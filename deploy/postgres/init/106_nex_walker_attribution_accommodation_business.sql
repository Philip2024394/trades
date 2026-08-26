-- 106_nex_walker_attribution_accommodation_business.sql
--
-- Persistence-contract Phase 1 · Philip 2026-08-26 production launch directive.
-- Parallel to migration 105 · same shape · isolated table (accommodation walker
-- can evolve independently from food walker).
--
-- Backward-safe: additive only, no defaults, no backfill. Existing accommodation_business
-- rows stay NULL for both columns.
--
-- Reversible:
--   BEGIN;
--     DROP INDEX IF EXISTS nex.idx_accommodation_business_cycle_run;
--     DROP INDEX IF EXISTS nex.idx_accommodation_business_worker_id;
--     ALTER TABLE nex.accommodation_business DROP COLUMN IF EXISTS worker_id;
--     ALTER TABLE nex.accommodation_business DROP COLUMN IF EXISTS cycle_run_id;
--   COMMIT;

BEGIN;

ALTER TABLE nex.accommodation_business
  ADD COLUMN IF NOT EXISTS worker_id     TEXT,
  ADD COLUMN IF NOT EXISTS cycle_run_id  UUID
    REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accommodation_business_cycle_run
  ON nex.accommodation_business (cycle_run_id) WHERE cycle_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accommodation_business_worker_id
  ON nex.accommodation_business (worker_id) WHERE worker_id IS NOT NULL;

COMMENT ON COLUMN nex.accommodation_business.worker_id IS
  'Persistence contract 2026-08-26 · worker_id matching nex.worker_heartbeat.worker_id. NULL for pre-contract rows.';
COMMENT ON COLUMN nex.accommodation_business.cycle_run_id IS
  'Persistence contract 2026-08-26 · FK to worker_cycle_run.id. NULL for pre-contract rows.';

DO $$
DECLARE has_worker BOOLEAN; has_cycle BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='accommodation_business' AND column_name='worker_id') INTO has_worker;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='accommodation_business' AND column_name='cycle_run_id') INTO has_cycle;
  IF NOT has_worker THEN RAISE EXCEPTION 'Migration 106 failed: worker_id not added'; END IF;
  IF NOT has_cycle  THEN RAISE EXCEPTION 'Migration 106 failed: cycle_run_id not added'; END IF;
  RAISE NOTICE 'Migration 106 complete';
END $$;

COMMIT;
