import { type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axe = readFileSync(require.resolve('axe-core/axe.min.js'));

/** Serve the test instrumentation from this test origin without relaxing CSP. */
export async function installAxe(page: Page) {
  await page.route('**/__test__/axe.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: axe }),
  );
  await page.addScriptTag({ url: '/__test__/axe.js' });
}
