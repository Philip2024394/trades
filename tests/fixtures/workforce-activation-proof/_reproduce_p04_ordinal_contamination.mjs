// Reproduce P0.4 defect · fresh-conversation ordinal contamination.
// Captures the exact case Philip named:
//   Fresh conversation · "Tell me about the first hotel." →
//   NEX silently binds to "First Living" (or similar) via keyword tokenization.
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

const cases = [
  { label: "Case B · Fresh 'first hotel'", conv: randomUUID(), messages: ["Tell me about the first hotel."] },
  { label: "Case C · Fresh 'first one'", conv: randomUUID(), messages: ["Tell me about the first one."] },
  { label: "Case E · Explicit entity search", conv: randomUUID(), messages: ["Find First Living Hotel in Yogyakarta."] },
];

const out = { ranAt: new Date().toISOString(), cases: [] };
for (const c of cases) {
  console.log(`\n═══ ${c.label} (conv=${c.conv.slice(0, 8)}) ═══`);
  const turns = [];
  for (const [i, msg] of c.messages.entries()) {
    console.log(`\n  T${i + 1} → ${JSON.stringify(msg)}`);
    const j = await post(c.conv, msg);
    const cm = j.composition_meta || {};
    const rec = {
      turn: i + 1,
      question: msg,
      intent: j.intent,
      reply: j.reply,
      current_reference: j.current_reference,
      composition_ran: cm.ran,
      composition_accepted: cm.accepted,
      composition_reason: cm.reason,
      composition_knowledge_count: cm.knowledge_count,
      composition_composed_reply: cm.composed_reply,
      hydration_reason: cm.hydration_reason,
      ordinal_gate_fired: cm.ordinal_gate_fired,
      ordinal_gate_reason: cm.ordinal_gate_reason,
      ordinal_matched_phrase: cm.ordinal_matched_phrase,
      world_cards_count: j.world_cards?.count ?? j.world_cards?.cards?.length ?? 0,
      world_cards_names: (j.world_cards?.cards || []).map((c) => c.name ?? c.title),
      card_hits_topics: (j.card?.payload?.hits || []).map((h) => h.topic),
    };
    turns.push(rec);
    console.log(`    intent=${rec.intent} k=${rec.composition_knowledge_count} comp_accepted=${rec.composition_accepted}`);
    console.log(`    current_reference: ${JSON.stringify(rec.current_reference)}`);
    console.log(`    reply: ${(rec.reply || "").slice(0, 320)}`);
  }
  out.cases.push({ label: c.label, conversation_id: c.conv, turns });
}
writeFileSync(path.join(here, "_reproduce_p04_ordinal_contamination.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`\n→ _reproduce_p04_ordinal_contamination.json`);
