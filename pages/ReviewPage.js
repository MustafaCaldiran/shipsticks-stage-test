const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class ReviewPage extends BasePage {
    constructor(page) {
        super(page);

        this.heading = page.getByRole('heading', { name: 'Additional Options & Payment Details' });
    }

    async assertLoaded() {
        await expect(this.page).toHaveURL(/\/book\/review/, { timeout: 30000 });
        await expect(this.heading).toBeVisible({ timeout: 30000 });
    }

    async assertBillingCountry(country) {
        const countryText = this.heading
            .locator('..')
            .getByText(country);
        await expect(countryText).toBeVisible();
    }

    async assertCoverageText(coverageAmount) {
        // coverageAmount e.g. '$2,500.00 ($8.99)' → extract the dollar value before the space
        const match = coverageAmount.match(/\$([\d,]+)/);
        const upToAmount = match ? `$${match[1]}` : coverageAmount;
        const coverageText = this.page.getByText(`Covers up to ${upToAmount}`);
        await expect(coverageText).toBeVisible();
    }

    async confirmAndPay() {
        await this.page.locator('button').filter({ hasText: 'Confirm and Pay' }).first().click();
    }
}

module.exports = ReviewPage;
