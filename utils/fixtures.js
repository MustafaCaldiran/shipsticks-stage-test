const { test: base } = require('@playwright/test');
const path = require('path');

const STORAGE_STATE_PATH = path.resolve(__dirname, '../.auth/storageState.json');

/**
 * `authenticatedTest` — same as `test` but the browser context is pre-loaded
 * with the saved auth session from globalSetup. Use this when you want to start
 * a test already logged in without going through the sign-up / login flow.
 *
 * Usage:
 *   const { test } = require('../utils/fixtures');
 *   test('my test', async ({ page, baseURL }) => { ... });
 */
const test = base.extend({
    storageState: STORAGE_STATE_PATH,
});

module.exports = { test };
