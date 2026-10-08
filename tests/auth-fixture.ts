import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { bootstrapAdmin, hashPassword } from '../server/auth.js';
import type { Bank } from '../server/database.js';

export const testEmail = 'test-admin@example.invalid';
export const testPassword = 'TEST ONLY isolated admin password 2026!';
let hash: Promise<string> | undefined;
/** Seeds an actual database session only in an explicitly supplied isolated bank. */
export async function seedAdminSession(bank: Bank, hosted = false) {
  let row = await bank.one('SELECT id FROM admins WHERE email=?', testEmail);
  if (!row) {
    const id = randomUUID();
    hash ??= hashPassword(testPassword);
    await bank.run(
      'INSERT INTO admins(id,email,password_hash,created_at) VALUES(?,?,?,?)',
      id,
      testEmail,
      await hash,
      Date.now(),
    );
    row = { id };
  }
  const token = randomBytes(32).toString('base64url');
  await bank.run(
    'INSERT INTO admin_sessions(token_digest,admin_id,created_at,expires_at) VALUES(?,?,?,?)',
    createHash('sha256').update(token).digest('hex'),
    String(row.id),
    Date.now(),
    Date.now() + 3600_000,
  );
  return `${hosted ? '__Host-qb_admin' : 'qb_admin'}=${token}`;
}
export function authenticatedFetch(cookie: string): typeof fetch {
  return (input, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set('Cookie', cookie);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(init.method?.toUpperCase() ?? 'GET')) {
      if (!headers.has('Origin')) headers.set('Origin', new URL(String(input)).origin);
      headers.set('X-Question-Bank-Request', '1');
    }
    return fetch(input, { ...init, headers });
  };
}
export async function seedBrowserAdmin(bank: Bank) {
  await bootstrapAdmin(bank, testEmail, testPassword);
}
