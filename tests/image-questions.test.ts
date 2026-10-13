import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { imageEnvironment, imageFile } from './image-fixture.js';
import { validateImage } from '../server/asset-validation.js';
import { ImageQuestionService } from '../server/image-questions.js';
import { orderedQuestions } from '../shared/image-question.js';

test('Concurrent replacements with the same revision commit only once and keep referenced files', async () => {
  const e = await imageEnvironment();
  try {
    const q = (await e.create()).question;
    const results = await Promise.allSettled(
      [6, 7].map((totalMarks) =>
        e.service.save(q.id, { ...e.fixture(), totalMarks, expectedRevision: 1 }, e.pair, e.actor),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await e.service.get(q.id, true)).revision, 2);
    assert.equal((await e.bank.all('SELECT * FROM image_question_versions')).length, 2);
    assert.equal(readdirSync(e.directory).length, 6);
    assert.ok(await e.storage.exists(q.questionImage.key));
  } finally {
    await e.close();
  }
});

test('One stable ID links both original images, required metadata and immutable revision history', async () => {
  const e = await imageEnvironment();
  try {
    const q = (await e.create()).question;
    assert.equal(q.status, 'draft');
    assert.equal(q.difficultyId, 'medium');
    assert.equal(q.totalMarks, 5);
    for (const [asset, file] of [
      [q.questionImage, e.pair.question],
      [q.answerImage!, e.pair.answer],
    ] as const) {
      assert.deepEqual((await e.storage.get(asset.key))!.bytes, file.buffer);
      assert.equal(asset.sha256, createHash('sha256').update(file.buffer).digest('hex'));
    }
    const before = await e.bank.all('SELECT * FROM image_question_versions');
    const changed = (
      await e.service.save(
        q.id,
        { ...e.fixture(), expectedRevision: 1, totalMarks: 8 },
        {},
        e.actor,
      )
    ).question;
    assert.equal(changed.id, q.id);
    assert.equal(changed.revision, 2);
    assert.deepEqual(changed.questionImage, q.questionImage);
    assert.equal((await e.bank.all('SELECT * FROM image_question_versions')).length, 2);
    assert.deepEqual(
      await e.bank.all('SELECT * FROM image_question_versions WHERE revision=1'),
      before,
    );
    await assert.rejects(() => e.bank.run('DELETE FROM image_question_versions'), /immutable/);
  } finally {
    await e.close();
  }
});
test('Drafts are private; explicit publication exposes matching pair; archive hides all assets', async () => {
  const e = await imageEnvironment();
  try {
    const q = (await e.create()).question;
    assert.equal((await e.service.list()).total, 0);
    await assert.rejects(() => e.service.get(q.id));
    assert.equal(await e.service.publicAsset(q.questionImage.url), false);
    await assert.rejects(() =>
      e.service.status(q.id, { status: 'approved', expectedRevision: 1 }, e.actor),
    );
    const approved = await e.service.status(
      q.id,
      { status: 'approved', expectedRevision: 1, confirmed: true },
      e.actor,
    );
    assert.equal((await e.service.questionSet(q.id)).items[0].answerImage!.key, q.answerImage!.key);
    assert.equal(await e.service.publicAsset(q.questionImage.thumbnailUrl!), true);
    await assert.rejects(
      () =>
        e.service.save(q.id, { ...e.fixture(), expectedRevision: approved.revision }, {}, e.actor),
      /Confirm/,
    );
    await e.service.status(
      q.id,
      { status: 'retired', expectedRevision: 2, confirmed: true },
      e.actor,
    );
    assert.equal((await e.service.list()).total, 0);
    assert.equal(await e.service.publicAsset(q.answerImage!.url), false);
  } finally {
    await e.close();
  }
});
test('Stale revisions reject both replacement and publication without uploading or altering records', async () => {
  const e = await imageEnvironment();
  try {
    const q = (await e.create()).question;
    await e.service.save(q.id, { ...e.fixture(), expectedRevision: 1 }, {}, e.actor);
    const files = readdirSync(e.directory);
    await assert.rejects(
      () => e.service.save(q.id, { ...e.fixture(), expectedRevision: 1 }, e.pair, e.actor),
      /changed/,
    );
    await assert.rejects(
      () =>
        e.service.status(
          q.id,
          { status: 'approved', expectedRevision: 1, confirmed: true },
          e.actor,
        ),
      /changed/,
    );
    assert.deepEqual(readdirSync(e.directory), files);
  } finally {
    await e.close();
  }
});
test('Malformed metadata, missing pair, wrong hierarchy and academic JSON are rejected before upload', async () => {
  const e = await imageEnvironment();
  try {
    for (const input of [
      { ...e.fixture(), totalMarks: 0 },
      { ...e.fixture(), totalMarks: 1.2 },
      { ...e.fixture(), subtopicId: 'missing-subtopic' },
      { ...e.fixture(), topicId: e.circular },
      { ...e.fixture(), semesterId: 'semester-2' },
      { ...e.fixture(), tags: ['provenance'] },
      { ...e.fixture(), scenario: 'obsolete content' },
    ])
      await assert.rejects(() => e.service.save(undefined, input, e.pair, e.actor));
    await assert.rejects(() =>
      e.service.save(undefined, e.fixture(), { question: e.pair.question }, e.actor),
    );
    assert.deepEqual(readdirSync(e.directory), []);
  } finally {
    await e.close();
  }
});
test('Failed transaction removes only fresh unreferenced uploads and preserves historical pairs', async () => {
  const e = await imageEnvironment();
  try {
    const q = (await e.create()).question,
      files = readdirSync(e.directory).sort();
    await assert.rejects(() =>
      e.service.save(q.id, { ...e.fixture(), expectedRevision: 1 }, e.pair, 'missing-admin'),
    );
    assert.deepEqual(readdirSync(e.directory).sort(), files);
    assert.equal((await e.service.get(q.id, true)).revision, 1);
  } finally {
    await e.close();
  }
});
test('An uncertain commit retains referenced uploads while reporting save failure', async () => {
  const e = await imageEnvironment();
  const original = e.bank.transaction.bind(e.bank);
  try {
    e.bank.transaction = async (fn) => {
      await original(fn);
      throw new Error('TEST uncertain commit acknowledgement');
    };
    await assert.rejects(() => e.create(), /uncertain/);
    assert.equal((await e.service.list({}, true)).total, 1);
    assert.equal(readdirSync(e.directory).length, 3);
  } finally {
    e.bank.transaction = original;
    await e.close();
  }
});
test('Upload transport failure cleans earlier receipts and never creates a partial question', async () => {
  const e = await imageEnvironment(),
    put = e.storage.put.bind(e.storage);
  let calls = 0;
  try {
    e.storage.put = async (u) => {
      if (++calls === 3) throw new Error('TEST failed answer upload');
      return put(u);
    };
    await assert.rejects(() => e.create());
    assert.equal((await e.service.list({}, true)).total, 0);
    assert.deepEqual(readdirSync(e.directory), []);
  } finally {
    await e.close();
  }
});
test('Duplicate bytes remain independent stable records; old replacement files are retained', async () => {
  const e = await imageEnvironment();
  try {
    const a = (await e.create()).question,
      b = await e.create();
    assert.notEqual(a.id, b.question.id);
    assert.equal(b.duplicateImages, 2);
    await e.service.save(a.id, { ...e.fixture(), expectedRevision: 1 }, e.pair, e.actor);
    assert.ok(await e.storage.exists(a.questionImage.key));
    assert.ok(await e.storage.exists(b.question.questionImage.key));
  } finally {
    await e.close();
  }
});
test('Publication requires intact stored images and approved snapshot', async () => {
  const e = await imageEnvironment();
  try {
    const q = (await e.create()).question;
    await e.storage.delete(q.answerImage!.key);
    await assert.rejects(() =>
      e.service.status(q.id, { status: 'approved', expectedRevision: 1, confirmed: true }, e.actor),
    );
    await e.bank.run("UPDATE image_questions SET status='approved' WHERE id=?", q.id);
    assert.equal((await e.service.list()).total, 0);
  } finally {
    await e.close();
  }
});
for (const format of ['png', 'jpeg', 'webp'] as const)
  test(`Complete ${format} validation retains bytes and dimensions`, async () => {
    const f = await imageFile('TEST ONLY', 1000, format),
      result = await validateImage(f.buffer, f.originalname, f.mimetype, true);
    assert.deepEqual(result.upload.bytes, f.buffer);
    assert.equal(result.width, 800);
    assert.equal(result.height, 1000);
    assert.ok(result.thumbnail);
  });
test('Reject truncated images, unsupported active content, MIME mismatch and oversized dimensions', async () => {
  const f = await imageFile();
  for (const bad of [
    { ...f, buffer: f.buffer.subarray(0, 100) },
    { ...f, mimetype: 'image/jpeg' },
    { ...f, originalname: '../test.png' },
    { ...f, buffer: Buffer.from('<svg/>') },
    { ...f, buffer: Buffer.alloc(1572865) },
  ])
    await assert.rejects(() => validateImage(bad.buffer, bad.originalname, bad.mimetype));
  const huge = await imageFile('TEST ONLY', 30001);
  await assert.rejects(() => validateImage(huge.buffer, huge.originalname, huge.mimetype));
});
test('Ordering uses numeric curriculum order and stable IDs; mixed sets and duplicates are rejected', async () => {
  const e = await imageEnvironment();
  try {
    const q = (await e.create()).question,
      tax = await e.bank.taxonomy();
    const c10 = await e.bank.addTaxon('chapters', 'TEST ONLY Chapter 10', 'semester-1', true),
      t10 = await e.bank.addTaxon('topics', 'TEST ONLY topic10', c10, true),
      s10 = await e.bank.addTaxon('subtopics', 'TEST ONLY sub10', t10, true);
    await e.bank.run('UPDATE chapters SET sort_order=2 WHERE id=?', e.c1);
    await e.bank.run('UPDATE chapters SET sort_order=10 WHERE id=?', c10);
    const other = (
      await e.service.save(
        undefined,
        { ...e.fixture(), chapterId: c10, topicId: t10, subtopicId: s10 },
        e.pair,
        e.actor,
      )
    ).question;
    assert.deepEqual(
      orderedQuestions([other, q], await e.bank.taxonomy()).map((x) => x.id),
      [q.id, other.id],
    );
    assert.throws(() => orderedQuestions([q, q], tax), /Duplicate/);
    assert.throws(
      () => orderedQuestions([q, { ...other, semesterId: 'semester-2' }], tax),
      /one semester/,
    );
    assert.throws(
      () =>
        orderedQuestions(
          Array.from({ length: 51 }, (_, i) => ({ ...q, id: String(i) })),
          tax,
        ),
      /50/,
    );
    await assert.rejects(
      () => new ImageQuestionService(e.bank).save(undefined, e.fixture(), e.pair, e.actor),
      /storage/,
    );
  } finally {
    await e.close();
  }
});
