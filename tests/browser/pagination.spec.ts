import { test, expect } from './student-fixture.js';
import type { ImageQuestion, ImageQuestionList } from '../../shared/image-question.js';
import { orderedQuestions } from '../../shared/image-question.js';
import { questionPagination } from '../../shared/pagination.js';
import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import { installAxe } from './accessibility.js';

test('Selections on three pages survive navigation, deselection and export into one paired PDF', async ({
  page,
  request,
}) => {
  await page.goto('/?semester=semester-1');
  const ids: string[] = [];
  for (const [index, count] of [
    [1, 3],
    [2, 4],
    [3, 2],
  ]) {
    if (index > 1) await page.getByRole('button', { name: 'Page ' + index, exact: true }).click();
    await expect(page.locator('.question-card')).toHaveCount(10);
    for (let i = 0; i < count; i++) {
      const card = page.locator('.question-card').nth(i);
      ids.push((await card.locator('code').textContent())!);
      await card.getByRole('checkbox').check();
    }
  }
  await expect(page.getByRole('region', { name: 'Selected questions', exact: true })).toContainText(
    '9 selected',
  );
  await page.getByRole('button', { name: 'Page 1', exact: true }).click();
  for (const id of ids.slice(0, 3))
    await expect(page.getByRole('checkbox', { name: 'Select ' + id, exact: true })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Select ' + ids[0], exact: true }).uncheck();
  await expect(page.getByRole('region', { name: 'Selected questions', exact: true })).toContainText(
    '8 selected',
  );
  await page.getByRole('checkbox', { name: 'Select ' + ids[0], exact: true }).check();
  await expect(page.getByRole('region', { name: 'Selected questions', exact: true })).toContainText(
    '9 selected',
  );
  const tax = await (await request.get('/api/taxonomy')).json();
  const full = await (await request.get('/api/public/question-set?ids=' + ids.join(','))).json();
  const plan = orderedQuestions(full.items, tax);
  expect(plan).toHaveLength(9);
  expect(new Set(plan.map((q) => q.id)).size).toBe(9);
  for (const item of plan) {
    const original = await (
      await request.get('/api/questions/' + item.id + '?answers=true')
    ).json();
    expect(item.questionImage).toEqual(original.questionImage);
    expect(item.answerImage).toEqual(original.answerImage);
  }
  await page.getByRole('link', { name: 'Create combined PDF' }).click();
  await expect(page.locator('.set-order li')).toHaveCount(9);
  expect(await page.locator('.set-order code').allTextContents()).toEqual(plan.map((q) => q.id));
  const imageRequests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/uploads/'))
      imageRequests.push(new URL(r.url()).pathname);
  });
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download combined PDF' }).click();
  const download = await pending,
    file = await download.path();
  const pdf = await PDFDocument.load(readFileSync(file!));
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(18);
  const expectedImages = [
    ...new Set([...plan.map((q) => q.questionImage.url), ...plan.map((q) => q.answerImage!.url)]),
  ];
  expect(imageRequests).toEqual(expectedImages);
  await expect(page.getByRole('status')).toContainText('Combined PDF downloaded');
});

test('Page numbers, Previous/Next, URL reload, Back/Forward, filters and scroll position', async ({
  page,
  request,
}) => {
  const tax = await (await request.get('/api/taxonomy')).json();
  const topic = tax.topics.find((t: { name: string }) => t.name === 'TEST ONLY Momentum');
  await page.goto('/?semester=semester-1&page=2&chapter=' + topic.parentId);
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Chapter', { exact: true })).toHaveValue(topic.parentId);
  await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Showing 21–25 of 25 questions', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await expect(page.locator('.question-card')).toHaveCount(5);
  expect(
    await page.locator('.question-list-start').evaluate((el) => document.activeElement === el),
  ).toBe(true);
  expect((await page.locator('.question-list-start').boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await page.goBack();
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await page.getByLabel('Difficulty', { exact: true }).selectOption('hard');
  await expect(page.getByText('No questions match these filters')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('page')).toBe('1');
  await expect(page.getByRole('navigation', { name: 'Question pages', exact: true })).toHaveCount(
    0,
  );
  await page.goBack();
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('');
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await page.getByLabel('Search question ID or topic').fill('no-matching-question');
  await expect(page.getByText('No questions match these filters')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('page')).toBe('1');
});

test('Combined hierarchy filters persist between pages and search resets to the first matching result', async ({
  page,
  request,
}) => {
  const tax = await (await request.get('/api/taxonomy')).json();
  const topic = tax.topics.find((t: { name: string }) => t.name === 'TEST ONLY Momentum');
  const subtopic = tax.subtopics.find((t: { parentId: string }) => t.parentId === topic.id);
  await page.goto('/?semester=semester-1&page=4');
  await expect(page.getByText('Page 4 of 5', { exact: true })).toBeVisible();
  for (const [label, value] of [
    ['Chapter', topic.parentId],
    ['Topic', topic.id],
    ['Subtopic', subtopic.id],
    ['Difficulty', 'medium'],
  ]) {
    const pending = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/questions');
    await page.getByLabel(label, { exact: true }).selectOption(value);
    expect((await pending).status()).toBe(200);
    expect(new URL(page.url()).searchParams.get('page')).toBe('1');
  }
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Page 2', exact: true }).click();
  await expect(page.locator('.question-card')).toHaveCount(2);
  for (const [key, value] of Object.entries({
    curriculum: 'legacy-matriculation-physics',
    semester: 'semester-1',
    chapter: topic.parentId,
    topic: topic.id,
    subtopic: subtopic.id,
    difficulty: 'medium',
  }))
    expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  const id = (await page.locator('.question-card code').first().textContent())!;
  await page.getByLabel('Search question ID or topic').fill(id);
  await expect(page.locator('.question-card')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get('page')).toBe('1');
  await expect(page.locator('.question-card code')).toHaveText(id);
  await page.getByLabel('Semester', { exact: true }).selectOption('semester-2');
  await expect(page.getByText('No questions match these filters')).toBeVisible();
  for (const label of ['Chapter', 'Topic', 'Subtopic'])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue('');
});

test('Question-set review keeps global numbering and clamps after removing the only last-page entry', async ({
  page,
  request,
}) => {
  const rows: ImageQuestion[] = [];
  for (const index of [1, 2])
    rows.push(
      ...(await (await request.get('/api/questions?semester=semester-1&page=' + index)).json())
        .items,
    );
  const ids = rows
    .slice(0, 11)
    .map((q) => q.id)
    .join(',');
  await page.goto('/question-set?ids=' + ids + '&page=2');
  await expect(page.locator('.set-order li')).toHaveCount(1);
  await expect(page.locator('.set-order li')).toContainText('Question 11 / Answer 11');
  await page.route('**/uploads/**', (route) =>
    route.fulfill({ status: 503, body: 'TEST ONLY unavailable image' }),
  );
  await page.getByRole('button', { name: 'Download combined PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('An image is no longer available');
  await expect(page.locator('.set-order li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove Question 11', exact: true }).click();
  await expect(page.locator('.set-order li')).toHaveCount(10);
  expect(new URL(page.url()).searchParams.get('page')).toBe('1');
  await expect(
    page.getByRole('navigation', { name: 'Selected question pages', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download combined PDF' })).toBeEnabled();
  await page.goBack();
  await expect(page.locator('.set-order li')).toHaveCount(1);
  await expect(page.locator('.set-order li')).toContainText('Question 11 / Answer 11');
  expect(new URL(page.url()).searchParams.get('ids')).toBe(ids);
});

test('All boundaries, compact large-page navigation and clamping a shrinking last page', async ({
  page,
  request,
}) => {
  const sample: ImageQuestion = (await (await request.get('/api/questions')).json()).items[0];
  let count = 0,
    calls = 0;
  await page.route('**/api/questions?**', async (route) => {
    calls++;
    const requested = Number(new URL(route.request().url()).searchParams.get('page') || 1),
      info = questionPagination(count, requested);
    const items = Array.from(
      { length: Math.max(0, Math.min(10, count - (info.page - 1) * 10)) },
      (_, i) => ({ ...sample, id: 'TEST-' + ((info.page - 1) * 10 + i + 1) }),
    );
    await route.fulfill({ json: { ...info, items } });
  });
  for (count of [0, 1, 9, 10, 11, 20, 21, 100, 101, 1000]) {
    await page.goto('/');
    if (!count) await expect(page.getByText('No questions match these filters')).toBeVisible();
    else await expect(page.locator('.question-card')).toHaveCount(Math.min(count, 10));
    const nav = page.getByRole('navigation', { name: 'Question pages', exact: true });
    if (count <= 10) await expect(nav).toHaveCount(0);
    else {
      await expect(nav.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
      expect(await nav.getByRole('button').count()).toBeLessThanOrEqual(9);
      const pages = Math.ceil(count / 10);
      await nav.getByRole('button', { name: 'Page ' + pages, exact: true }).click();
      await expect(page.getByText(`Page ${pages} of ${pages}`, { exact: true })).toBeVisible();
      await expect(page.locator('.question-card')).toHaveCount(count % 10 || 10);
      await expect(nav.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
    }
  }
  count = 11;
  const before = calls;
  await page.reload();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('page')).toBe('2');
  expect(calls - before).toBe(1); // The clamped response is reused, not fetched twice.
  await expect(page.locator('.question-card')).toHaveCount(1);
});

test('Obsolete responses cannot overwrite rapid filter changes and errors stay separate from empty results', async ({
  page,
  request,
}) => {
  const actual: ImageQuestionList = await (await request.get('/api/questions')).json();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route('**/api/questions?**', async (route) => {
    const query = new URL(route.request().url()).searchParams;
    if (query.get('q') === 'slow') {
      await gate;
      await route.fulfill({ json: actual }).catch(() => {});
    } else if (query.get('q') === 'error') {
      await route.fulfill({ status: 503, json: { error: 'TEST ONLY request failed' } });
    } else if (query.get('q') === 'empty') {
      await route.fulfill({ json: { ...questionPagination(0), items: [] } });
    } else await route.fulfill({ json: actual });
  });
  await page.goto('/');
  await expect(page.locator('.question-card')).toHaveCount(10);
  const input = page.getByLabel('Search question ID or topic');
  await input.fill('slow');
  await expect(page.getByRole('status')).toContainText('Loading questions');
  await input.fill('empty');
  await expect(page.getByText('No questions match these filters')).toBeVisible();
  release();
  await expect(page.locator('.question-card')).toHaveCount(0);
  await input.fill('error');
  await expect(page.getByRole('alert')).toContainText('TEST ONLY request failed');
  await expect(page.getByText('No questions match these filters')).toHaveCount(0);
  await input.fill('');
  await expect(page.locator('.question-card')).toHaveCount(10);
});

test('Rapid Back/Forward navigation cancels pending pages without changing selections', async ({
  page,
  request,
}) => {
  const first: ImageQuestionList = await (await request.get('/api/questions?page=1')).json(),
    second: ImageQuestionList = await (await request.get('/api/questions?page=2')).json();
  let release!: () => void,
    staleResponses = 0;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route('**/api/questions?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('page') === '2') {
      await gate;
      await route.fulfill({ json: second }).catch(() => {});
      staleResponses++;
    } else await route.fulfill({ json: first });
  });
  await page.goto('/');
  await expect(page.locator('.question-card')).toHaveCount(10);
  const selected = (await page.locator('.question-card code').first().textContent())!;
  await page.getByRole('checkbox', { name: 'Select ' + selected, exact: true }).check();
  await page.getByRole('button', { name: 'Page 2', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Loading questions');
  await page.goBack();
  await expect(page.locator('.question-card')).toHaveCount(10);
  await page.goForward();
  await expect(page.getByRole('status')).toContainText('Loading questions');
  await page.goBack();
  release();
  await expect.poll(() => staleResponses).toBeGreaterThan(0);
  await expect(page.getByText('Page 1 of 5', { exact: true })).toBeVisible();
  expect(await page.locator('.question-card code').allTextContents()).toEqual(
    first.items.map((q) => q.id),
  );
  await expect(
    page.getByRole('checkbox', { name: 'Select ' + selected, exact: true }),
  ).toBeChecked();
});

for (const [name, width, height] of [
  ['desktop', 1440, 900],
  ['ipad-portrait', 768, 1024],
  ['ipad-landscape', 1024, 768],
  ['android-tablet', 800, 1280],
  ['iphone', 390, 844],
  ['android-phone', 360, 800],
] as const)
  test(`Pagination is accessible and fits ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?semester=semester-1');
    const nav = page.getByRole('navigation', { name: 'Question pages', exact: true });
    await expect(nav).toBeVisible();
    await nav.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const button of await nav.getByRole('button').all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await nav.getByRole('button', { name: 'Page 2', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Page 2 of 5', { exact: true })).toBeVisible();
    await page.screenshot({ path: `data/pagination/${name}.png`, fullPage: true });
    await page
      .locator('.question-pagination')
      .screenshot({ path: `data/pagination/${name}-controls.png` });
    if (name === 'iphone') {
      await installAxe(page);
      const issues = await page.evaluate(async () => {
        const result = await (
          window as unknown as { axe: { run: () => Promise<{ violations: { impact: string }[] }> } }
        ).axe.run();
        return result.violations.filter((v) => ['critical', 'serious'].includes(v.impact));
      });
      expect(issues).toEqual([]);
    }
  });
