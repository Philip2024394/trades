-- Trade Center Picks — add a per-pick banner image override.
--
-- The banner override lets the merchant pin a custom landscape banner
-- onto a pick that's distinct from the underlying product's PDP cover.
-- When NULL the public banner component falls back to the joined
-- product.cover_url. Additive, fully backward-compatible.

ALTER TABLE hammerex_xrated_trade_center_picks
  ADD COLUMN IF NOT EXISTS banner_image_url text;
