import type { ImageQuestion, ImageQuestionList } from '../../shared/image-question.js';
import { studentCode, studentEmail } from '../student-fixture.js';
import { imageFile } from '../image-fixture.js';
import { test, expect } from './admin-fixture.js';

test('A held question keeps both previews and cannot be exported from an open student selection', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const list: ImageQuestionList = await request
    .get('/api/questions?status=approved&limit=1')
    .then((response) => response.json());
  const original = list.items[0];
  const students = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const login = await students.request.post('/api/student-auth/login', {
      headers: { Origin: baseURL!, 'X-Question-Bank-Request': '1' },
      data: { email: studentEmail, code: studentCode },
    });
    expect(login.status()).toBe(200);
    const session = await students.request
      .get('/api/auth/session')
      .then((response) => response.json());
    expect(session.user.role).toBe('student');
    const published = await students.request.get('/api/questions/' + original.id + '?answers=true');
    expect(published.status()).toBe(200);
    const savedSelection = { items: [await published.json()] };
    const student = await students.newPage();
    // Leave the actual export recheck on the server and conserve the suite's shared print quota.
    await student.route(
      '**/api/public/question-set?*',
      (route) => route.fulfill({ json: savedSelection }),
      { times: 1 },
    );
    await student.goto('/question-set?ids=' + original.id);
    const download = student.getByRole('button', { name: 'Download combined PDF' });
    await expect(download).toBeEnabled();
    await page.goto('/edit/' + original.id);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Move to Unassigned Questions' }).click();
    await expect(
      page.getByRole('heading', { name: 'Unassigned Questions', exact: true }),
    ).toBeVisible();
    const card = page.locator('article').filter({ hasText: original.id });
    await expect(card).toBeVisible();
    await expect(card.getByAltText('Question picture preview')).toHaveJSProperty('complete', true);
    await expect(card.getByAltText('Answer picture preview')).toHaveJSProperty('complete', true);
    for (const image of await card.locator('img').all()) {
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
    }
    await expect(page.getByText('Showing 1–1 of 1 questions')).toBeVisible();
    await download.click();
    await expect(student.getByRole('alert')).toContainText('no longer available');
    await expect(download).toBeDisabled();
    await student.goto('/admin/unassigned');
    await expect(student.getByRole('heading', { name: 'Admin login' })).toBeVisible();
    await expect(student.getByRole('link', { name: 'Unassigned Questions' })).toHaveCount(0);
    await student.goto('/?q=' + original.id);
    await expect(
      student.getByRole('heading', { name: 'No questions match these filters' }),
    ).toBeVisible();
    await card.getByRole('button', { name: 'Reassign' }).click();
    await card.getByLabel('Chapter', { exact: true }).selectOption(original.chapterId);
    await card.getByLabel('Topic', { exact: true }).selectOption(original.topicId);
    if (original.subtopicId)
      await card.getByLabel('Subtopic (Optional)').selectOption(original.subtopicId);
    await card.getByRole('button', { name: 'Save assignment' }).click();
    await expect(page.getByText('No unassigned questions match these filters.')).toBeVisible();
    await student.goto('/?q=' + original.id);
    await expect(student.locator('.question-card').filter({ hasText: original.id })).toBeVisible();
    const restored: ImageQuestion = await request
      .get('/api/questions/' + original.id)
      .then((response) => response.json());
    expect(restored.questionImage).toEqual(original.questionImage);
    expect(restored.status).toBe(original.status);
    expect(restored.updatedAt).toBe(original.updatedAt);
  } finally {
    await students.close();
    const current: ImageQuestion = await request
      .get('/api/questions/' + original.id)
      .then((response) => response.json());
    if (current.unassigned) {
      const { curriculumVersionId, semesterId, chapterId, topicId, subtopicId } = original;
      const response = await request.patch('/api/admin/unassigned/' + original.id, {
        data: {
          expectedRevision: current.revision,
          confirmed: true,
          mapping: { curriculumVersionId, semesterId, chapterId, topicId, subtopicId },
        },
      });
      expect(response.status()).toBe(200);
    }
  }
});

test('Topic relocation previews both chapters and subtopic count before confirmation', async ({
  page,
  request,
}) => {
  const add = async (kind: string, name: string, parentId: string) => {
    const response = await request.post('/api/taxonomy/' + kind, {
      data: { name, parentId, isTest: true },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).id as string;
  };
  const origin = await add('chapters', 'TEST ONLY Relocation Origin', 'semester-1');
  const destination = await add('chapters', 'TEST ONLY Relocation Destination', 'semester-1');
  const topic = await add('topics', 'TEST ONLY Relocation Topic', origin);
  await add('subtopics', 'TEST ONLY Relocation Subtopic', topic);
  await page.goto('/curriculum');
  await page.getByLabel('Curriculum record').selectOption(topic);
  const move = page.getByLabel('Move to parent'),
    save = page.getByRole('button', { name: 'Save curriculum change' });
  await move.selectOption(destination);
  await expect(page.getByText(/Original chapter .*Relocation Origin/)).toBeVisible();
  await expect(page.getByText(/Destination chapter .*Relocation Destination/)).toBeVisible();
  await expect(page.getByText('0 affected questions and 1 affected subtopic.')).toBeVisible();
  await expect(save).toBeDisabled();
  await page.getByLabel('Curriculum change note').fill('TEST ONLY move');
  await page.getByLabel('I reviewed the impact on current browsing and linked questions.').check();
  await save.click();
  await expect
    .poll(async () => {
      const taxonomy = await request.get('/api/taxonomy').then((response) => response.json());
      return taxonomy.topics.find((record: { id: string }) => record.id === topic)?.parentId;
    })
    .toBe(destination);
});

test('Retired records leave open student selectors and stay available through the admin toggle', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const add = async (kind: string, name: string, parentId: string) => {
    const response = await request.post('/api/taxonomy/' + kind, {
      data: { name, parentId, isTest: true },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).id as string;
  };
  const chapterName = 'TEST ONLY Retirement Chapter';
  const topicName = 'TEST ONLY Retirement Topic';
  const subtopicName = 'TEST ONLY Retirement Subtopic';
  const chapter = await add('chapters', chapterName, 'semester-1');
  const topic = await add('topics', topicName, chapter);
  await add('subtopics', subtopicName, topic);
  const students = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const login = await students.request.post('/api/student-auth/login', {
      headers: { Origin: baseURL!, 'X-Question-Bank-Request': '1' },
      data: { email: studentEmail, code: studentCode },
    });
    expect(login.status()).toBe(200);
    const student = await students.newPage();
    await student.goto('/?semester=semester-1&chapter=' + chapter + '&topic=' + topic);
    await expect(student.getByLabel('Topic', { exact: true })).toHaveValue(topic);
    await expect(student.getByRole('option', { name: subtopicName })).toHaveCount(1);

    await page.goto('/curriculum');
    const toggle = page.getByRole('checkbox', { name: 'Show retired records' });
    await expect(toggle).not.toBeChecked();
    const record = page.getByLabel('Curriculum record');
    const status = page.getByLabel('Curriculum item status');
    const note = page.getByLabel('Curriculum change note');
    const save = page.getByRole('button', { name: 'Save curriculum change' });
    await record.selectOption(topic);
    await status.selectOption('retired');
    await note.fill('TEST ONLY retire');
    await save.click();
    const option = record.locator(`option[value="${topic}"]`);
    await expect(option).toHaveCount(0);

    await student.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(student.getByRole('option', { name: topicName })).toHaveCount(0);
    await expect(student.getByRole('option', { name: subtopicName })).toHaveCount(0);
    await expect(student).not.toHaveURL(new RegExp(topic));
    await student.goto('/curriculum');
    await expect(student.getByRole('heading', { name: chapterName })).toBeVisible();
    await expect(student.getByRole('listitem').filter({ hasText: topicName })).toHaveCount(0);

    const editor = await page.context().newPage();
    try {
      await editor.goto('/edit/new');
      await editor.getByLabel('Syllabus Version').selectOption('legacy-matriculation-physics');
      await editor.getByLabel('Semester', { exact: true }).selectOption('semester-1');
      await editor.getByLabel('Chapter', { exact: true }).selectOption(chapter);
      await expect(editor.getByRole('option', { name: topicName })).toHaveCount(0);
    } finally {
      await editor.close();
    }

    await toggle.check();
    await expect(option).toHaveCount(1);
    await record.selectOption(topic);
    await expect(status).toHaveValue('retired');
    await status.selectOption('active');
    const corrected = topicName + ' corrected';
    await page.getByLabel('Edited name').fill(corrected);
    await note.fill('TEST ONLY restore and rename');
    await save.click();
    await expect(option).toContainText(corrected);
    await toggle.uncheck();
    await expect(option).toHaveCount(1);
    await student.reload();
    await expect(student.getByRole('listitem').filter({ hasText: corrected })).toBeVisible();
  } finally {
    await students.close();
  }
});

test('Topic retirement offers and confirms transfer of current questions to the holding area', async ({
  page,
  request,
}) => {
  const tax = await request.get('/api/taxonomy').then((response) => response.json());
  const chapterId = tax.chapters.find(
    (chapter: { parentId: string }) => chapter.parentId === 'semester-1',
  ).id;
  const response = await request.post('/api/taxonomy/topics', {
    data: { name: 'TEST ONLY Topic Transfer', parentId: chapterId, isTest: true },
  });
  expect(response.status()).toBe(201);
  const topicId = (await response.json()).id;
  const image = await imageFile();
  const saved = await request.post('/api/questions', {
    multipart: {
      metadata: JSON.stringify({
        curriculumVersionId: 'legacy-matriculation-physics',
        semesterId: 'semester-1',
        chapterId,
        topicId,
        difficultyId: 'medium',
        totalMarks: 5,
      }),
      question: { name: 'question.png', mimeType: 'image/png', buffer: image.buffer },
      answer: { name: 'answer.png', mimeType: 'image/png', buffer: image.buffer },
    },
  });
  expect(saved.status()).toBe(201);
  const { question } = await saved.json();
  await page.goto('/curriculum');
  await page.getByLabel('Curriculum record').selectOption(topicId);
  await page.getByLabel('Curriculum item status').selectOption('retired');
  await page.getByLabel('Curriculum change note').fill('TEST ONLY transfer');
  await page.getByLabel('I reviewed the impact on current browsing and linked questions.').check();
  const save = page.getByRole('button', { name: 'Save curriculum change' });
  const transfer = page.getByRole('checkbox', {
    name: /Move 1 assigned question to Unassigned Questions/,
  });
  await expect(transfer).toBeVisible();
  await expect(save).toBeDisabled();
  await transfer.check();
  await save.click();
  await expect(
    page.getByLabel('Curriculum record').locator(`option[value="${topicId}"]`),
  ).toHaveCount(0);
  await page.goto('/admin/unassigned?q=' + question.id);
  const card = page.locator('article').filter({ hasText: question.id });
  await expect(card).toBeVisible();
  await expect(card.getByAltText('Question picture preview')).toHaveAttribute(
    'src',
    question.questionImage.url,
  );
  await expect(card.getByAltText('Answer picture preview')).toHaveAttribute(
    'src',
    question.answerImage.url,
  );
});
