-- 088_nex_recovered_evidence_column.sql
--
-- NEX Path A Persistence · Priority 1 storage schema
-- 2026-08-23 · Philip greenlight (P1 · accommodation Path A persist)
--
-- Doctrine anchors:
--   project_nex_priority_greenlight_accommodation_path_a_food_walker_preservation_2026_08_23
--   project_nex_business_knowledge_object_three_layer_2026_08_23
--   project_nex_path_a_snapshot_reparse_greenlit_2026_08_23
--
-- What this migration does (both symmetric · additive · non-breaking):
--   Adds `recovered_evidence jsonb NOT NULL DEFAULT '{}'::jsonb` to both business tables.
--
-- Shape of recovered_evidence (JSONB · per-attribute provenance embedded):
--   {
--     "brand":    { "value": "Santika", "source": "osm_replay", "source_reference": "node/12345",
--                   "raw_snippet": "Santika", "captured_at": "2026-08-23T...", "snapshot_id": "..." },
--     "operator": { ... },
--     "description":  { ... },
--     "wikidata": { "value": "Q7420423", "source": "osm_replay", ... },
--     ...
--   }
--
-- Why JSONB (single column) rather than polymorphic nex.business_attribute overlay:
--   · Minimal schema commitment for Priority 1 · reversible via DROP COLUMN
--   · Structured provenance per attribute preserved in the JSONB
--   · Doctrinally compatible with the eventual polymorphic overlay — this data can
--     migrate cleanly into nex.business_attribute rows when Philip greenlights the
--     full Business Knowledge Object schema
--   · Idempotent per key via jsonb || jsonb merge semantics
--
-- Per-attribute-level provenance also written to *_field_provenance table
-- (Direct-Provenance A pattern) with field_name='recovered_evidence:<attribute_key>'
--
-- This migration does NOT:
--   · Change ≥90 threshold
--   · Modify any customer-facing UI
--   · Activate listings
--   · Introduce ranking penalties
--   · Change Walker code
--
-- Rollback path documented at the bottom.

BEGIN;

-- 1. Add recovered_evidence to nex.accommodation_business (Priority 1 target)
ALTER TABLE nex.accommodation_business
    ADD COLUMN IF NOT EXISTS recovered_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS evidence_recovered_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS evidence_source text NULL;

CREATE INDEX IF NOT EXISTS idx_accom_business_evidence_source
    ON nex.accommodation_business (evidence_source) WHERE evidence_source IS NOT NULL;

COMMENT ON COLUMN nex.accommodation_business.recovered_evidence IS
    'NEX Path A Priority 1 · JSONB of attributes recovered from raw source_snapshot payload · per-attribute provenance embedded · never contributes to a ranking score · consumed as EVIDENCE by Business Knowledge Object / Decision Context. Doctrine: project_nex_priority_greenlight_accommodation_path_a_food_walker_preservation_2026_08_23.';

-- 2. Symmetric addition on food_business (Priority 2 target · empty on food until Walker preserves raw tags)
ALTER TABLE nex.food_business
    ADD COLUMN IF NOT EXISTS recovered_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS evidence_recovered_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS evidence_source text NULL;

CREATE INDEX IF NOT EXISTS idx_food_business_evidence_source
    ON nex.food_business (evidence_source) WHERE evidence_source IS NOT NULL;

COMMENT ON COLUMN nex.food_business.recovered_evidence IS
    'NEX Path A Priority 1 · same shape as nex.accommodation_business.recovered_evidence · currently empty until food Walker preserves raw OSM tags (Priority 2 code change) or existing 806 rows backfilled via Overpass re-hit (Priority 3 · pending greenlight).';

COMMIT;

-- ── ROLLBACK ─────────────────────────────────────────────────────────────
--   BEGIN;
--   DROP INDEX IF EXISTS nex.idx_food_business_evidence_source;
--   ALTER TABLE nex.food_business
--       DROP COLUMN IF EXISTS evidence_source,
--       DROP COLUMN IF EXISTS evidence_recovered_at,
--       DROP COLUMN IF EXISTS recovered_evidence;
--   DROP INDEX IF EXISTS nex.idx_accom_business_evidence_source;
--   ALTER TABLE nex.accommodation_business
--       DROP COLUMN IF EXISTS evidence_source,
--       DROP COLUMN IF EXISTS evidence_recovered_at,
--       DROP COLUMN IF EXISTS recovered_evidence;
--   COMMIT;
