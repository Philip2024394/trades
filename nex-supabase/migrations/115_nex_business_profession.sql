-- ============================================================================
-- NEX-native Migration 115 · nex_business.profession_id
-- ============================================================================
--
-- Attach every business to (optionally) one profession row. When set,
-- terminology-service resolves labels via:
--
--   business terminology_overrides (future Phase 2.5, not this migration)
--       ↓ fallback
--   profession default_terminology
--       ↓ fallback
--   vertical default_terminology
--       ↓ fallback
--   GLOBAL_DEFAULT_TERMINOLOGY (in code)
--
-- Nullable. Existing businesses without a profession fall through to
-- the vertical default of their (future) inferred vertical, or the
-- global default. No back-fill in this migration · onboarding writes
-- the value going forward, and existing owners can pick via
-- /manage/profession without silent overwrites.
--
-- CRITICAL invariant (founder-sealed 2026-09-30):
--   Setting or CHANGING profession_id MUST NOT modify any other column
--   on nex_business · never touch cover_layout_id, description,
--   custom sections, info_pages, etc. The application layer enforces
--   this · this migration adds nothing else.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '115';
--     ALTER TABLE nex_business DROP COLUMN IF EXISTS profession_id;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS profession_id uuid REFERENCES nex_profession(id) ON DELETE SET NULL;

COMMENT ON COLUMN nex_business.profession_id IS
  'Optional FK to nex_profession · determines terminology + suggested cover layout. Founder-sealed 2026-09-30 · setting or changing this column MUST NOT modify any other column on nex_business (application layer enforces).';

CREATE INDEX IF NOT EXISTS nex_business_profession_idx
  ON nex_business (profession_id)
  WHERE profession_id IS NOT NULL;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '115',
    'nex_business.profession_id nullable FK to nex_profession + partial index',
    'Founder-authorised 2026-09-30. No back-fill. Business terminology_overrides deferred to Phase 2.5. Bridge Profession-C.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
