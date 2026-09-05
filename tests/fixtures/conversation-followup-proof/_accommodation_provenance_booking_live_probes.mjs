// Accommodation Provenance + Booking Semantics + Follow-up Conversation ·
// live HTTP probes.
// Philip 2026-09-06 · AUTHORIZE · ACCOMMODATION PROVENANCE, BOOKING
// SEMANTICS & FOLLOW-UP CONVERSATION FIX
//
// Six campaigns:
//   A · Hotel provenance → clarification → display
//   B · Food provenance → clarification → display
//   C · Restaurant provenance → clarification → display
//   D · Transport provenance → clarification → display
//   E · Negation ("I don't want to book the first one")
//   F · Reference ("Where did you find that one?")

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
    // capability + display observability (this slice)
    capability_display_act: cm.capability_display_act,
    capability_display_reason: cm.capability_display_reason,
    capability_display_gate_fired: cm.capability_display_gate_fired,
    capability_kind: cm.capability_kind,
    capability_state: cm.capability_state,
    capability_display_vertical: cm.capability_display_vertical,
    display_entities_count: cm.display_entities_count,
    // downstream ordering (must be false on capability-display gate hits)
    result_followup_fired: cm.result_followup_fired,
    result_followup_reason: cm.result_followup_reason,
    // preservation observability from earlier waves
    active_language: cm.active_language,
    conv_function_detected: cm.conv_function_detected,
    conv_function_gate_fired: cm.conv_function_gate_fired,
    frame_transition: cm.frame_transition,
    frame_active_domain: cm.frame_active_domain,
    frame_gate_fired: cm.frame_gate_fired,
    scope_gate_fired: cm.scope_gate_fired,
    ordinal_gate_fired: cm.ordinal_gate_fired,
    temporal_gate_fired: cm.temporal_gate_fired,
    wave1_gate_reason: cm.wave1_gate_reason,
    wave2_gate_reason: cm.wave2_gate_reason,
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
    console.log(`     cap_act=${d.capability_display_act} gate=${d.capability_display_gate_fired} kind=${d.capability_kind} state=${d.capability_state} vertical=${d.capability_display_vertical} disp_n=${d.display_entities_count}`);
    console.log(`     rf_fired=${d.result_followup_fired} rf_reason=${d.result_followup_reason}`);
  }
  results.tests.push(record);
}

// ═════════════ CAMPAIGN A · HOTEL PROVENANCE + BOOKING + DISPLAY ═════════════
await test("LIVE A · Hotel · full flow (provenance → clarification → display)",
  "hotels → where you find them → what you mean I can't book → ok so lets see them",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "where did you find them?" },
    { msg: "what you mean i cant book" },
    { msg: "ok so lets see them" },
  ]);

// ═════════════ CAMPAIGN B · FOOD ═════════════
await test("LIVE B · Food · provenance + capability clarification + display",
  "food → provenance → capability → display",
  [
    { msg: "find me some food places in Yogyakarta" },
    { msg: "where did you find them?" },
    { msg: "can I book?" },
    { msg: "ok show me them" },
  ]);

// ═════════════ CAMPAIGN C · RESTAURANT ═════════════
await test("LIVE C · Restaurant · capability question first (no prior provenance turn)",
  "restaurants → can I book? → let's see them",
  [
    { msg: "find me restaurants near Malioboro" },
    { msg: "can I reserve?" },
    { msg: "let's see them" },
  ]);

// ═════════════ CAMPAIGN D · TRANSPORT ═════════════
await test("LIVE D · Transport · capability question",
  "transport → can I book?",
  [
    { msg: "find me some transport options in Yogyakarta" },
    { msg: "can I book?" },
    { msg: "ok show me the options" },
  ]);

// ═════════════ CAMPAIGN E · NEGATION ═════════════
// G12 preservation · negated capability with reference does NOT trigger
// a capability question or a display request. It should either flow to
// G12/existing pipeline or be handled as a normal message.
await test("LIVE E · Negation · 'I don't want to book the first one'",
  "hotels → I don't want to book the first one",
  [
    { msg: "find me hotels" },
    { msg: "I don't want to book the first one" },
  ]);

// ═════════════ CAMPAIGN F · REFERENCE ═════════════
// Reference resolution · 'that one' scoped to a single entity. Not a
// display request (singular · not the whole set). Should flow to
// existing reference-resolution / result-followup pathway.
await test("LIVE F · Reference · 'where did you find that one?'",
  "hotels → where did you find that one?",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "where did you find that one?" },
  ]);

// ═════════════ PRESERVATION ═════════════

await test("PRESERVE · plain provenance still works",
  "no capability language · standard provenance flow",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
  ]);

await test("PRESERVE · G12 negated request",
  "'I don't want a hotel' still gated by G12",
  [{ msg: "I don't want a hotel" }]);

await test("PRESERVE · L4 social",
  "'do you want to know where I am' still social-frame reset",
  [
    { msg: "any hotels nex" },
    { msg: "do you want to know where i am" },
  ]);

await test("PRESERVE · G24 scope",
  "'seafood in Japan' still scope-blocked",
  [{ msg: "tell me about seafood in Japan" }]);

await test("PRESERVE · fresh capability question no prior results",
  "'can I book?' fresh conv · honest UNKNOWN answer",
  [{ msg: "can I book?" }]);

await test("PRESERVE · fresh display request no result set",
  "'show me them' fresh conv · honest no-result reply",
  [{ msg: "show me them" }]);

writeFileSync(path.join(here, "_accommodation_provenance_booking_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_accommodation_provenance_booking_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
