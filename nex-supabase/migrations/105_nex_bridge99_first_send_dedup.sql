-- ============================================================================
-- NEX-native Migration 105 · Bridge 99 · Stage 11-A2 · first-send intent dedup
-- ============================================================================
--
-- Sealed doctrine reference:
--   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
--   §13 A2 · sealed acceptance criterion:
--     "Double-tap Send within 100ms → 1 message, 1 account"
--   Founder-sealed 2026-09-30 · baseline 6566ace3.
--   Prior migration: 104 (atomic six-mutation create).
--
-- Founder authorization: 2026-09-30 (post-Stage 10 checkpoint).
--
-- What this migration fixes
-- -------------------------
-- Migration 104's atomic function creates the nex_account row in step 1
-- and only enforces the message-level UNIQUE (sender_account_id,
-- send_intent_id) constraint in step 4. Two concurrent invocations with
-- the same client send_intent_id therefore proceed independently through
-- step 1 (creating TWO accounts), then race in step 4 where only one
-- can insert the messages · producing two provisional accounts, one of
-- which has no messages.
--
-- This violates sealed §13 A2. The fix must operate BEFORE account
-- creation and MUST NOT use fingerprint / IP / UA / timezone / language /
-- risk signals as the deduplication key (founder-explicit boundary).
--
-- Solution shape
-- --------------
-- Add a new table nex_bridge99_first_send_intent keyed on
-- send_intent_id (the client-supplied UUID · the natural intent-level
-- identifier). Update the Migration 104 stored function to:
--
--   1. Acquire a Postgres advisory-transaction lock keyed on the
--      send_intent_id · concurrent transactions with the same intent
--      serialise; different-intent transactions are unblocked.
--   2. Check the dedup table for an existing row. If present, return
--      the cached { account_id, conversation_id, first_message_id }
--      immediately · this is the retry-safe idempotent path.
--   3. Otherwise proceed with the sealed §7B six-mutation atomic
--      create, then INSERT the dedup row binding this intent to the
--      created account. The advisory lock is transaction-scoped, so it
--      is released automatically on commit/rollback.
--
-- Retry semantics
-- ---------------
--   · Same client send_intent_id + subsequent request → returns the
--     cached ids (deduplicated=true). No new account, no new
--     conversation, no new messages.
--   · Concurrent requests with the same intent → whichever transaction
--     acquires the lock first performs the full create; the other
--     waits, then reads the cached row on second-lookup. Exactly one
--     account created.
--   · Client-supplied intent IDs collide (v4 UUID collisions are
--     practically impossible, but for defence-in-depth the constraint
--     is that intent IDs are per-send and per-sender · a colliding
--     intent from a different sender would return the wrong cached
--     account, which is a client bug not a server bug).
--
-- Doctrinal preservation
-- ----------------------
--   · Fingerprint is untouched · remains risk-only per §7A.
--   · Risk signals are untouched · remain advisory per §8.
--   · Sealed §7B six-mutation atomicity preserved · the dedup step
--     wraps the existing atomic sequence rather than replacing it.
--   · Bridge 62 inline welcome unchanged.
--   · No Bridge 3 RLS repair.
--
-- Rollback
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '105';
--     -- Restore Migration 104's function body from its original SQL
--     -- (re-run 104's CREATE OR REPLACE which does not know about
--     --  the dedup table).
--     DROP TABLE IF EXISTS nex_bridge99_first_send_intent;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · Dedup table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_bridge99_first_send_intent (
  send_intent_id    uuid PRIMARY KEY,
  account_id        uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  conversation_id   uuid NOT NULL REFERENCES nex_peer_conversation(id) ON DELETE CASCADE,
  first_message_id  uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_first_send_intent_account
  ON nex_bridge99_first_send_intent (account_id);

ALTER TABLE nex_bridge99_first_send_intent ENABLE ROW LEVEL SECURITY;
-- Intentionally NO authenticated-role policies · service-role only.

COMMENT ON TABLE nex_bridge99_first_send_intent IS
  'Bridge 99 Stage 11 · Founder-sealed §13 A2 dedup mechanism. Binds a client-supplied send_intent_id to the account/conversation/message ids produced by the first successful atomic create. Concurrent or repeated requests with the same intent read the cached row and return the same result · never creating a second account. Advisory-lock ordering in nex_bridge99_create_first_message serialises concurrent same-intent transactions. RLS enabled, no authenticated policies · service-role only. The dedup key is send_intent_id ONLY · never fingerprint/IP/UA/timezone/language/risk signals per sealed §7A boundaries.';

-- ---------------------------------------------------------------------------
-- 2 · Updated atomic stored function · adds dedup + advisory lock
-- ---------------------------------------------------------------------------
-- Full body redefined here so this migration is self-contained (no
-- dependency on 104's exact function body at repair time). All six
-- sealed §7B mutations preserved verbatim.

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
  -- Argument validation (same as 104 · defensive).
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

  -- ==== NEW · Advisory lock keyed on send_intent_id (Migration 105) ====
  -- Serialises concurrent transactions with the same intent · different
  -- intents proceed in parallel. Transaction-scoped: released on
  -- commit or rollback.
  --
  -- Lock key derived from the UUID string via md5 (first 15 hex chars →
  -- bigint via bitcast). Collisions across different intents are
  -- statistically negligible (2^60 space) but even if a collision
  -- occurred, it would only cause temporary serialisation of unrelated
  -- intents · never incorrect behaviour.
  v_lock_key := ('x' || substring(md5(p_send_intent_id::text), 1, 15))::bit(60)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- ==== NEW · Cached-result path (Migration 105) ====
  -- If a prior transaction already completed for this intent, return
  -- its cached ids. This is the retry/double-tap-safe path.
  SELECT account_id, conversation_id, first_message_id INTO v_existing
    FROM nex_bridge99_first_send_intent
   WHERE send_intent_id = p_send_intent_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'account_id',       v_existing.account_id,
      'conversation_id',  v_existing.conversation_id,
      'first_message_id', v_existing.first_message_id,
      'deduplicated',     true
    );
  END IF;

  -- ==== Sealed §7B six-mutation atomic sequence (unchanged from 104) ====

  -- Step 1 · Insert provisional nex_account row.
  INSERT INTO nex_account (display_name, claimed_at)
  VALUES (p_display_name, NULL)
  RETURNING id INTO v_account_id;

  IF v_account_id = p_owner_account_id THEN
    RAISE EXCEPTION 'nex_bridge99_create_first_message: sender cannot equal owner (impossible for provisional-create)';
  END IF;

  -- Step 2 · Insert device key.
  INSERT INTO nex_account_device_key (account_id, device_id, public_key, last_seen_at)
  VALUES (v_account_id, p_device_id, p_device_public_key, v_now);

  -- Step 3 · Insert conversation with canonical (a<b) ordering + origin.
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

  -- Step 4 · Insert one nex_peer_message row per ciphertext (fan-out).
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
      decode(v_ciphertext->>'ciphertext', 'base64'),
      decode(v_ciphertext->>'nonce',       'base64'),
      p_device_public_key,
      p_device_id,
      v_ciphertext->>'recipient_device_id',
      p_message_group_id::uuid,
      extensions.uuid_generate_v5(p_send_intent_id, v_ciphertext->>'recipient_device_id')
    )
    RETURNING id INTO v_first_message_id;
  END LOOP;

  -- Step 5 · Insert risk_signal.
  INSERT INTO nex_account_risk_signal (
    account_id,
    provisional_fingerprint,
    fingerprint_last_computed_at
  )
  VALUES (v_account_id, p_provisional_fingerprint, v_now);

  -- Step 6 · Insert welcome outbox event.
  INSERT INTO nex_welcome_outbox (account_id)
  VALUES (v_account_id);

  -- ==== NEW · Bind the intent to the created account (Migration 105) ====
  -- Any subsequent same-intent call reads this row and returns the
  -- cached result via the "cached-result path" above.
  INSERT INTO nex_bridge99_first_send_intent (
    send_intent_id, account_id, conversation_id, first_message_id
  )
  VALUES (p_send_intent_id, v_account_id, v_conversation_id, v_first_message_id);

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
  'Bridge 99 · v2 (Migration 105). Adds send_intent_id dedup via advisory lock + nex_bridge99_first_send_intent binding table BEFORE the sealed §7B six-mutation atomic sequence. Concurrent same-intent requests serialise, second reads cached result · exactly one account created per intent. Sealed §13 A2 enforced at DB level. Return payload now includes { deduplicated: boolean } so callers can distinguish cache hits.';

-- ---------------------------------------------------------------------------
-- Migration ledger
-- ---------------------------------------------------------------------------

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '105',
    'Bridge 99 Stage 11-A2 · first-send intent deduplication',
    'Adds nex_bridge99_first_send_intent table + pg_advisory_xact_lock keyed on send_intent_id. Fixes the sealed §13 A2 race where Migration 104 could create two provisional accounts before the message-level UNIQUE constraint fires. Dedup key is send_intent_id ONLY · fingerprint/IP/UA/timezone/language/risk signals explicitly forbidden per sealed §7A. Advisory lock released on commit/rollback · standard Postgres semantics. Function returns { deduplicated: bool } so callers can distinguish cache hits from fresh creates. Sealed baseline 6566ace3.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification (SELECTs · not part of the migration):
--
--   SELECT * FROM nex_migration_history WHERE version = '105';
--   SELECT tablename FROM pg_tables WHERE tablename = 'nex_bridge99_first_send_intent';
--   SELECT count(*) FROM pg_policies WHERE tablename = 'nex_bridge99_first_send_intent';
--     -- expect: 0
--   SELECT proname FROM pg_proc WHERE proname = 'nex_bridge99_create_first_message';
--     -- expect: 1 (function still exists, replaced by CREATE OR REPLACE)
--
-- Live tests (in apply script):
--   · sequential same-intent call · second returns { deduplicated: true }
--     with same ids · no second account created
--   · concurrent same-intent calls · exactly one account created,
--     both calls return the same ids
--   · different intents proceed in parallel with no cross-contention
--
-- ============================================================================
