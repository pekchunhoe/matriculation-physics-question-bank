import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { browserImageLoader, createImagePdf } from '../src/image-pdf.js';
import { imageEnvironment, imageFile } from './image-fixture.js';
import { PDFDocument } from 'pdf-lib';

test('PDF embeds both originals, preserves page geometry and refuses missing answers or over-budget sets', async () => {
  const e = await imageEnvironment();
  try {
    const q = (await e.create()).question,
      tax = await e.bank.taxonomy();
    const load = async (a: typeof q.questionImage) =>
      new Uint8Array((await e.storage.get(a.key))!.bytes);
    const pdf = await PDFDocument.load(await createImagePdf([q], tax, load));
    assert.equal(pdf.getPageCount(), 2);
    assert.equal(pdf.getPage(0).getWidth(), 595.28);
    const pageSized = await imageFile('TEST ONLY whole-page content and footer', 1131);
    const fullPage = (
      await e.service.save(
        undefined,
        e.fixture(),
        { question: pageSized, answer: pageSized },
        e.actor,
      )
    ).question;
    const fitted = await PDFDocument.load(await createImagePdf([fullPage], tax, load));
    assert.equal(
      fitted.getPageCount(),
      2,
      'Page-sized source must not produce footer-only continuation pages',
    );
    await assert.rejects(
      () => createImagePdf([{ ...q, answerImage: undefined }], tax, load),
      /matching answer/,
    );
    await assert.rejects(
      () =>
        createImagePdf(
          [{ ...q, questionImage: { ...q.questionImage, size: 65 * 1024 * 1024 } }],
          tax,
          load,
        ),
      /budget/,
    );
    await assert.rejects(
      () => createImagePdf([q], tax, async () => new Uint8Array()),
      /Incomplete/,
    );
  } finally {
    await e.close();
  }
});
test('Browser image downloads enforce same-origin references, exact MIME, size and SHA-256', async () => {
  const e = await imageEnvironment(),
    original = globalThis.fetch;
  try {
    const q = (await e.create()).question,
      a = q.questionImage;
    const bytes = new Uint8Array(e.pair.question.buffer);
    globalThis.fetch = async (input, options) => {
      assert.equal(input, a.url);
      assert.equal(options?.redirect, 'error');
      assert.equal(options?.credentials, 'same-origin');
      return new Response(bytes, { headers: { 'content-type': 'image/png' } });
    };
    assert.equal(
      createHash('sha256')
        .update(await browserImageLoader(a))
        .digest('hex'),
      a.sha256,
    );
    await assert.rejects(
      () => browserImageLoader({ ...a, url: 'https://invalid.example/image.png' }),
      /reference/,
    );
    await assert.rejects(() => browserImageLoader({ ...a, size: 1 }), /declared size/);
    await assert.rejects(() => browserImageLoader({ ...a, size: a.size + 1 }), /Incomplete/);
    await assert.rejects(() => browserImageLoader({ ...a, sha256: '0'.repeat(64) }), /integrity/);
    globalThis.fetch = async () =>
      new Response(bytes, { headers: { 'content-type': 'image/svg+xml' } });
    await assert.rejects(() => browserImageLoader(a), /content type/);
    globalThis.fetch = async () => new Response('missing', { status: 404 });
    await assert.rejects(() => browserImageLoader(a), /no longer available/);
  } finally {
    globalThis.fetch = original;
    await e.close();
  }
});
