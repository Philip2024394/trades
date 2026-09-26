-- ============================================================================
-- NEX-native Migration 040 · nex_generated_site · add 'warm-artisan' template
-- ============================================================================
-- Wave D Slice 16c · second template alongside 'modern-minimal'.
-- Drops the CHECK and re-adds with the new value included.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '040';
--     ALTER TABLE nex_generated_site DROP CONSTRAINT IF EXISTS nex_generated_site_template_known;
--     ALTER TABLE nex_generated_site
--       ADD CONSTRAINT nex_generated_site_template_known
--         CHECK (template_name IN ('modern-minimal'));
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_generated_site
  DROP CONSTRAINT IF EXISTS nex_generated_site_template_known;

ALTER TABLE nex_generated_site
  ADD CONSTRAINT nex_generated_site_template_known
    CHECK (template_name IN ('modern-minimal', 'warm-artisan'));

COMMENT ON COLUMN nex_generated_site.template_name IS
  'Site template · modern-minimal (default · flat neutral) or warm-artisan (serif · earthy palette · softer edges).';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '040',
    'Wave D Slice 16c · nex_generated_site.template_name CHECK expanded to warm-artisan',
    'Public site page branches by template_name · service NEX_SITE_TEMPLATES kept in sync.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
