const { test, expect } = require('@playwright/test');
const HomePage = require('../pages/HomePage');
const testData = require('../utils/testData');

test.describe('Ship Sticks login flow', () => {
    test('opens login modal when Sign In is clicked', async ({ page, baseURL }) => {
        const homePage = new HomePage(page, baseURL);

        await homePage.goto();
        await homePage.clickSignIn();
        await homePage.assertSignInModalVisible();

        await homePage.switchToSignUp();
        await homePage.assertSignUpModalVisible();

        await homePage.fillSignUpForm(testData.authData.signUp);
        await homePage.clickContinueToCreatePassword();

        await homePage.fillPasswordFields(testData.authData.signUp.password);

        await homePage.skipVerifyYourNumber();
        await homePage.assertLoggedIn(testData.authData.signUp.firstName);
    });
})
