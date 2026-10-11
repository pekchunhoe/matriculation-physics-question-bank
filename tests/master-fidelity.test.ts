import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { createClient } from '@libsql/client';
import { SQLiteAdapter } from '../server/sqlite-adapter.js';
import { TursoAdapter } from '../server/turso-adapter.js';
import { Bank } from '../server/database.js';
import { applyMigrations } from '../server/migrations.js';
import { setup } from './fixtures.js';
import { seedAdminSession, testEmail } from './auth-fixture.js';
import {
  examplePackage,
  localPackage,
  splitPackage,
  nestedPackage,
} from './question-import-fixture.js';
import {
  questionPackageSchema,
  validationMessage,
  type QuestionPackage,
} from '../shared/question-import.js';
import { documentSchema } from '../shared/schema.js';
import { numberingPlan } from '../shared/question-numbering.js';
import { QuestionJsonImportService } from '../server/question-json-import.js';
import { VisibilityService } from '../server/visibility.js';
import { ContentPreview } from '../src/Preview.js';
import { MasterPrint } from '../src/MasterPrint.js';
import { prepareQuestionImport, releaseImport } from '../src/question-import-preparation.js';

function masterPackage(): QuestionPackage {
  const doc = examplePackage();
  for (const [i, step] of doc.solutions[0].steps.entries()) {
    step.id = 'step-' + i;
    step.markingCode = i ? 'JU1' : 'GJU1';
  }
  doc.hints = [
    { id: 'first', partId: null, solutionStepId: 'step-0', text: 'First linked hint.', order: 0 },
    { id: 'second', partId: null, solutionStepId: 'step-0', text: 'Second linked hint.', order: 1 },
    { id: 'next', partId: null, solutionStepId: 'step-1', text: 'Next step hint.', order: 0 },
    { id: 'legacy', partId: null, text: 'General hint.', order: 0 },
  ];
  return doc;
}
test('golden reference demonstrates all new capabilities with byte-valid synthetic assets', async () => {
  const text = readFileSync(
    'examples/question-import/GOLDEN_QUESTION_IMPORT_REFERENCE.json',
    'utf8',
  );
  const doc = questionPackageSchema.parse(JSON.parse(text));
  assert.equal(doc.difficulty, undefined);
  assert.equal(
    doc.solutions.flatMap((s) => s.steps).filter((s) => s.markingCode && s.id).length,
    5,
  );
  assert.equal(doc.hints.filter((h) => h.solutionStepId).length, 6);
  const prepared = await prepareQuestionImport(text);
  assert.equal(prepared.blobs.size, 3);
  releaseImport(prepared);
});
test('optional fields preserve schemaVersion 1 and old packages exactly', () => {
  const old = examplePackage();
  assert.deepEqual(questionPackageSchema.parse(old), old);
  assert.equal(questionPackageSchema.parse(masterPackage()).schemaVersion, 1);
});
for (const code of ['G1', 'JU1', 'GJU1', 'Future+2/A-1._'])
  test(`marking code ${code} preserves exact authored characters without changing mark totals`, () => {
    const doc = masterPackage();
    doc.solutions[0].steps[0].markingCode = code;
    assert.equal(questionPackageSchema.parse(doc).solutions[0].steps[0].markingCode, code);
  });
const rejects: [string, (d: QuestionPackage) => void, string][] = [
  [
    'empty code',
    (d) => {
      d.solutions[0].steps[0].markingCode = '';
    },
    'solutions[0].steps[0].markingCode',
  ],
  [
    'long code',
    (d) => {
      d.solutions[0].steps[0].markingCode = 'G'.repeat(25);
    },
    'solutions[0].steps[0].markingCode',
  ],
  [
    'markup code',
    (d) => {
      d.solutions[0].steps[0].markingCode = '<script>';
    },
    'solutions[0].steps[0].markingCode',
  ],
  [
    'whitespace code',
    (d) => {
      d.solutions[0].steps[0].markingCode = ' G1';
    },
    'solutions[0].steps[0].markingCode',
  ],
  [
    'missing step',
    (d) => {
      d.hints[0].solutionStepId = 'foreign';
    },
    'hints[0].solutionStepId',
  ],
  [
    'duplicate step key',
    (d) => {
      d.solutions[0].steps[1].id = 'step-0';
    },
    'solutions[0].steps[1].id',
  ],
  [
    'duplicate hint key',
    (d) => {
      d.hints[1].id = 'first';
    },
    'hints',
  ],
  [
    'duplicate hint order',
    (d) => {
      d.hints[1].order = 0;
    },
    'hints[1].order',
  ],
  [
    'foreign solution ownership',
    (d) => {
      nestedPackage(d);
      d.hints = [{ id: 'bad', partId: 'aii', solutionStepId: 'step-0', text: 'Bad.', order: 0 }];
    },
    'hints[0].partId',
  ],
  [
    'unsupported target type',
    (d) => {
      Object.assign(d.hints[0], { target: { type: 'teacher_note' } });
    },
    'hints[0]',
  ],
];
for (const [name, mutate, path] of rejects)
  test(`Master contract rejects ${name} with an exact path in browser and server validators`, async () => {
    const doc = masterPackage();
    mutate(doc);
    const parsed = questionPackageSchema.safeParse(doc);
    assert.equal(parsed.success, false);
    if (!parsed.success) assert.ok(validationMessage(parsed.error).includes(path));
    await assert.rejects(prepareQuestionImport(JSON.stringify(doc)), (e: Error) =>
      e.message.includes(path),
    );
  });
test('one shared numbering plan follows selection, reordering and removal without mutating input', () => {
  const a = { id: 'A' },
    b = { id: 'B' },
    c = { id: 'C' };
  assert.deepEqual(
    numberingPlan([a]).map((x) => x.displayNumber),
    [1],
  );
  assert.deepEqual(
    numberingPlan([a, b, c]).map((x) => [x.id, x.displayNumber]),
    [
      ['A', 1],
      ['B', 2],
      ['C', 3],
    ],
  );
  assert.deepEqual(
    numberingPlan([c, a, b]).map((x) => [x.id, x.displayNumber]),
    [
      ['C', 1],
      ['A', 2],
      ['B', 3],
    ],
  );
  assert.deepEqual(
    numberingPlan([c, b]).map((x) => [x.id, x.displayNumber]),
    [
      ['C', 1],
      ['B', 2],
    ],
  );
  assert.deepEqual(a, { id: 'A' });
  assert.throws(() => numberingPlan([a, a]), /unique/);
});

for (const adapter of ['sqlite', 'libsql'] as const)
  test(`${adapter}: populated 004 upgrade preserves content, old hints, search, classification and immutable history; imports linked hints`, async () => {
    const db =
      adapter === 'sqlite'
        ? new SQLiteAdapter(':memory:')
        : new TursoAdapter(createClient({ url: 'file::memory:' }));
    const bank = new Bank(db);
    try {
      await applyMigrations(db, { throughVersion: 4 });
      const { fixture } = await setup(bank);
      const doc = fixture('TEST-004-PRESERVED');
      // Populate the migration-004 structures using their actual old column shapes.
      await bank.run(
        'INSERT INTO questions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        'old',
        doc.question.questionCode,
        doc.question.topicId,
        doc.question.subtopicId,
        doc.question.title,
        doc.question.scenario,
        'hard',
        'structured',
        2,
        3,
        'approved',
        0,
        0,
        0,
        1,
        'old',
        'old',
        'old',
      );
      const p = doc.parts[0],
        s = doc.solutions[0],
        t = s.steps[0];
      await bank.run(
        'INSERT INTO question_parts VALUES(?,?,?,?,?,?,?)',
        'old',
        p.id,
        p.label,
        p.prompt,
        p.marks,
        p.order,
        p.parentId,
      );
      await bank.run(
        'INSERT INTO solutions VALUES(?,?,?,?,?)',
        'old',
        s.partId,
        s.solution,
        s.equationLatex,
        s.teacherNotes,
      );
      await bank.run(
        'INSERT INTO solution_steps VALUES(?,?,?,?,?,?,?,?,?)',
        'old',
        s.partId,
        t.number,
        t.explanation,
        t.equationLatex,
        t.working,
        t.markingPoint,
        t.marks,
        t.order,
      );
      for (const h of doc.hints)
        await bank.run(
          'INSERT INTO hints VALUES(?,?,?,?,?)',
          'old',
          h.id,
          h.partId,
          h.text,
          h.order,
        );
      await bank.run(
        'INSERT INTO question_versions VALUES(?,?,?,?,?,?)',
        'old',
        1,
        JSON.stringify(doc),
        'Old immutable revision',
        null,
        'old',
      );
      await bank.run(
        'INSERT INTO question_version_classifications VALUES(?,?,?)',
        'old',
        1,
        JSON.stringify(await bank.curriculum.classification(doc)),
      );
      await bank.run('INSERT INTO question_search VALUES(?,?)', 'old', 'Existing indexed content');
      const tables = [
        'questions',
        'question_parts',
        'solutions',
        'solution_steps',
        'hints',
        'question_versions',
        'question_version_classifications',
        'question_search',
        'semesters',
        'topics',
      ];
      const before = new Map<string, unknown>();
      for (const table of tables)
        before.set(table, await bank.all(`SELECT * FROM ${table} ORDER BY 1,2`));
      await applyMigrations(db, { beforeMigration: async (v) => assert.equal(v, 5) });
      for (const table of tables) {
        const after = await bank.all(`SELECT * FROM ${table} ORDER BY 1,2`);
        for (const row of after) {
          for (const field of table === 'solution_steps'
            ? ['step_id', 'marking_code']
            : table === 'hints'
              ? ['solution_step_id']
              : []) {
            assert.equal(row[field], null);
            delete row[field];
          }
        }
        assert.deepEqual(after, before.get(table), table);
      }
      assert.deepEqual(await bank.document('old'), doc);
      await applyMigrations(db);
      await seedAdminSession(bank);
      const row = await bank.one('SELECT id FROM admins WHERE email=?', testEmail);
      const admin = { id: String(row!.id), email: testEmail, role: 'admin' as const };
      const pkg = await localPackage(bank);
      const master = masterPackage();
      pkg.solutions = master.solutions;
      pkg.hints = master.hints;
      const { manifest } = splitPackage(pkg);
      const service = new QuestionJsonImportService(bank);
      const preview = await service.validate(manifest, admin, 'Easy');
      assert.equal(preview.document.solutions[0].steps[0].markingCode, 'GJU1');
      const imported = await service.commit(manifest, preview.token, [], admin, 'Easy');
      const canonical = await bank.document(imported.id);
      assert.equal(canonical.solutions[0].steps[0].markingCode, 'GJU1');
      assert.equal(canonical.hints[0].solutionStepId, 'step-0');
      assert.equal(
        (
          await bank.one(
            'SELECT marking_code FROM solution_steps WHERE question_id=? AND step_id=?',
            imported.id,
            'step-0',
          )
        )?.marking_code,
        'GJU1',
      );
      assert.equal(
        (
          await bank.one(
            'SELECT solution_step_id FROM hints WHERE question_id=? AND id=?',
            imported.id,
            'first',
          )
        )?.solution_step_id,
        'step-0',
      );
      const render = renderToStaticMarkup(
        createElement(ContentPreview, { doc: canonical, teacher: true }),
      );
      assert.ok(render.includes('GJU1'));
      assert.ok(render.indexOf('First linked hint.') < render.indexOf('Second linked hint.'));
      const hidden = renderToStaticMarkup(
        createElement(ContentPreview, { doc: canonical, teacher: false }),
      );
      assert.ok(!hidden.includes('GJU1'));
      assert.ok(!hidden.includes('linked hint.'));
      const visibility = new VisibilityService(bank);
      await assert.rejects(visibility.questionSet(imported.id, 'true', 'true'), /not found/);
      // Direct SQL integrity tests cannot bypass question/part ownership or update it later.
      await assert.rejects(
        bank.run(
          'UPDATE hints SET question_id=? WHERE question_id=? AND id=?',
          'old',
          imported.id,
          'first',
        ),
      );
      await assert.rejects(
        bank.run(
          'UPDATE hints SET part_id=? WHERE question_id=? AND id=?',
          'part-a',
          imported.id,
          'first',
        ),
      );
      await assert.rejects(
        bank.run(
          'UPDATE solution_steps SET part_id=? WHERE question_id=? AND step_id=?',
          'part-a',
          imported.id,
          'step-0',
        ),
      );
      await assert.rejects(
        bank.run(
          'DELETE FROM solution_steps WHERE question_id=? AND step_id=?',
          imported.id,
          'step-0',
        ),
      );
      await assert.rejects(
        bank.run(
          'UPDATE solution_steps SET marking_code=? WHERE question_id=?',
          '<bad>',
          imported.id,
        ),
      );
      const tax = await bank.taxonomy();
      const item = numberingPlan([{ id: imported.id, document: canonical }])[0];
      const questionHtml = renderToStaticMarkup(createElement(MasterPrint, { item, tax }));
      const answerHtml = renderToStaticMarkup(
        createElement(MasterPrint, { item, tax, answer: true, hints: true }),
      );
      assert.ok(questionHtml.includes('Question 1'));
      assert.ok(answerHtml.includes('Question 1'));
      assert.ok(!questionHtml.includes('GJU1'));
      assert.ok(!questionHtml.includes('linked hint.'));
      assert.ok(answerHtml.includes('GJU1'));
      assert.ok(answerHtml.includes('First linked hint.'));
      assert.ok(!answerHtml.includes(canonical.question.questionCode));
      for (const excluded of [
        'SP015',
        'SP025',
        'SET A',
        '2026/2027',
        'Student working space',
        'Question 5',
      ])
        assert.ok(!(questionHtml + answerHtml).includes(excluded));
      canonical.question.title += ' revised';
      await bank.save(imported.id, canonical, 'Local linked-hint revision', 1);
      assert.equal((await bank.document(imported.id, 1)).hints[0].solutionStepId, 'step-0');
      assert.equal((await bank.versions(imported.id)).length, 2);
      assert.deepEqual(await bank.all('PRAGMA foreign_key_check'), []);
      assert.equal((await bank.one('PRAGMA integrity_check'))?.integrity_check, 'ok');
    } finally {
      await bank.close();
    }
  });
test('canonical validator rejects a step hint pointing into another solution', async () => {
  const { bank, fixture } = await setup();
  try {
    const doc = fixture('TEST-FOREIGN');
    doc.solutions[0].steps[0].id = 'owned';
    doc.hints[0].solutionStepId = 'owned';
    const result = documentSchema.safeParse(doc);
    assert.equal(result.success, false);
    if (!result.success) assert.ok(validationMessage(result.error).includes('hints[0].partId'));
  } finally {
    await bank.close();
  }
});
test('general parent hints follow relational ancestry even when authored part labels are identical', async () => {
  const { bank, fixture } = await setup();
  try {
    const doc = fixture('TEST-HINT-SCOPES');
    const part = doc.parts[0],
      solution = doc.solutions[0];
    doc.parts = [
      { ...part, id: 'parent-1', label: '(a)' },
      { ...part, id: 'leaf-1', parentId: 'parent-1', label: '(i)' },
      { ...part, id: 'parent-2', label: '(a)', order: 1 },
      { ...part, id: 'leaf-2', parentId: 'parent-2', label: '(i)' },
    ];
    doc.solutions = [
      { ...solution, partId: 'leaf-1', solution: 'First solution boundary.' },
      { ...solution, partId: 'leaf-2', solution: 'Second solution boundary.' },
    ];
    doc.hints = [{ id: 'p2', partId: 'parent-2', text: 'Only the second parent hint.', order: 0 }];
    const html = renderToStaticMarkup(
      createElement(MasterPrint, {
        item: { id: 'test', document: doc, displayNumber: 1 },
        tax: await bank.taxonomy(),
        answer: true,
        hints: true,
      }),
    );
    assert.equal(html.split('Only the second parent hint.').length - 1, 1);
    assert.ok(
      html.indexOf('Only the second parent hint.') > html.indexOf('First solution boundary.'),
    );
  } finally {
    await bank.close();
  }
});
