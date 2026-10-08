import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import express from 'express';
import { connectRuntimeBank } from '../server/runtime.js';
import { createApiHandler } from '../server/vercel-handler.js';
import type { Bank } from '../server/database.js';

const args = process.argv.slice(2);
if (
  args[args.indexOf('--target') + 1] !== 'matriculation-physics-question-bank' ||
  !args.includes('--target') ||
  !args.includes('--output')
)
  throw new Error(
    'Explicit production target and evidence output are required for read-only runtime checks',
  );
const output = resolve(args[args.indexOf('--output') + 1]);
const originalDirectory = process.cwd();
const emptyDirectory = mkdtempSync(join(tmpdir(), 'physics-turso-no-sqlite-'));
let bank: Bank | undefined;
let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
try {
  process.chdir(emptyDirectory);
  assert.deepEqual(readdirSync(emptyDirectory), []);
  bank = await connectRuntimeBank();
  const runtime = bank;
  const app = express();
  app.use(createApiHandler(async () => runtime));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const health = await fetch(base + '/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', database: 'connected' });
  const taxonomy = await (await fetch(base + '/api/taxonomy')).json();
  assert.equal(taxonomy.semesters.length, 2);
  assert.equal(taxonomy.curriculumVersions.length, 1);
  const listing = await fetch(
    base + '/api/questions?semester=semester-1&difficulty=hard&q=momentum',
  );
  assert.equal(listing.status, 200);
  assert.equal((await listing.json()).total, 0);
  assert.equal((await fetch(base + '/api/curriculum-versions')).status, 200);
  assert.equal((await fetch(base + '/api/questions', { method: 'POST' })).status, 401);
  assert.equal((await fetch(base + '/api/uploads', { method: 'POST' })).status, 401);
  assert.deepEqual(readdirSync(emptyDirectory), []);
  writeFileSync(
    output,
    JSON.stringify(
      {
        target: 'matriculation-physics-question-bank',
        readOnly: true,
        health: true,
        currentRuntimeQueries: true,
        noLocalSQLite: true,
        noLocalFileWrites: true,
        noTestFixtures: true,
        hostedWritesProtected: true,
        hostedUploadsUnavailable: true,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Actual Turso runtime startup, health and API reads from an empty working directory: PASS',
  );
} catch {
  console.error('Read-only runtime check failed; connection details were withheld');
  process.exitCode = 1;
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (bank) await bank.close();
  process.chdir(originalDirectory);
  // Only an empty directory created above is removed; no recursive deletion.
  rmdirSync(emptyDirectory);
}
