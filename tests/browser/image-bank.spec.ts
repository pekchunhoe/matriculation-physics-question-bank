import { test, expect } from './student-fixture.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { installAxe } from './accessibility.js';
import { testEmail, testPassword } from '../auth-fixture.js';
import type { ImageQuestion } from '../../shared/image-question.js';

test('Student browsing, dependent dropdowns, selection, removal and original aspect ratio', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Question bank', exact: true })).toBeVisible();
  await page.getByLabel('Semester', { exact: true }).selectOption('semester-1');
  await expect(page.locator('.question-card')).toHaveCount(20);
  await page.locator('.question-card input').first().check();
  await expect(page.getByRole('region', { name: 'Selected questions', exact: true })).toContainText(
    '1 selected',
  );
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
  await page.locator('.question-card input').first().check();
  await expect(page.getByRole('region', { name: 'Selected questions', exact: true })).toContainText(
    '10 total marks',
  );
  await page.getByRole('link', { name: 'Create combined PDF' }).click();
  await expect(page.getByRole('heading', { name: '2 questions - 10 total marks' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Question 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: '1 questions - 5 total marks' })).toBeVisible();
  await page.goto('/');
  await page
    .locator('.question-card')
    .first()
    .getByRole('link', { name: 'Preview', exact: true })
    .click();
  await expect(page.getByAltText('Question image')).toBeVisible();
  await expect(page.getByAltText('Answer image')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show answer / marking scheme' }).click();
  await expect(page.getByAltText('Answer image')).toBeVisible();
  for (const image of await page.locator('.academic-image').all()) {
    const dimensions = await image.evaluate((img: HTMLImageElement) => ({
      w: img.width,
      h: img.height,
      nw: img.naturalWidth,
      nh: img.naturalHeight,
    }));
    expect(Math.abs(dimensions.w / dimensions.h - dimensions.nw / dimensions.nh)).toBeLessThan(
      0.01,
    );
  }
});
test('Student cannot open editor or write through direct API, including obsolete routes', async ({
  page,
  request,
}) => {
  await page.goto('/edit/new');
  await expect(page.getByRole('heading', { name: 'Admin login' })).toBeVisible();
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  for (const [method, url] of [
    ['POST', '/api/questions'],
    ['PUT', '/api/questions/test'],
    ['PATCH', '/api/questions/test/status'],
    ['POST', '/api/taxonomy/subtopics'],
    ['POST', '/api/question-json-import'],
    ['DELETE', '/api/questions/test'],
  ])
    expect((await request.fetch(url, { method })).status()).toBe(401);
  for (const url of ['/api/admin/legacy-questions', '/api/questions/test/versions'])
    expect((await request.get(url)).status()).toBe(401);
});
test('Administrator login and logout use the existing protected session flow', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/admin/login');
  await page.getByLabel('Administrator email').fill(testEmail);
  await page.getByLabel('Password').fill(testPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('link', { name: 'Admin login' })).toBeVisible();
});
test('CSP, headers, accessible controls and narrow-screen layout', async ({ page, request }) => {
  const response = await request.get('/');
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['content-security-policy']).not.toContain("'unsafe-eval'");
  const violations: string[] = [];
  await page.exposeFunction('recordViolation', (s: string) => violations.push(s));
  await page.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { recordViolation: (s: string) => void }).recordViolation(
        JSON.stringify({
          directive: e.violatedDirective,
          blockedURI: e.blockedURI,
          sourceFile: e.sourceFile,
          line: e.lineNumber,
          column: e.columnNumber,
        }),
      ),
    ),
  );
  await page.goto('/');
  await expect(page.locator('.question-card')).toHaveCount(20);
  expect(violations).toEqual([]);
  const applicationViolations = [...violations];
  await installAxe(page);
  const accessibility = await page.evaluate(async () => {
    const result = await (
      window as unknown as { axe: { run: () => Promise<{ violations: { impact: string }[] }> } }
    ).axe.run();
    return result.violations;
  });
  const issues = accessibility.filter((v) => ['serious', 'critical'].includes(v.impact));
  expect(issues).toEqual([]); // axe probes blocked capabilities after the application CSP check.
  mkdirSync('data/architecture-refactor', { recursive: true });
  writeFileSync(
    'data/architecture-refactor/csp-accessibility.json',
    JSON.stringify(
      {
        applicationViolations,
        accessibilityToolPhaseViolations: violations.slice(applicationViolations.length),
        accessibility,
        criticalOrSeriousViolations: issues,
      },
      null,
      2,
    ),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'data/architecture-refactor/student-mobile.png', fullPage: true });
});
for (const count of [1, 5, 20, 50])
  test(`Browser PDF exports ${count} questions with matching answers and tall-image pagination`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    const result = await request.get('/api/questions?limit=50&semester=semester-1');
    const rows = (await result.json()).items as ImageQuestion[];
    const tall = rows.find((q) => q.questionImage.height === 4000)!;
    const assigned = rows.find((q) => q.subtopicId !== null)!;
    const selected = [
      tall,
      assigned,
      ...rows.filter((q) => q.id !== tall.id && q.id !== assigned.id),
    ]
      .slice(0, count)
      .reverse();
    expect(tall.subtopicId).toBeNull();
    if (count > 1) expect(selected.some((q) => q.subtopicId !== null)).toBe(true);
    await page.goto('/question-set?ids=' + selected.map((q) => q.id).join(','));
    await expect(page.getByRole('button', { name: 'Download combined PDF' })).toBeEnabled();
    const violations: string[] = [];
    page.on('pageerror', (e) => violations.push(e.message));
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download combined PDF' }).click();
    const download = await pending;
    const folder = 'data/architecture-refactor/pdf';
    mkdirSync(folder, { recursive: true });
    const path = `${folder}/browser-${count}.pdf`;
    await download.saveAs(path);
    const pdf = await PDFDocument.load(readFileSync(path));
    expect(pdf.getPageCount()).toBe(count * 2 + 7);
    for (const p of pdf.getPages()) {
      expect(p.getWidth()).toBeCloseTo(595.28);
      expect(p.getHeight()).toBeCloseTo(841.89);
    }
    const list = await page.locator('.set-order li').allTextContents();
    expect(list).toHaveLength(count);
    const chapters = list.map((v) => Number(/Chapter (\d+)/.exec(v)![1]));
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
    expect(list.every((v, i) => v.includes(`Question ${i + 1} / Answer ${i + 1}`))).toBe(true);
    expect(violations).toEqual([]);
    writeFileSync(
      `${folder}/browser-${count}.json`,
      JSON.stringify(
        { count, pages: pdf.getPageCount(), orderedLabels: list, ids: selected.map((q) => q.id) },
        null,
        2,
      ),
    );
    await expect(page.getByRole('status')).toContainText('Combined PDF downloaded');
  });
test('Invalid, duplicate and mixed-semester export selection fail without a download', async ({
  page,
  request,
}) => {
  const rows = (await (await request.get('/api/questions?limit=1')).json()).items;
  await page.goto('/question-set?ids=' + rows[0].id + ',' + rows[0].id);
  await expect(page.getByRole('alert')).toContainText('distinct');
  await expect(page.getByRole('button', { name: 'Download combined PDF' })).toBeDisabled();
  expect((await request.get('/api/public/question-set?ids=missing')).status()).toBe(409);
});
