// G12 · Negation Intelligence & Intent Polarity · live probes.
// Philip 2026-09-06 · AUTHORIZE G12 · §22 test matrix + §23 adversarial.

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
  } catch (err) {
    return { error: String(err) };
  }
}

function digest(j) {
  const cm = j.composition_meta || {};
  return {
    reply: (j.reply || "").slice(0, 300),
    voice_en: (j.voice_reply?.en || "").slice(0, 200),
    intent: j.intent,
    voice_intent: j.voice_reply?.intent,
    world_cards_count: j.world_cards?.count ?? j.world_cards?.cards?.length ?? 0,
    knowledge_count: cm.knowledge_count,
    conv_function_detected: cm.conv_function_detected,
    conv_function_gate_fired: cm.conv_function_gate_fired,
    conv_function_reason: cm.conv_function_reason,
    result_followup_fired: cm.result_followup_fired,
    scope_gate_fired: cm.scope_gate_fired,
    ordinal_gate_fired: cm.ordinal_gate_fired,
  };
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
    record.turns.push({ turn: i + 1, message: t.msg, ...d });
    console.log(`  T${i + 1} "${t.msg}"`);
    console.log(`     reply: ${JSON.stringify(d.reply?.slice(0, 200))}`);
    console.log(`     cf=${d.conv_function_detected} gate=${d.conv_function_gate_fired} intent=${d.intent} wc=${d.world_cards_count}`);
  }
  results.tests.push(record);
}

// ═════════════ §22 · REQUIRED TEST MATRIX ═════════════

// Basic
await test("BASIC-POS · I want a hotel",
  "affirmative · hotel task runs",
  [{ msg: "I want a hotel" }]);
await test("BASIC-NEG · I don't want a hotel (THE REGRESSION)",
  "NEGATED_REQUEST · MUST NOT execute hotel search",
  [{ msg: "I don't want a hotel" }]);

// Action
await test("ACTION-POS · Find me hotels",
  "affirmative · hotel task runs",
  [{ msg: "Find me hotels" }]);
await test("ACTION-NEG · Don't find me hotels",
  "action-negated · MUST NOT execute hotel search",
  [{ msg: "Don't find me hotels" }]);

// Need
await test("NEED-POS · I need a hotel",
  "affirmative",
  [{ msg: "I need a hotel" }]);
await test("NEED-NEG · I don't need a hotel",
  "negated · MUST NOT execute hotel search",
  [{ msg: "I don't need a hotel" }]);

// Preference
await test("PREF-POS · I'm looking for a hotel",
  "affirmative",
  [{ msg: "I'm looking for a hotel" }]);
await test("PREF-NEG · I'm not looking for a hotel",
  "negated · MUST NOT execute hotel search",
  [{ msg: "I'm not looking for a hotel" }]);

// Entity vs attribute
await test("ATTR · I want a hotel that's not expensive",
  "AFFIRMATIVE / ATTRIBUTE · hotel search MUST proceed",
  [{ msg: "I want a hotel that's not expensive" }]);

// Contrast
await test("CONTRAST · Not a hotel — a restaurant",
  "CONTRASTIVE · surface restaurant · no hotel list",
  [{ msg: "Not a hotel -- a restaurant" }]);

// Correction (existing L4)
await test("CORRECTION cross-turn · Find hotels then cancel",
  "T2 correction · MUST NOT rerun hotels",
  [{ msg: "Find me hotels" }, { msg: "Actually, I don't want a hotel anymore" }]);

// Result context
await test("RESULT-NEG · Find hotels then don't want first",
  "T2 RESULT-scope negation · hotel task remains valid · MUST NOT gate",
  [{ msg: "Find me hotels" }, { msg: "I don't want the first one" }]);

// Question
await test("QUESTION-NEG · Don't you have any hotels?",
  "rhetorical question · MUST NOT gate as rejection",
  [{ msg: "Don't you have any hotels?" }]);

// Attribute question
await test("QUESTION-ATTR · Which hotels don't have parking?",
  "attribute question · MUST NOT gate",
  [{ msg: "Which hotels don't have parking?" }]);

// Social
await test("SOCIAL · No thanks",
  "social · natural reply · NOT a rejection",
  [{ msg: "No thanks" }]);
await test("SOCIAL · I don't know",
  "social · MUST NOT gate as rejection",
  [{ msg: "I don't know" }]);
await test("SOCIAL · I don't mind",
  "social",
  [{ msg: "I don't mind" }]);

// ═════════════ §23 · ADVERSARIAL SCOPE TRAPS ═════════════

await test("ADV · I want a hotel that's not expensive (§23-1)",
  "attribute-only · hotel search proceeds",
  [{ msg: "I want a hotel that's not expensive" }]);

await test("ADV · I don't want an expensive hotel (§23-2)",
  "attribute-negation · entity affirmed",
  [{ msg: "I don't want an expensive hotel" }]);

await test("ADV · I don't want a hotel but I do want a restaurant (§23-3)",
  "contrastive",
  [{ msg: "I don't want a hotel but I do want a restaurant" }]);

await test("ADV · Don't search hotels yet (§23-4)",
  "action-negation with 'yet'",
  [{ msg: "Don't search hotels yet" }]);

await test("ADV · No thanks, I'm still looking for a hotel (§23-8)",
  "SCOPE MUST BE CORRECT · social 'no thanks' precedes affirmative task",
  [{ msg: "No thanks, I'm still looking for a hotel" }]);

// ═════════════ INDONESIAN ═════════════

await test("ID · saya tidak mau hotel",
  "ID · negated request · Indonesian reply",
  [{ msg: "saya tidak mau hotel" }]);
await test("ID · jangan cari hotel",
  "ID · action-negated · Indonesian reply",
  [{ msg: "jangan cari hotel" }]);
await test("ID · bukan hotel",
  "ID · bare entity negation",
  [{ msg: "bukan hotel" }]);

// ═════════════ PRESERVATION ═════════════

await test("PRESERVE · G24 · seafood in Japan",
  "G24 still blocks fabrication",
  [{ msg: "tell me about seafood in Japan" }]);
await test("PRESERVE · P0.3 · ordinal continuation",
  "hotel → first-one continuation",
  [
    { msg: "find me a hotel in Yogyakarta" },
    { msg: "tell me more about the first one" },
  ]);
await test("PRESERVE · P0.4 · fresh 'the first hotel'",
  "ordinal boundary reply",
  [{ msg: "Tell me about the first hotel." }]);
await test("PRESERVE · L4 · social/personal frame reset",
  "T2 offer must gate (L4)",
  [{ msg: "any hotels nex" }, { msg: "do you want to know where i am" }]);
await test("PRESERVE · result-followup · provenance",
  "delegated to Milestone A",
  [{ msg: "find me hotels" }, { msg: "where did you find them?" }]);

writeFileSync(path.join(here, "_g12_negation_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_g12_negation_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
