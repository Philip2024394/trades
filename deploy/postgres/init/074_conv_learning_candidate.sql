-- 074_conv_learning_candidate.sql
--
-- Task #76 Bundle B · Conversation Teacher candidate table · 2026-08-22
--
-- Doctrine anchor:
--   project_nex_cle_constitutional_boundary_2026_08_22 (verbatim):
--     "Conversation does not automatically teach NEX. The CLE pipeline
--      should: observe → compare → candidate → evidence → admin promotion → knowledge."
--
-- This is the CANDIDATE-holding table · the "candidate" step in the
-- pipeline. Candidates never touch nex.conv_knowledge_items live rows or
-- nex.knowledge_records authoritative rows until an admin explicitly
-- promotes them (Step 5-6). Rejected candidates stay for audit.
--
-- Direct-provenance from birth: every candidate carries cycle_run_id FK
-- to the CLE cycle that generated it. Six-criteria output criterion
-- JOINs on cycle_run_id · never time-window inference.
--
-- Language handling: EN and ID both land here with identical schema and
-- identical gates. `language` column is metadata · not trust-modifier.
-- Rejects the "silent-auto-teach" anti-pattern (project_nex_cle_constitutional_boundary_2026_08_22).
--
-- Reversible:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.conv_learning_candidate CASCADE;
--   COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS nex.conv_learning_candidate (
  candidate_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Direct causality (built in from day one · not retrofitted)
  cycle_run_id                  UUID NOT NULL REFERENCES nex.worker_cycle_run(id) ON DELETE CASCADE,

  -- Evidence · which conv_turns generated this candidate
  from_turn_ids                 UUID[] NOT NULL DEFAULT '{}',

  -- Language metadata · EN + ID + others go through identical gates
  language                      TEXT NOT NULL DEFAULT 'unknown',
  -- Brain scope · candidates never cross brains (ADR-0033 Rule 4)
  brain                         TEXT NOT NULL,

  -- Candidate shape · what the CLE proposes NEX should learn
  candidate_kind                TEXT NOT NULL CHECK (candidate_kind IN (
    'add_clarification_ki',
    'add_intent_example',
    'add_entity_alias',
    'add_edge_correction'
  )),
  candidate_payload             JSONB NOT NULL,

  -- Scoring · heuristic today · full-eval-driven later
  score                         NUMERIC(4,3) NOT NULL DEFAULT 0
    CHECK (score >= 0 AND score <= 1),
  score_components              JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Promotion gate · candidates default pending_review · never auto-teach
  status                        TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','promoted','rejected')),
  reviewed_at                   TIMESTAMPTZ,
  reviewed_by                   TEXT,
  rejection_reason              TEXT,

  -- If promoted, the resulting knowledge_records row · closes the causal chain
  promotion_target_record_id    UUID REFERENCES nex.knowledge_records(id) ON DELETE SET NULL,

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes · admin review queue + direct-provenance lookup + language slice
CREATE INDEX IF NOT EXISTS idx_conv_learning_candidate_pending
  ON nex.conv_learning_candidate (created_at DESC)
  WHERE status = 'pending_review';

CREATE INDEX IF NOT EXISTS idx_conv_learning_candidate_cycle
  ON nex.conv_learning_candidate (cycle_run_id);

CREATE INDEX IF NOT EXISTS idx_conv_learning_candidate_language_status
  ON nex.conv_learning_candidate (language, status);

-- Grants · CLE worker runs as postgres directly today but nex_brain_app is
-- the canonical role for Brain-adjacent writes · grant for future.
GRANT SELECT, INSERT, UPDATE ON nex.conv_learning_candidate TO nex_brain_app;

COMMENT ON TABLE nex.conv_learning_candidate IS
  'CLE candidate table (Task #76 Bundle B · 2026-08-22). Every row is a proposed learning · never AUTHORITATIVE. Direct-provenance link to cycle_run built in from birth. Status transitions pending_review → promoted|rejected via /api/nex/cle/promote-candidate admin-only route. EN + ID identical gates. Constitutional boundary: conversation does NOT auto-teach NEX.';

COMMENT ON COLUMN nex.conv_learning_candidate.cycle_run_id IS
  'Direct causality FK to nex.worker_cycle_run.id · six-criteria output criterion JOINs here.';
COMMENT ON COLUMN nex.conv_learning_candidate.status IS
  'Promotion gate. pending_review (default · awaits admin) · promoted (admin approved · knowledge_record created · FK in promotion_target_record_id) · rejected (admin declined · rejection_reason recorded). Never auto-promoted.';
COMMENT ON COLUMN nex.conv_learning_candidate.language IS
  'EN · ID · or "unknown". Metadata only · does NOT modify trust or gate.';

DO $$
DECLARE
  tbl_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='nex' AND table_name='conv_learning_candidate') INTO tbl_exists;
  IF NOT tbl_exists THEN RAISE EXCEPTION 'Migration 074 failed: conv_learning_candidate not created'; END IF;
  RAISE NOTICE 'Migration 074 complete: nex.conv_learning_candidate ready · direct-provenance from birth · admin-only promotion gate';
END $$;

COMMIT;
