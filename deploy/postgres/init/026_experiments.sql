-- NEX A/B Testing · §5.15 · Phase 5.2
--
-- Doctrine: docs/JOURNEY_ENGINE_CHARTER.md §12
-- v1.0 amendment 1.0.3 · invariant #13 (sticky deterministic assignment)
--
-- Three additive tables:
--   nex.experiments             · versioned experiment definitions with immutable seed
--   nex.experiment_variants     · variants (A/B/C etc) with allocation_pct summing to 100
--   nex.experiment_assignments  · sticky per (experiment_id, contact_id) · UNIQUE enforces #13
--
-- Zero changes to any v1.0 table.

CREATE TABLE IF NOT EXISTS nex.experiments (
  experiment_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  version             INT NOT NULL DEFAULT 1,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','active','paused','ended')),
  scope_type          TEXT NOT NULL DEFAULT 'journey_node'
                        CHECK (scope_type IN ('journey_node','campaign')),
  scope_ref           TEXT,                                        -- for journey_node: journey_id · for campaign: campaign_id
  goal_event_type     TEXT NOT NULL DEFAULT 'clicked',              -- one of the canonical event types
  goal_within_seconds INT NOT NULL DEFAULT 604800,                  -- default 7 days · configurable
  seed                BIGINT NOT NULL,                              -- immutable · drives deterministic hash
  start_at            TIMESTAMPTZ,
  end_at              TIMESTAMPTZ,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at        TIMESTAMPTZ,
  paused_at           TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  UNIQUE (slug, version)
);

-- One Active per slug at a time · mirrors journey pattern
CREATE UNIQUE INDEX IF NOT EXISTS experiments_active_per_slug
  ON nex.experiments (slug) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS experiments_status_idx
  ON nex.experiments (status, updated_at DESC);

-- ── nex.experiment_variants ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.experiment_variants (
  experiment_id       UUID NOT NULL REFERENCES nex.experiments(experiment_id) ON DELETE CASCADE,
  variant_id          TEXT NOT NULL,                                -- 'A' · 'B' · 'C' · etc
  name                TEXT,
  allocation_pct      NUMERIC(5,2) NOT NULL CHECK (allocation_pct > 0 AND allocation_pct <= 100),
  target_node_id      TEXT,                                          -- for scope=journey_node
  target_campaign_id  UUID REFERENCES nex.campaigns(campaign_id) ON DELETE SET NULL,   -- for scope=campaign
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (experiment_id, variant_id)
);

-- ── nex.experiment_assignments · sticky per (experiment, contact) ──
--
-- UNIQUE(experiment_id, contact_id) enforces invariant #13:
-- "A contact receives exactly one variant assignment per experiment."
-- Duplicate ticks that call assignForContact() will hit the unique
-- index and read back the existing assignment · never reassign.
CREATE TABLE IF NOT EXISTS nex.experiment_assignments (
  assignment_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id       UUID NOT NULL REFERENCES nex.experiments(experiment_id) ON DELETE CASCADE,
  contact_id          UUID NOT NULL,
  variant_id          TEXT NOT NULL,
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_hash       BIGINT NOT NULL,                              -- forensics · replay verification
  UNIQUE (experiment_id, contact_id),
  FOREIGN KEY (experiment_id, variant_id) REFERENCES nex.experiment_variants(experiment_id, variant_id)
);

CREATE INDEX IF NOT EXISTS experiment_assignments_variant_idx
  ON nex.experiment_assignments (experiment_id, variant_id);

CREATE INDEX IF NOT EXISTS experiment_assignments_contact_idx
  ON nex.experiment_assignments (contact_id);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE nex.experiments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.experiment_variants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.experiment_assignments  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'experiments' AND policyname = 'service_role_all_experiments') THEN
    CREATE POLICY "service_role_all_experiments" ON nex.experiments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'experiment_variants' AND policyname = 'service_role_all_experiment_variants') THEN
    CREATE POLICY "service_role_all_experiment_variants" ON nex.experiment_variants FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'experiment_assignments' AND policyname = 'service_role_all_experiment_assignments') THEN
    CREATE POLICY "service_role_all_experiment_assignments" ON nex.experiment_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.experiments IS 'Versioned experiment defs with immutable seed · one Active per slug · charter §12';
COMMENT ON TABLE nex.experiment_variants IS 'Allocation must sum to 100 across variants of the same experiment (checked at activation)';
COMMENT ON TABLE nex.experiment_assignments IS 'Sticky per (experiment_id, contact_id) · UNIQUE constraint enforces invariant #13';
