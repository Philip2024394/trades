// Micro-regression for the empty-state guard fix (2026-08-20).
//
// Reproduces the scenario surfaced by eval-regression.mjs natural-25turn T3:
//   1. "hi"                          → meta_greeting (empty state)
//   2. "u there?"                    → meta_presence (empty state)
//   3. "im looking to redo my stairs" → statement (still empty state)
//
// Before fix: isTurn1EmptyState guarded turnCountEff<=1 → after 2 meta turns
//   turn_count was 5, guard didn't fire, KNOWLEDGE PACKET was included, and
//   Qwen replied "Given your staircase against a wall, a closed string with
//   oak would be a common choice." — pure fabrication.
// After fix: isEmptyStateDiscover only checks factCountEff===0, guard fires
//   on T3, reply must not contain wall/oak/closed-string.

import { createStore } from "./lib/store-factory.mjs";
import { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } from "./lib/entities.mjs";
import * as infer from "./lib/infer.mjs";
import { randomUUID } from "node:crypto";

const FORBIDDEN_ON_EMPTY_STATE = [
  /\bagainst (the |a )?wall\b/i,
  /\bclosed string\b/i,
  /\bcut string\b/i,
  /\bopen riser\b/i,
  /\boak\b/i,
  /\bwalnut\b/i,
  /\bvictorian\b/i,
  /\bedwardian\b/i,
  /\bgiven your\b/i,
  /\bfor your\b/i,
];

async function main() {
  const store = await createStore({ backend: "jsonl" });
  for (const i of STAIRCASE_INTENTS) await store.upsertIntent(i);
  for (const e of STAIRCASE_ENTITIES) await store.upsertEntity({ ...e, brain: "staircase_brain" });

  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain" });
  const script = [
    { text: "hi", note: "meta_greeting" },
    { text: "u there?", note: "meta_presence" },
    { text: "im looking to redo my staircase", note: "empty-state discovery · GUARD MUST FIRE" },
  ];

  const results = [];
  for (const s of script) {
    const out = await infer.processTurn({ store, state, brain: "staircase_brain", text: s.text, speaker: "customer", withProse: true });
    const reply = out.prose?.text ?? "";
    results.push({ note: s.note, customer: s.text, intent: out.understood_intent.slug, reply, factCount: Object.keys(state.established_facts).length, turnCount: state.turn_count });
  }

  console.log("─── TRANSCRIPT ─────────────────────────────────");
  for (const r of results) {
    console.log(`[${r.note}] intent=${r.intent} · facts=${r.factCount} · turn_count=${r.turnCount}`);
    console.log(`  C: ${r.customer}`);
    console.log(`  N: ${r.reply}`);
  }

  const t3 = results[2];
  const violations = FORBIDDEN_ON_EMPTY_STATE.filter(rx => rx.test(t3.reply));

  console.log("\n─── ASSERTIONS ────────────────────────────────");
  const ok = violations.length === 0;
  console.log(`  ${ok ? "✓" : "✗"} T3 reply must NOT contain any specific staircase claim while state is empty`);
  if (!ok) {
    console.log(`      forbidden matches: ${violations.map(r => r.source).join(", ")}`);
    console.log(`      reply: "${t3.reply}"`);
  }

  process.exit(ok ? 0 : 2);
}
main().catch(e => { console.error(e); process.exit(1); });
