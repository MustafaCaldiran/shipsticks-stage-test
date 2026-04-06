# API Testing Guide — ShipSticks Playwright Automation

This document explains everything we built: how we discovered the APIs, how we captured real network traffic, how we turned that into automated tests, and how it all works under the hood. Written for someone who knows REST but is new to GraphQL.

---

## Table of Contents

1. [The Big Picture — What We Built](#1-the-big-picture)
2. [Step 1 — Network Capture: How We Listened to Every API Call](#2-step-1--network-capture)
3. [What the Capture Revealed: The App Uses GraphQL](#3-what-the-capture-revealed)
4. [REST vs GraphQL — The Core Difference](#4-rest-vs-graphql)
5. [Step 2 — API Tests Without a Browser](#5-step-2--api-tests-without-a-browser)
6. [How Authentication Works in the Tests](#6-how-authentication-works)
7. [File-by-File Breakdown](#7-file-by-file-breakdown)
8. [API Interception with page.route() — Interview Gold](#8-api-interception-with-pageroute)
9. [Test Ideas to Add Next](#9-test-ideas-to-add-next)

---

## 1. The Big Picture

Before we wrote a single API test, we had no idea what endpoints the app was calling. We couldn't just guess the URLs. So we went through this process:

```
Step 1: Run the real UI flow (sign-up, booking) and record every network call → network-capture.json
Step 2: Read the capture, find the real endpoints and exact request payloads
Step 3: Write API tests that send those same payloads directly — no browser needed
Step 4: Add interception tests that mock the API to test edge cases in the UI
```

This approach works for any app. You don't need API docs. You just listen.

---

## 2. Step 1 — Network Capture

**File:** `tests/network-capture.spec.js`

The idea is simple: Playwright gives you hooks called `page.on('request')` and `page.on('response')`. These fire every single time the browser sends or receives anything — HTML, images, JSON, GraphQL — everything.

We attached those hooks before navigating to the page, so nothing slipped through:

```js
const log = [];

// This fires for EVERY outgoing request
page.on('request', req => {
  if (!isApiCall(req.url())) return;  // skip .js, .css, images, analytics
  log.push({
    dir: 'REQ',
    method: req.method(),       // GET, POST, etc.
    url: req.url(),             // full URL
    postData: req.postData(),   // the request body (the GraphQL query lives here)
  });
});

// This fires for EVERY incoming response
page.on('response', async res => {
  if (!isApiCall(res.url())) return;
  let body = null;
  try { body = await res.json(); } catch {
    try { body = (await res.text()).slice(0, 800); } catch {}
  }
  log.push({
    dir: 'RES',
    status: res.status(),   // 200, 201, 404, etc.
    url: res.url(),
    body,                   // the actual response data
  });
});

// Then we ran the real UI flow — sign-up, booking step 1 — while recording
await home.goto();
await home.clickSignIn();
// ... full flow ...

// Save everything to a JSON file
fs.writeFileSync('tmp/network-capture.json', JSON.stringify(log, null, 2));
```

The `isApiCall()` filter keeps noise out — it skips static assets and third-party analytics (Google Tag Manager, Optimizely, Airbrake, Intercom) so we only see the app's real backend calls.

**To run the capture yourself:**
```bash
npx playwright test tests/network-capture.spec.js --headed --project=chromium
```

Then open `tmp/network-capture.json` to see everything the browser sent and received.

---

## 3. What the Capture Revealed

When we opened `tmp/network-capture.json`, we found something important: **almost every single API call goes to the same URL:**

```
POST https://www.app.staging.shipsticks.com/graphql
```

There is also a secondary endpoint:
```
POST https://staging.shipsticks.com/api/v6/graphql
```

This means ShipSticks uses **GraphQL**, not REST. Only one exception: user registration goes to a REST endpoint at `POST /api/v5/users`.

**GraphQL operations captured during sign-up:**

| Operation Name | Type | What It Does |
|---|---|---|
| `getPricingExperiments` | query | Loads A/B test config on page load |
| `cutoffTimesWithClubZone` | query | Gets pickup cutoff times |
| `getCountries` | query | Loads country list for the address form |
| `GetUserEmail` | query | Checks if an email is already registered |
| `createMobileVerification` | mutation | Sends the SMS code to the user's phone |
| `GetCurrentUser` | query | Fetches the logged-in user's data |

**GraphQL operations captured during booking step 1:**

| Operation Name | Type | What It Does |
|---|---|---|
| `getPlaceDetails` | query | Converts a Google autocomplete ID to a full address |
| `classifyAddress` | mutation | Tags an address as residential or commercial |
| `GetProductLines` | query | Gets available item types (Golf Bag, Ski Bag, etc.) for the route |
| `GetProductLinePricing` | query | Gets the price per item |
| `getShippingDates` | query | Gets available delivery date options |
| `getNotes` | query | Gets warnings for the origin/destination |
| `GetDeliverByTransitRates` | query | **The main rates call** — returns Ground/Express options with prices |

---

## 4. REST vs GraphQL — The Core Difference

This is the most important thing to understand for your interview.

### REST: Many Endpoints, One Purpose Each

In a REST API, each resource has its own URL. To build the booking page, the app would make multiple separate calls:

```
GET  /api/products              → get available bag types
GET  /api/rates?origin=LA&dest=FL  → get shipping prices
GET  /api/dates?route=...       → get available dates
GET  /api/user/me               → get user info
```

Every endpoint returns a fixed set of data — you get back whatever the server decides to include, even if you only need two fields. If you need data from three endpoints, you make three requests.

**REST request example:**
```
GET https://api.example.com/users/123
```
Response (server decides what to return):
```json
{
  "id": 123,
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "createdAt": "2024-01-01",
  "lastLogin": "2024-06-01",
  "address": { ... },
  "preferences": { ... }
}
```

### GraphQL: One Endpoint, You Decide What You Get

GraphQL has a single endpoint (`/graphql`). Instead of the server deciding what to return, **you write a query that says exactly which fields you want.** The response only contains those fields — nothing more.

**The same user data in GraphQL:**
```js
// The request body (this is the "query")
POST /graphql
{
  "query": "query GetCurrentUser { user { id email firstName } }",
  "operationName": "GetCurrentUser"
}
```
Response (only what you asked for):
```json
{
  "data": {
    "user": {
      "id": "abc123",
      "email": "john@example.com",
      "firstName": "John"
    }
  }
}
```

### The Key Differences Side by Side

| | REST | GraphQL |
|---|---|---|
| **Endpoints** | Many (`/users`, `/products`, `/rates`) | One (`/graphql`) |
| **HTTP Method** | GET, POST, PUT, DELETE, PATCH | Always POST |
| **HTTP Status for errors** | 404 Not Found, 401 Unauthorized, etc. | Usually always 200, error goes in the body |
| **Response shape** | Fixed by the server | You specify exactly what you want |
| **Over-fetching** | Common (you get fields you don't need) | Never (you only get what you ask for) |
| **Under-fetching** | Common (need multiple requests) | Rare (one query can span multiple resources) |
| **Request body** | Varies by endpoint | Always has `query`, `variables`, `operationName` |

### The Tricky Part: GraphQL Always Returns 200

This is what catches people off guard. In REST, if something goes wrong:
- `404` means the resource wasn't found
- `401` means you're not authenticated
- `422` means the input was invalid

In GraphQL, the HTTP status is almost always `200 OK`, even when there's an error. The error is **inside the response body:**

```json
{
  "data": null,
  "errors": [
    {
      "message": "User not found",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["getUserByEmail"]
    }
  ]
}
```

This is why our GraphQL tests check `body.errors` in addition to `res.status()`:

```js
expect(res.status()).toBe(200);        // HTTP is always 200
expect(body.errors).toBeUndefined();   // THIS is how you know it succeeded
expect(body.data.user).toBeTruthy();   // and then check the data
```

### Mutations vs Queries

GraphQL has two types of operations:
- **Query** — read-only, like GET in REST. Example: `GetCurrentUser`, `GetProductLines`
- **Mutation** — changes data, like POST/PUT/DELETE in REST. Example: `createMobileVerification`

Both are sent as `POST` requests to the same `/graphql` endpoint.

### Why This App Uses GraphQL

ShipSticks is a Next.js app. The booking page needs products, prices, dates, and user data all at once. With GraphQL, the frontend can fetch all of that in one or two requests, which makes the page load faster. With REST, it would need 4+ separate calls.

---

## 5. Step 2 — API Tests Without a Browser

Once we knew the real endpoints and exact payloads from the capture, we wrote tests that skip the browser entirely. Instead of loading a page and clicking buttons, we send HTTP requests directly using Playwright's `request` API.

This is faster, more reliable, and tests the backend independently from the UI.

**The pattern every GraphQL test follows:**

```js
const { test, expect, request } = require('@playwright/test');

test('GetCurrentUser — authenticated session returns user data', async () => {
  // 1. Create an HTTP client (no browser)
  const ctx = await request.newContext({
    baseURL: 'https://www.app.staging.shipsticks.com',
    ignoreHTTPSErrors: true,
  });

  // 2. Send a POST to /graphql with our query
  const res = await ctx.post('/graphql', {
    headers: {
      'Content-Type': 'application/json',
      Cookie: getCookieHeader(),  // authentication via saved session
    },
    data: {
      operationName: 'GetCurrentUser',
      query: `
        query GetCurrentUser {
          user {
            id
            email
            firstName
          }
        }
      `,
    },
  });

  // 3. Assert
  expect(res.status()).toBe(200);           // always 200 in GraphQL
  const body = await res.json();
  expect(body.errors).toBeUndefined();      // no GraphQL-level errors
  expect(body.data.user.email).toBeTruthy(); // data is actually there

  await ctx.dispose();
});
```

---

## 6. How Authentication Works

Most of our API tests need to be logged in. We handle this by reusing the saved session from `globalSetup`.

**How the session gets saved (`globalSetup.js`):**
The setup script logs in once by doing a real browser login, then saves all the cookies to `.auth/storageState.json`. This file contains the session cookie that proves to the server "this request comes from a logged-in user."

**How API tests use it:**
```js
function getCookieHeader() {
  const { cookies } = JSON.parse(
    fs.readFileSync('.auth/storageState.json', 'utf8')
  );
  // Convert the array of cookie objects into a single "Cookie: name=value; ..." header
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}
```

Then we attach that header to every API request:
```js
headers: {
  'Content-Type': 'application/json',
  Cookie: getCookieHeader(),
}
```

The server sees the session cookie and knows who is making the request — same as if you were logged in and using the website normally.

---

## 7. File-by-File Breakdown

### `tests/network-capture.spec.js`
**Purpose:** Discovery tool. Run once to record all network traffic.
**When to use:** When you suspect the app changed its API, or when you want to find a new endpoint you haven't tested yet.
**Output:** `tmp/network-capture.json`

### `tmp/network-capture.json`
**Purpose:** The raw recording. Contains every HTTP request/response from the sign-up and booking flows.
**How to use:** Search for keywords like `"mutation"`, `"query"`, or a field name to find the exact payload a feature uses.

### `tests/api-graphql.spec.js`
**Purpose:** Tests the GraphQL endpoint directly — no browser.
**What it tests:**
- `GetCurrentUser` with valid session → returns user data
- `GetCurrentUser` with no session → returns null (unauthenticated)
- `GetUserEmail` with known email → finds the user
- `GetUserEmail` with unknown email → returns null
- `GetProductLines` for a route → returns available bag types
- `GetDeliverByTransitRates` → returns pricing with `priceCents > 0`
- `GetDeliverByTransitRates` with invalid product → returns empty or error

### `tests/api-user.spec.js`
**Purpose:** Tests user registration via the REST endpoint `POST /api/v5/users`.
**What it tests:**
- Create a new user → 201 response
- Duplicate email → 4xx error
- Missing required fields → 4xx error
- Mismatched passwords → 4xx error
- Full flow: register → login → `GetCurrentUser` confirms the account works

### `tests/api-booking.spec.js`
**Purpose:** Template for booking/shipment API tests. Payloads marked with `// TODO` need to be filled in from the network capture after running a booking flow.
**What it will test:**
- Create a new booking
- Cancel a booking
- List user's bookings
- Unauthenticated access returns 401

---

## 8. API Interception with page.route()

This is different from the capture. `page.on('request')` only **listens** — it can't change anything. `page.route()` **intercepts** — you can modify, block, or replace the response before the browser ever sees it.

This lets you test UI behavior for scenarios that are hard to reproduce in real life: server errors, empty results, slow responses, payment failures.

### How page.route() Works

```js
// Intercept all requests matching a pattern
await page.route('**/graphql', async route => {
  const request = route.request();

  // Option A: Block the request entirely
  await route.abort();

  // Option B: Return a fake response
  await route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ errors: [{ message: 'Server Error' }] }),
  });

  // Option C: Let it through unchanged
  await route.continue();

  // Option D: Modify the request before it goes to the server
  await route.continue({
    headers: { ...request.headers(), 'X-Custom-Header': 'test' },
  });
});
```

The pattern matching supports wildcards:
- `'**/graphql'` — matches any URL ending in `/graphql`
- `'**rates**'` — matches any URL containing "rates"
- `'https://exact.url.com/path'` — exact match

### Intercepting GraphQL Specifically

Because GraphQL always POSTs to the same URL, you need to inspect the request body to intercept a specific operation:

```js
await page.route('**/graphql', async route => {
  const body = JSON.parse(route.request().postData());

  if (body.operationName === 'GetDeliverByTransitRates') {
    // Only intercept this specific query, let others through
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { transitRates: [] },  // fake empty result
      }),
    });
  } else {
    await route.continue();
  }
});
```

### Real Interception Tests You Can Write

**1. Shipping rates API returns 500 — verify the UI shows an error:**
```js
test('shows error message when rates API fails', async ({ page, baseURL }) => {
  await page.route('**/graphql', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.operationName === 'GetDeliverByTransitRates') {
      await route.fulfill({
        status: 500,
        body: 'Internal Server Error',
      });
    } else {
      await route.continue();
    }
  });

  // Now navigate and go through the booking flow
  // The UI should show an error message, not a blank screen
  await page.goto(baseURL);
  // ... fill out the form ...
  await expect(page.getByText(/something went wrong/i)).toBeVisible();
});
```

**2. Rates return empty — verify "no options available" UI:**
```js
test('shows fallback message when no shipping options available', async ({ page, baseURL }) => {
  await page.route('**/graphql', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.operationName === 'GetDeliverByTransitRates') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { transitRates: [] } }),
      });
    } else {
      await route.continue();
    }
  });
  // Assert the UI handles an empty result gracefully
});
```

**3. Slow network — verify loading spinner appears:**
```js
test('shows loading spinner while rates are loading', async ({ page, baseURL }) => {
  await page.route('**/graphql', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.operationName === 'GetDeliverByTransitRates') {
      await new Promise(r => setTimeout(r, 3000));  // 3-second delay
      await route.continue();
    } else {
      await route.continue();
    }
  });

  // Assert a loading indicator is visible DURING the 3-second delay
  await expect(page.locator('.loading-spinner')).toBeVisible();
});
```

**4. Assert the request payload is correct (no mock — just spy):**
```js
test('booking form sends correct origin and destination to the API', async ({ page, baseURL }) => {
  let capturedPayload;

  await page.route('**/graphql', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.operationName === 'GetDeliverByTransitRates') {
      capturedPayload = body.variables.input;  // save what was sent
    }
    await route.continue();  // still let it through so the UI works normally
  });

  // Go through the booking flow
  // ...

  // Assert the payload that was sent matches what we entered in the form
  expect(capturedPayload.shipRoute.origin.city).toBe('Los Angeles');
  expect(capturedPayload.shipRoute.destination.city).toBe('Miami Lakes');
  expect(capturedPayload.products[0].quantity).toBe(1);
});
```

**5. Simulate being offline:**
```js
test('handles going offline gracefully', async ({ page, context, baseURL }) => {
  await page.goto(`${baseURL}/book/ship`);
  await context.setOffline(true);
  // Try to submit the form — assert an error message, not a crash
  await context.setOffline(false);
});
```

---

## 9. Test Ideas to Add Next

### High-Value API Tests

| Test | Why It's Impressive |
|---|---|
| `GetDeliverByTransitRates` — past delivery date | Business rule: past dates shouldn't return rates |
| `GetDeliverByTransitRates` — international route (US → UK) | Verifies international shipping logic |
| `GetProductLines` — route with no available products | Edge case: what happens when no bags are available? |
| `classifyAddress` mutation — residential vs commercial | Address classification affects pricing |
| `createMobileVerification` mutation — invalid phone | Validates phone number handling |
| `GetCurrentUser` — expired session cookie | What happens when the cookie is stale? |

### High-Value Interception Tests

| Test | Why It's Impressive |
|---|---|
| Mock `GetDeliverByTransitRates` returning one Ground and one Express option | Verify both options render with correct prices |
| Mock `classifyAddress` returning "residential" — verify residential fee appears in UI | Tests UI logic driven by API data |
| Abort the `/graphql` request entirely | Tests offline/network failure UI handling |
| Delay `GetDeliverByTransitRates` by 5 seconds | Verifies loading state is shown |
| Mock rates with `priceCents: 0` | Edge case: free shipping scenario |
| Intercept `POST /api/v5/users` and return a 409 conflict | Verifies "email already taken" UI message |

### Interview-Ready Talking Points

When asked about your API testing approach, you can say:

> "I started by running the real UI flows under Playwright's network listener to discover what the app actually calls — because the app had no API documentation. Once I saw the requests in the capture file, I identified that it's a GraphQL API with a single `/graphql` endpoint, which is different from REST where each resource has its own URL. I then wrote two types of tests: direct API tests using `request.newContext()` that bypass the browser entirely for speed, and interception tests using `page.route()` to mock the API and test UI error states that would be hard to reproduce on a real staging environment."

When asked what's different about testing GraphQL vs REST:

> "The main difference is that GraphQL always returns HTTP 200, even for errors — the error is in the response body in an `errors` field. You also always POST to the same endpoint and include the operation name in the request body, so to intercept a specific operation in Playwright you need to parse the request body and check `operationName`, rather than matching on the URL path like you would with REST."
