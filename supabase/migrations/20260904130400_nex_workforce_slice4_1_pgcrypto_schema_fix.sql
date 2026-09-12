-- NEX Workforce v2 · Slice 4.1 · pgcrypto schema-resolution fix
-- ============================================================================
-- Author: Claude · Date: 2026-09-04
-- Governing authorization:
--   Philip 2026-09-04 · "NEX · MAINTENANCE SLICE 4.1 · PRODUCTION-SHAPE
--   PGCRYPTO / DIGEST SCHEMA-RESOLUTION FIX · HARD STOP · NO APPLY WITHOUT
--   EXPLICIT AUTHORIZATION"
-- Governing doctrine:
--   doctrine_nex_pgcrypto_extension_schema_2026_09_04.md
--   project_nex_slice4_1_gate_sequence_2026_09_04.md
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Why this migration exists
-- ─────────────────────────────────────────────────────────────────────────────
-- Gate 5A · Real-Overpass Proving Cycle #3 (2026-09-04) surfaced this defect:
--
--   catastrophic in persist_all:
--     unclassified: error: function public.digest(text, unknown) does not exist
--
-- Root cause:
--   Supabase Project B installs pgcrypto in schema `extensions`, not `public`.
--   Under hardened `search_path = pg_catalog, pg_temp`, both bare `digest(...)`
--   and `public.digest(...)` fail to resolve on Supabase. Portable PG17.11
--   installed pgcrypto into `public` by default which masked the defect.
--
-- Fix (explicit qualification per Philip 2026-09-04):
--   Every pgcrypto call in the workforce persister chain is rewritten to
--   `extensions.digest(...)` at the call site. No search_path is widened.
--   `public.` is never used. This makes the dependency textually obvious.
--
-- Scope · targets exactly THREE call sites identified by Slice 4.1 Part 1
-- inventory:
--   1. nex_workforce._crockford5(text)                    · line 351 in slice1h
--   2. nex_workforce.persist_to_food_business(...)        · line 533 in slice1h
--   3. nex_workforce.evidence_record.evidence_id_consistency CHECK · line 82 in slice1g
--
-- What this migration does NOT do
--   - No role changes · no grant changes · no RLS changes
--   - No schema DDL (columns/tables/indexes untouched)
--   - No pgcrypto install/relocate (Supabase already has extensions.pgcrypto)
--   - No changes to any other function
--   - No retry of Gate 5A · no workforce activation · no Scheduled Task
--
-- Invariants preserved
--   - SECURITY DEFINER on persist_to_food_business
--   - persist_to_food_business OWNER = nex_workforce_persister_food_business
--   - _crockford5 OWNER = postgres · IMMUTABLE · SECURITY INVOKER
--   - hardened search_path = pg_catalog, pg_temp on both functions
--   - REVOKE ALL FROM PUBLIC on persist_to_food_business
--   - COMMENT ON FUNCTION preserved
--   - evidence_record CHECK constraint invariant unchanged (only OID target
--     schema changes · byte-for-byte same semantics)
--   - persist_batch, stage_candidates, all other workforce functions unchanged
--
-- ─────────────────────────────────────────────────────────────────────────────
-- STAGED · NOT APPLIED TO PROJECT B
-- ─────────────────────────────────────────────────────────────────────────────
-- Filename lacks date prefix → will NOT auto-apply.
-- Rename to `2026MMDDHHMMSS_nex_workforce_slice4_1_pgcrypto_schema_fix.sql`
-- only AFTER Philip explicitly authorizes "APPLY SLICE 4.1 TO PROJECT B".

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
    RAISE EXCEPTION
      'Slice 4.1 preflight failed · pgcrypto must be installed in schema `extensions` before this migration runs. Detected: %',
      COALESCE((SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pgcrypto'), '(not installed)');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'nex_workforce' AND p.proname = 'persist_to_food_business'
  ) THEN
    RAISE EXCEPTION 'Slice 4.1 preflight failed · persist_to_food_business missing · apply Slice 1h R4 first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'nex_workforce' AND p.proname = '_crockford5'
  ) THEN
    RAISE EXCEPTION 'Slice 4.1 preflight failed · _crockford5 missing · apply Slice 1h R4 first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'evidence_id_consistency'
       AND conrelid = 'nex_workforce.evidence_record'::regclass
  ) THEN
    RAISE EXCEPTION 'Slice 4.1 preflight failed · evidence_id_consistency CHECK missing · apply Slice 1g first';
  END IF;
END $body$;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 1b · Grant USAGE on `extensions` schema to workforce roles that resolve
--        extensions.digest(). Without this the SECDEF chain hits "permission
--        denied for schema extensions" when the fix takes effect. Explicit
--        USAGE-only grants · no EXECUTE-any-function, no CREATE. Idempotent.
--
--        Roles needing USAGE:
--          - nex_workforce_admin
--              stage_candidates is SECDEF as admin · its INSERT into
--              evidence_record triggers the CHECK constraint that now calls
--              extensions.digest · admin must resolve the schema.
--          - nex_workforce_persister_food_business
--              persist_to_food_business is SECDEF as this role · it calls
--              extensions.digest directly (dedupe_hash) · it also invokes
--              _crockford5 which is SECURITY INVOKER · same digest call
--              runs as persister · persister must resolve extensions schema.
--
--        NOT granted (deliberately):
--          - nex_workforce_app (runtime EXECUTE-only role · never resolves
--            extensions.digest directly)
--          - nex_app_runtime (member of app · same reasoning)
--          - any other role
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_admin') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA extensions TO nex_workforce_admin';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_persister_food_business') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA extensions TO nex_workforce_persister_food_business';
  END IF;
END $body$;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 2 · _crockford5 · replace body with extensions.digest qualification
--
-- Function is owned by postgres · SECURITY INVOKER · IMMUTABLE. Preserved
-- byte-for-byte except for the single digest call.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION nex_workforce._crockford5(p_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $body$
DECLARE
  v_alpha text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; -- Crockford Base32 (no I, L, O, U)
  v_bytes bytea;
  v_num   numeric := 0;
  v_i     integer;
  v_out   text := '';
BEGIN
  -- Slice 4.1 (2026-09-04): fully-qualified as extensions.digest per Supabase
  -- pgcrypto placement · under hardened search_path = pg_catalog, pg_temp the
  -- explicit extensions.<fn> form is required · unqualified/`public`-schema
  -- variants fail on Supabase where pgcrypto lives in extensions.
  v_bytes := extensions.digest(p_input, 'sha256');
  FOR v_i IN 0..4 LOOP
    v_num := v_num * 256 + get_byte(v_bytes, v_i);
  END LOOP;
  FOR v_i IN 1..5 LOOP
    v_out := substring(v_alpha FROM ((v_num % 32)::integer + 1) FOR 1) || v_out;
    v_num := trunc(v_num / 32);
  END LOOP;
  RETURN v_out;
END;
$body$;

COMMENT ON FUNCTION nex_workforce._crockford5(text) IS
  'Deterministic 5-char Crockford Base32 hash for public_listing_ref suffix. Matches nex_food_business_public_ref_format_check (^#FL-YYYY-[A-HJKMNP-TV-Z0-9]{5}$). Slice 4.1: extensions.digest qualified.';

-- ═════════════════════════════════════════════════════════════════════════════
-- § 3 · persist_to_food_business · replace body with extensions.digest
--
-- The ONLY change vs Slice 1h R4 body is the single `public.digest(...)` call
-- in § 7.4 (dedupe_hash derivation) which becomes `extensions.digest(...)`.
-- Everything else is preserved byte-for-byte including all 7.x branches,
-- fence check, category enum, monotonic UPSERT, ownership, SECURITY DEFINER,
-- search_path.
--
-- CREATE OR REPLACE preserves existing OWNER · we do NOT re-ALTER OWNER.
-- CREATE OR REPLACE preserves existing REVOKE PUBLIC · we do NOT re-REVOKE.
-- CREATE OR REPLACE preserves existing COMMENT · we do NOT re-COMMENT.
-- (Docs: "CREATE OR REPLACE FUNCTION" preserves grants, owner, and comments
--  when the function signature is unchanged.)
--
-- PG 16+ ownership requirement · CREATE OR REPLACE on an existing function
-- requires the caller to be the OWNER (or a member of the owner's role with
-- SET permission). Under Supabase-managed postgres (rolsuper=false) and the
-- production-shape probe (nex_r4_probe INHERIT postgres), the direct call
-- fails with "must be owner of function persist_to_food_business" because
-- INHERIT does not chain through role membership admin-options.
--
-- Fix: temporarily re-grant CREATE on schema nex_workforce to the persister
-- (runtime state has USAGE only per Slice 1h R4 § 8b REVOKE) · SET LOCAL ROLE
-- to persister (owner) · CREATE OR REPLACE · RESET ROLE · REVOKE CREATE to
-- restore runtime posture. Same pattern as R4's own CREATE FUNCTION sequence.
--
-- Requires that the migration executor:
--   (a) owns nex_workforce schema (postgres on Project B · verified 2026-09-04)
--   (b) has SET option on persister role (postgres on Project B set_option=true)
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
  v_row_pk       uuid;
BEGIN
  -- ─── § 7.1 · Defense-in-depth fence check ─────────────────────────────────
  SELECT id, agent_id, generation, state
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

  -- ─── § 7.4 · Derive dedupe_hash (SLICE 4.1 · extensions.digest qualified) ─
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
  -- Slice 4.1 (2026-09-04): fully-qualified as extensions.digest per Supabase
  -- pgcrypto placement.
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

  IF v_match_count >= 2 THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('identity_ambiguous:%s_matches', v_match_count);
    RETURN NEXT;
    RETURN;
  END IF;

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
      'Yogyakarta',
      'ID',
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

  SELECT internal_id, source_retrieved_at, source_evidence_id
    INTO v_existing_pk, v_existing_rt, v_existing_ev
    FROM nex.food_business
   WHERE source = 'osm_overpass' AND source_reference = p_natural_key
   FOR UPDATE;

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
  'Slice 1h R4 + Slice 4.1 (extensions.digest) · target-specific persister · nex.food_business ONLY. SECURITY DEFINER runs as nex_workforce_persister_food_business (NOLOGIN, NOBYPASSRLS). RLS scopes writes to source=osm_overpass. Identity is (source, source_reference) with production canonical `<type>/<id>` format. Match-count branching: 0 → INSERT · 1 → monotonic UPDATE · ≥2 → REJECT identity_ambiguous. Legacy production duplicates untouched.';

-- Return to migration-executor role for subsequent DDL (§ 4 constraint DROP/ADD
-- runs as executor because nex_workforce.evidence_record is owned by postgres).
RESET ROLE;

-- Revoke the temporary CREATE grant so persister runtime state matches R4
-- doctrine (USAGE only · no CREATE at rest).
REVOKE CREATE ON SCHEMA nex_workforce FROM nex_workforce_persister_food_business;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 4 · evidence_record CHECK constraint · replace with extensions.digest
--
-- Historical note: the original constraint used unqualified `digest(...)` which
-- got OID-bound at CREATE TABLE time and continued to resolve after ALTER
-- EXTENSION SET SCHEMA. The explicit qualification removes the resolution
-- dependency and matches the Slice 4.1 doctrine that pgcrypto calls under
-- hardened search_path must be `extensions.<fn>(...)`.
--
-- DROP + ADD instead of ALTER because CHECK constraints cannot be altered in
-- place. This is a DDL-only change · zero rows read or written.
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE nex_workforce.evidence_record
  DROP CONSTRAINT evidence_id_consistency;

ALTER TABLE nex_workforce.evidence_record
  ADD CONSTRAINT evidence_id_consistency CHECK (
    evidence_id = encode(
      extensions.digest(
        work_item_id::text || '::' ||
        generation::text   || '::' ||
        query_hash         || '::' ||
        response_sha256,
        'sha256'
      ),
      'hex'
    )
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- § 5 · Postflight assertions
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
DECLARE
  v_persister_body text;
  v_crockford_body text;
  v_constraint_def text;
  v_persister_owner text;
  -- Slice 4.1 v2 (2026-09-04): OID-based CHECK verification variables.
  v_constraint_oid oid;
  v_digest_count   integer;
  v_digest_schema  text;
  v_digest_args    text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_persister_body
    FROM pg_proc
   WHERE pronamespace = 'nex_workforce'::regnamespace
     AND proname = 'persist_to_food_business';
  -- Strict actual-call-site checks (regex · ignores string tokens in comments)
  IF v_persister_body ~ 'public\.digest\s*\(' THEN
    RAISE EXCEPTION 'Slice 4.1 postflight FAILED · persist_to_food_business still calls public.digest(';
  END IF;
  IF v_persister_body !~ 'extensions\.digest\s*\(' THEN
    RAISE EXCEPTION 'Slice 4.1 postflight FAILED · persist_to_food_business missing extensions.digest(';
  END IF;

  SELECT pg_get_functiondef(oid) INTO v_crockford_body
    FROM pg_proc
   WHERE pronamespace = 'nex_workforce'::regnamespace
     AND proname = '_crockford5';
  IF v_crockford_body ~ 'public\.digest\s*\(' THEN
    RAISE EXCEPTION 'Slice 4.1 postflight FAILED · _crockford5 still calls public.digest(';
  END IF;
  IF v_crockford_body !~ 'extensions\.digest\s*\(' THEN
    RAISE EXCEPTION 'Slice 4.1 postflight FAILED · _crockford5 missing extensions.digest(';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Slice 4.1 v2 (2026-09-04): OID-based catalog verification of
  -- evidence_id_consistency's digest dependency · display-independent (does
  -- NOT use pg_get_constraintdef). The prior text-based assertion failed
  -- during the first Slice 4.1 apply attempt on Project B because Project B's
  -- default session search_path includes `extensions` and PostgreSQL reduces
  -- `extensions.digest(...)` to unqualified `digest(...)` in the rendered
  -- constraint text. That was a DISPLAY difference, not a semantic one · the
  -- OID-bound reference was correct all along.
  --
  -- Verification chain: pg_constraint → pg_depend → pg_proc → pg_namespace
  -- Expected: constraint depends on exactly ONE digest function whose
  -- containing schema is `extensions` and whose signature is (text, text).
  -- This assertion is strictly stronger than the previous text check because
  -- it verifies catalog identity (function OID resolution), which is the
  -- authoritative source · the previous check only verified rendered SQL.
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT oid INTO v_constraint_oid
    FROM pg_constraint
   WHERE conname = 'evidence_id_consistency'
     AND conrelid = 'nex_workforce.evidence_record'::regclass;
  IF v_constraint_oid IS NULL THEN
    RAISE EXCEPTION 'Slice 4.1 postflight FAILED · evidence_id_consistency constraint missing on nex_workforce.evidence_record';
  END IF;

  SELECT count(*) INTO v_digest_count
    FROM pg_depend d
    JOIN pg_proc p ON p.oid = d.refobjid
   WHERE d.classid    = 'pg_constraint'::regclass
     AND d.objid      = v_constraint_oid
     AND d.refclassid = 'pg_proc'::regclass
     AND p.proname    = 'digest';
  IF v_digest_count = 0 THEN
    RAISE EXCEPTION 'Slice 4.1 postflight FAILED · evidence_id_consistency has ZERO digest() dependencies · expected exactly 1 in schema extensions';
  END IF;
  IF v_digest_count > 1 THEN
    RAISE EXCEPTION 'Slice 4.1 postflight FAILED · evidence_id_consistency has % digest() dependencies · expected exactly 1', v_digest_count;
  END IF;

  SELECT n.nspname, pg_get_function_identity_arguments(p.oid)
    INTO v_digest_schema, v_digest_args
    FROM pg_depend d
    JOIN pg_proc p ON p.oid = d.refobjid
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE d.classid    = 'pg_constraint'::regclass
     AND d.objid      = v_constraint_oid
     AND d.refclassid = 'pg_proc'::regclass
     AND p.proname    = 'digest';

  IF v_digest_schema IS DISTINCT FROM 'extensions' THEN
    RAISE EXCEPTION 'Slice 4.1 postflight FAILED · evidence_id_consistency digest resolves to schema % · expected extensions', v_digest_schema;
  END IF;
  IF v_digest_args IS DISTINCT FROM 'text, text' THEN
    RAISE EXCEPTION 'Slice 4.1 postflight FAILED · evidence_id_consistency digest signature is (%) · expected (text, text)', v_digest_args;
  END IF;

  -- Ownership preserved
  SELECT rolname INTO v_persister_owner
    FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
   WHERE p.pronamespace = 'nex_workforce'::regnamespace
     AND p.proname = 'persist_to_food_business';
  IF v_persister_owner IS DISTINCT FROM 'nex_workforce_persister_food_business' THEN
    RAISE EXCEPTION 'Slice 4.1 postflight FAILED · persist_to_food_business owner changed · got: %', v_persister_owner;
  END IF;

  RAISE NOTICE 'Slice 4.1 postflight OK · extensions.digest wired (OID-verified) · ownership preserved';
END $body$;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 6 · DOWN migration (commented · uncomment to reverse)
-- ═════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- -- Reverse only the extensions.digest → public.digest change · not a real
-- -- rollback (would reintroduce the Supabase failure) · included for
-- -- symmetry only. Prefer forward-fix if this fix reveals a downstream defect.
-- ALTER TABLE nex_workforce.evidence_record DROP CONSTRAINT evidence_id_consistency;
-- ALTER TABLE nex_workforce.evidence_record ADD CONSTRAINT evidence_id_consistency CHECK (
--   evidence_id = encode(digest(work_item_id::text || '::' || generation::text || '::' || query_hash || '::' || response_sha256, 'sha256'), 'hex')
-- );
-- -- Restore R4 function bodies with public.digest ... (see _slice1h R4 for text)
-- COMMIT;
