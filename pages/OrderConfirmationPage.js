const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class OrderConfirmationPage extends BasePage {
    constructor(page) {
        super(page);

        this.heading = page.getByRole('heading', { name: /Your Order is Complete\./i });
    }

    async assertLoaded() {
        await expect(this.page).toHaveURL(/\/order-confirmation/, { timeout: 30000 });
        await expect(this.heading).toBeVisible({ timeout: 30000 });
    }
}

module.exports = OrderConfirmationPage;
