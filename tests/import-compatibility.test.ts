import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { unzipSync, strFromU8 } from 'fflate';
import {
  normalizeQuestionImport,
  parseImportSource,
  normalizeMathDelimiters,
  compatibilitySubmission,
} from '../shared/import-compatibility.js';
import { questionPackageSchema } from '../shared/question-import.js';
import {
  examplePackage,
  localPackage,
  nestedPackage,
  splitPackage,
} from './question-import-fixture.js';
import { setup } from './fixtures.js';
import { seedAdminSession, testEmail, authenticatedFetch } from './auth-fixture.js';
import { QuestionJsonImportService } from '../server/question-json-import.js';
import { createApp } from '../server/app.js';
import { createWordExport } from '../src/word-export.js';
import { exportPlan } from '../shared/export-plan.js';
import { MasterPrint } from '../src/MasterPrint.js';
import { MathText } from '../src/MathText.js';
import type { AdminIdentity } from '../server/auth.js';

export function portableFixture(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      new URL('../examples/question-import/portable-first-law-synthetic.json', import.meta.url),
      'utf8',
    ),
  );
}
const blocked = (r: ReturnType<typeof normalizeQuestionImport>) =>
  r.diagnostics
    .filter((d) => d.blocking)
    .map((d) => d.message)
    .join('\n');
test('A: canonical adapter preserves official packages exactly, including optional fields and visuals', () => {
  for (const visual of [false, true]) {
    const source = examplePackage(visual),
      result = normalizeQuestionImport(source);
    assert.equal(result.valid, true, blocked(result));
    assert.equal(result.lossless, true);
    assert.deepEqual(result.candidate, source);
    assert.equal(result.adapter, 'canonical-v1@1');
  }
});
test('B/G: documented portable v1.1 profile preserves MEDIUM, working, Unicode, equations and separate step hints deterministically', () => {
  const source = portableFixture(),
    before = structuredClone(source),
    r = normalizeQuestionImport(source);
  assert.equal(r.valid, true, blocked(r));
  assert.equal(r.difficulty, 'Medium');
  const doc = questionPackageSchema.parse(r.candidate);
  assert.match(doc.question.scenario, /\$\\Delta U=Q-W\$/);
  assert.match(doc.question.scenario, /Δ, θ, μ, Ω, °/);
  assert.equal(doc.solutions[0].steps[1].equationLatex, '\\Delta U=500-200=300\\,\\mathrm{J}');
  assert.equal(doc.hints[0].solutionStepId, 'first-law');
  assert.equal(doc.hints[0].partId, null);
  assert.deepEqual(normalizeQuestionImport(source), r);
  assert.deepEqual(source, before);
  assert.equal(
    normalizeMathDelimiters('\\(\\vec{F}_{\\mathrm{net}}\\) and \\[\\frac{1}{2}mv^2\\]'),
    '$\\vec{F}_{\\mathrm{net}}$ and $$\\frac{1}{2}mv^2$$',
  );
});
test('C/D: unversioned aliases and genuinely empty optional collections normalize without academic defaults', () => {
  const p = portableFixture();
  delete p.format_identifier;
  delete p.format_version;
  delete p.student_hints;
  delete p.assets;
  const r = normalizeQuestionImport(p);
  assert.equal(r.valid, true, blocked(r));
  assert.equal(r.adapter, 'aliases@1');
  assert.deepEqual(r.candidate.hints, []);
  assert.deepEqual(r.candidate.assets, []);
  assert.ok(r.diagnostics.some((d) => d.category === 'optional'));
});
test('E: required estimated time and marks are not fabricated; exact administrator correction revalidates', () => {
  const p = portableFixture();
  delete (p.question as Record<string, unknown>).estimated_minutes;
  const r = normalizeQuestionImport(p);
  assert.equal(r.valid, false);
  assert.match(blocked(r), /estimatedMinutes not found/);
  assert.equal((r.candidate.question as Record<string, unknown>).estimatedMinutes, undefined);
  const candidate = structuredClone(r.candidate);
  (candidate.question as Record<string, unknown>).estimatedMinutes = 4;
  assert.equal(normalizeQuestionImport(p, { candidate }).valid, true);
});
test('F: nested source parts flatten to canonical adjacency while preserving explicit IDs, marks, schemes and hints', () => {
  const doc = nestedPackage(examplePackage());
  delete doc.difficulty;
  const source = { ...doc } as Record<string, unknown>;
  delete source.schemaVersion;
  delete source.kind;
  source.parts = [
    {
      ...doc.parts[0],
      children: doc.parts.slice(1).map(({ parentId, ...p }) => {
        void parentId;
        return p;
      }),
    },
  ];
  const r = normalizeQuestionImport(source);
  assert.equal(r.valid, true, blocked(r));
  assert.deepEqual(r.candidate.parts, doc.parts);
  assert.deepEqual(r.candidate.solutions, doc.solutions);
});
test('H: unknown wrapper offers exact manual mapping; unresolved source content remains blocked', () => {
  const source = { unfamiliar: examplePackage() },
    first = normalizeQuestionImport(source);
  assert.equal(first.manualRequired, true);
  assert.match(blocked(first), /Unknown JSON/);
  const mappings = Object.fromEntries(
    [
      'classification',
      'question',
      'difficulty',
      'parts',
      'solutions',
      'hints',
      'tags',
      'assets',
    ].map((k) => [`/${k}`, `/unfamiliar/${k}`]),
  );
  const r = normalizeQuestionImport(source, { candidate: examplePackage(), mappings });
  assert.equal(r.valid, true, blocked(r));
  assert.equal(r.lossless, true);
  assert.equal(r.adapter, 'administrator-mapping@1');
});
test('I: unmappable academic information and source edits cannot masquerade as lossless imports', () => {
  const p = portableFixture();
  p.alternative_solutions = [{ answer: 'Additional meaningful derivation' }];
  const r = normalizeQuestionImport(p);
  assert.equal(r.valid, false);
  assert.match(blocked(r), /Unrecognized source/);
  const edited = structuredClone(r.candidate);
  (edited.question as Record<string, unknown>).scenario = 'Rewritten statement';
  assert.match(blocked(normalizeQuestionImport(p, { candidate: edited })), /changed or removed/);
  const reviewed = normalizeQuestionImport(p, { administrativePaths: ['/alternative_solutions'] });
  assert.equal(reviewed.valid, false);
  assert.equal(reviewed.lossless, false);
  const administrative = portableFixture();
  administrative.importer_compatibility = { producer: 'offline test tool' };
  const accepted = normalizeQuestionImport(administrative, {
    administrativePaths: ['/importer_compatibility'],
  });
  assert.equal(accepted.valid, true, blocked(accepted));
  assert.equal(accepted.lossless, false);
  const ambiguous = portableFixture();
  (ambiguous.metadata as Record<string, unknown>).difficulty_level = 'uncertain source category';
  const confirmed = normalizeQuestionImport(ambiguous, { confirmedDifficulty: 'Medium' });
  assert.equal(confirmed.valid, true, blocked(confirmed));
  assert.equal(confirmed.lossless, false);
});
test('version registry refuses unsupported future and forged canonical versions even with manual review', () => {
  for (const source of [
    { ...portableFixture(), format_version: '2.0' },
    { ...examplePackage(), schemaVersion: 2 },
  ]) {
    const r = normalizeQuestionImport(source, { candidate: examplePackage() });
    assert.equal(r.valid, false);
    assert.match(blocked(r), /Unsupported source version/);
  }
});
test('conflicting aliases and free-text marking schemes are surfaced rather than guessed', () => {
  const p = portableFixture();
  (p.question as Record<string, unknown>).title = 'Different title';
  assert.equal(normalizeQuestionImport(p).valid, false);
  const q = portableFixture();
  q.answer_scheme = 'Answer 300 J';
  assert.match(blocked(normalizeQuestionImport(q)), /structured steps/);
  const competing = portableFixture();
  (competing.question as Record<string, unknown>).title = 'Alternate authored title';
  const resolved = normalizeQuestionImport(competing, {
    mappings: {
      '/question/title': '/question/title',
      '/solutions/0/teacherNotes': '/metadata/question_title',
    },
  });
  assert.equal(resolved.valid, true, blocked(resolved));
});
test('unknown unversioned identifiers can be reviewed as metadata, but never impersonate a supported version', () => {
  const source = { ...examplePackage(), format_identifier: 'custom offline wrapper' } as Record<
    string,
    unknown
  >;
  delete source.schemaVersion;
  delete source.kind;
  assert.equal(normalizeQuestionImport(source).valid, false);
  assert.equal(
    normalizeQuestionImport(source, { administrativePaths: ['/format_identifier'] }).valid,
    true,
  );
});
test('N: malformed, oversized, deeply nested, nonfinite and prototype-bearing inputs are bounded and rejected', () => {
  assert.throws(() => parseImportSource('{bad'), /Invalid JSON/);
  assert.throws(() => parseImportSource(' '.repeat(5 * 1024 * 1024 + 1)), /5 MiB/);
  assert.throws(() => parseImportSource('{"__proto__":{"polluted":true}}'), /Unsafe object key/);
  assert.throws(
    () => parseImportSource('{"title":"first","title":"second"}'),
    /Duplicate JSON key/,
  );
  let nested: unknown = null;
  for (let i = 0; i < 34; i++) nested = { next: nested };
  assert.throws(() => normalizeQuestionImport(nested), /deeply nested/);
  assert.throws(() => normalizeQuestionImport({ marks: Infinity }), /finite/);
  assert.throws(() => normalizeQuestionImport(Object.create({ evil: true })), /plain JSON/);
  assert.throws(
    () => normalizeQuestionImport({}, { mappings: { '/question/__proto__/x': '/x' } }),
    /Unsupported canonical destination/,
  );
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.throws(
    () =>
      normalizeQuestionImport(
        { value: 'x' },
        { mappings: { '/parts/999999999/prompt': '/value' } },
      ),
    /Unsupported canonical destination/,
  );
  assert.equal(
    normalizeQuestionImport(['lost statement'], { candidate: examplePackage() }).valid,
    false,
  );
});
async function environment() {
  const { bank } = await setup();
  const cookie = await seedAdminSession(bank);
  const admin: AdminIdentity = {
    id: String((await bank.one('SELECT id FROM admins WHERE email=?', testEmail))!.id),
    email: testEmail,
    role: 'admin',
  };
  const service = new QuestionJsonImportService(bank);
  const p = portableFixture();
  const local = await localPackage(bank);
  Object.assign(p.metadata as object, {
    curriculum_version_code: local.classification.curriculumVersionCode,
    semester: local.classification.semester,
    chapter_name: local.classification.chapter,
    topic_name: local.classification.topic,
  });
  return { bank, cookie, admin, service, p };
}
test('B/L/M/O: source → server normalization → atomic draft → immutable retrieval → PDF markup and native Word preserves content', async () => {
  const e = await environment();
  try {
    const r = normalizeQuestionImport(e.p);
    assert.equal(r.valid, true, blocked(r));
    const before = await e.bank.all('SELECT * FROM questions');
    const plan = await e.service.validate(e.p, e.admin, 'Medium');
    assert.deepEqual(await e.bank.all('SELECT * FROM questions'), before);
    const created = await e.service.commit(e.p, plan.token, [], e.admin, 'Medium'),
      saved = await e.bank.document(created.id);
    const canonical = questionPackageSchema.parse(r.candidate);
    assert.equal(saved.question.scenario, canonical.question.scenario);
    assert.equal(saved.question.totalMarks, 2);
    assert.equal(saved.question.difficultyId, 'medium');
    assert.equal(saved.question.status, 'draft');
    assert.deepEqual(saved.solutions, canonical.solutions);
    assert.deepEqual(saved.hints, canonical.hints);
    assert.deepEqual(saved.parts, canonical.parts);
    assert.deepEqual(saved.assets, []);
    assert.deepEqual(await e.bank.document(created.id, 1), saved);
    const tax = await e.bank.taxonomy(),
      planItems = exportPlan([{ id: created.id, document: saved }], tax);
    const html = renderToStaticMarkup(
      createElement(MasterPrint, { item: planItems[0], tax, answer: true, hints: true }),
    );
    assert.match(html, /katex/);
    assert.match(html, /300 J/);
    assert.match(html, /MEDIUM/);
    assert.doesNotMatch(html, /format_identifier|pdf_export_contract/);
    const bytes = await createWordExport(planItems, 'answer', tax, async () => {
      throw new Error('No supplied assets; no fetch allowed');
    });
    const xml = strFromU8(unzipSync(bytes)['word/document.xml']);
    assert.match(xml, /m:oMath/);
    assert.match(xml, /300 J/);
    assert.match(xml, /Identify the sign convention/);
    assert.doesNotMatch(xml, /format_identifier/);
    assert.deepEqual(await e.bank.all('PRAGMA foreign_key_check'), []);
    await assert.rejects(
      e.service.validate(e.p, e.admin, 'Hard'),
      /Preserve the source difficulty/,
    );
    const invalid = structuredClone(e.p);
    (invalid.question as Record<string, unknown>).total_marks = 3;
    const tables = [
      'questions',
      'question_parts',
      'solutions',
      'solution_steps',
      'hints',
      'question_versions',
      'question_import_receipts',
    ];
    const snapshots = await Promise.all(tables.map((t) => e.bank.all(`SELECT * FROM ${t}`)));
    await assert.rejects(e.service.validate(invalid, e.admin, 'Medium'));
    assert.deepEqual(
      await Promise.all(tables.map((t) => e.bank.all(`SELECT * FROM ${t}`))),
      snapshots,
    );
  } finally {
    await e.bank.close();
  }
});
test('K: fresh duplicate previews cannot silently import; explicit signed approval and receipt retries work', async () => {
  const e = await environment();
  try {
    const p = await e.service.validate(e.p, e.admin, 'Medium'),
      first = await e.service.commit(e.p, p.token, [], e.admin, 'Medium');
    const duplicate = await e.service.validate(e.p, e.admin, 'Medium');
    assert.equal(duplicate.duplicates[0].id, first.id);
    await assert.rejects(
      e.service.commit(e.p, duplicate.token, [], e.admin, 'Medium'),
      /Identical content/,
    );
    assert.equal((await e.bank.list()).total, 1);
    const explicit = await e.service.validate(e.p, e.admin, 'Medium', true),
      second = await e.service.commit(e.p, explicit.token, [], e.admin, 'Medium');
    assert.notEqual(first.id, second.id);
    assert.equal(
      (await e.service.commit(e.p, explicit.token, [], e.admin, 'Medium')).id,
      second.id,
    );
  } finally {
    await e.bank.close();
  }
});
test('server independently checks original source, manual mapping, candidate coverage and manifest parity before signing', async () => {
  const e = await environment();
  try {
    const result = normalizeQuestionImport(e.p),
      canonical = questionPackageSchema.parse(result.candidate),
      { manifest } = splitPackage(canonical);
    const submission = compatibilitySubmission(e.p, {});
    await e.service.validate(manifest, e.admin, 'Medium', false, submission);
    const changed = structuredClone(manifest);
    changed.question.scenario = 'Dropped meaningful content';
    await assert.rejects(
      e.service.validate(changed, e.admin, 'Medium', false, submission),
      /differs from/,
    );
    const forged = { ...submission, review: { candidate: changed } };
    await assert.rejects(
      e.service.validate(changed, e.admin, 'Medium', false, forged),
      /changed or removed/,
    );
    const source = { ...e.p, alternative_solutions: ['Original alternative working'] };
    await assert.rejects(
      e.service.validate(manifest, e.admin, 'Medium', false, { source, review: {} }),
      /Unrecognized source/,
    );
    assert.equal((await e.bank.list()).total, 0);
    const visual = examplePackage(true),
      transport = compatibilitySubmission(visual, {});
    assert.equal(JSON.stringify(transport).includes('dataBase64'), false);
    assert.equal(visual.assets[0].dataBase64.length > 0, true);
    assert.equal(normalizeQuestionImport(transport.source, transport.review, true).valid, true);
  } finally {
    await e.bank.close();
  }
});
test('M: retired source curriculum is never reassigned automatically; reviewed active mapping preserves source and content', async () => {
  const e = await environment();
  try {
    const original = structuredClone(e.p),
      old = e.p.metadata as Record<string, unknown>;
    const active = (await e.bank.taxonomy()).curriculumVersions!.find(
      (v) => v.code === old.curriculum_version_code,
    )!;
    await e.bank.run(
      "INSERT INTO curriculum_versions VALUES('retired-import-fixture',?,'RETIRED-IMPORT-FIXTURE','TEST ONLY retired syllabus',NULL,NULL,'retired',99,1,'before','before')",
      active.courseId,
    );
    old.curriculum_version_code = 'RETIRED-IMPORT-FIXTURE';
    await assert.rejects(e.service.validate(e.p, e.admin, 'Medium'), /non-retired curriculum/);
    assert.equal(old.curriculum_version_code, 'RETIRED-IMPORT-FIXTURE');
    assert.equal((await e.bank.list()).total, 0);
    const candidate = normalizeQuestionImport(e.p).candidate;
    candidate.classification = normalizeQuestionImport(original).candidate.classification;
    const review = { candidate, classificationApproved: true },
      result = normalizeQuestionImport(e.p, review);
    assert.equal(result.valid, true, blocked(result));
    assert.equal(result.lossless, false);
    const { manifest } = splitPackage(questionPackageSchema.parse(result.candidate));
    const plan = await e.service.validate(
      manifest,
      e.admin,
      'Medium',
      false,
      compatibilitySubmission(e.p, review),
    );
    const created = await e.service.commit(manifest, plan.token, [], e.admin, 'Medium');
    assert.equal(
      (await e.bank.document(created.id)).question.scenario,
      (candidate.question as Record<string, unknown>).scenario,
    );
    assert.equal(old.curriculum_version_code, 'RETIRED-IMPORT-FIXTURE');
  } finally {
    await e.bank.close();
  }
});
test('O: portable draft transaction failure rolls back content, versions and receipts atomically', async () => {
  const e = await environment();
  try {
    const plan = await e.service.validate(e.p, e.admin, 'Medium');
    await e.bank.run(
      "CREATE TEMP TRIGGER fail_portable BEFORE INSERT ON solution_steps BEGIN SELECT RAISE(ABORT,'TEST ONLY portable rollback'); END",
    );
    await assert.rejects(
      e.service.commit(e.p, plan.token, [], e.admin, 'Medium'),
      /portable rollback/,
    );
    for (const table of [
      'questions',
      'question_parts',
      'solutions',
      'solution_steps',
      'hints',
      'question_versions',
      'question_import_receipts',
      'question_search',
    ])
      assert.deepEqual(await e.bank.all(`SELECT * FROM ${table}`), []);
  } finally {
    await e.bank.close();
  }
});
test('N: HTML remains literal text in rendered content and external asset references cannot enter the embedded-asset contract', () => {
  const p = portableFixture();
  (p.question as Record<string, unknown>).stem =
    '<script>window.importExecuted=true</script> literal physics $F=ma$';
  const result = normalizeQuestionImport(p);
  assert.equal(result.valid, true, blocked(result));
  const canonical = questionPackageSchema.parse(result.candidate);
  assert.match(canonical.question.scenario, /<script>/);
  const html = renderToStaticMarkup(
    createElement(MathText, { value: canonical.question.scenario }),
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  const unsafe = portableFixture();
  unsafe.assets = { diagram: { url: 'https://untrusted.example.invalid/image.png' } };
  const blockedResult = normalizeQuestionImport(unsafe);
  assert.equal(blockedResult.valid, false);
  assert.match(blocked(blockedResult), /url/);
});
test('J/N: direct alternative-format API calls retain admin/CSRF/canonical validation and draft privacy', async () => {
  const e = await environment();
  const server = createApp(e.bank, undefined).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`,
    url = base + '/api/admin/questions/import/validate';
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest: e.p, selectedDifficulty: 'Medium' }),
  };
  try {
    assert.equal((await fetch(url, init)).status, 401);
    assert.equal(
      (await fetch(url, { ...init, headers: { ...init.headers, Cookie: e.cookie } })).status,
      403,
    );
    const authorized = authenticatedFetch(e.cookie),
      response = await authorized(url, init);
    assert.equal(response.status, 200);
    assert.equal((await e.bank.list()).total, 0);
    const preview = await response.json(),
      form = new FormData();
    form.append('manifest', JSON.stringify(e.p));
    form.append('token', preview.token);
    form.append('selectedDifficulty', 'Medium');
    assert.equal(
      (await fetch(base + '/api/admin/questions/import/commit', { method: 'POST', body: form }))
        .status,
      401,
    );
    const saved = await authorized(base + '/api/admin/questions/import/commit', {
      method: 'POST',
      body: form,
    });
    assert.equal(saved.status, 201);
    const { id } = await saved.json();
    assert.equal((await fetch(base + '/api/questions/' + id)).status, 404);
    const malicious = {
      ...e.p,
      metadata: JSON.parse('{"constructor":{"prototype":{"polluted":true}}}'),
    };
    assert.equal(
      (
        await authorized(url, {
          ...init,
          body: JSON.stringify({ manifest: malicious, selectedDifficulty: 'Medium' }),
        })
      ).status,
      400,
    );
    assert.equal((await e.bank.list()).total, 1);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await e.bank.close();
  }
});
