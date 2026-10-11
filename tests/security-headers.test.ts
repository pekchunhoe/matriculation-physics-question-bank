import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../server/app.js';
import { createApiHandler } from '../server/vercel-handler.js';
import { securityHeaders, contentSecurityPolicy } from '../server/security-headers.js';
import { createTestBank } from './test-bank.js';
import { seedAdminSession, authenticatedFetch } from './auth-fixture.js';
import express, { type RequestHandler } from 'express';

async function serve(handler: RequestHandler, run: (base: string) => Promise<void>) {
  const app = express();
  app.use(handler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    await run('http://127.0.0.1:' + address.port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function hardened(response: Response) {
  for (const [key, value] of Object.entries(securityHeaders))
    assert.equal(response.headers.get(key), value, key);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
}

test('Public API, authenticated sensitive API and rejected mutations retain security headers and no-store', async () => {
  const bank = await createTestBank();
  const session = await seedAdminSession(bank);
  try {
    await serve(createApp(bank, undefined), async (base) => {
      for (const response of [
        await fetch(base + '/api/health'),
        await authenticatedFetch(session)(base + '/api/auth/session'),
        await fetch(base + '/api/questions', { method: 'POST' }),
      ]) {
        hardened(response);
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
        assert.equal(response.headers.get('location'), null);
      }
    });
  } finally {
    await bank.close();
  }
});

test('Cold-start database failures retain security headers and cannot be cached', async () => {
  await serve(
    createApiHandler(async () => {
      throw new Error('TEST ONLY startup failure');
    }),
    async (base) => {
      const response = await fetch(base + '/api/health');
      assert.equal(response.status, 503);
      hardened(response);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    },
  );
});

test('Vercel static headers match the server policy without overriding sandboxed uploads', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const documents = config.headers[0];
  assert.deepEqual(
    Object.fromEntries(
      documents.headers.map((h: { key: string; value: string }) => [h.key, h.value]),
    ),
    securityHeaders,
  );
  const match = new RegExp('^' + documents.source + '$');
  for (const path of ['/', '/admin/login', '/curriculum', '/question-set', '/assets/index.js'])
    assert.ok(match.test(path));
  for (const path of ['/uploads/test.svg', '/uploads', '/api/health', '/api'])
    assert.ok(!match.test(path));
  const privateRoutes = new RegExp('^' + config.headers[1].source + '$');
  for (const path of ['/admin/login', '/edit/new', '/import', '/import/question-json'])
    assert.ok(privateRoutes.test(path));
  assert.equal(config.headers[1].headers[0].value, 'private, no-store');
  assert.ok(!contentSecurityPolicy.includes('unsafe-eval'));
  assert.ok(!contentSecurityPolicy.includes("script-src 'self' 'unsafe-inline'"));
  assert.ok(!contentSecurityPolicy.includes('*'));
});

test('Canonical host and every configured rewrite stay on the application origin', () => {
  const html = readFileSync('index.html', 'utf8');
  const canonical = /rel="canonical" href="([^"]+)"/.exec(html)?.[1];
  assert.equal(canonical, 'https://matriculation-physics-question-bank.vercel.app/');
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.equal(config.redirects, undefined);
  for (const route of config.rewrites) {
    assert.ok(route.destination.startsWith('/') && !route.destination.startsWith('//'));
    assert.equal(new URL(route.destination, canonical).origin, new URL(canonical!).origin);
  }
});

test('Hosted mode always enforces CSP even if development was requested', async () => {
  const bank = await createTestBank();
  try {
    await serve(createApp(bank, undefined, { hosted: true, development: true }), async (base) => {
      const response = await fetch(base + '/api/health');
      hardened(response);
      assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000');
    });
  } finally {
    await bank.close();
  }
});
