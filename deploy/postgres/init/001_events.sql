-- NEX Infrastructure Runtime · §5.1 · events
--
-- Intelligence Event Bus · audit truth surface · retention forever.
-- Every write is a snapshot; event_id is unique so replays are idempotent.

CREATE TABLE IF NOT EXISTS nex.events (
  event_id             UUID PRIMARY KEY,
  event_type           TEXT NOT NULL,
  source               TEXT NOT NULL,
  actor_id             TEXT,
  timestamp            TIMESTAMPTZ NOT NULL,
  business_id          UUID,                                   -- Contract §2 principle 6 · NULL = system
  related_department   TEXT,
  related_brain        TEXT,
  related_job          TEXT,
  related_contact      TEXT,
  outcome              TEXT NOT NULL,
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
  reversible           BOOLEAN NOT NULL DEFAULT FALSE,
  reverse_of           TEXT,
  supersedes           TEXT,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()      -- differs from timestamp during dual-write catch-up
);

CREATE INDEX IF NOT EXISTS events_timestamp_desc_idx      ON nex.events (timestamp DESC);
CREATE INDEX IF NOT EXISTS events_type_ts_idx             ON nex.events (event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS events_related_job_idx         ON nex.events (related_job, timestamp DESC) WHERE related_job IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_related_department_idx  ON nex.events (related_department, timestamp DESC) WHERE related_department IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_business_id_idx         ON nex.events (business_id, timestamp DESC) WHERE business_id IS NOT NULL;

ALTER TABLE nex.events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'events' AND policyname = 'service_role_all_events') THEN
    CREATE POLICY "service_role_all_events" ON nex.events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.events IS 'Intelligence Event Bus · Infrastructure Runtime §5.1 · retention forever · audit truth';
