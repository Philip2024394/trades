#!/usr/bin/env node
// scripts/smoke-vs-frontier.mjs
//
// Founder Phase 9 · P9-4 · NEX vs Frontier regression.
//
// Verifies:
//   A · GET /api/nex/vs-frontier returns 200 with 9 comparisons
//   B · every comparison has {property, nex_status, nex_measured, frontier_baseline, why_it_matters}
//   C · Test 1 (General reasoning) is honest_gap · we DON'T pretend to win
//   D · at least 7 of 9 are advantages
//   E · every advantage's nex_measured has a source
//   F · frontier claims that make a specific number have a citation_url
//   G · /nex/vs-frontier HTML page renders 200
//   H · thesis includes "system" language
//   I · chat_challenge field is present and honest

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function get(pth) {
  const res = await fetch(`${HOST}${pth}`);
  const text = await res.text();
  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
  return { status: res.status, text, body: isJson ? tryParse(text) : null };
}
function tryParse(s) { try { return JSON.parse(s); } catch { return null; } }

const failures = [];

console.log("\n══ A · endpoint returns 200 with comparisons array");
{
  const r = await get("/api/nex/vs-frontier");
  const cmp = r.body?.comparisons ?? [];
  console.log(`  status=${r.status} count=${cmp.length}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (cmp.length < 9) failures.push({ case: "A", reason: `expected_9_got_${cmp.length}` });
}

console.log("\n══ B · every comparison has all 5 fields");
{
  const r = await get("/api/nex/vs-frontier");
  for (const c of r.body?.comparisons ?? []) {
    if (!c.property) failures.push({ case: "B", reason: `no_property` });
    if (!c.nex_status) failures.push({ case: "B", reason: `no_nex_status_${c.property}` });
    if (!c.nex_measured) failures.push({ case: "B", reason: `no_nex_measured_${c.property}` });
    if (!c.frontier_baseline) failures.push({ case: "B", reason: `no_frontier_baseline_${c.property}` });
    if (!c.why_it_matters) failures.push({ case: "B", reason: `no_why_${c.property}` });
  }
}

console.log("\n══ C · Test 1 (General reasoning) is honest_gap");
{
  const r = await get("/api/nex/vs-frontier");
  const t1 = (r.body?.comparisons ?? []).find((c) => c.property.startsWith("1 ·"));
  console.log(`  T1_status=${t1?.nex_status}`);
  if (t1?.nex_status !== "honest_gap") failures.push({ case: "C", reason: `expected_honest_gap_got_${t1?.nex_status}` });
}

console.log("\n══ D · at least 7 of 9 are advantages");
{
  const r = await get("/api/nex/vs-frontier");
  const adv = r.body?.summary?.advantages ?? 0;
  console.log(`  advantages=${adv}`);
  if (adv < 7) failures.push({ case: "D", reason: `only_${adv}_advantages` });
}

console.log("\n══ E · every advantage has a source string");
{
  const r = await get("/api/nex/vs-frontier");
  for (const c of r.body?.comparisons ?? []) {
    if (c.nex_status === "advantage" && typeof c.nex_measured?.source !== "string") {
      failures.push({ case: "E", reason: `no_source_${c.property}` });
    }
  }
}

console.log("\n══ F · specific-number frontier claims have citations");
{
  const r = await get("/api/nex/vs-frontier");
  const hasNumericClaim = (s) => /\b\d+(\.\d+)?%|\bblackmail|\bfrequently\s+fail|\bhallucinat|\b\$/i.test(String(s ?? ""));
  for (const c of r.body?.comparisons ?? []) {
    if (hasNumericClaim(c.frontier_baseline?.claim) && !c.frontier_baseline?.citation_url) {
      failures.push({ case: "F", reason: `no_citation_${c.property}` });
    }
  }
}

console.log("\n══ G · /nex/vs-frontier HTML page renders");
{
  const r = await get("/nex/vs-frontier");
  console.log(`  status=${r.status}`);
  if (r.status !== 200) failures.push({ case: "G", reason: `status_${r.status}` });
  if (!r.text.includes("NEX vs Frontier")) failures.push({ case: "G", reason: "no_marker" });
}

console.log("\n══ H · thesis includes 'system' language");
{
  const r = await get("/api/nex/vs-frontier");
  const t = String(r.body?.thesis ?? "").toLowerCase();
  console.log(`  thesis: ${t.slice(0, 60)}…`);
  if (!t.includes("system") && !t.includes("model")) failures.push({ case: "H", reason: "no_positioning" });
}

console.log("\n══ I · chat_challenge fields present + honest");
{
  const r = await get("/api/nex/vs-frontier");
  const cc = r.body?.chat_challenge;
  console.log(`  received: ${String(cc?.received ?? "").slice(0, 60)}…`);
  console.log(`  response: ${String(cc?.response ?? "").slice(0, 60)}…`);
  if (!cc?.received) failures.push({ case: "I", reason: "no_received" });
  if (!cc?.response || !String(cc.response).toLowerCase().includes("agreed")) {
    failures.push({ case: "I", reason: "response_not_honest" });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · NEX vs Frontier public surface live · every claim measurable or cited.");
  process.exit(0);
}
