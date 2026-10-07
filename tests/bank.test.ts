import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Bank } from '../server/database.js';
import { compareDocuments, PdfRevisionImportService } from '../server/revisions.js';
import { warnings } from '../shared/schema.js';
import { seedTests, setup } from './fixtures.js';

test('Semester 1, Semester 2 and All filter by inherited taxonomy', () => {
  const { bank } = seedTests();
  try {
    assert.equal(bank.list({ semester: 'semester-1' }).total, 4);
    assert.equal(bank.list({ semester: 'semester-2' }).total, 3);
    assert.equal(bank.list().total, 7);
    assert.ok(
      bank.list({ semester: 'semester-1' }).items.every((q) => q.semester === 'Semester 1'),
    );
  } finally {
    bank.close();
  }
});
test('Topic, chapter and subtopic filters narrow the hierarchy', () => {
  const { bank, momentum, c1, subtopic } = seedTests();
  try {
    assert.equal(bank.list({ topic: momentum }).total, 3);
    assert.equal(bank.list({ chapter: c1 }).total, 4);
    assert.equal(bank.list({ subtopic }).total, 3);
  } finally {
    bank.close();
  }
});
for (const difficulty of ['easy', 'medium', 'hard'])
  test(`${difficulty} is a controlled difficulty filter`, () => {
    const { bank } = seedTests();
    try {
      assert.ok(bank.list({ difficulty }).items.every((q) => q.difficulty_id === difficulty));
      assert.ok(bank.list({ difficulty }).total > 0);
    } finally {
      bank.close();
    }
  });
test('Semester + Momentum + Hard and Semester 2 + Medium combine with AND', () => {
  const { bank, momentum, circular } = seedTests();
  try {
    assert.equal(
      bank.list({ semester: 'semester-1', topic: momentum, difficulty: 'hard', status: 'approved' })
        .total,
      1,
    );
    assert.equal(
      bank.list({ semester: 'semester-2', topic: circular, difficulty: 'medium' }).total,
      1,
    );
    assert.equal(bank.list({ semester: 'semester-2', topic: momentum }).total, 0);
  } finally {
    bank.close();
  }
});
test('Search includes wording, code, chapter, topic, subtopic and tags with filters', () => {
  const { bank, momentum } = seedTests();
  try {
    for (const q of ['2D collision', 'TEST-S1-2', 'Momentum', 'collision'])
      assert.ok(bank.list({ q, topic: momentum, difficulty: 'hard' }).total === 1);
    assert.equal(bank.list({ q: 'no such phrase', semester: 'semester-1' }).total, 0);
    assert.doesNotThrow(() => bank.list({ q: '" OR * ( AND' }));
  } finally {
    bank.close();
  }
});
test('Marks, tags, type, availability and status combine; invalid ranges fail', () => {
  const { bank } = seedTests();
  try {
    assert.equal(
      bank.list({
        minMarks: '2',
        maxMarks: '2',
        tags: 'collision,TEST ONLY',
        type: 'structured',
        diagram: 'false',
        status: 'approved',
      }).total,
      7,
    );
    assert.equal(bank.list({ minMarks: '3' }).total, 0);
    assert.throws(() => bank.list({ minMarks: '4', maxMarks: '2' }));
    assert.throws(() => bank.list({ minMarks: 'NaN' }));
    assert.throws(() => bank.list({ diagram: '1' }));
  } finally {
    bank.close();
  }
});
test('Pagination stays server-side and counts are derived from records', () => {
  const { bank } = seedTests();
  try {
    const a = bank.list({ limit: '2', page: '1' }),
      b = bank.list({ limit: '2', page: '2' });
    assert.equal(a.total, 7);
    assert.equal(a.items.length, 2);
    assert.ok(a.items.every((x) => !b.items.some((y) => y.id === x.id)));
    assert.equal(
      bank.counts().reduce((s, r) => s + Number(r.count), 0),
      7,
    );
    assert.throws(() => bank.list({ limit: '1000' }));
  } finally {
    bank.close();
  }
});
test('Taxonomy parent relationships and normalized uniqueness are enforced', () => {
  const { bank, momentum, c1 } = setup();
  try {
    assert.equal(bank.taxonomy().topics.find((t) => t.id === momentum)?.parentId, c1);
    assert.equal(bank.taxonomy().chapters.find((c) => c.id === c1)?.parentId, 'semester-1');
    assert.throws(() => bank.addTaxon('topics', '  TEST  ONLY momentum ', c1));
    assert.throws(() => bank.addTaxon('topics', 'Invalid topic', 'missing'));
    assert.equal(bank.taxonomy().topics.length, 3);
  } finally {
    bank.close();
  }
});
test('New courses, semesters and difficulty levels require no UI-specific schema changes', () => {
  const { bank, fixture, momentum } = setup();
  try {
    const course = bank.addTaxon('courses', 'Test extra course', null, true);
    const semester = bank.addTaxon('semesters', 'Test Semester 3', course, true);
    const chapter = bank.addTaxon('chapters', 'Test chapter', semester, true);
    const topic = bank.addTaxon('topics', 'Test topic', chapter, true);
    const level = bank.addTaxon('difficulties', 'Extension', null);
    bank.create(fixture('TEST-EXTENSION', topic, level), 'Test', null, true);
    assert.equal(bank.list({ course, semester, difficulty: level }).total, 1);
    assert.equal(bank.list({ topic: momentum }).total, 0);
  } finally {
    bank.close();
  }
});
test('Structured imports preserve content, equations, difficulty and authored marks', () => {
  const { bank, fixture } = setup();
  try {
    const input = fixture('TEST-IMPORT');
    input.question.totalMarks = 5;
    const result = bank.create(bank.resolveImport(input), 'Import', null, true);
    assert.deepEqual(bank.document(result.id), input);
    assert.ok(result.warnings[0].includes('Part marks total 2'));
    assert.equal(warnings(input).length, 1);
    assert.equal(bank.all('SELECT * FROM question_parts').length, 1);
    assert.equal(bank.all('SELECT * FROM solution_steps').length, 1);
  } finally {
    bank.close();
  }
});
test('Duplicate code, invalid difficulty, marks, parts, solutions, assets and LaTeX reject imports atomically', () => {
  const { bank, fixture, circular, subtopic } = setup();
  try {
    bank.create(fixture('TEST-DUP'), 'Test', null, true);
    assert.throws(
      () => bank.create(fixture('TEST-DUP'), 'Duplicate', null, true),
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
      assert.throws(() => bank.create(doc, 'Invalid', null, true));
    }
    assert.equal(bank.list().total, 1);
    assert.equal(bank.all('SELECT * FROM question_versions').length, 1);
  } finally {
    bank.close();
  }
});
test('Import classification resolves existing normalized names and rejects semester/topic conflicts', () => {
  const { bank, fixture } = setup();
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
    assert.deepEqual(bank.resolveImport(input), doc);
    assert.throws(
      () =>
        bank.resolveImport({
          ...input,
          classification: { ...input.classification, semester: 'semester-2' },
        }),
      /Unknown or inconsistent/,
    );
    assert.equal(bank.taxonomy().topics.length, 3);
  } finally {
    bank.close();
  }
});
test('Approved creation requires explicit approval and answers for leaf parts', () => {
  const { bank, fixture } = setup();
  try {
    const doc = fixture('TEST-APPROVE');
    assert.throws(() => bank.create(doc, 'Test'), /approval/);
    doc.solutions = [];
    assert.throws(() => bank.create(doc, 'Test', null, true), /answer scheme/);
    assert.equal(bank.list().total, 0);
  } finally {
    bank.close();
  }
});
test('Meaningful draft save creates one immutable snapshot; unchanged content does not create a version', () => {
  const { bank, fixture } = setup();
  try {
    const doc = fixture('TEST-DRAFT');
    doc.question.status = 'draft';
    const { id } = bank.create(doc, 'Initial');
    doc.question.title = 'TEST ONLY revised title';
    bank.save(id, doc, 'Revision', 1, 'Teacher');
    assert.equal(bank.current(id).active_version, 2);
    assert.equal(bank.document(id, 1).question.title, 'TEST ONLY TEST-DRAFT');
    assert.equal(bank.document(id, 2).question.title, 'TEST ONLY revised title');
    assert.throws(() => bank.save(id, doc, 'No change', 2), /No content changes/);
    assert.equal(bank.versions(id).length, 2);
    assert.throws(
      () =>
        bank.run('UPDATE question_versions SET change_note=? WHERE question_id=?', 'changed', id),
      /immutable/,
    );
  } finally {
    bank.close();
  }
});
test('Approved manual and JSON revisions never overwrite active content before human review', () => {
  const { bank, fixture } = setup();
  try {
    const original = fixture('TEST-REVIEW');
    const { id } = bank.create(original, 'Approved', null, true);
    const revised = structuredClone(original);
    revised.question.title = 'TEST ONLY revised';
    const result = bank.save(id, revised, 'Change title', 1, 'Author', 'json');
    assert.ok(result.pending && result.candidateId);
    assert.deepEqual(bank.document(id), original);
    assert.equal(bank.versions(id).length, 1);
    assert.throws(() => bank.review(result.candidateId!, true, ''), /teacher/);
    bank.review(result.candidateId!, true, 'Reviewing teacher');
    assert.deepEqual(bank.document(id), revised);
    assert.deepEqual(bank.document(id, 1), original);
    assert.equal(bank.versions(id).length, 2);
    assert.equal(bank.current(id).active_version, 2);
  } finally {
    bank.close();
  }
});
test('Rejected and stale candidates preserve the active version, and stable codes cannot change', () => {
  const { bank, fixture } = setup();
  try {
    const doc = fixture('TEST-STALE');
    const { id } = bank.create(doc, 'Initial', null, true);
    doc.question.title = 'TEST ONLY candidate';
    const a = bank.save(id, doc, 'A', 1);
    doc.question.title = 'TEST ONLY candidate B';
    const b = bank.save(id, doc, 'B', 1);
    bank.review(a.candidateId!, true, 'Teacher');
    assert.throws(() => bank.review(b.candidateId!, true, 'Teacher'), /stale/);
    bank.review(b.candidateId!, false, 'Teacher');
    assert.equal(bank.current(id).active_version, 2);
    assert.throws(() => bank.save(id, doc, 'Old editor', 1), /changed/);
    doc.question.questionCode = 'TEST-CHANGED';
    assert.throws(() => bank.save(id, doc, 'Code change', 2), /stable/);
  } finally {
    bank.close();
  }
});
test('Nested parts, per-part hints and answer diagrams survive revision roundtrip', () => {
  const { bank, fixture } = setup();
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
    const { id } = bank.create(doc, 'Nested');
    assert.deepEqual(bank.document(id), doc);
    assert.equal(bank.all('PRAGMA foreign_key_check').length, 0);
  } finally {
    bank.close();
  }
});
test('Database transactions roll back a failed content write completely', () => {
  const { bank, fixture } = setup();
  try {
    bank.db.exec(
      "CREATE TRIGGER fail_parts BEFORE INSERT ON question_parts BEGIN SELECT RAISE(ABORT,'forced test failure'); END;",
    );
    assert.throws(
      () => bank.create(fixture('TEST-ROLLBACK'), 'Test', null, true),
      /forced test failure/,
    );
    assert.equal(bank.list().total, 0);
    assert.equal(bank.all('SELECT * FROM question_versions').length, 0);
    assert.equal(bank.all('SELECT * FROM question_search').length, 0);
  } finally {
    bank.close();
  }
});
test('PDF ingestion is a service boundary that always stages review candidates', async () => {
  const { bank, fixture } = setup();
  try {
    const doc = fixture('TEST-PDF');
    doc.question.status = 'draft';
    const { id } = bank.create(doc, 'Initial');
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
    assert.deepEqual(bank.document(id), doc);
    assert.ok(result.diff.some((d) => d.path === 'parts'));
    assert.equal(bank.candidates(id)[0].source, 'pdf');
  } finally {
    bank.close();
  }
});
test('Migration is repeatable and stored records survive reopening', () => {
  const dir = mkdtempSync(join(tmpdir(), 'physics-bank-test-'));
  try {
    const path = join(dir, 'bank.sqlite');
    const first = new Bank(path);
    first.close();
    const second = new Bank(path);
    assert.equal(second.all('SELECT * FROM schema_migrations').length, 1);
    assert.equal(second.taxonomy().semesters.length, 2);
    assert.equal(second.one('PRAGMA integrity_check')?.integrity_check, 'ok');
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('Diff includes content, numerical metadata, assets and hints without rewriting values', () => {
  const { bank, fixture } = setup();
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
    bank.close();
  }
});
