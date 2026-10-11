import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClient } from '@libsql/client';
import { setup } from './fixtures.js';
import { seedAdminSession, testEmail, authenticatedFetch } from './auth-fixture.js';
import { localPackage, splitPackage } from './question-import-fixture.js';
import { QuestionJsonImportService } from '../server/question-json-import.js';
import { Bank } from '../server/database.js';
import { TursoAdapter } from '../server/turso-adapter.js';
import { applyMigrations } from '../server/migrations.js';
import { createApp } from '../server/app.js';
import { MasterPrint } from '../src/MasterPrint.js';
import { difficultyOptions, questionPackageSchema } from '../shared/question-import.js';
import type { AdminIdentity } from '../server/auth.js';

async function environment(libsql = false) {
  let existing: Bank | undefined;
  if (libsql) {
    const adapter = new TursoAdapter(createClient({ url: 'file::memory:' }));
    await applyMigrations(adapter);
    existing = new Bank(adapter);
  }
  const { bank, fixture } = await setup(existing);
  const cookie = await seedAdminSession(bank);
  const admin: AdminIdentity = {
    id: String((await bank.one('SELECT id FROM admins WHERE email=?', testEmail))!.id),
    email: testEmail,
    role: 'admin',
  };
  const service = new QuestionJsonImportService(bank);
  const doc = await localPackage(bank);
  delete doc.difficulty;
  return { bank, fixture, cookie, admin, service, doc, ...splitPackage(doc) };
}

for (const libsql of [false, true])
  for (const difficulty of difficultyOptions)
    test(`${libsql ? 'local libSQL' : 'SQLite'} admin ${difficulty}: omitted JSON difficulty persists canonically, filters and Master output agree`, async () => {
      const e = await environment(libsql);
      try {
        assert.equal(questionPackageSchema.parse(e.doc).difficulty, undefined);
        const before = await e.bank.all('SELECT * FROM questions');
        const p = await e.service.validate(e.manifest, e.admin, difficulty);
        assert.deepEqual(await e.bank.all('SELECT * FROM questions'), before);
        const tax = await e.bank.taxonomy();
        const id = tax.difficulties.find((d) => d.name === difficulty)!.id;
        assert.equal(p.document.question.difficultyId, id);
        const created = await e.service.commit(e.manifest, p.token, [], e.admin, difficulty);
        const canonical = await e.bank.document(created.id);
        assert.equal(canonical.question.difficultyId, id);
        assert.equal(canonical.question.status, 'draft');
        assert.equal((await e.bank.list({ difficulty: id })).total, 1);
        assert.equal(
          (await e.bank.list({ difficulty: tax.difficulties.find((d) => d.id !== id)!.id })).total,
          0,
        );
        assert.equal((await e.bank.document(created.id, 1)).question.difficultyId, id);
        for (const answer of [false, true]) {
          const html = renderToStaticMarkup(
            createElement(MasterPrint, {
              item: { id: created.id, document: canonical, displayNumber: 1 },
              tax,
              answer,
            }),
          );
          assert.ok(html.includes(`DIFFICULTY: ${difficulty.toUpperCase()}`));
        }
        assert.equal(
          (await e.service.commit(e.manifest, p.token, [], e.admin, difficulty)).id,
          created.id,
        );
        assert.deepEqual(await e.bank.all('PRAGMA foreign_key_check'), []);
      } finally {
        await e.bank.close();
      }
    });

for (const [marks, difficulty] of [
  [1, 'Hard'],
  [2, 'Hard'],
  [10, 'Easy'],
  [20, 'Medium'],
] as const)
  test(`${marks} marks with admin ${difficulty} has no marks-derived difficulty`, async () => {
    const e = await environment();
    try {
      e.manifest.question.totalMarks = marks;
      e.manifest.solutions[0].steps = [{ ...e.manifest.solutions[0].steps[0], marks }];
      const p = await e.service.validate(e.manifest, e.admin, difficulty);
      const created = await e.service.commit(e.manifest, p.token, [], e.admin, difficulty);
      const doc = await e.bank.document(created.id);
      assert.equal(doc.question.totalMarks, marks);
      assert.equal(
        doc.question.difficultyId,
        (await e.bank.taxonomy()).difficulties.find((d) => d.name === difficulty)!.id,
      );
    } finally {
      await e.bank.close();
    }
  });

for (const [legacy, selected] of [
  ['Hard', 'Easy'],
  ['Easy', 'Hard'],
  ['MEDIUM', 'Medium'],
  ['Arbitrary legacy label', 'Easy'],
] as const)
  test(`source JSON ${legacy} is preserved or requires explicit ambiguity review; admin ${selected} cannot silently replace it`, async () => {
    const e = await environment();
    try {
      e.manifest.difficulty = legacy;
      if (legacy.toLowerCase() !== selected.toLowerCase()) {
        await assert.rejects(
          e.service.validate(e.manifest, e.admin, selected),
          /Preserve the source difficulty|ambiguous/,
        );
        assert.equal((await e.bank.list()).total, 0);
        return;
      }
      const p = await e.service.validate(e.manifest, e.admin, selected);
      const r = await e.service.commit(e.manifest, p.token, [], e.admin, selected);
      assert.equal(
        (await e.bank.document(r.id)).question.difficultyId,
        (await e.bank.taxonomy()).difficulties.find((d) => d.name === selected)!.id,
      );
    } finally {
      await e.bank.close();
    }
  });

for (const selection of [
  undefined,
  null,
  '',
  'Impossible',
  'easy',
  'hard',
  { id: 'hard' },
  ['Hard'],
])
  test(`invalid separate selection ${JSON.stringify(selection)} cannot preview or commit and leaves DB untouched`, async () => {
    const e = await environment();
    try {
      e.manifest.difficulty = 'Medium';
      const before = await e.bank.all('SELECT * FROM questions');
      await assert.rejects(
        e.service.validate(e.manifest, e.admin, selection),
        /selectedDifficulty/,
      );
      const p = await e.service.validate(e.manifest, e.admin, 'Medium');
      await assert.rejects(
        e.service.commit(e.manifest, p.token, [], e.admin, selection),
        /selectedDifficulty/,
      );
      assert.deepEqual(await e.bank.all('SELECT * FROM questions'), before);
      assert.deepEqual(await e.bank.all('SELECT * FROM question_import_receipts'), []);
    } finally {
      await e.bank.close();
    }
  });

for (const mode of ['missing', 'ambiguous'] as const)
  test(`${mode} canonical reference rejects selected difficulty`, async () => {
    const e = await environment();
    try {
      if (mode === 'missing') await e.bank.run("DELETE FROM difficulty_levels WHERE name='Hard'");
      else
        await e.bank.run(
          "INSERT INTO difficulty_levels(id,name,slug,sort_order) VALUES('duplicate-hard','Hard','duplicate-hard',99)",
        );
      await assert.rejects(
        e.service.validate(e.manifest, e.admin, 'Hard'),
        /exactly one canonical/,
      );
      assert.equal((await e.bank.list()).total, 0);
    } finally {
      await e.bank.close();
    }
  });

test('signed selection cannot change before commit or on idempotent retry; a new preview imports the reviewed value', async () => {
  const e = await environment();
  try {
    const p = await e.service.validate(e.manifest, e.admin, 'Medium');
    await assert.rejects(
      e.service.commit(e.manifest, p.token, [], e.admin, 'Hard'),
      /difficulty changed/,
    );
    const payload = JSON.parse(Buffer.from(p.token.split('.')[0], 'base64url').toString());
    payload.selectedDifficulty = 'Hard';
    const tampered =
      Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + p.token.split('.')[1];
    await assert.rejects(e.service.commit(e.manifest, tampered, [], e.admin, 'Hard'), /tampered/);
    assert.equal((await e.bank.list()).total, 0);
    const medium = await e.service.commit(e.manifest, p.token, [], e.admin, 'Medium');
    await assert.rejects(
      e.service.commit(e.manifest, p.token, [], e.admin, 'Hard'),
      /difficulty changed/,
    );
    assert.equal(
      (await e.service.commit(e.manifest, p.token, [], e.admin, 'Medium')).id,
      medium.id,
    );
    const hard = await e.service.validate(e.manifest, e.admin, 'Hard');
    const r = await e.service.commit(e.manifest, hard.token, [], e.admin, 'Hard');
    assert.equal((await e.bank.document(r.id)).question.difficultyId, 'hard');
  } finally {
    await e.bank.close();
  }
});

test('difficulty revisions preserve immutable history and unrelated preexisting questions', async () => {
  const e = await environment();
  try {
    const old = await e.bank.create(
      e.fixture('EXISTING-DIFFICULTY'),
      'Existing test question',
      null,
      true,
    );
    const oldDocument = await e.bank.document(old.id);
    const oldVersions = await e.bank.versions(old.id);
    const p = await e.service.validate(e.manifest, e.admin, 'Easy');
    const r = await e.service.commit(e.manifest, p.token, [], e.admin, 'Easy');
    const revised = await e.bank.document(r.id);
    revised.question.difficultyId = 'hard';
    await e.bank.save(r.id, revised, 'Administrator changes difficulty', 1, e.admin.email);
    assert.equal((await e.bank.document(r.id)).question.difficultyId, 'hard');
    assert.equal((await e.bank.document(r.id, 1)).question.difficultyId, 'easy');
    assert.equal((await e.bank.versions(r.id)).length, 2);
    assert.deepEqual(await e.bank.document(old.id), oldDocument);
    assert.deepEqual(await e.bank.versions(old.id), oldVersions);
  } finally {
    await e.bank.close();
  }
});

test('HTTP requires separate selection at preview and commit, rejects stale commits, preserves auth/CSRF and draft privacy', async () => {
  const e = await environment();
  const server = createApp(e.bank, undefined).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const authorized = authenticatedFetch(e.cookie);
  const body = (selectedDifficulty?: unknown) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      manifest: e.manifest,
      ...(selectedDifficulty === undefined ? {} : { selectedDifficulty }),
    }),
  });
  const form = (token: string, selection?: string) => {
    const f = new FormData();
    f.append('manifest', JSON.stringify(e.manifest));
    f.append('token', token);
    if (selection !== undefined) f.append('selectedDifficulty', selection);
    return { method: 'POST', body: f };
  };
  try {
    const url = base + '/api/admin/questions/import/validate';
    assert.equal((await fetch(url, body('Hard'))).status, 401);
    assert.equal(
      (
        await fetch(url, {
          ...body('Hard'),
          headers: { 'Content-Type': 'application/json', Cookie: e.cookie },
        })
      ).status,
      403,
    );
    const noSelection = await authorized(url, body());
    assert.equal(noSelection.status, 400);
    assert.match(await noSelection.text(), /Select a difficulty/);
    assert.equal((await authorized(url, body('hard'))).status, 400);
    assert.equal((await e.bank.list()).total, 0);
    const response = await authorized(url, body('Medium'));
    assert.equal(response.status, 200);
    const p = await response.json();
    const commit = base + '/api/admin/questions/import/commit';
    assert.equal((await authorized(commit, form(p.token))).status, 400);
    assert.equal((await authorized(commit, form(p.token, 'Hard'))).status, 409);
    assert.equal((await e.bank.list()).total, 0);
    const saved = await authorized(commit, form(p.token, 'Medium'));
    assert.equal(saved.status, 201);
    const r = await saved.json();
    assert.equal((await authorized(commit, form(p.token, 'Hard'))).status, 409);
    assert.equal((await authorized(commit, form(p.token, 'Medium'))).status, 201);
    assert.equal((await fetch(base + '/api/questions/' + r.id)).status, 404);
    assert.equal((await e.bank.document(r.id)).question.difficultyId, 'medium');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    await e.bank.close();
  }
});
