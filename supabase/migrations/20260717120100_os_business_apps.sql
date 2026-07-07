-- XRatedTrade OS — Business App Content (V2 Ecosystem Foundation, part 2/5).
--
-- Every business becomes a complete standalone website — not just a
-- profile. This migration adds the content tables that populate the
-- 17 sub-routes of the business app:
--
--   /trade/[slug]                       → home
--   /trade/[slug]/services              → services (already exists as content)
--   /trade/[slug]/products              → products (already exists as shop)
--   /trade/[slug]/gallery               → gallery (from photos[])
--   /trade/[slug]/portfolio             ← NEW (this migration)
--   /trade/[slug]/reviews               → reviews (already exists)
--   /trade/[slug]/offers                ← NEW (this migration)
--   /trade/[slug]/trade-circle          → next migration (part 3)
--   /trade/[slug]/about                 → about (from bio + fields)
--   /trade/[slug]/contact               → contact (already exists)
--   /trade/[slug]/quote                 → quote (already exists)
--   /trade/[slug]/opening-times         ← NEW (this migration)
--   /trade/[slug]/coverage              ← NEW (this migration)
--   /trade/[slug]/certifications        ← NEW (this migration)
--   /trade/[slug]/downloads             → downloads (already exists as feature)
--   /trade/[slug]/videos                ← NEW (this migration)
--   /trade/[slug]/social                ← NEW (this migration)
--
-- Content-quantity limits (not feature limits) are enforced at the
-- application layer via tier lookup on os_business_listings.tier — no
-- schema constraint blocks a free merchant from having many rows, the
-- server route rejects writes above the limit.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. os_business_offers — time-limited promotions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  image_url text,
  cta_label text,
  cta_url text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_business_offers_business_idx
  ON os_business_offers (business_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS os_business_offers_valid_idx
  ON os_business_offers (valid_from, valid_to) WHERE active = true;

-- ---------------------------------------------------------------------
-- 2. os_business_portfolio_projects — past work case studies
--
-- These are DIFFERENT from os_projects. os_projects belong to a property
-- and represent live work. os_business_portfolio_projects are showcase
-- entries the merchant curates to display on their app. They may
-- reference a real os_projects row (if the work was tracked on-platform)
-- or be manually authored.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_portfolio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  hero_image_url text,
  gallery_urls text[] NOT NULL DEFAULT '{}',
  video_url text,
  completed_at date,
  property_type text,                       -- freeform: "3-bed semi", "detached"
  location_area text,                       -- non-exact for privacy: "Manchester"
  client_testimonial text,
  service_ids uuid[] NOT NULL DEFAULT '{}', -- links to services (soft ref)
  product_ids uuid[] NOT NULL DEFAULT '{}', -- links to products (soft ref)
  tags text[] NOT NULL DEFAULT '{}',
  display_order integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  linked_os_project_id uuid REFERENCES os_projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_business_portfolio_business_idx
  ON os_business_portfolio_projects (business_id, display_order)
  WHERE published = true;
CREATE INDEX IF NOT EXISTS os_business_portfolio_featured_idx
  ON os_business_portfolio_projects (business_id) WHERE featured = true;

-- ---------------------------------------------------------------------
-- 3. os_business_certifications — trade credentials
--
-- Gas Safe, NAPIT, NICEIC, CHAS, insurance certificates, trade body
-- memberships. Time-bounded — expiry drives the "Verified" badge.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,
  credential_name text NOT NULL,            -- "Gas Safe", "NAPIT", ...
  credential_number text,
  issuer text,                              -- issuing body
  scope text,                               -- what it covers
  issued_at date,
  expires_at date,
  verification_status text NOT NULL DEFAULT 'self_reported'
    CHECK (verification_status IN ('self_reported','verified','disputed','expired')),
  verified_at timestamptz,
  document_url text,                        -- scanned copy
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_business_certifications_business_idx
  ON os_business_certifications (business_id);
CREATE INDEX IF NOT EXISTS os_business_certifications_expiry_idx
  ON os_business_certifications (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_business_certifications_status_idx
  ON os_business_certifications (verification_status);

-- ---------------------------------------------------------------------
-- 4. os_business_downloads — spec sheets, brochures, price lists
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text,                           -- "pdf", "docx", "xlsx"
  file_size_bytes bigint,
  thumbnail_url text,
  download_count integer NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_business_downloads_business_idx
  ON os_business_downloads (business_id, display_order) WHERE published = true;

-- ---------------------------------------------------------------------
-- 5. os_business_videos — video content
--
-- Self-hosted URL OR embedded (YouTube / Vimeo). Kept generic so any
-- provider can be added without a schema change.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,                  -- direct or embed
  video_provider text,                      -- "youtube", "vimeo", "self", ...
  thumbnail_url text,
  duration_seconds integer,
  published_at timestamptz NOT NULL DEFAULT now(),
  display_order integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_business_videos_business_idx
  ON os_business_videos (business_id, display_order);

-- ---------------------------------------------------------------------
-- 6. os_business_coverage_areas — service map
--
-- Two representations supported:
--   • area_type = 'postcodes' — array of postcode prefixes (simple)
--   • area_type = 'polygon'   — GeoJSON polygon for a drawn service area
-- Premium unlocks polygon; Free tier uses postcode-only.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_coverage_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,
  area_type text NOT NULL CHECK (area_type IN ('postcodes','polygon')),
  postcodes text[] NOT NULL DEFAULT '{}',
  polygon_geojson jsonb,
  label text,                               -- "Manchester + 25 miles"
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS os_business_coverage_business_uk
  ON os_business_coverage_areas (business_id);

-- ---------------------------------------------------------------------
-- 7. os_business_opening_hours — weekly schedule
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_opening_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0 = Sunday
  opens_at time,
  closes_at time,
  is_closed boolean NOT NULL DEFAULT false,
  is_24_hour boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS os_business_opening_hours_bday_uk
  ON os_business_opening_hours (business_id, day_of_week);

-- ---------------------------------------------------------------------
-- 8. os_business_social_links — external social profile links
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,
  platform text NOT NULL,                   -- "instagram", "facebook", "tiktok", ...
  url text NOT NULL,
  handle text,
  verified boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_business_social_business_idx
  ON os_business_social_links (business_id, display_order);
CREATE UNIQUE INDEX IF NOT EXISTS os_business_social_business_platform_uk
  ON os_business_social_links (business_id, lower(platform));

-- ---------------------------------------------------------------------
-- 9. Touch triggers for updated_at
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_business_offers',
      'os_business_portfolio_projects',
      'os_business_certifications',
      'os_business_downloads',
      'os_business_videos',
      'os_business_coverage_areas',
      'os_business_opening_hours',
      'os_business_social_links'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 10. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_business_offers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_portfolio_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_certifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_downloads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_videos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_coverage_areas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_opening_hours       ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_social_links        ENABLE ROW LEVEL SECURITY;

COMMIT;
