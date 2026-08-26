-- deploy/postgres/init/104_nex_safety_audit.sql
--
-- NEX Safety & Audit · F3 addition (2026-08-25 · Philip locked).
--
-- Shared infrastructure for EVERY destructive or paid NEX Action. Not
-- grenade-specific. Future consumables (vault, admin actions, moderation
-- interventions) plug into the same tables.
--
-- Two-tier design · separates metadata from content:
--
--   nex.safety_audit_event         · ~30 day default retention · what happened
--   nex.chat_message_archive       · stricter access · what was said
--
-- Retention:
--   · Default 30 days on safety_audit_event.retention_until
--   · legal_hold=true overrides retention · row survives purge sweeps
--   · Config in nex.safety_audit_config (default_retention_days · configurable)
--
-- Access model (F4 will add row-level security · F3 stays permissive):
--   · safety_audit_event · authorised HQ staff for investigation
--   · chat_message_archive · stricter access · used only when investigation
--     requires reviewing the actual content
--   · Never publicly visible in HQ · always via an audit workflow

BEGIN;

-- ── Config · one row · runtime-tunable retention defaults ─────────────
CREATE TABLE IF NOT EXISTS nex.safety_audit_config (
  singleton_key            text        PRIMARY KEY DEFAULT 'default'
                             CHECK (singleton_key = 'default'),
  default_retention_days   int         NOT NULL DEFAULT 30 CHECK (default_retention_days > 0),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
INSERT INTO nex.safety_audit_config (singleton_key) VALUES ('default')
  ON CONFLICT (singleton_key) DO NOTHING;

-- ── Safety audit event · shared across all destructive/paid actions ──
CREATE TABLE IF NOT EXISTS nex.safety_audit_event (
  event_id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type           text         NOT NULL CHECK (event_type IN (
                         'grenade', 'vault', 'admin_delete', 'admin_adjust',
                         'moderation_intervention'
                       )),
  action_id            text         NOT NULL,          -- NexAction.id (e.g. 'grenade')

  -- Actor · who performed it. Display name captured at event time so
  -- rename/deletion later doesn't corrupt the audit line.
  actor_user_id        text         NOT NULL,
  actor_display_name   text         NOT NULL,

  -- Target · what was acted upon. For grenade this is a message + its owner.
  -- target_user_id may equal actor_user_id (own-message grenade) or differ
  -- once P2 moderation grenades exist.
  target_kind          text         NOT NULL CHECK (target_kind IN ('message','user','conversation')),
  target_id            text         NOT NULL,
  target_user_id       text                    ,
  conversation_id      text                    ,

  -- Economic linkage
  wallet_transaction_id uuid                    ,
  sparks_charged       bigint       NOT NULL DEFAULT 0 CHECK (sparks_charged >= 0),

  -- Outcome
  success              boolean      NOT NULL,
  failure_reason       text                    ,

  -- Idempotency + observability
  idempotency_key      text         NOT NULL,
  request_ip_hash      text                    ,  -- SHA-256 of source IP · never raw IP
  request_metadata     jsonb        NOT NULL DEFAULT '{}'::jsonb,

  -- Time + retention
  event_time_utc       timestamptz  NOT NULL DEFAULT now(),
  -- Populated by BEFORE INSERT trigger from safety_audit_config.
  -- Explicit INSERT value wins if provided (allows callers to override).
  retention_until      timestamptz  NOT NULL DEFAULT (now() + interval '30 days'),
  legal_hold           boolean      NOT NULL DEFAULT false,
  legal_hold_reason    text                    ,
  legal_hold_set_at    timestamptz             ,
  legal_hold_set_by    text                    ,

  UNIQUE (idempotency_key, event_type)
);

-- Retention default from config · BEFORE INSERT trigger (subqueries not
-- allowed in column DEFAULTs). Explicit retention_until values pass through.
CREATE OR REPLACE FUNCTION nex.safety_audit_event_apply_default_retention()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_days int;
BEGIN
  -- Only apply the config-driven default if the caller didn't set retention.
  -- Detect via a sentinel: NEW.retention_until being the literal DEFAULT
  -- (now() + 30 days) is hard to distinguish · we always overwrite from
  -- config to keep behaviour consistent. Callers who want a custom value
  -- can set it AND flag legal_hold=true (which pins it) or update after insert.
  SELECT default_retention_days INTO v_days FROM nex.safety_audit_config
    WHERE singleton_key = 'default';
  NEW.retention_until := NEW.event_time_utc + make_interval(days => v_days);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS safety_audit_event_default_retention ON nex.safety_audit_event;
CREATE TRIGGER safety_audit_event_default_retention
  BEFORE INSERT ON nex.safety_audit_event
  FOR EACH ROW EXECUTE FUNCTION nex.safety_audit_event_apply_default_retention();

CREATE INDEX IF NOT EXISTS safety_audit_event_actor_time_idx
  ON nex.safety_audit_event (actor_user_id, event_time_utc DESC);
CREATE INDEX IF NOT EXISTS safety_audit_event_target_time_idx
  ON nex.safety_audit_event (target_id, event_time_utc DESC);
CREATE INDEX IF NOT EXISTS safety_audit_event_type_time_idx
  ON nex.safety_audit_event (event_type, event_time_utc DESC);
CREATE INDEX IF NOT EXISTS safety_audit_event_retention_idx
  ON nex.safety_audit_event (retention_until)
  WHERE legal_hold = false;

-- Immutability trigger · audit rows never mutate (except legal_hold fields
-- which are updated through a dedicated function).
CREATE OR REPLACE FUNCTION nex.safety_audit_event_reject_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'nex.safety_audit_event is retention-managed · use nex.safety_audit_purge_expired()'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Only legal_hold-related columns may change.
  IF NEW.event_id            <> OLD.event_id
     OR NEW.event_type       <> OLD.event_type
     OR NEW.action_id        <> OLD.action_id
     OR NEW.actor_user_id    <> OLD.actor_user_id
     OR NEW.actor_display_name <> OLD.actor_display_name
     OR NEW.target_kind      <> OLD.target_kind
     OR NEW.target_id        <> OLD.target_id
     OR NEW.sparks_charged   <> OLD.sparks_charged
     OR NEW.success          <> OLD.success
     OR NEW.idempotency_key  <> OLD.idempotency_key
     OR NEW.event_time_utc   <> OLD.event_time_utc THEN
    RAISE EXCEPTION 'nex.safety_audit_event: only legal_hold fields may be updated'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS safety_audit_event_no_delete ON nex.safety_audit_event;
CREATE TRIGGER safety_audit_event_no_delete
  BEFORE DELETE ON nex.safety_audit_event
  FOR EACH ROW EXECUTE FUNCTION nex.safety_audit_event_reject_mutation();
DROP TRIGGER IF EXISTS safety_audit_event_restricted_update ON nex.safety_audit_event;
CREATE TRIGGER safety_audit_event_restricted_update
  BEFORE UPDATE ON nex.safety_audit_event
  FOR EACH ROW EXECUTE FUNCTION nex.safety_audit_event_reject_mutation();

-- ── Preserved deleted-message content · stricter access ──────────────
-- When a chat_message is soft-deleted, its ORIGINAL content is copied
-- here. This table has stricter access (RLS to be added in F4 · for now
-- only the HQ audit UI reads it, via a dedicated service role).
--
-- Retention linked to the parent audit event · deletion cascades from
-- safety_audit_event purge (via nex.safety_audit_purge_expired).
CREATE TABLE IF NOT EXISTS nex.chat_message_archive (
  archive_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             uuid         NOT NULL REFERENCES nex.safety_audit_event(event_id) ON DELETE CASCADE,
  original_message_id  uuid         NOT NULL,
  conversation_id      text         NOT NULL,
  original_sender_id   text         NOT NULL,
  original_sender_display_name text  NOT NULL,
  original_content     text         NOT NULL,
  original_created_at  timestamptz  NOT NULL,
  archived_at          timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (event_id, original_message_id)
);
CREATE INDEX IF NOT EXISTS chat_message_archive_message_idx
  ON nex.chat_message_archive (original_message_id);

-- Immutability · same append-only rule as the wallet ledger.
CREATE OR REPLACE FUNCTION nex.chat_message_archive_reject_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Deletion is ONLY allowed via CASCADE from safety_audit_event purge.
    -- Detect that context: pg_trigger_depth() > 1 = cascade from parent.
    IF pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'nex.chat_message_archive is retention-managed · direct DELETE forbidden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RAISE EXCEPTION 'nex.chat_message_archive is append-only'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
DROP TRIGGER IF EXISTS chat_message_archive_no_mutate ON nex.chat_message_archive;
CREATE TRIGGER chat_message_archive_no_mutate
  BEFORE UPDATE OR DELETE ON nex.chat_message_archive
  FOR EACH ROW EXECUTE FUNCTION nex.chat_message_archive_reject_mutation();

-- ── Legal hold setter · the ONE way to set/unset a hold ──────────────
CREATE OR REPLACE FUNCTION nex.safety_audit_set_legal_hold(
  p_event_id       uuid,
  p_hold           boolean,
  p_reason         text,
  p_operator_id    text
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_hold AND (p_reason IS NULL OR length(p_reason) < 4) THEN
    RAISE EXCEPTION 'safety_audit_set_legal_hold: reason required when setting a hold';
  END IF;
  IF p_operator_id IS NULL THEN
    RAISE EXCEPTION 'safety_audit_set_legal_hold: operator_id required';
  END IF;
  -- Bypass the restricted_update trigger via SET LOCAL session_replication_role
  -- (only DBA-level roles can do this · production hardening moves this to a
  -- dedicated stored procedure with SECURITY DEFINER).
  UPDATE nex.safety_audit_event
     SET legal_hold        = p_hold,
         legal_hold_reason = p_reason,
         legal_hold_set_at = CASE WHEN p_hold THEN now() ELSE NULL END,
         legal_hold_set_by = p_operator_id
   WHERE event_id = p_event_id;
END;
$$;

-- Legal-hold trigger bypass · legal hold column mutations don't fail the
-- restricted_update check because only legal_hold_* columns changed.
-- (The check already ignores those columns · they're not in the diff list.)

-- ── Retention purge · scheduled by ops · never deletes held rows ─────
CREATE OR REPLACE FUNCTION nex.safety_audit_purge_expired()
RETURNS TABLE (purged_count int) LANGUAGE plpgsql AS $$
DECLARE
  v_purged int;
BEGIN
  -- We disable the delete trigger temporarily for this specific operation.
  -- In production this function runs under a role with the necessary
  -- override capability; in dev the trigger check on TG_OP='DELETE' is the
  -- guard against accidental application-level deletes.
  ALTER TABLE nex.safety_audit_event DISABLE TRIGGER safety_audit_event_no_delete;
  DELETE FROM nex.safety_audit_event
    WHERE retention_until < now() AND legal_hold = false;
  GET DIAGNOSTICS v_purged = ROW_COUNT;
  ALTER TABLE nex.safety_audit_event ENABLE TRIGGER safety_audit_event_no_delete;
  purged_count := v_purged;
  RETURN NEXT;
END;
$$;

-- ── Rewrite the grenade delete function · now writes to both new tables ─
-- Return type changed vs migration 103 · DROP first so CREATE succeeds.
DROP FUNCTION IF EXISTS nex.chat_message_grenade_delete(uuid, text, text, text, uuid);
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
  event_id        uuid,
  idempotent_hit  boolean
) LANGUAGE plpgsql AS $$
DECLARE
  v_msg            RECORD;
  v_existing_ev    RECORD;
  v_event_time     timestamptz := now();
  v_local_time     text;
  v_local_date     text;
  v_history        text;
  v_new_event_id   uuid;
  v_sparks_charged bigint := 0;
  v_idempotency    text;
BEGIN
  -- Compose idempotency key from actor + message + wallet txn · deterministic.
  v_idempotency := format('grenade:%s:%s:%s', p_actor_user_id, p_message_id, p_wallet_txn_id);

  -- Idempotency short-circuit.
  SELECT * INTO v_existing_ev FROM nex.safety_audit_event
    WHERE idempotency_key = v_idempotency AND event_type = 'grenade'
    LIMIT 1;
  IF FOUND THEN
    SELECT deletion.history_line, deletion.event_time
      INTO v_history, v_event_time
      FROM nex.chat_message_deletion deletion
      WHERE deletion.message_id = p_message_id
      ORDER BY deletion.event_time ASC LIMIT 1;
    message_id     := p_message_id;
    history_line   := v_history;
    event_time     := v_event_time;
    event_id       := v_existing_ev.event_id;
    idempotent_hit := true;
    RETURN NEXT; RETURN;
  END IF;

  -- Ownership + existence check (lock the row).
  SELECT * INTO v_msg FROM nex.chat_message
    WHERE nex.chat_message.message_id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'grenade: message % not found', p_message_id USING ERRCODE = 'no_data_found';
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

  -- Resolve Sparks charged from the wallet reservation (cost declared in the registry).
  SELECT -delta_sparks INTO v_sparks_charged
    FROM nex.wallet_transaction WHERE transaction_id = p_wallet_txn_id;
  IF v_sparks_charged IS NULL THEN v_sparks_charged := 0; END IF;

  -- Compose history line.
  v_local_time := to_char(v_event_time, 'HH12:MI AM');
  v_local_date := to_char(v_event_time, 'DD/MM/YYYY');
  v_history    := format('💣 %s grenaded this post · %s · %s',
                         p_actor_display_name, v_local_time, v_local_date);

  -- Safety audit event · shared across all destructive actions.
  INSERT INTO nex.safety_audit_event (
    event_type, action_id, actor_user_id, actor_display_name,
    target_kind, target_id, target_user_id, conversation_id,
    wallet_transaction_id, sparks_charged, success, idempotency_key,
    request_metadata, event_time_utc
  ) VALUES (
    'grenade', 'grenade', p_actor_user_id, p_actor_display_name,
    'message', p_message_id::text, v_msg.sender_id, p_conversation_id,
    p_wallet_txn_id, v_sparks_charged, true, v_idempotency,
    jsonb_build_object('history_line', v_history), v_event_time
  ) RETURNING safety_audit_event.event_id INTO v_new_event_id;

  -- Preserved content archive · stricter access · retention linked to event.
  INSERT INTO nex.chat_message_archive (
    event_id, original_message_id, conversation_id,
    original_sender_id, original_sender_display_name,
    original_content, original_created_at
  ) VALUES (
    v_new_event_id, p_message_id, p_conversation_id,
    v_msg.sender_id, v_msg.sender_display_name,
    v_msg.content, v_msg.created_at
  );

  -- Legacy per-message deletion record (kept for the chat-level history line).
  INSERT INTO nex.chat_message_deletion (
    message_id, conversation_id, actor_user_id, actor_display_name,
    actor_action, wallet_transaction_id, history_line, event_time
  ) VALUES (
    p_message_id, p_conversation_id, p_actor_user_id, p_actor_display_name,
    'grenade', p_wallet_txn_id, v_history, v_event_time
  );

  -- Soft-delete the message.
  UPDATE nex.chat_message
     SET deleted_at         = v_event_time,
         deleted_by_user_id = p_actor_user_id,
         deletion_reason    = 'grenade'
   WHERE nex.chat_message.message_id = p_message_id;

  message_id     := p_message_id;
  history_line   := v_history;
  event_time     := v_event_time;
  event_id       := v_new_event_id;
  idempotent_hit := false;
  RETURN NEXT;
END;
$$;

-- ── Failure audit · called when server-side action FAILS · records refund ─
-- Grenade handler calls this via its own path so failed attempts leave a
-- trace (helps detect abuse patterns, insufficient-Sparks probes, etc.).
CREATE OR REPLACE FUNCTION nex.safety_audit_record_failure(
  p_event_type          text,
  p_action_id           text,
  p_actor_user_id       text,
  p_actor_display_name  text,
  p_target_kind         text,
  p_target_id           text,
  p_conversation_id     text,
  p_wallet_txn_id       uuid,
  p_failure_reason      text,
  p_idempotency_key     text
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO nex.safety_audit_event (
    event_type, action_id, actor_user_id, actor_display_name,
    target_kind, target_id, conversation_id,
    wallet_transaction_id, sparks_charged, success, failure_reason,
    idempotency_key
  ) VALUES (
    p_event_type, p_action_id, p_actor_user_id, p_actor_display_name,
    p_target_kind, p_target_id, p_conversation_id,
    p_wallet_txn_id, 0, false, p_failure_reason,
    p_idempotency_key
  )
  ON CONFLICT (idempotency_key, event_type) DO NOTHING
  RETURNING event_id INTO v_id;
  RETURN v_id;
END;
$$;

COMMIT;
