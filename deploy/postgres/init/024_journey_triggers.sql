-- NEX Journey Engine · §5.13 · Phase 5.1.2 · Rich Triggers
--
-- Doctrine: docs/JOURNEY_ENGINE_CHARTER.md §11
-- Kernel amendment: 12th invariant · Triggers are pure event readers
--
-- Two additive tables:
--   nex.journey_triggers        · versioned trigger config (mirrors
--                                  the journey versioning pattern)
--   nex.journey_inbound_events  · immutable audit of every inbound
--                                  webhook · signed OR unsigned · for
--                                  integration forensics (Philip 2026-08-08)
--
-- Idempotent · additive-only · zero changes to any v1.0 table.

-- ── nex.journey_triggers · versioned per (journey_id, trigger_key) ──
CREATE TABLE IF NOT EXISTS nex.journey_triggers (
  trigger_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id         UUID NOT NULL REFERENCES nex.journeys(journey_id) ON DELETE CASCADE,
  trigger_key        TEXT NOT NULL,                                     -- stable id within a journey · shared across versions
  version            INT  NOT NULL DEFAULT 1,
  status             TEXT NOT NULL DEFAULT 'draft'  CHECK (status IN ('draft','active','paused','archived')),
  trigger_type       TEXT NOT NULL                  CHECK (trigger_type IN (
                       'segment_join','analytics_event','compliance_transition','inactivity','custom_webhook','schedule'
                     )),
  trigger_config     JSONB NOT NULL DEFAULT '{}'::jsonb,                 -- per-type config · see §11.2 in the charter
  dedup_window_sec   INT NOT NULL DEFAULT 60,                             -- suppresses rapid re-fires for the same contact
  correlation_scope  TEXT NOT NULL DEFAULT 'per_contact',                 -- how correlation_id is derived · 'per_contact' | 'per_event'
  last_fired_at      TIMESTAMPTZ,
  fire_count         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at       TIMESTAMPTZ,
  paused_at          TIMESTAMPTZ,
  archived_at        TIMESTAMPTZ,
  UNIQUE (journey_id, trigger_key, version)
);

-- One Active per (journey_id, trigger_key) at a time
CREATE UNIQUE INDEX IF NOT EXISTS journey_triggers_active_per_key
  ON nex.journey_triggers (journey_id, trigger_key) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS journey_triggers_type_active_idx
  ON nex.journey_triggers (trigger_type) WHERE status = 'active';

-- ── nex.journey_inbound_events · immutable audit + integration debug ──
CREATE TABLE IF NOT EXISTS nex.journey_inbound_events (
  inbound_event_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key          TEXT NOT NULL,                                    -- URL slug e.g. 'quote_created'
  received_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,               -- parsed body
  contact_id           UUID,                                              -- resolved from payload · null if resolution failed
  source               TEXT NOT NULL DEFAULT 'webhook'  CHECK (source IN ('webhook','internal')),
  -- Signature verification metadata (Philip 2026-08-08 · charter §11.5)
  verified_signature   BOOLEAN NOT NULL DEFAULT FALSE,
  signature_algorithm  TEXT,                                              -- 'hmac-sha256' · 'basic-auth' · 'sigv4' · null
  request_headers      JSONB NOT NULL DEFAULT '{}'::jsonb,                -- REDACTED · no authorization/cookie values
  raw_body_hash        TEXT,                                              -- SHA-256 hex of the raw request body
  ip                   TEXT,
  -- Processing outcome (INSERT-only after processing tick)
  processed_at         TIMESTAMPTZ,
  matched_triggers     INT NOT NULL DEFAULT 0,
  matched_journey_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,
  processing_error     TEXT
);

CREATE INDEX IF NOT EXISTS journey_inbound_events_key_time_idx ON nex.journey_inbound_events (trigger_key, received_at DESC);
CREATE INDEX IF NOT EXISTS journey_inbound_events_time_idx     ON nex.journey_inbound_events (received_at DESC);
CREATE INDEX IF NOT EXISTS journey_inbound_events_pending_idx  ON nex.journey_inbound_events (received_at) WHERE processed_at IS NULL;

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE nex.journey_triggers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.journey_inbound_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'journey_triggers' AND policyname = 'service_role_all_journey_triggers') THEN
    CREATE POLICY "service_role_all_journey_triggers" ON nex.journey_triggers FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'journey_inbound_events' AND policyname = 'service_role_all_journey_inbound_events') THEN
    CREATE POLICY "service_role_all_journey_inbound_events" ON nex.journey_inbound_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.journey_triggers       IS 'Versioned trigger config · one Active per (journey_id, trigger_key) · charter §11.3';
COMMENT ON TABLE nex.journey_inbound_events IS 'Immutable inbound webhook audit · signed AND unsigned recorded · charter §11.5';
