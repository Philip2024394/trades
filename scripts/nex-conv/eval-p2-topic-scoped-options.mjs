// P2-T1 · Topic-scoped ask_options.
//
// S1 T5 of the 2026-08-20 audit: customer asked "What options do I have
// for the balustrade?" · NEX replied with wood options (oak, walnut,
// mahogany) not balustrade options. Fix: detect the specific category
// the customer named, pass it into the packet with a category-specific
// example, so Qwen stays on-topic.
//
// This eval asserts: when the customer asks options for X, the reply
// mentions X or X's typical options, and does NOT drift to a different
// category (e.g. wood options in reply to a balustrade question).

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

async function runOne(store, text) {
  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p2-topic" });
  const out = await infer.processTurn({ store, state, brain: "staircase_brain", text, speaker: "customer", withProse: true });
  return out.prose?.text ?? "";
}

// For each category-specific question, at least one of the "on-topic"
// terms MUST appear in the reply · and none of the "off-topic drift"
// terms should be the primary subject.
const CASES = [
  {
    question: "What options do I have for the balustrade?",
    onTopic:  [/\bballustr|\bglass\b|\bspindle|\bcable|\bmetal\s+balus|\bwrought|\binfill|\bpanel/i],
    drift:    [/\boak,? walnut,? mahogany\b/i, /\bwood specifically\b/i],
  },
  {
    question: "What handrail options do I have?",
    onTopic:  [/\bhandrail|\btimber\b|\bstainless|\bmetal|\bglass\b/i],
    drift:    [/\boak,? walnut,? mahogany\b/i, /\bfor wood specifically\b/i],
  },
  {
    question: "What are the finish options?",
    onTopic:  [/\bnatural\b|\bstained?\b|\bpainted?\b|\bfinish/i],
    drift:    [/\boak,? walnut\b/i, /\bfor wood specifically\b/i],
  },
  {
    question: "What shape options are there?",
    onTopic:  [/\bstraight|\bquarter[-\s]?turn|\bhalf[-\s]?turn|\bwinder|\bspiral|\bshape/i],
    drift:    [/\bfor wood specifically\b/i],
  },
  {
    question: "What wood options do I have?",  // baseline · wood question should still get wood answer
    onTopic:  [/\boak\b|\bwalnut\b|\bash\b|\bpine\b/i],
    drift:    [/\bballustr(?!.*wood)/i],
  },
];

async function main() {
  const store = await boot();
  const assertions = [];

  for (const c of CASES) {
    const reply = await runOne(store, c.question);
    const onTopicHit = c.onTopic.some(rx => rx.test(reply));
    const driftHit = c.drift.some(rx => rx.test(reply));
    const ok = onTopicHit && !driftHit;
    assertions.push({
      pass: ok,
      label: `"${c.question}" → on-topic + no drift`,
      reply,
      onTopicHit,
      driftHit,
    });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P2-T1 · Topic-scoped ask_options");
  console.log("════════════════════════════════════════════════════════");
  let p = 0, f = 0;
  for (const a of assertions) {
    console.log(`  ${a.pass ? "✓" : "✗"} ${a.label}`);
    if (!a.pass) {
      console.log(`      reply: ${a.reply.slice(0, 220)}`);
      if (!a.onTopicHit) console.log(`      ✗ no on-topic term found`);
      if (a.driftHit) console.log(`      ✗ drift term matched`);
    }
    a.pass ? p++ : f++;
  }
  console.log(`\nSUMMARY · passed: ${p} · failed: ${f}`);
  process.exit(f === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
