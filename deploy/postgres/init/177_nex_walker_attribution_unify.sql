-- 177_nex_walker_attribution_unify.sql
--
-- NEX Directory Canonical Spine · migration 12 of 12 · walker-attribution
-- source unification.
-- Phase 1 of the N=7-primitive architecture (founder-sealed 2026-10-07,
-- Phase-1 build authorised 2026-10-09).
--
-- WHAT THIS MIGRATION DOES
--   Adds `source_id text NULL REFERENCES nex.source_registry(source_id)`
--   to every walker-attribution table so a walker-produced row can be
--   traced to the data source it was derived from (OSM / Nominatim /
--   Wikidata / Wikimedia / government registry / etc.) via the sealed
--   source_registry (migration 166).
--
--   The 4 walker-attribution tables added by migrations 105/106/107/110:
--
--     nex.food_business           (migration 105 added worker_id + cycle_run_id)
--     nex.accommodation_business  (migration 106)
--     nex.mp_seller               (migration 107)
--     nex.transport_acquisition_record (migration 110)
--
--   This migration does NOT backfill. source_id stays NULL on every
--   existing row until a separately authorised backfill wave reads
--   each row's `source` column (free-text slug) and maps it to a
--   source_registry row.
--
--   This migration does NOT change the existing free-text `source`
--   column on any legacy table. source_id (new) and source (legacy)
--   coexist during the migration period; the legacy column can later
--   be deprecated when all consumers read through source_id.
--
-- WHY NULLABLE
--   Zero existing walker-attributed rows have been audited against the
--   sealed source_registry. Making the column NOT NULL would require
--   either a bulk UPDATE (not safe) or a default value (would silently
--   mislabel). NULL is the honest "we have not mapped this row's source
--   to the registry yet" state.
--
-- ON DELETE SET NULL
--   If a source_registry row is ever purged (should be rare and admin-
--   reviewed), walker-attributed rows survive with source_id = NULL
--   rather than being collaterally deleted.
--
-- IDEMPOTENCE
--   ADD COLUMN IF NOT EXISTS. DO-block guards every FK + index add.
--   Safe to re-run.
--
-- ROLLBACK (operational, not architectural)
--   BEGIN;
--     ALTER TABLE nex.food_business                 DROP CONSTRAINT IF EXISTS fk_fb_source_id,  DROP COLUMN IF EXISTS source_id;
--     ALTER TABLE nex.accommodation_business        DROP CONSTRAINT IF EXISTS fk_ab_source_id,  DROP COLUMN IF EXISTS source_id;
--     ALTER TABLE nex.mp_seller                     DROP CONSTRAINT IF EXISTS fk_mp_source_id,  DROP COLUMN IF EXISTS source_id;
--     ALTER TABLE nex.transport_acquisition_record  DROP CONSTRAINT IF EXISTS fk_ta_source_id,  DROP COLUMN IF EXISTS source_id;
--   COMMIT;
--
--   NOTE: nex.food_business already has a free-text `source` column
--   (migration 054). This migration adds a SEPARATE column
--   `source_id` (text FK). The rollback above drops only the new column.
--
-- SAFE ON POPULATED DB
--   Yes. Nullable column + nullable FK. No DML. ADD COLUMN with no
--   default is a metadata-only operation on PG 11+.
--
-- NAMING NOTE · why `source_id` and not reuse `source`
--   Migrations 054/078/110/091 all declare `source text` as a free-form
--   slug. Overloading that column to be a nex.source_registry.source_id
--   FK would silently reinterpret existing values. Adding a NEW column
--   `source_id` makes the backfill wave an explicit mapping step that
--   can refuse to proceed when a legacy `source` value does not match
--   any source_registry row.
--
-- NOT APPLIED
--   Phase 1 of the sealed architecture. MUST NOT be applied to any
--   live database without an explicit founder authorisation.

-- ═══════════════════════════════════════════════════════════════════
-- (1) · nex.food_business
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE nex.food_business
  ADD COLUMN IF NOT EXISTS source_id text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_fb_source_id'
      AND conrelid = 'nex.food_business'::regclass
  ) THEN
    ALTER TABLE nex.food_business
      ADD CONSTRAINT fk_fb_source_id
      FOREIGN KEY (source_id)
      REFERENCES nex.source_registry (source_id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_fb_source_id
  ON nex.food_business (source_id)
  WHERE source_id IS NOT NULL;

COMMENT ON COLUMN nex.food_business.source_id IS
  'FK into nex.source_registry (migration 166). NULL until the walker-source backfill wave maps the legacy free-text `source` column to a registry slug.';

-- ═══════════════════════════════════════════════════════════════════
-- (2) · nex.accommodation_business
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE nex.accommodation_business
  ADD COLUMN IF NOT EXISTS source_id text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_ab_source_id'
      AND conrelid = 'nex.accommodation_business'::regclass
  ) THEN
    ALTER TABLE nex.accommodation_business
      ADD CONSTRAINT fk_ab_source_id
      FOREIGN KEY (source_id)
      REFERENCES nex.source_registry (source_id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_ab_source_id
  ON nex.accommodation_business (source_id)
  WHERE source_id IS NOT NULL;

COMMENT ON COLUMN nex.accommodation_business.source_id IS
  'FK into nex.source_registry (migration 166). NULL until the walker-source backfill wave maps the legacy free-text `source` column to a registry slug.';

-- ═══════════════════════════════════════════════════════════════════
-- (3) · nex.mp_seller
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE nex.mp_seller
  ADD COLUMN IF NOT EXISTS source_id text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_mp_source_id'
      AND conrelid = 'nex.mp_seller'::regclass
  ) THEN
    ALTER TABLE nex.mp_seller
      ADD CONSTRAINT fk_mp_source_id
      FOREIGN KEY (source_id)
      REFERENCES nex.source_registry (source_id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_mp_source_id
  ON nex.mp_seller (source_id)
  WHERE source_id IS NOT NULL;

COMMENT ON COLUMN nex.mp_seller.source_id IS
  'FK into nex.source_registry (migration 166). NULL until the walker-source backfill wave maps the legacy free-text `source` column to a registry slug.';

-- ═══════════════════════════════════════════════════════════════════
-- (4) · nex.transport_acquisition_record
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE nex.transport_acquisition_record
  ADD COLUMN IF NOT EXISTS source_id text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_ta_source_id'
      AND conrelid = 'nex.transport_acquisition_record'::regclass
  ) THEN
    ALTER TABLE nex.transport_acquisition_record
      ADD CONSTRAINT fk_ta_source_id
      FOREIGN KEY (source_id)
      REFERENCES nex.source_registry (source_id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_ta_source_id
  ON nex.transport_acquisition_record (source_id)
  WHERE source_id IS NOT NULL;

COMMENT ON COLUMN nex.transport_acquisition_record.source_id IS
  'FK into nex.source_registry (migration 166). NULL until the walker-source backfill wave maps the legacy free-text `source` column to a registry slug.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 177.
--
-- Downstream (177 does NOT ship these):
--   · Walker-source backfill wave (separate authorisation) — reads each
--     legacy `source` free-text value and populates `source_id` from
--     nex.source_registry.
--   · Legacy `source` column deprecation (post-backfill, when all
--     consumers have been cut over to read `source_id`).
-- ═══════════════════════════════════════════════════════════════════
