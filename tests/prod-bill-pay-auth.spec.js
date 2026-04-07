// tests/prod-bill-pay-auth.spec.js
//
// Diagnostic test for the production Online Bill Pay authentication issue.
//
// Findings being investigated:
//   1. Phone-VERIFIED account   → bill pay opens logged in  ✓
//      Phone-UNVERIFIED account → bill pay opens logged out ✗ (possibly intentional)
//   2. Either way: logging out from bill pay does NOT log the user out
//      of the main ShipSticks site                          ✗ (likely a bug)
//
// Network calls are captured to find the root cause of both behaviours.
//
// Run:
//   PROD_EMAIL=shipsticksprodtest@gmail.com \
//   PROD_PASSWORD=Password \
//   BASE_URL=https://www.shipsticks.com \
//   npx playwright test tests/prod-bill-pay-auth.spec.js --project=chromium

const { test, expect } = require('@playwright/test');
const HomePage = require('../pages/HomePage');

const PROD_URL      = 'https://www.shipsticks.com';
const PROD_EMAIL    = process.env.PROD_EMAIL    || 'shipsticksprodtest@gmail.com';
const PROD_PASSWORD = process.env.PROD_PASSWORD || 'Password';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Attach request + response loggers immediately so no early requests are missed. */
function attachNetworkLogger(page, label) {
  page.on('request', req => {
    const url = req.url();
    if (!url.includes('shipsticks')) return;
    const h = req.headers();
    console.log(`\n[${label}][REQ] ${req.method()} ${url}`);
    console.log(`  cookie:        ${(h['cookie'] || '(none)').substring(0, 400)}`);
    console.log(`  authorization: ${h['authorization'] || '(none)'}`);
  });

  page.on('response', async res => {
    const url    = res.url();
    const status = res.status();
    if (!url.includes('shipsticks')) return;

    const h         = res.headers();
    const setCookie = h['set-cookie'] || '';
    const location  = h['location']   || '';
    const marker    = status >= 300 ? '⚠' : ' ';
    console.log(`[${label}][RES] ${marker} ${status} ${url}${location ? ' → ' + location : ''}`);

    if (setCookie) console.log(`  set-cookie: ${setCookie.substring(0, 400)}`);

    if (url.includes('/graphql')) {
      try {
        const body = await res.json();
        if (body?.data?.currentUser !== undefined) {
          console.log(`  currentUser: ${JSON.stringify(body.data.currentUser)}`);
        }
      } catch { /* non-JSON */ }
    }
  });
}

/** Print every shipsticks cookie currently in the browser context. */
async function dumpCookies(context, label) {
  const relevant = (await context.cookies()).filter(c => c.domain.includes('shipsticks'));
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`COOKIES — ${label}`);
  console.log('─'.repeat(70));
  if (!relevant.length) {
    console.log('  (none)');
  } else {
    relevant.forEach(c =>
      console.log(
        `  ${c.name}=${c.value.substring(0, 80)}\n` +
        `    domain=${c.domain}  path=${c.path}  sameSite=${c.sameSite}  secure=${c.secure}`
      )
    );
  }
  console.log('─'.repeat(70));
}

// ─── test ───────────────────────────────────────────────────────────────────

test('prod — bill pay auth: phone verification gate + logout sync', async ({ page, context }) => {

  // ── STEP 1: Log in on the production main site ────────────────────────────
  attachNetworkLogger(page, 'MAIN');

  const home = new HomePage(page, PROD_URL);
  await home.goto();  // handles chat widget blocking + cookie banner

  await home.clickSignIn();
  await home.assertSignInModalVisible();

  const modal = page.getByRole('dialog');

  // Use typeWithFocusGuard so chat widget / focus stealing does not corrupt input
  await home.typeWithFocusGuard(
    modal.getByRole('textbox', { name: /email/i }),
    PROD_EMAIL
  );
  // Password field is type="password" — typeWithFocusGuard works on any input
  await home.typeWithFocusGuard(
    modal.locator('input[type="password"]'),
    PROD_PASSWORD
  );

  await modal.getByRole('button', { name: 'Log In' }).click();

  // The Account options menu button appearing confirms we are logged in
  await expect(page.getByRole('button', { name: 'Account options menu' })).toBeVisible({ timeout: 25000 });
  console.log('\n✓ Logged in on production main site');
  await dumpCookies(context, 'AFTER MAIN-SITE LOGIN');

  // ── STEP 2: Capture the bill pay link href before clicking ────────────────
  // The account menu can close if focus is stolen (Zendesk widget etc.)
  // Retry up to 3 times, same pattern as typeWithFocusGuard
  const billPayItem = home.onlineBillPay;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await home.dismissChatWidgetIfPresent();
    await page.waitForTimeout(500);
    await home.userAccount.click();
    try {
      await expect(billPayItem).toBeVisible({ timeout: 4000 });
      break;
    } catch {
      console.log(`  account menu attempt ${attempt} — menu closed, retrying…`);
      if (attempt === 3) await expect(billPayItem).toBeVisible({ timeout: 5000 });
    }
  }

  const billPayHref1 = await billPayItem.evaluate(
    el => el.getAttribute('href') || el.closest('a')?.getAttribute('href') || '(no href)'
  );
  console.log(`\n══ Bill pay link href — VISIT 1: ${billPayHref1}`);

  // ── STEP 3: First visit — attach logger before the tab is created ─────────
  context.once('page', newTab => {
    console.log('\n══ NEW TAB opened — VISIT 1 ══');
    attachNetworkLogger(newTab, 'VISIT-1');
  });

  const [tab1] = await Promise.all([
    context.waitForEvent('page'),
    billPayItem.click(),
  ]);

  await tab1.waitForLoadState('domcontentloaded');
  await tab1.waitForTimeout(3000); // let JS-driven auth check settle
  await tab1.screenshot({ path: 'tmp/prod-visit1.png', fullPage: true });

  const visit1Url = tab1.url();
  console.log(`\n══ Bill pay tab URL — VISIT 1: ${visit1Url}`);

  const loggedInVisit1 = await tab1.getByRole('link', { name: /Hello,.*My Account/i }).isVisible();
  console.log(`   Logged in on bill pay (visit 1): ${loggedInVisit1 ? 'YES ✓' : 'NO ✗ — phone not verified?'}`);
  await dumpCookies(context, 'AFTER VISIT 1 LOADED');

  // ── STEP 4: Log out from bill pay (only if we are logged in) ─────────────
  if (loggedInVisit1) {
    console.log('\n── Logging out from bill pay ──');

    // Capture every response during logout to see which cookies get cleared
    tab1.on('response', async res => {
      if (!res.url().includes('shipsticks')) return;
      const h = res.headers();
      if (h['set-cookie'] || res.status() >= 300) {
        console.log(`[LOGOUT][RES] ${res.status()} ${res.url()}`);
        if (h['set-cookie']) console.log(`  set-cookie: ${h['set-cookie'].substring(0, 400)}`);
        if (h['location'])   console.log(`  location:   ${h['location']}`);
      }
    });

    // Logout is in the footer "Account" section — directly visible without any dropdown
    const logoutLink = tab1.getByRole('link', { name: 'Logout' }).first();
    await expect(logoutLink).toBeVisible({ timeout: 10000 });
    await logoutLink.click();

    // After logout, bill pay redirects back to www.shipsticks.com
    await tab1.waitForURL(/shipsticks\.com/, { timeout: 15000 });
    await tab1.waitForLoadState('domcontentloaded');
    await tab1.waitForTimeout(2000);
    await tab1.screenshot({ path: 'tmp/prod-after-billpay-logout.png', fullPage: false });
    console.log(`✓ After logout — tab landed on: ${tab1.url()}`);
    await dumpCookies(context, 'AFTER BILL-PAY LOGOUT');

    // ── STEP 5: Check main site — is user still logged in? ──────────────────
    await page.bringToFront();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tmp/prod-main-after-billpay-logout.png', fullPage: false });

    const stillLoggedIn = await page.getByRole('button', { name: 'Account options menu' }).isVisible();
    console.log(`\n══ Main site after bill-pay logout: ${stillLoggedIn ? 'STILL LOGGED IN ✗ (bug)' : 'logged out ✓'}`);
    await dumpCookies(context, 'MAIN SITE AFTER BILL-PAY LOGOUT');

    // ── STEP 6: Second visit to bill pay (if main still logged in) ───────────
    if (stillLoggedIn) {
      const billPayItem2 = home.onlineBillPay;
      for (let attempt = 1; attempt <= 3; attempt++) {
        await home.dismissChatWidgetIfPresent();
        await page.waitForTimeout(500);
        await home.userAccount.click();
        try {
          await expect(billPayItem2).toBeVisible({ timeout: 4000 });
          break;
        } catch {
          console.log(`  account menu attempt ${attempt} (visit 2) — retrying…`);
          if (attempt === 3) await expect(billPayItem2).toBeVisible({ timeout: 5000 });
        }
      }

      const billPayHref2 = await billPayItem2.evaluate(
        el => el.getAttribute('href') || el.closest('a')?.getAttribute('href') || '(no href)'
      );
      console.log(`\n══ Bill pay link href — VISIT 2: ${billPayHref2}`);
      console.log(`   href identical to visit 1: ${billPayHref1 === billPayHref2 ? 'YES — no token rotation' : 'NO — href changed'}`);

      context.once('page', newTab => {
        console.log('\n══ NEW TAB opened — VISIT 2 ══');
        attachNetworkLogger(newTab, 'VISIT-2');
      });

      const [tab2] = await Promise.all([
        context.waitForEvent('page'),
        billPayItem2.click(),
      ]);

      await tab2.waitForLoadState('domcontentloaded');
      await tab2.waitForTimeout(3000);
      await tab2.screenshot({ path: 'tmp/prod-visit2.png', fullPage: true });

      const loggedInVisit2 = await tab2.getByRole('link', { name: /Hello,.*My Account/i }).isVisible();
      console.log(`\n══ Bill pay tab URL — VISIT 2: ${tab2.url()}`);
      console.log(`   Logged in on bill pay (visit 2): ${loggedInVisit2 ? 'YES ✓' : 'NO ✗ (bug)'}`);
      await dumpCookies(context, 'AFTER VISIT 2 LOADED');

      // ── STEP 7: Summary ───────────────────────────────────────────────────
      console.log('\n' + '═'.repeat(70));
      console.log('DIAGNOSTIC SUMMARY');
      console.log('═'.repeat(70));
      console.log(`Account used                      : ${PROD_EMAIL}`);
      console.log(`Bill pay href visit 1             : ${billPayHref1}`);
      console.log(`Bill pay href visit 2             : ${billPayHref2}`);
      console.log(`hrefs identical                   : ${billPayHref1 === billPayHref2}`);
      console.log(`Logged in on bill pay — visit 1   : ${loggedInVisit1}`);
      console.log(`Main site still logged in         : ${stillLoggedIn}  ← should be false`);
      console.log(`Logged in on bill pay — visit 2   : ${loggedInVisit2}  ← should be true`);
      console.log('═'.repeat(70));
    }
  } else {
    // Account has unverified phone — document the gate behaviour
    console.log('\n══ Account has unverified phone number.');
    console.log('   Bill pay does not log in this user (likely intentional security gate).');
    console.log('   To test the logout sync bug, use an account with a verified phone number.');
    console.log('   Network calls above show what the bill pay page received on load —');
    console.log('   compare cookies/headers to a phone-verified session to see what is missing.');
    await dumpCookies(context, 'UNVERIFIED ACCOUNT — FINAL STATE');
  }

  console.log('\nScreenshots saved:');
  console.log('  tmp/prod-visit1.png');
  if (loggedInVisit1) {
    console.log('  tmp/prod-after-billpay-logout.png');
    console.log('  tmp/prod-main-after-billpay-logout.png');
    console.log('  tmp/prod-visit2.png');
  }
});
