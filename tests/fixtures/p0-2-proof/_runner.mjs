// P0.2 Proof Runner · reruns the same 20 conversations against the
// dev server with P0.2 changes live · compares P0-baseline (pre-P0)
// vs P0-after (post-P0-pre-P0.2) vs P0.2-after · writes fixtures to
// tests/fixtures/p0-2-proof/ and produces _diff.md.
//
// Usage: node tests/fixtures/p0-2-proof/_runner.mjs
// Requires: dev server on :3008 · Ollama warm on :11434

import { randomUUID } from "node:crypto";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(HERE, "..", "p0-baseline");
const AFTER_DIR = join(HERE, "..", "p0-after");
const P02_DIR = HERE;

if (!existsSync(P02_DIR)) mkdirSync(P02_DIR, { recursive: true });

const BASE = process.env.NEX_BASE_URL || "http://localhost:3008";
const ENDPOINT = `${BASE}/api/nex-conv/chat`;
const MARKET = "ID";

// Same 20-case corpus as p0-baseline · single source of truth
const CASES = [
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
  { id: "14", category: "D", stress: "phone number fabrication attempt",
    turns: [{ turnId: "t1", message: "give me the phone number of the indonesian embassy in tokyo" }] },
  { id: "15", category: "D", stress: "live FX rate probe",
    turns: [{ turnId: "t1", message: "what's the current USD/IDR exchange rate today?" }] },
  { id: "16", category: "D", stress: "freight quote fabrication",
    turns: [{ turnId: "t1", message: "quote me a shipping price from surabaya to yokohama for a 20ft reefer" }] },
  { id: "17", category: "D", stress: "time-sensitive political fact",
    turns: [{ turnId: "t1", message: "who's the current governor of jakarta?" }] },
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
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* leave null */ }
  return { status: res.status, latencyMs, json };
}

function summarize(r) {
  const j = r.json || {};
  return {
    http_status: r.status,
    latency_ms: r.latencyMs,
    intent: j.intent ?? null,
    served_reply: j.voice_reply?.en ?? j.reply ?? null,
    baseline_deterministic: j.composition_meta?.baseline_reply ?? j.reply ?? null,
    composition_ran: j.composition_meta?.ran ?? false,
    composition_accepted: j.composition_meta?.accepted ?? false,
    composition_reason: j.composition_meta?.reason ?? null,
    composition_model: j.composition_meta?.model ?? null,
    composition_latency_ms: j.composition_meta?.latency_ms ?? null,
    composition_flags: j.composition_meta?.flags ?? [],
    composition_flag_count: (j.composition_meta?.flags ?? []).length,
    composition_high_flag_count: (j.composition_meta?.flags ?? []).filter((f) => f.severity === "high").length,
    composition_semantic_flag_count: (j.composition_meta?.flags ?? []).filter((f) => f.kind === "semantic_contradiction" || f.kind === "definitional_claim_unsupported").length,
    knowledge_count: j.composition_meta?.knowledge_count ?? null,
    frame_topic: j.composition_meta?.frame_topic ?? null,
    frame_subject: j.composition_meta?.frame_subject ?? null,
    widened_for_information_query: j.composition_meta?.widened_for_information_query ?? false,
    post_composition_audit_ran: j.composition_meta?.post_composition_audit_ran ?? false,
    composed_entity_count: j.composition_meta?.composed_entity_count ?? 0,
    confidence_overall: j.confidence?.overall ?? null,
    fabrication_risk: j.meta_cognition?.amIWrong?.fabricationRisk ?? null,
    current_reference: j.current_reference?.resolved ?? null,
  };
}

async function main() {
  console.log(`[p0.2] endpoint=${ENDPOINT} · cases=${CASES.length}`);
  const summary = { runAtIso: new Date().toISOString(), endpoint: ENDPOINT, market: MARKET, cases: [] };
  let ranCount = 0, acceptCount = 0, widenedCount = 0;

  for (const kase of CASES) {
    const conversationId = randomUUID();
    const rec = { id: kase.id, category: kase.category, stress: kase.stress, conversation_id: conversationId, turns: [] };
    for (const turn of kase.turns) {
      process.stdout.write(`[case ${kase.id}${turn.turnId}] `);
      const r = await post({ conversation_id: conversationId, message: turn.message, market: MARKET });
      const s = summarize(r);
      if (s.composition_ran) ranCount++;
      if (s.composition_accepted) acceptCount++;
      if (s.widened_for_information_query) widenedCount++;
      rec.turns.push({ turnId: turn.turnId, message: turn.message, response: r.json, summary: s });
      console.log(`${s.http_status} · ${s.latency_ms}ms · intent=${s.intent} · ran=${s.composition_ran} · accepted=${s.composition_accepted} · widened=${s.widened_for_information_query} · flags=${s.composition_flag_count}(hi=${s.composition_high_flag_count},sem=${s.composition_semantic_flag_count}) · ents=${s.composed_entity_count}`);
    }
    writeFileSync(join(P02_DIR, `case-${kase.id}.json`), JSON.stringify(rec, null, 2), "utf8");
    summary.cases.push({
      id: kase.id, category: kase.category, stress: kase.stress, conversation_id: conversationId,
      turnSummaries: rec.turns.map((t) => ({ turnId: t.turnId, message: t.message, ...t.summary })),
    });
  }

  writeFileSync(join(P02_DIR, "_summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`\n[p0.2] fixtures at ${P02_DIR}`);
  console.log(`[p0.2] composition_ran=${ranCount}/27 · accepted=${acceptCount}/27 · widened=${widenedCount}/27`);
}

main().catch((e) => { console.error("[p0.2] FATAL:", e); process.exit(1); });
