// P1-#6 + P1-#8 · Anti-scaffold + anti-"Given your..." opener.
//
// S2 of the 2026-08-20 audit had a reply beginning "Sure, here's a
// reply that fits the context and the rules:" — Qwen leaked its
// thinking scaffold. S4 T1 had nested wrapper quotes 'Sure, how about
// "Sure. For wood specifically..."'. Post-processing in respond-local.mjs
// strips these deterministically.
//
// Separately, "Given your X..." appeared in 60% of substantive replies.
// This test runs 8 varied turns and asserts the given-your pattern
// stays under 25% of replies (aspirational bar · was 60%).

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

const SCAFFOLD_PATTERNS = [
  /^\s*sure,?\s+here'?s\s+(a|the|my)/i,
  /^\s*here'?s\s+(a|the|my)?\s*reply/i,
  /^\s*sure,?\s+how about\s+["'“]/i,
  /^\s*["'“].+["'”]\s*$/s,   // whole reply wrapped in quotes
  /fits\s+the\s+context\s+and\s+the\s+rules/i,
];

const GIVEN_YOUR_RX = /^\s*given\s+(the|your|that)/i;

async function runOne(store, text) {
  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p1-scaffold-opener" });
  const out = await infer.processTurn({
    store, state, brain: "staircase_brain", text, speaker: "customer", withProse: true,
  });
  return out.prose?.text ?? "";
}

const PROBES = [
  "I want an oak staircase",
  "What's the difference between a closed string and a cut string?",
  "Add glass balustrades to the design",
  "What about the handrail?",
  "Make the handrail walnut too",
  "What options have I got for wood?",
  "And what about balustrade choices?",
  "I'd like a straight staircase in walnut",
];

async function main() {
  const store = await boot();
  const replies = [];
  for (const p of PROBES) replies.push({ text: p, reply: await runOne(store, p) });

  console.log("════════════════════════════════════════════════════════");
  console.log("P1-#6 + P1-#8 · Scaffold + \"Given your...\" frequency");
  console.log("════════════════════════════════════════════════════════");
  const scaffoldViolations = [];
  const givenYourCount = replies.filter(r => GIVEN_YOUR_RX.test(r.reply)).length;
  for (const r of replies) {
    const bad = SCAFFOLD_PATTERNS.some(rx => rx.test(r.reply));
    if (bad) scaffoldViolations.push(r);
  }

  const assertions = [
    {
      pass: scaffoldViolations.length === 0,
      label: `No scaffold leakage in any reply · violations: ${scaffoldViolations.length}/${replies.length}`,
      detail: scaffoldViolations.map(r => `"${r.text}" → "${r.reply.slice(0, 100)}..."`).join("\n      "),
    },
    {
      pass: givenYourCount / replies.length <= 0.25,
      label: `"Given your..." opener frequency ≤ 25% · got ${givenYourCount}/${replies.length} = ${Math.round(100*givenYourCount/replies.length)}%`,
      detail: replies.filter(r => GIVEN_YOUR_RX.test(r.reply)).map(r => `"${r.text}" → "${r.reply.slice(0, 100)}..."`).join("\n      "),
    },
  ];

  let p = 0, f = 0;
  for (const a of assertions) {
    console.log(`  ${a.pass ? "✓" : "✗"} ${a.label}`);
    if (!a.pass && a.detail) console.log(`      ${a.detail}`);
    a.pass ? p++ : f++;
  }
  console.log(`\nSUMMARY · passed: ${p} · failed: ${f}`);
  process.exit(f === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
