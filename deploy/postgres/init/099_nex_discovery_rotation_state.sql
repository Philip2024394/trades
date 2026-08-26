-- deploy/postgres/init/099_nex_discovery_rotation_state.sql
--
-- NEX Discovery Rotation Controller · CONSTITUTIONAL state store (2026-08-24).
--
-- One row per (city, category, round). Tracks whether this combo is actively
-- finding new records or has saturated · drives the central controller that
-- decides which walker to promote next.
--
-- Doctrine anchor: project_nex_discovery_rotation_controller_2026_08_24
--
-- Additive · reversible. Applied by scripts/nex-discovery-rotation/_apply-migration.mjs.

BEGIN;

DO $$ BEGIN
  CREATE TYPE nex.discovery_rotation_state_kind AS ENUM (
    'build',        -- records_new > 0 in recent cycles · aggressive walking
    'saturated',    -- N consecutive cycles with records_new=0 · stop hammering
    'maintenance',  -- cooldown after saturation · occasional light re-check
    'reactivate'    -- provider/query/taxonomy changed · resume BUILD next cycle
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS nex.discovery_rotation_state (
  rotation_id                   uuid                                    PRIMARY KEY DEFAULT gen_random_uuid(),
  city                          text                                    NOT NULL,     -- e.g. 'Yogyakarta'
  category                      text                                    NOT NULL,     -- e.g. 'accommodation','food','transport','market'
  round                         int                                     NOT NULL DEFAULT 1 CHECK (round >= 1),
  state                         nex.discovery_rotation_state_kind       NOT NULL DEFAULT 'build',
  -- Productivity signal
  consecutive_zero_new_cycles   int                                     NOT NULL DEFAULT 0 CHECK (consecutive_zero_new_cycles >= 0),
  total_records_last_cycle      int                                                        ,
  records_new_last_cycle        int                                                        ,
  -- Timestamps
  last_cycle_started_at         timestamptz                                              ,
  last_productive_at            timestamptz                                              ,
  last_evaluated_at             timestamptz                             NOT NULL DEFAULT now(),
  state_entered_at              timestamptz                             NOT NULL DEFAULT now(),
  -- Reactivation trigger reference · human-readable · no FK enforcement (may
  -- reference a memory doc, a new provider slot id, a query-universe version, etc).
  reactivation_reason           text                                                     ,
  next_action_hint              text                                                     ,
  notes                         text                                                     ,
  updated_at                    timestamptz                             NOT NULL DEFAULT now(),
  CONSTRAINT rotation_unique_per_round UNIQUE (city, category, round)
);

CREATE INDEX IF NOT EXISTS idx_rotation_state_state
  ON nex.discovery_rotation_state (state);
CREATE INDEX IF NOT EXISTS idx_rotation_state_last_evaluated
  ON nex.discovery_rotation_state (last_evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rotation_state_city_category
  ON nex.discovery_rotation_state (city, category);

COMMENT ON TABLE nex.discovery_rotation_state IS
  'Central Discovery Rotation Controller state · one row per (city, category, round). Lifecycle: build → saturated → maintenance → reactivate → build. Populated by scripts/nex-discovery-rotation/_rotation-tick.mjs from live worker_cycle_run history · never manually inflated.';

COMMENT ON COLUMN nex.discovery_rotation_state.consecutive_zero_new_cycles IS
  'Count of consecutive cycles (most recent first) with records_new=0. Threshold for transition to SATURATED is defined in src/lib/nex-hq/discovery-rotation.ts · currently 3.';

COMMENT ON COLUMN nex.discovery_rotation_state.reactivation_reason IS
  'Free-text · e.g. "new_provider:facebook_public", "new_taxonomy_l3_sample", "walker_query_universe_v2". Set when transitioning maintenance/saturated → reactivate.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.discovery_rotation_state;
--     DROP TYPE  IF EXISTS nex.discovery_rotation_state_kind;
--   COMMIT;
