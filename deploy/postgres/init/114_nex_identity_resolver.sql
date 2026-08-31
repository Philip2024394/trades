-- 114_nex_identity_resolver.sql
--
-- NEX Dedup + Identity Resolution · Phase 1a · Philip 2026-08-27.
--
-- Doctrine: project_nex_dedup_and_identity_resolution_doctrine_2026_08_27.md
--
-- What this migration installs:
--
--   1. UNIQUE (source, source_reference) WHERE source_reference IS NOT NULL
--      partial index on the tables where existing rows do NOT already
--      conflict (accommodation_business · service_business · mp_seller).
--      This is the ONE safe DB-level identity constraint per doctrine §1.
--      Explicitly NOT adding UNIQUE(name, city) — two legitimate businesses
--      can share a name in one city.
--
--   2. Non-unique index on (source, source_reference) for food_business.
--      food_business has 401 pre-existing conflict groups on (source,
--      source_reference) that would make CREATE UNIQUE INDEX fail. Per
--      Philip's Phase 1a rule, NO cleanup/deletion is allowed here. The
--      resolver's application-layer Layer 1 SELECT is the safety net for
--      food_business until Phase 2 cleanup lands, at which point the
--      constraint can be upgraded to UNIQUE (see migration 116 · post
--      Phase 2 · TODO).
--
--   3. mp_seller columns: `source` and `source_reference` added (were
--      absent · resolver's Layer 1 needs them).
--
--   4. nex.identity_merge_log · append-only provenance log for every
--      observation the resolver merged into an existing entity. Records
--      layer, incoming source data, enriched fields. Philip: "never lose
--      useful source data simply because we're deduplicating."
--
-- Idempotent: uses CREATE * IF NOT EXISTS. Safe to re-run.

-- ── 1. UNIQUE constraints where safe ────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS ux_accommodation_business_source_ref
  ON nex.accommodation_business (source, source_reference)
  WHERE source_reference IS NOT NULL;

-- Note: nex.service_business already has ux_service_business_source_ref
-- from migration 110. Confirm/create.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='nex' AND tablename='service_business'
      AND indexname='ux_service_business_source_ref'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX ux_service_business_source_ref
             ON nex.service_business (source, source_reference)
             WHERE source_reference IS NOT NULL';
  END IF;
END $$;

-- ── 2. mp_seller · add source/source_reference columns + UNIQUE ────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='mp_seller' AND column_name='source'
  ) THEN
    ALTER TABLE nex.mp_seller ADD COLUMN source TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='mp_seller' AND column_name='source_reference'
  ) THEN
    ALTER TABLE nex.mp_seller ADD COLUMN source_reference TEXT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mp_seller_source_ref
  ON nex.mp_seller (source, source_reference)
  WHERE source_reference IS NOT NULL;

-- ── 3. food_business · non-unique index (upgrade to UNIQUE post Phase 2) ─

CREATE INDEX IF NOT EXISTS ix_food_business_source_ref
  ON nex.food_business (source, source_reference)
  WHERE source_reference IS NOT NULL;

COMMENT ON INDEX nex.ix_food_business_source_ref IS
  'Phase 1a resolver Layer 1 lookup · non-unique because 401 pre-existing '
  'conflict groups block UNIQUE until Phase 2 cleanup. Upgrade to UNIQUE '
  'in migration 116 after cleanup lands.';

-- ── 4. Provenance-preserving merge log ─────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.identity_merge_log (
  merge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which table + which existing row absorbed the observation
  table_name TEXT NOT NULL,
  existing_ref TEXT NOT NULL,          -- public_listing_ref or slug

  -- Which resolver layer identified the match
  match_layer TEXT NOT NULL
    CHECK (match_layer IN ('source_ref', 'website', 'phone', 'name_city', 'geo_confirmed')),

  -- What the incoming observation looked like (never lost)
  incoming_source TEXT,
  incoming_source_reference TEXT,
  incoming_name TEXT,
  incoming_city TEXT,
  incoming_website TEXT,
  incoming_phone TEXT,
  incoming_whatsapp TEXT,
  incoming_lat NUMERIC,
  incoming_lng NUMERIC,
  incoming_extras JSONB DEFAULT '{}'::jsonb,

  -- What the resolver decided to enrich (COALESCE fills only where NULL)
  enriched_fields TEXT[] DEFAULT '{}',
  skipped_reason TEXT,

  -- Walker attribution
  worker_id TEXT,
  cycle_run_id UUID,

  merged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_identity_merge_log_table_existing
  ON nex.identity_merge_log (table_name, existing_ref, merged_at DESC);

CREATE INDEX IF NOT EXISTS ix_identity_merge_log_source
  ON nex.identity_merge_log (incoming_source, incoming_source_reference)
  WHERE incoming_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_identity_merge_log_layer_time
  ON nex.identity_merge_log (match_layer, merged_at DESC);

COMMENT ON TABLE nex.identity_merge_log IS
  'Append-only log of every observation the identity resolver merged into '
  'an existing entity. Preserves incoming source data + which layer fired + '
  'which fields were enriched. Philip 2026-08-27: never lose useful source '
  'data simply because we are deduplicating.';
