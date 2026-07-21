-- Cron Runs · heartbeat log for every scheduled job.
-- Phase 6.3 of the engine-first roadmap.
--
-- Every Vercel cron + every pg_cron job writes here on start + finish.
-- The System Health page (/admin/system) reads this to answer:
--   "Which jobs haven't run when they should have?"
--
-- Job name is the URL path for Vercel crons ("/api/cron/monthly-washer-replenish")
-- or the function name for pg_cron ("hammerex_daily_analytics_rollup").

CREATE TABLE IF NOT EXISTS public.hammerex_cron_runs (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name        TEXT           NOT NULL,
  started_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  duration_ms     INTEGER,
  status          TEXT           NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'success', 'error', 'skipped')),
  error_message   TEXT,
  result_summary  TEXT,                     -- "36 rows updated" / "2 crashed / 132 sent"
  metadata        JSONB,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_recent
  ON public.hammerex_cron_runs (job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_runs_errors
  ON public.hammerex_cron_runs (started_at DESC)
  WHERE status = 'error';

ALTER TABLE public.hammerex_cron_runs ENABLE ROW LEVEL SECURITY;
-- Service-role only.
