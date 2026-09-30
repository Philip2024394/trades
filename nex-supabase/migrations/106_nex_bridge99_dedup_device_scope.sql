-- ============================================================================
-- NEX-native Migration 106 · Bridge 99 · scope dedup key to (intent, device)
-- ============================================================================
--
-- Sealed doctrine reference:
--   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
--   §7A · Fingerprint is risk-only, NEVER identity.
--   Founder-directed post-Migration 105 hardening 2026-09-30.
--   Prior migration: 105 (advisory-lock dedup on send_intent_id alone).
--
-- Problem this migration fixes
-- ----------------------------
-- Migration 105's dedup key was send_intent_id ALONE. That made the
-- send_intent_id behave like a bearer credential: any request replaying
-- the observed send_intent_id would resolve to the original account and
-- receive a valid session cookie. The founder's boundary test called
-- this out explicitly:
--
--   "Two genuinely independent browser/session contexts using the same
--    send_intent_id must not accidentally inherit the first account.
--    The idempotency key cannot become a portable bearer token for an
--    anonymous account."
--
-- Fix
-- ---
-- Scope the dedup to (send_intent_id, device_id). Rationale:
--   · device_id is a client-generated IndexedDB token (Bridge 74).
--     Two genuinely-independent browser contexts have different
--     device_id values by construction.
--   · This is NOT a risk signal. It is a per-context identifier the
--     client cooperates with. Founder-explicit boundary preserved:
--     no fingerprint / IP / UA / timezone / language.
--   · Same intent + same device = legitimate retry (double-tap /
--     network retry / refresh) · returns the cached account.
--   · Same intent + different device = independent context · a fresh
--     account is created and bound to THAT device's (intent, device)
--     row, without touching the original binding.
--
-- Race safety
-- -----------
-- The advisory lock is still keyed on send_intent_id alone · concurrent
-- requests with the same intent still serialise. The second-in-line
-- transaction, after acquiring the lock, checks (send_intent_id,
-- device_id): if the device matches → cache hit; if not → fresh create
-- with a new (intent, device) binding.
--
-- Concurrent same-intent-different-device requests still serialise on
-- the lock (they share the intent key) but each produces its own
-- account. The second call's dedup INSERT uses a different device_id
-- so the PRIMARY KEY does not collide.
--
-- Threat surface still open (out of Bridge 99 v1 scope)
-- ----------------------------------------------------
-- An attacker who replays the FULL POST body (including device_id +
-- device_public_key) can still receive a session cookie for the
-- account. Closing this requires per-request signing with the device
-- private key + server-side signature verification, which is a broader
-- auth mechanism than Bridge 99 v1 specifies. This migration is scoped
-- to closing the SEND_INTENT_ID-ONLY replay vector · full-request
-- replay hardening is a separate future bridge.
--
-- Migration approach
-- ------------------
--   1. Add device_id column NOT NULL (default 'legacy-m105' for any
--      surviving M105-era rows · in practice production has none).
--   2. Drop the old PRIMARY KEY on (send_intent_id).
--   3. Create new PRIMARY KEY on (send_intent_id, device_id).
--   4. CREATE OR REPLACE the stored function to include device_id in
--      lookup + insert.
--
-- Rollback
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '106';
--     -- Restore original PK and drop device_id column
--     ALTER TABLE nex_bridge99_first_send_intent
--       DROP CONSTRAINT nex_bridge99_first_send_intent_pkey;
--     ALTER TABLE nex_bridge99_first_send_intent
--       ADD PRIMARY KEY (send_intent_id);
--     ALTER TABLE nex_bridge99_first_send_intent
--       DROP COLUMN device_id;
--     -- Re-run Migration 105's CREATE OR REPLACE to restore the
--     -- old function body.
--   COMMIT;
-- ============================================================================

BEGIN;

-- Step 1 · add device_id column (safe default for any surviving rows)
ALTER TABLE nex_bridge99_first_send_intent
  ADD COLUMN IF NOT EXISTS device_id text NOT NULL DEFAULT 'legacy-m105';

-- Step 2 · swap PRIMARY KEY
ALTER TABLE nex_bridge99_first_send_intent
  DROP CONSTRAINT IF EXISTS nex_bridge99_first_send_intent_pkey;
ALTER TABLE nex_bridge99_first_send_intent
  ADD PRIMARY KEY (send_intent_id, device_id);

-- Step 3 · updated stored function
CREATE OR REPLACE FUNCTION nex_bridge99_create_first_message(
  p_display_name             text,
  p_device_id                text,
  p_device_public_key        text,
  p_owner_account_id         uuid,
  p_owner_business_id        uuid,
  p_send_intent_id           uuid,
  p_message_group_id         text,
  p_ciphertext_rows          jsonb,
  p_provisional_fingerprint  text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id       uuid;
  v_conversation_id  uuid;
  v_first_message_id uuid;
  v_a_id             uuid;
  v_b_id             uuid;
  v_ciphertext       jsonb;
  v_now              timestamptz := now();
  v_existing         RECORD;
  v_lock_key         bigint;
BEGIN
  -- Argument validation (unchanged from 105).
  IF p_display_name IS NULL OR length(p_display_name) = 0 THEN
    RAISE EXCEPTION 'nex_bridge99_create_first_message: p_display_name required';
  END IF;
  IF p_device_id IS NULL OR length(p_device_id) < 8 THEN
    RAISE EXCEPTION 'nex_bridge99_create_first_message: p_device_id must be at least 8 chars';
  END IF;
  IF p_device_public_key IS NULL OR length(p_device_public_key) < 40 THEN
    RAISE EXCEPTION 'nex_bridge99_create_first_message: p_device_public_key must be at least 40 chars';
  END IF;
  IF p_owner_account_id IS NULL THEN
    RAISE EXCEPTION 'nex_bridge99_create_first_message: p_owner_account_id required';
  END IF;
  IF p_send_intent_id IS NULL THEN
    RAISE EXCEPTION 'nex_bridge99_create_first_message: p_send_intent_id required';
  END IF;
  IF p_message_group_id IS NULL OR length(p_message_group_id) = 0 THEN
    RAISE EXCEPTION 'nex_bridge99_create_first_message: p_message_group_id required';
  END IF;
  IF p_ciphertext_rows IS NULL OR jsonb_typeof(p_ciphertext_rows) <> 'array'
     OR jsonb_array_length(p_ciphertext_rows) = 0 THEN
    RAISE EXCEPTION 'nex_bridge99_create_first_message: p_ciphertext_rows must be a non-empty JSON array';
  END IF;
  IF p_provisional_fingerprint IS NULL OR length(p_provisional_fingerprint) = 0 THEN
    RAISE EXCEPTION 'nex_bridge99_create_first_message: p_provisional_fingerprint required';
  END IF;

  -- Advisory lock keyed on send_intent_id (unchanged from 105). Concurrent
  -- same-intent transactions serialise regardless of device_id · different
  -- intents run in parallel.
  v_lock_key := ('x' || substring(md5(p_send_intent_id::text), 1, 15))::bit(60)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- v6 (Migration 106) · Cache-hit lookup scoped to (intent, device).
  -- Same-intent-different-device requests fall through to fresh create.
  SELECT account_id, conversation_id, first_message_id INTO v_existing
    FROM nex_bridge99_first_send_intent
   WHERE send_intent_id = p_send_intent_id
     AND device_id      = p_device_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'account_id',       v_existing.account_id,
      'conversation_id',  v_existing.conversation_id,
      'first_message_id', v_existing.first_message_id,
      'deduplicated',     true
    );
  END IF;

  -- Sealed §7B six-mutation atomic sequence · unchanged since 104/105.

  INSERT INTO nex_account (display_name, claimed_at)
  VALUES (p_display_name, NULL)
  RETURNING id INTO v_account_id;

  IF v_account_id = p_owner_account_id THEN
    RAISE EXCEPTION 'nex_bridge99_create_first_message: sender cannot equal owner';
  END IF;

  INSERT INTO nex_account_device_key (account_id, device_id, public_key, last_seen_at)
  VALUES (v_account_id, p_device_id, p_device_public_key, v_now);

  IF v_account_id < p_owner_account_id THEN
    v_a_id := v_account_id; v_b_id := p_owner_account_id;
  ELSE
    v_a_id := p_owner_account_id; v_b_id := v_account_id;
  END IF;
  INSERT INTO nex_peer_conversation (participant_a_id, participant_b_id, origin_cover_business_id)
  VALUES (v_a_id, v_b_id, p_owner_business_id)
  RETURNING id INTO v_conversation_id;

  FOR v_ciphertext IN SELECT * FROM jsonb_array_elements(p_ciphertext_rows)
  LOOP
    INSERT INTO nex_peer_message (
      conversation_id, sender_account_id, body, encrypted, ciphertext, nonce,
      sender_public_key, sender_device_id, recipient_device_id, message_group_id,
      send_intent_id
    )
    VALUES (
      v_conversation_id, v_account_id, '(encrypted)', true,
      decode(v_ciphertext->>'ciphertext', 'base64'),
      decode(v_ciphertext->>'nonce', 'base64'),
      p_device_public_key, p_device_id, v_ciphertext->>'recipient_device_id',
      p_message_group_id::uuid,
      extensions.uuid_generate_v5(p_send_intent_id, v_ciphertext->>'recipient_device_id')
    )
    RETURNING id INTO v_first_message_id;
  END LOOP;

  INSERT INTO nex_account_risk_signal (account_id, provisional_fingerprint, fingerprint_last_computed_at)
  VALUES (v_account_id, p_provisional_fingerprint, v_now);

  INSERT INTO nex_welcome_outbox (account_id)
  VALUES (v_account_id);

  -- v6 · dedup binding scoped to (send_intent_id, device_id).
  INSERT INTO nex_bridge99_first_send_intent (
    send_intent_id, device_id, account_id, conversation_id, first_message_id
  )
  VALUES (p_send_intent_id, p_device_id, v_account_id, v_conversation_id, v_first_message_id);

  RETURN jsonb_build_object(
    'account_id',       v_account_id,
    'conversation_id',  v_conversation_id,
    'first_message_id', v_first_message_id,
    'deduplicated',     false
  );
END;
$$;

COMMENT ON FUNCTION nex_bridge99_create_first_message(
  text, text, text, uuid, uuid, uuid, text, jsonb, text
) IS
  'Bridge 99 v3 · Migration 106. Dedup scope tightened to (send_intent_id, device_id) so an observed send_intent_id from one browser context cannot silently inherit that account when replayed from a different browser context. Advisory lock still keyed on send_intent_id alone (concurrency safety). Full-request replay from the same device+public_key remains outside Bridge 99 v1 scope · closing that would require per-request device signature verification.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '106',
    'Bridge 99 · dedup key scoped to (send_intent_id, device_id)',
    'Closes the send_intent_id-only replay vector where a replayed intent from a genuinely independent browser context could inherit the original account. New dedup key is (send_intent_id, device_id) · device_id is a Bridge 74 client-generated IndexedDB token, not a risk signal. Same intent + same device = cache hit (legitimate retry). Same intent + different device = fresh account. Fingerprint/IP/UA/timezone/language still not used per sealed §7A. Sealed baseline 6566ace3.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification (in apply script):
--   · PK now includes both columns
--   · Same-intent + same-device sequential → cached
--   · Same-intent + different-device → fresh account, both dedup rows exist
--   · Concurrent same-intent + same-device → one account (race protected)
--   · Concurrent same-intent + different-device → two accounts (race
--     serialised but each creates its own)
-- ============================================================================
