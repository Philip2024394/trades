-- Xrated Trades — Phase 1B follow-up
--
-- 1. hammerex_xrated_products gains:
--      kind ('product' | 'service')   — single table holds both Shop Mode
--                                       physical goods AND the Services
--                                       Prices add-on entries.
--      unit text                      — pricing unit for services
--                                       ("per hour", "per sqm", "per tree",
--                                       "per day", etc). Null = flat item
--                                       price (the default for products).
--      category text                  — optional grouping inside Services
--                                       Prices ("gardening", "machinery",
--                                       "hire") so the public grid can be
--                                       split into sections.
--
-- 2. hammerex_xrated_reviews gains:
--      product_id uuid                — when set, review is tagged to a
--                                       specific product entry. Reuses the
--                                       existing 5-axis rating scale; the
--                                       UI relabels axes for product
--                                       context (workmanship → Quality,
--                                       timeliness → Delivery time).

ALTER TABLE hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'product'
    CHECK (kind IN ('product','service')),
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS hammerex_xrated_products_kind_idx
  ON hammerex_xrated_products (listing_id, kind, status, sort_order);

ALTER TABLE hammerex_xrated_reviews
  ADD COLUMN IF NOT EXISTS product_id uuid
    REFERENCES hammerex_xrated_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS hammerex_xrated_reviews_product_idx
  ON hammerex_xrated_reviews (product_id)
  WHERE product_id IS NOT NULL;
