#!/usr/bin/env node
// Build a self-contained HTML evidence report from Playwright JSON reporter output.
// Usage: node build-report.js <manifest.json> <output.html>   (manifest format: ../EVIDENCE.md)
const fs = require("fs");
const path = require("path");
const [manifestPath, outPath] = process.argv.slice(2);
if (!manifestPath || !outPath) {
  console.error("usage: build-report.js <manifest.json> <output.html>");
  process.exit(1);
}
const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const walk = (suite, acc) => { (suite.specs || []).forEach((sp) => acc.push(sp)); (suite.suites || []).forEach((s) => walk(s, acc)); return acc; };

const tests = [];
(m.runs || []).forEach((run, runIndex) => {
  const jsonPath = path.resolve(path.dirname(manifestPath), run.json);
  if (!fs.existsSync(jsonPath)) { run.pending = true; return; }
  const j = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  for (const sp of walk({ suites: j.suites }, [])) for (const t of sp.tests) {
    const r = t.results[t.results.length - 1];
    const shots = (r.attachments || []).filter((a) => /^image\//.test(a.contentType) && a.body).map((a) => {
      const [label, ...rest] = a.name.split(" | ");
      const fields = {};
      rest.forEach((kv) => { const i = kv.indexOf(":"); if (i > 0) fields[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); else fields[kv.trim()] = ""; });
      return { label: label.replace(/^\d+\s*/, ""), fields, src: `data:${a.contentType};base64,${a.body}` };
    });
    const status = r.status === "passed" ? "passed" : r.status === "skipped" ? "skipped" : "failed";
    tests.push({ runIndex, env: run.env, project: t.projectName, title: sp.title, status, duration: r.duration, error: r.error && r.error.message, shots });
  }
});
tests.sort((a, b) => a.runIndex - b.runIndex || a.project.localeCompare(b.project) || a.title.localeCompare(b.title));

const summary = {};
for (const t of tests) { const k = `${t.env}|${t.project}`; summary[k] ||= { env: t.env, project: t.project, passed: 0, failed: 0, skipped: 0 }; summary[k][t.status]++; }
const passed = tests.filter((t) => t.status === "passed").length;
const pending = (m.scenarios || []).filter((sc) => !tests.some((t) => t.title.startsWith(sc.title)));

const stepTable = (t) => {
  if (!t.shots.length) return "";
  const cols = [...new Set(t.shots.flatMap((s) => Object.keys(s.fields)))];
  const head = `<tr><th>#</th><th>Step</th>${cols.map((c) => `<th class="num">${esc(c)}</th>`).join("")}</tr>`;
  const rows = t.shots.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.label)}</td>${cols.map((c) => `<td class="num"><strong>${esc(s.fields[c] ?? "")}</strong></td>`).join("")}</tr>`).join("");
  const imgs = t.shots.map((s, i) => `<figure><img src="${s.src}" alt="${esc(s.label)}" loading="lazy" onclick="this.classList.toggle('zoom')"><figcaption><b>${i + 1}.</b> ${esc(s.label)}<br>${Object.entries(s.fields).map(([k, v]) => `${esc(k)} <strong>${esc(v)}</strong>`).join(" · ")}</figcaption></figure>`).join("");
  return `<table class="steps"><thead>${head}</thead><tbody>${rows}</tbody></table><div class="gallery">${imgs}</div>`;
};
const refs = (m.references || []).map((r) => { const f = path.resolve(path.dirname(manifestPath), r.image); const mime = f.endsWith(".png") ? "image/png" : "image/jpeg"; return { title: r.title, caption: r.caption, src: `data:${mime};base64,${fs.readFileSync(f).toString("base64")}` }; });
const refSection = refs.length ? `<h2>Design reference</h2><p class="sub">Figma frames the captured screenshots are compared against by eye.</p><div class="gallery refs">${refs.map((r) => `<figure><img src="${r.src}" alt="${esc(r.title)}" loading="lazy" onclick="this.classList.toggle('zoom')"><figcaption><b>${esc(r.title)}</b><br>${esc(r.caption || "")}</figcaption></figure>`).join("")}</div>` : "";
const cards = tests.map((t) => `
<article class="card ${t.status}">
  <header><span class="pill ${t.status}">${t.status}</span><h3>${esc(t.title)}</h3><span class="meta">${esc(t.env)} · ${esc(t.project)} · ${(t.duration / 1000).toFixed(1)}s</span></header>
  ${t.error ? `<pre class="err">${esc(t.error)}</pre>` : ""}
  ${stepTable(t)}
</article>`).join("");
const pendingCards = pending.map((sc) => `
<article class="card pending">
  <header><span class="pill pending">pending</span><h3>${esc(sc.title)}</h3><span class="meta">${sc.task ? `task ${esc(sc.task)} · ` : ""}no run yet</span></header>
</article>`).join("");
const summaryRows = Object.values(summary).map((s) => `<tr><td>${esc(s.env)}</td><td>${esc(s.project)}</td><td class="num ok">${s.passed}</td><td class="num ${s.failed ? "bad" : ""}">${s.failed}</td><td class="num ${s.skipped ? "opt" : ""}">${s.skipped}</td></tr>`).join("");

fs.writeFileSync(outPath, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(m.ticket)} · ${esc(m.title)}</title>
<style>
:root{--ink:#1f2933;--muted:#616e7c;--line:#e4e7eb;--ok:#0f7b4f;--okbg:#e6f6ee;--bad:#b42318;--badbg:#fdecea;--opt:#8a5a00;--optbg:#fff4d6;--bg:#f7f8fa}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:1180px;margin:0 auto;padding:32px 24px 64px}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:36px 0 12px}h3{font-size:16px;margin:0;flex:1}
.sub{color:var(--muted);margin:0 0 20px}.lead{background:#fff;border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin-bottom:8px}
table{border-collapse:collapse;width:100%;background:#fff}th,td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}.ok{color:var(--ok)}.bad{color:var(--bad);font-weight:600}.opt{color:var(--opt)}
.card{background:#fff;border:1px solid var(--line);border-left:5px solid var(--ok);border-radius:10px;padding:16px 20px;margin:14px 0}.card.failed{border-left-color:var(--bad)}.card.skipped{border-left-color:var(--opt)}.card.pending{border-left-color:var(--line);color:var(--muted)}.pill.pending{background:var(--bg);color:var(--muted)}
.card header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}.meta{color:var(--muted);font-size:13px}
.pill{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 10px;border-radius:999px;background:var(--okbg);color:var(--ok)}.pill.failed{background:var(--badbg);color:var(--bad)}.pill.skipped{background:var(--optbg);color:var(--opt)}
.gallery.refs figure{width:300px}.steps{margin-bottom:12px;font-size:14px}.gallery{display:flex;gap:14px;flex-wrap:wrap}figure{margin:0;width:220px}figure img{width:100%;border:1px solid var(--line);border-radius:6px;cursor:zoom-in;background:#fff}
figure img.zoom{position:fixed;inset:24px;width:auto;height:calc(100% - 48px);max-width:calc(100% - 48px);object-fit:contain;z-index:10;cursor:zoom-out;box-shadow:0 12px 40px rgba(0,0,0,.35)}
figcaption{font-size:12.5px;color:var(--muted);margin-top:6px}pre.err{background:var(--badbg);padding:12px;border-radius:6px;white-space:pre-wrap;font-size:12.5px}
.kicker{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}ul{margin:8px 0 0 18px;padding:0}code{font-size:13px}
</style></head><body><main>
<p class="kicker">Jira ${esc(m.ticket)} · generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</p>
<h1>${esc(m.title)}</h1>
<p class="sub">${passed} of ${tests.length} test runs passed${pending.length ? ` · ${pending.length} scenario${pending.length === 1 ? "" : "s"} pending` : ""}${m.spec ? ` · spec <code>${esc(m.spec)}</code>` : ""}${m.feature ? ` · scenarios <code>${esc(m.feature)}</code>` : ""}</p>
${m.verified || (m.bullets || []).length ? `<div class="lead">${m.verified ? `<strong>What was verified.</strong> ${esc(m.verified)}` : ""}${(m.bullets || []).length ? `<ul>${m.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}</div>` : ""}
<h2>Summary</h2>
<table><thead><tr><th>Environment</th><th>Project</th><th class="num">Passed</th><th class="num">Failed</th><th class="num">Skipped</th></tr></thead><tbody>${summaryRows}</tbody></table>
<p class="sub" style="margin-top:8px">${(m.runs || []).map((r) => `<strong>${esc(r.env)}</strong>: ${esc(r.url || "")}${r.note ? ` — ${esc(r.note)}` : ""}${r.pending ? " — pending" : ""}`).join("<br>")}</p>
${refSection}
<h2>Results with screenshots</h2>
<p class="sub">Click a screenshot to enlarge it. Captions record the values the test read from the page at that step.</p>
${cards}${pendingCards}
</main></body></html>`);
console.log(`wrote ${outPath}: ${tests.length} tests, ${pending.length} pending, ${tests.reduce((n, t) => n + t.shots.length, 0)} screenshots, ${(fs.statSync(outPath).size / 1048576).toFixed(1)} MB`);
