# Ticket tasks

Read this file when the questionnaire in `SKILL.md` step 2 chose *break into tasks: yes*. It overlays steps 3 to 5 of the flow; it is not a workflow on its own.

A **task** is one Gherkin scenario group (an acceptance criterion and its scenarios) with a single done: its tests green on the target env under both projects. Tasks make a ticket resumable and let it be worked one slice at a time. Deliverables such as the Testing Suite edit are steps inside a task, never tasks.

Folder layout: `CONVENTIONS.md` § Ticket folder. The main agent alone writes task files and the README; the evidence agent never touches them.

## Hooks into the flow

**Step 3, plan.** Derive tasks from the scenario groups. Task `01` carries all shared scaffolding: feature-file skeleton, spec file, the `tests/util/` helper additions (BU utilities class, `utilities.js`, `evidence.js`) with evidence capture, the page-object additions the plan lists, the Testing Suite edit. Every other task is blocked by `01` and adds only its scenarios and their locators. Show the list in the plan message as number, title, blocked by, scenarios owned. Write one file per task from the template below with status `proposed`, and the task table into the README. Tasks are not pasted into chat for Jira; the Gherkin is.

**Gate.** *Implement the plan* flips every task to `ready`.

**Step 4, implement.** Work the frontier: the lowest-numbered task whose blockers are `green`. Flip it to `in-progress`, implement, verify per step 5, flip to `green` with env results and files touched, take the next. No per-task approval: the plan was approved whole. Pause with a questionnaire only when a task meets something the plan did not cover: a missing fixture, a locator that does not resolve, a scenario that cannot be produced. The task then becomes `blocked` or `skipped` with the reason, and the next task starts.

**Step 5, verify.** Per task: run only that task's scenarios on the target env under `chromium` and `mobile-chrome`, then the fallible inversion on one of them. JSON goes to `results/<NN>-<env>.json`. Environment contrast runs happen once for the whole spec after the last task.

**Resume.** When the README shows tasks, continue at the first task that is not `green` or `skipped`. A task left `in-progress` by a dead session is re-verified before anything else is written.

## Task file template

`docs/tickets/<KEY>/tasks/<NN>-<slug>.md`:

```
# <NN> — <Task title>

**Status:** proposed | ready | in-progress | green | blocked | skipped
**Blocked by:** 01 — <title>, or "None"
**Scenarios:**
- <scenario name> [<KEY>]
- <scenario name> [<KEY>]

**Files touched:** filled as work happens
**Results:** chromium <env> pass/fail, mobile-chrome <env> pass/fail, fallible pass
**Notes:** reason for blocked or skipped, deviations from the plan
```

Done when: every task is `green` or `skipped` with a reason, and the README table matches the task files.
