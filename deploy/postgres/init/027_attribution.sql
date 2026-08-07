-- NEX Attribution · §5.16 · Phase 5.3
--
-- Doctrine: docs/JOURNEY_ENGINE_CHARTER.md §13
-- v1.0 amendment 1.0.4 · invariant #14 (Attribution is Observational)
--
-- Two additive tables:
--   nex.conversion_events · recorded conversions (quote_requested,
--                            deposit_paid, installation_completed, etc)
--   nex.attributions      · computed credit assignment per model
--
-- Zero changes to any v1.0 table.

CREATE TABLE IF NOT EXISTS nex.conversion_events (
  conversion_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id        UUID NOT NULL,
  event_type        TEXT NOT NULL,                                -- 'quote_requested' | 'deposit_paid' | 'installation_completed' | 'final_payment' | any string
  conversion_value  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'GBP',
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_days       INT NOT NULL DEFAULT 30,                      -- attribution look-back
  source            TEXT NOT NULL DEFAULT 'webhook'  CHECK (source IN ('webhook','internal','manual','import')),
  correlation_id    TEXT,                                          -- optional · link related conversions (e.g. deposit → install → final)
  external_ref      TEXT,                                          -- optional · idempotency key from source system
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, external_ref)                                    -- idempotent per external system
);

CREATE INDEX IF NOT EXISTS conversion_events_contact_idx     ON nex.conversion_events (contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS conversion_events_type_idx        ON nex.conversion_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS conversion_events_correlation_idx ON nex.conversion_events (correlation_id) WHERE correlation_id IS NOT NULL;

-- ── nex.attributions · computed credit assignment ────────────────
--
-- One row per (conversion, model, source_event) triple. UNIQUE
-- constraint enforces idempotent replay (invariant #14).
CREATE TABLE IF NOT EXISTS nex.attributions (
  attribution_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id            UUID NOT NULL REFERENCES nex.conversion_events(conversion_id) ON DELETE CASCADE,
  contact_id               UUID NOT NULL,
  model                    TEXT NOT NULL CHECK (model IN ('first_touch','last_touch','linear')),
  window_days              INT NOT NULL,
  credit_pct               NUMERIC(6, 3) NOT NULL,                 -- 0 - 100
  attributed_value         NUMERIC(12, 2) NOT NULL,
  currency                 TEXT NOT NULL,
  -- Touchpoint context (all optional · reflects whatever the source analytics_event carried)
  source_event_id          UUID,                                    -- analytics_events.event_id
  source_event_type        TEXT,
  source_event_timestamp   TIMESTAMPTZ,
  campaign_id              UUID,
  journey_id               UUID,
  journey_version          INT,
  experiment_id            UUID,
  variant_id               TEXT,
  provider                 TEXT,
  country                  TEXT,
  domain                   TEXT,
  -- Bookkeeping
  attribution_run_id       UUID,                                    -- groups a batch of computations
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversion_id, model, source_event_id)
);

CREATE INDEX IF NOT EXISTS attributions_conversion_idx      ON nex.attributions (conversion_id);
CREATE INDEX IF NOT EXISTS attributions_contact_idx         ON nex.attributions (contact_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS attributions_campaign_idx        ON nex.attributions (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS attributions_journey_idx         ON nex.attributions (journey_id)  WHERE journey_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS attributions_experiment_idx      ON nex.attributions (experiment_id, variant_id) WHERE experiment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS attributions_model_idx           ON nex.attributions (model, computed_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE nex.conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.attributions      ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'conversion_events' AND policyname = 'service_role_all_conversion_events') THEN
    CREATE POLICY "service_role_all_conversion_events" ON nex.conversion_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'attributions' AND policyname = 'service_role_all_attributions') THEN
    CREATE POLICY "service_role_all_attributions" ON nex.attributions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.conversion_events IS 'Business conversions · one row per outcome (quote/deposit/install/final) · UNIQUE(source, external_ref) for webhook idempotency';
COMMENT ON TABLE nex.attributions      IS 'Computed credit rows · UNIQUE(conversion_id, model, source_event_id) for replay idempotency · invariant #14';
