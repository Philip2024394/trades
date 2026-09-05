// Conversational Function / Social-Turn Protection · live HTTP probes.
// Philip 2026-09-06 · AUTHORIZE.
//
// Fires the exact regression + generalization + adversarial matrix
// against /api/nex-conv/chat. Writes JSON evidence for the report.

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
    voice_en: (j.voice_reply?.en || "").slice(0, 220),
    intent: j.intent,
    voice_intent: j.voice_reply?.intent,
    world_cards_count: j.world_cards?.count ?? j.world_cards?.cards?.length ?? 0,
    composition_ran: cm.ran,
    composition_accepted: cm.accepted,
    composition_reason: cm.reason,
    knowledge_count: cm.knowledge_count,
    conv_function_detected: cm.conv_function_detected,
    conv_function_gate_fired: cm.conv_function_gate_fired,
    conv_function_reason: cm.conv_function_reason,
    result_followup_fired: cm.result_followup_fired,
    scope_gate_fired: cm.scope_gate_fired,
    ordinal_gate_fired: cm.ordinal_gate_fired,
    hydration_reason: cm.hydration_reason,
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

// ═════════════ EXACT DEMONSTRATED FAILURE ═════════════

await test("A · EXACT REGRESSION · hotel then personal-context-offer",
  "T2 must NOT be 'Yep — found 3.' MUST invite location. NO fabrication.",
  [
    { msg: "any hotels nex" },
    { msg: "do you want to know where i am" },
  ]);

// User then provides a location (T3 · not gated · just should not fabricate)
await test("A.2 · continuation · user provides location after offer",
  "T3 personal-context-statement · natural acknowledgment",
  [
    { msg: "any hotels nex" },
    { msg: "do you want to know where i am" },
    { msg: "i'm in Bandung" },
  ]);

// ═════════════ GENERALIZATION MATRIX ═════════════

await test("B · social greeting after hotel search",
  "'how are you' must be recognised as SOCIAL_UTTERANCE, not hotel follow-up",
  [
    { msg: "find me hotels near Malioboro" },
    { msg: "how are you?" },
  ]);

await test("C · personal-context statement after hotel search",
  "'i'm actually in Bandung' must be PERSONAL_CONTEXT_STATEMENT",
  [
    { msg: "find me hotels" },
    { msg: "i'm actually in Bandung" },
  ]);

await test("D · meta-conversation after hotel search",
  "'can i ask you something?' must be META_CONVERSATION",
  [
    { msg: "find me hotels" },
    { msg: "can i ask you something?" },
  ]);

await test("E · gratitude after hotel search",
  "'thanks nex' must be GRATITUDE · NOT hotel list reuse",
  [
    { msg: "find me hotels" },
    { msg: "thanks nex" },
  ]);

// ═════════════ LEGITIMATE CONTINUATIONS (must NOT be hijacked) ═════════════

await test("F · legitimate result follow-up · P0.3 preservation",
  "'tell me more about the first one' must still resolve to first hotel",
  [
    { msg: "find me a hotel in Yogyakarta" },
    { msg: "tell me more about the first one" },
  ]);

await test("G · legitimate provenance follow-up · Milestone A preservation",
  "'where you find them' must still produce provenance answer",
  [
    { msg: "find me a hotel in Yogyakarta" },
    { msg: "where you find them" },
  ]);

await test("H · legitimate result-question · 'which is closest?'",
  "hotel-result question · NOT gated",
  [
    { msg: "find me hotels" },
    { msg: "which is closest?" },
  ]);

// ═════════════ REVERSE ORDER · new hotel task after social ═════════════

await test("I · reverse · social opener then hotel task",
  "T1 social greeting · T2 hotel search must still succeed",
  [
    { msg: "how are you?" },
    { msg: "find me hotels near Malioboro" },
  ]);

// ═════════════ INDONESIAN ═════════════

await test("J · Indonesian gratitude after hotel search",
  "'terima kasih banyak' after hotel · must be GRATITUDE",
  [
    { msg: "cari hotel murah di Yogyakarta" },
    { msg: "terima kasih banyak" },
  ]);

await test("K · Indonesian personal-context statement",
  "'saya di Bandung' must be PERSONAL_CONTEXT_STATEMENT",
  [
    { msg: "cari hotel" },
    { msg: "saya di Bandung" },
  ]);

await test("L · Indonesian social opener",
  "'selamat pagi' must be SOCIAL_UTTERANCE",
  [{ msg: "selamat pagi" }]);

// ═════════════ NON-REGRESSION · standalone gated functions ═════════════

await test("M · standalone gratitude (no prior context)",
  "'thanks' as first turn · natural social reply",
  [{ msg: "thanks" }]);

await test("N · standalone personal-context-offer",
  "'do you want to know where I am' as first turn · offer accepted naturally",
  [{ msg: "do you want to know where i am" }]);

// ═════════════ P0.4 preservation ═════════════

await test("O · P0.4 fresh 'the first hotel'",
  "boundary reply · ordinal_gate_fired=true · NOT hijacked",
  [{ msg: "Tell me about the first hotel." }]);

// ═════════════ G24 preservation ═════════════

await test("P · G24 · seafood in Japan · still blocked",
  "scope gate must still emit boundary · NOT hijacked by conv_function",
  [{ msg: "tell me about seafood in Japan" }]);

writeFileSync(path.join(here, "_conversational_function_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_conversational_function_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
