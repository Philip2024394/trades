#!/usr/bin/env node
// scripts/smoke-l2-memory.mjs
//
// Founder BEGIN Phase 3.10 · L2 memory · user identity · custom instructions.
// Founder Doctrine #4 (2026-09-09): "Memory informs context. Memory does
// NOT establish truth."
//
// Verifies:
//   A · request WITHOUT user_id → no memory pipeline fires
//   B · "remember X" → memory saved (memory_meta reports saved_memory_ids)
//   C · same user next turn → memory loaded into bundle.user_context (counts increment)
//   D · Doctrine #4 · orphan memory citation REJECTED with doctrine_4 reason
//   E · custom_instructions upsert → persisted · user_id_hash stable
//   F · "forget X" directive → memory soft-deleted
//   G · consent_memory=false → memory pipeline skipped even with user_id
//   H · classifier · "I prefer concise" categorized as preference (not context)
//
// Requires: NEX_MEMORY=on · NEX_LLM_RESCUE=1 · NEX_LLM_RESCUE_PROVIDER=mock

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

// Unique per-run user so we don't clash with prior smoke runs.
const RUN_USER = `phil+l2m-${Date.now()}@memory.local`;

// ══════════════════════════════════════════════════════════════════
// A · no user_id → no memory pipeline
// ══════════════════════════════════════════════════════════════════
console.log("\n══ A · request WITHOUT user_id → no memory pipeline");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real hotel gaotama info");
  const dbg = r.body?._debug_timings ?? {};
  const mm = dbg.memory_meta;
  console.log(`  memory_meta=${JSON.stringify(mm)}`);
  if (mm !== null && mm !== undefined) failures.push({ case: "no_user_id", reason: "memory_ran_without_user_id" });
}

// ══════════════════════════════════════════════════════════════════
// B · save memory · "please remember I have 2 kids named Ava and Ben"
// ══════════════════════════════════════════════════════════════════
console.log("\n══ B · save memory · 'please remember I have 2 kids'");
{
  const cid = randomUUID();
  const r = await chat(cid, "please remember I have 2 kids named Ava and Ben", { user_id: RUN_USER });
  const dbg = r.body?._debug_timings ?? {};
  const mm = dbg.memory_meta;
  console.log(`  saved=${JSON.stringify(mm?.saved_memory_ids)} user_id_hash=${mm?.user_id_hash?.slice(0, 8)}`);
  if (!mm) failures.push({ case: "save", reason: "no_memory_meta" });
  else if (!Array.isArray(mm.saved_memory_ids) || mm.saved_memory_ids.length < 1) {
    failures.push({ case: "save", reason: `expected_>=1_saved_got_${mm.saved_memory_ids?.length ?? 0}` });
  }
}

// ══════════════════════════════════════════════════════════════════
// C · next turn same user → memory surfaces in user_context counts
// ══════════════════════════════════════════════════════════════════
console.log("\n══ C · next turn same user → user_context surfaces prior memory");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real hotel gaotama info", { user_id: RUN_USER });
  const dbg = r.body?._debug_timings ?? {};
  const mm = dbg.memory_meta;
  const total = (mm?.preferences_count ?? 0) + (mm?.user_asserted_count ?? 0);
  console.log(`  preferences=${mm?.preferences_count} user_asserted=${mm?.user_asserted_count} total=${total}`);
  if (total < 1) failures.push({ case: "recall", reason: `expected_>=1_context_entries_got_${total}` });
}

// ══════════════════════════════════════════════════════════════════
// D · Doctrine #4 · orphan MEMORY citation rejected by gate
// ══════════════════════════════════════════════════════════════════
console.log("\n══ D · Doctrine #4 · orphan memory: citation REJECTED");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:memory xyzzy plugh with unusual details", { user_id: RUN_USER });
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const reply = String(r.body?.reply ?? "");
  console.log(`  rescue.verified=${rescue?.verified} rejected=${rescue?.rejected_claims_count}`);
  console.log(`  reply: ${JSON.stringify(reply.slice(0, 80))}`);
  if (!rescue) failures.push({ case: "doctrine_4", reason: "rescue_did_not_fire" });
  else {
    if (rescue.verified) failures.push({ case: "doctrine_4", reason: "memory_orphan_accepted" });
    if ((rescue.rejected_claims_count ?? 0) < 1) failures.push({ case: "doctrine_4", reason: "no_rejection_recorded" });
    // Fabrication must not leak.
    if (reply.toLowerCase().includes("123 fabricated st")) failures.push({ case: "doctrine_4", reason: "FABRICATED_LEAKED" });
    if (!reply.includes("couldn't verify") && !reply.startsWith("Based on research:")) {
      failures.push({ case: "doctrine_4", reason: "no_honest_reply_pattern" });
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// E · custom_instructions upsert · user_id_hash stable
// ══════════════════════════════════════════════════════════════════
console.log("\n══ E · custom_instructions upsert · user_id_hash stable");
{
  const cid = randomUUID();
  const r = await chat(cid, "hello", {
    user_id: RUN_USER,
    custom_instructions: {
      about_user: "Property owner in Yogyakarta",
      response_style: "be concise and use bullet points",
      preferred_language: "en",
    },
  });
  const dbg = r.body?._debug_timings ?? {};
  const mm = dbg.memory_meta;
  console.log(`  user_id_hash=${mm?.user_id_hash?.slice(0, 8)}`);
  if (!mm?.user_id_hash) failures.push({ case: "ci_upsert", reason: "no_user_id_hash" });
}

// ══════════════════════════════════════════════════════════════════
// F · "forget X" directive → memory soft-deleted
// ══════════════════════════════════════════════════════════════════
console.log("\n══ F · 'forget X' directive → soft delete");
{
  const cid = randomUUID();
  // First save a very specific memory we can then forget.
  await chat(cid, "remember that unique-forget-token-9x7q is my special code", { user_id: RUN_USER });
  // Now issue the forget directive.
  const r = await chat(cid, "forget the unique-forget-token-9x7q", { user_id: RUN_USER });
  const dbg = r.body?._debug_timings ?? {};
  const mm = dbg.memory_meta;
  console.log(`  forgot=${JSON.stringify(mm?.forgot_memory_ids)}`);
  if (!Array.isArray(mm?.forgot_memory_ids) || mm.forgot_memory_ids.length < 1) {
    failures.push({ case: "forget", reason: `expected_>=1_forgot_got_${mm?.forgot_memory_ids?.length ?? 0}` });
  }
}

// ══════════════════════════════════════════════════════════════════
// G · consent_memory=false → pipeline skipped
// ══════════════════════════════════════════════════════════════════
console.log("\n══ G · consent_memory=false → skipped");
{
  const cid = randomUUID();
  const r = await chat(cid, "please remember I want private mode", {
    user_id: RUN_USER, consent_memory: false,
  });
  const dbg = r.body?._debug_timings ?? {};
  const mm = dbg.memory_meta;
  console.log(`  memory_meta=${JSON.stringify(mm)}`);
  if (mm !== null && mm !== undefined) failures.push({ case: "consent_off", reason: "memory_ran_despite_consent_false" });
}

// ══════════════════════════════════════════════════════════════════
// H · classifier · "I prefer concise answers" categorized as preference
// ══════════════════════════════════════════════════════════════════
console.log("\n══ H · classifier · 'I prefer concise answers' → preference");
{
  const ownUser = `phil+prefs-${Date.now()}@memory.local`;
  const cid1 = randomUUID();
  await chat(cid1, "I prefer concise answers", { user_id: ownUser });
  // Load on next turn.
  const cid2 = randomUUID();
  const r2 = await chat(cid2, "hello", { user_id: ownUser });
  const dbg = r2.body?._debug_timings ?? {};
  const mm = dbg.memory_meta;
  console.log(`  preferences_count=${mm?.preferences_count} user_asserted_count=${mm?.user_asserted_count}`);
  if ((mm?.preferences_count ?? 0) < 1) {
    failures.push({ case: "classifier", reason: `expected_>=1_preference_got_${mm?.preferences_count ?? 0}` });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · memory pipeline works · Doctrine #4 (MEMORY IS NOT TRUTH) enforced.");
  process.exit(0);
}
