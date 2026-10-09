import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../server/app.js';
import { VisibilityService } from '../server/visibility.js';
import { curriculumImportSchema, type CurriculumDocument } from '../shared/curriculum.js';
import { createTestBank } from './test-bank.js';
import { setup } from './fixtures.js';
import { seedAdminSession, authenticatedFetch } from './auth-fixture.js';

function draftIds(document: CurriculumDocument): string[] {
  return [
    document.curriculumVersion.id!,
    ...document.semesters.flatMap((semester) => [
      semester.id!,
      ...semester.chapters.flatMap((chapter) => [
        chapter.id!,
        ...chapter.topics.flatMap((topic) => [
          topic.id!,
          ...topic.subtopics.map((subtopic) => subtopic.id!),
        ]),
      ]),
    ]),
  ];
}
function assertNoDraftIds(value: unknown, ids: string[]) {
  const serialized = JSON.stringify(value);
  for (const id of ids) assert.ok(!serialized.includes(id), `Draft ID exposed: ${id}`);
}
async function fixture(
  callback: (
    bank: Awaited<ReturnType<typeof createTestBank>>,
    document: CurriculumDocument,
    ids: string[],
  ) => Promise<void>,
) {
  const bank = await createTestBank();
  try {
    const document = curriculumImportSchema.parse(
      JSON.parse(
        readFileSync(new URL('./fixtures/physics-curriculum.json', import.meta.url), 'utf8'),
      ),
    );
    const plan = await bank.curriculum.plan(document);
    assert.deepEqual(plan.counts, { semesters: 2, chapters: 18, topics: 82, subtopics: 0 });
    await bank.curriculum.import(document, plan.token, 'TEST ONLY isolated counts visibility');
    await callback(bank, document, draftIds(document));
  } finally {
    await bank.close();
  }
}
async function serve(
  bank: Awaited<ReturnType<typeof createTestBank>>,
  callback: (base: string) => Promise<void>,
) {
  const server = createApp(bank, undefined).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
async function get(base: string, path: string, request: typeof fetch = fetch) {
  const response = await request(base + path);
  assert.equal(response.status, 200, path);
  return await response.json();
}

test('Anonymous counts serialize none of the full 2/18/82 draft hierarchy IDs, including with spoofed filters', async () =>
  fixture(async (bank, _document, ids) => {
    assert.equal(ids.length, 103);
    await serve(bank, async (base) => {
      for (const query of [
        '',
        '?course=matriculation-physics',
        '?curriculum=curriculum-physics-2022-2023&role=admin&status=draft',
      ]) {
        const counts = await get(base, '/api/counts' + query);
        assertNoDraftIds(counts, ids);
        assert.equal(counts.length, 2);
        assert.deepEqual(counts.map((row: { semester_id: string }) => row.semester_id).sort(), [
          'semester-1',
          'semester-2',
        ]);
        assert.ok(
          counts.every(
            (row: { count: number; chapter_id: string | null; topic_id: string | null }) =>
              row.count === 0 && row.chapter_id === null && row.topic_id === null,
          ),
        );
      }
      for (const path of ['/api/taxonomy', '/api/curriculum-versions', '/api/questions'])
        assertNoDraftIds(await get(base, path), ids);
      assert.deepEqual(await get(base, '/api/counts?course=nonexistent-course'), []);
    });
  }));

test('Public counts and related reads require approved snapshots in published curricula, even for approved draft-version questions', async () =>
  fixture(async (bank, document, ids) => {
    const env = await setup(bank);
    const publicDoc = env.fixture('TEST-COUNTS-PUBLIC', env.momentum, 'easy');
    publicDoc.assets = [
      {
        id: 'public-diagram',
        partId: null,
        kind: 'physics_diagram',
        url: '/uploads/test-counts-public.svg',
        alt: 'TEST ONLY published diagram',
        mime: 'image/svg+xml',
        order: 0,
      },
    ];
    const publicQuestion = await bank.create(publicDoc, 'TEST ONLY public', null, true);
    for (const status of ['draft', 'reviewing', 'retired'] as const) {
      const doc = env.fixture('TEST-COUNTS-' + status.toUpperCase(), env.momentum, 'hard');
      doc.question.status = status;
      await bank.create(doc, 'TEST ONLY hidden question');
    }
    const hiddenTopic = document.semesters[1].chapters[0].topics[0].id!;
    const hiddenDoc = env.fixture('TEST-COUNTS-DRAFT-VERSION', hiddenTopic, 'easy');
    hiddenDoc.assets = [
      {
        id: 'hidden-diagram',
        partId: null,
        kind: 'physics_diagram',
        url: '/uploads/test-counts-hidden.svg',
        alt: 'TEST ONLY hidden diagram',
        mime: 'image/svg+xml',
        order: 0,
      },
    ];
    const hiddenQuestion = await bank.create(
      hiddenDoc,
      'TEST ONLY approved question in draft curriculum',
      null,
      true,
    );
    const visibility = new VisibilityService(bank);
    assert.equal(await visibility.publicAsset('/uploads/test-counts-hidden.svg'), false);
    assert.equal(await visibility.publicAsset('/uploads/test-counts-public.svg'), true);
    await serve(bank, async (base) => {
      const counts = await get(base, '/api/counts');
      assertNoDraftIds(counts, ids);
      assert.equal(
        counts.reduce((sum: number, row: { count: number }) => sum + row.count, 0),
        1,
      );
      const counted = counts.filter((row: { count: number }) => row.count > 0);
      assert.equal(counted.length, 1);
      assert.equal(counted[0].topic_id, env.momentum);
      assert.equal(counted[0].chapter_id, env.c1);
      assert.equal(counted[0].semester_id, 'semester-1');
      assert.equal(counted[0].difficulty_id, 'easy');
      for (const query of ['', '?status=approved&taxonomyStatus=all', '?q=TEST-COUNTS']) {
        const listing = await get(base, '/api/questions' + query);
        assertNoDraftIds(listing, ids);
        assert.equal(listing.total, 1);
        assert.equal(listing.items[0].id, publicQuestion.id);
      }
      assert.equal(
        (await get(base, '/api/questions?curriculum=' + document.curriculumVersion.id)).total,
        0,
      );
      assert.equal((await get(base, '/api/questions?topic=' + hiddenTopic)).total, 0);
      assert.equal(
        (await fetch(base + '/api/questions/' + hiddenQuestion.id + '?view=student')).status,
        404,
      );
      assert.equal(
        (await fetch(base + '/api/public/question-set?ids=' + hiddenQuestion.id)).status,
        404,
      );
      assert.equal(
        (await fetch(base + '/api/questions/' + publicQuestion.id + '?view=student')).status,
        200,
      );
      const admin = authenticatedFetch(await seedAdminSession(bank));
      const adminCounts = await get(base, '/api/counts', admin);
      assert.equal(
        adminCounts.reduce((sum: number, row: { count: number }) => sum + row.count, 0),
        5,
      );
      assert.equal(
        (await get(base, '/api/questions/' + hiddenQuestion.id, admin)).id,
        hiddenQuestion.id,
      );
    });
  }));

test('Retired published curriculum counts and approved questions remain public alongside active curriculum', async () =>
  fixture(async (bank, _document, ids) => {
    const env = await setup(bank);
    await bank.create(
      env.fixture('TEST-COUNTS-ACTIVE', env.momentum, 'easy'),
      'TEST ONLY active',
      null,
      true,
    );
    const retired = await bank.curriculum.createVersion(
      {
        courseId: 'matriculation-physics',
        code: 'TEST-COUNTS-HISTORY',
        name: 'TEST ONLY published history',
        effectiveFrom: null,
        effectiveTo: null,
        status: 'draft',
        order: 2,
        cloneFromId: 'legacy-matriculation-physics',
      },
      'TEST ONLY history fixture',
      null,
    );
    const tax = await bank.taxonomy();
    const semester = tax.semesters.find((row) => row.curriculumVersionId === retired.id)!;
    const chapter = tax.chapters.find((row) => row.parentId === semester.id)!;
    const topic = tax.topics.find((row) => row.parentId === chapter.id)!;
    const history = await bank.create(
      env.fixture('TEST-COUNTS-HISTORY', topic.id, 'hard'),
      'TEST ONLY historical public question',
      null,
      true,
    );
    const impact = await bank.curriculum.impact('curriculumVersions', retired.id);
    await bank.curriculum.editVersion(retired.id, {
      name: 'TEST ONLY published history',
      effectiveFrom: null,
      effectiveTo: null,
      status: 'retired',
      order: 2,
      expectedRevision: impact.revision,
      impactToken: impact.token,
      confirmImpact: true,
      note: 'TEST ONLY retired fixture',
    });
    await serve(bank, async (base) => {
      const counts = await get(base, '/api/counts?course=matriculation-physics');
      assertNoDraftIds(counts, ids);
      assert.equal(
        counts.reduce((sum: number, row: { count: number }) => sum + row.count, 0),
        2,
      );
      assert.equal(counts.find((row: { topic_id: string }) => row.topic_id === topic.id).count, 1);
      assert.equal(
        (await get(base, '/api/questions?curriculum=' + retired.id)).items[0].id,
        history.id,
      );
      assert.equal((await fetch(base + '/api/questions/' + history.id)).status, 200);
      assert.ok(
        (await get(base, '/api/taxonomy')).curriculumVersions.some(
          (version: { id: string }) => version.id === retired.id,
        ),
      );
    });
  }));

test('Only a genuine authenticated admin retains counts for all 82 draft topics', async () =>
  fixture(async (bank, document, ids) => {
    const admin = authenticatedFetch(await seedAdminSession(bank));
    await serve(bank, async (base) => {
      const publicCounts = await get(base, '/api/counts');
      assertNoDraftIds(publicCounts, ids);
      const spoofed = await fetch(base + '/api/counts', {
        headers: { Cookie: 'qb_admin=invalid', 'X-Admin-Role': 'admin' },
      });
      assert.equal(spoofed.status, 200);
      assertNoDraftIds(await spoofed.json(), ids);
      const counts = await get(base, '/api/counts?course=matriculation-physics', admin);
      assert.equal(counts.length, 84);
      const draftTopics = document.semesters.flatMap((semester) =>
        semester.chapters.flatMap((chapter) => chapter.topics.map((topic) => topic.id!)),
      );
      assert.equal(draftTopics.length, 82);
      for (const id of draftTopics)
        assert.ok(counts.some((row: { topic_id: string }) => row.topic_id === id));
      assert.ok(counts.every((row: { count: number }) => row.count === 0));
    });
  }));
