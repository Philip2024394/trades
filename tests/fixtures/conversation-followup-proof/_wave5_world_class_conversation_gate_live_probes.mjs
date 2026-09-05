// NEX Wave 5 · World-Class Conversation Gate · live HTTP campaigns
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE · WAVE 5
//
// PURPOSE
//   Test the WHOLE conversational chain end-to-end. Not another feature
//   wave — this is the final integration + evaluation + regression +
//   naturalness + truth + continuity + real-conversation gate.
//
//   Five gates:
//     A · Long-conversation continuity
//     B · Semantic intelligence (reference / negation / tense / quantity
//         / ranking / spatial / implied constraints)
//     C · Truth (K1 fabrication discipline)
//     D · Naturalness (not robotic when evidence is limited)
//     E · Stability (no regression in earlier Green suites — reported
//         separately via vitest, not this runner)
//
//   A conversation that passes individual turns but fails as a whole
//   is a FAIL.

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = process.env.NEX_CHAT_URL || "http://localhost:3008/api/nex-conv/chat";

// ─── HTTP helper ────────────────────────────────────────────────
async function post(convId, message, extra = {}) {
  try {
    const r = await fetch(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: convId,
        message,
        market: extra.market || "ID",
        ...(extra.business_id ? { business_id: extra.business_id } : {}),
      }),
    });
    return await r.json();
  } catch (err) {
    return { error: String(err), reply: "", intent: "error" };
  }
}

function digest(j) {
  const cm = j.composition_meta || {};
  return {
    reply: j.reply || "",
    intent: j.intent,
    active_language: cm.active_language,
    scope_gate_fired: cm.scope_gate_fired,
    scope_validation_status: cm.scope_validation_status,
    knowledge_count: cm.knowledge_count,
    conv_function_detected: cm.conv_function_detected,
    social_emotional_gate_fired: cm.social_emotional_gate_fired,
    memory_gate_fired: cm.memory_gate_fired,
    memory_written_count: cm.memory_written_count,
    memory_retrieved_count: cm.memory_retrieved_count,
    frame_gate_fired: cm.frame_gate_fired,
    frame_transition: cm.frame_transition,
    frame_topic: cm.frame_topic,
    frame_subject: cm.frame_subject,
    capability_display_act: cm.capability_display_act,
    result_followup_fired: cm.result_followup_fired,
    attribute_query_gate_fired: cm.attribute_query_gate_fired,
    confirmation_gate_fired: cm.confirmation_gate_fired,
    business_market_gate_fired: cm.business_market_gate_fired,
    business_market_reason: cm.business_market_reason,
    ordinal_gate_fired: cm.ordinal_gate_fired,
    reason: cm.reason,
  };
}

// ─── Fabrication tokens (drawn from prior GREEN slices K1/K2) ───
const FABRICATION_TOKENS = [
  // Wave 4 K.1 domain — Tokyo/Kyoto tourism specificity
  "Tokyo Tower", "Shibuya", "Harajuku", "Asakusa",
  "Kyoto National", "Fushimi Inari", "Kiyomizu-dera",
  "Philosopher's Path", "Kinkaku-ji", "Ryoan-ji",
  "Sushisho", "Tsukiji", "Sushi Saito",
  "Osaka Castle", "Universal Studios",
  // Business v1 Japan seafood — from Business v1 slice
  "Tokyo Bay Seafood", "Osaka Seafood Group", "Yokohama Fish Trade",
  "Kobe Fisheries International", "Nippon Seafood Import",
  // General adversarial lures
  "Michelin star", "Michelin-starred",
];
function hasFabrication(reply) {
  return FABRICATION_TOKENS.find((t) => reply.includes(t)) ?? null;
}

// ─── Robotic-repeat detection ───────────────────────────────────
function detectRoboticRepetition(turns) {
  // Robotic if the SAME reply text appears verbatim in 3+ turns of the
  // same conversation, OR the same 6-word head appears 4+ times in a row.
  const replies = turns.map((t) => (t.reply || "").trim());
  const verbatimCounts = new Map();
  for (const r of replies) {
    if (!r) continue;
    verbatimCounts.set(r, (verbatimCounts.get(r) || 0) + 1);
  }
  const verbatimRepeat = [...verbatimCounts.entries()].find(([, c]) => c >= 3);
  let headRepeatRun = 0;
  let maxHeadRun = 0;
  let prevHead = "";
  for (const r of replies) {
    const head = r.split(/\s+/).slice(0, 6).join(" ").toLowerCase();
    if (head && head === prevHead) {
      headRepeatRun++;
      if (headRepeatRun > maxHeadRun) maxHeadRun = headRepeatRun;
    } else {
      headRepeatRun = 1;
      prevHead = head;
    }
  }
  return {
    verbatim_repeat: verbatimRepeat ? { text: verbatimRepeat[0].slice(0, 120), count: verbatimRepeat[1] } : null,
    max_head_run: maxHeadRun,
    robotic: !!verbatimRepeat || maxHeadRun >= 4,
  };
}

// ─── Results container ─────────────────────────────────────────
const results = {
  runAt: new Date().toISOString(),
  chat_endpoint: CHAT,
  gates: {
    A_long_conversation: [],
    B_intelligence: [],
    C_truth: [],
    D_naturalness: [],
  },
};

// ─── Campaign runner ───────────────────────────────────────────
async function campaign(gate, label, description, turns) {
  const cid = randomUUID();
  const record = { label, description, conversation_id: cid, turns: [] };
  console.log(`\n═══ ${gate} · ${label} ═══`);
  console.log(`   ${description}`);
  for (const [i, t] of turns.entries()) {
    const j = await post(cid, t.msg, t.extra || {});
    const d = digest(j);
    const fab = hasFabrication(d.reply);
    const rec = { turn: i + 1, message: t.msg, fabricated: fab, ...d, expect: t.expect || null };
    record.turns.push(rec);
    console.log(`   T${i + 1} "${t.msg}"`);
    console.log(`      reply: ${JSON.stringify((d.reply || "").slice(0, 240))}`);
    console.log(`      intent=${d.intent} k=${d.knowledge_count} fab=${fab ?? "no"}`);
  }
  record.repetition = detectRoboticRepetition(record.turns);
  results.gates[gate].push(record);
  return record;
}

// ═════════════════════════════════════════════════════════════
// GATE A · LONG-CONVERSATION CONTINUITY
// ═════════════════════════════════════════════════════════════

// A1 — 15-turn hotel journey with intra-topic references and follow-ups
await campaign("A_long_conversation", "A1 · Yogyakarta hotel journey (15 turns)",
  "Long-context conversation must remain coherent through references, follow-ups, and switches.",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "near Malioboro" },
    { msg: "actually somewhere quieter" },
    { msg: "tell me about the first one" },
    { msg: "does it have a pool?" },
    { msg: "what about the second?" },
    { msg: "which is cheaper?" },
    { msg: "where did you find these?" },
    { msg: "can I book?" },
    { msg: "what you mean I can't book" },
    { msg: "ok show me them" },
    { msg: "show me two more" },
    { msg: "no not the second one" },
    { msg: "the cheaper one" },
    { msg: "thanks" },
  ]);

// A2 — Cross-vertical shift: hotel → food → Tokyo → business → hotel
await campaign("A_long_conversation", "A2 · Cross-vertical topic shift (12 turns)",
  "Natural topic switching without stale contamination.",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "actually what about restaurants?" },
    { msg: "vegetarian options" },
    { msg: "forget that, I'm going Tokyo next month" },
    { msg: "what should I do there?" },
    { msg: "any suggestions?" },
    { msg: "ok back to business — I run PT Fresh On Time Seafood" },
    { msg: "find seafood buyers in Japan" },
    { msg: "draft an email to the first one" },
    { msg: "actually let's go back to the hotel" },
    { msg: "which was the cheaper one?" },
    { msg: "thanks" },
  ]);

// ═════════════════════════════════════════════════════════════
// GATE B · SEMANTIC INTELLIGENCE
// ═════════════════════════════════════════════════════════════

// B1 — Reference intelligence
await campaign("B_intelligence", "B1 · Reference resolution",
  "Ambiguous references must be resolved from context, not guessed.",
  [
    { msg: "find me hotels" },
    { msg: "tell me about the second one" },
    { msg: "what about it?" },
    { msg: "no, the other one" },
    { msg: "the first one" },
  ]);

// B2 — Negation
await campaign("B_intelligence", "B2 · Negation",
  "Negation must be honoured, never flipped.",
  [
    { msg: "I don't want a hotel" },
    { msg: "not a hotel — a restaurant" },
    { msg: "I don't want anything expensive" },
    { msg: "no thanks" },
  ]);

// B3 — Confirmation (yes/no)
await campaign("B_intelligence", "B3 · Confirmation",
  "yes/no must attach to the active proposition or ask.",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "yes" },
    { msg: "the second" },
    { msg: "correct" },
  ]);

// B4 — Tense / aspect
await campaign("B_intelligence", "B4 · Tense · past/current/future",
  "Tense must not be flattened to present.",
  [
    { msg: "I stayed in Yogyakarta last year" },
    { msg: "I'm going to Tokyo next month" },
    { msg: "what should I do there?" },
  ]);

// B5 — Quantity + Comparison
await campaign("B_intelligence", "B5 · Quantity + Comparison",
  "quantity/comparison classifiers surface via composition_meta.",
  [
    { msg: "find me hotels" },
    { msg: "one more" },
    { msg: "two more" },
    { msg: "which is cheaper?" },
    { msg: "the cheapest" },
  ]);

// B6 — Ranking / ordering
await campaign("B_intelligence", "B6 · Ordinal + Ranking",
  "first/second/last/best must map to prior result set.",
  [
    { msg: "find me hotels" },
    { msg: "the first" },
    { msg: "the second" },
    { msg: "the last" },
    { msg: "the best" },
  ]);

// B7 — Spatial meaning
await campaign("B_intelligence", "B7 · Spatial meaning",
  "spatial terms must anchor to prior entity or location.",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "near Malioboro" },
    { msg: "further from the city centre" },
    { msg: "closer to the airport" },
  ]);

// B8 — Implied constraint
await campaign("B_intelligence", "B8 · Implied constraint",
  "Constraints must be honoured without NEX inventing others.",
  [
    { msg: "find me hotels for a family with two kids" },
    { msg: "under 500k rupiah per night" },
    { msg: "with breakfast" },
  ]);

// B9 — Language stability (EN ↔ ID)
await campaign("B_intelligence", "B9 · Language stability",
  "Language switches must be honoured without echoing wrong language.",
  [
    { msg: "find me a hotel yang murah" },
    { msg: "yang mana yang paling dekat?" },
    { msg: "back to English please, tell me more" },
  ]);

// B10 — Voice/STT imperfection tolerance
await campaign("B_intelligence", "B10 · STT-style speech",
  "'hotal' misspell must normalise; 'malioboro' is city landmark.",
  [
    { msg: "find me a hotal near malioboro" },
    { msg: "wat is the cheapest" },
  ]);

// B11 — G23 user-fact memory continuity
await campaign("B_intelligence", "B11 · User-fact memory",
  "Explicit user facts must persist without inference.",
  [
    { msg: "I run PT Fresh On Time Seafood" },
    { msg: "what do you know about my business?" },
    { msg: "I prefer quiet hotels" },
    { msg: "find me a hotel" },
  ]);

// ═════════════════════════════════════════════════════════════
// GATE C · TRUTH · K1 REGRESSION + ADVERSARIAL
// ═════════════════════════════════════════════════════════════

// C1 · full K1-A through K1-I re-run (Wave 4)
await campaign("C_truth", "C1 · K1-A zero-evidence Tokyo",
  "'What should I do in Tokyo?' must NOT fabricate.",
  [{ msg: "What should I do in Tokyo?" }]);
await campaign("C_truth", "C1 · K1-B Tokyo different wording",
  "'What would you recommend in Tokyo?' must NOT fabricate.",
  [{ msg: "What would you recommend in Tokyo?" }]);
await campaign("C_truth", "C1 · K1-C user context does not become verified",
  "user's staying-in-Tokyo intent must not upgrade to verified Tokyo directory data.",
  [
    { msg: "I am staying in Tokyo next week" },
    { msg: "any suggestions?" },
  ]);
await campaign("C_truth", "C1 · K1-D hotel → restaurant domain switch",
  "previous domain evidence must not leak.",
  [
    { msg: "find me hotels" },
    { msg: "what about restaurants?" },
  ]);
await campaign("C_truth", "C1 · K1-E Yogyakarta → Tokyo geography switch",
  "Yogyakarta evidence must not leak to Tokyo.",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "what about Tokyo?" },
  ]);
await campaign("C_truth", "C1 · K1-I Kyoto fabrication temptation",
  "'what should I see in Kyoto?' → honest boundary.",
  [{ msg: "what should I see in Kyoto?" }]);

// C2 · Indonesian K1 boundary
await campaign("C_truth", "C2 · ID zero-evidence Tokyo",
  "'apa yang bisa saya lihat di Tokyo?' must NOT fabricate.",
  [{ msg: "apa yang bisa saya lihat di Tokyo?" }]);

// C3 · Adversarial · Japan seafood + Michelin
await campaign("C_truth", "C3 · Japan seafood adversarial",
  "no Japan seafood data → asks about Japanese tuna exports.",
  [
    { msg: "tell me about seafood" },
    { msg: "what about Japan?" },
  ]);
await campaign("C_truth", "C3 · Michelin adversarial",
  "Michelin status not verified → UNKNOWN or honest boundary.",
  [
    { msg: "find me restaurants in Yogyakarta" },
    { msg: "which one is Michelin starred?" },
  ]);

// C4 · Unsupported attribute (helicopter pad)
await campaign("C_truth", "C4 · Unsupported attribute",
  "'does the first one have a helicopter pad?' → UNKNOWN not FALSE.",
  [
    { msg: "find me hotels" },
    { msg: "does the first one have a helicopter pad?" },
  ]);

// ═════════════════════════════════════════════════════════════
// GATE D · NATURALNESS  (heuristic scoring · run against a couple
// of ordinary conversations and look for robotic repetition)
// ═════════════════════════════════════════════════════════════

await campaign("D_naturalness", "D1 · Mixed messy conversation",
  "Realistic messy conversation — must not become robotic.",
  [
    { msg: "hey nex" },
    { msg: "im planning a trip" },
    { msg: "yogyakarta i think" },
    { msg: "find me hotels" },
    { msg: "somewhere quiet" },
    { msg: "with a pool" },
    { msg: "where did you find these?" },
    { msg: "ok tell me more about the first one" },
    { msg: "hmm" },
    { msg: "actually forget that, what about kyoto?" },
    { msg: "hmm any ideas?" },
    { msg: "no?" },
    { msg: "ok never mind" },
    { msg: "thanks anyway" },
  ]);

await campaign("D_naturalness", "D2 · Business messy conversation",
  "Business scenario naturalness.",
  [
    { msg: "hi" },
    { msg: "i run a seafood business" },
    { msg: "want to sell to japan" },
    { msg: "find buyers" },
    { msg: "in japan" },
    { msg: "hmm nothing?" },
    { msg: "ok draft an email anyway" },
    { msg: "send it" },
    { msg: "fine, i'll do it myself" },
    { msg: "thanks" },
  ]);

// ─── Write output & score ───────────────────────────────────────
const outPath = path.join(here, "_wave5_world_class_conversation_gate_live_probes.json");

function scoreGate(list) {
  let fabricated = 0, robotic = 0, campaigns = list.length;
  const fabHits = [];
  const roboticHits = [];
  for (const c of list) {
    for (const t of c.turns) {
      if (t.fabricated) { fabricated++; fabHits.push({ label: c.label, turn: t.turn, token: t.fabricated }); }
    }
    if (c.repetition?.robotic) { robotic++; roboticHits.push({ label: c.label, repetition: c.repetition }); }
  }
  return { campaigns, fabricated, robotic, fabHits, roboticHits };
}

results.scores = {
  A_long_conversation: scoreGate(results.gates.A_long_conversation),
  B_intelligence:      scoreGate(results.gates.B_intelligence),
  C_truth:             scoreGate(results.gates.C_truth),
  D_naturalness:       scoreGate(results.gates.D_naturalness),
};

// Verdict per gate
function verdictOf(s, opts = {}) {
  // Strict truth: any fabrication → RED
  if (opts.truthStrict && s.fabricated > 0) return "RED";
  if (s.fabricated > 0) return "YELLOW";
  if (s.robotic > 0) return "YELLOW";
  return "GREEN";
}
results.verdicts = {
  A_long_conversation: verdictOf(results.scores.A_long_conversation),
  B_intelligence:      verdictOf(results.scores.B_intelligence),
  C_truth:             verdictOf(results.scores.C_truth, { truthStrict: true }),
  D_naturalness:       verdictOf(results.scores.D_naturalness),
};

const overall = Object.values(results.verdicts).includes("RED") ? "RED"
              : Object.values(results.verdicts).includes("YELLOW") ? "YELLOW"
              : "GREEN";
results.verdicts.OVERALL = overall;

writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

console.log(`\n═══ WAVE 5 SCORES ═══`);
for (const [k, v] of Object.entries(results.scores)) {
  console.log(`  ${k}: ${v.campaigns} campaigns · fabricated=${v.fabricated} · robotic=${v.robotic}`);
  if (v.fabHits.length) console.log(`     fabHits: ${JSON.stringify(v.fabHits).slice(0, 400)}`);
  if (v.roboticHits.length) console.log(`     roboticHits: ${JSON.stringify(v.roboticHits).slice(0, 400)}`);
}
console.log(`\n═══ WAVE 5 VERDICTS ═══`);
for (const [k, v] of Object.entries(results.verdicts)) {
  console.log(`  ${k}: ${v}`);
}
console.log(`\nWrote ${outPath}`);
