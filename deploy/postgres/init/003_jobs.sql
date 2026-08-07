-- NEX Infrastructure Runtime · §5.2 · jobs
-- Snapshot store · append-only · latest-per-key on job_id via query view.
-- Retention: forever.

CREATE TABLE IF NOT EXISTS nex.jobs (
  snapshot_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id               TEXT NOT NULL,
  source               TEXT,
  owner                TEXT,
  business_id          UUID,
  created_at           TIMESTAMPTZ NOT NULL,
  knowledge_type       TEXT,
  target_brains        JSONB NOT NULL DEFAULT '[]'::jsonb,
  status               TEXT NOT NULL,
  progress             REAL,
  completion_result    JSONB,
  inbox_item_id        TEXT,
  title                TEXT,
  content_length       INTEGER,
  updated_at           TIMESTAMPTZ NOT NULL,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jobs_job_id_updated_idx    ON nex.jobs (job_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS jobs_status_updated_idx    ON nex.jobs (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS jobs_owner_created_idx     ON nex.jobs (owner, created_at DESC) WHERE owner IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_inbox_item_id_idx     ON nex.jobs (inbox_item_id) WHERE inbox_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_business_id_idx       ON nex.jobs (business_id, updated_at DESC) WHERE business_id IS NOT NULL;

ALTER TABLE nex.jobs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'jobs' AND policyname = 'service_role_all_jobs') THEN
    CREATE POLICY "service_role_all_jobs" ON nex.jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.jobs IS 'Infrastructure Runtime §5.2 · Worker Manager job snapshots · retention forever';
