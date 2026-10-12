import { createTestBank } from './test-bank.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bank } from '../server/database.js';
import { setup } from './fixtures.js';
import type { CurriculumDocument, EditableKind } from '../shared/curriculum.js';
import { imageEnvironment } from './image-fixture.js';

for (const kind of ['chapters', 'topics', 'subtopics'] as const)
  test(`Image classification history survives ${kind} rename and blocks moves`, async () => {
    const e = await imageEnvironment();
    try {
      const q = (await e.create()).question,
        id = kind === 'chapters' ? e.c1 : kind === 'topics' ? e.momentum : e.subtopic;
      const before = await e.bank.all('SELECT * FROM image_question_versions');
      const impact = await e.bank.curriculum.impact(kind, id);
      assert.equal(impact.currentQuestions, 1);
      assert.equal(impact.historicalQuestions, 1);
      await edit(e.bank, kind, id, { name: 'TEST ONLY renamed' });
      assert.deepEqual(await e.bank.all('SELECT * FROM image_question_versions'), before);
      assert.equal((await e.service.get(q.id, true)).id, q.id);
      await assert.rejects(
        () =>
          edit(e.bank, kind, id, {
            parentId: kind === 'chapters' ? 'semester-2' : kind === 'topics' ? e.c2 : e.dynamics,
          }),
        /referenced/,
      );
    } finally {
      await e.close();
    }
  });
test('No subtopics are invented during fresh migration; admin creates valid hierarchy', async () => {
  const bank = await createTestBank();
  try {
    assert.equal((await bank.taxonomy()).subtopics.length, 0);
    await assert.rejects(() => bank.addTaxon('subtopics', 'TEST ONLY', 'missing', true));
  } finally {
    await bank.close();
  }
});
test('Subtopic creation rejects duplicates, retired parents and wrong semester names', async () => {
  const e = await setup();
  try {
    await assert.rejects(
      () => e.bank.addTaxon('subtopics', 'TEST ONLY Details', e.momentum, true),
      /already exists/,
    );
    await edit(e.bank, 'topics', e.momentum, { status: 'retired' });
    await assert.rejects(
      () => e.bank.addTaxon('subtopics', 'TEST ONLY new', e.momentum, true),
      /retired/,
    );
    await assert.rejects(
      () => edit(e.bank, 'semesters', 'semester-1', { name: 'SP015' }),
      /permanent/,
    );
  } finally {
    await e.bank.close();
  }
});
test('Stale curriculum impact token cannot mutate taxonomy after a question save', async () => {
  const e = await imageEnvironment();
  try {
    const impact = await e.bank.curriculum.impact('topics', e.momentum);
    await e.create();
    await assert.rejects(
      () =>
        e.bank.curriculum.edit('topics', e.momentum, {
          name: 'TEST stale',
          expectedRevision: impact.revision,
          impactToken: impact.token,
          confirmImpact: true,
          note: 'TEST ONLY',
        }),
      /changed|stale|preview/i,
    );
  } finally {
    await e.close();
  }
});
test('Required impact confirmation protects referenced taxonomy', async () => {
  const e = await imageEnvironment();
  try {
    await e.create();
    await assert.rejects(
      () => edit(e.bank, 'topics', e.momentum, { status: 'retired' }, false),
      /confirm/i,
    );
  } finally {
    await e.close();
  }
});
test('Curriculum import is reviewed, atomic and rejects reuse of stale plan', async () => {
  const bank = await createTestBank();
  try {
    const doc = document(),
      plan = await bank.curriculum.plan(doc);
    const result = await bank.curriculum.import(plan.document, plan.token, 'TEST ONLY import');
    assert.ok(result);
    const tax = await bank.taxonomy();
    assert.ok(tax.curriculumVersions!.some((v) => v.code === 'TEST-CURRICULUM'));
    assert.equal(tax.subtopics.length, 1);
    await assert.rejects(() =>
      bank.curriculum.import(plan.document, plan.token, 'TEST ONLY retry'),
    );
  } finally {
    await bank.close();
  }
});
test('Cloning a curriculum preserves source identities and creates separate descendants', async () => {
  const e = await setup();
  try {
    const before = await e.bank.curriculum.export(e.fixture().curriculumVersionId);
    await e.bank.curriculum.createVersion(
      {
        courseId: 'matriculation-physics',
        code: 'TEST-CLONE',
        name: 'TEST ONLY clone',
        effectiveFrom: null,
        effectiveTo: null,
        status: 'draft',
        order: 2,
        cloneFromId: e.fixture().curriculumVersionId,
      },
      'TEST ONLY',
    );
    assert.deepEqual(await e.bank.curriculum.export(e.fixture().curriculumVersionId), before);
    const tax = await e.bank.taxonomy();
    assert.equal(tax.subtopics.length, 4);
    assert.equal(new Set(tax.subtopics.map((s) => s.id)).size, 4);
  } finally {
    await e.bank.close();
  }
});
test('Retired curriculum remains browsable; draft curriculum cannot publish', async () => {
  const e = await imageEnvironment();
  try {
    const q = (await e.create()).question;
    await assert.rejects(() => changeVersion(e.bank, q.curriculumVersionId, 'draft'), /Retire/);
    await e.bank.run(
      "UPDATE curriculum_versions SET status='draft' WHERE id=?",
      q.curriculumVersionId,
    );
    await assert.rejects(
      () =>
        e.service.status(
          q.id,
          { status: 'approved', expectedRevision: 1, confirmed: true },
          e.actor,
        ),
      /Activate/,
    );
    await changeVersion(e.bank, q.curriculumVersionId, 'active');
    await e.service.status(
      q.id,
      { status: 'approved', expectedRevision: 1, confirmed: true },
      e.actor,
    );
    await changeVersion(e.bank, q.curriculumVersionId, 'retired');
    assert.equal((await e.service.list()).total, 1);
  } finally {
    await e.close();
  }
});

async function edit(
  bank: Bank,
  kind: EditableKind,
  id: string,
  change: object,
  confirmImpact = true,
) {
  const impact = await bank.curriculum.impact(kind, id);
  return await bank.curriculum.edit(kind, id, {
    ...change,
    expectedRevision: impact.revision,
    impactToken: impact.token,
    confirmImpact,
    note: 'TEST DATA curriculum change',
  });
}
async function changeVersion(
  bank: Bank,
  id: string,
  status: 'draft' | 'active' | 'retired',
  confirmImpact = true,
) {
  const v = (await bank.curriculum.versions()).find((v) => v.id === id)!,
    impact = await bank.curriculum.impact('curriculumVersions', id);
  return await bank.curriculum.editVersion(id, {
    name: v.name,
    effectiveFrom: v.effectiveFrom,
    effectiveTo: v.effectiveTo,
    status,
    order: v.order,
    expectedRevision: impact.revision,
    impactToken: impact.token,
    confirmImpact,
    note: 'TEST DATA lifecycle change',
  });
}
function document(code = 'TEST-CURRICULUM'): CurriculumDocument {
  return {
    schemaVersion: 1,
    course: { id: 'matriculation-physics', name: 'Matriculation Physics' },
    curriculumVersion: {
      code,
      name: 'TEST DATA curriculum',
      effectiveFrom: null,
      effectiveTo: null,
      status: 'draft',
      order: 5,
    },
    semesters: [
      {
        name: 'Semester 1',
        order: 3,
        status: 'active',
        isTest: true,
        chapters: [
          {
            name: 'TEST DATA Chapter',
            order: 8,
            status: 'active',
            isTest: true,
            topics: [
              {
                name: 'TEST DATA Topic',
                order: 7,
                status: 'active',
                isTest: true,
                subtopics: [
                  { name: 'TEST DATA Subtopic', order: 9, status: 'retired', isTest: true },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
