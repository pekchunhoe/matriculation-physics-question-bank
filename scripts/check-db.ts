import assert from 'node:assert/strict';
import { Bank } from '../server/database.js';
const bank = new Bank();
assert.deepEqual(bank.all('PRAGMA foreign_key_check'), []);
assert.equal(bank.one('PRAGMA integrity_check')?.integrity_check, 'ok');
assert.equal(bank.taxonomy().semesters.length, 2);
assert.equal(bank.list().total, 0);
assert.equal(
  bank.all("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
    .length >= 10,
  true,
);
assert.equal(bank.one('SELECT count(*) count FROM schema_migrations')?.count, 2);
bank.close();
console.log('Migration, relational integrity, indexes, and empty production seed: PASS');
