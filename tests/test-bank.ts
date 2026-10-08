import { Bank } from '../server/database.js';
import { SQLiteAdapter } from '../server/sqlite-adapter.js';
import { applyMigrations } from '../server/migrations.js';

/** Always explicit local SQLite; never reads TURSO_* or connects to production. */
export async function createTestBank(path = ':memory:') {
  const adapter = new SQLiteAdapter(path);
  try {
    await applyMigrations(adapter);
    return new Bank(adapter);
  } catch (error) {
    await adapter.close();
    throw error;
  }
}
