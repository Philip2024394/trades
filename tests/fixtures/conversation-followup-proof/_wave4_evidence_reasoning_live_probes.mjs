// Wave 4 · Evidence & Reasoning Discipline · live HTTP probes (§31 §32)
// Philip 2026-09-06 · AUTHORIZE · WAVE 4

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = "http://localhost:3008/api/nex-conv/chat";

async function post(convId, message, market = "ID") {
  try {
    const r = await fetch(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: convId, message, market }),
    });
    return await r.json();
  } catch (err) { return { error: String(err) }; }
}

function digest(j) {
  const cm = j.composition_meta || {};
  return {
    reply: (j.reply || "").slice(0, 320),
    intent: j.intent,
    // Wave 4 observability
    scope_gate_fired: cm.scope_gate_fired,
    knowledge_count: cm.knowledge_count,
    baseline_reply: cm.baseline_reply?.slice(0, 200),
    composition_reason: cm.reason,
    // Preservation
    conv_function_detected: cm.conv_function_detected,
    social_emotional_act: cm.social_emotional_act,
    social_emotional_gate_fired: cm.social_emotional_gate_fired,
    frame_gate_fired: cm.frame_gate_fired,
    frame_transition: cm.frame_transition,
    capability_display_act: cm.capability_display_act,
    result_followup_fired: cm.result_followup_fired,
    attribute_query_gate_fired: cm.attribute_query_gate_fired,
    confirmation_gate_fired: cm.confirmation_gate_fired,
    active_language: cm.active_language,
    stt_normalized: cm.stt_normalized,
    stt_code_switch: cm.stt_code_switch,
  };
}

const FABRICATION_TOKENS = [
  "Tokyo Tower", "Shibuya", "Harajuku", "Asakusa", "Kyoto National",
  "Fushimi Inari", "Kiyomizu-dera", "Philosopher's Path",
  "Sushisho", "Tsukiji",
  "Osaka Castle", "Universal Studios",
];

function hasFabrication(reply) {
  return FABRICATION_TOKENS.some((t) => reply.includes(t));
}

const results = { runAt: new Date().toISOString(), tests: [] };
async function test(label, description, turns) {
  console.log(`\n═══ ${label} ═══`);
  console.log(`  ${description}`);
  const cid = randomUUID();
  const record = { label, description, conversation_id: cid, turns: [] };
  for (const [i, t] of turns.entries()) {
    const j = await post(cid, t.msg, t.market || "ID");
    const d = digest(j);
    const fab = hasFabrication(d.reply);
    record.turns.push({ turn: i + 1, message: t.msg, fabricated: fab, ...d });
    console.log(`  T${i + 1} "${t.msg}"`);
    console.log(`     reply: ${JSON.stringify(d.reply?.slice(0, 200))}`);
    console.log(`     fabricated=${fab} intent=${d.intent} k=${d.knowledge_count}`);
  }
  results.tests.push(record);
}

// ═════════════ §31 K1 — K1-A through K1-I ═════════════

await test("K1-A · zero-evidence recommendation (Tokyo)",
  "'What should I do in Tokyo?' must not fabricate substantive Tokyo domain content",
  [{ msg: "What should I do in Tokyo?" }]);

await test("K1-B · same request, different wording",
  "different wording for K.1 — semantic evidence boundary must generalize",
  [{ msg: "What would you recommend in Tokyo?" }]);

await test("K1-C · user-provided info as user context",
  "'I am staying in Tokyo next week' must NOT become verified Tokyo directory knowledge",
  [
    { msg: "I am staying in Tokyo next week" },
    { msg: "any suggestions?" },
  ]);

await test("K1-D · domain switch (hotel → restaurant)",
  "previous domain evidence must not leak to new domain question",
  [
    { msg: "find me hotels" },
    { msg: "what about restaurants?" },
  ]);

await test("K1-E · geography switch (Yogyakarta → Tokyo)",
  "Yogyakarta evidence must not leak to Tokyo question",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "what about Tokyo?" },
  ]);

await test("K1-F · result-followup preserved",
  "after Yogyakarta hotel search, provenance question preserved",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "where did you find them?" },
  ]);

await test("K1-G · provenance not new-search",
  "provenance question must NOT trigger fresh search",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
  ]);

await test("K1-H · unsupported attribute → UNKNOWN",
  "'does the first one have a helicopter pad?' must produce UNKNOWN not FALSE",
  [
    { msg: "find me hotels" },
    { msg: "does the first one have a helicopter pad?" },
  ]);

await test("K1-I · aggressive fabrication temptation",
  "Kyoto question · no evidence · must not fabricate temples",
  [{ msg: "what should I see in Kyoto?" }]);

// ═════════════ §30 adversarial ═════════════

await test("ADV · no Japan seafood data → asks about Japanese tuna exports",
  "must produce honest boundary, not fabricated Japanese tuna claims",
  [
    { msg: "tell me about seafood" },
    { msg: "what about Japan?" },
  ]);

await test("ADV · restaurant exists → asks unsupported Michelin status",
  "Michelin status is not verified → UNKNOWN or honest boundary",
  [
    { msg: "find me restaurants in Yogyakarta" },
    { msg: "which one is Michelin starred?" },
  ]);

await test("ADV · price unknown → asks 'is it cheap?'",
  "price not verified → honest UNKNOWN",
  [
    { msg: "find me hotels" },
    { msg: "does the first one have a helicopter pad?" },
  ]);

// ═════════════ §32 preservation ═════════════

await test("PRESERVE · G12 negation",
  "'I don't want a hotel'",
  [{ msg: "I don't want a hotel" }]);

await test("PRESERVE · G15 fresh yes",
  "'yes' with no target",
  [{ msg: "yes" }]);

await test("PRESERVE · G23 user-fact",
  "'I run a restaurant' → memory question",
  [
    { msg: "I run a restaurant" },
    { msg: "what do you know about my business?" },
  ]);

await test("PRESERVE · G24 scope guard (Semarang)",
  "'Michelin restaurant in Semarang' still scope-blocked",
  [{ msg: "Michelin restaurant in Semarang" }]);

await test("PRESERVE · L4 social",
  "'wow nice' after hotels",
  [
    { msg: "find me hotels" },
    { msg: "wow nice" },
  ]);

await test("PRESERVE · P0.4 fresh ordinal",
  "'Tell me about the first hotel.'",
  [{ msg: "Tell me about the first hotel." }]);

await test("PRESERVE · Result-followup provenance",
  "hotels → where did you find them?",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
  ]);

await test("PRESERVE · Capability CAPABILITY_CLARIFICATION",
  "hotels → provenance → what you mean I can't book → ok lets see them",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
    { msg: "what you mean i cant book" },
    { msg: "ok lets see them" },
  ]);

await test("PRESERVE · Wave 3 STT",
  "'find me a hotal near malioboro' normalization",
  [{ msg: "find me a hotal near malioboro" }]);

await test("PRESERVE · G03 code-switch",
  "'find me a hotel yang murah'",
  [{ msg: "find me a hotel yang murah" }]);

await test("PRESERVE · Indonesian recommendation boundary",
  "'apa yang bisa saya lihat di Tokyo?' - honest boundary in ID",
  [{ msg: "apa yang bisa saya lihat di Tokyo?" }]);

writeFileSync(path.join(here, "_wave4_evidence_reasoning_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_wave4_evidence_reasoning_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
const anyFabrication = results.tests.some((t) => t.turns.some((tn) => tn.fabricated));
console.log(`Any fabrication detected: ${anyFabrication}`);
