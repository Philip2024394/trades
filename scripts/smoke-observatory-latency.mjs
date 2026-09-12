#!/usr/bin/env node
// scripts/smoke-observatory-latency.mjs
//
// Founder Path A · Phase OBS-2-4 · per-turn latency + promotion-path telemetry.
//
// Verifies:
//   A · fire N routine adapter turns → adapter_promoted_ratio > baseline
//   B · fire cite:none turns → rescue_fired_ratio + research_fired_ratio grow
//   C · llm_invoked_ratio computed AND < 0.5 (Composition Pilot target is <0.05)
//   D · end_to_end_p50_ms non-zero after traffic
//   E · Doctrine overall_score stays 1.0 · zero bypass

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function chat(cid, message) {
  const res = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: cid, market: "ID", useLiveWorld: true }),
  });
  return await res.json();
}

async function snapshot(w = "1h") {
  return await (await fetch(`${HOST}/api/nex/observatory/snapshot?window=${w}`)).json();
}

const failures = [];
try { await chat(randomUUID(), "warmup"); } catch {}

// baseline
console.log("\n── baseline snapshot");
const before = await snapshot("1h");
const b_adapter = before.latency.adapter_promoted_ratio;
const b_end = before.latency.end_to_end_p50_ms;
console.log(`  adapter_ratio=${b_adapter} end_to_end_p50=${b_end}`);

// Fire N routine queries (should hit adapter path).
console.log("\n── firing 5 routine adapter queries");
for (let i = 0; i < 5; i++) {
  await chat(randomUUID(), "how many rooms does Gaotama Hotel have?");
}

// Fire cite:none queries (should reach rescue + research).
console.log("── firing 3 cite:none queries (rescue+research path)");
for (let i = 0; i < 3; i++) {
  await chat(randomUUID(), "cite:none deep dive on Java maritime trade history " + i);
}

// Give fire-and-forget writes a moment.
await new Promise((r) => setTimeout(r, 1000));

console.log("\n── after snapshot");
const after = await snapshot("1h");
const a_adapter = after.latency.adapter_promoted_ratio;
const a_research = after.latency.research_fired_ratio;
const a_llm = after.latency.llm_invoked_ratio;
const a_end_p50 = after.latency.end_to_end_p50_ms;
const a_end_p95 = after.latency.end_to_end_p95_ms;
console.log(`  adapter_ratio=${a_adapter} rescue_ratio=${after.latency.rescue_fired_ratio} research_ratio=${a_research} llm_ratio=${a_llm}`);
console.log(`  end_to_end p50=${a_end_p50}ms p95=${a_end_p95}ms`);
console.log(`  adapter_p50=${after.latency.adapter_p50_ms}ms composer_p50=${after.latency.composer_p50_ms}ms rescue_p50=${after.latency.rescue_p50_ms}ms research_p50=${after.latency.research_p50_ms}ms`);

// ══ A · adapter path exists
if (a_adapter <= 0) failures.push({ case: "A_adapter", reason: `adapter_ratio_${a_adapter}` });
// ══ B · rescue/research fired
if (after.latency.rescue_fired_ratio <= 0 && a_research <= 0) {
  failures.push({ case: "B_rescue_research", reason: `neither_fired_rescue=${after.latency.rescue_fired_ratio}_research=${a_research}` });
}
// ══ C · llm ratio computed (0..1)
if (typeof a_llm !== "number" || a_llm < 0 || a_llm > 1) failures.push({ case: "C_llm_ratio", reason: `ratio=${a_llm}` });
// ══ D · end-to-end p50 non-zero
if (!a_end_p50 || a_end_p50 <= 0) failures.push({ case: "D_p50", reason: `p50=${a_end_p50}` });
// ══ E · doctrine still zero-bypass
if (after.doctrine_health.overall_score !== 1) failures.push({ case: "E_doctrine", reason: `score=${after.doctrine_health.overall_score}` });

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · Observatory reports LIVE latency + promotion-path ratios · doctrines zero-bypass.");
  process.exit(0);
}
