import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { LocalAssetStorage } from '../server/local-asset-storage.js';
import { setup, seedTests } from './fixtures.js';
import type { QuestionDocument } from '../shared/schema.js';
async function withApi(
  fn: (env: {
    base: string;
    fixture: Awaited<ReturnType<typeof setup>>['fixture'];
    bank: Awaited<ReturnType<typeof setup>>['bank'];
    momentum: string;
  }) => Promise<void>,
  seed = false,
) {
  const env = seed ? await seedTests() : await setup(),
    dir = mkdtempSync(join(tmpdir(), 'physics-bank-api-')),
    app = createApp(env.bank, new LocalAssetStorage(dir)),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  try {
    await fn({ ...env, base: `http://127.0.0.1:${addr.port}` });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    await env.bank.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
const body = (data: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
test('HTTP browse combines semester/topic/difficulty/search and returns only a page of summaries', async () =>
  withApi(async ({ base, momentum }) => {
    const r = await fetch(
      base +
        '/api/questions?semester=semester-1&topic=' +
        momentum +
        '&difficulty=hard&q=collision&limit=1',
    );
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.total, 1);
    assert.equal(result.items.length, 1);
    assert.ok(!('parts' in result.items[0]));
    assert.ok(!('solutions' in result.items[0]));
  }, true));
test('Student API excludes solutions, teacher notes, marking points and answer assets, including history', async () =>
  withApi(async ({ base, fixture, bank }) => {
    const doc = fixture('TEST-STUDENT');
    doc.assets = [
      {
        id: 'answer',
        partId: 'part-a',
        kind: 'answer_diagram',
        url: 'https://example.org/private-answer.svg',
        alt: 'PRIVATE ANSWER DIAGRAM',
        mime: 'image/svg+xml',
        order: 0,
      },
      {
        id: 'original',
        partId: null,
        kind: 'original_pdf',
        url: 'https://example.org/private-master.pdf',
        alt: 'PRIVATE MASTER',
        mime: 'application/pdf',
        order: 0,
      },
    ];
    const { id } = await bank.create(doc, 'Test', null, true);
    for (const query of ['?view=student', '?view=student&version=1']) {
      const response = await fetch(base + '/api/questions/' + id + query);
      const text = await response.text();
      for (const secret of [
        'PRIVATE TEACHER NOTE',
        'PRIVATE MARKING POINT',
        'PRIVATE ANSWER DIAGRAM',
        'PRIVATE MASTER',
        'TEST ONLY solution',
      ])
        assert.ok(!text.includes(secret));
      const result = JSON.parse(text);
      assert.equal(result.document.solutions.length, 0);
      assert.equal(result.document.assets.length, 0);
      assert.equal(result.document.hints.length, 2);
    }
    const teacher = await fetch(base + '/api/questions/' + id);
    assert.ok((await teacher.text()).includes('PRIVATE TEACHER NOTE'));
  }));
test('HTTP import validates first, rejects duplicates, and queues approved replacements', async () =>
  withApi(async ({ base, fixture, bank }) => {
    const doc = fixture('TEST-HTTP-IMPORT');
    const validate = await fetch(base + '/api/import/validate', {
      method: 'POST',
      ...body({ document: doc }),
    });
    assert.equal(validate.status, 200);
    assert.equal((await bank.list()).total, 0);
    const created = await fetch(base + '/api/import', {
      method: 'POST',
      ...body({ document: doc, note: 'Initial', confirmApproval: true }),
    });
    assert.equal(created.status, 201);
    const { id } = await created.json();
    const duplicate = await fetch(base + '/api/import', {
      method: 'POST',
      ...body({ document: doc, note: 'Duplicate', confirmApproval: true }),
    });
    assert.equal(duplicate.status, 409);
    doc.question.title = 'TEST ONLY changed title';
    const revision = await fetch(base + '/api/import', {
      method: 'POST',
      ...body({
        document: doc,
        note: 'Revision',
        questionId: id,
        baseVersion: 1,
        author: 'Author',
      }),
    });
    const pending = await revision.json();
    assert.equal(pending.pending, true);
    assert.notEqual((await bank.document(id)).question.title, doc.question.title);
    const malformed = await fetch(base + '/api/revisions/' + pending.candidateId + '/review', {
      method: 'POST',
      ...body({ approve: 'yes', reviewer: 'Teacher' }),
    });
    assert.equal(malformed.status, 400);
    const approved = await fetch(base + '/api/revisions/' + pending.candidateId + '/review', {
      method: 'POST',
      ...body({ approve: true, reviewer: 'Teacher' }),
    });
    assert.equal(approved.status, 200);
    assert.equal((await bank.document(id)).question.title, doc.question.title);
  }));
test('Malformed JSON and invalid import structure fail clearly without partial writes', async () =>
  withApi(async ({ base, bank, fixture }) => {
    const malformed = await fetch(base + '/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(malformed.status, 400);
    const doc = fixture('TEST-BAD-HTTP');
    doc.question.totalMarks = 0;
    const invalid = await fetch(base + '/api/import', {
      method: 'POST',
      ...body({ document: doc, note: 'Invalid', confirmApproval: true }),
    });
    assert.equal(invalid.status, 400);
    assert.ok((await invalid.json()).error.includes('totalMarks'));
    assert.equal((await bank.list()).total, 0);
    assert.equal((await fetch(base + '/api/no-such-route')).status, 404);
  }));
test('Uploads validate signatures and SVG content, and imports require existing matching assets', async () =>
  withApi(async ({ base, fixture, bank }) => {
    const upload = async (text: string, name: string) => {
      const data = new FormData();
      data.append('file', new Blob([text]), name);
      return fetch(base + '/api/uploads', { method: 'POST', body: data });
    };
    assert.equal((await upload('not a file', 'bad.pdf')).status, 400);
    assert.equal(
      (
        await upload(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
          'bad.svg',
        )
      ).status,
      400,
    );
    const result = await upload(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><marker id="arrow"><path d="M0 0L1 1"/></marker></defs><path d="M0 0L10 10" marker-end="url(#arrow)"/></svg>',
      'test.svg',
    );
    assert.equal(result.status, 201);
    const asset = await result.json();
    const doc = fixture('TEST-ASSET');
    doc.assets = [
      {
        id: 'svg',
        partId: null,
        kind: 'physics_diagram',
        url: asset.url,
        alt: 'TEST ONLY schematic',
        mime: asset.mime,
        order: 0,
      },
    ];
    const created = await fetch(base + '/api/questions', {
      method: 'POST',
      ...body({ document: doc, note: 'Asset', confirmApproval: true }),
    });
    assert.equal(created.status, 201);
    const { id } = await created.json();
    const response = await fetch(base + asset.url);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('content-security-policy')?.includes('sandbox'));
    assert.ok((await response.text()).includes('marker-end="url(#arrow)"'));
    assert.equal(
      (
        await upload(
          '<svg xmlns="http://www.w3.org/2000/svg"><image href=https://example.org/image.png /></svg>',
          'external.svg',
        )
      ).status,
      400,
    );
    const wrongMime = structuredClone(doc);
    wrongMime.question.questionCode = 'TEST-WRONG-MIME';
    wrongMime.assets[0].mime = 'image/jpeg';
    assert.equal(
      (
        await fetch(base + '/api/questions', {
          method: 'POST',
          ...body({ document: wrongMime, note: 'Invalid MIME', confirmApproval: true }),
        })
      ).status,
      400,
    );
    const saved = await bank.document(id);
    assert.deepEqual(saved.assets, doc.assets);
    const bad = structuredClone(doc);
    bad.question.questionCode = 'TEST-MISSING-ASSET';
    bad.assets[0].url = '/uploads/missing.svg';
    assert.equal(
      (
        await fetch(base + '/api/questions', {
          method: 'POST',
          ...body({ document: bad, note: 'Bad asset', confirmApproval: true }),
        })
      ).status,
      400,
    );
  }));
test('Cross-origin writes are rejected and future PDF extraction remains explicitly unavailable', async () =>
  withApi(async ({ base, fixture, bank }) => {
    const doc = fixture('TEST-PDF-API');
    const blocked = await fetch(base + '/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
      body: JSON.stringify({ document: doc, note: 'Blocked', confirmApproval: true }),
    });
    assert.equal(blocked.status, 403);
    const { id } = await bank.create(doc, 'Initial', null, true);
    const pdf = await fetch(base + '/api/questions/' + id + '/pdf-revision', {
      method: 'POST',
      ...body({ pdfUrl: '/uploads/test.pdf', note: 'Future', author: 'Teacher', baseVersion: 1 }),
    });
    assert.equal(pdf.status, 501);
    assert.equal((await bank.current(id)).active_version, 1);
  }));
test('Exports roundtrip through the versioned structured import validator', async () =>
  withApi(async ({ base, fixture, bank }) => {
    const original = fixture('TEST-EXPORT');
    const { id } = await bank.create(original, 'Export', null, true);
    const response = await fetch(base + '/api/questions/' + id + '/export');
    const doc = (await response.json()) as QuestionDocument;
    assert.deepEqual(doc, original);
    assert.ok(response.headers.get('content-disposition')?.includes('.json'));
    assert.deepEqual(await bank.resolveImport(doc), original);
    const versions = await fetch(base + '/api/questions/' + id + '/versions');
    assert.equal((await versions.json()).length, 1);
  }));
