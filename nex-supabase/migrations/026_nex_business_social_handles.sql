-- ============================================================================
-- NEX-native Migration 026 · nex_business social handles
-- ============================================================================
--
-- Purpose:
--   Wave B Slice 3d · merchant advertises their social presence · buyer
--   sees a small row of platform icons linking out. Public display only ·
--   never used for auth / relationship keys · Identity Doctrine intact.
--
--   Five nullable text columns · each ≤ 64 chars · pattern check enforced.
--   Handles are stored WITHOUT the leading `@`. Consumers (public page)
--   compose the platform URL (e.g. https://instagram.com/<handle>).
--
-- Doctrine:
--   · Anti-fabrication · nullable · null = no claim
--   · CHECK on each field: NULL OR matches ^[A-Za-z0-9._-]{1,64}$
--   · Storage-layer size + shape guard · defence-in-depth
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '026';
--     ALTER TABLE nex_business DROP CONSTRAINT IF EXISTS nex_business_social_handles_shape;
--     ALTER TABLE nex_business
--       DROP COLUMN IF EXISTS instagram_handle,
--       DROP COLUMN IF EXISTS facebook_handle,
--       DROP COLUMN IF EXISTS tiktok_handle,
--       DROP COLUMN IF EXISTS linkedin_handle,
--       DROP COLUMN IF EXISTS x_handle;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS facebook_handle  text,
  ADD COLUMN IF NOT EXISTS tiktok_handle    text,
  ADD COLUMN IF NOT EXISTS linkedin_handle  text,
  ADD COLUMN IF NOT EXISTS x_handle         text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_business_social_handles_shape'
       AND conrelid = 'nex_business'::regclass
  ) THEN
    ALTER TABLE nex_business
      ADD CONSTRAINT nex_business_social_handles_shape CHECK (
        (instagram_handle IS NULL OR instagram_handle ~ '^[A-Za-z0-9._-]{1,64}$') AND
        (facebook_handle  IS NULL OR facebook_handle  ~ '^[A-Za-z0-9._-]{1,64}$') AND
        (tiktok_handle    IS NULL OR tiktok_handle    ~ '^[A-Za-z0-9._-]{1,64}$') AND
        (linkedin_handle  IS NULL OR linkedin_handle  ~ '^[A-Za-z0-9._-]{1,64}$') AND
        (x_handle         IS NULL OR x_handle         ~ '^[A-Za-z0-9._-]{1,64}$')
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_business.instagram_handle IS 'Instagram username · stored WITHOUT leading @ · displayed as https://instagram.com/<handle>.';
COMMENT ON COLUMN nex_business.facebook_handle  IS 'Facebook page slug · stored without leading @ · https://facebook.com/<handle>.';
COMMENT ON COLUMN nex_business.tiktok_handle    IS 'TikTok username · stored without leading @ · https://tiktok.com/@<handle>.';
COMMENT ON COLUMN nex_business.linkedin_handle  IS 'LinkedIn identifier (company or in/personal) · stored without leading @.';
COMMENT ON COLUMN nex_business.x_handle         IS 'X (Twitter) username · stored without leading @ · https://x.com/<handle>.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '026',
    'nex_business social handles · instagram/facebook/tiktok/linkedin/x · nullable + shape CHECK',
    'Wave B Slice 3d · Founder-authorised keypad build 2026-09-24. Public display only · never a relationship key.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_business'
--      AND column_name IN ('instagram_handle','facebook_handle','tiktok_handle','linkedin_handle','x_handle')
--    ORDER BY column_name;
--     -- expect: 5 rows
-- ============================================================================
