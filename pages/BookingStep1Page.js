const BasePage = require('./BasePage');
const { expect } = require('@playwright/test');

class BookingStep1Page extends BasePage {
    constructor(page, baseUrl) {
        super(page);
        this.baseUrl = baseUrl;
        this.serviceLevelLabels = {
            Ground: 'Ground',
            'Three Day Express': 'Three Day Express',
            'Next Day Express': 'Next Day Express',
            'Second Day Express': 'Second Day Express',
        };

        this.tripTypeButton = page.getByRole('button', { name: /round trip|one way/i });
        this.oneWayOption = page.getByRole('option', { name: 'One way' });

        this.originField = page.getByRole('combobox', { name: 'Where from?' });
        this.destinationField = page.getByRole('combobox', { name: 'Where to?' });
        this.autocompleteListbox = page.locator('[role="listbox"]');
        this.firstAutocompleteSuggestion = page.getByRole('option').first();
        this.weatherWarning = page.getByText('Please note before proceeding');
        this.weatherWarningDismissButton = page.getByRole('button', { name: 'I understand' });

        this.saveButton = page.getByRole('button', { name: 'Save' });
        this.selectDateButton = page.getByRole('button', { name: 'Please select a date' });
        this.dateButton = page.getByRole('button', { name: /please select a date|[a-z]{3} \d{1,2}, \d{4}/i });
        this.showMoreOptionsButton = page.getByRole('button', { name: /Show More Options/i });

        this.nextButton = page.getByRole('button', { name: 'Next: Traveler Details' }).first();

        this.shippingOptionsHeading = page.getByRole('heading', { name: 'Shipping Options' });
        this.shipmentSpeedsHeading = page.getByRole('heading', { name: 'Shipment Speeds' });
        this.orderSummary = page.getByRole('heading', { name: 'Order Summary' });
    }

    async goto() {
        await this.navigate(`${this.baseUrl}/book/ship`);
        await this.acceptCookiesIfPresent();
        await this.assertLoaded();
    }

    async assertLoaded() {
        const currentUrl = this.page.url();
        if (/validate\.perfdrive\.com|shieldsquare/i.test(currentUrl)) {
            throw new Error(
                `Navigation was blocked by Ship Sticks bot protection at ${currentUrl}. ` +
                'The test runner is reaching a CAPTCHA page instead of the booking flow.'
            );
        }
        await expect(this.shippingOptionsHeading).toBeVisible();
        await this.acceptCookiesIfPresent();
    }

    async dismissWeatherWarningIfPresent() {
        try {
            await this.weatherWarningDismissButton.waitFor({ state: 'visible', timeout: 5000 });
            await this.weatherWarningDismissButton.click();
            await this.weatherWarningDismissButton.waitFor({ state: 'hidden', timeout: 5000 });
        } catch {
        }
    }


    async selectOneWayShipment() {
        await this.tripTypeButton.click();
        await this.oneWayOption.click();
        await expect(this.tripTypeButton).toContainText('One way');
    }

    async fillOriginAddress(address) {
        await this.originField.fill(address);
        await this.waitForAutocomplete();
        await this.firstAutocompleteSuggestion.click();
        await expect(this.originField).not.toHaveValue('');
    }

    async fillDestinationAddress(address) {
        await this.destinationField.fill(address);
        await this.waitForAutocomplete();
        await this.firstAutocompleteSuggestion.click();
        await expect(this.destinationField).not.toHaveValue('');
    }

    async saveAddresses() {
        try {
            await this.saveButton.waitFor({ state: 'visible', timeout: 5000 });
            await expect(this.saveButton).toBeEnabled();
            await this.saveButton.click();
        } catch {
        }
        await this.dismissCountryNoteIfPresent();
    }

    async selectDeliveryDate(dateString) {
        await expect(this.selectDateButton).toBeEnabled({ timeout: 5000 });
        await this.selectDateButton.click();

        const calendarPanel = this.page.locator('[role="grid"]').locator('..').first();
        const nextMonthButton = calendarPanel.getByRole('button').nth(1);
        const normalizedDate = this.normalizeDateLabel(dateString);
        const dateParts = normalizedDate.match(/([A-Za-z]+)\s+\d+,\s+(\d{4})/);
        const targetMonthName = dateParts[1];
        const targetYear = dateParts[2];

        for (let index = 0; index < 36; index += 1) {
            const monthLabel = await calendarPanel.locator('text=/[A-Za-z]+ \\d{4}/').first().textContent();
            if (monthLabel && monthLabel.includes(targetMonthName) && monthLabel.includes(targetYear)) {
                break;
            }
            await nextMonthButton.click();
        }

        await expect(calendarPanel.getByText(`${targetMonthName} ${targetYear}`)).toBeVisible();
        await this.page.getByRole('gridcell', { name: normalizedDate }).click();
        const shortMonth = targetMonthName.slice(0, 3);
        const dayNumber = normalizedDate.match(/\d+/)[0];
        await expect(this.dateButton).toHaveText(new RegExp(`${shortMonth} ${dayNumber}, ${targetYear}`, 'i'));
        await expect(this.shipmentSpeedsHeading).toBeVisible();
    }

    async selectShippingMethod(serviceLevel) {
        await expect(this.shipmentSpeedsHeading).toBeVisible({ timeout: 10000 });
        const resolvedServiceLevel = this.resolveServiceLevelLabel(serviceLevel);

        await expect(
            this.page.getByText(/Ground/i).first()
        ).toBeVisible({ timeout: 30000 });

        if (/Second Day Express/i.test(resolvedServiceLevel)) {
            await this.showMoreShippingOptionsIfPresent();
            await expect(
                this.page.getByText(new RegExp(resolvedServiceLevel, 'i')).first()
            ).toBeVisible({ timeout: 10000 });
        }

        const serviceRadio = this.page
            .getByRole('radio', { name: new RegExp(resolvedServiceLevel, 'i') })
            .first();

        await expect(serviceRadio).toBeVisible({ timeout: 10000 });
        await serviceRadio.click();
        await expect(serviceRadio).toBeChecked();
    }

    async showMoreShippingOptionsIfPresent() {
        try {
            await this.showMoreOptionsButton.waitFor({ state: 'visible', timeout: 5000 });
            await this.showMoreOptionsButton.click();
        } catch {
        }
    }

    async addItem(itemCategory, quantity = 1) {
        const increaseButton = this.page.getByRole('button', {
            name: new RegExp(`Increase ${this.escapeRegex(itemCategory)} count`, 'i'),
        });

        await this.page.getByRole('heading', { name: 'Item Details' }).scrollIntoViewIfNeeded();
        for (let index = 0; index < quantity; index += 1) {
            await expect(increaseButton).toBeEnabled();
            await increaseButton.click();
        }

        await expect(this.orderSummary).toBeVisible();
    }

    async selectItemSize(itemCategory, sizeLabel, itemIndex = 1) {
        const itemLabelText = `${itemCategory} #${itemIndex}`;
        
        // Wait for DOM to be stable after adding items
        await this.page.waitForTimeout(500);
        
        // Use a more specific locator to avoid strict mode violations
        const itemSection = this.page
            .getByText(itemLabelText, { exact: true })
            .locator('..')
            .first();  // Take the first match to avoid strict mode violation

        // Wait for the item section to be stable
        await expect(itemSection).toBeVisible({ timeout: 10000 });
        
        const sizeButton = itemSection.getByRole('button', {
            name: new RegExp(this.escapeRegex(sizeLabel), 'i'),
        });

        // Wait for the size button to be attached and visible before scrolling
        await expect(sizeButton).toBeVisible({ timeout: 10000 });
        await expect(sizeButton).toBeAttached();
        
        try {
            await sizeButton.scrollIntoViewIfNeeded();
        } catch (error) {
            // If element becomes detached, try once more with fresh locator
            const freshSizeButton = this.page
                .getByText(itemLabelText, { exact: true })
                .locator('..')
                .first()  // Take the first match to avoid strict mode violation
                .getByRole('button', {
                    name: new RegExp(this.escapeRegex(sizeLabel), 'i'),
                });
            await expect(freshSizeButton).toBeVisible({ timeout: 5000 });
            await freshSizeButton.scrollIntoViewIfNeeded();
            await freshSizeButton.click();
            return;
        }
        
        await sizeButton.click();
    }

    async configureItems(itemConfigs) {
        const normalizedItems = this.normalizeItemConfigs(itemConfigs);

        for (const item of normalizedItems) {
            await this.addItem(item.category, item.quantity);

            for (let index = 0; index < item.sizes.length; index += 1) {
                await this.selectItemSize(item.category, item.sizes[index], index + 1);
            }
        }
    }

    normalizeItemConfigs(itemConfigs) {
        return itemConfigs.map((item) => {
            const sizes = item.sizes
                ?? (item.size ? Array(item.quantity || 1).fill(item.size) : []);
            const quantity = item.quantity || sizes.length || 1;

            if (sizes.length !== quantity) {
                throw new Error(
                    `Item config mismatch for ${item.category}: quantity=${quantity}, sizes=${sizes.length}`
                );
            }

            return {
                category: item.category,
                quantity,
                sizes,
            };
        });
    }

    getChallengeItems(challenge) {
        if (Array.isArray(challenge.items) && challenge.items.length > 0) {
            return this.normalizeItemConfigs(challenge.items);
        }

        return this.normalizeItemConfigs([
            {
                category: challenge.itemCategory,
                quantity: 1,
                sizes: [challenge.itemSize],
            },
        ]);
    }

    async proceedToNextStep() {
        await expect(this.nextButton).toBeEnabled();
        await this.nextButton.click();
    }

    async getOriginValue() {
        return this.originField.inputValue();
    }

    async getDestinationValue() {
        return this.destinationField.inputValue();
    }

    normalizeDateLabel(dateString) {
        const match = dateString.match(/([A-Za-z]+,\s+)?([A-Za-z]+\s+\d{1,2},\s+\d{4})/);
        if (!match) {
            throw new Error(`Unsupported date format: ${dateString}`);
        }

        return match[2];
    }

    resolveServiceLevelLabel(serviceLevel) {
        const resolvedLabel = this.serviceLevelLabels[serviceLevel];
        if (!resolvedLabel) {
            throw new Error(`Unsupported service level: ${serviceLevel}`);
        }

        return resolvedLabel;
    }

    escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

module.exports = BookingStep1Page;
