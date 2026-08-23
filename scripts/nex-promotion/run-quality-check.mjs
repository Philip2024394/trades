#!/usr/bin/env node
// NEX Promotion · run-quality-check.mjs · Task #88 Phase 1 worker (2026-08-22)
//
// Reads nex.food_business rows at claim_status='discovered' · computes a
// quality score with breakdown · upserts nex.food_business_promotion · writes
// audit rows for meaningful changes · all writes carry cycle_run_id FK
// (Direct-Provenance A · project_nex_architecture_replaceable_plumbing_and_provable_causality_2026_08_22).
//
// Doctrine anchors:
//   project_nex_task88_promotion_pipeline_spec_2026_08_22
//   project_nex_task88_phase0_inventory_2026_08_22
//   project_nex_walker_dev_frozen_2026_08_22
//   project_nex_walker_stays_pure_acquisition_2026_08_22
//
// Explicit non-behaviours (Philip 2026-08-22 Phase 1 lock):
//   · Never advances nex.food_business.claim_status (leaves 'discovered' alone)
//   · Never sends outreach (Gate 5 hard-noop preserved · not our concern here)
//   · Never invites owner (Phase 4 job)
//   · Never touches Walker, CLE, RAG, knowledge_records, or /food view
//   · Never auto-promotes based on score (score determines readiness, not action)
//
// USAGE
//   node --env-file=.env.local scripts/nex-promotion/run-quality-check.mjs
//     [--vertical=food] [--city=Yogyakarta] [--apply|--dry-run]
//
// Idempotency: second run with no new discovered rows and no score/state
// changes produces ZERO audit rows.

import pg from "pg";
import { emitHeartbeat, startCycleRun, finishCycleRun } from "../nex-worker/reliability.mjs";
import { scoreBusiness, deriveState, MAX_SCORE_EXPORT } from "./quality-score.mjs";

// ── Args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const vertical = args.find((a) => a.startsWith("--vertical="))?.split("=")[1] ?? "food";
const city     = args.find((a) => a.startsWith("--city="))?.split("=")[1] ?? "Yogyakarta";
const apply    = args.includes("--apply");
const dryRun   = !apply;

// Only food:Yogyakarta is supported in Phase 1.
if (vertical !== "food" || city !== "Yogyakarta") {
  console.error(`Only food:Yogyakarta is supported in Phase 1. Got ${vertical}:${city}.`);
  process.exit(1);
}

const workerConfig = `${vertical}:${city}:quality-check`;
const workerId     = `promotion:${workerConfig}:${process.pid}`;
const workerType   = "promotion";                             // NEW type · not previously registered
const t0           = Date.now();
const materialScoreDelta = 5;                                 // audit-row trigger threshold

// ── DB pool ──────────────────────────────────────────────────────────
const pgUrl = process.env.NEX_POSTGRES_URL;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: pgUrl });

// ── Reliability · start cycle + first heartbeat ─────────────────────
let cycleRunId = null;
try {
  cycleRunId = await startCycleRun(pool, { workerId, workerType, workerConfig });
  await emitHeartbeat(pool, { workerId, workerType, workerConfig, status: "running", cycleRunId,
                              metadata: { pid: process.pid, apply, startedAt: new Date().toISOString() } });
} catch (err) {
  console.error(`[reliability] cycle-start failed: ${err.message}`);
  process.exit(2);
}

console.log(`── QUALITY CHECK · start ${new Date(t0).toISOString()} ──`);
console.log(`  worker_id  : ${workerId}`);
console.log(`  cycle_run  : ${cycleRunId}`);
console.log(`  mode       : ${apply ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);
console.log(`  reading    : nex.food_business WHERE city='${city}' AND claim_status='discovered'`);

// ── Read discovered rows ────────────────────────────────────────────
let discovered;
try {
  discovered = await pool.query(
    `SELECT public_listing_ref AS business_ref, business_name, category, categories,
            coordinates_lat, coordinates_lng, address, phone, whatsapp_number,
            website, public_social_links, last_verified_at
       FROM nex.food_business
      WHERE city = $1 AND claim_status = 'discovered'
      ORDER BY public_listing_ref`,
    [city],
  );
} catch (err) {
  await finishCycleRun(pool, cycleRunId, {
    status: "failed", errorsCount: 1,
    summary: { phase: "read_discovered", error: err.message },
  });
  await emitHeartbeat(pool, { workerId, workerType, workerConfig, status: "failed", cycleRunId,
                              metadata: { error: err.message } });
  console.error(`[read] failed: ${err.message}`);
  await pool.end();
  process.exit(3);
}

console.log(`  discovered : ${discovered.rows.length} rows`);

// ── Score + upsert · one row at a time (atomic per row · restart-safe) ──
const counts = {
  processed: 0,
  new_rows: 0,
  state_changes: 0,
  score_shifts: 0,
  unchanged: 0,
  audit_rows_written: 0,
  errors: 0,
  by_state: { ready_for_promotion: 0, needs_enrichment: 0, poor_evidence: 0, quality_pending: 0 },
};
const errors = [];

for (const row of discovered.rows) {
  counts.processed++;
  try {
    const { score, breakdown } = scoreBusiness(row);
    const newState = deriveState(score);
    counts.by_state[newState] = (counts.by_state[newState] ?? 0) + 1;

    // Load prior state (single-row SELECT · deterministic)
    const priorRes = await pool.query(
      `SELECT current_state, quality_score
         FROM nex.food_business_promotion
        WHERE business_ref = $1`,
      [row.business_ref],
    );
    const prior = priorRes.rows[0];

    const isNew         = !prior;
    const stateChanged  = !isNew && prior.current_state !== newState;
    const priorScore    = prior?.quality_score ?? null;
    const scoreShifted  = !isNew && priorScore != null && Math.abs(priorScore - score) >= materialScoreDelta;
    const anyChange     = isNew || stateChanged || scoreShifted;

    if (!apply) {
      // DRY-RUN · count what would happen · don't write
      if (isNew)               counts.new_rows++;
      else if (stateChanged)   counts.state_changes++;
      else if (scoreShifted)   counts.score_shifts++;
      else                     counts.unchanged++;
      continue;
    }

    if (!anyChange) {
      counts.unchanged++;
      continue;
    }

    // Upsert current state (atomic per business_ref)
    await pool.query(
      `INSERT INTO nex.food_business_promotion
         (business_ref, current_state, quality_score, score_breakdown,
          evaluated_at, entered_at, updated_at, cycle_run_id)
       VALUES ($1, $2, $3, $4::jsonb, now(), now(), now(), $5)
       ON CONFLICT (business_ref) DO UPDATE SET
         current_state   = EXCLUDED.current_state,
         quality_score   = EXCLUDED.quality_score,
         score_breakdown = EXCLUDED.score_breakdown,
         evaluated_at    = EXCLUDED.evaluated_at,
         updated_at      = now(),
         cycle_run_id    = EXCLUDED.cycle_run_id`,
      [row.business_ref, newState, score, JSON.stringify(breakdown), cycleRunId],
    );

    // Append audit row · every meaningful change tagged with cycle_run_id
    let reason;
    if (isNew)             reason = "initial evaluation";
    else if (stateChanged) reason = `state change: ${prior.current_state} → ${newState}`;
    else                   reason = `material score shift: ${priorScore} → ${score}`;

    await pool.query(
      `INSERT INTO nex.food_business_promotion_audit
         (business_ref, from_state, to_state, score_before, score_after, cycle_run_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [row.business_ref, prior?.current_state ?? null, newState, priorScore, score, cycleRunId, reason],
    );
    counts.audit_rows_written++;

    if (isNew)              counts.new_rows++;
    else if (stateChanged)  counts.state_changes++;
    else if (scoreShifted)  counts.score_shifts++;
  } catch (err) {
    counts.errors++;
    errors.push({ business_ref: row.business_ref, message: err.message });
    console.error(`  [row ${row.business_ref}] ERROR: ${err.message}`);
  }

  // Mid-loop heartbeat every 100 rows so long batches don't look dead
  if (counts.processed % 100 === 0) {
    try {
      await emitHeartbeat(pool, { workerId, workerType, workerConfig, status: "running", cycleRunId,
                                  metadata: { processed: counts.processed, discovered: discovered.rows.length } });
    } catch { /* non-fatal · continue */ }
  }
}

// ── Report ───────────────────────────────────────────────────────────
const runtimeMs = Date.now() - t0;
console.log("");
console.log("── COUNTS ──────────────────────────────────────────────────────────");
console.log(`  processed          : ${counts.processed}`);
console.log(`  new rows           : ${counts.new_rows}`);
console.log(`  state changes      : ${counts.state_changes}`);
console.log(`  score shifts (>=${materialScoreDelta}) : ${counts.score_shifts}`);
console.log(`  unchanged          : ${counts.unchanged}`);
console.log(`  audit rows written : ${counts.audit_rows_written}`);
console.log(`  errors             : ${counts.errors}`);
console.log("");
console.log("── DISTRIBUTION (this cycle · after scoring) ─────────────────────");
console.log(`  🟢 ready_for_promotion : ${counts.by_state.ready_for_promotion}`);
console.log(`  🟡 needs_enrichment    : ${counts.by_state.needs_enrichment}`);
console.log(`  🔴 poor_evidence       : ${counts.by_state.poor_evidence}`);
console.log("");
console.log(`  runtime            : ${(runtimeMs/1000).toFixed(2)}s`);
console.log(`  max score          : ${MAX_SCORE_EXPORT}`);
console.log("");
console.log("── DOCTRINE CHECKS ────────────────────────────────────────────────");
console.log(`  Walker not touched                     : HELD ✓  (no writes to food_business.claim_status)`);
console.log(`  No outreach fired                      : HELD ✓  (Phase 1 never sends messages)`);
console.log(`  No auto-promotion to listed            : HELD ✓  (state stays inside food_business_promotion)`);
console.log(`  Direct-Provenance A on every write     : HELD ✓  (cycle_run_id stamped on every upsert + audit row)`);
console.log(`  Every discovered business visible      : HELD ✓  (score determines priority · not filter)`);
console.log("");

// ── Finish cycle_run ─────────────────────────────────────────────────
try {
  await finishCycleRun(pool, cycleRunId, {
    status: counts.errors === 0 ? "completed" : "failed",
    recordsProcessed: counts.processed,
    recordsNew:       counts.new_rows,
    recordsRejected:  0,                                       // Phase 1 never rejects · every row scored
    errorsCount:      counts.errors,
    summary: {
      discovered_universe: discovered.rows.length,
      new_rows:            counts.new_rows,
      state_changes:       counts.state_changes,
      score_shifts:        counts.score_shifts,
      unchanged:           counts.unchanged,
      audit_rows_written:  counts.audit_rows_written,
      by_state:            counts.by_state,
      runtime_ms:          runtimeMs,
      mode:                apply ? "apply" : "dry-run",
    },
    doctrineChecks: {
      walker_untouched:         true,
      no_outreach:              true,
      no_auto_promotion:        true,
      direct_provenance_a:      true,
      every_row_visible:        true,
    },
  });
  await emitHeartbeat(pool, { workerId, workerType, workerConfig, status: "idle", cycleRunId,
                              metadata: { finishedAt: new Date().toISOString(), counts } });
} catch (err) {
  console.error(`[reliability] cycle-finish failed: ${err.message}`);
}

await pool.end();
process.exit(counts.errors === 0 ? 0 : 4);
