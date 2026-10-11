import { test, expect } from '@playwright/test';
import { testEmail, testPassword } from '../auth-fixture.js';

test('Bundled KaTeX size fonts load under CSP without font violations', async ({ page }) => {
  await page.addInitScript(() => {
    const auditWindow = window as unknown as { fontViolations: string[] };
    auditWindow.fontViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.effectiveDirective === 'font-src')
        auditWindow.fontViolations.push(event.blockedURI);
    });
  });
  await page.goto('/?q=TEST-S1-0');
  await expect(page.locator('.question-card')).toHaveCount(1);
  const result = await page.evaluate(async () => {
    const families = ['KaTeX_Size1', 'KaTeX_Size2', 'KaTeX_Size3', 'KaTeX_Size4'];
    const loaded = await Promise.all(
      families.map((family) => document.fonts.load('16px "' + family + '"')),
    );
    return {
      loaded: loaded.map(
        (faces) => faces.length > 0 && faces.every((face) => face.status === 'loaded'),
      ),
      violations: (window as unknown as { fontViolations: string[] }).fontViolations,
    };
  });
  expect(result.loaded).toEqual([true, true, true, true]);
  expect(result.violations).toEqual([]);
});

test('CSP blocks inline execution and third-party network access while public pages work', async ({
  page,
}) => {
  await page.goto('/?q=TEST-S1-0');
  await expect(page.locator('.question-card')).toHaveCount(1);
  const result = await page.evaluate(async () => {
    const violations: string[] = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(event.effectiveDirective),
    );
    const script = document.createElement('script');
    script.textContent = 'window.__securityTestExecuted = true';
    document.body.append(script);
    const blocked = await fetch('https://security-audit.example.invalid/', {
      method: 'POST',
      body: 'TEST ONLY',
    }).then(
      () => false,
      () => true,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { violations, blocked, executed: '__securityTestExecuted' in window };
  });
  expect(result.executed).toBe(false);
  expect(result.blocked).toBe(true);
  expect(result.violations).toEqual(expect.arrayContaining(['script-src-elem', 'connect-src']));
});

test('Admin credentials go only to the same-origin API and login/logout navigation stays same-origin', async ({
  page,
  baseURL,
}) => {
  const credentialDestinations: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.postData()?.includes(testPassword))
      credentialDestinations.push(request.url());
  });
  await page.goto('/admin/login');
  await page.getByLabel('Administrator email').fill(testEmail);
  await page.getByLabel('Password', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible();
  expect(credentialDestinations).toEqual([baseURL + '/api/auth/login']);
  expect(new URL(page.url()).origin).toBe(baseURL);
  expect(
    await page.evaluate(
      (password) =>
        [JSON.stringify(localStorage), JSON.stringify(sessionStorage), location.href].some((v) =>
          v.includes(password),
        ),
      testPassword,
    ),
  ).toBe(false);
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Admin login', exact: true })).toBeVisible();
  expect(new URL(page.url()).origin).toBe(baseURL);
});

test('Hostile embedding is blocked by the document frame policy', async ({ page }) => {
  const violations: string[] = [];
  await page.goto('/');
  page.on('console', (message) => {
    if (message.text().includes('frame-ancestors')) violations.push(message.text());
  });
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.src = '/admin/login';
    document.body.append(frame);
  });
  await expect.poll(() => violations.length).toBeGreaterThan(0);
});
