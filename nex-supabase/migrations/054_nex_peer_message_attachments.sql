-- ============================================================================
-- NEX-native Migration 054 · Bridge 8 + 9 · Peer message attachments
-- ============================================================================
--
-- Adds image / video / voice-note support to peer messages. A message
-- can now carry ONE attachment alongside its body text (or with an
-- empty body when the attachment is the whole message · a photo, a
-- voice note, etc).
--
-- Columns:
--   attachment_url   text · public URL in nex-peer-chat-attachments
--                    bucket · NULL when the message is text-only
--   attachment_type  text · 'image' | 'video' | 'audio' · matches what
--                    the URL points at · client dispatches renderer
--                    based on this
--   attachment_meta  jsonb · optional client metadata · e.g.
--                    { "duration_ms": 4200, "width": 1920, "height": 1080,
--                      "size_bytes": 123456, "mime": "image/jpeg" } ·
--                    used by the client for waveform / poster / progress
--
-- Constraints:
--   · attachment_type is restricted to the three MIME families we
--     render inline
--   · attachment_url and attachment_type must be both NULL or both set ·
--     no dangling URLs without a type, no types without a source
--   · body is now allowed to be empty when an attachment carries the
--     message · relaxes the previous CHECK that body length >= 1
--
-- RLS:
--   Unchanged · Bridge 3 participant policies still gate reads + writes.
--   Attachment URLs are stored inline on the message row, so they
--   inherit the same access rules.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '054';
--     ALTER TABLE nex_peer_message
--       DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check,
--       DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_pair_check,
--       DROP CONSTRAINT IF EXISTS nex_peer_message_body_or_attachment_check,
--       DROP COLUMN IF EXISTS attachment_url,
--       DROP COLUMN IF EXISTS attachment_type,
--       DROP COLUMN IF EXISTS attachment_meta;
--     -- Optionally restore the strict body length CHECK if it existed.
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_peer_message
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_meta jsonb;

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN ('image', 'video', 'audio')
  );

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_attachment_pair_check
  CHECK ((attachment_url IS NULL) = (attachment_type IS NULL));

-- Body is allowed to be empty when an attachment carries the message.
-- Drop the previous body-length constraint if it existed with the
-- standard name, and replace with a body-or-attachment constraint.
ALTER TABLE nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_body_check;

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_body_or_attachment_check
  CHECK (
    (body IS NOT NULL AND length(trim(body)) > 0)
    OR attachment_url IS NOT NULL
  );

COMMENT ON COLUMN nex_peer_message.attachment_url IS
  'Public URL of a photo, video, or voice note stored in the
   nex-peer-chat-attachments bucket. NULL for text-only messages.
   Sealed 2026-09-27 · Bridge 8+9.';
COMMENT ON COLUMN nex_peer_message.attachment_type IS
  'image | video | audio · client dispatches the inline renderer
   based on this value. Must be set whenever attachment_url is set.';
COMMENT ON COLUMN nex_peer_message.attachment_meta IS
  'Optional metadata about the attachment · duration_ms, width,
   height, size_bytes, mime · used by the client for waveform,
   poster, progress indicators.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '054',
    'Bridge 8+9 · nex_peer_message attachment_url + attachment_type + attachment_meta · body allowed empty with attachment',
    'Founder-authorised 2026-09-27. Camera / Video / Voice attachments on peer messages. Storage bucket configured in migration 055.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_peer_message'
--      AND column_name LIKE 'attachment%';
