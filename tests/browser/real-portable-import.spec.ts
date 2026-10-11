import { test, expect } from './question-import-browser-fixture.js';
import { realPortableSource, realPortableReview } from '../real-portable-fixture.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { normalizeQuestionImport } from '../../shared/import-compatibility.js';

const root = 'data/real-source-verification';

test('actual file blocks missing fields, then reviewed website mapping previews and imports a complete local draft', async ({
  page,
  importFixture,
}) => {
  const source = realPortableSource();
  const review = await realPortableReview(importFixture.bank);
  await page.goto('/import/question-json');
  await page.getByLabel('Paste Question JSON').fill(JSON.stringify(source));
  await expect(page.getByText(/Detected: Portable physics JSON/)).toContainText(
    'portable-worked-v1.1@2',
  );
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('Medium');
  await expect(page.getByLabel('Difficulty', { exact: true })).toBeDisabled();
  let validations = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/import/validate')) validations++;
  });
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByRole('alert')).toContainText('estimatedMinutes not found');
  expect(validations).toBe(0);
  expect((await importFixture.bank.list()).total).toBe(0);
  const missingCandidate = normalizeQuestionImport(source).candidate;
  Object.assign(missingCandidate.question as object, {
    estimatedMinutes: 3,
    questionType: 'structured',
  });
  await page
    .getByLabel('Normalized Master JSON (administrator corrections)')
    .fill(JSON.stringify(missingCandidate));
  await page.getByRole('button', { name: 'Apply corrections and recheck' }).click();
  const tax = await importFixture.bank.taxonomy();
  const chapter = tax.chapters.find((c) => c.name === 'TEST ONLY portable verification chapter')!;
  const semester = tax.semesters.find((s) => s.id === chapter.parentId)!;
  const topic = tax.topics.find(
    (t) => t.parentId === chapter.id && t.name === source.metadata.topic,
  )!;
  await page
    .getByLabel('Import curriculum version', { exact: true })
    .selectOption(semester.curriculumVersionId!);
  await page.getByLabel('Import semester', { exact: true }).selectOption(semester.id);
  await page.getByLabel('Import chapter', { exact: true }).selectOption(chapter.id);
  await page.getByLabel('Import topic', { exact: true }).selectOption(topic.id);
  await page.getByRole('button', { name: 'Confirm reviewed curriculum mapping' }).click();
  for (const path of review.administrativePaths!)
    await page.getByRole('checkbox', { name: `I reviewed ${path};`, exact: false }).check();
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(
    page.getByRole('heading', { name: 'Validation results', exact: true }),
  ).toBeVisible();
  expect(validations).toBe(1);
  await expect(page.locator('.paper')).toContainText(
    'In a thermodynamic process, an ideal gas absorbs',
  );
  await expect(page.locator('.paper')).toContainText('Given:');
  await expect(page.locator('.answer-scheme .solution-step')).toHaveCount(3);
  await expect(page.locator('.answer-scheme .step-hint')).toHaveCount(3);
  await expect(page.locator('.answer-scheme .katex')).toHaveCount(13);
  await expect(page.locator('.katex-error')).toHaveCount(0);
  for (const step of source.answer_scheme.steps)
    await expect(page.locator('.answer-scheme')).toContainText(step.student_hint);
  await expect(page.locator('.answer-scheme')).toContainText('GJU1');
  await expect(page.locator('.answer-scheme')).toContainText('1050');
  mkdirSync(root, { recursive: true });
  await page.screenshot({ path: root + '/actual-preview.png', fullPage: true });
  await page.getByRole('checkbox', { name: /I reviewed the question/ }).check();
  await page.getByRole('button', { name: 'Import as Draft' }).click();
  const link = page.getByRole('link', { name: 'Review imported draft' });
  await expect(link).toBeVisible();
  const id = (await link.getAttribute('href'))!.split('/').at(-1)!;
  const doc = await importFixture.bank.document(id);
  expect(doc.question.status).toBe('draft');
  expect(doc.question.difficultyId).toBe('medium');
  expect(doc.parts).toEqual([]);
  expect(doc.assets).toEqual([]);
  expect(doc.tags).toEqual(['SP015']);
  expect((await importFixture.bank.document(id, 1)).tags).toEqual(['SP015']);
  for (const key of ['question_id', 'question_source', 'subject', 'programme', 'language'])
    expect(JSON.stringify(doc)).not.toContain(JSON.stringify(source.metadata[key]));
  expect(JSON.stringify(doc)).not.toMatch(
    /content_base64|pdf_export_contract|importer_compatibility/,
  );
  expect(doc.hints.map((h) => h.text)).toEqual(
    source.answer_scheme.steps.map((s: { student_hint: string }) => s.student_hint),
  );
  writeFileSync(
    root + '/actual-local-draft.json',
    JSON.stringify(
      {
        testOnlyMissingFields: {
          estimatedMinutes: 3,
          questionType: 'structured',
          chapter: 'TEST ONLY portable verification chapter',
          curriculumVersionCode: 'LEGACY',
        },
        document: doc,
      },
      null,
      2,
    ),
  );

  // Approval here only enables the public export flow in this in-memory bank.
  // It is separate from the completed draft import and never touches production.
  doc.question.status = 'approved';
  const revision = await importFixture.bank.save(
    id,
    doc,
    'TEST ONLY export verification approval',
    1,
    'TEST ONLY reviewer',
  );
  await importFixture.bank.review(revision.candidateId!, true, 'TEST ONLY reviewer');
  await page.goto('/question-set?ids=' + id);
  for (const mode of ['question', 'answer'] as const) {
    await page.getByLabel('Document', { exact: true }).selectOption(mode);
    await page.getByLabel('Export format', { exact: true }).selectOption('docx');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const file = root + `/actual-${mode}.docx`;
    await (await pending).saveAs(file);
    const xml = strFromU8(unzipSync(readFileSync(file))['word/document.xml']);
    expect(xml).toContain('m:oMath');
    expect(xml).toContain('MEDIUM');
    expect(xml).not.toContain('pdf_export_contract');
    if (mode === 'answer') {
      expect(xml).toContain('1050');
      expect(xml).toContain('m:borderBox');
      expect(xml).toContain(source.answer_scheme.steps[1].student_hint);
    } else {
      expect(xml).not.toContain('Student hint:');
      expect(xml).toContain('In a thermodynamic process');
    }
    await page.getByLabel('Export format', { exact: true }).selectOption('pdf');
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.pdf({
      path: root + `/actual-${mode}.pdf`,
      preferCSSPageSize: true,
      printBackground: true,
    });
    await page.emulateMedia({ media: 'screen' });
  }
  expect(await importFixture.bank.all('PRAGMA foreign_key_check')).toEqual([]);
});

test('reviewed provenance tag injection blocks website preview before any API validation or draft write', async ({
  page,
  importFixture,
}) => {
  const source = realPortableSource(),
    review = await realPortableReview(importFixture.bank);
  await page.goto('/import/question-json');
  await page.getByLabel('Paste Question JSON').fill(JSON.stringify(source));
  const candidate = structuredClone(review.candidate) as { tags: string[] };
  candidate.tags.push(source.metadata.question_source);
  await page
    .getByLabel('Normalized Master JSON (administrator corrections)')
    .fill(JSON.stringify(candidate));
  await page.getByRole('button', { name: 'Apply corrections and recheck' }).click();
  for (const path of review.administrativePaths!)
    await page.getByRole('checkbox', { name: `I reviewed ${path};`, exact: false }).check();
  let validations = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/import/validate')) validations++;
  });
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Excluded provenance metadata cannot become question tags',
  );
  expect(validations).toBe(0);
  expect((await importFixture.bank.list()).total).toBe(0);
});
