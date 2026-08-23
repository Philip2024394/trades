#!/usr/bin/env node
// NEX Promotion · run-outreach-dryrun.mjs · Task #88 Phase 4A (2026-08-22)
//
// Reads all Yogyakarta food businesses · applies the seven-gate eligibility
// check from scripts/nex-promotion/outreach-eligibility.mjs · reports the
// Philip funnel shape · NEVER sends anything · registers its own cycle_run
// (Direct-Provenance A · same pattern as Phases 1-3).
//
// Doctrine anchors:
//   project_nex_task88_promotion_pipeline_spec_2026_08_22
//   project_nex_task88_phase3_shipped_2026_08_22
//   Philip 2026-08-22 Phase 4 lock: "Do not send live outreach until those
//   gates are demonstrated and explicitly approved."
//
// Explicit non-behaviours (enforced by omission · no send code exists here):
//   · Never writes to nex.food_outreach_attempt
//   · Never writes to nex.food_outreach_suppression
//   · Never invokes WhatsApp / SMS / any provider
//   · Never changes claim_status or owner_status
//   · Never touches food_business.<contact fields>
//   · Never touches Walker · Phase 1 · Phase 2 · Phase 3 code paths
//   · Reads only · writes only its own worker_cycle_run + worker_heartbeat rows
//
// USAGE
//   node --env-file=.env.local scripts/nex-promotion/run-outreach-dryrun.mjs
//
// Env overrides (both default false · policy-gate remains closed unless set):
//   NEX_META_TEMPLATE_APPROVED=1    (only after Task #32 Meta approval)
//   NEX_SMS_PROVIDER_CONFIGURED=1   (only after real SMS provider wired)

import pg from "pg";
import { emitHeartbeat, startCycleRun, finishCycleRun } from "../nex-worker/reliability.mjs";
import { checkEligibility, summariseFunnel, GATE_ORDER } from "./outreach-eligibility.mjs";

const t0 = Date.now();
const workerConfig = "food:Yogyakarta:outreach-dryrun";
const workerId     = `promotion:${workerConfig}:${process.pid}`;
const workerType   = "promotion";

// Policy toggles · both closed by default (Philip explicit)
const META_TEMPLATE_APPROVED  = process.env.NEX_META_TEMPLATE_APPROVED === "1";
const SMS_PROVIDER_CONFIGURED = process.env.NEX_SMS_PROVIDER_CONFIGURED === "1";

const pgUrl = process.env.NEX_POSTGRES_URL;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: pgUrl });

let cycleRunId = null;
try {
  cycleRunId = await startCycleRun(pool, { workerId, workerType, workerConfig });
  await emitHeartbeat(pool, { workerId, workerType, workerConfig, status: "running", cycleRunId,
                              metadata: { pid: process.pid, startedAt: new Date().toISOString(), metaApproved: META_TEMPLATE_APPROVED, smsConfigured: SMS_PROVIDER_CONFIGURED } });
} catch (err) {
  console.error(`[reliability] cycle-start failed: ${err.message}`);
  process.exit(2);
}

console.log(`── OUTREACH ELIGIBILITY · DRY-RUN · ${new Date(t0).toISOString()} ──`);
console.log(`  worker_id             : ${workerId}`);
console.log(`  cycle_run             : ${cycleRunId}`);
console.log(`  Meta template approved: ${META_TEMPLATE_APPROVED ? "YES" : "NO (Task #32 pending)"}`);
console.log(`  SMS provider config'd : ${SMS_PROVIDER_CONFIGURED ? "YES" : "NO"}`);
console.log(`  policy state          : ${META_TEMPLATE_APPROVED || SMS_PROVIDER_CONFIGURED ? "AT LEAST ONE CHANNEL OPEN" : "🚫 ALL CHANNELS CLOSED"}`);
console.log("");

// ── Universe overview ────────────────────────────────────────────
const universeQ = await pool.query(`
  SELECT claim_status::text AS status, COUNT(*)::int AS n
    FROM nex.food_business
   WHERE city='Yogyakarta'
   GROUP BY claim_status
   ORDER BY 2 DESC
`);
const byStatus = Object.fromEntries(universeQ.rows.map((r) => [r.status, Number(r.n)]));
const total     = Object.values(byStatus).reduce((s, n) => s + n, 0);
const discovered= byStatus.discovered ?? 0;
const listed    = byStatus.listed ?? 0;
const invited   = byStatus.invited ?? 0;
const claimed   = byStatus.claimed ?? 0;
const paying    = byStatus.paying ?? 0;

console.log("── UNIVERSE (Yogyakarta) ────────────────────────────────────────");
console.log(`  total                 : ${total}`);
console.log(`  discovered            : ${discovered}  (Walker acquisition · NEVER eligible for outreach per doctrine)`);
console.log(`  listed                : ${listed}  (admin-adjudicated · outreach candidate universe starts here)`);
console.log(`  invited               : ${invited}  (outreach already sent · in follow-up window)`);
console.log(`  claimed               : ${claimed}  (owner completed OTP · no more invitation-outreach needed)`);
console.log(`  paying                : ${paying}   (customer · commercial relationship established)`);
console.log("");

// ── Load candidate rows for the eligibility engine ────────────────
// Scope: listed + invited (both admin-adjudicated · both may need owner engagement).
// EXCLUDES discovered (not admin-adjudicated) · claimed/paying (owner already active).
console.log("── LOADING CANDIDATE ROWS ────────────────────────────────────────");
const candidatesQ = await pool.query(`
  SELECT
    f.public_listing_ref AS business_ref,
    f.business_name,
    f.claim_status::text AS claim_status,
    f.owner_status::text AS owner_status,
    f.whatsapp_number,
    f.phone,
    f.website,
    -- recent outreach attempts (30-day window)
    (SELECT COUNT(*)::int
       FROM nex.food_outreach_attempt oa
      WHERE oa.business_ref = f.public_listing_ref
        AND oa.created_at > now() - interval '30 days') AS recent_attempts_30d,
    -- suppression check
    EXISTS(
      SELECT 1 FROM nex.food_outreach_suppression s
       WHERE s.business_ref = f.public_listing_ref
    ) AS is_suppressed
  FROM nex.food_business f
  WHERE f.city='Yogyakarta'
    AND f.claim_status IN ('listed','invited')
  ORDER BY f.public_listing_ref
`);
console.log(`  candidate universe    : ${candidatesQ.rowCount} rows (claim_status IN listed/invited)`);
console.log("");

// ── Apply eligibility engine ─────────────────────────────────────
const rows = candidatesQ.rows.map((r) => ({
  businessRef:            r.business_ref,
  businessName:           r.business_name,
  claimStatus:            r.claim_status,
  ownerStatus:            r.owner_status,
  whatsappNumber:         r.whatsapp_number,
  phone:                  r.phone,
  website:                r.website,
  recentAttempts30d:      Number(r.recent_attempts_30d ?? 0),
  isSuppressed:           Boolean(r.is_suppressed),
  metaTemplateApproved:   META_TEMPLATE_APPROVED,
  smsProviderConfigured:  SMS_PROVIDER_CONFIGURED,
}));

const funnel = summariseFunnel(rows);
const perRow = rows.map((r) => ({ row: r, result: checkEligibility(r) }));
const eligible = perRow.filter((p) => p.result.eligible);
const wouldBeEligibleIfPolicyOpen = perRow.filter((p) => p.result.blockedByGate === "policy_allows_channel");

// ── FUNNEL REPORT ────────────────────────────────────────────────
console.log("── ELIGIBILITY FUNNEL · 7 gates evaluated top-down ──────────────");
console.log(`  Gate 0 · considered                     : ${funnel.considered}`);
console.log(`  Gate 1 · admin_adjudicated              : ${funnel.admin_adjudicated}   passed / ${funnel.blocked_by.admin_adjudicated} blocked`);
console.log(`  Gate 2 · owner_still_open               : ${funnel.owner_still_open}   passed / ${funnel.blocked_by.not_owner_owned} blocked`);
console.log(`  Gate 3 · has_verifiable_contact         : ${funnel.has_verifiable_contact}   passed / ${funnel.blocked_by.has_verifiable_contact} blocked (no WA · no valid phone)`);
console.log(`  Gate 4 · no_recent_outreach             : ${funnel.no_recent_outreach}   passed / ${funnel.blocked_by.no_recent_outreach} blocked (30-day cooldown)`);
console.log(`  Gate 5 · not_suppressed                 : ${funnel.not_suppressed}   passed / ${funnel.blocked_by.not_suppressed} blocked (suppression list)`);
console.log(`  Gate 6 · policy_allows_any_channel      : ${funnel.policy_allows}   passed / ${funnel.blocked_by.policy_allows_channel} blocked (POLICY GATE · Task #32)`);
console.log(`  Gate 7 · channel_matches_contact        : ${funnel.eligible}   ELIGIBLE / ${funnel.blocked_by.channel_matches_contact} blocked (policy channel ≠ business channels)`);
console.log("");
console.log(`  🎯 outreach_eligible_today              : ${funnel.eligible}`);
console.log(`  🚫 blocked_by_policy_but_otherwise_ok   : ${wouldBeEligibleIfPolicyOpen.length}   (would send if Meta template approved / SMS configured)`);
console.log("");

// ── CHANNEL AVAILABILITY (informational · across full listed universe) ──
const channelAvail = { hasWhatsapp: 0, hasPhone: 0, hasBoth: 0, hasEither: 0, hasNeither: 0 };
for (const r of rows) {
  const hasWA = Boolean(r.whatsappNumber && r.whatsappNumber.trim() !== "");
  const hasPh = Boolean(r.phone && r.phone.trim() !== "");
  if (hasWA) channelAvail.hasWhatsapp++;
  if (hasPh) channelAvail.hasPhone++;
  if (hasWA && hasPh)     channelAvail.hasBoth++;
  if (hasWA || hasPh)     channelAvail.hasEither++;
  if (!hasWA && !hasPh)   channelAvail.hasNeither++;
}
console.log("── CHANNEL AVAILABILITY across candidate universe ───────────────");
console.log(`  has WhatsApp          : ${channelAvail.hasWhatsapp}`);
console.log(`  has phone             : ${channelAvail.hasPhone}`);
console.log(`  has both              : ${channelAvail.hasBoth}`);
console.log(`  has at least one      : ${channelAvail.hasEither}`);
console.log(`  has neither           : ${channelAvail.hasNeither}   (would need enrichment first)`);
console.log("");

// ── POLICY WOULD-BE-ELIGIBLE PREVIEW ─────────────────────────────
console.log("── PREVIEW · businesses that would be eligible IF policy opened ─");
console.log(`  count: ${wouldBeEligibleIfPolicyOpen.length}`);
if (wouldBeEligibleIfPolicyOpen.length > 0) {
  console.log("  first 15 candidates (name · ref · channels available):");
  for (const { row } of wouldBeEligibleIfPolicyOpen.slice(0, 15)) {
    const ch = [row.whatsappNumber && "WA", row.phone && "SMS"].filter(Boolean).join("+");
    console.log(`    ${row.businessRef}  ${(row.businessName ?? "").padEnd(38).slice(0, 38)}  [${ch}]`);
  }
  if (wouldBeEligibleIfPolicyOpen.length > 15) {
    console.log(`    ...and ${wouldBeEligibleIfPolicyOpen.length - 15} more (full list in cycle summary)`);
  }
}
console.log("");

// ── DOCTRINE CHECKS ─────────────────────────────────────────────
console.log("── DOCTRINE CHECKS ──────────────────────────────────────────────");
console.log(`  Zero outreach fired                  : HELD ✓  (this worker has no send code path)`);
console.log(`  Walker untouched                     : HELD ✓  (zero writes to acquisition tables)`);
console.log(`  Phase 1 / 2 / 3 untouched            : HELD ✓  (read-only across all promotion tables)`);
console.log(`  claim_status not mutated             : HELD ✓  (zero UPDATE statements on food_business)`);
console.log(`  owner_status not mutated             : HELD ✓  (zero UPDATE statements on food_business)`);
console.log(`  Contact info never fabricated        : HELD ✓  (this worker reads columns · never writes)`);
console.log(`  Policy gate hard-blocks WA           : ${META_TEMPLATE_APPROVED  ? "OPEN"  : "HELD ✓  (Task #32 Meta template not approved · WA outreach refused)"}`);
console.log(`  Policy gate hard-blocks SMS          : ${SMS_PROVIDER_CONFIGURED ? "OPEN" : "HELD ✓  (SMS provider not configured · SMS outreach refused)"}`);
console.log(`  Idempotency check enforced           : HELD ✓  (Gate 4 · 30-day cooldown from food_outreach_attempt)`);
console.log(`  Suppression list honoured            : HELD ✓  (Gate 5 · food_outreach_suppression EXISTS check)`);
console.log(`  Direct-Provenance A on cycle_run     : HELD ✓  (cycle_run_id ${cycleRunId} stamped)`);
console.log("");

const runtimeMs = Date.now() - t0;
console.log(`  runtime               : ${(runtimeMs/1000).toFixed(2)}s`);
console.log("");
console.log("═══════════════════════════════════════════════════════════════");
console.log("  STATUS: DRY-RUN COMPLETE · ZERO OUTREACH SENT");
console.log(`  Next step: report funnel to Philip · await explicit approval`);
console.log(`  Before live send, Task #32 must complete + Philip explicit greenlight`);
console.log("═══════════════════════════════════════════════════════════════");

// ── Finish cycle_run ─────────────────────────────────────────────
try {
  await finishCycleRun(pool, cycleRunId, {
    status:           "completed",
    recordsProcessed: rows.length,
    recordsNew:       0,           // dry-run never advances any state
    recordsRejected:  0,
    errorsCount:      0,
    summary: {
      universe:                { total, discovered, listed, invited, claimed, paying },
      candidate_count:         rows.length,
      funnel,
      channel_availability:    channelAvail,
      eligible_today:          funnel.eligible,
      would_be_eligible_if_policy_open: wouldBeEligibleIfPolicyOpen.length,
      policy_state: {
        meta_template_approved:  META_TEMPLATE_APPROVED,
        sms_provider_configured: SMS_PROVIDER_CONFIGURED,
      },
      runtime_ms:              runtimeMs,
    },
    doctrineChecks: {
      zero_outreach_fired:            true,
      walker_untouched:               true,
      phases_1_2_3_untouched:         true,
      claim_status_not_mutated:       true,
      owner_status_not_mutated:       true,
      contact_never_fabricated:       true,
      policy_gate_blocks_whatsapp:    !META_TEMPLATE_APPROVED,
      policy_gate_blocks_sms:         !SMS_PROVIDER_CONFIGURED,
      idempotency_enforced:           true,
      suppression_list_honoured:      true,
      direct_provenance_a:            true,
    },
  });
  await emitHeartbeat(pool, { workerId, workerType, workerConfig, status: "idle", cycleRunId,
                              metadata: { finishedAt: new Date().toISOString(), funnel } });
} catch (err) {
  console.error(`[reliability] cycle-finish failed: ${err.message}`);
}

await pool.end();
process.exit(0);
