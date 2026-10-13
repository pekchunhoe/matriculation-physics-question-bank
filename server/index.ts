import { resolve } from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { connectRuntimeBank } from './runtime.js';
import { createApp } from './app.js';
import { LocalAssetStorage } from './local-asset-storage.js';

const data = resolve(process.env.BANK_DATA_DIR ?? 'data');
const bank = await connectRuntimeBank().catch(() => {
  console.error(
    'Question Bank startup failed: check server credentials, connectivity and schema migrations',
  );
  process.exit(1);
});
const production = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const app = createApp(bank, new LocalAssetStorage(resolve(data, 'uploads')), {
  development: !production,
});
if (production) {
  app.get('/verify-email', (_req, res) => res.sendFile(resolve('dist/verify-email.html')));
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  app.use('/verify-email', (req, _res, next) => {
    req.url = '/verify-email.html';
    next();
  });
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const server = app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1', () =>
  console.log('Question Bank: http://127.0.0.1:' + (process.env.PORT ?? 3000)),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await bank.close();
      process.exit(0);
    }),
  );
