import { test, expect } from './question-import-browser-fixture.js';
import { readFileSync, mkdirSync } from 'node:fs';
import { localPackage } from '../question-import-fixture.js';
import { normalizeQuestionImport } from '../../shared/import-compatibility.js';
import type { Bank } from '../../server/database.js';
import type { Page } from '@playwright/test';
import { installAxe } from './accessibility.js';
import { unzipSync, strFromU8 } from 'fflate';

async function portable(bank: Bank) {
  const p = JSON.parse(
    readFileSync('examples/question-import/portable-first-law-synthetic.json', 'utf8'),
  ) as Record<string, unknown>;
  const local = await localPackage(bank);
  Object.assign(p.metadata as object, {
    curriculum_version_code: local.classification.curriculumVersionCode,
    semester: local.classification.semester,
    chapter_name: local.classification.chapter,
    topic_name: local.classification.topic,
  });
  return p;
}
async function paste(page: Page, source: unknown) {
  await page.goto('/import/question-json');
  await page.getByLabel('Paste Question JSON').fill(JSON.stringify(source));
}
async function preview(page: Page) {
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(
    page.getByRole('heading', { name: 'Validation results', exact: true }),
  ).toBeVisible();
}
async function commit(page: Page) {
  await page.getByRole('checkbox', { name: /I reviewed the question/ }).check();
  await page.getByRole('button', { name: 'Import as Draft' }).click();
  const link = page.getByRole('link', { name: 'Review imported draft' });
  await expect(link).toBeVisible();
  return (await link.getAttribute('href'))!.split('/').at(-1)!;
}
test('portable paste detects v1.1, preserves Medium and previews real math, exact steps and separate hints before local draft', async ({
  page,
  importFixture,
}) => {
  const p = await portable(importFixture.bank);
  await paste(page, p);
  await expect(page.getByText(/Detected: Portable physics JSON/)).toContainText('portable-v1.1@1');
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('Medium');
  await expect(page.getByLabel('Difficulty', { exact: true })).toBeDisabled();
  await preview(page);
  await expect(page.locator('.paper .katex')).not.toHaveCount(0);
  await expect(page.locator('.answer-scheme .katex')).not.toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^Hint / })).toHaveCount(2);
  await expect(page.locator('.answer-scheme').getByText(/300 J increase/)).toBeVisible();
  const id = await commit(page),
    saved = await importFixture.bank.document(id);
  expect(saved.question.status).toBe('draft');
  expect(saved.question.difficultyId).toBe('medium');
  expect(saved.solutions[0].steps[1].equationLatex).toBe('\\Delta U=500-200=300\\,\\mathrm{J}');
  expect(saved.hints[0].solutionStepId).toBe('first-law');
  expect(saved.question.scenario).toContain('Δ, θ, μ, Ω, °');
});
test('missing required time blocks all API validation requests until explicit candidate correction', async ({
  page,
  importFixture,
}) => {
  const p = await portable(importFixture.bank);
  delete (p.question as Record<string, unknown>).estimated_minutes;
  await paste(page, p);
  let requests = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/import/validate')) requests++;
  });
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByRole('alert')).toContainText('estimatedMinutes not found');
  expect(requests).toBe(0);
  const candidate = normalizeQuestionImport(p).candidate;
  (candidate.question as Record<string, unknown>).estimatedMinutes = 4;
  await page
    .getByLabel('Normalized Master JSON (administrator corrections)')
    .fill(JSON.stringify(candidate));
  await page.getByRole('button', { name: 'Apply corrections and recheck' }).click();
  await preview(page);
  expect(requests).toBe(1);
  const id = await commit(page);
  expect((await importFixture.bank.document(id)).question.estimatedMinutes).toBe(4);
});
test('unknown wrapper uses exact field mapping and cannot discard unrepresented academic content', async ({
  page,
  importFixture,
}) => {
  const canonical = await localPackage(importFixture.bank);
  canonical.difficulty = 'Medium';
  const { classification, ...content } = canonical;
  const source = { unexpected: content, classification, title: content.question.title };
  await paste(page, source);
  await page
    .getByLabel('Normalized Master JSON (administrator corrections)')
    .fill(JSON.stringify(canonical));
  await page.getByRole('button', { name: 'Apply corrections and recheck' }).click();
  await expect(
    page.getByText('Manual review required before preview or draft creation.', { exact: false }),
  ).toBeVisible();
  for (const key of ['question', 'difficulty', 'parts', 'solutions', 'hints', 'tags', 'assets']) {
    await page.getByLabel('Source field path').selectOption('/unexpected/' + key);
    await page.getByLabel('Canonical destination path').fill('/' + key);
    await page.getByRole('button', { name: 'Apply field mapping' }).click();
  }
  await preview(page);
  await commit(page);
  expect((await importFixture.bank.list()).total).toBe(1);
});
test('duplicate content blocks new draft until explicit separate-draft choice and fresh signed preview', async ({
  page,
  importFixture,
}) => {
  const p = await portable(importFixture.bank);
  await paste(page, p);
  await preview(page);
  const first = await commit(page);
  await paste(page, p);
  await preview(page);
  await expect(page.getByRole('heading', { name: 'Existing identical questions' })).toBeVisible();
  await expect(page.getByRole('link', { name: /SYNTHETIC TEST ONLY/ })).toHaveAttribute(
    'href',
    '/questions/' + first,
  );
  await page.getByRole('checkbox', { name: /I reviewed the question/ }).check();
  await expect(page.getByRole('button', { name: 'Import as Draft' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /I intentionally want a separate draft/ }).check();
  await preview(page);
  const second = await commit(page);
  expect(second).not.toBe(first);
  expect((await importFixture.bank.list()).total).toBe(2);
});
test('unsupported academic fields and future versions remain blocking; no draft writes or automatic publication', async ({
  page,
  importFixture,
}) => {
  const p = await portable(importFixture.bank);
  p.alternative_solutions = ['Different meaningful method'];
  await paste(page, p);
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByRole('alert')).toContainText('/alternative_solutions');
  await expect(page.getByRole('checkbox', { name: /alternative_solutions/ })).toHaveCount(0);
  delete p.alternative_solutions;
  p.format_version = '2.0';
  await paste(page, p);
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByRole('alert')).toContainText('Unsupported source version 2.0');
  expect((await importFixture.bank.list()).total).toBe(0);
});
test('portable question exports actual PDF and native Word after separate approval in the isolated test bank', async ({
  page,
  importFixture,
}) => {
  const p = await portable(importFixture.bank);
  await paste(page, p);
  await preview(page);
  const id = await commit(page);
  const doc = await importFixture.bank.document(id);
  expect(doc.question.status).toBe('draft');
  doc.question.status = 'approved';
  const revision = await importFixture.bank.save(
    id,
    doc,
    'TEST ONLY separate approval for export verification',
    1,
    'TEST ONLY reviewer',
  );
  await importFixture.bank.review(revision.candidateId!, true, 'TEST ONLY reviewer');
  await page.goto('/question-set?ids=' + id);
  await expect(page.getByRole('heading', { name: 'Question set', exact: true })).toBeVisible();
  await page.getByLabel('Document', { exact: true }).selectOption('answer');
  await page.getByLabel('Export format', { exact: true }).selectOption('docx');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  mkdirSync('data/flexible-json-import', { recursive: true });
  await download.saveAs('data/flexible-json-import/portable-answer.docx');
  const path = await download.path();
  expect(path).not.toBeNull();
  const xml = strFromU8(unzipSync(readFileSync(path!))['word/document.xml']);
  expect(xml).toContain('m:oMath');
  expect(xml).toContain('300 J');
  expect(xml).toContain('Identify the sign convention');
  expect(xml).not.toContain('format_identifier');
  await page.getByLabel('Export format', { exact: true }).selectOption('pdf');
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('.master-paper .katex').first()).toBeVisible();
  await page.pdf({
    path: 'data/flexible-json-import/portable-answer.pdf',
    format: 'A4',
    printBackground: true,
  });
});
test('manual review controls fit mobile and satisfy automated accessibility checks', async ({
  page,
  importFixture,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const p = await portable(importFixture.bank);
  delete (p.question as Record<string, unknown>).estimated_minutes;
  await paste(page, p);
  await installAxe(page);
  const result = await page.evaluate(
    async () =>
      (
        await (
          window as unknown as { axe: { run(): Promise<{ violations: unknown[] }> } }
        ).axe.run()
      ).violations,
  );
  expect(result).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    path: 'data/flexible-json-import/manual-review-mobile.png',
    fullPage: true,
  });
});
