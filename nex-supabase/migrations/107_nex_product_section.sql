-- ============================================================================
-- NEX-native Migration 107 · Category Tabs · nex_product_section
-- ============================================================================
--
-- Purpose:
--   Per-shop category grouping for products, mirroring nex_menu_section
--   (Migration 066) so cover pages and the peer-chat shop slider can
--   render a tab bar that filters products by category.
--
-- Founder ruling · 2026-09-30:
--   · Hard cap 3 tabs per shop (enforced at form + service layer, NOT DB
--     so imports / API tooling don't reject the 4th row).
--   · One-word name rule enforced at form + service (NOT DB) so legacy
--     rows stay portable across future refactors.
--   · New table (NOT overloading nex_product.tags · tags are discovery
--     slugs, sections are UX navigation).
--
-- Data shape (mirrors nex_menu_section exactly):
--   id           uuid PK
--   business_id  uuid FK nex_business (ON DELETE CASCADE)
--   name         text 1-40 (looser than menu's 1-80 · products want short)
--   sort_order   integer default 0
--   timestamps
--
-- FK on nex_product:
--   ALTER TABLE nex_product ADD COLUMN section_id uuid
--     REFERENCES nex_product_section(id) ON DELETE SET NULL
--   NULL section_id = "uncategorised" · appears only under "All" tab.
--
-- RLS mirrors nex_product policies:
--   · Public reads sections whose parent business has any live product
--     (kept simple: all sections readable · they don't leak sensitive
--     info · just a name string).
--   · Owner CRUD their own business's sections.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '107';
--     ALTER TABLE nex_product DROP COLUMN IF EXISTS section_id;
--     DROP TABLE IF EXISTS nex_product_section;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_product_section (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_product_section_business
  ON nex_product_section (business_id, sort_order);

DROP TRIGGER IF EXISTS trg_nex_product_section_touch_updated_at ON nex_product_section;
CREATE TRIGGER trg_nex_product_section_touch_updated_at
  BEFORE UPDATE ON nex_product_section
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

COMMENT ON TABLE nex_product_section IS
  'Per-shop product category (max 3 enforced at service layer). Mirror of nex_menu_section. Sealed 2026-09-30 · Category Tabs doctrine.';
COMMENT ON COLUMN nex_product_section.name IS
  'One-word name recommended (pattern /^[A-Za-z0-9\-]{1,20}$/ enforced app-side). DB stays permissive up to 40 chars.';

ALTER TABLE nex_product_section ENABLE ROW LEVEL SECURITY;

-- Public read (any authenticated OR anon) · sections are just names.
DROP POLICY IF EXISTS nex_product_section_public_read ON nex_product_section;
CREATE POLICY nex_product_section_public_read
  ON nex_product_section
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Owner CRUD.
DROP POLICY IF EXISTS nex_product_section_owner_insert ON nex_product_section;
CREATE POLICY nex_product_section_owner_insert
  ON nex_product_section
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_product_section_owner_update ON nex_product_section;
CREATE POLICY nex_product_section_owner_update
  ON nex_product_section
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_product_section_owner_delete ON nex_product_section;
CREATE POLICY nex_product_section_owner_delete
  ON nex_product_section
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- FK on nex_product.
ALTER TABLE nex_product
  ADD COLUMN IF NOT EXISTS section_id uuid
    REFERENCES nex_product_section(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nex_product_section_id
  ON nex_product (section_id)
  WHERE section_id IS NOT NULL;

COMMENT ON COLUMN nex_product.section_id IS
  'Optional FK to nex_product_section. NULL = uncategorised · shown only under "All" tab. ON DELETE SET NULL so section removal never drops products.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '107',
    'Category Tabs · nex_product_section + nex_product.section_id FK · mirror of nex_menu_section (066)',
    'Founder-authorised 2026-09-30. Hard cap 3 tabs + one-word rule enforced at form/service layer, NOT DB. RLS: public read, owner CRUD.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_name = 'nex_product_section';
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'nex_product' AND column_name = 'section_id';
--   SELECT policyname FROM pg_policies WHERE tablename = 'nex_product_section';
