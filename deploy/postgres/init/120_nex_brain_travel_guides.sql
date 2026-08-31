-- 120_nex_brain_travel_guides.sql · Philip 2026-08-28 · Task #49.
--
-- Brain schema for comprehensive travel guides. Populated by the 15 knowledge
-- walkers + future travel-specific walkers (Wikivoyage · OpenFlights · gov
-- tourism stats · Wikidata SPARQL).
--
-- Design principle (per NEX Intelligence Constitution):
--   Every row cites its source · confidence-scored · truth-class labelled ·
--   never fabricated. Retrieval preserves uncertainty ("I know X from source
--   Y" vs "I'm inferring Z").
--
-- These tables complement (do NOT replace):
--   · nex.knowledge_records  (generic knowledge-first storage, migration 041)
--   · nex.food_business etc. (commercial discovery, separate identity chain)
--   · data/nex-city-catalogue.json (518 cities · source of truth for geography)
--
-- Population sources (per doctrine · all free / OSS / CC-licensed):
--   · Wikipedia EN + ID    (already wired · migrations 41-42)
--   · Wikivoyage           (new · CC-BY-SA · traveler guides)
--   · Wikidata SPARQL      (new · CC0 · structured facts)
--   · OpenFlights          (new · ODC-BY · airport + route data)
--   · BPS + Kemenparekraf  (new · Indonesian gov tourism stats)
--
-- All populate scripts should MERGE-not-overwrite when source data changes ·
-- keep source_reference + last_verified_at + source_licence_terms per row.

BEGIN;

-- ============================================================================
-- brain_location  (canonical location facts · joins to city-catalogue)
-- One row per named location NEX cares about (city, kabupaten, district,
-- island, region). Enriched over time by knowledge walkers.
-- ============================================================================
CREATE TABLE IF NOT EXISTS nex.brain_location (
  location_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   text NOT NULL UNIQUE,
  canonical_name_en      text NOT NULL,
  canonical_name_id      text,
  kind                   text NOT NULL CHECK (kind IN ('province','city','kabupaten','kecamatan','island','region','destination')),
  parent_province        text,
  region                 text,
  coordinates_lat        numeric,
  coordinates_lng        numeric,
  population_est         integer,
  vibe_classification    text CHECK (vibe_classification IN ('holiday_resort','tourist_hub','business_hub','quiet','religious','historical','beach','mountain','urban','rural','unknown')),
  primary_language       text,
  timezone               text,
  source                 text,
  source_reference       text,
  source_licence_terms   text,
  first_discovered_at    timestamptz DEFAULT now(),
  last_verified_at       timestamptz DEFAULT now(),
  confidence             numeric DEFAULT 0.9
);
CREATE INDEX IF NOT EXISTS idx_brain_location_kind ON nex.brain_location(kind);
CREATE INDEX IF NOT EXISTS idx_brain_location_slug ON nex.brain_location(slug);

-- ============================================================================
-- brain_transport  (flights · routes · driving times · ferries)
-- Populated by OpenFlights + manual curation. Per Philip 2026-08-28:
--   "flight times from each and whats flights fly to these destinations".
-- ============================================================================
CREATE TABLE IF NOT EXISTS nex.brain_transport (
  transport_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_location_slug   text NOT NULL,
  dest_location_slug     text NOT NULL,
  mode                   text NOT NULL CHECK (mode IN ('flight','train','ferry','bus','drive','walk')),
  origin_airport_iata    text,
  dest_airport_iata      text,
  operators              jsonb,                   -- ["Garuda Indonesia", "Lion Air", ...]
  duration_minutes       integer,
  distance_km            numeric,
  frequency_note         text,                    -- "3x daily" · "weekly"
  price_range_idr        jsonb,                   -- { min, max, avg, currency, sampled_at }
  source                 text,
  source_reference       text,
  source_licence_terms   text,
  first_discovered_at    timestamptz DEFAULT now(),
  last_verified_at       timestamptz DEFAULT now(),
  confidence             numeric DEFAULT 0.7,
  UNIQUE (origin_location_slug, dest_location_slug, mode, source_reference)
);
CREATE INDEX IF NOT EXISTS idx_brain_transport_origin ON nex.brain_transport(origin_location_slug);
CREATE INDEX IF NOT EXISTS idx_brain_transport_dest ON nex.brain_transport(dest_location_slug);

-- ============================================================================
-- brain_seasons  (climate · tourist peak/off · monsoon · best-time-to-visit)
-- Per Philip 2026-08-28: "what times is tourist attraction season".
-- ============================================================================
CREATE TABLE IF NOT EXISTS nex.brain_seasons (
  season_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_slug          text NOT NULL,
  season_kind            text NOT NULL CHECK (season_kind IN ('dry','wet','peak_tourist','off_peak','shoulder','festival','religious','custom')),
  month_start            integer CHECK (month_start BETWEEN 1 AND 12),
  month_end              integer CHECK (month_end BETWEEN 1 AND 12),
  description_en         text,
  description_id         text,
  crowd_level            text CHECK (crowd_level IN ('very_high','high','moderate','low','very_low','unknown')),
  weather_notes          text,
  source                 text,
  source_reference       text,
  source_licence_terms   text,
  first_discovered_at    timestamptz DEFAULT now(),
  last_verified_at       timestamptz DEFAULT now(),
  confidence             numeric DEFAULT 0.7,
  UNIQUE (location_slug, season_kind, month_start, source_reference)
);
CREATE INDEX IF NOT EXISTS idx_brain_seasons_loc ON nex.brain_seasons(location_slug);

-- ============================================================================
-- brain_activities  (hotspots for surfing · diving · culture · hiking ·
-- nightlife · family · spiritual · food-tour · shopping)
-- Per Philip 2026-08-28: "where would be the hot spots for what types of
-- activities".
-- ============================================================================
CREATE TABLE IF NOT EXISTS nex.brain_activities (
  activity_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_slug          text NOT NULL,
  activity_kind          text NOT NULL CHECK (activity_kind IN ('surfing','diving','snorkeling','hiking','climbing','beach','nightlife','culture','spiritual','food_tour','shopping','family','wildlife','adventure','wellness','cycling','yoga','photography')),
  spot_name_en           text NOT NULL,
  spot_name_id           text,
  suitable_for           jsonb,                   -- ["beginner","intermediate","advanced"] or ["family","couples","solo","group"]
  best_months            jsonb,                   -- [4,5,6,7,8,9]
  price_range_idr        jsonb,                   -- { min, max, currency, sampled_at }
  description_en         text,
  description_id         text,
  source                 text,
  source_reference       text,
  source_licence_terms   text,
  first_discovered_at    timestamptz DEFAULT now(),
  last_verified_at       timestamptz DEFAULT now(),
  confidence             numeric DEFAULT 0.7
);
CREATE INDEX IF NOT EXISTS idx_brain_activities_loc ON nex.brain_activities(location_slug);
CREATE INDEX IF NOT EXISTS idx_brain_activities_kind ON nex.brain_activities(activity_kind);

-- ============================================================================
-- brain_accommodation_prices  (typical price ranges per location · budget /
-- mid / luxury). Per Philip 2026-08-28: "accommodation prices within the
-- area". Deliberately NOT specific hotels · that's food_business/accommodation_business.
-- ============================================================================
CREATE TABLE IF NOT EXISTS nex.brain_accommodation_prices (
  price_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_slug          text NOT NULL,
  tier                   text NOT NULL CHECK (tier IN ('backpacker','budget','mid_range','luxury','premium')),
  typical_min_idr        integer,
  typical_max_idr        integer,
  currency               text DEFAULT 'IDR',
  sample_size            integer,
  season_context         text,                    -- "peak" · "off_peak" · "average"
  source                 text,
  source_reference       text,
  source_licence_terms   text,
  sampled_at             timestamptz DEFAULT now(),
  confidence             numeric DEFAULT 0.6,
  UNIQUE (location_slug, tier, season_context, source_reference)
);
CREATE INDEX IF NOT EXISTS idx_brain_accom_prices_loc ON nex.brain_accommodation_prices(location_slug);

-- ============================================================================
-- brain_attractions  (temples · beaches · sights · national parks · museums)
-- Per Philip 2026-08-28: "tourist attractions and destinations".
-- ============================================================================
CREATE TABLE IF NOT EXISTS nex.brain_attractions (
  attraction_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_slug          text NOT NULL,
  attraction_kind        text NOT NULL CHECK (attraction_kind IN ('temple','beach','waterfall','mountain','national_park','museum','monument','historical_site','viewpoint','market','village','other')),
  name_en                text NOT NULL,
  name_id                text,
  coordinates_lat        numeric,
  coordinates_lng        numeric,
  entry_price_idr        jsonb,                   -- { adult, child, foreign_adult, foreign_child, sampled_at }
  opening_hours          jsonb,
  description_en         text,
  description_id         text,
  best_time_to_visit     text,
  source                 text,
  source_reference       text,
  source_licence_terms   text,
  first_discovered_at    timestamptz DEFAULT now(),
  last_verified_at       timestamptz DEFAULT now(),
  confidence             numeric DEFAULT 0.75
);
CREATE INDEX IF NOT EXISTS idx_brain_attractions_loc ON nex.brain_attractions(location_slug);
CREATE INDEX IF NOT EXISTS idx_brain_attractions_kind ON nex.brain_attractions(attraction_kind);

-- ============================================================================
-- brain_local_guide  (comprehensive per-location guide · one row per location
-- · aggregated content walker workers compile from other brain_* tables +
-- Wikivoyage · Wikipedia sections)
-- Per Philip 2026-08-28: "complete guides as if you lived within these
-- locations for your life".
-- ============================================================================
CREATE TABLE IF NOT EXISTS nex.brain_local_guide (
  guide_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_slug          text NOT NULL UNIQUE,
  local_intro_en         text,                    -- "What a local would tell a friend visiting for the first time"
  local_intro_id         text,
  what_to_do_en          text,
  what_to_do_id          text,
  what_to_eat_en         text,                    -- Local specialty dishes
  what_to_eat_id         text,
  cultural_notes_en      text,                    -- Etiquette · dress codes · dos & don'ts
  cultural_notes_id      text,
  safety_notes_en        text,
  safety_notes_id        text,
  language_tips_en       text,                    -- Local greetings · basic phrases
  language_tips_id       text,
  last_compiled_at       timestamptz DEFAULT now(),
  compiled_from_sources  jsonb,                   -- ["wikivoyage:jakarta", "wikipedia_en:jakarta", ...]
  confidence             numeric DEFAULT 0.7
);
CREATE INDEX IF NOT EXISTS idx_brain_guide_loc ON nex.brain_local_guide(location_slug);

-- ============================================================================
-- brain_traveler_rating  (aggregated ratings from public/CC sources ONLY)
-- Never scrape TripAdvisor/Google unless ToS-compliant. Currently sourced
-- from Wikivoyage traveler notes + Wikidata ratings.
-- ============================================================================
CREATE TABLE IF NOT EXISTS nex.brain_traveler_rating (
  rating_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_kind            text NOT NULL CHECK (entity_kind IN ('location','attraction','activity_spot')),
  entity_ref             text NOT NULL,           -- location_slug · attraction_id · activity_id
  rating_scale           numeric NOT NULL,        -- e.g. 5 (out of 5) · 10 (out of 10)
  rating_value           numeric NOT NULL,
  review_count           integer,
  positive_sentiment     text,                    -- "loved by families" · "quiet · romantic"
  negative_sentiment     text,
  source                 text NOT NULL,           -- "wikivoyage" · "wikidata" · "openstreetmap"
  source_reference       text,
  source_licence_terms   text,
  sampled_at             timestamptz DEFAULT now(),
  confidence             numeric DEFAULT 0.5
);
CREATE INDEX IF NOT EXISTS idx_brain_rating_entity ON nex.brain_traveler_rating(entity_kind, entity_ref);

COMMIT;
