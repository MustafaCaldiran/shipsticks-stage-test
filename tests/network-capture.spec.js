 
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const HomePage = require('../pages/HomePage');
const BookingStep1Page = require('../pages/BookingStep1Page');
const testData = require('../utils/testData');

const OUT_FILE = path.resolve(__dirname, '../tmp/network-capture.json');

function isApiCall(url) {
  return (
    !url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)(\?|$)/) &&
    !url.includes('google-analytics') &&
    !url.includes('intercom') &&
    !url.includes('hotjar') &&
    !url.includes('segment')
  );
}

function saveCapture(key, entries) {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  let data = {};
  if (fs.existsSync(OUT_FILE)) {
    try { data = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); } catch {}
  }
  data[key] = entries;
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2));
}

test.describe('Network Capture', () => {
  // ── Flow 1: Sign-up / create user ──
  test('CAPTURE sign-up flow', async ({ page, baseURL }) => {
    const log = [];

    page.on('request', req => {
      if (!isApiCall(req.url())) return;
      log.push({ dir: 'REQ', method: req.method(), url: req.url(), postData: req.postData() || null });
    });

    page.on('response', async res => {
      if (!isApiCall(res.url())) return;
      let body = null;
      try { body = await res.json(); } catch {
        try { body = (await res.text()).slice(0, 800); } catch {}
      }
      log.push({ dir: 'RES', method: res.request().method(), url: res.url(), status: res.status(), body });
    });

    const home = new HomePage(page, baseURL);
    await home.goto();
    await home.clickSignIn();
    await home.assertSignInModalVisible();
    await home.switchToSignUp();
    await home.assertSignUpModalVisible();
    await home.fillSignUpForm(testData.authData.signUp);
    await home.clickContinueToCreatePassword();
    await home.fillPasswordFields(testData.authData.signUp.password);
    await home.verifyYourNumber();
    await home.assertLoggedIn(testData.authData.signUp.firstName);

    saveCapture('sign_up_flow', log);
    console.log('✅ Sign-up capture written to', OUT_FILE);
  });

  // ── Flow 2: Booking step 1 ──
  test('CAPTURE booking step 1 flow', async ({ page, baseURL }) => {
    const log = [];

    page.on('request', req => {
      if (!isApiCall(req.url())) return;
      log.push({ dir: 'REQ', method: req.method(), url: req.url(), postData: req.postData() || null });
    });

    page.on('response', async res => {
      if (!isApiCall(res.url())) return;
      let body = null;
      try { body = await res.json(); } catch {
        try { body = (await res.text()).slice(0, 800); } catch {}
      }
      log.push({ dir: 'RES', method: res.request().method(), url: res.url(), status: res.status(), body });
    });

    const home = new HomePage(page, baseURL);
    const booking = new BookingStep1Page(page, baseURL);
    const scenario = testData.scenarios.challenge;

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

    saveCapture('booking_step1_flow', log);
    console.log('✅ Booking capture written to', OUT_FILE);
  });
});