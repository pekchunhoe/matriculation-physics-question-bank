import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../server/app.js';
import { LocalAssetStorage } from '../server/local-asset-storage.js';
import { seedTests } from '../tests/fixtures.js';
const { bank } = await seedTests(),
  uploads = mkdtempSync(join(tmpdir(), 'physics-bank-browser-')),
  app = createApp(bank, new LocalAssetStorage(uploads));
app.use(express.static(resolve('dist')));
app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
const server = app.listen(3100, '127.0.0.1', () =>
  console.log('Temporary test bank: http://127.0.0.1:3100'),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await bank.close();
      rmSync(uploads, { recursive: true, force: true });
      process.exit(0);
    }),
  );
