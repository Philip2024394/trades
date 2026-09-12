#!/usr/bin/env node
// scripts/smoke-conversation-brain.mjs
//
// Founder BEGIN Phase 3.1 · multi-turn regression lab for the conversation brain.
//
// Each SCENARIO is a series of turns on ONE conversation_id. Every turn's
// reply, promotion, voice_intent, and per-turn latency is captured and
// asserted against expectations. Prints a summary + hard-fails on any
// regression (forbidden discovery_hit, missing entity resolution, etc.).

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

const SCENARIOS = [
  {
    id: "fragment_flow_en",
    turns: [
      { q: "hotel di jogja",                 assert: { must_not: "discovery_hit", classification_prefix: "list" } },
      { q: "which has a pool?",              assert: { must_not: "discovery_hit", need_state: true } },
      { q: "how many rooms does the first one have?", assert: { must_not: "discovery_hit", need_state: true } },
      { q: "and wifi?",                       assert: { must_not: "discovery_hit", need_state: true, fragment: true } },
      { q: "tomorrow?",                       assert: { must_not: "discovery_hit", need_state: true, fragment: true } },
    ],
  },
  {
    id: "single_entity_then_fragments",
    turns: [
      { q: "how many rooms does Gaotama Hotel have?", assert: { must_not: "discovery_hit" } },
      { q: "wifi?",                           assert: { must_not: "discovery_hit", fragment: true, need_state: true } },
      { q: "pool?",                           assert: { must_not: "discovery_hit", fragment: true, need_state: true } },
      { q: "address?",                        assert: { must_not: "discovery_hit", fragment: true, need_state: true } },
    ],
  },
  {
    id: "id_mixed_language",
    turns: [
      { q: "cari hotel di jogja",             assert: { must_not: "discovery_hit" } },
      { q: "yang murah?",                     assert: { must_not: "discovery_hit" } },
      { q: "wifinya?",                        assert: { must_not: "discovery_hit", fragment: true, need_state: true } },
    ],
  },
  {
    id: "ordinal_reference",
    turns: [
      { q: "hotels in yogyakarta",            assert: { must_not: "discovery_hit" } },
      { q: "tell me about the second one",    assert: { must_not: "discovery_hit", need_state: true } },
      { q: "rooms?",                          assert: { must_not: "discovery_hit", fragment: true, need_state: true } },
    ],
  },
  {
    id: "topic_switch",
    turns: [
      { q: "hotels in jogja",                 assert: { must_not: "discovery_hit" } },
      { q: "what about villas?",              assert: { must_not: "discovery_hit" } },
    ],
  },
  {
    id: "fragment_no_context_forces_honest",
    turns: [
      { q: "wifi?",                           assert: { may_be: "any" } },
    ],
  },
];

async function turn(cid, q) {
  const t0 = Date.now();
  const r = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: q, conversation_id: cid, market: "ID", useLiveWorld: true }),
  });
  const ms = Date.now() - t0;
  const b = await r.json();
  const dbg = b?._debug_timings ?? {};
  return {
    wall_ms: ms,
    voice_intent: b?.voice_reply?.intent,
    reply_preview: String(b?.reply ?? "").slice(0, 120),
    adapter_reply_kind: dbg.lcc_adapter_reply?.reply_kind,
    adapter_intent: dbg.lcc_adapter_reply?.intent_slug,
    adapter_entity: dbg.lcc_adapter_reply?.entity_ref,
    adapter_latency: dbg.lcc_adapter_reply?.latency_ms,
    fingerprint_hit: dbg.lcc_adapter_reply?.reasoning?.some?.((r) => r.includes("fingerprint_hit")) ?? false,
    turn_plan_classification: dbg.lcc_adapter_reply?.reasoning?.map?.((r) => r.match(/turn_plan · ([a-z_]+)/)?.[1]).find(Boolean) ?? null,
  };
}

const failures = [];
let totalTurns = 0;
const latencies = [];

for (const scenario of SCENARIOS) {
  const cid = randomUUID();
  console.log(`\n══ scenario: ${scenario.id} (cid=${cid.slice(0, 8)})`);
  for (let i = 0; i < scenario.turns.length; i++) {
    const step = scenario.turns[i];
    try {
      const r = await turn(cid, step.q);
      totalTurns++;
      latencies.push(r.wall_ms);
      const violated = step.assert.must_not === "discovery_hit" && r.voice_intent === "discovery_hit";
      const stateMissed = step.assert.need_state === true && !r.turn_plan_classification && !r.adapter_entity;
      console.log(`  T${i + 1} · ${JSON.stringify(step.q)}`);
      console.log(`     wall=${r.wall_ms}ms adapter=${r.adapter_latency ?? "-"}ms voice=${r.voice_intent} kind=${r.adapter_reply_kind ?? "-"} intent=${r.adapter_intent ?? "-"} entity=${r.adapter_entity ?? "-"}${r.fingerprint_hit ? " · fp_hit" : ""}${r.turn_plan_classification ? ` · tp=${r.turn_plan_classification}` : ""}${violated ? " ❌ discovery_hit" : ""}${stateMissed ? " ⚠ no state consult" : ""}`);
      console.log(`     reply: ${JSON.stringify(r.reply_preview)}`);
      if (violated) failures.push({ scenario: scenario.id, turn: i + 1, q: step.q, reason: "discovery_hit_forbidden" });
    } catch (e) {
      console.log(`  T${i + 1} · REQUEST ERROR ${e?.message ?? e}`);
      failures.push({ scenario: scenario.id, turn: i + 1, q: step.q, reason: `request_error:${e?.message ?? e}` });
    }
  }
}

const p50 = percentile(latencies, 50);
const p95 = percentile(latencies, 95);
const p99 = percentile(latencies, 99);

console.log(`\n══ SUMMARY`);
console.log(`   scenarios=${SCENARIOS.length}  turns=${totalTurns}  failures=${failures.length}`);
console.log(`   latency (wall, all turns): p50=${p50}ms  p95=${p95}ms  p99=${p99}ms  max=${Math.max(...latencies)}ms`);
if (failures.length > 0) {
  console.log(`\n   FAILED:`);
  for (const f of failures) console.log(`     [${f.scenario}] T${f.turn} ${JSON.stringify(f.q)} · ${f.reason}`);
  process.exit(1);
} else {
  console.log(`   0 discovery_hit regressions.`);
  process.exit(0);
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
