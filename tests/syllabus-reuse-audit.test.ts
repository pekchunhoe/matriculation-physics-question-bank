import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './fixtures.js';
import type { CurriculumDocument } from '../shared/curriculum.js';
import { documentSchema } from '../shared/schema.js';

test('AUDIT: 9 to 10 and 12 topics, unequal semester counts and more than nine subtopics are structural capabilities only', async () => {
  const { bank, fixture } = await setup();
  try {
    const question = await bank.create(fixture('TEST-AUDIT-PRESERVE'), 'Audit fixture', null, true);
    const before = await bank.document(question.id);
    const history = await bank.versions(question.id);
    const saved = await bank.savedClassification(question.id);
    const hierarchy = (code: string, counts: number[]): CurriculumDocument => ({
      schemaVersion: 1,
      course: { id: 'matriculation-physics', name: 'Matriculation Physics' },
      curriculumVersion: {
        code,
        name: 'TEST ONLY audit',
        status: 'draft',
        order: 10,
        effectiveFrom: null,
        effectiveTo: null,
      },
      semesters: counts.map((count, semester) => ({
        name: `Semester ${semester + 1}`,
        order: semester,
        status: 'active',
        isTest: true,
        chapters: [
          {
            name: 'TEST ONLY chapter',
            order: 0,
            status: 'active',
            isTest: true,
            topics: Array.from({ length: count }, (_, i) => ({
              name: `TEST ONLY Topic ${i + 1}`,
              order: i,
              status: 'active',
              isTest: true,
              subtopics:
                i === 0
                  ? Array.from({ length: 12 }, (_, j) => ({
                      name: `Subtopic ${j + 1}`,
                      order: j,
                      status: 'active',
                      isTest: true,
                    }))
                  : [],
            })),
          },
        ],
      })),
    });
    for (const [code, counts] of [
      ['TEST-AUDIT-NINE', [9, 9]],
      ['TEST-AUDIT-TEN', [10, 12]],
    ] as const) {
      const doc = hierarchy(code, [...counts]);
      if (code.endsWith('TEN')) {
        // Labels/order can represent rename/renumber/split/merge/remove/move destinations.
        // This does not implement semantic correspondence or question carry-forward.
        doc.semesters[0].chapters[0].topics[0].name = 'TEST ONLY changed scope one';
        doc.semesters[0].chapters[0].topics[1].name = 'TEST ONLY changed scope two';
      }
      const plan = await bank.curriculum.plan(doc);
      const result = await bank.curriculum.import(
        plan.document,
        plan.token,
        'Audit structural import',
      );
      const exported = await bank.curriculum.export(result.id);
      assert.deepEqual(
        exported.semesters.map((s) => s.chapters[0].topics.length),
        [...counts],
      );
      assert.equal(exported.semesters[0].chapters[0].topics[0].subtopics.length, 12);
      assert.equal(
        (await bank.list({ curriculum: result.id })).total,
        0,
        'No automatic reuse exists',
      );
    }
    const clone = await bank.curriculum.createVersion(
      {
        courseId: 'matriculation-physics',
        code: 'TEST-AUDIT-CLONE',
        name: 'TEST ONLY clone',
        status: 'draft',
        order: 11,
        effectiveFrom: null,
        effectiveTo: null,
        cloneFromId: 'legacy-matriculation-physics',
      },
      'Audit clone',
    );
    assert.equal((await bank.list({ curriculum: clone.id })).total, 0);
    const tables = await bank.all("SELECT name FROM sqlite_master WHERE type='table'");
    assert.equal(
      tables.some((t) => /correspondence|question_topic_mapping/.test(String(t.name))),
      false,
    );
    assert.equal(
      documentSchema.safeParse({
        ...before,
        question: { ...before.question, topicIds: [before.question.topicId, 'second'] },
      }).success,
      false,
    );
    assert.deepEqual(await bank.document(question.id), before);
    assert.deepEqual(await bank.versions(question.id), history);
    assert.deepEqual(await bank.savedClassification(question.id), saved);
    assert.equal((await bank.one('SELECT count(*) n FROM questions'))?.n, 1);
  } finally {
    await bank.close();
  }
});
