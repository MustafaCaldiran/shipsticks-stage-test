# Ship Sticks Interview Study Guide

This file is a study guide for the Ship Sticks interview based on the actual code in this repository and the take-home challenge PDF.

It is designed to help you explain:

- what the challenge asked for
- what this project actually does
- why the framework is structured this way
- how the code flows end to end
- what questions they are likely to ask
- how to answer those questions clearly

---

## 1. What the Take-Home Challenge Asked For

From the PDF:

- use **Playwright for Python**
- automate **Step 1 of the booking flow only**
- use the fixed challenge data
- assert that **Step 1 is complete and ready to proceed to Step 2**
- include a config file with base URL
- handle at least one async/timing concern explicitly
- include meaningful assertions beyond URL checks
- provide a Loom and a repo/README

### Important mismatch to be ready for

Your current implementation is:

- **JavaScript Playwright Test**, not Python
- it goes **past Step 1** and verifies the next page `/book/login`

This is the single most important interview risk. Do not get surprised by it.

Best framing:

> I chose the language and framework variant I could implement most confidently and explain clearly under time pressure. I focused on automation quality, locator stability, and flow coverage. I also extended the test slightly past Step 1 to verify that the data entered in Step 1 persisted correctly into the next page. If I were aligning strictly to the literal prompt, I would stop earlier and assert readiness to proceed without navigating forward.

---

## 2. What This Project Actually Is

This project is a **Playwright Test framework** for the **Ship Sticks booking flow**.

Main purpose:

- start a quote from the homepage
- enter Step 1 booking data
- configure items
- choose a date
- select shipping speed
- proceed to the next page
- verify order summary details

Main architecture:

- Playwright config in [`playwright.config.js`](./playwright.config.js)
- runtime env in [`config/env.js`](./config/env.js)
- page objects in [`pages`](./pages)
- tests in [`tests`](./tests)
- scenario data in [`utils/testData.js`](./utils/testData.js)

---

## 3. The Big Interview Story You Should Be Able To Say

Memorize this as your 45-second summary:

> This is a Playwright Test automation framework for the Ship Sticks booking flow. I structured it using Page Object Model with a shared `BasePage`, page-specific classes for the homepage, Step 1 booking page, and the login/order summary page, and scenario-driven test data in `utils/testData.js`. The main test starts from the homepage quote widget, enters the challenge shipment details, completes Step 1, moves to the next page, and verifies that the order summary reflects the entered data. I also added an environment guardrail test to make anti-bot blocking explicit rather than letting the suite fail with an unclear error.

Longer version:

> I used Playwright Test because it gives strong built-in fixtures, assertions, retries, reporting, browser projects, traces, screenshots, and videos. I used `getByRole` and other accessible locators where possible to make selectors more resilient and user-centered. I separated the flow into page objects to keep the test readable and maintainable. I also handled real asynchronous concerns such as autocomplete loading, date picker rendering, conditional modals, and environment instability. The biggest improvement I would make is aligning more strictly with the original prompt by stopping after Step 1 is complete and reducing the few remaining fixed waits.

---

## 4. Files You Must Know Cold

These are the files you should be able to explain without hesitation.

### 4.1 [`package.json`](./package.json)

Why it matters:

- tells how the project runs
- shows this is **Playwright Test**, not a custom runner

Important part:

```json
{
  "scripts": {
    "test": "playwright test",
    "test:headed": "HEADED=true playwright test",
    "test:debug": "HEADED=true SLOW_MO=300 playwright test --debug",
    "test:ci": "playwright test --reporter=html,line",
    "test:parallel": "WORKERS=4 FULLY_PARALLEL=true playwright test",
    "test:chromium": "BROWSERS=chromium playwright test",
    "test:firefox": "BROWSERS=firefox playwright test",
    "test:webkit": "BROWSERS=webkit playwright test",
    "test:all-browsers": "BROWSERS=chromium,firefox,webkit playwright test"
  }
}
```

What to say:

- the project supports normal, headed, debug, CI, parallel, and browser-specific runs
- browser selection is done through env vars
- the framework is CI-oriented, not just local

Likely question:

**Q: How do you run this project in different browsers?**  
**A:** I use the `BROWSERS` environment variable and Playwright projects. For convenience, `package.json` also exposes scripts like `test:chromium`, `test:firefox`, and `test:webkit`.

---

### 4.2 [`playwright.config.js`](./playwright.config.js)

Why it matters:

- this is the execution backbone of the framework

Code:

```js
const { defineConfig, devices } = require('@playwright/test');
const env = require('./config/env');

const browserProjects = {
  chromium: {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  firefox: {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  webkit: {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
};
```

What this does:

- imports Playwright config helpers
- imports runtime environment config
- maps browser names to device presets

Next section:

```js
const requestedBrowsers = (process.env.BROWSERS || 'chromium')
  .split(',')
  .map((browser) => browser.trim())
  .filter(Boolean);
```

What this does:

- reads `BROWSERS`
- defaults to `chromium`
- supports comma-separated browser selection

Main config:

```js
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: process.env.FULLY_PARALLEL === 'true',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : (process.env.CI ? 1 : undefined),
  timeout: env.timeout,
  expect: {
    timeout: env.timeout,
  },
  reporter: [['html', { open: 'never' }], ['line']],
  use: {
    baseURL: env.baseUrl,
    headless: !env.headed,
    slowMo: env.slowMo,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
    },
  },
```

What to say line by line:

- `testDir` points Playwright to the `tests` folder
- `fullyParallel` can be turned on by env var
- `forbidOnly` protects CI from accidentally committed `.only`
- `retries` increases resilience in CI
- `workers` can be controlled explicitly or defaults to safer CI behavior
- `timeout` and `expect.timeout` come from env config
- reporters include HTML and line output
- `baseURL` is centralized
- headless/headed mode is controlled by env
- `slowMo` supports debugging
- screenshot, trace, and video settings help failure triage

Project section:

```js
  projects: requestedBrowsers.map((browser) => {
    const project = browserProjects[browser];
    if (!project) {
      throw new Error(`Unsupported browser project: ${browser}`);
    }

    return project;
  }),
});
```

What this does:

- only enables the browsers the user requested
- fails fast if an unsupported name is passed

Likely questions:

**Q: Why use Playwright projects?**  
**A:** They let me run the same suite across Chromium, Firefox, and WebKit without duplicating test logic.

**Q: Why keep `baseURL` in config instead of hardcoding?**  
**A:** The prompt asked for config-driven base URLs, and it also makes the framework portable across staging or other environments.

**Q: Why traces/videos/screenshots?**  
**A:** They make failures diagnosable in CI and are especially useful for flaky UI flows like date pickers and autocomplete.

---

### 4.3 [`config/env.js`](./config/env.js)

Why it matters:

- central runtime values
- proves the framework supports `.env`

Code:

```js
require('dotenv').config();

module.exports = {
  baseUrl: process.env.BASE_URL || 'https://app.staging.shipsticks.com',
  headed: process.env.HEADED === 'true',
  slowMo: parseInt(process.env.SLOW_MO || '0', 10),
  timeout: parseInt(process.env.TIMEOUT || '60000', 10),
  testData: {
    shipmentType: 'One way',
    origin: '1234 Main Street, Los Angeles, CA, USA',
    destination: '4321 Main St, Miami Lakes, FL, USA',
    itemType: 'Golf Bag (Standard)',
    serviceLevel: 'Ground',
    deliveryDate: 'April 8, 2026',
  }
};
```

What to say:

- `dotenv` loads `.env` from project root if present
- the framework still works without `.env` because it has defaults
- the timeout and headed mode are controlled centrally here
- there is also a business test data object, though the main suite primarily uses `utils/testData.js`

Likely question:

**Q: Where are your environment settings configured?**  
**A:** In `config/env.js`, with `.env` support through `dotenv`.

Likely follow-up:

**Q: Why do you have test data in both `env.js` and `utils/testData.js`?**  
**A:** `utils/testData.js` is the real scenario source for the main suite. The `testData` object in `env.js` is more like a runtime default/reference and could be consolidated later for clarity.

---

### 4.4 [`utils/testData.js`](./utils/testData.js)

Why it matters:

- drives the scenario model

Key code:

```js
const scenarios = {
    challenge: {
        shipmentType: 'One-way',
        origin: '1234 Main Street, Los Angeles, CA, USA',
        destination: '4321 Main St, Miami Lakes, FL, USA',
        itemType: 'Golf Bag (Standard)',
        itemCategory: 'Golf Bags',
        itemSize: 'Standard',
        items: [
            {
                category: 'Golf Bags',
                quantity: 1,
                sizes: ['Standard'],
            },
        ],
        serviceLevel: 'Ground',
        deliveryDate: 'Wednesday, April 8, 2026',
    },
```

What to say:

- `challenge` is the canonical take-home scenario
- the file also supports additional scenarios like `two_golf_bags_ground`
- this is what makes the test scalable beyond one hardcoded example

Important helper:

```js
getScenarioEntries(selectedScenarioNames = []) {
    const requestedNames = selectedScenarioNames.filter(Boolean);

    if (requestedNames.length === 0) {
        return Object.entries(this.scenarios);
    }

    return requestedNames.map((name) => {
        const scenario = this.scenarios[name];
        if (!scenario) {
            throw new Error(`Unknown scenario: ${name}`);
        }

        return [name, scenario];
    });
},
```

What to say:

- if no scenario is specified, all scenarios run
- if `SCENARIOS` is specified, only those run
- invalid scenario names fail explicitly

Likely question:

**Q: Why not just hardcode the challenge values directly in the test?**  
**A:** I wanted the test flow reusable. Scenario-driven data lets me keep the test logic stable while varying inputs cleanly.

---

### 4.5 [`pages/BasePage.js`](./pages/BasePage.js)

Why it matters:

- common actions and synchronization helpers live here

Code:

```js
const { expect } = require('@playwright/test');

class BasePage {
    constructor(page) {
        this.page = page;
    }

    async navigate(url) {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    }
```

Line-by-line explanation:

- import `expect` because base helpers also perform visibility/assertion logic
- constructor stores the shared Playwright `page`
- `navigate()` centralizes page navigation
- using `waitUntil: 'domcontentloaded'` avoids acting too early

Typing helper:

```js
    async typeCarefully(locator, text, options = {}) {
        const { delay = 50, clearFirst = true } = options;

        await locator.click();
        if (clearFirst) await locator.fill('');

        for (const char of text) {
            await this.page.keyboard.type(char, { delay });
        }
    }
```

What to say:

- this is a fine-grained input helper
- it is useful when UI widgets react better to slower typing than bulk `fill()`
- it improves stability with dynamic/autocomplete inputs

Autocomplete helper:

```js
    async waitForAutocomplete(timeout = 15000) {
        return this.page.waitForSelector('[role="listbox"], .pac-container, [data-testid*="autocomplete"]',
            { timeout });
    }
```

Why this is good:

- it handles multiple possible autocomplete implementations
- it explicitly addresses the async concern the take-home asked about

Optional UI handlers:

```js
    async dismissCountryNoteIfPresent(timeout = 8000) {
        try {
            const btn = this.page.getByRole('button', { name: 'I understand' });
            await btn.waitFor({ state: 'visible', timeout });
            await btn.click();
            await btn.waitFor({ state: 'hidden', timeout: 5000 });
            await expect(this.page.locator('#headlessui-portal-root')).toBeEmpty({ timeout: 3000 }).catch(() => { });
        } catch {
        }
    }

    async acceptCookiesIfPresent(timeout = 5000) {
        try {
            const acceptBtn = this.page.getByRole('button', { name: /accept all cookies/i });
            await acceptBtn.waitFor({ state: 'visible', timeout });
            await acceptBtn.click();
            await acceptBtn.waitFor({ state: 'hidden', timeout: 3000 });
        } catch {
        }
    }
```

What to say:

- these are defensive helpers for conditional UI
- they reduce false failures caused by cookies or transient informational overlays
- they show practical QA judgment for staging environments

Likely question:

**Q: Why use a BasePage?**  
**A:** It keeps common behavior in one place and avoids repeating navigation, waiting, and modal-dismiss logic across all page objects.

---

### 4.6 [`pages/HomePage.js`](./pages/HomePage.js)

Why it matters:

- this is the first business page in the flow

Constructor:

```js
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
    }
```

What to say:

- locators are mostly `getByRole`, which is intentional
- the names reflect visible UI labels, which improves readability and resilience

`goto()`:

```js
    async goto() {
        await this.navigate(this.baseUrl);
        await this.acceptCookiesIfPresent();
        await expect(this.heroHeading).toBeVisible();
        await expect(this.getStartedButton).toBeDisabled();
    }
```

Line-by-line:

- navigate to base URL from config
- clear cookie banner if present
- assert key homepage hero content is visible
- assert quote flow cannot start before required fields are filled

`selectOneWayShipment()`:

```js
    async selectOneWayShipment() {
        await this.tripTypeButton.click();
        await this.oneWayOption.click();
        await expect(this.tripTypeButton).toContainText('One way');
    }
```

What to say:

- it changes the shipment type through the UI
- it validates visible state, not just the click event

`fillOriginAddress()`:

```js
    async fillOriginAddress(address) {
        await this.originField.fill(address);
        await expect(this.firstAutocompleteSuggestion).toBeVisible({ timeout: 15000 });
        await this.firstAutocompleteSuggestion.click();
        await expect(this.originField).not.toHaveValue('');
    }
```

What to say:

- fill origin
- wait for autocomplete suggestion
- pick the first option
- verify field accepted a value

`fillDestinationAddress()`:

```js
    async fillDestinationAddress(address) {
        await this.destinationField.fill(address);
        
        // Add a small delay to allow autocomplete to load
        await this.page.waitForTimeout(1000);
        
        try {
            await expect(this.firstAutocompleteSuggestion).toBeVisible({ timeout: 15000 });
            await this.firstAutocompleteSuggestion.click();
        } catch (error) {
            // If autocomplete doesn't appear, try typing more characters to trigger it
            await this.destinationField.fill('');
            await this.destinationField.type(address, { delay: 100 });
            await this.page.waitForTimeout(2000);
            await expect(this.firstAutocompleteSuggestion).toBeVisible({ timeout: 10000 });
            await this.firstAutocompleteSuggestion.click();
        }
        
        await expect(this.destinationField).not.toHaveValue('');
    }
```

This is one of the most likely code-review interview topics.

How to explain it:

- destination autocomplete was less stable in practice
- first attempt uses normal `fill()`
- if autocomplete does not appear, fallback retypes with delay to trigger suggestions more naturally
- final assertion confirms the field accepted a value

Potential critique:

- it uses fixed waits
- you should admit this

Best answer:

> I used a pragmatic fallback because the autocomplete was unstable in staging. The next improvement would be replacing fixed waits with a more deterministic signal, such as waiting for the listbox or a specific suggestion text.

`startQuote()`:

```js
    async startQuote({ shipmentType, origin, destination }) {
        if (/one[- ]way/i.test(shipmentType)) {
            await this.selectOneWayShipment();
        }

        await this.fillOriginAddress(origin);
        await this.fillDestinationAddress(destination);
        await expect(this.getStartedButton).toBeEnabled();
        await this.getStartedButton.click();
    }
```

What to say:

- this is the business entry method
- it takes business data and drives the homepage
- it verifies readiness before clicking `Get started`

Likely question:

**Q: Why wrap everything in `startQuote()` instead of keeping it in the test?**  
**A:** Because the homepage quote widget is one business action. Grouping it into one method makes the test more readable and isolates UI details inside the page object.

---

### 4.7 [`pages/BookingStep1Page.js`](./pages/BookingStep1Page.js)

This is the most important file in the project.

#### Constructor and locators

Key part:

```js
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
```

What to say:

- all important Step 1 controls are centralized in the constructor
- most locators use accessible names
- regex is used when button text may vary by state

#### `goto()`

```js
    async goto() {
        await this.navigate(`${this.baseUrl}/book/ship`);
        await this.acceptCookiesIfPresent();
        await this.assertLoaded();
    }
```

This directly opens the Step 1 page.

#### `assertLoaded()`

```js
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
```

This is a very strong part of the framework.

How to explain it:

- after navigation, the code checks whether the run was redirected to bot protection
- if so, it throws a meaningful error instead of letting later element waits fail vaguely
- if not blocked, it asserts the expected page heading

Likely question:

**Q: Why did you add bot-protection detection?**  
**A:** Because the prompt explicitly says staging environments can be unpredictable. I wanted a failure to tell me whether the problem was my test logic or the environment.

#### `dismissWeatherWarningIfPresent()`

```js
    async dismissWeatherWarningIfPresent() {
        try {
            await this.weatherWarningDismissButton.waitFor({ state: 'visible', timeout: 5000 });
            await this.weatherWarningDismissButton.click();
            await this.weatherWarningDismissButton.waitFor({ state: 'hidden', timeout: 5000 });
        } catch {
        }
    }
```

What to say:

- defensive handling for optional UI
- avoids false negatives from non-core blocking popups

#### Address methods

```js
    async fillOriginAddress(address) {
        await this.originField.fill(address);
        await this.waitForAutocomplete();
        await this.firstAutocompleteSuggestion.click();
        await expect(this.originField).not.toHaveValue('');
    }
```

Same explanation as homepage:

- fill
- wait for async suggestion
- select it
- verify accepted

#### `saveAddresses()`

```js
    async saveAddresses() {
        try {
            await this.saveButton.waitFor({ state: 'visible', timeout: 5000 });
            await expect(this.saveButton).toBeEnabled();
            await this.saveButton.click();
        } catch {
        }
        await this.dismissCountryNoteIfPresent();
    }
```

Honest note:

- this method exists but is not called by the main `booking.spec.js` flow
- if they notice that, say it is support logic for variants of the flow and could be removed if unused

#### `selectDeliveryDate()`

Code:

```js
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
```

How to explain this line by line:

- ensure the date picker button is interactable
- open the calendar
- locate the calendar panel
- locate the next-month button
- normalize input date format
- extract target month and year
- loop through months until target month/year is visible
- click the target date cell
- verify the chosen date appears on the button
- verify the next section (`Shipment Speeds`) is now visible

Likely question:

**Q: Why did you normalize the date string?**  
**A:** The input data and UI display format are not identical. I normalize the date before using it in locators and assertions so the test matches the actual calendar UI.

#### `selectShippingMethod()`

```js
    async selectShippingMethod(serviceLevel) {
        await expect(this.shipmentSpeedsHeading).toBeVisible({ timeout: 10000 });
        const resolvedServiceLevel = this.resolveServiceLevelLabel(serviceLevel);

        await expect(
            this.page.getByText(/Ground/i).first()
        ).toBeVisible({ timeout: 15000 });

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
```

What to say:

- it waits for the shipment speeds section
- it maps the business name to an expected label
- it supports hidden/expanded options
- it selects the shipping radio and verifies selection

Likely question:

**Q: Why verify `toBeChecked()` after clicking?**  
**A:** Because it confirms the business state actually changed, not just that the click executed.

#### `addItem()` and `selectItemSize()`

`addItem()`:

```js
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
```

What to say:

- locates the item increment control dynamically based on category
- scrolls to the item section if needed
- clicks the plus button the requested number of times
- verifies order summary is visible afterward

`selectItemSize()` is more involved:

```js
    async selectItemSize(itemCategory, sizeLabel, itemIndex = 1) {
        const itemLabelText = `${itemCategory} #${itemIndex}`;
        
        await this.page.waitForTimeout(500);
        
        const itemSection = this.page
            .getByText(itemLabelText, { exact: true })
            .locator('..')
            .first();

        await expect(itemSection).toBeVisible({ timeout: 10000 });
        
        const sizeButton = itemSection.getByRole('button', {
            name: new RegExp(this.escapeRegex(sizeLabel), 'i'),
        });

        await expect(sizeButton).toBeVisible({ timeout: 10000 });
        await expect(sizeButton).toBeAttached();
        
        try {
            await sizeButton.scrollIntoViewIfNeeded();
        } catch (error) {
            const freshSizeButton = this.page
                .getByText(itemLabelText, { exact: true })
                .locator('..')
                .first()
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
```

How to explain this honestly:

- this method had to deal with DOM instability and strict mode locator issues
- it waits briefly after adding items
- it finds the specific item section by exact label
- it scopes the size button inside that section
- it handles element detachment by rebuilding the locator once and retrying

Best explanation:

> This method is the most defensive one in the framework. I added the retry path because the DOM around dynamic item selection was unstable, and I wanted the locator to be re-resolved if the element detached before interaction.

Potential critique:

- fixed wait
- manual parent traversal
- could be improved with more deterministic app-level signals

Be ready to admit all of that.

#### `configureItems()`

```js
    async configureItems(itemConfigs) {
        const normalizedItems = this.normalizeItemConfigs(itemConfigs);

        for (const item of normalizedItems) {
            await this.addItem(item.category, item.quantity);

            for (let index = 0; index < item.sizes.length; index += 1) {
                await this.selectItemSize(item.category, item.sizes[index], index + 1);
            }
        }
    }
```

What to say:

- normalize data first
- add quantity
- then assign sizes item by item

#### `normalizeItemConfigs()` and `getChallengeItems()`

These methods are very interview-worthy because they show framework thinking.

`normalizeItemConfigs()`:

```js
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
```

What to say:

- it supports multiple input shapes
- it validates quantity-size consistency
- it creates one predictable normalized model for the rest of the flow

`getChallengeItems()`:

```js
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
```

What to say:

- if `items` already exists, use it
- otherwise convert simpler challenge properties into normalized item config

Likely question:

**Q: Why put data normalization inside the page object?**  
**A:** Because the UI interaction logic depends on a specific normalized item structure. I wanted the test to stay clean and pass business-level data into the page object rather than reshaping it in the test itself.

#### `proceedToNextStep()`

```js
    async proceedToNextStep() {
        await expect(this.nextButton).toBeEnabled();
        await this.nextButton.click();
    }
```

What to say:

- readiness is asserted before navigation forward
- this is the point where Step 1 is effectively treated as complete

Important challenge-related point:

The original prompt said the test should **end once Step 1 is complete and ready to proceed to Step 2**.  
Your code clicks through to the next page. If asked:

> I treated successful transition to the next page as a stronger proof that Step 1 was complete, but I understand that the literal prompt was to stop before crossing that boundary.

---

### 4.8 [`pages/BookingLoginPage.js`](./pages/BookingLoginPage.js)

Why it matters:

- validates data carry-over to the next page

Constructor:

```js
this.loginHeading = page.getByRole('heading', { name: 'Account Login' });
this.orderSummaryHeading = page.getByRole('heading', { name: 'Order Summary' });
this.summaryShipmentDate = page.locator('[aria-label="ShipmentDate"]').last();
this.summaryShipmentCities = page.locator('[aria-label="ShipmentCity"]');
this.summaryPaymentItems = page.locator('[aria-label="PaymentSummaryItem"]');
```

What to say:

- this page object uses aria-label locators because the summary area appears to expose stable semantic labels there
- it combines headings and summary data locators

`assertLoaded()`:

```js
    async assertLoaded() {
        await expect(this.page).toHaveURL(/\/book\/login/);
        await expect(this.loginHeading).toBeVisible();
    }
```

What to say:

- verifies route and page identity

Summary assertions:

```js
    async assertSummaryShipmentDate(dateString) {
        await expect(this.summaryShipmentDate).toHaveText(this.formatSummaryDate(dateString));
    }

    async assertSummaryOriginCity(address) {
        await expect(this.summaryShipmentCities.first()).toHaveText(this.extractCityState(address));
    }

    async assertSummaryDestinationCity(address) {
        await expect(this.summaryShipmentCities.nth(1)).toHaveText(this.extractCityState(address));
    }
```

What to say:

- the page object transforms input data into UI display format before asserting
- this is important because raw challenge data does not exactly match display formatting

`assertSummaryItem()`:

```js
    async assertSummaryItem(itemLabel) {
        await expect(
            this.summaryPaymentItems.filter({ hasText: itemLabel })
        ).toBeVisible();
    }
```

What to say:

- it finds a summary item by text filter and asserts it exists

`expandShippingAccordion()`:

```js
    async expandShippingAccordion() {
        const shippingAccordion = this.page.getByRole('button', { name: 'Shipping' });
        try {
            await shippingAccordion.waitFor({ state: 'visible', timeout: 3000 });
            await shippingAccordion.click();
            await expect(this.summaryPaymentItems.first()).toBeVisible({ timeout: 5000 });
        } catch {
        }
    }
```

What to say:

- summary items may be hidden inside an accordion
- this helper makes item assertions resilient to collapsed state

`assertSummaryMatchesChallenge()`:

```js
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
```

What to say:

- this is the main cross-page continuity assertion
- it verifies that Step 1 data persisted

Formatting helpers:

```js
    extractCityState(address) {
        const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
        if (parts.length < 3) {
            throw new Error(`Unsupported address format: ${address}`);
        }

        return `${parts[1]}, ${parts[2]}`;
    }
```

and

```js
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
```

What to say:

- the UI summary format is not the same as the challenge input format
- the page object transforms raw input into expected display text before asserting

Likely question:

**Q: Why add these formatting methods instead of asserting raw values directly?**  
**A:** Because the displayed summary text is transformed by the application. Good tests assert what the user actually sees, not what the test data originally looked like.

---

### 4.9 [`tests/booking.spec.js`](./tests/booking.spec.js)

This is your main story file. Know it in detail.

Code:

```js
const { test, expect } = require('@playwright/test');
const HomePage = require('../pages/HomePage');
const BookingStep1Page = require('../pages/BookingStep1Page');
const BookingLoginPage = require('../pages/BookingLoginPage');
const testData = require('../utils/testData');
```

What this means:

- import Playwright test runner and assertion API
- import the three page objects used in the flow
- import scenario data

Scenario selection:

```js
const selectedScenarioNames = (process.env.SCENARIOS || '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
```

What to say:

- allows running one or many scenarios from env vars

Main describe:

```js
test.describe('Ship Sticks booking flow', () => {
  for (const [scenarioName, scenario] of testData.getScenarioEntries(selectedScenarioNames)) {
```

What to say:

- creates one test per selected scenario
- this is dynamic but still readable because the test title includes the scenario name

Main happy-path test:

```js
    test(`completes Step 1 happy path with page objects [${scenarioName}]`, async ({ page, baseURL }) => {
      const homePage = new HomePage(page, baseURL);
      const bookingPage = new BookingStep1Page(page, baseURL);
      const loginPage = new BookingLoginPage(page);
```

What to say:

- Playwright injects `page` and `baseURL`
- one shared page is passed to all page objects
- page objects follow the user journey order

Homepage start:

```js
      await homePage.goto();
      await homePage.startQuote({
        shipmentType: scenario.shipmentType,
        origin: scenario.origin,
        destination: scenario.destination,
      });
```

What to say:

- open homepage
- enter quote data from scenario
- click into booking flow

Step 1 load:

```js
      await bookingPage.assertLoaded();
      await bookingPage.dismissWeatherWarningIfPresent();
```

What to say:

- verify page load
- handle optional warning UI

Item flow:

```js
      const challengeItems = bookingPage.getChallengeItems(scenario);
      await bookingPage.configureItems(challengeItems);
      await bookingPage.selectDeliveryDate(scenario.deliveryDate);
      await bookingPage.selectShippingMethod(scenario.serviceLevel);
```

What to say:

- normalize business item data
- configure items in the UI
- select delivery date
- choose shipping speed

Next step:

```js
      await bookingPage.proceedToNextStep();
      await loginPage.assertLoaded();
```

What to say:

- Step 1 completion is treated as proven by successful transition
- this is also where you diverged from the literal prompt

Cross-page verification:

```js
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
```

What to say:

- this is the strongest business assertion in the test
- it checks that the summary preserves the chosen data
- the `flatMap` builds the exact expected item labels for the summary section

Second test:

```js
  test('requires completed fields before moving to traveler details', async ({ page, baseURL }) => {
    const homePage = new HomePage(page, baseURL);

    await homePage.goto();
    await expect(homePage.getStartedButton).toBeDisabled();
    await expect(homePage.originField).toBeVisible();
  });
```

What to say:

- this is a smaller guard assertion
- verifies the homepage enforces required fields before progression

Likely question:

**Q: What are your meaningful assertions beyond URL checks?**  
**A:** Examples include `Get started` initially disabled, origin/destination fields receiving selected values, date button text updating, shipment speeds becoming visible, shipping radio being checked, login page heading visibility, summary date/city/item verification, and required-field gating.

---

### 4.10 [`tests/booking-blocking.spec.js`](./tests/booking-blocking.spec.js)

Why it matters:

- this shows practical QA judgment

Code:

```js
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
```

What to say:

- this test intentionally distinguishes test failures from environment blocking
- if automation is blocked, it proves the error is understood
- if not blocked, it still verifies the page is reachable

Likely question:

**Q: Why create a separate test for this instead of handling it only inside the main flow?**  
**A:** Because environment health is a separate concern. I wanted a fast, explicit signal that the environment itself was accessible before diagnosing business-flow failures.

---

## 5. Exact End-to-End Flow of the Code

This is the code flow you should be able to narrate out loud.

1. `npm test` runs `playwright test`
2. Playwright loads [`playwright.config.js`](./playwright.config.js)
3. Config loads runtime values from [`config/env.js`](./config/env.js)
4. Browser projects are selected using `BROWSERS`
5. Playwright finds tests under [`tests`](./tests)
6. [`tests/booking.spec.js`](./tests/booking.spec.js) loads scenarios from [`utils/testData.js`](./utils/testData.js)
7. Playwright injects `page` and `baseURL`
8. The test constructs `HomePage`, `BookingStep1Page`, and `BookingLoginPage`
9. `HomePage.goto()` opens the homepage and clears cookies if needed
10. `HomePage.startQuote()` selects one-way, fills addresses, waits for autocomplete, enables `Get started`, and clicks it
11. `BookingStep1Page.assertLoaded()` confirms the booking page loaded and detects bot-protection redirects
12. `dismissWeatherWarningIfPresent()` clears optional blocking UI
13. `getChallengeItems()` normalizes scenario item data
14. `configureItems()` adds items and selects sizes
15. `selectDeliveryDate()` opens the calendar, navigates to the right month, and chooses the target date
16. `selectShippingMethod()` chooses the target shipment speed
17. `proceedToNextStep()` clicks the Next button
18. `BookingLoginPage.assertLoaded()` confirms the login/summary page is open
19. `assertSummaryMatchesChallenge()` verifies that the data entered earlier appears correctly in the summary

---

## 6. Most Likely Interview Questions and Strong Answers

### Q1. Walk me through your framework design.

**Answer:**

I used Playwright Test with a Page Object Model. The framework has a shared `BasePage` for navigation, waiting, autocomplete handling, and optional modal dismissal. The main business pages are `HomePage`, `BookingStep1Page`, and `BookingLoginPage`. Test data is scenario-driven from `utils/testData.js`, and browser/runtime behavior is configured in `playwright.config.js` and `config/env.js`. The main test drives the homepage quote flow into Step 1, configures the shipment, proceeds forward, and verifies summary continuity on the next page.

### Q2. Why did you choose Page Object Model?

**Answer:**

Because the booking flow spans multiple pages and many UI actions. POM keeps the test readable and isolates selectors and UI logic inside page classes. It also makes maintenance easier if the DOM changes.

### Q3. Why did you choose these locators?

**Answer:**

I prioritized `getByRole` and accessible names because they are more stable and closer to how a user experiences the page. For summary data, I used aria-label-based locators where the UI exposed stable semantic markers. I used regex locators where control labels can vary slightly by state.

### Q4. How did you handle async/timing issues?

**Answer:**

The biggest async concerns were address autocomplete, dynamic date picker rendering, modal overlays, and DOM updates during item configuration. I added explicit waits for autocomplete, page-ready headings, state transitions, and selected control states. I also included optional modal dismissal helpers. There are still a few fixed waits in the framework, and I would replace those with more deterministic waits as a next improvement.

### Q5. Why did you add the bot-protection guardrail?

**Answer:**

Because the prompt explicitly acknowledged environment unpredictability. I wanted failures to be meaningful. If the test lands on anti-bot infrastructure instead of the booking page, that is not the same type of failure as a broken locator or broken business flow. The guardrail makes that distinction clear.

### Q6. How does your test prove Step 1 is complete?

**Answer:**

The test proves readiness through multiple conditions: required homepage gating, successful address selection, item configuration, date selection, shipping method selection, and the Next button becoming clickable. In my implementation, I then navigate forward and verify that the data appears correctly on the login/summary page, which I treated as a stronger proof of successful Step 1 completion.

### Q7. Why did you continue to the login page when the prompt said stop after Step 1?

**Answer:**

I made a judgment call to strengthen the business assertion by verifying that the Step 1 data persisted correctly into the next page. If I were aligning strictly to the prompt, I would stop after asserting the Next button is enabled and Step 1 is ready to proceed.

### Q8. Why JavaScript instead of Python?

**Answer:**

I chose the version of Playwright I could implement most quickly, cleanly, and confidently under time pressure. My goal was to maximize framework quality and explainability. That said, I understand the prompt explicitly asked for Python, and if strict prompt compliance were the primary goal, I would implement the same design in Python.

### Q9. What are the top three risks in this flow?

**Answer:**

1. Address autocomplete timing and suggestion rendering.  
2. Date picker behavior and date availability.  
3. Staging environment instability, including anti-bot protection or conditional UI overlays.

### Q10. What would you improve next?

**Answer:**

I would tighten prompt alignment by stopping after Step 1 completion, reduce fixed waits, add clearer locator-choice comments near complex locators, and expand coverage for negative scenarios like invalid addresses or unavailable date/service combinations.

### Q11. What parts of the framework are strongest?

**Answer:**

The strongest parts are the POM structure, Playwright config, scenario-driven data model, accessible locator strategy, and explicit environment guardrail handling.

### Q12. What parts are weakest?

**Answer:**

The main weaknesses are the JavaScript-vs-Python mismatch, the fact that the flow goes beyond the strict prompt boundary, and the few remaining `waitForTimeout()` stabilizers.

### Q13. How would you make this more CI-friendly?

**Answer:**

I already added retries, HTML reporting, screenshots, videos, and traces in Playwright config, plus a GitHub workflow. The next steps would be better environment tagging, more deterministic waiting, and clearer separation between environment failures and business-flow failures.

### Q14. Why did you put data normalization in the page object?

**Answer:**

Because the UI interaction methods require a normalized structure, and I wanted the test to remain business-focused rather than reshaping item data manually.

### Q15. If this started failing tomorrow, where would you look first?

**Answer:**

First I would determine whether the environment is blocked or reachable. Then I would check the failure artifacts: trace, video, screenshot, and line output. In this flow, the most likely breakpoints are autocomplete, dynamic item selection, date picker navigation, or shipping-speed visibility.

---

## 7. Questions They May Ask Specifically About Your Choices

### “Why did you write `startQuote()` this way?”

Answer:

- because homepage quote submission is one business action
- the test should read like a user story, not a series of low-level clicks
- this also keeps homepage locator details out of the test body

### “Why did you use `getByRole` instead of CSS selectors?”

Answer:

- accessible locators are generally more stable
- they reflect the user-facing contract of the UI
- they make the intent of the test clearer

### “Why did you use `.first()` in some locators?”

Answer:

- because some controls had multiple matches in the DOM
- I wanted a stable primary candidate while scoping by role/name as much as possible
- I would tighten scoping further if the DOM stabilized more

### “Why did you use a fallback path in destination autocomplete?”

Answer:

- because the destination field behaved less consistently in staging
- I wanted the test to recover when normal fill did not trigger suggestions
- the improvement would be to replace time-based fallback with a more app-specific deterministic signal

### “Why did you use regex in several locators?”

Answer:

- because text formatting or state labels may vary slightly
- regex makes the locator more tolerant without losing intent

### “Why did you verify summary data on the login page?”

Answer:

- because successful carry-over of user-selected data is a strong business validation
- it proves the flow preserved the inputs beyond just making the button clickable

---

## 8. How To Explain the Exact Code Flow in Simple Language

Use this when they ask you to “walk through the code.”

> The test starts by creating page objects for the homepage, Step 1 booking page, and login/summary page. It opens the homepage, clears cookies if necessary, and confirms that the quote can’t start before required fields are filled. Then it selects one-way shipping, fills origin and destination with autocomplete handling, and clicks Get Started. On the booking page, it first verifies that the run wasn’t redirected to bot protection. Then it dismisses any weather warning, configures the shipment items based on normalized scenario data, selects the delivery date through the calendar, chooses the shipping service, and clicks Next. Finally, it verifies the login page loaded and checks that the order summary reflects the same date, cities, and item configuration that were chosen in Step 1.

---

## 9. What You Should Admit Honestly

These answers will help you sound credible.

### Honest admission 1

> The prompt asked for Python and I implemented this in JavaScript Playwright Test. That was a tradeoff I made to optimize for speed, stability, and my confidence in the framework quality. I can explain the architecture clearly, and I could port the same design to Python if needed.

### Honest admission 2

> The prompt said to stop after Step 1 is complete. I extended the flow to the next page because I wanted stronger end-to-end validation of data continuity. Strictly speaking, I would stop earlier if I were optimizing for exact prompt compliance.

### Honest admission 3

> There are still a few fixed waits in the framework. I used them pragmatically in unstable parts of the staging flow, but I would replace them with more deterministic conditions in a production-quality iteration.

### Honest admission 4

> There are a couple of helper methods, like `saveAddresses()`, that are not used in the main happy path. They reflect framework support for flow variants, but I would prune or document them better if I were polishing the repository further.

---

## 10. Fast Rehearsal Checklist For Tonight

Be able to answer these without looking at the code:

1. What does `playwright.config.js` do?
2. How does `.env` work in this project?
3. What is the difference between `config/env.js` and `utils/testData.js`?
4. Why did you use POM?
5. Why did you use `getByRole`?
6. How do you handle autocomplete?
7. How do you handle date selection?
8. How do you detect bot protection?
9. Why did you add summary verification?
10. What would you improve next?
11. Why is your solution different from the PDF prompt?

---

## 11. One-Minute Closing Pitch

If they ask “anything else you want to add?” use this:

> I approached the take-home like a real QA automation problem rather than just a script. I tried to make failures meaningful, used accessible locators where possible, structured the flow with page objects, and added enough configurability to make it reusable. I also know exactly where I deviated from the prompt and how I would tighten those areas. The part I feel strongest about is the judgment around stability, flow design, and diagnosing environment issues cleanly.

---

## 12. How Playwright Can Be Used In AWS Cloud CI/CD

This is a likely interview topic because once a framework works locally, the next question is how it would run in a real delivery pipeline.

### High-level answer

Whether the project is built with **Python Playwright** or **JavaScript Playwright**, the cloud CI/CD idea is the same:

1. source code is stored in GitHub, GitLab, or CodeCommit
2. a pipeline starts on push, pull request, schedule, or manual trigger
3. the CI worker installs dependencies and Playwright browsers
4. tests run against a deployed environment such as `qa`, `staging`, or `pre-prod`
5. artifacts like reports, traces, screenshots, and videos are stored
6. the deployment is either allowed to continue or blocked based on test results

The difference between Python and JavaScript is mainly the runtime and dependency commands.

### JavaScript Playwright in CI/CD

Typical commands:

```bash
npm ci
npx playwright install --with-deps
npx playwright test
```

### Python Playwright in CI/CD

Typical commands:

```bash
pip install -r requirements.txt
playwright install --with-deps
pytest
```

or, if using Playwright’s own runner pattern in Python:

```bash
python -m pytest
```

### AWS services I would use

A practical AWS-based setup would usually involve:

- **CodePipeline** for orchestration
- **CodeBuild** for executing builds and tests
- **S3** for storing test artifacts and reports
- **CloudWatch** for logs and monitoring
- **SNS** or Slack/webhook notifications for pass/fail alerts
- optionally **ECS**, **EKS**, or another deployment target if the app is being promoted between environments

### Typical AWS CI/CD flow

1. developer pushes code
2. pipeline starts automatically
3. application is built or deployed to a test environment
4. Playwright smoke tests run first
5. if smoke passes, deeper regression can run
6. HTML reports, traces, videos, and screenshots upload to S3
7. CloudWatch captures logs
8. pipeline marks the build pass/fail
9. deployment to the next environment is blocked if tests fail

### Good structure for a Playwright framework in the cloud

The framework should be environment-driven and CI-friendly.

Core design principles:

- keep `baseURL`, timeouts, browser selection, credentials, and worker counts outside test logic
- use `.env`, pipeline env vars, or AWS Secrets Manager for sensitive/runtime settings
- keep page objects and test logic separated
- split tests into smoke vs regression
- always publish failure artifacts
- make failures diagnosable without rerunning locally

### Example JS project structure

```text
project/
  playwright.config.js
  package.json
  .env.example
  config/
    env.js
  pages/
    BasePage.js
    HomePage.js
    BookingStep1Page.js
  tests/
    smoke/
    regression/
  utils/
    testData.js
    helpers.js
  reports/
```

### Example Python project structure

```text
project/
  requirements.txt
  .env.example
  config/
    env.py
  pages/
    base_page.py
    home_page.py
    booking_step1_page.py
  tests/
    test_smoke.py
    test_booking_flow.py
  utils/
    test_data.py
    helpers.py
  reports/
```

### What I would say in interview

Use this answer:

> For AWS CI/CD, I would keep the Playwright framework environment-driven and run it through CodeBuild inside a CodePipeline. The pipeline would install dependencies and Playwright browsers, run smoke tests first against staging or a deployed test environment, then run broader regression if needed. I’d store traces, screenshots, videos, and HTML reports in S3 and use CloudWatch for logs. I’d also use environment variables or Secrets Manager for configuration like base URL, credentials, timeouts, and browser selection. The key idea is that the framework should run the same way locally and in the cloud, with only runtime configuration changing.

### If they ask about quality gates

Strong answer:

> I would use the Playwright suite as a deployment gate. For example, smoke tests would be required before promoting a build from staging to the next environment. If smoke fails, the pipeline stops. Regression could run after that or on a schedule, depending on release speed and cost.

### If they ask how to avoid flaky cloud execution

Strong answer:

> I’d keep the suite deterministic, minimize fixed waits, isolate environment configuration, run critical tests serially if needed, and always retain artifacts for failure triage. In cloud execution, diagnosing failures quickly is as important as running the test itself.

---

## 13. Behavioral Questions and Strong Answers

These are the exact answers you can practice out loud.

### Q: Where do you see yourself in 5 years?

Strong answer:

> In five years, I want to be a senior-level QA automation engineer or quality engineer who is trusted not just to write tests, but to improve overall engineering quality. I want to be strong across UI automation, API automation, CI/CD quality gates, and test strategy. I also want to grow in cloud-based test execution and be someone who helps teams release faster with confidence.

Shorter version:

> I see myself growing into a senior QA or quality engineering role where I own automation strategy, help build reliable CI/CD quality gates, and contribute to engineering quality at a broader level.

Why this answer works:

- it shows ambition
- it stays realistic
- it aligns with QA engineering rather than sounding generic

### Q: Why do you want to work with Ship Sticks?

Strong answer:

> I want to work with Ship Sticks because it is a real product with customer-facing booking flows where quality directly affects user trust and business outcomes. That makes QA meaningful, because reliability is tied to the actual customer experience. I also liked that your take-home challenge focused on judgment, maintainability, locator strategy, and async handling rather than just whether a script passes. That suggests the team values thoughtful engineering, and that is the kind of environment I want to be part of.

Shorter version:

> I’m interested in Ship Sticks because the product has real-world complexity and clear customer impact, and the challenge showed me that your team values engineering judgment, not just automation for its own sake.

### Q: Why Ship Sticks instead of any other QA role?

Strong answer:

> Because this looks like a place where QA is treated as an engineering function, not just a manual verification function. The challenge itself reflected that. It emphasized how you think, how you handle ambiguity, and how maintainable your solution is. That’s the type of team and quality culture I want to work in.

### Q: What kind of role do you want to grow into?

Strong answer:

> I want to grow into a role where I contribute not only by writing tests, but also by improving test architecture, CI/CD quality gates, and overall release confidence. Over time, I’d also like to mentor others and help teams think about quality earlier in the development lifecycle.

### Q: What attracts you to this type of product?

Strong answer:

> I like products where the main user journey is business-critical and customer-facing, because quality has a direct and visible impact. In a booking flow like this, issues with timing, correctness, or broken states affect trust immediately. That makes automation valuable in a very practical way.

---

## 14. Behavioral Answer Tips

Use these rules when speaking:

- keep answers direct and calm
- connect your answer to product quality and engineering judgment
- avoid sounding like you memorized a speech
- keep your examples tied to what you actually built in this repo
- when there is a weakness, acknowledge it and explain what you would improve

Good framing pattern:

1. state the decision
2. explain why you made it
3. acknowledge tradeoff if there is one
4. say what you would improve next

Example:

> I used JavaScript Playwright Test because it let me move quickly and structure the framework well, but I recognize the prompt asked for Python. If I were aligning strictly to the ask, I’d port the same architecture to Python.
