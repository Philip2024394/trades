// NEX Entity → Interest → Owner Conversation Slice · live HTTP probes
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// Proves via /api/nex-conv/chat + /api/nex-conv/session/view:
//   A · Existing accommodation entity + Interest → HONEST no-verified-contact
//       (positive-flow browser proof deferred per §31 · no real verified-contact
//        record exists in the current dev DB · YELLOW live positive-flow accepted)
//   B · Negation "I'm not interested" → G12 preserved · no owner-flow
//   C · Ambiguous "I'm interested" with multiple candidates → clarify
//   D · Fresh session "I'm interested" → honest boundary
//   E · Indonesian "saya tertarik" → ID reply
//   F · Correction "not the first one, the second one" → G12 preserved
//   G · Adversarial "did you send it?" → honest boundary
//   H · Return-to-NEX after interest → entity context preserved

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = "http://localhost:3008/api/nex-conv/chat";
const VIEW = "http://localhost:3008/api/nex-conv/session/view";

async function post(convId, message) {
  const r = await fetch(CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: convId, message, market: "ID" }),
  });
  return r.json();
}
async function beacon(convId, refId, vertical, name) {
  const r = await fetch(VIEW, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: convId, ref_id: refId, vertical, name }),
  });
  return r.json();
}

function digest(j) {
  const cm = j.composition_meta || {};
  return {
    reply: (j.reply || "").slice(0, 400),
    interest_gate_fired: cm.interest_gate_fired,
    interest_gate_kind: cm.interest_gate_kind,
    interest_intent_kind: cm.interest_intent_kind,
    interest_entity_name: cm.interest_entity_name,
    interest_contactability: cm.interest_contactability,
    interest_send_enabled: cm.interest_send_enabled,
    interest_open_url: cm.interest_open_url,
    interest_gate_reason: cm.interest_gate_reason,
  };
}

const FABRICATION_TOKENS = [
  "+62 812 3456 7890",
  "info@gaotama.com",
  "wa.me/62812",
  "gaotamahotel.com",
];
function reachedFabrication(text) {
  for (const t of FABRICATION_TOKENS) if ((text || "").includes(t)) return t;
  return null;
}

const results = { runAt: new Date().toISOString(), campaigns: {} };

async function campaign(id, description, turns) {
  const cid = randomUUID();
  console.log(`\n═══ ${id} · ${description} ═══`);
  const record = { id, description, conversation_id: cid, turns: [] };
  for (const [i, t] of turns.entries()) {
    let j;
    if (t.beacon) {
      j = await beacon(cid, t.beacon.ref_id, t.beacon.vertical, t.beacon.name);
      const line = { turn: i + 1, message: `[BEACON ${t.beacon.name}]`, beacon: true, ok: j.ok, memoized: j.viewed_entity?.memoized };
      record.turns.push(line);
      console.log(`   T${i + 1} BEACON ${t.beacon.name} → ok=${j.ok} memoized=${j.viewed_entity?.memoized}`);
      continue;
    }
    j = await post(cid, t.msg);
    const d = digest(j);
    const fab = reachedFabrication(d.reply);
    record.turns.push({ turn: i + 1, message: t.msg, fabricated: fab, ...d });
    console.log(`   T${i + 1} "${t.msg}"`);
    console.log(`      reply: ${JSON.stringify(d.reply?.slice(0, 260))}`);
    console.log(`      interest: gate=${d.interest_gate_fired ?? false} kind=${d.interest_gate_kind ?? "-"} intent=${d.interest_intent_kind ?? "-"} contact=${d.interest_contactability ?? "-"} send=${d.interest_send_enabled ?? false}`);
    console.log(`      fab=${fab ?? "no"}`);
  }
  results.campaigns[id] = record;
  return record;
}

// ─── Campaigns ───────────────────────────────────────────────

await campaign("A_negative_flow_verified_via_wave6",
  "Real Yogya hotel · beacon · 'I'm interested' → INTEREST_HONEST_NO_CONTACT (Wave 6 negative preserved)",
  [
    { msg: "find me hotels in Yogyakarta" },
    { beacon: { ref_id: "place:accommodation:#AC-2026-0000D", vertical: "accommodation", name: "Gaotama Hotel" } },
    { msg: "I'm interested" },
  ]);

await campaign("B_negation_g12_preserved",
  "'I'm not interested' → NEGATED · no owner-flow",
  [
    { msg: "find me hotels in Yogyakarta" },
    { beacon: { ref_id: "place:accommodation:#AC-2026-0000D", vertical: "accommodation", name: "Gaotama Hotel" } },
    { msg: "I'm not interested" },
  ]);

await campaign("C_ambiguous_asks",
  "Multiple candidates + 'I'm interested' (no viewed entity) → AMBIGUOUS · asks which",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "I'm interested" },
  ]);

await campaign("D_fresh_session_honest",
  "Fresh session · 'I'm interested' → INTEREST_NO_ENTITY_CONTEXT",
  [
    { msg: "I'm interested" },
  ]);

await campaign("E_indonesian",
  "'saya tertarik' after beacon → ID reply · INTEREST_HONEST_NO_CONTACT",
  [
    { msg: "cari hotel di Yogyakarta" },
    { beacon: { ref_id: "place:accommodation:#AC-2026-0000D", vertical: "accommodation", name: "Gaotama Hotel" } },
    { msg: "saya tertarik" },
  ]);

await campaign("F_correction_negation",
  "'not the first one, the second one' → NEGATED (G12) · no owner-flow triggered",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "not the first one, the second one" },
  ]);

await campaign("G_adversarial_did_you_send",
  "After Interest turn · 'did you send it?' → honest boundary (never claims sent)",
  [
    { msg: "find me hotels in Yogyakarta" },
    { beacon: { ref_id: "place:accommodation:#AC-2026-0000D", vertical: "accommodation", name: "Gaotama Hotel" } },
    { msg: "I'm interested" },
    { msg: "did you send it?" },
  ]);

await campaign("H_return_to_nex_context",
  "After Interest turn · 'what about parking?' → resolves against viewed entity (Wave 6 preserved)",
  [
    { msg: "find me hotels in Yogyakarta" },
    { beacon: { ref_id: "place:accommodation:#AC-2026-0000D", vertical: "accommodation", name: "Gaotama Hotel" } },
    { msg: "I'm interested" },
    { msg: "what about parking?" },
  ]);

await campaign("I_contact_verb_shape",
  "'I want to contact them' after beacon → INTEREST_HONEST_NO_CONTACT (verified path unavailable per §31)",
  [
    { msg: "find me hotels in Yogyakarta" },
    { beacon: { ref_id: "place:accommodation:#AC-2026-0000D", vertical: "accommodation", name: "Gaotama Hotel" } },
    { msg: "I want to contact them" },
  ]);

// ─── Verdicts ───────────────────────────────────────────────
const A = results.campaigns.A_negative_flow_verified_via_wave6?.turns?.[2];
const B = results.campaigns.B_negation_g12_preserved?.turns?.[2];
const C = results.campaigns.C_ambiguous_asks?.turns?.[1];
const D = results.campaigns.D_fresh_session_honest?.turns?.[0];
const E = results.campaigns.E_indonesian?.turns?.[2];
const F = results.campaigns.F_correction_negation?.turns?.[1];
const G = results.campaigns.G_adversarial_did_you_send?.turns?.[3];
const H = results.campaigns.H_return_to_nex_context?.turns?.[3];
const I = results.campaigns.I_contact_verb_shape?.turns?.[2];

function anyFab() {
  for (const c of Object.values(results.campaigns)) {
    for (const t of c.turns) if (t.fabricated) return { at: `${c.id}·T${t.turn}`, token: t.fabricated };
  }
  return null;
}

const verdicts = {
  A_honest_no_contact:              A?.interest_gate_kind === "INTEREST_HONEST_NO_CONTACT",
  A_send_not_enabled:               A?.interest_send_enabled === false,
  B_g12_negation_preserved:         B?.interest_gate_kind === "INTEREST_NEGATED",
  C_ambiguous_asks_which:           C?.interest_gate_kind === "INTEREST_AMBIGUOUS_ENTITY",
  D_fresh_honest_boundary:          D?.interest_gate_kind === "INTEREST_NO_ENTITY_CONTEXT",
  E_indonesian_gate_fires:          E?.interest_gate_fired === true,
  F_correction_preserves_g12:       F?.interest_gate_kind === "INTEREST_NEGATED" || F?.interest_gate_fired !== true,
  G_never_claims_sent:              !/i.?ve sent|sent it|delivered|owner received/i.test(G?.reply ?? ""),
  H_context_preserved:              /parking|gaotama/i.test(H?.reply ?? ""),
  I_contact_verb_gate_fires:        I?.interest_gate_fired === true && I?.interest_gate_kind === "INTEREST_HONEST_NO_CONTACT",
  zero_fabrications:                !anyFab(),
};

results.verdicts = verdicts;
const outPath = path.join(here, "_entity_interest_owner_chat_live_probes.json");
writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

console.log(`\n═══ INTEREST GATE LIVE VERDICTS ═══`);
for (const [k, v] of Object.entries(verdicts)) {
  console.log(`  ${k.padEnd(38)} : ${v ? "PASS" : "FAIL"}`);
}
console.log(`\nWrote ${outPath}`);
