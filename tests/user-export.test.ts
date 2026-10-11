import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { SaxesParser } from 'saxes';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { exportFixture } from './export-fixture.js';
import { exportPlan, exportFilename, groupHeadings } from '../shared/export-plan.js';
import { createWordExport } from '../src/word-export.js';
import { latexToOmml } from '../src/word-math.js';
import { MasterPrint } from '../src/MasterPrint.js';
const noImages = async () => {
  throw new Error('Unexpected image request');
};
function validXml(xml: string) {
  new SaxesParser({ xmlns: true }).write(xml).close();
}

test('canonical semester/chapter/topic ordering contradicts alphabetic and click order', () => {
  const { tax, items, question } = exportFixture();
  const plan = exportPlan([question('S2', 't-s2'), ...items], tax);
  assert.deepEqual(
    plan.map((q) => q.id),
    ['A', 'B', 'C', 'D', 'S2'],
  );
  assert.deepEqual(
    plan.map((q) => q.displayNumber),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(plan[0].positions, [0, 1, 1, -1]);
  assert.equal(plan[0].chapter.id, 'c1');
});
test('no subtopic comes first, then explicit subtopic order, then stable question ID', () => {
  const { tax, question } = exportFixture();
  const plan = exportPlan(
    [
      question('z', 't11', 'st1'),
      question('x', 't11', 'st2'),
      question('b', 't11'),
      question('a', 't11'),
      question('c', 't11', 'st1'),
    ],
    tax,
  );
  assert.deepEqual(
    plan.map((q) => q.id),
    ['a', 'b', 'c', 'z', 'x'],
  );
});
test('permuting click order cannot change syllabus numbering and does not mutate original data', () => {
  const { tax, items } = exportFixture(),
    before = structuredClone(items);
  assert.deepEqual(exportPlan(items, tax), exportPlan([...items].reverse(), tax));
  assert.deepEqual(items, before);
  assert.deepEqual(
    exportPlan([items[2]], tax).map((q) => q.displayNumber),
    [1],
  );
  assert.deepEqual(
    exportPlan(
      items.filter((q) => q.id !== 'B'),
      tax,
    ).map((q) => [q.id, q.displayNumber]),
    [
      ['A', 1],
      ['C', 2],
      ['D', 3],
    ],
  );
});
test('duplicate or missing curriculum references block export without invented taxonomy', () => {
  const { tax, items } = exportFixture();
  assert.throws(() => exportPlan([items[0], items[0]], tax), /unique/);
  items[0].document.question.subtopicId = 'nonexistent';
  assert.throws(() => exportPlan(items, tax), /unavailable curriculum/);
});
test('equal curriculum positions use stable node IDs, retaining each hierarchy group together', () => {
  const { tax, items } = exportFixture();
  tax.topics.forEach((t) => (t.order = 0));
  assert.deepEqual(
    exportPlan(items, tax).map((q) => q.id),
    ['A', 'B', 'C', 'D'],
  );
});
test('group headings appear only when entering canonical groups', () => {
  const { tax, question } = exportFixture();
  const plan = exportPlan(
    [question('a', 't11'), question('b', 't11'), question('c', 't11', 'st1')],
    tax,
  );
  assert.equal(groupHeadings(plan[0]).length, 3);
  assert.deepEqual(groupHeadings(plan[1], plan[0]), []);
  assert.deepEqual(groupHeadings(plan[2], plan[1]), ['Z Subtopic first']);
});
for (const format of ['pdf', 'docx'] as const)
  for (const mode of ['question', 'answer'] as const)
    test(`${format} ${mode}: identical shared sorting/numbering and strict educational mode`, async () => {
      const { tax, items } = exportFixture(),
        plan = exportPlan(items, tax);
      const output =
        format === 'docx'
          ? strFromU8(
              unzipSync(await createWordExport(plan, mode, tax, noImages))['word/document.xml'],
            )
          : plan
              .map((item, i) =>
                renderToStaticMarkup(
                  createElement(MasterPrint, {
                    item,
                    tax,
                    answer: mode === 'answer',
                    hints: true,
                    groups: groupHeadings(item, plan[i - 1]),
                  }),
                ),
              )
              .join('');
      let previous = -1;
      for (const item of plan) {
        const start = output.indexOf('Question ' + item.displayNumber, previous + 1);
        assert.ok(start > previous);
        previous = start;
        assert.ok(output.includes((mode === 'question' ? 'STEM ' : 'ANSWER ') + item.id));
      }
      assert.ok(!output.includes('PRIVATE NOTE'));
      assert.ok(!output.includes('SOURCE-'));
      if (mode === 'question')
        for (const secret of ['ANSWER ', 'REASON ', 'FINAL ', 'HINT ', 'JU1'])
          assert.ok(!output.includes(secret), secret);
      else {
        assert.ok(output.includes('STEP HINT'));
        assert.ok(output.includes('GENERAL HINT'));
        assert.ok(output.includes('JU1'));
        assert.ok(!output.includes('STEM '));
      }
      assert.equal(
        exportFilename(plan, mode, format),
        `matriculation-physics-semester-1-${mode === 'question' ? 'questions' : 'answer-scheme'}.${format}`,
      );
    });
test('neutral filenames for a selection spanning semesters', () => {
  const { tax, items, question } = exportFixture();
  assert.equal(
    exportFilename(exportPlan([...items, question('s2', 't-s2')], tax), 'question', 'docx'),
    'matriculation-physics-questions.docx',
  );
});
test('DOCX is a namespace-valid OOXML ZIP with native equations, A4, compact paragraphs and no page-per-question breaks', async () => {
  const { tax, items } = exportFixture(),
    files = unzipSync(await createWordExport(exportPlan(items, tax), 'answer', tax, noImages));
  for (const name of [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/_rels/document.xml.rels',
    'word/styles.xml',
    'word/settings.xml',
    'word/footer1.xml',
  ]) {
    assert.ok(files[name]);
    validXml(strFromU8(files[name]));
  }
  const doc = strFromU8(files['word/document.xml']);
  assert.ok(doc.includes('<m:f>'));
  assert.ok(doc.includes('<m:acc>'));
  assert.ok(doc.includes('<m:sSub>'));
  assert.ok(doc.includes('w:w="11906" w:h="16838"'));
  assert.ok(!doc.includes('pageBreakBefore'));
  assert.ok(!doc.includes('w:type="page"'));
  assert.ok(!doc.includes('TargetMode="External"'));
});
test('empty Word export is blocked', async () => {
  const { tax } = exportFixture();
  await assert.rejects(createWordExport([], 'question', tax, noImages), /Select at least one/);
});
test('Word image bytes and aspect ratio are preserved with internal-only relationships; answer assets excluded from Question', async () => {
  const { tax, items } = exportFixture(),
    doc = items[0].document;
  const make = (id: string, kind: 'physics_diagram' | 'fbd') => ({
    id,
    kind,
    partId: null,
    url: '/uploads/' + id + '.png',
    alt: id,
    mime: 'image/png' as const,
    order: 0,
  });
  doc.assets = [make('question-image', 'physics_diagram'), make('answer-image', 'fbd')];
  doc.question.blocks = [{ type: 'image', assetId: 'question-image' }];
  doc.solutions[0].steps[0].blocks = [
    { type: 'image', assetId: 'answer-image' },
    { type: 'math', latex: 'F=ma' },
  ];
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    seen: string[] = [];
  for (const mode of ['question', 'answer'] as const) {
    const files = unzipSync(
      await createWordExport(exportPlan([items[0]], tax), mode, tax, async (a) => {
        seen.push(a.id);
        return { bytes, mime: a.mime, width: 400, height: 200 };
      }),
    );
    const docXml = strFromU8(files['word/document.xml']);
    assert.ok(docXml.includes(mode === 'question' ? 'question-image' : 'answer-image'));
    assert.ok(!docXml.includes(mode === 'question' ? 'answer-image' : 'question-image'));
    assert.deepEqual(files['word/media/image1.png'], bytes);
    assert.ok(!strFromU8(files['word/_rels/document.xml.rels']).includes('/uploads/'));
  }
  assert.deepEqual(seen, ['question-image', 'answer-image']);
});
test('private or external storage URLs cannot be fetched by Word exporter', async () => {
  const { tax, items } = exportFixture();
  const doc = items[0].document;
  doc.assets = [
    {
      id: 'bad',
      partId: null,
      kind: 'physics_diagram',
      url: 'https://private.example.invalid/asset.png',
      alt: 'bad',
      mime: 'image/png',
      order: 0,
    },
  ];
  doc.question.blocks = [{ type: 'image', assetId: 'bad' }];
  await assert.rejects(
    createWordExport(exportPlan([items[0]], tax), 'question', tax, noImages),
    /approved asset delivery/,
  );
});

for (const mime of ['image/svg+xml', 'image/webp'] as const)
  test(`Word preserves original ${mime} bytes with a PNG compatibility representation`, async () => {
    const { tax, items } = exportFixture();
    items[0].document.assets = [
      {
        id: 'image',
        partId: null,
        kind: 'physics_diagram',
        url: '/uploads/image.' + (mime === 'image/webp' ? 'webp' : 'svg'),
        alt: 'Original visual',
        mime,
        order: 0,
      },
    ];
    items[0].document.question.blocks = [{ type: 'image', assetId: 'image' }];
    const bytes = new Uint8Array([1, 2, 3]),
      preview = new Uint8Array([4, 5, 6]);
    const files = unzipSync(
      await createWordExport(exportPlan([items[0]], tax), 'question', tax, async () => ({
        bytes,
        preview,
        mime,
        width: 200,
        height: 100,
      })),
    );
    assert.deepEqual(files['word/media/image1.' + (mime === 'image/webp' ? 'webp' : 'svg')], bytes);
    assert.deepEqual(files['word/media/preview1.png'], preview);
    assert.ok(strFromU8(files['word/document.xml']).includes('r:embed="preview1"'));
    if (mime === 'image/svg+xml')
      assert.ok(strFromU8(files['word/document.xml']).includes('asvg:svgBlip'));
  });
test('repeated original visuals reuse media but receive unique DrawingML IDs', async () => {
  const { tax, items } = exportFixture();
  items[0].document.assets = [
    {
      id: 'image',
      partId: null,
      kind: 'physics_diagram',
      url: '/uploads/image.png',
      alt: 'Image',
      mime: 'image/png',
      order: 0,
    },
  ];
  items[0].document.question.blocks = [
    { type: 'image', assetId: 'image' },
    { type: 'image', assetId: 'image' },
  ];
  const files = unzipSync(
    await createWordExport(exportPlan([items[0]], tax), 'question', tax, async () => ({
      bytes: new Uint8Array([1]),
      width: 200,
      height: 100,
      mime: 'image/png',
    })),
  );
  assert.equal(Object.keys(files).filter((p) => p.startsWith('word/media/')).length, 1);
  const xml = strFromU8(files['word/document.xml']);
  assert.ok(xml.includes('<wp:docPr id="1"'));
  assert.ok(xml.includes('<wp:docPr id="2"'));
});
for (const [name, latex, tag] of [
  ['fraction', String.raw`F_c=\frac{mv^2}{r}`, 'f'],
  ['superscript', String.raw`x^{-2}`, 'sSup'],
  ['subscript', String.raw`N_{\mathrm{top}}`, 'sSub'],
  ['combined scripts', String.raw`x_i^2`, 'sSubSup'],
  ['square root', String.raw`\sqrt{x}`, 'rad'],
  ['root index', String.raw`\sqrt[3]{x}`, 'rad'],
  ['Greek', String.raw`\alpha+\beta+\pi`, 'r'],
  ['vector', String.raw`\vec{F}`, 'acc'],
  ['brackets', String.raw`\left(\frac{x}{y}\right)`, 'd'],
  ['degrees', String.raw`30^{\circ}`, 'sSup'],
  ['units', String.raw`v=3.0\,\mathrm{m\,s^{-1}}`, 'sSup'],
  ['alignment', String.raw`\begin{aligned}F&=ma\\v&=u+at\end{aligned}`, 'eqArr'],
  ['matrix', String.raw`\begin{bmatrix}1&2\\3&4\end{bmatrix}`, 'm'],
  ['boxed answer', String.raw`\boxed{F=ma}`, 'borderBox'],
] as const)
  test(`editable Word math: ${name}`, () => {
    const xml = latexToOmml(latex, true);
    assert.ok(xml.includes('<m:' + tag));
    validXml(
      `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${xml}</w:p>`,
    );
  });
for (const latex of [
  String.raw`\cancel{x}`,
  String.raw`\phantom{x}`,
  String.raw`\color{red}{x}`,
  String.raw`\frac{1}{`,
])
  test(`unsupported or invalid Word math fails explicitly: ${latex}`, () => {
    assert.throws(() => latexToOmml(latex), /Word cannot safely export/);
  });
