// tests/create-user.spec.js
//
// Two tests — one per implementation in utils/createUser.js:
//
//   1. UI flow  — drives the full sign-up form, wraps it in withNetworkLogging
//                 so every request/response and POST body is visible.
//
//   2. API only — calls POST /api/v5/users directly, no browser needed (~1s).
//
// Run both:
//   npx playwright test tests/create-user.spec.js --project=chromium
//
// Run one:
//   npx playwright test tests/create-user.spec.js --project=chromium --grep "UI flow"
//   npx playwright test tests/create-user.spec.js --project=chromium --grep "API only"

const { test, expect } = require('@playwright/test');
const { withNetworkLogging, dumpCookies } = require('../utils/networkLogger');
const { createUserViaUi, createUserViaApi } = require('../utils/createUser');

// ─── Test 1: UI flow with network capture ────────────────────────────────────

test('create user — UI flow with network capture', async ({ page, context, baseURL }) => {
  // Also capture POST bodies so the raw /api/v5/users payload is visible
  const capturedRequests = [];
  page.on('request', req => {
    if (!req.url().includes('shipsticks')) return;
    if (req.method() !== 'POST') return;
    const body = req.postData();
    if (body) capturedRequests.push({ url: req.url(), body });
  });

  let user;
  await withNetworkLogging(page, 'SIGN-UP', async () => {
    user = await createUserViaUi(page, baseURL);
  });

  await dumpCookies(context, 'AFTER SIGN-UP');

  console.log('\n' + '═'.repeat(70));
  console.log('CAPTURED POST REQUEST BODIES');
  console.log('═'.repeat(70));
  capturedRequests.forEach(({ url, body }) => {
    console.log(`\n  URL: ${url}`);
    try {
      console.log('  BODY:', JSON.stringify(JSON.parse(body), null, 4)
        .split('\n').map(l => '    ' + l).join('\n'));
    } catch {
      console.log('  BODY (raw):', body.substring(0, 600));
    }
  });

  console.log('\n' + '═'.repeat(70));
  console.log('USER CREATED VIA UI');
  console.log('═'.repeat(70));
  console.log(`  email     : ${user.email}`);
  console.log(`  firstName : ${user.firstName}`);
  console.log(`  lastName  : ${user.lastName}`);
  console.log('═'.repeat(70));
});

// ─── Test 2: API only ─────────────────────────────────────────────────────────

test('create user — API only (no UI)', async ({ request, baseURL }) => {
  const user = await createUserViaApi(baseURL, request);

  console.log('\n' + '═'.repeat(70));
  console.log('USER CREATED VIA API');
  console.log('═'.repeat(70));
  console.log(`  id          : ${user.id}`);
  console.log(`  email       : ${user.email}`);
  console.log(`  firstName   : ${user.firstName}`);
  console.log(`  lastName    : ${user.lastName}`);
  console.log(`  phoneNumber : ${user.phoneNumber}`);
  console.log(`  authToken   : ${user.authToken.substring(0, 40)}…`);
  console.log('═'.repeat(70));
});

// ─── Test 3: Bulk — create 20 users on prod via API ──────────────────────────

test('create 20 users — API bulk (prod)', async ({ baseURL }) => {
  test.setTimeout(180000);

  const TOTAL = 20;
  const DELAY_MS = 500; // pause between calls to avoid rate limiting
  const created = [];
  const failed  = [];

  for (let i = 1; i <= TOTAL; i++) {
    try {
      let user;
      try {
        user = await createUserViaApi(baseURL);
      } catch {
        // Retry once — first call can get a transient HTML response on cold start
        await new Promise(r => setTimeout(r, 1000));
        user = await createUserViaApi(baseURL);
      }
      created.push(user);
      console.log(`[${i}/${TOTAL}] ✓  ${user.email}  /  ${user.password}`);
    } catch (err) {
      failed.push({ index: i, error: err.message });
      console.log(`[${i}/${TOTAL}] ✗  ${err.message}`);
    }
    if (i < TOTAL) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`BULK USER CREATION — ${created.length}/${TOTAL} succeeded`);
  console.log('═'.repeat(70));
  console.log('  #   Email                              Password');
  console.log('  ' + '─'.repeat(66));
  created.forEach((u, idx) => {
    console.log(`  ${String(idx + 1).padStart(2)}  ${u.email.padEnd(35)}  ${u.password}`);
  });

  if (failed.length) {
    console.log('\n  Failed:');
    failed.forEach(f => console.log(`  [${f.index}] ${f.error}`));
  }

  console.log('═'.repeat(70));

  expect(created.length).toBe(TOTAL);
});
