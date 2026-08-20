// Priority-2 diagnostic · NEX speaking-quality inspection.
//
// Runs the 12 scenarios from Philip's 2026-08-20 spec through the same
// pipeline the /api/nex-conv/chat route uses. Captures real prose so
// the audit judges from evidence, not code-reading alone.
//
// READ-ONLY · does not modify state, code, or persisted data. Uses the
// jsonl backend (no Postgres). Each scenario runs in a fresh
// conversation so priors from earlier scenarios don't leak.
//
// Delete or archive after the audit — this is a diagnostic artifact,
// not a regression test. Not chained into nex:conv:test.

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

async function runConversation(store, name, turns) {
  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: `probe-${name}` });
  const record = { name, turns: [] };
  for (const text of turns) {
    const t0 = Date.now();
    const out = await infer.processTurn({
      store, state, brain: "staircase_brain", text, speaker: "customer", withProse: true,
    });
    record.turns.push({
      customer: text,
      nex_reply: out.prose?.text ?? `(no prose · error: ${out.prose?.error ?? "unknown"})`,
      intent: out.understood_intent?.slug,
      entities: (out.understood_entities ?? []).slice(0, 5),
      facts: Object.fromEntries(
        Object.entries(state.established_facts).map(([k, v]) => [k, { value: v.value, provenance: v.provenance }])
      ),
      thin_packet_strikes: state.thin_packet_strikes,
      handoff: state.handoff_recommended,
      latency_ms: Date.now() - t0,
      prose_ms: out.stage_timings?.prose_ms,
    });
  }
  return record;
}

async function main() {
  const store = await boot();
  const results = [];

  // ─── 12 scenarios from Philip's Priority-2 spec ───────────────
  const scenarios = [
    { name: "1-simple-question", turns: [
      "What is a newel?"
    ]},
    { name: "2-technical-question", turns: [
      "What's the difference between a closed string and a cut string?"
    ]},
    { name: "3-changing-mind", turns: [
      "I'd like an oak staircase.",
      "Actually, change the oak to walnut.",
      "No, back to oak.",
    ]},
    { name: "4-several-questions-in-sequence", turns: [
      "What options have I got for wood?",
      "And what about balustrade choices?",
      "And how much does installation cost?",
    ]},
    { name: "5-unknown-question", turns: [
      "What's the name of the metal bracket that holds a floating tread to the wall in Scandinavian houses?",
    ]},
    { name: "6-needs-external-knowledge", turns: [
      "What did the 2019 revision of BS 5395-1 change about tapered treads for domestic use?",
    ]},
    { name: "7-return-to-earlier-subject", turns: [
      "I want an oak staircase against a wall.",
      "What about glass balustrades?",
      "How much would that oak configuration cost?",  // 'that' resolves to oak
    ]},
    { name: "8-recommendation", turns: [
      "It's a Victorian terrace hallway, quite narrow. Which staircase style would you recommend?",
    ]},
    { name: "9-price-no-authorised-product", turns: [
      "How much would a straight oak staircase cost, roughly?",
    ]},
    { name: "10-price-with-would-be-authorised-product", turns: [
      // No product catalogue exists yet · this scenario tests the
      // silence-over-fabrication default. Under the pricing doctrine
      // this should ALSO defer (no owner-provenanced record → deflect).
      "How much for a 900mm wide straight oak staircase from your standard range?",
    ]},
    { name: "11-voice-simulation-correction-flow", turns: [
      // Voice adapter emits a plain string identical to text input.
      // This scenario proves the same brain handles both paths.
      "i want an oak staircase",       // as if transcribed
      "actually change the oak to walnut",  // correction via voice
      "make the handrail walnut too",  // continuation
    ]},
    { name: "12-very-short-replies", turns: [
      "Hi",
      "I need a staircase",
      "yes",
      "no",
      "what about glass?",
    ]},
  ];

  console.log("════════════════════════════════════════════════════════");
  console.log("NEX SPEAKING QUALITY PROBE · 12 scenarios");
  console.log("════════════════════════════════════════════════════════");

  for (const sc of scenarios) {
    console.log(`\n─── SCENARIO ${sc.name} ─────────────────────────────`);
    const rec = await runConversation(store, sc.name, sc.turns);
    results.push(rec);
    for (const t of rec.turns) {
      console.log(`\n  [intent=${t.intent} · entities=[${t.entities.join(",")}] · ${t.latency_ms}ms]`);
      console.log(`  C: ${t.customer}`);
      console.log(`  N: ${t.nex_reply}`);
      if (Object.keys(t.facts).length > 0) {
        console.log(`  state: ${Object.entries(t.facts).map(([k, v]) => `${k}=${v.value}[${v.provenance ?? "?"}]`).join(" · ")}`);
      }
    }
  }

  console.log("\n\n════════════════════════════════════════════════════════");
  console.log("END · " + results.length + " scenarios · " + results.reduce((n, r) => n + r.turns.length, 0) + " turns");
  console.log("════════════════════════════════════════════════════════");
}

main().catch(e => { console.error(e); process.exit(1); });
