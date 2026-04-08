require('dotenv').config();

// ─── Environment map ──────────────────────────────────────────────────────────
// Each entry has two URLs:
//   appUrl — the browser-facing app URL used by Playwright's baseURL and page objects
//   apiUrl — the www. variant required by the Rails login endpoint (CSRF + session cookies)
//            The two hosts differ only for ShipSticks; apiUrl === appUrl on local.

const ENV_CONFIGS = {
  local: {
    appUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:3000',
  },
  staging: {
    appUrl: 'https://app.staging.shipsticks.com',
    apiUrl: 'https://www.app.staging.shipsticks.com',
  },
  production: {
    appUrl: 'https://app.shipsticks.com',
    apiUrl: 'https://www.app.shipsticks.com',
  },
};

// ─── Environment selector ─────────────────────────────────────────────────────
const TEST_ENV = process.env.TEST_ENV || 'staging';
const envConfig = ENV_CONFIGS[TEST_ENV];

if (!envConfig) {
  throw new Error(
    `Unknown TEST_ENV: "${TEST_ENV}". Valid options: ${Object.keys(ENV_CONFIGS).join(', ')}`
  );
}

// ─── URL resolution ───────────────────────────────────────────────────────────
// BASE_URL is still supported for one-off overrides (e.g. a review-app URL).
// When BASE_URL is set it takes priority; apiUrl mirrors it with the www. prefix.
const baseUrl = process.env.BASE_URL || envConfig.appUrl;
const apiUrl  = process.env.BASE_URL
  ? process.env.BASE_URL.replace('://app.', '://www.app.')
  : envConfig.apiUrl;

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  testEnv: TEST_ENV,
  baseUrl,
  apiUrl,
  headed:  process.env.HEADED === 'true',
  slowMo:  parseInt(process.env.SLOW_MO  || '0',     10),
  timeout: parseInt(process.env.TIMEOUT  || '60000', 10),
  testData: {
    shipmentType: 'One way',
    origin:       '1234 Main Street, Los Angeles, CA, USA',
    destination:  '4321 Main St, Miami Lakes, FL, USA',
    itemType:     'Golf Bag (Standard)',
    serviceLevel: 'Ground',
    deliveryDate: 'April 8, 2026',
  },
};
