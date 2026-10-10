import { test, expect } from './question-import-browser-fixture.js';
import { examplePackage, nestedPackage, splitPackage } from '../question-import-fixture.js';
import type { QuestionPackage } from '../../shared/question-import.js';
import type { Taxonomy } from '../../shared/schema.js';
import type { APIRequestContext, Page } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
async function browserPackage(request: APIRequestContext, visual = false) {
  const tax = (await (await request.get('/api/taxonomy')).json()) as Taxonomy;
  const doc = examplePackage(visual),
    topic = tax.topics.find((t) => t.name === 'TEST ONLY Momentum')!,
    chapter = tax.chapters.find((c) => c.id === topic.parentId)!,
    semester = tax.semesters.find((s) => s.id === chapter.parentId)!;
  doc.classification = {
    curriculumVersionCode: tax.curriculumVersions!.find(
      (v) => v.id === semester.curriculumVersionId,
    )!.code,
    semester: 'Semester 1',
    chapter: chapter.name,
    topic: topic.name,
    subtopic: null,
  };
  doc.question.title += ' BROWSER ' + test.info().title;
  return doc;
}
async function preview(page: Page, doc: QuestionPackage) {
  await page.goto('/import/question-json');
  await page.getByLabel('Paste Question JSON').fill(JSON.stringify(doc));
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByRole('heading', { name: 'Validation results' })).toBeVisible();
}

test('paste JSON shares validation and previews real math, whole-question marking scheme, hints and totals', async ({
  page,
  request,
}) => {
  const doc = await browserPackage(request);
  let validationBody = '';
  page.on('request', (r) => {
    if (r.url().endsWith('/import/validate')) validationBody = r.postData() ?? '';
  });
  await preview(page, doc);
  await expect(page.locator('.paper .katex')).not.toHaveCount(0);
  await expect(page.locator('.answer-scheme .katex')).not.toHaveCount(0);
  await expect(page.locator('.paper .preview-part')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Worked answer', exact: true })).toBeVisible();
  await expect(page.getByText(/Question total: 2.*Marking scheme total: 2/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Hint / })).toHaveCount(4);
  expect(validationBody).not.toContain('dataBase64');
  await expect(page.getByRole('button', { name: 'Import as Draft' })).toBeDisabled();
});
test('upload one JSON file uses the same preview and embedded assets need no separate upload', async ({
  page,
  request,
}) => {
  const doc = await browserPackage(request, true);
  await page.goto('/import/question-json');
  await page.getByLabel('Upload one .json file').setInputFiles({
    name: 'synthetic.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.getByLabel('Paste Question JSON')).toHaveValue(JSON.stringify(doc));
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.locator('.paper img')).toHaveCount(1);
  await expect(page.locator('.answer-scheme img')).toHaveCount(1);
  await expect(page.locator('.paper img')).toHaveAttribute(
    'alt',
    'Synthetic block on a horizontal support.',
  );
  await expect(page.locator('.answer-scheme .solution-step img')).toHaveAttribute(
    'alt',
    /upward normal/,
  );
  await expect(page.getByText('free_body_diagram', { exact: true })).toBeVisible();
  await expect(page.getByText('question_diagram', { exact: true })).toBeVisible();
  await expect(page.getByText(/Source page/)).toHaveCount(0);
});

const rejectionCases: [string, (d: QuestionPackage) => void, RegExp][] = [
  [
    'unsupported version',
    (d) => {
      d.schemaVersion = 88 as never;
    },
    /schemaVersion/,
  ],
  [
    'unknown field',
    (d) => {
      Object.assign(d, { unknownEducationalContent: 'Must not disappear' });
    },
    /Unrecognized key/,
  ],
  [
    'invalid classification',
    (d) => {
      d.classification.topic = 'Missing topic';
    },
    /classification.topic/,
  ],
  [
    'invalid difficulty',
    (d) => {
      d.difficulty = 'EASY';
    },
    /difficulty/,
  ],
  [
    'bad mark total',
    (d) => {
      d.question.totalMarks = 4;
    },
    /steps/,
  ],
  [
    'malformed LaTeX',
    (d) => {
      d.solutions[0].steps[0].equationLatex = '\\frac{1}{';
    },
    /equationLatex/,
  ],
  [
    'unmatched delimiters',
    (d) => {
      d.question.scenario = 'Unclosed $x';
    },
    /scenario/,
  ],
  [
    'direct approval',
    (d) => {
      Object.assign(d.question, { status: 'approved' });
    },
    /status/,
  ],
  [
    'nested parent mark mismatch',
    (d) => {
      nestedPackage(d);
      d.parts[0].marks = 4;
    },
    /parts\[0\].marks/,
  ],
];
for (const [name, mutate, path] of rejectionCases)
  test(`preview blocks ${name} and shows an exact error path`, async ({ page, request }) => {
    const doc = await browserPackage(request);
    mutate(doc);
    await page.goto('/import/question-json');
    await page.getByLabel('Paste Question JSON').fill(JSON.stringify(doc));
    await page.getByRole('button', { name: 'Validate & Preview' }).click();
    await expect(page.getByRole('alert')).toContainText(path);
    await expect(page.getByRole('button', { name: 'Import as Draft' })).toHaveCount(0);
  });
test('invalid JSON is readable and associated with the paste field', async ({ page }) => {
  await page.goto('/import/question-json');
  await page.getByLabel('Paste Question JSON').fill('{broken');
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid JSON');
  await expect(page.getByLabel('Paste Question JSON')).toHaveAttribute('aria-invalid', 'true');
});
test('nested subparts and part-scoped hints render without double counting parent marks', async ({
  page,
  request,
}) => {
  const doc = nestedPackage(await browserPackage(request));
  doc.hints[0].partId = 'ai';
  await preview(page, doc);
  await expect(page.locator('.preview-part')).toHaveCount(3);
  await expect(page.locator('.preview-part .preview-part')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Part (i)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hint 1 · ai' })).toBeVisible();
});
test('answer diagram and FBD stay in the answer section and preserve content block order', async ({
  page,
  request,
}) => {
  const doc = await browserPackage(request, true);
  doc.assets[1].role = 'answer_diagram';
  await preview(page, doc);
  await expect(page.locator('.paper img')).toHaveCount(1);
  await expect(page.locator('.answer-scheme img')).toHaveCount(1);
  const ordered = await page.locator('.paper').innerText();
  expect(ordered.indexOf('TEST ONLY')).toBeLessThan(ordered.indexOf('Name the upward'));
  await expect(page.getByText('answer_diagram', { exact: true })).toBeVisible();
});
test('source edits invalidate a reviewed plan and hide the draft action', async ({
  page,
  request,
}) => {
  const doc = await browserPackage(request);
  await preview(page, doc);
  await page.getByRole('checkbox', { name: /I reviewed the question/ }).check();
  await page
    .getByLabel('Paste Question JSON')
    .fill(JSON.stringify({ ...doc, question: { ...doc.question, title: 'Changed' } }));
  await expect(page.getByRole('button', { name: 'Import as Draft' })).toHaveCount(0);
});
test('double click creates one draft; lost response retry returns same ID; draft print and assets stay hidden', async ({
  page,
  request,
  playwright,
  baseURL,
}) => {
  const doc = await browserPackage(request, true),
    validation = page.waitForResponse((r) => r.url().endsWith('/import/validate'));
  await preview(page, doc);
  const plan = await (await validation).json();
  await page.getByRole('checkbox', { name: /I reviewed the question/ }).check();
  await page.getByRole('button', { name: 'Import as Draft' }).dblclick();
  await expect(page.getByRole('link', { name: 'Review imported draft' })).toBeVisible();
  const href = await page.getByRole('link', { name: 'Review imported draft' }).getAttribute('href'),
    id = href!.split('/').at(-1)!;
  await expect(page.getByLabel('Paste Question JSON')).toHaveValue('');
  const { manifest, files } = splitPackage(doc),
    multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
      manifest: JSON.stringify(manifest),
      token: plan.token,
    };
  for (const f of files)
    multipart[f.fieldname] = { name: f.fieldname + '.png', mimeType: f.mimetype, buffer: f.buffer };
  const retry = await request.post('/api/admin/questions/import/commit', { multipart });
  expect(retry.status()).toBe(201);
  expect((await retry.json()).id).toBe(id);
  const listing = await (
    await request.get('/api/questions?q=' + encodeURIComponent(doc.question.title))
  ).json();
  expect(listing.items.filter((q: { id: string }) => q.id === id)).toHaveLength(1);
  const anonymous = await playwright.request.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: {},
  });
  try {
    expect((await anonymous.get('/api/questions/' + id)).status()).toBe(404);
    expect(
      (await anonymous.get('/api/public/question-set?ids=' + id + '&answers=true')).status(),
    ).toBe(404);
  } finally {
    await anonymous.dispose();
  }
  await page.getByRole('link', { name: 'Review imported draft' }).click();
  await expect(page.getByText('draft', { exact: true })).toBeVisible();
  await expect(page.locator('.answer-scheme .solution-step img')).toHaveCount(1);
});
for (const [width, height] of [
  [390, 844],
  [1280, 1000],
])
  test(`complete visual preview is accessible and fits ${width}x${height}`, async ({
    page,
    request,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await preview(page, await browserPackage(request, true));
    await expect(page.locator('.paper img')).toBeVisible();
    await expect(page.locator('.answer-scheme img')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.addScriptTag({ path: require.resolve('axe-core') });
    const violations = await page.evaluate(
      async () =>
        (
          await (
            window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }
          ).axe.run()
        ).violations,
    );
    expect(violations).toEqual([]);
    await page.getByRole('button', { name: 'Import as Draft' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Import as Draft' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`import-${width}.png`), fullPage: true });
  });
