-- 167_nex_business_canonical.sql
--
-- NEX Directory Canonical Spine · migration 2 of 12.
-- Phase 1 of the N=7-primitive architecture founder-sealed 2026-10-07.
-- (See memory: project_nex_directory_spine_sealed_2026_10_07.md)
--
-- CREATES
--   nex.business_canonical — one row per real-world business or
--   place. The stable identity above the four legacy vertical tables
--   (food_business · accommodation_business · service_business ·
--   mp_seller) + the owner-controlled nex_business (Supabase side).
--   Every downstream spine primitive (evidence · media · conflict ·
--   claim) FKs its rows into this table.
--
-- SEALED SHAPE (Audit #5 Section B, founder-approved 2026-10-07;
-- revised 2026-10-07 after design-review).
--
-- WHAT THIS TABLE IS
--   · One row per real-world entity.
--   · A hotel chain with 10 properties = 10 rows (one per property).
--   · A ghost-kitchen operating 2 public brand names = 2 rows.
--   · A service company trading under 3 domains with aligned phone +
--     address = 1 row (extras in aliases).
--   · Identity is columns on this row (name_canonical, name_norm,
--     aliases, phone_e164, website_apex, osm_id, wikidata_qid,
--     country, city, coordinates). ADR-0022: identity-is-canonical.
--
-- WHAT THIS TABLE IS NOT
--   · Not a presentation projection (that's business_directory_v,
--     migration 175, downstream).
--   · Not a search result (search reads via the view).
--   · Not a claimed account (nex_business is the owner-controlled
--     profile and will carry a canonical_business_id FK added in a
--     later migration · not here · the two live in different DBs).
--
-- entity_type · the sealed 9-value enum
--   food                  — a place serving food or drink to customers at its own address
--   accommodation         — a place offering overnight stays
--   service               — a place-based service business (OSM-discoverable: gyms, salons, dentists, opticians, pharmacies, car-repair, trades-with-shopfront)
--   professional          — a service provider whose offering is the person's expertise (consultants, agencies, freelancers, mobile trades)
--   vehicle_rental        — a business renting vehicles at a fixed base location (motorbikes, cars, scooters, boats; vehicle class belongs in category_ids)
--   marketplace_seller    — a seller offering products through the NEX marketplace, keyed to a NEX account rather than to coordinates
--   transport_driver      — a natural person offering transport under the migration 091 legal model
--   transport_operator    — a bus, taxi, ferry, shuttle or other transport company (legal entity, not a natural person)
--   place                 — a public or semi-public location with cultural, natural, or civic significance, not primarily a claimable business (attractions, temples, landmarks, parks)
--
-- ARCHITECTURAL RULE (founder-sealed 2026-10-07)
--   entity_type is the canonical real-world identity class · it is
--   NOT the public NEX Search category taxonomy. Public categories
--   (Restaurants, Cafés & Coffee, Bars & Nightlife, Hotels, Villas,
--   Motorbike Rental, Car Rental, Shops, Manufacturers, Wholesale,
--   Trade Services, Professional Services, Attractions, Activities,
--   Events & Venues, etc.) belong to a separate taxonomy/presentation
--   concern surfaced through category_ids and the eventual directory
--   projection at migration 175. Do NOT add public-category values
--   to entity_type.
--
-- lifecycle_state · the sealed 7-value enum
--   DISCOVERED       — just appeared (walker found or legacy row backfilled)
--   ENRICHED         — ≥1 non-identity evidence row has landed
--   VERIFIED         — multi-source agreement OR admin confirmation
--   OWNER_CLAIMED    — a claim action has been accepted
--   OWNER_VERIFIED   — admin / verified_note recorded for the claim
--   DORMANT          — fresh evidence older than 24 months (reversible)
--   SUPERSEDED       — merged into another canonical (terminal · points via superseded_by_business_id)
--
-- DECISIONS DELIBERATELY NOT IN 167 (ship in later migrations)
--   · canonical_business_id FK backfilled onto legacy *_business tables → migration 169
--   · nex_business.canonical_business_id (Supabase-side) → separate migration, cross-DB handling
--   · public category taxonomy reconciliation → post-175
--   · business_evidence FK to canonical → migration 170
--   · business_media FK to canonical → migration 173
--   · business_fact_conflict FK to canonical → migration 174
--   · business_claim (universal, generalising food_claim_code) → migration 176
--   · business_directory_v view + GRANT/REVOKE sweep → migration 175
--   · nex.license_registry (deferred architectural item · do NOT create here)
--
-- IDEMPOTENCY
--   CREATE EXTENSION IF NOT EXISTS pgcrypto / pg_trgm.
--   CREATE SCHEMA IF NOT EXISTS nex.
--   CREATE OR REPLACE FUNCTION nex.name_norm(text).
--   CREATE TABLE IF NOT EXISTS.
--   CREATE INDEX IF NOT EXISTS for every index.
--   No DML. Safe to re-run.
--
-- ROLLBACK
--   DROP TABLE nex.business_canonical;
--   DROP FUNCTION nex.name_norm(text);
--   (No FKs point at this table yet — spine root for primitives 2–7.)
--
-- SAFE ON POPULATED DB
--   Yes. New table. No ALTERs to existing tables. No GRANT/REVOKE on
--   existing tables. Zero impact on any current reader or writer.
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITE · PostGIS
-- ═══════════════════════════════════════════════════════════════════
-- This migration uses `geography(Point, 4326)` for the `coordinates`
-- column and a GIST index over it. Both require the PostGIS extension
-- to be installed on the target database BEFORE 167 is applied.
--
-- On apply against a vanilla PostgreSQL instance without PostGIS, 167
-- will fail with:
--     ERROR:  type "geography" does not exist
-- …before any row lands.
--
-- `CREATE EXTENSION postgis` is intentionally NOT in this migration
-- because PostGIS requires a shared_preload step on some platforms
-- (and a dashboard click + role grant on managed services such as
-- Supabase). The deployment-window runbook that authorises 167 MUST
-- explicitly verify PostGIS presence before executing this file.
--
-- Do NOT change the geography architecture to work around a missing
-- PostGIS install — the GIST + geography(Point, 4326) shape is
-- founder-sealed as the correct foundation for Phase D radius /
-- "near me" discovery.
--
-- NOT APPLIED
--   Phase 1 of the sealed architecture. MUST NOT be applied to any
--   live database without an explicit founder authorisation of the
--   deployment window. Migration is authored but awaits scheduled
--   execution.


CREATE SCHEMA IF NOT EXISTS nex;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- NB: PostGIS is required for the geography(Point,4326) column + GIST
-- index below. CREATE EXTENSION IF NOT EXISTS postgis is intentionally
-- left to the deployer (see header "DEPLOYMENT PREREQUISITE" block).

-- ═══════════════════════════════════════════════════════════════════
-- nex.name_norm(text) — the canonical name-normalization function
-- ═══════════════════════════════════════════════════════════════════
--
-- Mirrors the TypeScript resolver's normalization at
--   src/lib/nex/entity-universe/identity-matching.ts : normName()
-- so the DB-stored `name_norm` column and the TS resolver's in-memory
-- normalization produce identical output on identical input.
--
-- Algorithm (matches TS line-for-line):
--   1. Lowercase (ASCII-aware · Unicode letters unchanged by Postgres
--      lower() for the Latin corpus NEX targets).
--   2. Strip ASCII apostrophe (U+0027) + Unicode smart quotes
--      U+2018 (‘) and U+2019 (’).  (TS uses `replace(/[‘’']/g, "")`.)
--   3. Replace every character that is NOT ASCII [a-z0-9] or
--      whitespace with a SPACE.  (TS uses `replace(/[^a-z0-9\s]/g, " ")`.)
--      - Non-ASCII letters (é, ü, ñ, 日, etc.) become spaces.
--      - Punctuation (-, —, –, ·, .) becomes spaces.
--      - This matches the TS behaviour that non-ASCII-alnum is NOT
--        silently deleted · it becomes a boundary.
--   4. Collapse runs of whitespace to a single space.
--      (TS uses `replace(/\s+/g, " ")`.)
--   5. Trim.
--
-- Test cases (semantic contract · verified against TS):
--   'Hello World'         → 'hello world'
--   "Jerry's Café"        → 'jerrys caf'
--   '‘Area 51’'           → 'area 51'
--   'Hello   World'       → 'hello world'
--   '  spaced  '          → 'spaced'
--   'Café — Du Lac'       → 'caf du lac'
--   '日本橋 Sushi'         → 'sushi'
--   ''                    → ''
--
-- Volatility: IMMUTABLE — depends only on the input text + Postgres
--             lower() which is treated as deterministic for the Latin
--             corpus NEX targets. If a future deployment needs
--             Turkish-dotted-I semantics (İ/ı) the function body
--             should be revisited.
-- STRICT    : NULL input returns NULL · the generated column source
--             (`name_canonical`) is NOT NULL so this branch is unreachable
--             from the generated column call site but matters for
--             direct function calls.
--
-- WHY as a function rather than inline:
--   TS and SQL must share ONE provable semantic contract. A function
--   makes the invariant testable from either side · 169 backfill can
--   call it; downstream unit tests can assert its output; and if the
--   contract ever needs to evolve, both callers follow the same
--   change.

CREATE OR REPLACE FUNCTION nex.name_norm(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        replace(
          replace(
            replace(
              lower(input),
              U&'\2018', ''              -- strip U+2018 left single quotation mark
            ),
            U&'\2019', ''                -- strip U+2019 right single quotation mark
          ),
          '''', ''                       -- strip ASCII apostrophe U+0027
        ),
        '[^a-z0-9[:space:]]', ' ', 'g'   -- non-ASCII-alnum-or-space → SPACE
      ),
      '\s+', ' ', 'g'                    -- collapse whitespace runs
    )
  );
$$;

COMMENT ON FUNCTION nex.name_norm(text) IS
  'Canonical business-name normalization · mirrors src/lib/nex/entity-universe/identity-matching.ts normName() · IMMUTABLE · referenced by nex.business_canonical.name_norm generated column';

-- ═══════════════════════════════════════════════════════════════════
-- business_canonical — one row per real-world business or place
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.business_canonical (
  canonical_business_id       uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity-class (what kind of real-world entity is this?)
  entity_type                 text                      NOT NULL,

  -- Country (ISO 3166-1 alpha-2 · matches migration 081 convention)
  country                     text                      NOT NULL,

  -- Lifecycle state
  lifecycle_state             text                      NOT NULL DEFAULT 'DISCOVERED',

  -- Identity columns
  name_canonical              text                      NOT NULL,
  name_norm                   text                      GENERATED ALWAYS AS (
    nex.name_norm(name_canonical)
  ) STORED,
  aliases                     text[]                    NOT NULL DEFAULT '{}',

  -- Normalised contact identity
  phone_e164                  text                      NULL,
  website_apex                text                      NULL,

  -- External identity references
  osm_id                      text                      NULL,              -- e.g. 'node/12345', 'way/67890'
  wikidata_qid                text                      NULL,              -- e.g. 'Q42' · regex-validated

  -- Location
  city                        text                      NULL,
  district                    text                      NULL,
  address                     jsonb                     NULL,              -- shape documented in header
  coordinates                 geography(Point, 4326)    NULL,

  -- Taxonomy (public categories live here · empty on 167 · populated post-175)
  category_ids                text[]                    NOT NULL DEFAULT '{}',

  -- Polymorphic vertical payload (shape by convention per entity_type)
  services_products           jsonb                     NULL,

  -- Merge history (self-FKs populated when a canonical is superseded)
  supersedes_business_id      uuid                      NULL,
  superseded_by_business_id   uuid                      NULL,

  -- Freshness
  last_verified_at            timestamptz               NULL,

  -- Record lineage
  created_at                  timestamptz               NOT NULL DEFAULT now(),
  updated_at                  timestamptz               NOT NULL DEFAULT now(),

  -- ─────────────── CHECKs ────────────────────────────────────────
  CONSTRAINT ck_bc_entity_type CHECK (entity_type IN (
    'food',
    'accommodation',
    'service',
    'professional',
    'vehicle_rental',
    'marketplace_seller',
    'transport_driver',
    'transport_operator',
    'place'
  )),

  CONSTRAINT ck_bc_country CHECK (country ~ '^[A-Z]{2}$'),

  CONSTRAINT ck_bc_lifecycle_state CHECK (lifecycle_state IN (
    'DISCOVERED',
    'ENRICHED',
    'VERIFIED',
    'OWNER_CLAIMED',
    'OWNER_VERIFIED',
    'DORMANT',
    'SUPERSEDED'
  )),

  CONSTRAINT ck_bc_name_canonical_nonblank CHECK (length(trim(name_canonical)) > 0),

  -- Normalised phone must match E.164 if present (identity-matching
  -- relies on this invariant; §10 cannot survive free-text drift).
  CONSTRAINT ck_bc_phone_e164 CHECK (
    phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{6,14}$'
  ),

  -- Wikidata QID format guard (founder-added · belt-and-braces).
  CONSTRAINT ck_bc_wikidata_qid CHECK (
    wikidata_qid IS NULL OR wikidata_qid ~ '^Q[0-9]+$'
  ),

  -- Self-reference guards (prevent length-1 supersede loops).
  CONSTRAINT ck_bc_supersedes_not_self CHECK (
    supersedes_business_id IS NULL
    OR supersedes_business_id <> canonical_business_id
  ),
  CONSTRAINT ck_bc_superseded_by_not_self CHECK (
    superseded_by_business_id IS NULL
    OR superseded_by_business_id <> canonical_business_id
  ),

  -- ─────────────── Self-FKs ──────────────────────────────────────
  CONSTRAINT fk_bc_supersedes
    FOREIGN KEY (supersedes_business_id)
    REFERENCES nex.business_canonical (canonical_business_id)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_bc_superseded_by
    FOREIGN KEY (superseded_by_business_id)
    REFERENCES nex.business_canonical (canonical_business_id)
    DEFERRABLE INITIALLY DEFERRED
);

-- ─────────────── Partial UNIQUE constraints ──────────────────────
-- OSM elements are unique per country · partial so NULL osm_id rows
-- (every non-OSM-sourced entity) do not collide.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bc_country_osm_id
  ON nex.business_canonical (country, osm_id)
  WHERE osm_id IS NOT NULL;

-- Wikidata QIDs are globally unique.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bc_wikidata_qid
  ON nex.business_canonical (wikidata_qid)
  WHERE wikidata_qid IS NOT NULL;

-- Deliberately NOT UNIQUE on (country, name_norm, city) — two
-- legitimate same-named businesses can coexist in one city
-- (identity-matching.ts §10 IMMUTABLE).
--
-- Deliberately NOT UNIQUE on phone_e164 — co-tenants may share a
-- reception desk.

-- ─────────────── Indexes ────────────────────────────────────────

-- Fuzzy-name search (public discovery + resolver candidate pool).
CREATE INDEX IF NOT EXISTS idx_bc_name_norm_trgm
  ON nex.business_canonical
  USING GIN (name_norm gin_trgm_ops);

-- Array containment for alias search.
CREATE INDEX IF NOT EXISTS idx_bc_aliases_gin
  ON nex.business_canonical
  USING GIN (aliases);

-- Array containment for public taxonomy filter.
CREATE INDEX IF NOT EXISTS idx_bc_category_ids_gin
  ON nex.business_canonical
  USING GIN (category_ids);

-- Geo nearest-neighbour / radius search.
CREATE INDEX IF NOT EXISTS idx_bc_coordinates_gist
  ON nex.business_canonical
  USING GIST (coordinates);

-- The main public-discovery filter path.
CREATE INDEX IF NOT EXISTS idx_bc_country_entity_lifecycle
  ON nex.business_canonical (country, entity_type, lifecycle_state);

-- Freshness band computation + stale sweep.
CREATE INDEX IF NOT EXISTS idx_bc_last_verified_at
  ON nex.business_canonical (last_verified_at);

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 167.
--
-- Downstream (167 does NOT ship these):
--   168 · nex_business_canonical_lifecycle (if any extensions on 167 shape)
--   169 · nex_legacy_canonical_backfill (adds canonical_business_id to legacy *_business)
--   170 · nex.business_evidence (FKs here)
--   171 · evidence backfill
--   172 · nex.business_freshness_band() + nex.business_freshness_v
--   173 · nex.business_media (FKs here)
--   174 · nex.business_fact_conflict (FKs here)
--   175 · nex.business_directory_v + GRANT/REVOKE sweep
--   176 · nex.business_claim (generalises food_claim_code)
--   177 · walker_attribution unify (source_id FKs via source_registry)
-- ═══════════════════════════════════════════════════════════════════
