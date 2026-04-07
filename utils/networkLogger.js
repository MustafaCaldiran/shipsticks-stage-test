/**
 * utils/networkLogger.js
 *
 * Reusable network logging helpers for Playwright tests.
 *
 * Usage — wrap any block of test steps to capture all ShipSticks
 * network traffic during that block only:
 *
 *   const { withNetworkLogging, dumpCookies } = require('../utils/networkLogger');
 *
 *   await withNetworkLogging(page, 'LOGIN', async () => {
 *     await page.getByRole('button', { name: 'Log In' }).click();
 *     await expect(page.getByRole('button', { name: 'Account options menu' })).toBeVisible();
 *   });
 *
 *   await dumpCookies(context, 'AFTER LOGIN');
 *
 * The label appears in every log line so output from multiple concurrent
 * pages or blocks stays easy to distinguish.
 */

/** Shared handler builders — used by both exported functions. */
function _makeHandlers(label) {
  const requestHandler = req => {
    const url = req.url();
    if (!url.includes('shipsticks')) return;
    const h = req.headers();
    console.log(`\n[${label}][REQ] ${req.method()} ${url}`);
    console.log(`  cookie:        ${(h['cookie'] || '(none)').substring(0, 400)}`);
    console.log(`  authorization: ${h['authorization'] || '(none)'}`);
  };

  const responseHandler = async res => {
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
  };

  return { requestHandler, responseHandler };
}

/**
 * Attach request + response loggers to a page and run the provided callback.
 * Listeners are removed once the callback resolves or throws, so logging is
 * scoped to exactly the steps inside the callback.
 *
 * Use this for steps on an existing page where you want bounded logging:
 *
 *   await withNetworkLogging(page, 'LOGIN', async () => {
 *     await page.getByRole('button', { name: 'Log In' }).click();
 *     await expect(...).toBeVisible();
 *   });
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} label   - Short tag printed in every log line, e.g. 'LOGIN'
 * @param {() => Promise<void>} fn - The test steps to run while logging is active
 */
async function withNetworkLogging(page, label, fn) {
  const { requestHandler, responseHandler } = _makeHandlers(label);

  page.on('request',  requestHandler);
  page.on('response', responseHandler);

  try {
    await fn();
  } finally {
    page.removeListener('request',  requestHandler);
    page.removeListener('response', responseHandler);
  }
}

/**
 * Attach request + response loggers permanently to a page.
 *
 * Use this for new tabs opened by the browser, where you must attach listeners
 * synchronously inside a `context.once('page', ...)` callback before any
 * navigation has started — `withNetworkLogging` cannot be used there because
 * the callback is synchronous and cannot be awaited.
 *
 *   context.once('page', newTab => {
 *     attachNetworkLogging(newTab, 'BILL-PAY-TAB');
 *   });
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} label
 */
function attachNetworkLogging(page, label) {
  const { requestHandler, responseHandler } = _makeHandlers(label);
  page.on('request',  requestHandler);
  page.on('response', responseHandler);
}

/**
 * Print every ShipSticks cookie currently held in the browser context.
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} label - Heading printed above the cookie dump
 */
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

module.exports = { withNetworkLogging, attachNetworkLogging, dumpCookies };
