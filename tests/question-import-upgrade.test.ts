import test from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteAdapter } from '../server/sqlite-adapter.js';
import { Bank } from '../server/database.js';
import { applyMigrations } from '../server/migrations.js';
import { setup } from './fixtures.js';
import { seedAdminSession, testEmail } from './auth-fixture.js';
import { localPackage, splitPackage } from './question-import-fixture.js';
import { QuestionJsonImportService } from '../server/question-json-import.js';
import { LocalAssetStorage } from '../server/local-asset-storage.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { TursoAdapter } from '../server/turso-adapter.js';

for (const adapter of ['sqlite', 'libsql'] as const)
  test(`${adapter}: populated schema 003 upgrades without changing legacy content or history, then imports a whole-question draft`, async () => {
    const db =
      adapter === 'sqlite'
        ? new SQLiteAdapter(':memory:')
        : new TursoAdapter(createClient({ url: 'file::memory:' }));
    const bank = new Bank(db);
    const directory = mkdtempSync(join(tmpdir(), 'import-upgrade-'));
    try {
      await applyMigrations(db, { throughVersion: 3 });
      const { fixture } = await setup(bank);
      const doc = fixture('TEST-UPGRADE');
      doc.parts.unshift({
        id: 'root',
        parentId: null,
        label: '(a)',
        prompt: 'Parent',
        marks: 2,
        order: 0,
      });
      doc.parts[1].parentId = 'root';
      doc.parts[1].label = '(i)';
      doc.assets.push({
        id: 'legacy-image',
        partId: 'part-a',
        kind: 'physics_diagram',
        url: 'https://example.com/original.png',
        alt: 'Original fixture',
        mime: 'image/png',
        order: 0,
      });
      await bank.run(
        'INSERT INTO questions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        'existing',
        doc.question.questionCode,
        doc.question.topicId,
        doc.question.subtopicId,
        doc.question.title,
        doc.question.scenario,
        'hard',
        'structured',
        2,
        3,
        'approved',
        1,
        0,
        0,
        1,
        'before',
        'before',
        'before',
      );
      for (const p of doc.parts)
        await bank.run(
          'INSERT INTO question_parts VALUES(?,?,?,?,?,?,?)',
          'existing',
          p.id,
          p.label,
          p.prompt,
          p.marks,
          p.order,
          p.parentId,
        );
      for (const s of doc.solutions) {
        await bank.run(
          'INSERT INTO solutions VALUES(?,?,?,?,?)',
          'existing',
          s.partId,
          s.solution,
          s.equationLatex,
          s.teacherNotes,
        );
        for (const t of s.steps)
          await bank.run(
            'INSERT INTO solution_steps VALUES(?,?,?,?,?,?,?,?,?)',
            'existing',
            s.partId,
            t.number,
            t.explanation,
            t.equationLatex,
            t.working,
            t.markingPoint,
            t.marks,
            t.order,
          );
      }
      for (const h of doc.hints)
        await bank.run(
          'INSERT INTO hints VALUES(?,?,?,?,?)',
          'existing',
          h.id,
          h.partId,
          h.text,
          h.order,
        );
      for (const a of doc.assets)
        await bank.run(
          'INSERT INTO assets VALUES(?,?,?,?,?,?,?,?)',
          'existing',
          a.id,
          a.partId,
          a.kind,
          a.url,
          a.alt,
          a.mime,
          a.order,
        );
      await bank.run(
        'INSERT INTO question_versions VALUES(?,?,?,?,?,?)',
        'existing',
        1,
        JSON.stringify(doc),
        'Original revision',
        null,
        'before',
      );
      await bank.run(
        'INSERT INTO question_version_classifications VALUES(?,?,?)',
        'existing',
        1,
        JSON.stringify(await bank.curriculum.classification(doc)),
      );
      await bank.run(
        'INSERT INTO question_versions VALUES(?,?,?,?,?,?)',
        'existing',
        2,
        JSON.stringify(doc),
        'Second immutable revision',
        null,
        'before',
      );
      await bank.run(
        'INSERT INTO question_version_classifications VALUES(?,?,?)',
        'existing',
        2,
        JSON.stringify(await bank.curriculum.classification(doc)),
      );
      await bank.run('UPDATE questions SET active_version=2 WHERE id=?', 'existing');
      await bank.run(
        'INSERT INTO revision_candidates(id,question_id,base_version,source,snapshot,change_note,status,created_at) VALUES(?,?,?,?,?,?,?,?)',
        'pending',
        'existing',
        2,
        'manual',
        JSON.stringify(doc),
        'Pending review',
        'pending',
        'before',
      );
      await bank.run('INSERT INTO tags VALUES(?,?,?)', 'existing-tag', 'TEST ONLY', 'test only');
      await bank.run('INSERT INTO question_tags VALUES(?,?)', 'existing', 'existing-tag');
      await bank.run(
        'INSERT INTO question_search VALUES(?,?)',
        'existing',
        'Original searchable content',
      );
      await seedAdminSession(bank);
      const tables = [
        'questions',
        'question_parts',
        'solutions',
        'solution_steps',
        'hints',
        'assets',
        'question_versions',
        'question_version_classifications',
        'revision_candidates',
        'tags',
        'question_tags',
        'question_search',
        'curriculum_versions',
        'semesters',
        'chapters',
        'topics',
        'subtopics',
      ];
      const before = Object.fromEntries(
        await Promise.all(
          tables.map(async (t) => [t, await bank.all(`SELECT * FROM ${t} ORDER BY 1,2`)]),
        ),
      );
      await applyMigrations(db, {
        throughVersion: 4,
        beforeMigration: async (version) => assert.equal(version, 4),
      });
      for (const table of tables) {
        const after = await bank.all(`SELECT * FROM ${table} ORDER BY 1,2`);
        if (table === 'assets')
          for (const row of after) {
            assert.equal(row.import_metadata, null);
            delete row.import_metadata;
          }
        assert.deepEqual(after, before[table], table);
      }
      assert.deepEqual(await bank.document('existing'), doc);
      assert.deepEqual(await bank.all('PRAGMA foreign_key_check'), []);
      await applyMigrations(db);
      const { manifest } = splitPackage(await localPackage(bank));
      const row = await bank.one('SELECT id FROM admins WHERE email=?', testEmail);
      const admin = { id: String(row!.id), email: testEmail, role: 'admin' as const };
      const service = new QuestionJsonImportService(bank, new LocalAssetStorage(directory));
      const plan = await service.validate(manifest, admin, 'Easy');
      const result = await service.commit(manifest, plan.token, [], admin, 'Easy');
      assert.equal((await bank.document(result.id)).question.status, 'draft');
      assert.equal((await bank.document(result.id)).solutions[0].partId, null);
      assert.deepEqual(await bank.document('existing'), doc);
      assert.deepEqual(
        (await bank.all('SELECT version FROM schema_migrations ORDER BY version')).map(
          (r) => r.version,
        ),
        [1, 2, 3, 4, 5],
      );
      assert.equal((await bank.one('PRAGMA integrity_check'))?.integrity_check, 'ok');
    } finally {
      await bank.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
