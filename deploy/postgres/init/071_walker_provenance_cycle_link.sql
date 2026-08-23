-- 071_walker_provenance_cycle_link.sql
--
-- Task #74 · Direct-Provenance A · Walker STUCK→GREEN proof · 2026-08-22
--
-- Doctrine anchors:
--   project_nex_architecture_replaceable_plumbing_and_provable_causality_2026_08_22
--   project_nex_hq_two_jobs_walker_and_teaching_2026_08_22
--
-- Constitutional binding (Philip 2026-08-22 verbatim):
--   "Walker is GREEN only when HQ can prove exactly what that Walker cycle
--    consumed and exactly what it produced or verified."
--
-- This migration adds ONE column: a direct FK from each provenance row to
-- the worker_cycle_run that wrote it. The six-criteria evaluator will
-- JOIN on this FK for output/state evidence instead of time-window
-- inference. Historical rows (pre-Task-74) remain NULL and are ignored
-- by the new evaluator SQL.
--
-- Reversible:
--   BEGIN;
--     DROP INDEX IF EXISTS nex.idx_provenance_cycle_run;
--     ALTER TABLE nex.food_business_field_provenance
--       DROP COLUMN IF EXISTS cycle_run_id;
--   COMMIT;

BEGIN;

ALTER TABLE nex.food_business_field_provenance
  ADD COLUMN IF NOT EXISTS cycle_run_id UUID
  REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_provenance_cycle_run
  ON nex.food_business_field_provenance (cycle_run_id)
  WHERE cycle_run_id IS NOT NULL;

COMMENT ON COLUMN nex.food_business_field_provenance.cycle_run_id IS
  'Direct causality link (Task #74 · 2026-08-22). Which worker_cycle_run wrote this provenance row. The six-criteria evaluator JOINs on this FK for output/state evidence instead of inferring via time-window intersection. Historical rows (pre-Task-74) are NULL.';

-- Sanity check
DO $$
DECLARE
  col_exists BOOLEAN;
  idx_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='food_business_field_provenance'
      AND column_name='cycle_run_id') INTO col_exists;
  SELECT EXISTS(SELECT 1 FROM pg_indexes
    WHERE schemaname='nex' AND indexname='idx_provenance_cycle_run') INTO idx_exists;
  IF NOT col_exists THEN RAISE EXCEPTION 'Migration 071 failed: cycle_run_id column not added'; END IF;
  IF NOT idx_exists THEN RAISE EXCEPTION 'Migration 071 failed: idx_provenance_cycle_run not created'; END IF;
  RAISE NOTICE 'Migration 071 complete: cycle_run_id column + index in place';
END $$;

COMMIT;
