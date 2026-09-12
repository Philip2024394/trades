#!/usr/bin/env node
// scripts/smoke-observatory.mjs
//
// Founder Path A · Phase C1-4 · Observatory Brain regression.
// Verifies gate_rejection_event + gate_kept_event are written correctly
// and Observatory reports REAL numbers.
//
// Verifies:
//   A · trigger orphan cite → orphan_citations increments
//   B · trigger postrationalisation → postrationalisation_suspected increments
//   C · trigger memory cite → doctrine_4_memory increments
//   D · kept claim → verified_replies increments · alignment stats populated
//   E · postrationalisation_rate > 0 after B
//   F · Doctrine overall_score stays 1.0 (rejections are wins, not violations)

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

async function snapshot(w = "1h") {
  const res = await fetch(`${HOST}/api/nex/observatory/snapshot?window=${w}`);
  return await res.json();
}

const failures = [];
try { await chat(randomUUID(), "warmup"); } catch {}

// Take baseline BEFORE firing test claims.
console.log("\n── baseline snapshot");
const before = await snapshot("1h");
const b_orphan = before.doctrine_health.doctrine_1_gate_rejections.orphan_citations;
const b_postrat = before.doctrine_health.doctrine_1_gate_rejections.postrationalisation_suspected;
const b_memory = before.doctrine_health.doctrine_1_gate_rejections.memory_citations_reject;
const b_verified = before.groundedness.verified_replies;
console.log(`  orphan=${b_orphan} postrat=${b_postrat} memory=${b_memory} verified=${b_verified}`);

// Fire N rejection scenarios · Fabrication Gate writes rows to nex.gate_rejection_event.
console.log("\n── firing scenarios");
await chat(randomUUID(), "cite:orphan xyzzy plugh with unusual detail");
await chat(randomUUID(), "cite:orphan zzz something else");
await chat(randomUUID(), "cite:postrationalisation xyzzy plugh");
await chat(randomUUID(), "cite:memory xyzzy plugh detail", { user_id: "phil+obs@test.local" });
await chat(randomUUID(), "cite:real xyzzy plugh nice details"); // kept · aligned

// Give the fire-and-forget writes a moment to land.
await new Promise((r) => setTimeout(r, 800));

console.log("\n── after snapshot");
const after = await snapshot("1h");
const a_orphan = after.doctrine_health.doctrine_1_gate_rejections.orphan_citations;
const a_postrat = after.doctrine_health.doctrine_1_gate_rejections.postrationalisation_suspected;
const a_memory = after.doctrine_health.doctrine_1_gate_rejections.memory_citations_reject;
const a_verified = after.groundedness.verified_replies;
console.log(`  orphan=${a_orphan} postrat=${a_postrat} memory=${a_memory} verified=${a_verified}`);
console.log(`  postrationalisation_rate=${after.groundedness.postrationalisation_rate} alignment_p50=${after.groundedness.alignment_p50} alignment_max=${after.groundedness.alignment_max}`);
console.log(`  doctrine overall_score=${after.doctrine_health.overall_score}`);

// ══ A · orphan increment
if ((a_orphan - b_orphan) < 2) failures.push({ case: "A_orphan", reason: `orphan_delta_${a_orphan - b_orphan}<2` });
// ══ B · postrationalisation increment
if ((a_postrat - b_postrat) < 1) failures.push({ case: "B_postrationalisation", reason: `postrat_delta_${a_postrat - b_postrat}<1` });
// ══ C · memory increment
if ((a_memory - b_memory) < 1) failures.push({ case: "C_memory", reason: `memory_delta_${a_memory - b_memory}<1` });
// ══ D · verified increment + alignment stats populated
if ((a_verified - b_verified) < 1) failures.push({ case: "D_verified", reason: `verified_delta_${a_verified - b_verified}<1` });
if (after.groundedness.alignment_max <= 0) failures.push({ case: "D_alignment", reason: `alignment_max_${after.groundedness.alignment_max}` });
// ══ E · postrationalisation_rate > 0
if (after.groundedness.postrationalisation_rate <= 0) failures.push({ case: "E_rate", reason: `rate_${after.groundedness.postrationalisation_rate}` });
// ══ F · overall_score stays 1.0 (rejections are wins)
if (after.doctrine_health.overall_score !== 1) failures.push({ case: "F_score", reason: `score_${after.doctrine_health.overall_score}` });

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · Observatory reports REAL groundedness · doctrines still zero-violation.");
  process.exit(0);
}
