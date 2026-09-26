-- ============================================================================
-- NEX-native Migration 004 · nex_conversation + nex_conversation_participant + nex_message
-- ============================================================================
--
-- Purpose:
--   Conversation infrastructure between a business and its customers.
--   Every message references a conversation · every conversation has
--   participants (accounts) with a side (business/customer) · every
--   message has a sender.
--
-- Doctrine references:
--   · Identity Doctrine · every participant is a nex_account UUID
--     · never phone/email
--   · Commercial Doctrine · basic conversation is free · no
--     pay-to-reply / pay-to-see-lead
--   · Build Order · nervous system first · messages are real persisted
--     records not UI-only simulation
--   · Product-context · a conversation may optionally be about a specific
--     product (about_product_id nullable)
--
-- Immutability:
--   nex_message rows are IMMUTABLE after INSERT. No UPDATE policy is
--   granted for any role · corrections are new messages · audit trail
--   preserved.
--
-- FK behaviour:
--   business_id → RESTRICT (business must exist for lifetime of thread)
--   about_product_id → SET NULL (product may be archived without losing
--                      the conversation reference)
--   participant.conversation_id → CASCADE (deleting conversation deletes
--                                 its participants · rare · service-role only)
--   participant.account_id → RESTRICT (never orphan a participant)
--   message.conversation_id → RESTRICT (never orphan a message)
--   message.sender_account_id → RESTRICT (never orphan a sender)
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '004';
--     DROP TABLE IF EXISTS nex_message;
--     DROP TABLE IF EXISTS nex_conversation_participant;
--     DROP TABLE IF EXISTS nex_conversation;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. nex_conversation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_conversation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid NOT NULL REFERENCES nex_business(id) ON DELETE RESTRICT,
  about_product_id    uuid REFERENCES nex_product(id) ON DELETE SET NULL,
    -- Optional product context. If set, the conversation is scoped to a
    -- specific product (relevant for "Ask about this product" flow).
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_conversation IS
  'Conversation thread scoped to a business · optionally scoped to a specific product.';

CREATE INDEX IF NOT EXISTS idx_nex_conversation_business_id
  ON nex_conversation (business_id);

CREATE INDEX IF NOT EXISTS idx_nex_conversation_about_product_id
  ON nex_conversation (about_product_id)
  WHERE about_product_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. nex_conversation_participant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_conversation_participant (
  conversation_id     uuid NOT NULL REFERENCES nex_conversation(id) ON DELETE CASCADE,
  account_id          uuid NOT NULL REFERENCES nex_account(id) ON DELETE RESTRICT,
  side                text NOT NULL CHECK (side IN ('business', 'customer')),
    -- Enforces which side of the conversation the participant is on.
    -- A single account cannot be on both sides of the same conversation.
  joined_at           timestamptz NOT NULL DEFAULT now(),
  last_read_at        timestamptz,
  PRIMARY KEY (conversation_id, account_id)
);

COMMENT ON TABLE nex_conversation_participant IS
  'Which nex_accounts participate in a conversation and on which side. last_read_at powers read-receipts.';

CREATE INDEX IF NOT EXISTS idx_nex_conversation_participant_account_id
  ON nex_conversation_participant (account_id);

-- ---------------------------------------------------------------------------
-- 3. nex_message
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_message (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       uuid NOT NULL REFERENCES nex_conversation(id) ON DELETE RESTRICT,
  sender_account_id     uuid NOT NULL REFERENCES nex_account(id) ON DELETE RESTRICT,
  body                  text NOT NULL CHECK (length(body) > 0),
    -- Non-empty. Corrections are new messages · never mutation.
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_message IS
  'Message content · IMMUTABLE after INSERT. Corrections are new messages · never mutation. Sender is a nex_account UUID.';

CREATE INDEX IF NOT EXISTS idx_nex_message_conversation_id_created_at
  ON nex_message (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_nex_message_sender_account_id
  ON nex_message (sender_account_id);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE nex_conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_conversation_participant ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_message ENABLE ROW LEVEL SECURITY;

-- Helper predicate: is the current user a participant in this conversation?
-- Inlined for policy readability · Postgres inlines EXISTS subqueries well.

-- nex_conversation · participants can read
CREATE POLICY nex_conversation_participant_read
  ON nex_conversation
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT p.conversation_id FROM nex_conversation_participant p
      JOIN nex_account a ON a.id = p.account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- nex_conversation_participant · self-visible + also visible to business
-- owner (so a merchant can see who they're talking to on their side).
CREATE POLICY nex_conversation_participant_self_read
  ON nex_conversation_participant
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
    OR conversation_id IN (
      SELECT c.id FROM nex_conversation c
      JOIN nex_business b ON b.id = c.business_id
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- nex_message · participants of the conversation can read
CREATE POLICY nex_message_participant_read
  ON nex_message
  FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT p.conversation_id FROM nex_conversation_participant p
      JOIN nex_account a ON a.id = p.account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- nex_message · authenticated user can INSERT if they are a participant
CREATE POLICY nex_message_participant_insert
  ON nex_message
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
    AND conversation_id IN (
      SELECT p.conversation_id FROM nex_conversation_participant p
      WHERE p.account_id = nex_message.sender_account_id
    )
  );

-- NO UPDATE / DELETE policies on nex_message · immutability by default.
-- Conversation + participant lifecycle managed via service-role.

INSERT INTO nex_migration_history (version, description, notes)
VALUES ('004', 'nex_conversation + participant + message · immutable messages · participant-scoped RLS', 'Messages IMMUTABLE by policy (no UPDATE/DELETE for any role). Participants can read own conversations + messages. Business owner sees participants of conversations on their business.')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT * FROM nex_migration_history WHERE version = '004';
--   SELECT count(*) FROM nex_conversation;
--   SELECT count(*) FROM nex_conversation_participant;
--   SELECT count(*) FROM nex_message;
--   SELECT tablename, policyname FROM pg_policies
--     WHERE tablename IN ('nex_conversation','nex_conversation_participant','nex_message')
--     ORDER BY tablename, policyname;
