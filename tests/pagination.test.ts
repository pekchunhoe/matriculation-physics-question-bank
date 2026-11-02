import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { Bank } from '../server/database.js';
import { TursoAdapter } from '../server/turso-adapter.js';
import { applyMigrations } from '../server/migrations.js';
import { createApp } from '../server/app.js';
import { imageEnvironment } from './image-fixture.js';
import { seedQuestionCopies, seedLegacyQuestions } from './pagination-fixture.js';
import { authenticatedFetch } from './auth-fixture.js';
import { seedStudentSession } from './student-fixture.js';
import {
  parseQuestionPage,
  questionPagination,
  questionPageNumbers,
} from '../shared/pagination.js';

for (const adapter of ['sqlite', 'turso'] as const)
  test(`${adapter}: real filtered SQL pagination at every required boundary through 1,000 questions`, async () => {
    let bank: Bank | undefined;
    if (adapter === 'turso') {
      bank = new Bank(new TursoAdapter(createClient({ url: 'file::memory:' })));
      await applyMigrations(bank.db);
    }
    const e = await imageEnvironment(bank);
    try {
      assert.deepEqual(await e.service.list(), { items: [], ...questionPagination(0) });
      const q = (await e.create()).question;
      await e.service.status(
        q.id,
        { status: 'approved', expectedRevision: 1, confirmed: true },
        e.actor,
      );
      let previous = 1;
      for (const count of [1, 9, 10, 11, 20, 21, 100, 101, 1000]) {
        await seedQuestionCopies(e.bank, q.id, previous, count - previous);
        previous = count;
        const first = await e.service.list(),
          last = await e.service.list({ page: '100000' });
        assert.equal(first.total, count);
        assert.equal(first.page, 1);
        assert.equal(first.pages, Math.ceil(count / 10));
        assert.equal(first.items.length, Math.min(10, count));
        assert.equal(last.page, first.pages);
        assert.equal(last.items.length, count % 10 || 10);
        assert.equal(last.pageSize, 10);
      }
      const ids: string[] = [];
      for (let page = 1; page <= 100; page++) {
        const result = await e.service.list({
          page: String(page),
          semester: 'semester-1',
          difficulty: 'medium',
        });
        ids.push(...result.items.map((q) => q.id));
      }
      assert.equal(new Set(ids).size, 1000, 'Stable ordering never repeats or omits a question');
      assert.deepEqual(ids, [...ids].sort());
      assert.equal((await e.service.list({ limit: '50' })).items.length, 10);
      assert.equal((await e.service.list({ limit: '1' })).items.length, 1);
      for (const invalid of [
        '0',
        '-1',
        '1.5',
        'NaN',
        'Infinity',
        '100001',
        '',
        '1e2',
        '2 OR 1=1',
      ]) {
        await assert.rejects(e.service.list({ page: invalid }), /pagination/);
        await assert.rejects(e.service.list({ limit: invalid }), /pagination/);
      }
      // A shrinking result set returns a valid last page, including an empty first page.
      await e.bank.run("UPDATE image_questions SET status='retired' WHERE id<>?", q.id);
      const shrunk = await e.service.list({ page: '100' });
      assert.equal(shrunk.page, 1);
      assert.equal(shrunk.total, 1);
      await e.bank.run("UPDATE image_questions SET status='retired' WHERE id=?", q.id);
      assert.deepEqual(await e.service.list({ page: '100' }), {
        items: [],
        ...questionPagination(0),
      });
    } finally {
      await e.close();
    }
  });

test('All hierarchy filters, search, status and combined filters apply before count and LIMIT', async () => {
  const e = await imageEnvironment();
  try {
    const q = (await e.create()).question;
    await e.service.status(
      q.id,
      { status: 'approved', expectedRevision: 1, confirmed: true },
      e.actor,
    );
    await seedQuestionCopies(e.bank, q.id, 0, 20);
    const filters = {
      curriculum: q.curriculumVersionId,
      semester: q.semesterId,
      chapter: q.chapterId,
      topic: q.topicId,
      subtopic: q.subtopicId!,
      difficulty: q.difficultyId,
      status: 'approved',
      q: 'Momentum',
    };
    for (const [key, value] of Object.entries(filters)) {
      assert.equal((await e.service.list({ [key]: value, page: '2' })).total, 21, key);
      assert.equal((await e.service.list({ [key]: 'missing', page: '2' })).total, 0, key);
    }
    assert.equal((await e.service.list({ ...filters, page: '3' })).items.length, 1);
    assert.equal((await e.service.list({ q: "' OR 1=1 --" })).total, 0);
    await e.create(); // Unpublished records remain excluded from all student results.
    assert.equal((await e.service.list({ status: 'draft' })).total, 0);
    assert.equal((await e.service.list({ status: 'draft' }, true)).total, 1);
    const list = await e.service.list({ page: '2' });
    const selected = await e.service.questionSet(list.items.map((q) => q.id).join(','));
    assert.equal(selected.items.length, 10);
    assert.ok(
      selected.items.every(
        (item) =>
          item.answerImage?.key === q.answerImage!.key &&
          item.questionImage.key === q.questionImage.key,
      ),
    );
  } finally {
    await e.close();
  }
});

test('API caps requested limits, rejects malformed parameters, keeps legacy compatibility and access controls', async () => {
  const e = await imageEnvironment();
  const server = createApp(e.bank, e.storage).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}/api`,
    admin = authenticatedFetch(e.cookie),
    student = authenticatedFetch(await seedStudentSession(e.bank));
  try {
    const q = (await e.create()).question;
    await seedQuestionCopies(e.bank, q.id, 0, 20);
    await seedLegacyQuestions(e.bank, e.momentum, 21);
    const page = await admin(base + '/questions?limit=1000&page=2').then((r) => r.json());
    assert.equal(page.items.length, 10);
    assert.equal(page.total, 21);
    for (const query of ['page=1&page=2', 'page[x]=1', 'page=0', 'limit=1.5'])
      assert.equal((await admin(base + '/questions?' + query)).status, 400, query);
    assert.equal((await student(base + '/questions')).status, 200);
    assert.equal((await student(base + '/questions').then((r) => r.json())).total, 0);
    assert.equal((await fetch(base + '/questions')).status, 401);
    assert.equal((await student(base + '/admin/legacy-questions')).status, 401);
    const legacy = await admin(base + '/admin/legacy-questions?paginated=true&page=3').then((r) =>
      r.json(),
    );
    assert.equal(legacy.total, 21);
    assert.equal(legacy.pages, 3);
    assert.equal(legacy.items.length, 1);
    assert.equal((await admin(base + '/admin/legacy-questions').then((r) => r.json())).length, 10);
    for (const value of ['page=0', 'page=1&page=2', 'page[]=1', 'page=1.5'])
      assert.equal((await admin(base + '/admin/legacy-questions?' + value)).status, 400);
    const before = await e.bank.legacyQuestionPage(3);
    await e.service.save(
      undefined,
      { ...e.fixture(), legacyId: String(before.items[0].id) },
      e.pair,
      e.actor,
    );
    const after = await e.bank.legacyQuestionPage(3);
    assert.equal(after.total, 20);
    assert.equal(after.page, 2);
    assert.equal(after.items.length, 10);
    assert.equal(
      (await e.bank.one('SELECT COUNT(*) n FROM questions'))!.n,
      21,
      'Conversion preserves source records',
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await e.close();
  }
});

test('Filtered totals and page contents exclude questions from other syllabuses, semesters, topics and difficulties', async () => {
  const e = await imageEnvironment();
  try {
    const publish = async (input: ReturnType<typeof e.fixture>) => {
      const q = (await e.service.save(undefined, input, e.pair, e.actor)).question;
      return e.service.status(
        q.id,
        { status: 'approved', expectedRevision: 1, confirmed: true },
        e.actor,
      );
    };
    const base = await publish(e.fixture());
    await seedQuestionCopies(e.bank, base.id, 0, 20);
    await publish({
      ...e.fixture(),
      semesterId: 'semester-2',
      chapterId: e.c2,
      topicId: e.circular,
      subtopicId: e.circularSubtopic,
    });
    await publish({ ...e.fixture(), topicId: e.dynamics, subtopicId: null });
    await publish({ ...e.fixture(), difficultyId: 'easy' });
    await e.bank.curriculum.createVersion(
      {
        courseId: 'matriculation-physics',
        code: 'TEST-PAGING',
        name: 'TEST ONLY pagination syllabus',
        effectiveFrom: null,
        effectiveTo: null,
        status: 'draft',
        order: 2,
        cloneFromId: base.curriculumVersionId,
      },
      'TEST ONLY clone',
    );
    const tax = await e.bank.taxonomy(),
      version = tax.curriculumVersions!.find((v) => v.code === 'TEST-PAGING')!,
      semester = tax.semesters.find(
        (s) => s.curriculumVersionId === version.id && s.name === 'Semester 1',
      )!,
      chapter = tax.chapters.find(
        (c) => c.parentId === semester.id && c.name === 'TEST ONLY Chapter 2',
      )!,
      topic = tax.topics.find((t) => t.parentId === chapter.id && t.name === 'TEST ONLY Momentum')!,
      subtopic = tax.subtopics.find((s) => s.parentId === topic.id)!;
    // Isolated fixture only: retain the published source as retired and make the clone active.
    await e.bank.run(
      "UPDATE curriculum_versions SET status='retired' WHERE id=?",
      base.curriculumVersionId,
    );
    await e.bank.run("UPDATE curriculum_versions SET status='active' WHERE id=?", version.id);
    await publish({
      ...e.fixture(),
      curriculumVersionId: version.id,
      semesterId: semester.id,
      chapterId: chapter.id,
      topicId: topic.id,
      subtopicId: subtopic.id,
    });
    assert.equal((await e.service.list()).total, 25);
    const filters = {
      curriculum: base.curriculumVersionId,
      semester: base.semesterId,
      chapter: base.chapterId,
      topic: base.topicId,
      subtopic: base.subtopicId!,
      difficulty: base.difficultyId,
      q: 'Momentum',
    };
    const found: string[] = [];
    for (const page of ['1', '2', '3']) {
      const result = await e.service.list({ ...filters, page });
      assert.equal(result.total, 21);
      assert.equal(result.pages, 3);
      assert.ok(
        result.items.every(
          (q) =>
            q.curriculumVersionId === base.curriculumVersionId &&
            q.semesterId === base.semesterId &&
            q.topicId === base.topicId &&
            q.subtopicId === base.subtopicId &&
            q.difficultyId === 'medium',
        ),
      );
      found.push(...result.items.map((q) => q.id));
    }
    assert.equal(new Set(found).size, 21);
    assert.equal((await e.service.list({ curriculum: version.id })).total, 1);
    assert.equal((await e.service.list({ semester: 'semester-2' })).total, 1);
    assert.equal((await e.service.list({ difficulty: 'easy' })).total, 1);
    assert.equal((await e.service.list({ topic: e.dynamics })).total, 1);
  } finally {
    await e.close();
  }
});

test('Compact page numbers cover start, middle and end without growing with the bank', () => {
  assert.equal(parseQuestionPage(undefined), 1);
  for (const total of [1, 2, 5, 7, 8, 24, 100, 100000])
    for (const page of [1, Math.ceil(total / 2), total]) {
      const numbers = questionPageNumbers(page, total);
      assert.ok(numbers.length <= 7);
      assert.ok(numbers.includes(page));
      assert.ok(numbers.includes(1));
      assert.ok(numbers.includes(total));
      assert.equal(
        new Set(numbers.filter((n) => n !== 'gap')).size,
        numbers.filter((n) => n !== 'gap').length,
      );
    }
});
