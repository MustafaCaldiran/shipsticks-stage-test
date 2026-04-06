// tests/api-intercept.spec.js
// Interception tests using page.route() — these mock or spy on API calls
// without needing a real backend response.
//
// Run all:  npx playwright test tests/api-intercept.spec.js --project=chromium
// Run one:  npx playwright test tests/api-intercept.spec.js --project=chromium -g "payload"

const { test, expect } = require('@playwright/test');
const HomePage = require('../pages/HomePage');
const BookingStep1Page = require('../pages/BookingStep1Page');
const testData = require('../utils/testData');

// ─── helpers ────────────────────────────────────────────────────────────────

// Reusable: set up the homepage and navigate to booking step 1 with
// the standard challenge scenario (LA → Miami, 1 Golf Bag Standard).
async function goToBookingStep1(page, baseURL) {
  const home = new HomePage(page, baseURL);
  const booking = new BookingStep1Page(page, baseURL);
  const scenario = testData.scenarios.challenge;

  await home.goto();
  await home.startQuote({
    shipmentType: scenario.shipmentType,
    origin: scenario.origin,
    destination: scenario.destination,
  });
  await booking.assertLoaded();
  await booking.dismissWeatherWarningIfPresent();

  return { home, booking, scenario };
}

// ─── Test 1: Payload spy ─────────────────────────────────────────────────────
// What it tests: that the booking form sends the correct origin, destination,
// and item quantity in the GetDeliverByTransitRates request.
// How it works: intercepts the request but DOES NOT mock it — just saves the
// payload and lets the real request go through.
// Why it matters for interviews: shows you can verify WHAT the frontend sends
// to the API, not just what the UI displays.

test('booking form sends correct origin, destination, and item count to GetDeliverByTransitRates', async ({ page, baseURL }) => {
  let capturedPayload = null;

  // Set up the spy BEFORE navigating — page.route is registered on the context
  // so it catches all matching requests from the moment it is registered.
  await page.route('**/graphql', async route => {
    const postData = route.request().postData();
    if (postData) {
      const body = JSON.parse(postData);
      if (body.operationName === 'GetDeliverByTransitRates') {
        capturedPayload = body.variables.input; // save what the app sent
      }
    }
    await route.continue(); // always let the real request through
  });

  const { booking, scenario } = await goToBookingStep1(page, baseURL);

  // Add item — this is when the app starts calling the rates API
  const items = booking.getChallengeItems(scenario);
  await booking.configureItems(items);

  // Selecting a delivery date triggers GetDeliverByTransitRates
  await booking.selectDeliveryDate(scenario.deliveryDate);

  // Wait until the spy captured the payload
  await expect.poll(() => capturedPayload, {
    message: 'GetDeliverByTransitRates was never called',
    timeout: 15000,
  }).not.toBeNull();

  // Assert the payload matches what we entered in the form
  expect(capturedPayload.shipRoute.origin.city).toBe('Los Angeles');
  expect(capturedPayload.shipRoute.origin.state).toBe('CA');
  expect(capturedPayload.shipRoute.destination.city).toBe('Miami Lakes');
  expect(capturedPayload.shipRoute.destination.state).toBe('FL');
  expect(capturedPayload.products).toHaveLength(1);
  expect(capturedPayload.products[0].quantity).toBe(1);
  expect(capturedPayload.direction).toBe('outbound');
});

// ─── Test 2: Offline simulation ──────────────────────────────────────────────
// What it tests: that the app handles going offline gracefully — it should
// not crash, freeze, or show a blank white screen.
// How it works: navigates to the booking page, cuts the network, then tries
// to interact. Asserts the page is still usable (has content).
// Why it matters: offline/flaky-network resilience is a real production concern.

test('booking page does not crash or go blank when network goes offline', async ({ page, context, baseURL }) => {
  await page.goto(`${baseURL}/book/ship`);
  await page.waitForLoadState('domcontentloaded');

  // Accept cookies if present before going offline
  try {
    const btn = page.getByRole('button', { name: /accept all cookies/i });
    await btn.waitFor({ state: 'visible', timeout: 4000 });
    await btn.click();
  } catch { /* no cookie banner */ }

  // Go offline
  await context.setOffline(true);

  // The page is already loaded — assert it still has its main content
  // (it should not go blank or show a browser error page)
  await expect(page.getByRole('heading', { name: 'Shipping Options' })).toBeVisible();

  // Try clicking the origin field — should be visible and not throw
  const originField = page.getByRole('combobox', { name: 'Where from?' });
  await expect(originField).toBeVisible();

  // Restore connection
  await context.setOffline(false);
});

// ─── Test 3: Empty rates — placeholder ───────────────────────────────────────
// Status: NEEDS SELECTOR
// What we need to discover: what text or element appears in the UI when
// GetDeliverByTransitRates returns { data: { transitRates: [] } }.
// To find it: run this test with headed:true — it will pause at page.pause()
// so you can inspect the screen and tell me the selector.
// Then replace page.pause() with the real expect().

test.skip('shows fallback UI when no shipping rates are returned', async ({ page, baseURL }) => {
  await page.route('**/graphql', async route => {
    const postData = route.request().postData();
    if (postData) {
      const body = JSON.parse(postData);
      if (body.operationName === 'GetDeliverByTransitRates') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { transitRates: [] } }),
        });
        return;
      }
    }
    await route.continue();
  });

  const { booking, scenario } = await goToBookingStep1(page, baseURL);
  const items = booking.getChallengeItems(scenario);
  await booking.configureItems(items);
  await booking.selectDeliveryDate(scenario.deliveryDate);

  // ── PAUSE HERE to inspect the UI ─────────────────────────────────────────
  // Run with: npx playwright test api-intercept --project=chromium -g "empty" --headed
  // Look at what the screen shows when there are no rates, then replace
  // this pause with the real assertion.
  await page.pause();

  // TODO: replace page.pause() above with something like:
  // await expect(page.getByText(/no shipping options/i)).toBeVisible();
  // await expect(page.getByRole('alert')).toBeVisible();
});

// ─── Test 4: 500 error — placeholder ─────────────────────────────────────────
// Status: NEEDS SELECTOR
// Same as above — run with page.pause() to discover the error message selector.

test.skip('shows error message when shipping rates API returns 500', async ({ page, baseURL }) => {
  await page.route('**/graphql', async route => {
    const postData = route.request().postData();
    if (postData) {
      const body = JSON.parse(postData);
      if (body.operationName === 'GetDeliverByTransitRates') {
        await route.fulfill({
          status: 500,
          body: 'Internal Server Error',
        });
        return;
      }
    }
    await route.continue();
  });

  const { booking, scenario } = await goToBookingStep1(page, baseURL);
  const items = booking.getChallengeItems(scenario);
  await booking.configureItems(items);
  await booking.selectDeliveryDate(scenario.deliveryDate);

  // ── PAUSE HERE to inspect the UI ─────────────────────────────────────────
  // Run with: npx playwright test api-intercept --project=chromium -g "500" --headed
  await page.pause();

  // TODO: replace page.pause() above with something like:
  // await expect(page.getByText(/something went wrong/i)).toBeVisible();
  // await expect(page.getByRole('alert')).toBeVisible();
});

// ─── Test 5: Loading spinner — placeholder ────────────────────────────────────
// Status: NEEDS SELECTOR
// This one is different: the assertion must fire DURING the 3-second delay,
// not after. The approach: start page.route with a delay, navigate,
// trigger the rates call, and assert the spinner is visible BEFORE the
// delay resolves.

test.skip('shows loading indicator while shipping rates are loading', async ({ page, baseURL }) => {
  let resolveDelay;

  await page.route('**/graphql', async route => {
    const postData = route.request().postData();
    if (postData) {
      const body = JSON.parse(postData);
      if (body.operationName === 'GetDeliverByTransitRates') {
        // Hold the response for 5 seconds so we have time to assert the spinner
        await new Promise(resolve => {
          resolveDelay = resolve;
          setTimeout(resolve, 5000);
        });
        await route.continue();
        return;
      }
    }
    await route.continue();
  });

  const { booking, scenario } = await goToBookingStep1(page, baseURL);
  const items = booking.getChallengeItems(scenario);
  await booking.configureItems(items);

  // Start selecting the date — this triggers the delayed rates request
  // We intentionally do NOT await selectDeliveryDate fully here
  booking.selectDeliveryDate(scenario.deliveryDate).catch(() => {});

  // ── PAUSE HERE to inspect the UI ─────────────────────────────────────────
  // Run with: npx playwright test api-intercept --project=chromium -g "loading" --headed
  await page.pause();

  // TODO: replace page.pause() with something like:
  // await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
  // await expect(page.locator('.animate-spin')).toBeVisible();
  // await expect(page.getByRole('progressbar')).toBeVisible();
});
