-- NEX Infrastructure Runtime · §5.5 · tracking_events
-- Retention: 365 days rolling.

CREATE TABLE IF NOT EXISTS nex.tracking_events (
  event_id             UUID PRIMARY KEY,
  session_id           TEXT,
  contact_id           TEXT,
  fingerprint          TEXT,
  event_name           TEXT NOT NULL,
  path                 TEXT,
  referrer             TEXT,
  user_agent           TEXT,
  ip_prefix            TEXT,
  utm_source           TEXT,
  utm_medium           TEXT,
  utm_campaign         TEXT,
  utm_content          TEXT,
  utm_term             TEXT,
  properties           JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at          TIMESTAMPTZ NOT NULL,
  server_received_at   TIMESTAMPTZ,
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tracking_session_idx       ON nex.tracking_events (session_id, occurred_at DESC) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracking_contact_idx       ON nex.tracking_events (contact_id, occurred_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracking_utm_campaign_idx  ON nex.tracking_events (utm_campaign, occurred_at DESC) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracking_occurred_idx      ON nex.tracking_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS tracking_business_id_idx   ON nex.tracking_events (business_id, occurred_at DESC) WHERE business_id IS NOT NULL;

ALTER TABLE nex.tracking_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'tracking_events' AND policyname = 'service_role_all_tracking') THEN
    CREATE POLICY "service_role_all_tracking" ON nex.tracking_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.tracking_events IS 'Infrastructure Runtime §5.5 · Event Tracking Service · 365d retention';
