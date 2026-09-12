#!/usr/bin/env node
// scripts/smoke-accessibility.mjs
//
// Founder Phase 23 · P23-3 · WCAG audit regression.
//
// Verifies:
//   A · inline mode: synthetic BAD html triggers img-has-alt + button-name + input-label + html-lang
//   B · inline mode: synthetic GOOD html scores 100 · zero violations
//   C · inline mode: heading hierarchy jump (h1 → h3) triggers minor violation
//   D · inline mode: link with no accessible name triggers serious violation
//   E · inline mode: <a target="_blank"> without rel triggers minor violation
//   F · paths mode: default audit returns array + summary
//   G · paths mode: rejects zero paths (400)
//   H · GET /api/nex/accessibility/audit returns default report with doctrine_note
//   I · /nex/accessibility page renders 200 with per-page scores
//   J · every violation carries a WCAG criterion + severity + suggestion
//   K · cannot_check_from_html list is present (honest scope disclosure)

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

async function post(pth, body) {
  const res = await fetch(`${HOST}${pth}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body: json };
}
async function get(pth) {
  const res = await fetch(`${HOST}${pth}`);
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body: json };
}

// ══ A · BAD html triggers multiple critical/serious rules
console.log("\n══ A · BAD html triggers multiple hard-rule violations");
{
  const bad = `<!doctype html>
<html>
<head><title></title></head>
<body>
  <img src="/a.png">
  <button></button>
  <input type="text">
</body></html>`;
  const r = await post("/api/nex/accessibility/audit", { html: bad });
  const rules = new Set((r.body?.reports?.[0]?.violations ?? []).map((v) => v.rule_id));
  console.log(`  rules_fired=${[...rules].join(",")}`);
  if (!rules.has("img-has-alt")) failures.push({ case: "A", reason: "no_img_alt" });
  if (!rules.has("button-has-accessible-name")) failures.push({ case: "A", reason: "no_button_name" });
  if (!rules.has("input-has-label")) failures.push({ case: "A", reason: "no_input_label" });
  if (!rules.has("html-has-lang")) failures.push({ case: "A", reason: "no_html_lang" });
  if (!rules.has("document-has-title")) failures.push({ case: "A", reason: "no_title" });
}

// ══ B · GOOD html scores 100
console.log("\n══ B · GOOD html scores 100 with zero violations");
{
  const good = `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Good page</title>
</head>
<body>
  <h1>Hello</h1>
  <img src="/a.png" alt="Logo">
  <button aria-label="Menu">☰</button>
  <label for="q">Query</label>
  <input id="q" type="text">
</body></html>`;
  const r = await post("/api/nex/accessibility/audit", { html: good });
  const report = r.body?.reports?.[0];
  console.log(`  score=${report?.score} violations=${report?.violations?.length}`);
  if (report?.score !== 100) failures.push({ case: "B", reason: `score_${report?.score}` });
  if ((report?.violations ?? []).length > 0) failures.push({ case: "B", reason: `${report.violations.length}_violations` });
}

// ══ C · heading jump
console.log("\n══ C · h1 → h3 jump triggers heading-hierarchy minor");
{
  const html = `<!doctype html>
<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>t</title></head>
<body><h1>A</h1><h3>B</h3></body></html>`;
  const r = await post("/api/nex/accessibility/audit", { html });
  const v = (r.body?.reports?.[0]?.violations ?? []).find((x) => x.rule_id === "heading-hierarchy");
  console.log(`  fired=${!!v} severity=${v?.severity}`);
  if (!v) failures.push({ case: "C", reason: "no_heading_hierarchy" });
}

// ══ D · empty link
console.log("\n══ D · <a> with no accessible name");
{
  const html = `<!doctype html><html lang="en"><head><title>t</title></head><body><h1>x</h1><a href="/x"></a></body></html>`;
  const r = await post("/api/nex/accessibility/audit", { html });
  const v = (r.body?.reports?.[0]?.violations ?? []).find((x) => x.rule_id === "link-has-accessible-name");
  console.log(`  fired=${!!v} severity=${v?.severity}`);
  if (!v) failures.push({ case: "D", reason: "no_link_name" });
}

// ══ E · target=_blank without rel
console.log("\n══ E · target=_blank without rel");
{
  const html = `<!doctype html><html lang="en"><head><title>t</title></head><body><h1>x</h1><a href="/x" target="_blank">Docs</a></body></html>`;
  const r = await post("/api/nex/accessibility/audit", { html });
  const v = (r.body?.reports?.[0]?.violations ?? []).find((x) => x.rule_id === "link-target-blank-rel");
  console.log(`  fired=${!!v}`);
  if (!v) failures.push({ case: "E", reason: "no_target_blank_rule" });
}

// ══ F · paths mode
console.log("\n══ F · paths mode audits multiple pages");
{
  const r = await post("/api/nex/accessibility/audit", { paths: ["/nex/vs-frontier", "/nex/tools"] });
  console.log(`  reports=${r.body?.reports?.length} avg_score=${r.body?.summary?.average_score}`);
  if ((r.body?.reports ?? []).length !== 2) failures.push({ case: "F", reason: `count_${r.body?.reports?.length}` });
  if (typeof r.body?.summary?.average_score !== "number") failures.push({ case: "F", reason: "no_avg_score" });
}

// ══ G · zero paths → 400
console.log("\n══ G · empty paths list → 400");
{
  const r = await post("/api/nex/accessibility/audit", { paths: [] });
  console.log(`  status=${r.status}`);
  if (r.status !== 400) failures.push({ case: "G", reason: `status_${r.status}` });
}

// ══ H · GET returns default report + doctrine note
console.log("\n══ H · GET returns default report with doctrine_note");
{
  const r = await get("/api/nex/accessibility/audit");
  console.log(`  reports=${r.body?.reports?.length} doctrine=${r.body?.doctrine_note?.slice(0, 40)}…`);
  if (r.status !== 200) failures.push({ case: "H", reason: `status_${r.status}` });
  if (!r.body?.doctrine_note) failures.push({ case: "H", reason: "no_doctrine_note" });
  if (!Array.isArray(r.body?.reports)) failures.push({ case: "H", reason: "no_reports" });
}

// ══ I · /nex/accessibility renders
console.log("\n══ I · /nex/accessibility page renders");
{
  const r = await get("/nex/accessibility");
  console.log(`  status=${r.status}`);
  if (r.status !== 200) failures.push({ case: "I", reason: `status_${r.status}` });
  const text = r.text;
  if (!text.includes("WCAG 2.1 audit")) failures.push({ case: "I", reason: "no_marker" });
  const lower = text.toLowerCase();
  const hasScope = lower.includes("honest scope") || lower.includes("cannot be checked") || lower.includes("not checked here");
  if (!hasScope) failures.push({ case: "I", reason: "no_scope_disclosure" });
}

// ══ J · violation shape
console.log("\n══ J · every violation carries criterion + severity + suggestion");
{
  const bad = `<html><body><img src=/a.png></body></html>`;
  const r = await post("/api/nex/accessibility/audit", { html: bad });
  for (const v of r.body?.reports?.[0]?.violations ?? []) {
    if (!v.criterion || !/^\d+\.\d+\.\d+/.test(v.criterion)) failures.push({ case: "J", reason: `no_criterion_${v.rule_id}` });
    if (!["critical", "serious", "moderate", "minor"].includes(v.severity)) failures.push({ case: "J", reason: `bad_severity_${v.severity}` });
    if (!v.suggestion || v.suggestion.length < 10) failures.push({ case: "J", reason: `no_suggestion_${v.rule_id}` });
  }
}

// ══ K · cannot_check_from_html
console.log("\n══ K · honest scope disclosure present");
{
  const r = await post("/api/nex/accessibility/audit", { html: "<html><body></body></html>" });
  const list = r.body?.reports?.[0]?.cannot_check_from_html ?? [];
  console.log(`  cannot_check_count=${list.length}`);
  if (list.length < 3) failures.push({ case: "K", reason: `only_${list.length}_disclosed` });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · WCAG audit live · rules deterministic · honest scope disclosure preserved.");
  process.exit(0);
}
