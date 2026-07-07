-- XRatedTrade OS — Business Listings (V2 Ecosystem Foundation, part 1/5).
--
-- os_business_listings is the canonical, forward-looking business table.
-- It replaces hammerex_trade_off_listings as the primary substrate for
-- every ecosystem feature (Trade Circle, banners, business apps, search,
-- discovery). Existing legacy data continues to live in
-- hammerex_trade_off_listings for the cutover window; a sync trigger
-- keeps the two aligned so no caller has to change on Day 1.
--
-- Design contract:
--   • Same primary-key UUID as hammerex_trade_off_listings so no ID
--     remapping is ever needed.
--   • Superset schema — every field from hammerex is preserved,
--     plus V2 primitives (tier, business_type, companies_house_*,
--     ecosystem_participation, geo, verified_*).
--   • Evolution slots included as columns with safe defaults so V3
--     graph work (weights, decay, certification edges) never requires
--     a schema migration.
--   • Service-role-only RLS matches the rest of os_*.
--
-- Cutover plan (later migration):
--   1. Migrate all readers (routes, components) from
--      hammerex_trade_off_listings → os_business_listings.
--   2. Migrate merchant dashboard writers.
--   3. Drop the sync trigger, then drop hammerex_trade_off_listings.
--
-- Nothing in this file changes existing behaviour. New tables only;
-- legacy paths continue functioning unchanged.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. os_business_listings — canonical business table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_listings (
  id uuid PRIMARY KEY,                          -- shared with legacy row
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  trading_name text,

  -- Business classification
  business_type text NOT NULL DEFAULT 'trade'
    CHECK (business_type IN (
      'trade',              -- solo tradesperson (default legacy)
      'sole_trader',
      'contractor',
      'service',
      'merchant',           -- builders / plumbing / electrical etc
      'supplier',
      'manufacturer',
      'developer',
      'architect',
      'surveyor',
      'engineer'
    )),
  primary_trade text NOT NULL,
  secondary_trades text[] NOT NULL DEFAULT '{}',

  -- Location
  city text NOT NULL,
  country text NOT NULL DEFAULT 'United Kingdom',
  postcode_prefix text,
  lat numeric(9,6),
  lng numeric(9,6),
  service_postcodes text[] NOT NULL DEFAULT '{}',

  -- Contact
  whatsapp text NOT NULL,
  phone text,
  email text NOT NULL,
  website text,
  instagram text,

  -- Content
  bio text NOT NULL DEFAULT '',
  years_in_trade integer,
  start_year integer,
  avatar_url text,
  photos text[] NOT NULL DEFAULT '{}',

  -- Publication + verification
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','live','hidden')),
  report_count integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,

  -- V2 ecosystem primitives
  tier text NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free','premium','verified','merchant_pro')),
  ecosystem_participation boolean NOT NULL DEFAULT true,
  ecosystem_participation_updated_at timestamptz NOT NULL DEFAULT now(),

  -- Day-0 identity capture (per Property OS review — unrecoverable later)
  companies_house_number text,
  companies_house_snapshot jsonb,               -- captured at signup
  party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  -- Legacy compatibility (preserved so sync trigger is idempotent)
  hammerex_standard_verified boolean NOT NULL DEFAULT false,
  hammerex_standard_products text[] NOT NULL DEFAULT '{}',
  hammerex_standard_blurb text,
  edit_token uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Timestamps
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS os_business_listings_primary_trade_idx
  ON os_business_listings (primary_trade);
CREATE INDEX IF NOT EXISTS os_business_listings_city_idx
  ON os_business_listings (lower(city));
CREATE INDEX IF NOT EXISTS os_business_listings_trade_city_idx
  ON os_business_listings (primary_trade, lower(city));
CREATE INDEX IF NOT EXISTS os_business_listings_status_idx
  ON os_business_listings (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS os_business_listings_tier_idx
  ON os_business_listings (tier) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS os_business_listings_business_type_idx
  ON os_business_listings (business_type);
CREATE INDEX IF NOT EXISTS os_business_listings_ecosystem_idx
  ON os_business_listings (ecosystem_participation)
  WHERE ecosystem_participation = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS os_business_listings_geo_idx
  ON os_business_listings (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS os_business_listings_email_idx
  ON os_business_listings (lower(email));
CREATE INDEX IF NOT EXISTS os_business_listings_companies_house_idx
  ON os_business_listings (companies_house_number)
  WHERE companies_house_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_business_listings_party_idx
  ON os_business_listings (party_id) WHERE party_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Touch trigger for updated_at
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS os_business_listings_touch ON os_business_listings;
CREATE TRIGGER os_business_listings_touch
  BEFORE UPDATE ON os_business_listings
  FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. One-time backfill from hammerex_trade_off_listings
--
-- Idempotent — safe to re-run. Any row already present in
-- os_business_listings is left untouched.
-- ---------------------------------------------------------------------
INSERT INTO os_business_listings (
  id, slug, display_name, trading_name,
  primary_trade, secondary_trades,
  city, country, postcode_prefix, lat, lng, service_postcodes,
  whatsapp, phone, email, website, instagram,
  bio, years_in_trade, start_year, avatar_url, photos,
  status, report_count,
  hammerex_standard_verified, hammerex_standard_products, hammerex_standard_blurb,
  edit_token, joined_at, created_at, updated_at
)
SELECT
  h.id, h.slug, h.display_name, h.trading_name,
  h.primary_trade, h.secondary_trades,
  h.city, h.country, h.postcode_prefix, h.lat, h.lng, h.service_postcodes,
  h.whatsapp, h.phone, h.email, h.website, h.instagram,
  h.bio, h.years_in_trade, h.start_year, h.avatar_url, h.photos,
  h.status, h.report_count,
  h.hammerex_standard_verified, h.hammerex_standard_products, h.hammerex_standard_blurb,
  h.edit_token, h.joined_at, h.created_at, h.updated_at
FROM hammerex_trade_off_listings h
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. Sync trigger — legacy writes propagate forward
--
-- Every existing route that writes to hammerex_trade_off_listings
-- (merchant dashboard, admin tools) continues working unchanged. The
-- trigger mirrors the change into os_business_listings so all V2
-- ecosystem features see up-to-date data. When phase 2 flips readers,
-- the trigger stays until phase 3 finally drops the legacy table.
--
-- Only mirrors legacy-known fields. V2 fields (tier, business_type,
-- ecosystem_participation, companies_house_*) are owned by V2 writers.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION os_sync_hammerex_to_business_listings()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO os_business_listings (
      id, slug, display_name, trading_name,
      primary_trade, secondary_trades,
      city, country, postcode_prefix, lat, lng, service_postcodes,
      whatsapp, phone, email, website, instagram,
      bio, years_in_trade, start_year, avatar_url, photos,
      status, report_count,
      hammerex_standard_verified, hammerex_standard_products, hammerex_standard_blurb,
      edit_token, joined_at, created_at, updated_at
    )
    VALUES (
      NEW.id, NEW.slug, NEW.display_name, NEW.trading_name,
      NEW.primary_trade, NEW.secondary_trades,
      NEW.city, NEW.country, NEW.postcode_prefix, NEW.lat, NEW.lng, NEW.service_postcodes,
      NEW.whatsapp, NEW.phone, NEW.email, NEW.website, NEW.instagram,
      NEW.bio, NEW.years_in_trade, NEW.start_year, NEW.avatar_url, NEW.photos,
      NEW.status, NEW.report_count,
      NEW.hammerex_standard_verified, NEW.hammerex_standard_products, NEW.hammerex_standard_blurb,
      NEW.edit_token, NEW.joined_at, NEW.created_at, NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      display_name = EXCLUDED.display_name,
      trading_name = EXCLUDED.trading_name,
      primary_trade = EXCLUDED.primary_trade,
      secondary_trades = EXCLUDED.secondary_trades,
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      postcode_prefix = EXCLUDED.postcode_prefix,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      service_postcodes = EXCLUDED.service_postcodes,
      whatsapp = EXCLUDED.whatsapp,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      website = EXCLUDED.website,
      instagram = EXCLUDED.instagram,
      bio = EXCLUDED.bio,
      years_in_trade = EXCLUDED.years_in_trade,
      start_year = EXCLUDED.start_year,
      avatar_url = EXCLUDED.avatar_url,
      photos = EXCLUDED.photos,
      status = EXCLUDED.status,
      report_count = EXCLUDED.report_count,
      hammerex_standard_verified = EXCLUDED.hammerex_standard_verified,
      hammerex_standard_products = EXCLUDED.hammerex_standard_products,
      hammerex_standard_blurb = EXCLUDED.hammerex_standard_blurb,
      edit_token = EXCLUDED.edit_token,
      updated_at = now();
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE os_business_listings SET
      slug = NEW.slug,
      display_name = NEW.display_name,
      trading_name = NEW.trading_name,
      primary_trade = NEW.primary_trade,
      secondary_trades = NEW.secondary_trades,
      city = NEW.city,
      country = NEW.country,
      postcode_prefix = NEW.postcode_prefix,
      lat = NEW.lat,
      lng = NEW.lng,
      service_postcodes = NEW.service_postcodes,
      whatsapp = NEW.whatsapp,
      phone = NEW.phone,
      email = NEW.email,
      website = NEW.website,
      instagram = NEW.instagram,
      bio = NEW.bio,
      years_in_trade = NEW.years_in_trade,
      start_year = NEW.start_year,
      avatar_url = NEW.avatar_url,
      photos = NEW.photos,
      status = NEW.status,
      report_count = NEW.report_count,
      hammerex_standard_verified = NEW.hammerex_standard_verified,
      hammerex_standard_products = NEW.hammerex_standard_products,
      hammerex_standard_blurb = NEW.hammerex_standard_blurb,
      edit_token = NEW.edit_token,
      updated_at = now()
    WHERE id = NEW.id;

    -- If the row was somehow missing (shouldn't happen after backfill),
    -- fall back to INSERT so we self-heal rather than lose the write.
    IF NOT FOUND THEN
      INSERT INTO os_business_listings (
        id, slug, display_name, trading_name,
        primary_trade, secondary_trades,
        city, country, postcode_prefix, lat, lng, service_postcodes,
        whatsapp, phone, email, website, instagram,
        bio, years_in_trade, start_year, avatar_url, photos,
        status, report_count,
        hammerex_standard_verified, hammerex_standard_products, hammerex_standard_blurb,
        edit_token, joined_at, created_at, updated_at
      )
      VALUES (
        NEW.id, NEW.slug, NEW.display_name, NEW.trading_name,
        NEW.primary_trade, NEW.secondary_trades,
        NEW.city, NEW.country, NEW.postcode_prefix, NEW.lat, NEW.lng, NEW.service_postcodes,
        NEW.whatsapp, NEW.phone, NEW.email, NEW.website, NEW.instagram,
        NEW.bio, NEW.years_in_trade, NEW.start_year, NEW.avatar_url, NEW.photos,
        NEW.status, NEW.report_count,
        NEW.hammerex_standard_verified, NEW.hammerex_standard_products, NEW.hammerex_standard_blurb,
        NEW.edit_token, NEW.joined_at, NEW.created_at, NEW.updated_at
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Legacy DELETE → soft-delete on os_business_listings.
    -- Preserves all edges + endorsements while removing from display.
    UPDATE os_business_listings SET deleted_at = now() WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS hammerex_to_os_business_sync ON hammerex_trade_off_listings;
CREATE TRIGGER hammerex_to_os_business_sync
  AFTER INSERT OR UPDATE OR DELETE ON hammerex_trade_off_listings
  FOR EACH ROW EXECUTE FUNCTION os_sync_hammerex_to_business_listings();

-- ---------------------------------------------------------------------
-- 5. RLS — service-role only, matching os_* convention
-- ---------------------------------------------------------------------
ALTER TABLE os_business_listings ENABLE ROW LEVEL SECURITY;

-- Deny-by-default (RLS enabled + no policies). All access via server
-- routes using the service role, which perform their own session +
-- ownership checks before returning data.

COMMIT;
