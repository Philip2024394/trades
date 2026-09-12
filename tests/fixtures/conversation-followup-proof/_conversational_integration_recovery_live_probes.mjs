// NEX · Conversational Integration Recovery · live HTTP verification
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// Verifies the route.ts gate reorder (entity-reasoning above attribute-
// query) fixed defect B without regressing D3/D4, attribute-query,
// interest, G12, fresh-safety, Indonesian.

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = "http://localhost:3008/api/nex-conv/chat";

async function post(cid, msg, market = "ID") {
  const r = await fetch(CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: cid, message: msg, market }),
  });
  return r.json();
}

function digest(j) {
  const cm = j.composition_meta || {};
  return {
    reply: (j.reply || "").slice(0, 260),
    reason: cm.reason,
    aq_fired: cm.attribute_query_gate_fired === true,
    aq_kind: cm.attribute_query_kind,
    er_fired: cm.entity_reasoning_gate_fired === true,
    er_kind: cm.entity_reasoning_kind,
    interest_fired: cm.interest_gate_fired === true,
    interest_kind: cm.interest_gate_kind,
    frame_fired: cm.frame_gate_fired === true,
    frame_switch: cm.frame_vertical_switch_target,
    qty_fired: cm.quantity_gate_fired === true,
    qty_kind: cm.quantity_constraint_kind,
  };
}

const FABRICATION_TOKENS = [
  "+62 812", "info@gaotama", "wa.me/62",
  "sushi", "sashimi", "ramen", "tokyo tower",
  "Rp1,000,000", "Rp2,000,000",
  "highly recommend", "definitely the best",
];
function reachedFabrication(text) {
  const t = (text || "").toLowerCase();
  for (const f of FABRICATION_TOKENS) if (t.includes(f.toLowerCase())) return f;
  return null;
}

const results = { runAt: new Date().toISOString(), campaigns: {} };

async function campaign(id, description, turns) {
  const cid = randomUUID();
  console.log(`\n=== ${id} · ${description} ===`);
  const rec = { id, description, conversation_id: cid, turns: [] };
  for (const [i, t] of turns.entries()) {
    const j = await post(cid, t.msg, t.market || "ID");
    const d = digest(j);
    const fab = reachedFabrication(d.reply);
    rec.turns.push({ turn: i + 1, message: t.msg, fabricated: fab, ...d });
    console.log(`  T${i + 1} "${t.msg}"`);
    console.log(`     reply: ${JSON.stringify(d.reply.slice(0, 220))}`);
    console.log(`     reason: ${d.reason}`);
    console.log(`     gates: er=${d.er_fired}/${d.er_kind || "-"} aq=${d.aq_fired}/${d.aq_kind || "-"} int=${d.interest_fired} qty=${d.qty_fired}/${d.qty_kind || "-"} frame=${d.frame_fired}/${d.frame_switch || "-"}`);
    if (fab) console.log(`     FAB: ${fab}`);
  }
  results.campaigns[id] = rec;
  return rec;
}

// --- PRIMARY DEFECT REPAIR ------------------------------------
await campaign("R1_reasoning_gate_primary_target",
  "what are you basing that on must reach reasoning NOT attribute", [
    { msg: "find hotels in Yogyakarta" },
    { msg: "which would you choose?" },
    { msg: "what are you basing that on?" },
    { msg: "are you sure?" },
    { msg: "what dont you know?" },
  ]);

// --- ATTRIBUTE vs REASONING DISTINCTION -----------------------
await campaign("R2_attribute_still_wins_for_attribute_questions",
  "does it have a pool must remain attribute-query", [
    { msg: "find hotels in Yogyakarta" },
    { msg: "does it have a pool?" },
    { msg: "which one has laundry?" },
    { msg: "tell me more about the first one" },
    { msg: "what does the second have?" },
  ]);

// --- REASONING NATURAL VARIATIONS -----------------------------
await campaign("R3_reasoning_natural_variations",
  "semantic equivalents all classify as reasoning", [
    { msg: "find hotels in Yogyakarta" },
    { msg: "which would you choose?" },
    { msg: "what evidence supports that?" },
    { msg: "what makes you say that?" },
    { msg: "on what basis?" },
    { msg: "what is that based on?" },
  ]);

// --- D3 QUANTITY CONTINUATION ---------------------------------
await campaign("R4_d3_quantity_continuation",
  "one more / another one continues result set", [
    { msg: "find hotels in Yogyakarta" },
    { msg: "one more" },
    { msg: "another one" },
    { msg: "2 more" },
  ]);

// --- D4 VERTICAL SWITCH ---------------------------------------
await campaign("R5_d4_vertical_switch_and_post_shift_ordinal",
  "actually I need a restaurant shifts vertical; post-shift ordinal honest", [
    { msg: "show me hotels" },
    { msg: "actually I need a restaurant" },
    { msg: "show me the first one" },
  ]);

// --- FRESH ORDINAL SAFETY (P0.4) ------------------------------
await campaign("R6_fresh_conversation_reasoning_boundary",
  "which would you choose fresh convo honest boundary", [
    { msg: "which would you choose?" },
  ]);
await campaign("R7_fresh_conversation_evidence_challenge",
  "what are you basing that on fresh convo honest boundary", [
    { msg: "what are you basing that on?" },
  ]);

// --- G12 NEGATION PRESERVATION --------------------------------
await campaign("R8_g12_negation_preserved",
  "I dont want the first one rejects first, not the task", [
    { msg: "find hotels in Yogyakarta" },
    { msg: "I dont want the first one" },
  ]);

// --- INDONESIAN SEMANTIC EQUIVALENTS --------------------------
await campaign("R9_indonesian_reasoning_equivalents",
  "ID variants classify as reasoning, no EN leakage", [
    { msg: "cari hotel di Yogyakarta" },
    { msg: "mana yang akan kamu pilih?" },
    { msg: "kamu yakin?" },
    { msg: "dasarnya apa?" },
    { msg: "apa yang belum kamu ketahui?" },
  ]);

// --- ADVERSARIAL: attribute-shaped reasoning ------------------
await campaign("R10_adversarial_attribute_shaped_reasoning",
  "what evidence... starts with what but must not become attribute", [
    { msg: "find hotels in Yogyakarta" },
    { msg: "which would you choose?" },
    { msg: "what evidence do you have?" },
    { msg: "how do you know?" },
  ]);

// --- ZERO-EVIDENCE BOUNDARY (P0 preservation) -----------------
await campaign("R11_zero_evidence_boundary",
  "What about Japan fresh no fabrication", [
    { msg: "What about Japan?" },
  ]);

// --- INTEREST GATE PRESERVATION -------------------------------
await campaign("R12_interest_gate_preserved",
  "Im interested still gates via interest, not intercepted by reasoning", [
    { msg: "find hotels in Yogyakarta" },
    { msg: "Im interested" },
  ]);

// --- Verdicts -------------------------------------------------
function T(id, idx) { return results.campaigns[id]?.turns[idx]; }
function anyFab() {
  for (const c of Object.values(results.campaigns)) {
    for (const t of c.turns) if (t.fabricated) return { at: `${c.id}·T${t.turn}`, token: t.fabricated };
  }
  return null;
}

const verdicts = {
  R1_which_reaches_reasoning:                    T("R1_reasoning_gate_primary_target", 1)?.er_fired === true,
  R1_basing_reaches_reasoning_not_attribute:     T("R1_reasoning_gate_primary_target", 2)?.er_fired === true && T("R1_reasoning_gate_primary_target", 2)?.aq_fired === false,
  R1_sure_reaches_reasoning:                     T("R1_reasoning_gate_primary_target", 3)?.er_fired === true,
  R1_dont_know_reaches_reasoning:                T("R1_reasoning_gate_primary_target", 4)?.er_fired === true,

  R2_pool_still_attribute:                       T("R2_attribute_still_wins_for_attribute_questions", 1)?.aq_fired === true && T("R2_attribute_still_wins_for_attribute_questions", 1)?.er_fired === false,
  R2_laundry_still_attribute:                    T("R2_attribute_still_wins_for_attribute_questions", 2)?.aq_fired === true,
  R2_tell_me_more_still_attribute:               T("R2_attribute_still_wins_for_attribute_questions", 3)?.aq_fired === true,
  R2_what_does_have_still_attribute:             T("R2_attribute_still_wins_for_attribute_questions", 4)?.aq_fired === true,

  R3_evidence_supports:                          T("R3_reasoning_natural_variations", 2)?.er_fired === true,
  R3_makes_you_say:                              T("R3_reasoning_natural_variations", 3)?.er_fired === true,
  R3_on_what_basis:                              T("R3_reasoning_natural_variations", 4)?.er_fired === true,
  R3_that_based_on:                              T("R3_reasoning_natural_variations", 5)?.er_fired === true,

  R4_one_more:                                   /boundary:quantity:incremental/.test(T("R4_d3_quantity_continuation", 1)?.reason || ""),
  R4_another_one:                                /boundary:quantity:incremental/.test(T("R4_d3_quantity_continuation", 2)?.reason || ""),
  R4_two_more:                                   /boundary:quantity:incremental/.test(T("R4_d3_quantity_continuation", 3)?.reason || ""),

  R5_vertical_switch:                            /topic_shift_vertical_switch|switch:accommodation|switch/i.test(T("R5_d4_vertical_switch_and_post_shift_ordinal", 1)?.reason || ""),
  R5_post_shift_ordinal_honest:                  /haven'?t shown any results|no result set|no active/i.test(T("R5_d4_vertical_switch_and_post_shift_ordinal", 2)?.reply || ""),

  R6_fresh_recommend_honest:                     T("R6_fresh_conversation_reasoning_boundary", 0)?.er_fired === true,
  R7_fresh_evidence_honest:                      T("R7_fresh_conversation_evidence_challenge", 0)?.er_fired === true,

  R8_negation_no_new_search:                     !/here (are|is)\s+\d+/i.test(T("R8_g12_negation_preserved", 1)?.reply || ""),

  R9_id_which_choose:                            T("R9_indonesian_reasoning_equivalents", 1)?.er_fired === true,
  R9_id_yakin:                                   T("R9_indonesian_reasoning_equivalents", 2)?.er_fired === true,
  R9_id_dasarnya:                                T("R9_indonesian_reasoning_equivalents", 3)?.er_fired === true,
  R9_id_belum_ketahui:                           T("R9_indonesian_reasoning_equivalents", 4)?.er_fired === true,

  R10_evidence_do_you_have:                      T("R10_adversarial_attribute_shaped_reasoning", 2)?.er_fired === true && T("R10_adversarial_attribute_shaped_reasoning", 2)?.aq_fired === false,
  R10_how_do_you_know:                           T("R10_adversarial_attribute_shaped_reasoning", 3)?.er_fired === true,

  R11_zero_ev_japan_no_fabrication:              !/sushi|sashimi|ramen|tokyo tower|shibuya|harajuku/i.test(T("R11_zero_evidence_boundary", 0)?.reply || ""),

  R12_interest_still_gates_via_interest:         T("R12_interest_gate_preserved", 1)?.interest_fired === true || /which one|no verified contact|no problem|no listing/i.test(T("R12_interest_gate_preserved", 1)?.reply || ""),

  zero_fabrications:                             !anyFab(),
};

results.verdicts = verdicts;
const outPath = path.join(here, "_conversational_integration_recovery_live_probes.json");
writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

console.log(`\n=== INTEGRATION RECOVERY VERDICTS ===`);
let pass = 0, fail = 0;
for (const [k, v] of Object.entries(verdicts)) {
  console.log(`  ${k.padEnd(46)} : ${v ? "PASS" : "FAIL"}`);
  if (v) pass++; else fail++;
}
console.log(`\nTOTALS pass=${pass} fail=${fail} fabrication=${anyFab() ? anyFab().token : "none"}`);
console.log(`Wrote ${outPath}`);
