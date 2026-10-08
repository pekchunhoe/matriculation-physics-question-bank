import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@libsql/client/web';
import type { Client, Config, Transaction } from '@libsql/client';
import type { DatabaseAdapter, QueryResult, Row, SQLInputValue } from './database-adapter.js';

export function tursoConfig(env: NodeJS.ProcessEnv): Config {
  const url = env.TURSO_DATABASE_URL?.trim();
  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('TURSO_DATABASE_URL must be a valid remote libSQL URL');
  }
  if (
    !['libsql:', 'https:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  )
    throw new Error('TURSO_DATABASE_URL must use a remote libsql:// or https:// endpoint');
  return { url, authToken, intMode: 'number' };
}

/** One remote client; AsyncLocalStorage keeps concurrent request transactions separate. */
export class TursoAdapter implements DatabaseAdapter {
  readonly kind = 'turso' as const;
  private readonly context = new AsyncLocalStorage<Transaction>();
  constructor(private readonly client: Client) {}

  static fromEnvironment(env = process.env, factory = createClient) {
    return new TursoAdapter(factory(tursoConfig(env)));
  }
  async execute(sql: string, args: SQLInputValue[] = []): Promise<QueryResult> {
    const connection = this.context.getStore() ?? this.client;
    const result = await connection.execute({ sql, args });
    return {
      rows: result.rows.map(
        (row) => Object.fromEntries(result.columns.map((column) => [column, row[column]])) as Row,
      ),
      rowsAffected: result.rowsAffected,
    };
  }
  async exec(sql: string) {
    await (this.context.getStore() ?? this.client).executeMultiple(sql);
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) throw new Error('Nested database transactions are not supported');
    const tx = await this.client.transaction('write');
    try {
      const result = await this.context.run(tx, async () => {
        const fk = await this.execute('PRAGMA foreign_keys');
        if (fk.rows[0]?.foreign_keys !== 1)
          throw new Error('Database foreign keys must be enabled');
        await this.exec('PRAGMA defer_foreign_keys=ON');
        return fn();
      });
      await tx.commit();
      return result;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {
        /* Closing the stream also rolls back. */
      }
      throw error;
    } finally {
      tx.close();
    }
  }
  async close() {
    this.client.close();
  }
}
