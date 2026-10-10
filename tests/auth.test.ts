import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import express, { type RequestHandler } from 'express';
import { createClient } from '@libsql/client';
import { createApp } from '../server/app.js';
import { createApiHandler } from '../server/vercel-handler.js';
import { AuthService, bootstrapAdmin, hashPassword } from '../server/auth.js';
import { Bank } from '../server/database.js';
import { LocalAssetStorage } from '../server/local-asset-storage.js';
import { applyMigrations, assertCurrentSchema } from '../server/migrations.js';
import { TursoAdapter } from '../server/turso-adapter.js';
import { validateUpload } from '../server/asset-validation.js';
import { VisibilityService } from '../server/visibility.js';
import { SQLiteAdapter } from '../server/sqlite-adapter.js';
import { spawnSync } from 'node:child_process';
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
      assert.equal((await bank.list()).total, 0);
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

test('Public lists/search/counts cannot reveal draft, reviewing, retired or source records through filters', async () =>
  environment(async ({ bank, fixture }) => {
    for (const status of ['draft', 'reviewing', 'approved', 'retired'] as const) {
      const doc = fixture('TEST-STATUS-' + status.toUpperCase());
      doc.question.status = status;
      doc.assets = [
        {
          id: 'source',
          partId: null,
          kind: 'original_pdf',
          url: 'https://example.invalid/PRIVATE-SOURCE.pdf',
          alt: 'source',
          mime: 'application/pdf',
          order: 0,
        },
      ];
      await bank.create(doc, 'TEST ONLY', null, status === 'approved');
    }
    await serve(createApp(bank, undefined), async (base) => {
      for (const query of [
        '',
        '?status=draft',
        '?status=reviewing&view=teacher&role=admin',
        '?status=retired&limit=100&page=1',
      ]) {
        const result = await (await fetch(base + '/api/questions' + query)).json();
        assert.equal(result.total, 1);
        assert.equal(result.items[0].status, 'approved');
        assert.equal(result.items[0].original_pdf, null);
        assert.ok(!JSON.stringify(result).includes('PRIVATE-SOURCE'));
      }
      assert.equal((await (await fetch(base + '/api/questions?q=reviewing')).json()).total, 0);
      const counts = await (await fetch(base + '/api/counts')).json();
      assert.equal(
        counts.reduce((sum: number, row: { count: number }) => sum + row.count, 0),
        1,
      );
    });
  }));

for (const status of ['draft', 'reviewing', 'retired'] as const)
  test(`Public direct ID, view flags, JSON export and history cannot reveal ${status} questions`, async () =>
    environment(async ({ bank, fixture }) => {
      const doc = fixture('TEST-HIDDEN-' + status.toUpperCase());
      doc.question.status = status;
      const { id } = await bank.create(doc, 'TEST ONLY');
      await serve(createApp(bank, undefined), async (base) => {
        for (const query of ['', '?view=teacher&admin=true', '?view=student']) {
          const response = await fetch(base + '/api/questions/' + id + query);
          assert.equal(response.status, 404);
          assert.ok(!(await response.text()).includes(doc.question.title));
        }
        for (const path of [
          '?version=1',
          '/export',
          '/export?provenance=true',
          '/versions',
          '/revisions',
        ])
          assert.equal((await fetch(base + '/api/questions/' + id + path)).status, 401);
      });
    }));

test('Approved public questions include schemes, marking points and hints while teacher notes and source PDFs stay private', async () =>
  environment(async ({ bank, fixture }) => {
    const doc = fixture('TEST-PUBLIC-ANSWERS');
    doc.assets = [
      {
        id: 'answer',
        partId: null,
        kind: 'answer_pdf',
        url: 'https://example.invalid/answer.pdf',
        alt: 'marking scheme',
        mime: 'application/pdf',
        order: 0,
      },
      {
        id: 'source',
        partId: null,
        kind: 'original_pdf',
        url: 'https://example.invalid/PRIVATE-SOURCE.pdf',
        alt: 'private',
        mime: 'application/pdf',
        order: 1,
      },
    ];
    const { id } = await bank.create(doc, 'TEST ONLY', null, true);
    await serve(createApp(bank, undefined), async (base) => {
      for (const query of ['', '?view=student', '?view=teacher']) {
        const response = await fetch(base + '/api/questions/' + id + query);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.document.solutions[0].solution, doc.solutions[0].solution);
        assert.equal(
          body.document.solutions[0].steps[0].markingPoint,
          doc.solutions[0].steps[0].markingPoint,
        );
        assert.equal(body.document.hints.length, 2);
        assert.equal(body.document.solutions[0].teacherNotes, '');
        assert.equal(body.document.assets.length, 1);
        assert.equal(body.metadata, undefined);
        assert.equal(body.savedClassification, undefined);
        assert.ok(!JSON.stringify(body).includes('PRIVATE TEACHER NOTE'));
        assert.ok(!JSON.stringify(body).includes('PRIVATE-SOURCE'));
      }
    });
  }));

test('All direct authoring methods and administrative read routes reject anonymous identity before database/storage side effects', async () =>
  environment(async ({ bank, fixture, momentum }) => {
    const { id } = await bank.create(fixture('TEST-AUTHORING'), 'TEST ONLY', null, true);
    await serve(createApp(bank, undefined), async (base) => {
      for (const [method, path] of [
        ['POST', '/questions'],
        ['PUT', '/questions/' + id],
        ['DELETE', '/questions/' + id],
        ['PATCH', '/questions/' + id],
        ['POST', '/import'],
        ['POST', '/import/validate'],
        ['POST', '/uploads'],
        ['POST', '/questions/' + id + '/pdf-revision'],
        ['POST', '/revisions/fake/review'],
        ['POST', '/taxonomy/topics'],
        ['PATCH', '/taxonomy/topics/' + momentum],
        ['DELETE', '/taxonomy/topics/' + momentum],
        ['POST', '/curriculum-versions'],
        ['PATCH', '/curriculum-versions/fake'],
        ['DELETE', '/curriculum-versions/fake'],
        ['POST', '/curriculum/import'],
        ['POST', '/curriculum/import/validate'],
      ])
        assert.equal(
          (
            await fetch(base + '/api' + path, {
              method,
              ...json(
                { role: 'admin', admin: true, document: fixture('TEST-ATTACK') },
                { Origin: base, 'X-Question-Bank-Request': '1' },
              ),
            })
          ).status,
          401,
          method + path,
        );
      for (const path of [
        '/questions/' + id + '/revisions',
        '/questions/' + id + '/versions',
        '/questions/' + id + '/export',
        '/taxonomy/topics/' + momentum + '/impact',
        '/curriculum-versions/legacy-matriculation-physics/impact',
        '/curriculum-versions/legacy-matriculation-physics/export',
      ])
        assert.equal((await fetch(base + '/api' + path)).status, 401, path);
      assert.equal((await bank.list()).total, 1);
      assert.equal((await bank.versions(id)).length, 1);
    });
  }));

test('Authenticated admin question, scheme and hint edits preserve immutable versions and explicit review safeguards', async () =>
  environment(async ({ bank, fixture }) => {
    const request = authenticatedFetch(await seedAdminSession(bank));
    await serve(createApp(bank, undefined), async (base) => {
      const doc = fixture('TEST-ADMIN-EDIT');
      doc.question.status = 'draft';
      const created = await request(base + '/api/questions', {
        method: 'POST',
        ...json({ document: doc, note: 'TEST ONLY draft' }),
      });
      assert.equal(created.status, 201);
      const { id } = await created.json();
      doc.solutions[0].solution = 'TEST ONLY edited scheme';
      doc.hints[0].text = 'TEST ONLY edited hint';
      doc.question.status = 'approved';
      const pending = await request(base + '/api/questions/' + id, {
        method: 'PUT',
        ...json({ document: doc, note: 'TEST ONLY approval', baseVersion: 1 }),
      });
      const candidate = await pending.json();
      assert.equal(candidate.pending, true);
      assert.equal((await fetch(base + '/api/questions/' + id)).status, 404);
      assert.equal(
        (
          await request(base + '/api/revisions/' + candidate.candidateId + '/review', {
            method: 'POST',
            ...json({ approve: true, reviewer: 'TEST ONLY authenticated reviewer' }),
          })
        ).status,
        200,
      );
      const publicDoc = await (await fetch(base + '/api/questions/' + id)).json();
      assert.equal(publicDoc.document.solutions[0].solution, doc.solutions[0].solution);
      assert.equal(publicDoc.document.hints[0].text, doc.hints[0].text);
      assert.equal((await bank.document(id, 1)).question.status, 'draft');
      doc.question.status = 'retired';
      const retirement = await (
        await request(base + '/api/questions/' + id, {
          method: 'PUT',
          ...json({ document: doc, note: 'TEST ONLY retire', baseVersion: 2 }),
        })
      ).json();
      assert.equal(
        (
          await request(base + '/api/revisions/' + retirement.candidateId + '/review', {
            method: 'POST',
            ...json({ approve: true, reviewer: 'TEST ONLY reviewer' }),
          })
        ).status,
        200,
      );
      assert.equal((await fetch(base + '/api/questions/' + id)).status, 404);
      assert.equal((await request(base + '/api/questions/' + id)).status, 200);
      assert.equal(
        (await request(base + '/api/questions/' + id, { method: 'DELETE' })).status,
        404,
      );
    });
  }));

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

test('Asset authorization serves approved diagrams and schemes, retains private sources, drafts, retired/history/candidates and staged files', async () =>
  environment(async ({ bank, fixture, directory }) => {
    const storage = new LocalAssetStorage(directory),
      request = authenticatedFetch(await seedAdminSession(bank));
    const source = await storage.put(
      validateUpload(Buffer.from('%PDF-1.7\nTEST ONLY source'), 'source.pdf'),
    );
    const draftUpload = await storage.put(
      validateUpload(Buffer.from('<svg><path d="M0 0L1 1"/></svg>'), 'draft.svg'),
    );
    const publicUpload = await storage.put(
      validateUpload(Buffer.from('<svg><path d="M0 0L2 2"/></svg>'), 'public.svg'),
    );
    const answer = await storage.put(
      validateUpload(Buffer.from('%PDF-1.7\nTEST ONLY answer'), 'answer.pdf'),
    );
    const doc = fixture('TEST-ASSET-POLICY');
    doc.assets = [
      {
        id: 'diagram',
        partId: null,
        kind: 'physics_diagram',
        url: publicUpload.url,
        mime: publicUpload.mime,
        alt: 'diagram',
        order: 0,
      },
      {
        id: 'scheme',
        partId: null,
        kind: 'answer_pdf',
        url: answer.url,
        mime: answer.mime,
        alt: 'scheme',
        order: 1,
      },
      {
        id: 'source',
        partId: null,
        kind: 'original_pdf',
        url: source.url,
        mime: source.mime,
        alt: 'private source',
        order: 2,
      },
    ];
    const { id } = await bank.create(doc, 'TEST ONLY', null, true);
    const draft = fixture('TEST-DRAFT-ASSET');
    draft.question.status = 'draft';
    draft.assets = [{ ...doc.assets[0], url: draftUpload.url }];
    await bank.create(draft, 'TEST ONLY draft');
    await serve(createApp(bank, storage), async (base) => {
      for (const upload of [publicUpload, answer]) {
        const response = await fetch(base + upload.url);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('cache-control')!, /no-store/);
        assert.ok(!(await response.text()).includes('blob.vercel-storage.com'));
      }
      for (const upload of [source, draftUpload]) {
        assert.equal((await fetch(base + upload.url + '?role=admin&view=teacher')).status, 404);
        assert.equal((await request(base + upload.url)).status, 200);
      }
      const revision = structuredClone(doc);
      revision.assets = [{ ...doc.assets[0], url: draftUpload.url }];
      await bank.save(id, revision, 'TEST ONLY private candidate', 1);
      assert.equal((await fetch(base + draftUpload.url)).status, 404);
      // Once the owning current question is retired, even old approved assets are private.
      await bank.run("UPDATE questions SET status='retired' WHERE id=?", id);
      assert.equal((await fetch(base + publicUpload.url)).status, 404);
      assert.equal((await request(base + publicUpload.url)).status, 200);
      const staged = await storage.put(
        validateUpload(Buffer.from('%PDF-1.7\nTEST ONLY staged'), 'staged.pdf'),
      );
      assert.equal((await fetch(base + staged.url)).status, 404);
      assert.equal((await request(base + staged.url)).status, 200);
      assert.equal((await fetch(base + '/uploads/%2e%2e%2fsecret.pdf')).status, 400);
    });
  }));

test('Hosted authenticated uploads keep validation and fit the platform body limit without local persistence', async () =>
  environment(async ({ bank, directory }) => {
    const calls: string[] = [],
      entries = new Map<string, Buffer>();
    const storage = {
      kind: 'vercel-private-blob' as const,
      put: async (upload: ReturnType<typeof validateUpload>) => {
        calls.push('put');
        const key = 'TEST-internal.pdf';
        entries.set(key, upload.bytes);
        return {
          key,
          url: '/uploads/' + key,
          name: upload.displayName,
          mime: upload.mime,
          size: upload.bytes.length,
          sha256: upload.sha256,
          uploadedAt: new Date(),
        };
      },
      get: async () => {
        calls.push('get');
        return undefined;
      },
      metadata: async () => undefined,
      exists: async () => false,
      delete: async () => {},
    };
    const cookie = await seedAdminSession(bank, true);
    await serve(
      createApiHandler(
        async () => bank,
        () => storage,
      ),
      async (base) => {
        const send = (bytes: BlobPart, name = 'test.pdf') => {
          const data = new FormData();
          data.append('file', new Blob([bytes], { type: 'application/octet-stream' }), name);
          return fetch(base + '/api/uploads', {
            method: 'POST',
            headers: {
              Cookie: cookie,
              Origin: base.replace('http:', 'https:'),
              'X-Question-Bank-Request': '1',
            },
            body: data,
          });
        };
        assert.equal((await fetch(base + '/api/uploads', { method: 'POST' })).status, 401);
        assert.equal((await send('%PDF-1.7\nTEST ONLY')).status, 201);
        assert.equal((await send('<svg><script>alert(1)</script></svg>', 'bad.svg')).status, 400);
        assert.equal((await send(new Uint8Array(3 * 1024 * 1024 + 1))).status, 413);
        assert.equal(calls.length, 1);
        assert.deepEqual(readdirSync(directory), []);
      },
    );
  }));

test('Public question sets preserve requested order, schemes and hints without source notes or authoring records', async () =>
  environment(async ({ bank, fixture }) => {
    const a = await bank.create(fixture('TEST-SET-A'), 'TEST ONLY', null, true),
      b = await bank.create(fixture('TEST-SET-B'), 'TEST ONLY', null, true);
    await serve(createApp(bank, undefined), async (base) => {
      const response = await fetch(
        base + `/api/public/question-set?ids=${b.id},${a.id}&answers=true&hints=true`,
      );
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.deepEqual(
        result.items.map((item: { id: string }) => item.id),
        [b.id, a.id],
      );
      assert.equal(result.items[0].document.solutions.length, 1);
      assert.equal(result.items[0].document.hints.length, 2);
      assert.ok(!JSON.stringify(result).includes('PRIVATE TEACHER NOTE'));
      const questions = await (await fetch(base + `/api/public/question-set?ids=${a.id}`)).json();
      assert.equal(questions.items[0].document.solutions.length, 0);
      assert.equal(questions.items[0].document.hints.length, 0);
      assert.equal((await bank.versions(a.id)).length, 1);
    });
  }));

test('Public print/PDF resources reject hidden IDs for anonymous and admin, invalid options, oversized and duplicate selections', async () =>
  environment(async ({ bank, fixture }) => {
    const publicId = (await bank.create(fixture('TEST-PDF-PUBLIC'), 'TEST ONLY', null, true)).id;
    const hidden = fixture('TEST-PDF-HIDDEN');
    hidden.question.status = 'draft';
    const hiddenId = (await bank.create(hidden, 'TEST ONLY')).id;
    const request = authenticatedFetch(await seedAdminSession(bank));
    await serve(createApp(bank, undefined), async (base) => {
      for (const client of [fetch, request]) {
        assert.equal(
          (
            await client(
              base + `/api/public/question-set?ids=${publicId},${hiddenId}&answers=true&role=admin`,
            )
          ).status,
          404,
        );
        assert.equal(
          (await client(base + `/api/public/question-set?ids=${publicId},${publicId}`)).status,
          400,
        );
        assert.equal(
          (await client(base + `/api/public/question-set?ids=${publicId}&answers=arbitrary`))
            .status,
          400,
        );
        assert.equal(
          (
            await client(
              base +
                '/api/public/question-set?ids=' +
                Array.from({ length: 21 }, (_, n) => 'TEST-' + n).join(','),
            )
          ).status,
          400,
        );
      }
    });
  }));

test('Public print limits persist across requests instead of relying on client-side controls', async () =>
  environment(async ({ bank, fixture }) => {
    const { id } = await bank.create(fixture('TEST-PDF-LIMIT'), 'TEST ONLY', null, true);
    await serve(createApp(bank, undefined), async (base) => {
      for (let index = 0; index < 21; index++)
        assert.equal(
          (await fetch(base + '/api/public/question-set?ids=' + id)).status,
          index < 20 ? 200 : 429,
        );
    });
  }));

test('Migration 003 is additive, transactional, repeatable, leaves admins empty and schema checks never apply missing DDL', async () => {
  const adapter = new TursoAdapter(createClient({ url: 'file::memory:' })),
    bank = new Bank(adapter);
  try {
    await adapter.exec(
      'CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)',
    );
    for (const version of ['001-foundation', '002-curriculum']) {
      await adapter.exec(
        readFileSync(new URL(`../server/migrations/${version}.sql`, import.meta.url), 'utf8'),
      );
      await bank.run(
        'INSERT INTO schema_migrations VALUES(?,?)',
        Number(version.slice(0, 3)),
        'TEST ONLY',
      );
    }
    const original = await bank.all('SELECT * FROM semesters');
    await assert.rejects(assertCurrentSchema(adapter), /schema is not current/);
    assert.equal(await bank.one("SELECT name FROM sqlite_master WHERE name='admins'"), undefined);
    await assert.rejects(
      applyMigrations(adapter, {
        beforeMigration: async () => {
          throw new Error('TEST ONLY abort');
        },
      }),
      /abort/,
    );
    assert.equal(await bank.one("SELECT name FROM sqlite_master WHERE name='admins'"), undefined);
    await applyMigrations(adapter);
    await assertCurrentSchema(adapter);
    await applyMigrations(adapter);
    assert.deepEqual(await bank.all('SELECT * FROM semesters'), original);
    assert.deepEqual(await bank.all('SELECT * FROM admins'), []);
    assert.deepEqual(await bank.all('SELECT version FROM schema_migrations'), [
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
    ]);
    assert.deepEqual(await bank.all('PRAGMA foreign_key_check'), []);
  } finally {
    await bank.close();
  }
});

test('Browser sources contain no server credentials or direct database/blob SDK access', () => {
  const files = [
    'main.tsx',
    'api.ts',
    'Auth.tsx',
    'Browser.tsx',
    'Preview.tsx',
    'QuestionSet.tsx',
    'Editor.tsx',
    'Curriculum.tsx',
    'CurriculumTools.tsx',
    'Importer.tsx',
    'QuestionJsonImporter.tsx',
    'question-import-preparation.ts',
  ];
  for (const file of files)
    assert.doesNotMatch(
      readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'),
      /TURSO_AUTH_TOKEN|TURSO_DATABASE_URL|VERCEL_OIDC_TOKEN|BLOB_READ_WRITE_TOKEN|BLOB_STORE_ID|@libsql\/client|@vercel\/blob/,
    );
});

test('Manual CLI audits without migration, applies only explicitly to a scratch baseline, and rejects unsafe bootstrap inputs', async () =>
  environment(async ({ directory }) => {
    const path = join(directory, 'admin-tool-test.sqlite');
    const baseline = new SQLiteAdapter(path);
    await baseline.exec(
      'CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)',
    );
    for (const name of ['001-foundation', '002-curriculum']) {
      await baseline.exec(
        readFileSync(new URL(`../server/migrations/${name}.sql`, import.meta.url), 'utf8'),
      );
      await baseline.execute('INSERT INTO schema_migrations VALUES(?,?)', [
        Number(name.slice(0, 3)),
        'TEST ONLY',
      ]);
    }
    await baseline.close();
    const env = { ...process.env };
    for (const name of [
      'TURSO_DATABASE_URL',
      'TURSO_AUTH_TOKEN',
      'BLOB_STORE_ID',
      'BLOB_READ_WRITE_TOKEN',
      'VERCEL_OIDC_TOKEN',
      'NODE_OPTIONS',
    ])
      delete env[name];
    const command = (...args: string[]) =>
      spawnSync(process.execPath, ['--import', 'tsx', 'scripts/auth-admin.ts', ...args], {
        env,
        encoding: 'utf8',
        timeout: 30_000,
      });
    const audit = command('migrate', '--local', path);
    assert.equal(audit.status, 0);
    assert.match(audit.stdout, /No schema changes/);
    const unchanged = new SQLiteAdapter(path);
    try {
      assert.equal(
        (await unchanged.execute("SELECT name FROM sqlite_master WHERE name='admins'")).rows.length,
        0,
      );
    } finally {
      await unchanged.close();
    }
    const applied = command('migrate', '--local', path, '--apply');
    assert.equal(applied.status, 0);
    const current = new SQLiteAdapter(path);
    try {
      await assertCurrentSchema(current, 3);
      assert.equal(
        (
          await current.execute(
            "SELECT name FROM sqlite_master WHERE name='question_import_receipts'",
          )
        ).rows.length,
        0,
      );
      assert.deepEqual((await current.execute('SELECT * FROM admins')).rows, []);
    } finally {
      await current.close();
    }
    assert.equal(
      command(
        'bootstrap',
        '--local',
        'data/bank.sqlite',
        '--email',
        testEmail,
        '--create-first-admin',
      ).status,
      1,
    );
    const unsafe = command(
      'bootstrap',
      '--local',
      path,
      '--email',
      testEmail,
      '--create-first-admin',
      '--password',
      'TEST ONLY DO NOT ECHO',
    );
    assert.equal(unsafe.status, 1);
    assert.ok(!unsafe.stderr.includes('TEST ONLY DO NOT ECHO'));
    const hidden = command(
      'bootstrap',
      '--local',
      path,
      '--email',
      testEmail,
      '--create-first-admin',
    );
    assert.equal(hidden.status, 1);
    assert.match(hidden.stderr, /interactive terminal/);
  }));

test('Public visibility fails closed when question status disagrees with its active immutable snapshot', async () =>
  environment(async ({ bank, fixture }) => {
    const doc = fixture('TEST-INCONSISTENT');
    doc.question.status = 'draft';
    const { id } = await bank.create(doc, 'TEST ONLY draft');
    await bank.run("UPDATE questions SET status='approved' WHERE id=?", id);
    const visibility = new VisibilityService(bank);
    await assert.rejects(visibility.approved(id), /not found/);
    assert.equal((await visibility.list({})).total, 0);
    assert.equal(
      (await bank.counts(undefined, true)).reduce((sum, row) => sum + Number(row.count), 0),
      0,
    );
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

test('Public asset sharing is granted only by a current approved relationship, independently of filename and preview flags', async () =>
  environment(async ({ bank, fixture }) => {
    const reference = '/uploads/TEST-shared.pdf',
      visibility = new VisibilityService(bank);
    const doc = fixture('TEST-SHARED');
    doc.question.status = 'draft';
    doc.assets = [
      {
        id: 'shared',
        partId: null,
        kind: 'answer_pdf',
        url: reference,
        alt: 'shared',
        mime: 'application/pdf',
        order: 0,
      },
    ];
    await bank.create(doc, 'TEST ONLY');
    assert.equal(await visibility.publicAsset(reference), false);
    const approved = structuredClone(doc);
    approved.question.questionCode = 'TEST-SHARED-PUBLIC';
    approved.question.status = 'approved';
    const { id } = await bank.create(approved, 'TEST ONLY publish', null, true);
    assert.equal(await visibility.publicAsset(reference), true);
    await bank.run("UPDATE questions SET status='retired' WHERE id=?", id);
    assert.equal(await visibility.publicAsset(reference), false);
  }));
