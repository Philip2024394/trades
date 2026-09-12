-- 163_nex_scheduled.sql
--
-- Founder Phase 18 · P18-1 · Scheduled agent primitives.
-- 2026-09-10.
--
-- Two tables:
--   nex.scheduled_job     · job registry · one row per named job
--   nex.scheduled_job_run · immutable audit trail of every execution

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- scheduled_job
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.scheduled_job (
  job_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL UNIQUE,      -- e.g. "observatory-refresh"
  handler         text        NOT NULL,             -- key resolved by registry (in code)
  cadence         text        NOT NULL,             -- interval spec · e.g. "60s","5m","1h","daily"
  active          boolean     NOT NULL DEFAULT TRUE,
  meta            jsonb       NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_run_at     timestamptz NULL,
  next_due_at     timestamptz NOT NULL DEFAULT now(),
  run_count       bigint      NOT NULL DEFAULT 0,
  fail_count      bigint      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_nex_scheduled_job_due
  ON nex.scheduled_job (next_due_at) WHERE active = TRUE;

COMMENT ON TABLE nex.scheduled_job IS
  'Founder Phase 18 · P18-1 · job registry · cron-like scheduled agents.';

-- ═══════════════════════════════════════════════════════════════════
-- scheduled_job_run
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.scheduled_job_run (
  run_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid        NOT NULL REFERENCES nex.scheduled_job(job_id) ON DELETE CASCADE,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz NULL,
  ok              boolean     NULL,
  error           text        NULL,
  duration_ms     integer     NULL,
  result_summary  jsonb       NULL,
  triggered_by    text        NOT NULL              -- "tick" | "run-now" | "boot"
);

CREATE INDEX IF NOT EXISTS idx_nex_scheduled_run_job_time
  ON nex.scheduled_job_run (job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_scheduled_run_recent
  ON nex.scheduled_job_run (started_at DESC);

COMMENT ON TABLE nex.scheduled_job_run IS
  'Founder Phase 18 · P18-1 · every job execution · immutable audit trail.';
