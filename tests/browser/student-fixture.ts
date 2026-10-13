import { test as base, expect } from '@playwright/test';
import { studentEmail, studentCode } from '../student-fixture.js';
type StudentState = {
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
export const test = base.extend<object, { studentState: StudentState }>({
  studentState: [
    async ({ browserName }, use) => {
      const response = await fetch('http://127.0.0.1:3100/api/student-auth/login', {
        method: 'POST',
        headers: {
          Origin: 'http://127.0.0.1:3100',
          'X-Question-Bank-Request': '1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: studentEmail, code: studentCode }),
      });
      expect(response.status, `Authenticated ${browserName} fixture`).toBe(200);
      const raw = response.headers.get('set-cookie')!.split(';')[0];
      await use({
        cookies: [
          {
            name: 'qb_student',
            value: raw.slice('qb_student='.length),
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
  storageState: async ({ studentState }, use) => use(studentState),
  extraHTTPHeaders: async ({ baseURL }, use) =>
    use({ Origin: baseURL!, 'X-Question-Bank-Request': '1' }),
  request: async ({ playwright, studentState, baseURL, extraHTTPHeaders }, use) => {
    const context = await playwright.request.newContext({
      baseURL,
      storageState: studentState,
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
