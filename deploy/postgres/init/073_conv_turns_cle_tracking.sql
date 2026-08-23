-- 073_conv_turns_cle_tracking.sql
--
-- Task #76 Bundle B · Conversation Teacher end-to-end · 2026-08-22
--
-- Doctrine anchors:
--   project_nex_cle_constitutional_boundary_2026_08_22
--     (observe → compare → candidate → evidence → admin promotion → knowledge)
--   project_nex_architecture_replaceable_plumbing_and_provable_causality_2026_08_22
--     (direct causality · cycle_run_id FK · never time-window inference)
--
-- Adds observation-processing tracking to nex.conv_turns so the CLE
-- worker can (a) know which turns it has already consumed and (b) prove
-- direct causality between a cycle_run and the turns it observed.
--
-- Nullable columns · backward-compatible · historical turns keep NULL.
-- Six-criteria evaluator uses cle_cycle_run_id to prove state advancement
-- (turn was observed and consumed by cycle N).
--
-- Reversible:
--   BEGIN;
--     DROP INDEX IF EXISTS nex.idx_conv_turns_cle_processed;
--     DROP INDEX IF EXISTS nex.idx_conv_turns_cle_cycle;
--     ALTER TABLE nex.conv_turns
--       DROP COLUMN IF EXISTS cle_processed_at,
--       DROP COLUMN IF EXISTS cle_cycle_run_id;
--   COMMIT;

BEGIN;

ALTER TABLE nex.conv_turns
  ADD COLUMN IF NOT EXISTS cle_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cle_cycle_run_id UUID REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;

-- Partial index · unprocessed turns are the input queue
CREATE INDEX IF NOT EXISTS idx_conv_turns_cle_pending
  ON nex.conv_turns (created_at DESC)
  WHERE cle_processed_at IS NULL;

-- Partial index · direct-provenance JOIN for six-criteria state check
CREATE INDEX IF NOT EXISTS idx_conv_turns_cle_cycle
  ON nex.conv_turns (cle_cycle_run_id)
  WHERE cle_cycle_run_id IS NOT NULL;

COMMENT ON COLUMN nex.conv_turns.cle_processed_at IS
  'When the CLE worker observed this turn (Task #76 Bundle B · 2026-08-22). NULL = still in the CLE input queue. Six-criteria input criterion counts NULLs.';
COMMENT ON COLUMN nex.conv_turns.cle_cycle_run_id IS
  'FK to nex.worker_cycle_run.id · which CLE cycle consumed this turn. Direct causality link · six-criteria state criterion JOINs here rather than inferring via timestamps.';

DO $$
DECLARE
  col_processed BOOLEAN;
  col_cycle     BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='conv_turns' AND column_name='cle_processed_at') INTO col_processed;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='conv_turns' AND column_name='cle_cycle_run_id') INTO col_cycle;
  IF NOT col_processed THEN RAISE EXCEPTION 'Migration 073 failed: cle_processed_at column not added'; END IF;
  IF NOT col_cycle THEN RAISE EXCEPTION 'Migration 073 failed: cle_cycle_run_id column not added'; END IF;
  RAISE NOTICE 'Migration 073 complete: conv_turns.cle_processed_at + cle_cycle_run_id in place';
END $$;

COMMIT;
