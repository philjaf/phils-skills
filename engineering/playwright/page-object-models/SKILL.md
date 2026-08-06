---
name: page-object-models
description: Create, extend, or review a Playwright page object model in a suite's existing pattern.
disable-model-invocation: true
---

# Page Object Models

A page object here is **thin**: locators declared in the constructor, methods that wrap exactly one Playwright call, and no judgment at all. The spec judges; the page object only reaches. Every rule below follows from that.

The **neighbour** — the existing page object closest to the page you are working on — is the pattern of record. Every convention below is a default that the neighbour overrides; when this skill and the neighbour disagree, follow the neighbour and say so. Code samples here carry names from one suite purely as illustration.

## Steps

### 1. Read the neighbour

Find the page objects directory (commonly `tests/pages/`, `e2e/pages/`, `pages/`) and open the two or three files closest to your target page — same product or area prefix, or same page role: login, shipping, checkout, hub. Note whether the suite has a **base** — a shared helper class the pages hold or extend, holding cross-page waits and utilities — and whether your neighbours use it.

Then work out what your page object owes, from whichever side exists:

- **The page object comes first, no spec yet** — the usual case. Take the flow from the request and from the page itself in step 2. Cover the elements that flow touches plus the states it can land in; stop there rather than modelling the whole page.
- **A spec already exists** — writing the second page object for a written spec, or extending a POM and spec together. Read it and list, by name, the methods it calls and the locators it reads directly.

Done when you can state the file-name and class-name shapes, whether the neighbour reaches the base, and the list of interactions your page object owes.

### 2. Harvest the selectors from the live page

Open the page in a browser (`playwright-cli` skill, or Chrome DevTools MCP) at the environment the suite targets, walk the flow through it, and snapshot the DOM at each state it reaches — validation errors shown, modal open, loader visible. Walking the flow is also how you finish the list from step 1 when no spec exists: the states you hit are the states your page object owes locators for.

Done when every element on that list has a selector you have watched resolve on the real page, and you know its expected count (one node, or n nodes reached by index).

### 3. Climb the selector ladder

For each harvested element, take the highest rung that resolves uniquely and stop:

1. `page.getByTestId("resupply-container")` — a `data-testid`, when the app ships one.
2. `page.getByRole("button", { name: "Next", exact: true })` — role plus accessible name. Add `exact: true` when a shorter name would also match.
3. `page.getByText("Forgot your Password?")` — visible copy, for links and static text.
4. `page.locator("#zipcode")` / `page.locator("[name='firstname']")` — id or name attribute.
5. `page.locator(".curated-review__item-name")` — class, when nothing above exists.

Scope a rung that collides rather than dropping to a weaker one: `page.locator(".qf-modal-container").getByRole("button", { name: "Next" })`, `page.locator('[data-testid^="order-status-cta-btn"]')`, `page.getByRole("button").filter({ hasText: "Proceed" })`.

Done when every locator sits on a named rung and you can say why the rung above it was unavailable.

### 4. Write the constructor block

```js
const { Page } = require("@playwright/test");
const { GenericPage } = require("./generic_page");

class UroPatientHubPage {
  genericPage = new GenericPage();

  constructor(page) {
    this.page = page;
    this.resupplyContainer = page.getByTestId("resupply-container");
    this.zipCode = page.locator("#zipcode");
    this.zipCodeError = page.locator("#zipcode-error");

    // insurance deficiency
    this.insuranceBlock = page.getByTestId("InsuranceBlock");
    this.editInsuranceButton = page.getByRole("button", { name: "Edit Insurance Details" });
  }
```

- `this.page = page;` is the first line, always.
- Every locator is declared here and nowhere else — specs read them directly (`await uroResupplyPage.insuranceGuidelinessCheckbox.isVisible()`), so locator names are public API. Name them for a reader.
- Pair every validated input with its error locator: `zipCode` / `zipCodeError`.
- Group locators by page region behind a `//` comment once the file covers more than one region.
- Reach the base the way the neighbours do — a class field, a constructor property, `extends` — and only when you need it; leave it out when you don't.
- Keep whatever header the neighbours carry, import style included, even where an import turns out to be ambient.

Done when every element from step 3 has a declared locator and every validated input has its error twin.

### 5. Write the thin methods

One Playwright call per method, named for the interaction rather than the call:

| The call | The method |
| --- | --- |
| `fill` | `enterFirstName(firstName)` |
| `selectOption` | `selectState(state)` |
| `click` | `clickNextButton()` |
| `textContent` on a field error | `getZipCodeErrorMessage()` |
| `textContent` / `getAttribute` | `getSuggestedSize()`, `getPullupStatus()` |
| `isVisible` | `isGotItModalDisplayed()` |
| `isEnabled` | `isPlaceOrderEnabled()` |
| a visibility loop | `waitForLoader()` |

- Methods reaching an indexed locator take the index: `clickAddToCartButton(index = 0)`, `selectProduct(productIndex)`.
- Compose only over your own methods: `enterBirthDate(m, d, y)` calls `enterBirthMonth`, `enterBirthDay`, `enterBirthYear`.
- Guard a button the app enables late with the base's enabled-wait, and leave the comment saying why:
  ```js
  async clickProceedToCheckoutButton() {
    await this.genericPage.waitForElementToBeEnabledDisabled(this.proceedToCheckoutButton, true);
    await this.proceedToCheckoutButton.click();
  }
  ```
- Put an inline timeout on the single call that needs it — `await this.pullups.click({ timeout: 15000 })` — not on the file.
- Assertions and navigation stay in the spec: `expect` and `goto` belong to the spec and the base, not to a page object.
- Read the base and the suite's helper directory before writing new behaviour — random dropdown selection, visibility and enabled waits, cookie-banner dismissal, network-idle waits, and accessibility scans are the things suites usually already have.
- Export the class the way the neighbours export theirs, CommonJS or ESM as the suite runs.

Done when every method wraps one call, no method holds an assertion or an inline locator, and the export names the class both sides.

### 6. Prove every locator resolves

Drive the live page again — a scratch spec, or the real spec if it is ready — and confirm each locator in the file resolves.

Done when every locator has either resolved to its expected count or is written down as reachable only in a state you could not produce, with the state named.

## New file conventions

- File name: copy the neighbours. List the pages directory, take the naming shape the majority of files already use — casing, separators, and the page suffix (`_page.js`, `.page.js`, `Page.js`) — and match it exactly. When the directory is split between two shapes, follow the one the files nearest your page use, and name the shape you picked in your summary.
- Class name: whatever form the neighbours export, likewise — commonly `PascalCase` ending in `Page`.
- One page object per page or per distinct flow; a multi-step form that shares one URL and one modal is one page object.

## Extending an existing page object

- Search the file for the element under any name first — a duplicate locator under a second name is the main failure here.
- Add locators inside the region comment they belong to and methods beside their siblings; leave the surrounding order alone.
- When the app has renamed an element, update the existing locator and its methods rather than adding a parallel set, then run the specs that consume them.
