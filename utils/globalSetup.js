const { chromium } = require('@playwright/test');
const path = require('path');

const AUTH_CREDENTIALS = {
    email: 'john@gmail.com',
    password: 'Password',
};

const STORAGE_STATE_PATH = path.resolve(__dirname, '../.auth/storageState.json');

module.exports = async function globalSetup() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    // Block chat widgets to avoid interference
    await page.route(/intercom|chat-widget|livechat|zendesk|freshchat|crisp|tawk/, route => route.abort());

    await page.goto('https://app.staging.shipsticks.com', { waitUntil: 'domcontentloaded' });

    // Accept cookies if present
    try {
        const cookieBtn = page.getByRole('button', { name: /accept|allow/i });
        await cookieBtn.click({ timeout: 5000 });
    } catch { }

    // Open Sign In menu
    await page.getByText('Sign In').click();
    await page.getByRole('menuitem', { name: 'Sign In' }).click();

    // Fill login modal
    await page.getByPlaceholder('Email address').fill(AUTH_CREDENTIALS.email);
    await page.getByRole('textbox', { name: 'Password*' }).fill(AUTH_CREDENTIALS.password);
    await page.getByRole('button', { name: 'Log In' }).click();

    // Wait until logged in (header shows user name)
    await page.waitForSelector('span[class*="Hi,"]', { timeout: 25000 }).catch(() =>
        page.waitForURL(/(?!.*login)/, { timeout: 25000 })
    );

    // Save full storage state (cookies + localStorage)
    await context.storageState({ path: STORAGE_STATE_PATH });

    await browser.close();
};
