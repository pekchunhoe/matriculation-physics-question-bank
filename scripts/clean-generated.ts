import { lstatSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, relative, sep, join } from 'node:path';
/** Deliberately fixed allowlist. Never enumerates data/, uploads/, database paths or backups. */
const root = resolve(import.meta.dirname, '..');
export function generatedTargets(workspace = root) {
  const targets = ['dist', 'test-results', 'playwright-report'].map((name) =>
    resolve(workspace, name),
  );
  let files = 0,
    bytes = 0;
  const inspect = (path: string) => {
    const rel = relative(workspace, path);
    if (rel.startsWith('..') || rel.startsWith(sep) || !rel)
      throw new Error('Unsafe cleanup target');
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error('Cleanup refuses links or junctions');
    if (stat.isDirectory()) for (const name of readdirSync(path)) inspect(join(path, name));
    else {
      if (/\.(sqlite|sqlite3|db)(-|$)|\.env/i.test(path))
        throw new Error('Persistent or credential file found; cleanup stopped');
      files++;
      bytes += stat.size;
    }
  };
  for (const target of targets) if (existsSync(target)) inspect(target);
  return { targets, files, bytes };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const plan = generatedTargets();
  console.log(
    JSON.stringify(
      { mode: process.argv.includes('--apply') ? 'apply' : 'dry-run', ...plan },
      null,
      2,
    ),
  );
  if (process.argv.includes('--apply'))
    for (const target of plan.targets) rmSync(target, { recursive: true, force: true });
}
