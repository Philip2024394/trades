#!/usr/bin/env node
// scripts/smoke-l2-memory-tiered.mjs
//
// Founder Path A · L2M-Tiered regression.
//
// Verifies:
//   A · "I always X" → procedural memory saved · tier_counts.procedural > 0 on recall
//   B · "yesterday I did X" → episodic memory saved · tier_counts.episodic > 0
//   C · plain preference → semantic memory · tier_counts.semantic > 0
//   D · Doctrine #4 still holds · memory citations rejected regardless of tier
//   E · saved memory persists across turns (recall works)

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function chat(cid, message, extra = {}) {
  const res = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: cid, market: "ID", useLiveWorld: true, ...extra }),
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: { _parse_error: text.slice(0, 200) } }; }
}

const failures = [];
try { await chat(randomUUID(), "warmup"); } catch {}

const USER_A = `phil+tier-proc-${Date.now()}@memory.local`;
const USER_B = `phil+tier-epi-${Date.now()}@memory.local`;
const USER_C = `phil+tier-sem-${Date.now()}@memory.local`;
const USER_D = `phil+tier-doc4-${Date.now()}@memory.local`;

// ══ A · procedural
console.log("\n══ A · 'I always X' → procedural");
{
  await chat(randomUUID(), "I always book window seats", { user_id: USER_A });
  const r = await chat(randomUUID(), "hello", { user_id: USER_A });
  const mm = r.body?._debug_timings?.memory_meta;
  console.log(`  tier_counts=${JSON.stringify(mm?.tier_counts)}`);
  if (!mm?.tier_counts) failures.push({ case: "A", reason: "no_tier_counts" });
  else if ((mm.tier_counts.procedural ?? 0) < 1) failures.push({ case: "A", reason: `expected_procedural_got_${mm.tier_counts.procedural}` });
}

// ══ B · episodic
console.log("\n══ B · 'yesterday I did X' → episodic");
{
  await chat(randomUUID(), "please remember I ate at Sate Klathak yesterday", { user_id: USER_B });
  const r = await chat(randomUUID(), "hello", { user_id: USER_B });
  const mm = r.body?._debug_timings?.memory_meta;
  console.log(`  tier_counts=${JSON.stringify(mm?.tier_counts)}`);
  if ((mm?.tier_counts?.episodic ?? 0) < 1) failures.push({ case: "B", reason: `expected_episodic_got_${mm?.tier_counts?.episodic}` });
}

// ══ C · semantic (default)
console.log("\n══ C · plain preference → semantic");
{
  await chat(randomUUID(), "I prefer concise answers", { user_id: USER_C });
  const r = await chat(randomUUID(), "hello", { user_id: USER_C });
  const mm = r.body?._debug_timings?.memory_meta;
  console.log(`  tier_counts=${JSON.stringify(mm?.tier_counts)}`);
  if ((mm?.tier_counts?.semantic ?? 0) < 1) failures.push({ case: "C", reason: `expected_semantic_got_${mm?.tier_counts?.semantic}` });
}

// ══ D · Doctrine #4 unchanged
console.log("\n══ D · Doctrine #4 · memory citations still rejected regardless of tier");
{
  await chat(randomUUID(), "I always drink black coffee in the morning", { user_id: USER_D });
  const r = await chat(randomUUID(), "cite:memory xyzzy plugh detail", { user_id: USER_D });
  const rescue = r.body?._debug_timings?.llm_rescue_verdict;
  const reasons = (rescue?.rejected_claims ?? []).map((x) => x.reason);
  console.log(`  verified=${rescue?.verified} reasons=${JSON.stringify(reasons)}`);
  if (rescue?.verified) failures.push({ case: "D", reason: "memory_cite_accepted" });
  if (!reasons.some((r) => r.startsWith("doctrine_4_memory_is_not_truth:"))) {
    failures.push({ case: "D", reason: "doctrine_4_reason_missing" });
  }
}

// ══ E · recall across turns
console.log("\n══ E · recall works across turns");
{
  const cid = randomUUID();
  const r = await chat(cid, "hello again", { user_id: USER_A });
  const mm = r.body?._debug_timings?.memory_meta;
  if ((mm?.preferences_count ?? 0) + (mm?.user_asserted_count ?? 0) < 1) {
    failures.push({ case: "E", reason: `no_memories_recalled` });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · L2M-Tiered green · semantic/episodic/procedural surfaced · Doctrine #4 holds.");
  process.exit(0);
}
