// Wave 2 · Contextual Meaning & Conversational Scope · live HTTP probes.
// Philip 2026-09-06 · AUTHORIZE · WAVE 2.

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
    spatial_concept: cm.spatial_concept,
    spatial_anchor: cm.spatial_anchor,
    spatial_polarity: cm.spatial_polarity,
    spatial_is_change: cm.spatial_is_change,
    spatial_gate_fired: cm.spatial_gate_fired,
    implicit_constraint_count: cm.implicit_constraint_count,
    implicit_constraints_summary: cm.implicit_constraints_summary,
    frame_transition: cm.frame_transition,
    frame_active_domain: cm.frame_active_domain,
    frame_result_set_state: cm.frame_result_set_state,
    frame_is_elliptical: cm.frame_is_elliptical,
    frame_gate_fired: cm.frame_gate_fired,
    wave2_gate_reason: cm.wave2_gate_reason,
    // preservation
    temporal_tense: cm.temporal_tense,
    quantity_kind: cm.quantity_kind,
    semantic_intent: cm.semantic_intent,
    confirmation_form: cm.confirmation_form,
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
    console.log(`     spatial=${d.spatial_concept}/${d.spatial_anchor} impl=${d.implicit_constraints_summary} frame=${d.frame_transition}/${d.frame_active_domain} gate=${d.wave2_gate_reason}`);
  }
  results.tests.push(record);
}

// ═════════════ §25 LIVE MATRIX ═════════════

await test("LIVE A · spatial continuation",
  "hotels → closer to airport",
  [
    { msg: "find me hotels near Malioboro" },
    { msg: "closer to the airport" },
  ]);

await test("LIVE B · implicit preference",
  "restaurants → somewhere quieter",
  [
    { msg: "find me restaurants" },
    { msg: "somewhere quieter" },
  ]);

await test("LIVE C · ellipsis chain",
  "hotels → cheaper → closer → two more",
  [
    { msg: "find me hotels" },
    { msg: "cheaper" },
    { msg: "closer" },
    { msg: "two more" },
  ]);

await test("LIVE D · topic shift",
  "hotels → restaurants → which is closest?",
  [
    { msg: "find me hotels" },
    { msg: "actually find me restaurants" },
    { msg: "which is closest?" },
  ]);

await test("LIVE E · contrastive update",
  "hotels near Malioboro → no, near the airport",
  [
    { msg: "find me hotels near Malioboro" },
    { msg: "no, near the airport" },
  ]);

await test("LIVE F · G04 reference + spatial",
  "hotels → is the first one closer to the airport?",
  [
    { msg: "find me hotels near Malioboro" },
    { msg: "is the first one closer to the airport?" },
  ]);

await test("LIVE G · G12 negated spatial",
  "hotels → I don't want anything near the airport",
  [
    { msg: "find me hotels" },
    { msg: "I don't want anything near the airport" },
  ]);

await test("LIVE H.1 · fresh deictic without antecedent",
  "'find something there' fresh conv · gate fires",
  [{ msg: "find something there" }]);

await test("LIVE H.2 · fresh ellipsis without result set",
  "'cheaper' fresh · gate fires clarification",
  [{ msg: "cheaper" }]);

await test("LIVE I · Indonesian spatial + implicit",
  "cari hotel → yang lebih tenang dekat bandara",
  [
    { msg: "cari hotel di Yogyakarta" },
    { msg: "yang lebih tenang dekat bandara" },
  ]);

await test("LIVE J · complete new request breaks ellipsis",
  "'what is the cheapest phone in Indonesia' after hotels · topic-shift",
  [
    { msg: "find me hotels" },
    { msg: "what is the cheapest phone in Indonesia?" },
  ]);

await test("LIVE K · evidence boundary · qualitative constraint",
  "hotels → somewhere quiet · attribute unsupported by data",
  [
    { msg: "find me hotels" },
    { msg: "somewhere quiet" },
  ]);

// ═════════════ PRESERVATION ═════════════

await test("PRESERVE · G15 fresh yes",
  "no target · clarify",
  [{ msg: "yes" }]);

await test("PRESERVE · G12 · I don't want a hotel",
  "NEGATED_REQUEST",
  [{ msg: "I don't want a hotel" }]);

await test("PRESERVE · G23 · restaurant recall",
  "user-fact memory intact",
  [
    { msg: "I run a restaurant" },
    { msg: "What do you know about my business?" },
  ]);

await test("PRESERVE · G24 · Japan seafood",
  "scope boundary intact",
  [{ msg: "tell me about seafood in Japan" }]);

await test("PRESERVE · L4 · social frame reset",
  "do you want to know where i am",
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

await test("PRESERVE · G03 · Indonesian continuity",
  "explicit switch intact",
  [
    { msg: "Find me a hotel" },
    { msg: "Please answer in Indonesian" },
  ]);

await test("PRESERVE · Wave 1 · temporal reflective",
  "reflective past · gate intact",
  [{ msg: "I was looking for hotels yesterday" }]);

writeFileSync(path.join(here, "_wave2_contextual_meaning_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_wave2_contextual_meaning_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
