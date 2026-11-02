import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { gzipSync, deflateSync } from 'node:zlib';
import express from 'express';

// Exercise the parser reached through Express, rather than an unrelated direct install.
// GHSA-27r3-jxmh-p828: late bytes after a valid compressed frame must not crash Node.
for (const [encoding, compress] of [
  ['gzip', gzipSync],
  ['deflate', deflateSync],
] as const)
  test(`Express survives trailing bytes after a ${encoding} JSON body and keeps serving requests`, async () => {
    const app = express();
    app.use(express.json({ limit: '4kb' }));
    app.post('/echo', (req, res) => res.json(req.body));
    app.get('/health', (_req, res) => res.json({ ok: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    try {
      const payload = { message: 'TEST ONLY compressed JSON' };
      const body = Buffer.concat([
        compress(Buffer.from(JSON.stringify(payload))),
        Buffer.from([0]),
        Buffer.alloc(100 * 1024, 0x58),
      ]);
      const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const client = request(
          {
            host: '127.0.0.1',
            port: address.port,
            path: '/echo',
            method: 'POST',
            agent: false,
            headers: {
              'Content-Type': 'application/json',
              'Content-Encoding': encoding,
              'Content-Length': body.length,
            },
          },
          (res) => {
            let text = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => (text += chunk));
            res.on('error', reject);
            res.on('end', () => resolve({ status: res.statusCode!, body: text }));
          },
        );
        client.on('error', reject);
        client.setTimeout(3000, () =>
          client.destroy(new Error('Local parser regression timed out')),
        );
        client.end(body);
      });
      assert.equal(response.status, 200);
      assert.deepEqual(JSON.parse(response.body), payload);
      // Decoder errors arrive after the response: also prove continued availability.
      await delay(200);
      const healthy = await fetch(`http://127.0.0.1:${address.port}/health`);
      assert.equal(healthy.status, 200);
      assert.deepEqual(await healthy.json(), { ok: true });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

test('The Blob OIDC dependency uses patched Zod without changing config parsing or request-context tokens', () => {
  const require = createRequire(import.meta.url);
  const fromBlob = createRequire(require.resolve('@vercel/blob'));
  const fromOidc = createRequire(fromBlob.resolve('@vercel/oidc'));
  const fromConfig = createRequire(fromOidc.resolve('@vercel/cli-config'));
  const zod = fromConfig('zod') as typeof import('zod');
  assert.equal(zod, require('zod'), 'The pinned vulnerable nested copy must not survive');
  const config = fromOidc('@vercel/cli-config') as {
    parseGlobalConfig: (value: unknown) => unknown;
    parseAuthFileConfig: (value: unknown) => unknown;
  };
  const input = { currentTeam: 'TEST_ONLY', telemetry: { enabled: false }, credStorage: 'file' };
  assert.deepEqual(config.parseGlobalConfig(input), input);
  assert.throws(() => config.parseGlobalConfig({ telemetry: { enabled: 'invalid' } }));
  assert.deepEqual(config.parseAuthFileConfig({ token: 'TEST_ONLY', tokenSource: 'env' }), {
    token: 'TEST_ONLY',
  });
  const oidc = fromBlob('@vercel/oidc') as { getVercelOidcTokenSync: () => string };
  const contextKey = Symbol.for('@vercel/request-context');
  const globalContext = globalThis as Record<symbol, unknown>;
  const before = globalContext[contextKey];
  try {
    globalContext[contextKey] = {
      get: () => ({ headers: { 'x-vercel-oidc-token': 'TEST_ONLY_REQUEST_CONTEXT' } }),
    };
    assert.equal(oidc.getVercelOidcTokenSync(), 'TEST_ONLY_REQUEST_CONTEXT');
  } finally {
    if (before === undefined) delete globalContext[contextKey];
    else globalContext[contextKey] = before;
  }
});
