import { zipSync, strToU8 } from 'fflate';
import { assetKeyFromReference } from '../shared/asset-reference';
import { exportContent, type ExportNode } from '../shared/export-content';
import { exportGroups, type ExportMode, type ExportPlanItem } from '../shared/export-plan';
import type { Asset, Taxonomy } from '../shared/schema';
import { latexToOmml, xmlText } from './word-math';

export type ExportImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
  mime: string;
  preview?: Uint8Array;
};
export type ImageLoader = (asset: Asset) => Promise<ExportImage>;
const wns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const mns = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const rns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const run = (text: string, bold = false) =>
  `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xmlText(text)}</w:t></w:r>`;
function inline(text: string) {
  return text
    .split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g)
    .map((s) =>
      s.startsWith('$')
        ? latexToOmml(s.slice(s.startsWith('$$') ? 2 : 1, s.startsWith('$$') ? -2 : -1))
        : run(s),
    )
    .join('');
}
function paragraph(body: string, style = 'Normal', keep = false, center = false) {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${keep ? '<w:keepNext/>' : ''}${center ? '<w:jc w:val="center"/>' : ''}</w:pPr>${body}</w:p>`;
}
/** Browser-compatible OOXML package; only embedded media relationships, never remote URLs. */
export async function createWordExport(
  plan: readonly ExportPlanItem[],
  mode: ExportMode,
  tax: Taxonomy,
  loadImage: ImageLoader,
): Promise<Uint8Array> {
  if (!plan.length) throw new Error('Select at least one question to export.');
  const content = plan.map((q) => exportContent(q.document, mode));
  // Fail unsupported equations before fetching any images or offering a partial document.
  const check = (nodes: ExportNode[]) => {
    for (const n of nodes) {
      if (n.type === 'math') latexToOmml(n.latex, true);
      else if (n.type === 'prose') inline(n.text);
      else if (n.type === 'image') n.equations.forEach((s) => latexToOmml(s, true));
      else check(n.nodes);
    }
  };
  content.forEach(check);
  const entries: Record<string, Uint8Array> = {};
  const relations: string[] = [];
  const types = new Map<string, string>();
  let drawing = 0;
  let media = 0,
    totalBytes = 0;
  const images = new Map<string, Promise<string>>();
  const image = async (asset: Asset, keep: boolean) => {
    if (!assetKeyFromReference(asset.url))
      throw new Error('Export images must use the approved asset delivery route.');
    const key = asset.url;
    if (!images.has(key))
      images.set(
        key,
        (async () => {
          const result = await loadImage(asset);
          if (
            result.mime !== asset.mime ||
            !Number.isFinite(result.width) ||
            !Number.isFinite(result.height) ||
            result.width <= 0 ||
            result.height <= 0 ||
            result.bytes.length > 3 * 1024 * 1024
          )
            throw new Error('An export image has invalid dimensions, MIME or size.');
          totalBytes += result.bytes.length + (result.preview?.length ?? 0);
          if (totalBytes > 64 * 1024 * 1024)
            throw new Error('Word images exceed 64 MiB. Export a smaller selection.');
          const index = ++media,
            originalExt = (
              {
                'image/png': 'png',
                'image/jpeg': 'jpg',
                'image/svg+xml': 'svg',
                'image/webp': 'webp',
              } as Record<string, string>
            )[result.mime];
          if (!originalExt) throw new Error('Unsupported Word image type. Choose PDF.');
          types.set(originalExt, result.mime);
          const original = `media/image${index}.${originalExt}`;
          entries['word/' + original] = result.bytes;
          const originalId = `original${index}`;
          relations.push(
            `<Relationship Id="${originalId}" Type="${rns}/image" Target="${original}"/>`,
          );
          let id = originalId;
          if (result.mime === 'image/svg+xml' || result.mime === 'image/webp') {
            if (!result.preview)
              throw new Error(
                'This image needs a device-rendered PNG preview for Word. Choose PDF.',
              );
            entries[`word/media/preview${index}.png`] = result.preview;
            types.set('png', 'image/png');
            id = `preview${index}`;
            relations.push(
              `<Relationship Id="${id}" Type="${rns}/image" Target="media/preview${index}.png"/>`,
            );
          }
          const scale = Math.min(
            1,
            590 / result.width,
            mode === 'answer' ? 220 / result.height : 350 / result.height,
          );
          const cx = Math.round(result.width * scale * 9525),
            cy = Math.round(result.height * scale * 9525);
          const svg =
            result.mime === 'image/svg+xml'
              ? `<a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${originalId}"/></a:ext></a:extLst>`
              : '';
          return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${index}" name="Diagram ${index}" descr="${xmlText(asset.alt)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${index}" name="Diagram ${index}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}">${svg}</a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
        })(),
      );
    const drawingId = ++drawing;
    const drawingXml = (await images.get(key)!).replace(
      /(<(?:wp:docPr|pic:cNvPr) id=")[0-9]+/g,
      '$1' + drawingId,
    );
    return paragraph(drawingXml, 'Normal', keep, true);
  };
  const nodes = async (list: ExportNode[]): Promise<string> => {
    let xml = '';
    for (const n of list) {
      if (n.type === 'prose')
        xml += paragraph(
          inline(n.text),
          n.style === 'total'
            ? 'Total'
            : n.style === 'hint'
              ? 'Hint'
              : n.style === 'part'
                ? 'Heading3'
                : 'Normal',
          Boolean(n.keepNext),
        );
      else if (n.type === 'math') xml += paragraph(latexToOmml(n.latex, true));
      else if (n.type === 'step')
        xml +=
          paragraph(
            run(`Step ${n.number}${n.part ? ' ' + n.part : ''}`, true) +
              run(
                `    ${n.code ? n.code + ' | ' : ''}${n.marks} ${n.marks === 1 ? 'mark' : 'marks'}`,
              ),
            'Heading3',
            true,
          ) + (await nodes(n.nodes));
      else {
        const caption = n.asset.importMetadata?.caption ?? n.asset.alt;
        xml += await image(n.asset, Boolean(caption || n.equations.length));
        if (caption)
          xml += paragraph(inline(caption), 'Caption', Boolean(n.equations.length), true);
        for (const [i, latex] of n.equations.entries())
          xml += paragraph(latexToOmml(latex, true), 'Normal', i < n.equations.length - 1);
      }
    }
    return xml;
  };
  let body = paragraph(
    run(mode === 'answer' ? "Answer Scheme with Student's Hints" : 'Questions', true),
    'Title',
    true,
  );
  for (const [i, item] of plan.entries()) {
    for (const group of exportGroups(item, plan[i - 1]))
      body += paragraph(
        run(group.label, true),
        { semester: 'Heading1', chapter: 'Heading1', topic: 'Heading2', subtopic: 'Heading3' }[
          group.level
        ],
        true,
      );
    const difficulty = tax.difficulties.find(
      (d) => d.id === item.document.question.difficultyId,
    )?.name;
    if (!difficulty)
      throw new Error('A selected question has unavailable difficulty. Refresh your selection.');
    body += paragraph(run(`Question ${item.displayNumber}`, true), 'QuestionHeading', true);
    body += paragraph(
      run(
        `${item.topic.name} · ${item.document.question.totalMarks} marks    DIFFICULTY: ${difficulty.toUpperCase()}`,
      ),
      'Metadata',
      true,
    );
    body += await nodes(content[i]);
  }
  const sect =
    '<w:sectPr><w:footerReference w:type="default" r:id="footer"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="907" w:right="1077" w:bottom="1020" w:left="1077" w:header="400" w:footer="500"/></w:sectPr>';
  const xml = (name: string, value: string) => {
    entries[name] = strToU8(declaration + value);
  };
  xml(
    'word/document.xml',
    `<w:document xmlns:w="${wns}" xmlns:m="${mns}" xmlns:r="${rns}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}${sect}</w:body></w:document>`,
  );
  const styles = [
    ['Title', 30, 120],
    ['Heading1', 26, 100],
    ['Heading2', 24, 80],
    ['Heading3', 22, 60],
    ['QuestionHeading', 28, 140],
    ['Metadata', 19, 60],
    ['Hint', 20, 60],
    ['Caption', 18, 40],
    ['Total', 22, 100],
  ]
    .map(
      ([id, size, before]) =>
        `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="${before}" w:after="60"/>${['Title', 'Heading1', 'Heading2', 'Heading3', 'QuestionHeading'].includes(String(id)) ? '<w:keepNext/><w:keepLines/>' : ''}${id === 'Total' ? '<w:jc w:val="right"/>' : ''}</w:pPr><w:rPr><w:sz w:val="${size}"/>${String(id).includes('Heading') || id === 'Title' ? '<w:b/>' : ''}<w:color w:val="000000"/></w:rPr></w:style>`,
    )
    .join('');
  xml(
    'word/styles.xml',
    `<w:styles xmlns:w="${wns}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="240" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${styles}</w:styles>`,
  );
  xml(
    'word/settings.xml',
    `<w:settings xmlns:w="${wns}" xmlns:m="${mns}"><w:updateFields w:val="true"/><m:mathPr><m:mathFont m:val="Cambria Math"/><m:brkBin m:val="before"/></m:mathPr></w:settings>`,
  );
  xml(
    'word/footer1.xml',
    `<w:ftr xmlns:w="${wns}">${paragraph(run('Matriculation Physics · Page ') + '<w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple>' + run(' of ') + '<w:fldSimple w:instr="NUMPAGES"><w:r><w:t>1</w:t></w:r></w:fldSimple>', 'Caption')}</w:ftr>`,
  );
  xml(
    'word/_rels/document.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="${rns}/styles" Target="styles.xml"/><Relationship Id="settings" Type="${rns}/settings" Target="settings.xml"/><Relationship Id="footer" Type="${rns}/footer" Target="footer1.xml"/>${relations.join('')}</Relationships>`,
  );
  xml(
    '_rels/.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="${rns}/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  xml(
    '[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[...types].map(([ext, mime]) => `<Default Extension="${ext}" ContentType="${mime}"/>`).join('')}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`,
  );
  return zipSync(entries, { level: 6 });
}

export const browserImageLoader: ImageLoader = async (asset) => {
  if (!assetKeyFromReference(asset.url))
    throw new Error('Export images must use the approved asset delivery route.');
  const response = await fetch(asset.url, { credentials: 'same-origin' });
  if (!response.ok)
    throw new Error('An image is no longer publicly available. Refresh your selection.');
  const mime = response.headers.get('content-type')?.split(';')[0];
  if (mime !== asset.mime || Number(response.headers.get('content-length') ?? 0) > 3 * 1024 * 1024)
    throw new Error('Invalid export image response.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 3 * 1024 * 1024) throw new Error('An export image exceeds 3 MiB.');
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const width = img.naturalWidth,
      height = img.naturalHeight;
    if (width * height > 40_000_000)
      throw new Error('This image is too large for device-side Word export. Choose PDF.');
    let preview: Uint8Array | undefined;
    if (mime === 'image/svg+xml' || mime === 'image/webp') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Word image preview unavailable. Choose PDF.');
      context.drawImage(img, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Word image preview unavailable.'))),
          'image/png',
        ),
      );
      preview = new Uint8Array(await blob.arrayBuffer());
    }
    return { bytes, width, height, mime: mime!, preview };
  } finally {
    URL.revokeObjectURL(url);
  }
};
