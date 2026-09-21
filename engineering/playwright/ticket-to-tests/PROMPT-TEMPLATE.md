# Prompting `/ticket-to-tests`

This file is for the person typing the slash command. It is not read by the skill.
It lives beside `CONVENTIONS.md`, `EVIDENCE.md` and `TASKS.md`; the skill's argument hint points here.

Written 2026-09-10 from two real runs: CPP-8 (defect, CPAP PDP pricing, run through
`/grill-me` before the skill existed) and AFBP-1268 (feature, MAB curated header modal,
run through the first version of the skill). The current skill (questionnaire, contrast,
gate, evidence agent, tasks) has not yet run on a ticket. Expect to revise this after it does.

## One command

| Situation | What to type |
|---|---|
| Defect, or a small feature with one or two scenario groups | `/ticket-to-tests` + ticket |
| Feature with several acceptance criteria you want worked one slice at a time | same; answer **yes** to "Break into tasks?" in round 1 |
| Coming back to a ticket you already started | just the key, e.g. `/ticket-to-tests CPP-8` |

Choosing tasks makes the flow follow `TASKS.md`: one task per scenario group, tracked under
`docs/tickets/<KEY>/tasks/`, worked one slice at a time and resumable.

## Before you type the command

Every minute here saves ten later. On AFBP-1268 the first two and a half hours went to
these, one at a time, through three failed inspection agents.

- [ ] VPN is on. The storefronts, the login-link API and SQL Server all reject a non-allow-listed IP,
      and the failure looks like a spec bug (405 from the edge, 401 or 500 from the API).
- [ ] `playwright.config.js` line 9 points at the `.env` for the target env, and that file has the
      right base URL for the store you are testing (`CPAP_SUPPLIES`, `MAB_BASE_URL`, …).
- [ ] `.env` has `ENV=<env>` set. The login-link API builds the Magento admin host from it.
- [ ] If the build is on a PR preview (`*.m2.aeroflow.ninja`), the login-link service does not know it.
      Put a UI-login account's credentials in `.env` and name the variables in the prompt.
      Never paste an email or password in chat; it ends up in the transcript.
- [ ] The fixture exists on the target env: the product slug renders a price, the admin config is on,
      the CMS block has content, the pool patient has curated products.
- [ ] No other `npx playwright test` is running. global-setup rewrites `gcp-key.json` and `patients-lock.json`.

## The prompt

Paste this after the command. Keep the `KEY: value` header; paste the ticket and handoff
verbatim under their headings. Delete lines you do not know rather than guessing; the
questionnaire will ask.

```
TICKET: <KEY> — <title>
JIRA: <url>
UAT DOC: <absolute path to a UAT / handoff document: .md, .pdf, .txt; omit if none>
TYPE: defect | feature          (the skill confirms this, it does not assume it)
RELEASE BRANCH: <release name, e.g. 220, or the ticket key>
NEIGHBOUR SPEC: tests/specs/<BU>_<AC|React>/<closest existing spec>.spec.js
STORE ENV VAR: <CPAP_SUPPLIES | MAB_BASE_URL | SLEEP_BASE_URL | URO_RESUPPLY_BASE_URL | …>
TARGET ENV: <stage2> <exact URL the build is on>
CONTRAST: <defect: env where the bug still shows, or "fixed everywhere">
          <feature: edge cases worth a scenario, e.g. config off, guest, other step, other BU>
PROJECTS: chromium + mobile-chrome          (only say "chromium" if the surface is desktop-only)
LOGIN: none | login link | UI login, creds in .env as <VAR_EMAIL>/<VAR_PASSWORD>
PATIENTS: <one per state variant: "<label>: pool <MAB_curated>" or "<label>: .env <VAR_EMAIL>/<VAR_PASSWORD>">
FIXTURES: <slugs with SKU and product type, admin config state, CMS block contents that must exist>
ASSERTION NOTES: <exact text vs "non-empty"; what is admin-editable and will drift>
MANUAL / OUT OF SCOPE: <admin toggles, third-party embeds, anything not to automate>
DESIGN: <Figma link, feature only>

TICKET DESCRIPTION
<verbatim>

QA HANDOFF
<verbatim, or "none">
```

### Why each line is there

- **UAT DOC** is read in intake alongside the ticket. Its numbered test scenarios are treated as acceptance
  criteria, its config tables as fixtures, and its state tables (logged out / eligible / not eligible) as
  contrast candidates. Contradictions inside the doc become questionnaire items, not guesses. Strip credentials
  and personal emails from the doc before pointing the skill at it; name `.env` variables or pool names instead.
- **TYPE** decides the contrast question. Defect asks fixed env vs broken env. Feature asks for edge cases.
- **NEIGHBOUR SPEC** is where the skill reads the data strategy, utilities module and anti-noise preamble.
  Point at the spec whose journey is closest, not the smoke file.
- **TARGET ENV** with the URL removes the single biggest source of wasted time. Say "PR preview" explicitly.
- **CONTRAST** up front avoids the CPP-8 reversal, where "do not run on prod" became "we need prod to see the bug"
  two rounds later. "None available" is a valid answer and goes in the report.
- **PROJECTS** defaults to both. On AFBP-1268 the prompt said chromium only, then two mobile-only handoff items
  forced a change of plan.
- **LOGIN** is the second biggest time sink. Say how a session is obtained on the target env and where the
  secret lives. The skill will not alter `.env`.
- **PATIENTS** is the patient-state contrast, one line per variant the feature branches on (eligible for
  bundles, eligible for one class, no eligibility, deficient, other BU). Each names a pool tag in
  `data/patients.json` or a pair of `.env` variables. LOGIN says *how* a session is made; PATIENTS says *who*.
  A variant with no patient is still listed, with "none available", so the plan can state the gap.
- **ASSERTION NOTES** is where "I am nervous it will not say Help Me Choose, just assert there is text" belongs.
  On AFBP-1268 that arrived after the plan was written.
- **MANUAL / OUT OF SCOPE** keeps the Gherkin honest: those items are still written into the feature file as
  comments so Jira sees them, but no test is attempted.

### Do not include

- Anything in `CONVENTIONS.md`. Branch naming, Gherkin path, spec naming, Testing Suite
  edit, allure tag, `expect.poll`, computed prices, skip-on-missing-fixture are settled and will not be asked.
- Expected values quoted from the ticket ("price should be $326.00"). Prices differ per env and over time;
  the spec computes unit price × qty from what the page shows.
- Pre-written Gherkin as the plan. See "About writing the Gherkin yourself" below.
- Free text meant as approval ("looks good", "perfect"). Only the questionnaire option **Implement the plan**
  starts implementation. Free text at the gate is treated as plan feedback.

### About writing the Gherkin yourself

Not by default. The plan's value is in the scenarios the ticket does not spell out: the baseline the ticket
cites as correct, and one scenario per contrast. Pre-written scenarios anchor the plan to your list and tend
to carry ticket-quoted values. What helps more is a **numbered list of acceptance criteria** in the handoff;
on CPP-8 the two numbered issues mapped one-to-one onto scenario groups, and on AFBP-1268 the handoff's
"Testing:" bullets did the same.

If you already have scenarios (from QA, from Jira, from a previous attempt), paste them under a heading
`DRAFT SCENARIOS` after the handoff. They are read as acceptance criteria, not as the plan, and the plan
message will say which were kept, merged or dropped and why.

## What still gets asked

The questionnaire runs in rounds through `AskUserQuestion`; one click confirms an inferred value. Expect:

- Round 1: type, contrasts (multi-select per category), ticket key, target env, release branch,
  break into tasks (feature).
- Later rounds: fixtures per scenario, scope per acceptance criterion, assertion strictness per scenario,
  any new page-object file with the rejected candidates named, out-of-scope items.
- The gate: **Implement the plan** / **Revise the plan** / **Stop here**.
- During implementation, only when something the plan did not cover appears (a locator that does not resolve,
  a missing fixture).

Answer with the option, or "Other" with a short reason. Numbered replies to numbered questions worked well
in both past sessions.

## Worked example, defect (CPP-8)

```
TICKET: CPP-8 — CPAP bundle PDP price does not follow quantity
JIRA: https://aeroflow.atlassian.net/browse/CPP-8
TYPE: defect
RELEASE BRANCH: 220
NEIGHBOUR SPEC: tests/specs/CPAP_AC/cpap_smoke_testing.spec.js
STORE ENV VAR: CPAP_SUPPLIES
TARGET ENV: stage2 https://cheapcpap.stage2.m2.aeroflow.dev
CONTRAST: prod https://cpapsupplies.com still shows issue 1 and 2 (read-only PDP, safe to run by hand)
PROJECTS: chromium + mobile-chrome
LOGIN: none
PATIENTS: none
FIXTURES: bundle /airtouch-f20-full-face-cpap-mask-by-resmed; a simple and a configurable slug for the
          baseline, pick ones that render a price on stage2 and prod
ASSERTION NOTES: assert price = unit × qty and that the price changed; never the dollar figures in the ticket
MANUAL / OUT OF SCOPE: none

TICKET DESCRIPTION
On PROD/all envs, if you navigate to a CPAP Bundled Product PDP … when you increase the quantity it does NOT
update the price as expected. …
Second issue: … you have to click OUTSIDE of the QTY field before you see the base price update …
Other product types (simple and configurable) will reflect the price change as expected.

QA HANDOFF
none
```

Output to compare against: `tests/features/CPAP_AC/CPP-8.feature` and `tests/specs/CPAP_AC/cpap_pdp_pricing.spec.js`.

## Worked example, feature (AFBP-1268)

```
TICKET: AFBP-1268 — Help Me Choose Modal - Breastpump
JIRA: https://aeroflow.atlassian.net/browse/AFBP-1268
TYPE: feature
RELEASE BRANCH: AFBP-1268
NEIGHBOUR SPEC: tests/specs/MAB_AC/mab_curated_shopping.spec.js
STORE ENV VAR: MAB_BASE_URL
TARGET ENV: PR preview https://breastpump.pr10364.m2.aeroflow.ninja (.env already points here, ENV set)
CONTRAST: next curated step has no header link (scoping); Enable Header Modal = No is manual
PROJECTS: chromium + mobile-chrome (full-screen vs right drawer, outside-click only on desktop)
LOGIN: UI login, creds in .env as MAB_QA_EMAIL / MAB_QA_PASSWORD (login-link API does not know PR previews)
PATIENTS: curated patient on the Breast Pump step: .env MAB_QA_EMAIL / MAB_QA_PASSWORD
FIXTURES: Header Modal enabled on the Breast Pump step with a CMS block that has body text and at least
          one link
ASSERTION NOTES: link label is admin-editable, assert non-empty text, not "Help Me Choose"
MANUAL / OUT OF SCOPE: admin toggle off; links open in new tab; style match is screenshots beside Figma
DESIGN: https://www.figma.com/design/…?node-id=840-4752

TICKET DESCRIPTION
<verbatim>

QA HANDOFF
<verbatim "Testing:" bullets>
```

Output to compare against: `tests/features/MAB_AC/AFBP-1268.feature` and
`tests/specs/MAB_AC/mab_curated_header_modal.spec.js`.

## Reference spec

`tests/specs/CPAP_AC/cpap_pdp_pricing.spec.js` is the model output. When you want to point the skill at
"do it like this", name this file. Things to notice in it:

- Header comment names the ticket and the feature file.
- `testCases` array at module scope mirrors the `Scenario Outline` `Examples` table.
- `snap(page, cpapPage, testInfo, label)` attaches a captioned JPEG per Gherkin state; caption format is
  `<n> <label> | qty: <v> | price: <v>`, which the report tabulates.
- `expectDisplayedPriceToBe` uses `expect.poll` so the quantity field is never blurred by the assertion.
- `openPdp` waits on the price block's own readiness, runs the anti-noise preamble, and `test.skip`s with a
  reason when the slug does not render a price on that env.
- Titles mirror scenario names and end in `[CPP-8]`.

## Test-driving the skill without side effects

The CPAP PDP flow is read-only: no lead, no order, no patient. Use it to check the skill itself.

1. Run the preflight checklist with `.env` on stage2.
2. Type `/ticket-to-tests` followed by the CPP-8 example above, changing the key to a scratch key such
   as `CPP-8-DRY` so it does not resume the real ticket. (`docs/tickets/` is gitignored; delete the
   scratch folder afterwards.)
3. Answer the rounds. At the gate choose **Stop here**.
4. Compare the proposed Gherkin with `tests/features/CPAP_AC/CPP-8.feature`. Same scenario groups, a baseline
   scenario per product type, an environment contrast named, computed prices only. Differences are either
   a skill regression or an improvement; either way they are worth a note.
5. For a full pass, choose **Implement the plan** instead and confirm the spec collects under both projects,
   both env runs produce JSON under `docs/tickets/CPP-8-DRY/results/`, and `report.html` opens with the
   fallible inversion recorded. Discard the branch afterwards.
