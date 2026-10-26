import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'reports/playwright-results.json' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on',
    screenshot: 'on',
    video: 'off',
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  outputDir: 'test-results/',
});
