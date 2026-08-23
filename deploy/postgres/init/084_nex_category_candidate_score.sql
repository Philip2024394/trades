-- 084_nex_category_candidate_score.sql
--
-- Directory Factory · Calibration Harness · 2026-08-23
--
-- Time-series score record per candidate. The Era 1 scorer writes ONE
-- row per candidate per scoring pass. Score history is preserved so
-- calibration (Era 1 → Era 2) can see how scores evolved as evidence
-- accumulated. Never activates a Registry category · never modifies
-- nex.category_candidate itself · pure observation.
--
-- Doctrine anchors:
--   project_nex_directory_factory_doctrine_2026_08_22 (amended 2026-08-23 · three-tier)
--   docs/nex/directory-factory-scoring-contract.md
--
-- Boundary:
--   · WRITES only to nex.category_candidate_score.
--   · READS from nex.category_candidate + nex.food_business +
--     nex.food_business_field_provenance + nex.food_business_source_snapshot
--     + nex.category_registry (Registry read only · never write).
--
-- Kill switch note (Phase 3 · not yet built):
--   The scorer runs regardless of NEX_FACTORY_AUTO_ACTIVATION_ENABLED.
--   The kill switch only gates ACTIVATION, not score recording. Recording
--   scores generates the calibration data · activation is a separate step
--   that consumes those scores.

BEGIN;

CREATE TABLE IF NOT EXISTS nex.category_candidate_score (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        uuid NOT NULL
                        REFERENCES nex.category_candidate(id) ON DELETE CASCADE,
    computed_at         timestamptz NOT NULL DEFAULT now(),
    computed_by         text NOT NULL,      -- e.g. 'scorer:era1:cycle-hook' or 'scorer:era1:manual'
    scorer_version      text NOT NULL,      -- 'era1-v1' etc · locked-in when a scorer's math changes

    quality_score       numeric(5,4) NOT NULL
                        CHECK (quality_score >= 0 AND quality_score <= 1),
    safety_score        numeric(5,4) NOT NULL
                        CHECK (safety_score >= 0 AND safety_score <= 1),
    provisional_tier    text NOT NULL
                        CHECK (provisional_tier IN ('HIGH','MEDIUM','LOW')),

    -- The primary reason a candidate isn't HIGH · e.g. 'keyword-collision'
    -- or 'below-quality-threshold' or 'fuzzy-osm-signal' · null if HIGH.
    primary_hazard      text,

    -- Every signal fed into the scorer for this pass · so calibration can
    -- see EXACTLY what the scorer saw. Shape defined in scoreCandidate.ts.
    signals             jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Per-signal contribution to quality_score (Era 1 formula) · for
    -- reviewer explainability.
    quality_breakdown   jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Per-signal multiplier applied to safety_score.
    safety_breakdown    jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS category_candidate_score_candidate_idx
    ON nex.category_candidate_score (candidate_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS category_candidate_score_tier_idx
    ON nex.category_candidate_score (provisional_tier, computed_at DESC);

COMMIT;

-- ── ROLLBACK ─────────────────────────────────────────────────────
--   BEGIN;
--   DROP INDEX IF EXISTS nex.category_candidate_score_tier_idx;
--   DROP INDEX IF EXISTS nex.category_candidate_score_candidate_idx;
--   DROP TABLE IF EXISTS nex.category_candidate_score;
--   COMMIT;
