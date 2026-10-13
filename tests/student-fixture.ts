import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from '../server/auth.js';
import type { Bank } from '../server/database.js';
import { seedAdminSession, testEmail } from './auth-fixture.js';
export const studentEmail = 'student@example.invalid';
export const studentCode = 'TEST-ONLY-STUDENT-CODE';
let hash: Promise<string> | undefined;
/** Isolated test seeding only. Never used by runtime or deployment tooling. */
export async function seedStudentSession(bank: Bank, hosted = false) {
  await seedAdminSession(bank);
  const actor = String((await bank.one('SELECT id FROM admins WHERE email=?', testEmail))!.id);
  let row = await bank.one(
    'SELECT id,credential_version FROM students WHERE email_key=?',
    studentEmail,
  );
  if (!row) {
    const id = randomUUID();
    hash ??= hashPassword(studentCode);
    await bank.run(
      "INSERT INTO students(id,email,email_key,status,email_verified_at,access_code_hash,registration_request_id,created_by,created_at,updated_at) VALUES(?,?,?,'ACTIVE',?,?,?,?,?,?)",
      id,
      studentEmail,
      studentEmail,
      Date.now(),
      await hash,
      randomUUID(),
      actor,
      Date.now(),
      Date.now(),
    );
    row = { id, credential_version: 1 };
  }
  const token = randomBytes(32).toString('base64url');
  await bank.run(
    'INSERT INTO student_sessions(token_digest,student_id,credential_version,created_at,expires_at) VALUES(?,?,?,?,?)',
    createHash('sha256').update(token).digest('hex'),
    String(row.id),
    Number(row.credential_version),
    Date.now(),
    Date.now() + 3600000,
  );
  return `${hosted ? '__Host-qb_student' : 'qb_student'}=${token}`;
}
