# Evidence: step screenshots and the HTML report

Evidence answers "show me the value changed" without re-running anything. Every test the skill writes captures it; the **evidence agent** checks it and assembles the report while the main agent keeps working.

## Step screenshots in the spec

Attach a captioned JPEG at each state the Gherkin names (on load, after each action). Caption format is fixed so the report can tabulate it:

```
<n> <label> | <field>: <value> | <field>: <value>
```

e.g. `2 after typing 3, no blur | qty: 3 | price: $387.00`. Fields are whatever proves the scenario (qty, price, count, status text).

The helper lives in `tests/util/evidence.js` (class `Evidence`, method `snap`), instantiated at module scope in the spec or in the BU utilities class — never redefined in a spec. If the file does not exist yet, create it with this shape:

```js
async function snap(page, testInfo, label, fields) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = await page.locator("<block containing the evidence>").first().boundingBox();
  const body = await page.screenshot({
    type: "jpeg", quality: 70, fullPage: true,
    clip: box ? { x: box.x, y: Math.max(0, box.y - 60), width: box.width, height: box.height + 60 } : undefined,
  });
  const caption = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join(" | ");
  await testInfo.attach(`${label} | ${caption}`, { body, contentType: "image/jpeg" });
}
```

Rules:
- Full-page capture clipped to the block: an element screenshot leaves content hidden under sticky headers.
- A full-page screenshot resizes the viewport and **drops focus**. Capture evidence *after* every assertion that depends on focus or field state.
- Tests take `({ page }, testInfo)`.
- Viewport capture (no `fullPage`) for `position: fixed` surfaces such as slide-in menus and modals: a full-page capture resizes the viewport and renders them closed or misplaced.

## Runs

One run per env × project set, sequentially, each with its own JSON file under the ticket folder (`CONVENTIONS.md` § Ticket folder):

```
STORE_VAR=<url> PLAYWRIGHT_JSON_OUTPUT_NAME=docs/tickets/<KEY>/results/<run>-<env>.json \
  npx playwright test <spec> [-g "<task scenarios>"] --project=chromium --project=mobile-chrome --reporter=list,json
```

After each run, send the evidence agent one message: `run done: <run>-<env>.json, note: <fixed build | broken build | contrast ...>`.

## Evidence agent

Spawned by the main agent at the start of step 4 with the `Agent` tool (`general-purpose`, background) and addressed afterwards with `SendMessage`. Its prompt names the ticket key, the ticket folder, the feature file, the spec, and this file. Its duties, in order:

1. Write `docs/tickets/<KEY>/manifest.json` with every scenario from the feature file under `scenarios` and an empty `runs`, build the report so it exists with everything pending, and reply with the path.
2. On each `run done` message: add the run, rebuild, then open every new screenshot and check it against the scenario's steps: caption in the fixed format, the fields the scenario needs present, the evidence block visible and not clipped, no blank or loader-only frames. Reply with a list of problems by test title and step number, or "no framing problems".
3. On `final`: rebuild, add `verified` and `bullets` (contrasts proven and unavailable, skips with reasons), reply with the path and a per-env × project summary.

It never edits anything under `tests/`, the README, or task files. Spec fixes belong to the main agent.

## Report

`scripts/build-report.js <manifest.json> <output.html>` produces one self-contained HTML file (screenshots embedded). Scenarios with no result yet render as pending, and runs whose JSON does not exist yet are listed as pending, so the report is viewable from step 4 onward. Manifest:

```json
{
  "ticket": "CPP-8",
  "title": "CPAP PDP price follows quantity and bundle options",
  "spec": "tests/specs/CPAP_AC/cpap_pdp_pricing.spec.js",
  "feature": "tests/features/CPAP_AC/CPP-8.feature",
  "verified": "One paragraph: what was checked and how expected values were computed.",
  "scenarios": [ { "title": "Price follows quantity [CPP-8]", "task": "01" } ],
  "bullets": ["Issue 1 … covered by …", "Red proof: …"],
  "runs": [
    { "env": "stage2", "url": "https://…", "json": "results/01-stage2.json", "note": "fixed build" },
    { "env": "prod",   "url": "https://…", "json": "results/spec-prod.json", "note": "environment contrast" }
  ]
}
```

Output goes to `docs/tickets/<KEY>/report.html` (gitignored, local-only) and is opened with `open`. The report lists: summary per env × project, then one card per test with a step table built from the captions and the screenshot gallery. Skips and failures show their message.
