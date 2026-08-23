-- 085_nex_category_candidate_calibration_annotation.sql
--
-- Directory Factory · Calibration Harness · 2026-08-23
--
-- Human verdicts on candidates for CALIBRATION PURPOSES only. Answers:
--   "If I saw this candidate today, what tier would I assign?"
--
-- Intentionally SEPARATE from nex.category_candidate.admin_decision
-- (which is the real Phase-2 approval workflow that could ultimately
-- activate a directory). An annotation NEVER activates anything.
--
-- Multiple annotators supported. Append-only history so a reviewer's
-- verdict changing over time is preserved for score-drift calibration.
--
-- Boundary:
--   · WRITES only to this table.
--   · Never touches nex.category_registry, nex.category_candidate,
--     nex.category_candidate_score, or any Walker table.

BEGIN;

CREATE TABLE IF NOT EXISTS nex.category_candidate_calibration_annotation (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id   uuid NOT NULL
                   REFERENCES nex.category_candidate(id) ON DELETE CASCADE,
    annotator      text NOT NULL,        -- e.g. 'philip@nex' or 'claude:proxy'
    verdict        text NOT NULL
                   CHECK (verdict IN ('HIGH','MEDIUM','LOW','SKIP')),
    reason         text,
    annotated_at   timestamptz NOT NULL DEFAULT now(),

    -- Optional: tie the annotation to a specific score row so score-drift
    -- calibration can say "annotator said LOW for a score of quality=0.60
    -- but same annotator said HIGH for a score of quality=0.80."
    against_score_id uuid
                   REFERENCES nex.category_candidate_score(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS category_candidate_calibration_annotation_candidate_idx
    ON nex.category_candidate_calibration_annotation (candidate_id, annotated_at DESC);

CREATE INDEX IF NOT EXISTS category_candidate_calibration_annotation_annotator_idx
    ON nex.category_candidate_calibration_annotation (annotator, annotated_at DESC);

COMMIT;

-- ── ROLLBACK ─────────────────────────────────────────────────────
--   BEGIN;
--   DROP INDEX IF EXISTS nex.category_candidate_calibration_annotation_annotator_idx;
--   DROP INDEX IF EXISTS nex.category_candidate_calibration_annotation_candidate_idx;
--   DROP TABLE IF EXISTS nex.category_candidate_calibration_annotation;
--   COMMIT;
