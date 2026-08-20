// P2-C2 · Multi-material correction disambiguates by component context.
//
// S5 T5 of the 2026-08-20 audit: "walnut with glass balustrade please"
// (correction intent) → material_primary=glass (entity-order lottery)
// instead of walnut primary + glass balustrade. Fix in state.mjs
// correction handler: strip materials that are context-bound to a
// component (balustrade/handrail/newel) before picking the primary
// candidate. Component writers also now fire during correct intent.

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

async function runSeq(store, turns) {
  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p2-multi-mat" });
  for (const t of turns) {
    await infer.processTurn({ store, state, brain: "staircase_brain", text: t, speaker: "customer", withProse: false });
  }
  return state;
}

async function main() {
  const store = await boot();
  const assertions = [];

  // Scenario A: full audit reproduction · flip-flop then correction with balustrade
  {
    const state = await runSeq(store, [
      "I'd like an oak staircase",
      "actually make it walnut",
      "wait, I liked oak better — back to oak",
      "hmm no, let's go walnut after all",
      "sorry for the flip-flopping — walnut with glass balustrade please",
    ]);
    const primary = state.established_facts.material_primary?.value;
    const balustrade = state.established_facts.balustrade?.value;
    assertions.push({ pass: primary === "walnut", label: `A · after full audit-reproduction sequence · material_primary=walnut · got ${primary}` });
    assertions.push({ pass: balustrade === "glass", label: `A · balustrade=glass captured during correction · got ${balustrade}` });
  }

  // Scenario B: one-shot multi-material correction from an oak start
  {
    const state = await runSeq(store, [
      "I want an oak staircase",
      "actually walnut with glass balustrade",
    ]);
    assertions.push({ pass: state.established_facts.material_primary?.value === "walnut", label: `B · one-shot correction · walnut primary · got ${state.established_facts.material_primary?.value}` });
    assertions.push({ pass: state.established_facts.balustrade?.value === "glass",       label: `B · one-shot correction · glass balustrade · got ${state.established_facts.balustrade?.value}` });
  }

  // Scenario C: correction with handrail material (not balustrade)
  {
    const state = await runSeq(store, [
      "I want an oak staircase",
      "actually make it walnut with a metal handrail",
    ]);
    assertions.push({ pass: state.established_facts.material_primary?.value === "walnut", label: `C · walnut primary despite handrail mention · got ${state.established_facts.material_primary?.value}` });
    assertions.push({ pass: state.established_facts.handrail_material?.value === "metal", label: `C · handrail_material=metal · got ${state.established_facts.handrail_material?.value}` });
  }

  // Scenario D: correction where only component material changes (primary unaffected)
  {
    const state = await runSeq(store, [
      "I want an oak staircase with glass balustrade",
      "actually change the balustrade to metal",
    ]);
    assertions.push({ pass: state.established_facts.material_primary?.value === "oak", label: `D · primary stays oak when only component changes · got ${state.established_facts.material_primary?.value}` });
    assertions.push({ pass: state.established_facts.balustrade?.value === "metal", label: `D · balustrade updated glass→metal · got ${state.established_facts.balustrade?.value}` });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P2-C2 · Multi-material correction disambiguates by component");
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
