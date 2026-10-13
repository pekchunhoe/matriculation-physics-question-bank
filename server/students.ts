import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Bank, BankError } from './database.js';
import { AuthService, hashPassword, verifyPassword } from './auth.js';
import {
  EmailDeliveryFailure,
  unavailableMailer,
  productionVerificationOrigin,
  type VerificationMailer,
} from './student-email.js';
import type { StudentRecord, StudentList } from '../shared/student.js';

const day = 86400_000,
  lifetime = 8 * 3600_000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
type Row = NonNullable<Awaited<ReturnType<Bank['one']>>>;
export type StudentIdentity = { id: string; email: string; role: 'student' };
function emailInput(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
    throw new BankError('Enter a valid student email');
  return { email: value.trim(), key: value.trim().toLowerCase() };
}
function requestId(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value))
    throw new BankError('A request ID is required');
  return value;
}
function record(row: Row): StudentRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    status: row.status as StudentRecord['status'],
    verifiedAt: row.email_verified_at === null ? null : Number(row.email_verified_at),
    deliveryState: String(row.delivery_state),
    revision: Number(row.revision),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}
export class StudentService {
  private hashesInFlight = 0;
  readonly auth: AuthService;
  constructor(
    private readonly bank: Bank,
    readonly hosted = false,
    readonly mailer: VerificationMailer = unavailableMailer,
    private readonly origin = productionVerificationOrigin,
    private readonly now = Date.now,
  ) {
    if (!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin))
      throw new Error('Invalid verification origin');
    this.auth = new AuthService(bank, hosted, now);
  }
  private async row(id: string, revision?: unknown) {
    const row = await this.bank.one('SELECT * FROM students WHERE id=?', id);
    if (!row) throw new BankError('Student not found', 404);
    if (revision !== undefined && (!Number.isSafeInteger(revision) || row.revision !== revision))
      throw new BankError('Student changed; refresh and try again', 409);
    return row;
  }
  private event(id: string, actor: string | null, action: string) {
    return this.bank.run(
      'INSERT INTO student_access_events(id,student_id,actor_id,action,created_at) VALUES(?,?,?,?,?)',
      randomUUID(),
      id,
      actor,
      action,
      this.now(),
    );
  }
  async list(search: unknown, pageInput: unknown): Promise<StudentList> {
    const term = typeof search === 'string' ? search.trim().slice(0, 254) : '';
    const page = Math.max(1, Math.min(100000, Number(pageInput) || 1));
    if (!Number.isInteger(page)) throw new BankError('Invalid page');
    const pattern = '%' + term.replace(/[\\%_]/g, '\\$&') + '%';
    const where = "email_key LIKE ? ESCAPE '\\'";
    const total = Number(
      (await this.bank.one(`SELECT COUNT(*) n FROM students WHERE ${where}`, pattern))?.n,
    );
    const items = (
      await this.bank.all(
        `SELECT * FROM students WHERE ${where} ORDER BY created_at DESC,id LIMIT 25 OFFSET ?`,
        pattern,
        (page - 1) * 25,
      )
    ).map(record);
    return {
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 25)),
      emailConfigured: this.mailer.configured,
    };
  }
  async register(value: unknown, request: unknown, actor: string) {
    const { email, key } = emailInput(value),
      rid = requestId(request);
    let created = false;
    const student = await this.bank.transaction(async () => {
      const previous = await this.bank.one(
        'SELECT * FROM students WHERE registration_request_id=?',
        rid,
      );
      if (previous) {
        if (previous.email_key !== key) throw new BankError('Request already used', 409);
        return record(previous);
      }
      if (await this.bank.one('SELECT id FROM students WHERE email_key=?', key))
        throw new BankError('This email is already registered', 409);
      const id = randomUUID(),
        now = this.now();
      const localDayStart = Math.floor((now + 8 * 3600000) / day) * day - 8 * 3600000;
      if (
        Number(
          (
            await this.bank.one(
              'SELECT COUNT(*) n FROM students WHERE created_at>=?',
              localDayStart,
            )
          )?.n,
        ) >= 5
      )
        throw new BankError(
          'Daily limit of five student registrations reached (Malaysia time)',
          429,
        );
      await this.bank.run(
        "INSERT INTO students(id,email,email_key,status,registration_request_id,created_by,created_at,updated_at) VALUES(?,?,?,'PENDING_VERIFICATION',?,?,?,?)",
        id,
        email,
        key,
        rid,
        actor,
        now,
        now,
      );
      await this.event(id, actor, 'REGISTERED');
      created = true;
      return record(await this.row(id));
    });
    return created && this.mailer.configured
      ? this.send(student.id, student.revision, rid, actor)
      : student;
  }
  /** Explicit admin action only: return plaintext once, after commit; never persist it. */
  async manualLink(id: string, revision: unknown, request: unknown, actor: string) {
    if (!Number.isSafeInteger(revision)) throw new BankError('Student revision required');
    const rid = requestId(request),
      token = randomBytes(32).toString('base64url'),
      challenge = randomUUID();
    const student = await this.bank.transaction(async () => {
      if (await this.bank.one('SELECT id FROM student_email_challenges WHERE request_id=?', rid))
        throw new BankError(
          'This link was already generated and cannot be retrieved. Generate a replacement if it was lost.',
          409,
        );
      const row = await this.row(id, revision),
        now = this.now();
      if (row.status !== 'PENDING_VERIFICATION')
        throw new BankError('Only pending students can receive a verification link', 409);
      if (
        row.last_attempt_at !== null &&
        now - Number(row.last_attempt_at) < (row.delivery_state === 'SENDING' ? 120000 : 60000)
      )
        throw new BankError('Wait before generating a replacement link', 429);
      await this.auth.limit('student-mail-account', id, 5, day);
      await this.auth.limit('student-mail-global', 'all', 50, day);
      await this.bank.run(
        "INSERT INTO student_email_challenges(id,student_id,email_key,email_version,token_digest,request_id,delivery_state,created_at,expires_at) VALUES(?,?,?,?,?,?,'MANUAL_READY',?,?)",
        challenge,
        id,
        String(row.email_key),
        Number(row.email_version),
        digest(token),
        rid,
        now,
        now + day,
      );
      await this.bank.run(
        'UPDATE student_email_challenges SET superseded_at=? WHERE student_id=? AND id<>? AND consumed_at IS NULL AND superseded_at IS NULL',
        now,
        id,
        challenge,
      );
      await this.bank.run(
        "UPDATE student_email_challenges SET delivery_state='UNKNOWN' WHERE student_id=? AND delivery_state='SENDING'",
        id,
      );
      await this.bank.run(
        "UPDATE students SET active_challenge_id=?,delivery_state='MANUAL_READY',last_attempt_at=?,revision=revision+1,updated_at=? WHERE id=?",
        challenge,
        now,
        now,
        id,
      );
      await this.event(id, actor, 'MANUAL_LINK_GENERATED');
      return record(await this.row(id));
    });
    return { student, link: this.origin + '/verify-email#token=' + token };
  }
  async send(id: string, revision: unknown, request: unknown, actor: string) {
    if (!Number.isSafeInteger(revision)) throw new BankError('Student revision required');
    const rid = requestId(request),
      token = randomBytes(32).toString('base64url'),
      challenge = randomUUID();
    const reserved = await this.bank.transaction(async () => {
      const duplicate = await this.bank.one(
        'SELECT student_id FROM student_email_challenges WHERE request_id=?',
        rid,
      );
      if (duplicate) {
        if (duplicate.student_id !== id) throw new BankError('Request already used', 409);
        return undefined;
      }
      const row = await this.row(id, revision),
        now = this.now();
      if (row.status !== 'PENDING_VERIFICATION')
        throw new BankError('Only pending students can receive verification email', 409);
      if (!this.mailer.configured) {
        await this.bank.run(
          "UPDATE students SET delivery_state='NOT_CONFIGURED',revision=revision+1,updated_at=? WHERE id=?",
          now,
          id,
        );
        return undefined;
      }
      if (
        row.last_attempt_at !== null &&
        now - Number(row.last_attempt_at) < (row.delivery_state === 'SENDING' ? 120000 : 60000)
      )
        throw new BankError('Wait before resending verification email', 429);
      await this.auth.limit('student-mail-account', id, 5, day);
      await this.auth.limit('student-mail-global', 'all', 50, day);
      await this.bank.run(
        "UPDATE student_email_challenges SET delivery_state='UNKNOWN' WHERE student_id=? AND delivery_state='SENDING'",
        id,
      );
      await this.bank.run(
        "INSERT INTO student_email_challenges(id,student_id,email_key,email_version,token_digest,request_id,delivery_state,created_at,expires_at) VALUES(?,?,?,?,?,?,'SENDING',?,?)",
        challenge,
        id,
        String(row.email_key),
        Number(row.email_version),
        digest(token),
        rid,
        now,
        now + day,
      );
      await this.bank.run(
        "UPDATE students SET delivery_state='SENDING',last_attempt_at=?,updated_at=?,revision=revision+1 WHERE id=?",
        now,
        now,
        id,
      );
      await this.event(id, actor, 'VERIFICATION_SEND_STARTED');
      return { to: String(row.email), version: Number(row.email_version), expiresAt: now + day };
    });
    if (!reserved) return record(await this.row(id));
    let outcome: 'SENT' | 'FAILED' | 'UNKNOWN' = 'SENT';
    try {
      await this.mailer.send({
        to: reserved.to,
        url: this.origin + '/verify-email#token=' + token,
        expiresAt: reserved.expiresAt,
        idempotencyKey: challenge,
      });
    } catch (error) {
      outcome =
        error instanceof EmailDeliveryFailure && error.outcome === 'FAILED' ? 'FAILED' : 'UNKNOWN';
    }
    await this.bank.transaction(async () => {
      const row = await this.row(id),
        attempt = await this.bank.one(
          'SELECT delivery_state FROM student_email_challenges WHERE id=?',
          challenge,
        );
      if (attempt?.delivery_state !== 'SENDING') return;
      const now = this.now();
      await this.bank.run(
        'UPDATE student_email_challenges SET delivery_state=? WHERE id=?',
        outcome,
        challenge,
      );
      if (row.status !== 'PENDING_VERIFICATION' || row.email_version !== reserved.version) {
        await this.bank.run(
          'UPDATE student_email_challenges SET superseded_at=? WHERE id=?',
          now,
          challenge,
        );
        return;
      }
      if (outcome === 'SENT') {
        await this.bank.run(
          'UPDATE student_email_challenges SET superseded_at=? WHERE student_id=? AND id<>? AND consumed_at IS NULL AND superseded_at IS NULL',
          now,
          id,
          challenge,
        );
        await this.bank.run('UPDATE students SET active_challenge_id=? WHERE id=?', challenge, id);
      }
      await this.bank.run(
        'UPDATE students SET delivery_state=?,revision=revision+1,updated_at=? WHERE id=?',
        outcome,
        now,
        id,
      );
      await this.event(id, actor, 'VERIFICATION_SEND_' + outcome);
    });
    return record(await this.row(id));
  }
  async verify(value: unknown) {
    const invalid = () =>
      new BankError(
        'Verification link is invalid or expired. Ask the administrator to resend it.',
        400,
      );
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw invalid();
    await this.bank.transaction(async () => {
      const now = this.now();
      const row = await this.bank.one(
        "SELECT c.id,c.student_id FROM student_email_challenges c JOIN students s ON s.id=c.student_id WHERE c.token_digest=? AND c.delivery_state IN ('SENT','MANUAL_READY') AND c.consumed_at IS NULL AND c.superseded_at IS NULL AND c.expires_at>? AND s.active_challenge_id=c.id AND s.email_key=c.email_key AND s.email_version=c.email_version AND s.status='PENDING_VERIFICATION'",
        digest(value),
        now,
      );
      if (!row) throw invalid();
      await this.bank.run(
        'UPDATE student_email_challenges SET consumed_at=? WHERE id=?',
        now,
        String(row.id),
      );
      await this.bank.run(
        "UPDATE students SET status='VERIFIED_AWAITING_CODE',email_verified_at=?,active_challenge_id=NULL,revision=revision+1,updated_at=? WHERE id=?",
        now,
        now,
        String(row.student_id),
      );
      await this.event(String(row.student_id), null, 'EMAIL_VERIFIED');
    });
  }
  async manage(id: string, revision: unknown, action: string, actor: string, email?: unknown) {
    if (!Number.isSafeInteger(revision)) throw new BankError('Student revision required');
    if (!['generate', 'reset', 'disable', 'reactivate', 'revoke', 'email'].includes(action))
      throw new BankError('Unknown student action');
    let code: string | undefined, hash: string | undefined;
    if (action === 'generate' || action === 'reset') {
      const row = await this.row(id, revision);
      if (
        row.email_verified_at === null ||
        row.status !== (action === 'generate' ? 'VERIFIED_AWAITING_CODE' : 'ACTIVE')
      )
        throw new BankError('A verified, enabled student is required', 409);
      if (this.hashesInFlight >= 2) throw new BankError('Try again shortly', 429);
      this.hashesInFlight++;
      try {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        code = Array.from(randomBytes(20), (b) => alphabet[b & 31]).join('');
        hash = await hashPassword(code);
      } finally {
        this.hashesInFlight--;
      }
    }
    const student = await this.bank.transaction(async () => {
      const row = await this.row(id, revision),
        now = this.now();
      if (hash) {
        if (
          row.email_verified_at === null ||
          row.status !== (action === 'generate' ? 'VERIFIED_AWAITING_CODE' : 'ACTIVE')
        )
          throw new BankError('A verified, enabled student is required', 409);
        await this.bank.run(
          "UPDATE students SET access_code_hash=?,status='ACTIVE' WHERE id=?",
          hash,
          id,
        );
      } else if (action === 'disable') {
        await this.bank.run(
          "UPDATE students SET status='DISABLED',access_code_hash=NULL,active_challenge_id=NULL WHERE id=?",
          id,
        );
      } else if (action === 'reactivate') {
        if (row.status !== 'DISABLED') throw new BankError('Student is not disabled', 409);
        await this.bank.run(
          'UPDATE students SET status=?,access_code_hash=NULL WHERE id=?',
          row.email_verified_at === null ? 'PENDING_VERIFICATION' : 'VERIFIED_AWAITING_CODE',
          id,
        );
      } else if (action === 'email') {
        const replacement = emailInput(email);
        if (replacement.key === row.email_key) throw new BankError('Enter a different email');
        if (await this.bank.one('SELECT id FROM students WHERE email_key=?', replacement.key))
          throw new BankError('This email is already registered', 409);
        await this.bank.run(
          "UPDATE students SET email=?,email_key=?,email_version=email_version+1,email_verified_at=NULL,access_code_hash=NULL,active_challenge_id=NULL,delivery_state='NOT_SENT',status=?,last_attempt_at=NULL WHERE id=?",
          replacement.email,
          replacement.key,
          row.status === 'DISABLED' ? 'DISABLED' : 'PENDING_VERIFICATION',
          id,
        );
      }
      if (action === 'disable' || action === 'email')
        await this.bank.run(
          'UPDATE student_email_challenges SET superseded_at=? WHERE student_id=? AND consumed_at IS NULL AND superseded_at IS NULL',
          now,
          id,
        );
      await this.bank.run(
        'UPDATE students SET credential_version=credential_version+1,revision=revision+1,updated_at=? WHERE id=?',
        now,
        id,
      );
      await this.bank.run(
        'UPDATE student_sessions SET revoked_at=? WHERE student_id=? AND revoked_at IS NULL',
        now,
        id,
      );
      await this.event(id, actor, action.toUpperCase());
      return record(await this.row(id));
    });
    return code ? { student, code } : { student };
  }
  get cookieName() {
    return this.hosted ? '__Host-qb_student' : 'qb_student';
  }
  private cookie(req: Request) {
    const matches = (req.headers.cookie ?? '')
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.startsWith(this.cookieName + '='));
    if (matches.length !== 1) return;
    const token = matches[0].slice(this.cookieName.length + 1);
    return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
  }
  async identity(req: Request): Promise<StudentIdentity | undefined> {
    const token = this.cookie(req);
    if (!token) return;
    const row = await this.bank.one(
      "SELECT s.id,s.email FROM student_sessions t JOIN students s ON s.id=t.student_id WHERE t.token_digest=? AND t.revoked_at IS NULL AND t.expires_at>? AND t.credential_version=s.credential_version AND s.status='ACTIVE' AND s.email_verified_at IS NOT NULL AND s.access_code_hash IS NOT NULL",
      digest(token),
      this.now(),
    );
    return row ? { id: String(row.id), email: String(row.email), role: 'student' } : undefined;
  }
  async login(req: Request, res: Response) {
    this.auth.csrf(req);
    let key = 'invalid';
    try {
      key = emailInput(req.body?.email).key;
    } catch {
      /* Generic failure. */
    }
    await this.auth.limit('student-login-global', 'all', 60, 60000);
    await this.auth.limit('student-login-ip', this.auth.clientAddress(req), 20, 15 * 60000);
    await this.auth.limit('student-login-account', key, 5, 15 * 60000);
    if (this.hashesInFlight >= 2) throw new BankError('Try again shortly', 429);
    this.hashesInFlight++;
    let row: Row | undefined;
    const invalid = () => new BankError('Invalid student credentials', 401);
    try {
      row = await this.bank.one('SELECT * FROM students WHERE email_key=?', key);
      const candidate =
        typeof req.body?.code === 'string' && Buffer.byteLength(req.body.code) <= 1024
          ? req.body.code
          : '';
      const hash = row?.access_code_hash
        ? String(row.access_code_hash)
        : `scrypt$32768$8$3$${'0'.repeat(32)}$${'0'.repeat(128)}`;
      if (
        !(await verifyPassword(candidate, hash)) ||
        !row ||
        row.status !== 'ACTIVE' ||
        row.email_verified_at === null
      )
        throw invalid();
    } finally {
      this.hashesInFlight--;
    }
    const token = randomBytes(32).toString('base64url'),
      now = this.now();
    await this.bank.transaction(async () => {
      const current = await this.row(String(row!.id));
      if (
        current.status !== 'ACTIVE' ||
        current.email_verified_at === null ||
        current.credential_version !== row!.credential_version ||
        current.access_code_hash !== row!.access_code_hash
      )
        throw invalid();
      const old = this.cookie(req);
      if (old)
        await this.bank.run(
          'UPDATE student_sessions SET revoked_at=? WHERE token_digest=?',
          now,
          digest(old),
        );
      await this.bank.run('DELETE FROM student_sessions WHERE expires_at<=?', now);
      await this.bank.run(
        'INSERT INTO student_sessions(token_digest,student_id,credential_version,created_at,expires_at) VALUES(?,?,?,?,?)',
        digest(token),
        String(current.id),
        Number(current.credential_version),
        now,
        now + lifetime,
      );
    });
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.hosted,
      sameSite: 'strict',
      path: '/',
      maxAge: lifetime,
    });
    return {
      authenticated: true,
      user: { id: String(row!.id), email: String(row!.email), role: 'student' as const },
    };
  }
  async logout(req: Request, res: Response) {
    this.auth.csrf(req);
    const token = this.cookie(req);
    if (token)
      await this.bank.run(
        'UPDATE student_sessions SET revoked_at=? WHERE token_digest=?',
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
