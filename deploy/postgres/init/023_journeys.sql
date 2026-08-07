-- NEX Journey Engine · §5.12 · Phase 5.1
--
-- Doctrine: docs/JOURNEY_ENGINE_CHARTER.md
-- Kernel amendment: 11th invariant · Determinism
--
-- Three tables (Philip 2026-08-08 · locked MVP shape):
--   nex.journeys         · immutable versioned definitions
--   nex.journey_states   · per-contact execution state
--   nex.journey_events   · INSERT-only audit trail
--
-- Idempotent · additive-only. Zero changes to any v1.0 table.

-- ── nex.journeys · versioned definitions ─────────────────────────
CREATE TABLE IF NOT EXISTS nex.journeys (
  journey_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL,                                    -- stable human-readable id · shared across versions
  name             TEXT NOT NULL,
  description      TEXT,
  version          INT NOT NULL DEFAULT 1,                            -- immutable once published
  status           TEXT NOT NULL DEFAULT 'draft'   CHECK (status IN ('draft','active','paused','archived')),
  trigger_type     TEXT NOT NULL DEFAULT 'segment_join'  CHECK (trigger_type IN ('segment_join','manual')),
  trigger_config   JSONB NOT NULL DEFAULT '{}'::jsonb,               -- e.g. { "segment_id": "..." }
  definition       JSONB NOT NULL DEFAULT '{}'::jsonb,               -- { nodes: Node[], start_node_id: string }
  validation_errors JSONB,                                            -- populated by publish · null when valid
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at     TIMESTAMPTZ,
  paused_at        TIMESTAMPTZ,
  archived_at      TIMESTAMPTZ,
  UNIQUE (slug, version)
);

-- One Active per slug at a time · enforced via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS journeys_active_per_slug ON nex.journeys (slug) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS journeys_status_idx ON nex.journeys (status, updated_at DESC);

-- ── nex.journey_states · per-contact execution ───────────────────
CREATE TABLE IF NOT EXISTS nex.journey_states (
  state_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id         UUID NOT NULL REFERENCES nex.journeys(journey_id) ON DELETE RESTRICT,
  journey_slug       TEXT NOT NULL,                                    -- captured for cross-version queries
  journey_version    INT NOT NULL,                                     -- immutable once entered · doctrine §2
  contact_id         UUID NOT NULL,
  current_node_id    TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active'  CHECK (status IN ('active','waiting','completed','stopped','failed')),
  entered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_transition_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wait_until         TIMESTAMPTZ,
  random_seed        INT NOT NULL,                                     -- drawn ONCE at entry · deterministic randomness
  snapshot           JSONB NOT NULL DEFAULT '{}'::jsonb,               -- captured contact fields at entry
  completed_at       TIMESTAMPTZ,
  stopped_reason     TEXT,
  last_command       JSONB,                                            -- most recent emitted command · forensics
  UNIQUE (journey_id, contact_id)                                      -- one instance per journey per contact
);

CREATE INDEX IF NOT EXISTS journey_states_ready_idx      ON nex.journey_states (wait_until) WHERE status IN ('active','waiting');
CREATE INDEX IF NOT EXISTS journey_states_contact_idx    ON nex.journey_states (contact_id);
CREATE INDEX IF NOT EXISTS journey_states_slug_ver_idx   ON nex.journey_states (journey_slug, journey_version);

-- ── nex.journey_events · immutable audit trail ───────────────────
CREATE TABLE IF NOT EXISTS nex.journey_events (
  event_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id         UUID NOT NULL,
  journey_slug       TEXT NOT NULL,
  journey_version    INT NOT NULL,
  state_id           UUID,
  contact_id         UUID,
  event_type         TEXT NOT NULL   CHECK (event_type IN (
                       'JourneyStarted','WaitEntered','WaitExpired','BranchTaken',
                       'CampaignCommandEmitted','CampaignCompleted','GoalReached',
                       'JourneyCompleted','JourneyStopped','JourneyFailed'
                     )),
  from_node_id       TEXT,
  to_node_id         TEXT,
  emitted_command    JSONB,                                            -- when applicable · e.g. enqueue_send_batch
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journey_events_state_idx    ON nex.journey_events (state_id, occurred_at);
CREATE INDEX IF NOT EXISTS journey_events_journey_idx  ON nex.journey_events (journey_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS journey_events_contact_idx  ON nex.journey_events (contact_id, occurred_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE nex.journeys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.journey_states  ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.journey_events  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'journeys' AND policyname = 'service_role_all_journeys') THEN
    CREATE POLICY "service_role_all_journeys" ON nex.journeys FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'journey_states' AND policyname = 'service_role_all_journey_states') THEN
    CREATE POLICY "service_role_all_journey_states" ON nex.journey_states FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'journey_events' AND policyname = 'service_role_all_journey_events') THEN
    CREATE POLICY "service_role_all_journey_events" ON nex.journey_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.journeys       IS 'Versioned journey definitions · immutable once activated · one Active per slug';
COMMENT ON TABLE nex.journey_states IS 'Per-contact execution state · journey_version captured at entry per Journey Charter §2';
COMMENT ON TABLE nex.journey_events IS 'INSERT-only audit trail · full replayability · doctrine §3';
