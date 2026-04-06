// tests/api-user.spec.js
// API tests for user creation via POST /api/v5/users
// Endpoint and payload confirmed from tmp/network-capture.json
// Run: npx playwright test tests/api-user.spec.js --project=chromium

const { test, expect, request } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = 'https://www.app.staging.shipsticks.com';
const STORAGE_STATE = path.resolve(__dirname, '../.auth/storageState.json');

function uniqueEmail() {
  return `api-test-${crypto.randomBytes(4).toString('hex')}@example.com`;
}

function getCookieHeader() {
  const { cookies } = JSON.parse(fs.readFileSync(STORAGE_STATE, 'utf8'));
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

test.describe('API — User Registration (/api/v5/users)', () => {

  test('POST /api/v5/users — creates a new user and returns 201', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
    const email = uniqueEmail();

    const res = await ctx.post('/api/v5/users', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: {
        user: {
          email,
          first_name: 'ApiTest',
          last_name: 'User',
          phone_number: '+1 151-351-3515',
          country_code: 'us',
          sms_tracking_optin: false,
          hear_about_us: 'Influencer',
          other_hear_about_us: '',
          terms: true,
          mobile_verified: false,
          brand_id: 'shipsticks',
          password: 'SecurePass123!',
          password_confirmation: 'SecurePass123!',
        },
        frontend_app_booking_flow: true,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    // API returns the new user object — verify key fields
    expect(body.email).toBe(email);
    expect(body.id || body.user?.id || body._id).toBeTruthy();

    await ctx.dispose();
  });

  test('POST /api/v5/users — duplicate email returns 4xx', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    // john@gmail.com is the existing test account used in globalSetup
    const res = await ctx.post('/api/v5/users', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: {
        user: {
          email: 'john@gmail.com',
          first_name: 'John',
          last_name: 'Duplicate',
          phone_number: '+1 151-351-3515',
          country_code: 'us',
          sms_tracking_optin: false,
          hear_about_us: 'Influencer',
          other_hear_about_us: '',
          terms: true,
          mobile_verified: false,
          brand_id: 'shipsticks',
          password: 'SecurePass123!',
          password_confirmation: 'SecurePass123!',
        },
        frontend_app_booking_flow: true,
      },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);

    await ctx.dispose();
  });

  test('POST /api/v5/users — missing required fields returns 4xx', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const res = await ctx.post('/api/v5/users', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: {
        user: {
          email: uniqueEmail(),
          // intentionally omitting password, first_name, last_name
          brand_id: 'shipsticks',
          terms: true,
        },
        frontend_app_booking_flow: true,
      },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);

    await ctx.dispose();
  });

  test('POST /api/v5/users — mismatched passwords returns 4xx', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const res = await ctx.post('/api/v5/users', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: {
        user: {
          email: uniqueEmail(),
          first_name: 'ApiTest',
          last_name: 'User',
          phone_number: '+1 151-351-3515',
          country_code: 'us',
          sms_tracking_optin: false,
          hear_about_us: 'Influencer',
          other_hear_about_us: '',
          terms: true,
          mobile_verified: false,
          brand_id: 'shipsticks',
          password: 'SecurePass123!',
          password_confirmation: 'DifferentPass456!', // mismatch
        },
        frontend_app_booking_flow: true,
      },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);

    await ctx.dispose();
  });

  test('New user can authenticate after registration — GetCurrentUser returns their data', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
    const email = uniqueEmail();
    const password = 'SecurePass123!';

    // Step 1: register a fresh user
    const regRes = await ctx.post('/api/v5/users', {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      data: {
        user: {
          email,
          first_name: 'ApiTest',
          last_name: 'Verify',
          phone_number: '+1 151-351-3515',
          country_code: 'us',
          sms_tracking_optin: false,
          hear_about_us: 'Influencer',
          other_hear_about_us: '',
          terms: true,
          mobile_verified: false,
          brand_id: 'shipsticks',
          password,
          password_confirmation: password,
        },
        frontend_app_booking_flow: true,
      },
    });
    expect(regRes.status()).toBe(201);

    // Step 2: log in as the new user using the Rails Devise form login
    const loginPage = await ctx.get('/users/sign_in');
    const html = await loginPage.text();
    const csrf = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/)?.[1];
    expect(csrf).toBeTruthy();

    const loginRes = await ctx.post('/users/sign_in', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: `${BASE_URL}/users/sign_in`,
      },
      data: new URLSearchParams({
        utf8: '✓',
        authenticity_token: csrf,
        'user[email]': email,
        'user[password]': password,
        'user[remember_me]': '0',
      }).toString(),
    });
    expect(loginRes.ok()).toBe(true);

    // Step 3: get new session cookies and verify GetCurrentUser
    const storageState = await ctx.storageState();
    const cookieHeader = storageState.cookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');

    const gqlRes = await ctx.post(`${BASE_URL}/graphql`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: cookieHeader,
      },
      data: {
        operationName: 'GetCurrentUser',
        query: `
          query GetCurrentUser {
            user {
              email
              firstName
              lastName
              id
            }
          }
        `,
      },
    });

    expect(gqlRes.status()).toBe(200);
    const gqlBody = await gqlRes.json();
    expect(gqlBody.data.user.email).toBe(email);
    expect(gqlBody.data.user.firstName).toBe('ApiTest');

    await ctx.dispose();
  });

});