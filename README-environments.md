# Environment Configuration Guide

This document explains the environment system in this Playwright framework: what was hard-coded before, what changed, and how to run tests against any environment from the terminal.

---

## What Was Hard-Coded Before

### Problem 1 — `utils/globalSetup.js` ignored the central config

```js
// OLD — hardcoded staging URL, completely independent of config/env.js
const BASE_URL = 'https://www.app.staging.shipsticks.com';
```

The global setup (which does the API login before all tests) used its own private constant instead of reading from the shared config file. This meant:

- Running `BASE_URL=https://app.shipsticks.com playwright test` had no effect on the login step.
- The login always targeted staging, even if you intended to test production.
- The two places defining the base URL could silently drift apart.

### Problem 2 — `config/env.js` had no named environment concept

```js
// OLD — only a single URL, no staging/production/local distinction
baseUrl: process.env.BASE_URL || 'https://app.staging.shipsticks.com',
```

There was no `TEST_ENV=staging` selector. Switching environments required remembering (and typing) a full URL every time.

### Problem 3 — `utils/createUser.js` did manual string manipulation

```js
// OLD — brittle URL transformation inline in the helper
const apiBase = baseURL.replace('://app.', '://www.app.');
```

The `www.` prefix requirement (needed because ShipSticks' Rails login endpoint lives on `www.app.`) was duplicated as a find-and-replace trick in a utility helper instead of being declared once in the config.

### Problem 4 — `playwright.config.js` had headless hardcoded

```js
// OLD — env-driven line commented out, hardcoded false below it
// headless: !env.headed,
headless: false,
```

Setting `HEADED=false` had no effect. Tests always ran in headed mode.

---

## What Changed

### `config/env.js` — new environment map and `TEST_ENV` selector

The file now owns a single source of truth for all environment URLs.

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

const TEST_ENV = process.env.TEST_ENV || 'staging';
```

Two URL keys per environment:
- `appUrl` — used by Playwright's `baseURL` and all page objects (browser-facing)
- `apiUrl` — used by `globalSetup` and `createUserViaApi` (the `www.` variant required by Rails)

The module exports both `baseUrl` and `apiUrl` so any file in the project can import the right one without transformation logic.

### `utils/globalSetup.js` — reads from `config/env.js`

```js
// NEW
const env = require('../config/env');
// ...
const BASE_URL = env.apiUrl;
```

The hardcoded constant is gone. `env.apiUrl` already carries the correct `www.` prefix for whichever `TEST_ENV` is active.

### `utils/createUser.js` — uses `env.apiUrl` instead of string replace

```js
// NEW
const apiBase = baseURL === env.baseUrl
  ? env.apiUrl
  : baseURL.replace('://app.', '://www.app.');
```

In normal usage `baseURL` equals `env.baseUrl`, so `env.apiUrl` is used directly. The fallback `.replace` only applies when a caller passes a custom URL (e.g. a one-off review-app).

### `playwright.config.js` — headless is now env-driven

```js
// NEW
headless: !env.headed,
```

Set `HEADED=true` to open a browser window. Omitting it runs headless.

### `package.json` — named environment scripts added

```json
"test:staging": "TEST_ENV=staging playwright test",
"test:prod":    "TEST_ENV=production playwright test",
"test:local":   "TEST_ENV=local playwright test",
```

---

## How the New Environment System Works

```
TEST_ENV=staging
      │
      ▼
config/env.js  ──► ENV_CONFIGS['staging']
                        │
              ┌─────────┴──────────┐
              │                    │
           appUrl               apiUrl
  https://app.staging…   https://www.app.staging…
              │                    │
              ▼                    ▼
   playwright.config.js     globalSetup.js
   (Playwright baseURL)     (API login)
   page objects             createUser.js
```

1. You set `TEST_ENV` (or rely on the default: `staging`).
2. `config/env.js` looks up the matching entry in `ENV_CONFIGS`.
3. `baseUrl` flows into `playwright.config.js` → Playwright's built-in `baseURL` fixture → every test automatically uses the right host.
4. `apiUrl` flows into `globalSetup.js` and `createUser.js` → API calls also target the right environment.

If `TEST_ENV` is not in `ENV_CONFIGS` the module throws immediately with a clear error message before any test runs.

---

## Running Tests

### Default (staging)

```bash
npm test
# or explicitly:
npm run test:staging
```

### Production

```bash
npm run test:prod
# or inline:
TEST_ENV=production npx playwright test
```

### Local dev server

```bash
npm run test:local
# or inline:
TEST_ENV=local npx playwright test
```

### Headed mode (opens a browser window)

```bash
HEADED=true npm test
npm run test:staging:headed
npm run test:prod:headed
```

### One-off custom URL (overrides TEST_ENV)

```bash
BASE_URL=https://app.review-123.shipsticks.com npx playwright test
```

`BASE_URL` still works as a full override. When set it bypasses `TEST_ENV` for the app URL, and `apiUrl` is derived from it automatically.

### Run a specific test file

```bash
TEST_ENV=staging npx playwright test tests/booking.spec.js
```

### Run with a specific browser

```bash
TEST_ENV=production BROWSERS=firefox npx playwright test
```

---

## Environment Variables Reference

| Variable    | Default    | Description |
|-------------|------------|-------------|
| `TEST_ENV`  | `staging`  | Named environment: `local`, `staging`, or `production` |
| `BASE_URL`  | *(unset)*  | Full URL override — takes priority over `TEST_ENV` |
| `HEADED`    | `false`    | `true` opens a visible browser window |
| `SLOW_MO`   | `0`        | Milliseconds to slow down each action (useful for demos) |
| `TIMEOUT`   | `60000`    | Default test timeout in milliseconds |
| `BROWSERS`  | `chromium` | Comma-separated list: `chromium`, `firefox`, `webkit` |
| `WORKERS`   | *(auto)*   | Number of parallel workers |
| `VERBOSE`   | `false`    | `true` enables trace/screenshot/video on every test |
| `CI`        | *(unset)*  | Set by CI systems — enables retries and disables `forbidOnly` |

---

## Files That Are Now Environment-Safe

| File | Status |
|------|--------|
| `config/env.js` | **Central config** — all environment values live here |
| `utils/globalSetup.js` | **Fixed** — reads `env.apiUrl`, no hard-coded URL |
| `utils/createUser.js` | **Fixed** — uses `env.apiUrl`, no string manipulation |
| `playwright.config.js` | **Fixed** — `headless` is now driven by `HEADED` env var |
| `tests/booking.spec.js` | Already safe — uses Playwright's `baseURL` fixture |
| `tests/booking-blocking.spec.js` | Already safe — uses Playwright's `baseURL` fixture |
| `pages/HomePage.js` | Already safe — receives `baseUrl` as constructor argument |
| `pages/BookingStep1Page.js` | Already safe — receives `baseUrl` as constructor argument |

---

## Limitations and Caveats

- **`local` environment requires a running dev server.** The framework does not start one for you. Run your local server before running `npm run test:local`.
- **Auth credentials are still hardcoded** in `globalSetup.js` and `testData.js`. For a production-ready framework these would come from environment variables or a secrets manager. For this interview project they are kept explicit for clarity.
- **Adding a new environment** is one object in `ENV_CONFIGS` inside `config/env.js` — no other files need to change.
- **`BASE_URL` override** applies to `appUrl` only; `apiUrl` is derived from it by appending the `www.` prefix. If your review-app domain does not follow the `app. → www.app.` pattern you may need to set both via a custom `.env` file.

---

## Interview Explanation

Before this change, three different files each had their own opinion about which URL to use. `globalSetup.js` had a hardcoded staging constant that was invisible to the rest of the config system, so running against production would still log in against staging. `createUser.js` was silently doing string manipulation to produce the `www.` variant it needed.

The fix introduces a single environment map in `config/env.js`. Each named environment (`local`, `staging`, `production`) declares both the browser-facing `appUrl` and the API-facing `apiUrl` in one place. Every file that needs a URL imports from `config/env.js` — nothing is hardcoded anywhere else. Switching environments is a single `TEST_ENV=` variable at the terminal. The framework fails fast with a clear message if you pass an unrecognised environment name.

This is a standard pattern called **environment-driven configuration**: separate what changes between runs (the environment name) from how it is used (page navigation, API calls), and centralise the mapping between them.
