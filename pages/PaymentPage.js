const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class PaymentPage extends BasePage {
    constructor(page) {
        super(page);

        this.heading = page.getByRole('heading', { name: /Additional Options & Payment Details/i });
        this.coverageDropdown = page.getByRole('button', { name: /Coverage amount\*/i });
        this.haveThemPickedUpOption = page.getByText('Have them picked up');
        this.dropThemOffOption = page.getByText('Bring your bags to a FedEx location.');
        this.pickupFeeValue = page.locator("//span[normalize-space()='Pickup Fee']/following-sibling::span");

        this.creditCardNumber = page.getByRole('textbox', { name: /Card number\*/i });
        this.expirationDate = page.getByRole('textbox', { name: /Expiration date\*/i });
        this.cvc = page.getByRole('textbox', { name: /CVC\*/i });
        this.billingCountryButton = page.getByRole('button', { name: 'United States of America' });
        this.billingZip = page.getByRole('textbox', { name: /Billing zip code\*/i });
        this.cardFirstName = page.getByRole('textbox', { name: /First name\*/i });
        this.cardLastName = page.getByRole('textbox', { name: /Last name\*/i });
        this.nextReviewOrderButton = page.locator('span').filter({ hasText: 'Next: Review Order' }).first();

    }

    async assertLoaded() {
        await expect(this.page).toHaveURL(/\/book\/pay/, { timeout: 30000 });
        await expect(this.heading).toBeVisible({ timeout: 30000 });
    }

    async selectCoverageAmount(coverageText) {
        await this.coverageDropdown.click();
        await this.page.getByText(coverageText, { exact: true }).click();
    }

    async selectPickupMethod(method) {
        if (method === 'haveThemPickedUp') {
            await this.haveThemPickedUpOption.click();
        } else {
            await this.dropThemOffOption.click();
        }
    }

    async assertPickupFee(method) {
        if (method === 'haveThemPickedUp') {
            // The fee shown on the option label
            const feeFromLabel = await this.page
                .locator("//span[normalize-space()='Have them picked up']/following::span[contains(text(),'$')][1]")
                .textContent();
            await expect(this.pickupFeeValue).toHaveText(feeFromLabel.trim());
        } else {
            await expect(this.pickupFeeValue).toHaveText('$0.00');
        }
    }

    async fillCreditCard({ firstName, lastName, cardNumber, expirationDate, cvc, billingCountry, zipCode }) {
        await this.cardFirstName.fill(firstName);
        await this.cardLastName.fill(lastName);
        await this.creditCardNumber.fill(cardNumber);
        await this.expirationDate.fill(expirationDate);
        await this.cvc.fill(cvc);

        // Billing country — open dropdown then click the exact option
        await this.billingCountryButton.click();
        await this.page.getByText(billingCountry, { exact: true }).click();

        // Zip code is optional — some countries don't have it
        try {
            await this.billingZip.waitFor({ state: 'visible', timeout: 5000 });
            await this.billingZip.fill(zipCode);
        } catch {
            // Field not present for this country, skip
        }
    }

    async proceedToReviewOrder() {
        await expect(this.nextReviewOrderButton).toBeVisible();
        await this.nextReviewOrderButton.click();
    }
}

module.exports = PaymentPage;
