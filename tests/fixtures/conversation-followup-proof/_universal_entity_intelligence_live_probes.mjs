// Universal Entity Intelligence & Result Card Contract · live probes.
// Philip 2026-09-06 · AUTHORIZE · UNIVERSAL ENTITY INTELLIGENCE

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
        conversation_id: convId,
        message,
        market: opts.market || "ID",
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
    entity_result_cards_count: cm.entity_result_cards_count,
    entity_result_cards_vertical: cm.entity_result_cards_vertical,
    entity_result_cards_avg_coverage: cm.entity_result_cards_avg_coverage,
    entity_result_cards_memoized: cm.entity_result_cards_memoized,
    // Attribute-query gate
    attribute_query_kind: cm.attribute_query_kind,
    attribute_query_gate_fired: cm.attribute_query_gate_fired,
    attribute_query_matched_id: cm.attribute_query_matched_id,
    attribute_query_matched_state: cm.attribute_query_matched_state,
    attribute_query_resolved_name: cm.attribute_query_resolved_name,
    attribute_query_resolved_position: cm.attribute_query_resolved_position,
    // Cross-preservation
    capability_display_act: cm.capability_display_act,
    capability_display_gate_fired: cm.capability_display_gate_fired,
    result_followup_fired: cm.result_followup_fired,
    frame_gate_fired: cm.frame_gate_fired,
    social_emotional_act: cm.social_emotional_act,
    social_emotional_gate_fired: cm.social_emotional_gate_fired,
    // Card structure evidence
    card_names: erc && erc.cards ? erc.cards.map((c) => c.card?.name || c.name).slice(0, 5) : [],
    card_highlights: erc && erc.cards ? erc.cards.map((c) => c.highlights).slice(0, 3) : [],
    card_coverage_pcts: erc && erc.cards ? erc.cards.map((c) => c.coverage?.coverage_pct) : [],
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
      console.log(`     cards=${d.entity_result_cards_count} vertical=${d.entity_result_cards_vertical} avg_cov=${d.entity_result_cards_avg_coverage}%`);
      console.log(`     names=${JSON.stringify(d.card_names)}`);
      console.log(`     highlights=${JSON.stringify(d.card_highlights[0])}`);
    }
    if (d.attribute_query_gate_fired) {
      console.log(`     attr_gate=${d.attribute_query_kind} matched=${d.attribute_query_matched_id}/${d.attribute_query_matched_state} entity=${d.attribute_query_resolved_name}#${d.attribute_query_resolved_position}`);
    }
    if (d.capability_display_gate_fired) console.log(`     cap=${d.capability_display_act}`);
    if (d.result_followup_fired) console.log(`     rf=fired`);
  }
  results.tests.push(record);
}

// ═════════════ §20 · HOTEL CORE FLOW ═════════════

await test("LIVE HOTEL · full attribute conversation",
  "hotels → does first have pool? → what rooms? → which has laundry? → tell me more about second → where find them? → can I book first?",
  [
    { msg: "have you got hotels?" },
    { msg: "does the first one have a pool?" },
    { msg: "what does the first one have?" },
    { msg: "which one has laundry?" },
    { msg: "tell me more about the second one" },
    { msg: "where did you find them?" },
    { msg: "can I book the first one?" },
  ]);

// ═════════════ §21 · CROSS-VERTICAL LIVE PROOF ═════════════

await test("LIVE FOOD · restaurants",
  "restaurants → do any have delivery?",
  [
    { msg: "find me restaurants in Yogyakarta" },
    { msg: "do any have delivery?" },
    { msg: "tell me more about the first one" },
  ]);

await test("LIVE GYM (service) · fitness",
  "gyms → does the first one have personal trainer?",
  [
    { msg: "find me gyms in Yogyakarta" },
    { msg: "does the first one have a personal trainer?" },
  ]);

await test("LIVE COMMERCE · phones",
  "phones → do any have price info?",
  [
    { msg: "find me phones in Yogyakarta" },
    { msg: "which one has a price?" },
  ]);

await test("LIVE SERVICE · plumbers",
  "plumbers → does the first offer emergency?",
  [
    { msg: "find me plumbers" },
    { msg: "does the first one offer emergency service?" },
  ]);

// ═════════════ §10 · UNKNOWN ≠ NO ═════════════

await test("EVIDENCE · UNKNOWN ≠ NO",
  "'does the first have a helicopter pad?' — must be honest UNKNOWN not 'no'",
  [
    { msg: "find me hotels" },
    { msg: "does the first one have a helicopter pad?" },
  ]);

// ═════════════ §22 · PRESERVATION MATRIX ═════════════

await test("PRESERVE · result-followup provenance",
  "hotels → where did you find them?",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
  ]);

await test("PRESERVE · capability-display CAPABILITY_CLARIFICATION",
  "hotels → provenance → what you mean I can't book → ok lets see them",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
    { msg: "what you mean i cant book" },
    { msg: "ok lets see them" },
  ]);

await test("PRESERVE · G12 negation",
  "'I don't want a hotel'",
  [{ msg: "I don't want a hotel" }]);

await test("PRESERVE · G24 scope",
  "'seafood in Japan'",
  [{ msg: "tell me about seafood in Japan" }]);

await test("PRESERVE · P0.4 fresh ordinal",
  "'Tell me about the first hotel' — fresh conv → clarify",
  [{ msg: "Tell me about the first hotel." }]);

await test("PRESERVE · social 'wow nice'",
  "hotels → wow nice",
  [
    { msg: "find me hotels" },
    { msg: "wow nice" },
  ]);

writeFileSync(path.join(here, "_universal_entity_intelligence_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_universal_entity_intelligence_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
