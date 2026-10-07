-- ============================================================================
-- NEX-native Migration 144 · Bridge 81 encrypted-attachment MIME repair
-- ============================================================================
--
-- Infrastructure fix for a drift between migration 055 (bucket birth,
-- 2026-09-27) and Bridge 81 (encrypted attachments route, later).
--
-- Bridge 81 (`src/app/api/nex-native/attachment/encrypted/route.ts`)
-- intentionally uploads encrypted ciphertext as:
--
--     application/octet-stream
--
-- so browsers never try to sniff / preview an opaque ciphertext as its
-- original media type. That contract is correct and must not change.
--
-- Migration 055 created the bucket with an MIME whitelist of just
-- image/*, video/*, audio/*. That pre-dated Bridge 81 and silently
-- rejects every encrypted upload with HTTP 415.
--
-- This migration adds `application/octet-stream` to the whitelist. No
-- other field changes. No bucket is created or deleted. The route code,
-- the client helper, the storage path layout, the size cap, and the
-- public-read posture all stay as sealed.
--
-- Why a new migration rather than editing 055:
--   055 is an applied, historical event · modifying it in place would
--   break deployment replay. The project's convention (see 055 itself)
--   is `INSERT ... ON CONFLICT (id) DO UPDATE` for idempotent upserts
--   of bucket config. We follow that pattern.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '144';
--     -- Restore the migration-055 MIME whitelist (does NOT drop the
--     -- bucket · 055 remains the authoritative creator).
--     UPDATE storage.buckets
--        SET allowed_mime_types = ARRAY[
--              'image/png','image/jpeg','image/webp','image/avif','image/gif',
--              'video/mp4','video/webm','video/quicktime',
--              'audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav'
--            ]
--      WHERE id = 'nex-peer-chat-attachments';
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
  26214400, -- 25 * 1024 * 1024 · 25 MB · unchanged from 055
  ARRAY[
    -- Original 055 whitelist · unchanged.
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
    'audio/wav',
    -- Bridge 81 encrypted-attachment ciphertext. Opaque bytes · must
    -- stay generic so no browser sniffing can run against ciphertext.
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '144',
    'Bridge 81 · nex-peer-chat-attachments allow application/octet-stream · encrypted ciphertext uploads',
    'Founder-authorised 2026-10-07 during B.6A Playwright. Bucket 055 pre-dated Bridge 81 encrypted-attachment route · route posts opaque ciphertext as application/octet-stream · whitelist updated to accept it · route code, size cap, public-read posture, and bucket name all unchanged.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT allowed_mime_types FROM storage.buckets
--    WHERE id = 'nex-peer-chat-attachments';
--   -- expect to include 'application/octet-stream'
