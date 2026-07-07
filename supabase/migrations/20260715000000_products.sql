-- Products — App #006.
--
-- Three-tier product model:
--
--   os_products_canonical         Manufacturer-owned, brand-signed
--                                 truth. Shared read across every app.
--                                 Write-restricted to the publisher.
--
--   os_products_variants          Variant tree over a canonical
--                                 (colour × size × finish).
--
--   app_products_merchant_offers  Merchant × canonical (× variant) with
--                                 local price, stock, delivery. What
--                                 the storefront + quote lines
--                                 actually reference.
--
--   app_products_merchant_collections
--                                 Merchant curation — groupings of
--                                 offers for storefront sections.
--
--   app_products_supplier_ranges  Supplier-published selection of a
--                                 manufacturer's canonicals plus deal
--                                 terms.
--
--   app_products_supplier_feeds   Ingest pipeline log (URL, sync
--                                 cadence, last run).
--
-- Constitution:
--   os_* tables are readable by any app via server helpers; writes go
--   through Products-app routes only (RLS + entitlement gate).
--   app_products_* tables are Products-owned; nothing else touches them.
--
-- Scale plan (documented for future):
--   • GTIN unique — 15 billion possible values; SKU space is 32-char
--     text (adequate for merchant-local ids). Both indexed.
--   • Categories are text[] materialised at write time; category
--     prefix search uses GIN.
--   • Attributes are JSONB (GIN-indexed for equality tests).
--   • Search will move to a dedicated engine at 10M SKUs; the base
--     schema is designed so a full-text tsvector column can be added
--     later without touching consumers.

BEGIN;

-- ---------------------------------------------------------------------
-- Enable pg_trgm for partial name search (cheap at v1 scale)
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------
-- 1. os_products_canonical — manufacturer-owned truth
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_products_canonical (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_business_id uuid NOT NULL,               -- manufacturer business (hammerex_trade_off_listings.id)
  gtin text,                                          -- GTIN-8/12/13/14 (barcode)
  mpn text,                                           -- manufacturer part number
  brand_name text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,                                 -- publisher-namespaced (`brand-slug/name-slug`)
  description text,
  category_path text[] NOT NULL DEFAULT '{}',         -- ['kitchen','handle','pull-handle']
  taxonomy_leaf_slug text,                            -- AI Visualiser leaf binding
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,      -- {material, colour, finish, dimensions_mm:{w,h,d}, ...}
  hero_image_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,       -- [{kind,title,url}]
  warranty_years integer,
  warranty_terms_url text,
  msrp_pence integer,                                  -- manufacturer suggested retail (indicative)
  lifecycle_status text NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN (
    'draft','active','legacy','withdrawn'
  )),
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS os_products_canonical_gtin_uk
  ON os_products_canonical (gtin) WHERE gtin IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS os_products_canonical_publisher_slug_uk
  ON os_products_canonical (publisher_business_id, slug);
CREATE INDEX IF NOT EXISTS os_products_canonical_publisher_idx
  ON os_products_canonical (publisher_business_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS os_products_canonical_leaf_idx
  ON os_products_canonical (taxonomy_leaf_slug) WHERE lifecycle_status = 'active';
CREATE INDEX IF NOT EXISTS os_products_canonical_category_gin
  ON os_products_canonical USING gin (category_path);
CREATE INDEX IF NOT EXISTS os_products_canonical_attributes_gin
  ON os_products_canonical USING gin (attributes);
CREATE INDEX IF NOT EXISTS os_products_canonical_name_trgm
  ON os_products_canonical USING gin (name gin_trgm_ops)
  WHERE lifecycle_status = 'active';

-- ---------------------------------------------------------------------
-- 2. os_products_variants — variant tree
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_products_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_product_id uuid NOT NULL REFERENCES os_products_canonical(id) ON DELETE CASCADE,
  variant_axes jsonb NOT NULL,                        -- {colour:'brass', size:'128mm'}
  gtin text,
  mpn text,
  name_suffix text,                                    -- ' — Brushed Brass 128mm'
  hero_image_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  attributes_delta jsonb NOT NULL DEFAULT '{}'::jsonb, -- overrides over parent
  lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN (
    'active','legacy','withdrawn'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS os_products_variants_gtin_uk
  ON os_products_variants (gtin) WHERE gtin IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_products_variants_canonical_idx
  ON os_products_variants (canonical_product_id);
CREATE INDEX IF NOT EXISTS os_products_variants_axes_gin
  ON os_products_variants USING gin (variant_axes);

-- ---------------------------------------------------------------------
-- 3. app_products_merchant_offers — merchant × canonical × local terms
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_products_merchant_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  canonical_product_id uuid NOT NULL REFERENCES os_products_canonical(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES os_products_variants(id) ON DELETE SET NULL,
  merchant_sku text,                                   -- merchant's own reference
  price_pence integer NOT NULL,
  rrp_pence integer,
  vat_rate numeric(4,3) NOT NULL DEFAULT 0.200,
  stock_status text NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN (
    'in_stock','low','out','preorder','discontinued'
  )),
  stock_quantity integer,
  low_stock_threshold integer,
  lead_time_days integer,
  delivery_options jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{zone,price_pence,eta_days}]
  local_image_urls text[] NOT NULL DEFAULT '{}',       -- merchant photos ADDED to canonical
  local_notes text,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  promotion jsonb,                                      -- {kind,percentage,ends_at,label}
  supplier_business_id uuid,                            -- optional: which supplier they buy this from
  supplier_range_id uuid,                               -- optional: which supplier range
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_products_merchant_offers_unique_uk
  ON app_products_merchant_offers (merchant_id, canonical_product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'));
CREATE UNIQUE INDEX IF NOT EXISTS app_products_merchant_offers_sku_uk
  ON app_products_merchant_offers (merchant_id, merchant_sku) WHERE merchant_sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_products_merchant_offers_merchant_active_idx
  ON app_products_merchant_offers (merchant_id, is_active, stock_status);
CREATE INDEX IF NOT EXISTS app_products_merchant_offers_canonical_idx
  ON app_products_merchant_offers (canonical_product_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS app_products_merchant_offers_stock_low_idx
  ON app_products_merchant_offers (merchant_id)
  WHERE stock_status IN ('low','out') AND is_active;

-- ---------------------------------------------------------------------
-- 4. app_products_merchant_collections — curation for storefront
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_products_merchant_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  offer_ids uuid[] NOT NULL DEFAULT '{}',
  hero_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_products_merchant_collections_slug_uk
  ON app_products_merchant_collections (merchant_id, slug);

-- ---------------------------------------------------------------------
-- 5. app_products_supplier_ranges — supplier-published selection
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_products_supplier_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_business_id uuid NOT NULL,
  manufacturer_business_id uuid NOT NULL,               -- which brand this range represents
  name text NOT NULL,
  slug text NOT NULL,
  canonical_product_ids uuid[] NOT NULL DEFAULT '{}',
  wholesale_terms jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {moq,rebate_tiers,net_days}
  is_active boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_products_supplier_ranges_slug_uk
  ON app_products_supplier_ranges (supplier_business_id, slug);
CREATE INDEX IF NOT EXISTS app_products_supplier_ranges_manufacturer_idx
  ON app_products_supplier_ranges (manufacturer_business_id) WHERE is_active;

-- ---------------------------------------------------------------------
-- 6. app_products_supplier_feeds — ingest pipeline log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_products_supplier_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_business_id uuid NOT NULL,
  feed_url text NOT NULL,
  format text NOT NULL DEFAULT 'json' CHECK (format IN ('json','csv','xml','pdf')),
  sync_cadence_hours integer NOT NULL DEFAULT 24,
  last_synced_at timestamptz,
  next_sync_at timestamptz,
  last_status text CHECK (last_status IN ('ok','failed','partial')),
  last_error text,
  products_seen integer,
  products_created integer,
  products_updated integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_products_supplier_feeds_supplier_idx
  ON app_products_supplier_feeds (supplier_business_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS app_products_supplier_feeds_due_idx
  ON app_products_supplier_feeds (next_sync_at) WHERE is_active AND next_sync_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- 7. app_products_merchant_subscriptions — merchant subscribes to a
--    supplier range so future manufacturer updates cascade to their
--    offers (with review-then-accept or auto-accept mode).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_products_merchant_range_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  supplier_range_id uuid NOT NULL REFERENCES app_products_supplier_ranges(id) ON DELETE CASCADE,
  auto_accept boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_products_merchant_range_subs_uk
  ON app_products_merchant_range_subscriptions (merchant_id, supplier_range_id);

-- ---------------------------------------------------------------------
-- Touch triggers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION products_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_products_canonical',
      'os_products_variants',
      'app_products_merchant_offers',
      'app_products_merchant_collections',
      'app_products_supplier_ranges',
      'app_products_supplier_feeds',
      'app_products_merchant_range_subscriptions'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION products_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- RLS
--   • Canonical: PUBLIC READ on lifecycle_status='active'. Writes
--     require publisher = auth.uid() (enforced additionally by the
--     entitlement gate at the route layer).
--   • Variants: PUBLIC READ on active. Writes via publisher chain.
--   • Merchant offers: PUBLIC READ on is_active. Writes owner-only.
--   • Collections, ranges, feeds, subscriptions: owner-only.
-- ---------------------------------------------------------------------
ALTER TABLE os_products_canonical                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_products_variants                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_products_merchant_offers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_products_merchant_collections            ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_products_supplier_ranges                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_products_supplier_feeds                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_products_merchant_range_subscriptions    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS os_products_canonical_public_read ON os_products_canonical;
CREATE POLICY os_products_canonical_public_read
  ON os_products_canonical FOR SELECT
  USING (lifecycle_status = 'active');

DROP POLICY IF EXISTS os_products_canonical_publisher_write ON os_products_canonical;
CREATE POLICY os_products_canonical_publisher_write
  ON os_products_canonical FOR ALL
  USING (publisher_business_id = auth.uid())
  WITH CHECK (publisher_business_id = auth.uid());

DROP POLICY IF EXISTS os_products_variants_public_read ON os_products_variants;
CREATE POLICY os_products_variants_public_read
  ON os_products_variants FOR SELECT
  USING (lifecycle_status = 'active');

DROP POLICY IF EXISTS app_products_merchant_offers_public_read ON app_products_merchant_offers;
CREATE POLICY app_products_merchant_offers_public_read
  ON app_products_merchant_offers FOR SELECT
  USING (is_active);

DROP POLICY IF EXISTS app_products_merchant_offers_merchant_write ON app_products_merchant_offers;
CREATE POLICY app_products_merchant_offers_merchant_write
  ON app_products_merchant_offers FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS app_products_merchant_collections_owner ON app_products_merchant_collections;
CREATE POLICY app_products_merchant_collections_owner
  ON app_products_merchant_collections FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS app_products_supplier_ranges_owner ON app_products_supplier_ranges;
CREATE POLICY app_products_supplier_ranges_owner
  ON app_products_supplier_ranges FOR ALL
  USING (supplier_business_id = auth.uid())
  WITH CHECK (supplier_business_id = auth.uid());

DROP POLICY IF EXISTS app_products_supplier_feeds_owner ON app_products_supplier_feeds;
CREATE POLICY app_products_supplier_feeds_owner
  ON app_products_supplier_feeds FOR ALL
  USING (supplier_business_id = auth.uid())
  WITH CHECK (supplier_business_id = auth.uid());

DROP POLICY IF EXISTS app_products_merchant_range_subs_owner ON app_products_merchant_range_subscriptions;
CREATE POLICY app_products_merchant_range_subs_owner
  ON app_products_merchant_range_subscriptions FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- ---------------------------------------------------------------------
-- 8. Extensions to existing app tables — bind them to Products (v1).
--    Non-destructive: nullable columns, existing rows unaffected.
-- ---------------------------------------------------------------------

-- AI Visualiser catalogue scope may now bind directly to real offers
-- (per-merchant) alongside the taxonomy-leaf binding.
ALTER TABLE app_ai_visualiser_catalogue_scope
  ADD COLUMN IF NOT EXISTS bound_offer_ids uuid[] NOT NULL DEFAULT '{}';

-- Quote Workspace line items may reference a merchant offer for
-- price + spec + warranty auto-binding.
ALTER TABLE app_quote_workspace_quote_items
  ADD COLUMN IF NOT EXISTS product_offer_id uuid REFERENCES app_products_merchant_offers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS app_quote_ws_items_offer_idx
  ON app_quote_workspace_quote_items (product_offer_id) WHERE product_offer_id IS NOT NULL;

COMMIT;
