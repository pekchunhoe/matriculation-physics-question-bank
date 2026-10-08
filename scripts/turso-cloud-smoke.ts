import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { connectRuntimeBank } from '../server/runtime.js';
import { createApp } from '../server/app.js';
import { setup } from '../tests/fixtures.js';
import type { Bank } from '../server/database.js';

const targetIndex = process.argv.indexOf('--target');
const target = process.argv[targetIndex + 1];
if (targetIndex < 0 || !/^physics-bank-runtime-smoke-[a-z0-9-]+$/.test(target))
  throw new Error('Smoke test requires an explicitly named disposable scratch database');
const url = new URL(process.env.TURSO_DATABASE_URL ?? '');
if (!url.hostname.startsWith(target + '-') || !url.hostname.endsWith('.turso.io'))
  throw new Error('Smoke-test credential URL does not match the scratch target');
const outputIndex = process.argv.indexOf('--output');
if (outputIndex < 0) throw new Error('Explicit --output evidence path required');
const output = process.argv[outputIndex + 1];
let bank!: Bank;
const checks: Record<string, boolean> = {};
try {
  bank = await connectRuntimeBank();
  assert.equal((await bank.list()).total, 0);
  const { fixture } = await setup(bank);
  const doc = fixture('TEST-ONLY-CLOUD-DRAFT');
  doc.question.status = 'draft';
  const q = await bank.create(doc, 'TEST ONLY disposable scratch draft');
  checks.create = true;
  await bank.close();
  bank = await connectRuntimeBank();
  assert.deepEqual(await bank.document(q.id), doc);
  checks.persistentReadAcrossConnections = true;
  doc.question.title = 'TEST ONLY cloudsdkreplacement';
  await bank.save(q.id, doc, 'TEST ONLY disposable update', 1);
  assert.equal(
    (await bank.list({ q: 'cloudsdkreplacement', semester: 'semester-1', difficulty: 'hard' }))
      .total,
    1,
  );
  assert.equal((await bank.versions(q.id)).length, 2);
  checks.update = true;
  checks.search = true;
  await bank.refreshSearch();
  assert.equal((await bank.all('SELECT * FROM question_search')).length, 1);
  checks.refreshSearch = true;
  await bank.transaction(async () => {
    await bank.run(
      'INSERT INTO tags(id,name,normalized) VALUES(?,?,?)',
      'test-disposable-tag',
      'TEST ONLY tag',
      'test-disposable-tag',
    );
  });
  await bank.close();
  bank = await connectRuntimeBank();
  assert.ok(await bank.one('SELECT id FROM tags WHERE id=?', 'test-disposable-tag'));
  await bank.run('DELETE FROM tags WHERE id=?', 'test-disposable-tag');
  assert.equal(await bank.one('SELECT id FROM tags WHERE id=?', 'test-disposable-tag'), undefined);
  checks.persistentDelete = true;
  const before = (await bank.list()).total;
  await assert.rejects(
    bank.transaction(async () => {
      await bank.run(
        'INSERT INTO tags(id,name,normalized) VALUES(?,?,?)',
        'test-rollback-tag',
        'TEST ONLY rollback',
        'test-rollback-tag',
      );
      throw new Error('TEST ONLY rollback');
    }),
    /rollback/,
  );
  assert.equal(await bank.one('SELECT id FROM tags WHERE id=?', 'test-rollback-tag'), undefined);
  assert.equal((await bank.list()).total, before);
  checks.rollback = true;
  const server = createApp(bank, undefined).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    assert.deepEqual(await (await fetch(base + '/api/health')).json(), {
      status: 'ok',
      database: 'connected',
    });
    assert.equal((await fetch(base + '/api/questions', { method: 'POST' })).status, 401);
    checks.health = true;
    checks.hostedWriteProtection = true;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  assert.equal((await bank.current(q.id)).status, 'draft');
  writeFileSync(
    output,
    JSON.stringify(
      { target, checks, onlyDisposableDrafts: true, productionTouched: false },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Isolated cloud persistent create/read/update/delete, FTS, rollback and health: PASS',
  );
} catch {
  console.error(
    'Isolated cloud smoke test failed; no secrets logged. Scratch database must be cleaned up.',
  );
  process.exitCode = 1;
} finally {
  if (bank) await bank.close();
}
