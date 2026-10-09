-- 169_nex_legacy_canonical_backfill.sql
--
-- NEX Directory Canonical Spine · migration 4 of 12 · legacy FK bridge.
-- Phase 1 of the N=7-primitive architecture (founder-sealed 2026-10-07,
-- Phase-1 build authorised 2026-10-09).
--
-- WHAT THIS MIGRATION DOES
--   Adds a nullable `canonical_business_id uuid` column + FK to each
--   legacy per-vertical table so a resolver-driven backfill wave can
--   populate the pointer from legacy row → sealed canonical row:
--
--     nex.food_business          (migration 054)
--     nex.accommodation_business (migration 078)
--     nex.service_business       (migration 110)
--     nex.mp_seller              (migration 096)
--
--   This migration is PURE SCHEMA. It does NOT populate any value. It
--   does NOT execute the resolver. It does NOT write to
--   `nex.business_canonical`.
--
-- WHY LEAVE NULL?
--   The sealed canonical-handoff path (`scripts/nex-canonical/`) is the
--   ONLY authorised writer to `nex.business_canonical`. Populating
--   `canonical_business_id` on 22,757+ legacy rows must therefore route
--   through the resolver + Rule-5m seven-proof gate · it is NOT a bulk
--   `UPDATE ... FROM` statement a migration file can safely perform.
--
--   This migration lands the empty column so the backfill wave has a
--   schema to write to. The column defaults NULL on every existing row ·
--   "we have not resolved this to a canonical yet" is the honest state
--   until the backfill wave runs.
--
-- ON DELETE SET NULL (not RESTRICT)
--   If a canonical row is ever purged, the legacy row survives with
--   canonical_business_id = NULL. The legacy row is the historical
--   business record and must not be collaterally lost. The sealed
--   canonical-row-delete path should be used only for admin-reviewed
--   mistakes; the two directions of causation (resolver links →
--   admin unlinks) stay distinct.
--
-- IDEMPOTENCE
--   ALTER TABLE ... ADD COLUMN IF NOT EXISTS. DO-block guards every
--   FK + index add. Safe to re-run.
--
-- ROLLBACK (operational, not architectural)
--   BEGIN;
--     ALTER TABLE nex.food_business          DROP CONSTRAINT IF EXISTS fk_fb_canonical_business, DROP COLUMN IF EXISTS canonical_business_id;
--     ALTER TABLE nex.accommodation_business DROP CONSTRAINT IF EXISTS fk_ab_canonical_business, DROP COLUMN IF EXISTS canonical_business_id;
--     ALTER TABLE nex.service_business       DROP CONSTRAINT IF EXISTS fk_sb_canonical_business, DROP COLUMN IF EXISTS canonical_business_id;
--     ALTER TABLE nex.mp_seller              DROP CONSTRAINT IF EXISTS fk_mp_canonical_business, DROP COLUMN IF EXISTS canonical_business_id;
--   COMMIT;
--
-- SAFE ON POPULATED DB
--   Yes. Nullable column + nullable FK. No DML. No row-rewrite · PG
--   stores NULL out-of-band for most types, including UUID (16-byte
--   aligned pointer). ADD COLUMN with no default is a metadata-only
--   operation on PG 11+.
--
-- WHAT THIS MIGRATION IS NOT
--   · Not a backfill. Zero values written.
--   · Not a legacy-schema rewrite. Legacy identity columns (public_
--     listing_ref etc.) stay authoritative on each legacy row.
--   · Not a trigger. The resolver / canonical-handoff path writes the
--     canonical_business_id value in TypeScript.
--   · Not a UNIQUE constraint. One legacy row maps to AT MOST one
--     canonical; one canonical may absorb MANY legacy rows (duplicate
--     deduplication); UNIQUE on canonical_business_id would therefore
--     be wrong.
--
-- NOT APPLIED
--   Phase 1 of the sealed architecture. MUST NOT be applied to any
--   live database without an explicit founder authorisation of the
--   deployment window.

-- ═══════════════════════════════════════════════════════════════════
-- (1) · nex.food_business
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE nex.food_business
  ADD COLUMN IF NOT EXISTS canonical_business_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_fb_canonical_business'
      AND conrelid = 'nex.food_business'::regclass
  ) THEN
    ALTER TABLE nex.food_business
      ADD CONSTRAINT fk_fb_canonical_business
      FOREIGN KEY (canonical_business_id)
      REFERENCES nex.business_canonical (canonical_business_id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_fb_canonical_business
  ON nex.food_business (canonical_business_id)
  WHERE canonical_business_id IS NOT NULL;

COMMENT ON COLUMN nex.food_business.canonical_business_id IS
  'FK into nex.business_canonical (migration 167). NULL until the resolver-driven backfill wave links this legacy row to a canonical. One canonical may absorb many legacy rows (dedup); UNIQUE would be wrong here.';

-- ═══════════════════════════════════════════════════════════════════
-- (2) · nex.accommodation_business
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE nex.accommodation_business
  ADD COLUMN IF NOT EXISTS canonical_business_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_ab_canonical_business'
      AND conrelid = 'nex.accommodation_business'::regclass
  ) THEN
    ALTER TABLE nex.accommodation_business
      ADD CONSTRAINT fk_ab_canonical_business
      FOREIGN KEY (canonical_business_id)
      REFERENCES nex.business_canonical (canonical_business_id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_ab_canonical_business
  ON nex.accommodation_business (canonical_business_id)
  WHERE canonical_business_id IS NOT NULL;

COMMENT ON COLUMN nex.accommodation_business.canonical_business_id IS
  'FK into nex.business_canonical (migration 167). NULL until the resolver-driven backfill wave links this legacy row to a canonical.';

-- ═══════════════════════════════════════════════════════════════════
-- (3) · nex.service_business
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE nex.service_business
  ADD COLUMN IF NOT EXISTS canonical_business_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_sb_canonical_business'
      AND conrelid = 'nex.service_business'::regclass
  ) THEN
    ALTER TABLE nex.service_business
      ADD CONSTRAINT fk_sb_canonical_business
      FOREIGN KEY (canonical_business_id)
      REFERENCES nex.business_canonical (canonical_business_id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_sb_canonical_business
  ON nex.service_business (canonical_business_id)
  WHERE canonical_business_id IS NOT NULL;

COMMENT ON COLUMN nex.service_business.canonical_business_id IS
  'FK into nex.business_canonical (migration 167). NULL until the resolver-driven backfill wave links this legacy row to a canonical.';

-- ═══════════════════════════════════════════════════════════════════
-- (4) · nex.mp_seller
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE nex.mp_seller
  ADD COLUMN IF NOT EXISTS canonical_business_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_mp_canonical_business'
      AND conrelid = 'nex.mp_seller'::regclass
  ) THEN
    ALTER TABLE nex.mp_seller
      ADD CONSTRAINT fk_mp_canonical_business
      FOREIGN KEY (canonical_business_id)
      REFERENCES nex.business_canonical (canonical_business_id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_mp_canonical_business
  ON nex.mp_seller (canonical_business_id)
  WHERE canonical_business_id IS NOT NULL;

COMMENT ON COLUMN nex.mp_seller.canonical_business_id IS
  'FK into nex.business_canonical (migration 167). NULL until the resolver-driven backfill wave links this legacy row to a canonical.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 169.
--
-- Downstream (169 does NOT ship these):
--   171 · nex_business_evidence_backfill — one-shot evidence seed for
--         canonical_business_id-populated legacy rows.
--   (resolver-driven backfill wave, separate Rule-5m authorisation) —
--         actually populates canonical_business_id on legacy rows.
-- ═══════════════════════════════════════════════════════════════════
