-- Shop Delivery picker — extends `retail_shipping_mode` to cover the
-- full set of patterns a merchant trade (Building Supplies, Tool
-- Hire, Heavy Machinery, etc.) actually offers:
--   'pickup'             — Click & Collect only, no delivery
--   'free'               — Free UK delivery on every order
--   'uk_flat'            — Flat UK delivery fee (retail_shipping_uk_pence)
--   'uk_areas'           — Per-area UK fees (retail_shipping_uk_areas)
--   'uk_over_threshold'  — Free UK delivery over a £ threshold
--                          (retail_shipping_uk_pence reused as the
--                          threshold in pence when mode = this)
-- Backwards compatible — existing rows ('free' / 'uk_flat' / 'uk_areas'
-- / null) stay valid.

alter table public.hammerex_trade_off_listings
  drop constraint if exists chk_retail_shipping_mode;
alter table public.hammerex_trade_off_listings
  add constraint chk_retail_shipping_mode check (
    retail_shipping_mode is null
    or retail_shipping_mode in (
      'free',
      'uk_flat',
      'uk_areas',
      'pickup',
      'uk_over_threshold'
    )
  );
