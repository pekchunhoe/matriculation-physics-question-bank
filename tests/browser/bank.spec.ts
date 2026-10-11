import { test, expect } from './admin-fixture.js';
import { installAxe } from './accessibility.js';
import { readFileSync } from 'node:fs';
import type { QuestionDocument } from '../../shared/schema';
test('semester, topic, difficulty and keyword filtering work together in the browser', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.question-card')).toHaveCount(7);
  await page.getByRole('button', { name: /Semester 1.*Browse questions/ }).click();
  await expect(page.locator('.question-card')).toHaveCount(4);
  await page.getByRole('checkbox', { name: /TEST ONLY Momentum/ }).check();
  await page.getByLabel('Difficulty', { exact: true }).selectOption('hard');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await expect(page.locator('.question-card code')).toHaveText('TEST-S1-2');
  await page.getByLabel('Search the question bank').fill('collision');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await expect(page).toHaveURL(/semester=semester-1/);
  await expect(page).toHaveURL(/difficulty=hard/);
  await expect(page).toHaveURL(/topic=/);
  await page.getByLabel('Semester', { exact: true }).selectOption('semester-2');
  await page.getByLabel('Difficulty', { exact: true }).selectOption('medium');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await expect(page.locator('.question-card code')).toHaveText('TEST-S2-1');
  await expect(page.getByRole('checkbox', { name: /TEST ONLY Momentum/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.locator('.question-card')).toHaveCount(7);
});
test('URL filters survive reload and marks/status filters compose', async ({ page }) => {
  await page.goto('/?semester=semester-1&difficulty=hard&status=approved&q=collision');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
  await page.getByText('More filters', { exact: true }).click();
  await page.getByLabel('Minimum marks').fill('3');
  await expect(
    page.getByRole('heading', { name: 'No questions match these filters' }),
  ).toBeVisible();
  await page.getByLabel('Minimum marks').fill('2');
  await expect(page.locator('.question-card')).toHaveCount(1);
});
test('student preview progressively reveals hints, renders math and keeps answer scheme hidden', async ({
  page,
}) => {
  await page.goto('/?q=TEST-S1-0');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Preview', exact: true }).click();
  await expect(page.getByText('STUDENT PREVIEW', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Answer scheme', exact: true })).toHaveCount(0);
  await expect(page.getByText('PRIVATE TEACHER NOTE')).toHaveCount(0);
  await expect(page.locator('.katex')).toHaveCount(1);
  await expect(page.getByText('TEST ONLY hint one')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal hint 1' }).first().click();
  await expect(page.getByText('TEST ONLY hint two')).toBeVisible();
  await page.getByRole('button', { name: 'Reveal hint 1' }).click();
  await expect(page.getByText('TEST ONLY hint one')).toBeVisible();
  await page.getByRole('link', { name: 'Teacher view' }).click();
  await expect(page.getByRole('heading', { name: 'Answer scheme', exact: true })).toBeVisible();
  await expect(page.getByText('PRIVATE TEACHER NOTE')).toBeVisible();
});
test('approved editor saves a review candidate and replacement requires a named human decision', async ({
  page,
}) => {
  await page.goto('/?q=TEST-S1-2');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Semester', { exact: true })).toHaveValue('semester-1');
  await expect(page.getByLabel('Stable question code')).toBeDisabled();
  await page.getByLabel('Title', { exact: true }).fill('TEST ONLY browser reviewed revision');
  await page.getByLabel('Revision note').fill('Browser integration revision');
  await page.getByLabel('Author', { exact: true }).fill('Test author');
  await page.getByRole('button', { name: 'Save for review' }).click();
  await expect(
    page.getByRole('heading', { name: 'TEST ONLY TEST-S1-2', exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve replacement' })).toBeDisabled();
  await page.getByLabel('Reviewing teacher').fill('Test reviewer');
  await page.getByRole('checkbox', { name: /I reviewed these changes/ }).check();
  await page.getByRole('button', { name: 'Approve replacement' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'TEST ONLY browser reviewed revision',
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page.getByLabel('View version').selectOption('1');
  await expect(
    page.getByRole('heading', { name: 'TEST ONLY TEST-S1-2', exact: true, level: 1 }),
  ).toBeVisible();
});
test('curriculum and editor cascade semester, chapter, topic and subtopic selections', async ({
  page,
}) => {
  await page.goto('/curriculum');
  await expect(page.getByRole('heading', { name: 'Courses, semesters and topics' })).toBeVisible();
  await expect(page.getByText('Semester 2', { exact: true })).toBeVisible();
  await page.goto('/edit/new');
  await page.getByLabel('Semester', { exact: true }).selectOption('semester-1');
  await page
    .getByLabel('Chapter', { exact: true })
    .selectOption({ label: 'TEST ONLY Momentum chapter (test taxonomy)' });
  await page
    .getByLabel('Topic', { exact: true })
    .selectOption({ label: 'TEST ONLY Momentum (test taxonomy)' });
  await page.getByLabel('Semester', { exact: true }).selectOption('semester-2');
  await expect(page.getByLabel('Chapter', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Topic', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Topic', { exact: true }).locator('option')).toHaveCount(1);
});
for (const width of [1440, 768, 390])
  test(`responsive browsing and accessible controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?semester=semester-1&difficulty=hard');
    await expect(page.locator('.question-card')).toHaveCount(1);
    if (width < 700) {
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await expect(page.getByLabel('Difficulty', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Close filters' }).click();
    }
    await installAxe(page);
    const violations = await page.evaluate(async () => {
      const result = await (
        window as unknown as {
          axe: {
            run: () => Promise<{
              violations: { id: string; impact: string; description: string }[];
            }>;
          };
        }
      ).axe.run();
      return result.violations;
    });
    expect(violations).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    await page.screenshot({ path: `test-results/bank-${width}.png`, fullPage: true });
  });
test('student mathematics and nested content fit mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?q=TEST-S2-0');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.katex')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await page.screenshot({ path: 'test-results/student-mobile.png', fullPage: true });
});

test('teacher authors parts, solution steps, hints and an approved archive without changing mismatched marks', async ({
  page,
}) => {
  await page.goto('/edit/new');
  await page.getByLabel('Semester', { exact: true }).selectOption('semester-1');
  await page
    .getByLabel('Chapter', { exact: true })
    .selectOption({ label: 'TEST ONLY Momentum chapter (test taxonomy)' });
  await page
    .getByLabel('Topic', { exact: true })
    .selectOption({ label: 'TEST ONLY Momentum (test taxonomy)' });
  await page.getByLabel('Difficulty', { exact: true }).selectOption('easy');
  await page.getByLabel('Stable question code').fill('TEST-BROWSER-CREATE');
  await page.getByLabel('Title', { exact: true }).fill('TEST ONLY authored browser fixture');
  await page.getByLabel('Total marks', { exact: true }).fill('3');
  await page.getByLabel('Prompt', { exact: true }).fill('TEST ONLY prompt with $x = 2$');
  await page.getByLabel('Marks', { exact: true }).fill('2');
  await expect(page.getByText(/Part marks total 2; question total is 3/)).toBeVisible();
  await page.getByRole('button', { name: 'Add solution', exact: true }).click();
  await page.getByLabel('Solution', { exact: true }).fill('TEST ONLY browser solution');
  await page.getByLabel('Teacher notes', { exact: true }).fill('BROWSER PRIVATE TEACHER NOTES');
  await page.getByRole('button', { name: 'Add solution step' }).click();
  await page.getByLabel('Step equation (LaTeX)').fill('x = 2');
  await page.getByLabel('Step marks', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Add hint', exact: true }).click();
  await page.getByLabel('Hint text').fill('TEST ONLY browser hint');
  await page.getByRole('button', { name: 'Add asset', exact: true }).click();
  await page.getByLabel('Asset type').selectOption('original_pdf');
  await page.getByLabel('Description / alternative text').fill('TEST ONLY original archive');
  await page.getByLabel('Upload file').setInputFiles({
    name: 'test-only.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nTEST ONLY ARCHIVE\n%%EOF'),
  });
  await expect(page.getByLabel('Asset URL')).toHaveValue(/\/uploads\/.*\.pdf/);
  await page.getByRole('button', { name: 'Add asset', exact: true }).click();
  await page.getByLabel('Description / alternative text').last().fill('TEST ONLY vector diagram');
  await page
    .getByLabel('Upload file')
    .last()
    .setInputFiles({
      name: 'test-vector.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50"><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6"/></marker></defs><path d="M10 25L90 25" stroke="black" marker-end="url(#arrow)"/></svg>',
      ),
    });
  await expect(page.getByLabel('Asset URL').last()).toHaveValue(/\/uploads\/.*\.svg/);
  await page.getByRole('checkbox', { name: 'Contains diagram', exact: true }).check();
  await page.getByLabel('Status', { exact: true }).selectOption('approved');
  await page.getByRole('checkbox', { name: /I reviewed the content/ }).check();
  await page.getByLabel('Revision note').fill('TEST ONLY initial authored revision');
  await page.getByLabel('Author', { exact: true }).fill('Test author');
  await page.getByRole('button', { name: 'Save revision', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'TEST ONLY authored browser fixture',
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Part marks total 2; question total is 3/)).toBeVisible();
  await expect(
    page.getByRole('link', { name: /original pdf.*TEST ONLY original archive/ }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'TEST ONLY vector diagram' })).toHaveJSProperty(
    'naturalWidth',
    100,
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const file = await download,
    path = await file.path();
  expect(path).not.toBeNull();
  const doc = JSON.parse(readFileSync(path!, 'utf8')) as QuestionDocument;
  expect(doc.question.totalMarks).toBe(3);
  expect(doc.parts[0].marks).toBe(2);
  expect(doc.solutions[0].steps[0].equationLatex).toBe('x = 2');
  expect(doc.question.difficultyId).toBe('easy');
  await page.getByRole('link', { name: 'Student preview', exact: true }).click();
  await expect(page.getByText('BROWSER PRIVATE TEACHER NOTES')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /TEST ONLY original archive/ })).toHaveCount(0);
});
test('browser JSON import validates and previews before a teacher saves it', async ({
  page,
  request,
}) => {
  const result = await request.get('/api/questions?q=TEST-S2-1');
  const listing = await result.json();
  const exported = await request.get('/api/questions/' + listing.items[0].id + '/export');
  const doc = (await exported.json()) as QuestionDocument;
  doc.question.questionCode = 'TEST-BROWSER-IMPORT';
  doc.question.title = 'TEST ONLY JSON browser import';
  doc.question.status = 'draft';
  await page.goto('/import');
  await page.getByLabel('Question JSON (schemaVersion 1)').fill(JSON.stringify(doc));
  await page.getByRole('button', { name: 'Validate and preview' }).click();
  await expect(
    page
      .locator('.paper')
      .getByRole('heading', { name: 'TEST ONLY JSON browser import', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Revision note').fill('TEST ONLY browser JSON import');
  await page.getByLabel('Author', { exact: true }).fill('Test importer');
  await page.getByRole('checkbox', { name: /I reviewed this imported content/ }).check();
  await page.getByRole('button', { name: 'Import question', exact: true }).click();
  await expect(page).toHaveURL(/\/questions\//);
  await expect(
    page
      .locator('.paper')
      .getByRole('heading', { name: 'TEST ONLY JSON browser import', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('draft', { exact: true })).toBeVisible();
});
test('editor, curriculum, import and student views have no automated accessibility violations', async ({
  page,
}) => {
  for (const path of ['/edit/new', '/curriculum', '/import', '/?q=TEST-S2-0']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    if (path.startsWith('/?')) {
      await expect(page.locator('.question-card')).toHaveCount(1);
      await page.getByRole('link', { name: 'Preview', exact: true }).click();
    }
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
    await installAxe(page);
    const violations = await page.evaluate(async () => {
      const result = await (
        window as unknown as {
          axe: { run: () => Promise<{ violations: { id: string; impact: string }[] }> };
        }
      ).axe.run();
      return result.violations;
    });
    expect(violations).toEqual([]);
  }
});
