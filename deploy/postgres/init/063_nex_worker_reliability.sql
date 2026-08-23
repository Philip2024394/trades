-- 063_nex_worker_reliability.sql
--
-- NEX Worker Reliability Layer · instrumentation INSIDE HQ.
--
-- NOT a 7th subsystem (per pinned product-architecture doctrine). This is
-- infrastructure that watches all workers (Acquisition Machine · CLE ·
-- nightly rescore-edges · any future worker) and lets NEX prove, every day,
-- whether the workers actually did their jobs.
--
-- Doctrine anchors:
--   · project_nex_product_architecture_4_roles_6_subsystems_2026_08_21
--     (HQ = control room · reliability layer lives inside HQ/worker infra)
--   · project_nex_acquisition_machine_scheduled_agents_2026_08_21 (audit-first)
--   · project_nex_conversation_learning_engine_2026_08_21 (dry-run · observation)
--
-- Ships:
--   1  nex.worker_heartbeat · per-worker liveness (last seen, current status)
--   2  nex.worker_cycle_run · one row per completed worker cycle
--                             (acquisition sweep · CLE cycle · rescore-edges pass)
--   3  nex.worker_health_status · view that computes deterministic HEALTHY/
--                                  WARNING/CRITICAL/UNKNOWN per worker
--   4  nex.worker_24h_activity · view that aggregates last-24h activity
--                                for the daily voice report
--
-- Reversible:
--   BEGIN;
--   DROP VIEW IF EXISTS nex.worker_24h_activity;
--   DROP VIEW IF EXISTS nex.worker_health_status;
--   DROP TABLE IF EXISTS nex.worker_cycle_run CASCADE;
--   DROP TABLE IF EXISTS nex.worker_heartbeat CASCADE;
--   COMMIT;

CREATE SCHEMA IF NOT EXISTS nex;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Per-worker heartbeat ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.worker_heartbeat (
  worker_id           text PRIMARY KEY,           -- 'acquisition:food:yogyakarta' | 'cle:staircase' | etc
  worker_type         text NOT NULL,              -- 'acquisition' | 'cle' | 'rescore_edges' | ...
  worker_config       text,                       -- 'food:Yogyakarta' | 'staircase' | ...
  last_heartbeat_at   timestamptz NOT NULL,
  last_status         text NOT NULL DEFAULT 'idle', -- 'idle' | 'running' | 'completed' | 'failed'
  last_cycle_run_id   uuid,                       -- FK-ish (soft) to worker_cycle_run
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_heartbeat_status_check CHECK (last_status IN
    ('idle','running','completed','failed','stopped'))
);

CREATE INDEX IF NOT EXISTS idx_worker_heartbeat_type ON nex.worker_heartbeat (worker_type);
CREATE INDEX IF NOT EXISTS idx_worker_heartbeat_last_at ON nex.worker_heartbeat (last_heartbeat_at DESC);

COMMENT ON TABLE nex.worker_heartbeat IS
  'Per-worker liveness. Every worker calls upsert on this table at cycle start + finish + failure. Reliability layer reads it to compute health.';

-- ── 2. Per-cycle audit rows ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.worker_cycle_run (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id           text NOT NULL,
  worker_type         text NOT NULL,
  worker_config       text,
  job_id_external     text,                       -- job id from the worker's own log
  started_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  duration_ms         integer,
  status              text NOT NULL DEFAULT 'running',
  records_processed   integer,
  records_new         integer,
  records_rejected    integer,
  errors_count        integer NOT NULL DEFAULT 0,
  summary             jsonb NOT NULL DEFAULT '{}'::jsonb,   -- structured counts/samples
  audit_report_path   text,                       -- disk path (e.g. .cache/runs/foo.json)
  doctrine_checks     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {invariant: HELD|VIOLATED}
  CONSTRAINT worker_cycle_run_status_check CHECK (status IN
    ('running','completed','failed','aborted'))
);

CREATE INDEX IF NOT EXISTS idx_wcr_worker_started ON nex.worker_cycle_run (worker_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wcr_type_started ON nex.worker_cycle_run (worker_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wcr_status ON nex.worker_cycle_run (status);
-- Time-range queries served by the plain idx_wcr_worker_started + idx_wcr_type_started
-- indexes above. Partial index using now() would need IMMUTABLE · not worth it here.

COMMENT ON TABLE nex.worker_cycle_run IS
  'Append-only cycle log. One row per completed worker cycle. Doctrine checks captured so reliability layer can prove invariants held (Discovery ≠ Outreach · Observe ≠ Teach · Candidate ≠ Promotion).';

-- ── 3. Deterministic health status view ────────────────────────────────────
--
-- Rules (pure SQL · no ML · testable):
--   HEALTHY  = heartbeated within 15min AND last cycle completed AND errors_count = 0
--   WARNING  = heartbeated within 60min BUT (last cycle had errors OR duration >2x median)
--   CRITICAL = no heartbeat for > 60min OR last 3 cycles failed
--   UNKNOWN  = worker has never emitted a heartbeat

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
  CASE
    WHEN h.last_heartbeat_at IS NULL THEN 'UNKNOWN'
    WHEN COALESCE(rfc.recent_failures, 0) >= 3 THEN 'CRITICAL'
    WHEN (now() - h.last_heartbeat_at) > interval '60 minutes' THEN 'CRITICAL'
    WHEN (now() - h.last_heartbeat_at) > interval '15 minutes'
         AND (lc.errors_count > 0 OR lc.status = 'failed') THEN 'WARNING'
    WHEN lc.errors_count > 0 OR lc.status = 'failed' THEN 'WARNING'
    ELSE 'HEALTHY'
  END AS health
FROM nex.worker_heartbeat h
LEFT JOIN latest_cycles lc ON lc.worker_id = h.worker_id
LEFT JOIN recent_failure_counts rfc ON rfc.worker_id = h.worker_id;

COMMENT ON VIEW nex.worker_health_status IS
  'Deterministic health per worker. Pure SQL · reliably testable. HEALTHY/WARNING/CRITICAL/UNKNOWN. Read by watchdog + 24h report + HQ tile.';

-- ── 4. 24-hour activity view (input to daily voice report) ─────────────────

CREATE OR REPLACE VIEW nex.worker_24h_activity AS
SELECT
  worker_id,
  worker_type,
  worker_config,
  count(*)::int                                                AS cycles_run,
  count(*) FILTER (WHERE status = 'completed')::int            AS cycles_completed,
  count(*) FILTER (WHERE status = 'failed')::int               AS cycles_failed,
  COALESCE(sum(records_processed), 0)::int                     AS total_records_processed,
  COALESCE(sum(records_new), 0)::int                           AS total_records_new,
  COALESCE(sum(errors_count), 0)::int                          AS total_errors,
  min(started_at)                                              AS first_cycle_at,
  max(started_at)                                              AS last_cycle_at,
  COALESCE(round(avg(duration_ms))::int, 0)                    AS avg_duration_ms
FROM nex.worker_cycle_run
WHERE started_at > now() - interval '24 hours'
GROUP BY worker_id, worker_type, worker_config
ORDER BY worker_type, worker_id;

COMMENT ON VIEW nex.worker_24h_activity IS
  'Rolling-24h aggregation per worker. Read by report-24h generator + voice endpoint.';
