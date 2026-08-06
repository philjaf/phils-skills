---
name: triage-af-failure
description: Triage a failing or flaky test in the Aeroflow Playwright suite to a verdict, then fix test-side causes and report the rest.
disable-model-invocation: true
---

# Triaging an Aeroflow Test Failure

A red test is a claim, not a fact. The job is the **verdict**: which of five things went wrong. Reach it from evidence, then act on it — and the two verdicts that are not the test's fault are handed back rather than patched around.

**No edit before the verdict.** Changing a wait or a selector to see if red goes green destroys the evidence and converts a product bug into a passing test. Diagnose, then fix.

| Verdict | Meaning | What you do |
| --- | --- | --- |
| **app bug** | The product is wrong. The test caught it. | Report. Never adjust the test to accommodate it. |
| **environment** | Infrastructure or a prerequisite failed. The app was never exercised. | Report, with the prerequisite named. |
| **stale** | The app changed legitimately; the test still describes the old app. | Fix test-side — selectors, copy, flow order. |
| **flake** | The test is timing-dependent. Same code, same app, different outcome. | Fix test-side — wait on the condition that was missing. |
| **data** | The patient was not in the state the test requires. | Fix the spec's setup; report if the data source itself is broken. |

## Steps

### 1. Gather the evidence

**From a CI run** — the merged Allure report at `allure-reports.aeroflow.ninja/report/<timestamp>/index.html` (the URL is an output of `merge-allure-reports.yml`, and `executor.json` in the run carries it). Read the failed test's `statusDetails.message`, the step it died in, and its attachments. Allure history comes down from S3 on every run, so the report also shows whether this test has failed before — use it.

For the workflow side: `gh run list`, then `gh run view <id> --log-failed`. Note which inputs the run used — `adobe-commerce-env`, `nx-fe-env`, the preview env number — since a failure against a preview environment is a different animal from one against stage.

**From a local run** — `npx playwright show-report` for `playwright-report/`, and the per-test directory under `test-results/` holding `trace.zip`, the video, and the failure screenshot. Open the trace: `npx playwright show-trace test-results/<dir>/trace.zip`. The trace is the strongest evidence in the suite; use it before theorizing.

Either way, establish four things: the exact error text, the last `test.step` that completed, the URL at the moment of failure, and whether the test passed on a retry.

Done when you have all four written down. **A test that failed and then passed on retry is a flake by definition** — CI runs `retries: 2`, and this matches how the dashboard plan counts flaky (`passed` with `retry > 0`), so record it that way and skip to step 4.

### 2. Read which timeout fired

The error text names the layer that gave up, and each points at a different verdict. The configured limits are test 80s, action 15s, navigation 30s, expect 10s.

- `Test timeout of 80000ms exceeded` — the journey stalled as a whole. Find the last completed step; the cause is usually upstream of the line that reported it. Often **environment** (RTE) rather than the element mentioned.
- `locator.click/fill: Timeout 15000ms exceeded` — one element never became actionable. **stale** if the DOM no longer has it, **flake** if it arrives late.
- `page.goto` / `waitForURL` timeouts — **environment** first: DNS, the wrong `.env`, or a service that never responded.
- An `expect(...)` mismatch on real content — **app bug** or **stale**; nothing else produces a value that is simply wrong.
- `Test timeout` on `mobile-chrome` only — the suite runs two projects. Passing on `chromium` and failing on `mobile-chrome` is a viewport problem, not a flake.

Done when the error text is attributed to a layer.

### 3. Clear the known transients before anything else

This is the cheapest step and it settles a large share of red runs. Match the error against the suite's own environment patterns — `RTE failure`, `DNS Resolution Failed`, `ERR_NAME_NOT_RESOLVED`, `Database deadlock error` — and against the known false-failure sources:

- **RTE did not come back.** `uroRteTryCatch` throws naming this directly ("probably because of RTE failure"). Verdict **environment**; the eligibility service, not the test.
- **`recapError` on the MAB qualify endpoint.** Check the runner IP is on the reCAPTCHA allowlist (`global-setup.js` adds it via gcloud and sets `WHITELISTED_IP`). If the allowlist is correct and stage still rejects, this is the documented escalation in `docs/recaptcha-enterprise-escalation.md` — verdict **environment**, and the doc is the deliverable.
- **A/B variant changed the DOM.** Kameleoon serves variants that move elements. `genericPage.turnOffKameleoon` and `utilities.gotoTurnOffABTesting` exist for this; a test that lacks them and fails intermittently on layout is **flake** with a known fix.
- **The Osano cookie dialog swallowed a click.** `genericPage.closeOsanoDialog`.
- **Address autocomplete never offered a suggestion** (Smarty) or **the Mailosaur email never arrived** — **environment** when the third party is down, **flake** when the test raced it.
- **SQL failures.** A deadlock is a transient (`clearTestPrefix` already retries three times); an unreachable server is **environment**; an empty recordset where the query expected rows is **data**.
- **`No available patients for bu`** thrown by `claimPatient` — the pool in `data/patients.json` is exhausted or a previous run left locks set. Verdict **data**: reseed via the `test_patient_setup` specs, or note that `global-setup.js` resets the lock file at the start of every run.
- **A leaked prefix from an earlier crashed run** polluting this one — verdict **data**.
- **The wrong `.env`.** The env file is chosen by hand-editing the `dotenv` path in `playwright.config.js`; confirm the run targeted the environment you think it did before blaming the test.

Done when the failure is either assigned to **environment** or **data** and reported, or ruled out of both.

### 4. Reproduce, narrowly

Run just the failing test: `npx playwright test <path> -g "<test title>" --headed --project=chromium`. For a suspected flake, run it repeatedly (`--repeat-each=5`) and count.

What the outcome means: fails every time → **app bug** or **stale**. Passes every time → **flake** or **environment**, and the CI-versus-local difference is itself the clue. Mixed → **flake**, and the repeat count is your evidence.

Note the `describe.serial` shape when reproducing: a `"backend data validation"` test reads what its `"verify UI workflow"` sibling wrote through the module-level `patient`, so running the validation test alone will fail for reasons that have nothing to do with the bug. Reproduce the whole describe block.

Done when you can state the failure rate out of a known number of attempts.

### 5. Commit to the verdict

State it in one line with the evidence behind it: the verdict, the error, the failure rate, and what you ruled out. If two verdicts are still live, the evidence is not yet enough — go back rather than picking the convenient one.

Done when one verdict is named and the evidence for it would convince someone who had not seen the run.

### 6a. Fix — stale, flake, or data

Only these three. The remedy for a flake is the condition the test failed to wait for, never a longer pause:

| Symptom | Remedy |
| --- | --- |
| Clicked a button the app had not enabled yet | `genericPage.waitForElementToBeEnabledDisabled(locator, true)` |
| Acted before an element appeared or after it should have gone | `genericPage.waitForElementToBeVisibleInvisible(locator, true/false)` |
| Read a page mid-navigation | `utilities.waitForUrlWithErrorHandling(page, /regex/)`, `gotoWithErrorHandling` |
| Raced a loading mask | the page object's own `waitForLoader`, or `utilities.loaderTryCatch` |
| Raced background XHR | `genericPage.waitForNetworkIdle(page)` |
| Selector no longer matches | Re-harvest it from the live page, taking the highest rung that resolves uniquely: test id, then role plus name, then visible text, then id or name attribute, then class |
| A precondition the test cannot create | `utilities.skipTestWithError("<why>")`, which is how this suite declines rather than fails |

Keep the change as small as the verdict justifies, inside the page object when it is a locator or a wait and inside the spec when it is setup. Match the conventions of the file you are editing and leave the rest of it alone — the neighbouring specs are the pattern of record, including the parts you would have written differently. The sibling `writing-af-specs/SKILL.md` spells those conventions out if you need them.

Done when the test passes three consecutive runs, the change addresses the named cause rather than the symptom, and nothing the run created outlives it.

### 6b. Report — app bug or environment

The deliverable is the report; the test stays as it is, red and correct.

Give: the verdict, what the product did versus what it should do (or which prerequisite failed), the exact error, the URL and step, the reproduction rate, and a pointer to the trace, video, or Allure page. For the reCAPTCHA case the escalation doc is already written — say so rather than restating it.

Done when someone who owns the app or the environment could act on the report without rerunning anything.
