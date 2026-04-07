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

// Two real transit rate objects captured from the staging API on 2026-04-06.
// Used as the base for mock responses so the UI receives a realistic payload shape.
const MOCK_RATE_GROUND = {
  carrierServiceLevel: {
    serviceLevel: { bestValue: false, displayName: 'Ground', systemName: 'DOMESTIC_GROUND', id: '5b314854c7170f610b00000f' },
    carrier: { systemName: 'FEDEX_GROUND' },
  },
  itemRates: [{
    priceCents: 7499, adjustedPriceCents: 0,
    product: { id: '5c5e2d376928b97125000007', productLine: { id: '5c5e2d376928b97125000001', displayName: 'Golf Bags' } },
    quantity: 1,
    serviceRate: { id: '635a895b7ef97126189eb359', carrierServiceLevel: { id: '5b314854c7170f610b000045' } },
    totalPriceCents: 7499, totalAdjustedPriceCents: 0, isPreferred: false,
  }],
  shipDate: '2026-04-07', transitTime: 6, isOffline: false,
};

const MOCK_RATE_NEXT_DAY_EXPRESS = {
  carrierServiceLevel: {
    serviceLevel: { bestValue: true, displayName: 'Next Day Express', systemName: 'DOMESTIC_1_DAY', id: '5b314854c7170f610b000006' },
    carrier: { systemName: 'FEDEX_EXPRESS' },
  },
  itemRates: [{
    priceCents: 16499, adjustedPriceCents: 0,
    product: { id: '5c5e2d376928b97125000007', productLine: { id: '5c5e2d376928b97125000001', displayName: 'Golf Bags' } },
    quantity: 1,
    serviceRate: { id: '61e169335bce0d016756b8b4', carrierServiceLevel: { id: '5b314854c7170f610b00003e' } },
    totalPriceCents: 16499, totalAdjustedPriceCents: 0, isPreferred: false,
  }],
  shipDate: '2026-04-14', transitTime: 1, isOffline: false,
};

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

test('shows Ground and Next Day Express options when two rates are mocked', async ({ page, baseURL }) => {
  await page.route('**/graphql', async route => {
    const postData = route.request().postData();
    if (postData) {
      const body = JSON.parse(postData);
      if (body.operationName === 'GetDeliverByTransitRates') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { transitRates: [MOCK_RATE_GROUND, MOCK_RATE_NEXT_DAY_EXPRESS] } }),
        });
        return;
      }
    }
    await route.continue();
  });

  const { booking, scenario } = await goToBookingStep1(page, baseURL);
  await booking.configureItems(booking.getChallengeItems(scenario));
  await booking.selectDeliveryDate(scenario.deliveryDate);

  await expect(booking.shipmentSpeedsHeading).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('radio', { name: /Ground/i }).first()).toBeVisible();
  await expect(page.getByRole('radio', { name: /Next Day Express/i }).first()).toBeVisible();
});

test('renders shipping options without crashing when all priceCents are zero', async ({ page, baseURL }) => {
  const freeGround = { ...MOCK_RATE_GROUND, itemRates: [{ ...MOCK_RATE_GROUND.itemRates[0], priceCents: 0, totalPriceCents: 0 }] };
  const freeExpress = { ...MOCK_RATE_NEXT_DAY_EXPRESS, itemRates: [{ ...MOCK_RATE_NEXT_DAY_EXPRESS.itemRates[0], priceCents: 0, totalPriceCents: 0 }] };

  await page.route('**/graphql', async route => {
    const postData = route.request().postData();
    if (postData) {
      const body = JSON.parse(postData);
      if (body.operationName === 'GetDeliverByTransitRates') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { transitRates: [freeGround, freeExpress] } }),
        });
        return;
      }
    }
    await route.continue();
  });

  const { booking, scenario } = await goToBookingStep1(page, baseURL);
  await booking.configureItems(booking.getChallengeItems(scenario));
  await booking.selectDeliveryDate(scenario.deliveryDate);

  await expect(booking.shipmentSpeedsHeading).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('radio', { name: /Ground/i }).first()).toBeVisible();
});

test('shows email already taken error when registration API returns 409', async ({ page, baseURL }) => {
  const postUrls = [];
  page.on('request', req => {
    if (req.method() === 'POST') {
      const url = req.url();
      let label = url;
      if (url.includes('/graphql')) {
        try { const b = JSON.parse(req.postData() || '{}'); label = `GQL:${b.operationName}`; } catch {}
      }
      if (url.includes('/api/')) {
        label = `API:${url.replace(/^https?:\/\/[^/]+/, '')}`;
      }
      postUrls.push(label);
    }
  });

  let intercepted = false;
  await page.route(/\/api\/v5\/users/, async route => {
    if (route.request().method() === 'POST') {
      intercepted = true;
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ errors: ['Email already taken'] }),
      });
      return;
    }
    await route.continue();
  });

  const home = new HomePage(page, baseURL);
  await home.goto();
  await home.clickSignIn();
  await home.switchToSignUp();
  await home.assertSignUpModalVisible();

  const signUp = testData.authData.signUp;
  await home.fillSignUpForm({
    firstName: signUp.firstName,
    lastName: signUp.lastName,
    email: signUp.email,
    country: signUp.country,
    howDidYouHear: signUp.howDidYouHear,
    phoneNumber: signUp.phoneNumber,
  });
  await home.clickContinueToCreatePassword();
  await page.screenshot({ path: '/tmp/debug-409-step1.png' });
  await home.fillPasswordFields(signUp.password);
  await page.screenshot({ path: '/tmp/debug-409-step2.png' });

  // Wait for sign-up flow to complete (API call happens async after button click)
  await page.waitForTimeout(5000);

  // Debug: log all POST URLs captured during the flow
  console.log('POST URLs seen:', postUrls.filter(u => u.startsWith('GQL:') || u.startsWith('API:')));
  expect(intercepted).toBe(true);
  await expect(page.getByText(/email already taken/i)).toBeVisible({ timeout: 15000 });
});
