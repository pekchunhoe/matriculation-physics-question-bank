import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Request, Response } from 'express';
import { createApp } from '../server/app.js';
import { Bank } from '../server/database.js';
import { StudentService } from '../server/students.js';
import {
  EmailDeliveryFailure,
  ResendVerificationMailer,
  studentEmailConfiguration,
  type VerificationMessage,
  type VerificationMailer,
} from '../server/student-email.js';
import { applyMigrations, assertCurrentSchema } from '../server/migrations.js';
import { createTestBank } from './test-bank.js';
import { authenticatedFetch, seedAdminSession, testEmail } from './auth-fixture.js';
import { seedStudentSession } from './student-fixture.js';
import { imageEnvironment } from './image-fixture.js';
import { SQLiteAdapter } from '../server/sqlite-adapter.js';

const origin = 'https://student-test.vercel.app';
class Inbox implements VerificationMailer {
  configured = true;
  messages: VerificationMessage[] = [];
  failure?: 'FAILED' | 'UNKNOWN';
  hold?: () => Promise<void>;
  async send(message: VerificationMessage) {
    this.messages.push(message);
    await this.hold?.();
    if (this.failure) throw new EmailDeliveryFailure(this.failure);
  }
  token(index = this.messages.length - 1) {
    return new URLSearchParams(new URL(this.messages[index].url).hash.slice(1)).get('token')!;
  }
}
async function env(
  run: (e: {
    bank: Bank;
    service: StudentService;
    inbox: Inbox;
    actor: string;
    tick: (ms: number) => void;
    current: (id: string) => Promise<number>;
  }) => Promise<void>,
) {
  const bank = await createTestBank();
  await seedAdminSession(bank);
  const actor = String((await bank.one('SELECT id FROM admins WHERE email=?', testEmail))!.id),
    inbox = new Inbox();
  let now = Date.now();
  const service = new StudentService(bank, false, inbox, origin, () => now);
  try {
    await run({
      bank,
      service,
      inbox,
      actor,
      tick: (ms) => {
        now += ms;
      },
      current: async (id) =>
        Number((await bank.one('SELECT revision FROM students WHERE id=?', id))!.revision),
    });
  } finally {
    await bank.close();
  }
}
async function serve(bank: Bank, inbox: VerificationMailer, run: (base: string) => Promise<void>) {
  const server = createApp(bank, undefined, { studentEmail: { mailer: inbox, origin } }).listen(
    0,
    '127.0.0.1',
  );
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await run('http://127.0.0.1:' + address.port);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}
const post = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const request = (code: string, email: string) =>
  ({
    body: { email, code },
    headers: { host: 'localhost', origin: 'http://localhost', 'x-question-bank-request': '1' },
    socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as Request;
function response() {
  let cookie = '';
  return {
    res: {
      cookie(name: string, value: string) {
        cookie = name + '=' + value;
      },
      clearCookie() {},
    } as unknown as Response,
    cookie: () => cookie,
  };
}

test('Student registration preserves original email, normalizes uniqueness, is idempotent and stores only token digests', () =>
  env(async ({ bank, service, inbox, actor }) => {
    const rid = randomUUID(),
      s = await service.register(' Student@Example.invalid ', rid, actor);
    assert.equal(s.status, 'PENDING_VERIFICATION');
    assert.equal(s.email, 'Student@Example.invalid');
    assert.equal(s.deliveryState, 'SENT');
    assert.equal((await service.register('student@example.invalid', rid, actor)).id, s.id);
    assert.equal(inbox.messages.length, 1);
    await assert.rejects(
      service.register('STUDENT@example.invalid', randomUUID(), actor),
      /already registered/,
    );
    assert.equal(inbox.messages[0].to, 'Student@Example.invalid');
    assert.equal(new URL(inbox.messages[0].url).origin, origin);
    assert.equal(new URL(inbox.messages[0].url).search, '');
    assert.equal(Buffer.from(inbox.token(), 'base64url').length, 32);
    const row = await bank.one('SELECT * FROM student_email_challenges');
    assert.ok(row?.token_digest === createHash('sha256').update(inbox.token()).digest('hex'));
    assert.ok(!JSON.stringify(row).includes(inbox.token()));
    assert.equal((await bank.one('SELECT access_code_hash FROM students'))!.access_code_hash, null);
    assert.ok(!JSON.stringify(await service.list('', 1)).includes('token_digest'));
  }));
test('Invalid, expired, consumed tokens fail; verification is one-use and never creates sessions or codes', () =>
  env(async ({ bank, service, inbox, actor, tick }) => {
    const s = await service.register('one@example.invalid', randomUUID(), actor);
    await assert.rejects(service.verify('bad'), /invalid or expired/);
    await assert.rejects(service.verify('A'.repeat(43)), /invalid or expired/);
    await service.verify(inbox.token());
    await assert.rejects(service.verify(inbox.token()), /invalid or expired/);
    const row = await bank.one('SELECT * FROM students WHERE id=?', s.id);
    assert.equal(row?.status, 'VERIFIED_AWAITING_CODE');
    assert.ok(row?.email_verified_at);
    assert.equal(row?.access_code_hash, null);
    assert.equal((await bank.all('SELECT * FROM student_sessions')).length, 0);
    await service.register('expired@example.invalid', randomUUID(), actor);
    tick(86400000);
    await assert.rejects(service.verify(inbox.token()), /invalid or expired/);
  }));
test('Concurrent verification has exactly one winner', () =>
  env(async ({ service, inbox, actor }) => {
    await service.register('race@example.invalid', randomUUID(), actor);
    const outcomes = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.verify(inbox.token())),
    );
    assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1);
  }));
test('Resend supersedes only after success; failures retain the old usable challenge, cooldown and request deduplication apply', () =>
  env(async ({ service, inbox, actor, tick, current }) => {
    const s = await service.register('resend@example.invalid', randomUUID(), actor),
      first = inbox.token();
    await assert.rejects(service.send(s.id, s.revision, randomUUID(), actor), /Wait/);
    tick(60001);
    inbox.failure = 'FAILED';
    let next = await service.send(s.id, await current(s.id), randomUUID(), actor);
    assert.equal(next.deliveryState, 'FAILED');
    tick(60001);
    inbox.failure = undefined;
    const rid = randomUUID();
    next = await service.send(s.id, next.revision, rid, actor);
    await service.send(s.id, next.revision, rid, actor);
    assert.equal(inbox.messages.length, 3);
    await assert.rejects(service.verify(first), /invalid or expired/);
    await service.verify(inbox.token());
  }));
test('Failed and unknown delivery remain pending; accepted earlier link stays usable', () =>
  env(async ({ bank, service, inbox, actor, tick, current }) => {
    const s = await service.register('failure@example.invalid', randomUUID(), actor),
      first = inbox.token();
    for (const failure of ['FAILED', 'UNKNOWN'] as const) {
      inbox.failure = failure;
      tick(60001);
      const next = await service.send(s.id, await current(s.id), randomUUID(), actor);
      assert.equal(next.deliveryState, failure);
      assert.equal(next.status, 'PENDING_VERIFICATION');
      await assert.rejects(service.verify(inbox.token()), /invalid or expired/);
    }
    await service.verify(first);
    assert.equal(
      (await bank.one('SELECT status FROM students WHERE id=?', s.id))?.status,
      'VERIFIED_AWAITING_CODE',
    );
  }));
test('Missing provider does not send, verify or issue a code', () =>
  env(async ({ bank, actor }) => {
    const service = new StudentService(bank),
      s = await service.register('pending@example.invalid', randomUUID(), actor);
    assert.equal(s.deliveryState, 'NOT_SENT');
    assert.equal(s.status, 'PENDING_VERIFICATION');
    assert.equal((await bank.all('SELECT * FROM student_email_challenges')).length, 0);
    await assert.rejects(service.manage(s.id, s.revision, 'generate', actor), /verified/);
  }));
test('In-flight resend is bounded, duplicate requests do not send twice, and late delivery cannot undo verification', () =>
  env(async ({ service, inbox, actor, tick, current }) => {
    const s = await service.register('overlap@example.invalid', randomUUID(), actor),
      old = inbox.token();
    tick(60001);
    let release!: () => void, started!: () => void;
    const reached = new Promise<void>((r) => {
      started = r;
    });
    inbox.hold = () => {
      started();
      return new Promise<void>((r) => {
        release = r;
      });
    };
    const rid = randomUUID(),
      pending = service.send(s.id, await current(s.id), rid, actor);
    await reached;
    await service.send(s.id, await current(s.id), rid, actor);
    await assert.rejects(service.send(s.id, await current(s.id), randomUUID(), actor), /Wait/);
    await service.verify(old);
    release();
    await pending;
    assert.equal((await service.list('', 1)).items[0].status, 'VERIFIED_AWAITING_CODE');
    await assert.rejects(service.verify(inbox.token()), /invalid or expired/);
    assert.equal(inbox.messages.length, 2);
  }));
test('Interrupted acceptance leaves no usable challenge and can recover through bounded new resend', () =>
  env(async ({ bank, service, inbox, actor, tick, current }) => {
    const s = await service.register('interrupt@example.invalid', randomUUID(), actor);
    tick(60001);
    // Simulate process termination after provider acceptance but before delivery-finalization commit.
    await bank.run(
      "UPDATE student_email_challenges SET delivery_state='SENDING' WHERE student_id=?",
      s.id,
    );
    await bank.run(
      "UPDATE students SET delivery_state='SENDING',last_attempt_at=? WHERE id=?",
      Date.now(),
      s.id,
    );
    await assert.rejects(service.verify(inbox.token()), /invalid or expired/);
    tick(120001);
    await service.send(s.id, await current(s.id), randomUUID(), actor);
    await service.verify(inbox.token());
    assert.equal(
      (
        await bank.one(
          "SELECT COUNT(*) n FROM student_email_challenges WHERE delivery_state='UNKNOWN'",
        )
      )?.n,
      1,
    );
  }));
test('Daily account rate limit persists across service instances', () =>
  env(async ({ bank, service, inbox, actor, tick, current }) => {
    const s = await service.register('limits@example.invalid', randomUUID(), actor);
    for (let n = 1; n < 5; n++) {
      tick(60001);
      await service.send(s.id, await current(s.id), randomUUID(), actor);
    }
    const reloaded = new StudentService(bank, false, inbox, origin, () => Date.now() + 3600000);
    await assert.rejects(reloaded.send(s.id, await current(s.id), randomUUID(), actor), /Too many/);
    assert.equal(inbox.messages.length, 5);
  }));
test('Code generation requires verification, produces independent salted hashes, and cannot be retrieved from listings', () =>
  env(async ({ bank, service, inbox, actor, current }) => {
    const codes: string[] = [];
    for (const email of ['a@example.invalid', 'b@example.invalid']) {
      const s = await service.register(email, randomUUID(), actor);
      await assert.rejects(service.manage(s.id, s.revision, 'generate', actor));
      await service.verify(inbox.token());
      const result = await service.manage(s.id, await current(s.id), 'generate', actor);
      assert.ok(result.code && /^[A-Z2-9]{20}$/.test(result.code));
      codes.push(result.code!);
      assert.equal(result.student.status, 'ACTIVE');
    }
    assert.ok(codes[0] !== codes[1]);
    const rows = await bank.all('SELECT access_code_hash FROM students');
    assert.ok(rows.every((r) => String(r.access_code_hash).startsWith('scrypt$32768$8$3$')));
    assert.ok(codes.every((code) => !JSON.stringify(rows).includes(code)));
    assert.ok(!JSON.stringify(await service.list('', 1)).includes('scrypt'));
  }));
test('Pending and verified-without-code cannot log in; reset revokes old credentials and sessions without changing ID', () =>
  env(async ({ bank, service, inbox, actor, current }) => {
    const s = await service.register('login@example.invalid', randomUUID(), actor);
    await assert.rejects(
      service.login(request('invalid', s.email), response().res),
      /Invalid student credentials/,
    );
    await service.verify(inbox.token());
    await assert.rejects(
      service.login(request('invalid', s.email), response().res),
      /Invalid student credentials/,
    );
    const issued = await service.manage(s.id, await current(s.id), 'generate', actor),
      r = response();
    await service.login(request(issued.code!, s.email), r.res);
    const req = { headers: { cookie: r.cookie() } } as Request;
    assert.equal((await service.identity(req))?.id, s.id);
    const reset = await service.manage(s.id, await current(s.id), 'reset', actor);
    assert.equal(reset.student.id, s.id);
    assert.ok(reset.code !== issued.code);
    assert.equal(await service.identity(req), undefined);
    await assert.rejects(
      service.login(request(issued.code!, s.email), response().res),
      /Invalid student credentials/,
    );
    await service.login(request(reset.code!, s.email), response().res);
    assert.equal((await bank.all('SELECT * FROM students')).length, 1);
  }));
test('Disable, reactivate, revoke and email change immediately enforce identity and require fresh verification/code', () =>
  env(async ({ service, inbox, actor, current }) => {
    const s = await service.register('change@example.invalid', randomUUID(), actor);
    await service.verify(inbox.token());
    const issued = await service.manage(s.id, await current(s.id), 'generate', actor),
      r = response();
    await service.login(request(issued.code!, s.email), r.res);
    const req = { headers: { cookie: r.cookie() } } as Request;
    await service.manage(s.id, await current(s.id), 'revoke', actor);
    assert.equal(await service.identity(req), undefined);
    await service.login(request(issued.code!, s.email), r.res);
    req.headers.cookie = r.cookie();
    await service.manage(s.id, await current(s.id), 'disable', actor);
    assert.equal(await service.identity(req), undefined);
    await assert.rejects(service.login(request(issued.code!, s.email), response().res));
    const enabled = await service.manage(s.id, await current(s.id), 'reactivate', actor);
    assert.equal(enabled.student.status, 'VERIFIED_AWAITING_CODE');
    const next = await service.manage(s.id, await current(s.id), 'generate', actor);
    await service.login(request(next.code!, s.email), r.res);
    req.headers.cookie = r.cookie();
    const changed = await service.manage(
      s.id,
      await current(s.id),
      'email',
      actor,
      'replacement@example.invalid',
    );
    assert.equal(changed.student.id, s.id);
    assert.equal(changed.student.verifiedAt, null);
    assert.equal(changed.student.status, 'PENDING_VERIFICATION');
    assert.equal(await service.identity(req), undefined);
    await assert.rejects(service.manage(s.id, await current(s.id), 'generate', actor));
    await service.send(s.id, await current(s.id), randomUUID(), actor);
    await service.verify(inbox.token());
  }));
test('Concurrent code issuance commits one result; stale revisions never replace a newer code', () =>
  env(async ({ service, inbox, actor, current }) => {
    const s = await service.register('code-race@example.invalid', randomUUID(), actor);
    await service.verify(inbox.token());
    const rev = await current(s.id);
    const results = await Promise.allSettled([
      service.manage(s.id, rev, 'generate', actor),
      service.manage(s.id, rev, 'generate', actor),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    await assert.rejects(service.manage(s.id, rev, 'disable', actor), /changed/);
  }));
test('HTTP admin workflow, CSRF, scanner GET, explicit verification and student permissions', () =>
  env(async ({ bank, inbox }) => {
    await serve(bank, inbox, async (base) => {
      const admin = authenticatedFetch(await seedAdminSession(bank)),
        anon = authenticatedFetch('');
      assert.equal(
        (
          await anon(
            base + '/api/admin/students',
            post({ email: 'http@example.invalid', requestId: randomUUID() }),
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await admin(base + '/api/admin/students', {
            ...post({}),
            headers: { Cookie: await seedAdminSession(bank) },
          })
        ).status,
        400,
      );
      const created = await admin(
        base + '/api/admin/students',
        post({ email: 'http@example.invalid', requestId: randomUUID() }),
      );
      assert.equal(created.status, 201);
      const s = await created.json();
      for (const path of [
        '/api/questions',
        '/api/taxonomy',
        '/api/counts',
        '/api/curriculum-versions',
        '/api/public/question-set?ids=one',
        '/uploads/fake.jpg',
      ])
        assert.equal((await fetch(base + path)).status, 401);
      const token = inbox.token();
      assert.equal((await fetch(base + '/api/student-auth/verify-email')).status, 401);
      assert.equal(
        (await bank.one('SELECT status FROM students WHERE id=?', s.id))?.status,
        'PENDING_VERIFICATION',
      );
      assert.equal(
        (await fetch(base + '/api/student-auth/verify-email', post({ token }))).status,
        403,
      );
      const verified = await anon(base + '/api/student-auth/verify-email', post({ token }));
      assert.equal(verified.status, 200);
      assert.equal(verified.headers.get('set-cookie'), null);
      const list = await (await admin(base + '/api/admin/students')).json();
      assert.equal(list.items[0].status, 'VERIFIED_AWAITING_CODE');
      assert.ok(!JSON.stringify(list).includes(token));
      const generated = await admin(
        base + '/api/admin/students/' + s.id + '/generate',
        post({ revision: list.items[0].revision }),
      );
      const code = (await generated.json()).code;
      const signed = await anon(base + '/api/student-auth/login', post({ email: s.email, code }));
      assert.equal(signed.status, 200);
      const cookie = signed.headers.get('set-cookie')!;
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/);
      const student = authenticatedFetch(cookie.split(';')[0]);
      assert.equal((await student(base + '/api/taxonomy')).status, 200);
      for (const path of ['/api/admin/students', '/api/admin/legacy-questions'])
        assert.equal((await student(base + path)).status, 401);
      for (const action of [
        'send',
        'generate',
        'reset',
        'disable',
        'reactivate',
        'revoke',
        'email',
      ])
        assert.equal(
          (
            await student(
              base + '/api/admin/students/' + s.id + '/' + action,
              post({ revision: 1 }),
            )
          ).status,
          401,
        );
      assert.equal((await student(base + '/api/student-auth/logout', post({}))).status, 200);
      assert.equal((await student(base + '/api/questions')).status, 401);
    });
  }));
test('Student login throttling survives new runtime instances; forged and duplicate cookies fail', () =>
  env(async ({ bank, inbox }) => {
    for (let i = 0; i < 6; i++)
      await serve(bank, inbox, async (base) => {
        assert.equal(
          (
            await authenticatedFetch('')(
              base + '/api/student-auth/login',
              post({ email: 'unknown@example.invalid', code: 'invalid' }),
            )
          ).status,
          i < 5 ? 401 : 429,
        );
      });
    const service = new StudentService(bank);
    const cookie = await seedStudentSession(bank);
    assert.equal(
      await service.identity({ headers: { cookie: cookie + '; ' + cookie } } as Request),
      undefined,
    );
    assert.equal(
      await service.identity({ headers: { cookie: 'qb_student=' + 'A'.repeat(43) } } as Request),
      undefined,
    );
  }));
test('Resend adapter sanitizes failures, uses idempotency, and refuses unverified configuration', async () => {
  assert.equal(
    studentEmailConfiguration({
      STUDENT_EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'TEST_ONLY',
      STUDENT_EMAIL_FROM: 'sender@example.invalid',
    }).mailer.configured,
    false,
  );
  assert.equal(
    studentEmailConfiguration({
      STUDENT_EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'TEST_ONLY',
      STUDENT_EMAIL_FROM: 'sender@my.vercel.app',
      STUDENT_EMAIL_DOMAIN_VERIFIED: 'true',
    }).mailer.configured,
    false,
  );
  for (const status of [200, 400, 429, 500]) {
    let calls = 0;
    const mailer = new ResendVerificationMailer(
      'TEST_ONLY',
      'sender@example.invalid',
      async (input, init) => {
        calls++;
        assert.equal(String(input), 'https://api.resend.com/emails');
        assert.equal(new Headers(init?.headers).get('Idempotency-Key'), 'TEST_ID');
        assert.ok(!String(init?.body).includes('access_code'));
        return new Response(
          JSON.stringify(status === 200 ? { id: 'test' } : { error: 'PRIVATE_PROVIDER_DETAIL' }),
          { status },
        );
      },
    );
    const sending = mailer.send({
      to: 'student@example.invalid',
      url: origin + '/verify-email#token=TEST_ONLY',
      expiresAt: Date.now() + 86400000,
      idempotencyKey: 'TEST_ID',
    });
    if (status === 200) await sending;
    else
      await assert.rejects(
        sending,
        (e: unknown) => e instanceof EmailDeliveryFailure && !e.message.includes('PRIVATE'),
      );
    assert.equal(calls, 1);
  }
});
test('Migration 008 preserves every pre-existing table and admin hash; backup restoration and failed migration recovery work', async () => {
  const db = new SQLiteAdapter();
  await applyMigrations(db, { throughVersion: 7 });
  const e = await imageEnvironment(new Bank(db));
  try {
    await e.create();
    const tables = await e.bank.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const before = new Map<string, string>();
    for (const t of tables)
      before.set(
        String(t.name),
        JSON.stringify(await e.bank.all(`SELECT * FROM "${t.name}" ORDER BY 1`)),
      );
    const originalExec = db.exec.bind(db);
    db.exec = async (sql) => {
      await originalExec(sql);
      if (sql.includes('CREATE TABLE students')) throw new Error('TEST interruption');
    };
    await assert.rejects(applyMigrations(db), /interruption/);
    assert.equal(
      await e.bank.one("SELECT name FROM sqlite_master WHERE name='students'"),
      undefined,
    );
    await assertCurrentSchema(db, 7);
    db.exec = originalExec;
    await applyMigrations(db);
    await assertCurrentSchema(db);
    await applyMigrations(db);
    for (const [table, rows] of before)
      if (table !== 'schema_migrations')
        assert.ok(
          JSON.stringify(await e.bank.all(`SELECT * FROM "${table}" ORDER BY 1`)) === rows,
          table + ' preserved',
        );
    assert.equal((await e.bank.one('PRAGMA integrity_check'))?.integrity_check, 'ok');
    assert.equal((await e.bank.all('PRAGMA foreign_key_check')).length, 0);
    const after = await e.bank.one('SELECT COUNT(*) n FROM schema_migrations');
    assert.equal(after?.n, 8);
  } finally {
    await e.close();
  }
});
test('libSQL persisted challenges, verification, code and revocation survive separate service and connection lifetimes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'student-libsql-'));
  try {
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'tests/student-persistence-worker.ts', join(directory, 'isolated.db')],
      { encoding: 'utf8', timeout: 30000 },
    );
    assert.equal(child.status, 0, 'Isolated persistence subprocess passed');
    assert.equal(child.stdout, 'PASS');
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(directory.includes('student-libsql-'));
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
test('Manual links show once after persistence, stay pending, regenerate atomically and never appear in listings', () =>
  env(async ({ bank, actor, tick, current }) => {
    let now = Date.now();
    const service = new StudentService(bank, false, undefined, origin, () => now);
    const s = await service.register('manual@example.invalid', randomUUID(), actor),
      rid = randomUUID();
    const first = await service.manualLink(s.id, s.revision, rid, actor),
      token = new URLSearchParams(new URL(first.link).hash.slice(1)).get('token')!;
    assert.equal(first.student.status, 'PENDING_VERIFICATION');
    assert.equal(first.student.verifiedAt, null);
    assert.equal(first.student.deliveryState, 'MANUAL_READY');
    assert.ok(!JSON.stringify(await service.list('', 1)).includes(token));
    assert.ok(
      !JSON.stringify(await bank.all('SELECT * FROM student_email_challenges')).includes(token),
    );
    await assert.rejects(
      service.manualLink(s.id, await current(s.id), rid, actor),
      /cannot be retrieved/,
    );
    await assert.rejects(
      service.manualLink(s.id, await current(s.id), randomUUID(), actor),
      /Wait/,
    );
    now += 60001;
    tick(60001);
    const revision = await current(s.id);
    const results = await Promise.allSettled([
      service.manualLink(s.id, revision, randomUUID(), actor),
      service.manualLink(s.id, revision, randomUUID(), actor),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    await assert.rejects(service.verify(token), /invalid or expired/);
    const replacement = results.find((r) => r.status === 'fulfilled')! as PromiseFulfilledResult<
      Awaited<ReturnType<StudentService['manualLink']>>
    >;
    await service.verify(
      new URLSearchParams(new URL(replacement.value.link).hash.slice(1)).get('token'),
    );
    assert.equal((await service.list('', 1)).items[0].status, 'VERIFIED_AWAITING_CODE');
  }));
test('Maximum five registrations per Malaysia day is atomic and idempotent requests do not consume extra slots', () =>
  env(async ({ bank, actor }) => {
    let now = Date.parse('2026-10-13T15:59:00Z');
    const service = new StudentService(bank, false, undefined, origin, () => now);
    const rid = randomUUID();
    await service.register('day0@example.invalid', rid, actor);
    await service.register('day0@example.invalid', rid, actor);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        service.register('day' + (i + 1) + '@example.invalid', randomUUID(), actor),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 4);
    assert.equal((await service.list('', 1)).total, 5);
    now = Date.parse('2026-10-13T16:00:00Z');
    await service.register('nextday@example.invalid', randomUUID(), actor);
    assert.equal((await service.list('', 1)).total, 6);
  }));
