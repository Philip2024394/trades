-- ============================================================================
-- NEX-native Migration 142 · Vault Phase A new tables
-- ============================================================================
--
-- Founder-authorised 2026-10-06 as part of Commit A.1 of the Vault Phase A
-- sequence. Scope is SCHEMA ONLY · no application code · no RPC · no
-- routes. Each new table exists so that Phase A implementation commits
-- (A.2–A.7) can write to it without further migrations.
--
-- WHAT THIS CREATES
-- -----------------
-- 1. nex_vault_setup
--      One row per account that has gone through Phase A Vault setup.
--      Carries the per-account non-secret parameters needed to derive
--      KEKs client-side: pin_mode (pin or passphrase) · pin_salt ·
--      pin_argon_params · prf_salt (per-account per design §L.5) ·
--      recovery_configured_at + recovery_salt + recovery_argon_params
--      (optional). vmk_generation bumps on key rotation (Phase F).
--
--      Owner-scoped RLS SELECT. Writes via service-role only (A.2+ setup
--      routes). This table never contains any secret key material · all
--      the actual VMK envelopes live in nex_vault_key_envelope.
--
-- 2. nex_vault_key_envelope
--      Multi-row per account. One row per unlock path per device/
--      credential. kind ∈ {pin · webauthn · device · recovery}.
--      wrapped_vmk + nonce + algorithm hold the opaque ciphertext of
--      VMK wrapped under the KEK derived at the client. Server never
--      sees any plaintext key material.
--
--      Four partial unique indexes enforce "at most one active envelope
--      per (account, path)" so a device cannot accumulate stale PIN
--      envelopes etc. kind-shape CHECK enforces that pin/device
--      envelopes carry target_device_id, webauthn envelopes carry
--      credential_id, and recovery envelopes carry neither.
--
-- 3. nex_vault_pin_attempt
--      Append-only rate-limit substrate. One row per PIN unlock attempt
--      (success or failure). Phase A step-up matrix (design §H)
--      queries this to enforce "5 attempts per rolling 15 min per
--      (account, device)" and the escalation ladder beyond.
--
-- 4. nex_vault_recovery_attempt
--      Same shape, scope is per-account (recovery passphrase is not
--      device-scoped). Rate limit: 5 per hour per account; 24h cooldown
--      + email notification after breach.
--
-- 5. nex_vault_file_migration_attempt
--      One row per in-flight legacy-file migration attempt. status
--      walks ('started' · 'uploaded' · 'verified' · 'finalized' ·
--      'failed'). Partial unique index on file_id WHERE status NOT IN
--      ('finalized','failed') enforces "one active attempt per file"
--      so concurrent migrations serialise. last_error carries a short
--      operator-visible string. The RECONCILIATION LOGIC that uses this
--      table lands with Commit A.6; this migration only creates the
--      substrate.
--
-- RLS SHAPE (uniform)
-- -------------------
-- · ENABLE ROW LEVEL SECURITY on every new table.
-- · One SELECT policy per table · owner-scoped via supabase_user_id →
--   nex_account.id. Lets the owner read their own rows (for Security +
--   Vault UI surfaces that land in later commits).
-- · No INSERT/UPDATE/DELETE policy · all writes go via service-role
--   through server routes that will land in A.2–A.7. The authenticated
--   client never writes to these tables directly.
--
-- WHAT THIS DOES NOT DO
--   · Does NOT alter any existing table (migration 141 does that).
--   · Does NOT add any route, service, type, or runtime behaviour.
--   · Does NOT seed any row. Every new table starts empty.
--   · Does NOT implement reconciliation (A.6).
--
-- Rollback:
--   BEGIN;
--     DROP TABLE IF EXISTS nex_vault_file_migration_attempt CASCADE;
--     DROP TABLE IF EXISTS nex_vault_recovery_attempt      CASCADE;
--     DROP TABLE IF EXISTS nex_vault_pin_attempt           CASCADE;
--     DROP TABLE IF EXISTS nex_vault_key_envelope          CASCADE;
--     DROP TABLE IF EXISTS nex_vault_setup                 CASCADE;
--     DROP FUNCTION IF EXISTS nex_vault_setup_touch_updated_at() CASCADE;
--     DROP FUNCTION IF EXISTS nex_vault_file_migration_attempt_touch_updated_at() CASCADE;
--     DELETE FROM nex_migration_history WHERE version = '142';
--   COMMIT;
-- ============================================================================

BEGIN;

-- ─── 1. nex_vault_setup ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex_vault_setup (
  account_id              uuid PRIMARY KEY REFERENCES nex_account(id) ON DELETE CASCADE,
  vmk_generation          integer NOT NULL DEFAULT 1,
  pin_mode                text    NOT NULL,
  pin_salt                bytea   NOT NULL,
  pin_argon_params        jsonb   NOT NULL,
  prf_salt                bytea   NOT NULL,
  recovery_configured_at  timestamptz NULL,
  recovery_salt           bytea   NULL,
  recovery_argon_params   jsonb   NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_vault_setup_pin_mode_values
    CHECK (pin_mode IN ('pin', 'passphrase')),
  CONSTRAINT nex_vault_setup_vmk_generation_range
    CHECK (vmk_generation >= 1),
  CONSTRAINT nex_vault_setup_pin_salt_length
    CHECK (octet_length(pin_salt) BETWEEN 16 AND 64),
  CONSTRAINT nex_vault_setup_prf_salt_length
    CHECK (octet_length(prf_salt) = 16),
  -- recovery triple is all-or-nothing
  CONSTRAINT nex_vault_setup_recovery_shape CHECK (
    (recovery_configured_at IS NULL
       AND recovery_salt IS NULL
       AND recovery_argon_params IS NULL)
    OR
    (recovery_configured_at IS NOT NULL
       AND recovery_salt IS NOT NULL
       AND recovery_argon_params IS NOT NULL)
  ),
  CONSTRAINT nex_vault_setup_recovery_salt_length
    CHECK (recovery_salt IS NULL OR octet_length(recovery_salt) BETWEEN 16 AND 64)
);

-- updated_at touch trigger · scoped to this table only
CREATE OR REPLACE FUNCTION nex_vault_setup_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_vault_setup_touch ON nex_vault_setup;
CREATE TRIGGER nex_vault_setup_touch
  BEFORE UPDATE ON nex_vault_setup
  FOR EACH ROW
  EXECUTE FUNCTION nex_vault_setup_touch_updated_at();

ALTER TABLE nex_vault_setup ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_vault_setup_owner_read
  ON nex_vault_setup
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );
-- No INSERT / UPDATE / DELETE policy · writes via service-role only.

COMMENT ON TABLE nex_vault_setup IS
  'Phase A · migration 142. One row per account that has set up Vault. '
  'Stores non-secret per-account parameters (salts, Argon2id params, '
  'VMK generation, PIN mode, optional recovery). Does NOT store any '
  'secret key material · all VMK wraps live in nex_vault_key_envelope. '
  'Owner RLS SELECT · writes via service-role only.';

COMMENT ON COLUMN nex_vault_setup.vmk_generation IS
  'Bumps on Vault key rotation (Phase F). Rotation re-wraps all file '
  'content keys under a new VMK and new envelopes; this counter '
  'detects orphans and prevents mix-and-match of old vs new wrapped '
  'material.';

COMMENT ON COLUMN nex_vault_setup.pin_mode IS
  'Phase A locked by founder 2026-10-06: ''pin'' = 8-12 digit PIN · '
  '''passphrase'' = 20+ char passphrase or 12-word BIP-39. 6-digit PINs '
  'are NOT permitted at any surface.';

COMMENT ON COLUMN nex_vault_setup.pin_salt IS
  'Random salt (16-64 bytes) consumed by client-side Argon2id to derive '
  'the PIN KEK. Server never derives a KEK · it only stores the salt.';

COMMENT ON COLUMN nex_vault_setup.pin_argon_params IS
  'Argon2id parameters (memory_kib, iterations, parallelism, variant). '
  'Versioned in-row so a future tune does not break existing wraps.';

COMMENT ON COLUMN nex_vault_setup.prf_salt IS
  'Phase A design §L.5 · per-account 16-byte salt passed to WebAuthn PRF '
  'extension. Prevents cross-account correlation of PRF outputs. Non-'
  'secret; stored server-side so the client can look it up at unlock.';

COMMENT ON COLUMN nex_vault_setup.recovery_configured_at IS
  'NULL = user declined / has not yet set up recovery. NOT NULL = user '
  'configured a recovery passphrase (recovery envelope lives in '
  'nex_vault_key_envelope · recovery_salt + recovery_argon_params let '
  'the client derive the KEK offline).';

-- ─── 2. nex_vault_key_envelope ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex_vault_key_envelope (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  kind               text NOT NULL,
  target_device_id   text NULL,
  credential_id      text NULL,
  wrapped_vmk        bytea NOT NULL,
  nonce              bytea NOT NULL,
  algorithm          text NOT NULL,
  generation         integer NOT NULL DEFAULT 1,
  consumed_at        timestamptz NULL,
  expires_at         timestamptz NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_vault_key_envelope_kind_values
    CHECK (kind IN ('pin', 'webauthn', 'device', 'recovery')),
  CONSTRAINT nex_vault_key_envelope_algorithm_values
    CHECK (algorithm = 'aes-256-gcm/v1'),
  CONSTRAINT nex_vault_key_envelope_wrapped_vmk_length
    CHECK (octet_length(wrapped_vmk) BETWEEN 32 AND 128),
  CONSTRAINT nex_vault_key_envelope_nonce_length
    CHECK (octet_length(nonce) BETWEEN 12 AND 24),
  CONSTRAINT nex_vault_key_envelope_generation_range
    CHECK (generation >= 1),
  CONSTRAINT nex_vault_key_envelope_target_device_length
    CHECK (target_device_id IS NULL OR char_length(target_device_id) BETWEEN 8 AND 128),
  CONSTRAINT nex_vault_key_envelope_credential_id_length
    CHECK (credential_id IS NULL OR char_length(credential_id) BETWEEN 16 AND 512),
  -- Kind-shape: pin and device envelopes carry target_device_id,
  -- webauthn envelopes carry credential_id, recovery envelopes carry
  -- neither.
  CONSTRAINT nex_vault_key_envelope_target_shape CHECK (
    (kind = 'pin'      AND target_device_id IS NOT NULL AND credential_id IS NULL)
    OR
    (kind = 'webauthn' AND target_device_id IS NULL     AND credential_id IS NOT NULL)
    OR
    (kind = 'device'   AND target_device_id IS NOT NULL AND credential_id IS NULL)
    OR
    (kind = 'recovery' AND target_device_id IS NULL     AND credential_id IS NULL)
  )
);

-- Four partial unique indexes enforce "at most one active envelope
-- per account per unlock path". Consumed-or-expired envelopes do not
-- block fresh ones.
CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_key_envelope_pin_active
  ON nex_vault_key_envelope (account_id, target_device_id)
  WHERE kind = 'pin' AND consumed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_key_envelope_webauthn_active
  ON nex_vault_key_envelope (account_id, credential_id)
  WHERE kind = 'webauthn' AND consumed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_key_envelope_device_active
  ON nex_vault_key_envelope (account_id, target_device_id)
  WHERE kind = 'device' AND consumed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_key_envelope_recovery_active
  ON nex_vault_key_envelope (account_id)
  WHERE kind = 'recovery' AND consumed_at IS NULL;

-- General lookup index
CREATE INDEX IF NOT EXISTS nex_vault_key_envelope_account_kind_idx
  ON nex_vault_key_envelope (account_id, kind, created_at DESC);

ALTER TABLE nex_vault_key_envelope ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_vault_key_envelope_owner_read
  ON nex_vault_key_envelope
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );
-- No INSERT / UPDATE / DELETE policy · service-role only.

COMMENT ON TABLE nex_vault_key_envelope IS
  'Phase A · migration 142. Opaque VMK wraps · one row per unlock path '
  'per device/credential. Server stores the ciphertext but holds no '
  'KEK · PIN envelope KEK derives from Argon2id(PIN, pin_salt) '
  'client-side · WebAuthn envelope KEK derives from HKDF(PRF(cred, '
  'prf_salt)) client-side · device envelope KEK derives from X25519 '
  'ECDH(source_device_priv, target_device_pub) client-side · recovery '
  'envelope KEK derives from Argon2id(passphrase, recovery_salt) '
  'client-side. Owner RLS SELECT · writes via service-role.';

COMMENT ON COLUMN nex_vault_key_envelope.consumed_at IS
  'Set when a one-shot envelope has been consumed (currently: '
  '''device'' kind only · a device envelope is minted by the sender, '
  'consumed by the target on first successful onboard, then retained '
  'as audit for a short window before cleanup).';

COMMENT ON COLUMN nex_vault_key_envelope.expires_at IS
  'Set for ''device'' envelopes (24h expiry per design §B.1). Server-'
  'side pending-list query filters expired rows out.';

-- ─── 3. nex_vault_pin_attempt ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex_vault_pin_attempt (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  device_id      text NOT NULL,
  success        boolean NOT NULL,
  attempted_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_vault_pin_attempt_device_id_length
    CHECK (char_length(device_id) BETWEEN 8 AND 128)
);

CREATE INDEX IF NOT EXISTS nex_vault_pin_attempt_rate_idx
  ON nex_vault_pin_attempt (account_id, device_id, attempted_at DESC);

ALTER TABLE nex_vault_pin_attempt ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_vault_pin_attempt_owner_read
  ON nex_vault_pin_attempt
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );
-- Append-only · no owner INSERT / UPDATE / DELETE policy.

COMMENT ON TABLE nex_vault_pin_attempt IS
  'Phase A · migration 142. Append-only PIN unlock attempt log · rate-'
  'limit substrate for the online-attack posture only (OFFLINE attacker '
  'with the local envelope is not rate-limited by the server per design '
  '§I.2 · PIN entropy + Argon2id cost are the offline protections).';

-- ─── 4. nex_vault_recovery_attempt ────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex_vault_recovery_attempt (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  success        boolean NOT NULL,
  attempted_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nex_vault_recovery_attempt_rate_idx
  ON nex_vault_recovery_attempt (account_id, attempted_at DESC);

ALTER TABLE nex_vault_recovery_attempt ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_vault_recovery_attempt_owner_read
  ON nex_vault_recovery_attempt
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );
-- Append-only · service-role writes.

COMMENT ON TABLE nex_vault_recovery_attempt IS
  'Phase A · migration 142. Append-only recovery-passphrase attempt log. '
  'Online rate-limit (5/hr/account). Offline attacks on the recovery '
  'envelope are bounded only by passphrase entropy + Argon2id cost.';

-- ─── 5. nex_vault_file_migration_attempt ──────────────────────────────
CREATE TABLE IF NOT EXISTS nex_vault_file_migration_attempt (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id                uuid NOT NULL REFERENCES nex_vault_file(id) ON DELETE CASCADE,
  account_id             uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  started_by_device_id   text NOT NULL,
  status                 text NOT NULL,
  retry_count            integer NOT NULL DEFAULT 0,
  last_error             text NULL,
  started_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_vault_file_migration_attempt_status_values
    CHECK (status IN ('started', 'uploaded', 'verified', 'finalized', 'failed')),
  CONSTRAINT nex_vault_file_migration_attempt_retry_count_range
    CHECK (retry_count >= 0),
  CONSTRAINT nex_vault_file_migration_attempt_device_id_length
    CHECK (char_length(started_by_device_id) BETWEEN 8 AND 128),
  CONSTRAINT nex_vault_file_migration_attempt_last_error_length
    CHECK (last_error IS NULL OR char_length(last_error) <= 1024)
);

-- One active (non-terminal) attempt per file. Finalised + failed rows
-- are retained for audit and do not block future attempts.
CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_file_migration_attempt_active
  ON nex_vault_file_migration_attempt (file_id)
  WHERE status NOT IN ('finalized', 'failed');

CREATE INDEX IF NOT EXISTS nex_vault_file_migration_attempt_account_idx
  ON nex_vault_file_migration_attempt (account_id, started_at DESC);

-- updated_at touch trigger
CREATE OR REPLACE FUNCTION nex_vault_file_migration_attempt_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_vault_file_migration_attempt_touch
  ON nex_vault_file_migration_attempt;
CREATE TRIGGER nex_vault_file_migration_attempt_touch
  BEFORE UPDATE ON nex_vault_file_migration_attempt
  FOR EACH ROW
  EXECUTE FUNCTION nex_vault_file_migration_attempt_touch_updated_at();

ALTER TABLE nex_vault_file_migration_attempt ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_vault_file_migration_attempt_owner_read
  ON nex_vault_file_migration_attempt
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );
-- Service-role writes.

COMMENT ON TABLE nex_vault_file_migration_attempt IS
  'Phase A · migration 142. One row per in-flight legacy-file migration '
  'attempt. status walks (''started'' · ''uploaded'' · ''verified'' · '
  '''finalized'' · ''failed''). Partial unique index serialises concurrent '
  'migrations per file. Reconciliation algorithm (design §M.3) lands with '
  'Commit A.6; this table is the substrate only.';

-- ─── 6. migration ledger ──────────────────────────────────────────────
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '142',
    'Vault Phase A new tables (nex_vault_setup, nex_vault_key_envelope + '
    '4 partial unique indexes, nex_vault_pin_attempt, nex_vault_recovery_attempt, '
    'nex_vault_file_migration_attempt)',
    'Vault Phase A Commit A.1. Founder-authorised 2026-10-06. Schema only · '
    'no routes · no services. Every new table ENABLE ROW LEVEL SECURITY · '
    'owner-scoped SELECT · writes via service-role only. No seed data. '
    'Phase A implementation (routes, services, UI) lands in A.2-A.7.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification queries:
--
-- 1 · All five tables exist:
--   SELECT tablename FROM pg_tables
--    WHERE tablename IN (
--      'nex_vault_setup','nex_vault_key_envelope','nex_vault_pin_attempt',
--      'nex_vault_recovery_attempt','nex_vault_file_migration_attempt'
--    )
--    ORDER BY tablename;
--   -- expect: 5 rows
--
-- 2 · Every new table has ROW LEVEL SECURITY on and exactly one SELECT policy:
--   SELECT c.relname, c.relrowsecurity
--     FROM pg_class c
--    WHERE c.relname IN (
--      'nex_vault_setup','nex_vault_key_envelope','nex_vault_pin_attempt',
--      'nex_vault_recovery_attempt','nex_vault_file_migration_attempt'
--    );
--   -- expect: all 5 relrowsecurity = true
--
--   SELECT polrelid::regclass::text AS tbl, polname, polcmd
--     FROM pg_policy
--    WHERE polrelid::regclass::text IN (
--      'nex_vault_setup','nex_vault_key_envelope','nex_vault_pin_attempt',
--      'nex_vault_recovery_attempt','nex_vault_file_migration_attempt'
--    )
--    ORDER BY tbl, polname;
--   -- expect: 5 rows, one per table, polcmd='r' (SELECT only)
--
-- 3 · Four partial unique indexes on nex_vault_key_envelope exist:
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'nex_vault_key_envelope'
--      AND indexname LIKE 'nex_vault_key_envelope_%_active'
--    ORDER BY indexname;
--   -- expect: pin_active, webauthn_active, device_active, recovery_active
--
-- 4 · Partial unique index on nex_vault_file_migration_attempt exists:
--   SELECT indexdef FROM pg_indexes
--    WHERE indexname = 'nex_vault_file_migration_attempt_active';
--   -- expect: WHERE clause "status NOT IN ('finalized', 'failed')"
--
-- 5 · Kind-shape CHECK rejects impossible envelope rows:
--   INSERT INTO nex_vault_key_envelope
--     (account_id, kind, target_device_id, credential_id, wrapped_vmk, nonce, algorithm)
--     VALUES
--     ('<any>', 'webauthn', 'this-should-be-null-for-webauthn', NULL,
--      '\\x00000000000000000000000000000000000000000000000000000000000000'::bytea,
--      '\\x000000000000000000000000'::bytea,
--      'aes-256-gcm/v1');
--   -- expect: ERROR 23514 nex_vault_key_envelope_target_shape
-- ============================================================================
