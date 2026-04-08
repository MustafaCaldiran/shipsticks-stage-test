# Ship Sticks QA Automation

Playwright end-to-end test suite for the Ship Sticks booking flow, written in JavaScript using the page object model.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Project Structure](#project-structure)
3. [Setup](#setup)
4. [How the Environment System Works](#how-the-environment-system-works)
5. [Running Tests](#running-tests)
6. [Environment Variables Reference](#environment-variables-reference)
7. [What Was Refactored and Why](#what-was-refactored-and-why)
8. [Architecture Notes](#architecture-notes)

---

## Project Overview

This suite covers the Ship Sticks web app end-to-end:

- Homepage quote widget (origin, destination, shipment type)
- Step 1 booking form (items, delivery date, shipping speed)
- Login / order summary page
- User sign-up flow (API and UI)
- Environment guardrail test that catches bot-protection redirects explicitly

**Stack:**

- Node.js 20+
- Playwright Test (`@playwright/test`)
- JavaScript — no TypeScript
- dotenv for `.env` file support
- GitHub Actions for CI

---

## Project Structure

```
config/
  env.js              ← single source of truth for all environment URLs and settings

pages/
  BasePage.js         ← shared helpers: careful typing, autocomplete waits, cookie banners
  HomePage.js         ← homepage quote widget + sign-in / sign-up modal flows
  BookingStep1Page.js ← /book/ship: items, dates, shipping speeds
  BookingLoginPage.js ← login page shown after Step 1
  ReviewPage.js
  TravelersPage.js
  PaymentPage.js
  OrderConfirmationPage.js

tests/
  booking.spec.js           ← happy-path booking flow, scenario-driven
  booking-blocking.spec.js  ← guardrail: explicit failure if bot protection fires

utils/
  globalSetup.js   ← API login before the suite; saves session to .auth/storageState.json
  fixtures.js      ← custom `test` export that preloads saved auth state
  testData.js      ← test scenarios, addresses, item configs, auth data
  createUser.js    ← create a user via API (fast) or via UI (when testing sign-up itself)
  networkLogger.js ← reusable request/response logging helpers

playwright.config.js  ← Playwright config: browsers, timeouts, artifacts, baseURL
package.json
```

---

## Setup

```bash
npm install
npx playwright install chromium --with-deps
```

Optional: copy `.env.example` to `.env` and fill in values (or pass everything inline at the terminal).

---

## How the Environment System Works

### The problem this solves

Before the refactor, three files each hard-coded their own staging URL and were not connected to each other. Running `BASE_URL=https://app.shipsticks.com playwright test` changed the browser URL but the API login still hit staging. There was no way to say "run everything against production" from a single variable.

### The solution: `TEST_ENV`

Set one variable and every part of the framework points at the right environment:

```bash
TEST_ENV=staging     # default
TEST_ENV=production
TEST_ENV=local
```

### Where the URLs are defined

`config/env.js` contains an environment map. This is the only place URLs are declared:

```js
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
```

**Two URLs per environment:**

- `appUrl` — the browser-facing URL. Used by Playwright's `baseURL` fixture and by page objects when they navigate. This is `app.*`.
- `apiUrl` — the `www.app.*` variant. The Ship Sticks Rails login endpoint requires this host. Used by `globalSetup.js` for the pre-suite API login and by `createUser.js` for user creation.

`config/env.js` exports both so every file imports what it needs with no further URL construction.

### How data flows

```
TEST_ENV=staging
      │
      ▼
config/env.js  ──► ENV_CONFIGS['staging']
                         │
               ┌─────────┴──────────┐
               │                    │
            baseUrl              apiUrl
  app.staging.shipsticks.com   www.app.staging…
               │                    │
               ▼                    ▼
  playwright.config.js       globalSetup.js
  (Playwright baseURL)        (API login before suite)
  page objects                createUser.js
  test fixtures
```

### BASE_URL override (still supported)

You can still pass a full URL directly for one-off runs, for example a review-app:

```bash
BASE_URL=https://app.review-123.shipsticks.com npx playwright test
```

When `BASE_URL` is set it overrides `TEST_ENV` for `appUrl`. The `apiUrl` is derived from it automatically by prepending `www.`.

### Error if TEST_ENV is unknown

If you set `TEST_ENV` to a value that is not in the map, the framework throws immediately before any test runs:

```
Error: Unknown TEST_ENV: "uat". Valid options: local, staging, production
```

---

## Running Tests

### By environment

```bash
# Staging (default)
npm test
npm run test:staging

# Production
npm run test:prod

# Local dev server
npm run test:local
```

### Headed mode (open browser window)

```bash
HEADED=true npm test
npm run test:headed
npm run test:staging:headed
npm run test:prod:headed
```

### Specific test file

```bash
TEST_ENV=staging npx playwright test tests/booking.spec.js
TEST_ENV=production npx playwright test tests/booking-blocking.spec.js
```

### Specific browser

```bash
BROWSERS=firefox npm test
BROWSERS=chromium,firefox,webkit npm test   # all browsers
npm run test:firefox
npm run test:webkit
```

### Specific scenarios

```bash
SCENARIOS=challenge npx playwright test
SCENARIOS=challenge,two_golf_bags_ground npx playwright test
```

### Slow motion (useful for demos)

```bash
HEADED=true SLOW_MO=500 npm test
```

### Verbose (trace + screenshot + video on every test)

```bash
npm run test:verbose
VERBOSE=true npx playwright test
```

### CI mode

```bash
npm run test:ci
```

Enables retries, locks worker count to 1, and disables `--forbid-only` bypass.

### One-off review-app URL

```bash
BASE_URL=https://app.review-123.shipsticks.com npx playwright test
```

---

## Environment Variables Reference

| Variable         | Default    | Description |
|------------------|------------|-------------|
| `TEST_ENV`       | `staging`  | Named environment: `local`, `staging`, or `production` |
| `BASE_URL`       | *(unset)*  | Full URL override — takes priority over `TEST_ENV` |
| `HEADED`         | `false`    | Set to `true` to open a visible browser window |
| `SLOW_MO`        | `0`        | Milliseconds to slow each action (useful for demos) |
| `TIMEOUT`        | `60000`    | Default test timeout in ms |
| `BROWSERS`       | `chromium` | Comma-separated: `chromium`, `firefox`, `webkit` |
| `WORKERS`        | *(auto)*   | Number of parallel workers |
| `FULLY_PARALLEL` | `false`    | Set to `true` to run all tests in parallel |
| `VERBOSE`        | `false`    | Set to `true` to capture trace/screenshot/video on every test |
| `SCENARIOS`      | *(all)*    | Comma-separated scenario names to run a subset |
| `CI`             | *(unset)*  | Set by CI — enables retries, sets workers to 1 |

---

## What Was Refactored and Why

### Before the refactor

Three separate files each maintained their own private URL:

**`utils/globalSetup.js`** had a hardcoded constant that had nothing to do with `config/env.js`:

```js
// OLD — completely disconnected from the config system
const BASE_URL = 'https://www.app.staging.shipsticks.com';
```

This meant the API login step always targeted staging no matter what `BASE_URL` or any other variable you set. The browser tests and the auth step were pointed at different environments without any warning.

**`config/env.js`** had no named environment concept — just a single URL:

```js
// OLD — no TEST_ENV, no environment map, one URL
baseUrl: process.env.BASE_URL || 'https://app.staging.shipsticks.com',
```

There was no way to say "staging" or "production" — you had to remember and type the full URL every time.

**`utils/createUser.js`** did manual string manipulation to produce the `www.` host it needed for API calls:

```js
// OLD — brittle, duplicated the www. knowledge inline
const apiBase = baseURL.replace('://app.', '://www.app.');
```

**`playwright.config.js`** had the env-driven `headless` line commented out and replaced with a hardcoded value:

```js
// OLD — HEADED env var had no effect
// headless: !env.headed,
headless: false,
```

### After the refactor

**`config/env.js`** is the single source of truth. It exports `baseUrl` (for the browser) and `apiUrl` (for the API, which needs `www.`). Every other file imports what it needs:

```js
// NEW
const ENV_CONFIGS = {
  staging:    { appUrl: 'https://app.staging.shipsticks.com', apiUrl: 'https://www.app.staging.shipsticks.com' },
  production: { appUrl: 'https://app.shipsticks.com',         apiUrl: 'https://www.app.shipsticks.com' },
  local:      { appUrl: 'http://localhost:3000',              apiUrl: 'http://localhost:3000' },
};
module.exports = { baseUrl, apiUrl, testEnv, headed, slowMo, timeout, testData };
```

**`utils/globalSetup.js`** now reads from config instead of declaring its own constant:

```js
// NEW
const env = require('../config/env');
const BASE_URL = env.apiUrl;   // correct www. host for active TEST_ENV
```

**`utils/createUser.js`** uses `env.apiUrl` directly — no string manipulation:

```js
// NEW
const apiBase = baseURL === env.baseUrl ? env.apiUrl : baseURL.replace('://app.', '://www.app.');
```

**`playwright.config.js`** headless is now driven by `HEADED`:

```js
// NEW
headless: !env.headed,
```

### Files that were already correct

`tests/booking.spec.js`, `tests/booking-blocking.spec.js`, `pages/HomePage.js`, and `pages/BookingStep1Page.js` all received `baseURL` as a constructor argument or Playwright fixture — they had no hardcoded URLs and required no changes.

### Summary of changes

| File | Change |
|------|--------|
| `config/env.js` | Rewrote — added `ENV_CONFIGS` map, `TEST_ENV` selector, exports `baseUrl` + `apiUrl` |
| `utils/globalSetup.js` | Removed hardcoded `BASE_URL` constant — now reads `env.apiUrl` |
| `utils/createUser.js` | Removed `.replace()` URL hack — now uses `env.apiUrl` |
| `playwright.config.js` | Fixed `headless: false` → `headless: !env.headed` |
| `package.json` | Added `test:staging`, `test:prod`, `test:local`, `test:staging:headed`, `test:prod:headed` |

---

## Architecture Notes

### Why two URLs per environment?

Ship Sticks runs `app.staging.*` for the web application and `www.app.staging.*` for the Rails backend that handles the login form and API endpoints. Playwright's browser navigation works against `app.*`. The API login in `globalSetup.js` and the user creation POST in `createUser.js` must go to `www.app.*` or the server redirects them and the session cookies are not set correctly.

By declaring both URLs explicitly in the config map, the distinction is visible and intentional — not hidden inside a string replacement in a utility file.

### Why global setup uses the API instead of UI login?

`globalSetup.js` performs a form-based HTTP login (GET the page → extract CSRF token → POST credentials) and saves the resulting cookies to `.auth/storageState.json`. Tests that import from `utils/fixtures.js` start with that file pre-loaded, so they are already authenticated without going through the sign-in modal each time. This is faster, less flaky, and scales to many workers.

### Page objects receive baseURL as a constructor argument

`HomePage` and `BookingStep1Page` receive `baseUrl` in their constructor rather than importing `config/env.js` directly. This keeps page objects decoupled from the config layer and makes them easier to test in isolation. The value comes from Playwright's built-in `baseURL` fixture in each test, which is set from `env.baseUrl` in `playwright.config.js`.
