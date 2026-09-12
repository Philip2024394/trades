-- Founder 2026-09-10 · Broad marketing-ready business lead directory.
--
-- Rationale: nex.service_business is CHECK-constrained to 6 category
-- slugs (gyms, salons, dentists, opticians, pharmacies, car-repair).
-- nex.food_business + nex.accommodation_business own their verticals.
-- Everything else (retail chains, banks, malls, telcos, wholesalers,
-- courier centres) had no home — 1000+ Lab rows were stranded.
--
-- This table is the general destination for Lab-verified business rows
-- that don't fit a specialist vertical. Broad category slug (no CHECK
-- constraint · new categories can be added without a migration).
--
-- Rows flow: nex_lab_business.harvest_raw → verified → promotion →
--            nex.business_lead_directory (HMAC-signed by founder).
--
-- Marketing status ladder (from service_business, matches nex-hq):
--   discovered → qualified → contactable → marketing_ready →
--   invited → trial → paid → declined

CREATE TABLE IF NOT EXISTS nex.business_lead_directory (
  internal_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_listing_ref    TEXT NOT NULL UNIQUE
                        CHECK (public_listing_ref ~ '^#BL-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$'),
  business_name         TEXT NOT NULL,
  category_slug         TEXT NOT NULL, -- e.g. "retail-apparel", "services-laundry", "retail-electronics"
  category_group        TEXT NOT NULL, -- "retail" | "food-beverage" | "services" | "health" | "accommodation" | "other"
  categories            TEXT[] NOT NULL DEFAULT '{}',
  address               TEXT,
  city                  TEXT NOT NULL,
  district              TEXT,
  province              TEXT,
  country               TEXT NOT NULL DEFAULT 'ID',
  coordinates_lng       NUMERIC,
  coordinates_lat       NUMERIC,
  phone                 TEXT,
  whatsapp_number       TEXT,
  email                 TEXT,
  additional_emails     TEXT[] DEFAULT '{}',
  website               TEXT,
  public_social_links   JSONB,
  source                TEXT NOT NULL,
  source_reference      TEXT,
  source_licence_terms  TEXT,
  source_ingested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_updated_at     TIMESTAMPTZ,
  last_verified_at      TIMESTAMPTZ,
  verification_source   TEXT,
  dedupe_hash           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'listed'
                        CHECK (status IN ('listed', 'archived', 'suspended')),
  claimed               BOOLEAN NOT NULL DEFAULT FALSE,
  verified              BOOLEAN NOT NULL DEFAULT FALSE,
  visibility            TEXT NOT NULL DEFAULT 'public'
                        CHECK (visibility IN ('public', 'admin_only', 'hidden')),
  commercial_status     TEXT NOT NULL DEFAULT 'discovered'
                        CHECK (commercial_status IN ('discovered','qualified','contactable','marketing_ready','attempted','engaged','invited','trial','paid','declined')),
  qualification_reason  JSONB,
  qualified_at          TIMESTAMPTZ,
  contactable_at        TIMESTAMPTZ,
  marketing_ready_at    TIMESTAMPTZ,
  last_marketing_action_at TIMESTAMPTZ,
  next_eligible_action_at  TIMESTAMPTZ,
  contact_opt_out       BOOLEAN NOT NULL DEFAULT FALSE,
  contact_opt_out_at    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_bld_dedupe ON nex.business_lead_directory (dedupe_hash);
CREATE INDEX IF NOT EXISTS ix_bld_city ON nex.business_lead_directory (city);
CREATE INDEX IF NOT EXISTS ix_bld_category_group ON nex.business_lead_directory (category_group);
CREATE INDEX IF NOT EXISTS ix_bld_commercial_status ON nex.business_lead_directory (commercial_status);
CREATE INDEX IF NOT EXISTS ix_bld_contactable ON nex.business_lead_directory (contactable_at) WHERE contact_opt_out = FALSE;
CREATE INDEX IF NOT EXISTS ix_bld_email ON nex.business_lead_directory (email) WHERE email IS NOT NULL;

-- Provenance (mirrors accommodation_business_field_provenance pattern)
CREATE TABLE IF NOT EXISTS nex.business_lead_directory_field_provenance (
  provenance_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_internal_id  UUID NOT NULL REFERENCES nex.business_lead_directory(internal_id) ON DELETE CASCADE,
  field_name        TEXT NOT NULL,
  field_value       JSONB,
  source_layer      TEXT NOT NULL, -- 'osm' | 'wikidata' | 'website_enrich' | 'gov_data' | 'instagram_meta' | 'admin_input'
  source_reference  TEXT,
  confidence        NUMERIC(3,2),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  cycle_run_id      UUID
);

CREATE INDEX IF NOT EXISTS ix_bld_prov_lead ON nex.business_lead_directory_field_provenance (lead_internal_id);
CREATE INDEX IF NOT EXISTS ix_bld_prov_layer ON nex.business_lead_directory_field_provenance (source_layer);

-- Marketing outreach opt-out registry (compliance · UU PDP 27/2022)
CREATE TABLE IF NOT EXISTS nex.business_lead_opt_out (
  opt_out_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT,
  phone           TEXT,
  whatsapp        TEXT,
  reason          TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by     TEXT NOT NULL, -- 'unsubscribe_link' | 'admin' | 'reply_stop' | 'user_request'
  CHECK (email IS NOT NULL OR phone IS NOT NULL OR whatsapp IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bld_opt_out_email ON nex.business_lead_opt_out (LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_bld_opt_out_phone ON nex.business_lead_opt_out (phone) WHERE phone IS NOT NULL;
