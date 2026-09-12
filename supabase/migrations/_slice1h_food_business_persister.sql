-- NEX Workforce v2 · Slice 1h R4 · nex.food_business Persister
-- ============================================================================
-- REVISION 4 · PG 16+ ALTER FUNCTION OWNER schema-CREATE requirement fix · 2026-09-04
-- ----------------------------------------------------------------------------
-- Governing authorization:
--   Philip 2026-09-04 · "AUTHORIZE SLICE 1H R4 PREPARATION + VALIDATION ONLY"
-- Supersedes:
--   R3 · doctrine_nex_slice1h_r3_food_business_persister_locked_2026_09_04.md
--        (which superseded R2 · which superseded R1)
--
-- Reason R4 exists:
--   R3 correctly fixed the PG 16+ SET-option gap on CREATE ROLE. R3 was
--   applied to Project B and failed at the NEXT PostgreSQL 16+ requirement:
--
--     ERROR 42501: permission denied for schema nex_workforce
--
--   The failing statement was:
--     ALTER FUNCTION nex_workforce.persist_to_food_business(...)
--       OWNER TO nex_workforce_persister_food_business;
--
--   PostgreSQL requires the NEW owner role to hold CREATE privilege on the
--   function's schema at ownership-transfer time. R3 granted only USAGE on
--   nex_workforce to the persister. Portable postgres (rolsuper=true) bypassed
--   the CREATE requirement · Supabase-managed postgres (rolsuper=false) did not.
--
-- R4 fix · smallest possible correction:
--   1. Change `GRANT USAGE` → `GRANT USAGE, CREATE` on nex_workforce
--   2. After all ALTER FUNCTION OWNER complete, REVOKE CREATE from persister
--      so the RUNTIME persister role retains only USAGE (no CREATE)
--
-- Final runtime persister state (unchanged from R3 intent):
--   NOLOGIN + NOBYPASSRLS + USAGE nex/nex_workforce (no CREATE)
--
-- REVISION 3 header preserved for history:
-- REVISION 3 · PG 16+ CREATE ROLE / ALTER FUNCTION OWNER SET-option fix
--   Added: GRANT nex_workforce_persister_food_business TO CURRENT_USER WITH SET TRUE
-- Supersedes:
--   R2 · doctrine_nex_slice1h_r2_food_business_persister_locked_2026_09_04.md
--        (which superseded R1 · doctrine_nex_slice1h_food_business_persister_locked_2026_09_04.md)
--        (both superseded by R3 · which is superseded by R4)
--
-- Reason R3 exists:
--   R2 failed on Project B PG 17.6 with `ERROR 42501: must be able to SET ROLE
--   "nex_workforce_persister_food_business"` during the `ALTER FUNCTION ...
--   OWNER TO nex_workforce_persister_food_business` step.
--
--   Verified against Project B READ-ONLY:
--     Supabase-managed `postgres` role has `rolsuper = FALSE`.
--     PG 16+ CREATE ROLE grants the creator ADMIN OPTION but NOT SET OPTION.
--     ALTER FUNCTION ... OWNER TO <role> requires SET permission on that role.
--     pg_has_role('postgres', 'nex_brain_app', 'SET') = FALSE (existing evidence).
--     Portable PG 17.11 test cluster runs as full local superuser (rolsuper=t)
--     which historically had implicit SET, so R2 tests passed without exposing
--     the gap.
--
-- R3 is the SMALLEST possible fix:
--   ONE explicit GRANT statement between CREATE ROLE and ALTER FUNCTION OWNER
--   that grants the executing role the SET option on the newly created role.
--
-- Everything else in R2 is preserved byte-for-byte.
-- Original R2 header follows for context.
--
-- REVISION 2 · Production-Reality Reconciliation · 2026-09-04
-- ----------------------------------------------------------------------------
-- Governing authorization:
--   Philip 2026-09-04 · "SLICE 1H REVISION — PRODUCTION REALITY RECONCILIATION"
-- Previous doctrine: doctrine_nex_slice1h_food_business_persister_locked_2026_09_04.md
--   → SUPERSEDED by doctrine_nex_slice1h_r2_food_business_persister_locked_2026_09_04.md
--   → SUPERSEDED by doctrine_nex_slice1h_r3_food_business_persister_locked_2026_09_04.md
--
-- This revision replaces the R1 design after Slice 1g/1h Production Migration
-- Design Review discovered four RED FLAGs (RF-1..RF-4) that made the R1 design
-- incompatible with Project B production data:
--
--   RF-1  · 373 duplicate (source, source_reference) pairs in production
--   RF-2  · production source_reference format is `node/<id>` NOT `osm:node:<id>`
--   RF-3  · FORCE RLS with no policy for nex_brain_app/nex_social_app would
--          block existing legitimate application access to nex.food_business
--   RF-4  · production has 50 columns (portable had 39) · additional
--          worker_id, cycle_run_id, categories, country (NOT NULL no default),
--          location_confidence, geocode_evidence, etc.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- STAGED · PORTABLE VALIDATION ONLY · NOT APPLIED TO PROJECT B
-- ═════════════════════════════════════════════════════════════════════════════
-- Filename lacks date prefix → will NOT auto-apply to Project B.
-- Rename ONLY after Philip explicitly authorizes "APPLY SLICE 1H TO PROJECT B".
--
-- Compatible with Project B state:
--   PostgreSQL 17.6
--   nex.food_business  · 22,750 rows · RLS OFF · owner=postgres
--   direct CRUD grants: nex_brain_app + nex_social_app
--   existing indexes preserved (idx_nex_food_business_*, ix_food_business_source_ref)
--   50 columns preserved (only ADD COLUMN operations)
--   sources: osm_overpass (21,954) + openstreetmap_overpass_v1 (796)
--
-- Non-goals · this migration explicitly does NOT:
--   * dedupe the 373 duplicate identity groups (separate future slice)
--   * migrate source_reference format for existing data
--   * take ownership of openstreetmap_overpass_v1 rows
--   * modify existing columns
--   * modify existing indexes
--   * modify existing application grants
--   * FORCE ROW LEVEL SECURITY (owner would need admin policy; sufficient to enable)
--   * introduce Slice 3 roles (nex_workforce_admin, nex_workforce_app)
--
-- ═════════════════════════════════════════════════════════════════════════════
-- Design summary (see doctrine for full context)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- IDENTITY MODEL (RF-1 resolution):
--   The workforce uses (source='osm_overpass', source_reference=<canonical OSM>)
--   as its LOGICAL identity but does NOT enforce a UNIQUE INDEX (would fail on
--   the 373 existing duplicate groups). Instead the persister function
--   determines behavior by COUNTING matches at write time:
--
--     0 matches → INSERT new workforce-managed row
--     1 match   → monotonic UPDATE that row
--     ≥2 matches → REJECT candidate with reason='identity_ambiguous'
--                  (workforce refuses to guess between duplicates)
--
--   Legacy duplicate rows remain untouched. Future dedupe reconciliation is
--   a SEPARATE slice with human approval.
--
-- CANONICAL FORMAT (RF-2 resolution):
--   The persister accepts and produces production canonical `<type>/<id>`
--   format (node/12345, way/12345, relation/12345). Capability output aligned.
--   No existing production data is rewritten.
--
-- RLS DESIGN (RF-3 resolution):
--   ENABLE ROW LEVEL SECURITY (matches production convention · 92/93 nex.*
--   tables have RLS on). Do NOT FORCE (owner=postgres continues admin ops
--   via BYPASSRLS superuser status · matches 75/92 nex.* tables that ENABLE
--   without FORCE).
--
--   Policies:
--     * food_business_brain_app_all   PERMISSIVE FOR ALL TO nex_brain_app
--       USING(true) WITH CHECK(true) · JUSTIFICATION: preserves the existing
--       unrestricted CRUD semantic that nex_brain_app has today via direct
--       table grants. This is a semantic-equivalence policy · not a widening.
--     * food_business_social_app_all  same shape for nex_social_app · same
--       justification.
--     * food_business_persister_insert  RESTRICTIVE-shape (PERMISSIVE type but
--       narrowly scoped) FOR INSERT TO nex_workforce_persister_food_business
--       WITH CHECK (source='osm_overpass') · workforce cannot write rows with
--       any other source value.
--     * food_business_persister_update  same shape for UPDATE · both USING and
--       WITH CHECK.
--     * food_business_persister_select  same shape for SELECT.
--
--   No universal PUBLIC/anon policies. No BYPASSRLS grant. No FORCE.
--
-- PRODUCTION EXTRA COLUMNS (RF-4 resolution):
--   The persister function INSERT provides values for the six NOT-NULL-no-default
--   columns (public_listing_ref, business_name, category, source, dedupe_hash,
--   country). Every other column uses its production default or NULL. The
--   migration explicitly does not touch categories, country default, worker_id,
--   cycle_run_id, geocode_evidence, or any other pre-existing column.
--   country hardcoded to 'ID' (Indonesia ISO 3166-1 alpha-2 · matches CHECK
--   '^[A-Z]{2}$') because production workforce scope is Yogyakarta.

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 0 · Prereqs
-- ═════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'nex') THEN
    RAISE EXCEPTION 'nex schema missing · apply base schema first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'nex_workforce') THEN
    RAISE EXCEPTION 'nex_workforce schema missing · apply R4 first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='nex' AND tablename='food_business') THEN
    RAISE EXCEPTION 'nex.food_business missing · apply 054 base schema first';
  END IF;
END $body$;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 1 · Workforce provenance columns · additive · zero effect on existing rows
--
-- Both columns nullable. Existing 22,750 rows keep NULL for both.
-- Monotonic UPSERT explicitly treats NULL existing.source_retrieved_at as
-- bootstrap-writable, so future workforce runs can populate these fields on
-- rows that already exist.
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE nex.food_business
  ADD COLUMN IF NOT EXISTS source_evidence_id  text,
  ADD COLUMN IF NOT EXISTS source_retrieved_at timestamptz;

COMMENT ON COLUMN nex.food_business.source_evidence_id IS
  'Slice 1g/1h R2 · workforce provenance link · SHA-256 evidence_id in nex_workforce.evidence_record. Never modified except through nex_workforce.persist_to_food_business monotonic UPSERT.';
COMMENT ON COLUMN nex.food_business.source_retrieved_at IS
  'Slice 1g/1h R2 · workforce provenance · when SOURCE was fetched. Monotonic ordering key · newer wins in workforce updates.';

-- Provenance lookup index (partial · workforce-managed rows only)
CREATE INDEX IF NOT EXISTS idx_food_business_source_evidence
  ON nex.food_business (source_evidence_id)
  WHERE source_evidence_id IS NOT NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 2 · Identity model · NO NEW UNIQUE INDEX (RF-1 resolution)
--
-- The existing production index `ix_food_business_source_ref` on
-- (source, source_reference) WHERE source_reference IS NOT NULL is NON-UNIQUE
-- and is already suitable for the persister's lookup pattern. We rely on it
-- rather than creating a new index. The persister function explicitly counts
-- matches at write time and refuses to guess when ≥2 matches exist.
--
-- No CREATE UNIQUE INDEX. No touching existing indexes.
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- § 3 · Row Level Security · ENABLE only (NOT FORCE)
--
-- Matches production convention (92/93 nex.* tables have RLS on; only 17
-- social_* tables use FORCE). Owner=postgres continues admin operations via
-- superuser BYPASSRLS. Non-owner non-superuser roles are RLS-checked and need
-- explicit policies. Existing brain_app + social_app access is preserved by
-- semantic-equivalence PERMISSIVE policies.
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE nex.food_business ENABLE ROW LEVEL SECURITY;

-- Ensure NO leftover FORCE from any prior attempt
ALTER TABLE nex.food_business NO FORCE ROW LEVEL SECURITY;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 4 · Persister-owner role · least privilege · NOLOGIN NOBYPASSRLS
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_persister_food_business') THEN
    CREATE ROLE nex_workforce_persister_food_business NOLOGIN NOBYPASSRLS;
  END IF;
END $body$;
ALTER ROLE nex_workforce_persister_food_business NOLOGIN NOBYPASSRLS;

-- R3 fix · PG 16+ CREATE ROLE grants ADMIN OPTION but NOT the SET option.
-- The subsequent `ALTER FUNCTION persist_to_food_business OWNER TO
-- nex_workforce_persister_food_business` requires SET permission on the target
-- owner role (Postgres error 42501 · "must be able to SET ROLE").
-- Explicit GRANT WITH SET TRUE gives the current migration executor SET
-- capability without changing anything else. Not a widening: the executor
-- already has ADMIN OPTION from CREATE ROLE, so it could grant SET to itself.
-- This is idempotent (safe to re-apply) because GRANT ... WITH SET TRUE
-- upgrades the option if the membership already exists.
GRANT nex_workforce_persister_food_business TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;

-- Minimum grants required for the persister function's operation
--
-- R4 fix (Philip 2026-09-04): USAGE + CREATE on nex_workforce during migration.
-- PostgreSQL requires the NEW owner of a function to hold CREATE on the
-- containing schema at ALTER FUNCTION OWNER time. Portable postgres
-- (rolsuper=true) bypassed this · Supabase-managed postgres (rolsuper=false)
-- enforces it. CREATE is REVOKED at end of migration (see § 8b) so the
-- runtime persister role retains USAGE-only.
GRANT USAGE ON SCHEMA nex           TO nex_workforce_persister_food_business;
GRANT USAGE, CREATE ON SCHEMA nex_workforce TO nex_workforce_persister_food_business;

-- Persister writes food_business (INSERT/UPDATE) + reads for match count
GRANT SELECT, INSERT, UPDATE ON nex.food_business TO nex_workforce_persister_food_business;

-- Persister needs read on evidence_record for provenance joins in queries
GRANT SELECT ON nex_workforce.evidence_record TO nex_workforce_persister_food_business;

-- Fence check needs work_item SELECT + row-level FOR UPDATE lock
-- (SELECT FOR UPDATE requires UPDATE privilege parse-time check even though
-- the function body never issues an actual UPDATE against work_item)
GRANT SELECT, UPDATE ON nex_workforce.work_item TO nex_workforce_persister_food_business;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 5 · Policies · preserve existing application access + scope persister
--
-- brain_app + social_app policies use USING(true) WITH CHECK(true) with
-- explicit justification: they preserve the pre-existing unrestricted CRUD
-- semantic those roles have today via direct table grants. Enabling RLS
-- without matching policies would silently break those existing grants ·
-- these permissive policies are semantic-equivalence, NOT a widening.
--
-- The persister policies are narrowly scoped to source='osm_overpass'. The
-- persister role has NO other CRUD grants on any nex.* table (structural
-- isolation), so its writes cannot leak to unrelated targets.
-- ═════════════════════════════════════════════════════════════════════════════

-- Preserve existing brain_app CRUD semantic (SEMANTIC-EQUIVALENT · not widening)
DROP POLICY IF EXISTS food_business_brain_app_all ON nex.food_business;
CREATE POLICY food_business_brain_app_all
  ON nex.food_business
  AS PERMISSIVE
  FOR ALL
  TO nex_brain_app
  USING (true)
  WITH CHECK (true);

-- Preserve existing social_app CRUD semantic (SEMANTIC-EQUIVALENT · not widening)
DROP POLICY IF EXISTS food_business_social_app_all ON nex.food_business;
CREATE POLICY food_business_social_app_all
  ON nex.food_business
  AS PERMISSIVE
  FOR ALL
  TO nex_social_app
  USING (true)
  WITH CHECK (true);

-- Workforce persister · scoped writes only
DROP POLICY IF EXISTS food_business_persister_insert ON nex.food_business;
CREATE POLICY food_business_persister_insert
  ON nex.food_business
  AS PERMISSIVE
  FOR INSERT
  TO nex_workforce_persister_food_business
  WITH CHECK (source = 'osm_overpass');

DROP POLICY IF EXISTS food_business_persister_update ON nex.food_business;
CREATE POLICY food_business_persister_update
  ON nex.food_business
  AS PERMISSIVE
  FOR UPDATE
  TO nex_workforce_persister_food_business
  USING      (source = 'osm_overpass')
  WITH CHECK (source = 'osm_overpass');

DROP POLICY IF EXISTS food_business_persister_select ON nex.food_business;
CREATE POLICY food_business_persister_select
  ON nex.food_business
  AS PERMISSIVE
  FOR SELECT
  TO nex_workforce_persister_food_business
  USING (source = 'osm_overpass');

-- ═════════════════════════════════════════════════════════════════════════════
-- § 6 · _crockford5 · deterministic 5-char Crockford Base32 hash
--       Used to build public_listing_ref suffix. IMMUTABLE, pure computation.
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
  -- explicit extensions.<fn> form is required · public.digest fails on Supabase.
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
  'Deterministic 5-char Crockford Base32 hash for public_listing_ref suffix. Matches nex_food_business_public_ref_format_check (^#FL-YYYY-[A-HJKMNP-TV-Z0-9]{5}$).';

-- ═════════════════════════════════════════════════════════════════════════════
-- § 7 · persist_to_food_business · SECURITY DEFINER · one target · match-safe
--
-- Signature matches Slice 1g persist_batch contract:
--   (agent_id text, work_item_id uuid, generation integer,
--    evidence_id text, retrieved_at timestamptz,
--    source_slug text, natural_key text, payload_json jsonb)
--   → TABLE (ok, target_pk, new_row, updated_row, rejected, rejection_reason)
--
-- R2 rules (Philip 2026-09-04 Redesign):
--
--   NATURAL KEY FORMAT · canonical `<type>/<id>` matching production
--     ^(node|way|relation)/[0-9]+$ · else REJECTED 'invalid_source_reference'
--
--   CATEGORY MAPPING · closed enum:
--     amenity=restaurant → 'restaurant'
--     amenity=cafe       → 'coffee-cafe'
--     amenity=ice_cream  → 'ice-cream-dessert'
--     amenity=fast_food  → 'fast-food'
--     else               → REJECTED 'unknown_category:amenity=<value>'
--
--   MISSING NAME · REJECTED 'missing_name' (never invent)
--
--   IDENTITY MATCH COUNT · (source='osm_overpass', source_reference=natural_key)
--     0 matches → INSERT new row (workforce-managed from birth)
--     1 match   → monotonic UPDATE of that row
--     ≥2 matches → REJECTED 'identity_ambiguous:<n>_matches' (workforce refuses
--                  to guess between production duplicates · legacy data
--                  untouched · deferred to a separate reconciliation slice)
--
--   MONOTONIC RULE (when updating):
--     UPDATE only if EXCLUDED.source_retrieved_at > existing.source_retrieved_at
--     OR (equal AND EXCLUDED.source_evidence_id > existing.source_evidence_id)
--     OR existing.source_retrieved_at IS NULL (bootstrap of legacy rows)
--     Else · SILENT NO-OP (ok=true, updated_row=false)
--
--   COUNTRY · hardcoded 'ID' (Indonesia · matches production CHECK '^[A-Z]{2}$')
--     because Slice 1h scope is Yogyakarta (Indonesia only).
--
--   DEFENSE-IN-DEPTH FENCE · verifies four-field workforce fence even if
--   invoked directly by runtime (bypassing persist_batch). Requires SELECT
--   + UPDATE grant on nex_workforce.work_item.
-- ═════════════════════════════════════════════════════════════════════════════
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

  -- R2 · canonical production format `<type>/<id>` · NOT `osm:<type>:<id>`
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

  -- Missing name · REJECT (never invent)
  IF v_name IS NULL THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := 'missing_name';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Category mapping · REJECT if not in known map
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

  -- ─── § 7.4 · Derive dedupe_hash (COMPUTED · NOT workforce identity) ──────
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
  -- pgcrypto placement · same rationale as _crockford5.
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
  IF v_match_count = 0 THEN
    INSERT INTO nex.food_business (
      public_listing_ref,
      business_name,
      category,
      address,
      city,
      country,                  -- NOT NULL no default · hardcoded 'ID'
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
      'ID',                     -- R2 · required by production CHECK constraint
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
  SELECT internal_id, source_retrieved_at, source_evidence_id
    INTO v_existing_pk, v_existing_rt, v_existing_ev
    FROM nex.food_business
   WHERE source = 'osm_overpass' AND source_reference = p_natural_key
   FOR UPDATE;

  -- Monotonic guard · newer wins, ties broken by evidence_id lex order
  IF v_existing_rt IS NOT NULL
  AND p_retrieved_at < v_existing_rt THEN
    -- Older evidence · SILENT NO-OP
    ok := true; target_pk := v_existing_pk::text; new_row := false; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_existing_rt IS NOT NULL
  AND p_retrieved_at = v_existing_rt
  AND (v_existing_ev IS NULL OR p_evidence_id <= v_existing_ev) THEN
    -- Equal timestamp · inferior or equal evidence_id · SILENT NO-OP
    ok := true; target_pk := v_existing_pk::text; new_row := false; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Monotonic update qualifies · apply
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

-- ─── Ownership + revoke public ───────────────────────────────────────────────
-- R4 note: REVOKE ALL FROM PUBLIC must run BEFORE ALTER FUNCTION OWNER because
-- REVOKE requires ownership. The migration executor (postgres in production ·
-- probe in portable rehearsal) is the current owner (from CREATE FUNCTION),
-- so REVOKE succeeds. After REVOKE we transfer ownership to the persister
-- role. REVOKE persists across ownership change (ACL is a function attribute
-- independent of owner).
-- R4 · REVOKE PUBLIC + COMMENT ON FUNCTION both require ownership.
-- Do all owner-requiring operations WHILE the migration executor still owns
-- the function · THEN transfer ownership last. ACL + COMMENT both persist
-- across ownership change.
REVOKE ALL ON FUNCTION nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)
  FROM PUBLIC;

COMMENT ON FUNCTION nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb) IS
  'Slice 1h R4 · target-specific persister · nex.food_business ONLY. SECURITY DEFINER runs as nex_workforce_persister_food_business (NOLOGIN, NOBYPASSRLS). RLS scopes writes to source=osm_overpass. Identity is (source, source_reference) with production canonical `<type>/<id>` format. Match-count branching: 0 → INSERT · 1 → monotonic UPDATE · ≥2 → REJECT identity_ambiguous. Legacy production duplicates untouched.';

-- Ownership transfer LAST · after this, only the persister role owns the function
ALTER FUNCTION nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)
  OWNER TO nex_workforce_persister_food_business;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 8 · Revoke stale admin membership (Slice 3 pre-hardening safety · defensive)
--
-- Wrapped in EXCEPTION handler so this future-proof cleanup NEVER blocks the
-- migration. On Project B pre-Slice-3, nex_workforce_admin does not exist and
-- the outer IF skips entirely. On environments where nex_workforce_admin
-- exists but the current migration executor lacks admin_option on it (e.g.
-- portable rehearsal probes), the inner EXCEPTION silently no-ops with a
-- NOTICE. The actual security invariant · "persister never inherits admin"
-- is enforced by never GRANTING it in the first place, not by this defensive
-- REVOKE.
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_admin') THEN
    BEGIN
      EXECUTE 'REVOKE nex_workforce_admin FROM nex_workforce_persister_food_business';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipping admin-membership revoke · executor lacks admin_option on nex_workforce_admin · non-blocking';
    END;
  END IF;
END $body$;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 8b · R4 · REVOKE CREATE on nex_workforce from persister role
--
-- CREATE was granted in § 4 solely so PostgreSQL would allow the
-- `ALTER FUNCTION persist_to_food_business OWNER TO persister` step. All
-- ownership transfers are now complete · the runtime persister role no longer
-- needs CREATE on the schema. Runtime state: USAGE only.
--
-- Defense-in-depth: even if CREATE remained, persister is NOLOGIN + only
-- SECURITY DEFINER hard-coded functions can invoke it. But USAGE-only is
-- strictly cleaner and matches the R2 doctrine's runtime shape.
-- ═════════════════════════════════════════════════════════════════════════════
REVOKE CREATE ON SCHEMA nex_workforce FROM nex_workforce_persister_food_business;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 9 · Slice 3 runtime grants (COMMENTED · Slice 3 gate · Philip auth needed)
--
-- Runtime EXECUTE grant is added by Slice 3 migration, not here.
--
--   GRANT EXECUTE ON FUNCTION
--     nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)
--     TO nex_workforce_app;
--
-- IMPORTANT · runtime NOT a member of nex_workforce_persister_food_business.
-- Runtime gets EXECUTE on the SECURITY DEFINER function only. Table access
-- happens inside the function under the persister-owner role, subject to RLS.
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- § 10 · DOWN migration (COMMENTED · manual only if reversal ever needed)
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb);
-- DROP FUNCTION IF EXISTS nex_workforce._crockford5(text);
-- DROP POLICY  IF EXISTS food_business_persister_select ON nex.food_business;
-- DROP POLICY  IF EXISTS food_business_persister_update ON nex.food_business;
-- DROP POLICY  IF EXISTS food_business_persister_insert ON nex.food_business;
-- DROP POLICY  IF EXISTS food_business_social_app_all   ON nex.food_business;
-- DROP POLICY  IF EXISTS food_business_brain_app_all    ON nex.food_business;
-- ALTER TABLE  nex.food_business DISABLE ROW LEVEL SECURITY;
-- DROP INDEX   IF EXISTS nex.idx_food_business_source_evidence;
-- ALTER TABLE  nex.food_business
--   DROP COLUMN IF EXISTS source_retrieved_at,
--   DROP COLUMN IF EXISTS source_evidence_id;
-- REVOKE ALL ON nex.food_business             FROM nex_workforce_persister_food_business;
-- REVOKE ALL ON nex_workforce.evidence_record FROM nex_workforce_persister_food_business;
-- REVOKE ALL ON nex_workforce.work_item       FROM nex_workforce_persister_food_business;
-- REVOKE USAGE ON SCHEMA nex, nex_workforce   FROM nex_workforce_persister_food_business;
-- DROP ROLE IF EXISTS nex_workforce_persister_food_business;
-- COMMIT;
--
-- Irreversible operations · none, provided rollback happens BEFORE any
-- workforce writes to source_evidence_id. Once workforce runs succeed, the
-- DROP COLUMN cascade would lose provenance permanently.
-- ═════════════════════════════════════════════════════════════════════════════
