-- Phase A of the Nearby Installers pattern.
--
-- `service_category` — set on service-kind product rows to tag what
-- kind of install the trade offers ("door_install", "tap_fitting",
-- "pat_testing", …). Enum is enforced in code (src/lib/serviceCategories.ts)
-- so we can grow the list without another migration.
--
-- `install_service_category` — set on physical product rows to declare
-- "customers who buy this product typically need this kind of install".
-- The PDP uses this to query nearby services in the same category and
-- render an "Independent local trades" strip.
--
-- Both nullable. The Independent-local-trades strip renders only when
-- both sides opt in — the product declares an install category AND
-- there's ≥1 live service tagged with that category in the same country.

ALTER TABLE hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS service_category text
    CHECK (service_category IS NULL OR char_length(service_category) BETWEEN 1 AND 60);

ALTER TABLE hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS install_service_category text
    CHECK (install_service_category IS NULL OR char_length(install_service_category) BETWEEN 1 AND 60);

-- Index the read path — matching lookups are always
-- (service_category, listing_country) or (service_category alone).
CREATE INDEX IF NOT EXISTS xrated_products_service_category_idx
  ON hammerex_xrated_products (service_category)
  WHERE service_category IS NOT NULL;
