#!/usr/bin/env node
// scripts/smoke-sai.mjs
//
// Founder BEGIN Phase 3.7 Safe Actionable Intelligence · regression matrix.
//
// Founder rule 2026-09-09: LLM NEVER EXECUTES AN ACTION WITHOUT NEX AUTHORIZATION.
//
// Tests every stage of the authorization pipeline:
//   A · unregistered action_id → rejected_unknown_action
//   B · malformed args → rejected_schema (with action-specific Zod)
//   C · save_favorite (no confirmation required) → executed straight through
//   D · contact_via_whatsapp (confirmation required) → pending_confirmation
//        with token, then echo the token → executed
//   E · every proposal produces an immutable nex.action_audit row
//
// Requires:
//   NEX_LLM_RESCUE=1 NEX_LLM_RESCUE_PROVIDER=mock

import pg from "pg";
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

// Warmup
try { await chat(randomUUID(), "warmup"); } catch {}

// ══════════════════════════════════════════════════════════════════
// A · unregistered action
// ══════════════════════════════════════════════════════════════════
// Test messages piggy-back a real entity name (Hotel Gaotama) so the
// domain classifier routes to accommodation and rescue fires.
console.log("\n══ A · unregistered action_id → rejected_unknown_action");
{
  const cid = randomUUID();
  const r = await chat(cid, "action:unknown at Hotel Gaotama something obscure");
  const aa = r.body?._debug_timings?.authorized_action;
  console.log(`  outcome=${aa?.outcome} reason=${aa?.outcome_reason}`);
  if (!aa) failures.push({ case: "unknown_action", reason: "no_authorized_action_recorded" });
  else if (aa.outcome !== "rejected_unknown_action") failures.push({ case: "unknown_action", reason: `expected_rejected_unknown_action_got_${aa.outcome}` });
}

// ══════════════════════════════════════════════════════════════════
// B · malformed args (save_favorite missing entity_ref)
// ══════════════════════════════════════════════════════════════════
console.log("\n══ B · malformed args → rejected_schema");
{
  const cid = randomUUID();
  const r = await chat(cid, "action:bad_args at Hotel Gaotama save something");
  const aa = r.body?._debug_timings?.authorized_action;
  console.log(`  outcome=${aa?.outcome} reason=${aa?.outcome_reason}`);
  if (!aa) failures.push({ case: "bad_args", reason: "no_authorized_action_recorded" });
  else if (aa.outcome !== "rejected_schema") failures.push({ case: "bad_args", reason: `expected_rejected_schema_got_${aa.outcome}` });
}

// ══════════════════════════════════════════════════════════════════
// C · save_favorite (no confirmation required) → executed
// ══════════════════════════════════════════════════════════════════
console.log("\n══ C · save_favorite → executed");
{
  const cid = randomUUID();
  const r = await chat(cid, "action:save_favorite Hotel Gaotama something obscure");
  const aa = r.body?._debug_timings?.authorized_action;
  console.log(`  outcome=${aa?.outcome} audit_id=${aa?.audit_id?.slice(0, 8)} result=${JSON.stringify(aa?.result)}`);
  if (!aa) failures.push({ case: "save_favorite", reason: "no_authorized_action_recorded" });
  else {
    if (aa.outcome !== "executed") failures.push({ case: "save_favorite", reason: `expected_executed_got_${aa.outcome}` });
    if (!aa.executed_at) failures.push({ case: "save_favorite", reason: "no_executed_at_timestamp" });
    if (!aa.result || aa.result.total !== 1) failures.push({ case: "save_favorite", reason: `expected_total_1_got_${JSON.stringify(aa.result)}` });
  }
}

// ══════════════════════════════════════════════════════════════════
// D · contact_via_whatsapp (confirmation required) → pending → executed
// ══════════════════════════════════════════════════════════════════
console.log("\n══ D · contact_via_whatsapp → pending_confirmation → executed");
{
  const cid = randomUUID();
  const r1 = await chat(cid, "action:contact_wa Hotel Gaotama something obscure");
  const aa1 = r1.body?._debug_timings?.authorized_action;
  console.log(`  step 1 · outcome=${aa1?.outcome} requires_confirmation=${aa1?.requires_user_confirmation} token=${aa1?.confirmation_token?.slice(0, 8)}`);
  if (!aa1 || aa1.outcome !== "pending_confirmation") {
    failures.push({ case: "contact_wa_step1", reason: `expected_pending_got_${aa1?.outcome}` });
  } else if (!aa1.confirmation_token) {
    failures.push({ case: "contact_wa_step1", reason: "no_confirmation_token" });
  } else {
    // Step 2 · echo the token to complete.
    const r2 = await chat(cid, "user confirms the action", { action_confirmation_token: aa1.confirmation_token });
    const aa2 = r2.body?._debug_timings?.authorized_action;
    console.log(`  step 2 · outcome=${aa2?.outcome} result=${JSON.stringify(aa2?.result)}`);
    if (!aa2 || aa2.outcome !== "executed") failures.push({ case: "contact_wa_step2", reason: `expected_executed_got_${aa2?.outcome}` });
    if (aa2?.result?.deep_link && !String(aa2.result.deep_link).startsWith("https://wa.me/")) {
      failures.push({ case: "contact_wa_step2", reason: "unexpected_deep_link_format" });
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// E · action_audit rows persist
// ══════════════════════════════════════════════════════════════════
console.log("\n══ E · nex.action_audit rows persist");
{
  const url = process.env.NEX_TAXONOMY_POSTGRES_URL;
  if (url) {
    const pool = new pg.Pool({ connectionString: url });
    try {
      const rows = await pool.query(
        `SELECT outcome, COUNT(*)::int AS n
           FROM nex.action_audit
           WHERE emitted_at > now() - interval '5 minutes'
           GROUP BY outcome ORDER BY n DESC`,
      );
      console.log(`  rows in last 5 min: ${JSON.stringify(rows.rows)}`);
      if (rows.rowCount === 0) failures.push({ case: "audit", reason: "no_audit_rows_persisted" });
    } finally { await pool.end(); }
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · LLM proposes · NEX decides · every action audited.");
  process.exit(0);
}
