// G15 · Confirmation & Yes/No Intelligence · live HTTP probes.
// Philip 2026-09-06 · AUTHORIZE G15 · §19 §20 scenarios.

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
    reply: (j.reply || "").slice(0, 260),
    intent: j.intent,
    world_cards_count: j.world_cards?.count ?? j.world_cards?.cards?.length ?? 0,
    active_language: cm.active_language,
    confirmation_form: cm.confirmation_form,
    confirmation_resolution: cm.confirmation_resolution,
    confirmation_active_proposition: cm.confirmation_active_proposition,
    confirmation_gate_fired: cm.confirmation_gate_fired,
    confirmation_gate_reason: cm.confirmation_gate_reason,
    conv_function_detected: cm.conv_function_detected,
    conv_function_gate_fired: cm.conv_function_gate_fired,
    scope_gate_fired: cm.scope_gate_fired,
    result_followup_fired: cm.result_followup_fired,
    memory_gate_fired: cm.memory_gate_fired,
    ordinal_gate_fired: cm.ordinal_gate_fired,
    language_switch_gate_fired: cm.language_switch_gate_fired,
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
    console.log(`     form=${d.confirmation_form} res=${d.confirmation_resolution} prop=${d.confirmation_active_proposition} gate=${d.confirmation_gate_fired}`);
  }
  results.tests.push(record);
}

// ═════════════ §20 REQUIRED LIVE SCENARIOS ═════════════

await test("A · standalone 'yes' on fresh conv · MUST NOT execute",
  "no active proposition · gate clarifies",
  [{ msg: "yes" }]);

await test("B · standalone 'no' on fresh conv · MUST NOT interpret as global cancel",
  "no active proposition · gate acknowledges",
  [{ msg: "no" }]);

await test("C · 'no thanks' after NEX result · social protection",
  "SOCIAL detection · no action executed",
  [
    { msg: "find me hotels" },
    { msg: "no thanks" },
  ]);

await test("D · 'thanks' after NEX result · social protection",
  "SOCIAL · brief natural ack",
  [
    { msg: "find me hotels" },
    { msg: "thanks" },
  ]);

await test("E · 'okay' as social ack after informational reply",
  "must NOT launch a new hotel search",
  [
    { msg: "what is Yogyakarta?" },
    { msg: "okay" },
  ]);

await test("F · CORRECTIVE 'no, restaurant' after hotels",
  "gate surfaces target · does not launch new hotel search",
  [
    { msg: "find me hotels" },
    { msg: "no, restaurant" },
  ]);

await test("G · QUALIFIED 'yes but not expensive'",
  "affirm + qualifier",
  [
    { msg: "find me hotels" },
    { msg: "yes but not expensive" },
  ]);

await test("H · UNCERTAIN 'I think so'",
  "uncertain · clarify",
  [
    { msg: "find me hotels" },
    { msg: "I think so" },
  ]);

// ═════════════ INDONESIAN ═════════════

await test("I · Indonesian 'iya' on fresh conv",
  "ID · no target · Indonesian clarification",
  [{ msg: "iya" }]);

await test("J · Indonesian 'tidak, restoran' corrective",
  "ID CORRECTIVE",
  [
    { msg: "cari hotel" },
    { msg: "tidak, restoran" },
  ]);

await test("K · Indonesian 'terima kasih'",
  "ID SOCIAL",
  [
    { msg: "cari hotel" },
    { msg: "terima kasih" },
  ]);

// ═════════════ NON-CONFIRMATIONS (must pass through) ═════════════

await test("L · non-confirmation 'find me a hotel'",
  "gate does NOT fire",
  [{ msg: "find me a hotel" }]);

await test("M · non-confirmation 'what is Yogyakarta?'",
  "gate does NOT fire",
  [{ msg: "what is Yogyakarta?" }]);

// ═════════════ PRESERVATION ═════════════

await test("PRESERVE · G12 · 'I don't want a hotel'",
  "NEGATED_REQUEST still gates",
  [{ msg: "I don't want a hotel" }]);

await test("PRESERVE · G23 · run restaurant + recall",
  "user-fact memory intact",
  [
    { msg: "I run a restaurant" },
    { msg: "What do you know about my business?" },
  ]);

await test("PRESERVE · G24 · seafood in Japan",
  "scope-gate intact",
  [{ msg: "tell me about seafood in Japan" }]);

await test("PRESERVE · G03 · Indonesian continuity",
  "explicit switch intact",
  [
    { msg: "Find me a hotel" },
    { msg: "Please answer in Indonesian" },
    { msg: "Tell me more" },
  ]);

await test("PRESERVE · L4 · social frame reset",
  "'do you want to know where i am' still gates",
  [
    { msg: "any hotels nex" },
    { msg: "do you want to know where i am" },
  ]);

await test("PRESERVE · P0.4 · fresh 'the first hotel'",
  "ordinal boundary intact",
  [{ msg: "Tell me about the first hotel." }]);

await test("PRESERVE · result-followup",
  "provenance answer intact",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
  ]);

writeFileSync(path.join(here, "_g15_confirmation_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_g15_confirmation_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
