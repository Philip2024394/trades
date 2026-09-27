-- ============================================================================
-- NEX-native Migration 055 · Bridge 8 + 9 · Peer chat attachments bucket
-- ============================================================================
--
-- Storage bucket that holds photos, videos, and voice notes sent via
-- peer chat messages. Public read (URLs are shareable · same rule as
-- nex-chat-theme-hero · Supabase Storage doesn't gate public buckets
-- through RLS). Writes are gated by the service-role client only ·
-- users never PUT directly to storage · they upload through the
-- server action which validates size, MIME, and participation.
--
-- MIME whitelist:
--   images  · png · jpeg · webp · avif · gif
--   videos  · mp4 · webm · quicktime (iOS mov)
--   audio   · webm · mp4 · mpeg · ogg · wav
--
-- Size cap: 25 MB per file · matches the practical mobile upload
-- ceiling for a chat context. Longer videos should be trimmed
-- client-side before upload.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '055';
--     DELETE FROM storage.buckets WHERE id = 'nex-peer-chat-attachments';
--   COMMIT;
-- ============================================================================

BEGIN;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'nex-peer-chat-attachments',
  'nex-peer-chat-attachments',
  true,
  26214400, -- 25 * 1024 * 1024 · 25 MB
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/avif',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '055',
    'Bridge 8+9 · nex-peer-chat-attachments storage bucket · public read · 25MB cap · image/video/audio MIMEs',
    'Founder-authorised 2026-09-27. Camera / Video / Voice attachments live here. Uploads gated through the server action, not direct.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, public, file_size_limit
--     FROM storage.buckets WHERE id = 'nex-peer-chat-attachments';
