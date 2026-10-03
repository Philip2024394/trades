-- ============================================================================
-- NEX-native Migration 128 · nex_vault_entry
-- ============================================================================
--
-- Per-viewer visibility shim for chats and friends moved into the user's
-- Vault. Sealed by Vault build-plan 2026-10-03 (docs/doctrine/vault-build-
-- plan-2026-10-03.md · founder decision D1).
--
-- SCOPE
-- -----
-- Each row records that `account_id` has moved either a single conversation
-- or a whole friend into their own Vault. This is a ONE-SIDED hide: the
-- counterparty's view of the moving account is unchanged. The moving user
-- sees the vaulted conversation/friend disappear from main inbox / contacts
-- and appear inside Vault.
--
-- SA6 ABSOLUTE: no server-side observation of Vault access patterns. This
-- table carries moved_at only. There is no revealed_at, last_viewed_at,
-- view_count, access_count, last_opened_at or similar observation column.
-- Adding one is a doctrine amendment requiring founder re-approval, NOT an
-- implementation detail.
--
-- entry_kind semantics (CHECK-enforced):
--   · 'conversation' → ref_id is a nex_peer_conversation.id. Hides only
--     this conversation from the viewer's inbox. The friend remains in
--     the viewer's Contacts / search / suggestions. The friend's view of
--     the viewer is unchanged.
--   · 'friend'       → ref_id is a nex_account.id. Hides the friend
--     from the viewer's Contacts / search / suggestions / group picker.
--     Implicitly hides every conversation with that friend from the
--     viewer's inbox (queries resolve this through nex_peer_conversation
--     joins; this table does not duplicate per-conversation rows). The
--     friend's view of the viewer is unchanged.
--
-- UNIQUE(account_id, entry_kind, ref_id) · idempotent move operation; a
-- second move is a no-op.
--
-- CASCADE: viewer deletion (SA9 cryptographic erasure) cascades to
-- vault entries. Counterparty deletion does NOT cascade — a dangling
-- ref_id surfaces as an "unknown contact" placeholder inside the viewer's
-- Vault UI.
--
-- RLS owner-scoped. Service-role bypass is forbidden except for the
-- viewer-deletion cascade. Clients may SELECT / INSERT / DELETE only
-- rows where account_id matches the auth-resolved session account.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '128';
--     DROP TABLE IF EXISTS nex_vault_entry CASCADE;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_vault_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  entry_kind TEXT NOT NULL CHECK (entry_kind IN ('conversation', 'friend')),
  ref_id UUID NOT NULL,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nex_vault_entry_unique_per_viewer
    UNIQUE (account_id, entry_kind, ref_id)
);

CREATE INDEX IF NOT EXISTS nex_vault_entry_by_account
  ON nex_vault_entry (account_id, entry_kind);

CREATE INDEX IF NOT EXISTS nex_vault_entry_by_ref
  ON nex_vault_entry (entry_kind, ref_id);

ALTER TABLE nex_vault_entry ENABLE ROW LEVEL SECURITY;

-- SELECT policy · viewer sees only their own rows.
CREATE POLICY nex_vault_entry_select_own
  ON nex_vault_entry
  FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

-- INSERT policy · viewer may only insert rows for their own account.
CREATE POLICY nex_vault_entry_insert_own
  ON nex_vault_entry
  FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

-- DELETE policy · viewer may only delete their own rows (remove-from-vault).
CREATE POLICY nex_vault_entry_delete_own
  ON nex_vault_entry
  FOR DELETE
  USING (
    account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

-- NO update policy · rows are immutable once inserted. moved_at is set
-- at insert time and never changes. To "re-move", delete and re-insert.
-- (The DB has no UPDATE policy; attempts fail by default under RLS.)

COMMENT ON TABLE nex_vault_entry IS
  'Vault visibility shim · per-viewer one-sided hide of a conversation or friend. Sealed by vault-build-plan-2026-10-03 D1.';
COMMENT ON COLUMN nex_vault_entry.entry_kind IS
  '''conversation'' hides one nex_peer_conversation; ''friend'' hides a nex_account and all conversations with them.';
COMMENT ON COLUMN nex_vault_entry.ref_id IS
  'For entry_kind=''conversation'' → nex_peer_conversation.id. For entry_kind=''friend'' → nex_account.id. No FK: counterparty deletion must leave the viewer''s row intact (surfaces as unknown-contact placeholder).';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '128',
    'nex_vault_entry · per-viewer vault visibility shim',
    'Sealed by vault-build-plan-2026-10-03 D1. Stage 3 of 7-stage Vault build. SA6-compliant: moved_at only, no observation columns. Owner-scoped RLS. One-sided hide; counterparty view unchanged.'
  );

COMMIT;
