# Conventions (settled; apply without asking)

Decided 2026-09-04 during CPP-8, amended 2026-09-10 (contrast, ticket folder, gate, ownership). Change here, not per ticket.

## Branch and commits
- Branch name = **release name** (e.g. `220`), created from `master` at the start of step 4 if it does not exist yet. The name is asked in step 2 unless the current branch already is a release branch.
- One commit per ticket: `KEY: summary`, body carries red/green results and dates. Never commit before the user reviews. Never push.

## Gherkin
- Path `tests/features/<suite folder>/<KEY>.feature`, mirroring the spec folder (`CPAP_AC`, `MAB_AC`, `URO_React`, …).
- Documentation only. No cucumber runtime. Header comment states this and names the spec file.
- Tags: the ticket key and the allure value the spec uses (`@CPP-8 @ui_input_validation`).
- Declarative steps, except where the exact interaction *is* the defect (e.g. "When I type 3 into the quantity field without leaving it"). Anti-noise preamble (Kameleoon, Osano, Klaviyo, loaders) stays out of Gherkin.
- A `Scenario Outline` with `Examples` for every axis the ticket compares (product type, business unit); it maps to the spec's `testCases` array.
- Comment each scenario group with the ticket issue it covers ("# CPP-8 issue 2: …").
- The Gherkin block is also pasted into chat so the user can copy it into Jira.

## Spec
- New **feature-area** file per business unit (`cpap_pdp_pricing.spec.js`), never the smoke file, never one file per ticket.
- Test titles mirror scenario names, data case appended, then the suffix `[KEY]`. The custom reporter matches title prefixes, so a suffix is safe.
- `test.slow()`, `await allure.tag("ui_input_validation")` (or `sql_input_validation`), page objects instantiated inside the test.
- **No helper functions in the spec.** The spec holds only `require`s, module-scope instances of stateless helpers, fixtures, and tests whose bodies read as the scenario's steps and assertions. Every reusable `async function` goes to `tests/util/`: flow, wait and geometry helpers that take page objects as parameters go in the business unit's `<bu>Utilities.js` class (`uroUtilities.js`, `mabUtilities.js`, …) under a `// ---- <surface> (<KEY>) ----` section; cross-BU helpers (banner waits, viewport fixes) go in `utilities.js`; evidence capture uses `tests/util/evidence.js`. A new util file is a questionnaire item in step 2, like a new page object. The one thing that may stay in the spec is a pure assertion function that *is* the ticket's claim (e.g. `verifySearchDirectlyBelowPhone(geometry)`), because moving it would hide the test's judgment in a util.
- **Add the filename explicitly** to the Testing Suite entries for the suite (desktop and mobile: the `elif` lines that set `TEST_FILE_ARGS`) in `.github/workflows/playwright-tests.yml`. The name is "Testing Suite", never "CI glob". Prod smoke globs stay untouched: regression files do not run on prod in CI. Running against prod by hand for a red proof is fine when the flow is read-only.
- Keep both `chromium` and `mobile-chrome` unless the surface is desktop-only.
- Fixtures are hardcoded slugs or pool patients at module scope, present on every env the tests run against. Missing fixture → `test.skip("<what>, <where>, <why>")`, and the skip goes in the report.
- Expected values are **computed** from what the page shows (unit price × qty, sum of line items), never the figures quoted in the ticket.
- Assertions on live-updating values use `expect.poll`, which waits without touching focus. Assert focus or field state *before* taking any screenshot (see EVIDENCE.md).
- Readiness waits use the component's own loaded marker (e.g. `.price-template.loaded`), not `waitForLoadState("load")`.
- Page objects: extend the existing file that covers the surface; a new file only after the questionnaire item naming the rejected candidates. Locators as fields, thin verb methods, no assertions. Prefer `select.<class>` over `[id^=…]` when hidden inputs share the prefix. Klaviyo's promo modal is matched by `getByLabel("Close dialog")` and can be blocked with `genericPage.turnOffKlaviyo(page)`.

## Environments
- URL per env comes from the `Create .env` step in `playwright-tests.yml`; non-prod AC stores follow `https://<store>.<env>.m2.aeroflow.dev`.
- Override on the shell per run: `CPAP_SUPPLIES=https://cpapsupplies.com npx playwright test <spec> --project=chromium`. `.env` is loaded without `override`, so the shell wins.
- Run sequentially, not two `npx playwright test` processes at once: global-setup writes `gcp-key.json` and regenerates `patients-lock.json`.
- Playwright clears `test-results/` per run; keep evidence in JSON reporter output (`PLAYWRIGHT_JSON_OUTPUT_NAME`) under the ticket folder's `results/`, where `testInfo.attach` bodies are embedded as base64.

## Repo gotchas
- `.gitignore` ignores `*.md` and `docs/`: `CLAUDE.md` edits and anything under `docs/` are local-only and will not be in the commit. Say so when it matters.
- The CPAP Testing Suite entry lists literal filenames; other suites use `*.spec.js`. Check the entry for the suite you touch.

## Ticket folder
- `docs/tickets/<KEY>/` (gitignored, local-only) is the one place for a ticket's working state:
  - `README.md`: key, title, type, plan status (`proposed` → `approved` → `committed`), contrasts chosen and which turned out unavailable, target env, release branch, report path, and the task table when tasks were chosen (`TASKS.md`).
  - `manifest.json`, `report.html`: owned by the evidence agent (EVIDENCE.md).
  - `results/<run>-<env>.json`: JSON reporter output per run. `<NN>-<env>` per task, `spec-<env>` for whole-spec and contrast runs.
  - `tasks/<NN>-<slug>.md`: only when tasks were chosen (`TASKS.md`).
- A key whose folder exists resumes from the README instead of re-running intake.

## Contrast
- Every plan names its contrasts. User, configuration and data contrasts become Gherkin scenarios; environment contrasts are report runs; Figma frames are the report's reference section; the fallible inversion always runs. Unavailable contrasts are stated in the report, never dropped silently.

## Gate and ownership
- Step 4 starts only on the `AskUserQuestion` option "Implement the plan". Free text, including "looks good", is feedback.
- Main agent writes: feature file, spec, page objects, Testing Suite edit, README, task files. Evidence agent writes: manifest, report script, report. No file has two writers.
