-- 142_nex_worker_health_deactivated.sql · Philip 2026-08-29.
--
-- Adds DEACTIVATED state to nex.worker_health_status.
--
-- Problem being fixed:
--   nex.worker_health_status was classifying 14,179 workers as CRITICAL
--   because any worker with `last_heartbeat_at > 60 minutes` fell into the
--   CRITICAL bucket · this included every historical city×category worker
--   that ran once and was never reactivated. That's not unhealthy · it's
--   just not part of the current active fleet.
--
-- Fix:
--   Add a DEACTIVATED bucket for workers with NO cycle_run in the last 7
--   days. This runs BEFORE the "heartbeat > 60min" CRITICAL check so
--   historical workers no longer masquerade as broken. Informational, not
--   an alert state · sits at the bottom of the priority order alongside
--   UNKNOWN.
--
-- View shape unchanged (same columns, same order) · only the CASE
-- expression is edited. `CREATE OR REPLACE VIEW` works without CASCADE.
--
-- Scope · Philip 2026-08-29:
--   · No discovery behaviour changes.
--   · No walker schedule changes.
--   · No data mutation.
--   · Instrument-panel-only fix.

CREATE OR REPLACE VIEW nex.worker_health_status AS
WITH latest_cycles AS (
  SELECT DISTINCT ON (worker_id) *
  FROM nex.worker_cycle_run
  ORDER BY worker_id, started_at DESC
),
recent_failure_counts AS (
  SELECT worker_id, count(*)::int AS recent_failures
  FROM nex.worker_cycle_run
  WHERE started_at > now() - interval '24 hours'
    AND status = 'failed'
  GROUP BY worker_id
),
recent_missed_counts AS (
  SELECT worker_id, count(*)::int AS recent_misses
  FROM nex.worker_missed_runs_24h
  GROUP BY worker_id
)
SELECT
  h.worker_id,
  h.worker_type,
  h.worker_config,
  h.last_heartbeat_at,
  h.last_status,
  EXTRACT(EPOCH FROM (now() - h.last_heartbeat_at))::int AS seconds_since_heartbeat,
  lc.started_at         AS last_cycle_started_at,
  lc.finished_at        AS last_cycle_finished_at,
  lc.status             AS last_cycle_status,
  lc.duration_ms        AS last_cycle_duration_ms,
  lc.records_processed  AS last_cycle_records_processed,
  lc.records_new        AS last_cycle_records_new,
  lc.errors_count       AS last_cycle_errors,
  COALESCE(rfc.recent_failures, 0) AS recent_failures_24h,
  COALESCE(rmc.recent_misses, 0)   AS recent_missed_runs_24h,
  CASE
    -- UNKNOWN sits at the top only when we have no signal at all.
    WHEN h.last_heartbeat_at IS NULL THEN 'UNKNOWN'

    -- ALERT states (worst first · schedule miss > repeated failures > staleness):
    WHEN COALESCE(rmc.recent_misses, 0) > 0 THEN 'MISSED_RUN'
    WHEN COALESCE(rfc.recent_failures, 0) >= 3 THEN 'CRITICAL'

    -- DEACTIVATED · new state · fires for historical / ephemeral / idle
    -- workers so they are informational rather than an alert. Catches:
    --   (a) worker_ids with NO cycle_run at all (never activated · fires
    --       regardless of heartbeat freshness · a worker that emits a
    --       heartbeat but never actually runs a cycle is not active fleet)
    --   (b) stale-heartbeat worker_ids whose last cycle finished > 60 min
    --       ago (ephemeral one-shot walkers · common because
    --       _category-walker.mjs mints a new UUID per invocation)
    --   (c) stale-heartbeat worker_ids whose last cycle started > 7 days
    --       ago (genuinely idle)
    -- A worker exits DEACTIVATED on the next fresh cycle_run + heartbeat.
    -- CRITICAL is reserved for actively-cycling workers (fresh cycle in
    -- the last hour) whose heartbeat has gone silent · true alert case.
    WHEN lc.started_at IS NULL THEN 'DEACTIVATED'
    WHEN (now() - h.last_heartbeat_at) > interval '60 minutes'
      AND (
        lc.finished_at < (now() - interval '60 minutes')
        OR lc.started_at < (now() - interval '7 days')
      ) THEN 'DEACTIVATED'

    -- Standard freshness rules for active workers:
    WHEN (now() - h.last_heartbeat_at) > interval '60 minutes' THEN 'CRITICAL'
    WHEN (now() - h.last_heartbeat_at) > interval '15 minutes'
         AND (lc.errors_count > 0 OR lc.status = 'failed') THEN 'WARNING'
    WHEN lc.errors_count > 0 OR lc.status = 'failed' THEN 'WARNING'
    ELSE 'HEALTHY'
  END AS health
FROM nex.worker_heartbeat h
LEFT JOIN latest_cycles lc ON lc.worker_id = h.worker_id
LEFT JOIN recent_failure_counts rfc ON rfc.worker_id = h.worker_id
LEFT JOIN recent_missed_counts rmc ON rmc.worker_id = h.worker_id;

COMMENT ON VIEW nex.worker_health_status IS
  'Deterministic per-worker health. States (worst first · alert): MISSED_RUN · CRITICAL · WARNING · HEALTHY. Informational: DEACTIVATED (no cycle_run in 7 days · historical/idle · not part of active fleet · added 2026-08-29) · UNKNOWN (never emitted a heartbeat). Pure SQL · zero LLM · verifiable.';
