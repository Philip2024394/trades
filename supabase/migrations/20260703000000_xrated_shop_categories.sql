-- Shop Categories add-on — per-listing horizontal category strip that
-- sits directly under the hero and jumps into the shop filtered by
-- that category.
--
-- Two changes:
--   1. listing.shop_categories — JSONB array of {slug,label,image_url,
--      enabled,sort_order}. Full merchant control from the dashboard.
--   2. product.shop_category_slugs — text[] of which strip slugs this
--      product belongs to. A product can be in multiple categories
--      (e.g. cement in both "bricks_and_blocks" and "sand_gravel").
--
-- Both are additive; existing listings + products get NULL/empty and
-- the strip self-hides when there are no enabled categories.

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS shop_categories jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS shop_category_slugs text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS hammerex_xrated_products_shop_cats_gin
  ON hammerex_xrated_products USING gin (shop_category_slugs);

COMMENT ON COLUMN hammerex_trade_off_listings.shop_categories IS
  'Per-listing category strip. Array of {slug,label,image_url,enabled,sort_order}. Merchant edits from /edit/<slug>/shop-categories.';
COMMENT ON COLUMN hammerex_xrated_products.shop_category_slugs IS
  'Which shop_categories slugs this product belongs to. GIN-indexed for filter queries: WHERE shop_category_slugs @> ARRAY[<slug>].';
