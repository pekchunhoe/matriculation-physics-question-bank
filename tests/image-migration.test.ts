import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SQLiteAdapter } from '../server/sqlite-adapter.js';
import { Bank } from '../server/database.js';
import { applyMigrations, assertCurrentSchema } from '../server/migrations.js';
import { imageEnvironment } from './image-fixture.js';
import { LocalAssetStorage } from '../server/local-asset-storage.js';
import { ImageQuestionService } from '../server/image-questions.js';

test('Migration 6 adds image structures without altering legacy records or inventing subtopics', async () => {
  const db = new SQLiteAdapter(':memory:');
  try {
    await applyMigrations(db, { throughVersion: 5 });
    await db.exec(
      "INSERT INTO chapters(id,semester_id,name,slug) VALUES('test-c','semester-1','TEST ONLY','test');INSERT INTO topics(id,chapter_id,name,slug) VALUES('test-t','test-c','TEST ONLY','test');INSERT INTO questions(id,question_code,topic_id,title,scenario,difficulty_id,question_type,total_marks,estimated_minutes,status,contains_diagram,contains_graph,contains_fbd,created_at,updated_at) VALUES('test-legacy','TEST-LEGACY','test-t','TEST ONLY legacy','Preserve Q = 500 J','medium','structured',5,10,'draft',0,0,0,'test','test');",
    );
    const tables = (
      await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='schema_migrations'",
      )
    ).rows;
    const before = new Map<string, unknown>();
    for (const row of tables)
      before.set(String(row.name), (await db.execute(`SELECT * FROM "${row.name}"`)).rows);
    await assert.rejects(() => assertCurrentSchema(db), /not current/);
    await applyMigrations(db);
    await assertCurrentSchema(db);
    for (const [table, rows] of before)
      assert.deepEqual((await db.execute(`SELECT * FROM "${table}"`)).rows, rows, table);
    assert.equal((await db.execute('SELECT COUNT(*) n FROM image_questions')).rows[0].n, 0);
    assert.equal((await db.execute('SELECT COUNT(*) n FROM subtopics')).rows[0].n, 0);
    await applyMigrations(db);
    assert.equal((await db.execute('SELECT COUNT(*) n FROM schema_migrations')).rows[0].n, 6);
  } finally {
    await db.close();
  }
});
test('Migration failure rolls back all version-6 DDL and is safely retryable', async () => {
  const db = new SQLiteAdapter(':memory:');
  try {
    await applyMigrations(db, { throughVersion: 5 });
    await db.exec('CREATE TABLE image_question_versions(test TEXT)');
    await assert.rejects(() => applyMigrations(db));
    assert.equal(
      (await db.execute("SELECT name FROM sqlite_master WHERE name='image_assets'")).rows.length,
      0,
    );
    assert.equal((await db.execute('SELECT MAX(version) n FROM schema_migrations')).rows[0].n, 5);
    await db.exec('DROP TABLE image_question_versions');
    await applyMigrations(db);
    await assertCurrentSchema(db);
  } finally {
    await db.close();
  }
});
test('Stable pair and image bytes survive closing and reopening an isolated file database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'qb-persistence-test-')),
    path = join(directory, 'isolated.sqlite');
  const adapter = new SQLiteAdapter(path);
  await applyMigrations(adapter);
  const e = await imageEnvironment(new Bank(adapter));
  let reopened: Bank | undefined;
  try {
    const q = (await e.create()).question;
    await e.bank.close();
    e.bank.close = async () => {};
    reopened = new Bank(new SQLiteAdapter(path));
    const service = new ImageQuestionService(reopened, new LocalAssetStorage(e.directory));
    assert.deepEqual(await service.get(q.id, true), q);
    assert.deepEqual((await e.storage.get(q.answerImage!.key))!.bytes, e.pair.answer.buffer);
    assert.equal((await reopened.all('PRAGMA foreign_key_check')).length, 0);
  } finally {
    await reopened?.close();
    await e.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('Explicit legacy conversion reuses the ID and preserves every original field', async () => {
  const e = await imageEnvironment();
  try {
    await e.bank.run(
      "INSERT INTO questions(id,question_code,topic_id,title,scenario,difficulty_id,question_type,total_marks,estimated_minutes,status,contains_diagram,contains_graph,contains_fbd,created_at,updated_at) VALUES('test-legacy','TEST-LEGACY',?,'TEST ONLY legacy','Preserve Q = 500 J','medium','structured',5,10,'draft',0,0,0,'test','test')",
      e.momentum,
    );
    const before = await e.bank.all('SELECT * FROM questions');
    const q = (
      await e.service.save(undefined, { ...e.fixture(), legacyId: 'test-legacy' }, e.pair, e.actor)
    ).question;
    assert.equal(q.id, 'test-legacy');
    assert.equal(q.legacyId, q.id);
    assert.equal(q.status, 'draft');
    assert.deepEqual(await e.bank.all('SELECT * FROM questions'), before);
    assert.deepEqual(await e.bank.legacyRecords(), []);
    await assert.rejects(
      () => e.service.save(undefined, { ...e.fixture(), legacyId: q.id }, e.pair, e.actor),
      /already converted/,
    );
  } finally {
    await e.close();
  }
});
