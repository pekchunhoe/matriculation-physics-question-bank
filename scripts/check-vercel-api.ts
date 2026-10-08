import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import './check-api-esm.js';

const result = await build({
  entryPoints: ['api/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  write: false,
  metafile: true,
  logLevel: 'silent',
});
const inputs = Object.keys(result.metafile!.inputs);
assert.ok(
  !inputs.some((file) => /sqlite-adapter|local-asset-storage|test-bank|fixtures/.test(file)),
);
assert.ok(!result.outputFiles![0].text.includes('node:sqlite'));
assert.ok(!result.outputFiles![0].text.includes('bank.sqlite'));
assert.ok(!result.outputFiles![0].text.includes('data/uploads'));
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
assert.equal(config.functions['api/index.ts'].includeFiles, 'server/migrations/*.sql');
console.log('Vercel API bundle, runtime import graph and SQLite independence: PASS');
