-- Merchant Pro — product categories + calculator framework.
--
-- merchant_category drives both the category-page taxonomy on the
-- storefront AND the default calculator type that renders on the PDP.
-- calculator_override lets a merchant force a different calculator (or
-- hide the calculator entirely with 'none') on a per-product basis.
--
-- service_trade_type + service_rate_pence + service_rate_unit cover the
-- trade-installer side: a service product (kind='service') declares its
-- trade (carpenter / tiler / plasterer / etc.) and a £/m² (or £/m,
-- £/item, £/tonne, £/hour, £/day) labour rate. Matching calculators
-- render an "Installation by [trade name]" line under the materials
-- estimate.

ALTER TABLE hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS merchant_category text NULL,
  ADD COLUMN IF NOT EXISTS calculator_override text NULL,
  ADD COLUMN IF NOT EXISTS service_trade_type text NULL,
  ADD COLUMN IF NOT EXISTS service_rate_pence integer NULL,
  ADD COLUMN IF NOT EXISTS service_rate_unit text NULL;

ALTER TABLE hammerex_xrated_products
  DROP CONSTRAINT IF EXISTS chk_calculator_override;
ALTER TABLE hammerex_xrated_products
  ADD CONSTRAINT chk_calculator_override CHECK (
    calculator_override IS NULL
    OR calculator_override IN (
      'auto', 'none',
      'paint', 'flooring', 'tiles', 'gravel', 'concrete', 'mortar',
      'bricks', 'plasterboard', 'insulation', 'decking', 'fencing',
      'paving', 'skirting', 'roof_tiles', 'wallpaper', 'render', 'turf'
    )
  );

ALTER TABLE hammerex_xrated_products
  DROP CONSTRAINT IF EXISTS chk_service_rate_unit;
ALTER TABLE hammerex_xrated_products
  ADD CONSTRAINT chk_service_rate_unit CHECK (
    service_rate_unit IS NULL
    OR service_rate_unit IN ('m2', 'linear_m', 'item', 'tonne', 'hour', 'day')
  );

COMMENT ON COLUMN hammerex_xrated_products.merchant_category IS
  'Structured category enum — drives the default calculator on the PDP. See src/lib/merchantCategories.ts.';
COMMENT ON COLUMN hammerex_xrated_products.calculator_override IS
  'Per-product calculator override. NULL or "auto" = use category default. "none" = hide. Or an explicit type.';
COMMENT ON COLUMN hammerex_xrated_products.service_trade_type IS
  'For kind=service rows — which trade is offering installation. Maps to the matching calculator.';
COMMENT ON COLUMN hammerex_xrated_products.service_rate_pence IS
  'Installer labour rate per unit (£/m², £/linear_m, etc.).';
COMMENT ON COLUMN hammerex_xrated_products.service_rate_unit IS
  'Unit for service_rate_pence. m2 | linear_m | item | tonne | hour | day.';
