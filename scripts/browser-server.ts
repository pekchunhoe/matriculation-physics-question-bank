import express from 'express';
import {
  mkdirSync,
  rmSync,
  readdirSync,
  lstatSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { createApp } from '../server/app.js';
import { LocalAssetStorage } from '../server/local-asset-storage.js';
import { setup } from '../tests/fixtures.js';
import { seedAdminSession, testEmail } from '../tests/auth-fixture.js';
import { imageFile } from '../tests/image-fixture.js';
import { ImageQuestionService } from '../server/image-questions.js';
import { validAssetKey } from '../shared/asset-reference.js';
// A fixed, explicitly owned test directory bounds growth even if Windows force-kills the server.
const workspace = resolve(import.meta.dirname, '..'),
  uploads = resolve(workspace, 'data/test-runtime/browser-uploads');
if (relative(workspace, uploads) !== join('data', 'test-runtime', 'browser-uploads'))
  throw new Error('Unsafe test upload directory');
for (const path of [join(workspace, 'data'), join(workspace, 'data/test-runtime'), uploads])
  if (existsSync(path) && lstatSync(path).isSymbolicLink())
    throw new Error('Test storage refuses links');
const marker = join(uploads, '.test-only'),
  markerText = 'Disposable browser-test images; never production storage.\n';
if (existsSync(uploads)) {
  if (!existsSync(marker) || readFileSync(marker, 'utf8') !== markerText)
    throw new Error('Unidentified test directory; refusing cleanup');
  for (const name of readdirSync(uploads)) {
    const path = join(uploads, name);
    if (
      !lstatSync(path).isFile() ||
      lstatSync(path).isSymbolicLink() ||
      (name !== '.test-only' && !validAssetKey(name))
    )
      throw new Error('Unexpected persistent data in test storage');
  }
  for (const name of readdirSync(uploads)) if (name !== '.test-only') rmSync(join(uploads, name));
} else {
  mkdirSync(uploads, { recursive: true });
  writeFileSync(marker, markerText);
}
const { bank, fixture, c1 } = await setup(),
  app = createApp(bank, new LocalAssetStorage(uploads));
await seedAdminSession(bank);
const storage = new LocalAssetStorage(uploads),
  service = new ImageQuestionService(bank, storage);
const actor = String((await bank.one('SELECT id FROM admins WHERE email=?', testEmail))!.id);
await bank.run('UPDATE chapters SET sort_order=2 WHERE id=?', c1);
const c10 = await bank.addTaxon('chapters', 'TEST ONLY Chapter 10', 'semester-1', true),
  t10 = await bank.addTaxon('topics', 'TEST ONLY Topic 10', c10, true),
  s10 = await bank.addTaxon('subtopics', 'TEST ONLY Subtopic 10', t10, true);
await bank.run('UPDATE chapters SET sort_order=10 WHERE id=?', c10);
const normal = { question: await imageFile(), answer: await imageFile('TEST ONLY ANSWER') };
for (let i = 0; i < 50; i++) {
  const pair =
    i === 0
      ? {
          question: await imageFile('TEST ONLY TALL QUESTION', 4000),
          answer: await imageFile('TEST ONLY TALL ANSWER', 5000),
        }
      : i === 1
        ? {
            question: await imageFile('TEST ONLY JPEG', 600, 'jpeg'),
            answer: await imageFile('TEST ONLY WEBP', 700, 'webp'),
          }
        : normal;
  const metadata = {
    ...fixture(),
    ...(i >= 25 ? { chapterId: c10, topicId: t10, subtopicId: s10 } : {}),
    ...(i % 2 === 0 ? { subtopicId: null } : {}),
  };
  const q = (await service.save(undefined, metadata, pair, actor)).question;
  await service.status(q.id, { status: 'approved', expectedRevision: 1, confirmed: true }, actor);
}
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
