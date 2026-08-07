-- NEX Testing · §5.11 · benchmark + recovery run history
--
-- Purpose (Philip 2026-08-08):
--   "The important outcome isn't '100,000 recipients succeeded'.
--    It's being able to compare future changes against a stable baseline."
--
-- Both tables are INSERT-ONLY audit trails. Every run appends a row so
-- regressions across commits are visible.

CREATE TABLE IF NOT EXISTS nex.benchmark_runs (
  run_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label            TEXT,                                      -- optional · e.g. commit sha or manual note
  target_recipients INT NOT NULL,
  actual_recipients INT NOT NULL,
  wall_clock_ms    INT NOT NULL,
  metrics          JSONB NOT NULL DEFAULT '{}'::jsonb,        -- 13-key measurement bundle
  status           TEXT NOT NULL DEFAULT 'complete'  CHECK (status IN ('complete','failed','partial')),
  notes            TEXT,
  environment      JSONB NOT NULL DEFAULT '{}'::jsonb         -- node version, cpu count, adapter, sim-fast-mode, etc.
);
CREATE INDEX IF NOT EXISTS benchmark_runs_time_idx ON nex.benchmark_runs (ran_at DESC);

CREATE TABLE IF NOT EXISTS nex.recovery_runs (
  run_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label            TEXT,
  scenarios        JSONB NOT NULL DEFAULT '[]'::jsonb,        -- Array<{ name, status, duration_ms, observations }>
  passed           INT NOT NULL,
  failed           INT NOT NULL,
  skipped          INT NOT NULL,
  total            INT NOT NULL,
  overall_status   TEXT NOT NULL   CHECK (overall_status IN ('pass','fail','partial'))
);
CREATE INDEX IF NOT EXISTS recovery_runs_time_idx ON nex.recovery_runs (ran_at DESC);

ALTER TABLE nex.benchmark_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.recovery_runs  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'benchmark_runs' AND policyname = 'service_role_all_benchmark_runs') THEN
    CREATE POLICY "service_role_all_benchmark_runs" ON nex.benchmark_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'recovery_runs' AND policyname = 'service_role_all_recovery_runs') THEN
    CREATE POLICY "service_role_all_recovery_runs" ON nex.recovery_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.benchmark_runs IS 'INSERT-only stress benchmark history · one row per run · baseline comparison over time';
COMMENT ON TABLE nex.recovery_runs  IS 'INSERT-only recovery-scenario history · one row per suite run · PASS/FAIL per scenario in JSONB';
