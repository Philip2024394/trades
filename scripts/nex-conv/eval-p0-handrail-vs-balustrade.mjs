// P0-#3 · Handrail material writes to handrail_material, NOT balustrade.
//
// S11 T3 of the 2026-08-20 audit reproduced: "make the handrail walnut
// too" wrote balustrade=walnut because state.mjs's balustrade writer
// included `handrail` in BALUSTRADE_CONTEXT_SLUGS. Silent state
// corruption. Fix at state.mjs: split into three writers (balustrade
// / handrail_material / newel_material) with strictly separate
// context-slug sets.
//
// State-only assertions · no LLM required.

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

async function runTurn(store, state, text) {
  return infer.processTurn({
    store, state, brain: "staircase_brain", text, speaker: "customer", withProse: false,
  });
}

async function main() {
  const store = await boot();
  const assertions = [];

  // Scenario A: "make the handrail walnut too" → handrail_material=walnut, balustrade absent
  {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p0-handrail-1" });
    await runTurn(store, state, "I want an oak staircase");
    await runTurn(store, state, "make the handrail walnut too");
    const handrail = state.established_facts.handrail_material?.value;
    const balustrade = state.established_facts.balustrade?.value;
    assertions.push({ pass: handrail === "walnut", label: `A · handrail_material=walnut · got ${handrail}` });
    assertions.push({ pass: !balustrade,          label: `A · balustrade NOT written · got ${balustrade ?? "(unset)"}` });
    assertions.push({ pass: state.established_facts.material_primary?.value === "oak", label: `A · material_primary stays oak` });
  }

  // Scenario B: "glass balustrade" → balustrade=glass, handrail absent
  {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p0-handrail-2" });
    await runTurn(store, state, "I want an oak staircase");
    await runTurn(store, state, "add glass balustrades to the design");
    const handrail = state.established_facts.handrail_material?.value;
    const balustrade = state.established_facts.balustrade?.value;
    assertions.push({ pass: balustrade === "glass", label: `B · balustrade=glass · got ${balustrade}` });
    assertions.push({ pass: !handrail,              label: `B · handrail_material NOT written · got ${handrail ?? "(unset)"}` });
  }

  // Scenario C: "oak newel" → newel_material=oak, balustrade absent, handrail absent
  {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p0-handrail-3" });
    await runTurn(store, state, "I want a walnut staircase");
    await runTurn(store, state, "give me oak newels");
    const newel = state.established_facts.newel_material?.value;
    const balustrade = state.established_facts.balustrade?.value;
    const handrail = state.established_facts.handrail_material?.value;
    assertions.push({ pass: newel === "oak",   label: `C · newel_material=oak · got ${newel}` });
    assertions.push({ pass: !balustrade,       label: `C · balustrade NOT written · got ${balustrade ?? "(unset)"}` });
    assertions.push({ pass: !handrail,         label: `C · handrail_material NOT written · got ${handrail ?? "(unset)"}` });
  }

  // Scenario D: both handrail + balustrade in same conversation stay distinct.
  // NOTE: use plural "glass balustrades" — the singular form "glass balustrade"
  // hits a pre-existing entity-alias collision (the alias "glass balustrade"
  // is registered against slug 'glass', 16 chars, longest-first sort makes
  // it consume the whole phrase and the `balustrade` slug never extracts).
  // That collision is a separate ticket, out of P0-#3 scope. Plural form
  // avoids it because "glass balustrades" doesn't match the exact-string alias.
  {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p0-handrail-4" });
    await runTurn(store, state, "I want an oak staircase");
    await runTurn(store, state, "add glass balustrades to the design");
    await runTurn(store, state, "make the handrail walnut");
    const bal = state.established_facts.balustrade?.value;
    const hr = state.established_facts.handrail_material?.value;
    assertions.push({ pass: bal === "glass",   label: `D · balustrade=glass alongside handrail · got ${bal}` });
    assertions.push({ pass: hr === "walnut",   label: `D · handrail_material=walnut alongside balustrade · got ${hr}` });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P0-#3 · Handrail material ≠ balustrade material");
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
