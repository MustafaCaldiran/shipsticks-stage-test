const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class HomePage extends BasePage {
    constructor(page, baseUrl) {
        super(page);
        this.baseUrl = baseUrl;

        this.originField = page.getByRole('combobox', { name: 'Where from?' });
        this.destinationField = page.getByRole('combobox', { name: 'Where to?' });
        this.tripTypeButton = page.getByRole('button', { name: /round trip|one way/i });
        this.oneWayOption = page.getByRole('option', { name: 'One way' });
        this.getStartedButton = page.getByRole('button', { name: 'Get started' }).first();
        this.heroHeading = page.getByRole('heading', { name: /Skip Baggage Claim/i });
        this.firstAutocompleteSuggestion = page.getByRole('option').first();

        // Sign in flow locators
        this.signInButton = page.getByText('Sign In')
        this.signInMenuItem = page.getByRole('menuitem', { name: 'Sign In' })

        //Modal elements
        this.loginModalHeading =   page.getByRole('heading', { name: 'Log In' })
        this.shipSticksLogoInModal =   page.getByRole('img', { name: /shipstickstextonlydark/i })
        this.emailFieldInModal =   page.getByPlaceholder('Email address')
        this.passwordFieldInModal =   page.getByRole('textbox', { name: 'Password*' })
        this.loginButtonInModal =   page.getByRole('button', { name: 'Log In' })
        this.forgotPasswordLinkInModal =     page.getByRole('button', { name: 'Forgot password?' })

        this.signUpButtonInModal =   page.getByRole('link', { name: 'Sign up here.' })

        this.signUpHeadingInModal =     page.locator('h2').filter({ hasText: 'Sign Up' }).first()
        this.firstNameFieldInSignUpModal =    page.getByRole('textbox', { name: 'First name*' })
        this.lastNameFieldInSignUpModal =   page.getByRole('textbox', { name: 'Last name*' })
        this.emailFieldInSignUpModal = page.locator('input[name="email"][type="text"]').last()
        this.countryDropdownInSignUpModal = page.locator('[role="dialog"]').getByRole('combobox').filter({ hasValue: /United States|Select/ }).or(page.locator('[role="dialog"]').getByRole('combobox').nth(0))
        this.howDidYouHearAboutUsDropdownInSignUpModal = page.locator('[role="dialog"]').locator('button[aria-haspopup="listbox"]').first()
        this.phoneNumberFieldInSignUpModal = page.getByPlaceholder('555-555-5555')
        this.continueButtonInSignUpModal =     page.getByRole('button', { name: 'Continue to Create Password' })

        this.finishingSignUpHeadingInModal =   page.getByRole('heading', { name: /create.*password|finish.*sign.*up/i })

        this.signUpPasswordField =    page.locator('#password')
        this.confirmSignUpPasswordField =   page.getByRole('textbox', { name: 'Confirm Password*' })
        this.signUpTermsCheckbox =     page.locator("span[id='headlessui-control-_r_al_'] span[class='icon-check flex-shrink-0 w-[17px] h-[17px] transition-colors group-data-[checked]:!text-white group-data-[disabled]:text-neutral-600']")

        this.finishSignUpButton =    page.getByRole('button', { name: /Finish sign up and verify number/i })
        this.verifyYourNumberHeading =  page.getByRole('heading', { name: /Verify your phone number/i })
        this.skipForNowButtonInVerificationStep =   page.getByRole('button', { name: /Skip for now/i })

    }

    //Sign in flow methods
    async clickSignIn() {
        await expect(this.signInButton).toBeVisible();
        await this.signInButton.click();
        await expect(this.signInMenuItem).toBeVisible();
        await this.signInMenuItem.click();
        
    }

    async assertSignInModalVisible() {
        await expect(this.loginModalHeading).toBeVisible();
        await expect(this.shipSticksLogoInModal).toBeVisible();
    }

    async switchToSignUp() {
        await this.signUpButtonInModal.click();
    }

    async assertSignUpModalVisible() {
        await expect(this.signUpHeadingInModal).toBeVisible();
        await expect(this.firstNameFieldInSignUpModal).toBeVisible();
    }

    async selectCountry(country) {
        await this.countryDropdownInSignUpModal.click({ clickCount: 3 });
        await this.countryDropdownInSignUpModal.pressSequentially(country, { delay: 50 });
        await this.page.getByRole('option', { name: country, exact: true }).click({ timeout: 10000 });
        await expect(this.countryDropdownInSignUpModal).toHaveValue(country, { timeout: 10000 });
    }

    async selectHowDidYouHear(optionText) {
        await this.howDidYouHearAboutUsDropdownInSignUpModal.click();
        await this.page.waitForTimeout(500); // Wait for options to appear
        await this.page.getByRole('option', { name: optionText, exact: true }).click();
    }

    async fillSignUpForm({ firstName, lastName, email, country, howDidYouHear, phoneNumber }) {
        await this.typeWithFocusGuard(this.firstNameFieldInSignUpModal, firstName);
        await this.typeWithFocusGuard(this.lastNameFieldInSignUpModal, lastName);
        await this.typeWithFocusGuard(this.emailFieldInSignUpModal, email);
        await this.selectCountry(country);
        await this.selectHowDidYouHear(howDidYouHear);
        await this.typeWithFocusGuard(this.phoneNumberFieldInSignUpModal, phoneNumber);
    }
    
    async clickContinueToCreatePassword() {
        await this.continueButtonInSignUpModal.click();
    }

    async assertFinishingSignUpVisible() {
        await expect(this.finishingSignUpHeadingInModal).toBeVisible();
    }

    async fillPasswordFields(password) {
        await expect(this.signUpPasswordField).toBeVisible({ timeout: 15000 });
        await this.signUpPasswordField.waitFor({ state: 'attached', timeout: 10000 });
        await this.signUpPasswordField.focus();
        await this.signUpPasswordField.pressSequentially(password, { delay: 50 });
        await this.confirmSignUpPasswordField.focus();
        await this.confirmSignUpPasswordField.pressSequentially(password, { delay: 50 });
        await expect(this.signUpTermsCheckbox).toBeVisible({ timeout: 10000 });
        await expect(this.signUpTermsCheckbox).toBeEnabled({ timeout: 10000 });
        await this.signUpTermsCheckbox.click();
        await expect(this.signUpTermsCheckbox).toBeChecked();
        await expect(this.finishSignUpButton).toBeEnabled({ timeout: 10000 });
        await this.finishSignUpButton.click();

    }

    async verifyYourNumber(){
        await expect(this.verifyYourNumberHeading).toBeVisible();
        await expect(this.skipForNowButtonInVerificationStep).toBeVisible();
        await this.skipForNowButtonInVerificationStep.click();
    }

    async assertLoggedIn(userName) {
        const userNameHeading = this.page.locator(`span:has-text("Hi, ${userName}")`);
        await expect(userNameHeading).toBeVisible({ timeout: 15000 });
    }





    async goto() {
        // Inject before any page scripts run - removes chat widget iframe the instant it appears
        await this.page.addInitScript(() => {
            const observer = new MutationObserver(() => {
                document.querySelectorAll(
                    '#launcher, iframe[id*="launcher"], iframe[name*="intercom"], iframe[title*="intercom"], #intercom-container, [class*="intercom-"]'
                ).forEach(el => el.remove());
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
        });
        // Also block at network level as a second layer
        await this.page.route(/intercom|chat-widget|livechat|zendesk|freshchat|crisp|tawk/, route => route.abort());
        await this.navigate(this.baseUrl);
        await this.acceptCookiesIfPresent();
        await expect(this.heroHeading).toBeVisible();
        await expect(this.getStartedButton).toBeDisabled();
    }

    async selectOneWayShipment() {
        await this.tripTypeButton.click();
        await this.oneWayOption.click();
        await expect(this.tripTypeButton).toContainText('One way');
    }

    async fillOriginAddress(address) {
        await this.typeCarefully(this.originField, address);
        await expect(this.firstAutocompleteSuggestion).toBeVisible({ timeout: 15000 });
        await this.firstAutocompleteSuggestion.click();
        await expect(this.originField).not.toHaveValue('');
    }

    async fillDestinationAddress(address) {
        await this.typeCarefully(this.destinationField, address);
        await expect(this.firstAutocompleteSuggestion).toBeVisible({ timeout: 15000 });
        await this.firstAutocompleteSuggestion.click();
        await expect(this.destinationField).not.toHaveValue('');
    }

    async startQuote({ shipmentType, origin, destination }) {
        if (/one[- ]way/i.test(shipmentType)) {
            await this.selectOneWayShipment();
        }

        await this.fillOriginAddress(origin);
        await this.fillDestinationAddress(destination);
        await expect(this.getStartedButton).toBeEnabled();
        await this.getStartedButton.click();
    }


}

module.exports = HomePage;
