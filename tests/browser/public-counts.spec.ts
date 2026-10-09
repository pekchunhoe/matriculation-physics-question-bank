import { test, expect } from './curriculum-presentation-fixture.js';

test.use({ curriculumState: 'draft' });

test('anonymous counts omit every draft hierarchy ID while a real isolated admin retains all 82 topics', async ({
  request,
  curriculumFixture,
}) => {
  const doc = curriculumFixture.document;
  const ids = [
    doc.curriculumVersion.id!,
    ...doc.semesters.flatMap((semester) => [
      semester.id!,
      ...semester.chapters.flatMap((chapter) => [
        chapter.id!,
        ...chapter.topics.map((topic) => topic.id!),
      ]),
    ]),
  ];
  expect(ids).toHaveLength(103);
  for (const path of [
    '/api/counts',
    '/api/counts?course=matriculation-physics',
    '/api/taxonomy',
    '/api/curriculum-versions',
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const serialized = await response.text();
    for (const id of ids) expect(serialized).not.toContain(id);
    if (path.startsWith('/api/counts')) expect(JSON.parse(serialized)).toHaveLength(2);
  }
  const admin = await request.get('/api/counts', {
    headers: { Cookie: curriculumFixture.adminCookie },
  });
  expect(admin.status()).toBe(200);
  const rows = await admin.json();
  expect(rows).toHaveLength(84);
  for (const topic of doc.semesters.flatMap((semester) =>
    semester.chapters.flatMap((chapter) => chapter.topics),
  )) {
    expect(rows.some((row: { topic_id: string }) => row.topic_id === topic.id)).toBe(true);
  }
});

test('the public browser works with only eligible zero counts on desktop and mobile', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1280, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const counts = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/counts',
    );
    await page.goto('/');
    expect(await (await counts).json()).toHaveLength(2);
    if (viewport.width === 390)
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByLabel('Semester', { exact: true }).selectOption('semester-1');
    await page.getByLabel('Difficulty', { exact: true }).selectOption('hard');
    await expect(page.locator('.topic-options input')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Your question bank is ready for content', exact: true }),
    ).toBeVisible();
    await page.reload();
    if (viewport.width === 390)
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await expect(page.getByLabel('Semester', { exact: true })).toHaveValue('semester-1');
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
    await page.getByLabel('Semester', { exact: true }).selectOption('semester-2');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (viewport.width === 390) {
      await page.getByRole('button', { name: 'Close filters', exact: true }).click();
      await expect(page.locator('#filters')).not.toBeVisible();
    }
  }
});
