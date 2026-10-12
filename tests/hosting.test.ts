import { test } from 'node:test';
import assert from 'node:assert/strict';
import express, { type RequestHandler } from 'express';
import { readFileSync } from 'node:fs';
import { createApp } from '../server/app.js';
import { createApiHandler } from '../server/vercel-handler.js';
import { createTestBank } from './test-bank.js';
import { seedAdminSession, authenticatedFetch } from './auth-fixture.js';
import { assertPreviewIsolation, previewIsolation } from '../server/preview-isolation.js';

function isolatedPreviewEnv(): NodeJS.ProcessEnv {
  const claims = {
    id: previewIsolation.databaseId,
    a: 'rw',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: previewIsolation.branch,
    TURSO_DATABASE_URL: 'libsql://' + previewIsolation.databaseHostname,
    TURSO_AUTH_TOKEN: 'test.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.test',
    BLOB_STORE_ID: previewIsolation.blobStoreId,
  };
}

test('Preview guard rejects resource drift, broader credentials and fallback configuration', () => {
  const valid = isolatedPreviewEnv();
  assert.doesNotThrow(() => assertPreviewIsolation(valid));
  const token = (claims: object) =>
    'test.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.test';
  const claims = { id: previewIsolation.databaseId, a: 'rw', exp: Date.now() / 1000 + 3600 };
  const invalid = [
    { TURSO_DATABASE_URL: undefined },
    { TURSO_DATABASE_URL: 'libsql://production.example.invalid' },
    { TURSO_DATABASE_URL: valid.TURSO_DATABASE_URL + '/other' },
    { TURSO_DATABASE_URL: valid.TURSO_DATABASE_URL + '?token=TEST_ONLY' },
    { TURSO_AUTH_TOKEN: undefined },
    { TURSO_AUTH_TOKEN: 'TEST_ONLY_MALFORMED_TOKEN' },
    { TURSO_AUTH_TOKEN: token({ ...claims, id: 'production' }) },
    { TURSO_AUTH_TOKEN: token({ ...claims, attach: ['production'] }) },
    { TURSO_AUTH_TOKEN: token({ ...claims, exp: 1 }) },
    { TURSO_AUTH_TOKEN: token({ ...claims, a: 'ro' }) },
    { BLOB_STORE_ID: 'store_production' },
    { BLOB_STORE_ID: undefined },
    { BLOB_READ_WRITE_TOKEN: 'TEST_ONLY_FALLBACK' },
    { VERCEL_GIT_COMMIT_REF: 'master' },
    { VERCEL_GIT_COMMIT_REF: undefined },
    { VERCEL_ENV: undefined },
    { VERCEL_ENV: 'unrecognized' },
  ];
  for (const override of invalid)
    assert.throws(
      () => assertPreviewIsolation({ ...valid, ...override }),
      /^Error: Preview isolation configuration rejected$/,
    );
  assert.doesNotThrow(() => assertPreviewIsolation({ VERCEL_ENV: 'production' }));
  assert.doesNotThrow(() => assertPreviewIsolation({}));
});

test('Invalid Preview configuration blocks health, authentication and uploads before any resource initialization', async () => {
  let touched = 0;
  const handler = createApiHandler(
    async () => {
      touched++;
      throw new Error('Must not connect');
    },
    () => {
      touched++;
      return undefined;
    },
    { ...isolatedPreviewEnv(), BLOB_STORE_ID: 'store_production' },
  );
  await withHandler(handler, async (base) => {
    for (const [method, path] of [
      ['GET', '/api/health'],
      ['POST', '/api/auth/login'],
      ['POST', '/api/uploads'],
      ['GET', '/api/preview-isolation'],
    ]) {
      const response = await fetch(base + path, { method });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: 'Preview isolation configuration rejected',
      });
    }
  });
  assert.equal(touched, 0);
});

test('Preview diagnostics are unavailable in Production and reject mutation methods before initialization', async () => {
  let touched = 0;
  const load = async () => {
    touched++;
    throw new Error('Must not connect');
  };
  await withHandler(
    createApiHandler(load, () => undefined, { VERCEL_ENV: 'production' }),
    async (base) => {
      assert.equal((await fetch(base + '/api/preview-isolation')).status, 404);
    },
  );
  await withHandler(
    createApiHandler(load, () => undefined, isolatedPreviewEnv()),
    async (base) => {
      assert.equal((await fetch(base + '/api/preview-isolation', { method: 'POST' })).status, 405);
    },
  );
  assert.equal(touched, 0);
});

async function withHandler(handler: RequestHandler, fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(handler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('/api/health checks connectivity and returns only safe status fields', async () => {
  const bank = await createTestBank();
  try {
    await withHandler(createApp(bank, undefined), async (base) => {
      const health = await fetch(base + '/api/health');
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { status: 'ok', database: 'connected' });
      await bank.close();
      const failed = await fetch(base + '/api/health');
      assert.equal(failed.status, 503);
      assert.deepEqual(await failed.json(), { status: 'error', database: 'unavailable' });
    });
  } catch (error) {
    await bank.close();
    throw error;
  }
});

test('Hosted API blocks anonymous mutations and reports missing durable uploads', async () => {
  const bank = await createTestBank();
  try {
    await withHandler(createApp(bank, undefined), async (base) => {
      for (const [method, path] of [
        ['POST', '/api/questions'],
        ['PUT', '/api/questions/test'],
        ['PATCH', '/api/taxonomy/topics/test'],
        ['DELETE', '/api/taxonomy/topics/test'],
        ['POST', '/api/curriculum/import'],
        ['POST', '/api/revisions/test/review'],
      ])
        assert.equal((await fetch(base + path, { method })).status, 401);
      assert.equal((await fetch(base + '/api/uploads', { method: 'POST' })).status, 401);
      assert.equal((await fetch(base + '/uploads/test.pdf')).status, 503);
      assert.equal((await fetch(base + '/api/questions')).status, 200);
      assert.equal((await fetch(base + '/api/taxonomy')).status, 200);
      assert.equal(Number((await bank.one('SELECT COUNT(*) n FROM image_questions'))!.n), 0);
      assert.equal((await bank.taxonomy()).chapters.length, 0);
    });
  } finally {
    await bank.close();
  }
});

test('Async Express transport errors do not expose stack traces, URLs or secrets', async () => {
  const bank = await createTestBank();
  await bank.close();
  await withHandler(createApp(bank, undefined), async (base) => {
    const response = await fetch(base + '/api/taxonomy');
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Unexpected server error' });
  });
});

test('Vercel handler routes nested API requests without opening SQLite or upload storage', async () => {
  const bank = await createTestBank();
  let connections = 0;
  const handler = createApiHandler(async () => {
    connections++;
    return bank;
  });
  try {
    await withHandler(handler, async (base) => {
      assert.equal((await fetch(base + '/api/health')).status, 200);
      const taxonomy = await (await fetch(base + '/api/taxonomy')).json();
      assert.equal(taxonomy.curriculumVersions.length, 1);
      assert.equal(taxonomy.semesters.length, 2);
      assert.equal(
        (await fetch(base + '/api/questions?semester=semester-1&difficulty=hard')).status,
        200,
      );
      assert.equal(
        (
          await authenticatedFetch(await seedAdminSession(bank, true))(
            base + '/api/curriculum-versions/legacy-matriculation-physics/export',
          )
        ).status,
        200,
      );
      assert.equal((await fetch(base + '/api/unknown')).status, 404);
      assert.equal((await fetch(base + '/api/questions', { method: 'POST' })).status, 401);
      assert.equal(connections, 1);
    });
  } finally {
    await bank.close();
  }
});

test('Vercel handler safely reports failed initialization and retries on the next request', async () => {
  const bank = await createTestBank();
  let attempts = 0;
  const handler = createApiHandler(async () => {
    if (++attempts <= 2) throw new Error('TEST_ONLY credential and connection details');
    return bank;
  });
  try {
    await withHandler(handler, async (base) => {
      const health = await fetch(base + '/api/health');
      assert.equal(health.status, 503);
      assert.deepEqual(await health.json(), { status: 'error', database: 'unavailable' });
      const failed = await fetch(base + '/api/taxonomy');
      assert.equal(failed.status, 503);
      assert.deepEqual(await failed.json(), { error: 'Database unavailable' });
      assert.equal((await fetch(base + '/api/health')).status, 200);
    });
  } finally {
    await bank.close();
  }
});

test('Vercel config routes API/uploads before SPA fallback and includes the TypeScript function', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.equal(config.framework, 'vite');
  assert.equal(config.outputDirectory, 'dist');
  assert.deepEqual(config.rewrites.slice(0, 2), [
    { source: '/api/:path*', destination: '/api' },
    { source: '/uploads/:path*', destination: '/api' },
  ]);
  const spa = new RegExp('^' + config.rewrites[2].source + '$');
  for (const path of ['/', '/curriculum', '/questions/test']) assert.ok(spa.test(path));
  for (const path of ['/api', '/api/health', '/uploads/test.pdf', '/assets/index.js'])
    assert.ok(!spa.test(path));
  assert.ok(readFileSync('api/index.ts', 'utf8').includes('export default createApiHandler()'));
});
