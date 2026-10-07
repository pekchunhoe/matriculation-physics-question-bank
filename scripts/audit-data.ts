import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
const db = new DatabaseSync(process.argv[2] ?? 'data/bank.sqlite', { readOnly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log(
  JSON.stringify(
    tables.map((row) => {
      const name = String(row.name),
        rows = db
          .prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '"')
          .all()
          .map((r) => JSON.stringify(r))
          .sort();
      return {
        table: name,
        count: rows.length,
        sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
      };
    }),
  ),
);
db.close();
