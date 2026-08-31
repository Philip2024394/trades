-- 130_nex_bike_model_and_driver.sql · Philip 2026-08-29
--
-- Bike taxonomy + driver registration schema for NEX ride-hail directory.
--
-- Doctrine anchors:
--   · project_nex_data_safety_no_localstorage_2026_08_28.md (server-side only)
--   · project_nex_operating_layer_doctrine_2026_08_27.md (NEX-owned identity)
--   · Driver data is PII · PDP-ID UU 27/2022 · must be accessible + deletable

-- Bike taxonomy · seeded from data/nex-bike-taxonomy.json (50 rows).
CREATE TABLE IF NOT EXISTS nex.bike_model (
  slug            text PRIMARY KEY,
  brand           text NOT NULL,
  model           text NOT NULL,
  year_range      text NOT NULL,
  cc              integer NOT NULL,      -- 0 = electric
  category        text NOT NULL CHECK (category IN
                    ('matic','maxi','sport','commuter','bebek','adventure','retro','electric')),
  base_image      text NOT NULL,          -- relative path under /nex/bikes/
  base_color      text NOT NULL,
  common_colors   text[] NOT NULL DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bike_model_brand    ON nex.bike_model (brand);
CREATE INDEX IF NOT EXISTS idx_bike_model_category ON nex.bike_model (category);
CREATE INDEX IF NOT EXISTS idx_bike_model_cc       ON nex.bike_model (cc);

-- Driver profile · PII · protected. NEVER in localStorage.
CREATE TABLE IF NOT EXISTS nex.driver_profile (
  driver_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_ref          text UNIQUE,               -- nex_id:{n} or device:{uuid}
  full_name            text NOT NULL,
  whatsapp_e164        text NOT NULL,             -- +62..., validated in API
  photo_url            text,                       -- owner-uploaded portrait
  bike_slug            text NOT NULL REFERENCES nex.bike_model(slug),
  bike_year            integer NOT NULL CHECK (bike_year BETWEEN 1980 AND 2030),
  bike_color_hex       text NOT NULL CHECK (bike_color_hex ~ '^#[0-9a-fA-F]{6}$'),
  plate                text NOT NULL,
  city                 text NOT NULL,
  status               text NOT NULL DEFAULT 'pending_review'
                        CHECK (status IN ('pending_review','active','suspended','removed')),
  rating_avg           numeric(3,2),               -- populated by rating system later
  rating_count         integer NOT NULL DEFAULT 0,
  registered_at        timestamptz NOT NULL DEFAULT now(),
  approved_at          timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_profile_city_status ON nex.driver_profile (city, status);
CREATE INDEX IF NOT EXISTS idx_driver_profile_bike_slug   ON nex.driver_profile (bike_slug);
