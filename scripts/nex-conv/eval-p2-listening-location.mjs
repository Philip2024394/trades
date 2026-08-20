// P2-L1 · NEX listens · install-location captured into state.
//
// S1 T2 of the 2026-08-20 audit: customer said "I'm renovating my
// hallway and I need advice on a staircase" · NEX asked "where in the
// house is the staircase going — hallway, extension, loft?" — NOT
// listening. Fix in state.mjs: new location_type fact captures
// hallway / loft / extension / kitchen etc. from the customer message
// so the prompt can acknowledge it instead of re-asking.

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
  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p2-listen" });
  await infer.processTurn({ store, state, brain: "staircase_brain", text, speaker: "customer", withProse: false });
  return state;
}

async function main() {
  const store = await boot();
  const assertions = [];

  const CASES = [
    { text: "I'm renovating my hallway and I need advice on a staircase", expect: "hallway" },
    { text: "It's for the loft conversion",                                expect: "loft" },
    { text: "The staircase is going in the new rear extension",            expect: "extension" },
    { text: "It's a small Victorian hallway",                              expect: "hallway" },
  ];

  for (const c of CASES) {
    const state = await runOne(store, c.text);
    const loc = state.established_facts.location_type?.value;
    assertions.push({
      pass: loc === c.expect,
      label: `"${c.text}" → location_type=${c.expect} · got ${loc ?? "(unset)"}`,
    });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P2-L1 · NEX listens · install-location captured");
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
