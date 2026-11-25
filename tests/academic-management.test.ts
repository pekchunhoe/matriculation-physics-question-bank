import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { createApp } from '../server/app.js';
import { Bank } from '../server/database.js';
import { ImageQuestionService } from '../server/image-questions.js';
import { applyMigrations } from '../server/migrations.js';
import { TursoAdapter } from '../server/turso-adapter.js';
import { unassignedId } from '../server/unassigned.js';
import { authenticatedFetch } from './auth-fixture.js';
import { setup } from './fixtures.js';
import { imageEnvironment } from './image-fixture.js';
import { seedLegacyQuestions, seedQuestionCopies } from './pagination-fixture.js';
import { seedStudentSession } from './student-fixture.js';

async function move(bank: Bank, topic: string, chapter: string, confirmed = true) {
  const impact = await bank.curriculum.impact('topics', topic);
  return bank.curriculum.edit('topics', topic, {
    parentId: chapter,
    expectedRevision: impact.revision,
    impactToken: impact.token,
    confirmImpact: confirmed,
    note: 'TEST ONLY relocation',
  });
}

test('Unused topics and their subtopics move within a semester with confirmation and atomic auditing', async () => {
  const e = await setup();
  const { bank } = e;
  try {
    const chapter = await bank.addTaxon('chapters', 'TEST ONLY Destination', 'semester-1', true);
    await assert.rejects(() => move(bank, e.dynamics, chapter, false), /confirm/i);
    await move(bank, e.dynamics, chapter);
    await assert.rejects(() => move(bank, e.dynamics, e.c2), /same semester/);
    const before = await bank.curriculum.impact('topics', e.momentum);
    assert.equal(before.descendants, 1);
    assert.equal(before.currentQuestions, 0);
    const original = bank.run.bind(bank);
    bank.run = async (sql, ...params) => {
      if (sql.startsWith('INSERT INTO curriculum_events')) throw new Error('TEST ONLY rollback');
      return original(sql, ...params);
    };
    try {
      await assert.rejects(() => move(bank, e.momentum, chapter), /TEST ONLY rollback/);
    } finally {
      bank.run = original;
    }
    assert.equal(
      (await bank.one('SELECT chapter_id FROM topics WHERE id=?', e.momentum))?.chapter_id,
      e.c1,
    );
    const conflict = await bank.addTaxon('topics', 'TEST ONLY Momentum', chapter, true);
    await assert.rejects(() => move(bank, e.momentum, chapter), /already exists/);
    await bank.run('UPDATE topics SET slug=? WHERE id=?', 'test-only-stable-alias', conflict);
    const version = await bank.curriculum.createVersion(
      {
        courseId: 'matriculation-physics',
        code: 'TEST-VERSION',
        name: 'TEST ONLY Version',
        effectiveFrom: null,
        effectiveTo: null,
        status: 'draft',
        order: 0,
      },
      'TEST ONLY new version',
    );
    const semester = await bank.addTaxon(
      'semesters',
      'Semester 1',
      'matriculation-physics',
      true,
      version.id,
    );
    const otherVersion = await bank.addTaxon('chapters', 'TEST ONLY Other Version', semester, true);
    await assert.rejects(() => move(bank, e.momentum, otherVersion), /one curriculum version/);
    await bank.run('UPDATE topics SET name=? WHERE id=?', 'TEST ONLY Other Label', conflict);
    await move(bank, e.momentum, chapter);
    assert.equal(
      (await bank.one('SELECT chapter_id FROM topics WHERE id=?', e.momentum))?.chapter_id,
      chapter,
    );
    assert.equal(
      (await bank.one('SELECT topic_id FROM subtopics WHERE id=?', e.subtopic))?.topic_id,
      e.momentum,
    );
    assert.deepEqual(await bank.all('PRAGMA foreign_key_check'), []);
  } finally {
    await bank.close();
  }
});

test('Existing triggers block live and historical topic moves and every permanent topic or subtopic deletion', async () => {
  const e = await imageEnvironment();
  try {
    const chapter = await e.bank.addTaxon('chapters', 'TEST ONLY Destination', 'semester-1', true);
    const { question } = await e.create();
    await assert.rejects(
      () => e.bank.run('DELETE FROM subtopics WHERE id=?', e.subtopic),
      /Retire curriculum items/,
    );
    await assert.rejects(
      () => e.bank.run('DELETE FROM topics WHERE id=?', e.momentum),
      /Retire curriculum items/,
    );
    for (let count = 1; count <= 2; count++) {
      assert.equal((await e.bank.curriculum.impact('topics', e.momentum)).currentQuestions, count);
      await assert.rejects(() => move(e.bank, e.momentum, chapter), /referenced/);
      await assert.rejects(
        () => e.bank.run('UPDATE topics SET chapter_id=? WHERE id=?', chapter, e.momentum),
        /Referenced image question topic cannot move/,
      );
      if (count === 1) await e.create();
    }
    for (const row of await e.bank.all('SELECT id FROM image_questions')) {
      await e.service.changeAssignment(
        String(row.id),
        { expectedRevision: 1, confirmed: true, mapping: null },
        e.actor,
      );
    }
    const impact = await e.bank.curriculum.impact('topics', e.momentum);
    assert.equal(impact.currentQuestions, 0);
    assert.equal(impact.historicalQuestions, 2);
    await assert.rejects(() => move(e.bank, e.momentum, chapter), /referenced/);
    await assert.rejects(
      () => e.bank.run('UPDATE topics SET chapter_id=? WHERE id=?', chapter, e.momentum),
      /Referenced image question topic cannot move/,
    );
    const unusedSubtopic = await e.bank.addTaxon('subtopics', 'TEST ONLY Unused', e.dynamics);
    for (const [table, id] of [
      ['topics', e.dynamics],
      ['topics', e.momentum],
      ['subtopics', unusedSubtopic],
      ['subtopics', e.subtopic],
    ]) {
      await assert.rejects(
        () =>
          e.bank.transaction(async () => {
            await e.bank.run('UPDATE image_questions SET total_marks=17 WHERE id=?', question.id);
            await e.bank.run(`DELETE FROM ${table} WHERE id=?`, id);
          }),
        /Retire curriculum items instead of deleting them/,
      );
      assert.ok(await e.bank.one(`SELECT id FROM ${table} WHERE id=?`, id));
      assert.equal((await e.service.get(question.id, true)).totalMarks, question.totalMarks);
    }
    await seedLegacyQuestions(e.bank, e.dynamics, 1);
    await e.bank.run("UPDATE questions SET status='retired' WHERE topic_id=?", e.dynamics);
    assert.equal((await e.bank.curriculum.impact('topics', e.dynamics)).currentQuestions, 1);
    await assert.rejects(
      () => e.bank.run('UPDATE topics SET chapter_id=? WHERE id=?', chapter, e.dynamics),
      /Referenced or cross-version topics cannot move/,
    );
  } finally {
    await e.close();
  }
});

for (const adapter of ['SQLite', 'local libSQL'])
  test(`${adapter}: holding records, question mapping and immutable audit history are atomic, reusable and schema-neutral`, async () => {
    const existing =
      adapter === 'SQLite'
        ? undefined
        : new Bank(new TursoAdapter(createClient({ url: 'file::memory:' })));
    if (existing) await applyMigrations(existing.db);
    const e = await imageEnvironment(existing);
    try {
      const { bank, actor } = e;
      const schemaSql = 'SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name';
      const schema = await bank.all(schemaSql);
      const service = new ImageQuestionService(bank);
      const { question } = await e.create();
      const retired = await e.service.status(
        question.id,
        { status: 'retired', expectedRevision: 1, confirmed: true },
        actor,
      );
      const toHolding = { expectedRevision: retired.revision, confirmed: true, mapping: null };
      const before = await bank.one('SELECT * FROM image_questions WHERE id=?', retired.id);
      await assert.rejects(
        () => service.changeAssignment(retired.id, toHolding, 'missing-actor'),
        /FOREIGN KEY/i,
      );
      assert.deepEqual(
        await bank.one('SELECT * FROM image_questions WHERE id=?', retired.id),
        before,
      );
      assert.equal(
        await bank.one(
          'SELECT id FROM chapters WHERE id=?',
          unassignedId('chapter', retired.semesterId),
        ),
        undefined,
      );
      const held = await service.changeAssignment(retired.id, toHolding, actor);
      assert.equal(held.semesterId, retired.semesterId);
      assert.equal(held.curriculumVersionId, retired.curriculumVersionId);
      assert.equal(held.subtopicId, null);
      assert.equal(held.unassigned, true);
      const second = (await e.create()).question;
      await service.changeAssignment(
        second.id,
        { expectedRevision: second.revision, confirmed: true, mapping: null },
        actor,
      );
      assert.equal(
        (await bank.all('SELECT id FROM chapters WHERE slug=?', 'system-unassigned-questions'))
          .length,
        1,
      );
      assert.equal(
        (await bank.all('SELECT id FROM topics WHERE slug=?', 'system-unassigned-questions'))
          .length,
        1,
      );
      assert.ok(!(await bank.taxonomy()).topics.some((t) => t.id === held.topicId));
      assert.ok(
        !(await bank.curriculum.export(held.curriculumVersionId)).semesters.some((s) =>
          s.chapters.some((c) => c.id === held.chapterId),
        ),
      );
      await assert.rejects(
        () => bank.addTaxon('chapters', 'Unassigned Questions', held.semesterId),
        /reserved/,
      );
      await assert.rejects(
        () => bank.addTaxon('subtopics', 'TEST ONLY Entry', held.topicId),
        /protected/,
      );
      await assert.rejects(() => bank.curriculum.edit('topics', held.topicId, {}), /protected/);
      const target = {
        curriculumVersionId: retired.curriculumVersionId,
        semesterId: retired.semesterId,
        chapterId: retired.chapterId,
        topicId: retired.topicId,
        subtopicId: e.subtopic,
      };
      const reassign = { expectedRevision: held.revision, confirmed: true, mapping: target };
      await assert.rejects(
        () =>
          service.changeAssignment(
            retired.id,
            { ...reassign, mapping: { ...target, topicId: e.dynamics } },
            actor,
          ),
        /valid syllabus/,
      );
      await assert.rejects(
        () => service.changeAssignment(retired.id, reassign, 'missing-actor'),
        /FOREIGN KEY/i,
      );
      assert.deepEqual(await service.get(retired.id, true), held);
      const restored = await service.changeAssignment(retired.id, reassign, actor);
      assert.deepEqual(restored, { ...retired, revision: retired.revision + 2 });
      assert.equal((await service.list({}, true, true)).total, 1);
      assert.equal((await service.list({}, true)).total, 1);
      await assert.rejects(() => service.changeAssignment(retired.id, reassign, actor), /changed/);
      assert.equal(
        (await bank.all('SELECT * FROM image_question_versions WHERE question_id=?', retired.id))
          .length,
        4,
      );
      const version = await bank.curriculum.createVersion(
        {
          courseId: 'matriculation-physics',
          code: 'TEST-HOLDING',
          name: 'TEST ONLY Holding',
          effectiveFrom: null,
          effectiveTo: null,
          status: 'draft',
          order: 0,
        },
        'TEST ONLY another version',
      );
      const semester = await bank.addTaxon(
        'semesters',
        'Semester 2',
        'matriculation-physics',
        true,
        version.id,
      );
      const chapter = await bank.addTaxon('chapters', 'TEST ONLY Chapter', semester, true);
      const topic = await bank.addTaxon('topics', 'TEST ONLY Topic', chapter, true);
      await service.changeAssignment(
        second.id,
        {
          expectedRevision: 2,
          confirmed: true,
          mapping: {
            curriculumVersionId: version.id,
            semesterId: semester,
            chapterId: chapter,
            topicId: topic,
            subtopicId: null,
          },
        },
        actor,
      );
      const otherHolding = await service.changeAssignment(
        second.id,
        {
          expectedRevision: 3,
          confirmed: true,
          mapping: null,
        },
        actor,
      );
      assert.equal(otherHolding.curriculumVersionId, version.id);
      assert.equal(otherHolding.semesterId, semester);
      assert.notEqual(otherHolding.topicId, held.topicId);
      await service.changeAssignment(
        retired.id,
        {
          expectedRevision: restored.revision,
          confirmed: true,
          mapping: null,
        },
        actor,
      );
      assert.equal((await service.list({}, true, true)).total, 2);
      assert.equal((await service.list({ curriculum: version.id }, true, true)).total, 1);
      assert.deepEqual(await bank.all(schemaSql), schema);
      assert.deepEqual(await bank.all('PRAGMA foreign_key_check'), []);
    } finally {
      await e.close();
    }
  });

test('Holding pages paginate and only administrators can read held images, records and assignments', async () => {
  const e = await imageEnvironment();
  const server = createApp(e.bank, e.storage).listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const admin = authenticatedFetch(e.cookie);
    const student = authenticatedFetch(await seedStudentSession(e.bank));
    const draft = (await e.create()).question;
    const published = await e.service.status(
      draft.id,
      { status: 'approved', expectedRevision: draft.revision, confirmed: true },
      e.actor,
    );
    const detail = base + '/api/questions/' + published.id;
    const selection = base + '/api/public/question-set?ids=' + published.id;
    const queue = base + '/api/admin/unassigned';
    const path = queue + '/' + published.id;
    const patch = (body: unknown) => ({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const hold = patch({ expectedRevision: published.revision, confirmed: true, mapping: null });
    assert.equal((await student(selection)).status, 200);
    assert.equal((await student(queue)).status, 401);
    assert.equal((await student(path, hold)).status, 401);
    assert.equal((await fetch(queue)).status, 401);
    assert.equal((await admin(path, hold)).status, 200);
    const held = await e.service.get(published.id, true);
    assert.equal((await admin(base + '/api/counts').then((r) => r.json())).length, 0);
    assert.equal((await student(base + '/api/counts').then((r) => r.json())).length, 0);
    assert.equal(
      (
        await student(base + '/api/questions?topic=' + encodeURIComponent(held.topicId)).then((r) =>
          r.json(),
        )
      ).total,
      0,
    );
    const studentTax = await student(base + '/api/taxonomy').then((r) => r.text());
    assert.ok(!studentTax.includes('Unassigned Questions'));
    assert.equal((await student(detail + '?answers=true')).status, 404);
    assert.equal((await student(selection)).status, 409);
    for (const url of [
      held.questionImage.url,
      held.answerImage!.url,
      held.questionImage.thumbnailUrl!,
    ]) {
      assert.equal((await student(base + url)).status, 404);
      assert.equal((await admin(base + url)).status, 200);
    }
    await seedQuestionCopies(e.bank, held.id, 60, 11);
    const secondPage = await admin(queue + '?page=2').then((r) => r.json());
    assert.equal(secondPage.total, 12);
    assert.equal(secondPage.items.length, 2);
    assert.equal((await admin(queue + '?semester=semester-2').then((r) => r.json())).total, 0);
    const singleton = await admin(queue + '?q=' + held.id).then((r) => r.json());
    assert.equal(singleton.items.length, 1);
    assert.deepEqual(singleton.items[0].questionImage, published.questionImage);
    assert.deepEqual(singleton.items[0].answerImage, published.answerImage);
    assert.equal(
      (
        await admin(base + '/api/taxonomy/topics/' + encodeURIComponent(held.topicId), {
          method: 'DELETE',
        })
      ).status,
      409,
    );
    const { curriculumVersionId, semesterId, chapterId, topicId } = published;
    assert.equal(
      (
        await admin(
          path,
          patch({
            expectedRevision: held.revision,
            confirmed: true,
            mapping: { curriculumVersionId, semesterId, chapterId, topicId, subtopicId: null },
          }),
        )
      ).status,
      200,
    );
    assert.equal((await admin(queue + '?q=' + held.id).then((r) => r.json())).total, 0);
    assert.equal((await student(detail)).status, 200);
    assert.equal((await student(selection)).status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await e.close();
  }
});
