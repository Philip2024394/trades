-- 110_nex_walker_attribution_transport.sql
--
-- Persistence contract P5 · Philip 2026-08-26 · complete walker attribution
-- coverage. transport_acquisition_record already has cycle_run_id from
-- migration 093 · adds worker_id column to close the three-way match.
--
-- Reversible:
--   BEGIN;
--     DROP INDEX IF EXISTS nex.idx_transport_worker_id;
--     ALTER TABLE nex.transport_acquisition_record DROP COLUMN IF EXISTS worker_id;
--   COMMIT;

BEGIN;

ALTER TABLE nex.transport_acquisition_record
  ADD COLUMN IF NOT EXISTS worker_id TEXT;

CREATE INDEX IF NOT EXISTS idx_transport_worker_id
  ON nex.transport_acquisition_record (worker_id) WHERE worker_id IS NOT NULL;

COMMENT ON COLUMN nex.transport_acquisition_record.worker_id IS
  'Persistence contract 2026-08-26 · worker_id matching nex.worker_heartbeat.worker_id. Complements existing cycle_run_id (migration 093) for three-way SELECT-verify. NULL for pre-contract rows.';

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='transport_acquisition_record' AND column_name='worker_id')
  THEN RAISE EXCEPTION 'Migration 110 failed'; END IF;
  RAISE NOTICE 'Migration 110 complete';
END $$;

COMMIT;
