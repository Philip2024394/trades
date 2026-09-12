-- 144_nex_taxonomy_schema.sql
--
-- NEX UNIVERSAL BUSINESS & PRODUCT TAXONOMY · T1 · PERSISTENT STORAGE
-- Philip 2026-09-05
--
-- Doctrine anchor:
--   doctrine_nex_universal_business_product_taxonomy_2026_09_05.md
--   Follows T0 canonical content authored in data/nex-taxonomy/v1/*.json
--   Validated by scripts/nex-taxonomy/validate.mjs (T0 · 84/84 pass)
--
-- Purpose:
--   Create the persistent storage representation of the canonical NEX
--   Universal Taxonomy. This is STORAGE ONLY. T1 does not classify any
--   business/product/service and does not integrate with Product Creator,
--   Search, Business Brain, Marketing, or Workforce.
--
-- T1 scope (STRICT):
--   · Create nex_taxonomy schema + 3 tables + indexes + trigger only.
--   · Zero rows inserted by this migration (importer runs separately
--     via scripts/nex-taxonomy/import.mjs).
--   · Zero consumer code changes.
--   · Existing tables NOT altered.
--   · System A untouched.
--   · Local nex_dev untouched.
--   · Workforce untouched.
--
-- Reversible (not scripted per Philip's design rule 7):
--   BEGIN;
--     DROP SCHEMA IF EXISTS nex_taxonomy CASCADE;
--   COMMIT;
--
-- The five canonical dimensions live in ONE table (taxonomy_node) with a
-- dimension column plus CHECK + trigger enforcement of dimension-scoped
-- parent/replacement relationships. This preserves the "hybrid taxonomy"
-- design (Industry × Product × Service × Role × Market) while giving one
-- consistent query surface.
--
-- Design rules:
--   1. UUID identity via gen_random_uuid() on first INSERT · idempotency
--      via ON CONFLICT (dimension, slug) DO UPDATE (importer). UUIDs
--      remain stable across re-imports. Never uuid_generate_v5 (dep on
--      uuid-ossp not required).
--   2. Slugs are stable human-readable identifiers · UNIQUE per dimension.
--   3. Dimension separation enforced at DB layer (CHECK constraint on
--      allowed values + BEFORE trigger that blocks cross-dimension
--      parent_id / replacement_id).
--   4. Aliases · brain_domain_hints · attribute_hints stored as JSONB
--      arrays (never separate tables for T1 · queryable via ->>/@>).
--   5. Market-specific fields (iso_alpha2 · region · timezone ·
--      currency_default · first_class) live in a separate market_meta
--      table joined by node_id · avoids sparse columns on the main table.
--   6. All timestamps are timestamptz.
--   7. No destructive statements. No DROP/ALTER of existing objects.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- SCHEMA
-- ═══════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS nex_taxonomy;

COMMENT ON SCHEMA nex_taxonomy IS
  'T1 (Philip 2026-09-05) · Canonical NEX Universal Business & Product Taxonomy '
  'storage. Content source: data/nex-taxonomy/v1/*.json. Importer: '
  'scripts/nex-taxonomy/import.mjs. Validator: scripts/nex-taxonomy/t1-validate.mjs. '
  'No classification tables (T2/T3/T4). No Product Creator / Search / Brain / '
  'Marketing / Workforce integration.';

-- ═══════════════════════════════════════════════════════════════════
-- TABLE · nex_taxonomy.taxonomy_version
-- ═══════════════════════════════════════════════════════════════════
--
-- Version registry. v1 seeded by importer with the T0 metadata.json
-- content. Future versions coexist safely (each row = one release).

CREATE TABLE IF NOT EXISTS nex_taxonomy.taxonomy_version (
  version         integer PRIMARY KEY,
  status          text NOT NULL DEFAULT 'active',
  released_at     timestamptz NOT NULL,
  released_by     text,
  specification   text,
  changelog       jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT taxonomy_version_status_check CHECK (
    status IN ('draft', 'active', 'superseded')
  )
);

COMMENT ON TABLE nex_taxonomy.taxonomy_version IS
  'Version registry for canonical taxonomy releases. v1 is the T0 baseline. '
  'Future versions are additive · deprecated nodes retain replacement_id chains.';

-- ═══════════════════════════════════════════════════════════════════
-- TABLE · nex_taxonomy.taxonomy_node
-- ═══════════════════════════════════════════════════════════════════
--
-- All five dimensions in one table with a dimension discriminator.
-- Same-dimension parent/replacement enforcement via trigger below.

CREATE TABLE IF NOT EXISTS nex_taxonomy.taxonomy_node (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension             text NOT NULL,
  slug                  text NOT NULL,
  parent_id             uuid REFERENCES nex_taxonomy.taxonomy_node(id) ON DELETE RESTRICT,
  depth                 integer NOT NULL,
  label_en              text NOT NULL,
  label_i18n            jsonb NOT NULL DEFAULT '{}'::jsonb,
  i18n_key              text NOT NULL,
  status                text NOT NULL DEFAULT 'active',
  version_introduced    integer NOT NULL,
  version_deprecated    integer,
  replacement_id        uuid REFERENCES nex_taxonomy.taxonomy_node(id) ON DELETE RESTRICT,
  aliases               jsonb NOT NULL DEFAULT '[]'::jsonb,
  brain_domain_hints    jsonb NOT NULL DEFAULT '[]'::jsonb,
  attribute_hints       jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes                 text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Allowed dimensions (locked · T1)
  CONSTRAINT taxonomy_node_dimension_check CHECK (
    dimension IN ('industry', 'product', 'service', 'role', 'market')
  ),

  -- Allowed status values (locked · T1)
  CONSTRAINT taxonomy_node_status_check CHECK (
    status IN ('draft', 'active', 'deprecated', 'replaced', 'withdrawn')
  ),

  -- Depth must be positive
  CONSTRAINT taxonomy_node_depth_positive CHECK (depth >= 1),

  -- Never self-parent
  CONSTRAINT taxonomy_node_no_self_parent CHECK (id IS DISTINCT FROM parent_id),

  -- deprecated/replaced status requires replacement_id
  CONSTRAINT taxonomy_node_deprecated_needs_replacement CHECK (
    (status NOT IN ('deprecated', 'replaced')) OR (replacement_id IS NOT NULL)
  ),

  -- version_deprecated is set only when replacement_id is set
  CONSTRAINT taxonomy_node_version_deprecated_consistency CHECK (
    (version_deprecated IS NULL) OR (replacement_id IS NOT NULL)
  ),

  -- i18n_key bounded to prevent runaway keys
  CONSTRAINT taxonomy_node_i18n_key_bounded CHECK (
    char_length(i18n_key) > 0 AND char_length(i18n_key) <= 512
  ),

  -- label_en must equal label_i18n.en
  CONSTRAINT taxonomy_node_label_en_matches_i18n CHECK (
    (label_i18n ? 'en') AND (label_i18n->>'en' = label_en)
  )
);

-- Uniqueness per dimension + slug (the core identity invariant)
CREATE UNIQUE INDEX IF NOT EXISTS taxonomy_node_dim_slug_uniq
  ON nex_taxonomy.taxonomy_node (dimension, slug);

-- Global i18n_key uniqueness (developer safety · single lookup surface)
CREATE UNIQUE INDEX IF NOT EXISTS taxonomy_node_i18n_key_uniq
  ON nex_taxonomy.taxonomy_node (i18n_key);

-- Fast parent lookup (children of a given node)
CREATE INDEX IF NOT EXISTS taxonomy_node_parent_idx
  ON nex_taxonomy.taxonomy_node (parent_id)
  WHERE parent_id IS NOT NULL;

-- Fast per-dimension scans
CREATE INDEX IF NOT EXISTS taxonomy_node_dimension_idx
  ON nex_taxonomy.taxonomy_node (dimension);

-- Fast active-status filter (common consumer query · dimension + active)
CREATE INDEX IF NOT EXISTS taxonomy_node_dimension_active_idx
  ON nex_taxonomy.taxonomy_node (dimension, status)
  WHERE status = 'active';

-- Fast replacement chain traversal
CREATE INDEX IF NOT EXISTS taxonomy_node_replacement_idx
  ON nex_taxonomy.taxonomy_node (replacement_id)
  WHERE replacement_id IS NOT NULL;

COMMENT ON TABLE nex_taxonomy.taxonomy_node IS
  'T1 (Philip 2026-09-05) · canonical taxonomy nodes across five independent '
  'dimensions (industry · product · service · role · market). Content authored '
  'in data/nex-taxonomy/v1/. Imported via scripts/nex-taxonomy/import.mjs. UUID '
  'identity stable across re-imports via ON CONFLICT (dimension, slug) DO UPDATE. '
  'Dimension separation enforced at DB layer via CHECK + trigger.';

COMMENT ON COLUMN nex_taxonomy.taxonomy_node.dimension IS
  'One of: industry | product | service | role | market. Locked via CHECK. '
  'parent_id and replacement_id must reference the SAME dimension (trigger).';

COMMENT ON COLUMN nex_taxonomy.taxonomy_node.slug IS
  'Stable English-derived dotted path. UNIQUE per (dimension, slug). Owner-invisible. '
  'Example: food.seafood.fish.tuna.frozen. Never mutated for a live node · '
  'renames deprecate + create new with replacement_id set.';

COMMENT ON COLUMN nex_taxonomy.taxonomy_node.parent_id IS
  'Same-dimension parent. Enforced by trigger nex_taxonomy.check_parent_dimension().';

COMMENT ON COLUMN nex_taxonomy.taxonomy_node.replacement_id IS
  'Successor node when status IN (deprecated, replaced). Same-dimension via trigger.';

COMMENT ON COLUMN nex_taxonomy.taxonomy_node.aliases IS
  'JSONB array of search-matching strings (EN/ID/JA/industry-terms). Aliases '
  'resolve TO the canonical node · never create new canonical identity.';

COMMENT ON COLUMN nex_taxonomy.taxonomy_node.brain_domain_hints IS
  'JSONB array of specialist workforce role slugs (per metadata.json vocabulary). '
  'Advisory routing hints for future T6 Brain Routing · never activates workforce.';

COMMENT ON COLUMN nex_taxonomy.taxonomy_node.attribute_hints IS
  'JSONB array of attribute keys · advisory to Product Creator UI · not schema '
  'and not enforcement.';

-- ═══════════════════════════════════════════════════════════════════
-- TABLE · nex_taxonomy.market_meta
-- ═══════════════════════════════════════════════════════════════════
--
-- Per-market attributes (only markets need iso_alpha2, region, timezone,
-- currency_default, first_class). Separated to keep taxonomy_node clean.

CREATE TABLE IF NOT EXISTS nex_taxonomy.market_meta (
  node_id             uuid PRIMARY KEY REFERENCES nex_taxonomy.taxonomy_node(id) ON DELETE CASCADE,
  iso_alpha2          text,
  region              text,
  timezone            text,
  currency_default    text,
  first_class         boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT market_meta_iso_alpha2_valid CHECK (
    iso_alpha2 IS NULL OR (char_length(iso_alpha2) = 2 AND iso_alpha2 = upper(iso_alpha2))
  ),

  CONSTRAINT market_meta_currency_default_bounded CHECK (
    currency_default IS NULL OR char_length(currency_default) BETWEEN 2 AND 8
  )
);

-- Fast first_class lookup (Japan first-class · likely other markets promoted later)
CREATE INDEX IF NOT EXISTS market_meta_first_class_idx
  ON nex_taxonomy.market_meta (first_class)
  WHERE first_class = true;

-- Fast region rollup
CREATE INDEX IF NOT EXISTS market_meta_region_idx
  ON nex_taxonomy.market_meta (region)
  WHERE region IS NOT NULL;

COMMENT ON TABLE nex_taxonomy.market_meta IS
  'T1 (Philip 2026-09-05) · per-market attributes joined to taxonomy_node.id '
  'via CASCADE. One row per market node. ISO 3166-1 alpha-2 for real markets · '
  'INTL sentinel has iso_alpha2 NULL.';

COMMENT ON COLUMN nex_taxonomy.market_meta.first_class IS
  'true for markets NEX treats as Day-1 first-class (Japan). Enables selective '
  'downstream targeting (e.g. Marketing Employee eligibility engine).';

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER · same-dimension parent/replacement enforcement
-- ═══════════════════════════════════════════════════════════════════
--
-- Postgres CHECK constraints cannot reference other rows · trigger is the
-- correct enforcement mechanism for cross-row invariants.

CREATE OR REPLACE FUNCTION nex_taxonomy.check_parent_dimension()
RETURNS trigger AS $$
BEGIN
  -- parent must exist in the SAME dimension (or be NULL)
  IF NEW.parent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM nex_taxonomy.taxonomy_node
      WHERE id = NEW.parent_id AND dimension = NEW.dimension
    ) THEN
      RAISE EXCEPTION
        'nex_taxonomy: parent_id % must reference a node in dimension %',
        NEW.parent_id, NEW.dimension;
    END IF;
  END IF;

  -- replacement must exist in the SAME dimension (or be NULL)
  IF NEW.replacement_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM nex_taxonomy.taxonomy_node
      WHERE id = NEW.replacement_id AND dimension = NEW.dimension
    ) THEN
      RAISE EXCEPTION
        'nex_taxonomy: replacement_id % must reference a node in dimension %',
        NEW.replacement_id, NEW.dimension;
    END IF;
  END IF;

  -- keep updated_at fresh on UPDATE
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS taxonomy_node_dimension_guard ON nex_taxonomy.taxonomy_node;
CREATE TRIGGER taxonomy_node_dimension_guard
BEFORE INSERT OR UPDATE ON nex_taxonomy.taxonomy_node
FOR EACH ROW
EXECUTE FUNCTION nex_taxonomy.check_parent_dimension();

-- Simple updated_at trigger for taxonomy_version + market_meta
CREATE OR REPLACE FUNCTION nex_taxonomy.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS taxonomy_version_updated_at ON nex_taxonomy.taxonomy_version;
CREATE TRIGGER taxonomy_version_updated_at
BEFORE UPDATE ON nex_taxonomy.taxonomy_version
FOR EACH ROW
EXECUTE FUNCTION nex_taxonomy.set_updated_at();

DROP TRIGGER IF EXISTS market_meta_updated_at ON nex_taxonomy.market_meta;
CREATE TRIGGER market_meta_updated_at
BEFORE UPDATE ON nex_taxonomy.market_meta
FOR EACH ROW
EXECUTE FUNCTION nex_taxonomy.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY (least-privilege · service_role only in T1)
-- ═══════════════════════════════════════════════════════════════════
--
-- Enable RLS on every table · grant service_role full access. Application
-- read access (nex_app_runtime SELECT) is deferred to a future slice
-- since T1 has no consumer integration yet.

ALTER TABLE nex_taxonomy.taxonomy_version ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='nex_taxonomy' AND tablename='taxonomy_version'
      AND policyname='service_role_all_taxonomy_version'
  ) THEN
    CREATE POLICY "service_role_all_taxonomy_version"
      ON nex_taxonomy.taxonomy_version
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE nex_taxonomy.taxonomy_node ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='nex_taxonomy' AND tablename='taxonomy_node'
      AND policyname='service_role_all_taxonomy_node'
  ) THEN
    CREATE POLICY "service_role_all_taxonomy_node"
      ON nex_taxonomy.taxonomy_node
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE nex_taxonomy.market_meta ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='nex_taxonomy' AND tablename='market_meta'
      AND policyname='service_role_all_market_meta'
  ) THEN
    CREATE POLICY "service_role_all_market_meta"
      ON nex_taxonomy.market_meta
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SANITY CHECK · per existing NEX migration convention
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  schema_exists       boolean;
  version_tbl_exists  boolean;
  node_tbl_exists     boolean;
  market_meta_exists  boolean;
  trg_dim_exists      boolean;
  trg_ver_ts_exists   boolean;
  trg_mm_ts_exists    boolean;
  n_node_indexes      integer;
  n_mm_indexes        integer;
  n_node_rows         integer;
  n_market_meta_rows  integer;
  n_version_rows      integer;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='nex_taxonomy')
    INTO schema_exists;
  IF NOT schema_exists THEN
    RAISE EXCEPTION 'Migration 144 failed: schema nex_taxonomy not created';
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                WHERE table_schema='nex_taxonomy' AND table_name='taxonomy_version')
    INTO version_tbl_exists;
  IF NOT version_tbl_exists THEN
    RAISE EXCEPTION 'Migration 144 failed: nex_taxonomy.taxonomy_version not created';
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                WHERE table_schema='nex_taxonomy' AND table_name='taxonomy_node')
    INTO node_tbl_exists;
  IF NOT node_tbl_exists THEN
    RAISE EXCEPTION 'Migration 144 failed: nex_taxonomy.taxonomy_node not created';
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                WHERE table_schema='nex_taxonomy' AND table_name='market_meta')
    INTO market_meta_exists;
  IF NOT market_meta_exists THEN
    RAISE EXCEPTION 'Migration 144 failed: nex_taxonomy.market_meta not created';
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.triggers
                WHERE event_object_schema='nex_taxonomy'
                  AND trigger_name='taxonomy_node_dimension_guard')
    INTO trg_dim_exists;
  IF NOT trg_dim_exists THEN
    RAISE EXCEPTION 'Migration 144 failed: taxonomy_node_dimension_guard trigger not created';
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.triggers
                WHERE event_object_schema='nex_taxonomy'
                  AND trigger_name='taxonomy_version_updated_at')
    INTO trg_ver_ts_exists;
  SELECT EXISTS(SELECT 1 FROM information_schema.triggers
                WHERE event_object_schema='nex_taxonomy'
                  AND trigger_name='market_meta_updated_at')
    INTO trg_mm_ts_exists;
  IF NOT (trg_ver_ts_exists AND trg_mm_ts_exists) THEN
    RAISE EXCEPTION 'Migration 144 failed: updated_at triggers not created (ver=%, mm=%)',
      trg_ver_ts_exists, trg_mm_ts_exists;
  END IF;

  SELECT count(*)::int FROM pg_indexes
    WHERE schemaname='nex_taxonomy' AND tablename='taxonomy_node'
    INTO n_node_indexes;
  -- Expect: 1 PK + 2 UNIQUE + 4 non-unique = 7 (Postgres reports PK too)
  IF n_node_indexes < 6 THEN
    RAISE EXCEPTION 'Migration 144 failed: expected ≥6 indexes on taxonomy_node, got %', n_node_indexes;
  END IF;

  SELECT count(*)::int FROM pg_indexes
    WHERE schemaname='nex_taxonomy' AND tablename='market_meta'
    INTO n_mm_indexes;
  IF n_mm_indexes < 3 THEN
    RAISE EXCEPTION 'Migration 144 failed: expected ≥3 indexes on market_meta, got %', n_mm_indexes;
  END IF;

  -- T1 must be empty · importer runs separately
  SELECT count(*)::int FROM nex_taxonomy.taxonomy_node INTO n_node_rows;
  SELECT count(*)::int FROM nex_taxonomy.market_meta INTO n_market_meta_rows;
  SELECT count(*)::int FROM nex_taxonomy.taxonomy_version INTO n_version_rows;
  IF n_node_rows > 0 OR n_market_meta_rows > 0 THEN
    RAISE NOTICE 'Migration 144: nex_taxonomy already has data (nodes=%, markets=%, versions=%) · importer previously ran, schema idempotent',
      n_node_rows, n_market_meta_rows, n_version_rows;
  END IF;

  RAISE NOTICE 'Migration 144 complete: nex_taxonomy schema · 3 tables · % + % indexes · 3 triggers · RLS enabled · service_role policies attached (rows currently: nodes=%, markets=%, versions=%)',
    n_node_indexes, n_mm_indexes, n_node_rows, n_market_meta_rows, n_version_rows;
END $$;

COMMIT;
