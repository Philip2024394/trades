// G24 · Scope-Validated Evidence · live HTTP reproduction.
// Philip 2026-09-05 · AUTHORIZE · NEX G24
//
// Reproduces the two known fabrication pathways plus the required
// non-regression corpus.

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
    reply: (j.reply || "").slice(0, 350),
    voice_en: (j.voice_reply?.en || "").slice(0, 250),
    intent: j.intent,
    voice_intent: j.voice_reply?.intent,
    world_cards_count: j.world_cards?.count ?? j.world_cards?.cards?.length ?? 0,
    composition_ran: cm.ran,
    composition_accepted: cm.accepted,
    composition_reason: cm.reason,
    composition_knowledge_count: cm.knowledge_count,
    scope_validation_status: cm.scope_validation_status,
    scope_validation_reason: cm.scope_validation_reason,
    scope_covered_anchors: cm.scope_covered_anchors,
    scope_missing_anchors: cm.scope_missing_anchors,
    scope_gate_fired: cm.scope_gate_fired,
    ordinal_gate_fired: cm.ordinal_gate_fired,
    result_followup_fired: cm.result_followup_fired,
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
    console.log(`  T${i + 1} ${JSON.stringify(t.msg)}`);
    console.log(`     reply: ${JSON.stringify(d.reply?.slice(0, 200))}`);
    console.log(`     scope: status=${d.scope_validation_status} gate=${d.scope_gate_fired} k=${d.composition_knowledge_count} covered=${JSON.stringify(d.scope_covered_anchors)} missing=${JSON.stringify(d.scope_missing_anchors)}`);
  }
  results.tests.push(record);
}

// ─── TEST A · known regression: seafood in Japan ────────────────
await test("A · seafood/Japan · known fabrication pathway",
  "MUST NOT emit unsupported Japanese seafood facts",
  [{ msg: "tell me about seafood in Japan" }]);

// ─── TEST B · known regression: Michelin in Semarang ────────────
await test("B · Michelin/Semarang · known fabrication pathway",
  "MUST NOT fabricate a specific Michelin restaurant name",
  [{ msg: "recommend a Michelin restaurant in Semarang" }]);

// ─── TEST C · Genuine evidence (non-regression) ─────────────────
await test("C.1 · genuine evidence · Yogyakarta",
  "SUPPORTED · substantive grounded answer must remain",
  [{ msg: "what is Yogyakarta?" }]);

await test("C.2 · genuine evidence · Bandung population",
  "SUPPORTED · grounded population number must remain",
  [{ msg: "what is the population of Bandung?" }]);

await test("C.3 · genuine evidence · flights Jakarta-Bali",
  "SUPPORTED · both anchors covered",
  [{ msg: "flights from Jakarta to Bali" }]);

// ─── TEST D · Partial-scope ─────────────────────────────────────
await test("D · partial scope · Michelin in Yogyakarta",
  "PARTIALLY_SUPPORTED · honest boundary acknowledging missing Michelin",
  [{ msg: "recommend a Michelin restaurant in Yogyakarta" }]);

// ─── TEST E · Existing zero-evidence protection ─────────────────
await test("E.1 · zero-evidence retention · tuna/Japan (P0 case)",
  "Existing honest-boundary must remain",
  [{ msg: "tell me about tuna exports from Japan" }]);

await test("E.2 · zero-evidence · weather (temporal-unknown)",
  "Existing weather honest-boundary must remain",
  [{ msg: "what's the weather in Yogyakarta right now?" }]);

// ─── TEST F · Adversarial matrix (varying dimension) ────────────
await test("F.1 · adversarial geography · Tokyo",
  "IRRELEVANT · retrieval about Indonesia cannot license Tokyo answer",
  [{ msg: "what should I do in Tokyo?" }]);

await test("F.2 · adversarial brand · Marriott",
  "IRRELEVANT · no Marriott records",
  [{ msg: "which Marriott properties are near Malioboro?" }]);

await test("F.3 · adversarial entity · fictional place",
  "IRRELEVANT · no such place in NEX data",
  [{ msg: "tell me about Vondelpark in Amsterdam" }]);

// ─── TEST G · P0.3 preservation (hotel resolved-reference) ──────
await test("G · P0.3 preserved · ordinal after hotel search",
  "T2 must resolve to Gaotama Hotel · T1 hotel search must succeed",
  [
    { msg: "find me a hotel in Yogyakarta" },
    { msg: "tell me more about the first one" },
  ]);

// ─── TEST H · P0.4 preservation (fresh-conv ordinal) ────────────
await test("H · P0.4 preserved · fresh 'the first hotel'",
  "Boundary reply · ordinal_gate_fired=true",
  [{ msg: "Tell me about the first hotel." }]);

// ─── TEST I · Result-followup preservation ──────────────────────
await test("I · result-followup preserved · 'where you find them'",
  "Provenance answer after hotel search",
  [
    { msg: "find me a hotel in Yogyakarta" },
    { msg: "where you find them" },
  ]);

// ─── TEST J · broad questions (no anchors) must not gate ────────
await test("J.1 · broad question · no place anchor",
  "SUPPORTED (no anchors to validate) · normal reply",
  [{ msg: "how much does a hotel cost?" }]);

await test("J.2 · broad social · no anchor",
  "SUPPORTED · social greeting",
  [{ msg: "hi there" }]);

writeFileSync(path.join(here, "_g24_live_reproduction.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_g24_live_reproduction.json")}`);
console.log(`Total tests: ${results.tests.length}`);
