import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { imageEnvironment } from './image-fixture.js';
import { authenticatedFetch } from './auth-fixture.js';
import { seedStudentSession } from './student-fixture.js';

test('Paired multipart API persists drafts, denies student writes and protects all asset roles', async () => {
  const e = await imageEnvironment(),
    server = createApp(e.bank, e.storage).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`,
    admin = authenticatedFetch(e.cookie),
    student = authenticatedFetch(await seedStudentSession(e.bank));
  const body = () => {
    const f = new FormData();
    f.set('metadata', JSON.stringify(e.fixture()));
    for (const role of ['question', 'answer'] as const)
      f.set(
        role,
        new Blob([new Uint8Array(e.pair[role].buffer)], { type: 'image/png' }),
        role + '.png',
      );
    return f;
  };
  try {
    for (const [method, path] of [
      ['POST', '/questions'],
      ['PUT', '/questions/any'],
      ['PATCH', '/questions/any/status'],
      ['DELETE', '/questions/any'],
      ['POST', '/taxonomy/subtopics'],
      ['POST', '/curriculum/import'],
      ['POST', '/questions/import'],
    ])
      assert.equal((await fetch(base + '/api' + path, { method })).status, 401);
    assert.equal(
      (
        await fetch(base + '/api/questions', {
          method: 'POST',
          headers: { Cookie: e.cookie },
          body: body(),
        })
      ).status,
      403,
    );
    const save = await admin(base + '/api/questions', { method: 'POST', body: body() });
    assert.equal(save.status, 201, await save.clone().text());
    const q = (await save.json()).question;
    assert.equal((await fetch(base + '/api/questions/' + q.id)).status, 401);
    assert.equal((await student(base + '/api/questions/' + q.id)).status, 404);
    assert.equal((await student(base + '/api/counts').then((r) => r.json())).length, 0);
    for (const url of [q.questionImage.url, q.answerImage.url, q.questionImage.thumbnailUrl]) {
      assert.equal((await fetch(base + url)).status, 401);
      assert.equal((await student(base + url)).status, 404);
      const r = await admin(base + url);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(r.headers.get('cache-control'), 'private, no-store');
    }
    const published = await admin(base + '/api/questions/' + q.id + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', expectedRevision: 1, confirmed: true }),
    });
    assert.equal(published.status, 200);
    assert.equal((await student(base + '/api/counts').then((r) => r.json()))[0].count, 1);
    assert.equal((await student(base + '/api/public/question-set?ids=' + q.id)).status, 200);
    assert.equal((await fetch(base + '/api/questions/' + q.id + '/versions')).status, 401);
    assert.equal((await fetch(base + '/api/admin/legacy-questions')).status, 401);
    assert.equal((await fetch(base + q.answerImage.url)).status, 401);
    assert.equal((await student(base + q.answerImage.url)).status, 200);
    await e.bank.run('UPDATE image_questions SET revision=99 WHERE id=?', q.id);
    assert.deepEqual(await student(base + '/api/counts').then((r) => r.json()), []);
    assert.equal((await student(base + '/api/public/question-set?ids=' + q.id)).status, 409);
    for (const path of ['/questions/import', '/uploads', '/question-json-import'])
      assert.equal((await admin(base + '/api' + path, { method: 'POST' })).status, 404);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await e.close();
  }
});
