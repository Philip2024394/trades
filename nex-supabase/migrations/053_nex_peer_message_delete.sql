-- ============================================================================
-- NEX-native Migration 053 · Bridge 6 · Delete messages
-- ============================================================================
--
-- WhatsApp-style "Delete for everyone" · sender can retract a peer
-- message within a 1-hour window. Recipients see a "🚫 This message
-- was deleted" placeholder in the same slot instead of the body.
--
-- Columns:
--   · deleted_for_everyone  boolean · default false · flips to true when
--     the sender retracts the message. Client-side UI reads this
--     to decide whether to render the body or the placeholder.
--   · deleted_at            timestamptz · when the retraction happened ·
--     useful for auditing + tombstone lifetime policies later
--
-- "Delete for me" (per-viewer soft delete on the recipient side) is
-- deferred to a follow-up bridge · needs a separate
-- nex_peer_message_hidden(message_id, viewer_id) table so viewers can
-- hide messages from their own view without affecting the sender or
-- other participants.
--
-- Body is intentionally NOT nulled when a message is deleted:
--   · reply_to_id joins keep working
--   · admin/audit can still see the retracted content
--   · client filters by deleted_for_everyone before rendering
--
-- RLS unchanged · Bridge 3 participant policies still cover reads +
-- writes. Delete is expressed as an UPDATE (setting the flags), not a
-- DROP row, so the existing UPDATE policy already permits it.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '053';
--     ALTER TABLE nex_peer_message
--       DROP COLUMN IF EXISTS deleted_for_everyone,
--       DROP COLUMN IF EXISTS deleted_at;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_peer_message
  ADD COLUMN IF NOT EXISTS deleted_for_everyone boolean NOT NULL DEFAULT false;

ALTER TABLE nex_peer_message
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN nex_peer_message.deleted_for_everyone IS
  'When true, the message was retracted by its sender. Client renders
   a "🚫 deleted" placeholder in its slot. Body is preserved for audit.
   Sealed 2026-09-27 · Bridge 6.';
COMMENT ON COLUMN nex_peer_message.deleted_at IS
  'When the retraction happened. Non-null only when
   deleted_for_everyone = true.';

CREATE INDEX IF NOT EXISTS idx_nex_peer_message_deleted
  ON nex_peer_message (conversation_id, deleted_for_everyone);

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '053',
    'Bridge 6 · nex_peer_message.deleted_for_everyone + deleted_at · sender-retract within 1-hour window',
    'Founder-authorised 2026-09-27. WhatsApp-style delete for everyone. Body preserved · UI filters. Delete for me (per-viewer) deferred to follow-up bridge.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_peer_message'
--      AND column_name IN ('deleted_for_everyone', 'deleted_at');
