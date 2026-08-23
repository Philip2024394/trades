-- 069_nex_worker_missed_runs.sql
--
-- Task #57 · Missed-run detection · pre-24/7 constitutional gate.
--
-- Doctrine anchor: project_nex_worker_reliability_2026_08_21
-- Philip 2026-08-21 verbatim: "The report currently proves 'the worker ran.'
-- We eventually need it to prove 'the worker was supposed to run, and it ran.'
-- Those are different."
--
-- Constitutional rule: NEX must not claim a worker is healthy unless
--   (heartbeat is fresh) AND (every expected run has a matching cycle_run
--   within grace window). Silent failure = undetected failure until Philip
--   asks. Missed-run detection closes that gap.
--
-- Design decisions:
--   · Interval-based (not cron) for MVP. Real cron scheduling is a deployment
--     concern (Vercel cron · Windows Task Scheduler · systemd). The DB just
--     records what NEX EXPECTS and detects gaps deterministically.
--   · No separate expected_run table · view computes expected times on the fly
--     from (started_at, interval_seconds, grace_window_sec). One row per
--     worker in nex.worker_schedule. Deterministic. Testable.
--   · MISSED_RUN state added to worker_health_status view. Escalates above
--     CRITICAL when unmatched expected runs exist beyond grace window.
--
-- What ships:
--   1  nex.worker_schedule    · one row per worker · defines what to expect
--   2  nex.worker_expected_runs · view · every expected run for the last 7d
--   3  nex.worker_missed_runs_24h · view · unmatched expected runs in 24h
--   4  nex.worker_health_status · REPLACED · adds MISSED_RUN state
--
-- Reversible:
--   BEGIN;
--   DROP VIEW IF EXISTS nex.worker_missed_runs_24h;
--   DROP VIEW IF EXISTS nex.worker_expected_runs;
--   DROP TABLE IF EXISTS nex.worker_schedule CASCADE;
--   -- restore prior worker_health_status from migration 063
--   COMMIT;

CREATE TABLE IF NOT EXISTS nex.worker_schedule (
  worker_id            text PRIMARY KEY,
  worker_type          text NOT NULL,
  worker_config        text,
  interval_seconds     integer NOT NULL CHECK (interval_seconds >= 60),
  grace_window_sec     integer NOT NULL DEFAULT 300 CHECK (grace_window_sec >= 0),
  schedule_started_at  timestamptz NOT NULL DEFAULT now(),
  enabled              boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  notes                text
);

COMMENT ON TABLE nex.worker_schedule IS
  'Per-worker schedule definition. Interval-based (not cron): worker is expected to run every interval_seconds starting from schedule_started_at. Grace window allows for late starts before flagging missed. Real cron/systemd/Vercel-cron is a deployment concern — this table only records what NEX EXPECTS.';

CREATE INDEX IF NOT EXISTS idx_worker_schedule_enabled
  ON nex.worker_schedule (enabled) WHERE enabled = true;

-- ── View · expected runs for the last 7 days ───────────────────────────────
--
-- Uses generate_series to emit one row per expected run time. Joins with
-- nex.worker_cycle_run to match each expected time with an actual cycle
-- that started within the grace window. Deterministic. No LLM. No inference.

CREATE OR REPLACE VIEW nex.worker_expected_runs AS
SELECT
  s.worker_id,
  s.worker_type,
  s.worker_config,
  s.interval_seconds,
  s.grace_window_sec,
  expected_at,
  cr.id            AS matched_cycle_run_id,
  cr.started_at    AS matched_started_at,
  cr.finished_at   AS matched_finished_at,
  cr.status        AS matched_status,
  CASE
    WHEN cr.id IS NOT NULL THEN 'matched'
    WHEN expected_at + (s.grace_window_sec || ' seconds')::interval < now() THEN 'missed'
    WHEN expected_at > now() THEN 'future'
    ELSE 'pending'   -- within grace window · not yet matched · not yet late
  END AS run_status,
  CASE
    WHEN cr.id IS NULL AND expected_at + (s.grace_window_sec || ' seconds')::interval < now()
      THEN EXTRACT(EPOCH FROM (now() - expected_at))::int
    ELSE NULL
  END AS missed_by_seconds
FROM nex.worker_schedule s
CROSS JOIN LATERAL generate_series(
  s.schedule_started_at,
  now(),
  (s.interval_seconds || ' seconds')::interval
) AS expected_at
LEFT JOIN LATERAL (
  SELECT cr.id, cr.started_at, cr.finished_at, cr.status
  FROM nex.worker_cycle_run cr
  WHERE cr.worker_id = s.worker_id
    AND cr.started_at >= expected_at
    AND cr.started_at <= expected_at + (s.grace_window_sec || ' seconds')::interval
  ORDER BY cr.started_at ASC
  LIMIT 1
) cr ON true
WHERE s.enabled = true
  AND expected_at > now() - interval '7 days';

COMMENT ON VIEW nex.worker_expected_runs IS
  'Every expected run for enabled workers over the last 7 days · joined with matching cycle_run within grace window. run_status: matched · missed · pending · future. Deterministic derivation from schedule + cycle_run · no LLM.';

-- ── View · missed runs in last 24h (fires the alert) ──────────────────────

CREATE OR REPLACE VIEW nex.worker_missed_runs_24h AS
SELECT
  worker_id,
  worker_type,
  worker_config,
  expected_at,
  missed_by_seconds,
  grace_window_sec
FROM nex.worker_expected_runs
WHERE run_status = 'missed'
  AND expected_at > now() - interval '24 hours'
ORDER BY expected_at DESC;

COMMENT ON VIEW nex.worker_missed_runs_24h IS
  'Rolling 24h missed-run alerts. Empty = every scheduled run either matched a cycle_run or is still within grace window. Non-empty = MISSED_RUN health state escalation for those workers · surfaced by watchdog + 24h report + voice.';

-- ── UPDATED worker_health_status view · adds MISSED_RUN state ─────────────
--
-- MISSED_RUN escalates above CRITICAL when a worker has any missed expected
-- run in the last 24h. If no schedule exists for a worker, MISSED_RUN cannot
-- be raised (unscheduled workers can't miss what they don't have).
--
-- DROP + CREATE (not CREATE OR REPLACE) because column shape changes: adds
-- recent_missed_runs_24h column which shifts positions.

DROP VIEW IF EXISTS nex.worker_health_status CASCADE;

CREATE VIEW nex.worker_health_status AS
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
    WHEN h.last_heartbeat_at IS NULL THEN 'UNKNOWN'
    WHEN COALESCE(rmc.recent_misses, 0) > 0 THEN 'MISSED_RUN'
    WHEN COALESCE(rfc.recent_failures, 0) >= 3 THEN 'CRITICAL'
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
  'Deterministic per-worker health. States (worst first): MISSED_RUN (scheduled + missed at least once in 24h · added Task #57 2026-08-22) · CRITICAL (3+ failures OR heartbeat > 60min stale) · WARNING (heartbeat stale + errors OR fresh HB + recent errors) · HEALTHY · UNKNOWN. Pure SQL · zero LLM · verifiable.';
