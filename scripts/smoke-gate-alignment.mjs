#!/usr/bin/env node
// scripts/smoke-gate-alignment.mjs
//
// Founder Path A · Phase A1 · Fabrication Gate v2 regression.
// Claim-span alignment scoring · postrationalisation detection.
//
// Doctrine anchor: Doctrine #1 · LLM rescue never bypasses Truth Engine.
// This smoke proves that even when the LLM produces a REAL (in-evidence)
// ref_id, the gate rejects the claim if the cited span does not actually
// support the claim text (postrationalisation per arXiv 2510.24476).
//
// Verifies:
//   A · cite:real (aligned claim) → verified=true · alignment_summary.min ≥ threshold
//   B · cite:orphan → still rejected via source_ref_not_in_evidence (unchanged)
//   C · cite:postrationalisation (real ref, unrelated text) → REJECTED with
//       postrationalisation_suspected reason · reply is honest limitation
//   D · alignment_scores emitted per claim · alignment_summary present
//   E · Doctrine #4 · memory citation still rejected with doctrine_4 reason
//
// Requires: NEX_LLM_RESCUE=1 · NEX_LLM_RESCUE_PROVIDER=mock

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

// ══════════════════════════════════════════════════════════════════
// A · cite:real (aligned) → verified=true · alignment ≥ threshold
// ══════════════════════════════════════════════════════════════════
console.log("\n══ A · cite:real (aligned) → verified · alignment >= threshold");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real xyzzy plugh with details");
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const align = rescue?.alignment_summary;
  console.log(`  verified=${rescue?.verified} align_summary=${JSON.stringify(align)}`);
  if (!rescue) failures.push({ case: "A_aligned", reason: "rescue_did_not_fire" });
  else {
    if (!rescue.verified) failures.push({ case: "A_aligned", reason: "verdict_not_verified" });
    if (!align) failures.push({ case: "A_aligned", reason: "no_alignment_summary" });
    else if (align.min < align.threshold) failures.push({ case: "A_aligned", reason: `min_${align.min}_below_threshold_${align.threshold}` });
  }
}

// ══════════════════════════════════════════════════════════════════
// B · cite:orphan → rejected via source_ref_not_in_evidence
// ══════════════════════════════════════════════════════════════════
console.log("\n══ B · cite:orphan (ref not in evidence) → rejected (unchanged behavior)");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:orphan xyzzy plugh with photo");
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const reasons = (rescue?.rejected_claims ?? []).map((x) => x.reason);
  console.log(`  verified=${rescue?.verified} reasons=${JSON.stringify(reasons)}`);
  if (!rescue) failures.push({ case: "B_orphan", reason: "rescue_did_not_fire" });
  else {
    if (rescue.verified) failures.push({ case: "B_orphan", reason: "orphan_accepted" });
    if (!reasons.some((r) => r.startsWith("source_ref_not_in_evidence:"))) {
      failures.push({ case: "B_orphan", reason: "orphan_wrong_reason" });
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// C · cite:postrationalisation → real ref but unrelated text → REJECTED
// ══════════════════════════════════════════════════════════════════
console.log("\n══ C · cite:postrationalisation → real ref + unrelated text → REJECTED");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:postrationalisation xyzzy plugh detail");
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const reasons = (rescue?.rejected_claims ?? []).map((x) => x.reason);
  const align = rescue?.alignment_summary;
  const reply = String(r.body?.reply ?? "");
  console.log(`  verified=${rescue?.verified} reasons=${JSON.stringify(reasons)} align=${JSON.stringify(align)}`);
  console.log(`  reply: ${JSON.stringify(reply.slice(0, 80))}`);
  if (!rescue) failures.push({ case: "C_postrationalisation", reason: "rescue_did_not_fire" });
  else {
    if (rescue.verified) failures.push({ case: "C_postrationalisation", reason: "postrationalisation_accepted" });
    if (!reasons.some((r) => r.startsWith("postrationalisation_suspected:"))) {
      failures.push({ case: "C_postrationalisation", reason: `wrong_reason_got_${JSON.stringify(reasons)}` });
    }
    if (reply.toLowerCase().includes("xenopus laevis")) {
      failures.push({ case: "C_postrationalisation", reason: "FABRICATED_CONTENT_LEAKED" });
    }
    // Honest reply is EITHER the LLM-rescue limitation OR a Research Brain
    // fallback that itself was fabrication-gate validated. Both are OK.
    if (!reply.includes("couldn't verify") && !reply.startsWith("Based on research:")) {
      failures.push({ case: "C_postrationalisation", reason: "no_honest_reply_pattern" });
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// D · alignment_scores emitted per claim
// ══════════════════════════════════════════════════════════════════
console.log("\n══ D · alignment_scores per claim in debug meta");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real xyzzy plugh alignment observability");
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const scores = rescue?.alignment_scores ?? [];
  console.log(`  scores=${JSON.stringify(scores)}`);
  if (scores.length < 1) failures.push({ case: "D_observability", reason: "no_alignment_scores" });
  else {
    for (const s of scores) {
      if (typeof s.score !== "number") failures.push({ case: "D_observability", reason: "score_not_number" });
      if (!s.method) failures.push({ case: "D_observability", reason: "no_method" });
      if (!s.source_ref) failures.push({ case: "D_observability", reason: "no_source_ref" });
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// E · Doctrine #4 · memory citation still rejected
// ══════════════════════════════════════════════════════════════════
console.log("\n══ E · Doctrine #4 · memory citation still rejected");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:memory xyzzy plugh detail", { user_id: "phil+gate2@memory.local" });
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const reasons = (rescue?.rejected_claims ?? []).map((x) => x.reason);
  console.log(`  verified=${rescue?.verified} reasons=${JSON.stringify(reasons)}`);
  if (!rescue) failures.push({ case: "E_doctrine4", reason: "rescue_did_not_fire" });
  else {
    if (rescue.verified) failures.push({ case: "E_doctrine4", reason: "memory_accepted" });
    if (!reasons.some((r) => r.startsWith("doctrine_4_memory_is_not_truth:"))) {
      failures.push({ case: "E_doctrine4", reason: "wrong_reason" });
    }
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · Fabrication Gate v2 · alignment enforced · postrationalisation caught.");
  process.exit(0);
}
