import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generatedTargets } from '../scripts/clean-generated.js';
test('Generated cleanup dry-run excludes data and refuses misplaced databases', () => {
  const root = mkdtempSync(join(tmpdir(), 'qb-cleanup-test-'));
  try {
    mkdirSync(join(root, 'data'));
    writeFileSync(join(root, 'data', 'bank.sqlite'), 'PRESERVE');
    mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'dist', 'app.js'), 'TEST');
    const plan = generatedTargets(root);
    assert.equal(plan.bytes, 4);
    assert.equal(plan.files, 1);
    assert.ok(plan.targets.every((t) => !t.endsWith('data')));
    writeFileSync(join(root, 'dist', 'bank.sqlite'), 'PRESERVE');
    assert.throws(() => generatedTargets(root), /Persistent/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
