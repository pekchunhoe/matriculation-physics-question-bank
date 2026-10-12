import { assetKeyFromReference } from '../shared/asset-reference.js';
import { maxAssetBytes } from '../server/asset-storage.js';
import { LocalAssetStorage } from '../server/local-asset-storage.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlobNotFoundError } from '@vercel/blob';
import { AssetStorageError, AssetWriteFailure } from '../server/asset-storage.js';
import { validateUpload } from '../server/asset-validation.js';
import {
  VercelBlobAssetStorage,
  hostedAssetStorage,
  blobAssetPrefix,
  type BlobTransport,
} from '../server/vercel-blob-storage.js';
const pdf = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==',
  'base64',
);
const rawError =
  'TEST_ONLY_TRANSPORT_SECRET https://store.private.blob.vercel-storage.com/?token=TEST_ONLY';
function blobFixture(storeId = 'store_test123') {
  const entries = new Map<string, { bytes: Buffer; mime: string }>();
  const calls: { operation: string; pathname: string; options: unknown }[] = [];
  const faults = {
    operation: '',
    contentType: '',
    publicUrl: false,
    url: '',
    readBytes: undefined as Buffer | undefined,
  };
  const record = (operation: string, pathname: string, options: unknown) => {
    calls.push({ operation, pathname, options });
    if (faults.operation === operation) throw new Error(rawError);
  };
  const metadata = (pathname: string) => {
    const entry = entries.get(pathname);
    if (!entry) throw new BlobNotFoundError();
    const url =
      faults.url ||
      `https://${storeId.replace(/^store_/, '')}.${faults.publicUrl ? 'public' : 'private'}.blob.vercel-storage.com/${pathname}`;
    return {
      pathname,
      url,
      downloadUrl: url + '?download=1',
      contentType: faults.contentType || entry.mime,
      size: entry.bytes.length,
      uploadedAt: new Date(),
      etag: '"test-only"',
      cacheControl: 'max-age=60',
      contentDisposition: 'attachment',
    };
  };
  const transport: BlobTransport = {
    async put(pathname, body, options) {
      record('put', pathname, options);
      assert.ok(Buffer.isBuffer(body));
      assert.equal(options.access, 'private');
      assert.equal(options.allowOverwrite, false);
      if (entries.has(pathname)) throw new Error('TEST_ONLY collision');
      entries.set(pathname, { bytes: Buffer.from(body), mime: options.contentType! });
      return metadata(pathname);
    },
    async head(pathname, options) {
      record('head', pathname, options);
      return metadata(pathname);
    },
    async get(pathname, options) {
      record('get', pathname, options);
      assert.equal(options.access, 'private');
      if (!entries.has(pathname)) return null;
      const bytes = faults.readBytes ?? entries.get(pathname)!.bytes;
      return {
        statusCode: 200,
        blob: metadata(pathname),
        headers: new Headers(),
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
      };
    },
    async del(pathname, options) {
      assert.ok(typeof pathname === 'string');
      record('del', pathname, options);
      entries.delete(pathname);
    },
  };
  return {
    storage: new VercelBlobAssetStorage(storeId, transport),
    entries,
    calls,
    faults,
  };
}
test('Private Blob adapter uses scoped private operations and returns only opaque application references', async () => {
  const env = blobFixture(),
    upload = await env.storage.put(validateUpload(pdf, 'original.png'));
  assert.ok(assetKeyFromReference(upload.url));
  assert.ok(!JSON.stringify(upload).includes('blob.vercel-storage.com'));
  assert.equal(await env.storage.exists(upload.key), true);
  assert.equal((await env.storage.metadata(upload.key))?.mime, 'image/png');
  assert.deepEqual((await env.storage.get(upload.key))?.bytes, pdf);
  for (const call of env.calls) {
    assert.equal(call.pathname, blobAssetPrefix + upload.key);
    assert.ok(!('token' in (call.options as object)));
    assert.ok(!('oidcToken' in (call.options as object)));
    assert.equal((call.options as { storeId: string }).storeId, 'store_test123');
  }
  await env.storage.delete(upload.key);
  assert.equal(await env.storage.exists(upload.key), false);
  assert.equal(await env.storage.get(upload.key), undefined);
});

test('Private Blob adapter cannot delete arbitrary URLs, other namespaces or legacy local names', async () => {
  const env = blobFixture();
  for (const key of [
    '../other.png',
    'question-bank/other.png',
    'https://test123.private.blob.vercel-storage.com/other.png',
    'legacy.png',
    'bad%2f.png',
  ]) {
    await assert.rejects(env.storage.delete(key), AssetStorageError);
    await assert.rejects(env.storage.get(key), AssetStorageError);
  }
  assert.equal(env.calls.length, 0);
});

for (const storeId of ['store_TeSt123AbC', 'store_test123abc']) {
  test(`Private Blob adapter accepts canonical private metadata for ${storeId}`, async () => {
    const env = blobFixture(storeId);
    const expectedHost = 'test123abc.private.blob.vercel-storage.com';
    assert.equal(
      new URL(`https://${storeId.slice('store_'.length)}.private.blob.vercel-storage.com`).hostname,
      expectedHost,
    );
    const upload = await env.storage.put(validateUpload(pdf, 'synthetic.png'));
    assert.equal(assetKeyFromReference(upload.url), upload.key);
    assert.ok(!JSON.stringify(upload).includes('blob.vercel-storage.com'));
    assert.equal((await env.storage.metadata(upload.key))?.sha256, upload.sha256);
    assert.deepEqual((await env.storage.get(upload.key))?.bytes, pdf);
    for (const call of env.calls)
      assert.equal((call.options as { storeId: string }).storeId, storeId);
  });
}

test('Private Blob hostname normalization retains exact store, host and HTTPS validation', async () => {
  const env = blobFixture('store_TeSt123AbC');
  const upload = await env.storage.put(validateUpload(pdf, 'synthetic.png'));
  const pathname = blobAssetPrefix + upload.key;
  const expectedHost = 'test123abc.private.blob.vercel-storage.com';
  const invalidUrls = [
    `https://otherstore.private.blob.vercel-storage.com/${pathname}`,
    `https://test123abc.public.blob.vercel-storage.com/${pathname}`,
    `https://attacker.${expectedHost}/${pathname}`,
    `https://${expectedHost}.attacker.example/${pathname}`,
    `https://attackertest123abc.private.blob.vercel-storage.com/${pathname}`,
    `https://test123abcattacker.private.blob.vercel-storage.com/${pathname}`,
    `http://${expectedHost}/${pathname}`,
    'not a URL',
    `https://unrelated.example/${pathname}`,
    `https://${expectedHost}@attacker.example/${pathname}`,
    `https://attacker@${expectedHost}/${pathname}`,
    `https://${expectedHost}/other-namespace/${upload.key}`,
    `https://${expectedHost}/${pathname}?token=TEST_ONLY`,
    `https://${expectedHost}/${pathname}#fragment`,
  ];
  for (const url of invalidUrls) {
    env.faults.url = url;
    await assert.rejects(env.storage.metadata(upload.key), AssetStorageError);
    await assert.rejects(env.storage.get(upload.key), AssetStorageError);
  }
});

test('Genuine post-put host verification failures retain sanitized upload uncertainty without deletion', async () => {
  const env = blobFixture('store_TeSt123AbC');
  env.faults.publicUrl = true;
  await assert.rejects(
    env.storage.put(validateUpload(pdf, 'synthetic.png')),
    (error: unknown) =>
      error instanceof AssetWriteFailure &&
      error.code === 'upload_uncertain' &&
      error.status === 503 &&
      Boolean(assetKeyFromReference(error.reconciliationReference)) &&
      !error.message.includes('https://'),
  );
  assert.equal(env.entries.size, 1);
  assert.deepEqual(
    env.calls.map((call) => call.operation),
    ['put'],
  );
});

test('Private Blob adapter verifies private host, MIME, byte length and SHA-256', async () => {
  const env = blobFixture(),
    upload = await env.storage.put(validateUpload(pdf, 'archive.png'));
  env.faults.publicUrl = true;
  await assert.rejects(env.storage.metadata(upload.key), AssetStorageError);
  env.faults.publicUrl = false;
  env.faults.contentType = 'text/html';
  await assert.rejects(env.storage.metadata(upload.key), AssetStorageError);
  env.faults.contentType = '';
  env.faults.readBytes = Buffer.from('%PDF-1.4 TEST ONLY tampered document');
  await assert.rejects(env.storage.get(upload.key), AssetStorageError);
  env.faults.readBytes = Buffer.alloc(maxAssetBytes + 1);
  await assert.rejects(env.storage.get(upload.key), AssetStorageError);
});

test('Private Blob transport failures stay sanitized and retain planned references for uncertain writes', async () => {
  const env = blobFixture(),
    upload = await env.storage.put(validateUpload(pdf, 'archive.png'));
  for (const operation of ['head', 'get', 'del'] as const) {
    env.faults.operation = operation;
    const action =
      operation === 'head'
        ? env.storage.metadata(upload.key)
        : operation === 'get'
          ? env.storage.get(upload.key)
          : env.storage.delete(upload.key);
    await assert.rejects(
      action,
      (error: unknown) =>
        error instanceof AssetStorageError &&
        !error.message.includes('TEST_ONLY_TRANSPORT_SECRET') &&
        !error.message.includes('https://'),
    );
  }
  env.faults.operation = 'put';
  await assert.rejects(
    env.storage.put(validateUpload(pdf, 'new.png')),
    (error: unknown) =>
      error instanceof AssetWriteFailure &&
      Boolean(assetKeyFromReference(error.reconciliationReference)),
  );
});

test('Provider configuration defaults local independently of Blob env and selects only scoped hosted private storage', () => {
  assert.equal(new LocalAssetStorage('TEST ONLY temporary location').kind, 'local');
  assert.equal(hostedAssetStorage({ VERCEL: '1' }), undefined);
  assert.equal(
    hostedAssetStorage({ VERCEL: '1', BLOB_STORE_ID: 'store_test123' })?.kind,
    'vercel-private-blob',
  );
  assert.throws(() => hostedAssetStorage({ BLOB_STORE_ID: 'store_test123' }), AssetStorageError);
  for (const storeId of ['../other', 'https://example.org', 'store_'])
    assert.throws(() => new VercelBlobAssetStorage(storeId), AssetStorageError);
});
