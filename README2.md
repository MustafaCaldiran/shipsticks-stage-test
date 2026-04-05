# Ship Sticks Playwright Framework: End-to-End Project Guide

## Project Overview

This project is a **Playwright end-to-end automation framework** for the **Ship Sticks booking flow**. Its purpose is to validate the main user journey from the homepage quote widget into the Step 1 shipping configuration flow and then into the login/order summary page.

The framework is built to automate these business actions:

- start a quote from the homepage
- select a shipment type
- enter origin and destination addresses
- configure shipped items
- select a delivery date
- choose a shipping service level
- move to the next booking step
- verify that the order summary carries the correct information forward

This is not a generic sample Playwright repo. It is a focused booking-flow automation framework built around the Ship Sticks staging application at the default base URL from [`config/env.js`](./config/env.js):

```js
baseUrl: process.env.BASE_URL || 'https://app.staging.shipsticks.com'
```

### What we built and why

The implementation uses:

- **Playwright Test** as the test runner
- **Page Object Model (POM)** to organize page behavior
- **scenario-driven test data** to run the same flow with different inputs
- **environment-driven configuration** for browser behavior and runtime settings

The idea is to keep the tests readable and business-focused while moving locator logic and repeated actions into page classes.

### Overall automation approach

The framework uses a **real user-flow approach**:

1. open the homepage
2. interact with the quote widget
3. enter the booking flow
4. complete Step 1
5. assert that the next page shows the expected summary

It also includes an **environment guardrail test** to detect when the site blocks automation with bot protection rather than letting the suite fail with a vague error.

## How the Framework Is Designed

### Main design decisions

The actual design choices in this project are:

1. **Use `@playwright/test` directly**
   This project uses a standard Playwright Test setup with [`playwright.config.js`](./playwright.config.js), browser projects, retries in CI, and Playwright reporting features.

2. **Use page objects for each major step**
   The framework has dedicated page classes for:
   - homepage quote entry
   - booking step 1
   - booking login/order summary

3. **Keep common browser behavior in a base page**
   Repeated operations like navigation, autocomplete waiting, cookie acceptance, and dismissing modals live in [`pages/BasePage.js`](./pages/BasePage.js).

4. **Drive tests from scenario data**
   The main suite loops through scenarios from [`utils/testData.js`](./utils/testData.js), which keeps the same flow reusable across multiple booking combinations.

5. **Use accessible locators where possible**
   The project relies heavily on `getByRole`, `getByText`, and Playwright assertions instead of CSS-heavy locator strategies.

6. **Support multiple browsers through config**
   Browser selection is controlled by the `BROWSERS` environment variable and mapped to projects in [`playwright.config.js`](./playwright.config.js).

### Folder structure and purpose

```text
config/
pages/
tests/
utils/
specs/
.github/
playwright.config.js
package.json
```

#### `config/`

- [`config/env.js`](./config/env.js)

Purpose:

- central runtime configuration
- base URL
- headed mode
- slow motion
- timeout
- default business test data

This file reads `.env` values via `dotenv` and exports normalized config values the rest of the project can use.

#### `pages/`

- [`pages/BasePage.js`](./pages/BasePage.js)
- [`pages/HomePage.js`](./pages/HomePage.js)
- [`pages/BookingStep1Page.js`](./pages/BookingStep1Page.js)
- [`pages/BookingLoginPage.js`](./pages/BookingLoginPage.js)

Purpose:

- Page Object Model implementation
- selectors and user actions are grouped by page responsibility

This is the core of the framework.

#### `tests/`

- [`tests/booking.spec.js`](./tests/booking.spec.js)
- [`tests/booking-blocking.spec.js`](./tests/booking-blocking.spec.js)
- [`tests/seed.spec.ts`](./tests/seed.spec.ts)

Purpose:

- executable Playwright tests

`booking.spec.js` is the main business-flow suite.  
`booking-blocking.spec.js` is a guardrail/environment test.  
`seed.spec.ts` is just a placeholder seed file and is not part of the real framework flow.

#### `utils/`

- [`utils/testData.js`](./utils/testData.js)

Purpose:

- stores reusable booking scenarios
- exposes scenario selection logic
- holds timing constants, invalid data, and variations

#### `specs/`

- [`specs/README.md`](./specs/README.md)

Purpose:

- reserved for test plans and specifications

At the moment, this folder is mostly a placeholder.

#### `.github/`

- [`.github/workflows/e2e.yml`](./.github/workflows/e2e.yml)
- [`.github/workflows/copilot-setup-steps.yml`](./.github/workflows/copilot-setup-steps.yml)
- agent files under [`.github/agents`](./.github/agents)

Purpose:

- CI execution
- GitHub workflow automation
- repository-specific agent instructions

### Separation of responsibilities

The framework separates concerns cleanly:

- **`playwright.config.js`** controls execution behavior
- **`config/env.js`** controls runtime environment values
- **page objects** know how to use the UI
- **`utils/testData.js`** provides business scenarios
- **test files** orchestrate the flow and make assertions
- **GitHub workflow files** run the suite in CI

### How maintainability and reusability are achieved

Maintainability comes from:

- central locators inside page classes
- common helpers inside `BasePage`
- scenario reuse from `utils/testData.js`
- browser/project reuse through Playwright config

Reusability examples:

- `HomePage.startQuote()` is reused for every scenario run
- `BookingStep1Page.configureItems()` handles multiple item shapes
- `BookingLoginPage.assertSummaryMatchesChallenge()` centralizes order-summary verification
- `testData.getScenarioEntries()` makes scenario filtering easy

## Execution Flow

This section explains the actual internal flow from test start to test finish.

### 1. Playwright starts from `package.json`

The main script in [`package.json`](./package.json) is:

```json
"test": "playwright test"
```

That means the project uses the normal Playwright Test runner, not a custom Node runner.

Other important scripts:

- `npm run test:headed`
- `npm run test:debug`
- `npm run test:ci`
- `npm run test:parallel`
- `npm run test:chromium`
- `npm run test:firefox`
- `npm run test:webkit`
- `npm run test:all-browsers`

### 2. `playwright.config.js` builds the execution model

[`playwright.config.js`](./playwright.config.js) is the center of test execution behavior.

It defines:

- `testDir: './tests'`
- `fullyParallel`
- retries in CI
- worker count
- timeout and expect timeout from `env.timeout`
- HTML and line reporters
- shared `use` options
- browser projects

Important `use` settings:

- `baseURL: env.baseUrl`
- `headless: !env.headed`
- `slowMo: env.slowMo`
- viewport `1280 x 800`
- `trace: 'on-first-retry'`
- `screenshot: 'only-on-failure'`
- `video: 'retain-on-failure'`

Project selection is dynamic:

```js
const requestedBrowsers = (process.env.BROWSERS || 'chromium')
  .split(',')
  .map((browser) => browser.trim())
  .filter(Boolean);
```

That list is mapped into Playwright browser projects:

- `chromium`
- `firefox`
- `webkit`

### 3. Environment config is loaded

[`config/env.js`](./config/env.js) loads `.env` through:

```js
require('dotenv').config();
```

Then it exports:

- `baseUrl`
- `headed`
- `slowMo`
- `timeout`
- a default `testData` object

Even though `env.testData` exists, the active business-flow suite is mainly driven by [`utils/testData.js`](./utils/testData.js).

### 4. The main suite reads scenario data

In [`tests/booking.spec.js`](./tests/booking.spec.js), the suite reads scenario names from:

```js
process.env.SCENARIOS
```

Then it calls:

```js
testData.getScenarioEntries(selectedScenarioNames)
```

This means:

- if `SCENARIOS` is empty, all defined scenarios run
- if `SCENARIOS=challenge`, only that one runs
- if an unknown scenario name is passed, the framework throws an error

### 5. Playwright injects `page` and `baseURL`

Each Playwright test receives fixtures like:

```js
async ({ page, baseURL }) => { ... }
```

This is standard Playwright Test behavior.

The test creates page object instances using those fixtures:

```js
const homePage = new HomePage(page, baseURL);
const bookingPage = new BookingStep1Page(page, baseURL);
const loginPage = new BookingLoginPage(page);
```

All page objects share the same Playwright `page`, which means the browser state continues naturally from one page object to the next.

### 6. The test begins on the homepage

The first action is usually:

```js
await homePage.goto();
```

Inside [`pages/HomePage.js`](./pages/HomePage.js):

- `goto()` calls `BasePage.navigate()`
- `navigate()` uses `page.goto(..., { waitUntil: 'domcontentloaded' })`
- `acceptCookiesIfPresent()` runs
- the hero heading is asserted visible
- the `Get started` button is asserted disabled before required fields are filled

### 7. The quote widget is completed

The test then calls:

```js
await homePage.startQuote({
  shipmentType,
  origin,
  destination,
});
```

Inside `HomePage.startQuote()`:

1. if shipment type is one-way, `selectOneWayShipment()` runs
2. `fillOriginAddress(origin)` fills the origin combobox and selects the first autocomplete option
3. `fillDestinationAddress(destination)` fills the destination combobox
4. it waits for/handles autocomplete
5. it verifies `Get started` is enabled
6. it clicks `Get started`

This is the point where the flow moves from the homepage into the booking flow.

### 8. Step 1 booking page takes over

After starting the quote, the test asserts:

```js
await bookingPage.assertLoaded();
```

In [`pages/BookingStep1Page.js`](./pages/BookingStep1Page.js), `assertLoaded()` does something important:

- it reads the current URL
- if the URL matches `validate.perfdrive.com` or `shieldsquare`, it throws an explicit error saying bot protection blocked the run
- otherwise it expects the `Shipping Options` heading to be visible

This is a real project-specific pattern and one of the strongest design choices in the codebase, because it turns an environmental blocker into a meaningful failure reason.

### 9. Optional modal/notice handling happens

Still on Step 1, the suite calls:

```js
await bookingPage.dismissWeatherWarningIfPresent();
```

The base page and booking page also include optional handlers for:

- cookie acceptance
- country note dismissal
- weather warning dismissal

These are defensive helpers that reduce flakiness from conditional UI elements.

### 10. Items are configured

The main flow builds challenge items like this:

```js
const challengeItems = bookingPage.getChallengeItems(scenario);
await bookingPage.configureItems(challengeItems);
```

`getChallengeItems()` supports two scenario shapes:

- a full `items` array
- a simpler single-item definition using `itemCategory` and `itemSize`

`configureItems()` then:

1. normalizes item configs
2. adds the requested quantity with `addItem()`
3. selects sizes using `selectItemSize()`

This is a good example of business-data normalization living inside the page object, not the test.

### 11. Delivery date is selected

The suite calls:

```js
await bookingPage.selectDeliveryDate(scenario.deliveryDate);
```

Inside `selectDeliveryDate()`:

- the date picker is opened
- the calendar month/year is read
- next-month navigation is clicked until the target month is reached
- the target grid cell is selected
- the button text is verified with a regex
- the `Shipment Speeds` section is expected to appear

This is one of the most detailed UI flows in the framework.

### 12. Shipping method is selected

The suite calls:

```js
await bookingPage.selectShippingMethod(scenario.serviceLevel);
```

This method:

- maps the service level through `serviceLevelLabels`
- verifies shipping options are visible
- expands more options when needed for `Second Day Express`
- locates the shipping radio button
- clicks it
- verifies it is checked

### 13. The test moves to the next page

Then:

```js
await bookingPage.proceedToNextStep();
```

This clicks the `Next: Traveler Details` button.

The current implementation expects the next page to be the login/order summary step.

### 14. The login/order summary page is verified

The suite then calls:

```js
await loginPage.assertLoaded();
await loginPage.assertSummaryMatchesChallenge({ ... });
```

In [`pages/BookingLoginPage.js`](./pages/BookingLoginPage.js):

- `assertLoaded()` verifies URL pattern `/book/login`
- the `Account Login` heading is visible
- summary date, origin city, destination city, and shipped items are validated

This is how data is proven to have flowed correctly across pages.

### 15. The second test checks required-field behavior

The same suite also includes:

```js
test('requires completed fields before moving to traveler details', ...)
```

This verifies a simpler UI rule:

- homepage loads
- `Get started` is disabled
- required quote fields are visible

### 16. The guardrail suite checks environment blocking

[`tests/booking-blocking.spec.js`](./tests/booking-blocking.spec.js) exists to make environmental failures explicit.

Flow:

1. instantiate `BookingStep1Page`
2. call `goto()`
3. catch any thrown error
4. if blocked, assert the error contains `bot protection`
5. otherwise assert the shipping options heading is visible

This suite passed in Chromium during verification in this environment.

## Playwright Basics Actually Used in This Project

This section only covers Playwright APIs that are truly used here.

### `test.describe()`

What it does:

- groups related test cases

Where it is used:

- [`tests/booking.spec.js`](./tests/booking.spec.js)
- [`tests/booking-blocking.spec.js`](./tests/booking-blocking.spec.js)
- [`tests/seed.spec.ts`](./tests/seed.spec.ts)

Why it is used:

- to organize booking flow tests and environment guardrail tests

### `test()`

What it does:

- defines an individual Playwright test

Where it is used:

- all files under `tests/`

Why it is used:

- each business scenario becomes a test case

### Playwright fixtures: `{ page, baseURL }`

What they do:

- `page` gives a browser tab
- `baseURL` comes from Playwright config

Where they are used:

- [`tests/booking.spec.js`](./tests/booking.spec.js)
- [`tests/booking-blocking.spec.js`](./tests/booking-blocking.spec.js)

Why they are used:

- page objects need the browser page
- the framework uses config-based URLs instead of hardcoding everywhere

### `defineConfig()`

What it does:

- defines Playwright runner configuration

Where it is used:

- [`playwright.config.js`](./playwright.config.js)

Why it is used:

- to manage projects, retries, workers, reporters, and shared runtime behavior

### `devices[...]`

What it does:

- provides browser/device presets

Where it is used:

- [`playwright.config.js`](./playwright.config.js)

Why it is used:

- to configure `Desktop Chrome`, `Desktop Firefox`, and `Desktop Safari` projects cleanly

### `goto()`

What it does:

- navigates the page to a URL

Where it is used:

- `BasePage.navigate()`

Why it is used:

- all page-entry methods depend on it

### `getByRole()`

What it does:

- locates elements using accessible role and name

Where it is used:

- throughout all page classes

Examples:

- comboboxes for origin/destination
- buttons like `Get started`, `Save`, `Next: Traveler Details`
- headings like `Shipping Options` and `Account Login`
- radio buttons for shipping methods

Why it is used:

- it is robust, readable, and aligned with user-visible UI semantics

### `getByText()`

What it does:

- locates visible text content

Where it is used:

- `BookingStep1Page`

Why it is used:

- useful for headings, item labels, weather notes, and shipping option text

### `locator()`

What it does:

- creates a more flexible locator chain

Where it is used:

- `BasePage.waitForAutocomplete()`
- `BookingLoginPage`
- `BookingStep1Page`

Why it is used:

- for complex DOM structures, aria-label-based summary data, parent traversal, and calendar handling

### `filter()`

What it does:

- narrows a locator based on content

Where it is used:

- `BasePage.waitForAutocompleteOption()`
- `BookingLoginPage.assertSummaryItem()`

Why it is used:

- to match autocomplete options and specific summary items by displayed text

### `first()` and `nth()`

What they do:

- select the first or indexed match from a locator set

Where they are used:

- throughout the page objects

Examples:

- first autocomplete option
- first `Get started` button
- first and second shipment city in the order summary
- next month calendar button with `.nth(1)`

Why they are used:

- the UI often exposes repeated matching elements

### `fill()`

What it does:

- enters text into input fields

Where it is used:

- homepage address fields
- step 1 address fields
- base helper methods

Why it is used:

- address entry is one of the main business actions

### `type()`

What it does:

- types text character by character

Where it is used:

- `HomePage.fillDestinationAddress()`
- `BasePage.typeCarefully()`

Why it is used:

- to better trigger autocomplete behavior in unstable cases

### `keyboard.type()`

What it does:

- sends typed characters through the keyboard

Where it is used:

- `BasePage.typeCarefully()`

Why it is used:

- gives fine-grained input control with delay

### `waitFor()`

What it does:

- waits for a locator state

Where it is used:

- `BasePage.waitForElement()`
- cookie handlers
- modal handlers
- buttons and notices throughout page objects

Why it is used:

- to synchronize dynamic UI states before acting

### `waitForSelector()`

What it does:

- waits for a selector to appear

Where it is used:

- `BasePage.waitForAutocomplete()`

Why it is used:

- autocomplete is a key dependency for address entry

### `waitForTimeout()`

What it does:

- pauses execution for a fixed time

Where it is used:

- `HomePage.fillDestinationAddress()`
- `BookingStep1Page.selectItemSize()`

Why it is used:

- to stabilize DOM changes or autocomplete behavior in a few tricky places

Honest note:

- this is part of the real code, but it is more brittle than event-driven waiting and is one of the weaker reliability points in the framework

### `toBeVisible()`

What it does:

- asserts that an element is visible

Where it is used:

- everywhere in page objects and tests

Why it is used:

- most page readiness and business checkpoints depend on visibility assertions

### `toBeDisabled()` / `toBeEnabled()`

What they do:

- assert control state

Where they are used:

- homepage `Get started` button
- save button
- next step button

Why they are used:

- this framework verifies user progression rules, not just presence of controls

### `toContainText()` / `toHaveText()` / `toHaveURL()`

What they do:

- assert displayed text or current URL

Where they are used:

- `HomePage.selectOneWayShipment()`
- `BookingStep1Page.selectDeliveryDate()`
- `BookingLoginPage.assertLoaded()`
- summary verification methods

Why they are used:

- they validate that selected state and navigation are correct

### `toHaveValue()` / `inputValue()`

What they do:

- verify or read field values

Where they are used:

- address fields on homepage/step 1
- summary helper methods

Why they are used:

- to confirm that user-entered data was accepted

### `toBeChecked()`

What it does:

- asserts a radio/checkbox selection state

Where it is used:

- `BookingStep1Page.selectShippingMethod()`

Why it is used:

- shipping method selection is a required part of Step 1 completion

### `scrollIntoViewIfNeeded()`

What it does:

- scrolls an element into view before interaction

Where it is used:

- `BookingStep1Page.addItem()`
- `BookingStep1Page.selectItemSize()`

Why it is used:

- item controls can be lower in the page and may not be interactable immediately

### Methods not meaningfully used in this project

The active framework does **not** rely on:

- API testing helpers
- Playwright storage state/auth fixtures
- custom reporters beyond configured Playwright reporters
- `beforeEach` / `afterEach` hooks
- snapshot testing

## Page Object Model in This Project

### How POM is implemented

The POM implementation is straightforward:

- one class per major page/step
- locators are defined in the constructor
- page methods represent user actions and page validations

This makes tests read like business workflows instead of low-level DOM scripts.

### `BasePage`

File:

- [`pages/BasePage.js`](./pages/BasePage.js)

Role:

- common browser and synchronization helpers

Main methods:

- `navigate(url)`
- `typeCarefully(locator, text, options)`
- `waitForElement(locator, timeout)`
- `waitForAutocomplete(timeout)`
- `waitForAutocompleteOption(textOrRegex, timeout)`
- `dismissCountryNoteIfPresent(timeout)`
- `acceptCookiesIfPresent(timeout)`

This file is the shared technical foundation.

### `HomePage`

File:

- [`pages/HomePage.js`](./pages/HomePage.js)

Role:

- homepage quote widget interactions

Main locators:

- `originField`
- `destinationField`
- `tripTypeButton`
- `oneWayOption`
- `getStartedButton`
- `heroHeading`
- `firstAutocompleteSuggestion`

Main methods:

- `goto()`
- `selectOneWayShipment()`
- `fillOriginAddress(address)`
- `fillDestinationAddress(address)`
- `startQuote({ shipmentType, origin, destination })`

This page object is responsible for starting the business flow.

### `BookingStep1Page`

File:

- [`pages/BookingStep1Page.js`](./pages/BookingStep1Page.js)

Role:

- Step 1 booking form behavior

Main responsibilities:

- validate page load
- detect bot protection redirects
- dismiss optional warnings
- fill addresses
- save addresses
- select delivery date
- select shipping method
- add and size items
- move to the next step

Important methods:

- `goto()`
- `assertLoaded()`
- `dismissWeatherWarningIfPresent()`
- `fillOriginAddress()`
- `fillDestinationAddress()`
- `saveAddresses()`
- `selectDeliveryDate()`
- `selectShippingMethod()`
- `addItem()`
- `selectItemSize()`
- `configureItems()`
- `normalizeItemConfigs()`
- `getChallengeItems()`
- `proceedToNextStep()`

This is the most complex page object in the project.

### `BookingLoginPage`

File:

- [`pages/BookingLoginPage.js`](./pages/BookingLoginPage.js)

Role:

- next-step verification page for login and order summary assertions

Main responsibilities:

- confirm transition to `/book/login`
- verify summary date
- verify summary origin and destination
- verify summary item labels
- expand shipping accordion when needed
- normalize display formatting for date and city assertions

Important methods:

- `assertLoaded()`
- `assertSummaryShipmentDate()`
- `assertSummaryOriginCity()`
- `assertSummaryDestinationCity()`
- `assertSummaryItem()`
- `assertSummaryMatchesChallenge()`
- `buildSummaryItemLabel()`
- `extractCityState()`
- `normalizeDateLabel()`
- `formatSummaryDate()`

This page object is where cross-page data continuity is validated.

### How tests interact with page objects

The main test creates the page objects directly:

```js
const homePage = new HomePage(page, baseURL);
const bookingPage = new BookingStep1Page(page, baseURL);
const loginPage = new BookingLoginPage(page);
```

Then it drives the flow through their methods:

```js
await homePage.goto();
await homePage.startQuote(...);
await bookingPage.assertLoaded();
await bookingPage.configureItems(...);
await bookingPage.selectDeliveryDate(...);
await bookingPage.selectShippingMethod(...);
await bookingPage.proceedToNextStep();
await loginPage.assertLoaded();
await loginPage.assertSummaryMatchesChallenge(...);
```

That is the clearest example of how POM is used in this project.

## Utilities, Helpers, Configs, Fixtures, and Supporting Files

### `playwright.config.js`

Role:

- the central test runner configuration

Connects to the rest of the project by:

- pointing Playwright to `./tests`
- defining browser projects
- injecting `baseURL`
- defining retries, workers, screenshots, traces, and videos

### `config/env.js`

Role:

- application/runtime environment configuration

Connects to the rest of the project by:

- feeding config values into Playwright setup
- exposing shared timeout and URL data

### `utils/testData.js`

Role:

- scenario repository and scenario resolver

Important content:

- `scenarios.challenge`
- `scenarios.two_golf_bags_ground`
- `variations`
- `invalidData`
- `timing`
- `getScenarioEntries(selectedScenarioNames)`

Connects to the rest of the project by:

- driving the loop in `tests/booking.spec.js`
- supplying item/category/size/service-level combinations

### `tests/seed.spec.ts`

Role:

- placeholder seed file

Honest note:

- it does not currently participate in the executable business framework and contains no real automation logic

### Fixtures and hooks

The project uses Playwright’s built-in fixtures:

- `page`
- `baseURL`

But the current active tests do **not** define:

- custom fixtures
- `test.beforeEach()`
- `test.afterEach()`
- global setup files

The framework is still clean, but it stays simple and explicit.

## Real Project-Specific Patterns and Relationships

### File relationships

[`tests/booking.spec.js`](./tests/booking.spec.js)
-> imports `HomePage`, `BookingStep1Page`, `BookingLoginPage`
-> imports `testData`
-> loops through scenarios
-> runs the end-to-end flow

[`tests/booking-blocking.spec.js`](./tests/booking-blocking.spec.js)
-> imports `BookingStep1Page`
-> validates environment accessibility and bot-protection behavior

[`pages/HomePage.js`](./pages/HomePage.js)
-> extends `BasePage`
-> starts the quote flow

[`pages/BookingStep1Page.js`](./pages/BookingStep1Page.js)
-> extends `BasePage`
-> handles the largest business workflow section

[`pages/BookingLoginPage.js`](./pages/BookingLoginPage.js)
-> extends `BasePage`
-> validates the next-step summary

[`playwright.config.js`](./playwright.config.js)
-> imports `config/env.js`
-> defines global test behavior

[`utils/testData.js`](./utils/testData.js)
-> provides the data that drives the main flow

### Important project-specific patterns

#### Scenario-driven test generation inside a single describe block

This code:

```js
for (const [scenarioName, scenario] of testData.getScenarioEntries(selectedScenarioNames)) {
  test(`completes Step 1 happy path with page objects [${scenarioName}]`, async ({ page, baseURL }) => {
```

means the framework dynamically creates one test per selected scenario.

#### Guardrail test for bot protection

This is not generic boilerplate. The framework explicitly expects anti-bot interference as a real environment risk and handles it with a meaningful assertion.

#### Data normalization inside the page object

`BookingStep1Page.normalizeItemConfigs()` and `getChallengeItems()` convert business test data into the shape required by the UI flow. That keeps the test cleaner and lets the framework support multiple scenario formats.

#### UI-format normalization inside the summary page

`BookingLoginPage.formatSummaryDate()` and `extractCityState()` convert raw scenario data into the exact display format used by the order summary UI. This is another strong project-specific design choice.

## Beginner-Friendly Teaching Section

### Explain this project simply

This project is an automated robot that books the first step of a shipment on the Ship Sticks website.

It works like this:

1. open the homepage
2. fill out the quote form
3. enter the booking flow
4. choose shipment details
5. go to the next page
6. check that the summary shows the right data

### Simple way to understand the framework

Think of it as four layers:

1. **Playwright config** decides how tests run
2. **Tests** describe the scenario
3. **Page objects** know how to click, type, and verify each page
4. **Test data** supplies the shipment details

### How one test moves through the framework

For the main happy path:

1. Playwright starts `tests/booking.spec.js`
2. The test picks a scenario from `utils/testData.js`
3. It creates `HomePage`, `BookingStep1Page`, and `BookingLoginPage`
4. `HomePage` opens the site and starts the quote
5. `BookingStep1Page` completes shipment details
6. The test clicks next
7. `BookingLoginPage` checks the summary
8. Playwright ends the test and automatically handles artifacts like traces/screenshots on failure

### Why page objects help beginners

Without POM, the test would be full of locator code like:

```js
page.getByRole('combobox', { name: 'Where from?' }).fill(...)
```

With POM, the test can say:

```js
await homePage.startQuote(...)
```

That is easier to read, easier to explain, and easier to maintain.

### Good interview explanation for this project

You could describe it like this:

> This is a Playwright Test automation framework for the Ship Sticks booking flow. It uses a Page Object Model with a shared `BasePage`, scenario-based test data from `utils/testData.js`, and a standard `playwright.config.js` for multi-browser execution and failure artifacts. The main suite starts on the homepage, enters the booking flow, completes Step 1 shipment details, navigates to the login page, and verifies that the order summary reflects the selected shipment data. The framework also includes an environment guardrail test that turns bot-protection redirects into explicit, understandable failures.

## Current State and Honest Notes

What is clearly implemented:

- homepage quote flow
- Step 1 booking flow automation
- item configuration with quantities and sizes
- delivery date selection
- shipping method selection
- next-step summary verification
- scenario-driven test execution
- multi-browser Playwright config
- CI workflow
- explicit anti-bot guardrail coverage

What is present but incomplete or minimal:

- [`tests/seed.spec.ts`](./tests/seed.spec.ts) is only a placeholder
- [`specs/README.md`](./specs/README.md) is just a placeholder
- `config/env.js` contains `testData`, but the main suite primarily uses [`utils/testData.js`](./utils/testData.js)
- some fixed waits are still used for stabilization and could be improved later

## How to Run

Install:

```bash
npm install
npx playwright install chromium --with-deps
```

Run all tests:

```bash
npm test
```

Run headed:

```bash
npm run test:headed
```

Run one browser:

```bash
npm run test:chromium
npm run test:firefox
npm run test:webkit
```

Run selected scenarios:

```bash
SCENARIOS=challenge npx playwright test
SCENARIOS=two_golf_bags_ground npx playwright test
```

Useful environment variables actually supported by the code:

- `BASE_URL`
- `HEADED`
- `SLOW_MO`
- `TIMEOUT`
- `BROWSERS`
- `WORKERS`
- `FULLY_PARALLEL`
- `SCENARIOS`
