import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup } from './fixtures.js';
import { seedAdminSession, authenticatedFetch, testEmail } from './auth-fixture.js';
import { QuestionJsonImportService } from '../server/question-json-import.js';
import { questionPackageSchema, importManifestSchema } from '../shared/question-import.js';
import { createApp } from '../server/app.js';
import { LocalAssetStorage } from '../server/local-asset-storage.js';
import { AssetConsistencyError, AssetService } from '../server/asset-service.js';
import {
  AssetStorageError,
  type AssetStorage,
  type StoredUpload,
  type ValidatedUpload,
} from '../server/asset-storage.js';
import { newAssetKey } from '../server/asset-storage.js';
import {
  examplePackage,
  localPackage,
  splitPackage,
  nestedPackage,
} from './question-import-fixture.js';
import type { AdminIdentity } from '../server/auth.js';

class TestStorage implements AssetStorage {
  readonly kind = 'local' as const;
  objects = new Map<string, { metadata: StoredUpload; bytes: Buffer }>();
  puts = 0;
  reads = 0;
  deleted: string[] = [];
  failDelete = false;
  failPutAt = 0;
  async put(upload: ValidatedUpload) {
    if (++this.puts === this.failPutAt) throw new AssetStorageError('Test upload unavailable');
    const key = newAssetKey(upload),
      metadata = {
        key,
        url: '/uploads/' + key,
        mime: upload.mime,
        size: upload.bytes.length,
        sha256: upload.sha256,
        name: upload.displayName,
        uploadedAt: new Date(),
      };
    this.objects.set(key, { metadata, bytes: Buffer.from(upload.bytes) });
    return metadata;
  }
  async get(key: string) {
    this.reads++;
    return this.objects.get(key);
  }
  async metadata(key: string) {
    return this.objects.get(key)?.metadata;
  }
  async exists(key: string) {
    return this.objects.has(key);
  }
  async delete(key: string) {
    if (this.failDelete) throw new Error('TEST cleanup');
    this.deleted.push(key);
    this.objects.delete(key);
  }
}
async function environment(visual = false, nested = false) {
  const { bank } = await setup();
  await seedAdminSession(bank);
  const row = await bank.one('SELECT id FROM admins WHERE email=?', testEmail);
  const admin: AdminIdentity = { id: String(row!.id), email: testEmail, role: 'admin' };
  const storage = new TestStorage(),
    service = new QuestionJsonImportService(bank, storage);
  const doc = await localPackage(bank, visual);
  if (nested) nestedPackage(doc);
  return { bank, admin, storage, service, ...splitPackage(doc) };
}

test('official no-part and synthetic visual examples validate against the canonical package schema', () => {
  for (const visual of [false, true])
    assert.equal(questionPackageSchema.safeParse(examplePackage(visual)).success, true);
});

const invalidCases: [string, (doc: Record<string, unknown>) => void, RegExp][] = [
  [
    'unsupported version',
    (d) => {
      d.schemaVersion = 99;
    },
    /schemaVersion/,
  ],
  [
    'unknown kind',
    (d) => {
      d.kind = 'bulk';
    },
    /kind/,
  ],
  [
    'unknown field',
    (d) => {
      d.extra = 'educational content';
    },
    /Unrecognized key/,
  ],
  [
    'publication status',
    (d) => {
      (d.question as Record<string, unknown>).status = 'approved';
    },
    /status/,
  ],
  [
    'negative marks',
    (d) => {
      (d.question as Record<string, unknown>).totalMarks = -1;
    },
    /totalMarks/,
  ],
  [
    'fractional marks',
    (d) => {
      (d.question as Record<string, unknown>).totalMarks = 2.5;
    },
    /totalMarks/,
  ],
  [
    'scheme mismatch',
    (d) => {
      (d.question as Record<string, unknown>).totalMarks = 3;
    },
    /steps/,
  ],
  [
    'invalid math',
    (d) => {
      (d.question as Record<string, unknown>).scenario = '$\\frac{1}{2$';
    },
    /scenario/,
  ],
  [
    'unmatched delimiter',
    (d) => {
      (d.question as Record<string, unknown>).scenario = 'Unclosed $x';
    },
    /delimiter/,
  ],
  [
    'unmatched braces',
    (d) => {
      (d.question as Record<string, unknown>).scenario = '$x^{2$';
    },
    /LaTeX/,
  ],
  [
    'source code semester',
    (d) => {
      (d.classification as Record<string, unknown>).semester = 'SP015';
    },
    /semester/,
  ],
  [
    'multiple questions',
    (d) => {
      d.questions = [];
    },
    /questions/,
  ],
];
for (const [name, mutate, expected] of invalidCases)
  test(`package rejects ${name} with an actionable path`, () => {
    const doc = examplePackage() as unknown as Record<string, unknown>;
    mutate(doc);
    const result = questionPackageSchema.safeParse(doc);
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.error.message, expected);
  });

for (const [name, mutate, path] of [
  [
    'unknown asset role',
    (d: ReturnType<typeof examplePackage>) => {
      d.assets[0].role = 'unknown' as never;
    },
    /role/,
  ],
  [
    'oversized asset',
    (d: ReturnType<typeof examplePackage>) => {
      d.assets[0].byteLength = 4 * 1024 * 1024;
    },
    /byteLength/,
  ],
  [
    'invalid Base64',
    (d: ReturnType<typeof examplePackage>) => {
      d.assets[0].dataBase64 = 'data:image/png;base64,bad';
    },
    /dataBase64/,
  ],
  [
    'missing placement',
    (d: ReturnType<typeof examplePackage>) => {
      d.question.blocks = [];
    },
    /explicit image/,
  ],
  [
    'answer FBD in question',
    (d: ReturnType<typeof examplePackage>) => {
      d.question.blocks = [{ type: 'image', assetId: 'answer-fbd' }];
    },
    /Answer diagrams/,
  ],
] as const)
  test(`portable assets reject ${name}`, () => {
    const doc = examplePackage(true);
    mutate(doc);
    const result = questionPackageSchema.safeParse(doc);
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.error.message, path);
  });

test('validate performs no writes or Blob calls; no-part import creates one draft and immutable initial version', async () => {
  const e = await environment();
  try {
    const before = await e.bank.all('SELECT * FROM questions');
    const preview = await e.service.validate(e.manifest, e.admin, 'Easy');
    assert.deepEqual(await e.bank.all('SELECT * FROM questions'), before);
    assert.equal(e.storage.puts, 0);
    assert.equal(e.storage.reads, 0);
    assert.deepEqual(preview.marks, { question: 2, parts: 2, markingScheme: 2 });
    const created = await e.service.commit(e.manifest, preview.token, [], e.admin, 'Easy');
    assert.equal((await e.bank.current(created.id)).status, 'draft');
    const saved = await e.bank.document(created.id);
    assert.deepEqual(saved.parts, []);
    assert.equal(saved.solutions[0].partId, null);
    assert.equal(
      saved.solutions[0].steps[0].equationLatex,
      e.manifest.solutions[0].steps[0].equationLatex,
    );
    assert.equal((await e.bank.all('SELECT * FROM solutions')).length, 1);
    assert.equal((await e.bank.all('SELECT * FROM question_content_blocks')).length, 2);
    assert.equal((await e.bank.versions(created.id)).length, 1);
    assert.ok(await e.bank.savedClassification(created.id));
    await assert.rejects(
      e.bank.run('UPDATE question_versions SET snapshot=snapshot WHERE question_id=?', created.id),
      /immutable/,
    );
    assert.equal(e.storage.puts, 0);
    assert.equal(e.storage.reads, 0);
    assert.deepEqual(await e.bank.all('PRAGMA foreign_key_check'), []);
  } finally {
    await e.bank.close();
  }
});

test('nested parts allocate parent marks once, persist flat parent links, and bind part hints', async () => {
  const e = await environment(false, true);
  try {
    e.manifest.hints[0].partId = 'ai';
    const p = await e.service.validate(e.manifest, e.admin, 'Easy');
    const r = await e.service.commit(e.manifest, p.token, [], e.admin, 'Easy');
    const saved = await e.bank.document(r.id);
    assert.equal(saved.parts[1].parentId, 'a');
    assert.equal(saved.hints[0].partId, 'ai');
    assert.deepEqual(p.marks, { question: 2, parts: 2, markingScheme: 2 });
    e.manifest.parts[0].marks = 3;
    await assert.rejects(
      e.service.validate(e.manifest, e.admin, 'Easy'),
      /Parent marks|totalMarks/,
    );
  } finally {
    await e.bank.close();
  }
});

for (const field of ['curriculumVersionCode', 'chapter', 'topic', 'subtopic'] as const)
  test(`classification rejects missing/exact-mismatched ${field} without writes`, async () => {
    const e = await environment();
    try {
      e.manifest.classification[field] = 'Nonexistent';
      await assert.rejects(
        e.service.validate(e.manifest, e.admin, 'Easy'),
        new RegExp('classification.' + field),
      );
      assert.equal((await e.bank.list()).total, 0);
    } finally {
      await e.bank.close();
    }
  });
test('exact matching rejects normalized names and hierarchy mismatches; difficulty is exact', async () => {
  const e = await environment();
  try {
    e.manifest.classification.topic = e.manifest.classification.topic.toLowerCase();
    await assert.rejects(e.service.validate(e.manifest, e.admin, 'Easy'), /classification.topic/);
    e.manifest.classification.topic = 'TEST ONLY Momentum';
    e.manifest.classification.semester = 'Semester 2';
    await assert.rejects(e.service.validate(e.manifest, e.admin, 'Easy'), /classification.chapter/);
    e.manifest.classification.semester = 'Semester 1';
    await assert.rejects(e.service.validate(e.manifest, e.admin, 'easy'), /selectedDifficulty/);
  } finally {
    await e.bank.close();
  }
});

test('changed manifest, tampered token, stale curriculum and expired plan are blocked', async () => {
  const e = await environment();
  try {
    const p = await e.service.validate(e.manifest, e.admin, 'Easy');
    const edited = structuredClone(e.manifest);
    edited.question.title = 'Changed';
    await assert.rejects(
      e.service.commit(edited, p.token, [], e.admin, 'Easy'),
      /Content or difficulty changed/,
    );
    await assert.rejects(
      e.service.commit(
        e.manifest,
        p.token.slice(0, -1) + (p.token.endsWith('a') ? 'b' : 'a'),
        [],
        e.admin,
        'Easy',
      ),
      /tampered/,
    );
    const expired = new QuestionJsonImportService(e.bank, e.storage, () => Date.now() + 3600_000);
    await assert.rejects(expired.commit(e.manifest, p.token, [], e.admin, 'Easy'), /expired/);
    await e.bank.run(
      'UPDATE chapters SET revision=revision+1 WHERE name=?',
      e.manifest.classification.chapter,
    );
    await assert.rejects(
      e.service.commit(e.manifest, p.token, [], e.admin, 'Easy'),
      /Curriculum changed/,
    );
    assert.equal(e.storage.puts, 0);
  } finally {
    await e.bank.close();
  }
});

test('same signed plan is durable across service instances, simultaneous commits and response-loss retries', async () => {
  const e = await environment(true);
  try {
    const p = await e.service.validate(e.manifest, e.admin, 'Easy'),
      another = new QuestionJsonImportService(e.bank, e.storage);
    const results = await Promise.all([
      e.service.commit(e.manifest, p.token, e.files, e.admin, 'Easy'),
      another.commit(e.manifest, p.token, e.files, e.admin, 'Easy'),
    ]);
    assert.equal(results[0].id, results[1].id);
    assert.equal((await e.bank.list()).total, 1);
    assert.equal(e.storage.objects.size, 2);
    const retry = await another.commit(e.manifest, p.token, e.files, e.admin, 'Easy');
    assert.equal(retry.id, results[0].id);
    assert.equal(retry.alreadyImported, true);
    assert.match(
      (await another.validate(e.manifest, e.admin, 'Easy')).warnings.join(' '),
      /Duplicate content fingerprint/,
    );
  } finally {
    await e.bank.close();
  }
});

for (const mode of ['signature', 'mime', 'multipart-mime', 'sha', 'length', 'extra-file'] as const)
  test(`binary upload rejects ${mode} before Blob write`, async () => {
    const e = await environment(true);
    try {
      if (mode === 'signature') {
        e.files[0].buffer = Buffer.alloc(e.files[0].buffer.length);
        e.manifest.assets[0].sha256 = createHash('sha256').update(e.files[0].buffer).digest('hex');
      }
      if (mode === 'mime') e.manifest.assets[0].mimeType = 'image/jpeg';
      if (mode === 'multipart-mime') e.files[0].mimetype = 'image/jpeg';
      if (mode === 'sha') e.manifest.assets[0].sha256 = '0'.repeat(64);
      if (mode === 'length') e.files[0].buffer = e.files[0].buffer.subarray(0, 10);
      if (mode === 'extra-file') e.files.push(e.files[0]);
      const p = await e.service.validate(e.manifest, e.admin, 'Easy');
      await assert.rejects(
        e.service.commit(e.manifest, p.token, e.files, e.admin, 'Easy'),
        /assets/,
      );
      assert.equal(e.storage.puts, 0);
      assert.equal((await e.bank.list()).total, 0);
    } finally {
      await e.bank.close();
    }
  });

for (const table of [
  'questions',
  'question_parts',
  'solutions',
  'solution_steps',
  'hints',
  'question_versions',
  'question_version_classifications',
  'assets',
  'question_content_blocks',
  'question_import_receipts',
  'question_search',
])
  test(`failure inserting ${table} rolls back all relational rows and cleans exact new images`, async () => {
    const e = await environment(true, true);
    try {
      const unrelated = await e.storage.put({
        bytes: e.files[0].buffer,
        mime: 'image/png',
        extension: 'png',
        displayName: 'unrelated.png',
        sha256: e.manifest.assets[0].sha256,
      });
      const p = await e.service.validate(e.manifest, e.admin, 'Easy'),
        run = e.bank.run.bind(e.bank);
      e.bank.run = async (sql, ...params) => {
        if (
          sql.startsWith('INSERT INTO ' + table + ' ') ||
          sql.startsWith('INSERT INTO ' + table + '(')
        )
          throw new Error('TEST insert failure');
        return run(sql, ...params);
      };
      // Visual example has no hints; add an actual ordered hint before a new plan.
      if (table === 'hints')
        e.manifest.hints.push({ id: 'test-hint', partId: null, text: 'Hint', order: 0 });
      const token =
        table === 'hints' ? (await e.service.validate(e.manifest, e.admin, 'Easy')).token : p.token;
      await assert.rejects(
        e.service.commit(e.manifest, token, e.files, e.admin, 'Easy'),
        /TEST insert failure/,
      );
      for (const t of [
        'questions',
        'question_parts',
        'solutions',
        'solution_steps',
        'hints',
        'question_versions',
        'question_version_classifications',
        'assets',
        'question_content_blocks',
        'question_import_receipts',
        'question_search',
      ])
        assert.equal((await e.bank.all('SELECT * FROM ' + t)).length, 0, t);
      assert.equal(e.storage.objects.size, 1);
      assert.equal(e.storage.objects.has(unrelated.key), true);
      assert.equal(e.storage.deleted.includes(unrelated.key), false);
      assert.deepEqual(await e.bank.all('PRAGMA foreign_key_check'), []);
    } finally {
      await e.bank.close();
    }
  });

test('final transaction failure rolls back and compensates uploads', async () => {
  const e = await environment(true);
  try {
    const p = await e.service.validate(e.manifest, e.admin, 'Easy'),
      original = e.bank.db.transaction.bind(e.bank.db);
    let fail = true;
    e.bank.db.transaction = (fn) =>
      original(async () => {
        const result = await fn();
        if (fail) {
          fail = false;
          throw new Error('TEST final commit');
        }
        return result;
      });
    await assert.rejects(
      e.service.commit(e.manifest, p.token, e.files, e.admin, 'Easy'),
      /final commit/,
    );
    assert.equal((await e.bank.list()).total, 0);
    assert.equal(e.storage.objects.size, 0);
  } finally {
    await e.bank.close();
  }
});
test('partial upload failure compensates earlier uploads', async () => {
  const e = await environment(true);
  try {
    e.storage.failPutAt = 2;
    const p = await e.service.validate(e.manifest, e.admin, 'Easy');
    await assert.rejects(
      e.service.commit(e.manifest, p.token, e.files, e.admin, 'Easy'),
      /unavailable/,
    );
    assert.equal(e.storage.objects.size, 0);
    assert.equal((await e.bank.list()).total, 0);
  } finally {
    await e.bank.close();
  }
});
test('cleanup failure reports reconciliation using opaque references and attempts every cleanup', async () => {
  const e = await environment(true);
  try {
    const p = await e.service.validate(e.manifest, e.admin, 'Easy');
    e.storage.failDelete = true;
    const run = e.bank.run.bind(e.bank);
    e.bank.run = (sql, ...args) => {
      if (sql.startsWith('INSERT INTO questions')) throw new Error('TEST fail');
      return run(sql, ...args);
    };
    await assert.rejects(
      e.service.commit(e.manifest, p.token, e.files, e.admin, 'Easy'),
      (err: unknown) =>
        err instanceof AssetConsistencyError &&
        err.code === 'import_cleanup_failed' &&
        err.reconciliationReference.startsWith('/uploads/'),
    );
    assert.equal((await e.bank.list()).total, 0);
    assert.equal(e.storage.objects.size, 2);
  } finally {
    await e.bank.close();
  }
});

test('HTTP admin/CSRF boundary, private FBD byte preservation, and every public draft visibility path', async () => {
  const { bank } = await setup(),
    dir = mkdtempSync(join(tmpdir(), 'question-json-test-'));
  const storage = new LocalAssetStorage(dir),
    app = createApp(bank, storage),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const cookie = await seedAdminSession(bank),
      authorized = authenticatedFetch(cookie),
      { manifest, files } = splitPackage(await localPackage(bank, true));
    const jsonBody = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest, selectedDifficulty: 'Easy' }),
    };
    for (const route of ['validate', 'commit'])
      assert.equal(
        (await fetch(base + '/api/admin/questions/import/' + route, jsonBody)).status,
        401,
      );
    assert.equal(
      (
        await fetch(base + '/api/admin/questions/import/validate', {
          ...jsonBody,
          headers: { ...jsonBody.headers, Cookie: cookie },
        })
      ).status,
      403,
    );
    const counts = await (await fetch(base + '/api/counts')).json(),
      facets = await (await fetch(base + '/api/taxonomy')).json();
    const validationState = async () =>
      Promise.all(
        [
          'questions',
          'question_import_receipts',
          'assets',
          'question_content_blocks',
          'security_rate_limits',
          'admin_sessions',
          'curriculum_events',
        ].map((table) => bank.all(`SELECT * FROM ${table}`)),
      );
    const beforeValidate = await validationState();
    const planResponse = await authorized(base + '/api/admin/questions/import/validate', jsonBody);
    assert.equal(planResponse.status, 200);
    assert.deepEqual(
      await validationState(),
      beforeValidate,
      'Validation endpoint is read-only, including security tables',
    );
    const plan = await planResponse.json();
    const form = new FormData();
    form.append('manifest', JSON.stringify(manifest));
    form.append('token', plan.token);
    form.append('selectedDifficulty', 'Easy');
    for (const file of files)
      form.append(
        file.fieldname,
        new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
        file.fieldname + '.png',
      );
    assert.equal(
      (
        await fetch(base + '/api/admin/questions/import/commit', {
          method: 'POST',
          headers: { Cookie: cookie },
          body: form,
        })
      ).status,
      403,
    );
    const imported = await authorized(base + '/api/admin/questions/import/commit', {
      method: 'POST',
      body: form,
    });
    assert.equal(imported.status, 201);
    const result = await imported.json();
    const saved = await bank.document(result.id);
    for (const [i, asset] of saved.assets.entries()) {
      assert.equal((await fetch(base + asset.url)).status, 404);
      const response = await authorized(base + asset.url);
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.deepEqual(bytes, files[i].buffer);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.assets[i].sha256);
    }
    for (const url of [
      `/api/questions/${result.id}`,
      `/api/questions/${result.id}?view=teacher`,
      `/api/questions/${result.id}/export`,
      `/api/questions/${result.id}/versions`,
      `/api/questions/${result.id}/revisions`,
      `/api/public/question-set?ids=${result.id}&answers=true&hints=true`,
    ])
      assert.ok([401, 404].includes((await fetch(base + url)).status), url);
    assert.equal((await (await fetch(base + '/api/questions?q=SYNTHETIC')).json()).total, 0);
    assert.equal((await (await fetch(base + '/api/questions?status=draft')).json()).total, 0);
    assert.deepEqual(await (await fetch(base + '/api/counts')).json(), counts);
    assert.deepEqual(await (await fetch(base + '/api/taxonomy')).json(), facets);
    assert.equal(JSON.stringify(saved).includes('dataBase64'), false);
    assert.equal((await bank.all('SELECT * FROM question_import_receipts')).length, 1);
    assert.equal(
      (
        await authorized(base + '/api/admin/questions/import/commit', {
          method: 'POST',
          body: form,
        })
      ).status,
      201,
    );
    assert.equal((await bank.list()).total, 1);
    const service = new AssetService(storage, bank);
    await assert.rejects(service.discardUnlinkedUpload({} as StoredUpload), /owned upload/);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    await bank.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('manifest rejects Base64 and oversized structured payloads independently of browser preparation', () => {
  const e = examplePackage(true);
  assert.equal(importManifestSchema.safeParse(e).success, false);
});
import { createClient } from '@libsql/client';
import { TursoAdapter } from '../server/turso-adapter.js';
import { applyMigrations } from '../server/migrations.js';
import { Bank } from '../server/database.js';

test('real local libSQL persists no-part and nested imports with relational block references and receipts', async () => {
  const adapter = new TursoAdapter(createClient({ url: 'file::memory:' }));
  await applyMigrations(adapter);
  const bank = new Bank(adapter);
  try {
    await setup(bank);
    await seedAdminSession(bank);
    const admin: AdminIdentity = {
      id: String((await bank.one('SELECT id FROM admins WHERE email=?', testEmail))!.id),
      email: testEmail,
      role: 'admin',
    };
    const storage = new TestStorage(),
      service = new QuestionJsonImportService(bank, storage);
    for (const nested of [false, true]) {
      const doc = await localPackage(bank, true);
      if (nested) nestedPackage(doc);
      doc.question.title += nested ? ' nested' : ' whole';
      const { manifest, files } = splitPackage(doc),
        p = await service.validate(manifest, admin, 'Easy'),
        r = await service.commit(manifest, p.token, files, admin, 'Easy');
      assert.equal((await bank.current(r.id)).status, 'draft');
      assert.equal((await bank.document(r.id)).solutions[0].partId, nested ? 'ai' : null);
      assert.equal((await service.commit(manifest, p.token, files, admin, 'Easy')).id, r.id);
    }
    assert.equal((await bank.list()).total, 2);
    assert.equal((await bank.all('SELECT * FROM question_import_receipts')).length, 2);
    assert.deepEqual(await bank.all('PRAGMA foreign_key_check'), []);
  } finally {
    await bank.close();
  }
});

test('whole-question SQL constraints reject orphan steps and duplicate schemes without fabricated parts', async () => {
  const e = await environment();
  try {
    const p = await e.service.validate(e.manifest, e.admin, 'Easy'),
      r = await e.service.commit(e.manifest, p.token, [], e.admin, 'Easy');
    await assert.rejects(
      e.bank.run('INSERT INTO solutions VALUES(?,?,?,?,?)', r.id, null, 'Duplicate', '', ''),
      /UNIQUE/,
    );
    await assert.rejects(
      e.bank.run(
        'INSERT INTO solution_steps(question_id,part_id,step_number,explanation,equation_latex,working,marking_point,marks,display_order) VALUES(?,?,?,?,?,?,?,?,?)',
        'unknown-question',
        null,
        1,
        '',
        '',
        '',
        '',
        1,
        0,
      ),
      /Whole-question solution/,
    );
    await assert.rejects(
      e.bank.run('DELETE FROM solutions WHERE question_id=?', r.id),
      /Delete solution steps/,
    );
    await assert.rejects(
      e.bank.run(
        'INSERT INTO solution_steps(question_id,part_id,step_number,explanation,equation_latex,working,marking_point,marks,display_order) VALUES(?,?,?,?,?,?,?,?,?)',
        r.id,
        null,
        1,
        '',
        '',
        '',
        '',
        1,
        0,
      ),
      /UNIQUE/,
    );
  } finally {
    await e.bank.close();
  }
});

test('future curriculum keeps permanent Semester 1 with version-specific curriculum code', async () => {
  const e = await environment();
  try {
    await e.bank.run(
      "UPDATE curriculum_versions SET code='PHYSICS-2028-2029',revision=revision+1 WHERE code='LEGACY'",
    );
    e.manifest.classification.curriculumVersionCode = 'PHYSICS-2028-2029';
    const p = await e.service.validate(e.manifest, e.admin, 'Easy'),
      r = await e.service.commit(e.manifest, p.token, [], e.admin, 'Easy');
    const saved = await e.bank.savedClassification(r.id);
    assert.equal(saved?.semester.name, 'Semester 1');
    assert.equal(saved?.curriculumVersion.code, 'PHYSICS-2028-2029');
  } finally {
    await e.bank.close();
  }
});

test('oversized manifests, binary data, plan admin binding and stale difficulty fail before storage', async () => {
  const e = await environment(true);
  try {
    const p = await e.service.validate(e.manifest, e.admin, 'Easy');
    await assert.rejects(
      e.service.validate(
        { ...e.manifest, question: { ...e.manifest.question, scenario: 'x'.repeat(400000) } },
        e.admin,
        'Easy',
      ),
      /384 KiB/,
    );
    const tooBig = structuredClone(e.files);
    tooBig[0].buffer = Buffer.alloc(3 * 1024 * 1024 + 1);
    await assert.rejects(
      e.service.commit(e.manifest, p.token, tooBig, e.admin, 'Easy'),
      /byteLength/,
    );
    await assert.rejects(
      e.service.commit(e.manifest, p.token, e.files, { ...e.admin, id: 'other-admin' }, 'Easy'),
      /Administrator unavailable/,
    );
    await e.bank.run("UPDATE difficulty_levels SET sort_order=99 WHERE name='Easy'");
    await assert.rejects(
      e.service.commit(e.manifest, p.token, e.files, e.admin, 'Easy'),
      /Curriculum changed/,
    );
    assert.equal(e.storage.puts, 0);
  } finally {
    await e.bank.close();
  }
});

test('all accepted visual roles persist their metadata and exact placement; no transforms are introduced', async () => {
  for (const role of [
    'question_diagram',
    'answer_diagram',
    'free_body_diagram',
    'graph',
    'circuit_diagram',
    'table_image',
    'other_visual',
  ] as const) {
    const e = await environment(true);
    try {
      e.manifest.assets[1].role = role;
      const p = await e.service.validate(e.manifest, e.admin, 'Easy'),
        r = await e.service.commit(e.manifest, p.token, e.files, e.admin, 'Easy');
      const saved = await e.bank.document(r.id),
        asset = saved.assets[1];
      assert.equal(asset.importMetadata?.role, role);
      assert.equal('source' in (asset.importMetadata ?? {}), false);
      assert.deepEqual(
        (await e.storage.get(asset.url.slice('/uploads/'.length)))?.bytes,
        e.files[1].buffer,
      );
      assert.equal(saved.solutions[0].steps[0].blocks?.[0].type, 'image');
    } finally {
      await e.bank.close();
    }
  }
});

test('unreleased portable format rejects question and asset source provenance', () => {
  for (const source of [{ type: 'pdf', fileName: 'paper.pdf' }, { pages: [2] }]) {
    const doc = examplePackage(false);
    assert.equal(questionPackageSchema.safeParse({ ...doc, source }).success, false);
    assert.equal(
      questionPackageSchema.safeParse({ ...doc, question: { ...doc.question, source } }).success,
      false,
    );
  }
  const doc = examplePackage(true);
  assert.equal(
    questionPackageSchema.safeParse({
      ...doc,
      assets: doc.assets.map((a) => ({ ...a, source: { page: 2 } })),
    }).success,
    false,
  );
});
