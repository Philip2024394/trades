// NEX Acquisition Workforce · health-state derivation library.
//
// Philip 2026-09-02 · Phase 1A · READ-ONLY health state derivation.
// Zero writes. Reads nex.worker_heartbeat + nex.worker_cycle_run and derives
// the 10-value health state per Philip's corrected model:
//
//   STARTING · PROCESSING · ALIVE · PRODUCTIVE · WAITING_FOR_WORK ·
//   WAITING_FOR_NETWORK · WAITING_FOR_PROVIDER · STALLED · FAILED · RECOVERING
//
// CRITICAL RULE (Philip's correction 1):
//   STALLED does NOT mean "no completed cycle in last N minutes".
//   STALLED requires ALL of:
//     · supervisor heartbeat is fresh (process alive)
//     · no child walker process currently running (checked by caller)
//     · no completed cycle_run in the last STALL_WINDOW_MS
//     · supervisor has NOT explicitly declared a WAITING_FOR_* state
//   A legitimate long-running cycle → PROCESSING (not STALLED).
//   A legitimately-quiet queue → WAITING_FOR_WORK (not STALLED).
//   A network outage → WAITING_FOR_NETWORK (not STALLED).
//
// The supervisor DECLARES its waiting states by writing worker_heartbeat with
// last_status in {'waiting','standby'} plus context in worker_config. This
// module READS those declarations to distinguish them from silent stalls.

const DEFAULTS = Object.freeze({
  HEARTBEAT_FRESH_MS:   Number(process.env.NEX_ACQ_HEARTBEAT_FRESH_MS   ?? 60_000),   // 60s
  PRODUCTIVE_WINDOW_MS: Number(process.env.NEX_ACQ_PRODUCTIVE_WINDOW_MS ?? 900_000),  // 15 min (widened per Philip)
  STALL_WINDOW_MS:      Number(process.env.NEX_ACQ_STALL_WINDOW_MS      ?? 900_000),  // 15 min (Philip: no premature kill)
  STARTING_WINDOW_MS:   Number(process.env.NEX_ACQ_STARTING_WINDOW_MS   ?? 30_000),   // 30s
});

const SUPERVISOR_WORKER_ID = "acquisition-supervisor";

/**
 * Derive the acquisition-workforce health snapshot from Postgres.
 * @param {pg.Pool} pool
 * @param {object} opts { childProcessPresent?: boolean, watchdogInBackoff?: boolean }
 * @returns {Promise<HealthSnapshot>}
 */
export async function deriveHealthState(pool, opts = {}) {
  const {
    childProcessPresent = null,    // null=caller did not inspect · true/false=caller's OS check result (Philip 2026-09-02 observability fix)
    watchdogInBackoff   = false,   // watchdog signals if it's mid-restart
    now                 = new Date(),
  } = opts;

  const nowMs = now.getTime();

  // ── Read supervisor heartbeat ─────────────────────────────────────────
  const supHb = await pool.query(
    `SELECT worker_id, worker_type, worker_config, last_heartbeat_at, last_status, last_cycle_run_id
       FROM nex.worker_heartbeat
      WHERE worker_id = $1`,
    [SUPERVISOR_WORKER_ID],
  );
  const supRow = supHb.rows[0] ?? null;

  // ── Read cycle statistics for category:* workers ──────────────────────
  // NOTE: `running_now_fresh` uses started_at within the last 60 minutes
  // (cycle_timeout window). A cycle stuck in status='running' from days ago
  // is a ZOMBIE — not active work — and must not fool the watchdog into
  // reporting PROCESSING. `running_now_all` is kept for diagnostic visibility.
  const cycleStats = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE finished_at > now() - interval '5 minutes'   AND status = 'completed') AS completed_5m,
       COUNT(*) FILTER (WHERE finished_at > now() - interval '15 minutes'  AND status = 'completed') AS completed_15m,
       COUNT(*) FILTER (WHERE finished_at > now() - interval '1 hour'      AND status = 'completed') AS completed_1h,
       COUNT(*) FILTER (WHERE status = 'running'
                          AND started_at > now() - interval '60 minutes')                           AS running_now_fresh,
       COUNT(*) FILTER (WHERE status = 'running')                                                   AS running_now_all,
       COUNT(*) FILTER (WHERE status = 'running'
                          AND started_at <= now() - interval '60 minutes')                          AS zombie_running,
       MAX(finished_at) FILTER (WHERE status = 'completed')                                         AS last_completed_at,
       MAX(started_at)                                                                              AS last_started_at,
       SUM(records_new) FILTER (WHERE finished_at > now() - interval '1 hour' AND status = 'completed') AS records_1h
       FROM nex.worker_cycle_run
      WHERE worker_type LIKE 'category:%'
         OR worker_type = 'acquisition_supervisor'`,
  );
  const cs = cycleStats.rows[0];

  // ── Read child worker heartbeats (recent category:*) ──────────────────
  const childHbs = await pool.query(
    `SELECT worker_id, worker_type, worker_config, last_heartbeat_at, last_status, last_cycle_run_id
       FROM nex.worker_heartbeat
      WHERE worker_type LIKE 'category:%'
        AND last_heartbeat_at > now() - interval '1 hour'
      ORDER BY last_heartbeat_at DESC
      LIMIT 20`,
  );

  // ── Derive supervisor state ───────────────────────────────────────────
  let state = "UNKNOWN";
  const reasons = [];

  if (watchdogInBackoff) {
    state = "RECOVERING";
    reasons.push("watchdog reported in-backoff");
  } else if (!supRow) {
    state = "STARTING";
    reasons.push("no supervisor heartbeat row yet");
  } else {
    const hbAgeMs   = supRow.last_heartbeat_at ? nowMs - new Date(supRow.last_heartbeat_at).getTime() : Infinity;
    const hbFresh   = hbAgeMs <= DEFAULTS.HEARTBEAT_FRESH_MS;
    const completed15m = Number(cs?.completed_15m ?? 0);
    const runningNow   = Number(cs?.running_now_fresh ?? 0);   // FRESH only · zombies excluded
    const declaredStatus = supRow.last_status;
    const declaredConfig = supRow.worker_config ?? "";

    // Explicit waiting states (declared by the supervisor itself)
    if (hbFresh && declaredStatus === "waiting" && declaredConfig.startsWith("waiting_for_network")) {
      state = "WAITING_FOR_NETWORK";
      reasons.push(`supervisor declared: ${declaredConfig}`);
    } else if (hbFresh && declaredStatus === "waiting" && declaredConfig.startsWith("waiting_for_provider")) {
      state = "WAITING_FOR_PROVIDER";
      reasons.push(`supervisor declared: ${declaredConfig}`);
    } else if (hbFresh && (declaredStatus === "waiting" || declaredStatus === "standby") && declaredConfig.startsWith("waiting_for_work")) {
      state = "WAITING_FOR_WORK";
      reasons.push(`supervisor declared: ${declaredConfig}`);
    } else if (hbFresh && declaredStatus === "failed") {
      state = "FAILED";
      reasons.push("supervisor declared status=failed");
    } else if (childProcessPresent === true || runningNow > 0) {
      state = "PROCESSING";
      const parts = [`running_now=${runningNow}`];
      if (childProcessPresent === true)  parts.push("child_process_detected=true");
      if (childProcessPresent === false) parts.push("child_process_detected=false");
      // childProcessPresent === null · caller did not inspect · omit from reason (do not misleadingly assert)
      reasons.push(`child running · ${parts.join(" · ")}`);
    } else if (hbFresh && completed15m >= 1) {
      state = "PRODUCTIVE";
      reasons.push(`hbFresh + completed_15m=${completed15m}`);
    } else if (hbFresh && completed15m === 0 && Number(cs?.completed_1h ?? 0) === 0
               && nowMs - new Date(supRow.last_heartbeat_at).getTime() > DEFAULTS.STARTING_WINDOW_MS
               && !isRecentlyStarted(supRow, nowMs)) {
      // Real STALLED: heartbeat is fresh (process alive) BUT no cycles at all in 15+ min
      // AND supervisor did NOT declare any waiting state AND is not just starting
      state = "STALLED";
      reasons.push(`hbFresh · completed_15m=0 · completed_1h=${cs?.completed_1h ?? 0} · no waiting state declared`);
    } else if (hbFresh) {
      state = "ALIVE";
      reasons.push(`hbFresh · not yet productive`);
    } else {
      state = "FAILED";
      reasons.push(`supervisor heartbeat stale · age=${hbAgeMs}ms`);
    }
  }

  return {
    at: now.toISOString(),
    state,
    reasons,
    supervisor: supRow ? {
      worker_id: supRow.worker_id,
      worker_type: supRow.worker_type,
      worker_config: supRow.worker_config,
      last_status: supRow.last_status,
      last_heartbeat_at: supRow.last_heartbeat_at,
      last_heartbeat_age_ms: supRow.last_heartbeat_at ? nowMs - new Date(supRow.last_heartbeat_at).getTime() : null,
      last_cycle_run_id: supRow.last_cycle_run_id,
    } : null,
    cycles: {
      completed_5m:      Number(cs?.completed_5m      ?? 0),
      completed_15m:     Number(cs?.completed_15m     ?? 0),
      completed_1h:      Number(cs?.completed_1h      ?? 0),
      running_now_fresh: Number(cs?.running_now_fresh ?? 0),   // status='running' AND started_at within 60m
      running_now_all:   Number(cs?.running_now_all   ?? 0),   // status='running' regardless of age (diagnostic)
      zombie_running:    Number(cs?.zombie_running    ?? 0),   // status='running' but started > 60m ago
      last_completed_at: cs?.last_completed_at ?? null,
      last_started_at:   cs?.last_started_at   ?? null,
      records_new_1h:    Number(cs?.records_1h ?? 0),
    },
    children: childHbs.rows.map((r) => ({
      worker_id: r.worker_id,
      worker_type: r.worker_type,
      worker_config: r.worker_config,
      last_status: r.last_status,
      last_heartbeat_at: r.last_heartbeat_at,
      last_heartbeat_age_ms: r.last_heartbeat_at ? nowMs - new Date(r.last_heartbeat_at).getTime() : null,
    })),
    thresholds: DEFAULTS,
  };
}

function isRecentlyStarted(supRow, nowMs) {
  // If supervisor started less than STARTING_WINDOW_MS ago, don't flag STALLED yet
  if (!supRow.last_heartbeat_at) return true;
  const ageMs = nowMs - new Date(supRow.last_heartbeat_at).getTime();
  return ageMs < DEFAULTS.STARTING_WINDOW_MS;
}

/**
 * Convenience predicate for the watchdog's kill-decision.
 * ONLY STALLED and FAILED warrant killing/restarting the supervisor.
 * WAITING_FOR_* and PROCESSING and PRODUCTIVE and ALIVE do NOT.
 */
export function watchdogShouldRestart(healthSnapshot) {
  return healthSnapshot.state === "STALLED"
      || healthSnapshot.state === "FAILED";
}

export { SUPERVISOR_WORKER_ID, DEFAULTS };
