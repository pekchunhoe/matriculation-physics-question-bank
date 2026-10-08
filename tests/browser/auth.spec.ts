import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { testEmail, testPassword } from '../auth-fixture.js';
const require = createRequire(import.meta.url);

test('Public students browse approved questions, solutions, hints and curriculum without authoring controls or login', async ({
  page,
}) => {
  await page.goto('/?q=TEST-S1-0');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Add question', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Import JSON', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'View solution', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Answer scheme', exact: true })).toBeVisible();
  await expect(page.getByText('TEST ONLY solution', { exact: true })).toBeVisible();
  await expect(page.getByText('PRIVATE TEACHER NOTE')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit question' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Version history' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Student preview' }).click();
  await page.getByRole('button', { name: 'Reveal hint 1' }).first().click();
  await expect(page.getByText('TEST ONLY hint two')).toBeVisible();
  await page.getByRole('link', { name: 'Curriculum', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Courses, semesters and topics' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Add a curriculum record' })).toHaveCount(0);
});

test('Admin login fails generically, succeeds, restores after refresh and logout removes authorization', async ({
  page,
}) => {
  await page.goto('/admin/login');
  await page.getByLabel('Administrator email').fill(testEmail);
  await page.getByLabel('Password', { exact: true }).fill('incorrect TEST ONLY password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid administrator credentials');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await page.getByLabel('Password', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add question', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Admin login', exact: true })).toBeVisible();
  expect((await page.request.post('/api/questions', { data: { role: 'admin' } })).status()).toBe(
    401,
  );
  await expect(page.getByRole('link', { name: 'Add question', exact: true })).toHaveCount(0);
});

test('Public selections prepare server-validated questions and generate a PDF with optional schemes and hints', async ({
  page,
}) => {
  await page.goto('/?q=TEST-S1-0');
  await page.getByRole('checkbox', { name: 'Select TEST-S1-0', exact: true }).check();
  await page.getByRole('link', { name: 'Prepare question set' }).click();
  await expect(page.locator('.print-question')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Answer scheme', exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Include marking schemes' }).check();
  await page.getByRole('checkbox', { name: 'Include student hints' }).check();
  await expect(page.getByRole('heading', { name: 'Answer scheme', exact: true })).toBeVisible();
  await expect(page.getByText('TEST ONLY hint one')).toBeVisible();
  await expect(page.getByText('PRIVATE TEACHER NOTE')).toHaveCount(0);
  const button = page.getByRole('button', { name: 'Print / Save as PDF', exact: true });
  await expect(button).toBeEnabled();
  const pdf = await page.pdf({
    path: test.info().outputPath('public-question-set.pdf'),
    format: 'A4',
    printBackground: true,
  });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(5000);
  await page.evaluate(() => {
    (window as unknown as { printRequested: boolean }).printRequested = false;
    window.print = () => {
      (window as unknown as { printRequested: boolean }).printRequested = true;
    };
  });
  await button.click();
  expect(
    await page.evaluate(() => (window as unknown as { printRequested: boolean }).printRequested),
  ).toBe(true);
});

test('Public print route refuses hidden IDs and direct authoring paths require login', async ({
  page,
}) => {
  await page.goto('/question-set?ids=TEST-HIDDEN-NONEXISTENT&answers=true&role=admin');
  await expect(page.getByRole('alert')).toHaveText('Question not found');
  await expect(page.locator('.print-question')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeDisabled();
  await page.goto('/edit/new?role=admin&teacher=true');
  await expect(page.getByRole('heading', { name: 'Admin login', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toHaveCount(0);
  expect((await page.request.post('/api/uploads')).status()).toBe(401);
});

test('Login and public print options fit mobile and have no automated accessibility violations', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/admin/login', '/?q=TEST-S1-0']) {
    await page.goto(path);
    if (path === '/admin/login') await expect(page.getByLabel('Administrator email')).toBeVisible();
    else await expect(page.locator('.question-card')).toHaveCount(1);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const result = await page.evaluate(async () =>
      (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run(),
    );
    expect(result.violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  }
});
