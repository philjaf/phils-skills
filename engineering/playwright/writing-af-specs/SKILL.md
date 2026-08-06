---
name: writing-af-specs
description: Write or extend a spec in the Aeroflow Playwright suite — test-data lifecycle, business-unit wiring, Allure narration, waits that hold.
disable-model-invocation: true
---

# Writing Aeroflow Specs

Two rules carry this suite, and most spec bugs are one of them broken.

**Nothing outlives the run.** Every patient a spec creates or borrows is handed back: a **prefix** gets cleared, a **claim** gets released. A spec that leaves data behind poisons the next run rather than its own.

**Wait on a condition, not the clock.** The suite has helpers that wait for the state you actually need. Reach for those, and the spec survives a slow environment.

The **neighbour** — the existing specs in the same business-unit directory — is the pattern of record. Most of this suite was written by one engineer over 160-odd commits and it is internally consistent; match it rather than improve it. Leave the formatting, ordering, and idioms of existing specs alone, and add beside them.

## Steps

### 1. Read the neighbour

Specs live in `tests/specs/<BU>_<frontend>/` — `URO_AC`, `URO_React`, `MAB_AC`, `MAB_React`, `CGM_AC`, `CGM_React`, `Sleep_React`, `CPAP_AC`, `Motif_AC`, plus `Cognito_React`, `nx`, `Visual_Tests`, and `test_patient_setup`. `_AC` is the Adobe Commerce (Magento) storefront; `_React` is the newer frontend. The same journey exists in both for several BUs, and they are not interchangeable.

Open the two closest specs in your target directory. If your journey exists for another BU — address validation, curated shopping, resupply, my account, lead generation all exist several times over — open that one too, since porting it is most of the work.

Done when you can state: which data strategy the neighbours use (step 2), which utilities module they load (`uroUtilities`, `mabUtilities`, `cgmUtilities`, `sleepUtilities`), the `insertIntoSysTestingPreferences` IDs they pass, and whether they pair a UI test with a data-validation test.

### 2. Choose the data strategy from the neighbour

Two live in the suite. Take whichever the neighbours take — do not introduce the other one into a directory that does not already use it.

**Prefix** — create a fresh patient, tagged so it can be deleted afterwards. Used by the URO, CGM, and Sleep specs.

```js
testPrefix = await utilities.beforeEachGetTestPrefix(internalDBQuery);
await internalDBQuery.insertIntoSysTestingPreferences(testPrefix, 153);
await internalDBQuery.turnOnTestLeadPrefix(testPrefix);
```

- The preference IDs are feature switches and they differ by BU and journey — URO resupply passes `153` and `154`, CGM passes `220`. Copy them from the neighbour; a guessed ID silently changes what the app does.
- Tag the patient so the prefix owns it: `patient.firstName = testPrefix + faker.name.firstName(patient.gender) + "test"`, and `lastName` suffixed `"test"` too.
- Read the created patient back with `internalDBQuery.getTextPrefixPatientData(testPrefix)` → `recordset[0].TestingPatientId`.
- Clear it in teardown: `await internalDBQuery.clearTestPrefix(testPrefix)`.

**Claim** — borrow a pre-seeded patient from the pool in `data/patients.json`. Used by the newer MAB specs.

```js
testPatientData = claimPatient("MAB");   // in test.beforeAll
releasePatient(patient.patientId);       // in test.afterAll
```

- The pool is locked through `data/patients-lock.json`, which `global-setup.js` rebuilds unlocked at the start of every run.
- Release the same id you claimed, and assign it (`patient = testPatientData`) where a failure cannot skip the assignment — a claim released with an undefined id leaves the patient locked for the rest of the run.

Done when the spec has a strategy, its cleanup hook is written, and the IDs came from a neighbour rather than from you. The only specs that skip cleanup are the four in `test_patient_setup`, whose whole purpose is to leave a seeded patient behind.

### 3. Build the patient at module scope

The house shape is a single mutable `patient` object built at module scope from faker, filled in further inside the hooks:

```js
let patient = {};
patient.gender = faker.name.sex().charAt(0).toUpperCase();
patient.dob = utilities.generateValidInvalidDate(45, -18);
patient.phoneNumber = faker.phone.number("303-4##-####");
patient.state = "North Carolina";
patient.stateAbbreviation = utilities.stateNameToAbbreviation(patient.state).abbreviation;
patient.zipCode = "28803";
patient.memberId = "123456789A";
```

- Email always goes through Mailosaur: `` `${randomValue}@${process.env.MAILOSAUR_SERVER}.mailosaur.net` ``, with `randomValue` from `utilities.generateRandomValue()`.
- Take the known-good address, insurance, and card values from the neighbour rather than inventing them — they are chosen to pass address validation, payer lookups, and RTE.
- Reach for `utilities` before writing a generator: dates, state abbreviations, the BU dropdown value maps (`diabetesTypeDropdown`, `insulinCountDropdown`, `birthTypeDropdown`), `businessUnitMapping`, `getRandomInsurance`, `testCreditCardNumbers`.

Done when every field the journey needs is set before the test body reads it.

### 4. Wire the lifecycle

Follow the neighbour's hook shape. The two in use:

- `test.beforeEach` / `test.afterEach` around a single independent test — the React specs.
- `test.describe.serial(...)` holding a `"verify UI workflow"` test and a `"backend data validation"` test that reads what the first one wrote, with `beforeAll`/`afterAll` for the claim — the Adobe Commerce specs. State passes between them through the module-level `patient`, which is exactly why they are `.serial`.

Also: `test.slow()` opens nearly every test in this suite (215 of them), and AC specs that call the Magento API get an auth token in `beforeAll` via `magentoAPI.authToken()`.

Done when the hooks match the neighbour and the cleanup from step 2 is attached to the outermost scope that can still run it.

### 5. Narrate the flow in steps

Wrap each phase of the journey in `await test.step("...", async () => {...})`. These are the report: Allure is read by PMs, POs, and manual QA, so the string says what a person did — `"Complete the shipping page by selecting the type-ahead address dropdown in address line 1"`, not `"step 4"`. Tag data-validation tests the way the neighbours do: `await allure.tag("sql_input_validation")` or `"ui_input_validation"`.

Inside the steps:

- Drive the page through its page object, never through raw locators in the spec.
- Reuse the journey helpers rather than rebuilding a flow: `utilities.uroLeadGeneration`, `sleepLeadGeneration`, `cgmLeadGeneration`, `uro4StepLeadGeneration`, `enterCompleteShippingInfo`, `addDoctor`, `enterCreditCardInfo`, `createRtePatientAndGetLoginLink`, `initialCognitoSetup`, and the per-BU utilities modules.
- Wait on conditions: `genericPage.waitForElementToBeVisibleInvisible`, `waitForElementToBeEnabledDisabled`, `waitForNetworkIdle`, `utilities.waitForUrlWithErrorHandling`, `gotoWithErrorHandling`, `loaderTryCatch`, and the page object's own `waitForLoader`. When you believe a fixed pause is the only option, say so in your summary with what you tried — the suite already carries 243 of them and they are the top source of flake.
- Environment reads go through `process.env` — the BU base URL (`URO_BASE_URL`, `CGM_BASE_URL`, …), `MAILOSAUR_SERVER`, `IS_PROD` for the production-eligible specs.

Done when every phase sits in a named step and no locator, URL, or credential is inlined in the spec that belongs to a page object, an env var, or a utility.

### 6. Validate the data when the journey writes any

If the journey creates an order, a lead, or an address, the suite expects the write to be checked, not just the UI: `utilities.verifyOrderDataInAdobeAndInternal`, `verifyAddressDataInAdobeAndInternal`, `verifyAddressDataInInternal`, `internalDBQuery.incomingLeadPrizmValidation`, or the BU pricing and tracking queries. Guard the results with `utilities.sqlResultsCheck` so a missing row fails with a readable message.

Done when either the write is asserted, or you have said which write is going unchecked and why.

### 7. Run it, twice

Run the spec (`npx playwright test <path> --headed --project=chromium` while iterating). Then run it again without cleaning anything by hand.

Done when it passes twice in a row, and after the second run the prefix is cleared or the patient is unlocked — the second pass is what proves rule one holds.

## Extending an existing spec

- Add a test case beside its siblings inside the existing `describe`, reusing that file's patient object and hooks.
- When a shared helper needs a change, check every spec that calls it before editing — `utilities.js` is loaded by nearly the whole suite.
- Leave unrelated formatting, ordering, and idioms untouched, including the ones you would have written differently.
