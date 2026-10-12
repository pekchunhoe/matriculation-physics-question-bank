import { test, expect } from './admin-fixture.js';
import { imageFile } from '../image-fixture.js';

test('Exactly two uploads and required mapping save one persistent draft; publish and archive explicitly', async ({
  page,
  request,
}) => {
  const tax = await (await request.get('/api/taxonomy')).json();
  const topic = tax.topics.find((t: { name: string }) => t.name === 'TEST ONLY Momentum'),
    chapter = tax.chapters.find((c: { id: string }) => c.id === topic.parentId),
    subtopic = tax.subtopics.find((s: { parentId: string }) => s.parentId === topic.id);
  await page.goto('/edit/new');
  await expect(page.locator('input[type=file]')).toHaveCount(2);
  await expect(page.locator('main select')).toHaveCount(6);
  await expect(page.locator('main input[type=number]')).toHaveCount(1);
  for (const [label, value] of [
    ['Syllabus Version', 'legacy-matriculation-physics'],
    ['Semester', 'semester-1'],
    ['Chapter', chapter.id],
    ['Topic', topic.id],
    ['Subtopic', subtopic.id],
    ['Difficulty', 'medium'],
  ])
    await page.getByLabel(label, { exact: true }).selectOption(value);
  await page.getByLabel('Total Marks').fill('7');
  const q = await imageFile('TEST ONLY BROWSER QUESTION'),
    a = await imageFile('TEST ONLY BROWSER ANSWER', 750);
  await page
    .getByLabel('Question Picture', { exact: true })
    .setInputFiles({ name: 'question.png', mimeType: q.mimetype, buffer: q.buffer });
  await page
    .getByLabel('Answer Picture', { exact: true })
    .setInputFiles({ name: 'answer.png', mimeType: a.mimetype, buffer: a.buffer });
  await expect(page.getByAltText('Question picture preview')).toBeVisible();
  await page.getByRole('button', { name: 'Save Question', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved draft question');
  const id = page.url().split('/').pop()!;
  await page.reload();
  await expect(page.getByLabel('Total Marks')).toHaveValue('7');
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('medium');
  await expect(page.getByAltText('Answer picture preview')).toBeVisible();
  await page.getByLabel('Total Marks').fill('8');
  await page.getByRole('button', { name: 'Save Question', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(id);
  expect(page.url().endsWith(id)).toBe(true);
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Publish Question', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('now approved');
  await expect(page.getByLabel('Confirm replacement of the published question')).toBeVisible();
  await page.getByRole('button', { name: 'Archive Question', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('now retired');
});
test('Failed save shows an error without success or premature navigation', async ({
  page,
  request,
}) => {
  const rows = (await (await request.get('/api/questions?limit=1')).json()).items,
    id = rows[0].id;
  await page.goto('/edit/' + id);
  await expect(page.getByLabel('Total Marks')).toHaveValue('5');
  await page.getByLabel('Confirm replacement of the published question').check();
  await page.route('**/api/questions/' + id, (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'TEST ONLY durable save failed' }),
        })
      : route.continue(),
  );
  await page.getByRole('button', { name: 'Save Question', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('durable save failed');
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(page.url().endsWith(id)).toBe(true);
});
test('Missing existing question cannot accidentally become a new question', async ({ page }) => {
  await page.goto('/edit/does-not-exist');
  await expect(page.getByRole('alert')).toContainText('not found');
  await expect(page.getByRole('button', { name: 'Save Question', exact: true })).toBeDisabled();
});
test('Administrators create an authoritative subtopic under the selected topic', async ({
  page,
  request,
}) => {
  const tax = await (await request.get('/api/taxonomy')).json(),
    topic = tax.topics.find((t: { name: string }) => t.name === 'TEST ONLY Dynamics');
  await page.goto('/curriculum');
  const panel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Add a curriculum record', exact: true }) });
  await panel.getByLabel('Record type', { exact: true }).selectOption('subtopics');
  await panel.getByLabel('Parent topics', { exact: true }).selectOption(topic.id);
  await panel.getByLabel('Name', { exact: true }).fill('TEST ONLY Admin supplied subtopic');
  await panel.getByRole('button').click();
  await expect(panel.getByRole('status')).toContainText('added');
  const after = await (await request.get('/api/taxonomy')).json();
  expect(
    after.subtopics.find((s: { name: string }) => s.name === 'TEST ONLY Admin supplied subtopic')
      .parentId,
  ).toBe(topic.id);
});
