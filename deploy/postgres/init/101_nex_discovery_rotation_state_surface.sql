-- 101_nex_discovery_rotation_state_surface.sql
-- P0 · 2026-08-24 · Philip greenlight (a) atomic change.
--
-- Add SURFACE dimension to nex.discovery_rotation_state so the discovery work
-- unit becomes (city, category, surface, round) instead of (city, category,
-- round). Distinguishes geographic saturation from provider/query-surface
-- saturation · fixes the false-`prambanan` placeholder that made 7 non-
-- Yogyakarta cities look saturated when the walker was actually walking the
-- correct city bbox but recording a lying surface name.
--
-- Constitutional guarantees preserved:
--   · ONE Geographic Authority (Rotation Controller / Orchestrator)
--   · SATURATION_THRESHOLD_CYCLES=3 unchanged
--   · MAINTENANCE_COOLDOWN_HOURS=72 unchanged
--   · Provider Rate Governor unchanged
--   · No competing scheduler introduced
--
-- Reversibility:
--   To revert this migration:
--     ALTER TABLE nex.discovery_rotation_state DROP CONSTRAINT rotation_unique_per_round_surface;
--     ALTER TABLE nex.discovery_rotation_state ADD CONSTRAINT rotation_unique_per_round
--       UNIQUE (city, category, round);
--     ALTER TABLE nex.discovery_rotation_state DROP COLUMN surface;
--   No data is destroyed by the reversal · the column and its unique constraint
--   are dropped but the row identities preserved via (city, category, round).

BEGIN;

-- Column: surface identifies the specific discovery surface (bbox name for
-- food/accommodation, zone id for market, query-universe name for transport).
-- Default 'default' so any pre-existing insert paths continue to work; the
-- upgraded walker/orchestrator writes the real surface name explicitly.
ALTER TABLE nex.discovery_rotation_state
  ADD COLUMN IF NOT EXISTS surface TEXT NOT NULL DEFAULT 'default';

-- Replace the (city, category, round) uniqueness with the new 4-tuple.
-- We keep rotation_id as the surrogate PK · only the UNIQUE constraint changes.
ALTER TABLE nex.discovery_rotation_state
  DROP CONSTRAINT IF EXISTS rotation_unique_per_round;

ALTER TABLE nex.discovery_rotation_state
  ADD CONSTRAINT rotation_unique_per_round_surface
    UNIQUE (city, category, surface, round);

-- Index for the picker's typical lookup pattern.
CREATE INDEX IF NOT EXISTS discovery_rotation_state_lookup_idx
  ON nex.discovery_rotation_state (city, category, surface, round);

COMMIT;

-- Verification query (run manually after apply):
--   SELECT count(*) FROM nex.discovery_rotation_state;              -- unchanged
--   SELECT DISTINCT surface FROM nex.discovery_rotation_state;      -- shows 'default'
--   SELECT conname FROM pg_constraint
--     WHERE conrelid='nex.discovery_rotation_state'::regclass;      -- shows rotation_unique_per_round_surface
