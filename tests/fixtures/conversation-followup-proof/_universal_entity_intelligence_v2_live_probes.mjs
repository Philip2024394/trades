// Universal Entity Intelligence v2 · live HTTP probes.
// Philip 2026-09-06 · AUTHORIZE · 6-state + Villa + Pipeline delta.

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = "http://localhost:3008/api/nex-conv/chat";

async function post(convId, message, opts = {}) {
  try {
    const r = await fetch(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: convId, message, market: opts.market || "ID",
      }),
    });
    return await r.json();
  } catch (err) { return { error: String(err) }; }
}

function digest(j) {
  const cm = j.composition_meta || {};
  const erc = j.entity_result_cards || null;
  return {
    reply: (j.reply || "").slice(0, 340),
    // Universal entity contract v2 observability
    entity_result_cards_count: cm.entity_result_cards_count,
    entity_result_cards_vertical: cm.entity_result_cards_vertical,
    entity_result_cards_avg_coverage: cm.entity_result_cards_avg_coverage,
    entity_result_cards_avg_evidence_pct: cm.entity_result_cards_avg_evidence_pct,
    entity_result_cards_total_unverified: cm.entity_result_cards_total_unverified,
    entity_result_cards_total_stale: cm.entity_result_cards_total_stale,
    entity_result_cards_total_conflicting: cm.entity_result_cards_total_conflicting,
    // Attribute-query gate v2 · 6-state matched values
    attribute_query_kind: cm.attribute_query_kind,
    attribute_query_gate_fired: cm.attribute_query_gate_fired,
    attribute_query_matched_id: cm.attribute_query_matched_id,
    attribute_query_matched_state: cm.attribute_query_matched_state,
    attribute_query_resolved_name: cm.attribute_query_resolved_name,
    // Preservation
    capability_display_act: cm.capability_display_act,
    capability_display_gate_fired: cm.capability_display_gate_fired,
    result_followup_fired: cm.result_followup_fired,
    social_emotional_act: cm.social_emotional_act,
    social_emotional_gate_fired: cm.social_emotional_gate_fired,
    // Card structure with v2 buckets
    card_names: erc && erc.cards ? erc.cards.map((c) => c.card?.name).slice(0, 5) : [],
    card_verified_highlights: erc && erc.cards ? erc.cards.map((c) => c.highlights).slice(0, 3) : [],
    card_unverified_highlights: erc && erc.cards ? erc.cards.map((c) => c.unverified_highlights).slice(0, 3) : [],
    card_coverage_pcts: erc && erc.cards ? erc.cards.map((c) => c.coverage?.coverage_pct) : [],
    card_evidence_pcts: erc && erc.cards ? erc.cards.map((c) => c.coverage?.evidence_pct) : [],
  };
}

const results = { runAt: new Date().toISOString(), tests: [] };
async function test(label, description, turns) {
  console.log(`\n═══ ${label} ═══`);
  console.log(`  ${description}`);
  const cid = randomUUID();
  const record = { label, description, conversation_id: cid, turns: [] };
  for (const [i, t] of turns.entries()) {
    const j = await post(cid, t.msg, { market: t.market || "ID" });
    const d = digest(j);
    record.turns.push({ turn: i + 1, message: t.msg, ...d });
    console.log(`  T${i + 1} "${t.msg}"`);
    console.log(`     reply: ${JSON.stringify(d.reply?.slice(0, 210))}`);
    if (d.entity_result_cards_count) {
      console.log(`     cards=${d.entity_result_cards_count} v_cov=${d.entity_result_cards_avg_coverage}% e_cov=${d.entity_result_cards_avg_evidence_pct}% unv=${d.entity_result_cards_total_unverified} stale=${d.entity_result_cards_total_stale}`);
      console.log(`     names=${JSON.stringify(d.card_names)}`);
      console.log(`     verified_h=${JSON.stringify(d.card_verified_highlights[0])} unverified_h=${JSON.stringify(d.card_unverified_highlights[0])}`);
    }
    if (d.attribute_query_gate_fired) {
      console.log(`     attr=${d.attribute_query_kind}/${d.attribute_query_matched_id}/${d.attribute_query_matched_state} entity=${d.attribute_query_resolved_name}`);
    }
    if (d.capability_display_gate_fired) console.log(`     cap=${d.capability_display_act}`);
    if (d.result_followup_fired) console.log(`     rf=fired`);
  }
  results.tests.push(record);
}

// ═════════════ Full 6-state hotel flow ═════════════
await test("LIVE HOTEL v2 · full flow",
  "hotels → does first have pool? → what does first have? → which has laundry? → tell me more about second → provenance → book?",
  [
    { msg: "have you got hotels?" },
    { msg: "does the first one have a pool?" },
    { msg: "what does the first one have?" },
    { msg: "which one has laundry?" },
    { msg: "tell me more about the second one" },
    { msg: "where did you find them?" },
    { msg: "can I book the first one?" },
  ]);

// ═════════════ Villa vertical ═════════════
await test("LIVE VILLA · category-aware attributes",
  "'find me villas in Bali' → does the first have private pool? → how many bedrooms?",
  [
    { msg: "find me villas in Bali" },
    { msg: "does the first one have a private pool?" },
    { msg: "how many bedrooms?" },
  ]);

// ═════════════ UNKNOWN ≠ FALSE ═════════════
await test("EVIDENCE · UNKNOWN ≠ FALSE (helicopter pad)",
  "'does the first have a helicopter pad?' → honest UNKNOWN not 'no'",
  [
    { msg: "find me hotels" },
    { msg: "does the first one have a helicopter pad?" },
  ]);

// ═════════════ Preservation ═════════════
await test("PRESERVE · result-followup",
  "'where did you find them?' still works",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
  ]);

await test("PRESERVE · capability CAPABILITY_CLARIFICATION",
  "'what you mean I can't book' after provenance",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
    { msg: "what you mean i cant book" },
    { msg: "ok lets see them" },
  ]);

await test("PRESERVE · G12 negation",
  "'I don't want a hotel'",
  [{ msg: "I don't want a hotel" }]);

await test("PRESERVE · G24 scope block",
  "'seafood in Japan'",
  [{ msg: "tell me about seafood in Japan" }]);

await test("PRESERVE · P0.4 fresh ordinal",
  "'Tell me about the first hotel.'",
  [{ msg: "Tell me about the first hotel." }]);

await test("PRESERVE · social 'wow nice'",
  "hotels → wow nice",
  [
    { msg: "find me hotels" },
    { msg: "wow nice" },
  ]);

await test("PRESERVE · Wave 3 STT normalization",
  "'find me a hotal'",
  [{ msg: "find me a hotal near malioboro" }]);

writeFileSync(path.join(here, "_universal_entity_intelligence_v2_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_universal_entity_intelligence_v2_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
