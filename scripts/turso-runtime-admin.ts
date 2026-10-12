import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Bank } from '../server/database.js';
import { TursoAdapter } from '../server/turso-adapter.js';
import { SQLiteAdapter } from '../server/sqlite-adapter.js';
import { applyMigrations, assertCurrentSchema } from '../server/migrations.js';
import type { Row } from '../server/database-adapter.js';

class AuditError extends Error {}

const target = 'matriculation-physics-question-bank';
const args = process.argv.slice(2);
const value = (name: string) => args[args.indexOf(name) + 1];
if (!args.includes('--target') || value('--target') !== target || !args.includes('--output-dir'))
  throw new AuditError(
    'Explicit --target matriculation-physics-question-bank and new --output-dir are required',
  );
const output = resolve(value('--output-dir'));
if (existsSync(output))
  throw new AuditError('Choose a new artifact directory; existing evidence is immutable');
const apply = args.includes('--apply');
const url = new URL(process.env.TURSO_DATABASE_URL ?? '');
if (!url.hostname.startsWith(target + '-') || !url.hostname.endsWith('.turso.io'))
  throw new AuditError('Credential endpoint does not identify the explicit production target');
const source = resolve('data/turso-migration/applied-20261008/source-audit.json');
const baseline = JSON.parse(readFileSync(source, 'utf8')) as {
  app_schema: unknown[][];
  autoindexes: unknown[][];
  shadow_tables: string[];
  normal_tables: string[];
  virtual_tables: string[];
  tables: Record<string, { columns: string[]; select: string; count: number; sha256: string }>;
};
const protectedPaths = [
  'D:/Physics Apps/Database Backups/QuestionBank-checkpointed-for-Turso',
  'data/bank.sqlite',
  'data/bank.sqlite-wal',
  'data/bank.sqlite-shm',
  'data/uploads',
  'data/turso-migration',
];
function fingerprints() {
  const records: Record<string, object> = {};
  function visit(path: string) {
    if (!existsSync(path)) return;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(join(path, name));
    } else
      records[path] = {
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
      };
  }
  protectedPaths.forEach(visit);
  return records;
}
const before = fingerprints();
mkdirSync(output, { recursive: true });
const save = (name: string, data: unknown) =>
  writeFileSync(join(output, name), JSON.stringify(data, null, 2) + '\n');
// Matches the previous Python typed-row hash for this audited baseline: there
// are no REAL/blob application values in that snapshot; fail on an unknown type.
function asciiJSON(value: unknown) {
  return JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}
function rowHash(rows: Row[], columns: string[]) {
  const encoded = rows
    .map((row) =>
      asciiJSON(
        columns.map((column) => {
          const value = row[column];
          if (value === null) return { type: 'null' };
          if (typeof value === 'string') return { type: 'text', value };
          if (typeof value === 'number' && Number.isSafeInteger(value))
            return { type: 'integer', value: String(value) };
          throw new AuditError(
            'Unexpected baseline value type; manual preservation audit required',
          );
        }),
      ),
    )
    .sort();
  return createHash('sha256').update(asciiJSON(encoded)).digest('hex');
}
async function schema(bank: Bank) {
  const objects = await bank.all(
    'SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name',
  );
  const tables = await bank.all('PRAGMA table_list');
  const shadows = new Set(tables.filter((r) => r.type === 'shadow').map((r) => r.name));
  return objects
    .filter((r) => !shadows.has(r.name) && !shadows.has(r.tbl_name))
    .map((r) => [
      r.type,
      r.name,
      r.tbl_name,
      typeof r.sql === 'string' ? r.sql.trim().replace(/;$/, '') : r.sql,
    ]);
}
async function originalRows(bank: Bank, upgraded: boolean) {
  const records = [];
  for (const [table, item] of Object.entries(baseline.tables)) {
    const quoted = (name: string) => '"' + name.replaceAll('"', '""') + '"';
    // INTEGER PRIMARY KEY aliases can otherwise return duplicate column names.
    const sql =
      'SELECT ' +
      item.columns.map((column) => quoted(column) + ' AS ' + quoted(column)).join(',') +
      ' FROM ' +
      quoted(table) +
      (upgraded && table === 'schema_migrations' ? ' WHERE version=1' : '');
    const rows = await bank.all(sql);
    const hash = rowHash(rows, item.columns);
    if (rows.length !== item.count || hash !== item.sha256)
      throw new AuditError('Unexpected data or altered original records in ' + table + '; stopped');
    records.push({ table, originalRows: rows.length, originalHash: hash, preserved: true });
  }
  return records;
}
const adapter = TursoAdapter.fromEnvironment();
const bank = new Bank(adapter);
try {
  const migrations = await bank.all('SELECT * FROM schema_migrations ORDER BY version');
  const current = migrations.map((row) => row.version);
  if (
    JSON.stringify(current) !== JSON.stringify([1]) &&
    JSON.stringify(current) !== JSON.stringify([1, 2])
  )
    throw new AuditError('Unexpected migration tracking state; stopped');
  const upgraded = current.length === 2;
  if (apply && upgraded)
    throw new AuditError('Migration 002 already exists; use read-only audit mode');
  const actual = await schema(bank);
  if (!upgraded) {
    const expected = [...baseline.app_schema, ...baseline.autoindexes]
      .map((r) => [
        r[0],
        r[1],
        r[2],
        typeof r[3] === 'string' ? r[3].trim().replace(/;$/, '') : r[3],
      ])
      .sort(
        (a, b) =>
          String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])),
      );
    const sorted = [...actual].sort(
      (a, b) =>
        String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])),
    );
    if (JSON.stringify(sorted) !== JSON.stringify(expected))
      throw new AuditError('Migration-001 cloud schema differs from completed migration evidence');
  }
  const original = await originalRows(bank, upgraded);
  save('before.json', {
    migrations,
    schema: actual,
    originalRecords: original,
    unexpectedData: false,
  });
  console.log('Explicit target, migration state, complete baseline schema/row hashes: PASS');
  if (apply) {
    await applyMigrations(adapter, {
      beforeMigration: async (version) => {
        if (version !== 2) throw new AuditError('Unexpected missing migration; stopped');
        if (JSON.stringify(await schema(bank)) !== JSON.stringify(actual))
          throw new AuditError('Target schema changed after audit; stopped');
        await originalRows(bank, false);
      },
    });
    console.log('Repository migration 002 applied transactionally');
  }
  if (apply || upgraded) {
    await assertCurrentSchema(adapter);
    const local = new SQLiteAdapter();
    try {
      await applyMigrations(local);
      const expected = await schema(new Bank(local));
      const actual = await schema(bank);
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error('Cloud schema differs from current repository migrations');
      const counts = [];
      const tables = await bank.all('PRAGMA table_list');
      for (const row of tables
        .filter(
          (r) =>
            r.schema === 'main' && r.type !== 'shadow' && !String(r.name).startsWith('sqlite_'),
        )
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
        const name = String(row.name).replaceAll('"', '""');
        counts.push({
          table: row.name,
          rows: (await bank.one('SELECT count(*) n FROM "' + name + '"'))?.n,
        });
      }
      const expectedCounts: Record<string, number> = {
        ...Object.fromEntries(
          Object.entries(baseline.tables).map(([name, item]) => [name, item.count]),
        ),
        schema_migrations: 2,
        curriculum_versions: 1,
        curriculum_events: 0,
        question_version_classifications: 0,
      };
      if (counts.some((r) => r.rows !== expectedCounts[String(r.table)]))
        throw new Error('Unexpected current cloud table counts');
      const preserved = await originalRows(bank, true);
      const versions = await bank.curriculum.versions();
      if (
        versions.length !== 1 ||
        versions[0].id !== 'legacy-matriculation-physics' ||
        versions[0].status !== 'active' ||
        versions[0].code !== 'LEGACY'
      )
        throw new Error('Legacy curriculum reconstruction differs from migration 002 intent');
      if ((await bank.taxonomy()).semesters.some((s) => s.curriculumVersionId !== versions[0].id))
        throw new Error('Semester curriculum foreign-key membership mismatch');
      if ((await bank.all('PRAGMA foreign_key_check')).length)
        throw new Error('Cloud foreign-key check failed');
      if ((await bank.one('PRAGMA integrity_check'))?.integrity_check !== 'ok')
        throw new Error('Cloud integrity check failed');
      if (Number((await bank.one('SELECT COUNT(*) n FROM questions'))!.n)!==0) throw new Error('Unexpected production question data');
      const schemaKinds = actual.reduce<Record<string, number>>((r, row) => {
        const k = String(row[0]);
        r[k] = (r[k] ?? 0) + 1;
        return r;
      }, {});
      save('after.json', {
        migrations: await bank.all('SELECT * FROM schema_migrations ORDER BY version'),
        schema: actual,
        schemaKinds,
        tables: counts,
        originalRecords: preserved,
        versions,
        ftsMatch: true,
        runtimeQueries: true,
        foreignKeys: true,
        integrity: 'ok',
        fullSchemaMatch: true,
        realQuestions: 0,
      });
      console.log(
        'Current runtime schema, original records, curriculum membership, FTS, integrity: PASS',
      );
    } finally {
      await local.close();
    }
  }
} catch (error) {
  // Detailed low-level client errors can embed connection URLs or credentials.
  const reason =
    error instanceof AuditError
      ? error.message
      : 'Database operation failed (' + (error instanceof Error ? error.name : 'unknown') + ')';
  console.error('STOP: ' + reason);
  save('failure.json', { reason });
  process.exitCode = 1;
} finally {
  await bank.close();
  const after = fingerprints();
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  save('safety.json', { before, after, unchanged });
  if (!unchanged) {
    console.error('Protected backup/runtime/upload/evidence fingerprints changed');
    process.exitCode = 1;
  }
}
