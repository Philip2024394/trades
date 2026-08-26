-- 108_nex_rotation_reactivation_cooldown.sql
--
-- Reactivation policy Phase 3 · Philip 2026-08-26 production launch directive.
-- Adds cooldown_until so the rotation controller can auto-transition
-- saturated → reactivate when the timer expires. Also enables the
-- provider-refresh trigger (setting cooldown_until = NOW() forces
-- immediate reactivation eligibility).
--
-- Doctrine anchor: project_nex_walker_production_launch_directive_2026_08_26
--   "saturation is now a cooldown, not a death sentence" (Philip 2026-08-26).
--
-- Cooldown durations (approved 2026-08-26):
--   food          → 6 hours
--   accommodation → 6 hours
--   transport     → 6 hours
--   market        → 12 hours
--   after 3 consecutive unproductive reactivations → 2× backoff
--   provider/query refresh                        → immediate (cooldown_until = NOW())
--
-- Backward-safe: additive only. Existing 60 saturated rows get cooldown_until=NULL
-- initially; the rotation-tick backfills cooldown_until on its next pass with
-- reactivation_reason='cooldown-defaulted' so they naturally re-enter the loop.
--
-- Reversible:
--   BEGIN;
--     DROP INDEX IF EXISTS nex.idx_rotation_state_cooldown;
--     ALTER TABLE nex.discovery_rotation_state DROP COLUMN IF EXISTS cooldown_until;
--     ALTER TABLE nex.discovery_rotation_state DROP COLUMN IF EXISTS reactivation_count;
--   COMMIT;

BEGIN;

ALTER TABLE nex.discovery_rotation_state
  ADD COLUMN IF NOT EXISTS cooldown_until       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reactivation_count   INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_rotation_state_cooldown
  ON nex.discovery_rotation_state (cooldown_until)
  WHERE cooldown_until IS NOT NULL AND state = 'saturated';

COMMENT ON COLUMN nex.discovery_rotation_state.cooldown_until IS
  'Reactivation policy 2026-08-26. When state=saturated, rotation-tick promotes to reactivate once cooldown_until < NOW(). Provider-refresh trigger sets this to NOW() for immediate reactivation. NULL = no cooldown set (rotation-tick backfills on next pass with reactivation_reason=cooldown-defaulted).';
COMMENT ON COLUMN nex.discovery_rotation_state.reactivation_count IS
  'Number of times this surface has cycled through saturated→reactivate→build. Used for 2× cooldown backoff after 3 consecutive unproductive reactivations.';

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='discovery_rotation_state' AND column_name='cooldown_until')
  THEN RAISE EXCEPTION 'Migration 108 failed: cooldown_until not added'; END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='discovery_rotation_state' AND column_name='reactivation_count')
  THEN RAISE EXCEPTION 'Migration 108 failed: reactivation_count not added'; END IF;
  RAISE NOTICE 'Migration 108 complete';
END $$;

COMMIT;
