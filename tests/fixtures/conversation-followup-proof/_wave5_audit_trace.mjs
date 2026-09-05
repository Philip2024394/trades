// Wave 5 · Read-only trace/audit of "need hotel tonight" → "can i see details"
// Philip 2026-09-06 · READ-ONLY DIAGNOSIS · no src/ changes
//
// Purpose: locate where entities disappear between the World adapter
// retrieval and the NEX Chat renderer.

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
  return await r.json();
}

function summarise(j, label) {
  const cm = j.composition_meta || {};
  const wc = j.world_cards;
  const erc = j.entity_result_cards;
  const card = j.card;
  console.log(`\n═══ ${label} ═══`);
  console.log(`  intent               : ${j.intent}`);
  console.log(`  reply                : ${JSON.stringify((j.reply || "").slice(0, 220))}`);
  console.log(`  voice_reply.en       : ${JSON.stringify(j.voice_reply?.en?.slice(0, 220))}`);
  console.log(`  voice_reply.intent   : ${j.voice_reply?.intent}`);
  console.log(`  voice_reply.mode     : ${j.voice_reply?.mode}`);
  console.log(`  --- CARDS PAYLOAD ---`);
  console.log(`  world_cards          : ${wc ? "present" : "NULL"}`);
  if (wc) {
    console.log(`    vertical           : ${wc.vertical}`);
    console.log(`    cards.length       : ${wc.cards?.length ?? "n/a"}`);
    console.log(`    totalAvailable     : ${wc.totalAvailable ?? "n/a"}`);
    console.log(`    headline           : ${JSON.stringify(wc.headline?.slice(0, 120))}`);
    console.log(`    caveat             : ${JSON.stringify(wc.caveat?.slice(0, 120) ?? null)}`);
    if (wc.cards?.[0]) {
      const c = wc.cards[0];
      console.log(`    card[0].name       : ${c.name}`);
      console.log(`    card[0].category   : ${c.category}`);
      console.log(`    card[0].refId      : ${c.refId ?? c.id ?? "n/a"}`);
      console.log(`    card[0].keys       : ${Object.keys(c).join(", ")}`);
    }
  }
  console.log(`  entity_result_cards  : ${erc ? "present" : "NULL"}`);
  if (erc) {
    console.log(`    vertical           : ${erc.vertical}`);
    console.log(`    cards.length       : ${erc.cards?.length ?? "n/a"}`);
    console.log(`    first name         : ${erc.cards?.[0]?.name}`);
  }
  console.log(`  card (accommodation) : ${card ? `kind=${card.kind}` : "NULL"}`);
  if (card?.payload?.hits) {
    console.log(`    payload.hits.length: ${card.payload.hits.length}`);
    console.log(`    payload.hits[0]    : ${JSON.stringify(card.payload.hits[0])}`);
  }
  console.log(`  --- OBSERVABILITY ---`);
  console.log(`  capability_display_act    : ${cm.capability_display_act}`);
  console.log(`  capability_display_gate_fired : ${cm.capability_display_gate_fired}`);
  console.log(`  result_followup_fired     : ${cm.result_followup_fired}`);
  console.log(`  attribute_query_gate_fired: ${cm.attribute_query_gate_fired}`);
  console.log(`  memory_gate_fired         : ${cm.memory_gate_fired}`);
  console.log(`  entity_result_cards_count : ${cm.entity_result_cards_count}`);
  console.log(`  entity_result_cards_memoized : ${cm.entity_result_cards_memoized}`);
  console.log(`  frame_topic               : ${cm.frame_topic}`);
  console.log(`  frame_subject             : ${cm.frame_subject}`);
  console.log(`  knowledge_count           : ${cm.knowledge_count}`);
}

const cid = randomUUID();
console.log(`Conversation: ${cid}\n`);

const t1 = await post(cid, "need hotel tonight");
summarise(t1, "T1 · 'need hotel tonight'");

const t2 = await post(cid, "can i see details");
summarise(t2, "T2 · 'can i see details'");

const trace = {
  runAt: new Date().toISOString(),
  conversation_id: cid,
  T1: { request: "need hotel tonight", response: t1 },
  T2: { request: "can i see details", response: t2 },
};
const out = path.join(here, "_wave5_audit_trace.json");
writeFileSync(out, JSON.stringify(trace, null, 2), "utf8");
console.log(`\nFull trace: ${out}`);
