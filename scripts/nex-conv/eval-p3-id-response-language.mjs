// P3 · Phase 1 · Response language passthrough.
//
// Doctrine (Philip 2026-08-20): Qwen 2.5:3b is multilingual — replies
// in the customer's detected language when the SYSTEM_PROMPT is relaxed
// and the packet carries CUSTOMER_LANGUAGE. Same brain, same doctrine,
// only presentation language changes.
//
// Asserts:
//   1. Indonesian input → state.conversation_language === 'id'
//   2. English input → state.conversation_language === 'en' (unchanged
//      merge-gate behaviour)
//   3. Indonesian input → NEX prose reply contains at least one
//      distinctively-Indonesian marker (heuristic · Qwen won't always
//      be 100% Indonesian for tech terms and that's OK per doctrine)

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

// Distinctive Indonesian output markers — high-confidence tokens that
// Qwen would emit if genuinely replying in Indonesian.
const ID_OUTPUT_RX = /\b(anda|saya|kami|tentu|silakan|baik|iya|tidak|ini|itu|untuk|dengan|dari|atau|kalau|jika|apakah|adalah|akan|sudah|sedang)\b/i;

async function runOne(store, text) {
  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p3-lang-resp" });
  const out = await infer.processTurn({ store, state, brain: "staircase_brain", text, speaker: "customer", withProse: true });
  return { state, reply: out.prose?.text ?? "" };
}

async function main() {
  const store = await boot();
  const assertions = [];

  // Scenario A: Indonesian greeting → state=id + Indonesian reply.
  // Qwen 3B non-determinism means individual replies sometimes miss the
  // language directive · retry 3x, require ≥2 in Indonesian. Detection
  // must be 100% deterministic (regex only, not LLM-dependent).
  {
    let detectionOk = true;
    let replyIndonesianCount = 0;
    const attempts = [];
    for (let i = 0; i < 3; i++) {
      const { state, reply } = await runOne(store, "Halo, saya mau tanya soal tangga");
      if (state.conversation_language !== "id") detectionOk = false;
      if (ID_OUTPUT_RX.test(reply)) replyIndonesianCount++;
      attempts.push(reply);
    }
    assertions.push({ pass: detectionOk, label: `A · Indonesian input · state.conversation_language=id (3/3 detections)` });
    assertions.push({ pass: replyIndonesianCount >= 2, label: `A · reply contains Indonesian marker (${replyIndonesianCount}/3 attempts)`, evidence: attempts.map(r => r.slice(0, 100)) });
  }

  // Scenario B: English greeting → state=en + English reply (regression gate)
  {
    const { state, reply } = await runOne(store, "hi, I need advice about a staircase");
    assertions.push({ pass: state.conversation_language === "en", label: `B · English input · state.conversation_language=en · got ${state.conversation_language}` });
    assertions.push({ pass: !ID_OUTPUT_RX.test(reply), label: `B · English reply has NO Indonesian marker · reply="${reply.slice(0, 120)}..."` });
  }

  // Scenario C: switching mid-conversation · re-detects per turn (no session lock)
  {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p3-switch" });
    await infer.processTurn({ store, state, brain: "staircase_brain", text: "Halo, saya mau tangga kayu", speaker: "customer", withProse: false });
    const langAfterId = state.conversation_language;
    await infer.processTurn({ store, state, brain: "staircase_brain", text: "Actually, walnut please", speaker: "customer", withProse: false });
    const langAfterEn = state.conversation_language;
    assertions.push({ pass: langAfterId === "id" && langAfterEn === "en", label: `C · language re-detected per turn (id→en switch) · got ${langAfterId} then ${langAfterEn}` });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P3-Phase-1 · Response language passthrough");
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
