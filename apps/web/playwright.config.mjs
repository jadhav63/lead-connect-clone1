import { defineConfig } from '@playwright/test';
const baseURL = process.env.BROWSER_TEST_URL || 'http://127.0.0.1:38507';
const target = new URL(baseURL);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.protocol !== 'http:') throw new Error('Browser acceptance tests require a disposable loopback application');
if (!process.env.LOCAL_UI_FIXTURE_FILE?.startsWith('/tmp/lead-connect-')) throw new Error('Use a private disposable local fixture');
export default defineConfig({
  testDir: './tests/e2e', workers: 1, retries: 0, timeout: 60_000,
  reporter: 'list', outputDir: '/tmp/lead-connect-browser-results', preserveOutput: 'never', use: { baseURL, trace: 'off', video: 'off', screenshot: 'off',
    launchOptions: { ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] } },
});
