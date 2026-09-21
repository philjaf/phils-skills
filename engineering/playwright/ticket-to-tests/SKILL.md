---
name: ticket-to-tests
description: Turn a Jira ticket (with or without a QA handoff) into a Gherkin test plan, then Playwright regression tests with screenshot evidence and an HTML report, for the Aeroflow suite. A ticket key alone resumes one.
disable-model-invocation: true
argument-hint: "Paste the ticket description and QA handoff (format: PROMPT-TEMPLATE.md in this skill), or a ticket key to resume"
---

# Ticket to Tests

The user pastes a ticket, or names a ticket key to resume. You return a **test plan in Gherkin**, get it approved through the gate in step 3, then deliver **green tests with evidence**: captioned screenshots and an HTML report the user can attach to the ticket. Nothing is committed until the user has reviewed.

Structural decisions are settled in [`CONVENTIONS.md`](CONVENTIONS.md); read it first and apply it without re-asking. Evidence capture, the evidence agent, and the report are in [`EVIDENCE.md`](EVIDENCE.md). This repo's spec and page-object rules are in `~/.claude/skills/writing-af-specs/SKILL.md` and `~/.claude/skills/page-object-models/SKILL.md`; read both before step 4. When the questionnaire chooses tasks, read [`TASKS.md`](TASKS.md) and follow its hooks where a step names them.

## Two words this skill thinks with

**Questionnaire.** Every question to the user goes through the `AskUserQuestion` tool, never a printed list. Up to four questions per call, the recommended option first and marked "(Recommended)", and any fact you have already inferred (ticket key, branch, env) offered as option 1 so one click confirms it. "Other" is the user's free-text escape. A question with no inferable option 1 is a lookup you have not done yet.

**Contrast.** A test is proven only when you have seen what it looks like when the behaviour differs. For a defect the contrast is usually another environment (fixed here, broken there). For a feature it is usually an edge case: a configuration off, a guest instead of a logged-in patient, a product variant without the option. Draw candidates from five categories: configuration (admin setting, Kameleoon flag, product option present or absent), auth state (guest, logged in, login link), patient or user state (deficiency, insurance, business unit), data variant (product type, quantity, price tier), environment (fixed env vs broken env). The inverted assertion (step 5, fallible) always runs and is the weakest contrast. "None available" is a legal answer that the report must state.

## 0. Resume check

If the arguments name a key and `docs/tickets/<KEY>/README.md` exists: read it, print one status line (type, plan status, tasks green of total or spec status, report path), and continue from where it stopped. Plan `proposed` → step 3. `approved` → step 4 at the first unfinished task, or the spec when there are no tasks. Otherwise start at step 1.

## 1. Intake: build the fact sheet

Read the ticket and handoff. When the arguments name a `UAT DOC`, read the file too (the `Read` tool handles `.pdf`, `.md`, `.txt`): numbered test scenarios are acceptance criteria, config tables are fixtures, state tables are contrast candidates, and any value the doc states two ways is a questionnaire item, never a guess. Infer **defect** or **feature**; step 2 confirms it, never assume it. Gather facts yourself, in parallel, without asking the user:

- **Patients**: for each `PATIENTS` line, confirm the pool tag exists in `data/patients.json` or the named `.env` variables are listed in `.env.example`; a variant with neither is a "none available" contrast the plan must state.
- **Repo**: the suite folder for this business unit; the Testing Suite entry in `.github/workflows/playwright-tests.yml` (the `elif` lines that set `TEST_FILE_ARGS`; say "Testing Suite", never "CI glob"); the env-var name for the store's base URL, from the workflow's `Create .env` step.
- **Page objects**: list every file under `tests/pages/` whose locators or URL cover the surface, and write the decision: *extend `<file>`*, or *new `<file>` because none of `<candidates>` covers `<surface>`*. A new file is a questionnaire item in step 2, never a silent choice.
- **Util helpers**: read the business unit's `tests/util/<bu>Utilities.js`, `utilities.js` and `evidence.js`, list the existing methods the flow can reuse, and name the util file each new helper goes in. Helpers never live in the spec (`CONVENTIONS.md` § Spec).
- **Live page**: dispatch an agent to inspect the target page on the target environment: exact selectors, dialogs that block interaction, the elements the ticket talks about, a run-through of the ticket's steps with observed values, and every toggle, state or variant that could serve as a contrast. When there is **no handoff**, this inspection is where the repro comes from.
- **Environments**: derive each env URL from the workflow's `Create .env` step. `.env` itself is not readable; never depend on it. Base URLs are overridden per run on the shell.

Done when: every noun in the ticket maps to a selector or a fact, the repro steps are written down, the page-object decision is written, and candidate contrasts exist per category.

## 2. Questionnaire rounds

Work the open decisions as a design tree in rounds of `AskUserQuestion` calls: ask everything askable now, wait, recompute, ask again. Everything in `CONVENTIONS.md` is settled and is never asked.

Round 1 always contains:
- **Type**: defect or feature, preselected from the ticket or the user's arguments.
- **Contrasts**: the concrete candidates from the fact sheet, multi-select per category, plus "none available". For a defect, preselect the environment contrast and ask which env is fixed and which still shows the bug.
- **Ticket key**, **target env**, **release branch**: inferred values as option 1.
- **Break into tasks?** when the type is feature; preselect yes when the ticket has several acceptance criteria. Yes → read `TASKS.md` before step 3.

Later rounds cover what round 1 unlocked: which `PATIENTS` variant backs each scenario, fixtures per scenario, scope per acceptance criterion, assertion strictness per scenario (exact text, non-empty, count), any new page-object file with its rejected candidates, out-of-scope items.

Done when: the frontier is empty, meaning no remaining answer would change the plan.

## 3. Plan and gate

Write the feature file content following `CONVENTIONS.md` § Gherkin. Cover the ticket's defect or acceptance criteria, the baseline behaviour the ticket cites as correct, and one scenario per selected user, configuration or data contrast. Under it, the implementation plan: files to create or touch, the page-object decision with rejected candidates, locators and helpers to add, how expected values are computed, fixtures, and the verification plan (which contrasts are scenarios, which are runs, which env proves what). **Tasks hook:** the task list with blocking edges.

Write `docs/tickets/<KEY>/README.md` (`CONVENTIONS.md` § Ticket folder) with plan status `proposed`. Present the Gherkin and plan in chat, then call `AskUserQuestion` with exactly three options: **Implement the plan**, **Revise the plan**, **Stop here**. Only the first starts step 4. Any free-text reply, including "looks good" or "ok", is feedback on the plan: fold it in and ask again.

Done when: the user has chosen *Implement the plan*. Only then flip the README to `approved` and create repo files.

## 4. Implement

Get onto the release branch: switch to it if it exists, otherwise create it from `master`. Spawn the evidence agent (`EVIDENCE.md` § Evidence agent) with the scenarios as pending. Then create the feature file, the spec, page-object additions, the `tests/util/` helper additions (`CONVENTIONS.md` § Spec: no helper functions in the spec), and the Testing Suite edit exactly as `CONVENTIONS.md` prescribes, with evidence capture from `EVIDENCE.md` in every test. Run prettier on touched files. **Tasks hook:** work tasks in order per `TASKS.md`. The main agent alone edits repo test files, the README and task files.

Done when: the spec collects under both projects and every scenario in the feature file has a test whose title mirrors it.

## 5. Verify

- **Green**: run on the target env under `chromium` and `mobile-chrome`. Readiness waits target the page's own loaded signal, never the browser `load` event. **Tasks hook:** per task, only that task's scenarios.
- **Contrast runs**: once, for the whole spec, on each environment the questionnaire named. If a chosen env contrast turns out unavailable (the bug is fixed everywhere), establish that with evidence, record "no environment contrast" for the report, and continue.
- **Fallible**: temporarily invert one expected value, run that test, confirm it fails with a clear message, restore the file.
- After every run, message the evidence agent with the JSON path. Fix any framing or caption problem it reports in the spec, then rerun that test only.
- Any skip is a finding: capture its reason for the report.

Done when: every planned run has a JSON file under the ticket folder, the evidence agent reports no open framing problems, and results are known per env and project.

## 6. Report

Ask the evidence agent for the final build, open `docs/tickets/<KEY>/report.html`, and summarize in chat: outcome first, results table per env and project, which contrasts were proven and which were unavailable, skips with reasons, plan deviations, and files for review. State what could not be verified before anything else.

Done when: the user has the report path and the review list.

## 7. After review

When the user approves, commit on the release branch as `KEY: summary` with the results in the body. Commit only; push and PR are the user's call. Set the README plan status to `committed`.
