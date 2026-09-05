// G03 · Language Stability & Reply-Language Continuity · live HTTP probes.
// Philip 2026-09-06 · AUTHORIZE G03 · §24 test matrix + §25 adversarial + §26 Live A-E.

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
    reply: (j.reply || "").slice(0, 260),
    voice_en: (j.voice_reply?.en || "").slice(0, 160),
    intent: j.intent,
    world_cards_count: j.world_cards?.count ?? j.world_cards?.cards?.length ?? 0,
    active_language: cm.active_language,
    detected_language: cm.detected_language_this_turn,
    language_source: cm.language_source,
    language_switch_gate_fired: cm.language_switch_gate_fired,
    language_switched_from: cm.language_switched_from,
    language_switched_to: cm.language_switched_to,
    output_language_verification: cm.output_language_verification,
    output_language_dominant: cm.output_language_dominant,
    output_language_matches: cm.output_language_matches,
    conv_function_detected: cm.conv_function_detected,
    conv_function_gate_fired: cm.conv_function_gate_fired,
    memory_gate_fired: cm.memory_gate_fired,
    scope_gate_fired: cm.scope_gate_fired,
    result_followup_fired: cm.result_followup_fired,
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
    console.log(`     active=${d.active_language} det=${d.detected_language} src=${d.language_source} switch=${d.language_switch_gate_fired} verify=${d.output_language_verification}/${d.output_language_dominant}`);
  }
  results.tests.push(record);
}

// ═════════════ §26 LIVE MATRIX ═════════════

await test("§26 Live A · English continuity",
  "T1-T3 all English · active_language stays EN across turns",
  [
    { msg: "Find me a hotel near Malioboro" },
    { msg: "Tell me about the first one" },
    { msg: "Does it have parking?" },
  ]);

await test("§26 Live B · Indonesian continuity",
  "T1-T3 all Indonesian · active_language stays ID across turns",
  [
    { msg: "Carikan hotel dekat Malioboro" },
    { msg: "Yang pertama bagaimana?" },
    { msg: "Ada parkir?" },
  ]);

await test("§26 Live C · explicit EN → ID switch",
  "T2 explicit switch · T3 stays ID",
  [
    { msg: "Find me a hotel" },
    { msg: "Please answer in Indonesian" },
    { msg: "Tell me about the first one" },
  ]);

await test("§26 Live D · explicit ID → EN switch back",
  "After ID conv, switch back to English",
  [
    { msg: "Carikan hotel dekat Malioboro" },
    { msg: "Yang pertama bagaimana?" },
    { msg: "Now switch back to English" },
    { msg: "What about the second one?" },
  ]);

await test("§26 Live E · translation isolation",
  "Translation request does NOT change active language",
  [
    { msg: "Let's speak English" },
    { msg: "Translate \"Selamat pagi\" into Indonesian" },
    { msg: "Which hotel is closest?" },
  ]);

// ═════════════ §24 REQUIRED MATRIX ═════════════

await test("§24 short ambiguous · inherits ID",
  "Carikan then 'Ok' then 'Yang pertama bagaimana?' · stays ID",
  [
    { msg: "Carikan hotel" },
    { msg: "Ok" },
    { msg: "Yang pertama bagaimana?" },
  ]);

await test("§24 social utterance · preserves ID",
  "Carikan then 'Wah bagus' then 'Yang kedua bagaimana?' · stays ID",
  [
    { msg: "Carikan hotel" },
    { msg: "Wah bagus" },
    { msg: "Yang kedua bagaimana?" },
  ]);

// ═════════════ §25 ADVERSARIAL ═════════════

await test("§25 capability question · MUST NOT switch",
  "'Can you speak Indonesian?' after English conv · active stays EN",
  [
    { msg: "Find me hotels" },
    { msg: "Can you speak Indonesian?" },
    { msg: "Tell me about the first one" },
  ]);

await test("§25 speak imperative · switches",
  "'Speak Indonesian' after English conv · active switches to ID",
  [
    { msg: "Find me hotels" },
    { msg: "Speak Indonesian" },
    { msg: "Yang pertama bagaimana?" },
  ]);

await test("§25 code-switch stays ID",
  "'Saya mau hotel yang cheap' after ID conv · stays ID",
  [
    { msg: "Carikan hotel" },
    { msg: "Saya mau hotel yang cheap" },
  ]);

await test("§25 code-switch stays EN",
  "'I need a hotel dekat Malioboro' after EN conv · stays EN",
  [
    { msg: "Find hotels" },
    { msg: "I need a hotel dekat Malioboro" },
  ]);

// ═════════════ PRESERVATION ═════════════

await test("PRESERVE · G12 · 'I don't want a hotel'",
  "NEGATED_REQUEST still gates · G03 doesn't interfere",
  [{ msg: "I don't want a hotel" }]);

await test("PRESERVE · G23 · run restaurant + recall",
  "user-fact memory intact",
  [
    { msg: "I run a restaurant" },
    { msg: "What do you know about my business?" },
  ]);

await test("PRESERVE · G24 · seafood in Japan blocked",
  "scope-gate intact",
  [{ msg: "tell me about seafood in Japan" }]);

await test("PRESERVE · L4 · social frame reset",
  "'do you want to know where i am' still gates",
  [
    { msg: "any hotels nex" },
    { msg: "do you want to know where i am" },
  ]);

await test("PRESERVE · P0.4 · fresh 'the first hotel'",
  "ordinal-boundary intact",
  [{ msg: "Tell me about the first hotel." }]);

await test("PRESERVE · result-followup provenance",
  "Milestone A intact",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
  ]);

writeFileSync(path.join(here, "_g03_language_stability_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_g03_language_stability_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
