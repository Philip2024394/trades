-- ============================================================================
-- NEX-native Migration 140 · Vault Persistence (Phase A.1)
-- ============================================================================
--
-- Founder-sealed 2026-10-06 as Phase A.1 of the Vault commercial sequence.
-- Supersedes the Stage-3 "visibility shim only" scope · Vault now actually
-- preserves content. Phase A (full E2E key portability) remains the next
-- sealed step; this migration does NOT weaken E2E encryption or introduce
-- plaintext anywhere.
--
-- SCOPE
-- -----
-- 1. nex_vault_file gains two nullable linkage columns so Vault can track
--    files that originated from a chat attachment copy (as opposed to a
--    standalone owner upload). source_message_id + source_conversation_id
--    anchor the copy back to the chat message it came from and make the
--    move-to-vault operation idempotent via a partial unique index.
--
-- 2. The Bridge 78 purge function (migration 094) is replaced with a
--    vault-aware version. Encrypted ciphertext rows that would otherwise
--    be purged are now preserved IF the recipient device belongs to an
--    account that has vaulted the conversation. This is the SMALLEST
--    change that honours the sealed product promise ("move a conversation
--    to Vault and keep it in your private NEX storage") without touching
--    the fan-out encryption model.
--
-- LOAD-BEARING RULES (per founder's approval 2026-10-06)
-- -------------------------------------------------------
--   · The server CANNOT decrypt. These rows stay ciphertext · the row's
--     recipient_device_id continues to decide who can read it.
--   · No plaintext copies are introduced server-side.
--   · The Curve25519 fan-out encryption model is unchanged.
--   · Bridge 78 continues to purge ALL non-vaulted delivered-encrypted
--     rows on the 7-day cadence · vaulting is the ONLY exemption.
--   · "Vaulted" is deterministic + testable · a row is vaulted IFF a
--     vault entry grants the recipient device's owner access to the
--     parent conversation (direct vault or via friend-vault).
--
-- EXEMPTION PREDICATE (fully specified for test clarity)
-- -------------------------------------------------------
-- A row pm (encrypted=true, delivered_at NOT NULL, > 7d old) is PURGED
-- unless there exists a nex_vault_entry ve + nex_account_device_key adk
-- such that:
--     adk.account_id    = ve.account_id
-- AND adk.device_id     = pm.recipient_device_id
-- AND one of:
--     (A) ve.entry_kind = 'conversation' AND ve.ref_id = pm.conversation_id
--     (B) ve.entry_kind = 'friend' AND the vaulted friend id matches
--         the "other" participant of the conversation containing pm
--         (so adk.account_id is a participant of the conversation, and
--         ve.ref_id is the opposite participant).
--
-- Case (A) · Alice vaults her conversation with Bob · Alice's own-device
--            fan-out rows are preserved (she can re-render her outbox);
--            Bob's device rows are purged unless Bob also vaults.
-- Case (B) · Alice vaults Bob as a friend · every conversation with Bob,
--            including Alice's own-device rows, is preserved for Alice.
--
-- No row is preserved just because SOMEONE has opened Vault. The predicate
-- is scoped strictly through recipient_device_id → account_id → vault
-- entry · the server never guesses coverage.
--
-- Rollback:
--   BEGIN;
--     -- Restore Bridge 78 to migration 094's original definition:
--     CREATE OR REPLACE FUNCTION nex_purge_delivered_encrypted_messages(
--       retain_days int default 7
--     ) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
--     DECLARE effective_days int; purged int;
--     BEGIN
--       effective_days := greatest(retain_days, 1);
--       WITH victims AS (
--         DELETE FROM nex_peer_message
--         WHERE encrypted = true
--           AND delivered_at IS NOT NULL
--           AND delivered_at < (now() - (effective_days || ' days')::interval)
--         RETURNING id
--       )
--       SELECT count(*) INTO purged FROM victims;
--       RETURN purged;
--     END;
--     $$;
--     ALTER TABLE nex_vault_file
--       DROP COLUMN IF EXISTS source_message_id,
--       DROP COLUMN IF EXISTS source_conversation_id;
--     DROP INDEX IF EXISTS nex_vault_file_source_message_unique;
--     DELETE FROM nex_migration_history WHERE version = '140';
--   COMMIT;
-- ============================================================================

BEGIN;

-- ─── 1. nex_vault_file linkage columns ─────────────────────────────────
ALTER TABLE nex_vault_file
  ADD COLUMN IF NOT EXISTS source_message_id uuid NULL,
  ADD COLUMN IF NOT EXISTS source_conversation_id uuid NULL;

COMMENT ON COLUMN nex_vault_file.source_message_id IS
  'When this file was copied from a chat attachment on move-to-vault, '
  'the nex_peer_message.id it came from. NULL for standalone uploads. '
  'Phase A.1 · migration 140. No FK (the chat message may be purged by '
  'the normal Bridge 78 lifecycle for non-vaulted rows; the vault copy '
  'is the authoritative permanent reference).';

COMMENT ON COLUMN nex_vault_file.source_conversation_id IS
  'The nex_peer_conversation.id this attachment belonged to. Used to '
  'cascade-delete vault copies when the conversation is removed from '
  'Vault. NULL for standalone uploads. No FK (conversations may be '
  'deleted by participant-side policy; the vault copy survives).';

-- Idempotency: moving the same conversation to vault twice must not
-- duplicate the attachment copy. Partial unique index: enforce
-- (account_id, source_message_id) uniqueness only when the row is a
-- chat-origin copy. Standalone uploads (source_message_id IS NULL)
-- remain multi-row per account as before.
CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_file_source_message_unique
  ON nex_vault_file (account_id, source_message_id)
  WHERE source_message_id IS NOT NULL;

-- Lookup index for the cascade-delete on remove-from-vault.
CREATE INDEX IF NOT EXISTS nex_vault_file_source_conversation_idx
  ON nex_vault_file (account_id, source_conversation_id)
  WHERE source_conversation_id IS NOT NULL;

-- ─── 2. Bridge 78 purge · vault-aware replacement ──────────────────────
CREATE OR REPLACE FUNCTION nex_purge_delivered_encrypted_messages(
  retain_days int default 7
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_days int;
  purged int;
BEGIN
  effective_days := greatest(retain_days, 1);

  WITH victims AS (
    DELETE FROM nex_peer_message pm
    WHERE pm.encrypted = true
      AND pm.delivered_at IS NOT NULL
      AND pm.delivered_at < (now() - (effective_days || ' days')::interval)
      -- Phase A.1 vault preservation (migration 140):
      -- Preserve the row IF the recipient device belongs to an account
      -- that has either (A) vaulted this conversation directly, OR
      -- (B) vaulted a friend who is the other participant.
      AND NOT EXISTS (
        SELECT 1
        FROM nex_vault_entry ve
        JOIN nex_account_device_key adk
          ON adk.account_id = ve.account_id
         AND adk.device_id = pm.recipient_device_id
        WHERE ve.entry_kind = 'conversation'
          AND ve.ref_id = pm.conversation_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM nex_vault_entry ve
        JOIN nex_peer_conversation pc
          ON pc.id = pm.conversation_id
        JOIN nex_account_device_key adk
          ON adk.account_id = ve.account_id
         AND adk.device_id = pm.recipient_device_id
        WHERE ve.entry_kind = 'friend'
          AND (
            (ve.ref_id = pc.participant_a_id AND ve.account_id = pc.participant_b_id)
            OR
            (ve.ref_id = pc.participant_b_id AND ve.account_id = pc.participant_a_id)
          )
      )
    RETURNING id
  )
  SELECT count(*) INTO purged FROM victims;

  RETURN purged;
END;
$$;

COMMENT ON FUNCTION nex_purge_delivered_encrypted_messages(int) IS
  'Bridge 78 · sealed 2026-09-29 · vault-aware 2026-10-06 (Phase A.1 · '
  'migration 140). Deletes encrypted peer-messages that have been '
  'delivered at least <retain_days> ago (default 7). Vault-exempt: '
  'rows whose recipient_device_id belongs to an account that has '
  'vaulted the parent conversation (directly or via friend-vault) are '
  'preserved · the vault owner can continue to decrypt them with their '
  'existing device key. Server never decrypts; no plaintext introduced. '
  'See migration 140 header for the full exemption predicate.';

-- ─── 3. migration ledger ───────────────────────────────────────────────
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '140',
    'Phase A.1 Vault persistence · nex_vault_file linkage + Bridge 78 vault-aware purge',
    'Sealed 2026-10-06 after audit found Vault was visibility-shim-only + Bridge 78 would purge vaulted encrypted rows. Adds source_message_id + source_conversation_id to nex_vault_file (idempotent attachment copy). Replaces nex_purge_delivered_encrypted_messages with a vault-aware version that preserves ONLY rows whose recipient_device belongs to an account that has vaulted the parent conversation (directly or via friend-vault). No plaintext introduced. Fan-out encryption model unchanged. Cross-device decrypt remains Phase A (device-lineage limitation).'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification queries:
--
-- 1 · Columns exist:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_vault_file'
--      AND column_name IN ('source_message_id','source_conversation_id');
--
-- 2 · Partial unique index exists:
--   SELECT indexname, indexdef FROM pg_indexes
--    WHERE tablename = 'nex_vault_file'
--      AND indexname = 'nex_vault_file_source_message_unique';
--
-- 3 · Purge function updated (search for 'vault_entry' in the body):
--   SELECT pg_get_functiondef(oid) FROM pg_proc
--    WHERE proname = 'nex_purge_delivered_encrypted_messages';
--
-- 4 · Smoke · an isolated purge call still returns 0 on an empty table:
--   SELECT nex_purge_delivered_encrypted_messages(7);
-- ============================================================================
