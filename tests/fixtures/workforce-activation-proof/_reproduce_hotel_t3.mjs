// Reproduce Hotel T3 reference-loss failure BEFORE any code change.
// Captures full state: current_reference, hits, world_cards, composition_meta, reply.
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

const cid = randomUUID();
const turns = [
  "Find me a hotel near Malioboro.",
  "Tell me more about the first one.",
];

const out = { runAt: new Date().toISOString(), conversation_id: cid, turns: [] };
for (const [i, t] of turns.entries()) {
  console.log(`\n─── T${i + 1} · ${JSON.stringify(t)} ───`);
  const j = await post(cid, t);
  const cm = j.composition_meta || {};
  const rec = {
    turn: i + 1,
    question: t,
    intent: j.intent,
    reply: j.reply,
    voice_reply_en: j.voice_reply?.en,
    voice_reply_intent: j.voice_reply?.intent,
    current_reference: j.current_reference,
    world_cards_count: j.world_cards?.count ?? j.world_cards?.cards?.length ?? 0,
    world_cards_names: (j.world_cards?.cards || []).map((c) => ({
      name: c.name ?? c.title,
      id: c.id ?? c.public_listing_ref,
    })),
    card_hits: (j.card?.payload?.hits || []).map((h) => ({ topic: h.topic })),
    composition_ran: cm.ran,
    composition_accepted: cm.accepted,
    composition_reason: cm.reason,
    composition_knowledge_count: cm.knowledge_count,
    composition_baseline_reply: cm.baseline_reply,
    composition_composed_reply: cm.composed_reply,
    composition_flags: cm.flags,
    composition_widened_for_information_query: cm.widened_for_information_query,
    hydrated_reference_id: cm.hydrated_reference_id,
    hydrated_reference_vertical: cm.hydrated_reference_vertical,
    hydration_reason: cm.hydration_reason,
  };
  out.turns.push(rec);
  console.log("intent:", rec.intent);
  console.log("k_count:", rec.composition_knowledge_count);
  console.log("comp_ran:", rec.composition_ran, "accepted:", rec.composition_accepted, "reason:", rec.composition_reason);
  console.log("current_reference:", JSON.stringify(rec.current_reference));
  console.log("world_cards[]:", rec.world_cards_names.slice(0, 3));
  console.log("reply:", rec.reply?.slice(0, 400));
}

writeFileSync(path.join(here, "_reproduce_hotel_t3.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_reproduce_hotel_t3.json")}`);
