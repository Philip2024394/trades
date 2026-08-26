-- 109_nex_rotation_consecutive_unproductive.sql
--
-- Reactivation policy P3 · Philip 2026-08-26.
-- Tracks consecutive reactivation cycles that produced zero new records so the
-- rotation-tick can apply 2× backoff to cooldown after 3 unproductive
-- reactivations in a row. Reset when any productive cycle happens.
--
-- Doctrine anchor: project_nex_walker_production_launch_directive_2026_08_26
--   "Double cooldown after 3 consecutive unproductive reactivation cycles."
--
-- Backward-safe: additive column, NOT NULL DEFAULT 0. Existing 60+ saturated
-- rows initialise to 0 · effectively "clean slate" from the P3 rollout moment.
--
-- Reversible:
--   BEGIN;
--     ALTER TABLE nex.discovery_rotation_state
--       DROP COLUMN IF EXISTS consecutive_unproductive_reactivations;
--   COMMIT;

BEGIN;

ALTER TABLE nex.discovery_rotation_state
  ADD COLUMN IF NOT EXISTS consecutive_unproductive_reactivations INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN nex.discovery_rotation_state.consecutive_unproductive_reactivations IS
  'Number of consecutive reactivations that produced zero new records. Reset to 0 by any productive cycle. Rotation-tick uses this to double cooldown when >= 3 (Philip 2026-08-26).';

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='discovery_rotation_state'
      AND column_name='consecutive_unproductive_reactivations')
  THEN RAISE EXCEPTION 'Migration 109 failed'; END IF;
  RAISE NOTICE 'Migration 109 complete';
END $$;

COMMIT;
