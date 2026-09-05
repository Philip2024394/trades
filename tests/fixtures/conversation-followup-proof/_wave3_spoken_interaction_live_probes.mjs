// Wave 3 · Spoken Interaction & Voice Intelligence · live HTTP probes.
// Philip 2026-09-06 · AUTHORIZE · WAVE 3
//
// Twelve campaigns per §20 A-L plus preservation matrix per §22.

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = "http://localhost:3008/api/nex-conv/chat";

async function post(convId, message, opts = {}) {
  try {
    const r = await fetch(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: convId,
        message,
        market: opts.market || "ID",
        voice: opts.voice === true,
      }),
    });
    return await r.json();
  } catch (err) { return { error: String(err) }; }
}

function digest(j) {
  const cm = j.composition_meta || {};
  return {
    reply: (j.reply || "").slice(0, 320),
    intent: j.intent,
    // Wave 3 · STT normalization
    stt_normalized: cm.stt_normalized,
    stt_changed: cm.stt_changed,
    stt_confidence: cm.stt_confidence,
    stt_markers: cm.stt_markers,
    stt_self_correction: cm.stt_self_correction,
    stt_self_correction_kept: cm.stt_self_correction_kept,
    stt_self_correction_rejected: cm.stt_self_correction_rejected,
    stt_code_switch: cm.stt_code_switch,
    stt_languages_seen: cm.stt_languages_seen,
    // Wave 3 · social/emotional
    social_emotional_act: cm.social_emotional_act,
    social_emotional_emotion: cm.social_emotional_emotion,
    social_emotional_gate_fired: cm.social_emotional_gate_fired,
    social_emotional_task_fragment: cm.social_emotional_task_fragment,
    // Wave 3 · voice compression
    voice_compression_requested: cm.voice_compression_requested,
    voice_compression_applied: cm.voice_compression_applied,
    voice_compression_reduction_pct: cm.voice_compression_reduction_pct,
    voice_compression_meaning_preserved: cm.voice_compression_meaning_preserved,
    voice_compressed_reply: cm.voice_compressed_reply,
    // Preservation observability
    active_language: cm.active_language,
    conv_function_detected: cm.conv_function_detected,
    conv_function_gate_fired: cm.conv_function_gate_fired,
    confirmation_form: cm.confirmation_form,
    confirmation_gate_fired: cm.confirmation_gate_fired,
    temporal_gate_fired: cm.temporal_gate_fired,
    quantity_gate_fired: cm.quantity_gate_fired,
    semantic_gate_fired: cm.semantic_gate_fired,
    spatial_gate_fired: cm.spatial_gate_fired,
    frame_gate_fired: cm.frame_gate_fired,
    frame_transition: cm.frame_transition,
    frame_active_domain: cm.frame_active_domain,
    capability_display_act: cm.capability_display_act,
    capability_display_gate_fired: cm.capability_display_gate_fired,
    capability_kind: cm.capability_kind,
    capability_state: cm.capability_state,
    display_entities_count: cm.display_entities_count,
    result_followup_fired: cm.result_followup_fired,
    result_followup_reason: cm.result_followup_reason,
    scope_gate_fired: cm.scope_gate_fired,
    memory_gate_fired: cm.memory_gate_fired,
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
    const j = await post(cid, t.msg, { market: t.market || "ID", voice: t.voice === true });
    const d = digest(j);
    record.turns.push({ turn: i + 1, message: t.msg, ...d });
    console.log(`  T${i + 1} "${t.msg}"`);
    console.log(`     reply: ${JSON.stringify(d.reply?.slice(0, 200))}`);
    console.log(`     stt=${d.stt_normalized ? `"${d.stt_normalized.slice(0,60)}"` : "unchanged"} conf=${d.stt_confidence} self_corr=${d.stt_self_correction} cs=${d.stt_code_switch}`);
    console.log(`     social=${d.social_emotional_act}/${d.social_emotional_emotion} gate=${d.social_emotional_gate_fired}`);
    if (d.voice_compression_applied) console.log(`     voice_comp=${d.voice_compression_reduction_pct}%`);
    if (d.capability_display_act && d.capability_display_act !== "NONE") console.log(`     cap_act=${d.capability_display_act} gate=${d.capability_display_gate_fired}`);
    if (d.result_followup_fired) console.log(`     rf_reason=${d.result_followup_reason}`);
  }
  results.tests.push(record);
}

// ═════════════ §20 · LIVE A · Noisy hotel request ═════════════
await test("LIVE A · Noisy hotel request",
  "'find me a hotal near malioboro' + 'show me the cheep ones'",
  [
    { msg: "find me a hotal near malioboro" },
    { msg: "show me the cheep ones" },
  ]);

// ═════════════ §20 · LIVE B · Social protection ═════════════
await test("LIVE B · Social protection",
  "hotels then 'wow nice' — must NOT re-run search",
  [
    { msg: "find me hotels" },
    { msg: "wow nice" },
  ]);

// ═════════════ §20 · LIVE C · Confusion ═════════════
await test("LIVE C · Confusion",
  "hotels then 'what do you mean?' — must clarify not re-emit",
  [
    { msg: "find me hotels" },
    { msg: "what do you mean?" },
  ]);

// ═════════════ §20 · LIVE D · Spoken correction ═════════════
await test("LIVE D · Spoken correction",
  "hotels then 'no actually restaurants' — topic shift to restaurants",
  [
    { msg: "find me hotels" },
    { msg: "no actually restaurants" },
  ]);

// ═════════════ §20 · LIVE E · Spoken negation ═════════════
await test("LIVE E · Spoken negation",
  "hotels then 'nah I dont want the first one' — G12 result rejection",
  [
    { msg: "find me hotels" },
    { msg: "nah I dont want the first one" },
  ]);

// ═════════════ §20 · LIVE F · Spoken confirmation ═════════════
await test("LIVE F · Spoken confirmation",
  "show first hotel then 'yeah thats the one' — G15 confirmation",
  [
    { msg: "show me the first hotel" },
    { msg: "yeah thats the one" },
  ]);

// ═════════════ §20 · LIVE G · Social + task ═════════════
await test("LIVE G · Social + task",
  "hotels then 'nice, now show me the second one' — both survive",
  [
    { msg: "find me hotels" },
    { msg: "nice, now show me the second one" },
  ]);

// ═════════════ §20 · LIVE H · Spoken ellipsis ═════════════
await test("LIVE H · Spoken ellipsis",
  "hotels → cheaper → closer → two more (Wave 1/2 preservation)",
  [
    { msg: "find me hotels" },
    { msg: "cheaper" },
    { msg: "closer" },
    { msg: "two more" },
  ]);

// ═════════════ §20 · LIVE I · Indonesian ═════════════
await test("LIVE I · Indonesian spoken forms",
  "cari hotel → nggak mau yang pertama → bukan hotel, restoran → mantap → serius?",
  [
    { msg: "cari hotel di Yogyakarta" },
    { msg: "nggak mau yang pertama" },
    { msg: "bukan hotel, restoran" },
    { msg: "mantap" },
  ]);

// ═════════════ §20 · LIVE J · Code-switch ═════════════
await test("LIVE J · Code-switch (no language change)",
  "'find me a hotel yang murah' — semantic understanding without switching language",
  [
    { msg: "find me a hotel yang murah" },
  ]);

// ═════════════ §20 · LIVE K · Incomplete speech ═════════════
await test("LIVE K · Incomplete speech",
  "'find me something…' fresh conv — clarify not fabricate",
  [
    { msg: "find me something..." },
  ]);

// ═════════════ §20 · LIVE L · Confusion after provenance ═════════════
await test("LIVE L · Full observed-failure sequence",
  "hotels → provenance → capability clarification → display",
  [
    { msg: "have you got hotels" },
    { msg: "where did you find them" },
    { msg: "what do you mean I can't book" },
    { msg: "ok lets see them" },
  ]);

// ═════════════ VOICE COMPRESSION EVIDENCE ═════════════
await test("VOICE COMP · Semantic preservation with voice:true",
  "provenance reply compressed for voice · must preserve OpenStreetMap + directory",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?", voice: true },
  ]);

await test("VOICE COMP · Capability clarification compressed for voice",
  "must preserve 'don't have verified booking access' + 'can't confirm'",
  [
    { msg: "find me hotels" },
    { msg: "can I book?", voice: true },
  ]);

// ═════════════ §22 · PRESERVATION MATRIX ═════════════

await test("PRESERVE · G12 · 'I don't want a hotel'",
  "negated request",
  [{ msg: "I don't want a hotel" }]);

await test("PRESERVE · G15 · fresh 'yes'",
  "no target → clarify",
  [{ msg: "yes" }]);

await test("PRESERVE · G23 · user-fact + memory question",
  "still writes fact + reads back",
  [
    { msg: "I run a restaurant" },
    { msg: "What do you know about my business?" },
  ]);

await test("PRESERVE · G24 · scope-blocked",
  "'seafood in Japan' still gets honest boundary",
  [{ msg: "tell me about seafood in Japan" }]);

await test("PRESERVE · L4 · social frame reset",
  "'do you want to know where I am' still handled",
  [
    { msg: "any hotels nex" },
    { msg: "do you want to know where i am" },
  ]);

await test("PRESERVE · P0.4 · fresh 'first hotel' ordinal",
  "no fabrication",
  [{ msg: "Tell me about the first hotel." }]);

await test("PRESERVE · Wave 1 · temporal reflective",
  "reflective past preserves gate",
  [{ msg: "I was looking for hotels yesterday" }]);

await test("PRESERVE · G03 · explicit language switch",
  "still respected · code-switch does not autoswitch",
  [
    { msg: "Find me a hotel" },
    { msg: "Please answer in Indonesian" },
  ]);

await test("PRESERVE · result-followup",
  "plain provenance",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
  ]);

writeFileSync(path.join(here, "_wave3_spoken_interaction_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_wave3_spoken_interaction_live_probes.json")}`);
console.log(`Total tests: ${results.tests.length}`);
