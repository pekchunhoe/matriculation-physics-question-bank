import type { Page, Locator } from '@playwright/test';
import { installAxe } from './accessibility.js';
import type { CurriculumDocument } from '../../shared/curriculum.js';
import { test, expect } from './curriculum-presentation-fixture.js';

const stored = <T extends { order: number }>(items: T[]) =>
  [...items].sort((a, b) => a.order - b.order);

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
async function accessible(page: Page) {
  await installAxe(page);
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as { axe: { run: () => Promise<{ violations: { id: string }[] }> } }
    ).axe;
    return (await axe.run()).violations.map((violation) => violation.id);
  });
  expect(violations).toEqual([]);
}
async function chapterGroups(panel: Locator, semester: CurriculumDocument['semesters'][number]) {
  const chapters = stored(semester.chapters);
  await expect(panel.locator('.topic-chapter > legend')).toHaveText(
    chapters.map((chapter) => chapter.name),
  );
  for (const [index, chapter] of chapters.entries()) {
    await expect(panel.locator('.topic-chapter').nth(index).locator('label')).toHaveText(
      stored(chapter.topics).map((topic) => topic.name),
    );
  }
}

test('public current hierarchy contains 2 semesters / 18 chapters / 82 topics and keyboard-accessible history', async ({
  page,
  curriculumFixture,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/curriculum');
  const current = page.getByRole('region', { name: 'Current Curriculum', exact: true });
  await expect(current.getByRole('heading', { level: 3 })).toHaveText(
    curriculumFixture.document.curriculumVersion.name,
  );
  await expect(current.getByRole('heading', { level: 4 })).toHaveText(['Semester 1', 'Semester 2']);
  await expect(current.getByRole('heading', { level: 5 })).toHaveCount(18);
  await expect(current.locator('li')).toHaveCount(82);
  for (const [index, semester] of stored(curriculumFixture.document.semesters).entries()) {
    await expect(current.locator('.curriculum-semester').nth(index).locator('h5')).toHaveText(
      stored(semester.chapters).map((chapter) => chapter.name),
    );
    for (const [chapterIndex, chapter] of stored(semester.chapters).entries()) {
      await expect(
        current
          .locator('.curriculum-semester')
          .nth(index)
          .locator('.tree-level')
          .nth(chapterIndex)
          .locator('li'),
      ).toHaveText(stored(chapter.topics).map((topic) => topic.name));
    }
  }
  const history = page.locator('.curriculum-history');
  await expect(history).not.toHaveAttribute('open', '');
  await expect(history.locator('h3')).not.toBeVisible();
  await expect(current).not.toContainText('Existing curriculum (unversioned)');
  await expect(page.locator('main')).not.toContainText('curriculum-physics-2022-2023');
  await expect(page.locator('main')).not.toContainText('semester-physics-2022-2023');
  await noOverflow(page);
  await accessible(page);
  await page.screenshot({ path: test.info().outputPath('curriculum-desktop.png') });
  await history.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(history.getByRole('heading', { level: 3 })).toHaveText(
    'Existing curriculum (unversioned)',
  );
  await expect(history).toContainText('LEGACY · Retired');
  await expect(history.getByRole('heading', { level: 4 })).toHaveText(['Semester 1', 'Semester 2']);
  await history.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('curriculum-history-desktop.png') });
  await accessible(page);
});

test('public curriculum and historical disclosure remain readable and accessible on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/curriculum');
  await expect(
    page.getByRole('region', { name: 'Current Curriculum', exact: true }).locator('li'),
  ).toHaveCount(82);
  await noOverflow(page);
  await accessible(page);
  await page.screenshot({ path: test.info().outputPath('curriculum-mobile.png') });
  await page.locator('.curriculum-history summary').click();
  await expect(page.locator('.curriculum-history h3')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: test.info().outputPath('curriculum-history-mobile.png') });
});

test.describe('draft visibility', () => {
  test.use({ curriculumState: 'draft' });
  test('anonymous APIs and pages omit the draft while the existing admin editor retains it', async ({
    page,
    request,
    curriculumFixture,
    browser,
  }) => {
    for (const path of ['/api/taxonomy', '/api/curriculum-versions']) {
      const response = await request.get(path);
      expect(response.ok()).toBe(true);
      const text = await response.text();
      expect(text).not.toContain(curriculumFixture.document.curriculumVersion.id);
      expect(text).not.toContain('PHYSICS-2022-2023');
      expect(text).not.toContain(curriculumFixture.document.semesters[0].chapters[0].topics[0].id);
    }
    const exported = await request.get(
      '/api/curriculum-versions/curriculum-physics-2022-2023/export',
    );
    expect([401, 403, 404]).toContain(exported.status());
    await page.goto('/curriculum');
    await expect(
      page.getByRole('region', { name: 'Current Curriculum', exact: true }),
    ).toContainText('Existing curriculum (unversioned)');
    await expect(page.locator('main')).not.toContainText('Session 2022/2023');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Question bank', exact: true })).toBeVisible();
    await expect(page.locator('.topic-options input')).toHaveCount(0);
    const context = await browser.newContext({ baseURL: curriculumFixture.origin });
    try {
      const [name, value] = curriculumFixture.adminCookie.split('=');
      await context.addCookies([{ name, value, url: curriculumFixture.origin }]);
      const admin = await context.newPage();
      await admin.goto('/curriculum');
      await expect(
        admin.getByRole('heading', { name: 'Curriculum versions', exact: true }),
      ).toBeVisible();
      await admin
        .getByLabel('Curriculum version to manage')
        .selectOption(curriculumFixture.document.curriculumVersion.id!);
      await expect(admin.getByLabel('Version status', { exact: true })).toHaveValue('draft');
      await expect(admin.getByLabel('Version name', { exact: true })).toHaveValue(
        curriculumFixture.document.curriculumVersion.name,
      );
      await expect(
        admin.getByRole('heading', { name: 'Current hierarchy', exact: true }).locator('..'),
      ).toContainText('PHYSICS-2022-2023');
      await admin.getByLabel('Edit record type').selectOption('topics');
      await expect(
        admin.getByLabel('Curriculum record', { exact: true }).locator('option'),
      ).toHaveCount(83);
    } finally {
      await context.close();
    }
  });
});

test('zero-question topic filters group all semesters and switch between the 36-topic and 46-topic hierarchies', async ({
  page,
  curriculumFixture,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/');
  const panel = page.locator('.topic-options');
  await expect(panel.locator('.topic-semester > legend')).toHaveText(['Semester 1', 'Semester 2']);
  await expect(panel.getByRole('checkbox')).toHaveCount(82);
  for (const [index, semester] of curriculumFixture.document.semesters.entries()) {
    await chapterGroups(panel.locator('.topic-semester').nth(index), semester);
    await page.getByLabel('Semester', { exact: true }).selectOption(semester.id!);
    await chapterGroups(panel, semester);
    await expect(panel.getByRole('checkbox')).toHaveCount(index === 0 ? 36 : 46);
    await expect(
      page.getByRole('heading', { name: 'Your question bank is ready for content' }),
    ).toBeVisible();
    await page.getByLabel('Semester', { exact: true }).selectOption('');
  }
  await page
    .getByLabel('Semester', { exact: true })
    .selectOption(curriculumFixture.document.semesters[1].id!);
  await noOverflow(page);
  await accessible(page);
  await page.screenshot({ path: test.info().outputPath('topic-filter-desktop.png') });
  await page.locator('#filters').evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: test.info().outputPath('topic-groups-desktop.png') });
});

test.describe('stored ordering contradicts display numbering', () => {
  test.use({ reordered: true });
  test('semester, chapter and topic order come from stored fields rather than names', async ({
    page,
    curriculumFixture,
  }) => {
    await page.goto('/');
    const semesters = stored(curriculumFixture.document.semesters);
    const panel = page.locator('.topic-options');
    await expect(panel.locator('.topic-semester > legend')).toHaveText(
      semesters.map((semester) => semester.name),
    );
    for (const [index, semester] of semesters.entries())
      await chapterGroups(panel.locator('.topic-semester').nth(index), semester);
    await page.goto('/curriculum');
    const current = page.getByRole('region', { name: 'Current Curriculum', exact: true });
    await expect(current.locator('h4')).toHaveText(semesters.map((semester) => semester.name));
    for (const [index, semester] of semesters.entries()) {
      await expect(current.locator('.curriculum-semester').nth(index).locator('h5')).toHaveText(
        stored(semester.chapters).map((chapter) => chapter.name),
      );
      await expect(
        current
          .locator('.curriculum-semester')
          .nth(index)
          .locator('.tree-level')
          .first()
          .locator('li'),
      ).toHaveText(stored(stored(semester.chapters)[0].topics).map((topic) => topic.name));
    }
  });
});

test.describe('positive question filtering', () => {
  test.use({ fixtureQuestions: true });
  test('stable topic IDs and difficulty filter results survive reload and back navigation', async ({
    page,
    curriculumFixture,
  }) => {
    await page.goto('/');
    const [first, second] = curriculumFixture.document.semesters;
    const topic = first.chapters[0].topics[0];
    await page.getByLabel('Semester', { exact: true }).selectOption(first.id!);
    await page
      .locator('.topic-options')
      .getByRole('checkbox', { name: topic.name, exact: true })
      .check();
    await page.getByLabel('Difficulty', { exact: true }).selectOption('hard');
    await expect(page.locator('.question-card')).toHaveCount(1);
    await expect(page.locator('.question-card')).toContainText('TEST-PRESENTATION-S1-HARD');
    const query = new URL(page.url()).searchParams;
    expect(query.get('semester')).toBe(first.id);
    expect(query.get('topic')).toBe(topic.id);
    expect(query.get('difficulty')).toBe('hard');
    await page.reload();
    await expect(
      page.locator('.topic-options').getByRole('checkbox', { name: topic.name, exact: true }),
    ).toBeChecked();
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
    await expect(page.locator('.question-card')).toHaveCount(1);
    await page.goto('/curriculum');
    await page.goBack();
    await expect(page.getByLabel('Semester', { exact: true })).toHaveValue(first.id!);
    await expect(
      page.locator('.topic-options').getByRole('checkbox', { name: topic.name, exact: true }),
    ).toBeChecked();
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
    await expect(page.locator('.question-card')).toHaveCount(1);
    await page.goForward();
    await expect(
      page.getByRole('heading', { name: 'Courses, semesters and topics', exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel('Semester', { exact: true })).toHaveValue(first.id!);
    await expect(
      page.locator('.topic-options').getByRole('checkbox', { name: topic.name, exact: true }),
    ).toBeChecked();
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
    await expect(page.locator('.question-card')).toHaveCount(1);
    await page.getByLabel('Semester', { exact: true }).selectOption(second.id!);
    await expect(page.locator('.topic-options input:checked')).toHaveCount(0);
    await page
      .locator('.topic-options')
      .getByRole('checkbox', { name: second.chapters[0].topics[0].name, exact: true })
      .check();
    await expect(page.locator('.question-card')).toHaveCount(1);
    await expect(page.locator('.question-card')).toContainText('TEST-PRESENTATION-S2-HARD');
  });
});

test('mobile filters wrap long SP025 labels, retain selections and open/close accessibly', async ({
  page,
  curriculumFixture,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close filters', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  const semester = curriculumFixture.document.semesters[1];
  await page.getByLabel('Semester', { exact: true }).selectOption(semester.id!);
  await chapterGroups(page.locator('.topic-options'), semester);
  const longest = semester.chapters
    .flatMap((chapter) => chapter.topics)
    .sort((a, b) => b.name.length - a.name.length)[0];
  await page
    .locator('.topic-options')
    .getByRole('checkbox', { name: longest.name, exact: true })
    .check();
  await page.getByLabel('Difficulty', { exact: true }).selectOption('hard');
  await noOverflow(page);
  await accessible(page);
  await page
    .locator('.topic-options')
    .getByRole('checkbox', { name: longest.name, exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('topic-filter-mobile.png') });
  await page.getByRole('button', { name: 'Close filters', exact: true }).click();
  await expect(page.locator('#filters')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByLabel('Semester', { exact: true })).toHaveValue(semester.id!);
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
  await expect(
    page.locator('.topic-options').getByRole('checkbox', { name: longest.name, exact: true }),
  ).toBeChecked();
  await noOverflow(page);
});
