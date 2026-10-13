import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { imageEnvironment } from './image-fixture.js';
import { orderedQuestions } from '../shared/image-question.js';
import { createImagePdf } from '../src/image-pdf.js';
import { PDFDocument } from 'pdf-lib';

for (const value of [undefined, null, '', '   '])
  test(`Optional subtopic ${JSON.stringify(value)} becomes SQL and snapshot NULL`, async () => {
    const e = await imageEnvironment();
    try {
      const input = { ...e.fixture(), subtopicId: value };
      if (value === undefined) delete input.subtopicId;
      const q = (await e.service.save(undefined, input, e.pair, e.actor)).question;
      assert.equal(q.subtopicId, null);
      assert.equal(
        (await e.bank.one('SELECT subtopic_id FROM image_questions WHERE id=?', q.id))!.subtopic_id,
        null,
      );
      const version = (await e.bank.one(
        'SELECT snapshot,classification FROM image_question_versions WHERE question_id=?',
        q.id,
      ))!;
      assert.equal(JSON.parse(String(version.snapshot)).subtopicId, null);
      assert.equal(JSON.parse(String(version.classification)).subtopic, null);
      assert.equal(await e.service.publicAsset(q.questionImage.url), false);
      const approved = await e.service.status(
        q.id,
        { status: 'approved', expectedRevision: 1, confirmed: true },
        e.actor,
      );
      assert.equal(approved.subtopicId, null);
      assert.equal((await e.service.list({ chapter: e.c1, topic: e.momentum })).total, 1);
      assert.equal((await e.service.list({ subtopic: e.subtopic })).total, 0);
      assert.equal(
        (await e.service.questionSet(q.id)).items[0].answerImage!.key,
        q.answerImage!.key,
      );
      assert.equal(await e.service.publicAsset(q.answerImage!.url), true);
    } finally {
      await e.close();
    }
  });

test('Remove and restore subtopic and change topic without uploads or changing ID; revisions stay immutable', async () => {
  const e = await imageEnvironment();
  try {
    const initial = (await e.create()).question;
    const files = readdirSync(e.directory).sort();
    const versions = await e.bank.all('SELECT * FROM image_question_versions');
    let q = initial;
    for (const subtopicId of [null, e.subtopic]) {
      q = (
        await e.service.save(
          q.id,
          { ...e.fixture(), subtopicId, expectedRevision: q.revision },
          {},
          e.actor,
        )
      ).question;
      assert.equal(q.id, initial.id);
      assert.equal(q.subtopicId, subtopicId);
      assert.deepEqual(q.questionImage, initial.questionImage);
      assert.deepEqual(q.answerImage, initial.answerImage);
    }
    q = (
      await e.service.save(
        q.id,
        { ...e.fixture(), topicId: e.dynamics, subtopicId: null, expectedRevision: q.revision },
        {},
        e.actor,
      )
    ).question;
    assert.equal(q.topicId, e.dynamics);
    assert.equal(q.subtopicId, null);
    assert.equal(q.revision, 4);
    assert.deepEqual(readdirSync(e.directory).sort(), files);
    assert.deepEqual(
      await e.bank.all('SELECT * FROM image_question_versions WHERE revision=1'),
      versions,
    );
    await assert.rejects(
      () =>
        e.service.save(
          q.id,
          { ...e.fixture(), subtopicId: null, expectedRevision: 1 },
          {},
          e.actor,
        ),
      /changed/,
    );
    assert.equal((await e.bank.one('SELECT COUNT(*) n FROM image_assets'))!.n, 2);
  } finally {
    await e.close();
  }
});

test('Optional subtopic preserves required fields and rejects invalid and cross-hierarchy mappings before uploading', async () => {
  const e = await imageEnvironment();
  try {
    const base = { ...e.fixture(), subtopicId: null };
    for (const field of [
      'curriculumVersionId',
      'semesterId',
      'chapterId',
      'topicId',
      'difficultyId',
      'totalMarks',
    ]) {
      const omitted: Record<string, unknown> = { ...base };
      delete omitted[field];
      await assert.rejects(() => e.service.save(undefined, omitted, e.pair, e.actor));
    }
    for (const invalid of [
      { curriculumVersionId: 'missing' },
      { semesterId: 'semester-2' },
      { chapterId: e.c2 },
      { topicId: '' },
      { topicId: 'missing' },
      { difficultyId: 'missing' },
      { totalMarks: 0 },
      { subtopicId: 'missing' },
      { subtopicId: e.circularSubtopic },
      { subtopicId: 42 },
      { topicId: e.dynamics, subtopicId: e.subtopic },
    ])
      await assert.rejects(() =>
        e.service.save(undefined, { ...base, ...invalid }, e.pair, e.actor),
      );
    for (const files of [{}, { question: e.pair.question }, { answer: e.pair.answer }])
      await assert.rejects(() => e.service.save(undefined, base, files, e.actor));
    assert.deepEqual(readdirSync(e.directory), []);
  } finally {
    await e.close();
  }
});

test('Mixed subtopic PDF set keeps nulls first, stable IDs, filters and both images', async () => {
  const e = await imageEnvironment();
  try {
    const withSubtopic = (await e.create()).question;
    const a = (
      await e.service.save(undefined, { ...e.fixture(), subtopicId: null }, e.pair, e.actor)
    ).question;
    const b = (
      await e.service.save(undefined, { ...e.fixture(), subtopicId: null }, e.pair, e.actor)
    ).question;
    const items = [withSubtopic, b, a];
    for (const q of items)
      await e.service.status(
        q.id,
        { status: 'approved', expectedRevision: 1, confirmed: true },
        e.actor,
      );
    const expected = [a.id, b.id].sort().concat(withSubtopic.id);
    const tax = await e.bank.taxonomy();
    assert.deepEqual(
      orderedQuestions(items, tax).map((q) => q.id),
      expected,
    );
    assert.deepEqual(
      orderedQuestions(items.reverse(), tax).map((q) => q.id),
      expected,
    );
    assert.deepEqual(
      (await e.service.list({ topic: e.momentum })).items.map((q) => q.id),
      expected,
    );
    assert.deepEqual(
      (await e.service.list({ subtopic: e.subtopic })).items.map((q) => q.id),
      [withSubtopic.id],
    );
    const set = await e.service.questionSet(items.map((q) => q.id).join(','));
    assert.deepEqual(
      set.items.map((q) => q.id),
      expected,
    );
    const pdf = await PDFDocument.load(
      await createImagePdf(
        set.items,
        tax,
        async (asset) => new Uint8Array((await e.storage.get(asset.key))!.bytes),
      ),
    );
    assert.equal(pdf.getPageCount(), 6);
    assert.throws(() => orderedQuestions([{ ...a, subtopicId: 'missing' }], tax), /classification/);
  } finally {
    await e.close();
  }
});

test('Subtopics from another syllabus are rejected even when their labels match', async () => {
  const e = await imageEnvironment();
  try {
    await e.bank.curriculum.createVersion(
      {
        courseId: 'matriculation-physics',
        code: 'TEST-OTHER',
        name: 'TEST ONLY other syllabus',
        effectiveFrom: null,
        effectiveTo: null,
        status: 'draft',
        order: 2,
        cloneFromId: e.fixture().curriculumVersionId,
      },
      'TEST ONLY',
    );
    const tax = await e.bank.taxonomy();
    const foreign = tax.subtopics.find((s) => s.id !== e.subtopic && s.id !== e.circularSubtopic)!;
    await assert.rejects(
      () => e.service.save(undefined, { ...e.fixture(), subtopicId: foreign.id }, e.pair, e.actor),
      /hierarchy/,
    );
    assert.deepEqual(readdirSync(e.directory), []);
  } finally {
    await e.close();
  }
});
