// NEX Chat Result Experience Integration · Live HTTP probes
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE · WORLD-CLASS CHAT RESULT EXPERIENCE v1
//
// PURPOSE: prove the visible /nex-app/chat surface now consumes the full
// conversational intelligence stack via /api/nex-conv/chat AND that the
// world_cards artifact reaches the client through the SAME
// mapChatResponseToArtifacts + <WorldCardsInline> pipeline that
// ChatSurface + FriendChatSurface already use.
//
// This runner does NOT open a browser; it hits the endpoint the client
// now calls and asserts that the response contains the artifact contract
// the client consumes. The client-side card render is unit-tested via
// existing chat-artifacts.test.ts + useNexChat.test.ts suites.

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

// ─── Mirror mapChatResponseToArtifacts ─────────────────────────
// (lightweight subset · not a re-implementation · used only to prove
//  the shape the client will consume). Exact behavior is unit-tested in
//  src/components/nex-app/shell/chat-artifacts.test.ts.
function mirrorArtifacts(j) {
  const wc = j?.world_cards;
  const worldCards = (wc?.cards ?? []).map((c) => ({
    refId: c.id ?? c.refId,
    name: c.name,
    category: c.category ?? (typeof c.subline === "string" ? c.subline.split("·")[0].trim() : undefined),
    hasImage: !!c.heroImage || !!c.image,
    rating: typeof c.rating === "number" ? c.rating : undefined,
    reviewCount: typeof c.reviewCount === "number" ? c.reviewCount : undefined,
    priceLine: typeof c.price === "string" ? c.price : undefined,
    hasContact: !!c.whatsapp || !!c.phone,
  }));
  const voiceReply = j?.voice_reply?.en ?? j?.voice_reply?.id ?? null;
  return { worldCards, voiceReply };
}

function digest(j) {
  const cm = j.composition_meta || {};
  const artifacts = mirrorArtifacts(j);
  return {
    reply: (j.reply || "").slice(0, 260),
    voice_reply_en: j.voice_reply?.en?.slice(0, 260),
    intent: j.intent,
    theme_command: j.theme_command,
    artifacts_world_cards_count: artifacts.worldCards.length,
    artifacts_world_cards_names: artifacts.worldCards.map((c) => c.name),
    artifacts_voice_reply: artifacts.voiceReply?.slice(0, 200),
    server_world_cards_count: j.world_cards?.cards?.length ?? 0,
    server_entity_result_cards_count: cm.entity_result_cards_count,
    server_entity_cards_memoized: cm.entity_result_cards_memoized,
    quantity_gate_fired: cm.quantity_gate_fired,
    frame_gate_fired: cm.frame_gate_fired,
    wave2_gate_reason: cm.wave2_gate_reason,
    current_reference: j.current_reference,
    business_market_gate_fired: cm.business_market_gate_fired,
  };
}

const FABRICATION_TOKENS = [
  "Tokyo Tower", "Shibuya", "Harajuku",
  "Palace Grand", "Royal Deluxe", "Emperor's Retreat",
  "Michelin star",
];
function hasFabrication(reply) {
  return FABRICATION_TOKENS.find((t) => reply.includes(t)) ?? null;
}

const results = { runAt: new Date().toISOString(), chat_endpoint: CHAT, campaigns: [] };

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
    console.log(`      reply           : ${JSON.stringify(d.reply?.slice(0, 200))}`);
    console.log(`      voice_reply.en  : ${JSON.stringify(d.voice_reply_en?.slice(0, 200))}`);
    console.log(`      cards on wire   : world=${d.server_world_cards_count} · client_artifacts=${d.artifacts_world_cards_count}`);
    console.log(`      card names      : [${d.artifacts_world_cards_names.slice(0, 3).join(", ")}]`);
    console.log(`      currentRef      : ${d.current_reference?.resolved ? `resolved offset=${d.current_reference.offset} refKind=${d.current_reference.refKind}` : `unresolved (${d.current_reference?.reason ?? "n/a"})`}`);
    console.log(`      gates           : quantity=${d.quantity_gate_fired ?? false} frame=${d.frame_gate_fired ?? false} biz=${d.business_market_gate_fired ?? false}`);
    console.log(`      fab=${fab ?? "no"}`);
  }
  results.campaigns.push(record);
  return record;
}

// ═════════════════════════════════════════════════════════════════
// A · AUTHORIZE-listed acceptance conversation T1-T8
// ═════════════════════════════════════════════════════════════════
await campaign("A · AUTHORIZE T1-T7 acceptance conversation",
  "The exact conversation from §7 of the AUTHORIZE — hotel → details → refs → one more → topic switch → new refs.",
  [
    { msg: "need a hotel tonight" },
    { msg: "can i see details" },
    { msg: "tell me about the first one" },
    { msg: "tell me about the second one" },
    { msg: "one more" },
    { msg: "actually, I need a restaurant" },
    { msg: "show me the first one" },
  ]);

// ═════════════════════════════════════════════════════════════════
// B · FRESH-CONVERSATION safety (P0.4 preservation)
// ═════════════════════════════════════════════════════════════════
await campaign("B · Fresh conversation ordinal safety",
  "Fresh session · 'tell me about the first hotel' → must clarify, not resurrect.",
  [
    { msg: "tell me about the first hotel" },
  ]);

// ═════════════════════════════════════════════════════════════════
// C · FRESH-CONVERSATION progression
// ═════════════════════════════════════════════════════════════════
await campaign("C · Fresh conv · find hotels → first one",
  "Fresh · find me hotels near Malioboro · then · first one → first hotel from THIS result set",
  [
    { msg: "find me hotels near Malioboro" },
    { msg: "tell me about the first one" },
  ]);

// ═════════════════════════════════════════════════════════════════
// D · ADVERSARIAL evidence discipline (§14)
// ═════════════════════════════════════════════════════════════════
await campaign("D · Adversarial · unsupported attribute",
  "What is the helicopter pad at this hotel? → UNKNOWN preserved.",
  [
    { msg: "find me hotels" },
    { msg: "what is the helicopter pad at this hotel?" },
  ]);
await campaign("D · Adversarial · booking capability",
  "Can I book this hotel? → capability boundary preserved.",
  [
    { msg: "find me hotels" },
    { msg: "can I book this hotel?" },
  ]);
await campaign("D · Adversarial · unsupported price",
  "How much is the room tonight? → no fabricated price.",
  [
    { msg: "find me hotels" },
    { msg: "how much is the room tonight?" },
  ]);

// ─── Scoring ──────────────────────────────────────────────────────
const outPath = path.join(here, "_chat_result_experience_integration_live_probes.json");

const A = results.campaigns[0];
// T1 "need a hotel tonight" → cards must be present on wire and via artifacts
const a_t1_cards_on_wire     = A.turns[0].server_world_cards_count > 0;
const a_t1_cards_via_artifact = A.turns[0].artifacts_world_cards_count > 0;
// T2 "can i see details" — cards must remain visible (accommodation composer emits them every accommodation turn)
const a_t2_cards_still_present = A.turns[1].server_world_cards_count > 0
                              && A.turns[1].artifacts_world_cards_count > 0;
// T3/T4 D1 ordinal resolution
const a_t3_ordinal = A.turns[2].current_reference?.resolved === true
                  && A.turns[2].current_reference?.refKind === "ordinal";
const a_t4_ordinal = A.turns[3].current_reference?.resolved === true
                  && A.turns[3].current_reference?.refKind === "ordinal";
// T5 D3 quantity continuation
const a_t5_quantity = A.turns[4].quantity_gate_fired === true;
// T6 D4 topic switch fires
const a_t6_topic_shift = A.turns[5].frame_gate_fired === true
                      && (A.turns[5].wave2_gate_reason ?? "").includes("topic_shift_vertical_switch");
// T7 first one after topic switch — session was reset · no stale hotel
const a_t7_no_stale_hotel = !A.turns[6].reply.includes("Gaotama Hotel")
                         && !A.turns[6].reply.includes("Selaras Inn");

// B · P0.4 preservation
const B = results.campaigns[1];
const b_p04_honest = /which hotel do you mean|don't have a previous|no previous|haven't shown any results/i.test(B.turns[0].reply);

// C · fresh conv progression
const C = results.campaigns[2];
const c_first_search_cards = C.turns[0].server_world_cards_count > 0;
const c_ordinal_resolves   = C.turns[1].current_reference?.resolved === true;

// D · adversarial · never fabricate
const anyFab = results.campaigns.some((c) => c.turns.some((t) => t.fabricated));

console.log(`\n═══ CHAT RESULT EXPERIENCE INTEGRATION VERDICT ═══`);
console.log(`  A · T1 hotel search · cards on server response      : ${a_t1_cards_on_wire ? "PASS" : "FAIL"}`);
console.log(`  A · T1 hotel search · cards via artifacts mapper    : ${a_t1_cards_via_artifact ? "PASS" : "FAIL"}`);
console.log(`  A · T2 detail request · cards still present         : ${a_t2_cards_still_present ? "PASS" : "FAIL"}`);
console.log(`  A · T3 'first one' resolves (D1 preserved)          : ${a_t3_ordinal ? "PASS" : "FAIL"}`);
console.log(`  A · T4 'second one' resolves (D1 preserved)         : ${a_t4_ordinal ? "PASS" : "FAIL"}`);
console.log(`  A · T5 'one more' quantity continuation (D3)        : ${a_t5_quantity ? "PASS" : "FAIL"}`);
console.log(`  A · T6 topic-shift to restaurant (D4)               : ${a_t6_topic_shift ? "PASS" : "FAIL"}`);
console.log(`  A · T7 'first one' after switch · no stale hotel    : ${a_t7_no_stale_hotel ? "PASS" : "FAIL"}`);
console.log(`  B · Fresh-conv ordinal safety (P0.4)                : ${b_p04_honest ? "PASS" : "FAIL"}`);
console.log(`  C · Fresh conv new search produces cards            : ${c_first_search_cards ? "PASS" : "FAIL"}`);
console.log(`  C · Ordinal resolves against NEW result set         : ${c_ordinal_resolves ? "PASS" : "FAIL"}`);
console.log(`  D · Zero fabrications across adversarial cases      : ${!anyFab ? "PASS" : "FAIL"}`);

results.verdicts = {
  a_t1_cards_on_wire, a_t1_cards_via_artifact,
  a_t2_cards_still_present,
  a_t3_ordinal, a_t4_ordinal,
  a_t5_quantity,
  a_t6_topic_shift,
  a_t7_no_stale_hotel,
  b_p04_honest,
  c_first_search_cards, c_ordinal_resolves,
  zero_fabrications: !anyFab,
};

writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`\nWrote ${outPath}`);
