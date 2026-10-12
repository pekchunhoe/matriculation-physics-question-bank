import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import express, { type RequestHandler } from 'express';
import { createClient } from '@libsql/client';
import { createApp } from '../server/app.js';
import { AuthService, bootstrapAdmin, hashPassword } from '../server/auth.js';
import { Bank } from '../server/database.js';
import { applyMigrations } from '../server/migrations.js';
import { TursoAdapter } from '../server/turso-adapter.js';
import { setup } from './fixtures.js';
import { seedAdminSession, authenticatedFetch, testEmail, testPassword } from './auth-fixture.js';

const json = (data: unknown, headers: Record<string, string> = {}) => ({
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(data),
});
async function serve(handler: RequestHandler, callback: (base: string) => Promise<void>) {
  const app = express();
  app.use(handler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
async function environment(
  callback: (env: Awaited<ReturnType<typeof setup>> & { directory: string }) => Promise<void>,
) {
  const env = await setup(),
    directory = mkdtempSync(join(tmpdir(), 'physics-auth-test-'));
  try {
    await callback({ ...env, directory });
  } finally {
    await env.bank.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(directory.includes('physics-auth-test-'));
    rmSync(directory, { recursive: true, force: true });
  }
}
function login(
  base: string,
  email = testEmail,
  password = testPassword,
  headers: Record<string, string> = {},
) {
  return fetch(base + '/api/auth/login', {
    method: 'POST',
    ...json({ email, password }, { Origin: base, 'X-Question-Bank-Request': '1', ...headers }),
  });
}

test('Manual bootstrap persists salted scrypt only, enforces password bounds and refuses duplicate first admin', async () =>
  environment(async ({ bank }) => {
    await assert.rejects(bootstrapAdmin(bank, testEmail, 'short'));
    await assert.rejects(bootstrapAdmin(bank, 'invalid', testPassword));
    await bootstrapAdmin(bank, testEmail.toUpperCase(), testPassword);
    const rows = await bank.all('SELECT * FROM admins');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, testEmail);
    assert.match(String(rows[0].password_hash), /^scrypt\$32768\$8\$3\$/);
    assert.ok(!JSON.stringify(rows).includes(testPassword));
    assert.notEqual(await hashPassword(testPassword), rows[0].password_hash);
    await assert.rejects(
      bootstrapAdmin(bank, 'second@example.invalid', testPassword),
      /already exists/,
    );
    assert.equal((await bank.all('SELECT * FROM admin_sessions')).length, 0);
  }));

test('Valid login restores real server session, stores token digest only and logout revokes it', async () =>
  environment(async ({ bank }) => {
    await bootstrapAdmin(bank, testEmail, testPassword);
    await serve(createApp(bank, undefined), async (base) => {
      const response = await login(base);
      assert.equal(response.status, 200);
      const user = await response.json(),
        cookie = response.headers.get('set-cookie')!;
      assert.deepEqual(Object.keys(user).sort(), ['authenticated', 'user']);
      assert.deepEqual(Object.keys(user.user).sort(), ['email', 'id', 'role']);
      assert.equal(user.user.role, 'admin');
      assert.ok(!JSON.stringify(user).includes('scrypt'));
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/);
      assert.match(cookie, /Path=\//);
      assert.match(cookie, /Max-Age=28800/);
      assert.ok(!cookie.includes('Domain='));
      const pair = cookie.split(';')[0],
        token = pair.split('=')[1];
      assert.equal(Buffer.from(token, 'base64url').length, 32);
      const sessions = await bank.all('SELECT * FROM admin_sessions');
      assert.ok(!JSON.stringify(sessions).includes(token));
      assert.equal(sessions[0].token_digest, createHash('sha256').update(token).digest('hex'));
      const request = authenticatedFetch(pair);
      assert.deepEqual(await (await request(base + '/api/auth/session')).json(), user);
      assert.equal((await request(base + '/api/auth/logout', { method: 'POST' })).status, 200);
      assert.deepEqual(await (await request(base + '/api/auth/session')).json(), {
        authenticated: false,
      });
      assert.equal((await request(base + '/api/questions', { method: 'POST' })).status, 401);
      assert.ok((await bank.one('SELECT revoked_at FROM admin_sessions'))?.revoked_at);
    });
  }));

test('Unknown and incorrect credentials fail generically without identity enumeration or plaintext errors', async () =>
  environment(async ({ bank }) => {
    await bootstrapAdmin(bank, testEmail, testPassword);
    await serve(createApp(bank, undefined), async (base) => {
      const unknown = await login(base, 'unknown@example.invalid', 'wrong'),
        wrong = await login(base, testEmail, 'wrong');
      assert.equal(unknown.status, 401);
      assert.equal(wrong.status, 401);
      assert.deepEqual(await unknown.json(), await wrong.json());
      assert.equal((await bank.all('SELECT * FROM admin_sessions')).length, 0);
    });
  }));

test('Hosted cookies are Secure host-only sessions and proxy/client flags cannot weaken them', async () =>
  environment(async ({ bank }) => {
    await bootstrapAdmin(bank, testEmail, testPassword);
    await serve(createApp(bank, undefined, { hosted: true }), async (base) => {
      const response = await login(base, testEmail, testPassword, {
        Origin: base.replace('http:', 'https:'),
        'X-Forwarded-Proto': 'http',
      });
      assert.equal(response.status, 200);
      const cookie = response.headers.get('set-cookie')!;
      assert.match(cookie, /^__Host-qb_admin=/);
      assert.match(cookie, /Secure/);
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/);
      assert.ok(!cookie.includes('Domain='));
      assert.equal((await login(base)).status, 403);
    });
  }));

test('Expired, revoked, disabled, forged and duplicate-cookie sessions cannot authorize writes', async () =>
  environment(async ({ bank }) => {
    await serve(createApp(bank, undefined), async (base) => {
      const cookie = await seedAdminSession(bank),
        request = authenticatedFetch(cookie);
      assert.equal((await (await request(base + '/api/auth/session')).json()).authenticated, true);
      await bank.run('UPDATE admin_sessions SET expires_at=?', Date.now() - 1);
      assert.equal((await request(base + '/api/questions', { method: 'POST' })).status, 401);
      await seedAdminSession(bank);
      await bank.run('UPDATE admins SET disabled=1');
      assert.equal((await request(base + '/api/auth/session')).status, 200);
      assert.equal((await (await request(base + '/api/auth/session')).json()).authenticated, false);
      for (const raw of [
        'qb_admin=' + randomBytes(32).toString('base64url'),
        cookie + '; ' + cookie,
        'qb_admin=forged; role=admin',
      ])
        assert.equal(
          (await fetch(base + '/api/questions', { method: 'POST', headers: { Cookie: raw } }))
            .status,
          401,
        );
    });
  }));

test('Reauthentication rotates tokens and revokes the old session instead of accepting session fixation', async () =>
  environment(async ({ bank }) => {
    await bootstrapAdmin(bank, testEmail, testPassword);
    await serve(createApp(bank, undefined), async (base) => {
      const first = await login(base),
        old = first.headers.get('set-cookie')!.split(';')[0];
      const second = await login(base, testEmail, testPassword, { Cookie: old }),
        next = second.headers.get('set-cookie')!.split(';')[0];
      assert.notEqual(old, next);
      assert.deepEqual(await (await authenticatedFetch(old)(base + '/api/auth/session')).json(), {
        authenticated: false,
      });
      assert.equal(
        (await (await authenticatedFetch(next)(base + '/api/auth/session')).json()).authenticated,
        true,
      );
    });
  }));

test('CSRF rejects cross-site, same-host wrong scheme, absent/null Origin and missing custom header for login and admin writes', async () =>
  environment(async ({ bank }) => {
    const cookie = await seedAdminSession(bank);
    await serve(createApp(bank, undefined), async (base) => {
      for (const headers of [
        { Origin: 'https://attacker.invalid', 'X-Question-Bank-Request': '1' },
        { Origin: base.replace('http:', 'https:'), 'X-Question-Bank-Request': '1' },
        { Origin: 'null', 'X-Question-Bank-Request': '1' },
        { 'X-Question-Bank-Request': '1' },
        { Origin: base },
        { Origin: base, 'X-Question-Bank-Request': '1', 'Sec-Fetch-Site': 'cross-site' },
      ] as Record<string, string>[]) {
        const requestHeaders = { ...headers, Cookie: cookie };
        assert.equal(
          (await fetch(base + '/api/questions', { method: 'POST', ...json({}, requestHeaders) }))
            .status,
          403,
        );
        assert.equal(
          (await fetch(base + '/api/auth/login', { method: 'POST', ...json({}, requestHeaders) }))
            .status,
          403,
        );
      }
      assert.equal(Number((await bank.one('SELECT COUNT(*) n FROM image_questions'))!.n), 0);
      assert.equal((await bank.all('SELECT * FROM security_rate_limits')).length, 0);
    });
  }));

test('Durable account throttling survives new Express instances and rejects even a correct password after the limit', async () =>
  environment(async ({ bank }) => {
    await bootstrapAdmin(bank, testEmail, testPassword);
    for (let count = 0; count < 6; count++)
      await serve(createApp(bank, undefined), async (base) => {
        const response = await login(base, testEmail, count === 5 ? testPassword : 'wrong');
        assert.equal(response.status, count < 5 ? 401 : 429);
        assert.ok(!(await response.text()).includes(testEmail));
      });
    assert.equal((await bank.all('SELECT * FROM admin_sessions')).length, 0);
    assert.ok(
      (await bank.all('SELECT attempts FROM security_rate_limits')).some(
        (row) => row.attempts === 6,
      ),
    );
  }));

test('Distributed atomic throttle counters bound concurrent libSQL instances and reset only after the window', async () => {
  const adapter = new TursoAdapter(createClient({ url: 'file::memory:' })),
    bank = new Bank(adapter);
  await applyMigrations(adapter);
  try {
    let now = 1000;
    const services = [
      new AuthService(bank, false, () => now),
      new AuthService(bank, false, () => now),
    ];
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        services[index % 2].limit('TEST-attempts', 'one', 5, 60_000),
      ),
    );
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 5);
    assert.equal((await bank.one('SELECT attempts FROM security_rate_limits'))?.attempts, 10);
    now = 60_001;
    await services[0].limit('TEST-attempts', 'one', 5, 60_000);
    assert.equal((await bank.one('SELECT attempts FROM security_rate_limits'))?.attempts, 1);
  } finally {
    await bank.close();
  }
});

test('Public curriculum hides draft branches while authenticated admin can inspect and modify them', async () =>
  environment(async ({ bank }) => {
    const draft = await bank.curriculum.createVersion(
      {
        courseId: 'matriculation-physics',
        code: 'TEST-PRIVATE',
        name: 'TEST ONLY private curriculum',
        effectiveFrom: null,
        effectiveTo: null,
        status: 'draft',
        order: 1,
        cloneFromId: 'legacy-matriculation-physics',
      },
      'TEST ONLY',
      null,
    );
    const request = authenticatedFetch(await seedAdminSession(bank));
    await serve(createApp(bank, undefined), async (base) => {
      const publicTax = await (await fetch(base + '/api/taxonomy')).json();
      assert.ok(
        !publicTax.curriculumVersions.some((version: { id: string }) => version.id === draft.id),
      );
      assert.ok(
        !publicTax.semesters.some(
          (semester: { curriculumVersionId: string }) => semester.curriculumVersionId === draft.id,
        ),
      );
      const adminTax = await (await request(base + '/api/taxonomy')).json();
      assert.ok(
        adminTax.curriculumVersions.some((version: { id: string }) => version.id === draft.id),
      );
      const created = await request(base + '/api/taxonomy/chapters', {
        method: 'POST',
        ...json({ name: 'TEST ONLY admin chapter', parentId: 'semester-1' }),
      });
      assert.equal(created.status, 201);
      const { id } = await created.json();
      const impact = await (
        await request(base + '/api/taxonomy/chapters/' + id + '/impact')
      ).json();
      assert.equal(
        (
          await request(base + '/api/taxonomy/chapters/' + id, {
            method: 'PATCH',
            ...json({
              name: 'TEST ONLY renamed',
              note: 'TEST ONLY rename',
              expectedRevision: impact.revision,
              impactToken: impact.token,
              confirmImpact: true,
            }),
          })
        ).status,
        200,
      );
      assert.equal(
        (await request(base + '/api/taxonomy/chapters/' + id, { method: 'DELETE' })).status,
        409,
      );
    });
  }));

test('Authentication transport errors do not leak credentials, hashes, session values or raw exceptions', async (t) =>
  environment(async ({ bank }) => {
    const logs: unknown[][] = [];
    t.mock.method(console, 'error', (...values: unknown[]) => {
      logs.push(values);
    });
    t.mock.method(bank, 'run', async () => {
      throw new Error('TEST ONLY TURSO_AUTH_TOKEN secret URL libsql://secret.invalid');
    });
    await serve(createApp(bank, undefined), async (base) => {
      const response = await login(base);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'Unexpected server error' });
      assert.equal(response.headers.get('set-cookie'), null);
      assert.ok(!JSON.stringify(logs).includes('TURSO_AUTH_TOKEN'));
      assert.ok(!JSON.stringify(logs).includes('secret.invalid'));
    });
  }));
