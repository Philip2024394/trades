-- Per-surface visibility flags for canteen products.
--
-- Enables the "upload once, flow to 3 surfaces" model:
--   1. show_in_canteen_products — the Products tab on the canteen page
--   2. show_in_trending         — the Instagram Stories-style swipe sheet
--   3. show_in_trade_center     — the Trade Center marketplace listing
--
-- All three default to TRUE so existing rows behave unchanged. The
-- merchant-wide `send_to_trade_center` flag on the members table stays
-- as a master switch — a product only reaches TC when BOTH the merchant
-- switch AND the per-product flag are true (defence-in-depth against a
-- merchant flipping the master off but leaving per-product flags on).

alter table hammerex_canteen_products
  add column if not exists show_in_canteen_products boolean not null default true,
  add column if not exists show_in_trending boolean not null default true,
  add column if not exists show_in_trade_center boolean not null default true,
  add column if not exists gallery_urls text[] default array[]::text[],
  -- Video URLs uploaded through the Video app. 60s cap enforced at
  -- upload time. Tier-gated: free tier is 0, paid tiers get a base
  -- allocation with credit-pack top-ups. Empty array default.
  add column if not exists video_urls text[] default array[]::text[],
  add column if not exists currency text default 'GBP',
  -- Variants: null when the product has no variants (single SKU). When
  -- present, the shape is:
  --   { axis: "size" | "color" | "size_color",
  --     sizePreset?: "uk_shoes" | "eu_shoes" | "uk_clothes" | "us_clothes"
  --                 | "numeric" | "trade_length" | "custom",
  --     sizeOptions?: string[],
  --     colorOptions?: { name: string, hex?: string }[] }
  add column if not exists variants jsonb,
  -- Commerce metadata: brand, year, condition, country of origin,
  -- warranty, shipping (local + international per-country), multi-buy
  -- discount ladders, and optional electrical/plumbing/etc. spec
  -- blocks. JSONB so the shape can evolve without further migrations.
  --
  -- Shape (all optional):
  --   { brand, yearMade, condition, countryOfOrigin, warranty,
  --     shipping: {
  --       freeLocalShipping, localShippingGbp,
  --       shipsInternationally, internationalRates: [{country, priceGbp}]
  --     },
  --     multiBuy: {
  --       enabled, model: "tiered"|"additive",
  --       tiers?: [{qty, unitPriceGbp}],
  --       additive?: {secondUnitDiscountGbp, thirdPlusUnitDiscountGbp},
  --       deliveryModel: "single"|"per-item"
  --     },
  --     electrical: {voltage, wattage, amps, plugType, certification}
  --   }
  add column if not exists commerce jsonb,
  -- Category slug from src/lib/productCategories.ts. Trade Center browse
  -- and Yard filtering both group by this. Nullable so pre-migration
  -- rows keep working; new products from the editor default to "other".
  add column if not exists category_slug text,
  -- Category-specific aspects (key → value). Shape mirrors the SpecField[]
  -- for the chosen category. Buyer-side facets read this to build
  -- filters. Empty when category is "other".
  add column if not exists category_aspects jsonb;

create index if not exists hammerex_canteen_products_category
  on hammerex_canteen_products (category_slug)
  where category_slug is not null;

comment on column hammerex_canteen_products.show_in_canteen_products
  is 'Product renders in the canteen Products tab. Default true. Merchant can hide without deleting.';
comment on column hammerex_canteen_products.show_in_trending
  is 'Product is eligible for the trending swipe sheet on the canteen mobile app. Default true.';
comment on column hammerex_canteen_products.show_in_trade_center
  is 'Product is listed on Trade Center. Requires merchant.send_to_trade_center = true AND trade_center_listing_id set. Default true.';
