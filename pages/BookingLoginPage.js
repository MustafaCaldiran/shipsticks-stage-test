const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class BookingLoginPage extends BasePage {
    constructor(page)  {
        super(page);

        this.loginHeading = page.getByRole('heading', { name: 'Account Login' });
        this.orderSummaryHeading = page.getByRole('heading', { name: 'Order Summary' });
        this.summaryShipmentDate = page.locator('[aria-label="ShipmentDate"]').last();
        this.summaryShipmentCities = page.locator('[aria-label="ShipmentCity"]');
        this.summaryPaymentItems = page.locator('[aria-label="PaymentSummaryItem"]');
    }

    async assertLoaded() {
        await expect(this.page).toHaveURL(/\/book\/login/);
        await expect(this.loginHeading).toBeVisible();
    }

    async getSummaryShipmentDateText() {
        return (await this.summaryShipmentDate.textContent())?.trim();
    }

    async getSummaryOriginCityText() {
        return (await this.summaryShipmentCities.first().textContent())?.trim();
    }

    async getSummaryDestinationCityText() {
        return (await this.summaryShipmentCities.nth(1).textContent())?.trim();
    }

    async assertSummaryShipmentDate(dateString) {
        await expect(this.summaryShipmentDate).toHaveText(this.formatSummaryDate(dateString));
    }

    async assertSummaryOriginCity(address) {
        await expect(this.summaryShipmentCities.first()).toHaveText(this.extractCityState(address));
    }

    async assertSummaryDestinationCity(address) {
        await expect(this.summaryShipmentCities.nth(1)).toHaveText(this.extractCityState(address));
    }

    async assertSummaryItem(itemLabel) {
        await expect(
            this.summaryPaymentItems.filter({ hasText: itemLabel })
        ).toBeVisible();
    }

    async expandShippingAccordion() {
        const shippingAccordion = this.page.getByRole('button', { name: 'Shipping' });
        try {
            await shippingAccordion.waitFor({ state: 'visible', timeout: 3000 });
            await shippingAccordion.click();
            await expect(this.summaryPaymentItems.first()).toBeVisible({ timeout: 5000 });
        } catch {
        }
    }

    async assertSummaryMatchesChallenge({
        deliveryDate,
        origin,
        destination,
        items = [],
    }) {
        await this.assertSummaryShipmentDate(deliveryDate);
        await this.assertSummaryOriginCity(origin);
        await this.assertSummaryDestinationCity(destination);

        if (items.length > 0) {
            await this.expandShippingAccordion();
            for (const item of items) {
                await this.assertSummaryItem(item);
            }
        }
    }

    buildSummaryItemLabel(itemCategory, itemSize, itemIndex = 1) {
        return `${itemCategory} #${itemIndex} (${itemSize})`;
    }

    extractCityState(address) {
        const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
        if (parts.length < 3) {
            throw new Error(`Unsupported address format: ${address}`);
        }

        return `${parts[1]}, ${parts[2]}`;
    }

    normalizeDateLabel(dateString) {
        const match = dateString.match(/([A-Za-z]+,\s+)?([A-Za-z]+\s+\d{1,2},\s+\d{4})/);
        if (!match) {
            throw new Error(`Unsupported date format: ${dateString}`);
        }

        return match[2];
    }

    formatSummaryDate(dateString) {
        const normalizedDate = this.normalizeDateLabel(dateString);
        const date = new Date(`${normalizedDate} 12:00:00`);
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];

        const dayName = weekdays[date.getDay()];
        const monthName = months[date.getMonth()];
        const day = String(date.getDate()).padStart(2, '0');

        return `${dayName}, ${monthName} ${day}`;
    }
}

module.exports = BookingLoginPage;
