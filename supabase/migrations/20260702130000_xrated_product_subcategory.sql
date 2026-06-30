-- Merchant Pro — product subcategory for calculator cross-sell.
--
-- Each product can optionally declare a `merchant_subcategory` (e.g.
-- "paint_brush", "paint_roller", "masking_tape", "sandpaper",
-- "tile_adhesive", "underlay") on top of its category. The Material
-- Calculator cross-sell engine reads this when surfacing "Complete
-- your project" suggestions — instead of showing generic ads, it pulls
-- the THIS merchant's own complementary products that match the
-- scenario's needed-items list.
--
-- Subcategory is intentionally free-text + indexed (not a strict enum)
-- so a new calc scenario can introduce a new subcategory by code
-- without a DB migration. src/lib/merchantCategories.ts holds the
-- controlled vocabulary the editor surfaces in the dropdown.

ALTER TABLE hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS merchant_subcategory text NULL;

CREATE INDEX IF NOT EXISTS idx_xrated_products_subcat
  ON hammerex_xrated_products(listing_id, merchant_subcategory)
  WHERE merchant_subcategory IS NOT NULL;

COMMENT ON COLUMN hammerex_xrated_products.merchant_subcategory IS
  'Optional subcategory for cross-sell matching. e.g. paint_brush, paint_roller, tile_adhesive, underlay. See src/lib/merchantCategories.ts MERCHANT_SUBCATEGORIES.';
