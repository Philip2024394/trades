-- ============================================================================
-- NEX-native Migration 045 · nex_account_profile.avatar_url + storage bucket
-- ============================================================================
--
-- Purpose:
--   Give every NEX account a real profile image · the single biggest
--   visual upgrade for the world-class chat card design (Founder brief
--   2026-09-27 · "top UI designer" consultation).
--
--   avatar_url column holds the public storage URL returned by
--   Supabase Storage after upload. Rendered as a 48x48 <img> in chat
--   cards, with the existing initials-in-a-circle as fallback when
--   the column is null.
--
-- Storage:
--   Creates the 'nex-avatars' bucket with public read so the URL
--   works in an <img src> without an auth header. Upload path is
--   {account_id}/avatar.{ext} · the server action generates the URL
--   after upload. Bucket is service-role writable only (no public
--   INSERT policy on storage.objects); the app's server action uses
--   the admin client to perform the upload after validating the file.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '045';
--     ALTER TABLE nex_account_profile DROP COLUMN IF EXISTS avatar_url;
--     -- Bucket left in place · rolling back a column shouldn't
--     -- silently strand storage objects. Manual bucket cleanup only.
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE nex_account_profile
  ADD CONSTRAINT nex_account_profile_avatar_url_len
  CHECK (avatar_url IS NULL OR length(avatar_url) BETWEEN 8 AND 2048);

COMMENT ON COLUMN nex_account_profile.avatar_url IS
  'Public URL to the account owner''s profile image (jpeg/png/webp). Uploaded to the nex-avatars Supabase Storage bucket. Null when no image is set · UI falls back to initials.';

-- Public-read avatar bucket · created idempotently.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('nex-avatars', 'nex-avatars', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '045',
    'nex_account_profile.avatar_url + nex-avatars storage bucket',
    'Founder-authorised 2026-09-27. Enables real profile images on chat cards. Public-read bucket · uploads only via server action using admin client. avatar_url column length CHECK 8..2048.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_name = 'nex_account_profile' AND column_name = 'avatar_url';
--   SELECT id, public FROM storage.buckets WHERE id = 'nex-avatars';
--   SELECT * FROM nex_migration_history WHERE version = '045';
