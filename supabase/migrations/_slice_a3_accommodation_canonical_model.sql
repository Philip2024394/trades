-- NEX Workforce v2 · Slice A3 · Accommodation Canonical Model Migration
-- Philip 2026-09-07 · FOUNDER AUTHORIZATION
-- ─────────────────────────────────────────────────────────────────────────────
-- A3 scope · canonical model completeness (per doctrine §5-§12):
--
--   1. Source-classification preservation (source_type + source_subtype)
--      · so the raw source classification is never lost after canonical mapping
--   2. Structural language metadata (name_source_language + name_original_text)
--      · so translations don't destroy source text (doctrine §12)
--   3. First-class Room Type entity (nex.accommodation_room_type)
--      · so "Hotel ABC → Standard / Deluxe / Family" is representable
--      · unit-level records DEFERRED per Founder Q4 resolution
--   4. Controlled type-specific attribute overlay
--      (nex.accommodation_attribute_vocabulary + nex.accommodation_attribute)
--      · polymorphic value-type discriminator: TEXT / NUMBER / BOOLEAN / TERNARY / CONTROLLED_ARRAY
--      · vocabulary-driven, NOT arbitrary JSON garbage
--      · attribute_name FKed to vocabulary composite (attribute_name, value_type)
--      · designed for A5 evidence attachment via source_evidence_id column
--   5. Persister function extended to preserve source_type + source_subtype +
--      name_source_language + name_original_text on every write
--
-- A3 is:
--   · additive (no column drops, no data migration)
--   · backward-compatible (existing 9,203 accommodation rows unchanged)
--   · idempotent (all steps IF NOT EXISTS / DO NOTHING)
--   · reversible (rollback documented at bottom)
--
-- A3 does NOT:
--   · widen category CHECK enum (Founder Q2: middle path · preserve via source_type/subtype)
--   · create accommodation_room_unit / physical-room records (Founder Q4: DEFER)
--   · reinvent nex.business_image (universal polymorphic · migration 080)
--   · reinvent nex.business_knowledge (A5 evidence engine · migration 089)
--   · reinvent field_provenance / enrichment_evidence (078)
--   · activate acquisition · seed cities · create job registry rows
--   · touch Project B · touch P1 · touch Scheduled Task
--   · implement A4/A5/A6/A7 features

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 0 · Preflight · fail-closed on missing A2 dependency
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'nex' AND table_name = 'accommodation_business') THEN
    RAISE EXCEPTION 'A3 preflight FAIL · nex.accommodation_business missing · apply 078 first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'nex_workforce' AND p.proname = 'persist_to_accommodation_business') THEN
    RAISE EXCEPTION 'A3 preflight FAIL · A2 persister missing · apply _slice_a2_accommodation_business_persister.sql first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_persister_accommodation_business') THEN
    RAISE EXCEPTION 'A3 preflight FAIL · nex_workforce_persister_accommodation_business role missing · apply A2 first';
  END IF;
END $body$;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 1 · Additive columns on accommodation_business
--
-- source_type + source_subtype:
--   Preserve the raw source classification (e.g. OSM tourism=chalet, hotel=villa)
--   BEFORE canonical mapping to the 8-value category enum. Founder Q2:
--   "The raw/source classification must survive normalization even when
--    canonical classification maps it elsewhere."
--
-- name_source_language + name_original_text:
--   Doctrine §12 language intelligence. Preserve original source text so
--   normalization/translation never destroys it. NULL for legacy rows.
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE nex.accommodation_business
  ADD COLUMN IF NOT EXISTS source_type          TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_subtype       TEXT NULL,
  ADD COLUMN IF NOT EXISTS name_source_language TEXT NULL,
  ADD COLUMN IF NOT EXISTS name_original_text   TEXT NULL;

COMMENT ON COLUMN nex.accommodation_business.source_type IS
  'Slice A3 · raw source classification (e.g. OSM tourism value hotel/chalet/guest_house). Preserved before canonical mapping so source distinction is never lost.';
COMMENT ON COLUMN nex.accommodation_business.source_subtype IS
  'Slice A3 · raw source sub-classification (e.g. OSM hotel=villa or guest_house=homestay). NULL when no subtype tag was present.';
COMMENT ON COLUMN nex.accommodation_business.name_source_language IS
  'Slice A3 · ISO 639-1 language code of business_name where the source provides evidence (e.g. OSM name matches name:id → ''id''). NULL when unknown. Never guessed.';
COMMENT ON COLUMN nex.accommodation_business.name_original_text IS
  'Slice A3 · raw source name preserved before any normalization. Populated on every persister write. NULL for legacy pre-A3 rows.';

CREATE INDEX IF NOT EXISTS idx_accommodation_business_source_type
  ON nex.accommodation_business (source_type) WHERE source_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accommodation_business_source_subtype
  ON nex.accommodation_business (source_subtype) WHERE source_subtype IS NOT NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 2 · Room Type entity
--
-- First-class Room Type per doctrine §11. Property → Room Type. Physical
-- units DEFERRED per Founder Q4.
--
-- Identity: (property_ref, source, source_reference) UNIQUE — the same source
-- may describe multiple room types for one property; two sources may describe
-- the "same" room type but A4 entity resolution (future slice) handles the
-- cross-source merge.
--
-- Language metadata is per-row: source_language captures what language the
-- source_name is in, so a Bahasa Indonesia "Kamar Deluxe" and an English
-- "Deluxe Room" don't get silently collapsed.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.accommodation_room_type (
  room_type_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref         TEXT NOT NULL REFERENCES nex.accommodation_business(public_listing_ref) ON DELETE CASCADE,

  -- Source identity (preserves what the source called this room type)
  source               TEXT NOT NULL,
  source_reference     TEXT NOT NULL,
  source_name          TEXT,
  source_language      TEXT,

  -- Canonical
  canonical_name       TEXT NOT NULL,
  normalized_slug      TEXT NOT NULL CHECK (normalized_slug ~ '^[a-z0-9][a-z0-9-]*$'),
  description          TEXT,
  description_language TEXT,

  -- Occupancy · nullable · never invented
  occupancy_adults     INTEGER CHECK (occupancy_adults IS NULL OR occupancy_adults >= 0),
  occupancy_children   INTEGER CHECK (occupancy_children IS NULL OR occupancy_children >= 0),
  beds_count           INTEGER CHECK (beds_count IS NULL OR beds_count >= 0),
  bed_configuration    TEXT,
  room_size_sqm        NUMERIC CHECK (room_size_sqm IS NULL OR room_size_sqm > 0),

  -- Provenance
  source_evidence_id   TEXT,
  source_retrieved_at  TIMESTAMPTZ,
  discovered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at         TIMESTAMPTZ,
  worker_id            TEXT,
  cycle_run_id         UUID REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           TEXT,

  UNIQUE (property_ref, source, source_reference)
);

CREATE INDEX IF NOT EXISTS idx_accommodation_room_type_property
  ON nex.accommodation_room_type (property_ref);
CREATE INDEX IF NOT EXISTS idx_accommodation_room_type_source
  ON nex.accommodation_room_type (source, source_reference);

COMMENT ON TABLE nex.accommodation_room_type IS
  'Slice A3 · first-class room-type entity. Property → Room Type relationship. Physical unit records DEFERRED (Founder Q4). Language metadata per row preserves source terminology.';

CREATE OR REPLACE FUNCTION nex.trg_accommodation_room_type_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accommodation_room_type_touch_updated_at ON nex.accommodation_room_type;
CREATE TRIGGER trg_accommodation_room_type_touch_updated_at
  BEFORE UPDATE ON nex.accommodation_room_type
  FOR EACH ROW EXECUTE FUNCTION nex.trg_accommodation_room_type_touch_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- § 3 · Controlled attribute vocabulary
--
-- Founder Q3 explicit rule: attributes must be controlled, NOT arbitrary JSON.
-- vocabulary table lists every valid (attribute_name, value_type) pair. The
-- accommodation_attribute rows then FK to this pair — the DB itself refuses
-- to accept a mismatched value_type.
--
-- applies_to_types: array of canonical categories this attribute is defined
-- for. Wildcard '*' means "applies to all accommodation types" (common core).
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.accommodation_attribute_vocabulary (
  attribute_name          TEXT NOT NULL,
  value_type              TEXT NOT NULL
                            CHECK (value_type IN ('TEXT','NUMBER','BOOLEAN','TERNARY','CONTROLLED_ARRAY')),
  applies_to_types        TEXT[] NOT NULL CHECK (array_length(applies_to_types, 1) >= 1),
  description             TEXT NOT NULL,
  controlled_array_values TEXT[],
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (attribute_name),
  UNIQUE (attribute_name, value_type),
  CONSTRAINT controlled_array_values_only_for_controlled_array CHECK (
    (value_type = 'CONTROLLED_ARRAY' AND controlled_array_values IS NOT NULL AND cardinality(controlled_array_values) >= 1)
    OR (value_type <> 'CONTROLLED_ARRAY' AND controlled_array_values IS NULL)
  )
);

COMMENT ON TABLE nex.accommodation_attribute_vocabulary IS
  'Slice A3 · controlled attribute vocabulary. Every accommodation_attribute row FKs to (attribute_name, value_type) here. Founder Q3 explicit: not arbitrary JSON.';

-- ═════════════════════════════════════════════════════════════════════════════
-- § 4 · Attribute overlay
--
-- Polymorphic structural attribute layer with strict value-type discriminator
-- and vocabulary FK. Five value slots · exactly one non-NULL per row.
--
-- Provenance columns (source, source_evidence_id, observed_at, raw_value,
-- source_language) match the A2 persister boundary so A5 evidence attachment
-- happens through source_evidence_id → nex_workforce.evidence_record.
--
-- room_type_id is NULLABLE: property-level attributes have NULL, room-level
-- attributes have a valid FK.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.accommodation_attribute (
  attribute_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref         TEXT NOT NULL REFERENCES nex.accommodation_business(public_listing_ref) ON DELETE CASCADE,
  room_type_id         UUID REFERENCES nex.accommodation_room_type(room_type_id) ON DELETE CASCADE,
  attribute_name       TEXT NOT NULL,
  value_type           TEXT NOT NULL,

  -- Value slots · exactly one non-NULL (enforced by check below)
  value_text           TEXT,
  value_number         NUMERIC,
  value_boolean        BOOLEAN,
  value_ternary        TEXT CHECK (value_ternary IS NULL OR value_ternary IN ('TRUE','FALSE','UNKNOWN')),
  value_array          TEXT[],

  -- Language / raw preservation
  raw_value            TEXT,
  source_language      TEXT,
  normalized_value     TEXT,

  -- Provenance
  source               TEXT NOT NULL,
  source_reference     TEXT,
  source_evidence_id   TEXT,
  observed_at          TIMESTAMPTZ NOT NULL,
  worker_id            TEXT,
  cycle_run_id         UUID REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           TEXT,

  -- Vocabulary FK · attribute_name must exist AND value_type must match
  FOREIGN KEY (attribute_name, value_type)
    REFERENCES nex.accommodation_attribute_vocabulary(attribute_name, value_type),

  -- Exactly-one value-slot invariant
  CONSTRAINT value_type_slot_matches CHECK (
    (value_type = 'TEXT'
      AND value_text IS NOT NULL
      AND value_number IS NULL AND value_boolean IS NULL AND value_ternary IS NULL AND value_array IS NULL)
    OR (value_type = 'NUMBER'
      AND value_number IS NOT NULL
      AND value_text IS NULL AND value_boolean IS NULL AND value_ternary IS NULL AND value_array IS NULL)
    OR (value_type = 'BOOLEAN'
      AND value_boolean IS NOT NULL
      AND value_text IS NULL AND value_number IS NULL AND value_ternary IS NULL AND value_array IS NULL)
    OR (value_type = 'TERNARY'
      AND value_ternary IS NOT NULL
      AND value_text IS NULL AND value_number IS NULL AND value_boolean IS NULL AND value_array IS NULL)
    OR (value_type = 'CONTROLLED_ARRAY'
      AND value_array IS NOT NULL AND cardinality(value_array) >= 1
      AND value_text IS NULL AND value_number IS NULL AND value_boolean IS NULL AND value_ternary IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_accommodation_attribute_property
  ON nex.accommodation_attribute (property_ref);
CREATE INDEX IF NOT EXISTS idx_accommodation_attribute_property_name
  ON nex.accommodation_attribute (property_ref, attribute_name);
CREATE INDEX IF NOT EXISTS idx_accommodation_attribute_room_type
  ON nex.accommodation_attribute (room_type_id) WHERE room_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accommodation_attribute_source_evidence
  ON nex.accommodation_attribute (source_evidence_id) WHERE source_evidence_id IS NOT NULL;

COMMENT ON TABLE nex.accommodation_attribute IS
  'Slice A3 · polymorphic type-specific attribute overlay. Vocabulary-FKed. Five value slots · exactly one non-NULL per row. Language + provenance columns present so A5/A6 attach cleanly.';

-- ═════════════════════════════════════════════════════════════════════════════
-- § 5 · Seed the initial controlled vocabulary
--
-- ~55 attribute names organized by scope:
--   COMMON CORE (applies to all types via wildcard '*')
--   HOTEL / RESORT
--   VILLA
--   APARTMENT (some shared with villa)
--   KOS
--   HOSTEL
--   GUESTHOUSE / HOMESTAY
--
-- Every entry is idempotent (ON CONFLICT DO NOTHING). Future slices may
-- extend this vocabulary; A3 seeds the initial world-class-baseline set.
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO nex.accommodation_attribute_vocabulary
  (attribute_name, value_type, applies_to_types, description, controlled_array_values)
VALUES
  -- ─── COMMON CORE ────────────────────────────────────────────────────────
  ('wifi',                   'TERNARY',           ARRAY['*'],           'Wi-Fi available at property. TRUE/FALSE/UNKNOWN.', NULL),
  ('air_conditioning',       'TERNARY',           ARRAY['*'],           'Air conditioning available. TRUE/FALSE/UNKNOWN.', NULL),
  ('parking',                'TERNARY',           ARRAY['*'],           'Any form of parking available at property.', NULL),
  ('elevator',               'TERNARY',           ARRAY['*'],           'Elevator available.', NULL),
  ('accessibility',          'TERNARY',           ARRAY['*'],           'Wheelchair or accessibility features.', NULL),
  ('reception_24hr',         'TERNARY',           ARRAY['*'],           '24-hour reception available.', NULL),
  ('airport_transfer',       'TERNARY',           ARRAY['*'],           'Airport transfer service available.', NULL),
  ('laundry_service',        'TERNARY',           ARRAY['*'],           'Laundry service available.', NULL),
  ('pets_policy',            'CONTROLLED_ARRAY',  ARRAY['*'],           'Pet policy.', ARRAY['allowed','not_allowed','on_request','unknown']),
  ('smoking_policy',         'CONTROLLED_ARRAY',  ARRAY['*'],           'Smoking policy.', ARRAY['allowed','not_allowed','designated_areas','unknown']),
  ('check_in_time',          'TEXT',              ARRAY['*'],           'Check-in start time or window (source verbatim).', NULL),
  ('check_out_time',         'TEXT',              ARRAY['*'],           'Check-out time (source verbatim).', NULL),
  ('cancellation_policy',    'TEXT',              ARRAY['*'],           'Cancellation policy summary (source verbatim).', NULL),
  ('children_policy',        'TEXT',              ARRAY['*'],           'Children policy (source verbatim).', NULL),
  ('house_rules',            'TEXT',              ARRAY['*'],           'General house rules (source verbatim).', NULL),

  -- ─── HOTEL / RESORT ─────────────────────────────────────────────────────
  ('floors_count',           'NUMBER',            ARRAY['hotel','resort'], 'Number of floors.', NULL),
  ('reception_hours',        'TEXT',              ARRAY['hotel','resort','guesthouse','hostel'], 'Reception operating hours.', NULL),
  ('conference_facilities',  'TERNARY',           ARRAY['hotel','resort'], 'Conference / meeting facilities available.', NULL),
  ('restaurant_on_site',     'TERNARY',           ARRAY['hotel','resort','guesthouse','homestay'], 'On-site restaurant.', NULL),
  ('spa',                    'TERNARY',           ARRAY['hotel','resort'], 'Spa facility on site.', NULL),
  ('gym',                    'TERNARY',           ARRAY['hotel','resort','apartment'], 'Gym / fitness facility on site.', NULL),
  ('pool',                   'TERNARY',           ARRAY['hotel','resort','villa','apartment'], 'Pool available (property or private per type).', NULL),
  ('breakfast_included',     'TERNARY',           ARRAY['hotel','resort','guesthouse','homestay','hostel'], 'Breakfast included in the rate.', NULL),
  ('resort_beachfront',      'TERNARY',           ARRAY['resort'],      'Resort is beachfront.', NULL),
  ('resort_all_inclusive',   'TERNARY',           ARRAY['resort'],      'All-inclusive resort model.', NULL),

  -- ─── VILLA ──────────────────────────────────────────────────────────────
  ('bedrooms_count',         'NUMBER',            ARRAY['villa','apartment','homestay','house'], 'Number of bedrooms.', NULL),
  ('bathrooms_count',        'NUMBER',            ARRAY['villa','apartment','homestay','house'], 'Number of bathrooms.', NULL),
  ('max_capacity',           'NUMBER',            ARRAY['villa','apartment','homestay','house'], 'Maximum occupancy (persons).', NULL),
  ('private_pool',           'TERNARY',           ARRAY['villa'],       'Private pool exclusive to this property.', NULL),
  ('private_garden',         'TERNARY',           ARRAY['villa'],       'Private garden.', NULL),
  ('kitchen',                'TERNARY',           ARRAY['villa','apartment','homestay','house'], 'Kitchen available for guest use.', NULL),
  ('living_area',            'TERNARY',           ARRAY['villa','apartment','house'], 'Dedicated living area.', NULL),
  ('entire_property',        'TERNARY',           ARRAY['villa','house'], 'Rental covers the entire property (not just a room).', NULL),

  -- ─── APARTMENT ──────────────────────────────────────────────────────────
  ('furnished',              'TERNARY',           ARRAY['apartment','kos','house'], 'Property/room is furnished.', NULL),
  ('unit_count',             'NUMBER',            ARRAY['apartment'],   'Number of units in the building.', NULL),
  ('floor',                  'NUMBER',            ARRAY['apartment'],   'Floor number of the unit.', NULL),
  ('balcony',                'TERNARY',           ARRAY['apartment','hotel','resort'], 'Balcony available.', NULL),

  -- ─── KOS ────────────────────────────────────────────────────────────────
  ('monthly_price_min',      'NUMBER',            ARRAY['kos'],         'Minimum monthly price (base currency).', NULL),
  ('monthly_price_max',      'NUMBER',            ARRAY['kos'],         'Maximum monthly price (base currency).', NULL),
  ('deposit_amount',         'NUMBER',            ARRAY['kos'],         'Security deposit amount (base currency).', NULL),
  ('gender_policy',          'CONTROLLED_ARRAY',  ARRAY['kos'],         'Gender policy (only when explicitly published).', ARRAY['any','male_only','female_only','unknown']),
  ('private_bathroom',       'TERNARY',           ARRAY['kos','hostel','guesthouse'], 'Bathroom is private (not shared).', NULL),
  ('electricity_included',   'TERNARY',           ARRAY['kos'],         'Electricity included in the rent.', NULL),
  ('wifi_included',          'TERNARY',           ARRAY['kos'],         'Wi-Fi included in the rent.', NULL),
  ('minimum_stay_months',    'NUMBER',            ARRAY['kos'],         'Minimum stay in months.', NULL),
  ('shared_kitchen',         'TERNARY',           ARRAY['kos','hostel','guesthouse'], 'Shared kitchen facility.', NULL),
  ('shared_bathroom',        'TERNARY',           ARRAY['kos','hostel'], 'Bathroom is shared with other rooms.', NULL),

  -- ─── HOSTEL ─────────────────────────────────────────────────────────────
  ('dorm_capacity',          'NUMBER',            ARRAY['hostel'],      'Number of beds in dorm room.', NULL),
  ('private_rooms_available','TERNARY',           ARRAY['hostel'],      'Private rooms available in addition to dorms.', NULL),
  ('lockers',                'TERNARY',           ARRAY['hostel'],      'Lockers available for guest belongings.', NULL),
  ('common_areas',           'TERNARY',           ARRAY['hostel','guesthouse','homestay'], 'Common/lounge areas available.', NULL),

  -- ─── GUESTHOUSE / HOMESTAY ──────────────────────────────────────────────
  ('shared_facilities',      'TERNARY',           ARRAY['guesthouse','homestay'], 'Shared facilities with other guests.', NULL),
  ('host_family_property',   'TERNARY',           ARRAY['homestay'],    'Property is a host family residence (homestay authenticity).', NULL),
  ('meals_included',         'TERNARY',           ARRAY['homestay','guesthouse'], 'Meals included beyond breakfast.', NULL)
ON CONFLICT (attribute_name) DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 6 · Grants for the accommodation persister role
--
-- The A2 persister role gets minimum grants on A3's new tables. Vocabulary is
-- read-only for the persister (seeded once via migration · future extensions
-- are separately authorized slices).
-- ═════════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE ON nex.accommodation_room_type
  TO nex_workforce_persister_accommodation_business;
GRANT SELECT, INSERT, UPDATE ON nex.accommodation_attribute
  TO nex_workforce_persister_accommodation_business;
GRANT SELECT ON nex.accommodation_attribute_vocabulary
  TO nex_workforce_persister_accommodation_business;

-- Field provenance rows for room-type + attribute writes reference the
-- existing accommodation_business_field_provenance table (grants already
-- present from A2). No new grant required.

-- ═════════════════════════════════════════════════════════════════════════════
-- § 7 · A2 persister function extended · CREATE OR REPLACE
--
-- Additive change: writes source_type + source_subtype + name_source_language
-- + name_original_text into the new columns. Every fence check, category
-- classification, dedupe_hash derivation, identity-ambiguity protection,
-- monotonic UPSERT, and field_provenance write remains BYTE-IDENTICAL to A2.
-- ═════════════════════════════════════════════════════════════════════════════
GRANT CREATE ON SCHEMA nex_workforce TO nex_workforce_persister_accommodation_business;

SET LOCAL ROLE nex_workforce_persister_accommodation_business;

CREATE OR REPLACE FUNCTION nex_workforce.persist_to_accommodation_business(
  p_agent_id      text,
  p_work_item_id  uuid,
  p_generation    integer,
  p_evidence_id   text,
  p_retrieved_at  timestamptz,
  p_source_slug   text,
  p_natural_key   text,
  p_payload_json  jsonb
) RETURNS TABLE (
  ok                boolean,
  target_pk         text,
  new_row           boolean,
  updated_row       boolean,
  rejected          boolean,
  rejection_reason  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $body$
DECLARE
  v_wi_row       RECORD;
  v_name         text;
  v_tourism      text;
  v_hotel_sub    text;
  v_guest_sub    text;
  v_category     text;
  v_source_type    text;
  v_source_subtype text;
  v_name_lang    text;
  v_name_orig    text;
  v_lat          numeric;
  v_lon          numeric;
  v_phone        text;
  v_website      text;
  v_addr_street  text;
  v_addr_city    text;
  v_addr_full    text;
  v_stars        integer;
  v_rooms        integer;
  v_amenities    text[] := '{}';
  v_public_ref   text;
  v_dedupe_hash  text;
  v_name_norm    text;
  v_addr_norm    text;
  v_phone_last6  text;
  v_coord_key    text;
  v_match_count  integer;
  v_existing_pk  uuid;
  v_existing_rt  timestamptz;
  v_existing_ev  text;
  v_row_pk       uuid;
  v_city         text;
  v_name_id      text;
  v_name_en      text;
BEGIN
  -- § 7.1 · Fence check (unchanged from A2)
  SELECT id, agent_id, generation, state, city_slug INTO v_wi_row
    FROM nex_workforce.work_item WHERE id = p_work_item_id FOR UPDATE;
  IF v_wi_row.id IS NULL
  OR v_wi_row.agent_id  IS DISTINCT FROM p_agent_id
  OR v_wi_row.generation <> p_generation
  OR v_wi_row.state      <> 'leased' THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT; RETURN;
  END IF;

  -- § 7.2 · Authoritative city (unchanged from A2)
  SELECT name INTO v_city FROM nex_workforce.city_catalogue WHERE slug = v_wi_row.city_slug;
  IF v_city IS NULL THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('city_not_registered:%s', COALESCE(v_wi_row.city_slug, 'NULL'));
    RETURN NEXT; RETURN;
  END IF;
  IF btrim(v_city) = '' OR length(v_city) > 200 THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('invalid_city:slug=%s,name_len=%s', v_wi_row.city_slug, length(COALESCE(v_city, '')));
    RETURN NEXT; RETURN;
  END IF;

  -- § 7.3 · Source-slug + natural-key validation (unchanged from A2)
  IF p_source_slug NOT IN ('overpass', 'osm_overpass') THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := format('unsupported_source_slug:%s', p_source_slug);
    RETURN NEXT; RETURN;
  END IF;
  IF p_natural_key IS NULL OR p_natural_key !~ '^(node|way|relation)/[0-9]+$' THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := 'invalid_source_reference';
    RETURN NEXT; RETURN;
  END IF;

  -- § 7.4 · Extract candidate fields (unchanged from A2 · plus A3 additions)
  v_name        := NULLIF(btrim(p_payload_json #>> '{tags,name}'), '');
  v_tourism     := lower(NULLIF(btrim(p_payload_json #>> '{tags,tourism}'), ''));
  v_hotel_sub   := lower(NULLIF(btrim(p_payload_json #>> '{tags,hotel}'), ''));
  v_guest_sub   := lower(NULLIF(btrim(p_payload_json #>> '{tags,guest_house}'), ''));
  v_lat         := NULLIF(p_payload_json ->> 'lat', '')::numeric;
  v_lon         := NULLIF(p_payload_json ->> 'lon', '')::numeric;
  v_phone       := NULLIF(p_payload_json #>> '{tags,phone}', '');
  v_website     := NULLIF(p_payload_json #>> '{tags,website}', '');
  v_addr_street := NULLIF(p_payload_json #>> '{tags,addr:street}', '');
  v_addr_city   := NULLIF(p_payload_json #>> '{tags,addr:city}', '');

  BEGIN
    v_stars := NULLIF(p_payload_json #>> '{tags,stars}', '')::integer;
    IF v_stars IS NOT NULL AND (v_stars < 1 OR v_stars > 5) THEN v_stars := NULL; END IF;
  EXCEPTION WHEN invalid_text_representation THEN v_stars := NULL; END;
  BEGIN
    v_rooms := NULLIF(p_payload_json #>> '{tags,rooms}', '')::integer;
    IF v_rooms IS NOT NULL AND v_rooms <= 0 THEN v_rooms := NULL; END IF;
  EXCEPTION WHEN invalid_text_representation THEN v_rooms := NULL; END;

  IF (p_payload_json #>> '{tags,internet_access}') IN ('wlan', 'yes', 'wifi', 'wired', 'terminal') THEN
    v_amenities := array_append(v_amenities, 'wifi');
  END IF;
  IF (p_payload_json #>> '{tags,air_conditioning}') = 'yes' THEN
    v_amenities := array_append(v_amenities, 'air_conditioning');
  END IF;
  IF (p_payload_json #>> '{tags,breakfast}') = 'yes' THEN
    v_amenities := array_append(v_amenities, 'breakfast');
  END IF;
  IF (p_payload_json #>> '{tags,swimming_pool}') = 'yes' THEN
    v_amenities := array_append(v_amenities, 'pool');
  END IF;
  IF (p_payload_json #>> '{tags,parking}') IN ('yes', 'surface', 'underground', 'multi-storey') THEN
    v_amenities := array_append(v_amenities, 'parking');
  END IF;

  -- § 7.5 · Missing name (unchanged from A2)
  IF v_name IS NULL THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := 'missing_name';
    RETURN NEXT; RETURN;
  END IF;

  -- § 7.6 · Category classification (unchanged from A2)
  IF v_tourism = 'hotel' AND v_hotel_sub = 'villa' THEN
    v_category := 'villa';
  ELSIF v_tourism = 'hotel' AND v_hotel_sub = 'resort' THEN
    v_category := 'resort';
  ELSIF v_tourism = 'chalet' THEN
    v_category := 'villa';
  ELSIF v_tourism = 'guest_house' AND v_guest_sub = 'homestay' THEN
    v_category := 'homestay';
  ELSIF v_tourism = 'guest_house' THEN
    v_category := 'guesthouse';
  ELSIF v_tourism = 'hostel' THEN
    v_category := 'hostel';
  ELSIF v_tourism = 'apartment' THEN
    v_category := 'apartment';
  ELSIF v_tourism = 'motel' THEN
    v_category := 'hotel';
  ELSIF v_tourism = 'hotel' THEN
    v_category := 'hotel';
  ELSE
    v_category := NULL;
  END IF;
  IF v_category IS NULL THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('unknown_category:tourism=%s,hotel=%s',
                                COALESCE(v_tourism, 'NULL'), COALESCE(v_hotel_sub, 'NULL'));
    RETURN NEXT; RETURN;
  END IF;

  -- § 7.6a · Slice A3 · Source-classification preservation (NEW)
  -- Raw tourism value → source_type. Raw subtype (whichever populated) → source_subtype.
  v_source_type    := v_tourism;
  IF v_hotel_sub IS NOT NULL THEN
    v_source_subtype := v_hotel_sub;
  ELSIF v_guest_sub IS NOT NULL THEN
    v_source_subtype := v_guest_sub;
  ELSE
    v_source_subtype := NULL;
  END IF;

  -- § 7.6b · Slice A3 · Name language evidence (NEW · evidence-based only)
  -- If the primary name matches a language-tagged name variant, we have
  -- source-supplied evidence of the language. Otherwise NULL (unknown).
  v_name_id := NULLIF(btrim(p_payload_json #>> '{tags,name:id}'), '');
  v_name_en := NULLIF(btrim(p_payload_json #>> '{tags,name:en}'), '');
  IF v_name_id IS NOT NULL AND v_name_id = v_name THEN
    v_name_lang := 'id';
  ELSIF v_name_en IS NOT NULL AND v_name_en = v_name THEN
    v_name_lang := 'en';
  ELSE
    v_name_lang := NULL;
  END IF;
  v_name_orig := v_name;  -- raw source name preserved verbatim

  -- § 7.7 · dedupe_hash (unchanged from A2)
  v_name_norm := regexp_replace(lower(v_name), '\s+', ' ', 'g');
  v_addr_norm := regexp_replace(lower(COALESCE(v_addr_street, '') || '|' || COALESCE(v_addr_city, '')), '\s+', ' ', 'g');
  v_phone_last6 := CASE WHEN v_phone IS NULL THEN '' ELSE right(regexp_replace(v_phone, '\D', '', 'g'), 6) END;
  v_coord_key := CASE WHEN v_lat IS NULL OR v_lon IS NULL THEN '' ELSE to_char(round(v_lat, 3), 'FM9990.999') || ',' || to_char(round(v_lon, 3), 'FM9990.999') END;
  v_dedupe_hash := encode(extensions.digest(v_name_norm || '|' || v_addr_norm || '|' || v_phone_last6 || '|' || v_coord_key, 'sha256'), 'hex');

  -- § 7.8 · address + public_listing_ref (unchanged from A2)
  v_addr_full := NULLIF(btrim(COALESCE(v_addr_street, '') || CASE WHEN v_addr_city IS NOT NULL THEN ', ' || v_addr_city ELSE '' END), '');
  v_public_ref := '#AC-' || to_char(p_retrieved_at, 'YYYY') || '-' || nex_workforce._crockford5(p_natural_key);

  -- § 7.9 · Match count branching (unchanged from A2)
  SELECT count(*)::integer INTO v_match_count FROM nex.accommodation_business
    WHERE source = 'osm_overpass' AND source_reference = p_natural_key;
  IF v_match_count >= 2 THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('identity_ambiguous:%s_matches', v_match_count);
    RETURN NEXT; RETURN;
  END IF;

  IF v_match_count = 0 THEN
    INSERT INTO nex.accommodation_business (
      public_listing_ref, business_name, category,
      source_type, source_subtype, name_source_language, name_original_text,
      address, city, coordinates_lat, coordinates_lng,
      phone, website, star_rating, room_count, amenities,
      source, source_reference, source_ingested_at, source_checked_at,
      source_licence_terms, source_evidence_id, source_retrieved_at,
      dedupe_hash, hero_image_approved, created_by
    ) VALUES (
      v_public_ref, v_name, v_category,
      v_source_type, v_source_subtype, v_name_lang, v_name_orig,
      v_addr_full, v_city, v_lat, v_lon,
      v_phone, v_website, v_stars, v_rooms, v_amenities,
      'osm_overpass', p_natural_key, now(), p_retrieved_at,
      'openstreetmap:odbl-1.0', p_evidence_id, p_retrieved_at,
      v_dedupe_hash, false,
      'nex_workforce_v2:persist_to_accommodation_business'
    )
    RETURNING internal_id INTO v_row_pk;

    -- field_provenance (unchanged from A2)
    INSERT INTO nex.accommodation_business_field_provenance
      (business_ref, field_name, trust_layer, written_by, source_reference)
    VALUES
      (v_public_ref, 'business_name', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key),
      (v_public_ref, 'category',      'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key),
      (v_public_ref, 'city',          'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
    ON CONFLICT (business_ref, field_name) DO NOTHING;

    -- Slice A3 addition: provenance rows for source-classification + language
    INSERT INTO nex.accommodation_business_field_provenance
      (business_ref, field_name, trust_layer, written_by, source_reference)
    VALUES
      (v_public_ref, 'source_type',    'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
    ON CONFLICT DO NOTHING;
    IF v_source_subtype IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance
        (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'source_subtype', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_name_lang IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance
        (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'name_source_language', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_lat IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance
        (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'coordinates', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_phone IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'phone', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_website IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'website', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_addr_full IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'address', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_stars IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'star_rating', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_rooms IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'room_count', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF array_length(v_amenities, 1) IS NOT NULL AND array_length(v_amenities, 1) > 0 THEN
      INSERT INTO nex.accommodation_business_field_provenance (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'amenities', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;

    ok := true; target_pk := v_row_pk::text; new_row := true; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT; RETURN;
  END IF;

  -- CASE B · 1 match → monotonic UPDATE
  SELECT internal_id, source_retrieved_at, source_evidence_id
    INTO v_existing_pk, v_existing_rt, v_existing_ev
    FROM nex.accommodation_business
   WHERE source = 'osm_overpass' AND source_reference = p_natural_key
   FOR UPDATE;

  IF v_existing_rt IS NOT NULL AND p_retrieved_at < v_existing_rt THEN
    ok := true; target_pk := v_existing_pk::text; new_row := false; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT; RETURN;
  END IF;
  IF v_existing_rt IS NOT NULL AND p_retrieved_at = v_existing_rt
  AND (v_existing_ev IS NULL OR p_evidence_id <= v_existing_ev) THEN
    ok := true; target_pk := v_existing_pk::text; new_row := false; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT; RETURN;
  END IF;

  UPDATE nex.accommodation_business
     SET business_name         = v_name,
         category              = v_category,
         source_type           = v_source_type,
         source_subtype        = v_source_subtype,
         name_source_language  = v_name_lang,
         name_original_text    = v_name_orig,
         address               = v_addr_full,
         city                  = v_city,
         coordinates_lat       = v_lat,
         coordinates_lng       = v_lon,
         phone                 = v_phone,
         website               = v_website,
         star_rating           = v_stars,
         room_count            = v_rooms,
         amenities             = v_amenities,
         source_checked_at     = p_retrieved_at,
         source_evidence_id    = p_evidence_id,
         source_retrieved_at   = p_retrieved_at,
         dedupe_hash           = v_dedupe_hash
   WHERE internal_id = v_existing_pk;

  ok := true; target_pk := v_existing_pk::text; new_row := false; updated_row := true;
  rejected := false; rejection_reason := NULL;
  RETURN NEXT; RETURN;
END;
$body$;

COMMENT ON FUNCTION nex_workforce.persist_to_accommodation_business(text, uuid, integer, text, timestamptz, text, text, jsonb) IS
  'Slice A3 · A2 persister extended with source_type + source_subtype + name_source_language + name_original_text preservation. Every fence/classification/dedupe/UPSERT rule byte-identical to A2. Owned by nex_workforce_persister_accommodation_business.';

RESET ROLE;

-- Restore ownership
REVOKE ALL ON FUNCTION nex_workforce.persist_to_accommodation_business(text, uuid, integer, text, timestamptz, text, text, jsonb) FROM PUBLIC;
ALTER FUNCTION nex_workforce.persist_to_accommodation_business(text, uuid, integer, text, timestamptz, text, text, jsonb)
  OWNER TO nex_workforce_persister_accommodation_business;
GRANT EXECUTE ON FUNCTION nex_workforce.persist_to_accommodation_business(text, uuid, integer, text, timestamptz, text, text, jsonb)
  TO nex_workforce_admin;

REVOKE CREATE ON SCHEMA nex_workforce FROM nex_workforce_persister_accommodation_business;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 8 · Sanity check
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
DECLARE ok BOOLEAN; vocab_count INTEGER;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                WHERE table_schema='nex' AND table_name='accommodation_room_type') INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Slice A3 FAIL: accommodation_room_type missing'; END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                WHERE table_schema='nex' AND table_name='accommodation_attribute') INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Slice A3 FAIL: accommodation_attribute missing'; END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                WHERE table_schema='nex' AND table_name='accommodation_attribute_vocabulary') INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Slice A3 FAIL: accommodation_attribute_vocabulary missing'; END IF;

  SELECT count(*) INTO vocab_count FROM nex.accommodation_attribute_vocabulary;
  IF vocab_count < 40 THEN
    RAISE EXCEPTION 'Slice A3 FAIL: vocabulary underseeded · % rows', vocab_count;
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.columns
                WHERE table_schema='nex' AND table_name='accommodation_business' AND column_name='source_type') INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Slice A3 FAIL: source_type column missing'; END IF;

  RAISE NOTICE 'Slice A3 complete: room_type + attribute overlay + vocabulary (% rows) + persister extended', vocab_count;
END $body$;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- Rollback (separate transaction · run manually if needed):
--
--   BEGIN;
--     DROP TABLE IF EXISTS nex.accommodation_attribute;
--     DROP TABLE IF EXISTS nex.accommodation_attribute_vocabulary;
--     DROP TRIGGER IF EXISTS trg_accommodation_room_type_touch_updated_at ON nex.accommodation_room_type;
--     DROP FUNCTION IF EXISTS nex.trg_accommodation_room_type_touch_updated_at();
--     DROP TABLE IF EXISTS nex.accommodation_room_type;
--     ALTER TABLE nex.accommodation_business DROP COLUMN IF EXISTS source_type;
--     ALTER TABLE nex.accommodation_business DROP COLUMN IF EXISTS source_subtype;
--     ALTER TABLE nex.accommodation_business DROP COLUMN IF EXISTS name_source_language;
--     ALTER TABLE nex.accommodation_business DROP COLUMN IF EXISTS name_original_text;
--     -- Re-apply _slice_a2_accommodation_business_persister.sql to restore A2 function shape
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════
