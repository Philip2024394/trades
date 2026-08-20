// P0-#2 · Information-seeking questions never become customer facts.
//
// S5 of the 2026-08-20 speaking-quality audit reproduced: message
// "what's the name of the metal bracket that holds a floating tread to
// the wall in Scandinavian houses?" was mis-classified as
// specify_material and wrote material_primary=metal[customer_stated]
// into state. Fix at extract.mjs (question-word pre-check) + state.mjs
// (looksInformationSeekingByText belt-and-braces).
//
// This eval asserts:
//   (a) Intent for these questions is ask_definition or ask_options
//       (NOT specify_*)
//   (b) established_facts remains empty after each turn
//   (c) No leftover state.constraints or entities-in-focus-as-facts

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

const QUESTIONS = [
  "What's the name of the metal bracket that holds a floating tread?",
  "What is a closed string?",
  "Which staircase style suits a Victorian terrace?",
  "How does an oak tread compare to walnut?",
  "Tell me about spiral staircases in glass",
  "What are the wood options I have?",
  "Show me the types of balustrade",
  "Why do you use a bullnose starting step?",
  "When is a floating staircase inappropriate?",
  "What's the difference between a handrail and a base rail?",
];

async function main() {
  const store = await boot();
  const results = [];

  for (const q of QUESTIONS) {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p0-question-pollution" });
    const out = await infer.processTurn({
      store, state, brain: "staircase_brain", text: q, speaker: "customer",
      withProse: false, // state-only check · no LLM needed
    });
    results.push({
      question: q,
      intent: out.understood_intent?.slug,
      intentClass: out.understood_intent?.class,
      facts: Object.fromEntries(
        Object.entries(state.established_facts).map(([k, v]) => [k, v?.value])
      ),
      constraints: state.constraints.slice(),
    });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P0-#2 · Questions never become customer facts");
  console.log("════════════════════════════════════════════════════════");
  let passed = 0, failed = 0;
  const askIntents = new Set(["ask_definition", "ask_options", "ask_recommendation", "ask_installation", "compare", "ask_what_about", "ask_price"]);
  for (const r of results) {
    const intentOk = askIntents.has(r.intent);
    const factsClean = Object.keys(r.facts).length === 0;
    const constraintsClean = r.constraints.length === 0;
    const ok = intentOk && factsClean && constraintsClean;
    console.log(`  ${ok ? "✓" : "✗"} [intent=${r.intent}] "${r.question}"`);
    if (!ok) {
      if (!intentOk) console.log(`      intent should be an ask_* / compare / ask_what_about · got '${r.intent}'`);
      if (!factsClean) console.log(`      facts polluted: ${JSON.stringify(r.facts)}`);
      if (!constraintsClean) console.log(`      constraints polluted: ${JSON.stringify(r.constraints)}`);
      failed++;
    } else {
      passed++;
    }
  }
  console.log(`\nSUMMARY · passed: ${passed} · failed: ${failed}`);
  process.exit(failed === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
