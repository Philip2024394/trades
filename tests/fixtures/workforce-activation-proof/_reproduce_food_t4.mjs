// Reproduce FOOD T4 Japan failure BEFORE any code change.
// Prints k_count, composition_meta, reply. This proves the failure is
// still live in the current codebase (not stale from prior report).
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
  "Tell me about Indonesian food.",
  "What about tuna?",
  "Could I export it?",
  "What about Japan?",
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
    composition_ran: cm.ran,
    composition_accepted: cm.accepted,
    composition_reason: cm.reason,
    composition_knowledge_count: cm.knowledge_count,
    composition_composed_reply: cm.composed_reply,
    composition_baseline_reply: cm.baseline_reply,
    card_hits: (j.card?.payload?.hits || []).map((h) => ({ topic: h.topic, source: h.source })),
    world_cards_count: j.world_cards?.count ?? j.world_cards?.cards?.length ?? 0,
  };
  out.turns.push(rec);
  console.log("intent:", rec.intent);
  console.log("k_count:", rec.composition_knowledge_count);
  console.log("comp_ran:", rec.composition_ran, "comp_accepted:", rec.composition_accepted);
  console.log("reply:", rec.reply?.slice(0, 400));
}

writeFileSync(path.join(here, "_reproduce_food_t4.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_reproduce_food_t4.json")}`);
