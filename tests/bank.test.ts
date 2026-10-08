import { createTestBank } from './test-bank.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareDocuments, PdfRevisionImportService } from '../server/revisions.js';
import { warnings } from '../shared/schema.js';
import { seedTests, setup } from './fixtures.js';

test('Semester 1, Semester 2 and All filter by inherited taxonomy', async () => {
  const { bank } = await seedTests();
  try {
    assert.equal((await bank.list({ semester: 'semester-1' })).total, 4);
    assert.equal((await bank.list({ semester: 'semester-2' })).total, 3);
    assert.equal((await bank.list()).total, 7);
    assert.ok(
      (await bank.list({ semester: 'semester-1' })).items.every((q) => q.semester === 'Semester 1'),
    );
  } finally {
    await bank.close();
  }
});
test('Topic, chapter and subtopic filters narrow the hierarchy', async () => {
  const { bank, momentum, c1, subtopic } = await seedTests();
  try {
    assert.equal((await bank.list({ topic: momentum })).total, 3);
    assert.equal((await bank.list({ chapter: c1 })).total, 4);
    assert.equal((await bank.list({ subtopic })).total, 3);
  } finally {
    await bank.close();
  }
});
for (const difficulty of ['easy', 'medium', 'hard'])
  test(`${difficulty} is a controlled difficulty filter`, async () => {
    const { bank } = await seedTests();
    try {
      assert.ok(
        (await bank.list({ difficulty })).items.every((q) => q.difficulty_id === difficulty),
      );
      assert.ok((await bank.list({ difficulty })).total > 0);
    } finally {
      await bank.close();
    }
  });
test('Semester + Momentum + Hard and Semester 2 + Medium combine with AND', async () => {
  const { bank, momentum, circular } = await seedTests();
  try {
    assert.equal(
      (
        await bank.list({
          semester: 'semester-1',
          topic: momentum,
          difficulty: 'hard',
          status: 'approved',
        })
      ).total,
      1,
    );
    assert.equal(
      (await bank.list({ semester: 'semester-2', topic: circular, difficulty: 'medium' })).total,
      1,
    );
    assert.equal((await bank.list({ semester: 'semester-2', topic: momentum })).total, 0);
  } finally {
    await bank.close();
  }
});
test('Search includes wording, code, chapter, topic, subtopic and tags with filters', async () => {
  const { bank, momentum } = await seedTests();
  try {
    for (const q of ['2D collision', 'TEST-S1-2', 'Momentum', 'collision'])
      assert.ok((await bank.list({ q, topic: momentum, difficulty: 'hard' })).total === 1);
    assert.equal((await bank.list({ q: 'no such phrase', semester: 'semester-1' })).total, 0);
    await assert.doesNotReject(async () => await bank.list({ q: '" OR * ( AND' }));
  } finally {
    await bank.close();
  }
});
test('Marks, tags, type, availability and status combine; invalid ranges fail', async () => {
  const { bank } = await seedTests();
  try {
    assert.equal(
      (
        await bank.list({
          minMarks: '2',
          maxMarks: '2',
          tags: 'collision,TEST ONLY',
          type: 'structured',
          diagram: 'false',
          status: 'approved',
        })
      ).total,
      7,
    );
    assert.equal((await bank.list({ minMarks: '3' })).total, 0);
    await assert.rejects(async () => await bank.list({ minMarks: '4', maxMarks: '2' }));
    await assert.rejects(async () => await bank.list({ minMarks: 'NaN' }));
    await assert.rejects(async () => await bank.list({ diagram: '1' }));
  } finally {
    await bank.close();
  }
});
test('Pagination stays server-side and counts are derived from records', async () => {
  const { bank } = await seedTests();
  try {
    const a = await bank.list({ limit: '2', page: '1' }),
      b = await bank.list({ limit: '2', page: '2' });
    assert.equal(a.total, 7);
    assert.equal(a.items.length, 2);
    assert.ok(a.items.every((x) => !b.items.some((y) => y.id === x.id)));
    assert.equal(
      (await bank.counts()).reduce((s, r) => s + Number(r.count), 0),
      7,
    );
    await assert.rejects(async () => await bank.list({ limit: '1000' }));
  } finally {
    await bank.close();
  }
});
test('Taxonomy parent relationships and normalized uniqueness are enforced', async () => {
  const { bank, momentum, c1 } = await setup();
  try {
    assert.equal((await bank.taxonomy()).topics.find((t) => t.id === momentum)?.parentId, c1);
    assert.equal((await bank.taxonomy()).chapters.find((c) => c.id === c1)?.parentId, 'semester-1');
    await assert.rejects(async () => await bank.addTaxon('topics', '  TEST  ONLY momentum ', c1));
    await assert.rejects(async () => await bank.addTaxon('topics', 'Invalid topic', 'missing'));
    assert.equal((await bank.taxonomy()).topics.length, 3);
  } finally {
    await bank.close();
  }
});
test('New courses, semesters and difficulty levels require no UI-specific schema changes', async () => {
  const { bank, fixture, momentum } = await setup();
  try {
    const course = await bank.addTaxon('courses', 'Test extra course', null, true);
    const semester = await bank.addTaxon('semesters', 'Test Semester 3', course, true);
    const chapter = await bank.addTaxon('chapters', 'Test chapter', semester, true);
    const topic = await bank.addTaxon('topics', 'Test topic', chapter, true);
    const level = await bank.addTaxon('difficulties', 'Extension', null);
    await bank.create(fixture('TEST-EXTENSION', topic, level), 'Test', null, true);
    assert.equal((await bank.list({ course, semester, difficulty: level })).total, 1);
    assert.equal((await bank.list({ topic: momentum })).total, 0);
  } finally {
    await bank.close();
  }
});
test('Structured imports preserve content, equations, difficulty and authored marks', async () => {
  const { bank, fixture } = await setup();
  try {
    const input = fixture('TEST-IMPORT');
    input.question.totalMarks = 5;
    const result = await bank.create(await bank.resolveImport(input), 'Import', null, true);
    assert.deepEqual(await bank.document(result.id), input);
    assert.ok(result.warnings[0].includes('Part marks total 2'));
    assert.equal(warnings(input).length, 1);
    assert.equal((await bank.all('SELECT * FROM question_parts')).length, 1);
    assert.equal((await bank.all('SELECT * FROM solution_steps')).length, 1);
  } finally {
    await bank.close();
  }
});
test('Duplicate code, invalid difficulty, marks, parts, solutions, assets and LaTeX reject imports atomically', async () => {
  const { bank, fixture, circular, subtopic } = await setup();
  try {
    await bank.create(fixture('TEST-DUP'), 'Test', null, true);
    await assert.rejects(
      async () => await bank.create(fixture('TEST-DUP'), 'Duplicate', null, true),
      /already exists/,
    );
    const variants = [
      (d: ReturnType<typeof fixture>) => (d.question.difficultyId = 'impossible'),
      (d: ReturnType<typeof fixture>) => (d.question.totalMarks = -1),
      (d: ReturnType<typeof fixture>) => {
        d.question.topicId = circular;
        d.question.subtopicId = subtopic;
      },
      (d: ReturnType<typeof fixture>) => (d.parts[0].parentId = 'part-a'),
      (d: ReturnType<typeof fixture>) => (d.solutions[0].partId = 'missing'),
      (d: ReturnType<typeof fixture>) => (d.solutions[0].equationLatex = '\\notARealCommand{'),
      (d: ReturnType<typeof fixture>) =>
        d.assets.push({
          id: 'x',
          partId: null,
          kind: 'physics_diagram',
          url: 'javascript:alert(1)',
          alt: 'bad',
          mime: 'image/svg+xml',
          order: 0,
        }),
    ];
    for (const mutate of variants) {
      const doc = fixture('TEST-INVALID');
      mutate(doc);
      await assert.rejects(async () => await bank.create(doc, 'Invalid', null, true));
    }
    assert.equal((await bank.list()).total, 1);
    assert.equal((await bank.all('SELECT * FROM question_versions')).length, 1);
  } finally {
    await bank.close();
  }
});
test('Import classification resolves existing normalized names and rejects semester/topic conflicts', async () => {
  const { bank, fixture } = await setup();
  try {
    const doc = fixture('TEST-NAMES');
    const input = {
      ...doc,
      question: { ...doc.question, topicId: undefined, subtopicId: undefined },
      classification: {
        course: '  matriculation   physics ',
        semester: 'semester-1',
        chapter: 'TEST ONLY Momentum chapter',
        topic: 'test only momentum',
        subtopic: 'TEST ONLY 2D collision',
      },
    };
    assert.deepEqual(await bank.resolveImport(input), doc);
    await assert.rejects(
      async () =>
        await bank.resolveImport({
          ...input,
          classification: { ...input.classification, semester: 'semester-2' },
        }),
      /Unknown or inconsistent/,
    );
    assert.equal((await bank.taxonomy()).topics.length, 3);
  } finally {
    await bank.close();
  }
});
test('Approved creation requires explicit approval and answers for leaf parts', async () => {
  const { bank, fixture } = await setup();
  try {
    const doc = fixture('TEST-APPROVE');
    await assert.rejects(async () => await bank.create(doc, 'Test'), /approval/);
    doc.solutions = [];
    await assert.rejects(async () => await bank.create(doc, 'Test', null, true), /answer scheme/);
    assert.equal((await bank.list()).total, 0);
  } finally {
    await bank.close();
  }
});
test('Meaningful draft save creates one immutable snapshot; unchanged content does not create a version', async () => {
  const { bank, fixture } = await setup();
  try {
    const doc = fixture('TEST-DRAFT');
    doc.question.status = 'draft';
    const { id } = await bank.create(doc, 'Initial');
    doc.question.title = 'TEST ONLY revised title';
    await bank.save(id, doc, 'Revision', 1, 'Teacher');
    assert.equal((await bank.current(id)).active_version, 2);
    assert.equal((await bank.document(id, 1)).question.title, 'TEST ONLY TEST-DRAFT');
    assert.equal((await bank.document(id, 2)).question.title, 'TEST ONLY revised title');
    await assert.rejects(
      async () => await bank.save(id, doc, 'No change', 2),
      /No content changes/,
    );
    assert.equal((await bank.versions(id)).length, 2);
    await assert.rejects(
      async () =>
        await bank.run(
          'UPDATE question_versions SET change_note=? WHERE question_id=?',
          'changed',
          id,
        ),
      /immutable/,
    );
  } finally {
    await bank.close();
  }
});
test('Approved manual and JSON revisions never overwrite active content before human review', async () => {
  const { bank, fixture } = await setup();
  try {
    const original = fixture('TEST-REVIEW');
    const { id } = await bank.create(original, 'Approved', null, true);
    const revised = structuredClone(original);
    revised.question.title = 'TEST ONLY revised';
    const result = await bank.save(id, revised, 'Change title', 1, 'Author', 'json');
    assert.ok(result.pending && result.candidateId);
    assert.deepEqual(await bank.document(id), original);
    assert.equal((await bank.versions(id)).length, 1);
    await assert.rejects(async () => await bank.review(result.candidateId!, true, ''), /teacher/);
    await bank.review(result.candidateId!, true, 'Reviewing teacher');
    assert.deepEqual(await bank.document(id), revised);
    assert.deepEqual(await bank.document(id, 1), original);
    assert.equal((await bank.versions(id)).length, 2);
    assert.equal((await bank.current(id)).active_version, 2);
  } finally {
    await bank.close();
  }
});
test('Rejected and stale candidates preserve the active version, and stable codes cannot change', async () => {
  const { bank, fixture } = await setup();
  try {
    const doc = fixture('TEST-STALE');
    const { id } = await bank.create(doc, 'Initial', null, true);
    doc.question.title = 'TEST ONLY candidate';
    const a = await bank.save(id, doc, 'A', 1);
    doc.question.title = 'TEST ONLY candidate B';
    const b = await bank.save(id, doc, 'B', 1);
    await bank.review(a.candidateId!, true, 'Teacher');
    await assert.rejects(async () => await bank.review(b.candidateId!, true, 'Teacher'), /stale/);
    await bank.review(b.candidateId!, false, 'Teacher');
    assert.equal((await bank.current(id)).active_version, 2);
    await assert.rejects(async () => await bank.save(id, doc, 'Old editor', 1), /changed/);
    doc.question.questionCode = 'TEST-CHANGED';
    await assert.rejects(async () => await bank.save(id, doc, 'Code change', 2), /stable/);
  } finally {
    await bank.close();
  }
});
test('Nested parts, per-part hints and answer diagrams survive revision roundtrip', async () => {
  const { bank, fixture } = await setup();
  try {
    const doc = fixture('TEST-NESTED');
    doc.question.status = 'draft';
    doc.parts.push({
      id: 'child',
      label: '(i)',
      parentId: 'part-a',
      marks: 0,
      prompt: 'TEST ONLY child',
      order: 1,
    });
    doc.assets.push({
      id: 'answer-diagram',
      partId: 'child',
      kind: 'answer_diagram',
      url: 'https://example.org/test.svg',
      alt: 'TEST ONLY image',
      mime: 'image/svg+xml',
      order: 0,
    });
    const { id } = await bank.create(doc, 'Nested');
    assert.deepEqual(await bank.document(id), doc);
    assert.equal((await bank.all('PRAGMA foreign_key_check')).length, 0);
  } finally {
    await bank.close();
  }
});
test('Database transactions roll back a failed content write completely', async () => {
  const { bank, fixture } = await setup();
  try {
    await bank.db.exec(
      "CREATE TRIGGER fail_parts BEFORE INSERT ON question_parts BEGIN SELECT RAISE(ABORT,'forced test failure'); END;",
    );
    await assert.rejects(
      async () => await bank.create(fixture('TEST-ROLLBACK'), 'Test', null, true),
      /forced test failure/,
    );
    assert.equal((await bank.list()).total, 0);
    assert.equal((await bank.all('SELECT * FROM question_versions')).length, 0);
    assert.equal((await bank.all('SELECT * FROM question_search')).length, 0);
  } finally {
    await bank.close();
  }
});
test('PDF ingestion is a service boundary that always stages review candidates', async () => {
  const { bank, fixture } = await setup();
  try {
    const doc = fixture('TEST-PDF');
    doc.question.status = 'draft';
    const { id } = await bank.create(doc, 'Initial');
    await assert.rejects(
      new PdfRevisionImportService(bank).prepare(id, '/uploads/test.pdf', 'Test', 'Author', 1),
      /not configured/,
    );
    const candidate = structuredClone(doc);
    candidate.parts[0].prompt = 'TEST ONLY revised from adapter';
    const service = new PdfRevisionImportService(bank, {
      async extract() {
        return candidate;
      },
    });
    const result = await service.prepare(id, '/uploads/test.pdf', 'PDF change', 'Author', 1);
    assert.ok(result.pending);
    assert.deepEqual(await bank.document(id), doc);
    assert.ok(result.diff.some((d) => d.path === 'parts'));
    assert.equal((await bank.candidates(id))[0].source, 'pdf');
  } finally {
    await bank.close();
  }
});
test('Migration is repeatable and stored records survive reopening', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'physics-bank-test-'));
  try {
    const path = join(dir, 'bank.sqlite');
    const first = await createTestBank(path);
    await first.close();
    const second = await createTestBank(path);
    assert.equal((await second.all('SELECT * FROM schema_migrations')).length, 3);
    assert.equal((await second.taxonomy()).semesters.length, 2);
    assert.equal((await second.one('PRAGMA integrity_check'))?.integrity_check, 'ok');
    await second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('Diff includes content, numerical metadata, assets and hints without rewriting values', async () => {
  const { bank, fixture } = await setup();
  try {
    const a = fixture('TEST-DIFF'),
      b = structuredClone(a);
    b.question.totalMarks = 3;
    b.hints[0].text = 'TEST ONLY replacement hint';
    b.solutions[0].equationLatex = 'x = 2';
    assert.deepEqual(
      compareDocuments(a, b).map((d) => d.path),
      ['question.totalMarks', 'solutions', 'hints'],
    );
    assert.equal(a.question.totalMarks, 2);
  } finally {
    await bank.close();
  }
});
