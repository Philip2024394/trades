-- NEX Infrastructure Runtime · §5.2 · recovery_attempts
-- Retention: 180 days.

CREATE TABLE IF NOT EXISTS nex.recovery_attempts (
  attempt_id           UUID PRIMARY KEY,
  job_id               TEXT NOT NULL,
  level                INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  level_name           TEXT NOT NULL,
  action               TEXT NOT NULL,
  at                   TIMESTAMPTZ NOT NULL,
  outcome              TEXT NOT NULL,
  detail               TEXT,
  target_provider      TEXT,
  target_worker        TEXT,
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recovery_job_at_idx        ON nex.recovery_attempts (job_id, at DESC);
CREATE INDEX IF NOT EXISTS recovery_level_at_idx      ON nex.recovery_attempts (level, at DESC);
CREATE INDEX IF NOT EXISTS recovery_outcome_at_idx    ON nex.recovery_attempts (outcome, at DESC);
CREATE INDEX IF NOT EXISTS recovery_business_id_idx   ON nex.recovery_attempts (business_id, at DESC) WHERE business_id IS NOT NULL;

ALTER TABLE nex.recovery_attempts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'recovery_attempts' AND policyname = 'service_role_all_recovery') THEN
    CREATE POLICY "service_role_all_recovery" ON nex.recovery_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.recovery_attempts IS 'Infrastructure Runtime §5.2 · Recovery Manager attempts · 180d retention';
