// Wave 1 · Conversational Semantic Control · live HTTP probes.
// Philip 2026-09-06 · AUTHORIZE.

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
    temporal_tense: cm.temporal_tense,
    temporal_entity: cm.temporal_entity,
    temporal_gate_fired: cm.temporal_gate_fired,
    quantity_kind: cm.quantity_kind,
    quantity_value: cm.quantity_value,
    quantity_gate_fired: cm.quantity_gate_fired,
    semantic_intent: cm.semantic_intent,
    semantic_attribute: cm.semantic_attribute,
    semantic_direction: cm.semantic_direction,
    semantic_count: cm.semantic_count,
    semantic_gate_fired: cm.semantic_gate_fired,
    wave1_gate_reason: cm.wave1_gate_reason,
    confirmation_form: cm.confirmation_form,
    confirmation_gate_fired: cm.confirmation_gate_fired,
    conv_function_detected: cm.conv_function_detected,
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
    console.log(`     tense=${d.temporal_tense} qty=${d.quantity_kind}/${d.quantity_value} sem=${d.semantic_intent}/${d.semantic_attribute} gate=${d.wave1_gate_reason}`);
  }
  results.tests.push(record);
}

// ═════════════ LIVE A · Temporal conversation ═════════════
await test("LIVE A · temporal chain",
  "past → completed → not_yet · reflective tenses gate safely",
  [
    { msg: "I was looking for hotels yesterday" },
    { msg: "I already found one" },
    { msg: "I haven't found a restaurant yet" },
  ]);

// ═════════════ LIVE B · Quantity ═════════════
await test("LIVE B · quantity",
  "search → quantity constraint · incremental",
  [
    { msg: "find me hotels" },
    { msg: "show me two more" },
  ]);

await test("LIVE B.2 · fresh incremental → clarify",
  "'two more' with no result set gates",
  [{ msg: "show me two more" }]);

// ═════════════ LIVE C · Ranking ═════════════
await test("LIVE C · ranking · fresh cheapest → clarify",
  "'What's the cheapest?' fresh conv gates",
  [{ msg: "What's the cheapest?" }]);

await test("LIVE C.2 · ranking after result set",
  "cheapest passes through when there IS a result set",
  [
    { msg: "find me hotels near Malioboro" },
    { msg: "which is the cheapest?" },
  ]);

// ═════════════ LIVE D · Comparison ═════════════
await test("LIVE D · comparison fresh → clarify",
  "'which is cheaper?' fresh conv gates",
  [{ msg: "which is cheaper?" }]);

// ═════════════ LIVE E · G12 (negation + ranking) ═════════════
await test("LIVE E · G12 preservation + ranking exclusion",
  "'I don't want the most expensive one' after hotels · G12 owns polarity",
  [
    { msg: "find me hotels" },
    { msg: "I don't want the most expensive one" },
  ]);

// ═════════════ LIVE F · G04 (reference + ranking) ═════════════
await test("LIVE F · G04 · reference + ranking",
  "'Is the first one closer?' comparative on reference",
  [
    { msg: "find me hotels near Malioboro" },
    { msg: "Is the first one closer?" },
  ]);

// ═════════════ LIVE G · G15 (confirmation + quantity) ═════════════
await test("LIVE G · G15 + quantity · yes to expand",
  "hotels → 'yes' → CONFIRMED (composer-handled) · G15 does not gate CONFIRMED with prop",
  [
    { msg: "find me hotels" },
    { msg: "show me two more" },
  ]);

// ═════════════ LIVE H · Indonesian ═════════════
await test("LIVE H · Indonesian · full semantic chain",
  "carikan hotel → dua lagi → yang paling murah",
  [
    { msg: "carikan hotel di Yogyakarta" },
    { msg: "dua lagi" },
    { msg: "yang paling murah" },
  ]);

// ═════════════ LIVE I · Combined ═════════════
await test("LIVE I · combined · temporal + quantity + reference + confirmation",
  "5-turn chain",
  [
    { msg: "find hotels near Malioboro" },
    { msg: "show me the three cheapest" },
    { msg: "is the first one closer?" },
    { msg: "yes" },
    { msg: "show me two more" },
  ]);

// ═════════════ LIVE J · Evidence boundary ═════════════
await test("LIVE J · evidence boundary · attribute missing",
  "OpenStreetMap listings lack facility data · 'which is cheapest?' should NOT fabricate",
  [
    { msg: "find me hotels" },
    { msg: "which is the cheapest?" },
  ]);

// ═════════════ PRESERVATION ═════════════
await test("PRESERVE · G12",
  "'I don't want a hotel' NEGATED_REQUEST",
  [{ msg: "I don't want a hotel" }]);

await test("PRESERVE · G23",
  "user-fact recall",
  [
    { msg: "I run a restaurant" },
    { msg: "What do you know about my business?" },
  ]);

await test("PRESERVE · G24",
  "seafood in Japan · scope gate",
  [{ msg: "tell me about seafood in Japan" }]);

await test("PRESERVE · L4",
  "social frame reset",
  [
    { msg: "any hotels nex" },
    { msg: "do you want to know where i am" },
  ]);

await test("PRESERVE · P0.4",
  "fresh 'the first hotel' boundary",
  [{ msg: "Tell me about the first hotel." }]);

await test("PRESERVE · result-followup",
  "provenance answer intact",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
  ]);

await test("PRESERVE · G15",
  "confirmation gate preserved · fresh 'yes'",
  [{ msg: "yes" }]);

await test("PRESERVE · G03",
  "language stability",
  [
    { msg: "Find me a hotel" },
    { msg: "Please answer in Indonesian" },
  ]);

writeFileSync(path.join(here, "_wave1_semantic_control_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_wave1_semantic_control_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
