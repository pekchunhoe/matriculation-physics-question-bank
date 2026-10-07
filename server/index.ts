import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Bank } from './database.js';
import { createApp } from './app.js';

const data = resolve(process.env.BANK_DATA_DIR ?? 'data');
mkdirSync(data, { recursive: true });
const bank = new Bank(resolve(data, 'bank.sqlite'));
const app = createApp(bank, resolve(data, 'uploads'));
if (process.env.NODE_ENV === 'production' || process.argv.includes('--production')) {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const server = app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1', () =>
  console.log('Question Bank: http://127.0.0.1:' + (process.env.PORT ?? 3000)),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      bank.close();
      process.exit(0);
    }),
  );
