// Explicit test/recovery adapter. Production entry points never import this module.
import { DatabaseSync, type SQLInputValue as SQLiteValue } from 'node:sqlite';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseAdapter, QueryResult, Row, SQLInputValue } from './database-adapter.js';

export class SQLiteAdapter implements DatabaseAdapter {
  readonly kind = 'sqlite' as const;
  private readonly db: DatabaseSync;
  private readonly context = new AsyncLocalStorage<boolean>();
  private queue: Promise<void> = Promise.resolve();
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  }
  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
  async execute(sql: string, args: SQLInputValue[] = []): Promise<QueryResult> {
    const operation = async () => {
      const statement = this.db.prepare(sql);
      const values = args as SQLiteValue[];
      if (statement.columns().length) {
        const rows = statement.all(...values) as Row[];
        return { rows, rowsAffected: 0 };
      }
      const result = statement.run(...values);
      return { rows: [], rowsAffected: Number(result.changes) };
    };
    return this.context.getStore() ? operation() : this.exclusive(operation);
  }
  async exec(sql: string) {
    const operation = async () => {
      this.db.exec(sql);
    };
    if (this.context.getStore()) await operation();
    else await this.exclusive(operation);
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) throw new Error('Nested database transactions are not supported');
    return this.exclusive(async () => {
      this.db.exec('BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON;');
      try {
        const result = await this.context.run(true, fn);
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    });
  }
  async close() {
    await this.exclusive(async () => {
      this.db.close();
    });
  }
}
