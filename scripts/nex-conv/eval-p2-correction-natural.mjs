// P2-C1 · Natural corrections update state correctly.
//
// S5 of the 2026-08-20 natural-conversation audit reproduced: "hmm no,
// let's go walnut after all" fell through to specify_material, was a
// no-op because prior material was already set, so state kept OAK
// while NEX SAID walnut. Silent state divergence · doctrine violation.
//
// This eval asserts that 8 natural correction phrasings all correctly
// UPDATE state.established_facts.material_primary to the new material.

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

async function runOne(store, prior, correction, expected) {
  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p2-correct" });
  await infer.processTurn({ store, state, brain: "staircase_brain", text: prior, speaker: "customer", withProse: false });
  await infer.processTurn({ store, state, brain: "staircase_brain", text: correction, speaker: "customer", withProse: false });
  return state.established_facts.material_primary?.value ?? null;
}

async function main() {
  const store = await boot();
  const assertions = [];

  const CASES = [
    { prior: "I'd like an oak staircase",  correction: "actually make it walnut",           expected: "walnut" },
    { prior: "I want an oak staircase",    correction: "no, walnut",                        expected: "walnut" },
    { prior: "I'd like an oak staircase",  correction: "hmm no, let's go walnut after all", expected: "walnut" },
    { prior: "I want an oak staircase",    correction: "I've changed my mind — walnut",     expected: "walnut" },
    { prior: "I want an oak staircase",    correction: "let's go walnut instead",           expected: "walnut" },
    { prior: "I want an oak staircase",    correction: "make it walnut",                    expected: "walnut" },
    { prior: "walnut staircase please",    correction: "back to oak",                       expected: "oak" },
    { prior: "walnut staircase please",    correction: "wait, oak after all",               expected: "oak" },
  ];

  for (const c of CASES) {
    const actual = await runOne(store, c.prior, c.correction, c.expected);
    assertions.push({
      pass: actual === c.expected,
      label: `"${c.prior}" → "${c.correction}" → material_primary=${c.expected} · got ${actual}`,
    });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P2-C1 · Natural corrections update state correctly");
  console.log("════════════════════════════════════════════════════════");
  let p = 0, f = 0;
  for (const a of assertions) {
    console.log(`  ${a.pass ? "✓" : "✗"} ${a.label}`);
    a.pass ? p++ : f++;
  }
  console.log(`\nSUMMARY · passed: ${p} · failed: ${f}`);
  process.exit(f === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
