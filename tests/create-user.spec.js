// tests/create-user.spec.js
//
// Tests — one per implementation in utils/createUser.js:
//
//   1. UI flow  — drives the full sign-up form, wraps it in withNetworkLogging
//                 so every request/response and POST body is visible.
//
//   2. API only — calls POST /api/v5/users directly, no browser needed (~1s).
//
//   3. Bulk sequential — creates 20 users one at a time with a delay.
//
//   4. Bulk parallel   — creates 20 users all at once with Promise.allSettled.
//                        Writes credentials to tmp/created-users.txt.
//
// Run all:
//   npx playwright test tests/create-user.spec.js --project=chromium
//
// Run one:
//   npx playwright test tests/create-user.spec.js --project=chromium --grep "UI flow"
//   npx playwright test tests/create-user.spec.js --project=chromium --grep "API only"
//   npx playwright test tests/create-user.spec.js --project=chromium --grep "sequential"
//   npx playwright test tests/create-user.spec.js --project=chromium --grep "parallel"

const { test, expect } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');
const { withNetworkLogging, dumpCookies } = require('../utils/networkLogger');
const { createUserViaUi, createUserViaApi } = require('../utils/createUser');

// ─── shared helper ────────────────────────────────────────────────────────────

function saveToFile(baseURL, created, failed) {
  const outPath = path.resolve(__dirname, '../tmp/created-users.txt');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const lines = [
    `Created: ${new Date().toISOString()}`,
    `Environment: ${baseURL}`,
    `Total: ${created.length} created, ${failed.length} failed`,
    '',
    '#   Email                              Password',
    '─'.repeat(66),
    ...created.map(({ index, user }) =>
      `${String(index).padStart(2)}  ${user.email.padEnd(35)}  ${user.password}`
    ),
    ...(failed.length
      ? ['', 'Failed:', ...failed.map(f => `  [${f.index}] ${f.error}`)]
      : []),
  ];

  fs.writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`\nCredentials saved → tmp/created-users.txt`);
}

// ─── Test 1: UI flow with network capture ────────────────────────────────────

test('create user — UI flow with network capture', async ({ page, context, baseURL }) => {
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

// ─── Test 3: Bulk sequential ──────────────────────────────────────────────────

test('create 20 users — API bulk sequential (prod)', async ({ baseURL }) => {
  test.setTimeout(180000);

  const TOTAL    = 20;
  const DELAY_MS = 500;
  const created  = [];
  const failed   = [];

  for (let i = 1; i <= TOTAL; i++) {
    try {
      let user;
      try {
        user = await createUserViaApi(baseURL);
      } catch {
        await new Promise(r => setTimeout(r, 1000));
        user = await createUserViaApi(baseURL);
      }
      created.push({ index: i, user });
      console.log(`[${i}/${TOTAL}] ✓  ${user.email}  /  ${user.password}`);
    } catch (err) {
      failed.push({ index: i, error: err.message });
      console.log(`[${i}/${TOTAL}] ✗  ${err.message}`);
    }
    if (i < TOTAL) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`BULK USER CREATION (SEQUENTIAL) — ${created.length}/${TOTAL} succeeded`);
  console.log('═'.repeat(70));
  console.log('  #   Email                              Password');
  console.log('  ' + '─'.repeat(66));
  created.forEach(({ index, user }) => {
    console.log(`  ${String(index).padStart(2)}  ${user.email.padEnd(35)}  ${user.password}`);
  });
  if (failed.length) {
    console.log('\n  Failed:');
    failed.forEach(f => console.log(`  [${f.index}] ${f.error}`));
  }
  console.log('═'.repeat(70));

  saveToFile(baseURL, created, failed);
  expect(created.length).toBe(TOTAL);
});

// ─── Test 5: Rate limit stress — parallel workers for 60s (prod) ─────────────

test('rate limit stress — parallel workers for 60s (prod)', async ({ baseURL }) => {
  test.setTimeout(90000); // 90s timeout to give the 60s run room to finish

  const DURATION_MS = 60_000;
  const CONCURRENCY = 10;
  const deadline    = Date.now() + DURATION_MS;

  const created        = [];
  const failed         = [];
  let   firstRateLimit = null;

  async function worker(workerId) {
    while (Date.now() < deadline) {
      try {
        const user  = await createUserViaApi(baseURL);
        const entry = { index: created.length + 1, user };
        created.push(entry);
        console.log(`[W${workerId}] ✓  ${user.email}`);
      } catch (err) {
        const isRateLimit = err.message.includes('429') ||
                            err.message.toLowerCase().includes('rate');
        if (isRateLimit && !firstRateLimit) {
          firstRateLimit = { workerId, ts: Date.now(), error: err.message };
          console.log(`[W${workerId}] ⚠  RATE LIMIT HIT — ${new Date().toISOString()}`);
        }
        failed.push({ index: failed.length + 1, error: err.message });
        console.log(`[W${workerId}] ✗  ${err.message.substring(0, 100)}`);
        await new Promise(r => setTimeout(r, 500)); // brief back-off before retrying
      }
    }
  }

  await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1))
  );

  console.log('\n' + '═'.repeat(70));
  console.log(`RATE LIMIT STRESS TEST — ${CONCURRENCY} parallel workers × 60s`);
  console.log('═'.repeat(70));
  console.log(`  Created : ${created.length}`);
  console.log(`  Failed  : ${failed.length}`);
  if (firstRateLimit) {
    console.log(`  First rate limit hit by worker W${firstRateLimit.workerId}`);
    console.log(`  At : ${new Date(firstRateLimit.ts).toISOString()}`);
    console.log(`  Err: ${firstRateLimit.error.substring(0, 120)}`);
  } else {
    console.log('  No rate limit encountered in 60s.');
  }
  console.log('═'.repeat(70));
  console.log(`\n→ ${created.length} users created in 60s across ${CONCURRENCY} parallel workers`);

  saveToFile(baseURL, created, failed);
  // No hard assertion — this is exploratory, result is in the output
});

// ─── Test 4: Bulk parallel ────────────────────────────────────────────────────

test('create 20 users — API bulk parallel (prod)', async ({ baseURL }) => {
  test.setTimeout(60000);

  const TOTAL = 20;

  // Stagger starts by 200ms per slot so all 20 don't hit the server at the
  // exact same instant and trigger rate limiting, while still running in parallel
  const results = await Promise.allSettled(
    Array.from({ length: TOTAL }, (_, i) =>
      new Promise(r => setTimeout(r, i * 200))
        .then(() => createUserViaApi(baseURL))
        .then(user => ({ index: i + 1, user }))
    )
  );

  const created = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  const failed = results
    .filter(r => r.status === 'rejected')
    .map((r, i) => ({ index: i + 1, error: r.reason?.message ?? r.reason }));

  console.log('\n' + '═'.repeat(70));
  console.log(`BULK USER CREATION (PARALLEL) — ${created.length}/${TOTAL} succeeded`);
  console.log('═'.repeat(70));
  console.log('  #   Email                              Password');
  console.log('  ' + '─'.repeat(66));
  created.forEach(({ index, user }) => {
    console.log(`  ${String(index).padStart(2)}  ${user.email.padEnd(35)}  ${user.password}`);
  });
  if (failed.length) {
    console.log('\n  Failed:');
    failed.forEach(f => console.log(`  [${f.index}] ${f.error}`));
  }
  console.log('═'.repeat(70));

  saveToFile(baseURL, created, failed);
  expect(created.length).toBe(TOTAL);
});
