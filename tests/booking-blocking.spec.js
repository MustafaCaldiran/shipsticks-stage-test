const { test, expect } = require('@playwright/test');
const BookingStep1Page = require('../pages/BookingStep1Page');

test.describe('Ship Sticks environment guardrails', () => {
  test('surfaces bot protection as an explicit failure reason', async ({ page, baseURL }) => {
    const bookingPage = new BookingStep1Page(page, baseURL);

    let error;
    try {
      await bookingPage.goto();
    } catch (caughtError) {
      error = caughtError;
    }

    if (error) {
      await expect(String(error.message)).toContain('bot protection');
      return;
    }

    await expect(bookingPage.shippingOptionsHeading).toBeVisible();
  });
});
