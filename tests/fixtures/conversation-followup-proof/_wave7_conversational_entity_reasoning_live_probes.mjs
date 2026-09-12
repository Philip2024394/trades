// NEX Wave 7 · Conversational Entity Reasoning · live HTTP probes
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// Proves via /api/nex-conv/chat:
//   A · Discovery then "which would you choose?" → grounded recommendation
//   B · "compare the first two" → structured comparison, no fabricated equality
//   C · "why?" → cited reason from supported claims
//   D · "which is cheapest?" when price is UNKNOWN → honest boundary, no
//         fabricated ranking
//   E · "are you sure?" → evidence request / honest boundary
//   F · "what don't you know?" → lists missing attributes
//   G · Indonesian "bandingkan yang pertama dan kedua"
//   H · Fresh session adversarial "which would you choose?" → honest boundary

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = "http://localhost:3008/api/nex-conv/chat";

async function post(convId, message) {
  const r = await fetch(CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: convId, message, market: "ID" }),
  });
  return r.json();
}

function digest(j) {
  const cm = j.composition_meta || {};
  return {
    reply: (j.reply || "").slice(0, 400),
    voice_reply_en: j.voice_reply?.en?.slice(0, 400),
    entity_reasoning_kind: cm.entity_reasoning_kind,
    entity_reasoning_gate_fired: cm.entity_reasoning_gate_fired,
    entity_reasoning_has_result_set: cm.entity_reasoning_has_result_set,
    entity_reasoning_claim_count: cm.entity_reasoning_claim_count,
    entity_reasoning_missing_evidence_count: cm.entity_reasoning_missing_evidence_count,
    entity_reasoning_recommendation: cm.entity_reasoning_recommendation,
    entity_reasoning_reason: cm.entity_reasoning_reason,
    world_cards_count: j.world_cards?.cards?.length ?? 0,
    knowledge_count: cm.knowledge_count,
  };
}

const FABRICATION_TOKENS = [
  "cheapest", "Rp 500", "$100", "Michelin", "5-star",
];
function reachesFabrication(text) {
  // Only flags when the FABRICATED-fact is asserted as fact — the word
  // "cheapest" in a phrase like "which is cheapest?" (echo of the user's
  // question) shouldn't fire. Check for definitive assertion patterns.
  const t = (text || "").toLowerCase();
  if (/gaotama is (the )?cheapest/.test(t)) return "gaotama is cheapest";
  if (/selaras is (the )?cheapest/.test(t)) return "selaras is cheapest";
  if (/(rp|Rp)\s?\d{3,}/.test(text || "")) return "fabricated Rp price";
  if (/\$\d+/.test(text || "")) return "fabricated $ price";
  return null;
}

const results = { runAt: new Date().toISOString(), campaigns: {} };

async function campaign(id, description, turns) {
  const cid = randomUUID();
  console.log(`\n═══ ${id} · ${description} ═══`);
  const record = { id, description, conversation_id: cid, turns: [] };
  for (const [i, t] of turns.entries()) {
    const j = await post(cid, t.msg);
    const d = digest(j);
    const fab = reachesFabrication(d.reply);
    record.turns.push({ turn: i + 1, message: t.msg, fabricated: fab, ...d });
    console.log(`   T${i + 1} "${t.msg}"`);
    console.log(`      reply: ${JSON.stringify(d.reply?.slice(0, 260))}`);
    console.log(`      reasoning: kind=${d.entity_reasoning_kind} gate=${d.entity_reasoning_gate_fired ?? false} claims=${d.entity_reasoning_claim_count ?? "-"} missing=${d.entity_reasoning_missing_evidence_count ?? "-"} rec=${d.entity_reasoning_recommendation ?? "-"}`);
    console.log(`      cards: ${d.world_cards_count} · fab=${fab ?? "no"}`);
  }
  results.campaigns[id] = record;
  return record;
}

// ─── Campaigns ───────────────────────────────────────────────
await campaign("A_recommendation",
  "Discovery → 'which would you choose?' → grounded recommendation",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "which would you choose?" },
  ]);

await campaign("B_comparison",
  "'compare the first two' → structured comparison, no fabricated equality",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "compare the first two" },
  ]);

await campaign("C_reason",
  "Recommendation then 'why?' → cited reason",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "which would you choose?" },
    { msg: "why?" },
  ]);

await campaign("D_cheapest_no_data",
  "'which is cheapest?' when price is UNKNOWN → honest boundary, no fabricated ranking",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "which is cheapest?" },
  ]);

await campaign("E_are_you_sure",
  "'are you sure?' after recommendation → honest evidence citation",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "which would you choose?" },
    { msg: "are you sure?" },
  ]);

await campaign("F_what_dont_you_know",
  "'what don't you know?' → lists missing attributes",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "what don't you know?" },
  ]);

await campaign("G_indonesian_comparison",
  "Indonesian 'bandingkan yang pertama dan kedua' → ID reply",
  [
    { msg: "cari hotel di Yogyakarta" },
    { msg: "bandingkan yang pertama dan kedua" },
  ]);

await campaign("H_fresh_adversarial",
  "Fresh session · 'which would you choose?' → honest 'no results' boundary",
  [
    { msg: "which would you choose?" },
  ]);

await campaign("I_pros_cons",
  "'pros and cons?' after result set",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "pros and cons?" },
  ]);

await campaign("J_evidence_request",
  "'what are you basing that on?' → evidence citation",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "which would you choose?" },
    { msg: "what are you basing that on?" },
  ]);

// ─── Verdicts ────────────────────────────────────────────────
const outPath = path.join(here, "_wave7_conversational_entity_reasoning_live_probes.json");

function anyFab() {
  for (const c of Object.values(results.campaigns)) {
    for (const t of c.turns) if (t.fabricated) return { at: `${c.id}·T${t.turn}`, token: t.fabricated };
  }
  return null;
}

const A = results.campaigns.A_recommendation;
const B = results.campaigns.B_comparison;
const C = results.campaigns.C_reason;
const D = results.campaigns.D_cheapest_no_data;
const E = results.campaigns.E_are_you_sure;
const F = results.campaigns.F_what_dont_you_know;
const G = results.campaigns.G_indonesian_comparison;
const H = results.campaigns.H_fresh_adversarial;
const I = results.campaigns.I_pros_cons;
const J = results.campaigns.J_evidence_request;

const verdicts = {
  A_recommendation_gate_fired:      A?.turns?.[1]?.entity_reasoning_gate_fired === true,
  A_recommendation_has_result_set:  A?.turns?.[1]?.entity_reasoning_has_result_set === true,
  A_recommendation_produced:        !!A?.turns?.[1]?.entity_reasoning_recommendation || /I'd lean|I'd start|honest/i.test(A?.turns?.[1]?.reply ?? ""),
  B_comparison_gate_fired:          B?.turns?.[1]?.entity_reasoning_gate_fired === true,
  B_comparison_kind:                B?.turns?.[1]?.entity_reasoning_kind === "ENTITY_COMPARISON",
  C_reason_cited:                   /because/i.test(C?.turns?.[2]?.reply ?? "") || C?.turns?.[2]?.entity_reasoning_gate_fired === true,
  D_cheapest_honest:                !/gaotama is cheapest|selaras is cheapest/i.test(D?.turns?.[1]?.reply ?? ""),
  E_are_you_sure_honest:            E?.turns?.[2]?.entity_reasoning_gate_fired === true,
  F_missing_attributes_listed:      /price|rating|verified yet/i.test(F?.turns?.[1]?.reply ?? ""),
  G_indonesian_reply:               /karena|belum|saya/i.test(G?.turns?.[1]?.reply ?? ""),
  H_fresh_honest_boundary:          /don't have any results|no results/i.test(H?.turns?.[0]?.reply ?? "") || H?.turns?.[0]?.entity_reasoning_gate_fired === true,
  I_pros_cons_gate_fired:           I?.turns?.[1]?.entity_reasoning_gate_fired === true,
  J_evidence_gate_fired:            J?.turns?.[2]?.entity_reasoning_gate_fired === true,
  zero_fabrications_overall:        !anyFab(),
};

results.verdicts = verdicts;
writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

console.log(`\n═══ WAVE 7 VERDICTS ═══`);
for (const [k, v] of Object.entries(verdicts)) {
  console.log(`  ${k.padEnd(38)} : ${v ? "PASS" : "FAIL"}`);
}
console.log(`\nWrote ${outPath}`);
