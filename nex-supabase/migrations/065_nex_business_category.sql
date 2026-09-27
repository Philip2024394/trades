-- ============================================================================
-- NEX-native Migration 065 · Bridge 14 · Business category foundation
-- ============================================================================
--
-- Persists the vertical every shop belongs to. Until now the 19
-- categories from src/lib/nex-native/site-templates.ts
-- (NEX_BUSINESS_CATEGORIES) only lived in template intent · never on
-- the row. This makes the category first-class so:
--
--   · Directory search can facet by category
--   · Future vertical-specific renderers can dispatch on it (a
--     restaurant landing shows a menu, a rental shows a calendar)
--   · Analytics can slice by vertical
--
-- Also adds search_keywords · a per-shop text[] so sellers can
-- surface additional discovery terms beyond what their products'
-- tags carry (useful for service businesses that have no products).
--
-- Nullable · existing rows default to NULL for category (unset) ·
-- Directory queries treat NULL as "uncategorised" and show the shop
-- in a general bucket. Sellers set the category on /manage/shop.
--
-- Categories mirror NEX_BUSINESS_CATEGORIES exactly · keep both
-- lists in sync when adding new verticals (search for
-- NEX_BUSINESS_CATEGORIES in the codebase).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '065';
--     ALTER TABLE nex_business
--       DROP CONSTRAINT IF EXISTS nex_business_category_check,
--       DROP COLUMN IF EXISTS business_category,
--       DROP COLUMN IF EXISTS search_keywords;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS business_category text,
  ADD COLUMN IF NOT EXISTS search_keywords text[];

ALTER TABLE nex_business
  DROP CONSTRAINT IF EXISTS nex_business_category_check;

ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_category_check
  CHECK (
    business_category IS NULL
    OR business_category IN (
      'bakery',
      'restaurant',
      'cafe',
      'tradesperson',
      'construction',
      'staircase-company',
      'salon',
      'beauty',
      'fitness',
      'consultant',
      'agency',
      'ecommerce',
      'product-brand',
      'local-service',
      'portfolio',
      'community',
      'event',
      'creator',
      'professional-service'
    )
  );

-- GIN index on the keyword array so ILIKE / && searches are cheap.
CREATE INDEX IF NOT EXISTS idx_nex_business_search_keywords
  ON nex_business USING gin (search_keywords);

-- BTree index on the category so facet filters are cheap.
CREATE INDEX IF NOT EXISTS idx_nex_business_category
  ON nex_business (business_category)
  WHERE business_category IS NOT NULL;

COMMENT ON COLUMN nex_business.business_category IS
  'Vertical of the shop · one of the 19 NEX_BUSINESS_CATEGORIES
   values. NULL = uncategorised · Directory shows in a general
   bucket. Sealed 2026-09-28 · Bridge 14. Keep in sync with
   src/lib/nex-native/site-templates.ts NEX_BUSINESS_CATEGORIES.';
COMMENT ON COLUMN nex_business.search_keywords IS
  'Additional discovery terms the seller wants to appear under ·
   used by /nex-native/search alongside product tags. Max ~20
   entries recommended (no hard cap enforced).';

-- Seed Aisha as ecommerce · she sells product-first.
UPDATE nex_business
   SET business_category = 'ecommerce',
       search_keywords = ARRAY[
         'vintage cameras', 'film cameras', 'leica', 'rolleiflex',
         'nikon', 'hasselblad', 'analog photography', 'jakarta',
         'cla serviced', 'medium format', 'rangefinder', 'slr'
       ]::text[],
       updated_at = now()
 WHERE slug = 'aisha-vintage-cameras';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '065',
    'Bridge 14 · nex_business.business_category (19-value CHECK) + search_keywords text[]',
    'Founder-authorised 2026-09-28. Category as first-class · unblocks vertical-specific renderers + Directory facet.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT slug, business_category, search_keywords
--     FROM nex_business WHERE slug='aisha-vintage-cameras';
