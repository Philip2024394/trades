-- deploy/postgres/init/096_nex_marketplace_slice.sql
--
-- NEX MARKETPLACE · vertical slice schema.
--
-- Doctrine:
--   · DISCOVERED ≠ CLAIMED ≠ REGISTERED ≠ VERIFIED ≠ ACTIVE for sellers.
--   · Configurable seller fee · never hard-coded in application code.
--   · Variants are (option × option_value) combinations · each variant has
--     its own SKU/price/stock.
--   · No real payment · no order settlement in this slice.
--
-- Additive · reversible · applied.

BEGIN;

DO $$ BEGIN
  CREATE TYPE nex.mp_seller_status AS ENUM (
    'discovered',       -- Walker found · no owner action
    'claimable',        -- Public claim page live · not yet claimed
    'claimed',          -- Owner said "this is mine" · not yet verified
    'registered',       -- Owner registered NEX seller account
    'verified',         -- Identity + payment info verified
    'active',           -- May list + transact
    'suspended'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.mp_product_condition AS ENUM ('new', 'used', 'refurbished');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── SELLER ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.mp_seller (
  seller_id            uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text                  NOT NULL UNIQUE,
  display_name         text                  NOT NULL,
  city                 text                            ,
  jurisdiction         text                  NOT NULL DEFAULT 'ID/DIY/Yogyakarta',
  status               nex.mp_seller_status  NOT NULL DEFAULT 'discovered',
  bio                  text                            ,
  cover_image_ref      text                            ,
  logo_image_ref       text                            ,
  contact_ref          text                            ,-- optional link to nex.comms_contact
  discovered_from      text                            ,-- e.g. 'walker:commerce:yogyakarta'
  created_at           timestamptz           NOT NULL DEFAULT now(),
  updated_at           timestamptz           NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mp_seller_status ON nex.mp_seller (status);

-- ── CATEGORY ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.mp_category (
  category_id          uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  key                  text                  NOT NULL UNIQUE,
  label                text                  NOT NULL,
  parent_id            uuid                            REFERENCES nex.mp_category(category_id),
  sort_order           int                   NOT NULL DEFAULT 100
);

-- Seed initial categories
INSERT INTO nex.mp_category (key, label, sort_order) VALUES
  ('electronics',        'Electronics',           10),
  ('phones',             'Phones',                20),
  ('computers',          'Computers',             30),
  ('motorbike',          'Motorbike',             40),
  ('car',                'Car',                   50),
  ('parts_accessories',  'Parts & Accessories',   60),
  ('fashion',            'Fashion',               70),
  ('home',               'Home',                  80),
  ('furniture',          'Furniture',             90),
  ('appliances',         'Appliances',           100),
  ('building_hardware',  'Building & Hardware',  110),
  ('tools',              'Tools',                120),
  ('food_beverage',      'Food & Beverage',      130),
  ('beauty',             'Beauty',               140),
  ('sports',             'Sports',               150),
  ('kids_family',        'Kids & Family',        160),
  ('local_products',     'Local Products',       170),
  ('used_preowned',      'Used / Pre-owned',     180),
  ('other',              'Other',                999)
ON CONFLICT (key) DO NOTHING;

-- ── PRODUCT ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.mp_product (
  product_id           uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id            uuid                          NOT NULL REFERENCES nex.mp_seller(seller_id) ON DELETE CASCADE,
  category_id          uuid                          REFERENCES nex.mp_category(category_id),
  slug                 text                          NOT NULL UNIQUE,
  name                 text                          NOT NULL,
  description          text                                    ,
  condition            nex.mp_product_condition      NOT NULL DEFAULT 'new',
  has_variants         boolean                       NOT NULL DEFAULT false,
  base_price_idr       int                                     CHECK (base_price_idr IS NULL OR base_price_idr >= 0),
  base_stock           int                                     CHECK (base_stock IS NULL OR base_stock >= 0),
  base_sku             text                                    ,
  active               boolean                       NOT NULL DEFAULT true,
  created_at           timestamptz                   NOT NULL DEFAULT now(),
  updated_at           timestamptz                   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mp_product_seller ON nex.mp_product (seller_id);
CREATE INDEX IF NOT EXISTS idx_mp_product_category ON nex.mp_product (category_id) WHERE active;

CREATE TABLE IF NOT EXISTS nex.mp_product_image (
  image_id             uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           uuid                  NOT NULL REFERENCES nex.mp_product(product_id) ON DELETE CASCADE,
  url                  text                  NOT NULL,
  sort_order           int                   NOT NULL DEFAULT 100,
  alt_text             text
);
CREATE INDEX IF NOT EXISTS idx_mp_product_image_product ON nex.mp_product_image (product_id, sort_order);

-- ── PRODUCT OPTIONS + VALUES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.mp_product_option (
  option_id            uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           uuid                  NOT NULL REFERENCES nex.mp_product(product_id) ON DELETE CASCADE,
  name                 text                  NOT NULL,     -- e.g. 'Color' · 'Size' · 'Storage' · 'Model'
  sort_order           int                   NOT NULL DEFAULT 100,
  UNIQUE (product_id, name)
);

CREATE TABLE IF NOT EXISTS nex.mp_product_option_value (
  option_value_id      uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id            uuid                  NOT NULL REFERENCES nex.mp_product_option(option_id) ON DELETE CASCADE,
  value                text                  NOT NULL,
  sort_order           int                   NOT NULL DEFAULT 100,
  UNIQUE (option_id, value)
);
CREATE INDEX IF NOT EXISTS idx_mp_option_value_option ON nex.mp_product_option_value (option_id, sort_order);

-- ── VARIANTS ───────────────────────────────────────────────────────────
-- Each variant is one specific combination of option-values.
-- Combination stored as jsonb array of option_value_ids for fast lookup.
CREATE TABLE IF NOT EXISTS nex.mp_product_variant (
  variant_id           uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           uuid                  NOT NULL REFERENCES nex.mp_product(product_id) ON DELETE CASCADE,
  sku                  text                  NOT NULL,
  price_idr            int                   NOT NULL CHECK (price_idr >= 0),
  stock                int                   NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active               boolean               NOT NULL DEFAULT true,
  option_value_ids     uuid[]                NOT NULL,     -- the combination · sorted for stable lookup
  UNIQUE (product_id, sku),
  UNIQUE (product_id, option_value_ids)
);
CREATE INDEX IF NOT EXISTS idx_mp_variant_product ON nex.mp_product_variant (product_id) WHERE active;

-- ── COMMERCE POLICY ────────────────────────────────────────────────────
-- Data-driven seller fee. Application code MUST NEVER hard-code the rate.
CREATE TABLE IF NOT EXISTS nex.mp_commerce_policy (
  policy_id                  uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction               text              NOT NULL,
  category_id                uuid                          REFERENCES nex.mp_category(category_id),
  effective_from             timestamptz       NOT NULL DEFAULT now(),
  effective_to               timestamptz                             ,
  seller_fee_rate            numeric(5, 4)     NOT NULL,   -- e.g. 0.0500 = 5%
  min_fee_idr                int               NOT NULL DEFAULT 0 CHECK (min_fee_idr >= 0),
  max_fee_idr                int                                       CHECK (max_fee_idr IS NULL OR max_fee_idr >= 0),
  currency                   text              NOT NULL DEFAULT 'IDR',
  notes                      text                                    ,
  CONSTRAINT fee_rate_bounds CHECK (seller_fee_rate >= 0 AND seller_fee_rate <= 1)
);

INSERT INTO nex.mp_commerce_policy (jurisdiction, category_id, effective_from, seller_fee_rate, notes)
VALUES ('ID/DIY/Yogyakarta', NULL, now(), 0.0500,
        'Initial NEX Marketplace seller fee · 5% · configurable per jurisdiction/category · never hard-coded.')
ON CONFLICT DO NOTHING;

COMMIT;

-- Rollback:
-- BEGIN;
--   DROP TABLE IF EXISTS nex.mp_commerce_policy;
--   DROP TABLE IF EXISTS nex.mp_product_variant;
--   DROP TABLE IF EXISTS nex.mp_product_option_value;
--   DROP TABLE IF EXISTS nex.mp_product_option;
--   DROP TABLE IF EXISTS nex.mp_product_image;
--   DROP TABLE IF EXISTS nex.mp_product;
--   DROP TABLE IF EXISTS nex.mp_category;
--   DROP TABLE IF EXISTS nex.mp_seller;
--   DROP TYPE  IF EXISTS nex.mp_product_condition;
--   DROP TYPE  IF EXISTS nex.mp_seller_status;
-- COMMIT;
