# Ship Sticks Booking Flow Automation

Playwright-based end-to-end test suite for the Ship Sticks booking flow. The project uses a page object model and scenario-driven test data to validate the path from the homepage quote widget through the Step 1 booking form and into the login/order summary page.

## Scope

- Covers the homepage quote widget and the `/book/ship` booking flow
- Verifies item configuration, delivery date selection, shipping speed selection, and order summary details
- Includes an environment guardrail test that surfaces bot protection or anti-automation redirects as explicit failures

## Stack

- Node.js 20+
- Playwright Test
- JavaScript page objects
- GitHub Actions for CI

## Project Structure

```text
config/
  env.js
pages/
  BasePage.js
  HomePage.js
  BookingStep1Page.js
  BookingLoginPage.js
tests/
  booking.spec.js
  booking-blocking.spec.js
utils/
  testData.js
```

## Setup

```bash
npm install
npx playwright install chromium --with-deps
```

## Run Tests

```bash
npm test
```

Run headed:

```bash
npm run test:headed
```

Run specific scenarios:

```bash
SCENARIOS=challenge npx playwright test
SCENARIOS=challenge,golf_and_luggage_ground npx playwright test
```

Run across browsers:

```bash
npm run test:chromium
npm run test:firefox
npm run test:webkit
```

## Configuration

Copy `.env.example` to `.env` and adjust values as needed.

Available environment variables:

- `BASE_URL`
- `HEADED`
- `SLOW_MO`
- `TIMEOUT`
- `BROWSERS`
- `WORKERS`
- `FULLY_PARALLEL`
- `SCENARIOS`

## CI

GitHub Actions runs the suite on pushes and pull requests to `main`, and uploads Playwright artifacts for failed runs.
