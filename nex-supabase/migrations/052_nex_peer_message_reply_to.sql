-- ============================================================================
-- NEX-native Migration 052 · Bridge 5 · Reply-to messages
-- ============================================================================
--
-- Turns the peer-chat message log from a flat stream into a threaded
-- conversation. Each message can now quote a previous one · UI renders
-- the quoted preview at the top of the reply bubble.
--
-- Founder direction: WhatsApp's reply-to pattern (swipe-right or long-
-- press → reply) is table stakes for a real chat product. This bridge
-- ships the backend contract so the UI can start writing quoted
-- messages immediately.
--
-- Column:
--   · reply_to_id   uuid NULLABLE  FK → nex_peer_message(id) ON DELETE SET NULL
--     · null = a fresh message
--     · non-null = a reply to the target message
--     · ON DELETE SET NULL: if the quoted message gets deleted, the
--       reply keeps its own body but the quote pointer clears
--     · index on it so we can efficiently look up "how many replies
--       does this message have" (thread depth · future feature)
--
-- No table renames · no constraint changes · no seed impact. Existing
-- rows get NULL and stay valid.
--
-- RLS is inherited from migration 047's nex_peer_message policies ·
-- nothing to add here.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '052';
--     ALTER TABLE nex_peer_message DROP COLUMN IF EXISTS reply_to_id;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_peer_message
  ADD COLUMN IF NOT EXISTS reply_to_id uuid
    REFERENCES nex_peer_message(id) ON DELETE SET NULL;

COMMENT ON COLUMN nex_peer_message.reply_to_id IS
  'When non-null · this message quotes the referenced peer message ·
   the UI renders a quote header inside the reply bubble.
   ON DELETE SET NULL · quote pointer clears if the target is deleted.
   Sealed 2026-09-27 · Bridge 5.';

CREATE INDEX IF NOT EXISTS idx_nex_peer_message_reply_to
  ON nex_peer_message (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '052',
    'Bridge 5 · nex_peer_message.reply_to_id · quoted-message threading',
    'Founder-authorised 2026-09-27. WhatsApp-style reply-to. Nullable FK · ON DELETE SET NULL. Partial index on non-null. No RLS change · inherits from migration 047.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_peer_message' AND column_name = 'reply_to_id';
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'nex_peer_message' AND indexname = 'idx_nex_peer_message_reply_to';
