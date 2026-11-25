import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EditableKind } from '../shared/curriculum.js';
import type { Taxonomy } from '../shared/schema.js';
import { createApp } from '../server/app.js';
import type { Bank } from '../server/database.js';
import { isUnassignedId, unassignedId } from '../server/unassigned.js';
import { authenticatedFetch } from './auth-fixture.js';
import { imageEnvironment } from './image-fixture.js';
import { seedLegacyQuestions } from './pagination-fixture.js';
import { seedStudentSession } from './student-fixture.js';

async function retirement(bank: Bank, kind: EditableKind, id: string) {
  const impact = await bank.curriculum.impact(kind, id);
  return {
    status: 'retired',
    expectedRevision: impact.revision,
    impactToken: impact.token,
    confirmImpact: true,
    note: 'TEST ONLY retirement',
  };
}

const patch = (data: unknown) => ({
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

test('Taxonomy and academic filters omit retired branches while older assigned questions remain browsable and exportable', async () => {
  const e = await imageEnvironment();
  const server = createApp(e.bank, e.storage).listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const admin = authenticatedFetch(e.cookie);
    const student = authenticatedFetch(await seedStudentSession(e.bank));
    const schema = 'SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name';
    const beforeSchema = await e.bank.all(schema);

    const unusedChapter = await e.bank.addTaxon('chapters', 'TEST ONLY Empty', 'semester-1');
    const unusedSubtopic = await e.bank.addTaxon('subtopics', 'TEST ONLY Empty', e.dynamics);
    for (const [kind, id] of [
      ['chapters', unusedChapter],
      ['topics', e.dynamics],
      ['subtopics', unusedSubtopic],
    ] as const) {
      // Use an actually childless topic for the direct deletion probe.
      const unused =
        kind === 'topics' ? await e.bank.addTaxon('topics', 'TEST ONLY Empty', e.c1) : id;
      await assert.rejects(
        () => e.bank.run(`DELETE FROM ${kind} WHERE id=?`, unused),
        /Retire curriculum items/,
      );
      const response = await admin(`${base}/api/taxonomy/${kind}/${unused}`, { method: 'DELETE' });
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /including unused records/);
    }

    const { question } = await e.create();
    const published = await e.service.status(
      question.id,
      {
        status: 'approved',
        confirmed: true,
        expectedRevision: question.revision,
      },
      e.actor,
    );
    const held = await e.service.changeAssignment(
      question.id,
      {
        mapping: null,
        confirmed: true,
        expectedRevision: published.revision,
      },
      e.actor,
    );
    for (const [kind, id] of [
      ['chapters', held.chapterId],
      ['topics', held.topicId],
    ]) {
      const path = `${base}/api/taxonomy/${kind}/${encodeURIComponent(id)}`;
      for (const options of [patch({ status: 'retired' }), { method: 'DELETE' }]) {
        const response = await admin(path, options);
        assert.equal(response.status, 409);
        assert.match((await response.json()).error, /protected/);
      }
    }
    const reassigned = await e.service.changeAssignment(
      held.id,
      {
        confirmed: true,
        expectedRevision: held.revision,
        mapping: {
          curriculumVersionId: published.curriculumVersionId,
          semesterId: published.semesterId,
          chapterId: e.c1,
          topicId: e.dynamics,
          subtopicId: unusedSubtopic,
        },
      },
      e.actor,
    );
    const impact = await e.bank.curriculum.impact('topics', e.momentum);
    assert.equal(impact.currentQuestions, 0);
    assert.equal(impact.historicalQuestions, 1);
    for (const [kind, id] of [
      ['topics', e.momentum],
      ['chapters', e.c2],
    ] as const) {
      const path = `${base}/api/taxonomy/${kind}/${id}`;
      const response = await admin(path, patch(await retirement(e.bank, kind, id)));
      assert.equal(response.status, 200, await response.clone().text());
      assert.equal((await admin(path, { method: 'DELETE' })).status, 409);
    }

    // Seed a status transition that the previous application permitted with assigned questions.
    await e.bank.run("UPDATE subtopics SET status='retired' WHERE id=?", unusedSubtopic);
    const missing = [
      ['chapters', e.c2],
      ['topics', e.momentum],
      ['topics', e.circular],
      ['subtopics', e.subtopic],
      ['subtopics', e.circularSubtopic],
      ['subtopics', unusedSubtopic],
    ] as const;
    for (const request of [student, admin]) {
      const response = await request(base + '/api/taxonomy');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const tax: Taxonomy = await response.json();
      for (const [kind, id] of missing) assert.ok(!tax[kind].some((row) => row.id === id));
      assert.ok(tax.chapters.some((row) => row.id === e.c1));
      assert.ok(tax.topics.some((row) => row.id === e.dynamics));
    }
    const studentOverride: Taxonomy = await student(
      base + '/api/taxonomy?includeRetired=true',
    ).then((r) => r.json());
    const inspection: Taxonomy = await admin(base + '/api/taxonomy?includeRetired=true').then((r) =>
      r.json(),
    );
    for (const [kind, id] of missing) {
      assert.ok(!studentOverride[kind].some((row) => row.id === id));
      assert.ok(inspection[kind].some((row) => row.id === id));
    }
    assert.ok(
      ![...inspection.chapters, ...inspection.topics].some((row) => isUnassignedId(row.id)),
    );
    const query = base + '/api/questions';
    assert.equal(
      (await student(query + '?subtopic=' + unusedSubtopic).then((r) => r.json())).total,
      0,
    );
    assert.equal((await student(query + '?topic=' + e.dynamics).then((r) => r.json())).total, 1);
    assert.equal((await student(query + '/' + question.id)).status, 200);
    assert.equal((await student(base + question.questionImage.url)).status, 200);
    const selection = await student(base + '/api/public/question-set?ids=' + question.id);
    assert.equal(selection.status, 200, await selection.clone().text());
    assert.equal((await selection.json()).items[0].id, question.id);
    const kept = await e.service.get(question.id, true);
    assert.equal(kept.subtopicId, unusedSubtopic);
    assert.equal(kept.revision, reassigned.revision);
    assert.deepEqual(kept.questionImage, reassigned.questionImage);
    assert.deepEqual(await e.bank.all(schema), beforeSchema);
    assert.deepEqual(await e.bank.all('PRAGMA foreign_key_check'), []);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await e.close();
  }
});

test('Topic retirement explicitly transfers all image assignments and rolls back a failed curriculum audit', async () => {
  const e = await imageEnvironment();
  try {
    const { bank, service, actor, momentum } = e;
    const first = (await e.create()).question;
    const second = (await e.create()).question;
    const published = await service.status(
      first.id,
      { status: 'approved', confirmed: true, expectedRevision: 1 },
      actor,
    );
    const archived = await service.status(
      second.id,
      { status: 'retired', confirmed: true, expectedRevision: 1 },
      actor,
    );
    const previousHistory = await bank.all(
      'SELECT * FROM image_question_versions ORDER BY question_id,revision',
    );
    const previousAssets = await bank.all('SELECT * FROM image_assets ORDER BY key');
    for (const [kind, id] of [
      ['chapters', e.c1],
      ['subtopics', e.subtopic],
    ] as const)
      await assert.rejects(
        async () => bank.curriculum.edit(kind, id, await retirement(bank, kind, id), actor),
        /Reassign its questions/,
      );
    const edit = await retirement(bank, 'topics', momentum);
    await assert.rejects(
      () => bank.curriculum.edit('topics', momentum, edit, actor),
      /Confirm transfer/,
    );
    const withTransfer = { ...edit, transferQuestions: true };
    await assert.rejects(
      () =>
        bank.curriculum.edit('topics', momentum, { ...withTransfer, confirmImpact: false }, actor),
      /Confirm the displayed impact/,
    );
    const run = bank.run.bind(bank);
    bank.run = async (sql, ...params) => {
      if (sql.startsWith('INSERT INTO curriculum_events'))
        throw new Error('TEST ONLY failed audit');
      return run(sql, ...params);
    };
    try {
      await assert.rejects(
        () => bank.curriculum.edit('topics', momentum, withTransfer, actor),
        /failed audit/,
      );
    } finally {
      bank.run = run;
    }
    assert.equal(
      (await bank.one('SELECT status FROM topics WHERE id=?', momentum))?.status,
      'active',
    );
    assert.equal(
      await bank.one(
        'SELECT id FROM topics WHERE id=?',
        unassignedId('topic', published.semesterId),
      ),
      undefined,
    );
    assert.deepEqual(await service.get(first.id, true), published);
    assert.deepEqual(await service.get(second.id, true), archived);
    assert.deepEqual(
      await bank.all('SELECT * FROM image_question_versions ORDER BY question_id,revision'),
      previousHistory,
    );

    await bank.curriculum.edit('topics', momentum, withTransfer, actor);
    assert.equal(
      (await bank.one('SELECT status FROM topics WHERE id=?', momentum))?.status,
      'retired',
    );
    const queue = await service.list({}, true, true);
    assert.equal(queue.total, 2);
    for (const original of [published, archived]) {
      const held = await service.get(original.id, true);
      assert.deepEqual(held, {
        ...original,
        unassigned: true,
        chapterId: unassignedId('chapter', original.semesterId),
        topicId: unassignedId('topic', original.semesterId),
        subtopicId: null,
        revision: original.revision + 1,
      });
    }
    assert.deepEqual(await bank.all('SELECT * FROM image_assets ORDER BY key'), previousAssets);
    assert.deepEqual(
      await bank.all(
        'SELECT * FROM image_question_versions WHERE revision<=2 ORDER BY question_id,revision',
      ),
      previousHistory,
    );
    assert.equal((await bank.curriculum.impact('topics', momentum)).currentQuestions, 0);
    await assert.rejects(() => service.get(first.id), /not found/);
    assert.deepEqual(await bank.all('PRAGMA foreign_key_check'), []);
  } finally {
    await e.close();
  }
});

test('Topic retirement rejects legacy and pending references before moving any question', async () => {
  const e = await imageEnvironment();
  try {
    const { bank, service, momentum, actor } = e;
    const { question } = await e.create();
    await seedLegacyQuestions(bank, e.dynamics, 1);
    const legacy = 'test-legacy-page-0000';
    await bank.run(
      "INSERT INTO revision_candidates(id,question_id,base_version,source,snapshot,change_note,created_at) VALUES(?,?,1,'manual',?,'TEST ONLY','TEST ONLY')",
      'test-pending',
      legacy,
      JSON.stringify({ question: { topicId: momentum, subtopicId: null } }),
    );
    const retire = async () =>
      bank.curriculum.edit(
        'topics',
        momentum,
        {
          ...(await retirement(bank, 'topics', momentum)),
          transferQuestions: true,
        },
        actor,
      );
    await assert.rejects(retire, /Resolve pending question revisions/);
    await bank.run("UPDATE revision_candidates SET status='rejected' WHERE id='test-pending'");
    await bank.run("UPDATE questions SET topic_id=?,status='retired' WHERE id=?", momentum, legacy);
    await assert.rejects(retire, /legacy question assignments/);
    assert.deepEqual(await service.get(question.id, true), question);
    assert.equal((await service.list({}, true, true)).total, 0);
    assert.equal(
      (await bank.one('SELECT status FROM topics WHERE id=?', momentum))?.status,
      'active',
    );
  } finally {
    await e.close();
  }
});
