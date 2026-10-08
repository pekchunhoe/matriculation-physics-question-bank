import { emitKeypressEvents } from 'node:readline';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { Bank, BankError } from '../server/database.js';
import { SQLiteAdapter } from '../server/sqlite-adapter.js';
import { TursoAdapter } from '../server/turso-adapter.js';
import { applyMigrations, assertCurrentSchema } from '../server/migrations.js';
import { bootstrapAdmin, normalizeEmail } from '../server/auth.js';

function hiddenPassword(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new BankError(
      'Use an interactive terminal; passwords are never accepted as arguments or environment variables',
    );
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => {
      process.stdin.off('keypress', listener);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const listener = (text: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        finish();
        reject(new BankError('Bootstrap cancelled'));
      } else if (key.name === 'return') {
        finish();
        resolve(value);
      } else if (key.name === 'backspace') value = [...value].slice(0, -1).join('');
      else if (
        text &&
        !key.ctrl &&
        !/[\p{Cc}]/u.test(text) &&
        Buffer.byteLength(value + text) <= 1024
      )
        value += text;
    };
    process.stdin.on('keypress', listener);
  });
}
async function main() {
  const args = process.argv.slice(2),
    command = args.shift();
  const value = (flag: string) => {
    const index = args.indexOf(flag);
    return index < 0 ? undefined : args[index + 1];
  };
  if (!['migrate', 'bootstrap', 'revoke'].includes(command ?? ''))
    throw new BankError('Choose migrate, bootstrap or revoke');
  const valued = new Set(['--local', '--target', ...(command === 'migrate' ? [] : ['--email'])]);
  const acknowledgement =
    command === 'migrate'
      ? '--apply'
      : command === 'bootstrap'
        ? '--create-first-admin'
        : '--revoke-all-sessions';
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new BankError('Duplicate administrative argument');
    seen.add(flag);
    if (valued.has(flag)) {
      if (!args[index + 1] || args[index + 1].startsWith('--'))
        throw new BankError('Missing administrative argument value');
      index++;
    } else if (flag !== acknowledgement)
      throw new BankError(
        'Unsupported administrative argument; passwords must be entered at the hidden prompt',
      );
  }
  const local = value('--local'),
    target = value('--target');
  if (Boolean(local) === Boolean(target))
    throw new BankError(
      'Choose exactly one explicit --local database path or --target Turso database name',
    );
  if (local && resolve(local) === resolve('data/bank.sqlite'))
    throw new BankError(
      'The original SQLite migration source is protected; use a separate recovery/test database',
    );
  if (local && !existsSync(resolve(local)))
    throw new BankError('Local administrative tooling requires an existing reviewed database');
  if (target) {
    const url = new URL(process.env.TURSO_DATABASE_URL ?? '');
    if (
      !/^[a-z0-9-]+$/.test(target) ||
      url.protocol !== 'libsql:' ||
      !url.hostname.startsWith(target + '-') ||
      !url.hostname.endsWith('.turso.io')
    )
      throw new BankError('Server credential endpoint does not match the explicit Turso target');
  }
  const adapter = local ? new SQLiteAdapter(resolve(local)) : TursoAdapter.fromEnvironment();
  const bank = new Bank(adapter);
  try {
    if (command === 'migrate') {
      const applied = (
        await bank.all('SELECT version FROM schema_migrations ORDER BY version')
      ).map((row) => row.version);
      if (JSON.stringify(applied) !== '[1,2]' && JSON.stringify(applied) !== '[1,2,3]')
        throw new BankError('Auth migration requires the existing 001/002 baseline');
      if (applied.length === 3) {
        await assertCurrentSchema(adapter);
        console.log('Auth schema already current; no changes');
        return;
      }
      if (!args.includes('--apply')) {
        console.log(
          'Migration 003 pending. Review SQL, take a backup, then explicitly repeat with --apply. No schema changes made.',
        );
        return;
      }
      await applyMigrations(adapter, {
        beforeMigration: async (version) => {
          if (version !== 3)
            throw new BankError('Only migration 003 is authorized by this command');
        },
      });
      await assertCurrentSchema(adapter);
      console.log(
        'Migration 003 applied transactionally; complete runtime schema verified. No administrator created.',
      );
    } else {
      await assertCurrentSchema(adapter);
      const email = normalizeEmail(value('--email'));
      if (command === 'bootstrap') {
        if (!args.includes('--create-first-admin'))
          throw new BankError('Explicit --create-first-admin acknowledgement required');
        if (await bank.one('SELECT id FROM admins LIMIT 1'))
          throw new BankError('First-admin bootstrap refused: an administrator already exists');
        const password = await hiddenPassword(
          'Administrator password (hidden, minimum 15 characters): ',
        );
        if (password !== (await hiddenPassword('Confirm password (hidden): ')))
          throw new BankError('Passwords do not match');
        await bootstrapAdmin(bank, email, password);
        console.log('First administrator created. No password or hash was printed.');
      } else {
        if (!args.includes('--revoke-all-sessions'))
          throw new BankError('Explicit --revoke-all-sessions acknowledgement required');
        await bank.transaction(async () => {
          const admin = await bank.one('SELECT id FROM admins WHERE email=?', email);
          if (!admin) throw new BankError('Administrator not found');
          await bank.run(
            'UPDATE admin_sessions SET revoked_at=? WHERE admin_id=?',
            Date.now(),
            String(admin.id),
          );
        });
        console.log('Administrator sessions revoked.');
      }
    }
  } finally {
    await bank.close();
  }
}
await main().catch((error: unknown) => {
  console.error(
    error instanceof BankError
      ? error.message
      : 'Administrative operation failed; verify target, credentials, connectivity and migration state',
  );
  process.exitCode = 1;
});
