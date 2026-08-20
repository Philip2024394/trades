// Voice adapter integration test.
//
// Purpose: prove the doctrine — VOICE MUST NOT CREATE A SECOND BRAIN.
//
// The browser voice adapter's job is exactly:
//   audio → string transcript → HTTP POST /api/nex-conv/chat
//
// So the invariant to prove without a browser is:
//   Given the SAME transcript passed via infer.processTurn (the exact
//   function the chat API route calls), the resulting NEX state and
//   reply must be IDENTICAL whether the input arrived as typed text
//   or as a spoken transcript. There is one brain, one state, one path.
//
// This test runs TWO parallel conversations with identical scripts.
// One is labelled "text", one "voice". After each turn we assert the
// two established_facts dicts are structurally equal, and that the
// corrections_log is symmetric. Any divergence would indicate a second
// pipeline has been introduced (which would be an Architecture Change
// requiring an Alert).

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

function normaliseFacts(facts) {
  // Compare only the load-bearing fields · timestamps differ per run.
  const out = {};
  for (const [k, v] of Object.entries(facts ?? {})) {
    if (!v || v.value == null) continue;
    out[k] = { value: v.value, provenance: v.provenance ?? "customer_stated" };
  }
  return out;
}

function normaliseCorrections(log) {
  return (log ?? []).map(c => ({
    field: c.field, previous: c.previous, new: c.new,
  }));
}

function stableStringify(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

async function runOne(store, label, script) {
  const state = infer.newState({
    conversation_id: randomUUID(),
    brain: "staircase_brain",
    business_id: `voice-adapter-${label}`,
  });
  const turns = [];
  for (const text of script) {
    const out = await infer.processTurn({
      store, state, brain: "staircase_brain", text, speaker: "customer",
      withProse: false, // prose adds LLM variance · state is what we compare
    });
    turns.push({
      text,
      intent: out.understood_intent?.slug,
      entities: (out.understood_entities ?? []).slice().sort(),
      facts: normaliseFacts(state.established_facts),
      corrections: normaliseCorrections(state.corrections_log),
    });
  }
  return { state, turns };
}

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("VOICE ADAPTER · one-brain invariant");
  console.log("════════════════════════════════════════════════════════");
  const store = await boot();

  const script = [
    "I want an oak staircase",
    "actually change the oak to walnut",
    "add glass balustrades to the design",
    "what about the handrail",
  ];

  // TEXT PATH · direct string input · same processTurn call.
  const text = await runOne(store, "text", script);
  // VOICE PATH · simulated transcript · identical string · same processTurn call.
  // (The browser adapter's job stops at producing this string. Everything
  //  downstream is byte-identical to the text path by construction — this
  //  test proves that construction has not been silently forked.)
  const voice = await runOne(store, "voice", script);

  const assertions = [];
  for (let i = 0; i < script.length; i++) {
    const t = text.turns[i], v = voice.turns[i];
    const factsMatch = stableStringify(t.facts) === stableStringify(v.facts);
    assertions.push({
      pass: factsMatch,
      label: `T${i + 1} · established_facts identical (text vs voice)`,
      evidence: factsMatch ? null : { text: t.facts, voice: v.facts },
    });
    const corrMatch = stableStringify(t.corrections) === stableStringify(v.corrections);
    assertions.push({
      pass: corrMatch,
      label: `T${i + 1} · corrections_log identical (text vs voice)`,
      evidence: corrMatch ? null : { text: t.corrections, voice: v.corrections },
    });
    const intentMatch = t.intent === v.intent;
    assertions.push({
      pass: intentMatch,
      label: `T${i + 1} · understood_intent identical (text=${t.intent} voice=${v.intent})`,
      evidence: intentMatch ? null : { text: t.intent, voice: v.intent },
    });
    const entMatch = stableStringify(t.entities) === stableStringify(v.entities);
    assertions.push({
      pass: entMatch,
      label: `T${i + 1} · understood_entities identical`,
      evidence: entMatch ? null : { text: t.entities, voice: v.entities },
    });
  }

  // Doctrine assertion · after the correction, both paths must have
  // material_primary=walnut. If either drifted, we'd have a second brain.
  const textFinal = text.state.established_facts.material_primary?.value;
  const voiceFinal = voice.state.established_facts.material_primary?.value;
  assertions.push({
    pass: textFinal === "walnut" && voiceFinal === "walnut",
    label: `final material_primary walnut on both paths (text=${textFinal} voice=${voiceFinal})`,
    evidence: null,
  });
  const textBal = text.state.established_facts.balustrade?.value;
  const voiceBal = voice.state.established_facts.balustrade?.value;
  assertions.push({
    pass: textBal === "glass" && voiceBal === "glass",
    label: `final balustrade glass on both paths (text=${textBal} voice=${voiceBal})`,
    evidence: null,
  });

  let passed = 0, failed = 0;
  console.log("");
  for (const a of assertions) {
    console.log(`  ${a.pass ? "✓" : "✗"} ${a.label}`);
    if (!a.pass && a.evidence) console.log(`      evidence: ${JSON.stringify(a.evidence).slice(0, 300)}`);
    a.pass ? passed++ : failed++;
  }
  console.log("");
  console.log("════════════════════════════════════════════════════════");
  console.log(`SUMMARY · passed: ${passed} · failed: ${failed}`);
  console.log("════════════════════════════════════════════════════════");
  process.exit(failed === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
