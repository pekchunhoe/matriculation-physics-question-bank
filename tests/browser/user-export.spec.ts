import { test, expect } from './master-fidelity-fixture.js';
import { mkdirSync, readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { installAxe } from './accessibility.js';
const root = 'data/user-export/artifacts';

test('a long hint starts on the available first page and continues naturally', async ({
  page,
  masterFixture,
}) => {
  await page.goto('/question-set?document=answer&ids=' + masterFixture.ids['long-hint']);
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
  mkdirSync(root, { recursive: true });
  const path = root + '/long-hint-answer.pdf';
  await page.pdf({ path, preferCSSPageSize: true, printBackground: true });
  const step = page.locator('.master-step').first();
  await expect(step).toHaveClass(/oversized-step/);
  expect(await step.evaluate((n) => getComputedStyle(n).breakInside)).toBe('auto');
});

test('Word Question embeds only the unchanged original question diagram', async ({
  page,
  request,
  masterFixture,
}) => {
  const id = masterFixture.ids['multiple-fbds'];
  await page.goto('/question-set?ids=' + id);
  await page.getByLabel('Export format', { exact: true }).selectOption('docx');
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  mkdirSync(root, { recursive: true });
  const path = root + '/diagram-question.docx';
  await (await pending).saveAs(path);
  const files = unzipSync(readFileSync(path));
  expect(Object.keys(files).filter((p) => p.startsWith('word/media/'))).toHaveLength(1);
  const doc = await masterFixture.bank.document(id),
    asset = doc.assets.find((a) => a.kind === 'physics_diagram')!;
  expect(files['word/media/image1.png']).toEqual(
    new Uint8Array(await (await request.get(asset.url)).body()),
  );
  const xml = strFromU8(files['word/document.xml']);
  expect(xml).not.toContain('JU1');
  expect(xml).not.toContain('Student hint:');
  expect(xml).not.toContain('answer-fbd');
});

for (const format of ['pdf', 'docx'] as const)
  for (const mode of ['question', 'answer'] as const)
    test(`syllabus sorting and mode isolation: ${format} ${mode}`, async ({
      page,
      masterFixture,
    }) => {
      const names = ['order-D', 'order-A', 'order-C', 'order-B'];
      await page.goto('/question-set?ids=' + names.map((n) => masterFixture.ids[n]).join(','));
      await page.getByLabel('Export format', { exact: true }).selectOption(format);
      await page.getByLabel('Document', { exact: true }).selectOption(mode);
      const button = page.getByRole('button', { name: 'Export', exact: true });
      await expect(button).toBeEnabled();
      const expected = ['order-A', 'order-B', 'order-C', 'order-D'].map((n, i) => [
        masterFixture.ids[n],
        String(i + 1),
      ]);
      expect(
        await page
          .locator('.master-paper')
          .evaluateAll((nodes) =>
            nodes.map((n) => [
              n.getAttribute('data-question-id'),
              n.getAttribute('data-question-number'),
            ]),
          ),
      ).toEqual(expected);
      const text = await page.locator('.print-set').innerText();
      expect(text).not.toContain('PRIVATE NOTE');
      expect(text).not.toContain('EXPORT-');
      if (mode === 'question') {
        expect(text).not.toContain('ANSWER ');
        expect(text).not.toContain('HINT ');
        expect(text).not.toContain('JU1');
      } else {
        expect(text).not.toContain('STEM ');
        expect(text).toContain('HINT order-A');
        expect(text).toContain('JU1');
      }
      mkdirSync(root, { recursive: true });
      const calls: string[] = [];
      page.on('request', (r) => calls.push(r.url()));
      if (format === 'docx') {
        const pending = page.waitForEvent('download');
        await button.click();
        const download = await pending;
        expect(download.suggestedFilename()).toBe(
          `matriculation-physics-semester-1-${mode === 'question' ? 'questions' : 'answer-scheme'}.docx`,
        );
        const path = `${root}/matrix-${mode}.docx`;
        await download.saveAs(path);
        const files = unzipSync(readFileSync(path)),
          xml = strFromU8(files['word/document.xml']);
        expect(xml).not.toContain('PRIVATE NOTE');
        expect(xml).not.toContain('w:type="page"');
        let previous = -1;
        for (const name of ['order-A', 'order-B', 'order-C', 'order-D']) {
          const position = xml.indexOf((mode === 'question' ? 'STEM ' : 'ANSWER ') + name);
          expect(position).toBeGreaterThan(previous);
          previous = position;
        }
        expect(xml).toContain(mode === 'question' ? 'STEM order-A' : 'HINT order-A');
        if (mode === 'question') {
          expect(xml).not.toContain('HINT ');
          expect(xml).not.toContain('JU1');
        } else expect(xml).toContain('<m:f>');
      } else {
        await page.evaluate(() => {
          window.print = () => {
            (window as unknown as { exportTitle: string }).exportTitle = document.title;
          };
        });
        await button.click();
        await expect(page.getByRole('status')).toHaveText(
          'Print dialog opened. Choose Save as PDF.',
        );
        expect(
          await page.evaluate(() => (window as unknown as { exportTitle: string }).exportTitle),
        ).toBe(
          `matriculation-physics-semester-1-${mode === 'question' ? 'questions' : 'answer-scheme'}`,
        );
        await page.pdf({
          path: `${root}/matrix-${mode}.pdf`,
          preferCSSPageSize: true,
          printBackground: true,
        });
      }
      expect(calls.every((url) => new URL(url).origin === masterFixture.origin)).toBe(true);
    });

for (const mode of ['question', 'answer'] as const)
  test(`several short ${mode} items flow compactly and DOCX has no forced page breaks`, async ({
    page,
    masterFixture,
  }) => {
    await page.goto(
      '/question-set?ids=' +
        Array.from({ length: 5 }, (_, i) => masterFixture.ids['short-' + i])
          .reverse()
          .join(',') +
        '&document=' +
        mode,
    );
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    await expect(page.locator('.master-paper')).toHaveCount(5);
    const before = await page
      .locator('.master-paper')
      .evaluateAll((nodes) =>
        nodes.map((n) => [
          n.getAttribute('data-question-id'),
          n.getAttribute('data-question-number'),
        ]),
      );
    expect(before.map((x) => x[1])).toEqual(['1', '2', '3', '4', '5']);
    await page.emulateMedia({ media: 'print' });
    expect(
      await page
        .locator('.master-paper')
        .evaluateAll((nodes) =>
          nodes.every(
            (n) =>
              getComputedStyle(n).breakBefore !== 'page' && getComputedStyle(n).minHeight === '0px',
          ),
        ),
    ).toBe(true);
    mkdirSync(root, { recursive: true });
    await page.pdf({ path: `${root}/compact-${mode}.pdf`, preferCSSPageSize: true });
    await page.emulateMedia({ media: 'screen' });
    await page.getByLabel('Export format', { exact: true }).selectOption('docx');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await (await pending).saveAs(`${root}/compact-${mode}.docx`);
    await page.getByRole('button', { name: 'Remove Question 3', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    expect(
      await page
        .locator('.master-paper')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-question-number'))),
    ).toEqual(['1', '2', '3', '4']);
  });

test('subtopics follow canonical positions with no-subtopic questions first', async ({
  page,
  masterFixture,
}) => {
  const expected = ['sub-none', 'sub-first', 'sub-second'];
  await page.goto(
    '/question-set?ids=' +
      [...expected]
        .reverse()
        .map((n) => masterFixture.ids[n])
        .join(','),
  );
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  expect(
    await page
      .locator('.master-paper')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-question-id'))),
  ).toEqual(expected.map((n) => masterFixture.ids[n]));
  const headings = await page.locator('.export-group').allTextContents();
  expect(headings.indexOf('TEST Z First Subtopic')).toBeLessThan(
    headings.indexOf('TEST A Second Subtopic'),
  );
});
test('empty selection disables export and removal of the last question produces no file', async ({
  page,
  masterFixture,
}) => {
  await page.goto('/question-set');
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  await expect(page.getByText('Select at least one question to export.')).toBeVisible();
  await page.goto('/question-set?ids=' + masterFixture.ids['order-A']);
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Remove Question 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  await expect(page.locator('.master-paper')).toHaveCount(0);
});
test('Word blocks unsupported equations visibly and offers the PDF format without a partial download', async ({
  page,
  masterFixture,
}) => {
  await page.goto('/question-set?ids=' + masterFixture.ids.unsupported);
  await page.getByLabel('Export format', { exact: true }).selectOption('docx');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Choose PDF');
  await page.getByLabel('Export format', { exact: true }).selectOption('pdf');
  // Changing format clears a Word-specific failure so PDF can be tried immediately.
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
});
test('export rechecks public eligibility and rejects a question retired after preview', async ({
  page,
  masterFixture,
}) => {
  const id = masterFixture.ids['order-A'];
  await page.goto('/question-set?ids=' + id);
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  await masterFixture.bank.run("UPDATE questions SET status='retired' WHERE id=?", id);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Question not found');
});
for (const name of ['multiple-fbds', 'long-solution', 'long-hint', 'no-parts', 'nested'] as const)
  test(`Word original visuals, editable equations and natural flow: ${name}`, async ({
    page,
    masterFixture,
  }) => {
    await page.goto('/question-set?ids=' + masterFixture.ids[name] + '&document=answer');
    await page.getByLabel('Export format', { exact: true }).selectOption('docx');
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    mkdirSync(root, { recursive: true });
    const path = `${root}/${name}-answer.docx`;
    await (await pending).saveAs(path);
    const files = unzipSync(readFileSync(path)),
      xml = strFromU8(files['word/document.xml']);
    expect(xml).toContain('<m:oMath');
    expect(xml).toContain('Student hint');
    expect(xml).not.toContain('w:type="page"');
    expect(xml).not.toContain('SYNTHETIC-');
    const rels = strFromU8(files['word/_rels/document.xml.rels']);
    expect(rels).not.toContain('https://');
    expect(rels).not.toContain('/uploads/');
    if (name !== 'long-solution')
      expect(Object.keys(files).filter((n) => n.startsWith('word/media/'))).toHaveLength(2);
  });
for (const [width, height] of [
  [390, 844],
  [1280, 1000],
])
  test(`export controls fit and support keyboard selection at ${width}x${height}`, async ({
    page,
    masterFixture,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/question-set?ids=' + masterFixture.ids['multiple-fbds']);
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    const format = page.getByLabel('Export format', { exact: true });
    await expect(format).toHaveValue('pdf');
    await format.focus();
    await page.keyboard.press('ArrowDown');
    await expect(format).toHaveValue('docx');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Document', { exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByLabel('Document', { exact: true })).toHaveValue('answer');
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await installAxe(page);
    expect(
      await page.evaluate(
        async () =>
          (
            await (
              window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }
            ).axe.run()
          ).violations,
      ),
    ).toEqual([]);
    await page.screenshot({ path: `data/user-export/controls-${width}.png`, fullPage: true });
  });
