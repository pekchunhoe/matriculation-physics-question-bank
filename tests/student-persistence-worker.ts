// Runs in a separate process so native Windows libSQL handles are released before cleanup.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';
import { Bank } from '../server/database.js';
import { TursoAdapter } from '../server/turso-adapter.js';
import { StudentService } from '../server/students.js';
import { applyMigrations } from '../server/migrations.js';
import { seedAdminSession } from './auth-fixture.js';
import type { Request, Response } from 'express';
const url = 'file:' + process.argv[2].replaceAll('\\', '/');
let bank = new Bank(new TursoAdapter(createClient({ url })));
try {
  await applyMigrations(bank.db);
  await seedAdminSession(bank);
  const actor = String((await bank.one('SELECT id FROM admins'))!.id);
  let service = new StudentService(bank);
  const s = await service.register('persist@example.invalid', randomUUID(), actor);
  const link = await service.manualLink(s.id, s.revision, randomUUID(), actor);
  const token = new URLSearchParams(new URL(link.link).hash.slice(1)).get('token')!;
  await bank.close();
  bank = new Bank(new TursoAdapter(createClient({ url })));
  service = new StudentService(bank);
  await service.verify(token);
  const rev = Number((await bank.one('SELECT revision FROM students WHERE id=?', s.id))!.revision),
    issued = await service.manage(s.id, rev, 'generate', actor);
  let cookie = '';
  await service.login(
    {
      body: { email: s.email, code: issued.code },
      headers: { host: 'localhost', origin: 'http://localhost', 'x-question-bank-request': '1' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request,
    {
      cookie(name: string, value: string) {
        cookie = name + '=' + value;
      },
    } as unknown as Response,
  );
  await bank.close();
  bank = new Bank(new TursoAdapter(createClient({ url })));
  service = new StudentService(bank);
  const req = { headers: { cookie } } as Request;
  assert.equal((await service.identity(req))?.id, s.id);
  await service.manage(s.id, issued.student.revision, 'disable', actor);
  assert.equal(await new StudentService(bank).identity(req), undefined);
  await bank.close();
  process.stdout.write('PASS');
} catch {
  await bank.close().catch(() => {});
  process.stderr.write('Persistence assertions failed (details withheld)');
  process.exitCode = 1;
}
