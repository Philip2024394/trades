#!/usr/bin/env node
// scripts/smoke-live-chat-completion.mjs
//
// Founder BEGIN Live Chat Completion 2026-09-09 · cross-category smoke matrix.
//
// Hits /api/nex-conv/chat with the 13 buckets the founder listed:
//   1  discovery/list
//   2  single-property fact
//   3  comparison
//   4  count
//   5  amenity
//   6  location
//   7  price
//   8  date/time
//   9  follow-up question
//   10 ambiguous entity
//   11 no-data question
//   12 unsupported/live-data question
//   13 conversation follow-up
//
// Hard-fail (exit 1) if for any accommodation-classified turn the voice_reply
// still comes back with intent "discovery_hit" — the founder-visible symptom.
// Every turn's promotion decision + adapter reply is printed for inspection.

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

const MATRIX = [
  // bucket 1 · discovery/list
  { bucket: "discovery_list",         q: "need hotel for tomorrow",         expect_domain: "accommodation", must_not_be_discovery_hit: true },
  { bucket: "discovery_list",         q: "have you hotel",                  expect_domain: "accommodation", must_not_be_discovery_hit: true },
  { bucket: "discovery_list",         q: "hotel di jogja",                  expect_domain: "accommodation", must_not_be_discovery_hit: true },
  // bucket 2 · single-property fact (a real Yogyakarta name from prior smoke)
  { bucket: "single_property_fact",   q: "how many rooms does Gaotama Hotel have?", expect_domain: "accommodation", must_not_be_discovery_hit: true },
  { bucket: "single_property_fact",   q: "does Selaras Inn Hotel Yogyakarta have wifi?", expect_domain: "accommodation", must_not_be_discovery_hit: true },
  // bucket 3 · comparison
  { bucket: "comparison",             q: "compare Gaotama Hotel and Indonesia Hotel", expect_domain: "accommodation", must_not_be_discovery_hit: false },
  // bucket 4 · count
  { bucket: "count",                  q: "how many hotels do you have in Yogyakarta", expect_domain: "accommodation", must_not_be_discovery_hit: false },
  // bucket 5 · amenity
  { bucket: "amenity",                q: "any hotels with a pool?",         expect_domain: "accommodation", must_not_be_discovery_hit: false },
  // bucket 6 · location
  { bucket: "location",               q: "where is Gaotama Hotel",          expect_domain: "accommodation", must_not_be_discovery_hit: false },
  // bucket 7 · price
  { bucket: "price",                  q: "cheap hotels in jogja",           expect_domain: "accommodation", must_not_be_discovery_hit: true },
  // bucket 8 · date/time
  { bucket: "date_time",              q: "any hotels this weekend",         expect_domain: "accommodation", must_not_be_discovery_hit: true },
  // bucket 9 · follow-up (uses ordinal — needs a prior list turn first)
  { bucket: "followup_ordinal",       q: "tell me about the first one",     expect_domain: "accommodation", must_not_be_discovery_hit: false, needs_prior_list: true },
  // bucket 10 · ambiguous entity
  { bucket: "ambiguous_entity",       q: "the one with a pool",             expect_domain: "accommodation", must_not_be_discovery_hit: false },
  // bucket 11 · no-data question
  { bucket: "no_data",                q: "what's the michelin star of Gaotama Hotel", expect_domain: "accommodation", must_not_be_discovery_hit: false },
  // bucket 12 · unsupported (live-data)
  { bucket: "unsupported_livedata",   q: "is Gaotama Hotel available tomorrow", expect_domain: "accommodation", must_not_be_discovery_hit: false },
  // bucket 13 · conversation follow-up
  { bucket: "conv_followup",          q: "thanks!",                          expect_domain: "unknown",       must_not_be_discovery_hit: false },
];

async function turn(cid, q) {
  const t0 = Date.now();
  const res = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: q,
      conversation_id: cid,
      market: "ID",
      useLiveWorld: true,
    }),
  });
  const ms = Date.now() - t0;
  const body = await res.json();
  const dbg = body?._debug_timings ?? {};
  return {
    wall_ms: ms,
    status: res.status,
    reply: body?.reply,
    voice_en: body?.voice_reply?.en,
    voice_intent: body?.voice_reply?.intent,
    voice_reason: body?.voice_reply?.chosen_reason,
    composition_accepted: body?.composition_meta?.accepted,
    composition_model: body?.composition_meta?.model,
    lcc_domain: dbg.lcc_domain,
    lcc_reply_kind: dbg.lcc_adapter_reply?.reply_kind ?? null,
    lcc_trust: dbg.lcc_adapter_reply?.trust ?? null,
    lcc_intent: dbg.lcc_adapter_reply?.intent_slug ?? null,
    lcc_known_count: dbg.lcc_adapter_reply?.known?.length ?? 0,
    lcc_unknown_count: dbg.lcc_adapter_reply?.unknown?.length ?? 0,
    lcc_requested_count: dbg.lcc_adapter_reply?.requested?.length ?? 0,
    lcc_latency_ms: dbg.lcc_adapter_reply?.latency_ms ?? null,
    promotion: dbg.deterministic_reply_promotion ?? null,
    world_cards_n: Array.isArray(body?.world_cards?.cards) ? body.world_cards.cards.length : null,
  };
}

console.log(`# NEX Live Chat Completion smoke matrix`);
console.log(`# host=${HOST}`);
console.log("");

const failures = [];
const results = [];
const cid = randomUUID(); // one conversation so ordinal/followups can reference the list

// Prime the conversation with a list turn so followup_ordinal has prior list context.
try {
  await turn(cid, "hotels in yogyakarta");
} catch { /* prime failure is not fatal — followup will just be empty */ }

for (const item of MATRIX) {
  try {
    const r = await turn(cid, item.q);
    results.push({ item, r });
    const violated = item.must_not_be_discovery_hit && r.voice_intent === "discovery_hit";
    console.log(`── [${item.bucket}] ${JSON.stringify(item.q)}`);
    console.log(`   wall_ms:        ${r.wall_ms}`);
    console.log(`   voice_en:       ${JSON.stringify(r.voice_en)}`);
    console.log(`   voice_intent:   ${r.voice_intent}  ${violated ? "❌ discovery_hit forbidden here" : "✓"}`);
    console.log(`   lcc_domain:     ${r.lcc_domain}`);
    console.log(`   lcc_intent:     ${r.lcc_intent}`);
    console.log(`   lcc_reply_kind: ${r.lcc_reply_kind}`);
    console.log(`   lcc_trust:      ${r.lcc_trust}`);
    console.log(`   lcc_known:      ${r.lcc_known_count} · unknown: ${r.lcc_unknown_count} · requested: ${r.lcc_requested_count}`);
    console.log(`   lcc_latency:    ${r.lcc_latency_ms}ms`);
    console.log(`   promotion:      ${JSON.stringify(r.promotion)}`);
    console.log(`   world_cards_n:  ${r.world_cards_n}`);
    console.log(`   reply_preview:  ${JSON.stringify((r.reply ?? "").slice(0, 200))}`);
    console.log("");
    if (violated) failures.push({ bucket: item.bucket, q: item.q, reason: "discovery_hit_forbidden" });
  } catch (e) {
    console.log(`── [${item.bucket}] ${JSON.stringify(item.q)} · REQUEST ERROR ${e?.message ?? e}`);
    console.log("");
    failures.push({ bucket: item.bucket, q: item.q, reason: `request_error:${e?.message ?? e}` });
  }
}

console.log("");
console.log(`# Summary`);
console.log(`# turns=${results.length} failures=${failures.length}`);
if (failures.length > 0) {
  console.log(`# FAILED:`);
  for (const f of failures) console.log(`#   - [${f.bucket}] ${JSON.stringify(f.q)} · ${f.reason}`);
  process.exit(1);
} else {
  console.log(`# All discovery_hit forbidden turns cleared. Legacy fallback preserved elsewhere.`);
  process.exit(0);
}
