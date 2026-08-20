// S4 Option A · Discovery loop SUSTAINED recovery.
//
// Doctrine (Philip 2026-08-20 · S4 Option A greenlit): the previous
// P2-D1 counter (empty_state_discovery_streak) tracked "consecutive
// NEX replies matching the empty-state whitelist". Differently-help
// replies didn't match the whitelist regex, so the counter reset to 0
// every third turn, causing a sawtooth: normal → normal → differently-
// help → normal → normal → differently-help → ...
//
// Fix (state.mjs updateStateFromCustomer): streak now tracks consecutive
// vague-fragment turns (intent === 'statement' AND factCount === 0).
// Reset only when a customer-stated fact is captured OR when the intent
// is a productive one. Threshold in respond-local.mjs unchanged at ≥ 2.
//
// This eval asserts SUSTAINED differently-help across multiple vague
// turns — the sawtooth is gone. Complements the existing eval-p2-no-
// discovery-loop.mjs (which only asserted differently-help fires ONCE).

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

// Whitelist shapes that must NOT dominate turns 3-6.
const EMPTY_STATE_WHITELIST_SHAPES = [
  /is this a new staircase, or replacing one/i,
  /roughly where in the house is the staircase going/i,
  /what sort of look are you going for/i,
];

// Differently-help shapes NEX should be using once streak ≥ 2.
const DIFFERENTLY_HELP_SHAPES = [
  /tell me in a sentence/i,
  /sentence or two/i,
  /describe.*(project|in your own words)/i,
  /try a different angle|photo.*example|specific concern/i,
  /make sure I understand/i,
];

async function main() {
  const store = await boot();
  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "s4-sustained" });

  // Six consecutive vague fragments (customer never gives a fact).
  const script = [
    "I need help",
    "with my house",
    "the stairs",
    "they're old",
    "not sure yet",
    "just looking",
  ];

  const replies = [];
  for (const text of script) {
    const out = await infer.processTurn({ store, state, brain: "staircase_brain", text, speaker: "customer", withProse: true });
    replies.push({
      customer: text,
      reply: out.prose?.text ?? "",
      streak_after: state.empty_state_discovery_streak,
      intent: out.understood_intent?.slug,
    });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("S4 Option A · Discovery loop SUSTAINED recovery");
  console.log("════════════════════════════════════════════════════════");
  for (const r of replies) {
    console.log(`  [streak=${r.streak_after} · intent=${r.intent}]  C: "${r.customer}"`);
    console.log(`                                    N: "${r.reply.slice(0, 100)}"`);
  }

  const assertions = [];

  // 1. Streak reaches ≥ 2 (matches existing P2-D1 test)
  const maxStreak = Math.max(...replies.map(r => r.streak_after));
  assertions.push({ pass: maxStreak >= 2, label: `streak reaches ≥ 2 · max=${maxStreak}` });

  // 2. Streak grows monotonically across vague turns (no sawtooth) — S4
  //    Option A CORE ASSERTION. Prior behaviour reset the streak on
  //    differently-help turns; new behaviour keeps it growing until a
  //    fact is captured.
  const streaksAscending = replies.every((r, i) => i === 0 || r.streak_after >= replies[i - 1].streak_after);
  assertions.push({ pass: streaksAscending, label: `streak grows monotonically across 6 vague turns (sawtooth eliminated)`, evidence: replies.map(r => r.streak_after) });

  // 3. Once streak ≥ 2, at least 3 of the subsequent replies match
  //    differently-help shape (not the whitelist). Proves sustained
  //    behaviour, not a one-off fire.
  const repliesAfterThreshold = replies.filter((r, i) => (replies[i - 1]?.streak_after ?? 0) >= 2 || r.streak_after >= 2);
  const differentlyHelpCount = repliesAfterThreshold.filter(r => DIFFERENTLY_HELP_SHAPES.some(rx => rx.test(r.reply))).length;
  assertions.push({
    pass: differentlyHelpCount >= 3,
    label: `differently-help mode sustained on ≥ 3 turns after threshold · got ${differentlyHelpCount}/${repliesAfterThreshold.length}`,
    evidence: repliesAfterThreshold.map(r => ({ streak: r.streak_after, reply: r.reply.slice(0, 80) })),
  });

  // 4. Not more than 1 whitelist reply after threshold (i.e. NEX doesn't
  //    keep falling back to the same 3 generic questions).
  const whitelistAfterThreshold = repliesAfterThreshold.filter(r => EMPTY_STATE_WHITELIST_SHAPES.some(rx => rx.test(r.reply))).length;
  assertions.push({
    pass: whitelistAfterThreshold <= 1,
    label: `at most 1 whitelist reply after threshold (loop broken, not reset) · got ${whitelistAfterThreshold}`,
  });

  // 5. Reset semantics: a fact-capturing turn resets streak to 0.
  {
    const state2 = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "s4-reset" });
    await infer.processTurn({ store, state: state2, brain: "staircase_brain", text: "I need help", speaker: "customer", withProse: false });
    await infer.processTurn({ store, state: state2, brain: "staircase_brain", text: "the stairs", speaker: "customer", withProse: false });
    const streakBefore = state2.empty_state_discovery_streak;
    await infer.processTurn({ store, state: state2, brain: "staircase_brain", text: "I want an oak staircase", speaker: "customer", withProse: false });
    const streakAfter = state2.empty_state_discovery_streak;
    assertions.push({
      pass: streakBefore >= 2 && streakAfter === 0,
      label: `streak resets to 0 when customer-stated fact lands · before=${streakBefore} · after=${streakAfter}`,
    });
  }

  console.log("");
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
