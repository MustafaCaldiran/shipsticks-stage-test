const { test } = require('@playwright/test');
const path = require('path');
const HomePage = require('../pages/HomePage');
const BookingStep1Page = require('../pages/BookingStep1Page');
const testData = require('../utils/testData');
const { withNetworkCapture, saveNetworkCapture } = require('../utils/networkCapture');

const OUT_FILE = path.resolve(__dirname, '../tmp/network-capture.json');

test.describe('Network Capture', () => {
  // ── Flow 1: Sign-up / create user ──
  test('CAPTURE sign-up flow', async ({ page, baseURL }) => {
    const home = new HomePage(page, baseURL);

    const log = await withNetworkCapture(page, async () => {
      await home.goto();
      await home.clickSignIn();
      await home.assertSignInModalVisible();
      await home.switchToSignUp();
      await home.assertSignUpModalVisible();
      await home.fillSignUpForm(testData.authData.signUp);
      await home.clickContinueToCreatePassword();
      await home.fillPasswordFields(testData.authData.signUp.password);
      await home.skipVerifyYourNumber();
      await home.assertLoggedIn(testData.authData.signUp.firstName);
    });

    saveNetworkCapture(OUT_FILE, 'sign_up_flow', log);
    console.log('✅ Sign-up capture written to', OUT_FILE);
  });

  // ── Flow 2: Booking step 1 ──
  test('CAPTURE booking step 1 flow', async ({ page, baseURL }) => {
    const home = new HomePage(page, baseURL);
    const booking = new BookingStep1Page(page, baseURL);
    const scenario = testData.scenarios.challenge;

    const log = await withNetworkCapture(page, async () => {
      await home.goto();
      await home.startQuote({
        shipmentType: scenario.shipmentType,
        origin: scenario.origin,
        destination: scenario.destination,
      });
      await booking.assertLoaded();
      await booking.dismissWeatherWarningIfPresent();
      const items = booking.getChallengeItems(scenario);
      await booking.configureItems(items);
      await booking.selectDeliveryDate(scenario.deliveryDate);
      await booking.selectShippingMethod(scenario.serviceLevel);
      await booking.proceedToNextStep();
    });

    saveNetworkCapture(OUT_FILE, 'booking_step1_flow', log);
    console.log('✅ Booking capture written to', OUT_FILE);
  });
});
