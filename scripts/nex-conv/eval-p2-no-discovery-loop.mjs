// P2-D1 · Kill discovery loop after N vague turns.
//
// S4 of the 2026-08-20 natural-conversation audit: customer gave 5 vague
// fragments in a row · NEX asked the same 3 generic discovery questions
// repeatedly. Feels like a form, not an assistant.
//
// Fix: state tracks empty_state_discovery_streak. When it reaches 2+,
// response layer switches to "differently-help" mode with three approved
// alternatives (tell me in a sentence · describe in your own words · try
// a different angle).
//
// This eval asserts:
//   1. state.empty_state_discovery_streak counts consecutive generic
//      discovery replies with zero facts captured
//   2. After 2+ streak turns, NEX's reply does NOT match any of the
//      three empty-state whitelist shapes

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

const EMPTY_STATE_SHAPES = [
  /is this a new staircase, or replacing one/i,
  /roughly where in the house is the staircase going/i,
  /what sort of look are you going for/i,
];
const DIFFERENTLY_HELP_SHAPES = [
  /tell me in a sentence/i,
  /describe.*(project|in your own words)/i,
  /try a different angle|photo.*example|specific concern/i,
  /sentence or two/i,
];

async function main() {
  const store = await boot();
  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p2-no-loop" });
  const replies = [];
  for (const text of ["I need help", "with my house", "the stairs", "they're old", "we're thinking of replacing them"]) {
    const out = await infer.processTurn({ store, state, brain: "staircase_brain", text, speaker: "customer", withProse: true });
    replies.push({ customer: text, reply: out.prose?.text ?? "", streak_after: state.empty_state_discovery_streak });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P2-D1 · Discovery loop breaks after 2 rounds");
  console.log("════════════════════════════════════════════════════════");
  const assertions = [];

  // 1. Streak counter should reach 2 or more during the loop
  const maxStreak = Math.max(...replies.map(r => r.streak_after));
  assertions.push({ pass: maxStreak >= 2, label: `empty_state_discovery_streak reached ≥2 at some point · max=${maxStreak}` });

  // 2. At least one of replies[2..] (third turn onwards) should have
  //    switched to differently-help mode (not the empty-state whitelist)
  const laterReplies = replies.slice(2);
  const anyDifferentlyHelp = laterReplies.some(r => DIFFERENTLY_HELP_SHAPES.some(rx => rx.test(r.reply)));
  const allStillEmptyState = laterReplies.every(r => EMPTY_STATE_SHAPES.some(rx => rx.test(r.reply)));
  assertions.push({
    pass: anyDifferentlyHelp || !allStillEmptyState,
    label: `after 2+ discovery turns · at least one reply switches to differently-help mode (or stops matching empty-state whitelist)`,
    evidence: replies.map(r => ({ streak: r.streak_after, reply: r.reply.slice(0, 100) })),
  });

  let p = 0, f = 0;
  for (const a of assertions) {
    console.log(`  ${a.pass ? "✓" : "✗"} ${a.label}`);
    if (!a.pass && a.evidence) console.log(`      ${JSON.stringify(a.evidence).slice(0, 400)}`);
    a.pass ? p++ : f++;
  }
  console.log(`\nSUMMARY · passed: ${p} · failed: ${f}`);
  process.exit(f === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
