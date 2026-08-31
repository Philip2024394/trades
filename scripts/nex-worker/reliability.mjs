// NEX Worker Reliability Library · shared functions for all workers.
//
// Every worker (acquisition · CLE · rescore-edges · future) uses these
// helpers to persist heartbeat + cycle-run rows. Deterministic. Testable.
// Zero LLM calls. Zero side effects beyond the two reliability tables.
//
// Doctrine anchor:
//   project_nex_product_architecture_4_roles_6_subsystems_2026_08_21
//   (reliability layer lives INSIDE HQ · watches all workers · never a 7th subsystem)

import { randomUUID } from "node:crypto";

// ── Heartbeat · upsert per worker ──────────────────────────────────────────

export async function emitHeartbeat(pool, { workerId, workerType, workerConfig, status, cycleRunId, metadata }) {
  await pool.query(
    `INSERT INTO nex.worker_heartbeat (worker_id, worker_type, worker_config, last_heartbeat_at, last_status, last_cycle_run_id, metadata)
     VALUES ($1, $2, $3, now(), $4, $5, $6::jsonb)
     ON CONFLICT (worker_id) DO UPDATE SET
       worker_type       = EXCLUDED.worker_type,
       worker_config     = EXCLUDED.worker_config,
       last_heartbeat_at = EXCLUDED.last_heartbeat_at,
       last_status       = EXCLUDED.last_status,
       last_cycle_run_id = EXCLUDED.last_cycle_run_id,
       metadata          = EXCLUDED.metadata,
       updated_at        = now()`,
    [workerId, workerType, workerConfig ?? null, status ?? "idle",
     cycleRunId ?? null, JSON.stringify(metadata ?? {})]
  );
}

// ── Cycle run · start (returns id · caller must call finishCycleRun) ──────

export async function startCycleRun(pool, { workerId, workerType, workerConfig, jobIdExternal }) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO nex.worker_cycle_run
       (id, worker_id, worker_type, worker_config, job_id_external, started_at, status)
     VALUES ($1, $2, $3, $4, $5, now(), 'running')`,
    [id, workerId, workerType, workerConfig ?? null, jobIdExternal ?? null]
  );
  return id;
}

// ── Cycle run · finish (records counts + doctrine checks + report path) ───

export async function finishCycleRun(pool, cycleRunId, {
  status, recordsProcessed, recordsNew, recordsRejected, errorsCount, summary,
  auditReportPath, doctrineChecks,
}) {
  const r = await pool.query(
    `UPDATE nex.worker_cycle_run SET
       finished_at        = now(),
       duration_ms        = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::int,
       status             = $2,
       records_processed  = $3,
       records_new        = $4,
       records_rejected   = $5,
       errors_count       = $6,
       summary            = $7::jsonb,
       audit_report_path  = $8,
       doctrine_checks    = $9::jsonb
     WHERE id = $1
     RETURNING duration_ms`,
    [cycleRunId, status, recordsProcessed ?? null, recordsNew ?? null, recordsRejected ?? null,
     errorsCount ?? 0, JSON.stringify(summary ?? {}),
     auditReportPath ?? null, JSON.stringify(doctrineChecks ?? {})]
  );
  return r.rows[0]?.duration_ms ?? null;
}

// ── Deterministic health evaluator (pure function · testable) ─────────────
//
// Rules match nex.worker_health_status view (see migration 142). Duplicated
// here so callers don't need DB round-trip for a single-worker health check.
// View is authoritative for aggregate reads.
//
// States (worst first · alert): MISSED_RUN · CRITICAL · WARNING · HEALTHY.
// Informational: DEACTIVATED (no cycle in 7d) · UNKNOWN (never heartbeated).

export function evaluateHealth({
  lastHeartbeatAt,        // Date or ISO string · nullable
  lastCycleStartedAt,     // Date or ISO string · nullable (added 2026-08-29 for DEACTIVATED)
  lastCycleStatus,        // 'completed' | 'failed' | 'running' | 'aborted' | null
  lastCycleErrorsCount,   // int · nullable
  recentFailures24h,      // int
  recentMissedRuns24h,    // int · nullable (added 2026-08-29 to mirror view)
  now = new Date(),
}) {
  if (!lastHeartbeatAt) return { health: "UNKNOWN", reason: "no heartbeat ever recorded" };
  const hb = lastHeartbeatAt instanceof Date ? lastHeartbeatAt : new Date(lastHeartbeatAt);
  const ageMs = now.getTime() - hb.getTime();
  const ageMin = ageMs / 60_000;

  // ALERT states first · schedule miss > repeated failures > staleness.
  if ((recentMissedRuns24h ?? 0) > 0) return { health: "MISSED_RUN", reason: `${recentMissedRuns24h} scheduled run(s) missed in last 24h` };
  if ((recentFailures24h ?? 0) >= 3) return { health: "CRITICAL", reason: `${recentFailures24h} failures in last 24h` };

  // DEACTIVATED · historical / ephemeral / idle worker. Two triggers:
  //   (a) NO cycle_run ever recorded (fires regardless of heartbeat)
  //   (b) heartbeat stale (> 60 min) AND (last cycle finished > 60 min ago
  //       OR last cycle started > 7 days ago)
  // Matches migration 142 view · not CRITICAL because these workers aren't
  // in an actively-expected state.
  const lastCycleAt = lastCycleStartedAt
    ? (lastCycleStartedAt instanceof Date ? lastCycleStartedAt : new Date(lastCycleStartedAt))
    : null;
  if (!lastCycleAt) {
    return { health: "DEACTIVATED", reason: "no cycle_run ever recorded · never activated" };
  }
  const daysSinceLastCycle = (now.getTime() - lastCycleAt.getTime()) / (24 * 60 * 60 * 1000);
  const minutesSinceLastCycle = (now.getTime() - lastCycleAt.getTime()) / 60_000;
  if (ageMin > 60 && (minutesSinceLastCycle > 60 || daysSinceLastCycle > 7)) {
    return { health: "DEACTIVATED", reason: daysSinceLastCycle > 7
      ? `no cycle_run in ${daysSinceLastCycle.toFixed(1)} days (> 7d)`
      : `stale heartbeat + last cycle ${minutesSinceLastCycle.toFixed(0)}min ago (> 60min) · ephemeral one-shot` };
  }

  if (ageMin > 60) return { health: "CRITICAL", reason: `no heartbeat for ${ageMin.toFixed(1)}min (> 60min threshold)` };
  if (ageMin > 15 && ((lastCycleErrorsCount ?? 0) > 0 || lastCycleStatus === "failed")) {
    return { health: "WARNING", reason: `heartbeat ${ageMin.toFixed(1)}min old + last cycle had issues` };
  }
  if ((lastCycleErrorsCount ?? 0) > 0 || lastCycleStatus === "failed") {
    return { health: "WARNING", reason: `last cycle had errors/failed but heartbeat is fresh` };
  }
  return { health: "HEALTHY", reason: `heartbeat ${ageMin.toFixed(1)}min old · last cycle clean` };
}

// ── Utility · load current health for all workers ─────────────────────────

export async function loadHealthStatus(pool) {
  const r = await pool.query(`SELECT * FROM nex.worker_health_status ORDER BY worker_type, worker_id`);
  return r.rows;
}

export async function load24hActivity(pool) {
  const r = await pool.query(`SELECT * FROM nex.worker_24h_activity`);
  return r.rows;
}
