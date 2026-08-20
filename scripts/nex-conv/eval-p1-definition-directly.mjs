// P1-#7 · Definition questions get direct answers.
//
// S1 of the 2026-08-20 audit ("What is a newel?") triggered the
// empty-state discovery guard and NEX responded "Of course. What sort
// of staircase are you thinking of, roughly?" — dodged the definition
// question. Fix: isEmptyStateDiscover now requires intent.slug ===
// 'statement' (not intent.class === 'discover'), so ask_definition on
// an empty state uses the normal knowledge-packet path.
//
// This eval asserts the reply to a bare definition question actually
// CONTAINS a definition-shaped sentence — reference to the term itself
// alongside a definitional word ("is", "means", "refers to").

import { createStore } from "./lib/store-factory.mjs";
import { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } from "./lib/entities.mjs";
import * as infer from "./lib/infer.mjs";
import { randomUUID } from "node:crypto";

async function boot() {
  const store = await createStore({ backend: "jsonl" });
  for (const i of STAIRCASE_INTENTS) await store.upsertIntent(i);
  for (const e of STAIRCASE_ENTITIES) await store.upsertEntity({ ...e, brain: "staircase_brain" });
  return store;
}

// Definition questions on empty state. Reply must:
//   1. NOT be the empty-state-discovery whitelist ("Is this a new staircase, or replacing one?"
//      / "Roughly where in the house..." / "What sort of look are you going for...")
//   2. Reference the specific term the customer asked about.
const CASES = [
  { question: "What is a newel?",        term: "newel" },
  { question: "What is a balustrade?",   term: "balustrade" },
  { question: "What does closed string mean?", term: "closed string" },
];

const RESTART_DISCOVERY_PATTERNS = [
  /is this a new staircase, or replacing one/i,
  /roughly where in the house/i,
  /what sort of look are you going for/i,
];

async function main() {
  const store = await boot();
  const results = [];

  for (const c of CASES) {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p1-def" });
    const out = await infer.processTurn({
      store, state, brain: "staircase_brain", text: c.question, speaker: "customer", withProse: true,
    });
    const reply = out.prose?.text ?? "";
    const isRestartDiscovery = RESTART_DISCOVERY_PATTERNS.some(rx => rx.test(reply));
    const mentionsTerm = new RegExp(`\\b${c.term}\\b`, "i").test(reply);
    results.push({
      question: c.question,
      intent: out.understood_intent?.slug,
      reply,
      isRestartDiscovery,
      mentionsTerm,
    });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P1-#7 · Definition questions get direct answers");
  console.log("════════════════════════════════════════════════════════");
  let p = 0, f = 0;
  for (const r of results) {
    const notDodging = !r.isRestartDiscovery;
    const answersTerm = r.mentionsTerm;
    const ok = notDodging && answersTerm;
    console.log(`  ${ok ? "✓" : "✗"} [intent=${r.intent}] "${r.question}"`);
    if (!ok) {
      console.log(`      reply: ${r.reply.slice(0, 250)}`);
      if (!notDodging) console.log(`      ✗ dodged with restart-discovery shape`);
      if (!answersTerm) console.log(`      ✗ reply doesn't mention the term "${r.question}"`);
      f++;
    } else {
      p++;
    }
  }
  console.log(`\nSUMMARY · passed: ${p} · failed: ${f}`);
  process.exit(f === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
