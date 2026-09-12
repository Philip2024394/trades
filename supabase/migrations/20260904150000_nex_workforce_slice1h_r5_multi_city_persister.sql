-- NEX Workforce v2 · Slice 1h R5 · Multi-city persister hardening
-- ============================================================================
-- Author: Claude · Date: 2026-09-04
-- Governing authorization:
--   Philip 2026-09-04 · "NEX · SLICE 1h R5 · MULTI-CITY PERSISTER HARDENING"
-- Discovered by: C6 preflight (city_catalogue seed authorization) found that
--   nex_workforce.persist_to_food_business() hardcodes city='Yogyakarta' in
--   its INSERT clause. Any work_item for a different city would silently
--   corrupt production data.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- What R5 does
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Grants persister role SELECT on nex_workforce.city_catalogue + adds a
--    permissive SELECT policy for the persister role
-- 2. CREATE OR REPLACE FUNCTION nex_workforce.persist_to_food_business
--    (same 8-parameter signature as R4 · SECDEF preserved · owner preserved
--     · hardened search_path preserved · REVOKE PUBLIC EXECUTE preserved
--     via CREATE OR REPLACE)
--    with 5 targeted body changes:
--      a. § 7.1 fence-read now selects city_slug too
--      b. NEW § 7.1b · derive authoritative city from
--         city_catalogue.name WHERE slug = work_item.city_slug
--         · REJECT 'city_not_registered:<slug>' if not found
--         · REJECT 'invalid_city' if name is empty/NULL/oversized
--      c. § 7.6b INSERT replaces literal 'Yogyakarta' with v_city
--      d. § 7.6c UPDATE preflight: if existing.city != v_city
--         → REJECT 'city_conflict:existing=X,new=Y' (identity-preserving)
--      e. All other logic (identity/dedupe/monotonic UPSERT/rejection reasons
--         /extensions.digest/created_by/etc.) preserved byte-for-byte-equivalent
--
-- ─────────────────────────────────────────────────────────────────────────────
-- What R5 does NOT do
-- ─────────────────────────────────────────────────────────────────────────────
--   * Does NOT modify signature (still 8 params · source-compatible)
--   * Does NOT modify identity model (source, source_reference unchanged)
--   * Does NOT modify dedupe_hash formula
--   * Does NOT modify category enum (still restaurant/coffee-cafe/etc.)
--   * Does NOT modify monotonic UPSERT rules
--   * Does NOT modify ownership (still nex_workforce_persister_food_business)
--   * Does NOT modify SECDEF/search_path/REVOKE PUBLIC
--   * Does NOT modify _crockford5 (unchanged from Slice 4.1 v2)
--   * Does NOT modify evidence_id_consistency CHECK (unchanged from Slice 4.1 v2)
--   * Does NOT touch city_catalogue rows (still empty · C6 remains gated)
--   * Does NOT touch job_registry (still 1 row · restaurants-overpass)
--   * Does NOT touch existing food_business rows (23,046 preserved)
--   * Does NOT retroactively re-city legacy rows
--   * Does NOT change RLS on food_business (still 5 policies)
--   * Does NOT change RLS on work_item (still fence-read policies from R2.2 v2)
--   * Does NOT change any admin/app/brain/social role
--
-- ─────────────────────────────────────────────────────────────────────────────
-- STAGED · NOT YET APPLIED TO PROJECT B
-- ─────────────────────────────────────────────────────────────────────────────
-- Filename lacks date prefix. Apply wrapper renames to date-prefixed form
-- after portable rehearsal passes and Philip authorizes APPLY.

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 1 · Pre-flight assertions
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'pgcrypto' AND n.nspname = 'extensions'
  ) THEN
    RAISE EXCEPTION 'R5 preflight FAIL · pgcrypto must be in extensions (Slice 4.1 v2)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_persister_food_business') THEN
    RAISE EXCEPTION 'R5 preflight FAIL · persister role missing · apply Slice 1h R4 first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'nex_workforce' AND p.proname = 'persist_to_food_business'
  ) THEN
    RAISE EXCEPTION 'R5 preflight FAIL · persist_to_food_business missing · apply Slice 1h R4 first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'nex_workforce' AND table_name = 'work_item' AND column_name = 'city_slug'
  ) THEN
    RAISE EXCEPTION 'R5 preflight FAIL · work_item.city_slug column missing · apply Slice 1 first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'nex_workforce' AND table_name = 'city_catalogue'
  ) THEN
    RAISE EXCEPTION 'R5 preflight FAIL · city_catalogue table missing · apply Slice 1 first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'nex_workforce' AND table_name = 'city_catalogue' AND column_name = 'name'
  ) THEN
    RAISE EXCEPTION 'R5 preflight FAIL · city_catalogue.name column missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'nex_workforce' AND table_name = 'city_catalogue' AND column_name = 'slug'
  ) THEN
    RAISE EXCEPTION 'R5 preflight FAIL · city_catalogue.slug column missing';
  END IF;
END $body$;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 2 · Grant persister SELECT on city_catalogue + add persister RLS policy
--
-- The R5 persister must be able to look up city_catalogue.name from the
-- work_item.city_slug during its SECDEF execution. The persister currently
-- has neither the SELECT grant nor a policy that covers it. Add both, scoped
-- to this exact table + this exact role. No broadening.
-- ═════════════════════════════════════════════════════════════════════════════
GRANT SELECT ON nex_workforce.city_catalogue TO nex_workforce_persister_food_business;

-- Add a narrow SELECT policy for the persister role.
-- USING (true) is safe here: city_catalogue is a small, non-sensitive
-- configuration table. The information (city slugs + bboxes) is derived
-- from public geographic data. No PII. This mirrors the wa_city_catalogue_select
-- policy shape (also USING true), differing only in target role.
DROP POLICY IF EXISTS wp_food_business_city_catalogue_select ON nex_workforce.city_catalogue;
CREATE POLICY wp_food_business_city_catalogue_select
  ON nex_workforce.city_catalogue
  AS PERMISSIVE
  FOR SELECT
  TO nex_workforce_persister_food_business
  USING (true);

-- ═════════════════════════════════════════════════════════════════════════════
-- § 3 · CREATE OR REPLACE persist_to_food_business with city-aware body
--
-- CREATE OR REPLACE preserves existing OWNER, existing REVOKE ALL FROM PUBLIC,
-- and existing COMMENT ON FUNCTION. Same PG 16+ ownership pattern as
-- Slice 4.1 v2: temporary GRANT CREATE on schema · SET LOCAL ROLE persister
-- · CREATE OR REPLACE runs as owner (satisfies "must be owner of function")
-- · RESET ROLE · REVOKE CREATE (restore runtime USAGE-only).
-- ═════════════════════════════════════════════════════════════════════════════
GRANT CREATE ON SCHEMA nex_workforce TO nex_workforce_persister_food_business;

SET LOCAL ROLE nex_workforce_persister_food_business;

CREATE OR REPLACE FUNCTION nex_workforce.persist_to_food_business(
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
  v_amenity      text;
  v_category     text;
  v_lat          numeric;
  v_lon          numeric;
  v_phone        text;
  v_website      text;
  v_addr_street  text;
  v_addr_city    text;
  v_addr_full    text;
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
  v_existing_city text;
  v_row_pk       uuid;
  -- Slice 1h R5 · authoritative city derivation
  v_city         text;
BEGIN
  -- ─── § 7.1 · Defense-in-depth fence check ─────────────────────────────────
  -- R5: also select city_slug so we can derive authoritative city.
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

  -- ─── § 7.1b · Slice 1h R5 · Authoritative city derivation ─────────────────
  -- The persister derives the city display name from the fenced work_item's
  -- city_slug via city_catalogue lookup. The OSM payload's addr:city tag is
  -- used only for the address string (v_addr_city), NEVER for the city column.
  -- If the work_item's city_slug is not registered in city_catalogue, the
  -- persist FAILS CLOSED (no default, no fallback). This prevents any silent
  -- data corruption if an orchestrator ever enqueues a work_item whose city
  -- isn't in the registered production catalogue.
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

  -- Defense-in-depth: reject empty / whitespace-only / oversized city names.
  -- The food_business.city column has no explicit length CHECK, so bound
  -- defensively at 200 characters (well beyond any real Indonesian city name).
  IF btrim(v_city) = '' OR length(v_city) > 200 THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('invalid_city:slug=%s,name_len=%s', v_wi_row.city_slug, length(COALESCE(v_city, '')));
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.2 · Source-slug + natural-key contract validation ────────────────
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

  -- ─── § 7.3 · Extract candidate fields ─────────────────────────────────────
  v_name        := NULLIF(btrim(p_payload_json #>> '{tags,name}'), '');
  v_amenity     := lower(NULLIF(p_payload_json #>> '{tags,amenity}', ''));
  v_lat         := NULLIF(p_payload_json ->> 'lat', '')::numeric;
  v_lon         := NULLIF(p_payload_json ->> 'lon', '')::numeric;
  v_phone       := NULLIF(p_payload_json #>> '{tags,phone}', '');
  v_website     := NULLIF(p_payload_json #>> '{tags,website}', '');
  v_addr_street := NULLIF(p_payload_json #>> '{tags,addr:street}', '');
  -- addr:city is used ONLY for the address string · NEVER for the city column
  v_addr_city   := NULLIF(p_payload_json #>> '{tags,addr:city}', '');

  IF v_name IS NULL THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := 'missing_name';
    RETURN NEXT;
    RETURN;
  END IF;

  v_category := CASE v_amenity
    WHEN 'restaurant' THEN 'restaurant'
    WHEN 'cafe'       THEN 'coffee-cafe'
    WHEN 'ice_cream'  THEN 'ice-cream-dessert'
    WHEN 'fast_food'  THEN 'fast-food'
    ELSE NULL
  END;

  IF v_category IS NULL THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := format('unknown_category:amenity=%s', COALESCE(v_amenity, 'NULL'));
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.4 · Derive dedupe_hash (SLICE 4.1 v2 · extensions.digest) ────────
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

  -- ─── § 7.5 · Derive address text + public_listing_ref ────────────────────
  v_addr_full := NULLIF(btrim(
    COALESCE(v_addr_street, '')
    || CASE WHEN v_addr_city IS NOT NULL THEN ', ' || v_addr_city ELSE '' END
  ), '');
  v_public_ref := '#FL-' || to_char(p_retrieved_at, 'YYYY') || '-' || nex_workforce._crockford5(p_natural_key);

  -- ─── § 7.6 · Match count · 0 / 1 / >=2 branching (RF-1 resolution) ───────
  SELECT count(*)::integer INTO v_match_count
    FROM nex.food_business
   WHERE source = 'osm_overpass' AND source_reference = p_natural_key;

  -- ─── § 7.6a · CASE C · ≥2 matches → REJECT identity_ambiguous ────────────
  IF v_match_count >= 2 THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('identity_ambiguous:%s_matches', v_match_count);
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.6b · CASE A · 0 matches → INSERT ─────────────────────────────────
  -- R5: city column now takes v_city (authoritative from work_item · not hardcoded)
  IF v_match_count = 0 THEN
    INSERT INTO nex.food_business (
      public_listing_ref,
      business_name,
      category,
      address,
      city,
      country,
      coordinates_lat,
      coordinates_lng,
      phone,
      website,
      source,
      source_reference,
      source_ingested_at,
      source_checked_at,
      source_licence_terms,
      source_evidence_id,
      source_retrieved_at,
      dedupe_hash,
      hero_image_url,
      hero_image_source,
      hero_image_approved,
      created_by
    ) VALUES (
      v_public_ref,
      v_name,
      v_category,
      v_addr_full,
      v_city,                                       -- R5 · authoritative from city_catalogue
      'ID',                                         -- Indonesia · unchanged from R4
      v_lat,
      v_lon,
      v_phone,
      v_website,
      'osm_overpass',
      p_natural_key,
      now(),
      p_retrieved_at,
      'openstreetmap:odbl-1.0',
      p_evidence_id,
      p_retrieved_at,
      v_dedupe_hash,
      NULL,
      NULL,
      false,
      'nex_workforce_v2:persist_to_food_business'
    )
    RETURNING internal_id INTO v_row_pk;

    ok := true; target_pk := v_row_pk::text; new_row := true; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.6c · CASE B · 1 match → monotonic UPDATE ────────────────────────
  -- R5: also read existing.city to enforce identity-preserving city check.
  -- If existing.city differs from authoritative v_city, REJECT (do NOT
  -- rewrite city as a monotonic field · Section 8: preserve identity model).
  SELECT internal_id, source_retrieved_at, source_evidence_id, city
    INTO v_existing_pk, v_existing_rt, v_existing_ev, v_existing_city
    FROM nex.food_business
   WHERE source = 'osm_overpass' AND source_reference = p_natural_key
   FOR UPDATE;

  -- R5 · identity-preserving city check
  IF v_existing_city IS DISTINCT FROM v_city THEN
    ok := false; target_pk := v_existing_pk::text; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('city_conflict:existing=%s,new=%s', COALESCE(v_existing_city, 'NULL'), v_city);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Monotonic guard · newer wins, ties broken by evidence_id lex order (unchanged from R4)
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

  -- UPDATE proceeds · city intentionally omitted from SET clause (already
  -- validated equal to v_city above · would be idempotent no-op anyway).
  UPDATE nex.food_business
     SET business_name       = v_name,
         category            = v_category,
         address             = v_addr_full,
         coordinates_lat     = v_lat,
         coordinates_lng     = v_lon,
         phone               = v_phone,
         website             = v_website,
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

COMMENT ON FUNCTION nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb) IS
  'Slice 1h R4 + Slice 4.1 v2 + R5 · target-specific persister · nex.food_business ONLY. SECURITY DEFINER runs as nex_workforce_persister_food_business (NOLOGIN, NOBYPASSRLS). RLS scopes writes to source=osm_overpass. Identity is (source, source_reference) with production canonical `<type>/<id>` format. City is authoritative from nex_workforce.work_item.city_slug via nex_workforce.city_catalogue lookup (R5) · REJECTS city_not_registered / invalid_city / city_conflict. Match-count branching: 0 → INSERT · 1 → monotonic UPDATE · ≥2 → REJECT identity_ambiguous. Legacy production duplicates untouched. dedupe_hash via extensions.digest (Slice 4.1 v2).';

RESET ROLE;

-- Revoke the temporary CREATE grant so persister runtime state matches R4
-- doctrine (USAGE only · no CREATE at rest).
REVOKE CREATE ON SCHEMA nex_workforce FROM nex_workforce_persister_food_business;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 4 · Postflight assertions
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
DECLARE
  v_persister_body text;
  v_persister_owner text;
  v_persister_secdef boolean;
  v_persister_config text[];
  v_has_ext_digest boolean;
  v_has_public_digest boolean;
  v_has_city_slug_ref boolean;
  v_has_city_catalogue_ref boolean;
  v_has_hardcoded_yogya_insert boolean;
  v_persister_has_cc_select boolean;
  v_persister_policy_exists boolean;
  v_persister_no_create boolean;
BEGIN
  SELECT pg_get_functiondef(oid),
         (SELECT rolname FROM pg_roles WHERE oid = proowner),
         prosecdef,
         proconfig
    INTO v_persister_body, v_persister_owner, v_persister_secdef, v_persister_config
    FROM pg_proc
   WHERE pronamespace = 'nex_workforce'::regnamespace
     AND proname = 'persist_to_food_business';

  -- Static · authoritative city derivation is in the body
  v_has_city_slug_ref := v_persister_body ~ 'v_wi_row\.city_slug';
  IF NOT v_has_city_slug_ref THEN
    RAISE EXCEPTION 'R5 postflight FAIL · persister body does not reference v_wi_row.city_slug (R5 fence-read extension)';
  END IF;

  v_has_city_catalogue_ref := v_persister_body ~ 'nex_workforce\.city_catalogue';
  IF NOT v_has_city_catalogue_ref THEN
    RAISE EXCEPTION 'R5 postflight FAIL · persister body does not reference nex_workforce.city_catalogue (R5 lookup)';
  END IF;

  -- Static · no hardcoded 'Yogyakarta' anywhere in the INSERT VALUES clause.
  -- The INSERT column for city is provided by v_city; the literal 'Yogyakarta'
  -- must not appear on any INSERT value line.
  v_has_hardcoded_yogya_insert := v_persister_body ~ E'VALUES[^;]*''Yogyakarta''';
  IF v_has_hardcoded_yogya_insert THEN
    RAISE EXCEPTION 'R5 postflight FAIL · persister body still has hardcoded ''Yogyakarta'' literal in an INSERT VALUES clause';
  END IF;

  -- Slice 4.1 v2 invariants preserved
  v_has_ext_digest := v_persister_body ~ 'extensions\.digest\s*\(';
  IF NOT v_has_ext_digest THEN
    RAISE EXCEPTION 'R5 postflight FAIL · persister body missing extensions.digest (Slice 4.1 v2 regression)';
  END IF;
  v_has_public_digest := v_persister_body ~ 'public\.digest\s*\(';
  IF v_has_public_digest THEN
    RAISE EXCEPTION 'R5 postflight FAIL · persister body reintroduces public.digest (Slice 4.1 v2 regression)';
  END IF;

  -- Security posture preserved
  IF v_persister_owner IS DISTINCT FROM 'nex_workforce_persister_food_business' THEN
    RAISE EXCEPTION 'R5 postflight FAIL · persister owner changed · got: %', v_persister_owner;
  END IF;
  IF v_persister_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'R5 postflight FAIL · persister no longer SECURITY DEFINER';
  END IF;
  IF NOT (v_persister_config @> ARRAY['search_path=pg_catalog, pg_temp']::text[]) THEN
    RAISE EXCEPTION 'R5 postflight FAIL · persister search_path changed · got: %', v_persister_config;
  END IF;

  -- Grant + policy added
  v_persister_has_cc_select := has_table_privilege('nex_workforce_persister_food_business', 'nex_workforce.city_catalogue', 'SELECT');
  IF NOT v_persister_has_cc_select THEN
    RAISE EXCEPTION 'R5 postflight FAIL · persister does not have SELECT on nex_workforce.city_catalogue';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid = 'nex_workforce.city_catalogue'::regclass
       AND polname = 'wp_food_business_city_catalogue_select'
  ) INTO v_persister_policy_exists;
  IF NOT v_persister_policy_exists THEN
    RAISE EXCEPTION 'R5 postflight FAIL · wp_food_business_city_catalogue_select policy missing';
  END IF;

  -- Transient CREATE was revoked (persister back to USAGE-only)
  v_persister_no_create := NOT has_schema_privilege('nex_workforce_persister_food_business', 'nex_workforce', 'CREATE');
  IF NOT v_persister_no_create THEN
    RAISE EXCEPTION 'R5 postflight FAIL · persister still has CREATE on nex_workforce · REVOKE step failed';
  END IF;

  RAISE NOTICE 'R5 postflight OK · city derived from work_item.city_slug via city_catalogue · Slice 4.1 v2 preserved · SECDEF/owner/search_path preserved · no hardcoded Yogyakarta in INSERT · CREATE revoked · grant + policy in place';
END $body$;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 5 · DOWN migration (commented · uncomment to reverse)
-- ═════════════════════════════════════════════════════════════════════════════
-- Reverting R5 would restore the hardcoded-city hazard. Only do this if R5
-- introduces a downstream regression. Prefer forward-fix.
--
-- BEGIN;
--   GRANT CREATE ON SCHEMA nex_workforce TO nex_workforce_persister_food_business;
--   SET LOCAL ROLE nex_workforce_persister_food_business;
--   -- Restore R4/Slice 4.1 v2 body (with hardcoded 'Yogyakarta') · see
--   -- supabase/migrations/20260904130400_nex_workforce_slice4_1_pgcrypto_schema_fix.sql
--   -- for the pre-R5 body text.
--   -- CREATE OR REPLACE FUNCTION nex_workforce.persist_to_food_business(...) ...
--   RESET ROLE;
--   REVOKE CREATE ON SCHEMA nex_workforce FROM nex_workforce_persister_food_business;
--   DROP POLICY IF EXISTS wp_food_business_city_catalogue_select ON nex_workforce.city_catalogue;
--   REVOKE SELECT ON nex_workforce.city_catalogue FROM nex_workforce_persister_food_business;
-- COMMIT;
