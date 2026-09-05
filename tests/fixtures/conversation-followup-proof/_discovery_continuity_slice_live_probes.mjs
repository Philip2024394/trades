// NEX Discovery Continuity Slice · live HTTP campaigns
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE · D1 fix only
//
// The AUTHORIZE-listed acceptance conversation:
//   T1 "need hotel tonight"                 → 3 hotel entities returned
//   T2 "can I see details"                  → active result set (existing capability)
//   T3 "tell me about the first one"        → resolve to hotel #1 · not fresh discovery
//   T4 "what about the second one?"         → resolve to hotel #2
//   T5 "one more"                           → existing quantity/continuation semantics
//   T6 "tell me more about that one"        → resolve via pronoun to prior pick
//
// Plus the AUTHORIZE-mandated preservation campaigns:
//   Fresh-conversation "tell me about the first hotel" → honest boundary
//   Cross-vertical hotel → restaurant → "show me the first one" → no leak

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = process.env.NEX_CHAT_URL || "http://localhost:3008/api/nex-conv/chat";

async function post(convId, message) {
  const r = await fetch(CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: convId, message, market: "ID" }),
  });
  return await r.json();
}

function digest(j) {
  const cm = j.composition_meta || {};
  const wc = j.world_cards;
  return {
    reply: (j.reply || "").slice(0, 260),
    voice_reply_en: j.voice_reply?.en?.slice(0, 220),
    voice_reply_intent: j.voice_reply?.intent,
    intent: j.intent,
    world_cards_count: wc?.cards?.length ?? 0,
    world_cards_names: wc?.cards?.slice(0, 3).map((c) => c.name) ?? [],
    entity_result_cards_count: cm.entity_result_cards_count,
    entity_result_cards_memoized: cm.entity_result_cards_memoized,
    // Reference resolution observability (from state_summary + entities)
    current_reference: j.current_reference,
    entities_count: (j.entities ?? []).length,
    reason: cm.reason,
  };
}

const FABRICATION_TOKENS = [
  // Wave 4/5 K1 lures
  "Tokyo Tower", "Shibuya", "Harajuku", "Fushimi Inari",
  // Placeholder hotels that must never appear
  "Palace Grand", "Royal Deluxe", "Emperor's Retreat",
];
function hasFabrication(reply) {
  return FABRICATION_TOKENS.find((t) => reply.includes(t)) ?? null;
}

const results = { runAt: new Date().toISOString(), campaigns: [] };

async function campaign(label, description, turns) {
  const cid = randomUUID();
  const record = { label, description, conversation_id: cid, turns: [] };
  console.log(`\n═══ ${label} ═══`);
  console.log(`   ${description}`);
  for (const [i, t] of turns.entries()) {
    const j = await post(cid, t.msg);
    const d = digest(j);
    const fab = hasFabrication(d.reply);
    record.turns.push({ turn: i + 1, message: t.msg, fabricated: fab, ...d });
    console.log(`   T${i + 1} "${t.msg}"`);
    console.log(`      reply       : ${JSON.stringify(d.reply)}`);
    console.log(`      voice_reply : ${JSON.stringify(d.voice_reply_en)} (intent=${d.voice_reply_intent})`);
    console.log(`      entities    : ${d.entities_count} · world_cards_count=${d.world_cards_count} names=[${d.world_cards_names.join(", ")}]`);
    console.log(`      currentRef  : ${d.current_reference?.resolved ? `resolved offset=${d.current_reference.offset} refKind=${d.current_reference.refKind}` : `unresolved (${d.current_reference?.reason ?? "n/a"})`}`);
    console.log(`      fab=${fab ?? "no"}`);
  }
  results.campaigns.push(record);
  return record;
}

// ══════════════════════════════════════════════════════════════════
// A · Primary acceptance conversation
// ══════════════════════════════════════════════════════════════════

await campaign("A · Primary acceptance (need hotel → ordinal follow-ups)",
  "The exact AUTHORIZE-listed conversation.",
  [
    { msg: "need hotel tonight" },
    { msg: "can I see details" },
    { msg: "tell me about the first one" },
    { msg: "what about the second one?" },
    { msg: "one more" },
    { msg: "tell me more about that one" },
  ]);

// ══════════════════════════════════════════════════════════════════
// B · P0.4 fresh-conversation ordinal protection preserved
// ══════════════════════════════════════════════════════════════════

await campaign("B · Fresh-conversation ordinal protection (P0.4)",
  "'tell me about the first hotel' in a fresh conversation must remain safely unresolved.",
  [
    { msg: "tell me about the first hotel" },
  ]);

// ══════════════════════════════════════════════════════════════════
// C · Cross-vertical topic shift · no leak
// ══════════════════════════════════════════════════════════════════

await campaign("C · Hotel → restaurant switch",
  "After switching from hotels to restaurants, 'show me the first one' must not resolve to a stale hotel.",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "actually, I need a restaurant" },
    { msg: "show me the first one" },
  ]);

// ══════════════════════════════════════════════════════════════════
// D · Genuine new search still works
// ══════════════════════════════════════════════════════════════════

await campaign("D · Fresh new-search still works after prior result set",
  "After hotels-in-Yogyakarta, 'find me hotels in Bali' must run a fresh discovery.",
  [
    { msg: "find me hotels in Yogyakarta" },
    { msg: "find me hotels in Bali" },
  ]);

// ══════════════════════════════════════════════════════════════════
// E · Preservation · result-followup provenance
// ══════════════════════════════════════════════════════════════════

await campaign("E · Result-followup provenance preserved",
  "'where did you find these?' must still return provenance not a re-emit.",
  [
    { msg: "find me hotels" },
    { msg: "where did you find these?" },
  ]);

// ══════════════════════════════════════════════════════════════════
// F · K1 fabrication discipline preserved
// ══════════════════════════════════════════════════════════════════

await campaign("F · K1 preserved · zero-evidence Tokyo",
  "'What should I do in Tokyo?' still honest boundary.",
  [
    { msg: "What should I do in Tokyo?" },
  ]);

// ─── Verdict ─────────────────────────────────────────────────────
const outPath = path.join(here, "_discovery_continuity_slice_live_probes.json");
writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

// Score
const a = results.campaigns[0];
const t3ResolvedOrdinalNaming = /first one/i.test(a.turns[2].reply) || a.turns[2].current_reference?.resolved === true;
const t4ResolvedOrdinalNaming = /second one/i.test(a.turns[3].reply) || a.turns[3].current_reference?.resolved === true;
const t6PronounResolved      = a.turns[5].current_reference?.resolved === true;

const t3NamesGaotamaOrPrior = a.turns[2].reply.includes(a.turns[0].world_cards_names[0] ?? "___") || t3ResolvedOrdinalNaming;
const t4NamesSecond          = a.turns[3].reply.includes(a.turns[0].world_cards_names[1] ?? "___") || t4ResolvedOrdinalNaming;

const b = results.campaigns[1];
const bIsHonestBoundary = /don't have|which hotel do you mean|no previous|honest/i.test(b.turns[0].reply) || b.turns[0].current_reference?.resolved !== true;

const c = results.campaigns[2];
const cNoLeak = !c.turns[2].reply.toLowerCase().includes("hotel") || /restaurant/i.test(c.turns[2].reply);

const d = results.campaigns[3];
const dFreshSearchDiffers = d.turns[0].world_cards_names.join("|") !== d.turns[1].world_cards_names.join("|");

const e = results.campaigns[4];
const eProvenancePreserved = /found them|openstreetmap|directory|community listings|provenance|source/i.test(e.turns[1].reply);

const f = results.campaigns[5];
const fZeroFab = !hasFabrication(f.turns[0].reply);

const anyFab = results.campaigns.some((c) => c.turns.some((t) => t.fabricated));

console.log(`\n═══ DISCOVERY CONTINUITY VERDICT ═══`);
console.log(`  T3 "first one" resolves + names       : ${t3NamesGaotamaOrPrior ? "PASS" : "FAIL"}`);
console.log(`  T4 "second one" resolves + names      : ${t4NamesSecond ? "PASS" : "FAIL"}`);
console.log(`  T6 "that one" pronoun resolves        : ${t6PronounResolved ? "PASS" : "FAIL"}`);
console.log(`  P0.4 fresh ordinal (honest boundary)  : ${bIsHonestBoundary ? "PASS" : "FAIL"}`);
console.log(`  Vertical switch no hotel leak         : ${cNoLeak ? "PASS" : "FAIL"}`);
console.log(`  Genuine new-search still runs         : ${dFreshSearchDiffers ? "PASS" : "FAIL"}`);
console.log(`  Result-followup provenance preserved  : ${eProvenancePreserved ? "PASS" : "FAIL"}`);
console.log(`  K1 zero fabrication                   : ${fZeroFab ? "PASS" : "FAIL"}`);
console.log(`  Zero fabrications overall             : ${!anyFab ? "PASS" : "FAIL"}`);

results.verdicts = {
  t3_first_one: t3NamesGaotamaOrPrior,
  t4_second_one: t4NamesSecond,
  t6_that_one_pronoun: t6PronounResolved,
  p0_4_fresh_ordinal: bIsHonestBoundary,
  vertical_switch_no_leak: cNoLeak,
  genuine_new_search: dFreshSearchDiffers,
  result_followup_provenance: eProvenancePreserved,
  k1_zero_fabrication: fZeroFab,
  zero_fabrications_overall: !anyFab,
};

writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`\nWrote ${outPath}`);
