// L4 · Dialogue-Act Classification & Conversational Frame Reset · live probes.
// Philip 2026-09-06 · AUTHORIZE L4 · covers §20 CASE A-H + §21 adversarial matrix.

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
    console.log(`     reply: ${JSON.stringify(d.reply?.slice(0, 180))}`);
    console.log(`     cf=${d.conv_function_detected} gate=${d.conv_function_gate_fired} intent=${d.intent} wc=${d.world_cards_count}`);
  }
  results.tests.push(record);
}

// ═════════════ §20 CASE MATRIX ═════════════

await test("CASE A · NEW OFFER · exact regression",
  "T2 personal-context-offer must not reuse hotel list",
  [{ msg: "any hotels nex" }, { msg: "do you want to know where i am" }]);

await test("CASE B · SOCIAL · I love this place (G07)",
  "T2 emotional-expression must not launch hotel search",
  [{ msg: "find me hotels" }, { msg: "I love this place" }]);

await test("CASE C · GRATITUDE · thanks nex (G19)",
  "T2 gratitude must produce natural gratitude reply",
  [{ msg: "find me hotels" }, { msg: "thanks nex" }]);

await test("CASE D · DECLARATIVE · there are hotels here (G14)",
  "T2 assertion must not re-emit hotel list",
  [{ msg: "find me hotels" }, { msg: "there are hotels here" }]);

await test("CASE E · TOPIC SHIFT · restaurants",
  "T2 topic-shift · restaurants LLM composition remains functional",
  [{ msg: "find me hotels" }, { msg: "actually, what about restaurants?" }]);

await test("CASE F · CORRECTION · no I meant restaurants",
  "T2 correction gates with natural clarifier",
  [{ msg: "find me hotels" }, { msg: "no, I meant restaurants" }]);

await test("CASE G · VALID RESULT FOLLOW-UP · first one",
  "T2 legitimate ordinal continuation · resolves to first hotel",
  [{ msg: "find me hotels near Malioboro" }, { msg: "tell me more about the first one" }]);

await test("CASE H · RESULT PROVENANCE",
  "T2 delegated to result-followup gate · provenance answer",
  [{ msg: "find me hotels" }, { msg: "where did you find them?" }]);

// ═════════════ §21 ADVERSARIAL ═════════════

await test("ADV 1 · can I tell you something",
  "personal-context-offer variant",
  [{ msg: "find me hotels" }, { msg: "can I tell you something?" }]);

await test("ADV 2 · let me explain",
  "should be OFFER · not hotel search",
  [{ msg: "find me hotels" }, { msg: "let me explain" }]);

await test("ADV 3 · actually forget that",
  "topic-shift · abandonment-detector handles",
  [{ msg: "find me hotels" }, { msg: "actually forget that" }]);

await test("ADV 4 · I'm in Jakarta",
  "personal-context-statement · natural ack",
  [{ msg: "find me hotels" }, { msg: "I'm in Jakarta" }]);

await test("ADV 5 · what do you think?",
  "meta / information-question · not gated",
  [{ msg: "find me hotels" }, { msg: "what do you think?" }]);

await test("ADV 6 · which one is cheapest?",
  "result-question · MUST NOT be gated · continuation",
  [{ msg: "find me hotels" }, { msg: "which one is cheapest?" }]);

await test("ADV 7 · what about the second one?",
  "result-continuation · MUST NOT be gated",
  [{ msg: "find me hotels" }, { msg: "what about the second one?" }]);

await test("ADV 8 · reverse · social then hotel",
  "T1 how are you · T2 hotel task must succeed",
  [{ msg: "how are you?" }, { msg: "find me hotels near Malioboro" }]);

await test("ADV 9 · reverse · gratitude then hotel",
  "T1 thanks · T2 hotel task must succeed",
  [{ msg: "thanks" }, { msg: "find me hotels" }]);

await test("ADV 10 · reverse · location then hotel-near-me",
  "T1 location-statement · T2 hotel task with context",
  [{ msg: "I'm in Bandung" }, { msg: "find me hotels near me" }]);

// ═════════════ INDONESIAN COVERAGE §17 ═════════════

await test("ID 1 · kamu mau tahu saya di mana",
  "ID personal-context-offer",
  [{ msg: "cari hotel" }, { msg: "kamu mau tahu saya di mana?" }]);

await test("ID 2 · terima kasih",
  "ID gratitude · Indonesian reply",
  [{ msg: "cari hotel" }, { msg: "terima kasih" }]);

await test("ID 3 · apa kabar",
  "ID social · Indonesian reply",
  [{ msg: "cari hotel" }, { msg: "apa kabar?" }]);

await test("ID 4 · sebenarnya maksud saya restoran",
  "ID correction · Indonesian reply · not hotel-list",
  [{ msg: "cari hotel" }, { msg: "sebenarnya maksud saya restoran" }]);

await test("ID 5 · di sini ada hotel",
  "ID assertion · Indonesian reply · not hotel-list",
  [{ msg: "cari hotel" }, { msg: "di sini ada hotel" }]);

// ═════════════ PRESERVATION CHECKS ═════════════

await test("PRESERVE · G24 · seafood in Japan",
  "G24 scope-gate still blocks",
  [{ msg: "tell me about seafood in Japan" }]);

await test("PRESERVE · P0.4 · fresh 'the first hotel'",
  "P0.4 ordinal-boundary still fires",
  [{ msg: "Tell me about the first hotel." }]);

await test("PRESERVE · P0.3 · hotel-ref continuity",
  "ordinal continuation resolves to first hotel",
  [
    { msg: "find me a hotel in Yogyakarta" },
    { msg: "tell me more about the first one" },
  ]);

writeFileSync(path.join(here, "_l4_dialogue_act_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_l4_dialogue_act_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
