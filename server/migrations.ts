import { readFileSync, readdirSync } from 'node:fs';
import type { DatabaseAdapter } from './database-adapter.js';

export const currentMigration = 8;

/** Explicit administrative operation; hosted request initialization never runs it. */
export async function applyMigrations(
  db: DatabaseAdapter,
  options: {
    beforeMigration?: (version: number) => Promise<void>;
    throughVersion?: number;
  } = {},
) {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)',
  );
  const folder = new URL('./migrations/', import.meta.url);
  const files = readdirSync(folder)
    .filter((name) => /^\d+-.*\.sql$/.test(name))
    .sort();
  for (const name of files) {
    const version = Number(name.split('-')[0]);
    if (version > (options.throughVersion ?? currentMigration)) continue;
    await db.transaction(async () => {
      const applied = await db.execute('SELECT version FROM schema_migrations WHERE version=?', [
        version,
      ]);
      if (applied.rows.length) return;
      // Administrative safety checks run under the same write transaction, so
      // another writer cannot change the audited content between check and DDL.
      await options.beforeMigration?.(version);
      await db.exec(readFileSync(new URL(name, folder), 'utf8'));
      if (version === 2) {
        const versions = await db.execute('SELECT count(*) n FROM question_versions');
        const classifications = await db.execute(
          'SELECT count(*) n FROM question_version_classifications',
        );
        if (versions.rows[0]?.n !== classifications.rows[0]?.n)
          throw new Error(
            'Curriculum migration cannot reconstruct every historical classification. Restore missing taxonomy records from backup before retrying. Migration rolled back.',
          );
      }
      if (version >= 7 && (await db.execute('PRAGMA foreign_key_check')).rows.length)
        throw new Error('Migration failed its foreign-key check; transaction rolled back');
      await db.execute('INSERT INTO schema_migrations VALUES(?,?)', [
        version,
        new Date().toISOString(),
      ]);
    });
  }
}

export async function assertCurrentSchema(db: DatabaseAdapter, expectedVersion = currentMigration) {
  const result = await db.execute('SELECT version FROM schema_migrations ORDER BY version');
  if (result.rows.length !== expectedVersion || result.rows.some((row, i) => row.version !== i + 1))
    throw new Error('Database schema is not current; run the explicit migration procedure');
  if (expectedVersion >= 4) {
    await db.execute('SELECT plan_id,manifest_digest FROM question_import_receipts LIMIT 0');
    await db.execute('SELECT owner_key,block_type FROM question_content_blocks LIMIT 0');
  }
  if (expectedVersion >= 5) {
    await db.execute('SELECT step_id,marking_code FROM solution_steps LIMIT 0');
    await db.execute('SELECT solution_step_id FROM hints LIMIT 0');
  }
  if (expectedVersion >= 6) {
    await db.execute('SELECT id,question_image,answer_image,revision FROM image_questions LIMIT 0');
    await db.execute('SELECT key,sha256,width,height FROM image_assets LIMIT 0');
    await db.execute('SELECT question_id,classification FROM image_question_versions LIMIT 0');
  }
  if (expectedVersion >= 7) {
    const columns = (await db.execute('PRAGMA table_info(image_questions)')).rows;
    if (columns.find((column) => column.name === 'subtopic_id')?.notnull !== 0)
      throw new Error('Optional subtopic schema is not current');
  }
  if (expectedVersion >= 8) {
    await db.execute(
      'SELECT id,email_key,email_verified_at,access_code_hash,credential_version FROM students LIMIT 0',
    );
    await db.execute(
      'SELECT token_digest,consumed_at,delivery_state FROM student_email_challenges LIMIT 0',
    );
    await db.execute(
      'SELECT token_digest,credential_version,revoked_at FROM student_sessions LIMIT 0',
    );
    await db.execute('SELECT student_id,actor_id,action FROM student_access_events LIMIT 0');
  }
  // Preparing these reads also verifies the structures used by the current API.
  await db.execute(
    'SELECT cv.id,s.curriculum_version_id,s.status,s.revision,c.status,c.revision,t.status,t.revision,st.status,st.revision FROM curriculum_versions cv LEFT JOIN semesters s ON s.curriculum_version_id=cv.id LEFT JOIN chapters c ON c.semester_id=s.id LEFT JOIN topics t ON t.chapter_id=c.id LEFT JOIN subtopics st ON st.topic_id=t.id LIMIT 0',
  );
  await db.execute(
    'SELECT question_id,version_number,snapshot FROM question_version_classifications LIMIT 0',
  );
  await db.execute('SELECT id,kind,entity_id,after_json FROM curriculum_events LIMIT 0');
  await db.execute('SELECT id,email,password_hash,role,disabled FROM admins LIMIT 0');
  await db.execute(
    'SELECT token_digest,admin_id,expires_at,revoked_at FROM admin_sessions LIMIT 0',
  );
  await db.execute(
    'SELECT bucket,window_start,attempts,expires_at FROM security_rate_limits LIMIT 0',
  );
  await db.execute(
    'SELECT question_id FROM question_search WHERE question_search MATCH ? LIMIT 0',
    ['"health"'],
  );
}
