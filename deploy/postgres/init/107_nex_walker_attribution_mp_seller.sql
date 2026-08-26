-- 107_nex_walker_attribution_mp_seller.sql
--
-- Persistence-contract Phase 1 · Philip 2026-08-26 production launch directive.
-- Parallel to migrations 105 + 106 · adds proper walker attribution to
-- marketplace seller table. Preserves the existing informal discovered_from
-- text field (no destruction).
--
-- Backward-safe: additive only, no defaults, no backfill. Existing mp_seller
-- rows stay NULL for both new columns; existing discovered_from remains as-is.
--
-- Reversible:
--   BEGIN;
--     DROP INDEX IF EXISTS nex.idx_mp_seller_cycle_run;
--     DROP INDEX IF EXISTS nex.idx_mp_seller_worker_id;
--     ALTER TABLE nex.mp_seller DROP COLUMN IF EXISTS worker_id;
--     ALTER TABLE nex.mp_seller DROP COLUMN IF EXISTS cycle_run_id;
--   COMMIT;

BEGIN;

ALTER TABLE nex.mp_seller
  ADD COLUMN IF NOT EXISTS worker_id     TEXT,
  ADD COLUMN IF NOT EXISTS cycle_run_id  UUID
    REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mp_seller_cycle_run
  ON nex.mp_seller (cycle_run_id) WHERE cycle_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mp_seller_worker_id
  ON nex.mp_seller (worker_id) WHERE worker_id IS NOT NULL;

COMMENT ON COLUMN nex.mp_seller.worker_id IS
  'Persistence contract 2026-08-26 · worker_id matching nex.worker_heartbeat.worker_id (e.g. "acquisition:market:Yogyakarta"). Complements existing informal discovered_from text field. NULL for pre-contract rows.';
COMMENT ON COLUMN nex.mp_seller.cycle_run_id IS
  'Persistence contract 2026-08-26 · FK to worker_cycle_run.id. NULL for pre-contract rows.';

DO $$
DECLARE has_worker BOOLEAN; has_cycle BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='mp_seller' AND column_name='worker_id') INTO has_worker;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='mp_seller' AND column_name='cycle_run_id') INTO has_cycle;
  IF NOT has_worker THEN RAISE EXCEPTION 'Migration 107 failed: worker_id not added'; END IF;
  IF NOT has_cycle  THEN RAISE EXCEPTION 'Migration 107 failed: cycle_run_id not added'; END IF;
  RAISE NOTICE 'Migration 107 complete';
END $$;

COMMIT;
