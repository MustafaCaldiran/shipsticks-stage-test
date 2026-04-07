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

// ─────────────────────────────────────────────────────────────────────────────
// PHONE VERIFICATION INTERCEPT TESTS
//
// Problem: When a new user registers, ShipSticks calls the GraphQL mutation
// `createMobileVerification` to send an SMS code to the user's phone.
// On the staging environment this always fails ("Failed to send verification
// code"), and even on production we can't receive real SMS codes inside an
// automated test.
//
// Solution: Use page.route() to intercept the /graphql endpoint.
// When the outgoing request body contains operationName === "createMobileVerification"
// we immediately return a fake "success" response instead of letting the real
// request reach the server. The browser thinks the SMS was sent successfully,
// shows the verification code input, and the test can continue.
//
// The same technique is applied to whichever mutation the frontend calls when
// the user submits the code (e.g. confirmMobileVerification / verifyMobileCode).
// We intercept that too and return a success so the account is treated as
// "verified" by the UI without any real code ever being sent or entered.
// ─────────────────────────────────────────────────────────────────────────────

test('intercepts createMobileVerification — SMS is never sent, UI reaches the code-entry step', async ({ page, baseURL }) => {
  // WHAT THIS DOES:
  // 1. Registers a fresh user through the UI
  // 2. Intercepts the createMobileVerification mutation so no real SMS is sent
  //    and the UI sees { success: true } instead of the staging failure
  // 3. Confirms the "Verify your phone number" modal appears (the UI reacted to
  //    the fake success) with the verification code input visible
  // 4. Clicks "Skip for now" to finish — we are not entering a code in this test

  let smsIntercepted = false;

  await page.route('**/graphql', async route => {
    const body = JSON.parse(route.request().postData() || '{}');

    if (body.operationName === 'createMobileVerification') {
      // ── INTERCEPT: return fake success, block the real SMS send ──────────
      smsIntercepted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            createMobileVerification: {
              success: true,
              errors: [],
            },
          },
        }),
      });
      return;
    }

    // All other GraphQL calls (GetCurrentUser, GetProductLines, etc.) pass through normally
    await route.continue();
  });

  const home = new HomePage(page, baseURL);
  const signUp = testData.authData.signUp;

  await home.goto();
  await home.clickSignIn();
  await home.assertSignInModalVisible();
  await home.switchToSignUp();
  await home.assertSignUpModalVisible();

  await home.fillSignUpForm(signUp);
  await home.clickContinueToCreatePassword();
  await home.fillPasswordFields(signUp.password);

  // "Finish sign up and verify number" click triggers:
  //   1. POST /api/v5/users  → creates the account (not intercepted, real call)
  //   2. createMobileVerification mutation → we intercept this and return success
  // Both happen in the background; the "Verify your phone number" heading then appears

  // Confirm the verification modal appeared (means the UI accepted our fake success)
  await expect(home.verifyYourNumberHeading).toBeVisible({ timeout: 15000 });

  // The verification code input should now be visible on screen
  await expect(page.locator('#verification_number')).toBeVisible({ timeout: 5000 });

  // Verify we actually intercepted the mutation (not just skipping past it)
  expect(smsIntercepted).toBe(true);

  // Skip for now — code submission is tested separately below
  await home.skipForNowButtonInVerificationStep.click();
  await home.assertLoggedIn(signUp.firstName);
});

test('intercepts both createMobileVerification AND the code-confirmation mutation — full phone verify without a real SMS', async ({ page, baseURL }) => {
  // WHAT THIS DOES:
  // 1. Registers a fresh user through the UI
  // 2. Intercepts createMobileVerification → fake SMS sent (success: true)
  // 3. Types "123456" as the verification code (any value works — the real
  //    mutation is also intercepted so the server never validates it)
  // 4. Intercepts whichever mutation fires when the code is submitted
  //    — it could be confirmMobileVerification, verifyMobileCode, updateUser, etc.
  //    We intercept ALL mutations that contain "mobile" or "verif" in their
  //    operationName (case-insensitive) and return success for each.
  // 5. Asserts the user ends up logged in with a verified phone

  const intercepted = { sms: false, codeConfirm: false };

  await page.route('**/graphql', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    const op = (body.operationName || '').toLowerCase();

    if (op === 'createmobileverification') {
      // ── Intercept 1: fake the SMS send ────────────────────────────────────
      intercepted.sms = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            createMobileVerification: { success: true, errors: [] },
          },
        }),
      });
      return;
    }

    if (op.includes('mobile') || op.includes('verif')) {
      // ── Intercept 2: fake the code confirmation ───────────────────────────
      // Covers: confirmMobileVerification, verifyMobileCode, verifyPhone, etc.
      // We don't know the exact name because the capture session used "Skip for now",
      // so we match broadly on any mutation that sounds like phone verification.
      intercepted.codeConfirm = true;
      // Build a generic success response that works for any of these mutation shapes
      const mutationKey = body.operationName || 'confirmMobileVerification';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            [mutationKey]: { success: true, errors: [], user: { mobileVerified: true } },
          },
        }),
      });
      return;
    }

    await route.continue();
  });

  const home = new HomePage(page, baseURL);
  const signUp = testData.authData.signUp;

  await home.goto();
  await home.clickSignIn();
  await home.assertSignInModalVisible();
  await home.switchToSignUp();
  await home.assertSignUpModalVisible();

  await home.fillSignUpForm(signUp);
  await home.clickContinueToCreatePassword();
  await home.fillPasswordFields(signUp.password);

  // Wait for the verify phone modal
  await expect(home.verifyYourNumberHeading).toBeVisible({ timeout: 15000 });
  expect(intercepted.sms).toBe(true);

  // Enter any 6-digit code — the real mutation is intercepted so value doesn't matter
  const codeInput = page.locator('#verification_number');
  await expect(codeInput).toBeVisible({ timeout: 5000 });
  await codeInput.fill('123456');

  // Click the Confirm button using the HomePage locator
  await expect(home.verifyYourNumberConfirmButton).toBeVisible({ timeout: 5000 });
  await home.verifyYourNumberConfirmButton.click();

  // The UI should now consider the phone verified and proceed to log the user in
  await home.assertLoggedIn(signUp.firstName);

  // Both intercepts must have fired
  expect(intercepted.sms).toBe(true);
  expect(intercepted.codeConfirm).toBe(true);

  // ── DIAGNOSE: Online Bill Pay new-tab auth issue ───────────────────────────
  // Clicking Account options menu → Online Bill Pay opens a NEW TAB at
  // https://www.app.staging.shipsticks.com/invoices/pay
  // but the user appears logged out there. We listen to all network calls on
  // that new tab to see what cookies/auth headers are sent (or missing).

  // 1. Open the account menu
  await expect(home.userAccount).toBeVisible({ timeout: 10000 });
  await home.userAccount.click();
  await expect(home.onlineBillPay).toBeVisible({ timeout: 5000 });

  // 2. Capture the new tab that opens when Online Bill Pay is clicked
  const [billPayTab] = await Promise.all([
    page.context().waitForEvent('page'),
    home.onlineBillPay.click(),
  ]);

  await billPayTab.waitForLoadState('domcontentloaded');

  // 3. Log every request the new tab makes so we can see auth headers / cookies
  console.log('\n══ Online Bill Pay tab — all requests ══');
  billPayTab.on('request', req => {
    const headers = req.headers();
    const cookieHeader = headers['cookie'] || '(none)';
    const authHeader   = headers['authorization'] || '(none)';
    console.log(`[REQ] ${req.method()} ${req.url()}`);
    console.log(`      cookie:        ${cookieHeader.substring(0, 200)}`);
    console.log(`      authorization: ${authHeader}`);
  });

  // 4. Log every response so we can see 401s, redirects, and Set-Cookie headers
  billPayTab.on('response', async res => {
    const status = res.status();
    const setCookie = res.headers()['set-cookie'] || '(none)';
    const location  = res.headers()['location']   || '';
    const label = status >= 300 ? '⚠ ' : '  ';
    console.log(`${label}[RES] ${status} ${res.url()}${location ? ' → ' + location : ''}`);
    if (setCookie !== '(none)') {
      console.log(`      set-cookie: ${setCookie.substring(0, 200)}`);
    }
    // Log GraphQL response bodies so we can see if GetCurrentUser returns null user
    if (res.url().includes('/graphql')) {
      try {
        const body = await res.json();
        if (body?.data?.currentUser !== undefined) {
          console.log(`      currentUser: ${JSON.stringify(body.data.currentUser)}`);
        }
      } catch { /* binary or non-JSON */ }
    }
  });

  // 5. Wait for the page to fully settle so all auth calls complete
  await billPayTab.waitForLoadState('networkidle');

  // 6. Take a screenshot so we can see the logged-in / logged-out state visually
  await billPayTab.screenshot({ path: 'tmp/bill-pay-tab.png', fullPage: true });
  console.log('\nScreenshot saved → tmp/bill-pay-tab.png');

  // 7. Also dump all cookies that exist in the context at the point the new tab opened
  const allCookies = await page.context().cookies();
  const stagingCookies = allCookies.filter(c => c.domain.includes('shipsticks'));
  console.log('\n── Staging cookies in browser context ──');
  stagingCookies.forEach(c =>
    console.log(`  ${c.name}=${c.value.substring(0, 60)}  domain=${c.domain}  path=${c.path}  sameSite=${c.sameSite}  secure=${c.secure}`)
  );

  // 8. (pause removed for headless run — re-add for manual inspection)
  // await billPayTab.pause();
});
