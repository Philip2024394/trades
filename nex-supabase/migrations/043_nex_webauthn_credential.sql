-- ============================================================================
-- NEX-native Migration 043 · nex_webauthn_credential
-- ============================================================================
--
-- Purpose:
--   Store WebAuthn platform-authenticator credentials so a NEX account
--   can be recognised on future logins by the OS-native biometric prompt
--   (Windows Hello face, macOS Touch ID, iOS Face ID, Android Face Unlock).
--
--   The animated "face scan" UI on /nex-native/create-account/face is the
--   NEX visual layer around a standard W3C WebAuthn ceremony. The actual
--   face recognition, secure enclave, and anti-spoofing are delegated to
--   the operating system's authenticator. This table only stores the
--   public credential material and per-credential counter so replay
--   attacks can be detected.
--
-- Doctrine references:
--   · Identity Doctrine · account_id UUID FK to nex_account · one
--     account may have many credentials (multiple devices)
--   · Anti-fabrication · no biometric templates are stored here; the
--     credential_id is opaque to us · the OS keeps the private key in
--     its own secure enclave
--   · Honest baseline · WebAuthn does NOT give NEX access to any face
--     data · the "face scan" UI is entirely aesthetic
--
-- FK behaviour:
--   account_id → nex_account(id) ON DELETE CASCADE
--     (a credential has no meaning without its account · deleting the
--     account revokes all credentials).
--
-- RLS:
--   Service-role only. All auth flows execute via the nexSupabaseAdmin
--   client from server routes; the client never queries this table
--   directly. No authenticated / anon policies are defined.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '043';
--     DROP TABLE IF EXISTS nex_webauthn_credential;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_webauthn_credential (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,

  -- base64url-encoded credential ID returned by the browser during
  -- registration; unique across the whole platform because collision
  -- would mean two authenticators claiming the same identity.
  credential_id         text NOT NULL UNIQUE,

  -- base64url-encoded COSE public key. Used server-side by
  -- @simplewebauthn/server to verify each assertion signature.
  credential_public_key text NOT NULL,

  -- Signature counter per RFC 8809 / WebAuthn L3. Bumps on every
  -- successful assertion; a lower/equal counter after a successful
  -- assertion is a clone-detection signal.
  counter               bigint NOT NULL DEFAULT 0,

  -- Transports the authenticator advertised (usb, nfc, ble, internal,
  -- hybrid). Optional · used to speed up subsequent get() calls.
  transports            text[],

  -- Optional owner-visible label ("MacBook Face ID", "Windows Hello").
  device_label          text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  last_used_at          timestamptz,

  CONSTRAINT nex_webauthn_credential_id_len
    CHECK (length(credential_id) BETWEEN 16 AND 512),
  CONSTRAINT nex_webauthn_public_key_len
    CHECK (length(credential_public_key) BETWEEN 32 AND 4096),
  CONSTRAINT nex_webauthn_device_label_len
    CHECK (device_label IS NULL OR length(device_label) <= 80)
);

COMMENT ON TABLE nex_webauthn_credential IS
  'WebAuthn platform-authenticator credentials · one account can have many · service-role only writes.';

CREATE INDEX IF NOT EXISTS idx_nex_webauthn_credential_account_id
  ON nex_webauthn_credential (account_id);

-- Touch trigger reuse (from migration 002).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'nex_touch_updated_at') THEN
    -- We don't have an updated_at column · last_used_at is manually
    -- bumped by the service on successful assertion. No trigger needed.
    NULL;
  END IF;
END $$;

ALTER TABLE nex_webauthn_credential ENABLE ROW LEVEL SECURITY;

-- No policies defined · service-role bypasses RLS · every read/write
-- goes through nexSupabaseAdmin from server routes only.

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '043',
    'nex_webauthn_credential · WebAuthn platform-authenticator storage',
    'Founder-authorised 2026-09-26. Enables /nex-native/create-account/face to enrol OS-native biometric credentials (Windows Hello / Touch ID / Face ID) and sign users in on return visits. Service-role-only writes.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT tablename FROM pg_tables WHERE tablename = 'nex_webauthn_credential';
--     -- expect: 1 row
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_webauthn_credential'::regclass
--    ORDER BY conname;
--     -- expect: PK + 3 length CHECKs + FK
