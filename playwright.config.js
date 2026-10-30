import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '*.spec.js', workers: 1, timeout: 300000,
  reporter: [['list'], ['json', { outputFile: 'test-results/browser.json' }]],
  use: {
    baseURL: process.env.CAPTIONS_TEST_URL || 'http://127.0.0.1:4173',
    channel: process.env.CAPTIONS_BROWSER_CHANNEL || 'chrome',
    viewport: { width: 1280, height: 1000 },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: process.env.CAPTIONS_TEST_URL ? undefined : {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 30000,
  },
});
