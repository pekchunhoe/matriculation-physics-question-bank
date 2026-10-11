import { createTestBank } from './test-bank.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Bank } from '../server/database.js';
import { createApp } from '../server/app.js';
import { seedAdminSession, authenticatedFetch } from './auth-fixture.js';
import { LocalAssetStorage } from '../server/local-asset-storage.js';
import { setup } from './fixtures.js';
import type { CurriculumDocument, EditableKind } from '../shared/curriculum.js';

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
        name: 'TEST DATA Semester',
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

for (const kind of ['semesters', 'chapters', 'topics', 'subtopics'] as const)
  test(`Rename ${kind} preserves linked content, IDs, slugs and historical names`, async () => {
    const env = await setup(),
      { bank, fixture } = env;
    try {
      const doc = fixture(`TEST-RENAME-${kind.toUpperCase()}`),
        q = await bank.create(doc, 'TEST DATA', null, true);
      const id = {
        semesters: 'semester-1',
        chapters: env.c1,
        topics: env.momentum,
        subtopics: env.subtopic,
      }[kind];
      const before = (await bank.taxonomy())[kind].find((t) => t.id === id)!;
      const saved = await bank.savedClassification(q.id);
      await assert.rejects(
        async () => await edit(bank, kind, id, { name: 'TEST DATA renamed' }, false),
        /Confirm/,
      );
      await edit(bank, kind, id, { name: 'TEST DATA renamed' });
      assert.equal((await bank.taxonomy())[kind].find((t) => t.id === id)?.slug, before.slug);
      assert.deepEqual(await bank.document(q.id), doc);
      assert.deepEqual(await bank.savedClassification(q.id), saved);
      assert.equal((await bank.list({ q: 'renamed' })).total, 1);
      assert.equal((await bank.versions(q.id)).length, 1);
      assert.equal((await bank.all('SELECT * FROM curriculum_events')).length, 1);
    } finally {
      await bank.close();
    }
  });

test('Explicit ordering, topic retirement, guarded deletion and restoration preserve questions', async () => {
  const { bank, fixture, momentum, dynamics } = await setup();
  try {
    const q = await bank.create(fixture('TEST-RETIRE'), 'TEST DATA', null, true);
    await edit(bank, 'topics', momentum, { order: 0 });
    await edit(bank, 'topics', dynamics, { order: 1 });
    assert.equal(
      (await bank.taxonomy()).topics.filter(
        async (t) =>
          t.parentId === (await bank.taxonomy()).topics.find((t) => t.id === momentum)?.parentId,
      )[0].id,
      momentum,
    );
    await edit(bank, 'topics', momentum, { status: 'retired' });
    assert.equal((await bank.list({ taxonomyStatus: 'active' })).total, 0);
    assert.equal((await bank.list({ taxonomyStatus: 'all' })).total, 1);
    assert.deepEqual(await bank.document(q.id), fixture('TEST-RETIRE'));
    await assert.rejects(
      async () => await bank.run('DELETE FROM topics WHERE id=?', momentum),
      /Retire/,
    );
    await assert.rejects(
      async () => await bank.create(fixture('TEST-NEW-RETIRED'), 'TEST DATA', null, true),
      /retired/,
    );
    const revised = await bank.document(q.id);
    revised.question.title += ' TEST DATA wording change';
    const candidate = await bank.save(q.id, revised, 'TEST DATA retained classification', 1);
    assert.ok(candidate.pending);
    await bank.review(candidate.candidateId!, true, 'TEST DATA Teacher');
    assert.equal((await bank.document(q.id)).question.topicId, momentum);
    await edit(bank, 'topics', momentum, { status: 'active' });
    assert.equal((await bank.list({ taxonomyStatus: 'active' })).total, 1);
  } finally {
    await bank.close();
  }
});

test('Safe moves work for unreferenced chapters/topics/subtopics; referenced and cross-version moves fail', async () => {
  const { bank, fixture, c1, c2, momentum, dynamics } = await setup();
  try {
    const fresh = await bank.addTaxon('topics', 'TEST DATA movable', c1, true),
      st = await bank.addTaxon('subtopics', 'TEST DATA movable subtopic', fresh, true);
    await edit(bank, 'topics', fresh, { parentId: c2 });
    assert.equal((await bank.taxonomy()).topics.find((t) => t.id === fresh)?.parentId, c2);
    await edit(bank, 'subtopics', st, { parentId: dynamics });
    assert.equal((await bank.taxonomy()).subtopics.find((t) => t.id === st)?.parentId, dynamics);
    const emptyChapter = await bank.addTaxon(
      'chapters',
      'TEST DATA movable chapter',
      'semester-1',
      true,
    );
    await edit(bank, 'chapters', emptyChapter, { parentId: 'semester-2' });
    assert.equal(
      (await bank.taxonomy()).chapters.find((t) => t.id === emptyChapter)?.parentId,
      'semester-2',
    );
    const q = await bank.create(fixture('TEST-GUARD'), 'TEST DATA', null, true);
    await assert.rejects(
      async () => await edit(bank, 'topics', momentum, { parentId: c2 }),
      /referenced/,
    );
    await assert.rejects(
      async () => await bank.run('UPDATE topics SET chapter_id=? WHERE id=?', c2, momentum),
      /Referenced/,
    );
    await assert.rejects(
      async () => await edit(bank, 'chapters', c1, { parentId: 'semester-2' }),
      /referenced/,
    );
    const plan = await bank.curriculum.plan(document());
    const result = await bank.curriculum.import(plan.document, plan.token, 'TEST DATA');
    const other = (await bank.curriculum.export(result.id)).semesters[0].chapters[0].id!;
    await assert.rejects(
      async () => await edit(bank, 'topics', fresh, { parentId: other }),
      /within one/,
    );
    await assert.rejects(
      async () => await bank.run('UPDATE topics SET chapter_id=? WHERE id=?', other, fresh),
      /cross-version/,
    );
    assert.equal((await bank.document(q.id)).question.topicId, momentum);
  } finally {
    await bank.close();
  }
});

test('Pending revisions and references held only in older snapshots also prevent moves', async () => {
  const { bank, fixture, c1, c2, momentum, dynamics } = await setup();
  try {
    const q = await bank.create(fixture('TEST-OLD-PATH'), 'TEST DATA', null, true);
    const revised = fixture('TEST-OLD-PATH', dynamics),
      candidate = await bank.save(q.id, revised, 'TEST DATA move question', 1);
    await bank.review(candidate.candidateId!, true, 'TEST DATA Teacher');
    const impact = await bank.curriculum.impact('topics', momentum);
    assert.equal(impact.currentQuestions, 0);
    assert.equal(impact.historicalQuestions, 1);
    await assert.rejects(
      async () => await edit(bank, 'topics', momentum, { parentId: c2 }),
      /referenced/,
    );
    const fresh = await bank.addTaxon('topics', 'TEST DATA pending topic', c1, true),
      pending = fixture('TEST-OLD-PATH', fresh);
    await bank.save(q.id, pending, 'TEST DATA pending assignment', 2);
    assert.equal((await bank.curriculum.impact('topics', fresh)).pendingRevisions, 1);
    await assert.rejects(
      async () => await edit(bank, 'topics', fresh, { parentId: c2 }),
      /pending revisions/,
    );
  } finally {
    await bank.close();
  }
});

test('Impact tokens reject stale previews after edits or newly linked questions', async () => {
  const { bank, fixture, momentum } = await setup();
  try {
    const impact = await bank.curriculum.impact('topics', momentum);
    await bank.create(fixture('TEST-CONCURRENT'), 'TEST DATA', null, true);
    await assert.rejects(
      async () =>
        await bank.curriculum.edit('topics', momentum, {
          name: 'TEST DATA stale',
          expectedRevision: impact.revision,
          impactToken: impact.token,
          confirmImpact: true,
          note: 'TEST DATA',
        }),
      /Reload the impact/,
    );
    const second = await bank.curriculum.impact('topics', momentum);
    await edit(bank, 'topics', momentum, { order: 1 });
    await assert.rejects(
      async () =>
        await bank.curriculum.edit('topics', momentum, {
          order: 2,
          expectedRevision: second.revision,
          impactToken: second.token,
          confirmImpact: true,
          note: 'TEST DATA',
        }),
      /changed/,
    );
  } finally {
    await bank.close();
  }
});

test('Draft creation, activation, retirement and cloning keep old questions queryable', async () => {
  const { bank, fixture, momentum } = await setup();
  try {
    const old = await bank.create(fixture('TEST-LEGACY'), 'TEST DATA', null, true),
      saved = await bank.savedClassification(old.id);
    const next = await bank.curriculum.createVersion(
      {
        courseId: 'matriculation-physics',
        code: 'TEST-NEXT',
        name: 'TEST DATA next',
        effectiveFrom: null,
        effectiveTo: null,
        status: 'draft',
        order: 1,
        cloneFromId: 'legacy-matriculation-physics',
      },
      'TEST DATA clone',
    );
    const exported = await bank.curriculum.export(next.id);
    assert.notEqual(exported.semesters[0].id, 'semester-1');
    assert.notEqual(exported.semesters[0].chapters[0].topics[0].id, momentum);
    assert.equal((await bank.list({ curriculum: next.id })).total, 0);
    await assert.rejects(
      async () => await changeVersion(bank, next.id, 'active', false),
      /Confirm that activation/,
    );
    await changeVersion(bank, next.id, 'active');
    assert.equal((await bank.list({ curriculum: 'active' })).total, 0);
    assert.equal(
      (
        await bank.list({
          curriculum: 'legacy-matriculation-physics',
          semester: 'semester-1',
          topic: momentum,
          difficulty: 'hard',
          status: 'approved',
        })
      ).total,
      1,
    );
    assert.deepEqual(await bank.savedClassification(old.id), saved);
    assert.deepEqual(await bank.document(old.id), fixture('TEST-LEGACY'));
    const topic = exported.semesters[0].chapters[0].topics[0].id!,
      fresh = fixture('TEST-NEW-VERSION', topic);
    fresh.question.subtopicId = null;
    await bank.create(fresh, 'TEST DATA', null, true);
    assert.equal((await bank.list({ curriculum: 'active' })).total, 1);
    await changeVersion(bank, next.id, 'retired');
    assert.equal((await bank.list({ curriculum: next.id })).total, 1);
    assert.equal((await bank.list({ curriculum: 'active' })).total, 0);
    await assert.rejects(
      async () =>
        await bank.run(
          "UPDATE semesters SET curriculum_version_id=? WHERE id='semester-1'",
          next.id,
        ),
      /membership is stable/,
    );
    assert.equal((await bank.curriculum.versions()).filter((v) => v.status === 'active').length, 0);
  } finally {
    await bank.close();
  }
});

test('Curriculum import dry run is read-only and exports stable hierarchy/order/status metadata', async () => {
  const bank = await createTestBank();
  try {
    const before = await bank.taxonomy(),
      plan = await bank.curriculum.plan(document());
    assert.deepEqual(await bank.taxonomy(), before);
    assert.deepEqual(plan.counts, { semesters: 1, chapters: 1, topics: 1, subtopics: 1 });
    const result = await bank.curriculum.import(
      plan.document,
      plan.token,
      'TEST DATA authoritative fixture',
    );
    const exported = await bank.curriculum.export(result.id);
    assert.deepEqual(exported, plan.document);
    assert.equal(exported.semesters[0].chapters[0].topics[0].subtopics[0].status, 'retired');
    await assert.rejects(async () => await bank.curriculum.plan(exported), /already exists/);
  } finally {
    await bank.close();
  }
});

test('Invalid curriculum imports, duplicates and stale plans do not partially write', async () => {
  const bank = await createTestBank();
  try {
    const before = await bank.taxonomy(),
      invalid = document();
    invalid.semesters.push(structuredClone(invalid.semesters[0]));
    await assert.rejects(async () => await bank.curriculum.plan(invalid), /Duplicate/);
    assert.deepEqual(await bank.taxonomy(), before);
    const inconsistent = document();
    inconsistent.course.id = 'unknown';
    await assert.rejects(async () => await bank.curriculum.plan(inconsistent), /existing course/);
    const badDate = document();
    badDate.curriculumVersion.effectiveFrom = '2028-01-01';
    badDate.curriculumVersion.effectiveTo = '2026-01-01';
    await assert.rejects(async () => await bank.curriculum.plan(badDate), /dates/);
    const plan = await bank.curriculum.plan(document());
    await bank.addTaxon('chapters', 'TEST DATA concurrent taxonomy', 'semester-1', true);
    await assert.rejects(
      async () => await bank.curriculum.import(plan.document, plan.token, 'TEST DATA'),
      /stale/,
    );
    assert.equal((await bank.curriculum.versions()).length, 1);
    const fresh = await bank.curriculum.plan(document());
    await bank.db.exec(
      "CREATE TRIGGER test_import_failure BEFORE INSERT ON topics BEGIN SELECT RAISE(ABORT,'TEST DATA forced rollback'); END;",
    );
    await assert.rejects(
      async () => await bank.curriculum.import(fresh.document, fresh.token, 'TEST DATA'),
      /forced rollback/,
    );
    assert.equal((await bank.curriculum.versions()).length, 1);
    assert.equal((await bank.taxonomy()).semesters.length, 2);
    assert.equal((await bank.all('SELECT * FROM curriculum_events')).length, 0);
  } finally {
    await bank.close();
  }
});

test('Question classification rejects cross-parent IDs and ambiguous names across versions', async () => {
  const { bank, fixture, circular } = await setup();
  try {
    const bad = fixture('TEST-CROSS');
    bad.question.topicId = circular;
    await assert.rejects(async () => await bank.resolveImport(bad), /Subtopic does not belong/);
    const q = fixture('TEST-CONTEXT') as unknown as Record<string, unknown>;
    q.classification = {
      course: 'matriculation-physics',
      curriculumVersion: 'unknown',
      semester: 'Semester 1',
      chapter: 'TEST ONLY Momentum chapter',
      topic: 'TEST ONLY Momentum',
      subtopic: 'TEST ONLY 2D collision',
    };
    await assert.rejects(async () => await bank.resolveImport(q), /semester/);
    await bank.curriculum.createVersion(
      {
        courseId: 'matriculation-physics',
        code: 'TEST-DUPLICATE',
        name: 'TEST DATA next',
        effectiveFrom: null,
        effectiveTo: null,
        status: 'draft',
        order: 1,
        cloneFromId: 'legacy-matriculation-physics',
      },
      'TEST DATA',
    );
    (q.classification as Record<string, string>).curriculumVersion = 'LEGACY';
    assert.equal(
      (await bank.resolveImport(q)).question.topicId,
      (q.question as { topicId: string }).topicId,
    );
    delete (q.classification as Record<string, string>).curriculumVersion;
    await assert.rejects(async () => await bank.resolveImport(q), /Ambiguous semester/);
  } finally {
    await bank.close();
  }
});

test('All requested Physics notation validates without altering authored text', async () => {
  const { bank, fixture } = await setup();
  try {
    const doc = fixture('TEST-MATH');
    doc.question.scenario = 'TEST DATA $W_g = mgs\\cos110^\\circ$ and $\\vec{p}=m\\vec{v}$';
    doc.parts[0].prompt =
      'TEST DATA $$\\begin{aligned}\\sum F &= ma\\\\N &= \\frac{mv^2}{r}\\end{aligned}$$ $\\alpha_1^2 = 2\\,\\mathrm{m\\,s^{-2}}$';
    doc.solutions[0].equationLatex = '\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}';
    const q = await bank.create(doc, 'TEST DATA', null, true);
    assert.deepEqual(await bank.document(q.id), doc);
    const bad = structuredClone(doc);
    bad.solutions[0].equationLatex = '\\notACommand';
    await assert.rejects(async () => await bank.resolveImport(bad), /LaTeX/);
  } finally {
    await bank.close();
  }
});

test('Migration 002 upgrades populated v1 data without rewriting authored rows, versions or assets', async () => {
  const { bank: source, fixture } = await setup(),
    dir = mkdtempSync(join(tmpdir(), 'physics-curriculum-upgrade-'));
  try {
    const doc = fixture('TEST-MIGRATION');
    doc.assets = [
      {
        id: 'test-pdf',
        partId: null,
        kind: 'original_pdf',
        url: 'https://example.org/test.pdf',
        alt: 'TEST DATA archived PDF',
        mime: 'application/pdf',
        order: 2,
      },
    ];
    const q = await source.create(doc, 'TEST DATA v1 migration fixture', 'TEST DATA Teacher', true);
    const path = join(dir, 'upgrade.sqlite'),
      old = new DatabaseSync(path);
    old.exec('PRAGMA foreign_keys=ON');
    old.exec(
      readFileSync(new URL('../server/migrations/001-foundation.sql', import.meta.url), 'utf8'),
    );
    old.exec(
      "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);INSERT INTO schema_migrations VALUES(1,'TEST DATA');BEGIN;PRAGMA defer_foreign_keys=ON;",
    );
    const tables = [
      'courses',
      'difficulty_levels',
      'semesters',
      'chapters',
      'topics',
      'subtopics',
      'questions',
      'question_parts',
      'solutions',
      'solution_steps',
      'hints',
      'assets',
      'tags',
      'question_tags',
      'question_versions',
      'revision_candidates',
    ];
    const originals = new Map<string, { columns: string[]; rows: unknown[] }>();
    for (const table of tables) {
      const columns = old
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((r) => String(r.name));
      const rows = await source.all(
        `SELECT ${columns.join(',')} FROM ${table} ORDER BY ${columns.join(',')}`,
      );
      for (const row of rows)
        old
          .prepare(
            `INSERT OR IGNORE INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`,
          )
          .run(...columns.map((c) => row[c]));
      originals.set(table, { columns, rows });
    }
    old.exec('COMMIT');
    old.close();
    const upgraded = await createTestBank(path);
    try {
      for (const [table, { columns, rows }] of originals)
        assert.deepEqual(
          await upgraded.all(
            `SELECT ${columns.join(',')} FROM ${table} ORDER BY ${columns.join(',')}`,
          ),
          rows,
          table,
        );
      assert.deepEqual(await upgraded.document(q.id), doc);
      assert.equal((await upgraded.savedClassification(q.id))?.provenance, 'reconstructed');
      assert.equal((await upgraded.savedClassification(q.id))?.topic.name, 'TEST ONLY Momentum');
      assert.equal((await upgraded.one('PRAGMA integrity_check'))?.integrity_check, 'ok');
      assert.deepEqual(await upgraded.all('PRAGMA foreign_key_check'), []);
      await edit(upgraded, 'topics', doc.question.topicId, { name: 'TEST DATA after migration' });
      assert.equal((await upgraded.savedClassification(q.id))?.topic.name, 'TEST ONLY Momentum');
      await assert.rejects(
        async () =>
          await upgraded.run(
            'UPDATE question_version_classifications SET snapshot=snapshot WHERE question_id=?',
            q.id,
          ),
        /immutable/,
      );
    } finally {
      await upgraded.close();
    }
    const reopened = await createTestBank(path);
    assert.equal((await reopened.all('SELECT * FROM schema_migrations')).length, 5);
    await reopened.close();
  } finally {
    await source.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('HTTP curriculum APIs guard deletion, apply reviewed imports and roundtrip provenance', async () => {
  const { bank, fixture, momentum } = await setup(),
    dir = mkdtempSync(join(tmpdir(), 'physics-curriculum-api-')),
    server = createApp(bank, new LocalAssetStorage(dir)).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}/api`;
  const fetch = authenticatedFetch(await seedAdminSession(bank));
  const body = (method: string, value: unknown) => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  try {
    const q = await bank.create(fixture('TEST-HTTP-PROVENANCE'), 'TEST DATA', null, true);
    assert.equal(
      (await fetch(`${base}/taxonomy/topics/${momentum}`, { method: 'DELETE' })).status,
      409,
    );
    const impact = await (await fetch(`${base}/taxonomy/topics/${momentum}/impact`)).json();
    assert.equal(impact.currentQuestions, 1);
    const response = await fetch(`${base}/questions/${q.id}/export?provenance=true&version=1`),
      exported = await response.json();
    assert.equal(exported.schemaVersion, 2);
    const live = exported.savedClassification.topic.name;
    await edit(bank, 'topics', momentum, { name: 'TEST DATA HTTP renamed' });
    assert.equal(
      (await (await fetch(`${base}/import/validate`, body('POST', { document: exported }))).json())
        .document.question.questionCode,
      'TEST-HTTP-PROVENANCE',
    );
    exported.document.question.questionCode = 'TEST-HTTP-PROVENANCE-COPY';
    const created = await fetch(
      `${base}/import`,
      body('POST', {
        document: exported,
        note: 'TEST DATA import',
        author: 'TEST DATA Teacher',
        confirmApproval: true,
      }),
    );
    assert.equal(created.status, 201);
    const copied = await created.json();
    assert.equal((await bank.savedClassification(copied.id))?.topic.name, live);
    exported.savedClassification.semester.id = 'semester-2';
    assert.equal(
      (await fetch(`${base}/import/validate`, body('POST', { document: exported }))).status,
      400,
    );
    const plan = await (
      await fetch(`${base}/curriculum/import/validate`, body('POST', { document: document() }))
    ).json();
    const imported = await fetch(
      `${base}/curriculum/import`,
      body('POST', { document: plan.document, token: plan.token, note: 'TEST DATA import' }),
    );
    assert.equal(imported.status, 201);
    const id = (await imported.json()).id;
    assert.equal((await fetch(`${base}/curriculum-versions/${id}/export`)).status, 200);
    const student = await (await fetch(`${base}/questions/${q.id}?view=student`)).json();
    assert.ok(!student.savedClassification);
    assert.equal(student.document.solutions.length, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await bank.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Retired ancestry blocks new taxonomy and question assignments; invalid version membership fails at the database', async () => {
  const { bank, fixture, c1, momentum } = await setup();
  try {
    await edit(bank, 'semesters', 'semester-1', { status: 'retired' });
    await assert.rejects(
      async () => await bank.addTaxon('topics', 'TEST DATA retired ancestor', c1, true),
      /retired parent hierarchy/,
    );
    await assert.rejects(
      async () => await bank.create(fixture('TEST-RETIRED-ANCESTRY'), 'TEST DATA', null, true),
      /retired/,
    );
    await edit(bank, 'semesters', 'semester-1', { status: 'active' });
    const course = await bank.addTaxon('courses', 'TEST DATA second course', null, true);
    await assert.rejects(
      async () =>
        await bank.addTaxon(
          'semesters',
          'TEST DATA invalid version',
          course,
          true,
          'legacy-matriculation-physics',
        ),
      /belonging to this course/,
    );
    await assert.rejects(
      async () =>
        await bank.run(
          "INSERT INTO semesters(id,course_id,curriculum_version_id,name,slug) VALUES('test-invalid',?,'legacy-matriculation-physics','TEST DATA invalid','test-invalid')",
          course,
        ),
      /must belong/,
    );
    await assert.rejects(
      async () => await edit(bank, 'topics', momentum, { parentId: 'unknown-parent' }),
      /not found/,
    );
    await changeVersion(bank, 'legacy-matriculation-physics', 'retired');
    await assert.rejects(
      async () => await bank.addTaxon('topics', 'TEST DATA retired version', c1, true),
      /curriculum version/,
    );
  } finally {
    await bank.close();
  }
});

test('An unreconstructable old classification rolls migration 002 back without changing the v1 database', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'physics-bad-history-'));
  try {
    const path = join(dir, 'legacy.sqlite'),
      old = new DatabaseSync(path);
    old.exec(
      readFileSync(new URL('../server/migrations/001-foundation.sql', import.meta.url), 'utf8'),
    );
    old.exec(
      "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);INSERT INTO schema_migrations VALUES(1,'TEST DATA');",
    );
    old.exec(
      "INSERT INTO chapters VALUES('test-chapter','semester-1','TEST DATA chapter','test-chapter',0,1);INSERT INTO topics VALUES('test-topic','test-chapter','TEST DATA current topic','test-topic',0,1);INSERT INTO questions(id,question_code,topic_id,title,scenario,difficulty_id,question_type,total_marks,estimated_minutes,status,contains_diagram,contains_graph,contains_fbd,created_at,updated_at) VALUES('test-old-question','TEST-OLD','test-topic','TEST DATA question','TEST DATA','hard','structured',1,1,'draft',0,0,0,'TEST DATA','TEST DATA');",
    );
    const snapshot = JSON.stringify({
      question: { topicId: 'test-missing-historical-topic', subtopicId: null },
    });
    old
      .prepare('INSERT INTO question_versions VALUES(?,?,?,?,?,?)')
      .run('test-old-question', 1, snapshot, 'TEST DATA old missing taxonomy', null, 'TEST DATA');
    old.close();
    await assert.rejects(
      async () => await createTestBank(path),
      /cannot reconstruct every historical classification/,
    );
    const reopened = new DatabaseSync(path, { readOnly: true });
    try {
      assert.equal(reopened.prepare('SELECT count(*) n FROM schema_migrations').get()?.n, 1);
      assert.equal(
        reopened.prepare("SELECT name FROM sqlite_master WHERE name='curriculum_versions'").get(),
        undefined,
      );
      assert.equal(
        reopened.prepare('SELECT snapshot FROM question_versions').get()?.snapshot,
        snapshot,
      );
      assert.equal(
        reopened
          .prepare('PRAGMA table_info(semesters)')
          .all()
          .some((r) => r.name === 'curriculum_version_id'),
        false,
      );
    } finally {
      await reopened.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
