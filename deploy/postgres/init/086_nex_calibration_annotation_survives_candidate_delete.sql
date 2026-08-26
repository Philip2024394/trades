-- 086_nex_calibration_annotation_survives_candidate_delete.sql
--
-- Directory Factory · Calibration Harness · 2026-08-23
--
-- Fix a real risk observed in production:
--   The migration-085 FK was ON DELETE CASCADE, so ANY deletion of a
--   candidate row (including test cleanup, admin housekeeping, or a
--   future migration) SILENTLY WIPED that candidate's human calibration
--   annotations. Calibration history is evidence of NEX's learning ·
--   it must NOT disappear just because the thing it learned about was
--   removed.
--
-- Doctrine (Philip 2026-08-23 verbatim):
--   "NEX's learning history must survive cleanup of the thing it
--    learned from."
--
-- Fix (this migration):
--   1. Change FK from CASCADE → SET NULL. When the candidate is
--      deleted, the annotation is kept · its candidate_id becomes
--      NULL. Referential integrity preserved while the candidate
--      exists.
--   2. Make candidate_id nullable so SET NULL is a valid outcome.
--   3. Add candidate_snapshot jsonb NOT NULL DEFAULT '{}'. The
--      annotator writes the candidate's identifying fields into this
--      column at annotation time, so even after candidate deletion
--      the annotation is self-contained ("philip@nex said LOW on
--      restaurant · food · ID · 889 businesses at 2026-08-23") ·
--      no reconstruction required.
--
-- Append-only preserved · no new UPDATE/DELETE paths introduced.
--
-- Boundary:
--   · Reads nothing from Walker, Registry, or Phase 3 code.
--   · Writes only to nex.category_candidate_calibration_annotation.
--
-- Rollback path documented at the bottom.

BEGIN;

-- 1. Drop the existing FK (was ON DELETE CASCADE from migration 085).
ALTER TABLE nex.category_candidate_calibration_annotation
    DROP CONSTRAINT IF EXISTS category_candidate_calibration_annotation_candidate_id_fkey;

-- 2. Make candidate_id nullable so SET NULL is a valid outcome.
ALTER TABLE nex.category_candidate_calibration_annotation
    ALTER COLUMN candidate_id DROP NOT NULL;

-- 3. Recreate FK with SET NULL. Referential integrity while the
--    candidate exists · graceful degradation when it's deleted.
ALTER TABLE nex.category_candidate_calibration_annotation
    ADD CONSTRAINT category_candidate_calibration_annotation_candidate_id_fkey
        FOREIGN KEY (candidate_id)
        REFERENCES nex.category_candidate(id)
        ON DELETE SET NULL;

-- 4. Self-contained historical snapshot. The annotator populates this
--    at INSERT time so the annotation record survives candidate deletion
--    with full context intact.
--
--    Shape (populated by scripts/nex-factory/annotate-candidate.mjs):
--      {
--        proposed_category_id:      text,   -- kebab id
--        proposed_name:             text,
--        display_name_en:           text,
--        suggested_parent_vertical: text,
--        suggested_countries:       text[],
--        brain_keywords:            text[],
--        business_count:            int,
--        cycle_count:               int,
--        proposed_by:               text,
--        candidate_created_at:      timestamptz,
--        snapshot_taken_at:         timestamptz  -- when the annotator captured the above
--      }
--    Left as DEFAULT '{}' for rows written before this migration ·
--    only 0 rows existed at migration time (confirmed via SQL query
--    before ship) so no backfill loop is required.
ALTER TABLE nex.category_candidate_calibration_annotation
    ADD COLUMN IF NOT EXISTS candidate_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;

-- ── ROLLBACK ─────────────────────────────────────────────────────
--   BEGIN;
--   ALTER TABLE nex.category_candidate_calibration_annotation
--       DROP COLUMN IF EXISTS candidate_snapshot;
--   ALTER TABLE nex.category_candidate_calibration_annotation
--       DROP CONSTRAINT IF EXISTS category_candidate_calibration_annotation_candidate_id_fkey;
--   -- Optional (only if you actively want CASCADE back · dangerous):
--   --   ALTER TABLE nex.category_candidate_calibration_annotation
--   --       ALTER COLUMN candidate_id SET NOT NULL,
--   --       ADD CONSTRAINT category_candidate_calibration_annotation_candidate_id_fkey
--   --         FOREIGN KEY (candidate_id) REFERENCES nex.category_candidate(id) ON DELETE CASCADE;
--   COMMIT;
