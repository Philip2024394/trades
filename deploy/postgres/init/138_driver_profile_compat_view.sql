-- 138_driver_profile_compat_view.sql · Philip 2026-08-29
--
-- Extends the deprecated `nex.driver_profile` compatibility view so any
-- LEGACY READERS still see `is_available` and `price_per_service_idr`,
-- which were added to nex.provider_profile after the driver->provider
-- rename and were not exposed by the original compat view (lossy).
--
-- CANONICAL WRITES: new code writes `nex.provider_profile` directly.
-- The compat view is READ-ONLY for legacy callers during the one-release
-- migration window (mobility doctrine v5). After that window, DROP.
--
-- Doctrine anchors:
--   · project_nex_mobility_doctrine_2026_08_29 · Provider not Driver
--   · Philip 2026-08-29: shims one release only · then remove

DROP VIEW IF EXISTS nex.driver_profile;

CREATE VIEW nex.driver_profile AS
  SELECT
    provider_id            AS driver_id,
    learner_ref,
    full_name,
    whatsapp_e164,
    photo_url,
    bike_slug,
    bike_year,
    bike_color_hex,
    plate,
    city,
    status,
    is_available,
    price_per_service_idr,
    rating_avg,
    rating_count,
    registered_at,
    approved_at,
    updated_at,
    secondary_language,
    provides_raincoat
  FROM nex.provider_profile;

COMMENT ON VIEW nex.driver_profile IS
  'DEPRECATED · compatibility only · new code writes nex.provider_profile directly · '
  'one-release migration window · Philip 2026-08-29 · mobility doctrine v5';

-- Explicit REVOKE would go here in a multi-role prod setup. In dev the
-- write ban is enforced by convention + the code audit (task #8) rather
-- than by DB permissions, since the connecting role owns the schema.
