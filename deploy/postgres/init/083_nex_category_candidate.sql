-- 083_nex_category_candidate.sql
--
-- Directory Factory · Phase 0 · 2026-08-23
-- Creates nex.category_candidate — Walker's proposal target for new
-- customer-facing categories · Philip's approval subject · Factory's
-- input for later activation.
--
-- Phase 0 creates the TABLE ONLY. Walker candidate-writer + HQ
-- approval surface + Factory activation engine come in later phases.
--
-- Doctrine anchors:
--   project_nex_directory_factory_doctrine_2026_08_22
--   project_nex_walker_stays_pure_acquisition_2026_08_22
--   project_nex_universal_directory_image_doctrine_2026_08_22 (image_candidates evidence)
--   project_nex_truth_invariant_2026_08_22
--
-- Locked design decisions from the approved Phase 0 plan:
--   D3 · admin_decision states: pending / approved / rejected /
--        duplicate / superseded. NO deferred, NO merged (requires
--        future doctrine).
--   D4 · Business/cycle threshold CHECK: business_count >= 50 AND
--        cycle_count >= 2. Meeting the threshold makes a candidate
--        ELIGIBLE for human approval · NEVER activates automatically.
--
-- Rollback path documented at the bottom.

BEGIN;

CREATE TABLE IF NOT EXISTS nex.category_candidate (
    id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What Walker proposes
    proposed_category_id       text NOT NULL
                               CHECK (proposed_category_id ~ '^[a-z][a-z0-9-]*$'),
    proposed_name              text NOT NULL,
    display_name_en            text NOT NULL,
    display_name_id            text,

    suggested_parent_vertical  text NOT NULL
                               CHECK (suggested_parent_vertical IN
                                  ('food','accommodation','rentals','services','tourism')),

    brain_keywords             jsonb NOT NULL DEFAULT '[]'::jsonb
                               CHECK (jsonb_typeof(brain_keywords) = 'array'),

    suggested_countries        text[] NOT NULL
                               CHECK (
                                 array_length(suggested_countries, 1) >= 1
                                 AND suggested_countries <@ ARRAY['ID','GB','US','MY','SG','TH','VN','PH','AU','NZ']::text[]
                               ),

    -- Evidence · D4 threshold enforced at schema level (defence in depth).
    business_count             integer NOT NULL
                               CHECK (business_count >= 50),
    cycle_count                integer NOT NULL
                               CHECK (cycle_count >= 2),
    confidence                 numeric(4,3) NOT NULL
                               CHECK (confidence >= 0 AND confidence <= 1),
    evidence                   jsonb NOT NULL DEFAULT '{}'::jsonb,
    discovered_businesses      jsonb NOT NULL DEFAULT '[]'::jsonb
                               CHECK (jsonb_typeof(discovered_businesses) = 'array'),

    -- Image evidence · Decision #9 · EVIDENCE ONLY.
    image_candidates           jsonb NOT NULL DEFAULT '[]'::jsonb
                               CHECK (jsonb_typeof(image_candidates) = 'array'),
    image_candidates_note      text NOT NULL DEFAULT
        'Evidence only. MUST NOT become live business images without going through the Universal Image resolver acceptance thresholds.',

    -- Provenance · Direct-Provenance A cross-ref
    proposed_by                text NOT NULL,
    proposed_cycle_run_id      uuid
                               REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL,
    created_at                 timestamptz NOT NULL DEFAULT now(),

    -- Admin adjudication · Decision #12 · human-gated
    admin_decision             text NOT NULL DEFAULT 'pending'
                               CHECK (admin_decision IN
                                  ('pending','approved','rejected','duplicate','superseded')),
    admin_reviewed_at          timestamptz,
    admin_reviewed_by          text,
    admin_notes                text,

    -- Duplicate/collision tracking
    duplicate_of_registry_id   text
                               REFERENCES nex.category_registry(id) ON DELETE SET NULL,
    superseded_by_candidate_id uuid
                               REFERENCES nex.category_candidate(id) ON DELETE SET NULL,

    -- Consistency invariant: if admin_decision != 'pending' then reviewed_at + reviewed_by set.
    CONSTRAINT category_candidate_decision_consistency
        CHECK (
          (admin_decision = 'pending' AND admin_reviewed_at IS NULL AND admin_reviewed_by IS NULL)
          OR
          (admin_decision <> 'pending' AND admin_reviewed_at IS NOT NULL AND admin_reviewed_by IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS category_candidate_status_idx
    ON nex.category_candidate (admin_decision, created_at DESC);

CREATE INDEX IF NOT EXISTS category_candidate_proposed_id_idx
    ON nex.category_candidate (proposed_category_id);

CREATE INDEX IF NOT EXISTS category_candidate_vertical_idx
    ON nex.category_candidate (suggested_parent_vertical);

-- Idempotent-safe partial unique index: at most ONE non-terminal
-- candidate per proposed_category_id at a time (defence against
-- obvious duplicates before Phase 1 dedup logic lands · R2 mitigation).
-- Multiple 'rejected' / 'duplicate' / 'superseded' rows for the same
-- proposed_category_id are allowed (history).
CREATE UNIQUE INDEX IF NOT EXISTS category_candidate_active_dedup_idx
    ON nex.category_candidate (proposed_category_id)
    WHERE admin_decision IN ('pending','approved');

-- ── ORIGIN FK on category_registry (deferred from migration 082) ──
-- Registry rows written by the Factory (Phase 3+) reference the
-- candidate that produced them. Seed rows written in 082 have origin
-- NULL (created before candidate infrastructure existed).
ALTER TABLE nex.category_registry
    ADD CONSTRAINT category_registry_origin_candidate_fkey
    FOREIGN KEY (origin_candidate_id)
    REFERENCES nex.category_candidate(id)
    ON DELETE SET NULL;

COMMIT;

-- ── ROLLBACK ─────────────────────────────────────────────────────
--   BEGIN;
--   ALTER TABLE nex.category_registry DROP CONSTRAINT IF EXISTS category_registry_origin_candidate_fkey;
--   DROP INDEX IF EXISTS nex.category_candidate_active_dedup_idx;
--   DROP INDEX IF EXISTS nex.category_candidate_vertical_idx;
--   DROP INDEX IF EXISTS nex.category_candidate_proposed_id_idx;
--   DROP INDEX IF EXISTS nex.category_candidate_status_idx;
--   DROP TABLE IF EXISTS nex.category_candidate;
--   COMMIT;
--
-- Zero user-facing effect · Walker doesn't write to this table in
-- Phase 0 · Phase 1+ features that depend on it aren't shipped yet.
