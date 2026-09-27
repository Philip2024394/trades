-- ============================================================================
-- NEX-native Migration 066 · Bridge 15a · Restaurant menus
-- ============================================================================
--
-- Restaurants + cafes are the first vertical to plug into the Bridge 14
-- category foundation. Two new tables:
--
--   nex_menu_section  · top-level grouping (Starters, Mains, Drinks…)
--                       · sort_order controls the reading order on the
--                       · public menu page
--   nex_menu_item     · individual dishes · rich metadata: dietary tags,
--                       allergens, spice level 0-3, availability toggle
--                       for daily "sold out" states, featured flag for
--                       chef's-choice callouts, prep time, portion note
--
-- Both tables are owned by nex_business.id and cascade on business
-- delete. Menu items also FK to a section (nullable so an "uncategorised"
-- item is possible during migration or for one-item drinks lists).
--
-- Dietary + allergen values are stored as free-form text[] to keep the
-- schema forgiving while a canonical list settles. The service layer
-- normalises to lowercase-hyphen (vegan, gluten-free, contains-nuts).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '066';
--     DROP TABLE IF EXISTS nex_menu_item;
--     DROP TABLE IF EXISTS nex_menu_section;
--   COMMIT;
-- ============================================================================

BEGIN;

-- Sections
CREATE TABLE IF NOT EXISTS nex_menu_section (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  description  text,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_menu_section_business
  ON nex_menu_section (business_id, sort_order);

-- Menu items
CREATE TABLE IF NOT EXISTS nex_menu_item (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  section_id          uuid REFERENCES nex_menu_section(id) ON DELETE SET NULL,
  name                text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description         text,
  price_pence         integer NOT NULL CHECK (price_pence >= 0),
  currency            text NOT NULL DEFAULT 'IDR' CHECK (length(currency) = 3),
  image_url           text,
  dietary_tags        text[] NOT NULL DEFAULT ARRAY[]::text[],
  allergens           text[] NOT NULL DEFAULT ARRAY[]::text[],
  spice_level         smallint NOT NULL DEFAULT 0 CHECK (spice_level BETWEEN 0 AND 3),
  is_available        boolean NOT NULL DEFAULT true,
  is_featured         boolean NOT NULL DEFAULT false,
  preparation_time    text,
  portion_note        text,
  sort_order          integer NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'live'
                      CHECK (status IN ('draft', 'live', 'archived')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_menu_item_business
  ON nex_menu_item (business_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_nex_menu_item_section
  ON nex_menu_item (section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_nex_menu_item_live_available
  ON nex_menu_item (business_id)
  WHERE status = 'live' AND is_available = true;

COMMENT ON TABLE nex_menu_section IS
  'Top-level menu grouping per restaurant · Starters, Mains, Drinks. Sealed 2026-09-28 · Bridge 15a.';
COMMENT ON TABLE nex_menu_item IS
  'Individual dishes with rich metadata · dietary tags, allergens, spice level (0-3), availability + featured flags, prep time, portion note. Sealed 2026-09-28 · Bridge 15a.';
COMMENT ON COLUMN nex_menu_item.dietary_tags IS
  'Free-form array · normalised to lowercase-hyphen · vegan, vegetarian, gluten-free, halal, dairy-free, keto, low-carb, spicy.';
COMMENT ON COLUMN nex_menu_item.allergens IS
  'Contains-warnings · nuts, peanuts, dairy, eggs, shellfish, soy, wheat, sesame.';
COMMENT ON COLUMN nex_menu_item.spice_level IS
  '0 = none · 1 = mild · 2 = medium · 3 = hot. Renders as chili glyph count on the menu page.';
COMMENT ON COLUMN nex_menu_item.is_available IS
  'Daily availability toggle · true = orderable now · false = sold out today (still visible but greyed).';
COMMENT ON COLUMN nex_menu_item.is_featured IS
  'Chef''s choice / house special · rendered with a star badge on the menu page.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '066',
    'Bridge 15a · nex_menu_section + nex_menu_item · restaurant + cafe menus with dietary, allergens, spice, availability, featured, prep time, portion',
    'Founder-authorised 2026-09-28. First vertical plugged into the Bridge 14 category foundation. Menu items are a distinct primitive from products · restaurants shouldn''t inherit product SKU/MOQ/dispatch fields that don''t apply.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_name IN ('nex_menu_section', 'nex_menu_item');
