const { expect } = require('@playwright/test');

class BasePage {
    constructor(page) {
        this.page = page;
    }

    async navigate(url) {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    async typeCarefully(locator, text, options = {}) {
        const { delay = 50, clearFirst = true } = options;

        await locator.click();
        if (clearFirst) await locator.fill('');

        for (const char of text) {
            await this.page.keyboard.type(char, { delay });
        }
    }

    async waitForElement(locator, timeout = 10000) {
        await locator.waitFor({ state: 'visible', timeout });
    }

    async waitForAutocomplete(timeout = 15000) {
        return this.page.waitForSelector('[role="listbox"], .pac-container, [data-testid*="autocomplete"]',
            { timeout });
    }

    async waitForAutocompleteOption(textOrRegex, timeout = 15000) {
        await this.waitForAutocomplete(timeout);
        await expect(
            this.page.getByRole('option').filter({ hasText: textOrRegex }).first()
        ).toBeVisible({ timeout });
    }

    async dismissCountryNoteIfPresent(timeout = 8000) {
        try {
            const btn = this.page.getByRole('button', { name: 'I understand' });
            await btn.waitFor({ state: 'visible', timeout });
            await btn.click();
            await btn.waitFor({ state: 'hidden', timeout: 5000 });
            await expect(this.page.locator('#headlessui-portal-root')).toBeEmpty({ timeout: 3000 }).catch(() => { });
        } catch {
        }
    }

    async acceptCookiesIfPresent(timeout = 5000) {
        try {
            const acceptBtn = this.page.getByRole('button', { name: /accept all cookies/i });
            await acceptBtn.waitFor({ state: 'visible', timeout });
            await acceptBtn.click();
            await acceptBtn.waitFor({ state: 'hidden', timeout: 3000 });
        } catch {
        }
    }

    async typeWithFocusGuard(locator, text) {
        for (let attempt = 0; attempt < 3; attempt++) {
            await locator.click();
            await locator.fill('');
            await locator.pressSequentially(text, { delay: 50 });
            const value = await locator.inputValue();
            if (value === text) return;
            // Focus was stolen - remove any interfering iframes and retry
            await this.dismissChatWidgetIfPresent();
        }
        // Final assertion to fail with a clear message if all retries exhausted
        await expect(locator).toHaveValue(text, { timeout: 5000 });
    }

    async dismissChatWidgetIfPresent() {
        try {
            await this.page.evaluate(() => {
                // Remove existing chat widget elements
                const selectors = '#launcher, iframe[id*="launcher"], iframe[name*="intercom"], iframe[title*="chat"], #intercom-container, [class*="intercom"]';
                document.querySelectorAll(selectors).forEach(el => el.remove());
                // Set up observer to auto-remove if it reappears
                if (!window.__chatObserver) {
                    window.__chatObserver = new MutationObserver((mutations) => {
                        document.querySelectorAll(selectors).forEach(el => el.remove());
                    });
                    window.__chatObserver.observe(document.body, { childList: true, subtree: true });
                }
            });
        } catch {
        }
    }
}

module.exports = BasePage;
