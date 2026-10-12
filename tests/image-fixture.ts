import sharp from 'sharp';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup } from './fixtures.js';
import { seedAdminSession, testEmail } from './auth-fixture.js';
import { LocalAssetStorage } from '../server/local-asset-storage.js';
import { ImageQuestionService } from '../server/image-questions.js';
import type { Bank } from '../server/database.js';

/** Synthetic raster fixtures only. Never reads an environment database. */
export async function imageFile(
  label = 'TEST ONLY QUESTION',
  height = 600,
  format: 'png' | 'jpeg' | 'webp' = 'png',
) {
  const lines = Array.from(
    { length: Math.floor(height / 100) },
    (_, i) => `<text x="30" y="${60 + i * 100}" font-size="22">${label} - line ${i + 1}</text>`,
  ).join('');
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${height}"><rect width="100%" height="100%" fill="white"/>${lines}<rect x="20" y="${height - 15}" width="760" height="5" fill="blue"/></svg>`,
  );
  return {
    buffer: await sharp(svg)[format]().toBuffer(),
    originalname: `test.${format}`,
    mimetype: `image/${format}`,
  };
}
export async function imageEnvironment(existing?: Bank) {
  const env = await setup(existing),
    directory = mkdtempSync(join(tmpdir(), 'qb-image-test-'));
  const storage = new LocalAssetStorage(directory),
    service = new ImageQuestionService(env.bank, storage);
  const cookie = await seedAdminSession(env.bank),
    actor = String((await env.bank.one('SELECT id FROM admins WHERE email=?', testEmail))!.id);
  const pair = { question: await imageFile(), answer: await imageFile('TEST ONLY ANSWER') };
  return {
    ...env,
    directory,
    storage,
    service,
    cookie,
    actor,
    pair,
    create: () => service.save(undefined, env.fixture(), pair, actor),
    close: async () => {
      await env.bank.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
