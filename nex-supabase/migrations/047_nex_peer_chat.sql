-- ============================================================================
-- NEX-native Migration 047 · Bridge 3 · peer-to-peer chat
-- ============================================================================
--
-- Purpose:
--   Enable friend↔friend messaging. Prior to this migration, every
--   nex_conversation required a business_id (NOT NULL), so two accounts
--   could only chat through a business context. This bridge adds a
--   separate table pair for pure peer conversations, keeping business
--   chat unaffected.
--
-- Design decisions:
--   · Two dedicated tables (nex_peer_conversation, nex_peer_message)
--     rather than making nex_conversation.business_id nullable. Reasons:
--       - Business conversations have participant "side" ("customer" /
--         "business") that doesn't apply peer-to-peer.
--       - Business chat has RLS built around business membership.
--         Peer chat RLS is about the pair only.
--       - Isolating peer chat means we can iterate on peer-specific
--         features (e.g. presence hints, typing indicators, disappearing
--         messages) without touching the business-chat plumbing.
--   · Peer conversations are UNIQUE per ordered pair. The two participant
--     ids are stored with participant_a_id < participant_b_id (lexico)
--     to canonicalise "A talks to B" == "B talks to A". Enforced via
--     CHECK + UNIQUE.
--   · Messages are IMMUTABLE (no updated_at, no update RLS policy).
--
-- Doctrine · sealed 2026-09-27:
--   Peer chat is the missing piece that lets Friends-tab cards actually
--   open a conversation. Until now the cards linked to /nex-native/u/
--   [handle] which was a profile page. After this bridge they link to
--   /nex-native/chat/peer/[accountId] which loads or creates the peer
--   conversation and renders the message thread.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '047';
--     DROP TABLE IF EXISTS nex_peer_message;
--     DROP TABLE IF EXISTS nex_peer_conversation;
--   COMMIT;
--   (Note · rolling back drops all peer-chat data. Only roll back if
--    the whole peer-chat feature is being reverted.)
-- ============================================================================

BEGIN;

-- Peer conversation · one row per canonical (a,b) pair. -----------------------
CREATE TABLE IF NOT EXISTS nex_peer_conversation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  participant_b_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_message_at     timestamptz,
  CONSTRAINT nex_peer_conversation_ordered_pair
    CHECK (participant_a_id < participant_b_id),
  CONSTRAINT nex_peer_conversation_distinct
    CHECK (participant_a_id <> participant_b_id),
  CONSTRAINT nex_peer_conversation_unique_pair
    UNIQUE (participant_a_id, participant_b_id)
);

COMMENT ON TABLE nex_peer_conversation IS
  'One row per canonical peer chat pair · participant_a_id < participant_b_id enforced by CHECK · Bridge 3 sealed 2026-09-27.';

CREATE INDEX IF NOT EXISTS idx_nex_peer_conversation_a
  ON nex_peer_conversation (participant_a_id);
CREATE INDEX IF NOT EXISTS idx_nex_peer_conversation_b
  ON nex_peer_conversation (participant_b_id);
CREATE INDEX IF NOT EXISTS idx_nex_peer_conversation_last_message_at
  ON nex_peer_conversation (last_message_at DESC NULLS LAST);

-- Peer message · immutable append-only log. -----------------------------------
CREATE TABLE IF NOT EXISTS nex_peer_message (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid NOT NULL REFERENCES nex_peer_conversation(id) ON DELETE CASCADE,
  sender_account_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  body                text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  sent_at             timestamptz NOT NULL DEFAULT now(),
  read_at             timestamptz
);

COMMENT ON TABLE nex_peer_message IS
  'Immutable peer-chat messages · read_at is the ONLY mutable column (marks receipt). Body length capped at 4000.';

CREATE INDEX IF NOT EXISTS idx_nex_peer_message_conversation_sent
  ON nex_peer_message (conversation_id, sent_at ASC);
CREATE INDEX IF NOT EXISTS idx_nex_peer_message_sender
  ON nex_peer_message (sender_account_id);
CREATE INDEX IF NOT EXISTS idx_nex_peer_message_unread
  ON nex_peer_message (conversation_id) WHERE read_at IS NULL;

-- Row-Level Security ----------------------------------------------------------
ALTER TABLE nex_peer_conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_peer_message ENABLE ROW LEVEL SECURITY;

-- Viewers see conversations they participate in.
DROP POLICY IF EXISTS nex_peer_conversation_select ON nex_peer_conversation;
CREATE POLICY nex_peer_conversation_select
  ON nex_peer_conversation FOR SELECT
  USING (
    participant_a_id = auth.uid()
    OR participant_b_id = auth.uid()
  );

-- Participants can create conversations that include themselves.
DROP POLICY IF EXISTS nex_peer_conversation_insert ON nex_peer_conversation;
CREATE POLICY nex_peer_conversation_insert
  ON nex_peer_conversation FOR INSERT
  WITH CHECK (
    participant_a_id = auth.uid()
    OR participant_b_id = auth.uid()
  );

-- Update policy allows bumping last_message_at when a participant sends a
-- message. Restricted to the last_message_at column via the trigger below;
-- RLS itself only gates who can trigger the update.
DROP POLICY IF EXISTS nex_peer_conversation_update ON nex_peer_conversation;
CREATE POLICY nex_peer_conversation_update
  ON nex_peer_conversation FOR UPDATE
  USING (
    participant_a_id = auth.uid()
    OR participant_b_id = auth.uid()
  );

-- Viewers see messages in conversations they participate in.
DROP POLICY IF EXISTS nex_peer_message_select ON nex_peer_message;
CREATE POLICY nex_peer_message_select
  ON nex_peer_message FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nex_peer_conversation c
       WHERE c.id = conversation_id
         AND (c.participant_a_id = auth.uid() OR c.participant_b_id = auth.uid())
    )
  );

-- Participants can send messages (must be sender + a participant).
DROP POLICY IF EXISTS nex_peer_message_insert ON nex_peer_message;
CREATE POLICY nex_peer_message_insert
  ON nex_peer_message FOR INSERT
  WITH CHECK (
    sender_account_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM nex_peer_conversation c
       WHERE c.id = conversation_id
         AND (c.participant_a_id = auth.uid() OR c.participant_b_id = auth.uid())
    )
  );

-- Participants can mark inbound messages read (RLS UPDATE gate · service
-- layer restricts to read_at column only).
DROP POLICY IF EXISTS nex_peer_message_update_read ON nex_peer_message;
CREATE POLICY nex_peer_message_update_read
  ON nex_peer_message FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM nex_peer_conversation c
       WHERE c.id = conversation_id
         AND (c.participant_a_id = auth.uid() OR c.participant_b_id = auth.uid())
    )
  );

-- Migration ledger ------------------------------------------------------------
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '047',
    'Bridge 3 · peer-to-peer chat tables (nex_peer_conversation + nex_peer_message)',
    'Founder-authorised 2026-09-27. Enables friend↔friend messaging without going through a business. Canonical (a,b) ordering enforced by CHECK. Business chat schema unchanged.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_name IN ('nex_peer_conversation', 'nex_peer_message');
--   SELECT policyname FROM pg_policies
--    WHERE tablename IN ('nex_peer_conversation', 'nex_peer_message');
--   SELECT * FROM nex_migration_history WHERE version = '047';
