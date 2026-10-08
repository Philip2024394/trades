-- 166_nex_source_registry.sql
--
-- NEX Directory Canonical Spine · migration 1 of 12.
-- Phase 1 of the N=7-primitive architecture founder-sealed 2026-10-07.
-- (See memory: project_nex_directory_spine_sealed_2026_10_07.md)
--
-- CREATES
--   nex.source_registry — one row per data source + per-source legal
--   policy. Every business_evidence and business_media row cites a
--   source_id in this registry. Everything downstream of this table
--   that renders business data to a user must respect its can_display,
--   can_derive, can_redistribute, attribution_required flags.
--
-- SEALED SHAPE (Audit #5 Section D, founder-approved 2026-10-07):
--   source_id text PK (slug)
--   source_type text CHECK ∈ sealed 9-value enum
--   display_name text
--   licence_id text — NULLABLE · identifier only · see "licence_id note" below
--   policy flags (5 bools)
--   attribution_required bool default true
--   attribution_template text
--   rate_limit_rps int
--   base_host text (SSRF-allowlist seed)
--   created_at timestamptz
--
-- NOT CREATED (deferred, deliberately):
--   nex.license_registry — would be a supporting table for formal
--   licence-identifier management. Deferred pending a separate
--   architecture audit of existing licence infrastructure. Audit #5
--   Section D originally said licence_id FKs into "nex.image_license
--   (extended)"; verification found that public.image_licenses is a
--   commercial purchase ledger (merchant buys exclusive rights to an
--   image), NOT a licence-type registry. The FK was architecturally
--   wrong. See memory load-bearing Rule 5 for why licence_id is kept
--   as free-text identifier here with no FK.
--
-- SAFETY POSTURE (sealed by founder brief):
--   - Seed rows set can_display, can_derive, can_redistribute at
--     their DEFAULT values (FALSE). Nothing is publishable until an
--     admin UPDATE explicitly flips a flag after legal review. "Do
--     not publish without affirmative permission" is enforced by the
--     column defaults, not by convention.
--   - Seed rows set licence_id = NULL. Honest declaration that NEX
--     does not yet have a formal licence registry. The licences
--     each source operates under are well-known (ODbL 1.0 for OSM,
--     CC0 for Wikidata, etc.) but assigning identifier slugs here
--     would pre-empt the registry audit. We refuse to invent values.
--   - Seed rows set attribution_template, rate_limit_rps, base_host
--     all NULL. These are operational settings an admin populates
--     per-source after reading the source's current terms. Values
--     recorded in Audit #4 Section E are inputs to that admin task,
--     not facts baked into the migration.
--
-- IDEMPOTENCY
--   CREATE TABLE IF NOT EXISTS + INSERT ... ON CONFLICT DO NOTHING.
--   Safe to re-run.
--
-- ROLLBACK
--   DROP TABLE nex.source_registry;
--   (No downstream FK dependencies yet — this is the spine root.)
--
-- SAFE ON POPULATED DB
--   Yes. New table. No ALTERs to existing tables. No GRANT/REVOKE on
--   existing tables. Zero impact on any current reader or writer.
--
-- NOT APPLIED
--   This file is Phase 1 of the sealed architecture. It MUST NOT be
--   applied to any live database without an explicit founder
--   authorisation of the deployment window. The migration is
--   authored but awaits scheduled execution.
--
-- DOWNSTREAM
--   167 · nex.business_canonical           — FK target of evidence + media
--   168 · nex_business_canonical_lifecycle — ALTER on 167
--   169 · nex_legacy_canonical_backfill    — adds canonical_business_id to legacy *_business
--   170 · nex.business_evidence            — FK into source_registry (this file)
--   171 · nex_business_evidence_backfill   — one-shot
--   172 · nex.business_freshness_band()    — SQL fn + view
--   173 · nex.business_media                — FK into source_registry (this file)
--   174 · nex.business_fact_conflict        — contradiction state
--   175 · nex.business_directory_v + GRANT  — the enforcement point
--   176 · nex.business_claim                — generalises food_claim_code
--   177 · nex_walker_attribution_unify      — source_id FK on 4 walker-attrib tables
--   (Numbering migrated from the audit's 146–157 to 166–177 to match
--    the actual next-free slot in deploy/postgres/init/; see founder
--    corrected authorization 2026-10-07.)


CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- source_registry — one row per data source
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.source_registry (
  source_id              text        PRIMARY KEY,            -- slug · stable identifier (e.g. 'osm_overpass')
  source_type            text        NOT NULL,               -- high-level kind (see ck_source_registry_type)
  display_name           text        NOT NULL,               -- human-readable name shown in attribution UI
  -- licence_id note:
  --   Free-text identifier for the licence policy this source operates
  --   under. Deliberately NOT a FK. public.image_licenses is a
  --   commercial purchase ledger and is the WRONG target. A formal
  --   nex.license_registry primitive is deferred pending a separate
  --   architecture audit; until it lands, this column stays as a
  --   loose identifier string (e.g. a future admin may set
  --   'osm_odbl_1_0' or 'cc0_1_0' etc. after the registry audit
  --   authors the slug conventions).
  licence_id             text        NULL,
  -- Policy flags · the five permissions a source grants NEX.
  -- SAFETY: defaults are the restrictive case — can_display,
  -- can_derive, can_redistribute all default FALSE. A source is
  -- NOT publishable until an admin UPDATE explicitly enables the
  -- flag after legal review.
  can_collect            boolean     NOT NULL DEFAULT true,  -- may NEX fetch bytes from this source?
  can_store              boolean     NOT NULL DEFAULT true,  -- may NEX persist what it fetched?
  can_display            boolean     NOT NULL DEFAULT false, -- may NEX render it to a user?
  can_derive             boolean     NOT NULL DEFAULT false, -- may NEX train/transform/aggregate?
  can_redistribute       boolean     NOT NULL DEFAULT false, -- may NEX hand it off to a third party?
  attribution_required   boolean     NOT NULL DEFAULT true,  -- must NEX display a credit when it renders?
  attribution_template   text        NULL,                   -- the exact string, e.g. '© OpenStreetMap contributors (ODbL)'
  rate_limit_rps         integer     NULL,                   -- NEX walker ceiling on this source
  base_host              text        NULL,                   -- SSRF-allowlist seed (apex host)
  created_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_source_registry_type CHECK (source_type IN (
    'osm_overpass',
    'wikidata',
    'wikimedia_commons',
    'business_website',
    'owner_upload',
    'user_upload',
    'government_registry',
    'licensed_provider',
    'directory_import'
  ))
);

-- Lookup index on source_type for admin queries ("show me every
-- OSM-type source" etc.).
CREATE INDEX IF NOT EXISTS idx_nex_sr_type
  ON nex.source_registry (source_type);

-- ═══════════════════════════════════════════════════════════════════
-- Seed rows · six initial sources
--
-- Honest baseline:
--   - Each row carries the OBSERVABLE facts about what the source IS
--     (slug, type, display name).
--   - Policy flags stay at defaults → NO source is publishable yet.
--     Admin flips can_display etc. after legal review of each source's
--     current terms.
--   - licence_id = NULL. Not invented. Formal licence identifier
--     treatment is deferred.
--   - attribution_template = NULL. Admin writes the exact string.
--   - rate_limit_rps = NULL. Admin reads source's current policy and
--     sets this; values suggested in Audit #4 Section E are inputs
--     to that admin task, not baked here.
--   - base_host = NULL. Admin populates when wiring the walker.
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO nex.source_registry (source_id, source_type, display_name)
  VALUES
    ('osm_overpass',      'osm_overpass',      'OpenStreetMap · Overpass API'),
    ('wikidata',          'wikidata',          'Wikidata'),
    ('wikimedia_commons', 'wikimedia_commons', 'Wikimedia Commons'),
    ('owner_upload',      'owner_upload',      'Business owner upload'),
    ('user_upload',       'user_upload',       'User upload'),
    ('business_website',  'business_website',  'Business website')
ON CONFLICT (source_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 166.
--
-- Downstream migrations (167–177 per sealed roadmap) will add FKs
-- INTO nex.source_registry(source_id) from nex.business_evidence and
-- nex.business_media. Those migrations are NOT authored yet.
-- ═══════════════════════════════════════════════════════════════════
