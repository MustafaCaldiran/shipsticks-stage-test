// tests/api-intercept.spec.js
// Run all: npx playwright test tests/api-intercept.spec.js --project=chromium

const { test, expect } = require('@playwright/test');
const HomePage = require('../pages/HomePage');
const BookingStep1Page = require('../pages/BookingStep1Page');
const testData = require('../utils/testData');

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

  return { booking, scenario };
}

test('booking form sends correct origin, destination, and item count to GetDeliverByTransitRates', async ({ page, baseURL }) => {
  let capturedPayload = null;

  await page.route('**/graphql', async route => {
    const postData = route.request().postData();
    if (postData) {
      const body = JSON.parse(postData);
      if (body.operationName === 'GetDeliverByTransitRates') {
        capturedPayload = body.variables.input;
      }
    }
    await route.continue();
  });

  const { booking, scenario } = await goToBookingStep1(page, baseURL);
  await booking.configureItems(booking.getChallengeItems(scenario));
  await booking.selectDeliveryDate(scenario.deliveryDate);

  await expect.poll(() => capturedPayload, {
    message: 'GetDeliverByTransitRates was never called',
    timeout: 15000,
  }).not.toBeNull();

  expect(capturedPayload.shipRoute.origin.city).toBe('Los Angeles');
  expect(capturedPayload.shipRoute.origin.state).toBe('CA');
  expect(capturedPayload.shipRoute.destination.city).toBe('Miami Lakes');
  expect(capturedPayload.shipRoute.destination.state).toBe('FL');
  expect(capturedPayload.products).toHaveLength(1);
  expect(capturedPayload.products[0].quantity).toBe(1);
  expect(capturedPayload.direction).toBe('outbound');
});

test('booking page does not crash or go blank when network goes offline', async ({ page, context, baseURL }) => {
  await page.goto(`${baseURL}/book/ship`);
  await page.waitForLoadState('domcontentloaded');

  try {
    const btn = page.getByRole('button', { name: /accept all cookies/i });
    await btn.waitFor({ state: 'visible', timeout: 4000 });
    await btn.click();
  } catch { /* no cookie banner */ }

  await context.setOffline(true);

  await expect(page.getByRole('heading', { name: 'Shipping Options' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Where from?' })).toBeVisible();

  await context.setOffline(false);
});

test('shows fallback UI when no shipping rates are returned', async ({ page, baseURL }) => {
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
  await booking.configureItems(booking.getChallengeItems(scenario));
  await booking.selectDeliveryDate(scenario.deliveryDate);

  await expect(page.getByText('No shipping options available')).toBeVisible({ timeout: 15000 });
});

test('shows error message when shipping rates API returns 500', async ({ page, baseURL }) => {
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
  await booking.configureItems(booking.getChallengeItems(scenario));
  await booking.selectDeliveryDate(scenario.deliveryDate);

  await expect(page.getByText('No shipping options available')).toBeVisible({ timeout: 15000 });
});
