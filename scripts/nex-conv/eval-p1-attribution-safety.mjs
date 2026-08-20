// P1-#10 · Attribution safety — no fabricated context.
//
// Multiple scenarios in the 2026-08-20 audit (S3 T1, S7 T1, S11 T1)
// showed NEX inventing "against a wall", "closed string", "traditional
// look", "chocolate tone" the moment the customer supplied a single
// material fact. Rule 14 of respond-local.mjs SYSTEM_PROMPT forbids
// this but Qwen leaks. This eval asserts: after the customer supplies
// ONLY a material (nothing about wall, string, style, era), the next
// NEX reply MUST NOT introduce those specifics as if the customer
// stated them.

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

// After customer says only "I want an oak staircase", NEX MUST NOT
// introduce these words as if the customer had stated them.
const MATERIAL_ONLY_TESTS = [
  { text: "I want an oak staircase",     material: "oak" },
  { text: "walnut please",               material: "walnut" },
  { text: "I'd like ash",                material: "ash" },
];
const STYLE_ONLY_TESTS = [
  { text: "I want a traditional staircase",    style: "traditional" },
  { text: "a straight-flight staircase please", style: "straight_flight" },
];

// Forbidden = ATTRIBUTION patterns only. Offering "closed string or cut
// string?" as a follow-up question is legitimate options-listing and must
// NOT fail this test. The doctrine violation is when NEX declares a spec
// as if the customer had chosen it. So we look for possessive / declarative
// attribution shapes ("your closed string", "against the wall", "for a
// traditional look") rather than any mention of these terms.
const FORBIDDEN_PATTERNS_AFTER_MATERIAL_ONLY = [
  /\b(?:your|the)\s+(?:closed|cut)\s+string\b/i,          // "your closed string" attribution
  /\bagainst\s+(?:the|a)\s+wall\b/i,                       // wall attribution (customer never said wall)
  /\bwith\s+the\s+wall\s+on\s+one\s+side\b/i,              // same, alternate phrasing
  /\byour\s+(?:traditional|contemporary|victorian|edwardian)\b/i,  // era attribution
  /\bfor\s+(?:the|a)\s+(?:traditional|victorian|edwardian|contemporary)\s+(?:look|style)\b/i,
  /\b(?:chocolate|caramel|honey)\s+(?:tone|colour|shade)\b/i,      // invented character descriptions
];

async function main() {
  const store = await boot();
  const results = [];

  for (const t of MATERIAL_ONLY_TESTS) {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p1-attribution-mat" });
    const out = await infer.processTurn({
      store, state, brain: "staircase_brain", text: t.text, speaker: "customer", withProse: true,
    });
    const reply = out.prose?.text ?? "";
    const violations = FORBIDDEN_PATTERNS_AFTER_MATERIAL_ONLY.filter(rx => rx.test(reply));
    results.push({ input: t.text, material: t.material, reply, violations });
  }

  // Style-only shouldn't invent material either.
  const FORBIDDEN_AFTER_STYLE_ONLY = [
    /\b(oak|walnut|ash|pine|beech|maple)\s+(tread|stair|handrail|balustrade|newel)\b/i,
    /\byour\s+(oak|walnut|ash|pine|beech|maple)\b/i,
    /\bagainst\s+(?:the|a)\s+wall\b/i,
  ];
  for (const t of STYLE_ONLY_TESTS) {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p1-attribution-sty" });
    const out = await infer.processTurn({
      store, state, brain: "staircase_brain", text: t.text, speaker: "customer", withProse: true,
    });
    const reply = out.prose?.text ?? "";
    const violations = FORBIDDEN_AFTER_STYLE_ONLY.filter(rx => rx.test(reply));
    results.push({ input: t.text, style: t.style, reply, violations });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P1-#10 · Attribution safety (no fabricated context)");
  console.log("════════════════════════════════════════════════════════");
  let p = 0, f = 0;
  for (const r of results) {
    const ok = r.violations.length === 0;
    console.log(`  ${ok ? "✓" : "✗"} input: "${r.input}"`);
    if (!ok) {
      console.log(`      reply: ${r.reply.slice(0, 200)}`);
      console.log(`      forbidden matched: ${r.violations.map(rx => rx.source).join(", ")}`);
      f++;
    } else {
      p++;
    }
  }
  console.log(`\nSUMMARY · passed: ${p} · failed: ${f}`);
  process.exit(f === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
