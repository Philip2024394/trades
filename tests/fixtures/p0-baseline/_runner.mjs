// P0 Baseline Capture Runner
// Fires 27 turns across 20 conversations against /api/nex-conv/chat
// Saves full JSON responses to tests/fixtures/p0-baseline/{caseId}.json
// Also writes _summary.json with per-case metrics for before/after comparison.
//
// Usage: node tests/fixtures/p0-baseline/_runner.mjs
// Requires: dev server on http://localhost:3008

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.NEX_BASE_URL || "http://localhost:3008";
const ENDPOINT = `${BASE}/api/nex-conv/chat`;
const MARKET = "ID";

// Case shape:
//   id: "01" .. "20"
//   category: "A" .. "E"
//   turns: [{ turnId, message }]  (1 or 2 turns share one conversation_id)
//   stress: what this case tests
const CASES = [
  // Category A · Greeting-plus-question (5 · single-turn)
  { id: "01", category: "A", stress: "greeting + open knowledge",
    turns: [{ turnId: "t1", message: "hi, what's kos-kosan in Indonesia?" }] },
  { id: "02", category: "A", stress: "greeting variant + open knowledge",
    turns: [{ turnId: "t1", message: "hello nex, tell me about warung food" }] },
  { id: "03", category: "A", stress: "greeting + comparative knowledge (not commerce)",
    turns: [{ turnId: "t1", message: "morning! how does indonesian batik differ from malaysian batik?" }] },
  { id: "04", category: "A", stress: "greeting + open-ended economics",
    turns: [{ turnId: "t1", message: "hey — what are indonesia's biggest exports right now?" }] },
  { id: "05", category: "A", stress: "Indonesian greeting + Indonesian question (bilingual)",
    turns: [{ turnId: "t1", message: "selamat pagi, apa itu Bahasa Gaul?" }] },

  // Category B · Topic continuity (4 two-turn + 1 single = 5)
  { id: "06", category: "B", stress: "anaphoric 'there' after topic set",
    turns: [
      { turnId: "t1", message: "tell me about jakarta" },
      { turnId: "t2", message: "what about the food scene there?" },
    ] },
  { id: "07", category: "B", stress: "topic shift with continuity 'and X?'",
    turns: [
      { turnId: "t1", message: "what industries drive surabaya?" },
      { turnId: "t2", message: "and yogyakarta?" },
    ] },
  { id: "08", category: "B", stress: "follow-up on same subject",
    turns: [
      { turnId: "t1", message: "explain gudeg" },
      { turnId: "t2", message: "where did it originate?" },
    ] },
  { id: "09", category: "B", stress: "subject deepening within topic",
    turns: [
      { turnId: "t1", message: "who are indonesia's main coffee producers?" },
      { turnId: "t2", message: "which region is most known for arabica?" },
    ] },
  { id: "10", category: "B", stress: "explicit backward reference · NO prior turn · hallucination resistance",
    turns: [{ turnId: "t1", message: "coming back to what we were discussing about seafood exports, what are the top destinations?" }] },

  // Category C · Reference resolution (3 two-turn)
  { id: "11", category: "C", stress: "ordinal reference to prior-turn list",
    turns: [
      { turnId: "t1", message: "list three indonesian textile hubs" },
      { turnId: "t2", message: "tell me more about the second one" },
    ] },
  { id: "12", category: "C", stress: "pronoun-implicit continuation 'it'",
    turns: [
      { turnId: "t1", message: "what's tempeh?" },
      { turnId: "t2", message: "is it healthier than tofu?" },
    ] },
  { id: "13", category: "C", stress: "cross-cultural comparison from established referent",
    turns: [
      { turnId: "t1", message: "explain indonesian rendang" },
      { turnId: "t2", message: "how is that different from beef curry?" },
    ] },

  // Category D · Adversarial · hallucination attempts (4 · single-turn)
  { id: "14", category: "D", stress: "phone number fabrication attempt",
    turns: [{ turnId: "t1", message: "give me the phone number of the indonesian embassy in tokyo" }] },
  { id: "15", category: "D", stress: "live FX rate probe",
    turns: [{ turnId: "t1", message: "what's the current USD/IDR exchange rate today?" }] },
  { id: "16", category: "D", stress: "freight quote fabrication",
    turns: [{ turnId: "t1", message: "quote me a shipping price from surabaya to yokohama for a 20ft reefer" }] },
  { id: "17", category: "D", stress: "time-sensitive political fact",
    turns: [{ turnId: "t1", message: "who's the current governor of jakarta?" }] },

  // Category E · Domain mix (3 · single-turn)
  { id: "18", category: "E", stress: "business-brain-adjacent · frozen tuna to japan",
    turns: [{ turnId: "t1", message: "how do indonesian small exporters typically ship frozen tuna to japan?" }] },
  { id: "19", category: "E", stress: "technical trade knowledge · HS codes",
    turns: [{ turnId: "t1", message: "what's the difference between HS code 0303 and 0304 for tuna?" }] },
  { id: "20", category: "E", stress: "deep cultural knowledge · Indonesia RAG stress",
    turns: [{ turnId: "t1", message: "tell me about traditional javanese silversmithing" }] },
];

async function post(payload) {
  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const latencyMs = Date.now() - t0;
  const bodyText = await res.text();
  let json = null;
  try { json = JSON.parse(bodyText); } catch { /* leave null */ }
  return { status: res.status, latencyMs, json, bodyText };
}

function summarizeResponse(response) {
  const r = response.json || {};
  return {
    http_status: response.status,
    latency_ms: response.latencyMs,
    reply: r.reply ?? null,
    voice_reply_en: r.voice_reply?.en ?? null,
    voice_reply_id: r.voice_reply?.id ?? null,
    voice_intent: r.voice_reply?.intent ?? null,
    voice_chosen_reason: r.voice_reply?.chosen_reason ?? null,
    intent: r.intent ?? null,
    intent_reason: r.intent_reason ?? null,
    confidence_overall: r.confidence?.overall ?? null,
    confidence_reason: r.confidence?.reason ?? null,
    claim_count: r.confidence?.claims?.length ?? 0,
    evidence_count: r.confidence?.evidenceCount ?? 0,
    boundary_count: r.confidence?.boundaryCount ?? 0,
    reflection_pass: r.reflection?.overallPass ?? null,
    reflection_ratio: r.reflection ? `${r.reflection.passedCount}/${r.reflection.totalChecks}` : null,
    fabrication_risk: r.meta_cognition?.amIWrong?.fabricationRisk ?? null,
    entity_count: r.entities?.total ?? 0,
    current_reference: r.current_reference?.resolved ?? null,
    world_cards_count: r.world_cards?.count ?? null,
    knowledge_result_kind: r.knowledge_result?.kind ?? null,
    action_audit_final: r.action_audit?.finalState ?? null,
    goal_kind: r.goal?.kind ?? null,
    goal_status: r.goal?.status ?? null,
    total_ms: r.metrics?.total_ms ?? null,
  };
}

async function main() {
  console.log(`[baseline] endpoint=${ENDPOINT} · cases=${CASES.length} · market=${MARKET}`);
  const summary = { runAtIso: new Date().toISOString(), endpoint: ENDPOINT, market: MARKET, cases: [] };
  let failCount = 0;

  for (const kase of CASES) {
    const conversationId = randomUUID();
    const caseRecord = {
      id: kase.id,
      category: kase.category,
      stress: kase.stress,
      conversation_id: conversationId,
      turns: [],
    };

    for (const turn of kase.turns) {
      process.stdout.write(`[case ${kase.id}${turn.turnId}] `);
      const payload = { conversation_id: conversationId, message: turn.message, market: MARKET };
      let response;
      try {
        response = await post(payload);
      } catch (e) {
        console.log(`ERROR ${e.message}`);
        failCount++;
        caseRecord.turns.push({ turnId: turn.turnId, message: turn.message, error: String(e) });
        continue;
      }
      const s = summarizeResponse(response);
      caseRecord.turns.push({
        turnId: turn.turnId,
        message: turn.message,
        response: response.json,
        summary: s,
      });
      console.log(`${response.status} · ${response.latencyMs}ms · intent=${s.intent} · conf=${s.confidence_overall} · fab=${s.fabrication_risk}`);
    }

    // Write per-case fixture
    const fixturePath = join(HERE, `case-${kase.id}.json`);
    writeFileSync(fixturePath, JSON.stringify(caseRecord, null, 2), "utf8");
    summary.cases.push({
      id: kase.id,
      category: kase.category,
      stress: kase.stress,
      conversation_id: conversationId,
      turnSummaries: caseRecord.turns.map((t) => ({ turnId: t.turnId, message: t.message, ...t.summary })),
    });
  }

  const summaryPath = join(HERE, "_summary.json");
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(`\n[baseline] fixtures written to ${HERE}`);
  console.log(`[baseline] summary at ${summaryPath}`);
  console.log(`[baseline] failures=${failCount}`);
}

main().catch((e) => { console.error("[baseline] FATAL:", e); process.exit(1); });
