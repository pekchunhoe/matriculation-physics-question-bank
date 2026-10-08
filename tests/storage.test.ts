import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import express, { type RequestHandler } from 'express';
import { BlobNotFoundError } from '@vercel/blob';
import {
  AssetStorageError,
  AssetWriteFailure,
  maxAssetBytes,
  type StoredUpload,
} from '../server/asset-storage.js';
import { validateUpload } from '../server/asset-validation.js';
import { LocalAssetStorage } from '../server/local-asset-storage.js';
import {
  VercelBlobAssetStorage,
  hostedAssetStorage,
  blobAssetPrefix,
  type BlobTransport,
} from '../server/vercel-blob-storage.js';
import { AssetService, AssetConsistencyError } from '../server/asset-service.js';
import { assetKeyFromReference } from '../shared/asset-reference.js';
import { createApp } from '../server/app.js';
import { seedAdminSession, authenticatedFetch } from './auth-fixture.js';
import type { Bank } from '../server/database.js';
import { createApiHandler } from '../server/vercel-handler.js';
import { setup } from './fixtures.js';
import { createTestBank } from './test-bank.js';

const pdf = Buffer.from('%PDF-1.4 TEST ONLY disposable document');
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><defs><marker id="arrow"><path d="M0 0L1 1"/></marker></defs><path d="M0 0L10 10" marker-end="url(#arrow)"/></svg>';
const rawError =
  'TEST_ONLY_TRANSPORT_SECRET https://store.private.blob.vercel-storage.com/?token=TEST_ONLY';
function scratch() {
  const directory = mkdtempSync(join(tmpdir(), 'physics-assets-test-'));
  return {
    directory,
    dispose() {
      assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
      assert.ok(basename(directory).startsWith('physics-assets-test-'));
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
function blobFixture() {
  const entries = new Map<string, { bytes: Buffer; mime: string }>();
  const calls: { operation: string; pathname: string; options: unknown }[] = [];
  const faults = {
    operation: '',
    contentType: '',
    publicUrl: false,
    readBytes: undefined as Buffer | undefined,
  };
  const record = (operation: string, pathname: string, options: unknown) => {
    calls.push({ operation, pathname, options });
    if (faults.operation === operation) throw new Error(rawError);
  };
  const metadata = (pathname: string) => {
    const entry = entries.get(pathname);
    if (!entry) throw new BlobNotFoundError();
    const url = `https://test123.${faults.publicUrl ? 'public' : 'private'}.blob.vercel-storage.com/${pathname}`;
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
    storage: new VercelBlobAssetStorage('store_test123', transport),
    entries,
    calls,
    faults,
  };
}
async function withHttp(
  handler: RequestHandler,
  fn: (base: string, fetch: typeof globalThis.fetch) => Promise<void>,
  adminBank?: Bank,
) {
  const app = express();
  app.use(handler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((done) => server.once('listening', done));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await fn(
      `http://127.0.0.1:${address.port}`,
      adminBank ? authenticatedFetch(await seedAdminSession(adminBank)) : globalThis.fetch,
    );
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
}
function withAsset(
  doc: ReturnType<Awaited<ReturnType<typeof setup>>['fixture']>,
  upload: StoredUpload,
) {
  doc.question.status = 'draft';
  doc.assets = [
    {
      id: 'TEST-ASSET',
      partId: null,
      kind: 'question_pdf',
      url: upload.url,
      alt: 'TEST ONLY document',
      mime: upload.mime,
      order: 0,
    },
  ];
  return doc;
}

test('Local storage persists immutable unique uploads, metadata, digest reads and owned-file deletion', async () => {
  const temp = scratch(),
    storage = new LocalAssetStorage(temp.directory);
  try {
    const validated = validateUpload(pdf, 'same.pdf', 'application/pdf');
    const first = await storage.put(validated),
      second = await storage.put(validated);
    assert.notEqual(first.key, second.key);
    assert.equal(first.sha256, second.sha256);
    assert.match(first.key, /^[0-9a-f-]{36}-[0-9a-f]{64}\.pdf$/);
    assert.equal((await storage.metadata(first.key))?.size, pdf.length);
    assert.equal(await storage.exists(first.key), true);
    assert.deepEqual((await storage.get(first.key))?.bytes, pdf);
    await storage.delete(first.key);
    assert.equal(await storage.exists(first.key), false);
    assert.deepEqual((await storage.get(second.key))?.bytes, pdf);
    await storage.delete(first.key);
  } finally {
    temp.dispose();
  }
});

test('Local storage preserves safe legacy upload references and rejects tampered digest content', async () => {
  const temp = scratch(),
    storage = new LocalAssetStorage(temp.directory);
  try {
    writeFileSync(join(temp.directory, 'legacy.pdf'), pdf);
    assert.deepEqual((await storage.get('legacy.pdf'))?.bytes, pdf);
    const upload = await storage.put(validateUpload(pdf, 'new.pdf'));
    writeFileSync(
      join(temp.directory, upload.key),
      Buffer.from('%PDF-1.4 TEST ONLY tampered document'),
    );
    await assert.rejects(
      storage.get(upload.key),
      (error: unknown) => error instanceof AssetStorageError && error.code === 'integrity_failed',
    );
  } finally {
    temp.dispose();
  }
});

test('Local storage rejects traversal, encoded keys, directories and symlink/junction reads', async () => {
  const temp = scratch(),
    outside = scratch(),
    storage = new LocalAssetStorage(temp.directory);
  try {
    for (const key of [
      '../secret.pdf',
      '/absolute.pdf',
      '..\\secret.pdf',
      'a/secret.pdf',
      '%2e%2e.pdf',
      'bad\0.pdf',
      'file..pdf',
      'file.pdf?x=1',
    ]) {
      await assert.rejects(storage.get(key), AssetStorageError);
      await assert.rejects(storage.delete(key), AssetStorageError);
    }
    symlinkSync(outside.directory, join(temp.directory, 'linked.pdf'), 'junction');
    await assert.rejects(storage.get('linked.pdf'), AssetStorageError);
    assert.deepEqual(readdirSync(outside.directory), []);
  } finally {
    temp.dispose();
    outside.dispose();
  }
});

test('Upload validation checks MIME/signatures, filenames, nonempty files and the size limit', () => {
  assert.equal(
    validateUpload(pdf, 'archive.pdf', 'application/octet-stream').mime,
    'application/pdf',
  );
  assert.equal(
    validateUpload(Buffer.from(svg), 'diagram.svg', 'image/svg+xml').mime,
    'image/svg+xml',
  );
  for (const [bytes, name, mime] of [
    [pdf, '../archive.pdf', 'application/pdf'],
    [pdf, 'C:\\archive.pdf', 'application/pdf'],
    [pdf, 'bad\n.pdf', 'application/pdf'],
    [pdf, 'archive.png', 'application/pdf'],
    [pdf, 'archive.pdf', 'image/jpeg'],
    [Buffer.from('<html><script>alert(1)</script></html>'), 'bad.png', 'image/png'],
    [Buffer.alloc(0), 'empty.pdf', 'application/pdf'],
    [Buffer.alloc(maxAssetBytes + 1), 'large.pdf', 'application/pdf'],
  ] as const)
    assert.throws(() => validateUpload(bytes, name, mime), AssetStorageError);
  assert.equal(
    validateUpload(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image.png', 'image/png').mime,
    'image/png',
  );
  assert.equal(
    validateUpload(Buffer.from([255, 216, 255, 0]), 'photo.jpeg', 'image/jpeg').mime,
    'image/jpeg',
  );
  assert.equal(
    validateUpload(Buffer.from('RIFF0000WEBPTEST'), 'image.webp', 'image/webp').mime,
    'image/webp',
  );
});

test('SVG validation rejects active XML, foreign namespaces, encoded references, animation and malformed documents', () => {
  for (const value of [
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="alert(1)"/>',
    '<svg><foreignObject><div>HTML</div></foreignObject></svg>',
    '<svg xmlns:h="http://www.w3.org/1999/xhtml"><h:script>alert(1)</h:script></svg>',
    '<svg><image href="&#104;ttps://example.org/image.png"/></svg>',
    '<svg><use href="javascript:alert(1)"/></svg>',
    '<svg><animate attributeName="href" values="javascript:alert(1)"/></svg>',
    '<svg><path style="fill:url(https://example.org/x)"/></svg>',
    '<svg><path style="fill:u\\72l(https://example.org/x)"/></svg>',
    '<svg><style>@import "https://example.org/style.css"</style></svg>',
    '<?xml-stylesheet href="https://example.org/x"?><svg/>',
    '<svg><path></svg>',
    '<svg xml:base="https://example.org/"/>',
    '<!DOCTYPE svg [<!ENTITY attack SYSTEM "file:///etc/passwd">]><svg>&attack;</svg>',
  ])
    assert.throws(
      () => validateUpload(Buffer.from(value), 'attack.svg', 'image/svg+xml'),
      AssetStorageError,
    );
});

test('Private Blob adapter uses scoped private operations and returns only opaque application references', async () => {
  const env = blobFixture(),
    upload = await env.storage.put(validateUpload(pdf, 'original.pdf'));
  assert.ok(assetKeyFromReference(upload.url));
  assert.ok(!JSON.stringify(upload).includes('blob.vercel-storage.com'));
  assert.equal(await env.storage.exists(upload.key), true);
  assert.equal((await env.storage.metadata(upload.key))?.mime, 'application/pdf');
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
    '../other.pdf',
    'question-bank/other.pdf',
    'https://test123.private.blob.vercel-storage.com/other.pdf',
    'legacy.pdf',
    'bad%2f.pdf',
  ]) {
    await assert.rejects(env.storage.delete(key), AssetStorageError);
    await assert.rejects(env.storage.get(key), AssetStorageError);
  }
  assert.equal(env.calls.length, 0);
});

test('Private Blob adapter verifies private host, MIME, byte length and SHA-256', async () => {
  const env = blobFixture(),
    upload = await env.storage.put(validateUpload(pdf, 'archive.pdf'));
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
    upload = await env.storage.put(validateUpload(pdf, 'archive.pdf'));
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
    env.storage.put(validateUpload(pdf, 'new.pdf')),
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

test('Hosted handler protects uploads and private reads without storage I/O or local filesystem writes', async () => {
  const temp = scratch(),
    previous = process.cwd(),
    bank = await createTestBank(),
    env = blobFixture();
  try {
    process.chdir(temp.directory);
    const handler = createApiHandler(
      async () => bank,
      () => env.storage,
    );
    await withHttp(handler, async (base, fetch) => {
      assert.deepEqual(await (await fetch(base + '/api/health')).json(), {
        status: 'ok',
        database: 'connected',
      });
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
        assert.equal((await fetch(base + '/api/uploads', { method })).status, 401);
      for (const method of ['GET', 'HEAD'])
        assert.equal((await fetch(base + '/uploads/test.pdf', { method })).status, 404);
      assert.equal((await fetch(base + '/uploads/test.pdf?view=teacher&admin=true')).status, 404);
    });
    assert.equal(env.calls.length, 0);
    assert.deepEqual(readdirSync(temp.directory), []);
  } finally {
    process.chdir(previous);
    await bank.close();
    temp.dispose();
  }
});

test('Hosted handler fails closed on unavailable configuration and rejects even injected local storage', async () => {
  const bank = await createTestBank(),
    temp = scratch();
  try {
    for (const factory of [
      () => {
        throw new Error(rawError);
      },
      () => new LocalAssetStorage(temp.directory),
    ])
      await withHttp(
        createApiHandler(async () => bank, factory),
        async (base, fetch) => {
          assert.equal((await fetch(base + '/api/uploads', { method: 'POST' })).status, 401);
          const read = await fetch(base + '/uploads/test.pdf');
          assert.equal(read.status, 503);
          assert.deepEqual(await read.json(), { error: 'Asset storage is not configured' });
          assert.equal((await fetch(base + '/api/health')).status, 200);
        },
      );
    assert.deepEqual(readdirSync(temp.directory), []);
  } finally {
    await bank.close();
    temp.dispose();
  }
});

test('Private upload API in an isolated trusted server returns opaque references and authorizes private delivery through a real admin session', async () => {
  const bank = await createTestBank(),
    env = blobFixture();
  try {
    await withHttp(
      createApp(bank, env.storage),
      async (base, fetch) => {
        const form = new FormData();
        form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'archive.pdf');
        const response = await fetch(base + '/api/uploads', { method: 'POST', body: form });
        assert.equal(response.status, 201);
        const uploaded = await response.json();
        assert.equal(uploaded.state, 'staged');
        assert.ok(assetKeyFromReference(uploaded.url));
        assert.equal(uploaded.sha256.length, 64);
        assert.ok(!JSON.stringify(uploaded).includes('blob.vercel-storage.com'));
        assert.equal((await fetch(base + uploaded.url)).status, 200);
        assert.equal((await bank.all('SELECT * FROM assets')).length, 0);
        const unsafe = new FormData();
        unsafe.append(
          'file',
          new Blob(['<svg><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }),
          'unsafe.svg',
        );
        assert.equal(
          (await fetch(base + '/api/uploads', { method: 'POST', body: unsafe })).status,
          400,
        );
        assert.equal(env.calls.filter((call) => call.operation === 'put').length, 1);
      },
      bank,
    );
  } finally {
    await bank.close();
  }
});

test('API storage failure responses cannot leak SDK credentials, raw URLs or stack traces', async (t) => {
  const bank = await createTestBank(),
    env = blobFixture();
  const logs: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => {
    logs.push(args);
  });
  env.faults.operation = 'put';
  try {
    await withHttp(
      createApp(bank, env.storage),
      async (base, fetch) => {
        const form = new FormData();
        form.append('file', new Blob([pdf]), 'archive.pdf');
        const response = await fetch(base + '/api/uploads', { method: 'POST', body: form });
        assert.equal(response.status, 503);
        const result = await response.json();
        assert.deepEqual(result, { error: 'Asset upload failed; reconciliation may be required' });
        assert.ok(!JSON.stringify(logs).includes('TEST_ONLY_TRANSPORT_SECRET'));
        assert.ok(logs.some((line) => line.includes('upload_uncertain')));
      },
      bank,
    );
  } finally {
    await bank.close();
  }
});

test('Asset metadata checks detect missing bytes and mismatched MIME without changing database records', async () => {
  const env = await setup(),
    blob = blobFixture(),
    service = new AssetService(blob.storage, env.bank);
  try {
    const upload = await service.upload(pdf, 'archive.pdf'),
      doc = withAsset(env.fixture('TEST-ASSET-METADATA'), upload);
    await service.checkDocument(doc);
    doc.assets[0].mime = 'image/png';
    await assert.rejects(service.checkDocument(doc), AssetStorageError);
    doc.assets[0].mime = 'application/pdf';
    blob.entries.clear();
    await assert.rejects(service.checkDocument(doc), AssetStorageError);
    assert.equal((await env.bank.list()).total, 0);
  } finally {
    await env.bank.close();
  }
});

test('Failed new metadata links compensate only the owned new object after real DB rejection', async () => {
  const env = await setup(),
    blob = blobFixture(),
    service = new AssetService(blob.storage, env.bank);
  try {
    const doc = env.fixture('TEST-DUPLICATE-METADATA');
    doc.question.status = 'draft';
    await env.bank.create(doc, 'TEST ONLY existing draft');
    await assert.rejects(
      service.uploadAndLink(pdf, 'archive.pdf', 'application/pdf', async (upload) =>
        env.bank.create(withAsset(structuredClone(doc), upload), 'TEST ONLY duplicate rejected'),
      ),
      (error: unknown) => error instanceof AssetStorageError && error.code === 'metadata_failed',
    );
    assert.equal(blob.entries.size, 0);
    assert.equal(blob.calls.filter((call) => call.operation === 'del').length, 1);
    assert.equal((await env.bank.list()).total, 1);
  } finally {
    await env.bank.close();
  }
});

test('Internal upload-and-link succeeds with existing metadata schema and opaque JSON references', async () => {
  const env = await setup(),
    blob = blobFixture(),
    service = new AssetService(blob.storage, env.bank);
  try {
    const linked = await service.uploadAndLink(pdf, 'archive.pdf', 'application/pdf', (upload) =>
      env.bank.create(
        withAsset(env.fixture('TEST-LINK-SUCCESS'), upload),
        'TEST ONLY linked draft',
      ),
    );
    const doc = await env.bank.document(linked.result.id);
    assert.equal(doc.assets[0].url, linked.upload.url);
    assert.equal((await env.bank.all('SELECT * FROM assets')).length, 1);
    assert.ok(!JSON.stringify(doc).includes('blob.vercel-storage.com'));
    assert.equal(
      (await env.bank.validate(JSON.parse(JSON.stringify(doc)))).assets[0].url,
      linked.upload.url,
    );
  } finally {
    await env.bank.close();
  }
});

test('Existing two-step upload workflow retains staged bytes after a rejected save for a safe retry', async () => {
  const env = await setup(),
    blob = blobFixture();
  try {
    await withHttp(
      createApp(env.bank, blob.storage),
      async (base, fetch) => {
        const form = new FormData();
        form.append('file', new Blob([pdf]), 'staged.pdf');
        const upload = await (
          await fetch(base + '/api/uploads', { method: 'POST', body: form })
        ).json();
        const doc = withAsset(env.fixture('TEST-STAGED-RETRY'), upload);
        const bad = structuredClone(doc);
        bad.question.topicId = 'TEST ONLY missing topic';
        const rejected = await fetch(base + '/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document: bad, note: 'TEST ONLY rejected save' }),
        });
        assert.equal(rejected.status, 400);
        assert.equal(blob.entries.size, 1);
        assert.equal((await env.bank.all('SELECT * FROM assets')).length, 0);
        const retry = await fetch(base + '/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document: doc, note: 'TEST ONLY successful retry' }),
        });
        assert.equal(retry.status, 201);
        assert.equal((await env.bank.all('SELECT * FROM assets')).length, 1);
      },
      env.bank,
    );
  } finally {
    await env.bank.close();
  }
});

test('Uncertain metadata completion retains linked assets and reports reconciliation explicitly', async (t) => {
  const env = await setup(),
    blob = blobFixture(),
    service = new AssetService(blob.storage, env.bank);
  t.mock.method(console, 'error', () => {});
  try {
    await assert.rejects(
      service.uploadAndLink(pdf, 'archive.pdf', undefined, async (upload) => {
        await env.bank.create(
          withAsset(env.fixture('TEST-COMMITTED-METADATA'), upload),
          'TEST ONLY committed link',
        );
        throw new Error(rawError);
      }),
      (error: unknown) =>
        error instanceof AssetConsistencyError && error.code === 'linked_asset_retained',
    );
    assert.equal(blob.entries.size, 1);
    assert.equal(blob.calls.filter((call) => call.operation === 'del').length, 0);
  } finally {
    await env.bank.close();
  }
});

test('Cleanup transport/DB failures retain objects and surface safe reconciliation references', async (t) => {
  const env = await setup(),
    blob = blobFixture(),
    service = new AssetService(blob.storage, env.bank);
  const logs: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => {
    logs.push(args);
  });
  let closed = false;
  try {
    blob.faults.operation = 'del';
    await assert.rejects(
      service.uploadAndLink(pdf, 'archive.pdf', undefined, async () => {
        throw new Error(rawError);
      }),
      (error: unknown) =>
        error instanceof AssetConsistencyError &&
        error.code === 'cleanup_failed' &&
        Boolean(assetKeyFromReference(error.reconciliationReference)),
    );
    assert.equal(blob.entries.size, 1);
    assert.ok(logs.length > 0);
    assert.ok(!JSON.stringify(logs).includes('TEST_ONLY_TRANSPORT_SECRET'));
    blob.faults.operation = '';
    await assert.rejects(
      service.uploadAndLink(pdf, 'another.pdf', undefined, async () => {
        await env.bank.close();
        closed = true;
        throw new Error(rawError);
      }),
      (error: unknown) => error instanceof AssetConsistencyError && error.code === 'cleanup_failed',
    );
    assert.equal(blob.entries.size, 2);
  } finally {
    if (!closed) await env.bank.close();
  }
});

test('Assets referenced only by an older immutable version remain physically retained', async () => {
  const env = await setup(),
    blob = blobFixture(),
    service = new AssetService(blob.storage, env.bank);
  try {
    const upload = await service.upload(pdf, 'historical.pdf');
    const doc = withAsset(env.fixture('TEST-HISTORICAL-ASSET'), upload);
    const question = await env.bank.create(doc, 'TEST ONLY original historical asset');
    doc.assets = [];
    await env.bank.save(question.id, doc, 'TEST ONLY remove current asset', 1);
    assert.equal((await env.bank.all('SELECT * FROM assets')).length, 0);
    assert.equal(await service.isReferenced(upload.url), true);
    assert.equal(await service.discardUnlinkedUpload(upload), false);
    assert.equal(blob.entries.size, 1);
  } finally {
    await env.bank.close();
  }
});

test('Deletion audits current/shared and immutable historical references and rejects forged receipts', async () => {
  const env = await setup(),
    blob = blobFixture(),
    service = new AssetService(blob.storage, env.bank);
  try {
    const upload = await service.upload(pdf, 'archive.pdf');
    assert.ok(Object.isFrozen(upload));
    await assert.rejects(service.discardUnlinkedUpload({ ...upload }), AssetStorageError);
    const firstDoc = withAsset(env.fixture('TEST-SHARED-ASSET-1'), upload);
    const first = await env.bank.create(firstDoc, 'TEST ONLY first reference');
    await env.bank.create(
      withAsset(env.fixture('TEST-SHARED-ASSET-2'), upload),
      'TEST ONLY shared reference',
    );
    assert.equal(await service.discardUnlinkedUpload(upload), false);
    firstDoc.assets = [];
    await env.bank.save(first.id, firstDoc, 'TEST ONLY remove current link', 1);
    assert.equal(await service.discardUnlinkedUpload(upload), false);
    assert.equal(blob.entries.size, 1);
    assert.equal(blob.calls.filter((call) => call.operation === 'del').length, 0);
  } finally {
    await env.bank.close();
  }
});

test('Revision snapshots and PDF source references retain staged bytes even after review rejection', async () => {
  const env = await setup(),
    blob = blobFixture(),
    service = new AssetService(blob.storage, env.bank);
  try {
    const base = env.fixture('TEST-REVISION-ASSET');
    const question = await env.bank.create(base, 'TEST ONLY approved fixture', null, true);
    const upload = await service.upload(pdf, 'candidate.pdf'),
      revised = withAsset(structuredClone(base), upload);
    revised.question.status = 'approved';
    const saved = await env.bank.save(question.id, revised, 'TEST ONLY pending asset', 1);
    assert.ok('candidateId' in saved && saved.candidateId);
    assert.equal(await service.discardUnlinkedUpload(upload), false);
    await env.bank.review(saved.candidateId, false, 'TEST ONLY Teacher');
    assert.equal(await service.discardUnlinkedUpload(upload), false);
    const source = await service.upload(pdf, 'source.pdf');
    await env.bank.run(
      'UPDATE revision_candidates SET source_pdf_url=? WHERE id=?',
      source.url,
      saved.candidateId,
    );
    assert.equal(await service.discardUnlinkedUpload(source), false);
  } finally {
    await env.bank.close();
  }
});

test('Question JSON rejects unsafe local paths and raw Blob URLs while preserving external HTTPS assets', async () => {
  const env = await setup();
  try {
    const doc = env.fixture('TEST-PRIVATE-JSON');
    const asset = {
      id: 'TEST-REF',
      partId: null,
      kind: 'question_pdf' as const,
      url: '',
      alt: 'TEST ONLY reference',
      mime: 'application/pdf' as const,
      order: 0,
    };
    for (const url of [
      '/uploads/../secret.pdf',
      '/uploads/%2e%2e.pdf',
      'https://test123.private.blob.vercel-storage.com/secret.pdf',
      'https://test123.public.blob.vercel-storage.com/secret.pdf',
    ]) {
      doc.assets = [{ ...asset, url }];
      await assert.rejects(env.bank.validate(doc));
    }
    doc.assets = [{ ...asset, url: 'https://example.org/TEST-ONLY.pdf' }];
    assert.equal((await env.bank.validate(doc)).assets[0].url, doc.assets[0].url);
  } finally {
    await env.bank.close();
  }
});

test('Local delivery preserves nosniff, SVG sandbox, MIME and byte range responses', async () => {
  const bank = await createTestBank(),
    temp = scratch(),
    storage = new LocalAssetStorage(temp.directory);
  try {
    const upload = await storage.put(validateUpload(Buffer.from(svg), 'diagram.svg'));
    await withHttp(
      createApp(bank, storage),
      async (base, fetch) => {
        const full = await fetch(base + upload.url);
        assert.equal(full.status, 200);
        assert.equal(full.headers.get('x-content-type-options'), 'nosniff');
        assert.ok(full.headers.get('content-security-policy')?.includes('sandbox'));
        assert.ok(full.headers.get('content-type')?.includes('image/svg+xml'));
        assert.equal(await full.text(), svg);
        const part = await fetch(base + upload.url, { headers: { Range: 'bytes=0-3' } });
        assert.equal(part.status, 206);
        assert.equal(await part.text(), '<svg');
        assert.equal(
          (await fetch(base + upload.url, { headers: { Range: 'bytes=99999-' } })).status,
          416,
        );
        assert.equal((await fetch(base + '/uploads/missing.svg')).status, 404);
      },
      bank,
    );
  } finally {
    await bank.close();
    temp.dispose();
  }
});

test('Private Blob bytes are mediated publicly only through approved current assets and staged bytes require admin', async () => {
  const env = await setup(),
    blob = blobFixture();
  try {
    const upload = await blob.storage.put(validateUpload(pdf, 'question.pdf'));
    const doc = withAsset(env.fixture('TEST-BLOB-PUBLIC'), upload);
    doc.question.status = 'approved';
    const { id } = await env.bank.create(doc, 'TEST ONLY public asset', null, true);
    const staged = await blob.storage.put(
      validateUpload(Buffer.from('%PDF-1.7\nTEST ONLY private'), 'source.pdf'),
    );
    await withHttp(
      createApp(env.bank, blob.storage),
      async (base, adminFetch) => {
        const publicRead = await fetch(base + upload.url);
        assert.equal(publicRead.status, 200);
        assert.equal(await publicRead.text(), pdf.toString());
        assert.ok(!publicRead.headers.get('location'));
        assert.ok(!JSON.stringify([...publicRead.headers]).includes('blob.vercel-storage.com'));
        const reads = blob.calls.filter((call) => call.operation === 'get').length;
        assert.equal((await fetch(base + staged.url)).status, 404);
        assert.equal(blob.calls.filter((call) => call.operation === 'get').length, reads);
        assert.equal((await adminFetch(base + staged.url)).status, 200);
        await env.bank.run("UPDATE questions SET status='retired' WHERE id=?", id);
        assert.equal((await fetch(base + upload.url)).status, 404);
        assert.equal((await adminFetch(base + upload.url)).status, 200);
      },
      env.bank,
    );
  } finally {
    await env.bank.close();
  }
});
