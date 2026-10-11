import { test, expect, layoutCases } from './master-fidelity-fixture.js';
import { mkdirSync, readFileSync } from 'node:fs';
import type { QuestionPackage } from '../../shared/question-import.js';
import type { Taxonomy } from '../../shared/schema.js';

for (const name of layoutCases)
  test(`A4 Master layout: ${name}`, async ({ page, masterFixture }) => {
    await page.goto(`/question-set?ids=${masterFixture.ids[name]}&answers=true&hints=true`);
    await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();
    await expect(page.locator('.master-question')).toHaveAttribute('data-question-number', '1');
    await expect(page.locator('.master-answer')).toHaveAttribute('data-question-number', '1');
    await expect(page.locator('.master-answer .step-hint').first()).toBeVisible();
    const text = await page.locator('.print-set').innerText();
    for (const excluded of [
      'SP015',
      'SP025',
      'SET A',
      'SET B',
      '2026/2027',
      'Student working space',
      'Question 5',
      'SYNTHETIC-',
    ])
      expect(text).not.toContain(excluded);
    expect(text).toContain(
      'DIFFICULTY: ' + (name === 'easy' ? 'EASY' : name === 'hard' ? 'HARD' : 'MEDIUM'),
    );
    expect(text).toContain('Total: 5 marks');
    const answer = page.locator('.master-answer');
    await expect(answer.locator('.marking-code')).toHaveCount(name === 'no-code' ? 0 : 5);
    await expect(page.locator('.master-question img')).toHaveCount(
      ['no-diagram', 'long-solution', 'no-code', 'answer-only-fbd'].includes(name) ? 0 : 1,
    );
    await expect(answer.locator('img')).toHaveCount(
      ['no-diagram', 'long-solution', 'no-code', 'question-diagram'].includes(name)
        ? 0
        : name === 'one-fbd'
          ? 1
          : 2,
    );
    if (name === 'nested') await expect(page.locator('.master-question')).toContainText('(b)(ii)');
    if (name === 'multiple-fbds') {
      await expect(answer.locator('[data-step-id="step-2"] .step-hint')).toHaveCount(2);
      await expect(answer.locator('[data-step-id="step-2"] img')).toHaveCount(1);
      await expect(answer.locator('[data-step-id="step-4"] img')).toHaveCount(1);
    }
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode()));
    });
    const overflow = await page
      .locator('.master-paper .katex-display')
      .evaluateAll((nodes) => nodes.filter((n) => n.scrollWidth > n.clientWidth + 2).length);
    expect(overflow).toBe(0);
    mkdirSync('data/master-fidelity/pdf', { recursive: true });
    await page.pdf({
      path: `data/master-fidelity/pdf/${name}.pdf`,
      preferCSSPageSize: true,
      printBackground: true,
    });
  });

test('shared numbering updates both sections immediately after reorder and removal', async ({
  page,
  masterFixture,
}) => {
  const ids = ['no-diagram', 'one-fbd', 'nested'].map((n) => masterFixture.ids[n]);
  await page.goto(`/question-set?ids=${ids.join(',')}&answers=true&hints=true`);
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();
  const mapping = async (selector: string) =>
    page
      .locator(selector)
      .evaluateAll((nodes) =>
        nodes.map((n) => [
          n.getAttribute('data-question-id'),
          n.getAttribute('data-question-number'),
        ]),
      );
  expect(await mapping('.master-question')).toEqual(ids.map((id, i) => [id, String(i + 1)]));
  await page.getByRole('button', { name: 'Move Question 3 up' }).click();
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();
  await page.getByRole('button', { name: 'Move Question 2 up' }).click();
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();
  const reordered = [ids[2], ids[0], ids[1]];
  expect(await mapping('.master-question')).toEqual(reordered.map((id, i) => [id, String(i + 1)]));
  expect(await mapping('.master-answer')).toEqual(await mapping('.master-question'));
  await page.getByRole('button', { name: 'Remove Question 2' }).click();
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();
  expect(await mapping('.master-question')).toEqual([
    [ids[2], '1'],
    [ids[1], '2'],
  ]);
  expect(await mapping('.master-answer')).toEqual(await mapping('.master-question'));
});
test('Master set diagrams, equations and answer controls fit a mobile viewport', async ({
  page,
  masterFixture,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/question-set?ids=${masterFixture.ids['multiple-fbds']}&answers=true&hints=true`,
  );
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .locator('.master-paper img')
      .evaluateAll((images) =>
        images.every(
          (img) =>
            img.getBoundingClientRect().right <=
            img.closest('.master-paper')!.getBoundingClientRect().right,
        ),
      ),
  ).toBe(true);
});
test('question-only export excludes answer FBDs, codes and every hint, including stale hints option', async ({
  page,
  request,
  masterFixture,
}) => {
  const id = masterFixture.ids['multiple-fbds'];
  await page.goto(`/question-set?ids=${id}&answers=false&hints=true`);
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();
  await expect(page.locator('.master-answer')).toHaveCount(0);
  await expect(page.locator('.print-set .marking-code, .print-set .step-hint')).toHaveCount(0);
  await expect(page.locator('.print-set img')).toHaveCount(1);
  const body = await (
    await request.get(`/api/public/question-set?ids=${id}&answers=false&hints=true`)
  ).json();
  expect(body.items[0].document.hints).toEqual([]);
  expect(body.items[0].document.solutions).toEqual([]);
  expect(body.items[0].document.assets).toHaveLength(1);
  const calls: string[] = [];
  page.on('request', (r) => calls.push(r.url()));
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole('button', { name: 'Print / Save as PDF' }).click();
  expect(calls.filter((url) => /openai|anthropic|imagegen|\/api\//i.test(url))).toEqual([]);
  await page.pdf({ path: 'data/master-fidelity/pdf/question-only.pdf', preferCSSPageSize: true });
});
test('admin importer preview shows first-class codes and ordered hints inside their targeted steps', async ({
  page,
  request,
  masterFixture,
}) => {
  await page.context().addCookies([
    {
      name: 'qb_admin',
      value: masterFixture.cookie.slice('qb_admin='.length),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  const tax: Taxonomy = await (await request.get('/api/taxonomy')).json();
  const doc: QuestionPackage = JSON.parse(
    readFileSync('examples/question-import/GOLDEN_QUESTION_IMPORT_REFERENCE.json', 'utf8'),
  );
  const topic = tax.topics.find((t) => t.name === 'TEST ONLY Momentum')!;
  const chapter = tax.chapters.find((t) => t.id === topic.parentId)!;
  const semester = tax.semesters.find((t) => t.id === chapter.parentId)!;
  doc.classification = {
    curriculumVersionCode: tax.curriculumVersions!.find(
      (v) => v.id === semester.curriculumVersionId,
    )!.code,
    semester: 'Semester 1',
    chapter: chapter.name,
    topic: topic.name,
    subtopic: null,
  };
  await page.goto('/import/question-json');
  await page.getByLabel('Paste Question JSON').fill(JSON.stringify(doc));
  await page.getByLabel('Difficulty', { exact: true }).selectOption('Medium');
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.locator('.answer-scheme .marking-code')).toHaveCount(5);
  await expect(
    page.locator('.answer-scheme .solution-step').nth(1).locator('.step-hint'),
  ).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Import as Draft' })).toBeDisabled();
  await page.screenshot({ path: 'data/master-fidelity/admin-preview.png', fullPage: true });
});
