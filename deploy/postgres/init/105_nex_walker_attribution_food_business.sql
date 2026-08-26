-- 105_nex_walker_attribution_food_business.sql
--
-- Persistence-contract Phase 1 · Philip 2026-08-26 production launch directive.
-- Adds walker attribution so every row can be traced to the cycle that created it.
--
-- Precedent: migration 071 (food_business_field_provenance.cycle_run_id).
-- Doctrine anchor: project_nex_walker_production_launch_directive_2026_08_26
--
-- Backward-safe: additive only, no defaults, no backfill. Existing food_business
-- rows stay NULL for both columns — honest attribution (we cannot fabricate a
-- worker/cycle for rows created before this contract existed).
--
-- ON DELETE SET NULL: if a worker_cycle_run row is ever purged, the business
-- record survives with cycle_run_id=NULL. Never a cascading delete.
--
-- Reversible:
--   BEGIN;
--     DROP INDEX IF EXISTS nex.idx_food_business_cycle_run;
--     DROP INDEX IF EXISTS nex.idx_food_business_worker_id;
--     ALTER TABLE nex.food_business DROP COLUMN IF EXISTS worker_id;
--     ALTER TABLE nex.food_business DROP COLUMN IF EXISTS cycle_run_id;
--   COMMIT;

BEGIN;

ALTER TABLE nex.food_business
  ADD COLUMN IF NOT EXISTS worker_id     TEXT,
  ADD COLUMN IF NOT EXISTS cycle_run_id  UUID
    REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_food_business_cycle_run
  ON nex.food_business (cycle_run_id) WHERE cycle_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_food_business_worker_id
  ON nex.food_business (worker_id) WHERE worker_id IS NOT NULL;

COMMENT ON COLUMN nex.food_business.worker_id IS
  'Persistence contract 2026-08-26 · worker_id matching nex.worker_heartbeat.worker_id (e.g. "acquisition:food:Yogyakarta"). NULL for pre-contract rows.';
COMMENT ON COLUMN nex.food_business.cycle_run_id IS
  'Persistence contract 2026-08-26 · FK to worker_cycle_run.id. Walker SELECT-verify + walkers:proof derive records_new from DB truth via this FK. NULL for pre-contract rows.';

DO $$
DECLARE has_worker BOOLEAN; has_cycle BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='food_business' AND column_name='worker_id') INTO has_worker;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='food_business' AND column_name='cycle_run_id') INTO has_cycle;
  IF NOT has_worker THEN RAISE EXCEPTION 'Migration 105 failed: worker_id not added'; END IF;
  IF NOT has_cycle  THEN RAISE EXCEPTION 'Migration 105 failed: cycle_run_id not added'; END IF;
  RAISE NOTICE 'Migration 105 complete';
END $$;

COMMIT;
