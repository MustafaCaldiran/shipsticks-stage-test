const { test, expect } = require('@playwright/test');
const BookingStep1Page = require('../pages/BookingStep1Page');
const TravelersPage = require('../pages/TravelersPage');
const PaymentPage = require('../pages/PaymentPage');
const ReviewPage = require('../pages/ReviewPage');
const OrderConfirmationPage = require('../pages/OrderConfirmationPage');
const testData = require('../utils/testData');
const { createUserViaUi } = require('../utils/createUser');

const scenario = testData.scenarios.challenge;

test.describe('Ship Sticks E2E flow', () => {
    test('sign up then complete booking step 1', async ({ page, baseURL }) => {
        const bookingPage = new BookingStep1Page(page, baseURL);
        const travelersPage = new TravelersPage(page);
        const paymentPage = new PaymentPage(page);
        const reviewPage = new ReviewPage(page);
        const orderConfirmationPage = new OrderConfirmationPage(page);

        // ── Sign up ──────────────────────────────────────────────────────────
        const { homePage, ...signUpData } = await createUserViaUi(page, baseURL);

        // ── Start a quote (fills Where from / Where to) ──────────────────────
        await homePage.startQuote({
            shipmentType: scenario.shipmentType,
            origin: scenario.origin,
            destination: scenario.destination,
        });

        // ── Booking Step 1 ───────────────────────────────────────────────────
        await bookingPage.assertLoaded();
        await bookingPage.dismissWeatherWarningIfPresent();

        const challengeItems = bookingPage.getChallengeItems(scenario);
        await bookingPage.configureItems(challengeItems);
        await bookingPage.selectDeliveryDate(scenario.deliveryDate);
        await bookingPage.selectShippingMethod(scenario.serviceLevel);

       

        // ── Proceed to Traveler Details ───────────────────────────────────────
        await bookingPage.proceedToNextStep();

        await travelersPage.assertLoaded();
        await travelersPage.assertTravelerName(signUpData.firstName, signUpData.lastName);
        await travelersPage.assertAddressFields({ streetAddress: scenario.origin.split(',')[0].split(' ').slice(0, 2).join(' ') });

        await travelersPage.proceedToPackageAndProtection();

        // ── Payment Page ──────────────────────────────────────────────────────
        await paymentPage.assertLoaded();
        await paymentPage.selectCoverageAmount(scenario.coverageAmount);
        await paymentPage.selectPickupMethod(scenario.pickupMethod);
        await paymentPage.assertPickupFee(scenario.pickupMethod);
        await paymentPage.fillCreditCard(testData.authData.payment);
       
        await paymentPage.proceedToReviewOrder();

        // ── Review Page ──────────────────────────────────────────────────────
        await reviewPage.assertLoaded();
        await reviewPage.assertBillingCountry(testData.authData.payment.billingCountry);
        await reviewPage.assertCoverageText(scenario.coverageAmount);
        await reviewPage.confirmAndPay();

        // ── Order Confirmation ───────────────────────────────────────────────
        await orderConfirmationPage.assertLoaded();

        await page.pause();
    });
});
