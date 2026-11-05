const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

/**
 * See https://playwright.dev/docs/test-configuration.
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 640 },
      },
      dependencies: ['setup'],
    },
  ],
});
