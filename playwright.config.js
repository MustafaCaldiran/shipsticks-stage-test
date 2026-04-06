const { defineConfig, devices } = require('@playwright/test');
const env = require('./config/env');

const browserProjects = {
  chromium: {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  firefox: {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  webkit: {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
};

const requestedBrowsers = (process.env.BROWSERS || 'chromium')
  .split(',')
  .map((browser) => browser.trim())
  .filter(Boolean);

module.exports = defineConfig({
  globalSetup: require.resolve('./utils/globalSetup'),
  testDir: './tests',
  fullyParallel: process.env.FULLY_PARALLEL === 'true',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : (process.env.CI ? 1 : undefined),
  timeout: env.timeout,
  expect: {
    timeout: 15000,
  },
  reporter: [['html', { open: 'never' }], ['line']],
  use: {
    baseURL: env.baseUrl,
    // headless: !env.headed,
    headless: false,
    slowMo: env.slowMo,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
    },
  },
  projects: requestedBrowsers.map((browser) => {
    const project = browserProjects[browser];
    if (!project) {
      throw new Error(`Unsupported browser project: ${browser}`);
    }

    return project;
  }),
});
