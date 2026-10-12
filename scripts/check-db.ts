import { createTestBank } from '../tests/test-bank.js';
import assert from 'node:assert/strict';
const bank = await createTestBank();
assert.deepEqual(await bank.all('PRAGMA foreign_key_check'), []);
assert.equal((await bank.one('PRAGMA integrity_check'))?.integrity_check, 'ok');
assert.equal((await bank.taxonomy()).semesters.length, 2);
assert.equal(Number((await bank.one('SELECT COUNT(*) n FROM image_questions'))!.n), 0);
assert.equal(
  (await bank.all("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"))
    .length >= 10,
  true,
);
assert.equal((await bank.one('SELECT count(*) count FROM schema_migrations'))?.count, 6);
await bank.close();
console.log('Migration, relational integrity, indexes, and empty production seed: PASS');
