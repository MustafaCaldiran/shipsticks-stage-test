// tests/api-graphql.spec.js
// GraphQL API tests using payloads captured from tmp/network-capture.json
// Run: npx playwright test tests/api-graphql.spec.js --project=chromium

const { test, expect, request } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.app.staging.shipsticks.com';
const GRAPHQL_URL = `${BASE_URL}/graphql`;
const STORAGE_STATE = path.resolve(__dirname, '../.auth/storageState.json');

function getCookieHeader() {
  const { cookies } = JSON.parse(fs.readFileSync(STORAGE_STATE, 'utf8'));
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

async function gql(ctx, body, cookieHeader) {
  return ctx.post(GRAPHQL_URL, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: cookieHeader,
    },
    data: body,
  });
}

test.describe('GraphQL API — Authentication', () => {

  test('GetCurrentUser — authenticated session returns user data', async () => {
    const cookieHeader = getCookieHeader();
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const res = await gql(ctx, {
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
    }, cookieHeader);

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.user).toBeTruthy();
    expect(body.data.user.email).toBeTruthy();
    expect(body.data.user.id).toBeTruthy();
    expect(body.errors).toBeUndefined();

    await ctx.dispose();
  });

  test('GetCurrentUser — unauthenticated request returns null user', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const res = await gql(ctx, {
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
    }, '');

    expect(res.status()).toBe(200);
    const body = await res.json();
    // Unauthenticated — user field should be null
    expect(body.data.user).toBeNull();

    await ctx.dispose();
  });

});

test.describe('GraphQL API — User Lookup', () => {

  test('GetUserEmail — existing email returns user record', async () => {
    const cookieHeader = getCookieHeader();
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const res = await gql(ctx, {
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
    }, cookieHeader);

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.getUserByEmail).toBeTruthy();
    expect(body.data.getUserByEmail.email).toBe('john@gmail.com');

    await ctx.dispose();
  });

  test('GetUserEmail — unknown email returns null', async () => {
    const cookieHeader = getCookieHeader();
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const nonExistentEmail = `nonexistent-${Date.now()}@nowhere-test.invalid`;

    const res = await gql(ctx, {
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
    }, cookieHeader);

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.getUserByEmail).toBeNull();

    await ctx.dispose();
  });

});

test.describe('GraphQL API — Product Lines', () => {

  test('GetProductLines — returns available product lines for LA to Miami route', async () => {
    const cookieHeader = getCookieHeader();
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const res = await gql(ctx, {
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
    }, cookieHeader);

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(Array.isArray(body.data.getProductLines)).toBe(true);
    expect(body.data.getProductLines.length).toBeGreaterThan(0);

    const productLine = body.data.getProductLines[0];
    expect(productLine.id).toBeTruthy();
    expect(productLine.displayName).toBeTruthy();

    await ctx.dispose();
  });

});

test.describe('GraphQL API — Shipping Rates', () => {

  test('GetDeliverByTransitRates — Golf Bag Standard LA to Miami returns rates', async () => {
    // Payload captured directly from tmp/network-capture.json
    // productId: Golf Bag Standard product
    // experimentVariationId: Optimizely variation active during capture
    const cookieHeader = getCookieHeader();
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const res = await gql(ctx, {
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
    }, cookieHeader);

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

    await ctx.dispose();
  });

  test('GetDeliverByTransitRates — invalid product ID returns empty or error', async () => {
    const cookieHeader = getCookieHeader();
    const ctx = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const res = await gql(ctx, {
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
    }, cookieHeader);

    expect(res.status()).toBe(200);
    const body = await res.json();
    // Expect empty rates or a GraphQL error — either is valid behaviour
    const hasNoRates = !body.data?.transitRates?.length;
    const hasErrors = Array.isArray(body.errors) && body.errors.length > 0;
    expect(hasNoRates || hasErrors).toBe(true);

    await ctx.dispose();
  });

});