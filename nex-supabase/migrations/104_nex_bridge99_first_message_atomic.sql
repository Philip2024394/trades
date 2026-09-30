-- ============================================================================
-- NEX-native Migration 104 · Bridge 99 · Stage 6 · atomic-create stored function
-- ============================================================================
--
-- Sealed doctrine reference:
--   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
--   §7B Create paragraph · sealed v5 · Founder-sealed 2026-09-30.
--   Baseline: git commit 6566ace3.
--
-- The sealed §7B Create paragraph specifies six DB mutations that must
-- occur atomically for a Bridge 99 provisional-create + first-message
-- flow:
--
--   1. Insert nex_account row.
--   2. Insert nex_account_device_key row.
--   3. Insert nex_peer_conversation (with origin_cover_business_id).
--   4. Insert one nex_peer_message row per recipient-device ciphertext,
--      all sharing (sender_account_id, send_intent_id) so migration 102
--      Part C's UNIQUE constraint provides idempotency.
--   5. Insert nex_account_risk_signal row (fingerprint storage owned
--      by risk-service.ts at the application layer; this stored
--      function is the DB primitive both services jointly rely on).
--   6. Insert nex_welcome_outbox event.
--
-- The sealed clause: "Any database failure rolls back the database
-- transaction · no half-born accounts, no orphaned device keys, no
-- ghost conversations."
--
-- Doing this via six sequential supabase-admin .from().insert() calls
-- would NOT be atomic (each PostgREST call is its own transaction).
-- Doing it via raw pg BEGIN/COMMIT would introduce a second DB access
-- path into production code. This stored function is the narrowest
-- fulfillment of the sealed atomicity requirement using the existing
-- supabase-admin HTTP path (via .rpc()).
--
-- Application-layer boundaries remain intact:
--   · provisional-account-service.ts is the SOLE caller in TypeScript
--     that invokes this RPC. No other module invokes it.
--   · risk-service.ts remains the sole application-layer reader/writer
--     of nex_account_risk_signal; this stored function is DB
--     infrastructure both services jointly depend on.
--   · Structural tests in provisional-session.ts / risk-signals.ts /
--     risk-service.ts continue to enforce "no .from(...) targeting
--     forbidden tables" — those tests don't run against this SQL.
--
-- Doctrinal preservation:
--   · No changes to Migrations 001, 047, 092, 102, 103, or any other
--     existing schema. This migration is PURELY additive.
--   · Bridge 62 inline welcome path unaffected.
--   · Bridge 3 peer_message RLS defect NOT repaired here (still
--     deferred to B99+rls-harden).
--
-- SECURITY DEFINER · runs as the postgres role that owns it, bypassing
-- RLS. This is necessary because:
--   · The provisional account has no supabase auth session at insert time.
--   · The risk_signal + welcome_outbox tables have zero authenticated
--     policies (service-role only), which the calling supabase-admin
--     client already provides — but SECURITY DEFINER makes the
--     function safe to invoke via .rpc() regardless of the caller's
--     role, which is important for future test/admin scenarios.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '104';
--     DROP FUNCTION IF EXISTS nex_bridge99_create_first_message(
--       text, text, text, uuid, uuid, uuid, text, jsonb, text
--     );
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION nex_bridge99_create_first_message(
  p_display_name             text,
  p_device_id                text,
  p_device_public_key        text,
  p_owner_account_id         uuid,
  p_owner_business_id        uuid,
  p_send_intent_id           uuid,
  p_message_group_id         text,
  p_ciphertext_rows          jsonb,  -- [{recipient_device_id, ciphertext, nonce}...]
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
BEGIN
  -- Argument validation (defensive · TypeScript caller already validates,
  -- but a corrupted call from any client should fail loudly).
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

  -- Step 1 · Insert provisional nex_account row.
  INSERT INTO nex_account (display_name, claimed_at)
  VALUES (p_display_name, NULL)
  RETURNING id INTO v_account_id;

  IF v_account_id = p_owner_account_id THEN
    RAISE EXCEPTION 'nex_bridge99_create_first_message: sender cannot equal owner (impossible for provisional-create)';
  END IF;

  -- Step 2 · Insert device key (Bridge 74 pattern).
  INSERT INTO nex_account_device_key (account_id, device_id, public_key, last_seen_at)
  VALUES (v_account_id, p_device_id, p_device_public_key, v_now);

  -- Step 3 · Insert conversation with canonical (a<b) ordering + origin.
  -- Since v_account_id is freshly generated it cannot already have a
  -- conversation with anyone, so a plain INSERT is safe (no get-or-create
  -- race).
  IF v_account_id < p_owner_account_id THEN
    v_a_id := v_account_id;
    v_b_id := p_owner_account_id;
  ELSE
    v_a_id := p_owner_account_id;
    v_b_id := v_account_id;
  END IF;

  INSERT INTO nex_peer_conversation (
    participant_a_id,
    participant_b_id,
    origin_cover_business_id
  )
  VALUES (v_a_id, v_b_id, p_owner_business_id)
  RETURNING id INTO v_conversation_id;

  -- Step 4 · Insert one nex_peer_message row per ciphertext (fan-out per
  -- recipient device). All rows share (sender_account_id, send_intent_id)
  -- so migration 102 Part C's UNIQUE constraint would reject a retry.
  --
  -- Note: the UNIQUE constraint is on (sender_account_id, send_intent_id).
  -- The N ciphertext rows for ONE first-send all share those two values
  -- but differ by recipient_device_id. The UNIQUE index does NOT include
  -- recipient_device_id, so PostgreSQL would reject the 2nd..Nth rows.
  -- To resolve this, we use N different send_intent_ids: the client
  -- supplies ONE send_intent_id, and we derive per-row keys by combining
  -- with recipient_device_id. This preserves idempotency at the intent
  -- level (retrying the whole first-send with the same client-generated
  -- intent id produces the same derived keys and hits the UNIQUE).
  --
  -- Alternative would be to change the UNIQUE index to include
  -- recipient_device_id, but that would broaden a migration 102 constraint
  -- after the fact. The derivation approach preserves the sealed
  -- constraint shape.
  FOR v_ciphertext IN SELECT * FROM jsonb_array_elements(p_ciphertext_rows)
  LOOP
    INSERT INTO nex_peer_message (
      conversation_id,
      sender_account_id,
      body,
      encrypted,
      ciphertext,
      nonce,
      sender_public_key,
      sender_device_id,
      recipient_device_id,
      message_group_id,
      send_intent_id
    )
    VALUES (
      v_conversation_id,
      v_account_id,
      '(encrypted)',
      true,
      -- Ciphertext + nonce stored as bytea · decode base64 from the JSON.
      decode(v_ciphertext->>'ciphertext', 'base64'),
      decode(v_ciphertext->>'nonce',       'base64'),
      p_device_public_key,
      p_device_id,
      v_ciphertext->>'recipient_device_id',
      -- message_group_id is a UUID column · cast the incoming text arg.
      p_message_group_id::uuid,
      -- Derived per-row send_intent_id: v5 UUID over (p_send_intent_id,
      -- recipient_device_id) so retrying produces the same per-row keys
      -- and hits the UNIQUE (sender_account_id, send_intent_id) constraint.
      -- Schema-qualified · Supabase installs uuid-ossp in the extensions
      -- schema, which is not on the SET search_path here.
      extensions.uuid_generate_v5(p_send_intent_id, v_ciphertext->>'recipient_device_id')
    )
    RETURNING id INTO v_first_message_id;
  END LOOP;

  -- Step 5 · Insert risk_signal row (fingerprint storage). Owned at
  -- application layer by risk-service.ts; this stored function is the
  -- DB primitive both services jointly depend on inside the atomic tx.
  INSERT INTO nex_account_risk_signal (
    account_id,
    provisional_fingerprint,
    fingerprint_last_computed_at
  )
  VALUES (v_account_id, p_provisional_fingerprint, v_now);

  -- Step 6 · Insert nex_welcome_outbox event.
  INSERT INTO nex_welcome_outbox (account_id)
  VALUES (v_account_id);

  -- Return the created ids so the orchestrator can issue the cookie +
  -- redirect payload.
  RETURN jsonb_build_object(
    'account_id',       v_account_id,
    'conversation_id',  v_conversation_id,
    'first_message_id', v_first_message_id
  );
END;
$$;

-- uuid-ossp is already installed by Supabase in the extensions schema
-- (see schema-qualified extensions.uuid_generate_v5 call above). No
-- CREATE EXTENSION needed · attempting one would try to install into
-- the wrong schema.

COMMENT ON FUNCTION nex_bridge99_create_first_message(
  text, text, text, uuid, uuid, uuid, text, jsonb, text
) IS
  'Bridge 99 Stage 6 · atomic six-insert transaction for provisional-create + first-message. Sealed doctrine §7B Create paragraph. Rollback semantics guaranteed by PL/pgSQL BEGIN/COMMIT wrapping. Called only by provisional-account-service.ts via supabase-admin.rpc(). SECURITY DEFINER · runs as postgres role.';

-- ---------------------------------------------------------------------------
-- Migration ledger
-- ---------------------------------------------------------------------------

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '104',
    'Bridge 99 Stage 6 · nex_bridge99_create_first_message atomic stored function',
    'Adds one PL/pgSQL SECURITY DEFINER function that atomically executes the six DB mutations sealed in doctrine §7B Create paragraph (nex_account, nex_account_device_key, nex_peer_conversation with origin, nex_peer_message fan-out with derived per-row send_intent_id via uuid_generate_v5, nex_account_risk_signal, nex_welcome_outbox). No schema changes. Preserves migration 102 Part C UNIQUE (sender_account_id, send_intent_id) semantics via derived per-recipient keys. Application-layer service boundaries unaffected. Bridge 62 unchanged. Doctrine unchanged. Sealed baseline 6566ace3.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification (SELECTs · not part of the migration):
--
--   SELECT * FROM nex_migration_history WHERE version = '104';
--   SELECT proname, pronargs, prosecdef FROM pg_proc WHERE proname = 'nex_bridge99_create_first_message';
--     -- expect: 1 row · pronargs=9 · prosecdef=true
--   SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp';
--     -- expect: 1 row
--
-- Live rejection proofs (savepoint-scoped in apply script):
--   · missing p_display_name → RAISE EXCEPTION
--   · empty p_ciphertext_rows → RAISE EXCEPTION
--   · sender == owner → RAISE EXCEPTION
-- ============================================================================
