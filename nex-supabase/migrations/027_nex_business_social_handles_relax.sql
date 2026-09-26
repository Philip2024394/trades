-- ============================================================================
-- NEX-native Migration 027 · relax social handle CHECK to allow slash
-- ============================================================================
--
-- Purpose:
--   Wave B Slice 3d follow-up · LinkedIn handles legitimately contain a
--   forward slash (e.g. "company/my-shop" or "in/philip"). The pattern
--   from migration 026 (`^[A-Za-z0-9._-]{1,64}$`) rejects them · relax
--   to include `/`.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '027';
--     ALTER TABLE nex_business DROP CONSTRAINT IF EXISTS nex_business_social_handles_shape;
--     ALTER TABLE nex_business
--       ADD CONSTRAINT nex_business_social_handles_shape CHECK (
--         (instagram_handle IS NULL OR instagram_handle ~ '^[A-Za-z0-9._-]{1,64}$') AND
--         (facebook_handle  IS NULL OR facebook_handle  ~ '^[A-Za-z0-9._-]{1,64}$') AND
--         (tiktok_handle    IS NULL OR tiktok_handle    ~ '^[A-Za-z0-9._-]{1,64}$') AND
--         (linkedin_handle  IS NULL OR linkedin_handle  ~ '^[A-Za-z0-9._-]{1,64}$') AND
--         (x_handle         IS NULL OR x_handle         ~ '^[A-Za-z0-9._-]{1,64}$')
--       );
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business DROP CONSTRAINT IF EXISTS nex_business_social_handles_shape;

ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_social_handles_shape CHECK (
    (instagram_handle IS NULL OR instagram_handle ~ '^[A-Za-z0-9._/\-]{1,64}$') AND
    (facebook_handle  IS NULL OR facebook_handle  ~ '^[A-Za-z0-9._/\-]{1,64}$') AND
    (tiktok_handle    IS NULL OR tiktok_handle    ~ '^[A-Za-z0-9._/\-]{1,64}$') AND
    (linkedin_handle  IS NULL OR linkedin_handle  ~ '^[A-Za-z0-9._/\-]{1,64}$') AND
    (x_handle         IS NULL OR x_handle         ~ '^[A-Za-z0-9._/\-]{1,64}$')
  );

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '027',
    'nex_business social handles · relax CHECK to allow forward slash (LinkedIn company/handle)',
    'Wave B Slice 3d follow-up · LinkedIn handles legitimately contain / · migration 026 pattern was too strict.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
