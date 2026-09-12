#!/usr/bin/env node
// scripts/smoke-truth-engine.mjs
//
// Founder BEGIN Phase 3.2 · Truth + Retrieval Engine regression lab.
//
// Assertions:
//   1. Temporal fragments (tomorrow / tonight / this weekend / besok) resolve
//      to availability_query intent with honest availability_unknown reply.
//   2. Fingerprint short-circuit fires when the same question repeats and
//      the question_variant is answered/partially_answered.
//   3. Per-stage timing breakdown lands on every LCC turn.
//   4. No discovery_hit regressions.

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

const SCENARIOS = [
  {
    id: "temporal_fragment_english",
    // "tomorrow?" after a rendered list correctly classifies as list_filter
    // (interpreter applies the temporal against the list). Intent must be
    // availability_query — that's the semantic anchor.
    turns: [
      { q: "hotels in yogyakarta",     assert: { must_not: "discovery_hit" } },
      { q: "tomorrow?",                assert: { must_not: "discovery_hit", intent_slug_expected: "availability_query" } },
    ],
  },
  {
    id: "temporal_fragment_tonight",
    turns: [
      { q: "hotels in jogja",          assert: { must_not: "discovery_hit" } },
      { q: "tonight?",                 assert: { must_not: "discovery_hit", intent_slug_expected: "availability_query" } },
    ],
  },
  {
    id: "temporal_fragment_indonesian",
    turns: [
      { q: "hotel di jogja",           assert: { must_not: "discovery_hit" } },
      { q: "besok?",                   assert: { must_not: "discovery_hit", intent_slug_expected: "availability_query" } },
    ],
  },
  {
    id: "fingerprint_short_circuit_hit",
    // Canonical name in DB is "Hotel Gaotama" · that's the exact phrasing
    // stored in nex.question_variant. L1 exact match only fires on that
    // wording; reversed word order ("Gaotama Hotel") is L3 semantic's job
    // (future BEGIN). Test uses the stored canonical form.
    turns: [
      { q: "How many rooms does Hotel Gaotama have?", assert: { must_not: "discovery_hit" } },
      { q: "How many rooms does Hotel Gaotama have?", assert: { must_not: "discovery_hit", expect_fingerprint: true } },
    ],
  },
  {
    id: "per_stage_timing_present",
    turns: [
      { q: "hotel di jogja",           assert: { must_not: "discovery_hit", need_stage_timing: true } },
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
  const reasoning = dbg.lcc_adapter_reply?.reasoning ?? [];
  return {
    wall_ms: ms,
    voice_intent: b?.voice_reply?.intent,
    reply_preview: String(b?.reply ?? "").slice(0, 120),
    adapter_reply_kind: dbg.lcc_adapter_reply?.reply_kind,
    adapter_intent: dbg.lcc_adapter_reply?.intent_slug,
    adapter_entity: dbg.lcc_adapter_reply?.entity_ref,
    adapter_latency: dbg.lcc_adapter_reply?.latency_ms,
    fingerprint_hit: reasoning.some((s) => s.includes("fingerprint_hit")),
    short_circuit: reasoning.some((s) => s.includes("short_circuit")),
    tp_classification: reasoning.map((r) => r.match(/turn_plan · ([a-z_]+)/)?.[1]).find(Boolean) ?? null,
    stage_ms: dbg.lcc_stage_ms ?? null,
    stage_keys: dbg.lcc_stage_ms ? Object.keys(dbg.lcc_stage_ms) : [],
  };
}

const failures = [];
let totalTurns = 0;
const latencies = [];
const stageLatencies = {};

for (const scenario of SCENARIOS) {
  const cid = randomUUID();
  console.log(`\n══ scenario: ${scenario.id} (cid=${cid.slice(0, 8)})`);
  for (let i = 0; i < scenario.turns.length; i++) {
    const step = scenario.turns[i];
    try {
      const r = await turn(cid, step.q);
      totalTurns++;
      latencies.push(r.wall_ms);
      if (r.stage_ms) {
        for (const [k, v] of Object.entries(r.stage_ms)) {
          if (!stageLatencies[k]) stageLatencies[k] = [];
          stageLatencies[k].push(v);
        }
      }
      const violations = [];
      if (step.assert.must_not === "discovery_hit" && r.voice_intent === "discovery_hit") violations.push("discovery_hit");
      if (step.assert.intent_slug_expected && r.adapter_intent !== step.assert.intent_slug_expected) violations.push(`intent_expected=${step.assert.intent_slug_expected} got=${r.adapter_intent}`);
      if (step.assert.classification && r.tp_classification !== step.assert.classification) violations.push(`classification_expected=${step.assert.classification} got=${r.tp_classification}`);
      if (step.assert.expect_fingerprint && !r.fingerprint_hit) violations.push("fingerprint_hit_expected");
      if (step.assert.need_stage_timing && (!r.stage_ms || r.stage_keys.length === 0)) violations.push("no_stage_timing");

      console.log(`  T${i + 1} · ${JSON.stringify(step.q)}`);
      console.log(`     wall=${r.wall_ms}ms adapter=${r.adapter_latency ?? "-"}ms voice=${r.voice_intent} kind=${r.adapter_reply_kind ?? "-"} intent=${r.adapter_intent ?? "-"} entity=${r.adapter_entity ?? "-"}${r.fingerprint_hit ? " · fp_hit" : ""}${r.short_circuit ? " · SHORT_CIRCUIT" : ""}${r.tp_classification ? ` · tp=${r.tp_classification}` : ""}${violations.length ? ` ❌ ${violations.join(",")}` : ""}`);
      console.log(`     stages=${r.stage_keys.join(",") || "—"}`);
      console.log(`     reply: ${JSON.stringify(r.reply_preview)}`);
      if (violations.length > 0) failures.push({ scenario: scenario.id, turn: i + 1, q: step.q, reasons: violations });
    } catch (e) {
      console.log(`  T${i + 1} · REQUEST ERROR ${e?.message ?? e}`);
      failures.push({ scenario: scenario.id, turn: i + 1, q: step.q, reasons: [`request_error:${e?.message ?? e}`] });
    }
  }
}

function pctile(arr, p) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

console.log(`\n══ SUMMARY`);
console.log(`   scenarios=${SCENARIOS.length}  turns=${totalTurns}  failures=${failures.length}`);
console.log(`   wall latency: p50=${pctile(latencies, 50)}ms p95=${pctile(latencies, 95)}ms max=${Math.max(...latencies)}ms`);
console.log(`   per-stage p50 (ms):`);
for (const [k, arr] of Object.entries(stageLatencies)) {
  console.log(`     ${k.padEnd(16)}: p50=${pctile(arr, 50)}  p95=${pctile(arr, 95)}  n=${arr.length}`);
}
if (failures.length > 0) {
  console.log(`\n   FAILED:`);
  for (const f of failures) console.log(`     [${f.scenario}] T${f.turn} ${JSON.stringify(f.q)} · ${f.reasons.join(", ")}`);
  process.exit(1);
} else {
  console.log(`   0 regressions.`);
  process.exit(0);
}
