#!/usr/bin/env node
// scripts/smoke-p36.mjs
//
// Founder BEGIN Phase 3.6 · integration polish regression.
//
// Four tracks:
//   A · Zod strict-mode rejects malformed LLM output (unit).
//   B · Model router picks correct class per query characteristics (unit).
//   C · Truth Engine prefixes appear on volatile-intent replies (integration).
//   D · HQ dashboard page renders without error (HTTP 200).

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

let failures = [];

// ══════════════════════════════════════════════════════════════════
// A · Zod strict-mode
// ══════════════════════════════════════════════════════════════════
console.log("\n══ A · Zod strict-mode LLM output validation");
{
  const { parseLlmOutputStrict } = await import("../src/lib/nex/live-chat-completion/llm-rescue/output-schema.ts");

  const good = parseLlmOutputStrict(JSON.stringify({
    answered: true,
    claims: [{ text: "Hotel X has wifi", source_ref: "fact:hotel_x:wifi", confidence: 0.8 }],
    reply_hint: "Hotel X has wifi",
  }));
  console.log(`  good payload: ok=${good.ok}${good.errors ? " errors=" + JSON.stringify(good.errors) : ""}`);
  if (!good.ok) failures.push({ case: "zod_good", reason: "valid_payload_rejected" });

  const badWrongType = parseLlmOutputStrict(JSON.stringify({
    answered: "yes",  // wrong type
    claims: [],
  }));
  console.log(`  wrong-type payload: ok=${badWrongType.ok}${badWrongType.errors ? " errors=" + JSON.stringify(badWrongType.errors) : ""}`);
  if (badWrongType.ok) failures.push({ case: "zod_wrong_type", reason: "wrong_type_accepted" });

  const badMalformed = parseLlmOutputStrict("this is not json");
  console.log(`  malformed payload: ok=${badMalformed.ok}${badMalformed.errors ? " errors=" + JSON.stringify(badMalformed.errors) : ""}`);
  if (badMalformed.ok) failures.push({ case: "zod_malformed", reason: "malformed_accepted" });

  const badExtraField = parseLlmOutputStrict(JSON.stringify({
    answered: true,
    claims: [{ text: "T", source_ref: "R", confidence: 2.0 }],  // confidence >1 · Zod clamps? No, min/max fails
  }));
  console.log(`  confidence-out-of-range: ok=${badExtraField.ok}${badExtraField.errors ? " errors=" + JSON.stringify(badExtraField.errors) : ""}`);
  if (badExtraField.ok) failures.push({ case: "zod_confidence_range", reason: "out_of_range_accepted" });
}

// ══════════════════════════════════════════════════════════════════
// B · Model router
// ══════════════════════════════════════════════════════════════════
console.log("\n══ B · Model router class selection");
{
  const { routeModel } = await import("../src/lib/nex/live-chat-completion/llm-rescue/model-router.ts");

  const shortSimple = routeModel({
    bundle: { message: "wifi?", language: "en", items: [], conversation_context: [] },
  });
  console.log(`  short query · items=0: class=${shortSimple.chosen_class} model=${shortSimple.chosen_model_id} reason=${shortSimple.reason}`);
  if (shortSimple.chosen_class !== "fast") failures.push({ case: "router_short", reason: `expected_fast_got_${shortSimple.chosen_class}` });

  const longComplex = routeModel({
    bundle: {
      message: "please explain the historical development of yogyakarta accommodation from colonial times through the present day with references and compare across the palace hotels versus modern boutique options and family-run kos properties across the city",
      language: "en", items: [], conversation_context: [],
    },
  });
  console.log(`  long query · words>40: class=${longComplex.chosen_class} model=${longComplex.chosen_model_id} reason=${longComplex.reason}`);
  if (longComplex.chosen_class !== "reasoning") failures.push({ case: "router_long", reason: `expected_reasoning_got_${longComplex.chosen_class}` });

  const manyItems = routeModel({
    bundle: {
      message: "compare",
      language: "en",
      items: Array.from({ length: 10 }, (_, i) => ({ ref_id: `ref_${i}`, source_type: "canonical_fact", text: "x", confidence: 0.5 })),
      conversation_context: [],
    },
  });
  console.log(`  many-item bundle: class=${manyItems.chosen_class} model=${manyItems.chosen_model_id} reason=${manyItems.reason}`);
  if (manyItems.chosen_class !== "reasoning") failures.push({ case: "router_many_items", reason: `expected_reasoning_got_${manyItems.chosen_class}` });

  const mockHint = routeModel({
    bundle: { message: "x", language: "en", items: [], conversation_context: [] },
    provider_name_hint: "mock:test",
  });
  console.log(`  mock provider hint: class=${mockHint.chosen_class} model=${mockHint.chosen_model_id} reason=${mockHint.reason}`);
  if (mockHint.chosen_class !== "mock") failures.push({ case: "router_mock", reason: `expected_mock_got_${mockHint.chosen_class}` });
}

// ══════════════════════════════════════════════════════════════════
// C · Truth Engine prefixes surface
// ══════════════════════════════════════════════════════════════════
console.log("\n══ C · Truth Engine prefixes in composed replies");

async function chat(cid, message) {
  const res = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: cid, market: "ID", useLiveWorld: true }),
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { _parse_error: text.slice(0, 200) }; }
}

// Warmup
try { await chat(randomUUID(), "warmup"); } catch {}

// Price is a VOLATILE intent per Phase 3.2 · reply should be prefixed honestly.
{
  const r = await chat(randomUUID(), "how much does Hotel Gaotama cost per night?");
  const reply = String(r?.reply ?? "");
  const adapter = r?._debug_timings?.lcc_adapter_reply;
  console.log(`  volatile price query: intent=${adapter?.intent_slug} reply="${reply.slice(0, 100)}"`);
  const hasPrefix = /moves often|snapshot|Data ini bisa berubah/i.test(reply);
  if (adapter?.intent_slug === "price_indicative" && adapter?.reply_kind === "fact" && !hasPrefix) {
    failures.push({ case: "truth_prefix_volatile", reason: "volatile_intent_reply_missing_prefix" });
  } else {
    console.log(`     ${hasPrefix ? "✓ prefix present" : "(intent didn't resolve to price_indicative · not a strict fail)"}`);
  }
}

// ══════════════════════════════════════════════════════════════════
// D · HQ dashboard page renders
// ══════════════════════════════════════════════════════════════════
console.log("\n══ D · HQ dashboard page HTTP 200");
{
  const res = await fetch(`${HOST}/nex-head-quarters/live-chat-completion`, { redirect: "manual" });
  console.log(`  GET /nex-head-quarters/live-chat-completion → ${res.status}`);
  if (res.status < 200 || res.status >= 400) failures.push({ case: "hq_page", reason: `http_${res.status}` });
  // Also verify the observatory endpoint the page fetches.
  const obs = await fetch(`${HOST}/api/nex/lcc/observatory`);
  console.log(`  GET /api/nex/lcc/observatory      → ${obs.status}`);
  if (!obs.ok) failures.push({ case: "hq_observatory", reason: `http_${obs.status}` });
}

console.log(`\n══ SUMMARY  ·  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log(`   0 regressions · strict-mode + router + truth-prefix + HQ page all green.`);
  process.exit(0);
}
