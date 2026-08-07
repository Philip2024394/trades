-- NEX Infrastructure Runtime · §5.1 · worker_audit_events
-- Retention: 90 days rolling.

CREATE TABLE IF NOT EXISTS nex.worker_audit_events (
  event_id             UUID PRIMARY KEY,
  worker_type          TEXT NOT NULL,
  event_type           TEXT NOT NULL,
  actor                TEXT,
  job_id               TEXT,
  input_ref            TEXT,
  details              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latency_ms           INTEGER,
  tokens_in            INTEGER,
  tokens_out           INTEGER,
  provider             TEXT,
  model                TEXT,
  error                TEXT,
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wae_worker_type_idx  ON nex.worker_audit_events (worker_type, created_at DESC);
CREATE INDEX IF NOT EXISTS wae_job_id_idx       ON nex.worker_audit_events (job_id, created_at DESC) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wae_provider_idx     ON nex.worker_audit_events (provider, created_at DESC) WHERE provider IS NOT NULL;
CREATE INDEX IF NOT EXISTS wae_business_id_idx  ON nex.worker_audit_events (business_id, created_at DESC) WHERE business_id IS NOT NULL;

ALTER TABLE nex.worker_audit_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'worker_audit_events' AND policyname = 'service_role_all_wae') THEN
    CREATE POLICY "service_role_all_wae" ON nex.worker_audit_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.worker_audit_events IS 'Infrastructure Runtime §5.1 · Worker Manager audit trail · 90d retention';
