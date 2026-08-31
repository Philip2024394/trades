-- 112_nex_category_image_library.sql
--
-- NEX Category Image Library · Philip 2026-08-27 (E).
--
-- Curated per-category fallback images. Philip prepares the library ·
-- NEX resolver picks the best available fallback when a business has no
-- VERIFIED_REAL / OWNER_IMAGE (Universal Image Doctrine · ADR-0022).
--
-- Doctrine (Philip 2026-08-27):
--   "Don't start making 1,140 individual business images. That's way too much
--    work. Instead make a category image library."
--   Beautiful · visually consistent with the NEX directory · never
--   random stock-looking pictures.
--
-- Resolution order (Universal Image Doctrine · unchanged):
--   OWNER_IMAGE > VERIFIED_REAL > CATEGORY_FALLBACK
--
-- A CATEGORY_FALLBACK is displayed as a real business photo (landscape card)
-- but the row is flagged image_type='CATEGORY_FALLBACK' so the directory
-- layer can style it differently (e.g. subtle "generic" watermark, or
-- treat it as "no photo yet" for owner-claim prompts).
--
-- Reversible:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.category_image_library;
--   COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS nex.category_image_library (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Category slug · MUST match a data/nex-job-registry.json entry's
  -- category_slug (gyms · salons · dentists · opticians · pharmacies ·
  -- car-repair) OR a legacy vertical (food · accommodation) OR '*' for
  -- a whole-directory generic fallback of last resort.
  category_slug     TEXT NOT NULL,

  -- Optional variant tag for finer selection (e.g. "modern-gym",
  -- "women-fitness", "cardio" for gyms · "womens-salon", "mens-barber",
  -- "beauty", "hair-styling" for salons). Resolver may pick a variant
  -- based on business tags · falls back to variant IS NULL if no match.
  variant_tag       TEXT,

  -- Image payload.
  url               TEXT NOT NULL,
  attribution       TEXT,                     -- who owns/licensed the image (e.g. "NEX in-house", "Unsplash · CC0", "commissioned")
  licence           TEXT,                     -- e.g. "in-house", "CC0", "CC-BY-4.0"
  intrinsic_width   INTEGER,                  -- for card layout hints
  intrinsic_height  INTEGER,

  -- Ordering: resolver prefers lower priority number when multiple match.
  -- Lets Philip rank his curated set (e.g. hero-quality vs adequate).
  priority          INTEGER NOT NULL DEFAULT 100,

  -- Enable/disable without deleting.
  active            BOOLEAN NOT NULL DEFAULT true,

  -- Provenance.
  notes             TEXT,
  added_by          TEXT,                     -- admin identifier
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT category_image_library_category_valid CHECK (category_slug ~ '^([a-z][a-z0-9-]*|\*)$'),
  CONSTRAINT category_image_library_variant_valid  CHECK (variant_tag IS NULL OR variant_tag ~ '^[a-z][a-z0-9-]*$')
);

CREATE INDEX IF NOT EXISTS idx_cat_img_library_category_active
  ON nex.category_image_library (category_slug, active, priority)
  WHERE active = true;

COMMENT ON TABLE nex.category_image_library IS
  'Curated per-category fallback images · NEX resolver picks the best match when a business has no OWNER_IMAGE or VERIFIED_REAL. Philip 2026-08-27 (E) · replaces per-business image generation with a small curated library.';

COMMIT;
