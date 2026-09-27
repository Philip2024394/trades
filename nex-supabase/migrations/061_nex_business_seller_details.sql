-- ============================================================================
-- NEX-native Migration 061 · Business seller-detail columns
-- ============================================================================
--
-- Adds the fields buyers care about when deciding whether to open a
-- conversation with a supplier:
--
--   year_established        smallint   founding year · e.g. 2015
--   staff_count             text       "1 (owner)", "5-10", "50+" · free-form
--                                       so the seller can write what fits
--   samples_available       boolean    "samples available on request"
--   accepts_oem             boolean    custom / OEM manufacturing on request
--   min_order_quantity      text       "1 unit", "10 pieces", "1000 pcs"
--   local_postage_included  boolean    shop prices include local shipping
--   seller_kind             text       'private' | 'registered_company'
--   languages               text[]     ISO codes · seller can speak with buyer
--   additional_details      text       any extra prose the seller wants to add
--
-- Defaults are chosen so existing rows stay valid without any UI edit:
--   · booleans default false (neutral · safest assumption)
--   · languages defaults to ['id'] (Indonesian · every seller speaks it)
--   · seller_kind defaults 'private' (safest label for an unverified shop)
--   · year_established / staff_count / min_order_quantity / additional_details
--     default NULL and simply hide on the About page when empty
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '061';
--     ALTER TABLE nex_business
--       DROP CONSTRAINT IF EXISTS nex_business_seller_kind_check,
--       DROP COLUMN IF EXISTS year_established,
--       DROP COLUMN IF EXISTS staff_count,
--       DROP COLUMN IF EXISTS samples_available,
--       DROP COLUMN IF EXISTS accepts_oem,
--       DROP COLUMN IF EXISTS min_order_quantity,
--       DROP COLUMN IF EXISTS local_postage_included,
--       DROP COLUMN IF EXISTS seller_kind,
--       DROP COLUMN IF EXISTS languages,
--       DROP COLUMN IF EXISTS additional_details;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS year_established smallint,
  ADD COLUMN IF NOT EXISTS staff_count text,
  ADD COLUMN IF NOT EXISTS samples_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_oem boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_order_quantity text,
  ADD COLUMN IF NOT EXISTS local_postage_included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_kind text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT ARRAY['id']::text[],
  ADD COLUMN IF NOT EXISTS additional_details text;

ALTER TABLE nex_business
  DROP CONSTRAINT IF EXISTS nex_business_seller_kind_check;

ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_seller_kind_check
  CHECK (seller_kind IN ('private', 'registered_company'));

COMMENT ON COLUMN nex_business.year_established IS
  'Founding year · smallint fits 4-digit years comfortably.';
COMMENT ON COLUMN nex_business.staff_count IS
  'Free-form headcount description · "1 (owner)", "5-10", "50+".';
COMMENT ON COLUMN nex_business.samples_available IS
  'True when the seller offers samples on request before an order.';
COMMENT ON COLUMN nex_business.accepts_oem IS
  'True when the seller manufactures custom / OEM per buyer spec.';
COMMENT ON COLUMN nex_business.min_order_quantity IS
  'Free-form MOQ · "1 unit", "10 pieces", "1000 pcs / colour".';
COMMENT ON COLUMN nex_business.local_postage_included IS
  'True when shop prices already include local shipping.';
COMMENT ON COLUMN nex_business.seller_kind IS
  '''private'' individual seller · ''registered_company'' registered
   business entity. Verification badges hook off this later.';
COMMENT ON COLUMN nex_business.languages IS
  'ISO codes the seller speaks · ''id'' Indonesian is the default.
   ''en'' English, ''zh'' Chinese, ''nl'' Dutch, ''ar'' Arabic, etc.';
COMMENT ON COLUMN nex_business.additional_details IS
  'Free prose · anything extra the seller wants buyers to know.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '061',
    'nex_business seller detail columns · year, staff, samples, oem, moq, postage, seller_kind, languages, additional_details',
    'Founder-authorised 2026-09-27. Everything a buyer wants to know before opening a conversation. Seller-setup form on /manage collects these · About overlay on the public shop renders them.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_business'
--      AND column_name IN (
--        'year_established','staff_count','samples_available','accepts_oem',
--        'min_order_quantity','local_postage_included','seller_kind',
--        'languages','additional_details'
--      );
