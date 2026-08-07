-- NEX Infrastructure Runtime · §5.6 · analytics_records
-- Retention: 730 days rolling.

CREATE TABLE IF NOT EXISTS nex.analytics_records (
  record_id            UUID PRIMARY KEY,
  provider             TEXT NOT NULL,
  event_name           TEXT,
  path                 TEXT,
  hostname             TEXT,
  referrer             TEXT,
  country              TEXT,
  device               TEXT,
  browser              TEXT,
  os                   TEXT,
  session_id           TEXT,
  visitor_id           TEXT,
  duration_sec         INTEGER,
  bounced              BOOLEAN,
  properties           JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at          TIMESTAMPTZ NOT NULL,
  ingested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_provider_ts_idx    ON nex.analytics_records (provider, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_path_ts_idx        ON nex.analytics_records (path, occurred_at DESC) WHERE path IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_country_idx        ON nex.analytics_records (country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_business_id_idx    ON nex.analytics_records (business_id, occurred_at DESC) WHERE business_id IS NOT NULL;

ALTER TABLE nex.analytics_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'analytics_records' AND policyname = 'service_role_all_analytics') THEN
    CREATE POLICY "service_role_all_analytics" ON nex.analytics_records FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.analytics_records IS 'Infrastructure Runtime §5.6 · Analytics Service · 730d retention';
