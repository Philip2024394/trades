// NEX Conversational Continuation Slice · D3 + D4 · live HTTP probes
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE · D3 + D4 ONLY

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = process.env.NEX_CHAT_URL || "http://localhost:3008/api/nex-conv/chat";

async function post(convId, message) {
  const r = await fetch(CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: convId, message, market: "ID" }),
  });
  return await r.json();
}

function digest(j) {
  const cm = j.composition_meta || {};
  const wc = j.world_cards;
  return {
    reply: (j.reply || "").slice(0, 260),
    voice_reply_en: j.voice_reply?.en?.slice(0, 240),
    intent: j.intent,
    world_cards_count: wc?.cards?.length ?? 0,
    world_cards_names: wc?.cards?.slice(0, 5).map((c) => c.name) ?? [],
    quantity_gate_fired: cm.quantity_gate_fired,
    quantity_kind: cm.quantity_kind,
    frame_gate_fired: cm.frame_gate_fired,
    frame_transition: cm.frame_transition,
    frame_active_domain: cm.frame_active_domain,
    wave1_gate_reason: cm.wave1_gate_reason,
    wave2_gate_reason: cm.wave2_gate_reason,
    current_reference: j.current_reference,
    entities_count: (j.entities ?? []).length,
    reason: cm.reason,
  };
}

const FABRICATION_TOKENS = [
  "Tokyo Tower", "Shibuya", "Harajuku",
  "Palace Grand", "Royal Deluxe",
  "Michelin star",
];
function hasFabrication(reply) {
  return FABRICATION_TOKENS.find((t) => reply.includes(t)) ?? null;
}

const results = { runAt: new Date().toISOString(), campaigns: [] };

async function campaign(label, description, turns) {
  const cid = randomUUID();
  const record = { label, description, conversation_id: cid, turns: [] };
  console.log(`\n═══ ${label} ═══`);
  console.log(`   ${description}`);
  for (const [i, t] of turns.entries()) {
    const j = await post(cid, t.msg);
    const d = digest(j);
    const fab = hasFabrication(d.reply);
    record.turns.push({ turn: i + 1, message: t.msg, fabricated: fab, ...d });
    console.log(`   T${i + 1} "${t.msg}"`);
    console.log(`      reply         : ${JSON.stringify(d.reply?.slice(0, 220))}`);
    console.log(`      quantity      : gate=${d.quantity_gate_fired ?? false} kind=${d.quantity_kind} reason=${d.wave1_gate_reason ?? "n/a"}`);
    console.log(`      frame         : gate=${d.frame_gate_fired ?? false} transition=${d.frame_transition} domain=${d.frame_active_domain} reason=${d.wave2_gate_reason ?? "n/a"}`);
    console.log(`      cards         : ${d.world_cards_count} names=[${d.world_cards_names.join(", ")}]`);
    console.log(`      currentRef    : ${d.current_reference?.resolved ? `resolved offset=${d.current_reference.offset} refKind=${d.current_reference.refKind}` : `unresolved (${d.current_reference?.reason ?? "n/a"})`}`);
    console.log(`      fab=${fab ?? "no"}`);
  }
  results.campaigns.push(record);
  return record;
}

// ══════════════════════════════════════════════════════════════════
// A · HOTEL QUANTITY (D3 primary)
// ══════════════════════════════════════════════════════════════════
await campaign("A · Hotel quantity continuation",
  "T1 hotels · T2 one more · T3 two more · T4 tell me about the first one",
  [
    { msg: "need hotel tonight" },
    { msg: "one more" },
    { msg: "two more" },
    { msg: "tell me about the first one" },
  ]);

// ══════════════════════════════════════════════════════════════════
// B · HOTEL → RESTAURANT (D4 primary)
// ══════════════════════════════════════════════════════════════════
await campaign("B · Hotel → restaurant topic switch",
  "T1 hotels · T2 actually restaurant · T3 first one (must be restaurant NOT hotel)",
  [
    { msg: "need hotel tonight" },
    { msg: "actually, I need a restaurant" },
    { msg: "show me the first one" },
  ]);

// ══════════════════════════════════════════════════════════════════
// C · EXPLICIT NEW SEARCH (preservation)
// ══════════════════════════════════════════════════════════════════
await campaign("C · Explicit new hotel search after prior hotels",
  "T1 hotels · T2 explicit new hotel search near airport — must be fresh discovery",
  [
    { msg: "need hotel tonight" },
    { msg: "find me another hotel near the airport" },
  ]);

// ══════════════════════════════════════════════════════════════════
// D · REFERENCE + QUANTITY
// ══════════════════════════════════════════════════════════════════
await campaign("D · Reference + quantity",
  "T1 hotels · T2 second one · T3 one more like that",
  [
    { msg: "need hotel tonight" },
    { msg: "tell me about the second one" },
    { msg: "show me one more like that" },
  ]);

// ══════════════════════════════════════════════════════════════════
// E · NEGATION preservation (G12)
// ══════════════════════════════════════════════════════════════════
await campaign("E · Negation preservation",
  "T1 hotels · T2 'I don't want another one' → G12 negation wins",
  [
    { msg: "need hotel tonight" },
    { msg: "I don't want another one" },
  ]);

// ══════════════════════════════════════════════════════════════════
// F · FRESH-CONVERSATION quantity
// ══════════════════════════════════════════════════════════════════
await campaign("F · Fresh session quantity",
  "Fresh session · 'one more' → honest clarification, no fabrication",
  [
    { msg: "one more" },
  ]);

// ══════════════════════════════════════════════════════════════════
// G · FRESH-CONVERSATION ordinal (P0.4 preservation)
// ══════════════════════════════════════════════════════════════════
await campaign("G · Fresh session ordinal",
  "Fresh session · 'show me the first one' → P0.4 honest clarification",
  [
    { msg: "show me the first one" },
  ]);

// ══════════════════════════════════════════════════════════════════
// H · D3 · TOPIC-CHANGE WITHIN QUANTITY (§F safety)
// ══════════════════════════════════════════════════════════════════
await campaign("H · Quantity + explicit different vertical",
  "T1 hotels · T2 'I need one more restaurant' — must NOT answer with hotels",
  [
    { msg: "need hotel tonight" },
    { msg: "I need one more restaurant" },
  ]);

// ─── Scoring ────────────────────────────────────────────────────
const outPath = path.join(here, "_conversational_continuation_slice_live_probes.json");

// Campaign A
const A = results.campaigns[0];
const a_t2_quantity = A.turns[1].quantity_gate_fired === true
                    && (A.turns[1].wave1_gate_reason ?? "").includes("incremental_continuation");
const a_t2_no_repeat = !A.turns[1].reply.includes("Which city or area are you looking at");
const a_t4_ordinal   = A.turns[3].current_reference?.resolved === true
                    && A.turns[3].current_reference?.refKind === "ordinal";

// Campaign B
const B = results.campaigns[1];
const b_t2_topic_shift = B.turns[1].frame_gate_fired === true
                       && (B.turns[1].wave2_gate_reason ?? "").includes("topic_shift_vertical_switch");
const b_t2_reply_restaurants = /restaurant|restoran|food/i.test(B.turns[1].reply);
const b_t3_no_stale_hotel = !B.turns[2].reply.includes("Gaotama Hotel")
                          && !B.turns[2].reply.includes("Selaras Inn");

// Campaign C
const C = results.campaigns[2];
const c_new_search_fresh = C.turns[1].world_cards_count > 0 || /\bhotel/i.test(C.turns[1].reply);

// Campaign D
const D = results.campaigns[3];
const d_ref_second = D.turns[1].current_reference?.resolved === true
                   && D.turns[1].current_reference?.offset === 2;

// Campaign E · G12 preservation — negation must not produce quantity continuation
const E = results.campaigns[4];
// The negation gate should fire OR quantity continuation should NOT fire.
const e_no_quantity_continuation = !(E.turns[1].wave1_gate_reason ?? "").includes("incremental_continuation");

// Campaign F · defensive quantity gate still works
const F = results.campaigns[5];
const f_defensive = /more of what|haven't shown/i.test(F.turns[0].reply);

// Campaign G · P0.4 preserved
const G = results.campaigns[6];
const g_p04_honest = /which hotel do you mean|don't have a previous|no previous|previous.*list|haven't shown any results/i.test(G.turns[0].reply);

// Campaign H · quantity yields to topic shift
const H = results.campaigns[7];
const h_topic_shift_wins = H.turns[1].frame_gate_fired === true
                         || !((H.turns[1].wave1_gate_reason ?? "").includes("incremental_continuation"));

const anyFab = results.campaigns.some((c) => c.turns.some((t) => t.fabricated));

console.log(`\n═══ CONVERSATIONAL CONTINUATION VERDICT ═══`);
console.log(`  A · 'one more' fires positive quantity gate      : ${a_t2_quantity ? "PASS" : "FAIL"}`);
console.log(`  A · 'one more' reply is not verbatim discovery   : ${a_t2_no_repeat ? "PASS" : "FAIL"}`);
console.log(`  A · T4 ordinal still resolves                    : ${a_t4_ordinal ? "PASS" : "FAIL"}`);
console.log(`  B · 'actually restaurant' fires topic-shift gate : ${b_t2_topic_shift ? "PASS" : "FAIL"}`);
console.log(`  B · reply names restaurants/food                 : ${b_t2_reply_restaurants ? "PASS" : "FAIL"}`);
console.log(`  B · T3 'first one' no stale hotel                : ${b_t3_no_stale_hotel ? "PASS" : "FAIL"}`);
console.log(`  C · Explicit new hotel search still runs         : ${c_new_search_fresh ? "PASS" : "FAIL"}`);
console.log(`  D · Reference 'second one' still resolves        : ${d_ref_second ? "PASS" : "FAIL"}`);
console.log(`  E · Negation not treated as quantity continuation: ${e_no_quantity_continuation ? "PASS" : "FAIL"}`);
console.log(`  F · Fresh 'one more' defensive gate              : ${f_defensive ? "PASS" : "FAIL"}`);
console.log(`  G · P0.4 fresh ordinal preserved                 : ${g_p04_honest ? "PASS" : "FAIL"}`);
console.log(`  H · Quantity+different vertical yields to topic  : ${h_topic_shift_wins ? "PASS" : "FAIL"}`);
console.log(`  Zero fabrications overall                        : ${!anyFab ? "PASS" : "FAIL"}`);

results.verdicts = {
  a_t2_quantity, a_t2_no_repeat, a_t4_ordinal,
  b_t2_topic_shift, b_t2_reply_restaurants, b_t3_no_stale_hotel,
  c_new_search_fresh,
  d_ref_second,
  e_no_quantity_continuation,
  f_defensive,
  g_p04_honest,
  h_topic_shift_wins,
  zero_fabrications: !anyFab,
};

writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`\nWrote ${outPath}`);
