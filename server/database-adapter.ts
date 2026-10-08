import type { InValue } from '@libsql/client';

export type SQLInputValue = InValue;
export type Row = Record<string, string | number | null>;
export type QueryResult = { rows: Row[]; rowsAffected: number };

export interface DatabaseAdapter {
  readonly kind: 'sqlite' | 'turso';
  execute(sql: string, args?: SQLInputValue[]): Promise<QueryResult>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
