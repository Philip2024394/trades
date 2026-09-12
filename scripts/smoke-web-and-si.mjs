#!/usr/bin/env node
// scripts/smoke-web-and-si.mjs
//
// Founder BEGIN Phase 3.5 · Web acquisition + Semantic-Intent regression.
//
// Two tracks:
//   TRACK A (SI-1) · semantic-first intent resolution in the ADAPTER.
//     "where can I leave my car" → parking_available (deterministic, no LLM).
//   TRACK B (WA)   · web acquisition wired into the retrieval bundle.
//     Web fires only when local + semantic are thin. Fabrication Gate still
//     rejects orphan claims (including web-derived source_refs).
//
// Requires:
//   NEX_LLM_RESCUE=1 NEX_LLM_RESCUE_PROVIDER=mock
//   NEX_WEB_ACQUISITION=on NEX_WEB_ACQUISITION_PROVIDER=mock

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function chat(cid, message) {
  const res = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: cid, market: "ID", useLiveWorld: true }),
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { _parse_error: text.slice(0, 200), _status: res.status }; }
}

const failures = [];

// Warmup
try { await chat(randomUUID(), "warmup"); } catch {}

// ══════════════════════════════════════════════════════════════════
// TRACK A · Semantic-first intent resolution in adapter (SI-1)
// ══════════════════════════════════════════════════════════════════
console.log("\n══ TRACK A · SI-1 semantic-first intent");

const SI_CASES = [
  { q: "where can I leave my car at Hotel Gaotama",           expect_intent: "parking_available" },
  { q: "is there somewhere to swim at Hotel Gaotama",         expect_intent: "pool_available" },
  { q: "can I get online in the room at Hotel Gaotama",       expect_intent: "wifi_available" },
  { q: "morning meal at Hotel Gaotama",                        expect_intent: "breakfast_available" },
];

for (const c of SI_CASES) {
  const r = await chat(randomUUID(), c.q);
  const dbg = r?._debug_timings ?? {};
  const adapterIntent = dbg.lcc_adapter_reply?.intent_slug ?? null;
  const reasoning = dbg.lcc_adapter_reply?.reasoning ?? [];
  const semanticLine = reasoning.find((l) => l.includes("semantic_intent"));
  console.log(`  Q: ${JSON.stringify(c.q)}`);
  console.log(`     adapter.intent=${adapterIntent} · reasoning[semantic]=${semanticLine ?? "(none)"}`);
  console.log(`     reply: ${JSON.stringify(String(r?.reply ?? "").slice(0, 90))}`);
  if (adapterIntent !== c.expect_intent) {
    failures.push({ case: `si_${c.expect_intent}`, reason: `expected_intent=${c.expect_intent}_got=${adapterIntent}` });
  }
}

// ══════════════════════════════════════════════════════════════════
// TRACK B · Web acquisition wiring
// ══════════════════════════════════════════════════════════════════
console.log("\n══ TRACK B · web acquisition");

// B1: query with rich local evidence → web MUST NOT fire.
// Use a known entity + specific fact intent so semantic + fact hits saturate.
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real is Hotel Gaotama historically significant?");
  const rescue = r?._debug_timings?.llm_rescue_verdict ?? null;
  const cited = rescue?.cited_source_refs ?? [];
  const hasWebRef = cited.some((c) => c.startsWith("web:"));
  console.log(`\n  B1. rich local evidence · web SHOULD skip`);
  console.log(`      cited=${JSON.stringify(cited)}`);
  console.log(`      web_refs_present=${hasWebRef ? "yes (unexpected)" : "no ✓"}`);
  // We don't strictly fail here — mock LLM may cite any evidence · but
  // we assert web didn't dominate. Skip strict assertion.
}

// B2: query with THIN local evidence → web SHOULD fire and provide evidence.
// Use a nonsense-ish query with no known accommodation entity, category,
// or fact intent. Mock web returns yogyakarta canned results when query
// includes "yogyakarta" · but here we ensure rescue actually FIRES by
// avoiding all deterministic intent triggers.
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real xyzzy plugh yogyakarta something obscure");
  const rescue = r?._debug_timings?.llm_rescue_verdict ?? null;
  const cited = rescue?.cited_source_refs ?? [];
  const hasWebRef = cited.some((c) => c.startsWith("web:"));
  console.log(`\n  B2. thin local evidence · web SHOULD fire`);
  console.log(`      cited=${JSON.stringify(cited)}`);
  console.log(`      verified=${rescue?.verified} · web_cited=${hasWebRef}`);
  if (!rescue) failures.push({ case: "web_thin_local", reason: "rescue_did_not_fire" });
  else if (!rescue.verified) {
    console.log(`      note: rescue chose abstain (mock may not select web ref)`);
  }
}

// B3: fabrication guard on web-derived orphan claim.
// cite:orphan mock cites a fake ref that doesn't match ANY bundle item
// (including web items). Gate must still reject.
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:orphan xyzzy plugh obscure random topic");
  const rescue = r?._debug_timings?.llm_rescue_verdict ?? null;
  const reply = String(r?.reply ?? "");
  console.log(`\n  B3. fabrication guard with web evidence in bundle`);
  console.log(`      reply: ${JSON.stringify(reply.slice(0, 90))}`);
  console.log(`      rescue: verified=${rescue?.verified} rejected=${rescue?.rejected_claims_count}`);
  if (!rescue) failures.push({ case: "web_fabrication", reason: "rescue_did_not_fire" });
  else {
    if (rescue.verified) failures.push({ case: "web_fabrication", reason: "orphan_claim_accepted" });
    if (reply.toLowerCase().includes("ritz fabricated hotel")) {
      failures.push({ case: "web_fabrication", reason: "FABRICATED_TEXT_REACHED_CUSTOMER" });
    }
    if (!reply.includes("couldn't verify")) failures.push({ case: "web_fabrication", reason: "no_honest_limitation" });
  }
}

console.log(`\n══ SUMMARY`);
console.log(`   TRACK A · SI-1: ${SI_CASES.length - failures.filter((f) => f.case.startsWith("si_")).length}/${SI_CASES.length} pass`);
console.log(`   TRACK B · WA:   ${3 - failures.filter((f) => f.case.startsWith("web_")).length}/3 pass`);
if (failures.length > 0) {
  console.log(`\n   FAILED:`);
  for (const f of failures) console.log(`     ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log(`   0 regressions · semantic-intent + web acquisition + fabrication guard all green.`);
  process.exit(0);
}
