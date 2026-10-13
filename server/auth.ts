import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { Bank, BankError } from './database.js';

// OWASP scrypt profile: N=2^15, r=8, p=3; bounded memory for serverless Node.
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const sessionLifetime = 8 * 60 * 60 * 1000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export type AdminIdentity = { id: string; email: string; role: 'admin' };
export function normalizeEmail(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
    throw new BankError('Enter a valid administrator email');
  return value.trim().toLowerCase();
}
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, scryptOptions, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export async function hashPassword(password: string) {
  if (
    typeof password !== 'string' ||
    [...password].length < 15 ||
    Buffer.byteLength(password) > 1024
  )
    throw new BankError('Use a password of at least 15 characters and at most 1024 UTF-8 bytes');
  const salt = randomBytes(16),
    key = await derive(password, salt);
  return `scrypt$32768$8$3$${salt.toString('hex')}$${key.toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const fields = hash.split('$');
  if (
    fields.length !== 6 ||
    fields.slice(0, 4).join('$') !== 'scrypt$32768$8$3' ||
    !/^[0-9a-f]{32}$/.test(fields[4]) ||
    !/^[0-9a-f]{128}$/.test(fields[5])
  )
    throw new Error('Invalid password record');
  return timingSafeEqual(
    await derive(password, Buffer.from(fields[4], 'hex')),
    Buffer.from(fields[5], 'hex'),
  );
}
// A valid fixed record makes nonexistent identifiers perform the same KDF work.
const dummyHash = `scrypt$32768$8$3$${'0'.repeat(32)}$${'0'.repeat(128)}`;
export class AuthService {
  private hashesInFlight = 0;
  constructor(
    private readonly bank: Bank,
    readonly hosted = false,
    private readonly now = Date.now,
  ) {}
  get cookieName() {
    return this.hosted ? '__Host-qb_admin' : 'qb_admin';
  }
  private cookieToken(req: Request) {
    const matches = (req.headers.cookie ?? '')
      .split(';')
      .map((v) => v.trim())
      .filter((v) => v.startsWith(this.cookieName + '='));
    if (matches.length !== 1) return;
    const token = matches[0].slice(this.cookieName.length + 1);
    return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
  }
  async identity(req: Request): Promise<AdminIdentity | undefined> {
    const token = this.cookieToken(req);
    if (!token) return;
    const row = await this.bank.one(
      "SELECT a.id,a.email,a.role FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_digest=? AND s.revoked_at IS NULL AND s.expires_at>? AND a.disabled=0 AND a.role='admin'",
      digest(token),
      this.now(),
    );
    return row ? { id: String(row.id), email: String(row.email), role: 'admin' } : undefined;
  }
  async requireAdmin(req: Request) {
    const user = await this.identity(req);
    if (!user) throw new BankError('Administrator authentication required', 401);
    return user;
  }
  csrf(req: Request) {
    const expected = `${this.hosted ? 'https' : 'http'}://${req.headers.host}`;
    if (
      req.headers.origin !== expected ||
      req.headers['x-question-bank-request'] !== '1' ||
      req.headers['sec-fetch-site'] === 'cross-site'
    )
      throw new BankError('Same-origin request verification failed', 403);
    // HTTP cookies are supported only by the explicitly loopback local entry.
    if (
      !this.hosted &&
      !/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(req.headers.host ?? '')
    )
      throw new BankError('Local authentication requires loopback access', 403);
  }
  clientAddress(req: Request) {
    // Vercel overwrites these headers at its trusted edge. Never trust them locally.
    return this.hosted
      ? String(
          req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'] ?? 'unavailable',
        ).slice(0, 200)
      : (req.socket.remoteAddress ?? 'unavailable');
  }
  async limit(namespace: string, subject: string, maximum: number, windowMs: number) {
    const now = this.now(),
      windowStart = Math.floor(now / windowMs) * windowMs;
    if (namespace.endsWith('-global'))
      await this.bank.run('DELETE FROM security_rate_limits WHERE expires_at<=?', now);
    const bucket = digest(namespace + ':' + subject);
    const result = await this.bank.run(
      'INSERT INTO security_rate_limits(bucket,window_start,attempts,expires_at) VALUES(?,?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,window_start=excluded.window_start,expires_at=excluded.expires_at RETURNING attempts',
      bucket,
      windowStart,
      windowStart + windowMs,
    );
    if (Number(result.rows[0]?.attempts) > maximum)
      throw new BankError('Too many requests; try again later', 429);
  }
  async login(req: Request, res: Response) {
    this.csrf(req);
    let email = '';
    try {
      email = normalizeEmail(req.body?.email);
    } catch {
      /* Generic failure below. */
    }
    const password = req.body?.password;
    await this.limit('login-global', 'all', 60, 60_000);
    await this.limit('login-ip', this.clientAddress(req), 20, 15 * 60_000);
    await this.limit('login-account', email || 'invalid', 5, 15 * 60_000);
    if (this.hashesInFlight >= 2) throw new BankError('Too many requests; try again later', 429);
    this.hashesInFlight++;
    let row: Awaited<ReturnType<Bank['one']>>,
      valid = false;
    try {
      row = email ? await this.bank.one('SELECT * FROM admins WHERE email=?', email) : undefined;
      const candidate =
        typeof password === 'string' && Buffer.byteLength(password) <= 1024 ? password : '';
      valid = await verifyPassword(candidate, row ? String(row.password_hash) : dummyHash);
      if (!valid || !row || row.disabled !== 0 || row.role !== 'admin')
        throw new BankError('Invalid administrator credentials', 401);
    } finally {
      this.hashesInFlight--;
    }
    const token = randomBytes(32).toString('base64url'),
      now = this.now();
    await this.bank.transaction(async () => {
      const active = await this.bank.one(
        "SELECT id FROM admins WHERE id=? AND disabled=0 AND role='admin' AND password_hash=?",
        String(row!.id),
        String(row!.password_hash),
      );
      if (!active) throw new BankError('Invalid administrator credentials', 401);
      const old = this.cookieToken(req);
      if (old)
        await this.bank.run(
          'UPDATE admin_sessions SET revoked_at=? WHERE token_digest=?',
          now,
          digest(old),
        );
      await this.bank.run('DELETE FROM admin_sessions WHERE expires_at<=?', now);
      await this.bank.run('DELETE FROM security_rate_limits WHERE expires_at<=?', now);
      await this.bank.run(
        'INSERT INTO admin_sessions(token_digest,admin_id,created_at,expires_at) VALUES(?,?,?,?)',
        digest(token),
        String(row!.id),
        now,
        now + sessionLifetime,
      );
    });
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.hosted,
      sameSite: 'strict',
      path: '/',
      maxAge: sessionLifetime,
    });
    return {
      authenticated: true,
      user: { id: String(row!.id), email: String(row!.email), role: 'admin' as const },
    };
  }
  async logout(req: Request, res: Response) {
    this.csrf(req);
    const token = this.cookieToken(req);
    if (token)
      await this.bank.run(
        'UPDATE admin_sessions SET revoked_at=? WHERE token_digest=?',
        this.now(),
        digest(token),
      );
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.hosted,
      sameSite: 'strict',
      path: '/',
    });
  }
}
/** Manual tooling/test fixture only. Never called by app initialization or HTTP. */
export async function bootstrapAdmin(bank: Bank, email: string, password: string) {
  const normalized = normalizeEmail(email),
    passwordHash = await hashPassword(password);
  return bank.transaction(async () => {
    if (await bank.one('SELECT id FROM admins LIMIT 1'))
      throw new BankError('First-admin bootstrap refused: an administrator already exists', 409);
    const id = randomUUID();
    await bank.run(
      'INSERT INTO admins(id,email,password_hash,created_at) VALUES(?,?,?,?)',
      id,
      normalized,
      passwordHash,
      Date.now(),
    );
    return id;
  });
}
