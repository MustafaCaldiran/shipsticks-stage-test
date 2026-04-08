/**
 * utils/createUser.js
 *
 * Two implementations for creating a new user account:
 *
 *   createUserViaApi(baseURL)        — pure HTTP, no browser, ~1s
 *   createUserViaUi(page, baseURL)   — full sign-up UI flow, ~25s
 *
 * Both return the same shape so callers can swap between them freely.
 * Use the API version in test setup / beforeEach where you just need an
 * account to exist. Use the UI version when the sign-up flow itself is
 * what is being tested.
 *
 * Usage:
 *   const { createUserViaApi, createUserViaUi } = require('../utils/createUser');
 *
 *   // API (fast — no page needed)
 *   test('...', async ({ request, baseURL }) => {
 *     const user = await createUserViaApi(baseURL, request);
 *     // user.id, user.email, user.authToken available immediately
 *   });
 *
 *   // UI (use when testing the sign-up flow itself)
 *   test('...', async ({ page, baseURL }) => {
 *     const user = await createUserViaUi(page, baseURL);
 *     // user.homePage available to continue interacting with the page
 *   });
 */

const { request: playwrightRequest } = require('@playwright/test');
const HomePage = require('../pages/HomePage');
const testData = require('./testData');

// ─── API implementation ──────────────────────────────────────────────────────

/**
 * Create a new user account with a single POST request — no browser required.
 * Returns the created user data including the auth token from the response body.
 *
 * @param {string} baseURL - Root URL of the environment under test.
 * @param {import('@playwright/test').APIRequestContext} [requestContext]
 *   Optional: pass the `request` fixture from a test so the call shares the
 *   same context. If omitted a new context is created and disposed internally.
 *
 * @returns {Promise<{id: string, email: string, password: string,
 *   firstName: string, lastName: string, phoneNumber: string,
 *   authToken: string}>}
 */
async function createUserViaApi(baseURL, requestContext) {
  const signUpData = testData.authData.signUp;

  // Use baseURL directly — no host transformation.
  // The REST endpoint /api/v5/users lives on the same host as the app (app.*).
  // The www.app.* variant is only needed by globalSetup for the Rails session
  // login (/users/sign_in with CSRF). Applying it here sends the request to
  // the wrong host and causes the call to fail.
  const apiBase = baseURL;

  console.log(`createUserViaApi: POST ${apiBase}/api/v5/users`);

  const ownContext = !requestContext;
  const ctx = requestContext ?? await playwrightRequest.newContext({
    baseURL: apiBase,
    ignoreHTTPSErrors: true,
  });

  const response = await ctx.post(`${apiBase}/api/v5/users`, {
    data: {
      user: {
        email:                signUpData.email,
        password:             signUpData.password,
        password_confirmation: signUpData.password,
        first_name:           signUpData.firstName,
        last_name:            signUpData.lastName,
        phone_number:         `+1 ${signUpData.phoneNumber}`,
        country_code:         'us',
        hear_about_us:        signUpData.howDidYouHear,
        other_hear_about_us:  '',
        terms:                true,
        mobile_verified:      false,
        brand_id:             'shipsticks',
        sms_tracking_optin:   false,
      },
      frontend_app_booking_flow: true,
    },
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    if (ownContext) await ctx.dispose();
    throw new Error(`createUserViaApi failed — ${response.status()}: ${body}`);
  }

  const body = await response.json();
  if (ownContext) await ctx.dispose();

  return {
    id:          body.id,
    email:       body.email,
    password:    signUpData.password,
    firstName:   body.first_name,
    lastName:    body.last_name,
    phoneNumber: body.phone_number,
    authToken:   body.auth_token,
  };
}

// ─── UI implementation ───────────────────────────────────────────────────────

/**
 * Create a new user account by driving the full sign-up UI flow.
 * Use this when the sign-up flow itself is what is being tested.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} baseURL - Root URL of the environment under test.
 *
 * @returns {Promise<{email: string, password: string, firstName: string,
 *   lastName: string, phoneNumber: string,
 *   homePage: import('../pages/HomePage')}>}
 *   Sign-up data plus the HomePage instance so callers can continue
 *   interacting with the page (e.g. startQuote) without constructing
 *   a second HomePage object.
 */
async function createUserViaUi(page, baseURL) {
  const home = new HomePage(page, baseURL);
  const signUpData = testData.authData.signUp;

  await home.goto();
  await home.clickSignIn();
  await home.assertSignInModalVisible();

  await home.switchToSignUp();
  await home.assertSignUpModalVisible();

  await home.fillSignUpForm(signUpData);
  await home.clickContinueToCreatePassword();
  await home.fillPasswordFields(signUpData.password);

  // Click "Skip for now" on the phone verification step
  await home.skipVerifyYourNumber();
  await home.assertLoggedIn(signUpData.firstName);

  return { ...signUpData, homePage: home };
}

module.exports = { createUserViaApi, createUserViaUi };
