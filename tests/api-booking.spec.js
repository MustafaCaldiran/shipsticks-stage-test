// tests/api-booking.spec.js
const { test, expect, request } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.app.staging.shipsticks.com';
const STORAGE_STATE = path.resolve(__dirname, '../.auth/storageState.json');

// Helper: build an API request context pre-loaded with the saved session cookies
async function authedContext() {
  const { cookies } = JSON.parse(fs.readFileSync(STORAGE_STATE, 'utf8'));
  const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
  // Inject saved session cookies
  await ctx.storageState(); // ensure context is initialised
  // Playwright request context doesn't support storageState injection directly,
  // so we set the cookie header manually from the saved state
  return { ctx, cookieHeader: cookies.map(c => `${c.name}=${c.value}`).join('; ') };
}

test.describe('API — User Registration', () => {

  test('POST /users — creates a new user and returns session', async () => {
    // ⚠️  Fill URL after running network-capture and checking tmp/network-capture.json
    const { ctx, cookieHeader } = await authedContext();

    // Step 1: get CSRF token
    const loginPage = await ctx.get('/users/sign_in');
    const html = await loginPage.text();
    const csrf = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/)?.[1];
    expect(csrf, 'CSRF token must be present').toBeTruthy();

    // Step 2: register — replace URL with what you find in the capture
    const res = await ctx.post('/users', {  // TODO: confirm path from capture
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        Accept: 'application/json',
      },
      data: {
        user: {
          email: `api-test-${Date.now()}@example.com`,
          password: 'SecurePass123!',
          first_name: 'Api',
          last_name: 'Test',
        },
      },
    });

    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('id'); // or whatever the API returns
    await ctx.dispose();
  });

  test('POST /users/sign_in — invalid credentials return 4xx', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const loginPage = await ctx.get('/users/sign_in');
    const html = await loginPage.text();
    const csrf = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/)?.[1];

    const res = await ctx.post('/users/sign_in', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        authenticity_token: csrf,
        'user[email]': 'nobody@nowhere.xyz',
        'user[password]': 'wrongpassword',
      }).toString(),
    });

    // Rails Devise returns 401 or redirects back to sign_in page
    const isUnauth = res.status() === 401 || res.status() === 422 || res.url().includes('sign_in');
    expect(isUnauth).toBe(true);
    await ctx.dispose();
  });
});

test.describe('API — Shipment (Booking)', () => {

  test('POST shipments — creates a new booking', async () => {
    // ⚠️  Replace endpoint + payload with what you find in tmp/network-capture.json
    const { ctx, cookieHeader } = await authedContext();

    const res = await ctx.post('/api/v1/shipments', { // TODO: confirm from capture
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        Accept: 'application/json',
      },
      data: {
        // TODO: fill payload from capture — origin, destination, items, service_level, delivery_date
      },
    });

    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body.status).not.toBe('cancelled');

    // save shipment id for cancel test
    process.env._CAPTURED_SHIPMENT_ID = String(body.id);
    await ctx.dispose();
  });

  test('DELETE/PUT shipments/:id — cancels a booking', async () => {
    // ⚠️  Replace endpoint with what you find in tmp/network-capture.json
    const shipmentId = process.env._CAPTURED_SHIPMENT_ID;
    if (!shipmentId) test.skip(); // depends on booking test above

    const { ctx, cookieHeader } = await authedContext();

    // Some Rails apps use DELETE /shipments/:id, others use PUT with status:'cancelled'
    const res = await ctx.delete(`/api/v1/shipments/${shipmentId}`, { // TODO: confirm
      headers: { Cookie: cookieHeader, Accept: 'application/json' },
    });

    expect([200, 204]).toContain(res.status());
    await ctx.dispose();
  });

  test('GET shipments — authenticated user can list their bookings', async () => {
    const { ctx, cookieHeader } = await authedContext();

    const res = await ctx.get('/api/v1/shipments', { // TODO: confirm
      headers: { Cookie: cookieHeader, Accept: 'application/json' },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body) || body.shipments).toBeTruthy();
    await ctx.dispose();
  });

  test('GET shipments — unauthenticated returns 401', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
    const res = await ctx.get('/api/v1/shipments', { // TODO: confirm
      headers: { Accept: 'application/json' },
    });
    expect([401, 403, 302]).toContain(res.status());
    await ctx.dispose();
  });
});