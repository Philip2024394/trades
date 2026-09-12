-- NEX Workforce v2 · Slice A2 · Accommodation Business Persister Migration
-- Philip 2026-09-07 · FOUNDER AUTHORIZATION
-- ─────────────────────────────────────────────────────────────────────────────
-- Mirrors the Slice 1h food_business persister pattern for the accommodation
-- vertical. Follows R2/R3/R5 discipline: authoritative city from work_item,
-- monotonic UPSERT with retrieved_at + evidence_id tiebreak, identity-ambiguity
-- protection, SECURITY DEFINER function owned by a narrowly-privileged role.
--
-- A2 SCOPE (Founder authorization 2026-09-07):
--   · Real accommodation persister function
--   · Dedicated persister-owner role · least privilege
--   · RLS enable + policies (brain_app + social_app preserved, persister scoped)
--   · Source-slug + natural-key validation
--   · 7-category tourism-family classifier (kos = name-based, deferred to A3)
--   · source_evidence_id + source_retrieved_at columns added for evidence linkage
--
-- A2 IS NOT (per Founder scope lock):
--   · Any acquisition activation
--   · Any 518-city seeding
--   · Any work_item seeding
--   · Any job_registry row for (accommodation, overpass)
--   · Any Overpass HTTP call
--   · Any change to the P1 quarantine or Scheduled Task
--   · Any migration of production data to Project B
--
-- FAIL-CLOSED INVARIANTS ENFORCED:
--   1. Function writes ONLY to nex.accommodation_business (never mock_target)
--   2. Function owner has ZERO grants on nex_workforce.mock_target — even
--      if a caller tried to redirect writes there, permissions would block it
--   3. Source-slug restricted to ('overpass', 'osm_overpass') · unsupported
--      sources are REJECTED with rejection_reason = 'unsupported_source_slug:<x>'
--   4. Category classification restricted to explicit tourism-tag branches ·
--      unclassifiable candidates are REJECTED, never silently defaulted
--   5. Missing name is REJECTED, never invented
--   6. City name derived from work_item.city_slug via city_catalogue lookup ·
--      addr:city from OSM tags is NEVER used as authoritative city
--   7. Four-field fence check (agent_id + work_item_id + generation + state='leased')
--      inside the function body · defense in depth even when invoked outside
--      persist_batch
--
-- Reversible rollback documented at the bottom.

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 0 · Preflight · fail-closed on missing dependencies
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'nex' AND table_name = 'accommodation_business') THEN
    RAISE EXCEPTION 'A2 preflight FAIL · nex.accommodation_business missing · apply deploy/postgres/init/078_nex_accommodation_business.sql first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'nex_workforce' AND table_name = 'work_item') THEN
    RAISE EXCEPTION 'A2 preflight FAIL · nex_workforce schema missing · apply _slice1_nex_workforce_v2_schema.sql first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'nex_workforce' AND table_name = 'evidence_record') THEN
    RAISE EXCEPTION 'A2 preflight FAIL · evidence_record missing · apply _slice1g_persistence_boundary.sql first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    RAISE EXCEPTION 'A2 preflight FAIL · extensions schema missing · required for pgcrypto placement';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension e
                 JOIN pg_namespace n ON n.oid = e.extnamespace
                 WHERE e.extname = 'pgcrypto' AND n.nspname = 'extensions') THEN
    RAISE EXCEPTION 'A2 preflight FAIL · pgcrypto not installed in extensions schema';
  END IF;
END $body$;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 1 · Add evidence-linkage columns to nex.accommodation_business
--
-- Mirrors what _slice1h_food_business_persister added for food_business.
-- source_evidence_id links back to the immutable nex_workforce.evidence_record
-- ledger · source_retrieved_at is the monotonic tiebreak field for UPSERT.
-- Both nullable · existing 9,203 rows have NULL here (bootstrap-friendly ·
-- monotonic guard explicitly treats NULL existing as "always overwritable").
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE nex.accommodation_business
  ADD COLUMN IF NOT EXISTS source_evidence_id  text,
  ADD COLUMN IF NOT EXISTS source_retrieved_at timestamptz;

COMMENT ON COLUMN nex.accommodation_business.source_evidence_id IS
  'Slice A2 · links back to nex_workforce.evidence_record.evidence_id. Immutable evidence provenance for the source response that produced this row. NULL for legacy pre-A2 rows.';
COMMENT ON COLUMN nex.accommodation_business.source_retrieved_at IS
  'Slice A2 · retrieval timestamp of the source response that produced (or last updated) this row. Monotonic-UPSERT tiebreak: newer wins, equal ties broken by evidence_id lex order. NULL treated as "any observation overwrites" (legacy bootstrap).';

CREATE INDEX IF NOT EXISTS idx_accommodation_business_source_evidence
  ON nex.accommodation_business (source_evidence_id)
  WHERE source_evidence_id IS NOT NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 2 · Row Level Security · ENABLE (NOT FORCE)
--
-- Same convention as _slice1h_food_business_persister. Owner=postgres still
-- BYPASSes via superuser. Non-owner non-superuser roles are RLS-checked with
-- explicit policies below.
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE nex.accommodation_business ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.accommodation_business NO FORCE ROW LEVEL SECURITY;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 3 · Persister-owner role · NOLOGIN NOBYPASSRLS · least privilege
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_persister_accommodation_business') THEN
    CREATE ROLE nex_workforce_persister_accommodation_business NOLOGIN NOBYPASSRLS;
  END IF;
END $body$;
ALTER ROLE nex_workforce_persister_accommodation_business NOLOGIN NOBYPASSRLS;

-- SET-role capability so the subsequent ALTER FUNCTION OWNER TO can execute
-- as the persister role. Idempotent · WITH SET TRUE upgrades an existing
-- membership · matches the food persister's R3 fix pattern.
GRANT nex_workforce_persister_accommodation_business TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 4 · Grants · minimum required for the persister function's operation
-- ═════════════════════════════════════════════════════════════════════════════
GRANT USAGE ON SCHEMA nex           TO nex_workforce_persister_accommodation_business;
GRANT USAGE, CREATE ON SCHEMA nex_workforce TO nex_workforce_persister_accommodation_business;
GRANT USAGE ON SCHEMA extensions    TO nex_workforce_persister_accommodation_business;

-- Persister writes accommodation_business (INSERT/UPDATE) + reads for match count
GRANT SELECT, INSERT, UPDATE ON nex.accommodation_business TO nex_workforce_persister_accommodation_business;

-- Persister writes per-field provenance rows
GRANT SELECT, INSERT ON nex.accommodation_business_field_provenance TO nex_workforce_persister_accommodation_business;

-- Persister needs read on city_catalogue for R5 authoritative city derivation
GRANT SELECT ON nex_workforce.city_catalogue TO nex_workforce_persister_accommodation_business;

-- Persister needs read on evidence_record for provenance joins
GRANT SELECT ON nex_workforce.evidence_record TO nex_workforce_persister_accommodation_business;

-- Fence check needs work_item SELECT + row-level FOR UPDATE lock
-- (SELECT FOR UPDATE requires UPDATE privilege parse-time check even though
-- the function body never issues an actual UPDATE against work_item)
GRANT SELECT, UPDATE ON nex_workforce.work_item TO nex_workforce_persister_accommodation_business;

-- STRUCTURAL FAIL-CLOSED: no grant on mock_target. Even if a caller tries to
-- redirect writes there via the SECURITY DEFINER function's owner role, the
-- role's permission table blocks it. This is defense-in-depth beyond the
-- function body's explicit target reference.

-- ═════════════════════════════════════════════════════════════════════════════
-- § 5 · Policies · preserve brain_app + social_app access · scope persister
--
-- Mirror the food persister's semantic-equivalence pattern for the two NEX
-- application roles, and add narrow persister policies scoped to
-- source='osm_overpass'.
-- ═════════════════════════════════════════════════════════════════════════════

-- Preserve existing brain_app CRUD semantic (SEMANTIC-EQUIVALENT · not widening)
-- Only issue policy if the role exists in this database.
DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_brain_app') THEN
    EXECUTE 'DROP POLICY IF EXISTS accommodation_business_brain_app_all ON nex.accommodation_business';
    EXECUTE 'CREATE POLICY accommodation_business_brain_app_all
              ON nex.accommodation_business
              AS PERMISSIVE FOR ALL
              TO nex_brain_app
              USING (true)
              WITH CHECK (true)';
  END IF;
END $body$;

-- Preserve existing social_app CRUD semantic (SEMANTIC-EQUIVALENT · not widening)
DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_social_app') THEN
    EXECUTE 'DROP POLICY IF EXISTS accommodation_business_social_app_all ON nex.accommodation_business';
    EXECUTE 'CREATE POLICY accommodation_business_social_app_all
              ON nex.accommodation_business
              AS PERMISSIVE FOR ALL
              TO nex_social_app
              USING (true)
              WITH CHECK (true)';
  END IF;
END $body$;

-- Workforce persister · scoped writes ONLY to source='osm_overpass'
DROP POLICY IF EXISTS accommodation_business_persister_insert ON nex.accommodation_business;
CREATE POLICY accommodation_business_persister_insert
  ON nex.accommodation_business
  AS PERMISSIVE FOR INSERT
  TO nex_workforce_persister_accommodation_business
  WITH CHECK (source = 'osm_overpass');

DROP POLICY IF EXISTS accommodation_business_persister_update ON nex.accommodation_business;
CREATE POLICY accommodation_business_persister_update
  ON nex.accommodation_business
  AS PERMISSIVE FOR UPDATE
  TO nex_workforce_persister_accommodation_business
  USING      (source = 'osm_overpass')
  WITH CHECK (source = 'osm_overpass');

DROP POLICY IF EXISTS accommodation_business_persister_select ON nex.accommodation_business;
CREATE POLICY accommodation_business_persister_select
  ON nex.accommodation_business
  AS PERMISSIVE FOR SELECT
  TO nex_workforce_persister_accommodation_business
  USING (source = 'osm_overpass');

-- Field provenance table · persister needs to write per-field rows
DO $body$
BEGIN
  EXECUTE 'ALTER TABLE nex.accommodation_business_field_provenance ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE nex.accommodation_business_field_provenance NO FORCE ROW LEVEL SECURITY';
EXCEPTION
  WHEN insufficient_privilege OR undefined_table THEN
    RAISE NOTICE 'Skipping RLS on accommodation_business_field_provenance (not present or insufficient privilege)';
END $body$;

DROP POLICY IF EXISTS accommodation_provenance_persister_all ON nex.accommodation_business_field_provenance;
CREATE POLICY accommodation_provenance_persister_all
  ON nex.accommodation_business_field_provenance
  AS PERMISSIVE FOR ALL
  TO nex_workforce_persister_accommodation_business
  USING (true)
  WITH CHECK (true);

-- ═════════════════════════════════════════════════════════════════════════════
-- § 6 · _crockford5 · shared with food persister · CREATE IF NOT PRESENT
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
                 JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'nex_workforce' AND p.proname = '_crockford5') THEN
    EXECUTE $q$
      CREATE OR REPLACE FUNCTION nex_workforce._crockford5(p_input text)
      RETURNS text
      LANGUAGE plpgsql
      IMMUTABLE
      SET search_path = pg_catalog, pg_temp
      AS $inner$
      DECLARE
        v_alpha text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
        v_bytes bytea;
        v_num   numeric := 0;
        v_i     integer;
        v_out   text := '';
      BEGIN
        v_bytes := extensions.digest(p_input, 'sha256');
        FOR v_i IN 0..4 LOOP v_num := v_num * 256 + get_byte(v_bytes, v_i); END LOOP;
        FOR v_i IN 1..5 LOOP
          v_out := substring(v_alpha FROM ((v_num % 32)::integer + 1) FOR 1) || v_out;
          v_num := trunc(v_num / 32);
        END LOOP;
        RETURN v_out;
      END;
      $inner$;
    $q$;
  END IF;
END $body$;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 7 · persist_to_accommodation_business · SECURITY DEFINER
--
-- Signature matches Slice 1g persist_batch contract:
--   (p_agent_id, p_work_item_id, p_generation,
--    p_evidence_id, p_retrieved_at,
--    p_source_slug, p_natural_key, p_payload_json)
--   → TABLE (ok, target_pk, new_row, updated_row, rejected, rejection_reason)
--
-- ACCOMMODATION CATEGORY MAPPING (7 tourism-family branches · closed set):
--   tourism=hotel + hotel=villa    → 'villa'
--   tourism=hotel + hotel=resort   → 'resort'
--   tourism=chalet                  → 'villa'      (P1 Yogya-market convention)
--   tourism=guest_house
--     + guest_house=homestay        → 'homestay'
--   tourism=guest_house             → 'guesthouse'
--   tourism=hostel                  → 'hostel'
--   tourism=apartment               → 'apartment'
--   tourism=motel                   → 'hotel'      (motel is hotel-shaped)
--   tourism=hotel (no subtype)      → 'hotel'
--   else                            → REJECT 'unknown_category:tourism=<x>,hotel=<y>'
--
-- NOTE: kos (Indonesian residential monthly rental) requires name-based
-- detection which is deferred to A3 canonical model work. A2 persister does
-- not auto-classify kos. Rows already classified as kos by another code path
-- are accepted by the schema's CHECK constraint (8-value taxonomy per
-- migration 079), but this persister function will never PRODUCE a kos
-- category from OSM tags alone.
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
BEGIN
  -- ─── § 7.1 · Defense-in-depth fence check (four-field) ────────────────────
  SELECT id, agent_id, generation, state, city_slug
    INTO v_wi_row
    FROM nex_workforce.work_item
   WHERE id = p_work_item_id
   FOR UPDATE;

  IF v_wi_row.id IS NULL
  OR v_wi_row.agent_id  IS DISTINCT FROM p_agent_id
  OR v_wi_row.generation <> p_generation
  OR v_wi_row.state      <> 'leased' THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.2 · Authoritative city derivation from work_item.city_slug ───────
  SELECT name INTO v_city
    FROM nex_workforce.city_catalogue
   WHERE slug = v_wi_row.city_slug;

  IF v_city IS NULL THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('city_not_registered:%s', COALESCE(v_wi_row.city_slug, 'NULL'));
    RETURN NEXT;
    RETURN;
  END IF;

  IF btrim(v_city) = '' OR length(v_city) > 200 THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('invalid_city:slug=%s,name_len=%s', v_wi_row.city_slug, length(COALESCE(v_city, '')));
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.3 · Source-slug + natural-key contract validation ────────────────
  IF p_source_slug NOT IN ('overpass', 'osm_overpass') THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := format('unsupported_source_slug:%s', p_source_slug);
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_natural_key IS NULL OR p_natural_key !~ '^(node|way|relation)/[0-9]+$' THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := 'invalid_source_reference';
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.4 · Extract candidate fields from OSM payload ────────────────────
  v_name        := NULLIF(btrim(p_payload_json #>> '{tags,name}'), '');
  v_tourism     := lower(NULLIF(btrim(p_payload_json #>> '{tags,tourism}'), ''));
  v_hotel_sub   := lower(NULLIF(btrim(p_payload_json #>> '{tags,hotel}'), ''));
  v_guest_sub   := lower(NULLIF(btrim(p_payload_json #>> '{tags,guest_house}'), ''));
  v_lat         := NULLIF(p_payload_json ->> 'lat', '')::numeric;
  v_lon         := NULLIF(p_payload_json ->> 'lon', '')::numeric;
  v_phone       := NULLIF(p_payload_json #>> '{tags,phone}', '');
  v_website     := NULLIF(p_payload_json #>> '{tags,website}', '');
  v_addr_street := NULLIF(p_payload_json #>> '{tags,addr:street}', '');
  -- addr:city is used ONLY for the address string · NEVER for the city column
  v_addr_city   := NULLIF(p_payload_json #>> '{tags,addr:city}', '');

  -- Star rating (integer 1-5 if the source declares one)
  BEGIN
    v_stars := NULLIF(p_payload_json #>> '{tags,stars}', '')::integer;
    IF v_stars IS NOT NULL AND (v_stars < 1 OR v_stars > 5) THEN
      v_stars := NULL;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    v_stars := NULL;
  END;

  -- Room count (positive integer if declared)
  BEGIN
    v_rooms := NULLIF(p_payload_json #>> '{tags,rooms}', '')::integer;
    IF v_rooms IS NOT NULL AND v_rooms <= 0 THEN
      v_rooms := NULL;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    v_rooms := NULL;
  END;

  -- Amenity tags (evidence-based · NEVER inferred). Only tags OSM commonly uses.
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

  -- ─── § 7.5 · Missing name → REJECT (never invent) ─────────────────────────
  IF v_name IS NULL THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := 'missing_name';
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.6 · Category classification · 7 tourism-family branches ──────────
  -- Order matters: subtype-specific branches evaluated first.
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
                                COALESCE(v_tourism, 'NULL'),
                                COALESCE(v_hotel_sub, 'NULL'));
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.7 · Derive dedupe_hash ───────────────────────────────────────────
  v_name_norm := regexp_replace(lower(v_name), '\s+', ' ', 'g');
  v_addr_norm := regexp_replace(lower(COALESCE(v_addr_street, '') || '|' || COALESCE(v_addr_city, '')), '\s+', ' ', 'g');
  v_phone_last6 := CASE
    WHEN v_phone IS NULL THEN ''
    ELSE right(regexp_replace(v_phone, '\D', '', 'g'), 6)
  END;
  v_coord_key := CASE
    WHEN v_lat IS NULL OR v_lon IS NULL THEN ''
    ELSE to_char(round(v_lat, 3), 'FM9990.999') || ',' || to_char(round(v_lon, 3), 'FM9990.999')
  END;
  v_dedupe_hash := encode(
    extensions.digest(v_name_norm || '|' || v_addr_norm || '|' || v_phone_last6 || '|' || v_coord_key, 'sha256'),
    'hex'
  );

  -- ─── § 7.8 · Derive address text + public_listing_ref ────────────────────
  v_addr_full := NULLIF(btrim(
    COALESCE(v_addr_street, '')
    || CASE WHEN v_addr_city IS NOT NULL THEN ', ' || v_addr_city ELSE '' END
  ), '');
  -- Accommodation prefix per migration 078: #AC-YYYY-XXXXX
  v_public_ref := '#AC-' || to_char(p_retrieved_at, 'YYYY') || '-' || nex_workforce._crockford5(p_natural_key);

  -- ─── § 7.9 · Match count · 0 / 1 / >=2 branching ─────────────────────────
  SELECT count(*)::integer INTO v_match_count
    FROM nex.accommodation_business
   WHERE source = 'osm_overpass' AND source_reference = p_natural_key;

  -- CASE C · ≥2 matches → REJECT identity_ambiguous
  IF v_match_count >= 2 THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('identity_ambiguous:%s_matches', v_match_count);
    RETURN NEXT;
    RETURN;
  END IF;

  -- CASE A · 0 matches → INSERT
  IF v_match_count = 0 THEN
    INSERT INTO nex.accommodation_business (
      public_listing_ref,
      business_name,
      category,
      address,
      city,
      coordinates_lat,
      coordinates_lng,
      phone,
      website,
      star_rating,
      room_count,
      amenities,
      source,
      source_reference,
      source_ingested_at,
      source_checked_at,
      source_licence_terms,
      source_evidence_id,
      source_retrieved_at,
      dedupe_hash,
      hero_image_approved,
      created_by
    ) VALUES (
      v_public_ref,
      v_name,
      v_category,
      v_addr_full,
      v_city,
      v_lat,
      v_lon,
      v_phone,
      v_website,
      v_stars,
      v_rooms,
      v_amenities,
      'osm_overpass',
      p_natural_key,
      now(),
      p_retrieved_at,
      'openstreetmap:odbl-1.0',
      p_evidence_id,
      p_retrieved_at,
      v_dedupe_hash,
      false,
      'nex_workforce_v2:persist_to_accommodation_business'
    )
    RETURNING internal_id INTO v_row_pk;

    -- Write field_provenance rows for the fields we populated from the source.
    -- Trust layer = source_import (lowest of the 5-level hierarchy).
    INSERT INTO nex.accommodation_business_field_provenance
      (business_ref, field_name, trust_layer, written_by, source_reference)
    VALUES
      (v_public_ref, 'business_name',   'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key),
      (v_public_ref, 'category',        'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key),
      (v_public_ref, 'city',            'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
    ON CONFLICT (business_ref, field_name) DO NOTHING;

    IF v_lat IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance
        (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'coordinates', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_phone IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance
        (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'phone', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_website IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance
        (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'website', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_addr_full IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance
        (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'address', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_stars IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance
        (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'star_rating', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_rooms IS NOT NULL THEN
      INSERT INTO nex.accommodation_business_field_provenance
        (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'room_count', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF array_length(v_amenities, 1) IS NOT NULL AND array_length(v_amenities, 1) > 0 THEN
      INSERT INTO nex.accommodation_business_field_provenance
        (business_ref, field_name, trust_layer, written_by, source_reference)
      VALUES (v_public_ref, 'amenities', 'source_import', 'nex_workforce_v2:persist_to_accommodation_business', p_natural_key)
      ON CONFLICT DO NOTHING;
    END IF;

    ok := true; target_pk := v_row_pk::text; new_row := true; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- CASE B · 1 match → monotonic UPDATE
  SELECT internal_id, source_retrieved_at, source_evidence_id
    INTO v_existing_pk, v_existing_rt, v_existing_ev
    FROM nex.accommodation_business
   WHERE source = 'osm_overpass' AND source_reference = p_natural_key
   FOR UPDATE;

  -- Monotonic guard · newer wins, ties broken by evidence_id lex order
  IF v_existing_rt IS NOT NULL
  AND p_retrieved_at < v_existing_rt THEN
    ok := true; target_pk := v_existing_pk::text; new_row := false; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_existing_rt IS NOT NULL
  AND p_retrieved_at = v_existing_rt
  AND (v_existing_ev IS NULL OR p_evidence_id <= v_existing_ev) THEN
    ok := true; target_pk := v_existing_pk::text; new_row := false; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Monotonic update qualifies · apply
  UPDATE nex.accommodation_business
     SET business_name       = v_name,
         category            = v_category,
         address             = v_addr_full,
         city                = v_city,
         coordinates_lat     = v_lat,
         coordinates_lng     = v_lon,
         phone               = v_phone,
         website             = v_website,
         star_rating         = v_stars,
         room_count          = v_rooms,
         amenities           = v_amenities,
         source_checked_at   = p_retrieved_at,
         source_evidence_id  = p_evidence_id,
         source_retrieved_at = p_retrieved_at,
         dedupe_hash         = v_dedupe_hash
   WHERE internal_id = v_existing_pk;

  ok := true; target_pk := v_existing_pk::text; new_row := false; updated_row := true;
  rejected := false; rejection_reason := NULL;
  RETURN NEXT;
  RETURN;
END;
$body$;

COMMENT ON FUNCTION nex_workforce.persist_to_accommodation_business(text, uuid, integer, text, timestamptz, text, text, jsonb) IS
  'Slice A2 · production accommodation persister · SECURITY DEFINER · fenced by four-field work_item check. Owned by nex_workforce_persister_accommodation_business (NOLOGIN NOBYPASSRLS). Writes ONLY to nex.accommodation_business and its field_provenance table. Never writes to mock_target (structurally impossible via owner-role permissions).';

-- ═════════════════════════════════════════════════════════════════════════════
-- § 8 · Transfer function ownership to the persister role
-- ═════════════════════════════════════════════════════════════════════════════
RESET ROLE;

REVOKE ALL ON FUNCTION nex_workforce.persist_to_accommodation_business(text, uuid, integer, text, timestamptz, text, text, jsonb) FROM PUBLIC;
ALTER FUNCTION nex_workforce.persist_to_accommodation_business(text, uuid, integer, text, timestamptz, text, text, jsonb)
  OWNER TO nex_workforce_persister_accommodation_business;

-- Runtime callers hold no direct EXECUTE grant — they invoke via
-- nex_workforce.persist_batch(regprocedure) which resolves the persister by
-- name at call time. The regprocedure cast in persist_batch requires that
-- caller has USAGE on nex_workforce, not EXECUTE on the persister.

-- Ensure workforce admin can inspect and superuser can maintain
GRANT EXECUTE ON FUNCTION nex_workforce.persist_to_accommodation_business(text, uuid, integer, text, timestamptz, text, text, jsonb)
  TO nex_workforce_admin;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 8b · Revoke CREATE on nex_workforce (restore runtime USAGE-only)
-- ═════════════════════════════════════════════════════════════════════════════
REVOKE CREATE ON SCHEMA nex_workforce FROM nex_workforce_persister_accommodation_business;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 9 · Sanity check
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
DECLARE ok BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'nex_workforce' AND p.proname = 'persist_to_accommodation_business'
  ) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Slice A2 FAIL: persist_to_accommodation_business missing after migration'; END IF;

  SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_persister_accommodation_business') INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Slice A2 FAIL: nex_workforce_persister_accommodation_business role missing'; END IF;

  RAISE NOTICE 'Slice A2 complete: accommodation persister function + role + grants + policies + evidence-linkage columns in place';
END $body$;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- Rollback (in a separate transaction; run manually if needed):
--
--   BEGIN;
--     REVOKE ALL ON FUNCTION nex_workforce.persist_to_accommodation_business(text, uuid, integer, text, timestamptz, text, text, jsonb) FROM nex_workforce_admin;
--     DROP FUNCTION IF EXISTS nex_workforce.persist_to_accommodation_business(text, uuid, integer, text, timestamptz, text, text, jsonb);
--     DROP POLICY IF EXISTS accommodation_business_persister_insert ON nex.accommodation_business;
--     DROP POLICY IF EXISTS accommodation_business_persister_update ON nex.accommodation_business;
--     DROP POLICY IF EXISTS accommodation_business_persister_select ON nex.accommodation_business;
--     DROP POLICY IF EXISTS accommodation_business_brain_app_all   ON nex.accommodation_business;
--     DROP POLICY IF EXISTS accommodation_business_social_app_all  ON nex.accommodation_business;
--     DROP POLICY IF EXISTS accommodation_provenance_persister_all ON nex.accommodation_business_field_provenance;
--     REVOKE ALL ON nex.accommodation_business FROM nex_workforce_persister_accommodation_business;
--     REVOKE ALL ON nex.accommodation_business_field_provenance FROM nex_workforce_persister_accommodation_business;
--     REVOKE ALL ON nex_workforce.evidence_record FROM nex_workforce_persister_accommodation_business;
--     REVOKE ALL ON nex_workforce.work_item FROM nex_workforce_persister_accommodation_business;
--     REVOKE ALL ON nex_workforce.city_catalogue FROM nex_workforce_persister_accommodation_business;
--     REVOKE ALL ON SCHEMA nex, nex_workforce, extensions FROM nex_workforce_persister_accommodation_business;
--     DROP ROLE IF EXISTS nex_workforce_persister_accommodation_business;
--     ALTER TABLE nex.accommodation_business DISABLE ROW LEVEL SECURITY;
--     ALTER TABLE nex.accommodation_business DROP COLUMN IF EXISTS source_evidence_id;
--     ALTER TABLE nex.accommodation_business DROP COLUMN IF EXISTS source_retrieved_at;
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════
