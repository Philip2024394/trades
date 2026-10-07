-- ============================================================================
-- NEX-native Migration 143 · Vault Phase B · Commit B.1
-- ============================================================================
--
-- Founder-authorised 2026-10-07 as the schema foundation of Vault Phase B
-- (Canonical Vault Chat). Scope is SCHEMA ONLY · no application code · no
-- RPC · no routes · no client crypto · no UI. Phase B.2 (envelope routes),
-- B.3 (client K_c + IndexedDB rewrap), B.4 (Vault chat surface), B.5 (move-
-- to-vault wire-up + Policy X), and B.6 (lock/revoke/notification) each
-- land as separate commits with their own founder authorisation.
--
-- THE DOCTRINE
-- ------------
-- `nex_vault_conversation_envelope` stores ONLY encrypted per-device
-- envelopes for the conversation key `K_c` of the existing canonical
-- `nex_peer_conversation`. It does NOT create a second conversation.
-- It does NOT contain plaintext key material. There is still exactly ONE
-- `nex_peer_conversation` row and ONE message history per Alice↔Bob
-- relationship; Vault adds a per-device envelope for the client-side at-
-- rest cache key `K_c`, and nothing else.
--
-- Future developers reading this table: if you find yourself tempted to
-- interpret these rows as "the Vault conversation" — stop. The
-- authoritative conversation remains `nex_peer_conversation`. These rows
-- are only encrypted key material that lets authorised client devices
-- decrypt their own Vault-cache plaintext when Vault is unlocked.
--
-- WHAT THIS CREATES
-- -----------------
--   nex_vault_conversation_envelope
--     One row per (account, canonical conversation, target device,
--     Vault key generation) tuple. The row holds the AES-256-GCM/v1
--     envelope that wraps the per-conversation at-rest cache key `K_c`
--     for the owning client device. Wrapping is done entirely client-
--     side under VMK (Phase A key hierarchy, see
--     src/lib/nex-native/vault/key-hierarchy.ts). The server receives
--     and stores opaque ciphertext bytes · it never possesses K_c, VMK,
--     plaintext messages, plaintext attachments, PINs, recovery
--     passphrases, device private keys, or PRF outputs.
--
-- UNIQUENESS PREDICATE
-- --------------------
--   Partial UNIQUE index on
--     (account_id, conversation_id, target_device_id, generation)
--     WHERE revoked_at IS NULL
--   enforces "at most one ACTIVE envelope per (account, conversation,
--   device, generation)". Revoked / obsolete envelopes may remain for
--   auditability without blocking fresh ones. During a rotation handoff
--   the recommended lifecycle is revoke-old → insert-new in one
--   transaction; two active generations may briefly coexist only when
--   the rotation design explicitly asks for it.
--
-- CRYPTOGRAPHIC SIZES (sealed at Phase A birth · do NOT invent new ones)
-- ---------------------------------------------------------------------
--   algorithm      = 'aes-256-gcm/v1'                        (text)
--   wrapped_k_c    = 60 bytes · 12 nonce || 32 ct || 16 tag  (bytea)
--   nonce          = 12 bytes · AES-GCM IV for the wrap       (bytea)
--   generation     ≥ 1
-- The wrapped_k_c envelope is identical in shape to the Phase A
-- `wrapped_content_key` on `nex_vault_file` · wrap/unwrap use the sealed
-- `wrapKey` / `unwrapKey` helpers · identical AAD and nonce discipline.
--
-- RLS SHAPE
-- ---------
--   ENABLE ROW LEVEL SECURITY.
--   Owner-scoped SELECT policy via supabase_user_id → nex_account.id.
--   NO INSERT / UPDATE / DELETE policy · all writes via service-role.
--   Knowing a `conversation_id` grants NO access · the gate is the
--   authenticated account's membership in `nex_account`.
--
-- WHAT THIS DOES NOT DO
-- ---------------------
--   · Does NOT alter any existing table (no column added to
--     nex_peer_conversation / nex_peer_message / nex_vault_entry /
--     nex_vault_file / nex_account / nex_account_device_key).
--   · Does NOT add any API route, service, type, or runtime behaviour.
--   · Does NOT backfill any row · every vaulted conversation that
--     exists today has zero envelopes until B.2/B.3 mints them.
--   · Does NOT reopen any sealed Phase A invariant.
--
-- ROLLBACK
-- --------
--   BEGIN;
--     DROP TABLE IF EXISTS nex_vault_conversation_envelope CASCADE;
--     DELETE FROM nex_migration_history WHERE version = '143';
--   COMMIT;
-- ============================================================================

BEGIN;

-- ─── nex_vault_conversation_envelope ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex_vault_conversation_envelope (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid        NOT NULL REFERENCES nex_account(id)         ON DELETE CASCADE,
  conversation_id     uuid        NOT NULL REFERENCES nex_peer_conversation(id) ON DELETE CASCADE,
  target_device_id    text        NOT NULL,
  wrapped_k_c         bytea       NOT NULL,
  nonce               bytea       NOT NULL,
  algorithm           text        NOT NULL,
  generation          integer     NOT NULL DEFAULT 1,
  revoked_at          timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT nex_vault_conversation_envelope_algorithm_values
    CHECK (algorithm = 'aes-256-gcm/v1'),

  CONSTRAINT nex_vault_conversation_envelope_wrapped_k_c_length
    CHECK (octet_length(wrapped_k_c) = 60),

  CONSTRAINT nex_vault_conversation_envelope_nonce_length
    CHECK (octet_length(nonce) = 12),

  CONSTRAINT nex_vault_conversation_envelope_generation_range
    CHECK (generation >= 1),

  CONSTRAINT nex_vault_conversation_envelope_target_device_length
    CHECK (char_length(target_device_id) BETWEEN 8 AND 128)
);

-- Uniqueness predicate · at most one ACTIVE envelope per
-- (account, conversation, device, generation) tuple. See doctrine comment
-- at top of file for the rotation handoff semantics.
CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_conversation_envelope_active_unique
  ON nex_vault_conversation_envelope
     (account_id, conversation_id, target_device_id, generation)
  WHERE revoked_at IS NULL;

-- "Give me every active envelope for this device across every vaulted
-- conversation I own" · drives the client's on-unlock batch unwrap.
CREATE INDEX IF NOT EXISTS nex_vault_conversation_envelope_device_active_idx
  ON nex_vault_conversation_envelope (account_id, target_device_id)
  WHERE revoked_at IS NULL;

-- "Give me every envelope (active and revoked) for this conversation" ·
-- drives audit / revoke-sweep lookups.
CREATE INDEX IF NOT EXISTS nex_vault_conversation_envelope_conversation_idx
  ON nex_vault_conversation_envelope (account_id, conversation_id, created_at DESC);

ALTER TABLE nex_vault_conversation_envelope ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_vault_conversation_envelope_owner_read
  ON nex_vault_conversation_envelope
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );
-- No INSERT / UPDATE / DELETE policy · service-role only.

COMMENT ON TABLE nex_vault_conversation_envelope IS
  'Vault Phase B · migration 143 · B.1. Opaque per-device envelopes '
  'wrapping the per-conversation at-rest cache key K_c for the SAME '
  'canonical nex_peer_conversation. Does NOT create a second '
  'conversation. Server never sees plaintext K_c · wrap/unwrap happen '
  'client-side under VMK (sealed Phase A key hierarchy). Owner RLS '
  'SELECT · writes via service-role (B.2 lands those routes).';

COMMENT ON COLUMN nex_vault_conversation_envelope.account_id IS
  'Owning account. Combined with conversation_id this must satisfy an '
  'application-level invariant (enforced in B.2 service layer): the '
  'account must be a participant of the canonical nex_peer_conversation. '
  'That invariant is NOT encoded here because it depends on service-'
  'role writes · the RLS owner read is the authoritative access gate.';

COMMENT ON COLUMN nex_vault_conversation_envelope.conversation_id IS
  'The ONE canonical nex_peer_conversation whose cache key this envelope '
  'wraps. Knowing this id grants NO access · access is gated by the '
  'authenticated account via RLS. ON DELETE CASCADE is intentional: if '
  'the canonical conversation row is ever removed, envelopes targeting '
  'it become undecryptable noise and are cleaned up. There is NO reverse '
  'FK from this envelope back onto nex_peer_message · deleting envelopes '
  'can never cascade into chat history.';

COMMENT ON COLUMN nex_vault_conversation_envelope.target_device_id IS
  'Opaque device identifier · same convention as '
  'nex_account_device_key.device_id and nex_vault_key_envelope.target_'
  'device_id (8–128 chars). Combined with wrapped_k_c this envelope is '
  'cryptographically bound to the target device: the client-side '
  'wrapKey call includes target_device_id in the AAD so a wrapped K_c '
  'for Device A cannot be reused as an envelope for Device B.';

COMMENT ON COLUMN nex_vault_conversation_envelope.wrapped_k_c IS
  'AES-256-GCM/v1 envelope · 12-byte nonce || 32-byte key ciphertext || '
  '16-byte GCM tag = exactly 60 bytes. Identical shape to Phase A '
  'wrapped_content_key on nex_vault_file. Decrypts to the 32-byte K_c '
  'client-side under VMK (never on server).';

COMMENT ON COLUMN nex_vault_conversation_envelope.nonce IS
  'The 12-byte wrap nonce for this envelope · redundantly stored outside '
  'wrapped_k_c for cheap integrity validation server-side (B.2 §P.2-'
  'style structural validator). Must equal the first 12 bytes of '
  'wrapped_k_c · B.2 enforces that invariant without ever touching the '
  'ciphertext.';

COMMENT ON COLUMN nex_vault_conversation_envelope.algorithm IS
  'Sealed Phase A algorithm identifier · currently exactly '
  '"aes-256-gcm/v1". New algorithms require a new migration + an '
  'explicit founder decision · the CHECK blocks silent drift.';

COMMENT ON COLUMN nex_vault_conversation_envelope.generation IS
  'Monotonic per (account, conversation) counter. Bumps on either VMK '
  'rotation (A.5 recovery flow) OR K_c rotation (device-revoke sweep in '
  'B.6). The partial unique index permits at most one ACTIVE envelope '
  'per (account, conversation, device, generation).';

COMMENT ON COLUMN nex_vault_conversation_envelope.revoked_at IS
  'NULL = active. Non-NULL = revoked (device-revoke sweep set this). '
  'Revoked rows remain for audit · they do not block fresh envelope '
  'inserts at the same (account, conversation, device, generation) '
  'tuple.';

COMMIT;
