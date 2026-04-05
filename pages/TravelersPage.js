const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class TravelersPage extends BasePage {
    constructor(page) {
        super(page);

        this.heading = page.getByRole('heading', { name: 'Traveler Details' });
        this.addressField = page.getByRole('combobox', { name: 'Address*' }).first();
        this.cityField = page.getByRole('textbox', { name: /City\*/i });
        this.stateField = page.getByRole('combobox', { name: /Choose state/i });
        this.zipField = page.getByRole('textbox', { name: /Zip code\*/i });
        this.nextButton = page.locator('span').filter({ hasText: 'Next: Package and Protection' }).first();
    }

    travelerNameLocator(firstName, lastName) {
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        return this.page.locator(`(//div[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'),'${fullName}')])[1]`);
    }

    async assertLoaded() {
        await expect(this.page).toHaveURL(/\/book\/travelers/);
        await expect(this.heading).toBeVisible();
    }

    async assertTravelerName(firstName, lastName) {
        await expect(this.travelerNameLocator(firstName, lastName)).toBeVisible();
    }

    async assertAddressFields({ streetAddress, city, state, zip }) {
        if (streetAddress) {
            await expect(this.addressField).toHaveValue(new RegExp(streetAddress, 'i'));
        }
        if (city) {
            await expect(this.cityField).toHaveValue(new RegExp(city, 'i'));
        }
        if (state) {
            await expect(this.stateField).toHaveValue(new RegExp(state, 'i'));
        }
        if (zip) {
            await expect(this.zipField).toHaveValue(new RegExp(zip, 'i'));
        }
    }

    async proceedToPackageAndProtection() {
        await expect(this.nextButton).toBeVisible();
        await this.nextButton.click();
    }
}

module.exports = TravelersPage;
