-- ============================================================================
-- NEX-native Migration 003 · nex_product
-- ============================================================================
--
-- Purpose:
--   Canonical NEX product. Owned by a business. Price in pence (bigint) +
--   ISO-4217 currency code. Status controls public visibility.
--
-- Doctrine references:
--   · Identity Doctrine · business_id is UUID FK · never phone/email
--   · Commercial Doctrine · product listing is free · not a lead product
--   · No fourth product architecture (Founder-signed 2026-09-24) · this IS
--     the NEX canonical product record. Legacy os_products_canonical /
--     app_products_merchant_offers / hammerex_xrated_products live on the
--     dead thenetworkers substrate · not authoritative here.
--
-- Merchant-offer separation:
--   MVP fold: one business owns each product · price/stock live on the
--   product row · no separate merchant_offer table yet. If in future
--   multi-merchant offers are needed, introduce nex_product_offer
--   (canonical_product_id → nex_product, merchant_business_id → nex_business).
--
-- FK behaviour:
--   business_id → ON DELETE RESTRICT · a product can't outlive its
--   business row · deleting a business requires archiving products first.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '003';
--     DROP TABLE IF EXISTS nex_product;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_product (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid NOT NULL REFERENCES nex_business(id) ON DELETE RESTRICT,
  name                text NOT NULL CHECK (length(trim(name)) > 0),
  description         text,
  price_pence         bigint NOT NULL CHECK (price_pence >= 0),
    -- Minor units of currency (e.g. GBP pence · USD cents). Never store
    -- money as float. Zero-priced products allowed (free giveaways).
  currency            text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    -- ISO-4217 uppercase 3-char code.
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'live', 'archived')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_product IS
  'NEX canonical product · owned by exactly one business · price in minor currency units (pence/cents) as bigint. This is the ONLY NEX-authoritative product table (Founder 2026-09-24 · no fourth product architecture).';

COMMENT ON COLUMN nex_product.price_pence IS
  'Price in minor currency units (e.g. GBP pence). bigint · never float · always >= 0.';

COMMENT ON COLUMN nex_product.currency IS
  'ISO-4217 uppercase 3-char code. Currency does not change on the product row · orders snapshot both price and currency at order-creation time.';

COMMENT ON COLUMN nex_product.status IS
  'draft (not visible to customers) · live (public) · archived (retired but retained for audit and existing orders).';

CREATE INDEX IF NOT EXISTS idx_nex_product_business_id
  ON nex_product (business_id);

CREATE INDEX IF NOT EXISTS idx_nex_product_status
  ON nex_product (status)
  WHERE status = 'live';

CREATE TRIGGER trg_nex_product_touch_updated_at
  BEFORE UPDATE ON nex_product
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

-- RLS
ALTER TABLE nex_product ENABLE ROW LEVEL SECURITY;

-- Public reads only LIVE products.
CREATE POLICY nex_product_public_read_live
  ON nex_product
  FOR SELECT
  TO anon, authenticated
  USING (status = 'live');

-- Owner (via business) reads all their products including drafts + archived.
CREATE POLICY nex_product_owner_read
  ON nex_product
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- Owner insert/update on their business's products.
CREATE POLICY nex_product_owner_insert
  ON nex_product
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

CREATE POLICY nex_product_owner_update
  ON nex_product
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- DELETE only via service-role (product retirement is governed · use status='archived' instead).

INSERT INTO nex_migration_history (version, description, notes)
VALUES ('003', 'nex_product · single canonical product table · price in pence + ISO currency + status enum + RLS', 'MVP folds merchant offers into product row · introduce nex_product_offer later if multi-merchant needed.')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT * FROM nex_migration_history WHERE version = '003';
--   SELECT count(*) FROM nex_product;
--   SELECT policyname FROM pg_policies WHERE tablename = 'nex_product';
