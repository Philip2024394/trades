// P3 · Phase 3 · Indonesian entity aliases → canonical slugs.
//
// Doctrine (Philip 2026-08-20): state stays language-neutral · canonical
// slugs identical across languages. Indonesian tech vocabulary (kaca,
// logam, tangga, koridor, loteng, ekstensi, pegangan tangan, tiang
// tangga, tradisional, klasik, kontemporer) must extract to the SAME
// slugs as their English equivalents.
//
// Also asserts: Indonesian conversation flow captures state facts with
// canonical slugs — proving that English regression tests would still
// see the same slugs regardless of input language.

import { createStore } from "./lib/store-factory.mjs";
import { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } from "./lib/entities.mjs";
import { extractEntities } from "./lib/extract.mjs";
import * as infer from "./lib/infer.mjs";
import { randomUUID } from "node:crypto";

async function boot() {
  const store = await createStore({ backend: "jsonl" });
  for (const i of STAIRCASE_INTENTS) await store.upsertIntent(i);
  for (const e of STAIRCASE_ENTITIES) await store.upsertEntity({ ...e, brain: "staircase_brain" });
  return store;
}

const ENTITY_CASES = [
  // Materials
  { text: "kaca",                                          expect: ["glass"] },
  { text: "logam",                                         expect: ["metal"] },
  { text: "besi",                                          expect: ["metal"] },
  // Components
  { text: "tangga",                                        expect: ["staircase"] },
  { text: "pegangan tangan",                               expect: ["handrail"] },
  { text: "tiang tangga",                                  expect: ["newel"] },
  // Locations
  { text: "koridor",                                       expect: ["hallway"] },
  { text: "lorong",                                        expect: ["hallway"] },
  { text: "loteng",                                        expect: ["loft"] },
  { text: "ekstensi",                                      expect: ["extension"] },
  // Styles
  { text: "tradisional",                                   expect: ["traditional"] },
  { text: "klasik",                                        expect: ["traditional"] },
  { text: "kontemporer",                                   expect: ["contemporary"] },
  // Multi-entity Indonesian sentence
  { text: "tangga kaca di koridor",                        expect: ["staircase", "glass", "hallway"] },
];

async function main() {
  const store = await boot();
  const assertions = [];

  // Entity extraction · canonical slugs
  for (const c of ENTITY_CASES) {
    const actual = extractEntities(c.text, store).sort();
    const expected = c.expect.slice().sort();
    const missing = expected.filter(e => !actual.includes(e));
    const ok = missing.length === 0;
    assertions.push({
      pass: ok,
      label: `"${c.text}" → extracts [${expected.join(", ")}] · got [${actual.join(", ")}]`,
    });
  }

  // State canonicalisation · Indonesian flow ends up with same slugs as English flow
  {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p3-canon" });
    await infer.processTurn({ store, state, brain: "staircase_brain", text: "Saya ingin tangga kayu oak", speaker: "customer", withProse: false });
    await infer.processTurn({ store, state, brain: "staircase_brain", text: "Tambahkan balustrade kaca", speaker: "customer", withProse: false });
    const material = state.established_facts.material_primary?.value;
    const balustrade = state.established_facts.balustrade?.value;
    assertions.push({ pass: material === "oak",        label: `Indonesian flow · material_primary=oak · got ${material}` });
    assertions.push({ pass: balustrade === "glass",     label: `Indonesian flow · balustrade=glass · got ${balustrade}` });
  }

  // Location captured from Indonesian
  {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p3-canon-loc" });
    await infer.processTurn({ store, state, brain: "staircase_brain", text: "Tangga untuk koridor kecil", speaker: "customer", withProse: false });
    const location = state.established_facts.location_type?.value;
    assertions.push({ pass: location === "hallway", label: `Indonesian flow · location_type=hallway from koridor · got ${location}` });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P3-Phase-3 · Indonesian entity aliases → canonical slugs");
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
