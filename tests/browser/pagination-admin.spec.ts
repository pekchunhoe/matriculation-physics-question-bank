import { test, expect } from './admin-fixture.js';
import { imageFile } from '../image-fixture.js';

test('Administrator draft/review queues paginate and recover when a status change removes the last page', async ({
  page,
  request,
}) => {
  await page.goto('/?status=draft&q=test-pagination-&page=2');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  const id = (await page.locator('.question-card code').textContent())!;
  const original = await (await request.get('/api/questions/' + id)).json();
  const changed = await request.patch('/api/questions/' + id + '/status', {
    data: { status: 'reviewing', expectedRevision: original.revision, confirmed: true },
  });
  expect(changed.status()).toBe(200);
  await page.reload();
  await expect(page.locator('.question-card')).toHaveCount(10);
  expect(new URL(page.url()).searchParams.get('page')).toBe('1');
  await expect(page.getByRole('navigation', { name: 'Question pages', exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel('Status', { exact: true }).selectOption('reviewing');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await expect(page.locator('.question-card code')).toHaveText(id);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Total Marks')).toHaveValue('5');
  await page.getByLabel('Total Marks').fill('6');
  await page.getByRole('button', { name: 'Save Question', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
  const after = await (await request.get('/api/questions/' + id)).json();
  expect(after.questionImage).toEqual(original.questionImage);
  expect(after.answerImage).toEqual(original.answerImage);
  expect((await request.delete('/api/questions/' + id)).status()).toBe(409);
});

test('Legacy archive uses ten-record pages and clamps after a new paired upload converts the last record', async ({
  page,
  request,
}) => {
  await page.goto('/admin/legacy');
  await expect(page.locator('main article')).toHaveCount(10);
  await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Page 3', exact: true }).click();
  await expect(page.locator('main article')).toHaveCount(1);
  const id = (await page.locator('main article code').textContent())!;
  const before = await (await request.get('/api/admin/legacy-questions/' + id)).json();
  const tax = await (await request.get('/api/taxonomy')).json();
  const topic = tax.topics.find((t: { name: string }) => t.name === 'TEST ONLY Momentum');
  const question = await imageFile('TEST ONLY LEGACY QUESTION'),
    answer = await imageFile('TEST ONLY LEGACY ANSWER');
  const response = await request.post('/api/questions', {
    multipart: {
      metadata: JSON.stringify({
        legacyId: id,
        curriculumVersionId: 'legacy-matriculation-physics',
        semesterId: 'semester-1',
        chapterId: topic.parentId,
        topicId: topic.id,
        subtopicId: null,
        difficultyId: 'medium',
        totalMarks: 5,
      }),
      question: { name: 'question.png', mimeType: question.mimetype, buffer: question.buffer },
      answer: { name: 'answer.png', mimeType: answer.mimetype, buffer: answer.buffer },
    },
  });
  expect(response.status()).toBe(201);
  await page.reload();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await expect(page.locator('main article')).toHaveCount(10);
  expect(new URL(page.url()).searchParams.get('page')).toBe('2');
  expect(await (await request.get('/api/admin/legacy-questions/' + id)).json()).toEqual(before);
  await page.goBack();
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
});
