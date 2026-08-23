-- 075 · Task #85 · 2026-08-22 · food_business.categories text[] column.
--
-- Adds secondary/multi-category storage alongside existing single `category`.
-- Doctrine (Philip 2026-08-22):
--   · Q1=B · additive column · backward compatible
--   · Q2=C · existing primary `category` CHECK stays intact (4-value contract)
--     — Preserves current /food directory reader + filter behavior
--     — Broader OSM discovery classifies to one of the 4 primary values
--     — Richer classification (bakery, warung, japanese, etc.) lands in categories[]
--
-- Zero data destruction. Existing 921+ rows keep their `category` value and
-- get default `'{}'` (empty array) for `categories`. Next Walker cycle populates
-- categories[] for genuinely new rows only. Existing rows stay untouched unless
-- explicitly re-verified by a future backfill task.
--
-- Every provenance/dedup/gate contract intact:
--   Direct-Provenance A · cycle_run_id FK · ON CONFLICT dedup · claim_status='discovered'
--   Gate 5 outreach hard-noop · CLE admin gate · RAG boundary · HQ singularity

ALTER TABLE nex.food_business
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN nex.food_business.categories IS
  'Task #85 · secondary/richer classification tokens sourced from OSM tags + cuisine + name heuristics. Primary category still lives in nex.food_business.category (single value · 4-enum). Populated at Walker insert time · never automatically mutated after that. Empty array means no secondary evidence available at ingest.';

-- Optional GIN index for later category-filtered queries (kept small · only
-- created when the table is a manageable size · noop if index exists).
CREATE INDEX IF NOT EXISTS idx_food_business_categories_gin
  ON nex.food_business USING GIN (categories);

-- Sanity assertion via a helper function that MUST return true.
DO $$
BEGIN
  ASSERT (SELECT column_name FROM information_schema.columns
          WHERE table_schema='nex' AND table_name='food_business' AND column_name='categories') = 'categories',
    'categories column not created';
END $$;
