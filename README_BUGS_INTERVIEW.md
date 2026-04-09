# Ship Sticks QA Findings

## Executive Summary

This document summarizes the strongest product and platform findings supported by the automation framework in this repository.

The goal of this file is to present the work in a professional, interview-ready format:

- what was tested
- what was observed
- why the issue matters
- where the evidence lives in the repo
- what engineering should review next

This report focuses only on findings supported by at least one of the following:

- automated tests in `tests/`
- page-object safeguards in `pages/`
- reusable diagnostics in `utils/`
- generated artifacts in `tmp/`
- existing investigation notes in `notes/`

## Scope

The framework covers a mix of:

- UI booking flows
- sign-up flows
- API and GraphQL validation
- request/response capture
- interception and mocking
- staging and production diagnostics

The most credible interview-ready findings from that work are:

1. Staging bill pay loses authenticated state when opened from the main app
2. Production bill pay logout does not log out the main Ship Sticks site
3. Bot protection can block the booking flow before the real app loads
4. GraphQL authenticated user lookup is not compatible with the current global setup auth flow
5. Phone verification in staging is not reliably automatable without interception

## Environment Matrix

| Finding | Staging | Production | Evidence |
|---|---|---|---|
| Bill pay opens logged out from an already logged-in main app | Confirmed | Not the same issue | `tests/api-intercept.spec.js`, investigation docs, screenshot/cookie dump |
| Bill pay logout does not log out the main app | Not confirmed | Confirmed | `tests/prod-bill-pay-auth.spec.js`, investigation docs |
| Booking flow can be blocked by anti-bot protection | Confirmed | Also observed as an access risk | `tests/booking-blocking.spec.js`, `pages/BookingStep1Page.js` |
| GraphQL `GetCurrentUser` does not accept the Devise-only session from global setup | Confirmed limitation | Not directly validated | `tests/api-graphql.spec.js` skipped test comment |
| Phone verification flow is unstable without interception | Confirmed | Production unsuitable for real-code automation | `tests/api-intercept.spec.js` |

## Finding 1: Staging Bill Pay Opens Logged Out From a Logged-In Main App

### Summary

On staging, a user can appear fully logged in on the main Ship Sticks application and still open Online Bill Pay in a new tab as a guest.

### Environment

- Main app: `https://www.app.staging.shipsticks.com`
- Bill pay destination: `https://www.app.staging.shipsticks.com/invoices/pay`

### Reproduction Flow

1. Create or log in to a user on the staging main application.
2. Confirm the homepage shows authenticated state.
3. Open `Account options menu`.
4. Click `Online Bill Pay`.
5. Observe the newly opened tab.

### Expected Result

The bill pay tab should inherit the authenticated user session and open in a logged-in state.

### Actual Result

The bill pay tab opens in a guest state and does not reflect the authenticated user from the main app.

### Why It Matters

- breaks expected cross-application authentication behavior
- creates a confusing user experience
- suggests session handling is not unified between connected application surfaces

### Evidence

- [tests/api-intercept.spec.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/tests/api-intercept.spec.js)
  This test signs up a user, intercepts phone-verification calls so the flow can complete, then opens bill pay in a new tab and logs network traffic.
- [utils/networkLogger.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/utils/networkLogger.js)
  Used to log requests, responses, and cookie state during the cross-tab flow.
- [tmp/bill-pay-tab.png](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/tmp/bill-pay-tab.png)
  Screenshot artifact from the bill pay tab.
- Investigation notes:
  - `notes/BILL_PAY_AUTH_INVESTIGATION.md`
  - `notes/BILL_PAY_AUTH_QA_REPORT.md`

### Likely Technical Cause

The automation and investigation notes indicate the main application and bill pay flow do not behave like a single auth system. The issue appears tied to session sharing and host/application boundaries rather than a simple frontend rendering bug.

## Finding 2: Production Bill Pay Logout Does Not Log Out the Main App

### Summary

In production, logging out from Online Bill Pay does not log the user out of the main Ship Sticks site.

### Environment

- Production main app: `https://www.shipsticks.com`

### Reproduction Flow

1. Log in to the main production site.
2. Open `Account options menu`.
3. Click `Online Bill Pay`.
4. Confirm the bill pay tab is logged in.
5. Log out from bill pay.
6. Return to the original Ship Sticks tab and refresh.

### Expected Result

If logout is intended to be global, both bill pay and the main application should reflect a logged-out state.

### Actual Result

Bill pay logs out, but the main Ship Sticks application remains logged in.

### Why It Matters

- session behavior is inconsistent across connected application surfaces
- users may believe they fully logged out when they did not
- creates trust and account-security concerns

### Evidence

- [tests/prod-bill-pay-auth.spec.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/tests/prod-bill-pay-auth.spec.js)
  The test logs into production, opens bill pay in a new tab, performs logout there, reloads the main app, and checks whether the main session still exists.
- Supporting artifacts named by the spec:
  - `tmp/prod-visit1.png`
  - `tmp/prod-after-billpay-logout.png`
  - `tmp/prod-main-after-billpay-logout.png`
  - `tmp/prod-visit2.png`
- Investigation notes:
  - `notes/BILL_PAY_AUTH_INVESTIGATION.md`
  - `notes/BILL_PAY_AUTH_QA_REPORT.md`

### Likely Technical Cause

The evidence points to bill pay and the main app maintaining partially separate auth/session state. Logout appears to clear one surface without invalidating the other.

## Finding 3: Bot Protection Can Block the Booking Flow

### Summary

The booking flow can be blocked by bot protection before the actual booking page loads.

### Environment

- Confirmed in staging
- also seen as a real risk in production runs

### Reproduction Flow

1. Open the booking flow through the framework.
2. Attempt to navigate to the booking page.
3. Observe whether the app loads or redirects to an anti-bot page.

### Expected Result

The booking page should load normally and display the `Shipping Options` heading.

### Actual Result

In blocked runs, the browser is redirected to bot-protection infrastructure instead of the app.

### Why It Matters

- prevents valid automation and possibly some real-user sessions from reaching the application
- creates false negatives if not handled clearly in test design
- indicates environment/access instability rather than a normal UI assertion failure

### Evidence

- [pages/BookingStep1Page.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/pages/BookingStep1Page.js)
  `assertLoaded()` explicitly checks for `validate.perfdrive.com` / `shieldsquare` URLs and raises a clear failure.
- [tests/booking-blocking.spec.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/tests/booking-blocking.spec.js)
  Dedicated guardrail test to surface bot protection as a specific issue instead of a vague locator failure.

### QA Note

This is a strong example of mature framework design: the suite distinguishes application failures from environment/access failures.

## Finding 4: GraphQL Auth Does Not Match the Current Global Setup Session

### Summary

The current `globalSetup` login flow creates a valid Rails/Devise session, but that session is not sufficient for all GraphQL authenticated user flows.

### Environment

- Confirmed in staging framework behavior

### Reproduction Flow

1. Let `utils/globalSetup.js` create the suite auth session.
2. Use that session in GraphQL tests.
3. Call the authenticated `GetCurrentUser` query.

### Expected Result

The authenticated GraphQL request should return the current user.

### Actual Result

The repo documents this as a known limitation and skips the test because the session created by the Devise login does not fully match the app-modal login flow required by the resolver.

### Why It Matters

- shows that “logged in” is not a single universal auth state in this system
- creates risk when mixing Rails session auth with frontend GraphQL auth assumptions
- affects API test design and fixture strategy

### Evidence

- [utils/globalSetup.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/utils/globalSetup.js)
  Uses the Rails sign-in page and CSRF token flow to create a session.
- [tests/api-graphql.spec.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/tests/api-graphql.spec.js)
  Contains a skipped test with a direct explanation that the app-modal login flow is not equivalent to the Devise session for `GetCurrentUser`.

### QA Note

This is not a simple “test bug.” It is a meaningful architectural finding about auth boundaries between backend and frontend layers.

## Finding 5: Staging Phone Verification Is Not Reliably Automatable Without Interception

### Summary

The signup phone-verification flow is not stable enough in staging to be tested straight through without intercepting backend calls.

### Environment

- Confirmed in staging

### Reproduction Flow

1. Sign up a new user through the UI.
2. Reach the phone-verification step.
3. Let the app attempt real verification calls.

### Expected Result

The app should send the verification code and allow the flow to continue through a real verification path.

### Actual Result

The repository comments and interception tests indicate the flow is unreliable in staging and must be faked to continue the automation reliably.

### Why It Matters

- blocks straightforward end-to-end coverage of signup verification
- increases flakiness and external dependency risk
- forced the team to use interception to keep test progress moving

### Evidence

- [tests/api-intercept.spec.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/tests/api-intercept.spec.js)
  Includes tests that intercept:
  - `createMobileVerification`
  - follow-up verification mutations
- Comments in the file explain that the real SMS-based path is not dependable for automation in staging.

### QA Note

This is a valid finding to discuss in interviews because it shows practical use of request interception to isolate unstable external dependencies.

## Most Valuable Interview Talking Points

If I were presenting this work in an interview, I would emphasize these points:

- I did not stop at UI assertions. I used request logging, cookie inspection, interception, and cross-tab validation to isolate auth behavior.
- I distinguished between product bugs and environment/access problems. For example, bot protection was treated separately from application regressions.
- I used Playwright as both an automation framework and a diagnostic tool.
- I documented architectural findings, not just pass/fail outcomes. The GraphQL auth mismatch is a good example.
- I produced evidence-backed findings with reproducible flows, supporting tests, and saved artifacts.

## Suggested Engineering Follow-Up

1. Review session-sharing behavior between the main Ship Sticks application and Online Bill Pay.
2. Clarify whether logout is intended to be global across application surfaces.
3. Review host/session boundaries for bill pay entry points.
4. Decide whether GraphQL authenticated user flows should trust the current Devise-based setup session.
5. Review staging bot-protection behavior for testability and environment reliability.
6. Review whether phone verification should be testable through a stable non-SMS path in staging.

## Related Files

- [tests/api-intercept.spec.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/tests/api-intercept.spec.js)
- [tests/prod-bill-pay-auth.spec.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/tests/prod-bill-pay-auth.spec.js)
- [tests/booking-blocking.spec.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/tests/booking-blocking.spec.js)
- [tests/api-graphql.spec.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/tests/api-graphql.spec.js)
- [utils/globalSetup.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/utils/globalSetup.js)
- [utils/networkLogger.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/utils/networkLogger.js)
- [pages/BookingStep1Page.js](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/pages/BookingStep1Page.js)
- [README_BUGS_AND_FINDINGS.md](/Users/mustafasapple/Downloads/shipsticks-stage-test-main%203/README_BUGS_AND_FINDINGS.md)
