import { test, expect } from '@playwright/test';
import express from 'express';
import { resolve } from 'node:path';
import { createApp } from '../../server/app.js';
import { imageEnvironment } from '../image-fixture.js';

// Credentials/links remain only in test memory; never record browser traces for this workflow.
test.use({ trace: 'off' });
test('Manual registration, scanner-safe confirmation, code issuance, student login and immediate disable', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const e = await imageEnvironment(),
    q = (await e.create()).question;
  await e.service.status(
    q.id,
    { status: 'approved', expectedRevision: 1, confirmed: true },
    e.actor,
  );
  const app = createApp(e.bank, e.storage);
  app.get('/verify-email', (_req, res) => res.sendFile(resolve('dist/verify-email.html')));
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Local test server unavailable');
  const base = 'http://127.0.0.1:' + address.port,
    admin = await browser.newContext(),
    student = await browser.newContext();
  try {
    await admin.addCookies([
      {
        name: 'qb_admin',
        value: e.cookie.slice('qb_admin='.length),
        url: base,
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);
    const page = await admin.newPage();
    await page.goto(base + '/admin/students');
    await page.getByLabel('New student email').fill('browser-student@example.invalid');
    await page.getByRole('button', { name: 'Add student', exact: true }).click();
    const row = page.getByRole('row').filter({ hasText: 'browser-student@example.invalid' });
    await expect(row).toContainText('Pending verification');
    await expect(row.getByRole('button', { name: 'Generate access code' })).toHaveCount(0);
    await row.getByRole('button', { name: 'Generate verification link', exact: true }).click();
    await expect(page.getByLabel('Verification link', { exact: true })).toBeVisible();
    const link = await page.getByLabel('Verification link', { exact: true }).inputValue();
    const parsed = new URL(link),
      verification = base + parsed.pathname + parsed.hash;
    await page.getByRole('button', { name: 'Dismiss link' }).click();
    await expect(page.getByLabel('Verification link', { exact: true })).toHaveCount(0);
    const visitor = await student.newPage(),
      external: string[] = [],
      errors: string[] = [];
    visitor.on('request', (r) => {
      if (new URL(r.url()).origin !== base) external.push(new URL(r.url()).origin);
    });
    visitor.on('pageerror', (e) => errors.push(e.message));
    const response = await visitor.goto(verification);
    expect(response?.headers()['referrer-policy']).toBe('no-referrer');
    expect(response?.headers()['cache-control']).toContain('no-store');
    await expect(
      visitor.getByRole('button', { name: 'Verify My Email', exact: true }),
    ).toBeVisible();
    expect(new URL(visitor.url()).hash).toBe('');
    await page.getByRole('button', { name: 'Refresh status' }).click();
    await expect(row).toContainText('Pending verification');
    expect((await student.request.get(base + '/api/questions')).status()).toBe(401);
    await visitor.getByRole('button', { name: 'Verify My Email', exact: true }).click();
    await expect(visitor.getByRole('status')).toContainText('Email verified');
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      (await student.request.get(base + '/api/auth/session').then((r) => r.json())).authenticated,
    ).toBe(false);
    await page.getByRole('button', { name: 'Refresh status' }).click();
    await expect(row).toContainText('awaiting access code');
    await row.getByRole('button', { name: 'Generate access code' }).click();
    const code = await page.getByLabel('Issued access code').textContent();
    expect(Boolean(code)).toBe(true);
    await page.getByRole('button', { name: 'Dismiss code' }).click();
    await visitor.goto(base);
    await visitor.getByLabel('Student email').fill('browser-student@example.invalid');
    await visitor.getByLabel('Access code', { exact: true }).fill(code!);
    await visitor.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      visitor.getByRole('heading', { name: 'Question bank', exact: true }),
    ).toBeVisible();
    await expect(visitor.getByRole('link', { name: 'Add question' })).toHaveCount(0);
    expect((await student.request.get(base + q.questionImage.url)).status()).toBe(200);
    expect((await student.request.get(base + q.answerImage!.url)).status()).toBe(200);
    page.on('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: 'Disable student' }).click();
    await expect(row).toContainText('Disabled');
    expect((await student.request.get(base + '/api/questions')).status()).toBe(401);
    expect((await student.request.get(base + q.answerImage!.url)).status()).toBe(401);
    await page.screenshot({ path: 'data/student-access/manual-management.png', fullPage: true });
  } finally {
    await admin.close();
    await student.close();
    await new Promise<void>((r) => server.close(() => r()));
    await e.close();
  }
});
test('Anonymous homepage shows login and exposes no academic images or metadata', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Student login', exact: true })).toBeVisible();
  await expect(page.locator('.question-card')).toHaveCount(0);
  for (const path of [
    '/api/taxonomy',
    '/api/questions',
    '/api/counts',
    '/api/public/question-set?ids=x',
    '/uploads/x.jpg',
  ])
    expect((await request.get(path)).status()).toBe(401);
});
