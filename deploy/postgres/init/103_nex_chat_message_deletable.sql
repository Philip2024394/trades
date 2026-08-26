-- deploy/postgres/init/103_nex_chat_message_deletable.sql
--
-- NEX Chat Message · deletable + auditable · F3 (2026-08-25).
--
-- Adds minimal server-authoritative persistence for chat messages so the
-- 💣 grenade consumable has a real ownership + deletion target. Every
-- deletion writes a permanent audit row to nex.chat_message_deletion.
--
-- Doctrine (Philip 2026-08-25 · locked):
--   · Soft delete only · content is never destroyed · audit trail permanent
--   · Ownership check enforced at the SQL function level · client cannot
--     bypass by crafting a request against another user's message
--   · The deletion event carries actor id + display name + timestamp
--     captured server-side · client cannot fake the history line
--   · The history line text is composed server-side using server time and
--     server-verified actor name · returned to the client verbatim
--
-- Additive · reversible. Zero touch on other tables. Chat retrieval /
-- filtering happens in application code (WHERE deleted_at IS NULL for the
-- live feed · full history including deletions for the audit view).

BEGIN;

-- ── Chat message table · minimal MVP · soft-deletable ─────────────────
CREATE TABLE IF NOT EXISTS nex.chat_message (
  message_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id      text         NOT NULL,
  sender_id            text         NOT NULL,
  sender_display_name  text         NOT NULL,
  content              text         NOT NULL,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  deleted_at           timestamptz             ,  -- NULL = live · timestamp = deleted
  deleted_by_user_id   text                    ,  -- who initiated the deletion
  deletion_reason      text                    CHECK (deletion_reason IN
                         (NULL, 'grenade', 'user-edit', 'admin')
                       )
);

CREATE INDEX IF NOT EXISTS chat_message_conversation_idx
  ON nex.chat_message (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_message_sender_idx
  ON nex.chat_message (sender_id, created_at DESC);

-- ── Deletion audit · one row per successful grenade / admin action ────
-- Permanent. Row here means the message was actually deleted by that user
-- at that moment. The `history_line` is the exact string clients render as
-- the persistent chat-history entry replacing the deleted bubble.
CREATE TABLE IF NOT EXISTS nex.chat_message_deletion (
  deletion_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id           uuid         NOT NULL REFERENCES nex.chat_message(message_id),
  conversation_id      text         NOT NULL,
  actor_user_id        text         NOT NULL,
  actor_display_name   text         NOT NULL,
  actor_action         text         NOT NULL CHECK (actor_action IN ('grenade','user-edit','admin')),
  wallet_transaction_id uuid                    ,   -- link to nex.wallet_transaction if consumable-driven
  history_line         text         NOT NULL,
  event_time           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_message_deletion_conv_idx
  ON nex.chat_message_deletion (conversation_id, event_time DESC);
CREATE INDEX IF NOT EXISTS chat_message_deletion_wallet_idx
  ON nex.chat_message_deletion (wallet_transaction_id)
  WHERE wallet_transaction_id IS NOT NULL;

-- ── Server-authoritative grenade delete · one atomic function ─────────
-- Called by the grenade handler INSIDE the runtime's wallet-reserve step.
-- Verifies:
--   · message exists and is not already deleted (idempotent → returns existing)
--   · actor owns the message (sender_id = actor_user_id)
--   · conversation matches (defence-in-depth)
-- On success: marks message deleted · writes audit row · returns the
-- history line for the client to render.
--
-- Failure modes are ERRORS · the caller (grenade handler) catches them and
-- returns the appropriate NexActionError · the runtime then refunds Sparks.
CREATE OR REPLACE FUNCTION nex.chat_message_grenade_delete(
  p_message_id          uuid,
  p_conversation_id     text,
  p_actor_user_id       text,
  p_actor_display_name  text,
  p_wallet_txn_id       uuid
) RETURNS TABLE (
  message_id      uuid,
  history_line    text,
  event_time      timestamptz,
  idempotent_hit  boolean
) LANGUAGE plpgsql AS $$
DECLARE
  v_msg            RECORD;
  v_existing_del   RECORD;
  v_event_time     timestamptz := now();
  v_local_time     text;
  v_local_date     text;
  v_history        text;
BEGIN
  -- Idempotency short-circuit · if this message was already deleted by
  -- this actor with a linked wallet txn, return the prior audit line.
  SELECT * INTO v_existing_del FROM nex.chat_message_deletion
    WHERE message_id = p_message_id
      AND actor_user_id = p_actor_user_id
      AND wallet_transaction_id = p_wallet_txn_id
    LIMIT 1;
  IF FOUND THEN
    message_id     := p_message_id;
    history_line   := v_existing_del.history_line;
    event_time     := v_existing_del.event_time;
    idempotent_hit := true;
    RETURN NEXT; RETURN;
  END IF;

  -- Row-lock the message so a parallel grenade can't double-delete it.
  SELECT * INTO v_msg FROM nex.chat_message
    WHERE nex.chat_message.message_id = p_message_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'grenade: message % not found', p_message_id
      USING ERRCODE = 'no_data_found';
  END IF;
  IF v_msg.conversation_id <> p_conversation_id THEN
    RAISE EXCEPTION 'grenade: conversation mismatch (msg belongs to %)', v_msg.conversation_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_msg.sender_id <> p_actor_user_id THEN
    RAISE EXCEPTION 'grenade: forbidden · actor % does not own message', p_actor_user_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_msg.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'grenade: message already deleted at %', v_msg.deleted_at
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Compose the history line server-side using server-verified actor name
  -- and server-side event time. Locale-agnostic default format · client
  -- may re-format for locale · the string here is the audit-of-record.
  v_local_time := to_char(v_event_time, 'HH12:MI AM');
  v_local_date := to_char(v_event_time, 'DD/MM/YYYY');
  v_history    := format('💣 %s grenaded this post · %s · %s',
                         p_actor_display_name, v_local_time, v_local_date);

  UPDATE nex.chat_message
     SET deleted_at         = v_event_time,
         deleted_by_user_id = p_actor_user_id,
         deletion_reason    = 'grenade'
   WHERE nex.chat_message.message_id = p_message_id;

  INSERT INTO nex.chat_message_deletion (
    message_id, conversation_id, actor_user_id, actor_display_name,
    actor_action, wallet_transaction_id, history_line, event_time
  ) VALUES (
    p_message_id, p_conversation_id, p_actor_user_id, p_actor_display_name,
    'grenade', p_wallet_txn_id, v_history, v_event_time
  );

  message_id     := p_message_id;
  history_line   := v_history;
  event_time     := v_event_time;
  idempotent_hit := false;
  RETURN NEXT;
END;
$$;

-- ── Helper · upsert a message from client-supplied fields ─────────────
-- Used by the messages-persist API when the client posts a new bubble.
-- Idempotent on message_id · never mutates content once created (edits
-- go through a separate function · not in F3).
CREATE OR REPLACE FUNCTION nex.chat_message_upsert(
  p_message_id          uuid,
  p_conversation_id     text,
  p_sender_id           text,
  p_sender_display_name text,
  p_content             text,
  p_created_at          timestamptz DEFAULT now()
) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO nex.chat_message (
    message_id, conversation_id, sender_id, sender_display_name, content, created_at
  ) VALUES (
    p_message_id, p_conversation_id, p_sender_id, p_sender_display_name, p_content, p_created_at
  )
  ON CONFLICT (message_id) DO NOTHING;
  RETURN p_message_id;
END;
$$;

COMMIT;
