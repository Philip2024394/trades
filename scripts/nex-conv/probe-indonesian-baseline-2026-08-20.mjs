// Priority 3 · Indonesian language-neutral inspection · baseline probe.
//
// Runs Indonesian utterances through the CURRENT pipeline (no code
// changes) to establish exactly what breaks. Feeds the plan report.

import { createStore } from "./lib/store-factory.mjs";
import { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } from "./lib/entities.mjs";
import * as infer from "./lib/infer.mjs";
import { extractEntities, extractIntent } from "./lib/extract.mjs";
import { randomUUID } from "node:crypto";

async function boot() {
  const store = await createStore({ backend: "jsonl" });
  for (const i of STAIRCASE_INTENTS) await store.upsertIntent(i);
  for (const e of STAIRCASE_ENTITIES) await store.upsertEntity({ ...e, brain: "staircase_brain" });
  return store;
}

const ID_PROBES = [
  { text: "Halo",                                        english: "Hello" },
  { text: "Saya ingin tangga oak",                        english: "I want an oak staircase" },
  { text: "Saya mau tangga kayu jati",                    english: "I want a teak-wood staircase" },
  { text: "Sebenarnya, ganti ke walnut",                  english: "Actually, change to walnut" },
  { text: "Berapa harganya?",                             english: "How much does it cost?" },
  { text: "Apa saja pilihan untuk railing?",              english: "What options are there for the balustrade?" },
  { text: "Ya",                                           english: "Yes" },
  { text: "Tidak",                                        english: "No" },
  { text: "Bagaimana dengan balustrade kaca?",            english: "What about glass balustrades?" },
  { text: "Rekomendasi apa untuk hallway kecil?",         english: "What do you recommend for a small hallway?" },
];

async function main() {
  const store = await boot();

  console.log("════════════════════════════════════════════════════════");
  console.log("INDONESIAN BASELINE · what the current pipeline does with ID input");
  console.log("════════════════════════════════════════════════════════");
  console.log("");

  // Section 1: intent + entity classification with current English classifier
  console.log("─── SECTION 1 · Intent + entity classification ─────────");
  for (const p of ID_PROBES) {
    const entities = extractEntities(p.text, store);
    const intent = extractIntent(p.text, store);
    console.log(`  "${p.text}"  (EN: "${p.english}")`);
    console.log(`     intent: ${intent.slug} (${intent.class}) · confidence ${intent.confidence} · reason: ${intent.reason}`);
    console.log(`     entities: [${entities.join(", ")}]`);
    console.log("");
  }

  // Section 2: Qwen's response behaviour on Indonesian input via current prompt
  console.log("─── SECTION 2 · Qwen prose output (current English-only prompt) ─");
  for (const p of ID_PROBES.slice(0, 5)) {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "id-baseline" });
    const out = await infer.processTurn({ store, state, brain: "staircase_brain", text: p.text, speaker: "customer", withProse: true });
    const reply = out.prose?.text ?? `(no prose · ${out.prose?.error})`;
    console.log(`  C: ${p.text}`);
    console.log(`  N: ${reply}`);
    console.log(`     lang detected: (none · current pipeline is English-only)`);
    console.log("");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
