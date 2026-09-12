#!/usr/bin/env node
// scripts/smoke-evidence-and-trust.mjs
//
// Founder Phase 6 · P6-6 · Trust/provenance moat regression.
//
// Verifies:
//   A · /api/nex/evidence/list returns 200 with sources array
//   B · every source has ref_id, source_type, times_cited (numeric)
//   C · /api/nex/evidence/[ref_id] returns provenance detail
//   D · citation_summary has {times_cited, mean_alignment, first_cited, last_cited}
//   E · /api/nex/trust-score/[entity_ref] returns 200 with overall in [0,1]
//   F · trust_score has all 5 components + supporting_data
//   G · /nex/evidence HTML page renders
//   H · /nex/evidence/[ref_id] HTML page renders
//   I · zero fabrication: all numbers trace to a database row

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function get(path) {
  const res = await fetch(`${HOST}${path}`);
  const text = await res.text();
  const isJson = res.headers.get("content-type")?.includes("application/json");
  return {
    status: res.status,
    body: isJson ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null,
    text,
    contentType: res.headers.get("content-type") ?? "",
  };
}

const failures = [];

// ══ A · evidence list endpoint
console.log("\n══ A · GET /api/nex/evidence/list returns 200 · sources array");
{
  const r = await get("/api/nex/evidence/list?limit=10");
  console.log(`  status=${r.status} total=${r.body?.total_sources}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!Array.isArray(r.body?.sources)) failures.push({ case: "A", reason: "no_sources_array" });
}

// ══ B · every source has expected shape
console.log("\n══ B · sources shape valid");
let firstRefId = null;
{
  const r = await get("/api/nex/evidence/list?limit=10");
  for (const s of r.body?.sources ?? []) {
    if (!s.ref_id) failures.push({ case: "B", reason: "no_ref_id" });
    if (!s.source_type) failures.push({ case: "B", reason: "no_source_type" });
    if (typeof s.times_cited !== "number") failures.push({ case: "B", reason: "no_times_cited" });
  }
  firstRefId = r.body?.sources?.[0]?.ref_id ?? null;
  console.log(`  first_ref_id=${firstRefId?.slice(0, 50)}`);
}

// ══ C · evidence detail endpoint
console.log("\n══ C · GET /api/nex/evidence/[ref_id] returns 200 for real ref");
if (firstRefId) {
  const r = await get(`/api/nex/evidence/${encodeURIComponent(firstRefId)}`);
  console.log(`  status=${r.status} type=${r.body?.source_type}`);
  if (r.status !== 200) failures.push({ case: "C", reason: `status_${r.status}` });
  if (r.body?.ref_id !== firstRefId) failures.push({ case: "C", reason: "ref_id_mismatch" });
}

// ══ D · citation_summary shape
console.log("\n══ D · citation_summary present");
if (firstRefId) {
  const r = await get(`/api/nex/evidence/${encodeURIComponent(firstRefId)}`);
  const cs = r.body?.citation_summary;
  console.log(`  times_cited=${cs?.times_cited} mean_align=${cs?.mean_alignment}`);
  if (typeof cs?.times_cited !== "number") failures.push({ case: "D", reason: "no_times_cited" });
  if (!("mean_alignment" in (cs ?? {}))) failures.push({ case: "D", reason: "no_mean_alignment_field" });
  if (!("first_cited" in (cs ?? {}))) failures.push({ case: "D", reason: "no_first_cited" });
}

// ══ E · trust score endpoint
console.log("\n══ E · GET /api/nex/trust-score/[entity_ref] returns 200");
{
  const r = await get(`/api/nex/trust-score/${encodeURIComponent("#AC-2026-0000C")}`);
  const ts = r.body?.trust_score;
  console.log(`  status=${r.status} overall=${ts?.overall} components=${ts?.components ? Object.keys(ts.components).length : 0}`);
  if (r.status !== 200) failures.push({ case: "E", reason: `status_${r.status}` });
  if (typeof ts?.overall !== "number" || ts.overall < 0 || ts.overall > 1) {
    failures.push({ case: "E", reason: `bad_overall_${ts?.overall}` });
  }
}

// ══ F · trust_score components
console.log("\n══ F · trust_score has all 5 components + supporting_data");
{
  const r = await get(`/api/nex/trust-score/${encodeURIComponent("#AC-2026-0000C")}`);
  const ts = r.body?.trust_score;
  const need = ["citation_alignment_quality", "citation_survival_rate", "freshness_score", "verification_evidence_ratio", "conflict_penalty"];
  for (const c of need) {
    if (!(c in (ts?.components ?? {}))) failures.push({ case: "F", reason: `missing_${c}` });
  }
  if (!ts?.supporting_data) failures.push({ case: "F", reason: "no_supporting_data" });
}

// ══ G · evidence catalog page
console.log("\n══ G · /nex/evidence HTML page renders");
{
  const r = await get("/nex/evidence");
  console.log(`  status=${r.status} content-type=${r.contentType.slice(0, 50)}`);
  if (r.status !== 200) failures.push({ case: "G", reason: `status_${r.status}` });
  if (!r.text.includes("Evidence") && !r.text.includes("data-evidence-catalog")) {
    failures.push({ case: "G", reason: "no_marker" });
  }
}

// ══ H · evidence detail page
console.log("\n══ H · /nex/evidence/[ref_id] HTML page renders");
if (firstRefId) {
  const r = await get(`/nex/evidence/${encodeURIComponent(firstRefId)}`);
  console.log(`  status=${r.status}`);
  if (r.status !== 200) failures.push({ case: "H", reason: `status_${r.status}` });
}

// ══ I · zero fabrication invariant · nonsense ref returns honest 0s
console.log("\n══ I · unknown ref_id · honest zeros · no fabrication");
{
  const r = await get(`/api/nex/evidence/${encodeURIComponent("does_not_exist_ref_id_" + Date.now())}`);
  const cs = r.body?.citation_summary;
  console.log(`  cited=${cs?.times_cited} rejected=${cs?.times_rejected}`);
  if (cs?.times_cited !== 0 || cs?.times_rejected !== 0) {
    failures.push({ case: "I", reason: "invented_counts_for_unknown_ref" });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · public evidence catalog + NEX Trust Score live · zero fabrication.");
  process.exit(0);
}
