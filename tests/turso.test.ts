import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { createClient as createWebClient } from '@libsql/client/web';
import type { Client, Config, ResultSet, Transaction, InStatement } from '@libsql/client';
import { Bank } from '../server/database.js';
import { TursoAdapter, tursoConfig } from '../server/turso-adapter.js';
import { applyMigrations, assertCurrentSchema } from '../server/migrations.js';
import { imageEnvironment } from './image-fixture.js';

test('Image pair and immutable history persist through the real libSQL SDK transaction adapter', async () => {
  const e = await imageEnvironment(await isolatedBank());
  try {
    const q = (await e.create()).question;
    await e.service.status(
      q.id,
      { status: 'approved', expectedRevision: 1, confirmed: true },
      e.actor,
    );
    const saved = (
      await e.service.save(
        q.id,
        { ...e.fixture(), expectedRevision: 2, confirmPublishedReplacement: true, totalMarks: 9 },
        {},
        e.actor,
      )
    ).question;
    assert.equal(saved.id, q.id);
    assert.equal(saved.revision, 3);
    assert.equal((await e.service.questionSet(q.id)).items[0].totalMarks, 9);
    assert.equal((await e.bank.all('SELECT * FROM image_question_versions')).length, 3);
    assert.deepEqual(await e.bank.all('PRAGMA foreign_key_check'), []);
  } finally {
    await e.close();
  }
});

// Every SDK integration client below is file::memory: or a mock. No test reads
// process.env, invokes the Turso CLI, or connects to the production database.
async function isolatedBank() {
  const adapter = new TursoAdapter(createClient({ url: 'file::memory:' }));
  try {
    await applyMigrations(adapter);
    return new Bank(adapter);
  } catch (error) {
    await adapter.close();
    throw error;
  }
}

function fakeResult(values: Record<string, string | number | null>, rowsAffected = 0) {
  return {
    columns: Object.keys(values),
    columnTypes: [],
    rows: [values],
    rowsAffected,
    lastInsertRowid: undefined,
  } as unknown as ResultSet;
}
function mockedClient(failCommit = false) {
  const events: string[] = [];
  let id = 0;
  const sql = (stmt: InStatement) => (typeof stmt === 'string' ? stmt : stmt.sql);
  const client = {
    async execute(stmt: InStatement) {
      events.push('outside:' + sql(stmt));
      return fakeResult({ owner: 'outside' });
    },
    async executeMultiple(text: string) {
      events.push('outside-multi:' + text);
    },
    async transaction(mode: string) {
      const owner = 'tx' + ++id;
      events.push(owner + ':begin:' + mode);
      return {
        async execute(stmt: InStatement) {
          events.push(owner + ':' + sql(stmt));
          return sql(stmt) === 'PRAGMA foreign_keys'
            ? fakeResult({ foreign_keys: 1 })
            : fakeResult({ owner }, sql(stmt).startsWith('INSERT') ? 1 : 0);
        },
        async executeMultiple(text: string) {
          events.push(owner + ':multi:' + text);
        },
        async commit() {
          events.push(owner + ':commit');
          if (failCommit) throw new Error('injected commit failure');
        },
        async rollback() {
          events.push(owner + ':rollback');
        },
        close() {
          events.push(owner + ':close');
        },
      } as unknown as Transaction;
    },
    close() {
      events.push('client:close');
    },
  } as unknown as Client;
  return { client, events };
}

test('Turso initialization validates server-only configuration without a SQLite fallback', async () => {
  for (const env of [
    {},
    { TURSO_DATABASE_URL: 'libsql://test.invalid' },
    { TURSO_AUTH_TOKEN: 'TEST_ONLY' },
    { VITE_TURSO_AUTH_TOKEN: 'TEST_ONLY' },
  ])
    assert.throws(() => tursoConfig(env), /required/);
  for (const url of [
    'file:test.sqlite',
    'http://test.invalid',
    'invalid',
    'https://user:pass@test.invalid',
    'https://localhost',
    'https://test.invalid?authToken=TEST_ONLY',
  ])
    assert.throws(
      () => tursoConfig({ TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: 'TEST_ONLY' }),
      /TURSO_DATABASE_URL/,
    );
  const { client, events } = mockedClient();
  let captured: Config | undefined;
  const adapter = TursoAdapter.fromEnvironment(
    { TURSO_DATABASE_URL: 'libsql://test.invalid', TURSO_AUTH_TOKEN: 'TEST_ONLY' },
    (config) => {
      captured = config;
      return client;
    },
  );
  assert.equal(captured?.url, 'libsql://test.invalid');
  assert.equal(captured?.authToken, 'TEST_ONLY');
  assert.equal(adapter.kind, 'turso');
  await adapter.close();
  assert.ok(events.includes('client:close'));
});

test('Turso transport failures reject awaited reads and never become false success', async () => {
  const client = createWebClient({
    url: 'https://test.invalid',
    authToken: 'TEST_ONLY',
    fetch: async () => {
      throw new Error('injected offline transport');
    },
  });
  const adapter = new TursoAdapter(client);
  try {
    await assert.rejects(adapter.execute('SELECT 1'));
  } finally {
    await adapter.close();
  }
});

test('Turso adapter executes parameterized queries/writes and returns plain named rows', async () => {
  const bank = await isolatedBank();
  try {
    assert.equal((await bank.one('SELECT ? AS value', 'TEST Ω'))?.value, 'TEST Ω');
    const result = await bank.run(
      'INSERT INTO tags(id,name,normalized) VALUES(?,?,?)',
      'test',
      'TEST',
      'test',
    );
    assert.equal(result.rowsAffected, 1);
    assert.deepEqual(await bank.all('SELECT id,name FROM tags'), [{ id: 'test', name: 'TEST' }]);
  } finally {
    await bank.close();
  }
});

test('Turso transactions keep concurrent request sessions separate and await commit', async () => {
  const { client, events } = mockedClient();
  const adapter = new TursoAdapter(client);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const a = adapter.transaction(async () => {
    const first = await adapter.execute('SELECT owner');
    entered();
    await gate;
    assert.equal((await adapter.execute('INSERT TEST')).rowsAffected, 1);
    return first.rows[0].owner;
  });
  await started;
  const outside = await adapter.execute('SELECT outside');
  const b = await adapter.transaction(
    async () => (await adapter.execute('SELECT owner')).rows[0].owner,
  );
  release();
  assert.equal(await a, 'tx1');
  assert.equal(b, 'tx2');
  assert.equal(outside.rows[0].owner, 'outside');
  assert.ok(events.includes('tx1:commit') && events.includes('tx2:commit'));
  assert.ok(!events.some((event) => event.includes('rollback')));
  await adapter.close();
});

test('Turso transactions roll back callback and commit failures and close their sessions', async () => {
  for (const failCommit of [false, true]) {
    const { client, events } = mockedClient(failCommit);
    const adapter = new TursoAdapter(client);
    await assert.rejects(
      adapter.transaction(async () => {
        await adapter.exec('INSERT TEST; UPDATE TEST;');
        if (!failCommit) throw new Error('injected callback failure');
      }),
      /injected/,
    );
    assert.ok(events.includes('tx1:rollback'));
    assert.ok(events.includes('tx1:close'));
    await adapter.close();
  }
});

test('libSQL migration runner is repeatable and validates the complete current runtime schema', async () => {
  const bank = await isolatedBank();
  try {
    const before = await bank.all('SELECT * FROM schema_migrations ORDER BY version');
    await applyMigrations(bank.db);
    assert.deepEqual(await bank.all('SELECT * FROM schema_migrations ORDER BY version'), before);
    await assertCurrentSchema(bank.db);
    await bank.run('DELETE FROM schema_migrations WHERE version=2');
    await assert.rejects(assertCurrentSchema(bank.db), /schema is not current/);
  } finally {
    await bank.close();
  }
});

test('Migration safety gate runs under the write transaction and blocks unexpected data before DDL', async () => {
  const adapter = new TursoAdapter(createClient({ url: 'file::memory:' }));
  const bank = new Bank(adapter);
  try {
    await adapter.exec(
      readFileSync(new URL('../server/migrations/001-foundation.sql', import.meta.url), 'utf8'),
    );
    await adapter.exec(
      "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL); INSERT INTO schema_migrations VALUES(1,'TEST_ONLY');",
    );
    await assert.rejects(
      applyMigrations(adapter, {
        beforeMigration: async (version) => {
          assert.equal(version, 2);
          await bank.run(
            'INSERT INTO tags VALUES(?,?,?)',
            'test-unexpected',
            'TEST ONLY unexpected',
            'test-unexpected',
          );
          throw new Error('Unexpected data: migration stopped');
        },
      }),
      /Unexpected data/,
    );
    assert.deepEqual(await bank.all('SELECT version FROM schema_migrations'), [{ version: 1 }]);
    assert.equal(
      await bank.one("SELECT name FROM sqlite_master WHERE name='curriculum_versions'"),
      undefined,
    );
    assert.deepEqual(await bank.all('SELECT * FROM tags'), []);
  } finally {
    await bank.close();
  }
});
