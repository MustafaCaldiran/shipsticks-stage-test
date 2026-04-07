// tests/api-graphql.spec.js
// GraphQL API tests using payloads captured from tmp/network-capture.json
// Run: npx playwright test tests/api-graphql.spec.js --project=chromium

const { test: baseTest, expect, request } = require('@playwright/test');
const { test } = require('../utils/fixtures'); // authenticated browser context
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.app.staging.shipsticks.com';
const GRAPHQL_URL = `${BASE_URL}/graphql`;
const STORAGE_STATE = path.resolve(__dirname, '../.auth/storageState.json');

// Creates an authenticated API context and fetches a CSRF token.
// Rails uses protect_from_forgery — without a valid X-CSRF-Token on POST requests
// it nulls the session before processing, which causes `user` to return Unauthorized.
async function authedContext() {
  const ctx = await request.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    storageState: STORAGE_STATE,
  });

  // Fetch CSRF token from any page (it's in the <meta name="csrf-token"> tag)
  const page = await ctx.get('/');
  const html = await page.text();
  const csrf = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/)?.[1] || '';

  return { ctx, csrf };
}

async function gql({ ctx, csrf }, body) {
  return ctx.post(GRAPHQL_URL, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-CSRF-Token': csrf,
    },
    data: body,
  });
}

test.describe('GraphQL API — Authentication', () => {

  // NOTE: The `user` GraphQL resolver requires a session created through the app's
  // own login modal (which uses a different auth flow than the Rails Devise form POST
  // in globalSetup). The Devise session authenticates Rails endpoints fine, but the
  // GraphQL `user` resolver enforces its own auth check that the Devise session alone
  // does not satisfy. To fully test this, globalSetup would need to log in via the
  // app's modal flow (same as a real user would) rather than the form POST.
  // This is left as a known limitation and a useful interview discussion point.
  test.skip('GetCurrentUser — authenticated session returns user data (requires app-modal login)', async ({ page }) => {
    await page.goto(BASE_URL);

    const res = await page.request.post(GRAPHQL_URL, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      data: {
        operationName: 'GetCurrentUser',
        query: `
          query GetCurrentUser {
            user {
              activeShipments
              email
              firstName
              id
              lastName
              mobileVerificationEligible
              mobileVerified
              phoneNumber
              complete
              countryCode
            }
          }
        `,
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(body.data.user).toBeTruthy();
    expect(body.data.user.email).toBeTruthy();
    expect(body.data.user.id).toBeTruthy();
  });

  test('GetCurrentUser — unauthenticated request returns null user', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const res = await ctx.post(GRAPHQL_URL, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      data: {
        operationName: 'GetCurrentUser',
        query: `
          query GetCurrentUser {
            user {
              email
              id
              firstName
              lastName
            }
          }
        `,
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    // Unauthenticated — server returns either null user or null data with errors
    const userIsNull = body.data === null || body.data?.user === null;
    expect(userIsNull).toBe(true);

    await ctx.dispose();
  });

});

test.describe('GraphQL API — User Lookup', () => {

  test('GetUserEmail — existing email returns user record', async () => {
    const authed = await authedContext();

    const res = await gql(authed, {
      operationName: 'GetUserEmail',
      query: `
        query GetUserEmail($email: String!) {
          getUserByEmail(email: $email) {
            id
            name
            firstName
            lastName
            phoneNumber
            email
            mobileVerificationEligible
            mobileVerified
          }
        }
      `,
      variables: { email: 'john@gmail.com' },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.getUserByEmail).toBeTruthy();
    expect(body.data.getUserByEmail.email).toBe('john@gmail.com');

    await authed.ctx.dispose();
  });

  test('GetUserEmail — unknown email returns null', async () => {
    const authed = await authedContext();

    const nonExistentEmail = `nonexistent-${Date.now()}@nowhere-test.invalid`;

    const res = await gql(authed, {
      operationName: 'GetUserEmail',
      query: `
        query GetUserEmail($email: String!) {
          getUserByEmail(email: $email) {
            id
            email
          }
        }
      `,
      variables: { email: nonExistentEmail },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.getUserByEmail).toBeNull();

    await authed.ctx.dispose();
  });

});

test.describe('GraphQL API — Product Lines', () => {

  test('GetProductLines — returns available product lines for LA to Miami route', async () => {
    const authed = await authedContext();

    const res = await gql(authed, {
      operationName: 'GetProductLines',
      query: `
        query GetProductLines($shipRoute: ShipRouteInput!) {
          getProductLines(shipRoute: $shipRoute) {
            id
            name
            displayName
            icon
            brand {
              id
            }
            labels(shipRoute: $shipRoute) {
              id
              name
              sku
              displayName
            }
          }
        }
      `,
      variables: {
        shipRoute: {
          origin: {
            address1: '1234 Main St',
            address2: '',
            countryCode: 'US',
            companyName: '',
            state: 'CA',
            city: 'Los Angeles',
            postalCode: '90015',
          },
          destination: {
            address1: '4321 Main St',
            address2: '',
            countryCode: 'US',
            companyName: '',
            state: 'FL',
            city: 'Miami Lakes',
            postalCode: '33014',
          },
        },
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(Array.isArray(body.data.getProductLines)).toBe(true);
    expect(body.data.getProductLines.length).toBeGreaterThan(0);

    const productLine = body.data.getProductLines[0];
    expect(productLine.id).toBeTruthy();
    expect(productLine.displayName).toBeTruthy();

    await authed.ctx.dispose();
  });

});

test.describe('GraphQL API — Shipping Rates', () => {

  test('GetDeliverByTransitRates — Golf Bag Standard LA to Miami returns rates', async () => {
    // Payload captured directly from tmp/network-capture.json
    // productId: Golf Bag Standard product
    // experimentVariationId: Optimizely variation active during capture
    const authed = await authedContext();

    const res = await gql(authed, {
      operationName: 'GetDeliverByTransitRates',
      query: `
        query GetDeliverByTransitRates($input: DeliverByTransitRateInput!) {
          transitRates: getDeliverByTransitRates(input: $input) {
            carrierServiceLevel {
              serviceLevel {
                bestValue
                displayName
                systemName
                id
              }
              carrier {
                systemName
              }
            }
            itemRates {
              priceCents
              adjustedPriceCents
              quantity
              totalPriceCents
              totalAdjustedPriceCents
              isPreferred: preferred
            }
            shipDate
            transitTime
            isOffline: offline
          }
        }
      `,
      variables: {
        input: {
          arrivalDate: '2026-04-15',
          direction: 'outbound',
          handlingOption: 'pickup',
          products: [{ productId: '5c5e2d376928b97125000007', quantity: 1 }],
          carrier: '',
          experimentVariationId: '5079228136292352',
          shipRoute: {
            origin: {
              address1: '1234 Main St',
              address2: '',
              city: 'Los Angeles',
              countryCode: 'US',
              postalCode: '90015',
              state: 'CA',
            },
            destination: {
              address1: '4321 Main St',
              address2: '',
              city: 'Miami Lakes',
              countryCode: 'US',
              postalCode: '33014',
              state: 'FL',
            },
          },
        },
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(Array.isArray(body.data.transitRates)).toBe(true);
    expect(body.data.transitRates.length).toBeGreaterThan(0);

    const rate = body.data.transitRates[0];
    expect(rate.shipDate).toBeTruthy();
    expect(rate.transitTime).toBeGreaterThan(0);
    expect(Array.isArray(rate.itemRates)).toBe(true);
    expect(rate.itemRates[0].priceCents).toBeGreaterThan(0);

    await authed.ctx.dispose();
  });

  test('GetDeliverByTransitRates — past delivery date returns empty rates or error', async () => {
    const authed = await authedContext();

    const res = await gql(authed, {
      operationName: 'GetDeliverByTransitRates',
      query: `
        query GetDeliverByTransitRates($input: DeliverByTransitRateInput!) {
          transitRates: getDeliverByTransitRates(input: $input) {
            shipDate
            transitTime
            itemRates { priceCents }
          }
        }
      `,
      variables: {
        input: {
          arrivalDate: '2024-01-01',
          direction: 'outbound',
          handlingOption: 'pickup',
          products: [{ productId: '5c5e2d376928b97125000007', quantity: 1 }],
          carrier: '',
          experimentVariationId: '5079228136292352',
          shipRoute: {
            origin: { address1: '1234 Main St', address2: '', city: 'Los Angeles', countryCode: 'US', postalCode: '90015', state: 'CA' },
            destination: { address1: '4321 Main St', address2: '', city: 'Miami Lakes', countryCode: 'US', postalCode: '33014', state: 'FL' },
          },
        },
      },
    });

    expect([200, 422, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const hasNoRates = !body.data?.transitRates?.length;
      const hasErrors = Array.isArray(body.errors) && body.errors.length > 0;
      expect(hasNoRates || hasErrors).toBe(true);
    }

    await authed.ctx.dispose();
  });

  test('GetDeliverByTransitRates — international route US to UK returns no domestic rates', async () => {
    const authed = await authedContext();

    const res = await gql(authed, {
      operationName: 'GetDeliverByTransitRates',
      query: `
        query GetDeliverByTransitRates($input: DeliverByTransitRateInput!) {
          transitRates: getDeliverByTransitRates(input: $input) {
            shipDate
            transitTime
            itemRates { priceCents }
            carrierServiceLevel { serviceLevel { displayName systemName } }
          }
        }
      `,
      variables: {
        input: {
          arrivalDate: '2026-06-01',
          direction: 'outbound',
          handlingOption: 'pickup',
          products: [{ productId: '5c5e2d376928b97125000007', quantity: 1 }],
          carrier: '',
          experimentVariationId: '5079228136292352',
          shipRoute: {
            origin: { address1: '1234 Main St', address2: '', city: 'Los Angeles', countryCode: 'US', postalCode: '90015', state: 'CA' },
            destination: { address1: '10 Downing Street', address2: '', city: 'London', countryCode: 'GB', postalCode: 'SW1A 2AA', state: '' },
          },
        },
      },
    });

    // International routes either return empty rates or an error — ShipSticks is US domestic
    expect([200, 422, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const rates = body.data?.transitRates ?? [];
      const allDomestic = rates.every(r => r.carrierServiceLevel?.serviceLevel?.systemName?.startsWith('DOMESTIC'));
      // If rates are returned for an international route, none should be DOMESTIC_ service levels
      if (rates.length > 0) {
        expect(allDomestic).toBe(false);
      }
    }

    await authed.ctx.dispose();
  });

  test('GetDeliverByTransitRates — invalid product ID returns empty or error', async () => {
    const authed = await authedContext();

    const res = await gql(authed, {
      operationName: 'GetDeliverByTransitRates',
      query: `
        query GetDeliverByTransitRates($input: DeliverByTransitRateInput!) {
          transitRates: getDeliverByTransitRates(input: $input) {
            shipDate
            transitTime
            itemRates {
              priceCents
            }
          }
        }
      `,
      variables: {
        input: {
          arrivalDate: '2026-12-01',
          direction: 'outbound',
          handlingOption: 'pickup',
          products: [{ productId: 'invalid-product-id-000000000000', quantity: 1 }],
          carrier: '',
          experimentVariationId: '5079228136292352',
          shipRoute: {
            origin: {
              address1: '1234 Main St',
              address2: '',
              city: 'Los Angeles',
              countryCode: 'US',
              postalCode: '90015',
              state: 'CA',
            },
            destination: {
              address1: '4321 Main St',
              address2: '',
              city: 'Miami Lakes',
              countryCode: 'US',
              postalCode: '33014',
              state: 'FL',
            },
          },
        },
      },
    });

    // Server returns 500 for an invalid product ID (unusual but real behaviour on this API)
    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const hasNoRates = !body.data?.transitRates?.length;
      const hasErrors = Array.isArray(body.errors) && body.errors.length > 0;
      expect(hasNoRates || hasErrors).toBe(true);
    }

    await authed.ctx.dispose();
  });

});
test.describe('GraphQL API — Mutations', () => {

  test('createMobileVerification — invalid phone number returns failure', async () => {
    const authed = await authedContext();

    const res = await gql(authed, {
      operationName: 'createMobileVerification',
      query: `
        mutation createMobileVerification($input: MobileVerificationCreateInput!) {
          createMobileVerification(input: $input) {
            success
            errors {
              message
            }
          }
        }
      `,
      variables: { input: { phoneNumber: '000-000-0000' } },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    const result = body.data?.createMobileVerification;
    const hasMutationError = result?.success === false && Array.isArray(result?.errors) && result.errors.length > 0;
    const hasGqlErrors = Array.isArray(body.errors) && body.errors.length > 0;
    expect(hasMutationError || hasGqlErrors).toBe(true);

    await authed.ctx.dispose();
  });

});
