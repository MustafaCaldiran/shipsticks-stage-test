const { test, expect } = require('@playwright/test');
const HomePage = require('../pages/HomePage');
const BookingStep1Page = require('../pages/BookingStep1Page');
const BookingLoginPage = require('../pages/BookingLoginPage');
const testData = require('../utils/testData');

const selectedScenarioNames = (process.env.SCENARIOS || '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

test.describe('Ship Sticks booking flow', () => {
  for (const [scenarioName, scenario] of testData.getScenarioEntries(selectedScenarioNames)) {
    test(`completes Step 1 happy path with page objects [${scenarioName}]`, async ({ page, baseURL }) => {
      const homePage = new HomePage(page, baseURL);
      const bookingPage = new BookingStep1Page(page, baseURL);
      const loginPage = new BookingLoginPage(page);

      await homePage.goto();
      await homePage.startQuote({
        shipmentType: scenario.shipmentType,
        origin: scenario.origin,
        destination: scenario.destination,
      });
      await bookingPage.assertLoaded();
      await bookingPage.dismissWeatherWarningIfPresent();

      const challengeItems = bookingPage.getChallengeItems(scenario);
      await bookingPage.configureItems(challengeItems);
      await bookingPage.selectDeliveryDate(scenario.deliveryDate);
      await bookingPage.selectShippingMethod(scenario.serviceLevel);

      await bookingPage.proceedToNextStep();
      await loginPage.assertLoaded();
      await loginPage.assertSummaryMatchesChallenge({
        deliveryDate: scenario.deliveryDate,
        origin: scenario.origin,
        destination: scenario.destination,
        items: challengeItems.flatMap((item) =>
          item.sizes.map((size, index) =>
            loginPage.buildSummaryItemLabel(item.category, size, index + 1)
          )
        ),
      });
    });
  }

  test('requires completed fields before moving to traveler details', async ({ page, baseURL }) => {
    const homePage = new HomePage(page, baseURL);

    await homePage.goto();
    await expect(homePage.getStartedButton).toBeDisabled();
    await expect(homePage.originField).toBeVisible();
  });
});
