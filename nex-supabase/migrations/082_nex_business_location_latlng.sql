-- Bridge 25c · Business latitude / longitude for bike-delivery
-- distance estimates · sealed 2026-09-28.
-- ------------------------------------------------------------
-- Two nullable numeric columns · restaurants + shops geo-code their
-- pickup point once (or NEX auto-geocodes their city + address later)
-- and the cart page uses them + the buyer's browser geolocation to
-- compute a bike-delivery estimate at Gojek / Grab / Maxim standard
-- Indonesian rates.
--
-- Coordinates are decimal degrees · WGS84. NULL means "not disclosed"
-- and the cart falls back to "chat with the seller to confirm delivery".
--
-- Rollback:
--   BEGIN;
--     ALTER TABLE nex_business
--       DROP COLUMN IF EXISTS location_lat,
--       DROP COLUMN IF EXISTS location_lng;
--     DELETE FROM nex_migration_history WHERE version = '082';
--   COMMIT;

BEGIN;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS location_lat double precision;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS location_lng double precision;

COMMENT ON COLUMN public.nex_business.location_lat IS
  'WGS84 latitude of the seller pickup point · used by the cart page to estimate bike-delivery distance / fare (Gojek / Grab / Maxim rates). NULL = not disclosed · cart falls back to "confirm in chat".';
COMMENT ON COLUMN public.nex_business.location_lng IS
  'WGS84 longitude of the seller pickup point · pair with location_lat.';

INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '082',
    'Bridge 25c · nex_business.location_lat + location_lng for bike-delivery estimator',
    'Founder-authorised 2026-09-28. Enables client-side distance calc against browser geolocation · flat Indonesian bike rate (base Rp 9,000 + Rp 2,500 per km).'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
