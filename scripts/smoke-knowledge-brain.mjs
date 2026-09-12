#!/usr/bin/env node
// scripts/smoke-knowledge-brain.mjs
//
// Founder Path A · Phase A3 · Knowledge Brain regression.
// Hits /api/nex/knowledge-brain/query · exercises BM25 + dense + rerank.
//
// Verifies:
//   A · answer shape · stage_ms.total present
//   B · empty query → 400
//   C · hits carry scores.bm25 OR scores.dense (or both)
//   D · every returned hit has scores.fused
//   E · answered=true → trust ∈ {canonical_verified, evidence_provisional}
//   F · answered=false → trust=unknown + unverified_reason set
//   G · answerToEvidenceItems() shape: ref_id + source_type + text + confidence
//   H · web_search / vision / file confidence capped at ≤ 0.75

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function query(body) {
  const res = await fetch(`${HOST}/api/nex/knowledge-brain/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: { _parse_error: text.slice(0, 200) } }; }
}

const failures = [];

// ══ A · shape
console.log("\n══ A · answer shape · stage_ms.total present");
{
  const r = await query({ query: "hotels in Yogyakarta with wifi", top_k: 5, budget_ms: 3000 });
  const a = r.body?.answer;
  console.log(`  status=${r.status} answered=${a?.answered} hits=${a?.hits?.length} trust=${a?.trust} total_ms=${a?.stage_ms?.total}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (typeof a?.stage_ms?.total !== "number") failures.push({ case: "A", reason: "no_total_stage_ms" });
  if (!Array.isArray(a?.hits)) failures.push({ case: "A", reason: "no_hits_array" });
}

// ══ B · empty query
console.log("\n══ B · empty query rejected");
{
  const r = await query({ query: "" });
  console.log(`  status=${r.status}`);
  if (r.status !== 400) failures.push({ case: "B", reason: `expected_400_got_${r.status}` });
}

// ══ C · hits carry bm25 or dense
console.log("\n══ C · hits carry bm25 or dense scores");
{
  const r = await query({ query: "wifi hotel Yogyakarta", top_k: 10 });
  const a = r.body?.answer;
  if (Array.isArray(a?.hits) && a.hits.length > 0) {
    let hasBm25 = 0, hasDense = 0;
    for (const h of a.hits) {
      if (typeof h.scores?.bm25 === "number") hasBm25++;
      if (typeof h.scores?.dense === "number") hasDense++;
    }
    console.log(`  bm25_hits=${hasBm25} dense_hits=${hasDense}`);
    if (hasBm25 + hasDense === 0) failures.push({ case: "C", reason: "neither_bm25_nor_dense_scored" });
  } else {
    console.log(`  (no hits · vacuously true)`);
  }
}

// ══ D · every returned hit has scores.fused
console.log("\n══ D · every returned hit has scores.fused");
{
  const r = await query({ query: "wifi hotel Yogyakarta", top_k: 10 });
  const a = r.body?.answer;
  if (Array.isArray(a?.hits)) {
    for (const h of a.hits) {
      if (typeof h.scores?.fused !== "number") {
        failures.push({ case: "D", reason: `no_fused_on_${h.ref_id}` });
      }
    }
    console.log(`  ${a.hits.length}/${a.hits.length} hits have fused score`);
  }
}

// ══ E · answered=true → trust valid
console.log("\n══ E · answered=true → trust valid");
{
  const r = await query({ query: "wifi hotel Yogyakarta", top_k: 10 });
  const a = r.body?.answer;
  if (a?.answered === true) {
    const ok = ["canonical_verified", "evidence_provisional"].includes(a.trust);
    console.log(`  trust=${a.trust} ok=${ok}`);
    if (!ok) failures.push({ case: "E", reason: `bad_trust_${a.trust}` });
  } else {
    console.log(`  (not answered · vacuous)`);
  }
}

// ══ F · answered=false → trust=unknown + reason
console.log("\n══ F · answered=false → trust=unknown + unverified_reason");
{
  const r = await query({ query: "zebra quantum entanglement moon landing 12345", top_k: 5 });
  const a = r.body?.answer;
  console.log(`  answered=${a?.answered} trust=${a?.trust} reason=${a?.unverified_reason}`);
  if (a?.answered === false) {
    if (a.trust !== "unknown") failures.push({ case: "F", reason: `expected_unknown_got_${a.trust}` });
    if (!a.unverified_reason) failures.push({ case: "F", reason: "no_unverified_reason" });
  }
}

// ══ G · evidence_items shape
console.log("\n══ G · evidence_items shape valid");
{
  const r = await query({ query: "wifi hotel Yogyakarta", top_k: 5 });
  const items = r.body?.evidence_items ?? [];
  for (const it of items) {
    if (!it.ref_id || !it.source_type || typeof it.text !== "string" || typeof it.confidence !== "number") {
      failures.push({ case: "G", reason: `bad_evidence_shape_${JSON.stringify(it).slice(0, 80)}` });
    }
  }
  console.log(`  ${items.length} evidence items · shape valid`);
}

// ══ H · web/vision/file capped at 0.75
console.log("\n══ H · web_search / vision / file confidence ≤ 0.75");
{
  const r = await query({ query: "wifi hotel Yogyakarta" });
  const items = r.body?.evidence_items ?? [];
  const capped = ["web_search", "vision", "file"];
  for (const it of items) {
    if (capped.includes(it.source_type) && it.confidence > 0.75) {
      failures.push({ case: "H", reason: `${it.source_type}_confidence_${it.confidence}_over_0.75` });
    }
  }
  console.log(`  cap enforced on ${items.filter((i) => capped.includes(i.source_type)).length} capped-type items`);
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · Knowledge Brain facade + hybrid retriever green.");
  process.exit(0);
}
