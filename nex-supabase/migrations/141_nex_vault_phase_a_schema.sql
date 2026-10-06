-- ============================================================================
-- NEX-native Migration 141 · Vault Phase A schema additions
-- ============================================================================
--
-- Founder-authorised 2026-10-06 as Commit A.1 of the Vault Phase A sequence.
-- Scope is SCHEMA ONLY · no application code · no RPC · no reconciliation
-- logic · no new routes. Phase A implementation lands in later authorised
-- commits (A.2 key hierarchy library · A.3 unlock paths · A.4 cross-device
-- envelope · A.5 revocation/rotation/password-reset hook · A.6 legacy file
-- migration + reconciliation · A.7 full E2E + visual proof).
--
-- WHAT THIS DOES
-- --------------
-- Extends three existing tables with additive, defaulted columns and
-- replaces the nex_sign_in_event event_type CHECK constraint with a
-- superset that covers the Vault audit events those later commits will
-- emit. All changes are reversible via the rollback at the bottom of
-- this header.
--
-- 1 · nex_webauthn_credential + prf_supported
--     Records whether a given WebAuthn credential was enrolled with the
--     PRF extension requested AND the authenticator advertised PRF
--     capability back. Defaults FALSE so every existing credential is
--     treated as non-PRF until a Phase A re-enrollment flow sets the
--     flag. No existing credential becomes unusable; non-PRF credentials
--     continue to sign the account in, they are just ineligible for the
--     Phase A WebAuthn-PRF Vault-unlock path.
--
-- 2 · nex_account_device_key + revoked_at
--     Adds nullable soft-revocation timestamp. Server-side callers filter
--     revoked rows out of future peer-chat fan-out AND Vault
--     device-authorization envelopes. Does NOT delete rows (keeps
--     cryptographic history auditable). Rows with revoked_at IS NOT NULL
--     remain in the table but are ignored by the active-device query.
--
-- 3 · nex_vault_file + encryption columns + four-state migration machine
--     ADDS: wrapped_content_key (bytea · AES-GCM-wrap of per-file key
--           K_f under the viewer's VMK · 32-byte K_f + 12-byte wrap-nonce
--           + 16-byte GCM auth tag = 60 bytes total · bytea permits any
--           length · hard CHECK on envelope kind in migration 142 bounds
--           the equivalent envelope-wrapped VMK),
--           content_nonce (bytea · 12-byte AES-GCM IV used to encrypt
--           file bytes · stored for every encrypted file),
--           encryption_algorithm (text · 'aes-256-gcm/v1' when set),
--           rotation_generation (int · bumps on Vault key rotation · 1
--           at Phase A birth · future Phase F feature),
--           legacy_bytes_path (text · while a pre-Phase-A file is still
--           stored as plaintext in the nex-vault-files bucket, this
--           column points at that path; when migration completes the
--           column goes NULL and the plaintext object is deleted),
--           migration_state (text · one of 'legacy' · 'migrating' ·
--           'encrypted' · 'failed'),
--           migrated_at (timestamptz · set when migration_state flips
--           to 'encrypted').
--
--     THE HARD INVARIANT (per founder sign-off 2026-10-06):
--
--         migration_state = 'encrypted'
--           ⇔  legacy_bytes_path IS NULL
--          AND wrapped_content_key IS NOT NULL
--          AND encryption_algorithm IS NOT NULL
--          AND migrated_at IS NOT NULL
--
--     The four permitted (migration_state, legacy_bytes_path,
--     wrapped_content_key, encryption_algorithm, migrated_at) tuples are
--     enumerated in the CHECK constraint. Any application code that
--     attempts to write a row claiming 'encrypted' while
--     legacy_bytes_path is still set is rejected by Postgres with error
--     code 23514 (check_violation). No application bug can bypass the
--     invariant; it is unforgeable at the database layer. Reconciliation
--     logic for crash recovery (per Phase A design §M.3) is deferred to
--     commit A.6; this migration only establishes the state machine.
--
--     BACKFILL: every pre-existing row in nex_vault_file is from Phase
--     A.1 Vault Persistence (sealed 24990f3f + a00c2d64) or earlier. All
--     those rows store plaintext bytes in the nex-vault-files bucket
--     and therefore belong in the 'legacy' state. The backfill runs
--     BEFORE the CHECK constraints are added so that pre-A.1 rows pass
--     validation on the first apply.
--
-- 4 · nex_session + step-up freshness timestamps
--     Three nullable timestamptz columns that record when the session
--     most recently proved possession of each factor. Phase A step-up
--     policy (per design §H) rejects sensitive operations when the
--     relevant timestamp is NULL or older than the per-operation
--     freshness window. This commit only adds the columns; the helpers
--     that populate them land with A.3 and A.5.
--
-- 5 · nex_sign_in_event.event_type · extended CHECK
--     Replaces the Phase 1.0 CHECK with a superset that admits the
--     Vault audit events emitted by A.3–A.7:
--       · vault_unlock
--       · vault_unlock_failed
--       · device_authorized
--       · device_revoked
--       · vault_rotated
--       · recovery_configured
--       · step_up_required_blocked
--       · password_reset_completed
--       · legacy_file_migrated
--       · legacy_file_migration_failed
--     All Phase 1.0 values remain accepted. Existing audit rows are
--     untouched.
--
-- WHAT THIS DOES NOT DO
-- ---------------------
--   · Does NOT create new tables (migration 142 does that).
--   · Does NOT touch migration 140 (Phase A.1 persistence · sealed).
--   · Does NOT add any route, service, type, or runtime behaviour.
--   · Does NOT implement reconciliation. The crash/reconciliation
--     algorithm lands with commit A.6.
--   · Does NOT backfill prf_supported for existing credentials. The
--     default FALSE is correct; A.3 adds the UI nudge to re-enroll.
--   · Does NOT change nex_account_device_key RLS. Existing policies
--     already cover the new column implicitly (both policies gate on
--     account_id ownership · the new column is per-row).
--
-- WHAT HAPPENS AT APPLY TIME
--   · nex_webauthn_credential: every existing row acquires prf_supported
--     = false. No row is deleted or disabled.
--   · nex_account_device_key: every existing row acquires revoked_at =
--     NULL. No row changes behaviour.
--   · nex_vault_file: every existing row acquires the seven new
--     columns, then the backfill flips wrapped_content_key-less rows
--     to migration_state='legacy' with legacy_bytes_path pointing at
--     the existing bucket_path. Then the CHECK constraints are added
--     and validated against the backfilled state. If the backfill
--     left any row inconsistent the migration fails loudly (and the
--     transaction is rolled back; schema is unchanged).
--   · nex_session: every existing row acquires three NULL timestamp
--     columns. Session resolver behaviour unchanged (A.3 will begin
--     writing the columns on fresh-step-up events).
--   · nex_sign_in_event: CHECK constraint replaced. No existing row is
--     touched · all pre-existing event_type values remain in the new
--     allowlist.
--
-- Rollback:
--   BEGIN;
--     ALTER TABLE nex_sign_in_event
--       DROP CONSTRAINT IF EXISTS nex_sign_in_event_type_values;
--     ALTER TABLE nex_sign_in_event
--       ADD CONSTRAINT nex_sign_in_event_type_values CHECK (
--         event_type IN (
--           'password', 'webauthn', 'magic_link', 'remote_sign_out',
--           'password_change', 'failure'
--         )
--       );
--     ALTER TABLE nex_session
--       DROP COLUMN IF EXISTS last_password_verified_at,
--       DROP COLUMN IF EXISTS last_webauthn_verified_at,
--       DROP COLUMN IF EXISTS last_vault_unlock_at;
--     DROP INDEX IF EXISTS nex_vault_file_migration_state_idx;
--     ALTER TABLE nex_vault_file
--       DROP CONSTRAINT IF EXISTS nex_vault_file_migration_invariant,
--       DROP CONSTRAINT IF EXISTS nex_vault_file_migration_state_values,
--       DROP CONSTRAINT IF EXISTS nex_vault_file_encryption_algorithm_values,
--       DROP CONSTRAINT IF EXISTS nex_vault_file_rotation_generation_range;
--     ALTER TABLE nex_vault_file
--       DROP COLUMN IF EXISTS wrapped_content_key,
--       DROP COLUMN IF EXISTS content_nonce,
--       DROP COLUMN IF EXISTS encryption_algorithm,
--       DROP COLUMN IF EXISTS rotation_generation,
--       DROP COLUMN IF EXISTS legacy_bytes_path,
--       DROP COLUMN IF EXISTS migration_state,
--       DROP COLUMN IF EXISTS migrated_at;
--     ALTER TABLE nex_account_device_key
--       DROP COLUMN IF EXISTS revoked_at;
--     ALTER TABLE nex_webauthn_credential
--       DROP COLUMN IF EXISTS prf_supported;
--     DELETE FROM nex_migration_history WHERE version = '141';
--   COMMIT;
-- ============================================================================

BEGIN;

-- ─── 1. nex_webauthn_credential + prf_supported ────────────────────────
ALTER TABLE nex_webauthn_credential
  ADD COLUMN IF NOT EXISTS prf_supported boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN nex_webauthn_credential.prf_supported IS
  'Phase A · migration 141. TRUE iff enrollment requested the WebAuthn '
  'PRF extension AND the authenticator advertised PRF capability back. '
  'Only credentials with this flag TRUE are eligible for the Phase A '
  'WebAuthn-PRF Vault-unlock path (design §B.2 and §L). Credentials with '
  'this flag FALSE still sign the account in normally; they are routed '
  'to PIN · device envelope · or recovery passphrase for Vault unlock.';

-- ─── 2. nex_account_device_key + revoked_at ────────────────────────────
ALTER TABLE nex_account_device_key
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS nex_account_device_key_active_idx
  ON nex_account_device_key (account_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

COMMENT ON COLUMN nex_account_device_key.revoked_at IS
  'Phase A · migration 141. Soft-revocation timestamp. When NOT NULL, '
  'server-side callers filter the row out of peer-chat fan-out AND Vault '
  'device-authorization envelopes. Row is NOT deleted · keeps a tamper-'
  'evident history for audit. See Phase A design §F.';

-- ─── 3. nex_vault_file · Phase A encryption + four-state machine ──────
ALTER TABLE nex_vault_file
  ADD COLUMN IF NOT EXISTS wrapped_content_key bytea NULL,
  ADD COLUMN IF NOT EXISTS content_nonce bytea NULL,
  ADD COLUMN IF NOT EXISTS encryption_algorithm text NULL,
  ADD COLUMN IF NOT EXISTS rotation_generation integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS legacy_bytes_path text NULL,
  ADD COLUMN IF NOT EXISTS migration_state text NOT NULL DEFAULT 'encrypted',
  ADD COLUMN IF NOT EXISTS migrated_at timestamptz NULL;

-- Backfill BEFORE the CHECK constraints are added. Every pre-existing
-- row stores plaintext bytes in the nex-vault-files bucket (Phase A.1
-- Vault Persistence and earlier) · those are 'legacy'. Rows whose
-- wrapped_content_key is still NULL after column add are definitionally
-- pre-Phase-A rows.
UPDATE nex_vault_file
   SET migration_state   = 'legacy',
       legacy_bytes_path = bucket_path,
       migrated_at       = NULL,
       encryption_algorithm = NULL,
       content_nonce     = NULL
 WHERE wrapped_content_key IS NULL;

-- Allowed migration_state values · gated BEFORE the invariant so the
-- more specific CHECK gets a clean enum to work against.
ALTER TABLE nex_vault_file
  ADD CONSTRAINT nex_vault_file_migration_state_values
    CHECK (migration_state IN ('legacy', 'migrating', 'encrypted', 'failed'));

-- Allowed encryption_algorithm values · null when migration_state is
-- 'legacy' or 'failed'; 'aes-256-gcm/v1' when 'migrating' or 'encrypted'.
-- The exhaustive check lives in the invariant below.
ALTER TABLE nex_vault_file
  ADD CONSTRAINT nex_vault_file_encryption_algorithm_values
    CHECK (
      encryption_algorithm IS NULL
      OR encryption_algorithm = 'aes-256-gcm/v1'
    );

-- Sanity on rotation_generation.
ALTER TABLE nex_vault_file
  ADD CONSTRAINT nex_vault_file_rotation_generation_range
    CHECK (rotation_generation >= 1);

-- ─── THE HARD INVARIANT ────────────────────────────────────────────────
-- The four permitted tuples. Any OTHER combination is rejected by
-- Postgres with error 23514. This is the unforgeable boundary between
-- a file that is actually encrypted and a file that is still legacy ·
-- no application bug can produce a 'encrypted' row that still has
-- legacy_bytes_path set.
ALTER TABLE nex_vault_file
  ADD CONSTRAINT nex_vault_file_migration_invariant CHECK (
    (migration_state = 'encrypted'
       AND legacy_bytes_path IS NULL
       AND wrapped_content_key IS NOT NULL
       AND encryption_algorithm IS NOT NULL
       AND content_nonce IS NOT NULL
       AND migrated_at IS NOT NULL)
    OR
    (migration_state = 'migrating'
       AND legacy_bytes_path IS NOT NULL
       AND wrapped_content_key IS NOT NULL
       AND encryption_algorithm IS NOT NULL
       AND content_nonce IS NOT NULL)
    OR
    (migration_state = 'legacy'
       AND legacy_bytes_path IS NOT NULL
       AND wrapped_content_key IS NULL
       AND encryption_algorithm IS NULL
       AND content_nonce IS NULL)
    OR
    (migration_state = 'failed'
       AND legacy_bytes_path IS NOT NULL
       AND wrapped_content_key IS NULL
       AND encryption_algorithm IS NULL
       AND content_nonce IS NULL)
  );

-- Index for the Phase A.6 migration queue · per-account, non-encrypted
-- rows only. Phase A.6 lists files that still need migration; this
-- index makes that query cheap.
CREATE INDEX IF NOT EXISTS nex_vault_file_migration_state_idx
  ON nex_vault_file (account_id, migration_state)
  WHERE migration_state <> 'encrypted';

COMMENT ON COLUMN nex_vault_file.wrapped_content_key IS
  'Phase A · migration 141. AES-256-GCM wrap of the per-file content key '
  'K_f under the viewer''s VMK. 32-byte K_f produces 60 bytes '
  '(12-byte wrap-nonce || 32-byte ciphertext || 16-byte GCM auth tag). '
  'NULL for migration_state = ''legacy'' or ''failed'' (hard invariant).';

COMMENT ON COLUMN nex_vault_file.content_nonce IS
  'Phase A · migration 141. 12-byte AES-256-GCM IV used to encrypt the '
  'file bytes under K_f. NULL for migration_state = ''legacy'' or '
  '''failed'' (hard invariant).';

COMMENT ON COLUMN nex_vault_file.encryption_algorithm IS
  'Phase A · migration 141. Algorithm identifier for the file bytes. '
  'Phase A: ''aes-256-gcm/v1''. Future algorithms require a migration '
  'to extend the CHECK allowlist.';

COMMENT ON COLUMN nex_vault_file.rotation_generation IS
  'Phase A · migration 141. Bumps when Vault key rotation re-wraps '
  'this file''s K_f under a new VMK. 1 at Phase A birth. Phase F'
  'rotation uses this to detect orphaned stale wrap material.';

COMMENT ON COLUMN nex_vault_file.legacy_bytes_path IS
  'Phase A · migration 141. While a file still has plaintext bytes in '
  'the nex-vault-files bucket from pre-Phase-A persistence, this '
  'column points at that path. On migration to encrypted, the '
  'plaintext object is deleted AND this column goes NULL (hard '
  'invariant: encrypted ⇔ legacy_bytes_path IS NULL).';

COMMENT ON COLUMN nex_vault_file.migration_state IS
  'Phase A · migration 141. Four-state legacy-file migration machine: '
  '''legacy'' = plaintext bytes only, no encrypted replacement yet; '
  '''migrating'' = encrypted replacement uploaded, verification in '
  'progress, BOTH copies present; '
  '''encrypted'' = encrypted replacement is the sole authoritative copy, '
  'legacy plaintext deleted; '
  '''failed'' = prior migration attempt failed, legacy bytes intact, '
  'retry permitted. Hard invariant enforced by '
  'nex_vault_file_migration_invariant.';

COMMENT ON COLUMN nex_vault_file.migrated_at IS
  'Phase A · migration 141. Set when migration_state flips to '
  '''encrypted''. NULL in every other state (hard invariant).';

-- ─── 4. nex_session · step-up freshness timestamps ─────────────────────
ALTER TABLE nex_session
  ADD COLUMN IF NOT EXISTS last_password_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_webauthn_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_vault_unlock_at      timestamptz NULL;

COMMENT ON COLUMN nex_session.last_password_verified_at IS
  'Phase A · migration 141. Most recent timestamp this session proved '
  'possession of the account password via the server-side re-verify '
  'path. Phase A step-up matrix (design §H) rejects sensitive ops '
  'when this is NULL or older than the per-operation freshness window. '
  'Cleared by password_reset_completed events (design §G.1).';

COMMENT ON COLUMN nex_session.last_webauthn_verified_at IS
  'Phase A · migration 141. Most recent timestamp this session '
  'completed a fresh WebAuthn assertion (sign-in OR step-up). Phase A '
  'step-up matrix uses this. Cleared by password_reset_completed '
  'events (design §G.1).';

COMMENT ON COLUMN nex_session.last_vault_unlock_at IS
  'Phase A · migration 141. Most recent timestamp this session '
  'unlocked Vault via any factor (PIN · WebAuthn-PRF · device envelope '
  '· recovery passphrase). Idle timeout + visibility-hidden timer + '
  'password_reset_completed clear this column.';

-- ─── 5. nex_sign_in_event.event_type · extended allowlist ─────────────
ALTER TABLE nex_sign_in_event
  DROP CONSTRAINT IF EXISTS nex_sign_in_event_type_values;

ALTER TABLE nex_sign_in_event
  ADD CONSTRAINT nex_sign_in_event_type_values
    CHECK (event_type IN (
      -- Phase 1.0 values (unchanged):
      'password',
      'webauthn',
      'magic_link',
      'remote_sign_out',
      'password_change',
      'failure',
      -- Phase A additions (migration 141):
      'vault_unlock',
      'vault_unlock_failed',
      'device_authorized',
      'device_revoked',
      'vault_rotated',
      'recovery_configured',
      'step_up_required_blocked',
      'password_reset_completed',
      'legacy_file_migrated',
      'legacy_file_migration_failed'
    ));

COMMENT ON COLUMN nex_sign_in_event.event_type IS
  'Phase 1.0 base + Phase A additions (migration 141). CHECK-constrained · '
  'adding a new type requires a migration. See Phase A design §J data flow '
  'for which code paths emit each new value.';

-- ─── 6. migration ledger ──────────────────────────────────────────────
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '141',
    'Vault Phase A schema additions (prf_supported, device revoked_at, '
    'nex_vault_file encryption columns + 4-state migration machine with '
    'hard invariant, nex_session step-up timestamps, event_type extended)',
    'Vault Phase A Commit A.1. Founder-authorised 2026-10-06. Additive '
    'schema only · no routes · no services · no runtime behaviour. '
    'Backfills pre-Phase-A nex_vault_file rows to migration_state = '
    '''legacy''. Hard invariant (migration_state=''encrypted'' ⇔ '
    'legacy_bytes_path IS NULL) enforced by '
    'nex_vault_file_migration_invariant CHECK constraint. '
    'Reconciliation logic deferred to A.6.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification queries (run manually against the live DB):
--
-- 1 · prf_supported added to WebAuthn credentials:
--   SELECT column_name, data_type, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'nex_webauthn_credential' AND column_name = 'prf_supported';
--   -- expect: prf_supported · boolean · false
--
-- 2 · device-key revoked_at added:
--   SELECT column_name, is_nullable FROM information_schema.columns
--    WHERE table_name = 'nex_account_device_key' AND column_name = 'revoked_at';
--   -- expect: revoked_at · YES
--
-- 3 · nex_vault_file acquired all 7 Phase A columns:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_vault_file'
--      AND column_name IN (
--        'wrapped_content_key','content_nonce','encryption_algorithm',
--        'rotation_generation','legacy_bytes_path','migration_state','migrated_at'
--      )
--    ORDER BY column_name;
--   -- expect: 7 rows
--
-- 4 · Pre-A.1 vault files backfilled to legacy:
--   SELECT COUNT(*) FROM nex_vault_file WHERE migration_state <> 'encrypted'
--                                          AND wrapped_content_key IS NULL;
--   -- Count equals the number of pre-A.1 rows at apply time. Every one of
--   -- them is 'legacy' with legacy_bytes_path = bucket_path.
--
--   SELECT COUNT(*) FROM nex_vault_file WHERE migration_state = 'legacy'
--                                          AND legacy_bytes_path IS NULL;
--   -- expect: 0 (invariant guarantee)
--
-- 5 · Hard invariant rejects impossible combinations · attempted direct write:
--   UPDATE nex_vault_file SET migration_state = 'encrypted'
--    WHERE legacy_bytes_path IS NOT NULL
--    LIMIT 1;
--   -- expect: ERROR 23514 nex_vault_file_migration_invariant
--
-- 6 · nex_session gained 3 step-up columns:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_session'
--      AND column_name IN (
--        'last_password_verified_at','last_webauthn_verified_at','last_vault_unlock_at'
--      )
--    ORDER BY column_name;
--   -- expect: 3 rows
--
-- 7 · nex_sign_in_event event_type extended · reject unknown type:
--   SELECT consrc FROM pg_constraint WHERE conname = 'nex_sign_in_event_type_values';
--   -- expect: contains 'vault_unlock', 'password_reset_completed', etc.
-- ============================================================================
