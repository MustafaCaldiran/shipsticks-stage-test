const { request } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

const AUTH_CREDENTIALS = {
    email: 'john@gmail.com',
    password: 'Password',
};

const STORAGE_STATE_PATH = path.resolve(__dirname, '../.auth/storageState.json');

/**
 * Global setup — runs once before the entire test suite.
 *
 * How the API login works:
 * 1. GET /users/sign_in  — Rails renders a login page containing a CSRF token
 *                          in a <meta name="csrf-token"> tag. We grab it here.
 * 2. POST /users/sign_in — Send credentials + CSRF token as a form submission,
 *                          exactly the way the browser does it.
 *                          The server sets session cookies in the response.
 * 3. apiContext.storageState() — Playwright captures all cookies from the HTTP
 *                                session and writes them to .auth/storageState.json.
 * 4. Tests that import from utils/fixtures.js start with that file pre-loaded
 *    into their browser context, so they are already authenticated.
 *
 * This replaces the old UI-based login (launching a browser, clicking through
 * the sign-in modal) — it is faster, more reliable, and has no flakiness risk.
 *
 * The login URL comes from env.apiUrl (config/env.js) so it follows whichever
 * TEST_ENV is active — no hard-coded staging URL in this file.
 */
module.exports = async function globalSetup() {
    const BASE_URL = env.apiUrl;

    console.log(`globalSetup: logging in against ${BASE_URL} (TEST_ENV=${env.testEnv})`);

    // Ensure .auth/ directory exists
    fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

    const apiContext = await request.newContext({
        baseURL: BASE_URL,
        ignoreHTTPSErrors: true,
    });

    // Step 1: GET the login page and extract the CSRF token (retry up to 3 times)
    let csrfToken;
    for (let attempt = 1; attempt <= 3; attempt++) {
        const loginPageResponse = await apiContext.get('/users/sign_in');
        const html = await loginPageResponse.text();
        const csrfMatch = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/);
        if (csrfMatch) {
            csrfToken = csrfMatch[1];
            break;
        }
        if (attempt === 3) {
            // Server is unavailable — skip login; tests that don't need auth will still run.
            console.warn(`globalSetup: ${env.testEnv} server did not return CSRF token after 3 attempts — skipping login. Tests requiring auth may fail.`);
            await apiContext.dispose();
            return;
        }
        await new Promise(r => setTimeout(r, 2000));
    }

    // Step 2: POST credentials with the CSRF token (form-encoded, same as the browser)
    const body = new URLSearchParams({
        utf8: '✓',
        authenticity_token: csrfToken,
        'user[email]': AUTH_CREDENTIALS.email,
        'user[password]': AUTH_CREDENTIALS.password,
        'user[remember_me]': '0',
    });

    const loginResponse = await apiContext.post('/users/sign_in', {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Referer': `${BASE_URL}/users/sign_in`,
        },
        data: body.toString(),
    });

    if (!loginResponse.ok()) {
        console.warn(`globalSetup: login request failed with status ${loginResponse.status()} — skipping session save.`);
        await apiContext.dispose();
        return;
    }

    // Step 3: Save cookies to .auth/storageState.json
    await apiContext.storageState({ path: STORAGE_STATE_PATH });
    await apiContext.dispose();

    console.log(`globalSetup: API login complete, session saved to ${STORAGE_STATE_PATH}`);
};
