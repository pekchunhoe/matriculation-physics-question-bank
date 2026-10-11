import { test as base, expect } from '@playwright/test';
import express from 'express';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createApp } from '../../server/app.js';
import { LocalAssetStorage } from '../../server/local-asset-storage.js';
import { setup } from '../fixtures.js';
import { seedAdminSession } from '../auth-fixture.js';
import type { Bank } from '../../server/database.js';

type Fixture = { origin: string; cookie: string; bank: Bank };
export const test = base.extend<{ importFixture: Fixture }>({
  importFixture: async ({ browserName }, use) => {
    const { bank } = await setup(),
      dir = mkdtempSync(join(tmpdir(), `question-json-${browserName}-browser-`));
    const cookie = await seedAdminSession(bank),
      app = createApp(bank, new LocalAssetStorage(dir));
    app.use(express.static(resolve('dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Isolated browser server unavailable');
    try {
      await use({ origin: `http://127.0.0.1:${address.port}`, cookie, bank });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
      await bank.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
  baseURL: async ({ importFixture }, use) => use(importFixture.origin),
  storageState: async ({ importFixture }, use) =>
    use({
      cookies: [
        {
          name: 'qb_admin',
          value: importFixture.cookie.slice('qb_admin='.length),
          domain: '127.0.0.1',
          path: '/',
          expires: Date.now() / 1000 + 3600,
          httpOnly: true,
          secure: false,
          sameSite: 'Strict',
        },
      ],
      origins: [],
    }),
  extraHTTPHeaders: async ({ importFixture }, use) =>
    use({ Origin: importFixture.origin, 'X-Question-Bank-Request': '1' }),
});
export { expect };
