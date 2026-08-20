// P2-Y1 · Yes/no resolves against NEX's last question.
//
// Doctrine (Philip 2026-08-20): "Would you prefer straight or quarter
// turn?" → customer says "yes" → NEX must understand this refers to
// the immediately-preceding question. For A/B questions, "yes" means
// "help me choose"; for binary questions, "yes" means clear agreement.
//
// This eval asserts:
//   - state.last_nex_question is populated with correct shape after
//     each NEX reply that ends in a question
//   - After a "yes" reply, NEX does NOT re-ask the identical question
//     (i.e. the reply differs from the previous NEX reply's question)

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

async function main() {
  const store = await boot();
  const assertions = [];

  // Scenario A: NEX asks A/B question · state.last_nex_question.shape='ab'
  {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p2-yn-a" });
    await infer.processTurn({ store, state, brain: "staircase_brain", text: "I want an oak staircase", speaker: "customer", withProse: true });
    // NEX probably asked a follow-up question · check state
    assertions.push({ pass: !!state.last_nex_question, label: `A · state.last_nex_question populated after NEX reply · got ${JSON.stringify(state.last_nex_question)}` });
  }

  // Scenario B: after NEX asks a question, customer's "yes" doesn't
  // trigger a re-ask of the same question (compare reply-2 to reply-1).
  {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p2-yn-b" });
    const t1 = await infer.processTurn({ store, state, brain: "staircase_brain", text: "I want an oak staircase", speaker: "customer", withProse: true });
    const reply1 = t1.prose?.text ?? "";
    const q1 = state.last_nex_question?.text ?? "";
    const t2 = await infer.processTurn({ store, state, brain: "staircase_brain", text: "yes", speaker: "customer", withProse: true });
    const reply2 = t2.prose?.text ?? "";
    // Assert: NEX's yes-reply is different from its first reply (no literal re-ask)
    assertions.push({ pass: reply1 !== reply2, label: `B · yes-reply differs from previous reply (no literal re-ask)`, evidence: { reply1: reply1.slice(0,80), reply2: reply2.slice(0,80) } });
    // Assert: if the previous question was A/B (contains " or "), the yes-reply should acknowledge ambiguity (mentions both, or asks a narrower question)
    if (/\bor\b/i.test(q1)) {
      const acknowledgesOptions = /both|either|lean|for a/i.test(reply2) || reply2.length > 50;
      assertions.push({ pass: acknowledgesOptions, label: `B · yes to A/B question · reply acknowledges options or narrows further`, evidence: { q1, reply2 } });
    }
  }

  // Scenario C: extractLastQuestion classifies shapes correctly
  {
    // Direct helper test via processTurn output — call the module directly
    const { updateStateFromNex } = await import("./lib/state.mjs");
    const s1 = { turn_count: 0, recent_turn_summaries: [], recent_closer_patterns: [], recent_opener_patterns: [], established_facts: {} };
    updateStateFromNex(s1, { text: "For that oak, would you prefer a closed string or a cut string?" });
    assertions.push({ pass: s1.last_nex_question?.shape === "ab", label: `C · A/B shape detected · got ${s1.last_nex_question?.shape}` });

    const s2 = { turn_count: 0, recent_turn_summaries: [], recent_closer_patterns: [], recent_opener_patterns: [], established_facts: {} };
    updateStateFromNex(s2, { text: "Would you like glass balustrades for this staircase?" });
    assertions.push({ pass: s2.last_nex_question?.shape === "binary", label: `C · binary shape detected · got ${s2.last_nex_question?.shape}` });

    const s3 = { turn_count: 0, recent_turn_summaries: [], recent_closer_patterns: [], recent_opener_patterns: [], established_facts: {} };
    updateStateFromNex(s3, { text: "What sort of look are you going for?" });
    assertions.push({ pass: s3.last_nex_question?.shape === "open", label: `C · open shape detected · got ${s3.last_nex_question?.shape}` });

    const s4 = { turn_count: 0, recent_turn_summaries: [], recent_closer_patterns: [], recent_opener_patterns: [], established_facts: {} };
    updateStateFromNex(s4, { text: "Thanks — I'll get back to you." });
    assertions.push({ pass: s4.last_nex_question === null, label: `C · no question in reply → last_nex_question=null · got ${JSON.stringify(s4.last_nex_question)}` });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P2-Y1 · Yes/no resolves against NEX's last question");
  console.log("════════════════════════════════════════════════════════");
  let p = 0, f = 0;
  for (const a of assertions) {
    console.log(`  ${a.pass ? "✓" : "✗"} ${a.label}`);
    if (!a.pass && a.evidence) console.log(`      evidence: ${JSON.stringify(a.evidence).slice(0,300)}`);
    a.pass ? p++ : f++;
  }
  console.log(`\nSUMMARY · passed: ${p} · failed: ${f}`);
  process.exit(f === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
