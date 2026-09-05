// P0.2 Human Conversation Test · single 9-turn conversation covering:
//
//   seafood → tuna → Japan → export → price → follow-up → comparison
//   → topic switch → return to tuna
//
// The question is not "does NEX answer?" but "does it feel like I am
// speaking to one continuously thinking system?"
//
// Records failures rather than hiding them.
//
// Usage: node tests/fixtures/p0-2-proof/_human_conversation.mjs
// Requires: dev server on :3008 · Ollama warm on :11434

import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = HERE;
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.NEX_BASE_URL || "http://localhost:3008";
const ENDPOINT = `${BASE}/api/nex-conv/chat`;
const MARKET = "ID";
const CONVERSATION_ID = randomUUID();

const TURNS = [
  { label: "T1 · broad topic",        message: "Tell me about the Indonesian seafood industry." },
  { label: "T2 · specific subtopic",  message: "What about tuna?" },
  { label: "T3 · related entity",     message: "And Japan?" },
  { label: "T4 · commercial",         message: "Could I export it?" },
  { label: "T5 · follow-up",          message: "What would affect the price?" },
  { label: "T6 · comparison",         message: "How does farmed shrimp compare to wild tuna commercially?" },
  { label: "T7 · topic switch",       message: "Actually, what about the seafood market generally?" },
  { label: "T8 · return to earlier",  message: "OK back to tuna — what's the biggest challenge for a small exporter?" },
  { label: "T9 · reference check",    message: "You mentioned Japan earlier — is it still the primary market for that?" },
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

function summarize(r, turn) {
  const j = r.json || {};
  return {
    label: turn.label,
    message: turn.message,
    reply: j.voice_reply?.en ?? j.reply ?? null,
    intent: j.intent ?? null,
    composition_ran: j.composition_meta?.ran ?? false,
    composition_accepted: j.composition_meta?.accepted ?? false,
    composition_reason: j.composition_meta?.reason ?? null,
    widened_for_information_query: j.composition_meta?.widened_for_information_query ?? false,
    frame_topic: j.composition_meta?.frame_topic ?? null,
    frame_subject: j.composition_meta?.frame_subject ?? null,
    flags: j.composition_meta?.flags ?? [],
    knowledge_count: j.composition_meta?.knowledge_count ?? null,
    composed_entity_count: j.composition_meta?.composed_entity_count ?? 0,
    latency_ms: r.latencyMs,
  };
}

async function main() {
  console.log(`[human] endpoint=${ENDPOINT} · conversation_id=${CONVERSATION_ID}`);
  const record = { runAtIso: new Date().toISOString(), conversation_id: CONVERSATION_ID, turns: [] };
  for (const turn of TURNS) {
    console.log(`\n${turn.label}`);
    console.log(`Q: ${turn.message}`);
    const r = await post({
      conversation_id: CONVERSATION_ID,
      message: turn.message,
      market: MARKET,
    });
    const s = summarize(r, turn);
    console.log(`A: ${(s.reply ?? "").slice(0, 260)}`);
    console.log(`   [intent=${s.intent} · ran=${s.composition_ran} · accepted=${s.composition_accepted} · widened=${s.widened_for_information_query} · frame_topic=${s.frame_topic ?? "?"} · frame_subject=${s.frame_subject ?? "?"} · knowledge=${s.knowledge_count} · flags=${(s.flags ?? []).length} · ents=${s.composed_entity_count} · ${s.latency_ms}ms]`);
    record.turns.push({ ...s, response: r.json });
  }
  writeFileSync(join(OUT_DIR, "_human_conversation.json"), JSON.stringify(record, null, 2), "utf8");
  console.log(`\n[human] written to ${OUT_DIR}/_human_conversation.json`);
}

main().catch((e) => { console.error("[human] FATAL:", e); process.exit(1); });
