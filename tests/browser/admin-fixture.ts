import { test as base, expect } from '@playwright/test';
import { testEmail, testPassword } from '../auth-fixture.js';
type AdminState = {
  cookies: {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict';
  }[];
  origins: [];
};
export const test = base.extend<object, { adminState: AdminState }>({
  adminState: [
    async ({ browserName }, use) => {
      const response = await fetch('http://127.0.0.1:3100/api/auth/login', {
        method: 'POST',
        headers: {
          Origin: 'http://127.0.0.1:3100',
          'X-Question-Bank-Request': '1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });
      expect(response.status, `Authenticated ${browserName} fixture`).toBe(200);
      const raw = response.headers.get('set-cookie')!.split(';')[0];
      await use({
        cookies: [
          {
            name: 'qb_admin',
            value: raw.slice('qb_admin='.length),
            domain: '127.0.0.1',
            path: '/',
            expires: Date.now() / 1000 + 3600,
            httpOnly: true,
            secure: false,
            sameSite: 'Strict',
          },
        ],
        origins: [],
      });
    },
    { scope: 'worker' },
  ],
  storageState: async ({ adminState }, use) => use(adminState),
  extraHTTPHeaders: async ({ baseURL }, use) =>
    use({ Origin: baseURL!, 'X-Question-Bank-Request': '1' }),
  request: async ({ playwright, adminState, baseURL, extraHTTPHeaders }, use) => {
    const context = await playwright.request.newContext({
      baseURL,
      storageState: adminState,
      extraHTTPHeaders,
    });
    try {
      await use(context);
    } finally {
      await context.dispose();
    }
  },
});
export { expect };
