-- ============================================================================
-- NEX-native Migration 049 · Supabase Storage bucket for theme hero images
-- ============================================================================
--
-- Purpose:
--   Bridge 4 originally shipped hero_image_url as a plain text field on
--   nex_chat_theme (migration 048) with the plan to add a file upload
--   pipeline later. This migration creates the bucket + policies that
--   the upload pipeline needs · admins can now upload PNG/JPG/WebP
--   files from their computer instead of pasting URLs.
--
--   Bucket: nex-chat-theme-hero
--     · public read (theme images render in every user's browser)
--     · 5 MB per file cap
--     · MIME whitelist · PNG · JPEG · WebP · AVIF
--     · writes gated at the service-role level (admin action only)
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '049';
--     DROP POLICY IF EXISTS "nex_chat_theme_hero_public_read"
--       ON storage.objects;
--     DELETE FROM storage.buckets WHERE id = 'nex-chat-theme-hero';
--   COMMIT;
--   (Note · dropping the bucket deletes any uploaded files.)
-- ============================================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'nex-chat-theme-hero',
  'nex-chat-theme-hero',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public              = EXCLUDED.public,
      file_size_limit     = EXCLUDED.file_size_limit,
      allowed_mime_types  = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "nex_chat_theme_hero_public_read"
  ON storage.objects;
CREATE POLICY "nex_chat_theme_hero_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'nex-chat-theme-hero');

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '049',
    'nex-chat-theme-hero storage bucket · public read · 5MB cap · image MIMEs',
    'Founder-authorised 2026-09-27. Admin theme builder can now upload files directly from the computer · replaces the paste-a-URL flow.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, public, file_size_limit, allowed_mime_types
--     FROM storage.buckets WHERE id = 'nex-chat-theme-hero';
--   SELECT policyname FROM pg_policies
--    WHERE tablename = 'objects' AND policyname = 'nex_chat_theme_hero_public_read';
