-- NEX Analytics · §5.8 · Canonical event stream + incremental rollups
--
-- Layer position (Philip 2026-08-08):
--   Provider → Webhook/Simulator → Event Ingest → nex.analytics_events
--        → Aggregation Workers → Rollup Tables → Dashboards
--
-- Everything downstream (Executive Dashboard · Campaign Analytics ·
-- Segment Intelligence · Reports · A/B · Attribution) derives from
-- this ONE event stream. Future fields are reserved now so schema
-- changes are unnecessary when attribution, journeys, experiments,
-- and revenue land.
--
-- Idempotent · additive-only.

-- ── nex.analytics_events · canonical event stream ─────────────────
CREATE TABLE IF NOT EXISTS nex.analytics_events (
  event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type          TEXT NOT NULL   CHECK (event_type IN (
                        'queued','delivered','deferred','opened','clicked',
                        'bounced','complaint','unsubscribed','failed','suppressed'
                      )),
  event_timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- when the event OCCURRED (may be in the future for simulated opens)
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- when the row was inserted
  -- Identity
  campaign_id         UUID REFERENCES nex.campaigns(campaign_id) ON DELETE SET NULL,
  recipient_id        UUID,                                   -- contact_id · nullable for aggregate events
  segment_id          UUID,                                   -- first attached segment · captured for convenience
  provider            TEXT,                                   -- 'simulator' | 'smtp' | 'ses' | ...
  country             TEXT,
  domain              TEXT,
  -- Payload
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_message_id TEXT,
  user_agent          TEXT,                                   -- opened/clicked events
  ip                  TEXT,                                   -- opened/clicked events (hashed at read for privacy · Phase 4e.9)
  link_url            TEXT,                                   -- clicked events
  latency_ms          INT,                                    -- delivered · bounced events
  -- Future-proofing (Philip 2026-08-08 · reserved for later phases)
  conversion_value    NUMERIC(12, 2),
  revenue             NUMERIC(12, 2),
  attribution_window  INT,                                    -- days
  journey_id          UUID,
  automation_id       UUID,
  experiment_id       UUID,
  variant_id          TEXT
);

CREATE INDEX IF NOT EXISTS analytics_events_campaign_time_idx ON nex.analytics_events (campaign_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS analytics_events_type_time_idx     ON nex.analytics_events (event_type, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS analytics_events_recipient_idx     ON nex.analytics_events (recipient_id) WHERE recipient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_events_ingest_idx        ON nex.analytics_events (ingested_at DESC);

-- ── Rollup tables · updated incrementally by ingest ───────────────
--
-- Every rollup carries the same 15 metric columns so downstream
-- dashboards use one shape. Rates are STORED (not view-computed) so
-- reads are constant time. UPSERT on the natural key with atomic
-- increments — safe under concurrent ingest.

-- Shared metric columns macro-style (repeated for clarity)
--   sent · delivered · opens · unique_opens · clicks · unique_clicks
--   bounces · complaints · unsubscribes · failed · suppressed
--   delivery_rate · open_rate · click_rate · ctor
-- (unique_* incremented ONLY when the recipient hasn't already contributed
--  to that metric for that rollup; enforced by a separate uniqueness track
--  in Phase 4e.5 · today we treat unique_* as best-effort per ingest event)

CREATE TABLE IF NOT EXISTS nex.rollup_campaigns (
  campaign_id      UUID PRIMARY KEY REFERENCES nex.campaigns(campaign_id) ON DELETE CASCADE,
  sent             INT NOT NULL DEFAULT 0,
  delivered        INT NOT NULL DEFAULT 0,
  opens            INT NOT NULL DEFAULT 0,
  unique_opens     INT NOT NULL DEFAULT 0,
  clicks           INT NOT NULL DEFAULT 0,
  unique_clicks    INT NOT NULL DEFAULT 0,
  bounces          INT NOT NULL DEFAULT 0,
  complaints       INT NOT NULL DEFAULT 0,
  unsubscribes     INT NOT NULL DEFAULT 0,
  failed           INT NOT NULL DEFAULT 0,
  suppressed       INT NOT NULL DEFAULT 0,
  delivery_rate    NUMERIC(5,2),
  open_rate        NUMERIC(5,2),
  click_rate       NUMERIC(5,2),
  ctor             NUMERIC(5,2),
  first_event_at   TIMESTAMPTZ,
  last_event_at    TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nex.rollup_daily (
  day              DATE PRIMARY KEY,
  sent             INT NOT NULL DEFAULT 0,
  delivered        INT NOT NULL DEFAULT 0,
  opens            INT NOT NULL DEFAULT 0,
  unique_opens     INT NOT NULL DEFAULT 0,
  clicks           INT NOT NULL DEFAULT 0,
  unique_clicks    INT NOT NULL DEFAULT 0,
  bounces          INT NOT NULL DEFAULT 0,
  complaints       INT NOT NULL DEFAULT 0,
  unsubscribes     INT NOT NULL DEFAULT 0,
  failed           INT NOT NULL DEFAULT 0,
  suppressed       INT NOT NULL DEFAULT 0,
  delivery_rate    NUMERIC(5,2),
  open_rate        NUMERIC(5,2),
  click_rate       NUMERIC(5,2),
  ctor             NUMERIC(5,2),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nex.rollup_monthly (
  month            DATE PRIMARY KEY,                          -- first day of month
  sent             INT NOT NULL DEFAULT 0,
  delivered        INT NOT NULL DEFAULT 0,
  opens            INT NOT NULL DEFAULT 0,
  unique_opens     INT NOT NULL DEFAULT 0,
  clicks           INT NOT NULL DEFAULT 0,
  unique_clicks    INT NOT NULL DEFAULT 0,
  bounces          INT NOT NULL DEFAULT 0,
  complaints       INT NOT NULL DEFAULT 0,
  unsubscribes     INT NOT NULL DEFAULT 0,
  failed           INT NOT NULL DEFAULT 0,
  suppressed       INT NOT NULL DEFAULT 0,
  delivery_rate    NUMERIC(5,2),
  open_rate        NUMERIC(5,2),
  click_rate       NUMERIC(5,2),
  ctor             NUMERIC(5,2),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nex.rollup_country (
  country          TEXT PRIMARY KEY,
  sent             INT NOT NULL DEFAULT 0,
  delivered        INT NOT NULL DEFAULT 0,
  opens            INT NOT NULL DEFAULT 0,
  clicks           INT NOT NULL DEFAULT 0,
  bounces          INT NOT NULL DEFAULT 0,
  unsubscribes     INT NOT NULL DEFAULT 0,
  delivery_rate    NUMERIC(5,2),
  open_rate        NUMERIC(5,2),
  click_rate       NUMERIC(5,2),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nex.rollup_provider (
  provider         TEXT PRIMARY KEY,
  sent             INT NOT NULL DEFAULT 0,
  delivered        INT NOT NULL DEFAULT 0,
  opens            INT NOT NULL DEFAULT 0,
  clicks           INT NOT NULL DEFAULT 0,
  bounces          INT NOT NULL DEFAULT 0,
  complaints       INT NOT NULL DEFAULT 0,
  unsubscribes     INT NOT NULL DEFAULT 0,
  failed           INT NOT NULL DEFAULT 0,
  avg_latency_ms   INT,
  delivery_rate    NUMERIC(5,2),
  open_rate        NUMERIC(5,2),
  click_rate       NUMERIC(5,2),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nex.rollup_segment (
  segment_id       UUID PRIMARY KEY REFERENCES nex.contact_segments(segment_id) ON DELETE CASCADE,
  sent             INT NOT NULL DEFAULT 0,
  delivered        INT NOT NULL DEFAULT 0,
  opens            INT NOT NULL DEFAULT 0,
  unique_opens     INT NOT NULL DEFAULT 0,
  clicks           INT NOT NULL DEFAULT 0,
  unique_clicks    INT NOT NULL DEFAULT 0,
  bounces          INT NOT NULL DEFAULT 0,
  unsubscribes     INT NOT NULL DEFAULT 0,
  campaigns_used_in INT NOT NULL DEFAULT 0,
  delivery_rate    NUMERIC(5,2),
  open_rate        NUMERIC(5,2),
  click_rate       NUMERIC(5,2),
  engagement_score NUMERIC(5,2),                              -- opens*1 + clicks*3 / sent · Phase 4e.5
  best_hour_utc    INT,                                        -- 0-23 · updated by segment-scoring worker
  best_weekday     INT,                                        -- 0-6 (Sun-Sat)
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE nex.analytics_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.rollup_campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.rollup_daily       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.rollup_monthly     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.rollup_country     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.rollup_provider    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.rollup_segment     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'analytics_events' AND policyname = 'service_role_all_analytics_events') THEN
    CREATE POLICY "service_role_all_analytics_events" ON nex.analytics_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'rollup_campaigns' AND policyname = 'service_role_all_rollup_campaigns') THEN
    CREATE POLICY "service_role_all_rollup_campaigns" ON nex.rollup_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'rollup_daily' AND policyname = 'service_role_all_rollup_daily') THEN
    CREATE POLICY "service_role_all_rollup_daily" ON nex.rollup_daily FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'rollup_monthly' AND policyname = 'service_role_all_rollup_monthly') THEN
    CREATE POLICY "service_role_all_rollup_monthly" ON nex.rollup_monthly FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'rollup_country' AND policyname = 'service_role_all_rollup_country') THEN
    CREATE POLICY "service_role_all_rollup_country" ON nex.rollup_country FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'rollup_provider' AND policyname = 'service_role_all_rollup_provider') THEN
    CREATE POLICY "service_role_all_rollup_provider" ON nex.rollup_provider FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'rollup_segment' AND policyname = 'service_role_all_rollup_segment') THEN
    CREATE POLICY "service_role_all_rollup_segment" ON nex.rollup_segment FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.analytics_events IS 'Canonical event stream · 10 event types · single source of truth for all analytics · future fields reserved for attribution/journeys/experiments/revenue';
COMMENT ON TABLE nex.rollup_campaigns IS 'Incremental per-campaign rollup · updated by ingest · 15 metric columns';
