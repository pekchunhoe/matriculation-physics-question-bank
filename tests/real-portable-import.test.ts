import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  normalizeQuestionImport,
  compatibilitySubmission,
  parseImportSource,
} from '../shared/import-compatibility.js';
import { questionPackageSchema } from '../shared/question-import.js';
import {
  realPortableSource,
  realPortableReview,
  realAdministrativePaths,
} from './real-portable-fixture.js';
import { createTestBank } from './test-bank.js';
import { seedAdminSession, testEmail } from './auth-fixture.js';
import { QuestionJsonImportService } from '../server/question-json-import.js';
import { splitPackage } from './question-import-fixture.js';
import { createWordExport } from '../src/word-export.js';
import { exportPlan } from '../shared/export-plan.js';
import { unzipSync, strFromU8 } from 'fflate';
import type { AdminIdentity } from '../server/auth.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MathText } from '../src/MathText.js';

const blocking = (r: ReturnType<typeof normalizeQuestionImport>) =>
  r.diagnostics.filter((d) => d.blocking);

test('actual unchanged file detects its versioned profile but requires missing fields and explicit metadata review', () => {
  const s = realPortableSource(),
    r = normalizeQuestionImport(parseImportSource(JSON.stringify(s)));
  assert.equal(r.adapter, 'portable-worked-v1.1@2');
  assert.equal(r.sourceVersion, '1.1');
  assert.equal(r.difficulty, 'Medium');
  assert.equal(r.valid, false);
  assert.equal(r.lossless, false);
  assert.deepEqual(
    blocking(r)
      .filter((d) => d.category === 'required')
      .map((d) => d.destinationPath)
      .sort(),
    [
      '/classification/chapter',
      '/classification/curriculumVersionCode',
      '/question/estimatedMinutes',
      '/question/questionType',
    ],
  );
  assert.deepEqual(
    blocking(r)
      .filter((d) => d.category === 'unsupported')
      .map((d) => d.sourcePath)
      .sort(),
    realAdministrativePaths.slice().sort(),
  );
  const pdf = s.pdf_export_contract.reference_pdf_embedded;
  assert.equal(
    createHash('sha256').update(Buffer.from(pdf.content_base64, 'base64')).digest('hex'),
    pdf.sha256,
  );
});

test('actual portable profile keeps hostile prose inert and rejects invalid equation/asset payloads', async () => {
  const bank = await createTestBank();
  try {
    const review = await realPortableReview(bank),
      source = realPortableSource();
    const payload = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
    source.question.stem.text += payload;
    const candidate = structuredClone(questionPackageSchema.parse(review.candidate));
    candidate.question.scenario += payload;
    const r = normalizeQuestionImport(source, { ...review, candidate });
    assert.equal(r.valid, true, JSON.stringify(blocking(r)));
    const html = renderToStaticMarkup(
      createElement(MathText, { value: (r.candidate.question as { scenario: string }).scenario }),
    );
    assert.doesNotMatch(html, /<img|<script/);
    assert.match(html, /&lt;script&gt;/);
    for (const change of [
      (s: ReturnType<typeof realPortableSource>) => {
        s.answer_scheme.steps[0].worked_equations[0].value = '\\def\\x{\\x}\\x';
      },
      (s: ReturnType<typeof realPortableSource>) => {
        s.assets = { external: { url: 'https://example.invalid/asset.svg' } };
      },
    ]) {
      const s = realPortableSource();
      change(s);
      assert.equal(normalizeQuestionImport(s, review).valid, false);
    }
  } finally {
    await bank.close();
  }
});

test('actual source draft transaction rolls back all content, immutable versions and receipts after a marking-step failure', async () => {
  const bank = await createTestBank();
  try {
    const source = realPortableSource(),
      review = await realPortableReview(bank);
    await seedAdminSession(bank);
    const admin: AdminIdentity = {
      id: String((await bank.one('SELECT id FROM admins WHERE email=?', testEmail))!.id),
      email: testEmail,
      role: 'admin',
    };
    const service = new QuestionJsonImportService(bank);
    const c = questionPackageSchema.parse(normalizeQuestionImport(source, review).candidate),
      { manifest } = splitPackage(c);
    const plan = await service.validate(
      manifest,
      admin,
      'Medium',
      false,
      compatibilitySubmission(source, review),
    );
    await bank.run(
      "CREATE TEMP TRIGGER fail_actual_portable BEFORE INSERT ON solution_steps BEGIN SELECT RAISE(ABORT,'Actual portable marking-step failure injection'); END",
    );
    await assert.rejects(
      service.commit(manifest, plan.token, [], admin, 'Medium'),
      /failure injection/,
    );
    for (const table of [
      'questions',
      'question_parts',
      'solutions',
      'solution_steps',
      'hints',
      'question_versions',
      'question_import_receipts',
      'question_version_classifications',
      'question_search',
    ])
      assert.deepEqual(await bank.all(`SELECT * FROM ${table}`), [], table);
    assert.deepEqual(await bank.all('PRAGMA foreign_key_check'), []);
  } finally {
    await bank.close();
  }
});

test('actual source academic text, all 13 equations, marks, quantities and step-owned hints survive reviewed normalization', async () => {
  const bank = await createTestBank();
  try {
    const s = realPortableSource(),
      review = await realPortableReview(bank),
      r = normalizeQuestionImport(s, review);
    assert.equal(r.valid, true, JSON.stringify(blocking(r)));
    assert.equal(
      r.lossless,
      false,
      'Explicit metadata exclusions must not be called globally lossless',
    );
    const c = questionPackageSchema.parse(r.candidate);
    assert.equal(c.question.title, s.question.heading);
    assert.equal(
      c.question.scenario,
      s.question.stem.text.replace(/\\\(([\s\S]*?)\\\)/g, (_: string, body: string) => `$${body}$`),
    );
    assert.equal(c.question.totalMarks, 3);
    assert.equal(c.difficulty, 'MEDIUM');
    assert.equal(c.classification.semester, 'Semester 1');
    assert.equal(c.classification.topic, s.metadata.topic);
    assert.deepEqual(c.parts, []);
    assert.deepEqual(c.assets, []);
    assert.ok(c.tags.includes('SP015'));
    assert.deepEqual(c.tags, ['SP015']);
    for (const key of ['question_id', 'question_source', 'subject', 'programme', 'language'])
      assert.ok(!JSON.stringify(c).includes(JSON.stringify(s.metadata[key])));
    assert.doesNotMatch(
      JSON.stringify(c),
      /pdf_export_contract|content_base64|importer_compatibility/,
    );
    const allMath = c.solutions
      .flatMap((scheme) => [scheme.blocks, ...scheme.steps.map((step) => step.blocks)])
      .flatMap((blocks) => (blocks ?? []).flatMap((b) => (b.type === 'math' ? [b.latex] : [])));
    const sourceMath = [
      ...s.answer_scheme.given_values.map(
        (v: { presentation_latex: string }) => v.presentation_latex,
      ),
      ...s.answer_scheme.final_answers.map((v: { latex: string }) => v.latex),
      ...s.answer_scheme.steps.flatMap((step: { worked_equations: { value: string }[] }) =>
        step.worked_equations.map((eq) => eq.value),
      ),
    ];
    assert.deepEqual(allMath, sourceMath);
    assert.equal(allMath.length, 13);
    s.answer_scheme.steps.forEach(
      (
        step: { title: string; marking_code: string; marks: number; student_hint: string },
        i: number,
      ) => {
        assert.equal(c.solutions[0].steps[i].explanation, step.title);
        assert.equal(c.solutions[0].steps[i].markingCode, step.marking_code);
        assert.equal(c.solutions[0].steps[i].marks, step.marks);
        assert.equal(c.hints[i].text, step.student_hint);
        assert.equal(c.hints[i].solutionStepId, c.solutions[0].steps[i].id);
      },
    );
    for (const v of [...s.answer_scheme.given_values, ...s.answer_scheme.final_answers])
      assert.ok(JSON.stringify(c.solutions[0].blocks).includes(String(v.value)));
  } finally {
    await bank.close();
  }
});

test('actual source cannot lose equations, numbers, hints or marks through candidate corrections or metadata exclusions', async () => {
  const bank = await createTestBank();
  try {
    const s = realPortableSource(),
      review = await realPortableReview(bank);
    for (const change of [
      (c: ReturnType<typeof questionPackageSchema.parse>) => {
        c.solutions[0].steps[0].blocks!.pop();
      },
      (c: ReturnType<typeof questionPackageSchema.parse>) => {
        c.hints[0].text = 'Shortened hint';
      },
      (c: ReturnType<typeof questionPackageSchema.parse>) => {
        c.hints[0].solutionStepId = c.solutions[0].steps[1].id;
      },
      (c: ReturnType<typeof questionPackageSchema.parse>) => {
        c.solutions[0].blocks!.shift();
      },
      (c: ReturnType<typeof questionPackageSchema.parse>) => {
        c.solutions[0].steps[0].marks = 0;
      },
      (c: ReturnType<typeof questionPackageSchema.parse>) => {
        c.question.scenario = 'Changed 20 L to 25 L';
      },
    ]) {
      const candidate = structuredClone(questionPackageSchema.parse(review.candidate));
      change(candidate);
      assert.equal(normalizeQuestionImport(s, { ...review, candidate }).valid, false);
    }
    const unknown = structuredClone(s);
    unknown.answer_scheme.steps[0].alternative_working = 'Additional academic solution';
    const r = normalizeQuestionImport(unknown, {
      ...review,
      administrativePaths: [
        ...realAdministrativePaths,
        '/answer_scheme/steps/0/alternative_working',
      ],
    });
    assert.equal(r.valid, false);
    assert.ok(blocking(r).some((d) => d.sourcePath.endsWith('/alternative_working')));
  } finally {
    await bank.close();
  }
});

test('portable provenance needs explicit review while SP015 cannot be excluded as metadata', async () => {
  const bank = await createTestBank();
  try {
    const source = realPortableSource(),
      review = await realPortableReview(bank);
    const unreviewed = normalizeQuestionImport(source, {
      ...review,
      administrativePaths: ['/importer_compatibility', '/pdf_export_contract'],
    });
    assert.equal(unreviewed.valid, false);
    assert.deepEqual(
      blocking(unreviewed)
        .map((d) => d.sourcePath)
        .sort(),
      realAdministrativePaths.filter((p) => p.startsWith('/metadata/')).sort(),
    );
    const candidate = questionPackageSchema.parse(review.candidate);
    candidate.tags = [];
    const removed = normalizeQuestionImport(source, {
      ...review,
      candidate,
      administrativePaths: [...realAdministrativePaths, '/metadata/syllabus_code'],
    });
    assert.equal(removed.valid, false);
    assert.ok(blocking(removed).some((d) => d.sourcePath === '/metadata/syllabus_code'));
  } finally {
    await bank.close();
  }
});

test('reviewed provenance cannot be reintroduced as tags through corrections or mapping, including direct server validation', async () => {
  const bank = await createTestBank();
  try {
    const source = realPortableSource(),
      review = await realPortableReview(bank);
    await seedAdminSession(bank);
    const admin: AdminIdentity = {
      id: String((await bank.one('SELECT id FROM admins WHERE email=?', testEmail))!.id),
      email: testEmail,
      role: 'admin',
    };
    const service = new QuestionJsonImportService(bank);
    for (const path of realAdministrativePaths.filter((p) => p.startsWith('/metadata/'))) {
      const candidate = questionPackageSchema.parse(review.candidate);
      candidate.tags.push(source.metadata[path.split('/').at(-1)!]);
      const poisoned = { ...review, candidate };
      const r = normalizeQuestionImport(source, poisoned);
      assert.equal(r.valid, false);
      assert.ok(blocking(r).some((d) => /cannot become question tags/.test(d.message)));
      const { manifest } = splitPackage(candidate);
      await assert.rejects(
        service.validate(
          manifest,
          admin,
          'Medium',
          false,
          compatibilitySubmission(source, poisoned),
        ),
        /cannot become question tags/,
      );
      const mapped = normalizeQuestionImport(source, { ...review, mappings: { '/tags/1': path } });
      assert.equal(mapped.valid, false);
      assert.ok(blocking(mapped).some((d) => /cannot also be mapped/.test(d.message)));
    }
    for (const path of [
      '/importer_compatibility',
      '/pdf_export_contract/reference_pdf_embedded/content_base64',
    ]) {
      const r = normalizeQuestionImport(source, {
        ...review,
        mappings: { '/question/scenario': path },
      });
      assert.equal(r.valid, false);
      assert.ok(blocking(r).some((d) => /cannot also be mapped/.test(d.message)));
    }
    assert.equal((await bank.list()).total, 0);
  } finally {
    await bank.close();
  }
});

test('actual profile rejects future versions, unsupported equation presentation and conflicting totals', async () => {
  const bank = await createTestBank();
  try {
    const review = await realPortableReview(bank);
    for (const change of [
      (s: ReturnType<typeof realPortableSource>) => {
        s.format_version = '2.0';
      },
      (s: ReturnType<typeof realPortableSource>) => {
        s.question.stem.format = 'html';
      },
      (s: ReturnType<typeof realPortableSource>) => {
        s.answer_scheme.steps[0].worked_equations[0].display = false;
      },
      (s: ReturnType<typeof realPortableSource>) => {
        s.answer_scheme.total_marks = 4;
      },
      (s: ReturnType<typeof realPortableSource>) => {
        s.question.difficulty_label = 'DIFFICULTY: HARD';
      },
      (s: ReturnType<typeof realPortableSource>) => {
        s.answer_scheme.marking_allocation[0].marks = 2;
      },
    ]) {
      const s = realPortableSource();
      change(s);
      assert.equal(normalizeQuestionImport(s, review).valid, false);
    }
  } finally {
    await bank.close();
  }
});

test('actual source completes signed disposable local draft, immutable retrieval, Word math and duplicate protections', async () => {
  const bank = await createTestBank();
  try {
    const s = realPortableSource(),
      review = await realPortableReview(bank);
    await seedAdminSession(bank);
    const admin: AdminIdentity = {
      id: String((await bank.one('SELECT id FROM admins WHERE email=?', testEmail))!.id),
      email: testEmail,
      role: 'admin',
    };
    const service = new QuestionJsonImportService(bank);
    await assert.rejects(service.validate(s, admin, 'Medium'));
    assert.equal((await bank.list()).total, 0);
    const c = questionPackageSchema.parse(normalizeQuestionImport(s, review).candidate),
      { manifest, files } = splitPackage(c);
    const submission = compatibilitySubmission(s, review);
    const preview = await service.validate(manifest, admin, 'Medium', false, submission);
    assert.equal((await bank.list()).total, 0);
    const created = await service.commit(manifest, preview.token, files, admin, 'Medium');
    const saved = await bank.document(created.id);
    assert.equal(saved.question.status, 'draft');
    assert.equal(saved.question.difficultyId, 'medium');
    assert.deepEqual(saved.solutions, c.solutions);
    assert.deepEqual(saved.hints, c.hints);
    assert.deepEqual(saved.question.blocks, c.question.blocks);
    assert.deepEqual(saved.tags, c.tags);
    assert.deepEqual(saved.tags, ['SP015']);
    assert.deepEqual(await bank.document(created.id, 1), saved);
    const tax = await bank.taxonomy(),
      plan = exportPlan([{ id: created.id, document: saved }], tax);
    for (const mode of ['question', 'answer'] as const) {
      const bytes = await createWordExport(plan, mode, tax, async () => {
        throw Error('No source image fetch allowed');
      });
      const xml = strFromU8(unzipSync(bytes)['word/document.xml']);
      assert.match(xml, /m:oMath/);
      assert.doesNotMatch(xml, /content_base64|pdf_export_contract|importer_compatibility/);
      if (mode === 'answer') {
        assert.match(xml, /1050/);
        assert.match(xml, /450/);
        assert.match(xml, /Convert pressure and volume to SI units/);
        assert.match(xml, /m:borderBox/);
      }
    }
    const duplicate = await service.validate(manifest, admin, 'Medium', false, submission);
    assert.equal(duplicate.duplicates[0].id, created.id);
    await assert.rejects(
      service.commit(manifest, duplicate.token, [], admin, 'Medium'),
      /Identical content/,
    );
    assert.deepEqual(await bank.all('PRAGMA foreign_key_check'), []);
    assert.equal((await bank.list()).total, 1);
    const forged = structuredClone(submission);
    (forged.review.candidate as typeof c).hints[0].text = 'Corrupted hint';
    await assert.rejects(
      service.validate(manifest, admin, 'Medium', false, forged),
      /changed or removed|Preserve them exactly/,
    );
  } finally {
    await bank.close();
  }
});
