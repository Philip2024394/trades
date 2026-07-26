-- NEX Centre visibility flags on merchant offers.
--
-- Per the Phase 7 Implementation Plan amendment (2026-07-27):
-- when a merchant approves a product it publishes to the NEX Centre
-- Pinterest feed by default. Merchant can opt out via
-- nex_centre_visible=false. Optional tile-layout hint per offer.
--
-- Additive-only. Safe to re-run.

BEGIN;

ALTER TABLE app_products_merchant_offers
  ADD COLUMN IF NOT EXISTS nex_centre_visible     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nex_centre_tile_layout TEXT;     -- 'portrait' | 'landscape' | null

CREATE INDEX IF NOT EXISTS app_products_merchant_offers_centre_visible_idx
  ON app_products_merchant_offers(nex_centre_visible, is_active)
  WHERE nex_centre_visible = true AND is_active = true;

COMMENT ON COLUMN app_products_merchant_offers.nex_centre_visible IS
  'Merchant opt-in for NEX Centre feed inclusion. Default true so approved '
  'products appear automatically. Merchant sets false to hide from the '
  'public discovery surface without withdrawing the offer.';

COMMENT ON COLUMN app_products_merchant_offers.nex_centre_tile_layout IS
  'Optional tile-shape hint for the Pinterest feed. NULL leaves auto-layout.';

COMMIT;
