import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  type PDFImage,
} from 'pdf-lib';
import {
  imageLimits,
  orderedQuestions,
  type ImageQuestion,
  type ImageAsset,
} from '../shared/image-question';
import type { Taxonomy } from '../shared/schema';
import { assetKeyFromReference } from '../shared/asset-reference';

export type ImageLoader = (asset: ImageAsset) => Promise<Uint8Array>;
export async function browserImageLoader(asset: ImageAsset) {
  if (assetKeyFromReference(asset.url) !== asset.key) throw new Error('Invalid image reference');
  const response = await fetch(asset.url, {
    credentials: 'same-origin',
    redirect: 'error',
    cache: 'no-store',
  });
  if (!response.ok || !response.body)
    throw new Error('An image is no longer available. Reload your selection.');
  if (response.headers.get('content-type')?.split(';')[0] !== asset.mime)
    throw new Error('Image content type changed');
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.length;
      if (total > imageLimits.bytes || total > asset.size)
        throw new Error('Image exceeds its declared size');
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  if (total !== asset.size) throw new Error('Incomplete image download');
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (hash !== asset.sha256) throw new Error('Image integrity check failed');
  return bytes;
}
async function webpPng(bytes: Uint8Array, asset: ImageAsset) {
  const bitmap = await createImageBitmap(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: asset.mime }),
  );
  try {
    if (bitmap.width !== asset.width || bitmap.height !== asset.height)
      throw new Error('Image dimensions changed');
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Image decoder unavailable');
      ctx.drawImage(bitmap, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Image conversion failed'))),
          'image/png',
        ),
      );
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      canvas.width = canvas.height = 0;
    }
  } finally {
    bitmap.close();
  }
}
/** A4, intact image aspect ratio, shared PDF image objects, and overlapping page slices.
 * Decode/fetch one source at a time; no server-side document generation. */
export async function createImagePdf(
  items: ImageQuestion[],
  tax: Taxonomy,
  load: ImageLoader = browserImageLoader,
  onProgress?: (done: number, total: number) => void,
) {
  const plan = orderedQuestions(items, tax),
    pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const unique = new Map<string, ImageAsset>();
  for (const q of plan) {
    if (!q.answerImage) throw new Error('Every question needs its matching answer image');
    unique.set(q.questionImage.key, q.questionImage);
    unique.set(q.answerImage.key, q.answerImage);
  }
  if ([...unique.values()].reduce((n, a) => n + a.size, 0) > imageLimits.exportBytes)
    throw new Error('Selected images exceed the 64 MiB export budget. Export a smaller set.');
  const embedded = new Map<string, PDFImage>(),
    totalMarks = plan.reduce((n, q) => n + q.totalMarks, 0);
  let completed = 0;
  for (const answer of [false, true])
    for (const [index, q] of plan.entries()) {
      const a = answer ? q.answerImage! : q.questionImage;
      let image = embedded.get(a.key);
      if (!image) {
        const bytes = await load(a);
        if (bytes.length !== a.size) throw new Error('Incomplete image');
        image =
          a.mime === 'image/jpeg'
            ? await pdf.embedJpg(bytes)
            : await pdf.embedPng(a.mime === 'image/webp' ? await webpPng(bytes, a) : bytes);
        if (image.width !== a.width || image.height !== a.height)
          throw new Error('Image dimensions changed');
        embedded.set(a.key, image);
        await pdf.flush();
      }
      const pageWidth = 595.28,
        pageHeight = 841.89,
        left = 36,
        top = 100,
        bottom = 46,
        available = pageHeight - top - bottom,
        fullWidth = Math.min(pageWidth - left * 2, a.width),
        // Modestly fit page-sized originals so their footer does not spill alone.
        // Long images retain readable full width and the overlapping slice plan.
        fullHeight = (fullWidth * a.height) / a.width,
        height = fullHeight <= available * 1.25 ? Math.min(fullHeight, available) : fullHeight,
        width = (height * a.width) / a.height;
      let offset = 0,
        part = 0;
      while (offset < height) {
        if (pdf.getPageCount() >= imageLimits.pages)
          throw new Error('This set exceeds 400 pages. Export fewer or shorter images.');
        const page = pdf.addPage([pageWidth, pageHeight]),
          visible = Math.min(available, height - offset);
        page.drawText(answer ? 'SECTION B - ANSWERS / MARKING SCHEMES' : 'SECTION A - QUESTIONS', {
          x: left,
          y: pageHeight - 34,
          size: 11,
          font: bold,
          color: rgb(0.06, 0.17, 0.27),
        });
        page.drawText(
          `${answer ? 'Answer' : 'Question'} ${index + 1}${part ? ' (continued)' : ''} - ${q.totalMarks} marks`,
          { x: left, y: pageHeight - 56, size: 12, font: bold },
        );
        page.drawText(`Set total: ${totalMarks} marks`, {
          x: left,
          y: pageHeight - 75,
          size: 9,
          font,
        });
        page.pushOperators(
          pushGraphicsState(),
          rectangle(left, pageHeight - top - visible, width, visible),
          clip(),
          endPath(),
        );
        page.drawImage(image, { x: left, y: pageHeight - top - height + offset, width, height });
        page.pushOperators(popGraphicsState());
        if (offset + visible >= height) break;
        offset += visible - 12;
        part++; // Small overlap prevents a line split from losing content.
      }
      completed++;
      onProgress?.(completed, plan.length * 2);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  pdf.getPages().forEach((page, i) =>
    page.drawText(`Page ${i + 1} of ${pdf.getPageCount()}`, {
      x: 36,
      y: 23,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    }),
  );
  pdf.setTitle('Matriculation Physics - Questions and Answers');
  pdf.setCreator('Matriculation Physics Question Bank');
  pdf.setProducer('Client-side image PDF');
  return pdf.save();
}
