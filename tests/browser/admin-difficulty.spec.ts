import { test, expect } from './question-import-browser-fixture.js';
import { localPackage } from '../question-import-fixture.js';
import { difficultyOptions } from '../../shared/question-import.js';
import type { Page } from '@playwright/test';
import { installAxe } from './accessibility.js';

async function validate(page: Page, difficulty: string) {
  const selector = page.getByLabel('Difficulty', { exact: true });
  if (await selector.isEnabled()) await selector.selectOption(difficulty);
  else await expect(selector).toHaveValue(difficulty);
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(
    page.getByText(`DIFFICULTY: ${difficulty.toUpperCase()}`, { exact: true }),
  ).toBeVisible();
}
async function commit(page: Page) {
  await page.getByRole('checkbox', { name: /I reviewed the question/ }).check();
  await page.getByRole('button', { name: 'Import as Draft' }).click();
  const link = page.getByRole('link', { name: 'Review imported draft' });
  await expect(link).toBeVisible();
  return (await link.getAttribute('href'))!.split('/').at(-1)!;
}

test('a missing canonical difficulty is rejected by the server and its error is associated with the selector', async ({
  page,
  importFixture,
}) => {
  const doc = await localPackage(importFixture.bank);
  delete doc.difficulty;
  await importFixture.bank.run("DELETE FROM difficulty_levels WHERE name='Hard'");
  await page.goto('/import/question-json');
  await page.getByLabel('Paste Question JSON').fill(JSON.stringify(doc));
  await page.getByLabel('Difficulty', { exact: true }).selectOption('Hard');
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Expected exactly one canonical difficulty record',
  );
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveAttribute(
    'aria-describedby',
    'difficulty-error difficulty-help',
  );
  await expect(page.getByLabel('Paste Question JSON')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.getByRole('button', { name: 'Import as Draft' })).toHaveCount(0);
  expect((await importFixture.bank.list()).total).toBe(0);
});

test('no manual selection blocks preview without a validation request or database write; error belongs to select', async ({
  page,
  importFixture,
}) => {
  const doc = await localPackage(importFixture.bank);
  delete doc.difficulty;
  await page.goto('/import/question-json');
  await page.getByLabel('Paste Question JSON').fill(JSON.stringify(doc));
  let validationRequests = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/import/validate')) validationRequests++;
  });
  const select = page.getByLabel('Difficulty', { exact: true });
  await expect(select).toHaveValue('');
  await expect(select.locator('option:checked')).toHaveText('Select difficulty...');
  await expect(select).toHaveAttribute('required', '');
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Select a difficulty before validating this question.',
  );
  await expect(select).toHaveAttribute('aria-invalid', 'true');
  await expect(select).toHaveAttribute('aria-describedby', 'difficulty-error difficulty-help');
  await expect(page.getByRole('heading', { name: 'Validation results' })).toHaveCount(0);
  expect(validationRequests).toBe(0);
  expect((await importFixture.bank.list()).total).toBe(0);
  expect(await importFixture.bank.all('SELECT * FROM question_import_receipts')).toEqual([]);
});

for (const method of ['paste', 'upload'] as const)
  test(`source Medium loaded by ${method} is preserved; a package without difficulty requires a fresh selection`, async ({
    page,
    importFixture,
  }) => {
    const doc = await localPackage(importFixture.bank);
    doc.difficulty = 'Medium';
    await page.goto('/import/question-json');
    if (method === 'paste') await page.getByLabel('Paste Question JSON').fill(JSON.stringify(doc));
    else
      await page.getByLabel('Upload one .json file').setInputFiles({
        name: 'legacy.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(doc)),
      });
    await expect(page.getByLabel('Paste Question JSON')).toHaveValue(JSON.stringify(doc));
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('Medium');
    await expect(page.getByLabel('Difficulty', { exact: true })).toBeDisabled();
    await expect(
      page.getByText(
        'Source difficulty preserved: Medium. Correct the source only if the source itself is wrong.',
      ),
    ).toBeVisible();
    await validate(page, 'Medium');
    delete doc.difficulty;
    doc.question.title += ' new package';
    await page.getByLabel('Paste Question JSON').fill(JSON.stringify(doc));
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Import as Draft' })).toHaveCount(0);
  });

for (const difficulty of difficultyOptions)
  test(`admin ${difficulty} preview and draft persist the same canonical value with no JSON difficulty`, async ({
    page,
    importFixture,
  }) => {
    const doc = await localPackage(importFixture.bank);
    delete doc.difficulty;
    await page.goto('/import/question-json');
    await page.getByLabel('Paste Question JSON').fill(JSON.stringify(doc));
    await validate(page, difficulty);
    const id = await commit(page);
    const tax = await importFixture.bank.taxonomy();
    expect((await importFixture.bank.document(id)).question.difficultyId).toBe(
      tax.difficulties.find((d) => d.name === difficulty)!.id,
    );
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('');
  });

for (const [legacy, difficulty] of [
  ['Hard', 'Easy'],
  ['Easy', 'Hard'],
] as const)
  test(`source ${legacy} is preserved and a direct API attempt to replace it with ${difficulty} is blocked`, async ({
    page,
    request,
    importFixture,
  }) => {
    const doc = await localPackage(importFixture.bank);
    doc.difficulty = legacy;
    await page.goto('/import/question-json');
    await page.getByLabel('Paste Question JSON').fill(JSON.stringify(doc));
    await expect(page.getByLabel('Difficulty', { exact: true })).toBeDisabled();
    const response = await request.post('/api/admin/questions/import/validate', {
      data: { manifest: doc, selectedDifficulty: difficulty },
    });
    expect(response.status()).toBe(400);
    await validate(page, legacy);
    const id = await commit(page);
    expect((await importFixture.bank.document(id)).question.difficultyId).toBe(
      legacy.toLowerCase(),
    );
  });

test('changing Medium to Hard clears reviewed preview, rejects the old token, and requires a fresh Hard preview', async ({
  page,
  request,
  importFixture,
}) => {
  const doc = await localPackage(importFixture.bank);
  delete doc.difficulty;
  await page.goto('/import/question-json');
  await page.getByLabel('Paste Question JSON').fill(JSON.stringify(doc));
  const response = page.waitForResponse((r) => r.url().endsWith('/import/validate'));
  await validate(page, 'Medium');
  const plan = await (await response).json();
  await page.getByRole('checkbox', { name: /I reviewed the question/ }).check();
  await expect(page.getByRole('button', { name: 'Import as Draft' })).toBeEnabled();
  await page.getByLabel('Difficulty', { exact: true }).selectOption('Hard');
  await expect(page.getByRole('heading', { name: 'Validation results' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import as Draft' })).toHaveCount(0);
  const stale = await request.post('/api/admin/questions/import/commit', {
    multipart: { manifest: JSON.stringify(doc), token: plan.token, selectedDifficulty: 'Hard' },
  });
  expect(stale.status()).toBe(409);
  expect((await importFixture.bank.list()).total).toBe(0);
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByText('DIFFICULTY: HARD', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /I reviewed the question/ })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Import as Draft' })).toBeDisabled();
  const id = await commit(page);
  expect((await importFixture.bank.document(id)).question.difficultyId).toBe('hard');
});

for (const [width, height] of [
  [390, 844],
  [1280, 1000],
])
  test(`native difficulty selector is labelled, touch-sized, keyboard accessible and unclipped at ${width}x${height}`, async ({
    page,
    importFixture,
  }) => {
    await page.setViewportSize({ width, height });
    const doc = await localPackage(importFixture.bank);
    delete doc.difficulty;
    await page.goto('/import/question-json');
    await page.getByLabel('Paste Question JSON').fill(JSON.stringify(doc));
    const select = page.getByRole('combobox', { name: 'Difficulty', exact: true });
    await select.scrollIntoViewIfNeeded();
    await expect(select).toBeVisible();
    const box = await select.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(40);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    await select.focus();
    await page.keyboard.press('ArrowDown');
    await expect(select).toHaveValue('Easy');
    await page.keyboard.press('ArrowDown');
    await expect(select).toHaveValue('Medium');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Validate & Preview' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('DIFFICULTY: MEDIUM', { exact: true })).toBeVisible();
    await select.scrollIntoViewIfNeeded();
    await installAxe(page);
    const violations = await page.evaluate(
      async () =>
        (
          await (
            window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }
          ).axe.run()
        ).violations,
    );
    expect(violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `data/admin-difficulty/selector-${width}.png`, fullPage: true });
  });
