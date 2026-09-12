#!/usr/bin/env node
// scripts/smoke-nex-standard.mjs
//
// Founder Phase 4 · P4-4 · NEX Standard test-suite regression.
//
// Verifies:
//   A · GET /api/nex/standard returns 200 with all 10 tests
//   B · every test has {test_id, test_name, status, headline, measurement, source}
//   C · T1 (reasoning) is honest_gap · we don't pretend
//   D · T5 (memory) always reports 0 escapes
//   E · T6 (actions) always reports 0 unauthorized executions
//   F · T9 (reliability) doctrine_overall_score = 1.0
//   G · T10 (independence) exposes local_only mode state
//   H · summary counts add to 10

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function get(path) {
  const res = await fetch(`${HOST}${path}`);
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: null }; }
}

const failures = [];

console.log("\n══ A · GET /api/nex/standard returns 200 · 10 tests");
{
  const r = await get("/api/nex/standard?window=1h");
  const tests = r.body?.tests ?? [];
  console.log(`  status=${r.status} version=${r.body?.standard_version} test_count=${tests.length}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (tests.length !== 10) failures.push({ case: "A", reason: `expected_10_tests_got_${tests.length}` });
  if (r.body?.standard_version !== "1.0.0") failures.push({ case: "A", reason: `version_${r.body?.standard_version}` });
}

console.log("\n══ B · every test has required fields");
{
  const r = await get("/api/nex/standard?window=1h");
  for (const t of r.body?.tests ?? []) {
    if (!t.test_id || !t.test_name || !t.status || !t.headline || !t.measurement || !t.source) {
      failures.push({ case: "B", reason: `bad_shape_T${t.test_id ?? "?"}` });
    }
    if (!["measured", "honest_gap", "no_data_yet"].includes(t.status)) {
      failures.push({ case: "B", reason: `bad_status_T${t.test_id}_${t.status}` });
    }
  }
}

console.log("\n══ C · T1 is honest_gap · no fake reasoning claim");
{
  const r = await get("/api/nex/standard?window=1h");
  const t1 = r.body?.tests?.find((t) => t.test_id === 1);
  if (t1?.status !== "honest_gap") failures.push({ case: "C", reason: `T1_status_${t1?.status}` });
}

console.log("\n══ D · T5 memory · 0 escapes");
{
  const r = await get("/api/nex/standard?window=24h");
  const t5 = r.body?.tests?.find((t) => t.test_id === 5);
  const escapes = t5?.measurement?.memory_citation_escapes;
  const bypass = t5?.measurement?.doctrine_4_bypass_count;
  console.log(`  escapes=${escapes} bypass=${bypass}`);
  if (escapes !== 0) failures.push({ case: "D", reason: `escapes_${escapes}` });
  if (bypass !== 0) failures.push({ case: "D", reason: `bypass_${bypass}` });
}

console.log("\n══ E · T6 actions · 0 unauthorized");
{
  const r = await get("/api/nex/standard?window=24h");
  const t6 = r.body?.tests?.find((t) => t.test_id === 6);
  const rate = t6?.measurement?.unauthorized_execution_rate;
  console.log(`  unauthorized_rate=${rate}`);
  if (rate !== 0) failures.push({ case: "E", reason: `rate_${rate}` });
}

console.log("\n══ F · T9 reliability · doctrine.overall_score = 1.0");
{
  const r = await get("/api/nex/standard?window=24h");
  const t9 = r.body?.tests?.find((t) => t.test_id === 9);
  const score = t9?.measurement?.overall_score;
  console.log(`  overall_score=${score}`);
  if (score !== 1) failures.push({ case: "F", reason: `score_${score}` });
}

console.log("\n══ G · T10 independence · local_only surface exists");
{
  const r = await get("/api/nex/standard?window=1h");
  const t10 = r.body?.tests?.find((t) => t.test_id === 10);
  const m = t10?.measurement;
  console.log(`  local_only_mode=${m?.local_only_mode} llm_provider=${m?.llm_provider}`);
  if (typeof m?.local_only_mode !== "boolean") failures.push({ case: "G", reason: "no_local_only_flag" });
  if (!m?.resolved_providers) failures.push({ case: "G", reason: "no_resolved_providers" });
}

console.log("\n══ H · summary counts add to 10");
{
  const r = await get("/api/nex/standard?window=1h");
  const s = r.body?.summary;
  const total = (s?.measured_count ?? 0) + (s?.honest_gap_count ?? 0) + (s?.no_data_yet_count ?? 0);
  console.log(`  measured=${s?.measured_count} honest_gap=${s?.honest_gap_count} no_data_yet=${s?.no_data_yet_count} total=${total}`);
  if (total !== 10) failures.push({ case: "H", reason: `total_${total}` });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · NEX Standard endpoint publishes all 10 tests · zero fabrication.");
  process.exit(0);
}
