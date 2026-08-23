-- 057_nex_food_source_snapshots.sql
--
-- Layered discovery architecture (Philip 2026-08-21 · constitutional).
-- Preserves raw source imports as IMMUTABLE snapshots so that OSM (or any
-- future source) re-imports NEVER overwrite owner-verified or admin-verified
-- fields on nex.food_business.
--
-- Motivation (Philip verbatim)
--   "Do not treat OSM data as automatically verified business data."
--   "Preserve the original fields and never overwrite verified owner-provided
--    information with a later OSM import."
--   "OSM → NEX discovery → verification/enrichment → owner claim → verified
--    NEX business profile."
--
-- What ships in this migration
--   1  nex.food_business_source_snapshot — one row per (source · source_reference)
--      import event · immutable · timestamped · never mutated after write.
--   2  nex.food_business_field_provenance — one row per (business · field_name)
--      recording the current trust layer for that field. On owner claim, all
--      owner-supplied fields get provenance='owner_verified'. On admin edit,
--      'admin_verified'. On raw import, 'source_import'.
--   3  Trust-layer enum: nex_food_field_trust
--      (source_import | nex_curated | admin_verified | owner_verified)
--   4  Indexes for the merge-safety guard read path.
--
-- Merge policy (must be enforced by every importer + edit path in application code)
--   - Re-import overwrites a field ONLY IF the current provenance is
--     'source_import' or NULL.
--   - Re-import NEVER touches any field on a row where claim_status IN
--     ('claimed','paying') OR owner_status='verified' (belt-and-braces).
--   - Every raw ingest writes exactly one snapshot row (immutable audit).
--
-- Reversible
--   BEGIN;
--   DROP TABLE IF EXISTS nex.food_business_field_provenance CASCADE;
--   DROP TABLE IF EXISTS nex.food_business_source_snapshot CASCADE;
--   DROP TYPE IF EXISTS nex_food_field_trust;
--   COMMIT;

CREATE SCHEMA IF NOT EXISTS nex;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enum ────────────────────────────────────────────────────────────────────

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nex_food_field_trust') THEN
    CREATE TYPE nex_food_field_trust AS ENUM (
      'source_import',    -- raw from OSM/Google/directory · lowest trust
      'nex_curated',      -- NEX-supplied (image · description · marketing)
      'admin_verified',   -- NEX admin confirmed
      'owner_verified'    -- owner directly confirmed
    );
  END IF;
END $body$;

-- ── Immutable source snapshots ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.food_business_source_snapshot (
  snapshot_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref       text,                             -- may be NULL if the snapshot
                                                       -- was ingested before dedupe
                                                       -- matched it to a canonical business
  source             text NOT NULL,                    -- e.g. 'openstreetmap_overpass_v1'
  source_reference   text NOT NULL,                    -- e.g. 'osm/node/1640337574'
  source_ingested_at timestamptz NOT NULL DEFAULT now(),
  source_licence_terms text,
  raw_payload        jsonb NOT NULL,                   -- the full source row · exactly as fetched
  ingested_by        text                              -- e.g. 'osm_yogyakarta_importer_v1'
);

CREATE INDEX IF NOT EXISTS idx_nex_food_snapshot_business_ref
  ON nex.food_business_source_snapshot (business_ref, source_ingested_at DESC)
  WHERE business_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_nex_food_snapshot_source_ref_at
  ON nex.food_business_source_snapshot (source, source_reference, source_ingested_at);

COMMENT ON TABLE nex.food_business_source_snapshot IS
  'IMMUTABLE audit trail of raw source imports. Never updated · never deleted. Re-imports write new rows with fresh source_ingested_at timestamps · the history is permanent. Reconstructs the discovery layer if the merged nex.food_business row is ever lost or wrong.';

-- ── Field-level provenance (the "never overwrite verified" guard) ──────────

CREATE TABLE IF NOT EXISTS nex.food_business_field_provenance (
  business_ref     text NOT NULL,
  field_name       text NOT NULL,                     -- 'business_name' | 'phone' | 'address' | ...
  trust_layer      nex_food_field_trust NOT NULL,
  written_at       timestamptz NOT NULL DEFAULT now(),
  written_by       text,                              -- 'osm_importer' | 'admin:philip' | 'owner:whatsapp'
  source_reference text,                              -- link back to snapshot when trust_layer='source_import'
  PRIMARY KEY (business_ref, field_name)
);

CREATE INDEX IF NOT EXISTS idx_nex_food_field_provenance_trust
  ON nex.food_business_field_provenance (business_ref, trust_layer);

COMMENT ON TABLE nex.food_business_field_provenance IS
  'One row per (business_ref, field_name). Tracks the CURRENT trust layer for that field so importers know whether they can overwrite. Enforced in application code · trust order: source_import < nex_curated < admin_verified < owner_verified. Higher trust NEVER overwritten by lower.';
