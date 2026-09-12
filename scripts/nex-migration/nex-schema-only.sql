--
-- PostgreSQL database dump
--

\restrict f0W2CWahmZudcs4M3nKUITu4qZL4zFq3j5rdfeUaH4d3C9UOygxepbdLd8Fxe2M

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: bko_attribute_domain; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.bko_attribute_domain AS ENUM (
    'identity',
    'location',
    'contact',
    'opening_availability',
    'facilities',
    'accessibility',
    'family',
    'suitability',
    'character',
    'commercial',
    'freshness',
    'physical'
);


--
-- Name: bko_source_tier; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.bko_source_tier AS ENUM (
    'VERIFIED',
    'OBSERVED',
    'OWNER_CLAIM',
    'INFERRED',
    'UNKNOWN'
);


--
-- Name: discovery_rotation_state_kind; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.discovery_rotation_state_kind AS ENUM (
    'build',
    'saturated',
    'maintenance',
    'reactivate'
);


--
-- Name: mp_product_condition; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.mp_product_condition AS ENUM (
    'new',
    'used',
    'refurbished'
);


--
-- Name: mp_seller_status; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.mp_seller_status AS ENUM (
    'discovered',
    'claimable',
    'claimed',
    'registered',
    'verified',
    'active',
    'suspended'
);


--
-- Name: social_admin_readable_resource; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.social_admin_readable_resource AS ENUM (
    'account_status_only',
    'audit_event_summary',
    'publish_intent_summary'
);


--
-- Name: transport_contactability; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.transport_contactability AS ENUM (
    'contactable',
    'unknown',
    'invalid'
);


--
-- Name: transport_provider_kind; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.transport_provider_kind AS ENUM (
    'individual_driver',
    'driver_operator',
    'fleet_operator',
    'transport_business',
    'courier_operator',
    'logistics_operator',
    'unknown'
);


--
-- Name: transport_recruitment_stage; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.transport_recruitment_stage AS ENUM (
    'discovered',
    'public_contact_verified',
    'invitable',
    'invited',
    'interested',
    'registration_started',
    'registered',
    'kyc_pending',
    'vehicle_pending',
    'insurance_pending',
    'legal_review',
    'verified',
    'active',
    'declined',
    'unreachable',
    'opted_out'
);


--
-- Name: transport_review_flag; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.transport_review_flag AS ENUM (
    'duplicate_phone_across_unrelated',
    'impossible_vehicle_claims',
    'source_disappeared',
    'source_conflict',
    'generic_directory_number',
    'incompatible_vehicle_types',
    'copied_business_identity',
    'phone_used_by_unrelated_names',
    'invalid_phone_format',
    'source_evidence_insufficient'
);


--
-- Name: transport_source_kind; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.transport_source_kind AS ENUM (
    'public_business_website',
    'public_maps_listing',
    'public_business_directory',
    'public_transport_service_listing',
    'public_driver_service_website',
    'public_facebook_business_page',
    'public_instagram_business_profile',
    'public_whatsapp_business_link',
    'public_marketplace_listing',
    'public_recruitment_advertisement',
    'other_public_business_source',
    'unknown_or_disallowed'
);


--
-- Name: transport_vehicle_ontology; Type: TYPE; Schema: nex; Owner: -
--

CREATE TYPE nex.transport_vehicle_ontology AS ENUM (
    'motorcycle',
    'car',
    'taxi',
    'van',
    'mpv',
    'pickup',
    'small_truck',
    'truck',
    'lorry',
    'bus',
    'minibus',
    'courier',
    'airport_transfer',
    'tourist_driver',
    'logistics_operator',
    'unknown'
);


--
-- Name: _admin_bypass_active(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex._admin_bypass_active() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(current_setting('nex.social_admin_bypass', TRUE) = 'on', FALSE)
$$;


--
-- Name: _current_social_tenant(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex._current_social_tenant() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('nex.social_tenant_id', TRUE), '')::UUID
$$;


--
-- Name: _worker_active(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex._worker_active() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(current_setting('nex.social_worker', TRUE) = 'on', FALSE)
$$;


--
-- Name: FUNCTION _worker_active(); Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON FUNCTION nex._worker_active() IS 'Phase 4 · true when the system worker daemon is executing · GUC nex.social_worker=on · set ONLY by src/lib/nex/comms-social/worker/worker.ts';


--
-- Name: chat_message_archive_reject_mutation(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.chat_message_archive_reject_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: chat_message_grenade_delete(uuid, text, text, text, uuid); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.chat_message_grenade_delete(p_message_id uuid, p_conversation_id text, p_actor_user_id text, p_actor_display_name text, p_wallet_txn_id uuid) RETURNS TABLE(message_id uuid, history_line text, event_time timestamp with time zone, event_id uuid, idempotent_hit boolean)
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: chat_message_upsert(uuid, text, text, text, text, timestamp with time zone); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.chat_message_upsert(p_message_id uuid, p_conversation_id text, p_sender_id text, p_sender_display_name text, p_content text, p_created_at timestamp with time zone DEFAULT now()) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: analytics_rollup_queue; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.analytics_rollup_queue (
    queue_id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    enqueued_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    claimed_by text,
    claimed_at timestamp with time zone,
    lease_expires_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    completed_at timestamp with time zone,
    CONSTRAINT analytics_rollup_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: TABLE analytics_rollup_queue; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.analytics_rollup_queue IS 'D6 · async rollup queue. Populated by ingest when NEX_ANALYTICS_ROLLUP_ASYNC=1; drained by rollup worker on cron-tick.';


--
-- Name: claim_analytics_rollup_batch(text, integer, integer); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.claim_analytics_rollup_batch(p_worker_id text, p_batch_size integer, p_lease_seconds integer DEFAULT 60) RETURNS SETOF nex.analytics_rollup_queue
    LANGUAGE plpgsql
    AS $$
DECLARE
  claimed nex.analytics_rollup_queue;
BEGIN
  FOR claimed IN
    UPDATE nex.analytics_rollup_queue
    SET status = 'processing',
        claimed_by = p_worker_id,
        claimed_at = NOW(),
        lease_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        attempts = attempts + 1
    WHERE queue_id IN (
      SELECT queue_id FROM nex.analytics_rollup_queue
      WHERE status = 'pending'
      ORDER BY enqueued_at
      LIMIT p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  LOOP
    RETURN NEXT claimed;
  END LOOP;
END $$;


--
-- Name: worker_jobs; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.worker_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    worker_type text NOT NULL,
    priority integer DEFAULT 5 NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    input_kind text NOT NULL,
    input_ref text NOT NULL,
    input_payload jsonb,
    assigned_worker_id text,
    assigned_at timestamp with time zone,
    lease_expires_at timestamp with time zone,
    result_id uuid,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT worker_jobs_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'assigned'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: claim_next_job(text, text, integer); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.claim_next_job(p_worker_type text, p_worker_id text, p_lease_seconds integer DEFAULT 60) RETURNS nex.worker_jobs
    LANGUAGE plpgsql
    AS $$
DECLARE
    claimed nex.worker_jobs;
BEGIN
    UPDATE nex.worker_jobs
    SET status = 'assigned',
        assigned_worker_id = p_worker_id,
        assigned_at = NOW(),
        lease_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        attempts = attempts + 1,
        updated_at = NOW()
    WHERE id = (
        SELECT id FROM nex.worker_jobs
        WHERE worker_type = p_worker_type
          AND status = 'waiting'
        ORDER BY priority ASC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING * INTO claimed;
    RETURN claimed;
END;
$$;


--
-- Name: llm_retry_queue; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.llm_retry_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_job_id uuid,
    parent_worker_type text,
    parent_input_ref text,
    call_purpose text NOT NULL,
    call_options jsonb,
    call_messages jsonb NOT NULL,
    requires_capability text,
    prefer_provider text,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_provider_tried text,
    last_error text,
    status text DEFAULT 'pending'::text NOT NULL,
    succeeded_provider text,
    succeeded_at timestamp with time zone,
    result_summary jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT llm_retry_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_flight'::text, 'succeeded'::text, 'exhausted'::text, 'cancelled'::text])))
);


--
-- Name: TABLE llm_retry_queue; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.llm_retry_queue IS 'Phase 11.1b · adapted from db/migrations/002. Persistent queue for LLM calls that failed across every provider. Background retry worker (workers/llm-retry.ts) picks them up when providers recover.';


--
-- Name: claim_next_llm_retry(text, integer); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.claim_next_llm_retry(p_worker_id text, p_lease_seconds integer DEFAULT 60) RETURNS nex.llm_retry_queue
    LANGUAGE plpgsql
    AS $$
DECLARE
    claimed nex.llm_retry_queue;
BEGIN
    UPDATE nex.llm_retry_queue
    SET status = 'in_flight',
        attempts = attempts + 1,
        last_provider_tried = p_worker_id,
        next_attempt_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        updated_at = NOW()
    WHERE id = (
        SELECT id FROM nex.llm_retry_queue
        WHERE status = 'pending'
          AND next_attempt_at <= NOW()
        ORDER BY next_attempt_at ASC, attempts ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING * INTO claimed;
    RETURN claimed;
END;
$$;


--
-- Name: conv_ki_enforce_draft_tier(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.conv_ki_enforce_draft_tier() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.draft_only = false AND NEW.confidence < 0.70 THEN
    RAISE EXCEPTION 'conv_knowledge_items: confidence %.3f < 0.70 requires draft_only=true (ADR-0033)',
      NEW.confidence USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: conv_touch_updated_at(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.conv_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: food_business_touch_updated_at(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.food_business_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: food_outreach_template_touch_updated_at(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.food_outreach_template_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: media_object_touch_updated_at(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.media_object_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: qty_price_tiers_wellformed(jsonb); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.qty_price_tiers_wellformed(v jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  el          jsonb;
  min_qty     int;
  price_idr   int;
  prev_min    int := NULL;
  prev_price  int := NULL;
BEGIN
  IF jsonb_typeof(v) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(v) = 0 THEN RETURN true; END IF;

  FOR el IN SELECT * FROM jsonb_array_elements(v) LOOP
    IF jsonb_typeof(el) <> 'object' THEN RETURN false; END IF;
    IF jsonb_typeof(el->'minQty')          <> 'number' THEN RETURN false; END IF;
    IF jsonb_typeof(el->'pricePerUnitIdr') <> 'number' THEN RETURN false; END IF;

    min_qty   := (el->>'minQty')::int;
    price_idr := (el->>'pricePerUnitIdr')::int;
    IF min_qty   < 2 THEN RETURN false; END IF;
    IF price_idr <= 0 THEN RETURN false; END IF;

    IF prev_min IS NOT NULL AND min_qty <= prev_min THEN RETURN false; END IF;
    IF prev_price IS NOT NULL AND price_idr >= prev_price THEN RETURN false; END IF;

    prev_min   := min_qty;
    prev_price := price_idr;
  END LOOP;

  RETURN true;
END;
$$;


--
-- Name: safety_audit_event_apply_default_retention(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.safety_audit_event_apply_default_retention() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: safety_audit_event_reject_mutation(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.safety_audit_event_reject_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: safety_audit_purge_expired(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.safety_audit_purge_expired() RETURNS TABLE(purged_count integer)
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: safety_audit_record_failure(text, text, text, text, text, text, text, uuid, text, text); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.safety_audit_record_failure(p_event_type text, p_action_id text, p_actor_user_id text, p_actor_display_name text, p_target_kind text, p_target_id text, p_conversation_id text, p_wallet_txn_id uuid, p_failure_reason text, p_idempotency_key text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: safety_audit_set_legal_hold(uuid, boolean, text, text); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.safety_audit_set_legal_hold(p_event_id uuid, p_hold boolean, p_reason text, p_operator_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: social_admin_read(text, uuid, nex.social_admin_readable_resource, text); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.social_admin_read(p_admin_user_id text, p_target_tenant_id uuid, p_resource nex.social_admin_readable_resource, p_reason text) RETURNS TABLE(audit_id bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'nex', 'pg_catalog'
    AS $_$
DECLARE
  new_audit_id BIGINT;
BEGIN
  IF p_admin_user_id IS NULL OR btrim(p_admin_user_id) = '' THEN
    RAISE EXCEPTION 'admin_user_id required';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason required for cross-tenant admin read';
  END IF;

  INSERT INTO nex.social_admin_access_log (admin_user_id, target_tenant_id, resource, reason)
  VALUES (p_admin_user_id, p_target_tenant_id, p_resource::text, p_reason)
  RETURNING nex.social_admin_access_log.access_id INTO new_audit_id;

  -- Note: the actual data read is performed by the caller AFTER this
  -- audit-emitting function returns · caller sets the bypass GUC
  -- explicitly · which is why we return the audit_id as a receipt.
  -- The caller pattern is:
  --   SELECT nex.social_admin_read('user-x', $tid, 'account_status_only', 'support ticket #123');
  --   SET LOCAL nex.social_admin_bypass = 'on';
  --   SELECT ... FROM nex.social_accounts WHERE tenant_id = $tid;
  --   RESET nex.social_admin_bypass;
  audit_id := new_audit_id;
  RETURN NEXT;
END $_$;


--
-- Name: FUNCTION social_admin_read(p_admin_user_id text, p_target_tenant_id uuid, p_resource nex.social_admin_readable_resource, p_reason text); Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON FUNCTION nex.social_admin_read(p_admin_user_id text, p_target_tenant_id uuid, p_resource nex.social_admin_readable_resource, p_reason text) IS 'Charter §0 Boundary 3 · the ONLY cross-tenant read entry point · records audit row before caller sets bypass GUC';


--
-- Name: trg_accommodation_business_touch_updated_at(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.trg_accommodation_business_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: wallet_commit_spend(text, uuid, text); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.wallet_commit_spend(p_user_id text, p_reservation_id uuid, p_idempotency_key text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_reserved  RECORD;
  v_existing  uuid;
BEGIN
  SELECT transaction_id INTO v_existing FROM nex.wallet_transaction
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN; END IF;

  SELECT * INTO v_reserved FROM nex.wallet_transaction
    WHERE transaction_id = p_reservation_id AND user_id = p_user_id;
  IF NOT FOUND OR v_reserved.kind <> 'spend_reserved' THEN
    RAISE EXCEPTION 'wallet_commit_spend: reservation % not found for user %', p_reservation_id, p_user_id;
  END IF;

  INSERT INTO nex.wallet_transaction (
    user_id, kind, delta_sparks, idempotency_key, related_transaction_id, action_id, balance_after
  ) VALUES (
    p_user_id, 'spend_committed', 0, p_idempotency_key, p_reservation_id, v_reserved.action_id,
    (SELECT sparks_balance FROM nex.user_wallet WHERE user_id = p_user_id)
  );
END;
$$;


--
-- Name: wallet_grant_sparks(text, text, bigint, text, text, text); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.wallet_grant_sparks(p_user_id text, p_kind text, p_amount bigint, p_idempotency_key text, p_note text DEFAULT NULL::text, p_operator_id text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_existing  bigint;
  v_new_bal   bigint;
  v_current   bigint;
BEGIN
  IF p_kind NOT IN ('signup_grant','promotion_grant','admin_adjustment') THEN
    RAISE EXCEPTION 'wallet_grant_sparks: invalid kind %', p_kind;
  END IF;
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'wallet_grant_sparks: amount cannot be zero';
  END IF;

  SELECT balance_after INTO v_existing FROM nex.wallet_transaction
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO nex.user_wallet (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT sparks_balance INTO v_current FROM nex.user_wallet
    WHERE user_id = p_user_id FOR UPDATE;

  v_new_bal := v_current + p_amount;
  IF v_new_bal < 0 THEN
    RAISE EXCEPTION 'wallet_grant_sparks: adjustment would push balance below zero (from % by %)', v_current, p_amount;
  END IF;

  UPDATE nex.user_wallet
     SET sparks_balance    = v_new_bal,
         lifetime_granted  = CASE WHEN p_amount > 0 AND p_kind IN ('signup_grant','promotion_grant')
                                  THEN lifetime_granted + p_amount ELSE lifetime_granted END,
         updated_at = now()
   WHERE user_id = p_user_id;

  INSERT INTO nex.wallet_transaction (
    user_id, kind, delta_sparks, idempotency_key, operator_id, note, balance_after
  ) VALUES (
    p_user_id, p_kind, p_amount, p_idempotency_key, p_operator_id, p_note, v_new_bal
  );
  RETURN v_new_bal;
END;
$$;


--
-- Name: wallet_record_purchase(text, bigint, text, text); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.wallet_record_purchase(p_user_id text, p_amount bigint, p_purchase_ref text, p_note text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_existing  bigint;
  v_new_bal   bigint;
  v_current   bigint;
  v_key       text;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'wallet_record_purchase: amount must be positive';
  END IF;
  v_key := 'purchase:' || p_purchase_ref;

  SELECT balance_after INTO v_existing FROM nex.wallet_transaction
    WHERE user_id = p_user_id AND idempotency_key = v_key LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO nex.user_wallet (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT sparks_balance INTO v_current FROM nex.user_wallet
    WHERE user_id = p_user_id FOR UPDATE;
  v_new_bal := v_current + p_amount;
  UPDATE nex.user_wallet
     SET sparks_balance     = v_new_bal,
         lifetime_purchased = lifetime_purchased + p_amount,
         updated_at         = now()
   WHERE user_id = p_user_id;

  INSERT INTO nex.wallet_transaction (
    user_id, kind, delta_sparks, idempotency_key, purchase_ref, note, balance_after
  ) VALUES (
    p_user_id, 'purchase', p_amount, v_key, p_purchase_ref, p_note, v_new_bal
  );
  RETURN v_new_bal;
END;
$$;


--
-- Name: wallet_refund_spend(text, uuid, text); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.wallet_refund_spend(p_user_id text, p_reservation_id uuid, p_idempotency_key text) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_reserved  RECORD;
  v_existing  uuid;
  v_new_bal   bigint;
  v_current   bigint;
BEGIN
  SELECT transaction_id, balance_after INTO v_existing, v_new_bal FROM nex.wallet_transaction
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_new_bal; END IF;

  SELECT * INTO v_reserved FROM nex.wallet_transaction
    WHERE transaction_id = p_reservation_id AND user_id = p_user_id;
  IF NOT FOUND OR v_reserved.kind <> 'spend_reserved' THEN
    RAISE EXCEPTION 'wallet_refund_spend: reservation % not found for user %', p_reservation_id, p_user_id;
  END IF;

  SELECT sparks_balance INTO v_current FROM nex.user_wallet
    WHERE user_id = p_user_id FOR UPDATE;

  v_new_bal := v_current + (-v_reserved.delta_sparks);  -- delta was negative
  UPDATE nex.user_wallet
     SET sparks_balance = v_new_bal,
         lifetime_spent = greatest(0, lifetime_spent + v_reserved.delta_sparks),
         updated_at = now()
   WHERE user_id = p_user_id;

  INSERT INTO nex.wallet_transaction (
    user_id, kind, delta_sparks, idempotency_key, related_transaction_id, action_id, balance_after
  ) VALUES (
    p_user_id, 'spend_refunded', -v_reserved.delta_sparks, p_idempotency_key,
    p_reservation_id, v_reserved.action_id, v_new_bal
  );
  RETURN v_new_bal;
END;
$$;


--
-- Name: wallet_reserve_spend(text, text, bigint, text); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.wallet_reserve_spend(p_user_id text, p_action_id text, p_amount bigint, p_idempotency_key text) RETURNS TABLE(transaction_id uuid, balance_after bigint, idempotent_hit boolean)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_existing_id  uuid;
  v_existing_bal bigint;
  v_current      bigint;
  v_new_id       uuid;
  v_new_bal      bigint;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'wallet_reserve_spend: amount must be positive (got %)', p_amount;
  END IF;
  -- Idempotency short-circuit · retries with the same key return the same row.
  SELECT wt.transaction_id, wt.balance_after
    INTO v_existing_id, v_existing_bal
    FROM nex.wallet_transaction wt
   WHERE wt.user_id = p_user_id AND wt.idempotency_key = p_idempotency_key
   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    transaction_id := v_existing_id;
    balance_after  := v_existing_bal;
    idempotent_hit := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Lock the wallet row for the balance check + update.
  SELECT sparks_balance INTO v_current
    FROM nex.user_wallet WHERE user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_reserve_spend: no wallet for user %', p_user_id
      USING ERRCODE = 'no_data_found';
  END IF;
  IF v_current < p_amount THEN
    RAISE EXCEPTION 'wallet_reserve_spend: insufficient sparks (have %, need %)', v_current, p_amount
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_new_bal := v_current - p_amount;
  UPDATE nex.user_wallet
     SET sparks_balance = v_new_bal,
         lifetime_spent = lifetime_spent + p_amount,
         updated_at = now()
   WHERE user_id = p_user_id;

  INSERT INTO nex.wallet_transaction (
    user_id, kind, delta_sparks, idempotency_key, action_id, balance_after
  ) VALUES (
    p_user_id, 'spend_reserved', -p_amount, p_idempotency_key, p_action_id, v_new_bal
  ) RETURNING wallet_transaction.transaction_id INTO v_new_id;

  transaction_id := v_new_id;
  balance_after  := v_new_bal;
  idempotent_hit := false;
  RETURN NEXT;
END;
$$;


--
-- Name: wallet_transaction_reject_mutation(); Type: FUNCTION; Schema: nex; Owner: -
--

CREATE FUNCTION nex.wallet_transaction_reject_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'nex.wallet_transaction is append-only (attempted %)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;


--
-- Name: accommodation_business; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.accommodation_business (
    internal_id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_listing_ref text NOT NULL,
    business_name text NOT NULL,
    category text NOT NULL,
    categories text[] DEFAULT '{}'::text[] NOT NULL,
    address text,
    city text NOT NULL,
    district text,
    coordinates_lng numeric,
    coordinates_lat numeric,
    phone text,
    whatsapp_number text,
    website text,
    public_social_links jsonb,
    star_rating integer,
    star_rating_source text,
    room_count integer,
    amenities text[] DEFAULT '{}'::text[] NOT NULL,
    source text NOT NULL,
    source_reference text NOT NULL,
    source_ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    source_checked_at timestamp with time zone,
    source_licence_terms text,
    source_updated_at timestamp with time zone,
    last_verified_at timestamp with time zone,
    verification_source text,
    dedupe_hash text NOT NULL,
    claim_status text DEFAULT 'discovered'::text NOT NULL,
    owner_status text DEFAULT 'unknown'::text NOT NULL,
    hero_image_url text,
    hero_image_source text,
    hero_image_approved boolean DEFAULT false NOT NULL,
    hero_image_provenance jsonb,
    rating numeric(3,2),
    rating_source text,
    review_count integer,
    review_count_source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    country text NOT NULL,
    location_confidence text DEFAULT 'CITY'::text NOT NULL,
    neighbourhood text,
    street_line text,
    in_target_zone boolean,
    geocode_evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    location_verified_at timestamp with time zone,
    location_source text,
    recovered_evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence_recovered_at timestamp with time zone,
    evidence_source text,
    worker_id text,
    cycle_run_id uuid,
    CONSTRAINT accommodation_business_category_check CHECK ((category = ANY (ARRAY['hotel'::text, 'villa'::text, 'guesthouse'::text, 'homestay'::text, 'resort'::text, 'hostel'::text, 'apartment'::text, 'kos'::text]))),
    CONSTRAINT accommodation_business_claim_status_check CHECK ((claim_status = ANY (ARRAY['discovered'::text, 'verifying'::text, 'listed'::text, 'invited'::text, 'claimed'::text, 'paying'::text]))),
    CONSTRAINT accommodation_business_country_iso_check CHECK ((country ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT accommodation_business_location_confidence_check CHECK ((location_confidence = ANY (ARRAY['EXACT'::text, 'STREET'::text, 'AREA'::text, 'CITY'::text, 'UNKNOWN'::text]))),
    CONSTRAINT accommodation_business_owner_status_check CHECK ((owner_status = ANY (ARRAY['unknown'::text, 'contacted'::text, 'responded'::text, 'verified'::text]))),
    CONSTRAINT accommodation_business_public_listing_ref_check CHECK ((public_listing_ref ~ '^#AC-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$'::text)),
    CONSTRAINT accommodation_business_rating_check CHECK (((rating IS NULL) OR ((rating >= (0)::numeric) AND (rating <= (5)::numeric)))),
    CONSTRAINT accommodation_business_review_count_check CHECK (((review_count IS NULL) OR (review_count >= 0))),
    CONSTRAINT accommodation_business_room_count_check CHECK (((room_count IS NULL) OR (room_count > 0))),
    CONSTRAINT accommodation_business_star_rating_check CHECK (((star_rating IS NULL) OR ((star_rating >= 1) AND (star_rating <= 5))))
);


--
-- Name: TABLE accommodation_business; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.accommodation_business IS 'Task #89 Phase A · Yogyakarta Accommodation vertical · canonical record. Parallel to nex.food_business · same shape · isolated so Accommodation state machine evolves independently. Populated by Walker (Universal Acquisition Engine · Task #50) via scripts/nex-acquisition/configs/accommodation-yogyakarta.mjs. Every new row lands at claim_status=discovered · never auto-published · admin promotion required to reach listed.';


--
-- Name: COLUMN accommodation_business.category; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.accommodation_business.category IS 'Q2 · 8-value taxonomy (Task #89 Phase A + Kos addition 2026-08-22) · determined by conservative classifier from OSM tags + name-based Kos detection (Indonesian residential monthly rental · tokens: kos/kost/kosan/indekos) · never inferred from vague accommodation-related tag or cheap-looking building alone.';


--
-- Name: COLUMN accommodation_business.categories; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.accommodation_business.categories IS 'Task #85 secondary-token pattern · evidence-based tags (e.g. luxury · budget · family · boutique) that never override primary category.';


--
-- Name: COLUMN accommodation_business.amenities; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.accommodation_business.amenities IS 'OSM-sourced amenity tags (wifi · pool · breakfast · air_conditioning) · empty by default · never fabricated · never inferred.';


--
-- Name: COLUMN accommodation_business.country; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.accommodation_business.country IS 'Country Foundation Step 3 · 2026-08-22 · ISO 3166-1 alpha-2 · required NOT NULL · no DEFAULT (every INSERT must explicitly declare). Backfilled to ''ID'' for pre-Step-3 Yogyakarta rows.';


--
-- Name: COLUMN accommodation_business.location_confidence; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.accommodation_business.location_confidence IS 'NEX Location Intelligence 5-state · same semantics as food_business.location_confidence.';


--
-- Name: COLUMN accommodation_business.recovered_evidence; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.accommodation_business.recovered_evidence IS 'NEX Path A Priority 1 · JSONB of attributes recovered from raw source_snapshot payload · per-attribute provenance embedded · never contributes to a ranking score · consumed as EVIDENCE by Business Knowledge Object / Decision Context. Doctrine: project_nex_priority_greenlight_accommodation_path_a_food_walker_preservation_2026_08_23.';


--
-- Name: COLUMN accommodation_business.worker_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.accommodation_business.worker_id IS 'Persistence contract 2026-08-26 · worker_id matching nex.worker_heartbeat.worker_id. NULL for pre-contract rows.';


--
-- Name: COLUMN accommodation_business.cycle_run_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.accommodation_business.cycle_run_id IS 'Persistence contract 2026-08-26 · FK to worker_cycle_run.id. NULL for pre-contract rows.';


--
-- Name: accommodation_business_field_provenance; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.accommodation_business_field_provenance (
    business_ref text NOT NULL,
    field_name text NOT NULL,
    trust_layer text NOT NULL,
    written_at timestamp with time zone DEFAULT now() NOT NULL,
    written_by text,
    source_reference text,
    cycle_run_id uuid,
    CONSTRAINT accommodation_business_field_provenance_trust_layer_check CHECK ((trust_layer = ANY (ARRAY['source_import'::text, 'nex_curated'::text, 'admin_verified'::text, 'owner_verified'::text, 'admin_rejected'::text])))
);


--
-- Name: TABLE accommodation_business_field_provenance; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.accommodation_business_field_provenance IS 'Task #89 Phase A · per-field trust layer + cycle_run_id FK (Direct-Provenance A · Task #74). Trust hierarchy: source_import < nex_curated < admin_verified/owner_verified. admin_rejected recorded but never applied to canonical field (queue suppresses future re-suggestion).';


--
-- Name: accommodation_business_source_snapshot; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.accommodation_business_source_snapshot (
    snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text NOT NULL,
    source text NOT NULL,
    source_reference text NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    raw_payload jsonb NOT NULL,
    cycle_run_id uuid
);


--
-- Name: TABLE accommodation_business_source_snapshot; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.accommodation_business_source_snapshot IS 'Task #89 Phase A · raw OSM/source payload preserved · never mutated · Phase C enrichment reads from here (star_rating · room_count · amenities extraction from tags without re-querying OSM).';


--
-- Name: accommodation_enrichment_evidence; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.accommodation_enrichment_evidence (
    evidence_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text NOT NULL,
    field_name text NOT NULL,
    value text,
    value_normalised text,
    source text NOT NULL,
    source_type text NOT NULL,
    source_url text,
    confidence numeric(3,2) NOT NULL,
    agent_name text NOT NULL,
    discovered_at timestamp with time zone DEFAULT now() NOT NULL,
    provenance_layer text DEFAULT 'source_import'::text NOT NULL,
    raw_snippet text,
    raw_payload jsonb,
    cycle_run_id uuid,
    CONSTRAINT accommodation_enrichment_evidence_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))
);


--
-- Name: TABLE accommodation_enrichment_evidence; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.accommodation_enrichment_evidence IS 'Task #89 Phase A · candidate evidence (mirrors Task #88 Phase 2 pattern for Food). Phase C admin queue will read from here for adjudication. Empty on Phase A ship · Phase C fills.';


--
-- Name: alert_dispatches; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.alert_dispatches (
    dispatch_id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_id uuid NOT NULL,
    channel text NOT NULL,
    destination text,
    status text NOT NULL,
    error text,
    latency_ms integer,
    attempt_no integer DEFAULT 1 NOT NULL,
    dispatched_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT alert_dispatches_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: TABLE alert_dispatches; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.alert_dispatches IS 'Immutable audit of every notification attempt · never mutated after insert';


--
-- Name: alert_rules; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.alert_rules (
    rule_id text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    severity text NOT NULL,
    description text,
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    dedup_window_sec integer DEFAULT 300 NOT NULL,
    notify_channels text[] DEFAULT ARRAY['email'::text, 'webhook'::text, 'slack'::text] NOT NULL,
    root_cause_of text[] DEFAULT ARRAY[]::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alert_rules_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: TABLE alert_rules; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.alert_rules IS 'Rule catalogue · admin-editable thresholds + enable flags · seeded on first evaluate';


--
-- Name: alerts; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.alerts (
    alert_id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id text NOT NULL,
    incident_id uuid,
    severity text NOT NULL,
    state text DEFAULT 'open'::text NOT NULL,
    title text NOT NULL,
    detail text,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    first_detected_at timestamp with time zone DEFAULT now() NOT NULL,
    last_triggered_at timestamp with time zone DEFAULT now() NOT NULL,
    trigger_count integer DEFAULT 1 NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledged_by text,
    resolved_at timestamp with time zone,
    resolved_reason text,
    resolved_by text,
    CONSTRAINT alerts_state_check CHECK ((state = ANY (ARRAY['open'::text, 'acknowledged'::text, 'resolved'::text])))
);


--
-- Name: TABLE alerts; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.alerts IS 'Alert instances with lifecycle (open/acknowledged/resolved) · one open per rule · incident_id correlates related alerts';


--
-- Name: analytics_events; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.analytics_events (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    event_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    campaign_id uuid,
    recipient_id uuid,
    segment_id uuid,
    provider text,
    country text,
    domain text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    provider_message_id text,
    user_agent text,
    ip text,
    link_url text,
    latency_ms integer,
    conversion_value numeric(12,2),
    revenue numeric(12,2),
    attribution_window integer,
    journey_id uuid,
    automation_id uuid,
    experiment_id uuid,
    variant_id text,
    CONSTRAINT analytics_events_event_type_check CHECK ((event_type = ANY (ARRAY['queued'::text, 'delivered'::text, 'deferred'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'complaint'::text, 'unsubscribed'::text, 'failed'::text, 'suppressed'::text])))
);


--
-- Name: TABLE analytics_events; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.analytics_events IS 'Canonical event stream · 10 event types · single source of truth for all analytics · future fields reserved for attribution/journeys/experiments/revenue';


--
-- Name: analytics_records; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.analytics_records (
    record_id uuid NOT NULL,
    provider text NOT NULL,
    event_name text,
    path text,
    hostname text,
    referrer text,
    country text,
    device text,
    browser text,
    os text,
    session_id text,
    visitor_id text,
    duration_sec integer,
    bounced boolean,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE analytics_records; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.analytics_records IS 'Infrastructure Runtime §5.6 · Analytics Service · 730d retention';


--
-- Name: attributions; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.attributions (
    attribution_id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversion_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    model text NOT NULL,
    window_days integer NOT NULL,
    credit_pct numeric(6,3) NOT NULL,
    attributed_value numeric(12,2) NOT NULL,
    currency text NOT NULL,
    source_event_id uuid,
    source_event_type text,
    source_event_timestamp timestamp with time zone,
    campaign_id uuid,
    journey_id uuid,
    journey_version integer,
    experiment_id uuid,
    variant_id text,
    provider text,
    country text,
    domain text,
    attribution_run_id uuid,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attributions_model_check CHECK ((model = ANY (ARRAY['first_touch'::text, 'last_touch'::text, 'linear'::text])))
);


--
-- Name: TABLE attributions; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.attributions IS 'Computed credit rows · UNIQUE(conversion_id, model, source_event_id) for replay idempotency · invariant #14';


--
-- Name: audit_log; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    actor text NOT NULL,
    before_state jsonb,
    after_state jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_rules; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.automation_rules (
    snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id text NOT NULL,
    name text NOT NULL,
    description text,
    authority text NOT NULL,
    enabled boolean NOT NULL,
    trigger jsonb DEFAULT '{}'::jsonb NOT NULL,
    condition jsonb DEFAULT '{}'::jsonb NOT NULL,
    action jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    created_by text,
    version integer DEFAULT 1 NOT NULL,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT automation_rules_authority_check CHECK ((authority = ANY (ARRAY['L1'::text, 'L2'::text, 'L3'::text])))
);


--
-- Name: TABLE automation_rules; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.automation_rules IS 'Infrastructure Runtime §5.7 · Automation Engine rules · retention forever';


--
-- Name: automation_runs; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.automation_runs (
    run_id uuid NOT NULL,
    rule_id text NOT NULL,
    rule_name text,
    rule_authority text,
    triggered_by_event_id uuid,
    triggered_by_event_type text,
    triggered_at timestamp with time zone NOT NULL,
    status text NOT NULL,
    outcome_detail text,
    action_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    admin_actor text,
    admin_decided_at timestamp with time zone,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE automation_runs; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.automation_runs IS 'Infrastructure Runtime §5.7 · Automation Engine runs · 180d retention';


--
-- Name: benchmark_runs; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.benchmark_runs (
    run_id uuid DEFAULT gen_random_uuid() NOT NULL,
    ran_at timestamp with time zone DEFAULT now() NOT NULL,
    label text,
    target_recipients integer NOT NULL,
    actual_recipients integer NOT NULL,
    wall_clock_ms integer NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'complete'::text NOT NULL,
    notes text,
    environment jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT benchmark_runs_status_check CHECK ((status = ANY (ARRAY['complete'::text, 'failed'::text, 'partial'::text])))
);


--
-- Name: TABLE benchmark_runs; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.benchmark_runs IS 'INSERT-only stress benchmark history · one row per run · baseline comparison over time';


--
-- Name: bike_model; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.bike_model (
    slug text NOT NULL,
    brand text NOT NULL,
    model text NOT NULL,
    year_range text NOT NULL,
    cc integer NOT NULL,
    category text NOT NULL,
    base_image text NOT NULL,
    base_color text NOT NULL,
    common_colors text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bike_model_category_check CHECK ((category = ANY (ARRAY['matic'::text, 'maxi'::text, 'sport'::text, 'commuter'::text, 'bebek'::text, 'adventure'::text, 'retro'::text, 'electric'::text])))
);


--
-- Name: bike_rental_listing; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.bike_rental_listing (
    rental_id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    neighbourhood text,
    whatsapp_e164 text,
    photo_url text,
    preferred_bike_slug text,
    preferred_categories text[] DEFAULT '{}'::text[] NOT NULL,
    helmets_included integer DEFAULT 1 NOT NULL,
    raincoats_included integer DEFAULT 0 NOT NULL,
    hotel_villa_dropoff boolean DEFAULT false NOT NULL,
    tank_full_on_rental boolean DEFAULT false NOT NULL,
    price_per_day_idr integer,
    price_per_week_idr integer,
    price_per_month_idr integer,
    has_buy_option boolean DEFAULT false NOT NULL,
    buy_price_idr integer,
    status text DEFAULT 'active'::text NOT NULL,
    rating_avg numeric(3,2),
    rating_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    airport_pickup_on_arrival boolean DEFAULT false NOT NULL,
    CONSTRAINT bike_rental_listing_helmets_included_check CHECK ((helmets_included >= 0)),
    CONSTRAINT bike_rental_listing_raincoats_included_check CHECK ((raincoats_included >= 0)),
    CONSTRAINT bike_rental_listing_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'removed'::text])))
);


--
-- Name: brain_accommodation_prices; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_accommodation_prices (
    price_id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_slug text NOT NULL,
    tier text NOT NULL,
    typical_min_idr integer,
    typical_max_idr integer,
    currency text DEFAULT 'IDR'::text,
    sample_size integer,
    season_context text,
    source text,
    source_reference text,
    source_licence_terms text,
    sampled_at timestamp with time zone DEFAULT now(),
    confidence numeric DEFAULT 0.6,
    CONSTRAINT brain_accommodation_prices_tier_check CHECK ((tier = ANY (ARRAY['backpacker'::text, 'budget'::text, 'mid_range'::text, 'luxury'::text, 'premium'::text])))
);


--
-- Name: brain_activities; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_activities (
    activity_id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_slug text NOT NULL,
    activity_kind text NOT NULL,
    spot_name_en text NOT NULL,
    spot_name_id text,
    suitable_for jsonb,
    best_months jsonb,
    price_range_idr jsonb,
    description_en text,
    description_id text,
    source text,
    source_reference text,
    source_licence_terms text,
    first_discovered_at timestamp with time zone DEFAULT now(),
    last_verified_at timestamp with time zone DEFAULT now(),
    confidence numeric DEFAULT 0.7,
    CONSTRAINT brain_activities_activity_kind_check CHECK ((activity_kind = ANY (ARRAY['surfing'::text, 'diving'::text, 'snorkeling'::text, 'hiking'::text, 'climbing'::text, 'beach'::text, 'nightlife'::text, 'culture'::text, 'spiritual'::text, 'food_tour'::text, 'shopping'::text, 'family'::text, 'wildlife'::text, 'adventure'::text, 'wellness'::text, 'cycling'::text, 'yoga'::text, 'photography'::text])))
);


--
-- Name: brain_attractions; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_attractions (
    attraction_id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_slug text NOT NULL,
    attraction_kind text NOT NULL,
    name_en text NOT NULL,
    name_id text,
    coordinates_lat numeric,
    coordinates_lng numeric,
    entry_price_idr jsonb,
    opening_hours jsonb,
    description_en text,
    description_id text,
    best_time_to_visit text,
    source text,
    source_reference text,
    source_licence_terms text,
    first_discovered_at timestamp with time zone DEFAULT now(),
    last_verified_at timestamp with time zone DEFAULT now(),
    confidence numeric DEFAULT 0.75,
    CONSTRAINT brain_attractions_attraction_kind_check CHECK ((attraction_kind = ANY (ARRAY['temple'::text, 'beach'::text, 'waterfall'::text, 'mountain'::text, 'national_park'::text, 'museum'::text, 'monument'::text, 'historical_site'::text, 'viewpoint'::text, 'market'::text, 'village'::text, 'other'::text])))
);


--
-- Name: brain_did_you_know_indonesia; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_did_you_know_indonesia (
    fact_id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    category text NOT NULL,
    region_slug text,
    region_label text,
    truth_class text DEFAULT 'confirmed_fact'::text NOT NULL,
    difficulty integer DEFAULT 3 NOT NULL,
    verified_source text DEFAULT 'human_curated_v1'::text NOT NULL,
    source_url text,
    licence_terms text DEFAULT 'CC0 · public factual data'::text NOT NULL,
    priority integer DEFAULT 5 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title_id text,
    body_id text,
    translated_at timestamp with time zone,
    CONSTRAINT brain_did_you_know_indonesia_category_check CHECK ((category = ANY (ARRAY['nature'::text, 'geology'::text, 'culture'::text, 'history'::text, 'language'::text, 'food'::text, 'rituals'::text, 'science'::text, 'society'::text, 'symbols'::text]))),
    CONSTRAINT brain_did_you_know_indonesia_difficulty_check CHECK (((difficulty >= 1) AND (difficulty <= 5))),
    CONSTRAINT brain_did_you_know_indonesia_truth_class_check CHECK ((truth_class = ANY (ARRAY['confirmed_fact'::text, 'academic_reference'::text, 'traditional_folk'::text, 'spiritual_belief'::text, 'unconfirmed'::text, 'ai_generated'::text])))
);


--
-- Name: brain_english_grammar; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_english_grammar (
    grammar_id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_slug text NOT NULL,
    topic_en text NOT NULL,
    topic_id text NOT NULL,
    cefr_level text NOT NULL,
    category text NOT NULL,
    explanation_en text NOT NULL,
    explanation_id text NOT NULL,
    positive_examples jsonb NOT NULL,
    common_indonesian_error jsonb,
    contrast_with_indonesian text,
    source text NOT NULL,
    source_reference text NOT NULL,
    source_licence_terms text NOT NULL,
    created_by text NOT NULL,
    confidence integer DEFAULT 50 NOT NULL,
    flagged_for_review boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_english_grammar_category_check CHECK ((category = ANY (ARRAY['tenses'::text, 'articles'::text, 'pronouns'::text, 'prepositions'::text, 'conjunctions'::text, 'word_order'::text, 'conditionals'::text, 'modal_verbs'::text, 'passive_voice'::text, 'reported_speech'::text, 'gerunds_infinitives'::text, 'comparatives'::text, 'question_forms'::text, 'phrasal_verbs'::text, 'punctuation'::text, 'spelling'::text, 'pronunciation'::text, 'other'::text]))),
    CONSTRAINT brain_english_grammar_cefr_level_check CHECK ((cefr_level = ANY (ARRAY['A1'::text, 'A2'::text, 'B1'::text, 'B2'::text, 'C1'::text, 'C2'::text]))),
    CONSTRAINT brain_english_grammar_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100)))
);


--
-- Name: TABLE brain_english_grammar; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.brain_english_grammar IS 'CEFR-aligned English grammar rules with Indonesian explanations. Includes contrast_with_indonesian and common_indonesian_error to address mistakes specific to Bahasa Indonesia speakers.';


--
-- Name: brain_english_lesson; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_english_lesson (
    lesson_id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_slug text NOT NULL,
    title_en text NOT NULL,
    title_id text NOT NULL,
    cefr_level text NOT NULL,
    topic_theme text NOT NULL,
    learning_objectives_en text[] NOT NULL,
    learning_objectives_id text[] NOT NULL,
    intro_dialogue_en text NOT NULL,
    intro_dialogue_id text NOT NULL,
    key_vocabulary jsonb NOT NULL,
    key_grammar_slugs text[] NOT NULL,
    practice_prompts jsonb NOT NULL,
    cultural_note_en text,
    cultural_note_id text,
    estimated_minutes integer DEFAULT 15 NOT NULL,
    prerequisite_lesson_slugs text[],
    source text NOT NULL,
    source_reference text,
    source_licence_terms text NOT NULL,
    created_by text NOT NULL,
    confidence integer DEFAULT 50 NOT NULL,
    flagged_for_review boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_english_lesson_cefr_level_check CHECK ((cefr_level = ANY (ARRAY['A1'::text, 'A2'::text, 'B1'::text, 'B2'::text, 'C1'::text, 'C2'::text]))),
    CONSTRAINT brain_english_lesson_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100)))
);


--
-- Name: TABLE brain_english_lesson; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.brain_english_lesson IS 'Structured English lessons: dialogue + vocab + grammar + practice + cultural note. All bilingual. Referenced by brain_english_practice via lesson_slug.';


--
-- Name: brain_english_practice; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_english_practice (
    practice_id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_slug text,
    cefr_level text NOT NULL,
    practice_kind text NOT NULL,
    prompt_en text,
    prompt_id text,
    correct_answer text NOT NULL,
    acceptable_variants text[],
    distractor_options text[],
    hint_id text,
    explanation_id text,
    difficulty integer DEFAULT 3 NOT NULL,
    source text NOT NULL,
    source_licence_terms text NOT NULL,
    created_by text NOT NULL,
    confidence integer DEFAULT 50 NOT NULL,
    flagged_for_review boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_english_practice_cefr_level_check CHECK ((cefr_level = ANY (ARRAY['A1'::text, 'A2'::text, 'B1'::text, 'B2'::text, 'C1'::text, 'C2'::text]))),
    CONSTRAINT brain_english_practice_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100))),
    CONSTRAINT brain_english_practice_difficulty_check CHECK (((difficulty >= 1) AND (difficulty <= 5))),
    CONSTRAINT brain_english_practice_practice_kind_check CHECK ((practice_kind = ANY (ARRAY['translate_en_to_id'::text, 'translate_id_to_en'::text, 'fill_in_blank'::text, 'multiple_choice'::text, 'reorder_words'::text, 'listen_and_type'::text, 'pronounce_and_record'::text, 'free_response'::text])))
);


--
-- Name: TABLE brain_english_practice; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.brain_english_practice IS 'Practice items across 8 kinds (translate / fill-blank / MCQ / reorder / listen / pronounce / free-response). Difficulty 1-5. Distractors and hints in Indonesian.';


--
-- Name: brain_english_progress; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_english_progress (
    progress_id uuid DEFAULT gen_random_uuid() NOT NULL,
    learner_ref text NOT NULL,
    vocab_id uuid,
    grammar_id uuid,
    lesson_slug text,
    practice_id uuid,
    attempts integer DEFAULT 0 NOT NULL,
    correct_count integer DEFAULT 0 NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    mastery_score integer DEFAULT 0 NOT NULL,
    next_review_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_english_progress_check CHECK (((((((vocab_id IS NOT NULL))::integer + ((grammar_id IS NOT NULL))::integer) + ((lesson_slug IS NOT NULL))::integer) + ((practice_id IS NOT NULL))::integer) = 1)),
    CONSTRAINT brain_english_progress_mastery_score_check CHECK (((mastery_score >= 0) AND (mastery_score <= 100)))
);


--
-- Name: TABLE brain_english_progress; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.brain_english_progress IS 'Per-learner progress across vocab / grammar / lesson / practice. Spaced-repetition next_review_at drives NEX daily lesson selection. Isolated to English-teaching brain per ADR-0033.';


--
-- Name: brain_english_vocabulary; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_english_vocabulary (
    vocab_id uuid DEFAULT gen_random_uuid() NOT NULL,
    word text NOT NULL,
    word_normalised text NOT NULL,
    part_of_speech text NOT NULL,
    cefr_level text NOT NULL,
    definition_en text,
    definition_id text,
    pronunciation_ipa text,
    pronunciation_id_hint text,
    example_sentence_en text,
    example_sentence_id text,
    common_mistake_note_id text,
    register text,
    variety text,
    tags text[],
    frequency_rank integer,
    source text NOT NULL,
    source_reference text NOT NULL,
    source_licence_terms text NOT NULL,
    created_by text NOT NULL,
    confidence integer DEFAULT 50 NOT NULL,
    flagged_for_review boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_english_vocabulary_cefr_level_check CHECK ((cefr_level = ANY (ARRAY['A1'::text, 'A2'::text, 'B1'::text, 'B2'::text, 'C1'::text, 'C2'::text]))),
    CONSTRAINT brain_english_vocabulary_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100))),
    CONSTRAINT brain_english_vocabulary_part_of_speech_check CHECK ((part_of_speech = ANY (ARRAY['noun'::text, 'verb'::text, 'adjective'::text, 'adverb'::text, 'pronoun'::text, 'preposition'::text, 'conjunction'::text, 'determiner'::text, 'interjection'::text, 'phrasal_verb'::text, 'idiom'::text]))),
    CONSTRAINT brain_english_vocabulary_register_check CHECK ((register = ANY (ARRAY['formal'::text, 'neutral'::text, 'informal'::text, 'slang'::text, 'technical'::text, 'literary'::text]))),
    CONSTRAINT brain_english_vocabulary_variety_check CHECK ((variety = ANY (ARRAY['british'::text, 'american'::text, 'both'::text, 'international'::text])))
);


--
-- Name: TABLE brain_english_vocabulary; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.brain_english_vocabulary IS 'CEFR-aligned English vocabulary for Indonesian learners. Bilingual (EN + ID gloss). Populated by Ollama from Oxford 3000 / Wikipedia Simple / KBBI cross-refs. Confidence + source + licence tracked per row.';


--
-- Name: brain_local_guide; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_local_guide (
    guide_id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_slug text NOT NULL,
    local_intro_en text,
    local_intro_id text,
    what_to_do_en text,
    what_to_do_id text,
    what_to_eat_en text,
    what_to_eat_id text,
    cultural_notes_en text,
    cultural_notes_id text,
    safety_notes_en text,
    safety_notes_id text,
    language_tips_en text,
    language_tips_id text,
    last_compiled_at timestamp with time zone DEFAULT now(),
    compiled_from_sources jsonb,
    confidence numeric DEFAULT 0.7
);


--
-- Name: brain_location; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_location (
    location_id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    canonical_name_en text NOT NULL,
    canonical_name_id text,
    kind text NOT NULL,
    parent_province text,
    region text,
    coordinates_lat numeric,
    coordinates_lng numeric,
    population_est integer,
    vibe_classification text,
    primary_language text,
    timezone text,
    source text,
    source_reference text,
    source_licence_terms text,
    first_discovered_at timestamp with time zone DEFAULT now(),
    last_verified_at timestamp with time zone DEFAULT now(),
    confidence numeric DEFAULT 0.9,
    CONSTRAINT brain_location_kind_check CHECK ((kind = ANY (ARRAY['province'::text, 'city'::text, 'kabupaten'::text, 'kecamatan'::text, 'island'::text, 'region'::text, 'destination'::text]))),
    CONSTRAINT brain_location_vibe_classification_check CHECK ((vibe_classification = ANY (ARRAY['holiday_resort'::text, 'tourist_hub'::text, 'business_hub'::text, 'quiet'::text, 'religious'::text, 'historical'::text, 'beach'::text, 'mountain'::text, 'urban'::text, 'rural'::text, 'unknown'::text])))
);


--
-- Name: brain_memories; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_memories (
    memory_id uuid NOT NULL,
    brain_name text NOT NULL,
    brain_slug text NOT NULL,
    source_job_id text,
    source_kind text,
    source_owner text,
    knowledge_type text,
    title text,
    content_length integer,
    inbox_item_id text,
    added_at timestamp with time zone NOT NULL,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE brain_memories; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.brain_memories IS 'Infrastructure Runtime §5.3 · Brain Router memories · retention forever';


--
-- Name: brain_seasons; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_seasons (
    season_id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_slug text NOT NULL,
    season_kind text NOT NULL,
    month_start integer,
    month_end integer,
    description_en text,
    description_id text,
    crowd_level text,
    weather_notes text,
    source text,
    source_reference text,
    source_licence_terms text,
    first_discovered_at timestamp with time zone DEFAULT now(),
    last_verified_at timestamp with time zone DEFAULT now(),
    confidence numeric DEFAULT 0.7,
    CONSTRAINT brain_seasons_crowd_level_check CHECK ((crowd_level = ANY (ARRAY['very_high'::text, 'high'::text, 'moderate'::text, 'low'::text, 'very_low'::text, 'unknown'::text]))),
    CONSTRAINT brain_seasons_month_end_check CHECK (((month_end >= 1) AND (month_end <= 12))),
    CONSTRAINT brain_seasons_month_start_check CHECK (((month_start >= 1) AND (month_start <= 12))),
    CONSTRAINT brain_seasons_season_kind_check CHECK ((season_kind = ANY (ARRAY['dry'::text, 'wet'::text, 'peak_tourist'::text, 'off_peak'::text, 'shoulder'::text, 'festival'::text, 'religious'::text, 'custom'::text])))
);


--
-- Name: brain_transport; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_transport (
    transport_id uuid DEFAULT gen_random_uuid() NOT NULL,
    origin_location_slug text NOT NULL,
    dest_location_slug text NOT NULL,
    mode text NOT NULL,
    origin_airport_iata text,
    dest_airport_iata text,
    operators jsonb,
    duration_minutes integer,
    distance_km numeric,
    frequency_note text,
    price_range_idr jsonb,
    source text,
    source_reference text,
    source_licence_terms text,
    first_discovered_at timestamp with time zone DEFAULT now(),
    last_verified_at timestamp with time zone DEFAULT now(),
    confidence numeric DEFAULT 0.7,
    CONSTRAINT brain_transport_mode_check CHECK ((mode = ANY (ARRAY['flight'::text, 'train'::text, 'ferry'::text, 'bus'::text, 'drive'::text, 'walk'::text])))
);


--
-- Name: brain_traveler_rating; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_traveler_rating (
    rating_id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_kind text NOT NULL,
    entity_ref text NOT NULL,
    rating_scale numeric NOT NULL,
    rating_value numeric NOT NULL,
    review_count integer,
    positive_sentiment text,
    negative_sentiment text,
    source text NOT NULL,
    source_reference text,
    source_licence_terms text,
    sampled_at timestamp with time zone DEFAULT now(),
    confidence numeric DEFAULT 0.5,
    CONSTRAINT brain_traveler_rating_entity_kind_check CHECK ((entity_kind = ANY (ARRAY['location'::text, 'attraction'::text, 'activity_spot'::text])))
);


--
-- Name: brain_user_saved_facts; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.brain_user_saved_facts (
    save_id uuid DEFAULT gen_random_uuid() NOT NULL,
    learner_ref text NOT NULL,
    fact_id uuid NOT NULL,
    saved_at timestamp with time zone DEFAULT now() NOT NULL,
    seen_count integer DEFAULT 1 NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: business_calling_config; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.business_calling_config (
    config_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_table text NOT NULL,
    business_ref text NOT NULL,
    voice_enabled boolean DEFAULT false NOT NULL,
    video_enabled boolean DEFAULT false NOT NULL,
    hours jsonb,
    timezone text DEFAULT 'Asia/Jakarta'::text,
    consent_at timestamp with time zone,
    consent_by text,
    blocked_callers text[] DEFAULT '{}'::text[],
    auto_reply_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_calling_config_business_table_check CHECK ((business_table = ANY (ARRAY['nex.food_business'::text, 'nex.accommodation_business'::text, 'nex.service_business'::text, 'nex.mp_seller'::text])))
);


--
-- Name: TABLE business_calling_config; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.business_calling_config IS 'Per-business calling enablement · voice/video flags · hours · consent · blocked callers. Discovery walkers NEVER populate this. Businesses opt in via claim + self-serve settings. Read by the calling gate service before allowing a marketplace-to-business call.';


--
-- Name: business_image; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.business_image (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_type text NOT NULL,
    business_country text NOT NULL,
    business_ref text NOT NULL,
    image_type text NOT NULL,
    url text NOT NULL,
    source text NOT NULL,
    provenance jsonb,
    confidence numeric,
    cycle_run_id uuid,
    fallback_category text,
    owner_approved boolean DEFAULT false NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_image_business_country_check CHECK ((business_country ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT business_image_confidence_check CHECK (((confidence IS NULL) OR ((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))),
    CONSTRAINT business_image_image_type_check CHECK ((image_type = ANY (ARRAY['OWNER_IMAGE'::text, 'VERIFIED_REAL'::text, 'CATEGORY_FALLBACK'::text])))
);


--
-- Name: TABLE business_image; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.business_image IS 'Universal Directory Image storage · polymorphic across every NEX vertical · country-scoped identity · doctrine: project_nex_universal_directory_image_doctrine_2026_08_22';


--
-- Name: COLUMN business_image.business_type; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_image.business_type IS 'Polymorphic vertical id · food | accommodation | rentals | services | trades | future';


--
-- Name: COLUMN business_image.business_country; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_image.business_country IS 'ISO 3166-1 alpha-2 · e.g. ID · GB · US · foundational per country-three-layer doctrine (Q6 RESOLVED 2026-08-22)';


--
-- Name: COLUMN business_image.business_ref; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_image.business_ref IS 'Vertical-native business reference · e.g. food_business.public_listing_ref';


--
-- Name: COLUMN business_image.image_type; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_image.image_type IS 'Universal Image Doctrine · one of OWNER_IMAGE > VERIFIED_REAL > CATEGORY_FALLBACK · fallback NEVER represents the specific business';


--
-- Name: COLUMN business_image.confidence; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_image.confidence IS 'Walker/discovery confidence 0-1 · required ≥0.95 for VERIFIED_REAL auto-publish per doctrine';


--
-- Name: COLUMN business_image.cycle_run_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_image.cycle_run_id IS 'Direct-Provenance A · Walker cycle that discovered VERIFIED_REAL rows · NULL for OWNER_IMAGE and CATEGORY_FALLBACK';


--
-- Name: COLUMN business_image.fallback_category; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_image.fallback_category IS 'Canonical category_id from Category Registry · NON-NULL only when image_type=CATEGORY_FALLBACK';


--
-- Name: COLUMN business_image.owner_approved; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_image.owner_approved IS 'Owner has signed off on this specific image (relevant to OWNER_IMAGE rows)';


--
-- Name: COLUMN business_image.approved; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_image.approved IS 'System approval to render publicly · Universal Image Doctrine · never bypass';


--
-- Name: business_knowledge; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.business_knowledge (
    knowledge_id uuid DEFAULT gen_random_uuid() NOT NULL,
    vertical text NOT NULL,
    business_ref text NOT NULL,
    attribute_domain nex.bko_attribute_domain NOT NULL,
    attribute_key text NOT NULL,
    source text NOT NULL,
    source_reference text,
    source_tier nex.bko_source_tier NOT NULL,
    claim jsonb NOT NULL,
    interpretation text,
    unknown_note text,
    confidence numeric,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    freshness_valid_until timestamp with time zone,
    provenance jsonb DEFAULT '{}'::jsonb NOT NULL,
    snapshot_id uuid,
    cycle_run_id uuid,
    superseded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_knowledge_vertical_check CHECK ((vertical = ANY (ARRAY['food'::text, 'accommodation'::text])))
);


--
-- Name: TABLE business_knowledge; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.business_knowledge IS 'Polymorphic evidence overlay. Each row = one piece of evidence about one attribute of one business. Rows carry SOURCE→CLAIM→INTERPRETATION→UNKNOWN. Never rewritten · superseded via superseded_by. Not read by any ranking scorer.';


--
-- Name: COLUMN business_knowledge.source_tier; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_knowledge.source_tier IS 'Immutable per row. VERIFIED = authoritative source. OBSERVED = machine observation. OWNER_CLAIM = owner-stated. INFERRED = NEX derivation (chain in provenance). UNKNOWN = absence-of-evidence.';


--
-- Name: COLUMN business_knowledge.interpretation; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_knowledge.interpretation IS 'The honest sentence NEX is ALLOWED to say using this specific evidence. Never invent a stronger claim.';


--
-- Name: COLUMN business_knowledge.unknown_note; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.business_knowledge.unknown_note IS 'What this evidence does NOT permit NEX to conclude. Example: changing_table=yes permits "has a changing table" · does NOT permit "family safe".';


--
-- Name: call_record; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.call_record (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    caller_user_id text NOT NULL,
    callee_user_id text NOT NULL,
    caller_display_name text,
    callee_display_name text,
    media_type text DEFAULT 'voice'::text NOT NULL,
    direction text DEFAULT 'outbound'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    connected_at timestamp with time zone,
    ended_at timestamp with time zone,
    duration_sec integer,
    end_reason text DEFAULT 'ended'::text NOT NULL,
    path text DEFAULT 'unknown'::text NOT NULL,
    quality_median_rtt_ms integer,
    quality_median_jitter_ms integer,
    quality_packets_lost integer,
    bytes_sent bigint,
    bytes_received bigint,
    audio_codec text,
    video_codec text,
    video_resolution text,
    client_call_id text,
    CONSTRAINT call_record_direction_check CHECK ((direction = ANY (ARRAY['outbound'::text, 'inbound'::text]))),
    CONSTRAINT call_record_end_reason_check CHECK ((end_reason = ANY (ARRAY['completed'::text, 'missed'::text, 'declined'::text, 'busy'::text, 'failed'::text, 'ended'::text]))),
    CONSTRAINT call_record_media_type_check CHECK ((media_type = ANY (ARRAY['voice'::text, 'video'::text]))),
    CONSTRAINT call_record_path_check CHECK ((path = ANY (ARRAY['p2p'::text, 'srflx'::text, 'relay'::text, 'unknown'::text])))
);


--
-- Name: TABLE call_record; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.call_record IS 'NEX Internal Calling · one row per call between two NEX identities. Written by /api/nex-calling/call-record on call end. Path column is the core evidence for Stage 2/3 infrastructure decisions (relay share proves TURN necessity). Philip 2026-08-27.';


--
-- Name: COLUMN call_record.caller_user_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.call_record.caller_user_id IS 'Pure-NEX identity string · not a Supabase auth UUID · Philip 2026-08-27. Opaque string · what the signalling server uses to route messages.';


--
-- Name: COLUMN call_record.callee_user_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.call_record.callee_user_id IS 'Pure-NEX identity string · not a Supabase auth UUID · Philip 2026-08-27.';


--
-- Name: campaign_recipients; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.campaign_recipients (
    campaign_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    email text NOT NULL,
    country text,
    variables jsonb DEFAULT '{}'::jsonb NOT NULL,
    send_status text DEFAULT 'pending'::text NOT NULL,
    suppressed_reason text,
    attempts integer DEFAULT 0 NOT NULL,
    scheduled_for timestamp with time zone,
    sent_at timestamp with time zone,
    failed_at timestamp with time zone,
    provider text,
    provider_message_id text,
    latency_ms integer,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_recipients_send_status_check CHECK ((send_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'suppressed'::text, 'skipped_window'::text])))
);


--
-- Name: TABLE campaign_recipients; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.campaign_recipients IS 'Immutable per-campaign recipient snapshot · written at expansion · never mutated after send';


--
-- Name: campaign_segments; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.campaign_segments (
    campaign_id uuid NOT NULL,
    segment_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE campaign_segments; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.campaign_segments IS 'Junction · one campaign targets one or more saved audiences';


--
-- Name: campaigns; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.campaigns (
    campaign_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    campaign_type text DEFAULT 'marketing'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    subject text,
    preview_text text,
    body_html text,
    body_text text,
    sender_name text,
    sender_from text,
    sender_reply_to text,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    last_preview_at timestamp with time zone,
    last_preview jsonb,
    send_stats jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    body_blocks jsonb,
    template_id uuid,
    CONSTRAINT campaigns_campaign_type_check CHECK ((campaign_type = ANY (ARRAY['marketing'::text, 'transactional'::text, 'announcement'::text, 'newsletter'::text]))),
    CONSTRAINT campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready_for_review'::text, 'approved'::text, 'scheduled'::text, 'sending'::text, 'paused'::text, 'completed'::text, 'cancelled'::text, 'archived'::text])))
);


--
-- Name: TABLE campaigns; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.campaigns IS 'Orchestrates a delivery · stores REFERENCES to segments · never a contact list';


--
-- Name: COLUMN campaigns.status; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.campaigns.status IS 'Lifecycle: draft → ready_for_review → approved → scheduled → sending → completed · paused/cancelled/archived as side branches';


--
-- Name: COLUMN campaigns.body_blocks; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.campaigns.body_blocks IS 'Source of truth for the composer · re-rendered to body_html on every edit';


--
-- Name: COLUMN campaigns.template_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.campaigns.template_id IS 'Origin template · NULL for from-scratch composition';


--
-- Name: category_candidate; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.category_candidate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposed_category_id text NOT NULL,
    proposed_name text NOT NULL,
    display_name_en text NOT NULL,
    display_name_id text,
    suggested_parent_vertical text NOT NULL,
    brain_keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
    suggested_countries text[] NOT NULL,
    business_count integer NOT NULL,
    cycle_count integer NOT NULL,
    confidence numeric(4,3) NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    discovered_businesses jsonb DEFAULT '[]'::jsonb NOT NULL,
    image_candidates jsonb DEFAULT '[]'::jsonb NOT NULL,
    image_candidates_note text DEFAULT 'Evidence only. MUST NOT become live business images without going through the Universal Image resolver acceptance thresholds.'::text NOT NULL,
    proposed_by text NOT NULL,
    proposed_cycle_run_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_decision text DEFAULT 'pending'::text NOT NULL,
    admin_reviewed_at timestamp with time zone,
    admin_reviewed_by text,
    admin_notes text,
    duplicate_of_registry_id text,
    superseded_by_candidate_id uuid,
    CONSTRAINT category_candidate_admin_decision_check CHECK ((admin_decision = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'duplicate'::text, 'superseded'::text]))),
    CONSTRAINT category_candidate_brain_keywords_check CHECK ((jsonb_typeof(brain_keywords) = 'array'::text)),
    CONSTRAINT category_candidate_business_count_check CHECK ((business_count >= 50)),
    CONSTRAINT category_candidate_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT category_candidate_cycle_count_check CHECK ((cycle_count >= 2)),
    CONSTRAINT category_candidate_decision_consistency CHECK ((((admin_decision = 'pending'::text) AND (admin_reviewed_at IS NULL) AND (admin_reviewed_by IS NULL)) OR ((admin_decision <> 'pending'::text) AND (admin_reviewed_at IS NOT NULL) AND (admin_reviewed_by IS NOT NULL)))),
    CONSTRAINT category_candidate_discovered_businesses_check CHECK ((jsonb_typeof(discovered_businesses) = 'array'::text)),
    CONSTRAINT category_candidate_image_candidates_check CHECK ((jsonb_typeof(image_candidates) = 'array'::text)),
    CONSTRAINT category_candidate_proposed_category_id_check CHECK ((proposed_category_id ~ '^[a-z][a-z0-9-]*$'::text)),
    CONSTRAINT category_candidate_suggested_countries_check CHECK (((array_length(suggested_countries, 1) >= 1) AND (suggested_countries <@ ARRAY['ID'::text, 'GB'::text, 'US'::text, 'MY'::text, 'SG'::text, 'TH'::text, 'VN'::text, 'PH'::text, 'AU'::text, 'NZ'::text]))),
    CONSTRAINT category_candidate_suggested_parent_vertical_check CHECK ((suggested_parent_vertical = ANY (ARRAY['food'::text, 'accommodation'::text, 'rentals'::text, 'services'::text, 'tourism'::text])))
);


--
-- Name: category_candidate_calibration_annotation; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.category_candidate_calibration_annotation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    annotator text NOT NULL,
    verdict text NOT NULL,
    reason text,
    annotated_at timestamp with time zone DEFAULT now() NOT NULL,
    against_score_id uuid,
    candidate_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT category_candidate_calibration_annotation_verdict_check CHECK ((verdict = ANY (ARRAY['HIGH'::text, 'MEDIUM'::text, 'LOW'::text, 'SKIP'::text])))
);


--
-- Name: category_candidate_score; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.category_candidate_score (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    computed_by text NOT NULL,
    scorer_version text NOT NULL,
    quality_score numeric(5,4) NOT NULL,
    safety_score numeric(5,4) NOT NULL,
    provisional_tier text NOT NULL,
    primary_hazard text,
    signals jsonb DEFAULT '{}'::jsonb NOT NULL,
    quality_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    safety_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT category_candidate_score_provisional_tier_check CHECK ((provisional_tier = ANY (ARRAY['HIGH'::text, 'MEDIUM'::text, 'LOW'::text]))),
    CONSTRAINT category_candidate_score_quality_score_check CHECK (((quality_score >= (0)::numeric) AND (quality_score <= (1)::numeric))),
    CONSTRAINT category_candidate_score_safety_score_check CHECK (((safety_score >= (0)::numeric) AND (safety_score <= (1)::numeric)))
);


--
-- Name: category_image_library; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.category_image_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_slug text NOT NULL,
    variant_tag text,
    url text NOT NULL,
    attribution text,
    licence text,
    intrinsic_width integer,
    intrinsic_height integer,
    priority integer DEFAULT 100 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    notes text,
    added_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT category_image_library_category_valid CHECK ((category_slug ~ '^([a-z][a-z0-9-]*|\*)$'::text)),
    CONSTRAINT category_image_library_variant_valid CHECK (((variant_tag IS NULL) OR (variant_tag ~ '^[a-z][a-z0-9-]*$'::text)))
);


--
-- Name: TABLE category_image_library; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.category_image_library IS 'Curated per-category fallback images · NEX resolver picks the best match when a business has no OWNER_IMAGE or VERIFIED_REAL. Philip 2026-08-27 (E) · replaces per-business image generation with a small curated library.';


--
-- Name: category_registry; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.category_registry (
    id text NOT NULL,
    parent_vertical text NOT NULL,
    display_name_en text NOT NULL,
    display_name_id text NOT NULL,
    icon text,
    visual_glyph text NOT NULL,
    visual_family text,
    route text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    brain_keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
    countries text[] NOT NULL,
    business_table text,
    category_filter text,
    schema_version text DEFAULT 'v1'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    activated_at timestamp with time zone,
    activated_by text,
    origin_candidate_id uuid,
    CONSTRAINT category_registry_brain_keywords_check CHECK ((jsonb_typeof(brain_keywords) = 'array'::text)),
    CONSTRAINT category_registry_countries_check CHECK (((array_length(countries, 1) >= 1) AND (countries <@ ARRAY['ID'::text, 'GB'::text, 'US'::text, 'MY'::text, 'SG'::text, 'TH'::text, 'VN'::text, 'PH'::text, 'AU'::text, 'NZ'::text]))),
    CONSTRAINT category_registry_id_check CHECK ((id ~ '^[a-z][a-z0-9-]*$'::text)),
    CONSTRAINT category_registry_parent_vertical_check CHECK ((parent_vertical = ANY (ARRAY['food'::text, 'accommodation'::text, 'rentals'::text, 'services'::text, 'tourism'::text]))),
    CONSTRAINT category_registry_route_check CHECK ((route ~ '^/[a-zA-Z][a-zA-Z0-9?=+&/_.:%-]*$'::text))
);


--
-- Name: chat_message; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.chat_message (
    message_id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id text NOT NULL,
    sender_id text NOT NULL,
    sender_display_name text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_user_id text,
    deletion_reason text,
    CONSTRAINT chat_message_deletion_reason_check CHECK ((deletion_reason = ANY (ARRAY[NULL::text, 'grenade'::text, 'user-edit'::text, 'admin'::text])))
);


--
-- Name: chat_message_archive; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.chat_message_archive (
    archive_id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    original_message_id uuid NOT NULL,
    conversation_id text NOT NULL,
    original_sender_id text NOT NULL,
    original_sender_display_name text NOT NULL,
    original_content text NOT NULL,
    original_created_at timestamp with time zone NOT NULL,
    archived_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_message_deletion; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.chat_message_deletion (
    deletion_id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    conversation_id text NOT NULL,
    actor_user_id text NOT NULL,
    actor_display_name text NOT NULL,
    actor_action text NOT NULL,
    wallet_transaction_id uuid,
    history_line text NOT NULL,
    event_time timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_message_deletion_actor_action_check CHECK ((actor_action = ANY (ARRAY['grenade'::text, 'user-edit'::text, 'admin'::text])))
);


--
-- Name: compliance_events; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.compliance_events (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    event_type text NOT NULL,
    old_state text,
    new_state text,
    reason text,
    source text NOT NULL,
    provider text,
    provider_message_id text,
    campaign_id uuid,
    actor text,
    analytics_event_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_events_event_type_check CHECK ((event_type = ANY (ARRAY['hard_bounce_received'::text, 'soft_bounce_received'::text, 'complaint_received'::text, 'unsubscribed'::text, 'suppressed_soft_threshold'::text, 'manual_suppressed'::text, 'reinstated'::text, 'delivered_reset_soft_streak'::text])))
);


--
-- Name: TABLE compliance_events; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.compliance_events IS 'Immutable audit trail · every automatic and manual compliance action · never mutated after insert';


--
-- Name: confidence_scores; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.confidence_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    record_id text NOT NULL,
    claim_key text NOT NULL,
    claim_text text NOT NULL,
    classification text NOT NULL,
    confidence_band text NOT NULL,
    confidence_score real,
    source_type text,
    source_ref text,
    verification_date date,
    rationale text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT confidence_scores_classification_check CHECK ((classification = ANY (ARRAY['established_practice'::text, 'industry_consensus'::text, 'design_opinion'::text, 'experimental_concept'::text, 'NEX_concept'::text]))),
    CONSTRAINT confidence_scores_confidence_band_check CHECK ((confidence_band = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT confidence_scores_confidence_score_check CHECK (((confidence_score >= (0)::double precision) AND (confidence_score <= (1)::double precision)))
);


--
-- Name: contact_duplicate_suggestions; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.contact_duplicate_suggestions (
    suggestion_id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_a text NOT NULL,
    contact_b text NOT NULL,
    match_kind text NOT NULL,
    confidence numeric(5,2),
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    decided_by text,
    decision text,
    merge_id uuid,
    CONSTRAINT contact_dup_ordered CHECK ((contact_a < contact_b))
);


--
-- Name: TABLE contact_duplicate_suggestions; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.contact_duplicate_suggestions IS 'Contact Intelligence · dedup queue · admin approves';


--
-- Name: contact_merges; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.contact_merges (
    merge_id uuid DEFAULT gen_random_uuid() NOT NULL,
    surviving_contact_id text NOT NULL,
    absorbed_contact_id text NOT NULL,
    decided_by text,
    decided_at timestamp with time zone DEFAULT now() NOT NULL,
    rationale text,
    match_signals jsonb DEFAULT '{}'::jsonb NOT NULL,
    reversed_at timestamp with time zone,
    reversed_by text
);


--
-- Name: TABLE contact_merges; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.contact_merges IS 'Contact Intelligence · merge audit · absorbed → surviving';


--
-- Name: contact_segments; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.contact_segments (
    segment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    filter jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    used_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp with time zone,
    archived_at timestamp with time zone
);


--
-- Name: TABLE contact_segments; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.contact_segments IS 'Named audience filters · every campaign starts from a segment · filter is a JSON specification (never a copy of contacts)';


--
-- Name: contact_sources; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.contact_sources (
    source_row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id text NOT NULL,
    source_type text NOT NULL,
    source_ref text,
    source_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    observed_at timestamp with time zone DEFAULT now() NOT NULL,
    business_id uuid,
    sync_status text DEFAULT 'ok'::text NOT NULL,
    sync_error text,
    synchronised_at timestamp with time zone
);


--
-- Name: TABLE contact_sources; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.contact_sources IS 'Contact Intelligence · append-only source history';


--
-- Name: contacts; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.contacts (
    snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id text NOT NULL,
    email text,
    phone text,
    name text,
    kind text,
    source text,
    source_ref text,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    consent_marketing boolean,
    consent_transactional boolean,
    consent_source text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    lifecycle_stage text,
    first_seen_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    linked_business_id uuid,
    updated_at timestamp with time zone NOT NULL,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL,
    company text,
    country text,
    region text,
    languages jsonb DEFAULT '[]'::jsonb NOT NULL,
    trade_categories jsonb DEFAULT '[]'::jsonb NOT NULL,
    preferred_channels jsonb DEFAULT '[]'::jsonb NOT NULL,
    never_contact boolean DEFAULT false NOT NULL,
    unsubscribe_at timestamp with time zone,
    last_contacted_at timestamp with time zone,
    canonical_email text,
    canonical_phone text,
    deleted_at timestamp with time zone,
    compliance_state text DEFAULT 'allowed'::text NOT NULL,
    compliance_reason text,
    compliance_source text,
    compliance_updated_at timestamp with time zone,
    soft_bounce_count integer DEFAULT 0 NOT NULL,
    soft_bounce_last_at timestamp with time zone,
    last_provider_message_id text,
    CONSTRAINT contacts_compliance_state_check CHECK ((compliance_state = ANY (ARRAY['allowed'::text, 'suppressed_soft'::text, 'suppressed_hard'::text, 'unsubscribed'::text, 'complaint'::text, 'manual_block'::text])))
);


--
-- Name: TABLE contacts; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.contacts IS 'Infrastructure Runtime §5.4 · Master Contact DB snapshots · retention forever';


--
-- Name: COLUMN contacts.compliance_state; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.contacts.compliance_state IS 'Structured compliance state · authoritative · updated ONLY by the Compliance Engine';


--
-- Name: COLUMN contacts.compliance_reason; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.contacts.compliance_reason IS 'Human-readable reason for current state · e.g. "hard bounce · SES · Permanent/General"';


--
-- Name: COLUMN contacts.compliance_source; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.contacts.compliance_source IS 'Which subsystem last updated compliance · provider webhook / manual_admin / expansion_check';


--
-- Name: contradictions; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.contradictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    record_a_id text NOT NULL,
    record_b_id text NOT NULL,
    claim_key_a text NOT NULL,
    claim_key_b text NOT NULL,
    contradiction_summary text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    resolved_by text,
    resolution_notes text,
    resolved_at timestamp with time zone,
    detected_by text DEFAULT 'memory-guardian'::text NOT NULL,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contradictions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'irrelevant'::text])))
);


--
-- Name: conv_edges; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.conv_edges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_item uuid NOT NULL,
    to_item uuid NOT NULL,
    edge_type text NOT NULL,
    weight numeric(4,3) NOT NULL,
    evidence_count integer DEFAULT 1 NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conv_edges_evidence_positive CHECK ((evidence_count >= 1)),
    CONSTRAINT conv_edges_no_self_loops CHECK ((from_item <> to_item)),
    CONSTRAINT conv_edges_type_check CHECK ((edge_type = ANY (ARRAY['answers'::text, 'clarifies'::text, 'follows_from'::text, 'corrects'::text, 'contradicts'::text, 'elaborates'::text, 'alternative_of'::text, 'comparison_to'::text, 'prices'::text, 'requires'::text, 'recommends'::text, 'warns_about'::text, 'related_to'::text]))),
    CONSTRAINT conv_edges_weight_gate CHECK ((weight >= 0.50)),
    CONSTRAINT conv_edges_weight_range CHECK (((weight >= (0)::numeric) AND (weight <= (1)::numeric)))
);


--
-- Name: TABLE conv_edges; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.conv_edges IS 'Typed conversation-graph edges. Weight is re-scored nightly from feedback outcomes.';


--
-- Name: COLUMN conv_edges.weight; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.conv_edges.weight IS 'ADR-0044 §1: >=0.85 strong · 0.70-0.84 candidate · 0.50-0.69 graph-link only.';


--
-- Name: conv_entities; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.conv_entities (
    slug text NOT NULL,
    display_name text NOT NULL,
    brain text NOT NULL,
    entity_class text NOT NULL,
    aliases text[] DEFAULT '{}'::text[] NOT NULL,
    embedding jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conv_entities_entity_class_check CHECK ((entity_class = ANY (ARRAY['material'::text, 'component'::text, 'style'::text, 'regulation'::text, 'service'::text, 'price_dimension'::text, 'person'::text, 'company'::text, 'process'::text, 'location'::text, 'other'::text])))
);


--
-- Name: TABLE conv_entities; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.conv_entities IS 'Ontology nodes. Every conv_knowledge_items.entities[] value is a slug here.';


--
-- Name: conv_feedback; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.conv_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turn_id uuid NOT NULL,
    signal text NOT NULL,
    source text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conv_feedback_signal_check CHECK ((signal = ANY (ARRAY['helpful'::text, 'not_helpful'::text, 'irrelevant'::text, 'wrong'::text, 'clarified'::text, 'corrected'::text, 'gave_up'::text, 'followed_recommendation'::text, 'asked_same_again'::text]))),
    CONSTRAINT conv_feedback_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'implicit_next_turn'::text, 'labelled'::text])))
);


--
-- Name: TABLE conv_feedback; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.conv_feedback IS 'Signal atoms consumed by nightly re-scoring. Explicit signals + implicit inferences.';


--
-- Name: conv_intents; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.conv_intents (
    slug text NOT NULL,
    display_name text NOT NULL,
    class text NOT NULL,
    example_phrases text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conv_intents_class_check CHECK ((class = ANY (ARRAY['discover'::text, 'specify'::text, 'compare'::text, 'price'::text, 'decide'::text, 'clarify'::text, 'correct'::text, 'object'::text, 'confirm'::text, 'revisit'::text, 'close'::text])))
);


--
-- Name: TABLE conv_intents; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.conv_intents IS 'Canonical user-intent taxonomy. Seeded from intent-patterns.md by the ingestion pipeline.';


--
-- Name: COLUMN conv_intents.class; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.conv_intents.class IS 'Broad intent class; see ADR-0044 §1.';


--
-- Name: conv_knowledge_items; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.conv_knowledge_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brain text NOT NULL,
    source_batch text NOT NULL,
    source_ref text,
    kind text NOT NULL,
    question_text text,
    answer_text text,
    canonical_intent text NOT NULL,
    entities text[] DEFAULT '{}'::text[] NOT NULL,
    topics text[] DEFAULT '{}'::text[] NOT NULL,
    confidence numeric(4,3) NOT NULL,
    draft_only boolean DEFAULT false NOT NULL,
    embedding jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conv_ki_confidence_gate CHECK ((confidence >= 0.50)),
    CONSTRAINT conv_ki_confidence_range CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT conv_ki_has_body CHECK (((question_text IS NOT NULL) OR (answer_text IS NOT NULL))),
    CONSTRAINT conv_ki_kind_check CHECK ((kind = ANY (ARRAY['qa_pair'::text, 'statement'::text, 'clarification'::text, 'correction'::text, 'recommendation'::text])))
);


--
-- Name: TABLE conv_knowledge_items; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.conv_knowledge_items IS 'One atomic Q+A pair or authoritative statement. Node in the conversation graph.';


--
-- Name: COLUMN conv_knowledge_items.brain; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.conv_knowledge_items.brain IS 'Brain isolation (ADR-0033 rule #4). Retrieval MUST filter by this.';


--
-- Name: COLUMN conv_knowledge_items.draft_only; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.conv_knowledge_items.draft_only IS 'ADR-0033 gate: confidence 0.50-0.69 items are draft-only and filtered from live retrieval until admin promotes.';


--
-- Name: conv_learning_candidate; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.conv_learning_candidate (
    candidate_id uuid DEFAULT gen_random_uuid() NOT NULL,
    cycle_run_id uuid NOT NULL,
    from_turn_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    language text DEFAULT 'unknown'::text NOT NULL,
    brain text NOT NULL,
    candidate_kind text NOT NULL,
    candidate_payload jsonb NOT NULL,
    score numeric(4,3) DEFAULT 0 NOT NULL,
    score_components jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending_review'::text NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by text,
    rejection_reason text,
    promotion_target_record_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conv_learning_candidate_candidate_kind_check CHECK ((candidate_kind = ANY (ARRAY['add_clarification_ki'::text, 'add_intent_example'::text, 'add_entity_alias'::text, 'add_edge_correction'::text]))),
    CONSTRAINT conv_learning_candidate_score_check CHECK (((score >= (0)::numeric) AND (score <= (1)::numeric))),
    CONSTRAINT conv_learning_candidate_status_check CHECK ((status = ANY (ARRAY['pending_review'::text, 'promoted'::text, 'rejected'::text])))
);


--
-- Name: TABLE conv_learning_candidate; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.conv_learning_candidate IS 'CLE candidate table (Task #76 Bundle B · 2026-08-22). Every row is a proposed learning · never AUTHORITATIVE. Direct-provenance link to cycle_run built in from birth. Status transitions pending_review → promoted|rejected via /api/nex/cle/promote-candidate admin-only route. EN + ID identical gates. Constitutional boundary: conversation does NOT auto-teach NEX.';


--
-- Name: COLUMN conv_learning_candidate.cycle_run_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.conv_learning_candidate.cycle_run_id IS 'Direct causality FK to nex.worker_cycle_run.id · six-criteria output criterion JOINs here.';


--
-- Name: COLUMN conv_learning_candidate.language; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.conv_learning_candidate.language IS 'EN · ID · or "unknown". Metadata only · does NOT modify trust or gate.';


--
-- Name: COLUMN conv_learning_candidate.status; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.conv_learning_candidate.status IS 'Promotion gate. pending_review (default · awaits admin) · promoted (admin approved · knowledge_record created · FK in promotion_target_record_id) · rejected (admin declined · rejection_reason recorded). Never auto-promoted.';


--
-- Name: conv_outcomes; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.conv_outcomes (
    conversation_id uuid NOT NULL,
    outcome text NOT NULL,
    outcome_note text,
    labelled_by text NOT NULL,
    labelled_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conv_outcomes_labelled_by_check CHECK ((labelled_by = ANY (ARRAY['auto'::text, 'owner'::text, 'admin'::text]))),
    CONSTRAINT conv_outcomes_outcome_check CHECK ((outcome = ANY (ARRAY['resolved'::text, 'clarification_completed'::text, 'correction_received'::text, 'user_abandoned'::text, 'repeated_question'::text, 'escalated'::text, 'pending'::text])))
);


--
-- Name: TABLE conv_outcomes; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.conv_outcomes IS 'End-of-conversation label. Feeds the nightly edge re-scoring job.';


--
-- Name: conv_states; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.conv_states (
    conversation_id uuid NOT NULL,
    business_id uuid,
    brain text NOT NULL,
    state jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE conv_states; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.conv_states IS 'Per-session structured state. Schema: see ADR-0044 proposal §5. Read+written every turn.';


--
-- Name: conv_turns; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.conv_turns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    turn_index integer NOT NULL,
    speaker text NOT NULL,
    text text NOT NULL,
    detected_intent text,
    detected_entities text[] DEFAULT '{}'::text[] NOT NULL,
    used_item_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    walked_edge_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    latency_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cle_processed_at timestamp with time zone,
    cle_cycle_run_id uuid,
    CONSTRAINT conv_turns_latency_nonneg CHECK (((latency_ms IS NULL) OR (latency_ms >= 0))),
    CONSTRAINT conv_turns_speaker_check CHECK ((speaker = ANY (ARRAY['customer'::text, 'owner'::text, 'nex'::text]))),
    CONSTRAINT conv_turns_turn_index_positive CHECK ((turn_index >= 0))
);


--
-- Name: TABLE conv_turns; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.conv_turns IS 'Append-only per-turn log. Full transcripts live here; the state row carries the summary.';


--
-- Name: COLUMN conv_turns.cle_processed_at; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.conv_turns.cle_processed_at IS 'When the CLE worker observed this turn (Task #76 Bundle B · 2026-08-22). NULL = still in the CLE input queue. Six-criteria input criterion counts NULLs.';


--
-- Name: COLUMN conv_turns.cle_cycle_run_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.conv_turns.cle_cycle_run_id IS 'FK to nex.worker_cycle_run.id · which CLE cycle consumed this turn. Direct causality link · six-criteria state criterion JOINs here rather than inferring via timestamps.';


--
-- Name: conversion_events; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.conversion_events (
    conversion_id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    event_type text NOT NULL,
    conversion_value numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'GBP'::text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    window_days integer DEFAULT 30 NOT NULL,
    source text DEFAULT 'webhook'::text NOT NULL,
    correlation_id text,
    external_ref text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversion_events_source_check CHECK ((source = ANY (ARRAY['webhook'::text, 'internal'::text, 'manual'::text, 'import'::text])))
);


--
-- Name: TABLE conversion_events; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.conversion_events IS 'Business conversions · one row per outcome (quote/deposit/install/final) · UNIQUE(source, external_ref) for webhook idempotency';


--
-- Name: cost_budget; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.cost_budget (
    branch text NOT NULL,
    daily_cap_usd numeric(10,4) NOT NULL,
    spent_today_usd numeric(10,6) DEFAULT 0 NOT NULL,
    last_reset_at timestamp with time zone DEFAULT now() NOT NULL,
    circuit_open_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE cost_budget; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.cost_budget IS 'NEX Discovery Fabric P8 · per-branch daily cost cap. Consumed by scripts/nex-worker/cost-oracle.mjs. checkBudget before calls, recordSpend after, resetDailyIfNeeded at cycle start. Cap can be raised operationally · never bypassed.';


--
-- Name: COLUMN cost_budget.daily_cap_usd; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.cost_budget.daily_cap_usd IS 'Hard daily ceiling. When spent_today_usd >= this, circuit_open_at is set and cost-oracle returns allowed=false for the rest of the day.';


--
-- Name: COLUMN cost_budget.spent_today_usd; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.cost_budget.spent_today_usd IS 'Rolling total for the current day. Reset by resetDailyIfNeeded at cycle start when last_reset_at is stale.';


--
-- Name: COLUMN cost_budget.circuit_open_at; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.cost_budget.circuit_open_at IS 'Timestamp when the daily cap was first breached today. Cleared when the daily reset runs. Read by cost-oracle to short-circuit further checks.';


--
-- Name: delivery_job_attempts; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.delivery_job_attempts (
    attempt_id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    attempt_no integer NOT NULL,
    worker_id text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    outcome text,
    latency_ms integer,
    error text,
    detail jsonb,
    CONSTRAINT delivery_job_attempts_outcome_check CHECK (((outcome = ANY (ARRAY['success'::text, 'transient_failure'::text, 'permanent_failure'::text, 'abandoned'::text])) OR (outcome IS NULL)))
);


--
-- Name: TABLE delivery_job_attempts; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.delivery_job_attempts IS 'Every worker attempt · success/transient_failure/permanent_failure/abandoned';


--
-- Name: delivery_jobs; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.delivery_jobs (
    job_id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    scheduled_for timestamp with time zone DEFAULT now() NOT NULL,
    campaign_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    result jsonb,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    lease_owner text,
    lease_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    last_error text,
    CONSTRAINT delivery_jobs_job_type_check CHECK ((job_type = ANY (ARRAY['campaign.expand'::text, 'campaign.send_batch'::text, 'campaign.finalise'::text]))),
    CONSTRAINT delivery_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'dead_letter'::text])))
);


--
-- Name: TABLE delivery_jobs; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.delivery_jobs IS 'Durable job queue for the Delivery Engine · resumable · leased via SELECT ... FOR UPDATE SKIP LOCKED';


--
-- Name: delivery_workers_archive_2026_08_22; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.delivery_workers_archive_2026_08_22 (
    worker_id text NOT NULL,
    hostname text,
    started_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    jobs_processed integer,
    jobs_failed integer,
    mode text,
    archived_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_reason text DEFAULT 'Task #75 Bundle A · migrated to canonical nex.worker_heartbeat 2026-08-22'::text NOT NULL
);


--
-- Name: TABLE delivery_workers_archive_2026_08_22; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.delivery_workers_archive_2026_08_22 IS 'Frozen snapshot of nex.delivery_workers prior to Task #75 Bundle A registry consolidation (2026-08-22). Historical delivery-worker heartbeats · replaced by canonical nex.worker_heartbeat. Never written to after archive.';


--
-- Name: deprecations; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.deprecations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    record_id text NOT NULL,
    superseded_by text,
    reason text NOT NULL,
    deprecated_by text NOT NULL,
    deprecated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: discovery_orchestrator_pick; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.discovery_orchestrator_pick (
    pick_id uuid DEFAULT gen_random_uuid() NOT NULL,
    city text NOT NULL,
    category text NOT NULL,
    picked_at timestamp with time zone DEFAULT now() NOT NULL,
    script text,
    note text,
    surface text
);


--
-- Name: discovery_rotation_state; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.discovery_rotation_state (
    rotation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    city text NOT NULL,
    category text NOT NULL,
    round integer DEFAULT 1 NOT NULL,
    state nex.discovery_rotation_state_kind DEFAULT 'build'::nex.discovery_rotation_state_kind NOT NULL,
    consecutive_zero_new_cycles integer DEFAULT 0 NOT NULL,
    total_records_last_cycle integer,
    records_new_last_cycle integer,
    last_cycle_started_at timestamp with time zone,
    last_productive_at timestamp with time zone,
    last_evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    state_entered_at timestamp with time zone DEFAULT now() NOT NULL,
    reactivation_reason text,
    next_action_hint text,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    surface text DEFAULT 'default'::text NOT NULL,
    cooldown_until timestamp with time zone,
    reactivation_count integer DEFAULT 0 NOT NULL,
    consecutive_unproductive_reactivations integer DEFAULT 0 NOT NULL,
    CONSTRAINT discovery_rotation_state_consecutive_zero_new_cycles_check CHECK ((consecutive_zero_new_cycles >= 0)),
    CONSTRAINT discovery_rotation_state_round_check CHECK ((round >= 1))
);


--
-- Name: TABLE discovery_rotation_state; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.discovery_rotation_state IS 'Central Discovery Rotation Controller state · one row per (city, category, round). Lifecycle: build → saturated → maintenance → reactivate → build. Populated by scripts/nex-discovery-rotation/_rotation-tick.mjs from live worker_cycle_run history · never manually inflated.';


--
-- Name: COLUMN discovery_rotation_state.consecutive_zero_new_cycles; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.discovery_rotation_state.consecutive_zero_new_cycles IS 'Count of consecutive cycles (most recent first) with records_new=0. Threshold for transition to SATURATED is defined in src/lib/nex-hq/discovery-rotation.ts · currently 3.';


--
-- Name: COLUMN discovery_rotation_state.reactivation_reason; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.discovery_rotation_state.reactivation_reason IS 'Free-text · e.g. "new_provider:facebook_public", "new_taxonomy_l3_sample", "walker_query_universe_v2". Set when transitioning maintenance/saturated → reactivate.';


--
-- Name: COLUMN discovery_rotation_state.cooldown_until; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.discovery_rotation_state.cooldown_until IS 'Reactivation policy 2026-08-26. When state=saturated, rotation-tick promotes to reactivate once cooldown_until < NOW(). Provider-refresh trigger sets this to NOW() for immediate reactivation. NULL = no cooldown set (rotation-tick backfills on next pass with reactivation_reason=cooldown-defaulted).';


--
-- Name: COLUMN discovery_rotation_state.reactivation_count; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.discovery_rotation_state.reactivation_count IS 'Number of times this surface has cycled through saturated→reactivate→build. Used for 2× cooldown backoff after 3 consecutive unproductive reactivations.';


--
-- Name: COLUMN discovery_rotation_state.consecutive_unproductive_reactivations; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.discovery_rotation_state.consecutive_unproductive_reactivations IS 'Number of consecutive reactivations that produced zero new records. Reset to 0 by any productive cycle. Rotation-tick uses this to double cooldown when >= 3 (Philip 2026-08-26).';


--
-- Name: provider_profile; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.provider_profile (
    provider_id uuid DEFAULT gen_random_uuid() NOT NULL,
    learner_ref text,
    full_name text NOT NULL,
    whatsapp_e164 text NOT NULL,
    photo_url text,
    bike_slug text NOT NULL,
    bike_year integer NOT NULL,
    bike_color_hex text NOT NULL,
    plate text NOT NULL,
    city text NOT NULL,
    status text DEFAULT 'pending_review'::text NOT NULL,
    rating_avg numeric(3,2),
    rating_count integer DEFAULT 0 NOT NULL,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    secondary_language text,
    provides_raincoat boolean DEFAULT false NOT NULL,
    price_per_service_idr integer,
    is_available boolean DEFAULT false NOT NULL,
    CONSTRAINT driver_profile_bike_color_hex_check CHECK ((bike_color_hex ~ '^#[0-9a-fA-F]{6}$'::text)),
    CONSTRAINT driver_profile_bike_year_check CHECK (((bike_year >= 1980) AND (bike_year <= 2030))),
    CONSTRAINT driver_profile_status_check CHECK ((status = ANY (ARRAY['pending_review'::text, 'active'::text, 'suspended'::text, 'removed'::text]))),
    CONSTRAINT provider_profile_price_per_service_idr_check CHECK (((price_per_service_idr IS NULL) OR (price_per_service_idr > 0)))
);


--
-- Name: TABLE provider_profile; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.provider_profile IS 'NEX Network providers · V1 eligibility = active + city + is_available · lock 33 · Philip 2026-08-29';


--
-- Name: COLUMN provider_profile.price_per_service_idr; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.provider_profile.price_per_service_idr IS 'Provider-set base price in IDR · displayed to user BEFORE request per doctrine lock 27 · NEX never premium-prices by category · Philip 2026-08-29';


--
-- Name: COLUMN provider_profile.is_available; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.provider_profile.is_available IS 'Manual toggle · provider turns on to receive broadcast requests · lock 34 · off by default · V1 eligibility uses this + city + status=active';


--
-- Name: driver_profile; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.driver_profile AS
 SELECT provider_id AS driver_id,
    learner_ref,
    full_name,
    whatsapp_e164,
    photo_url,
    bike_slug,
    bike_year,
    bike_color_hex,
    plate,
    city,
    status,
    is_available,
    price_per_service_idr,
    rating_avg,
    rating_count,
    registered_at,
    approved_at,
    updated_at,
    secondary_language,
    provides_raincoat
   FROM nex.provider_profile;


--
-- Name: VIEW driver_profile; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON VIEW nex.driver_profile IS 'DEPRECATED · compatibility only · new code writes nex.provider_profile directly · one-release migration window · Philip 2026-08-29 · mobility doctrine v5';


--
-- Name: email_templates; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.email_templates (
    template_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    description text,
    subject text,
    preview_text text,
    blocks jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_seed boolean DEFAULT false NOT NULL,
    is_draft boolean DEFAULT false NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    used_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp with time zone,
    archived_at timestamp with time zone,
    CONSTRAINT email_templates_category_check CHECK ((category = ANY (ARRAY['announcement'::text, 'newsletter'::text, 'feature_release'::text, 'welcome'::text, 'quote_followup'::text, 'reminder'::text, 'event'::text, 'seasonal'::text, 'other'::text])))
);


--
-- Name: TABLE email_templates; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.email_templates IS 'Reusable block-based email templates · seeded + user-created';


--
-- Name: events; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.events (
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    source text NOT NULL,
    actor_id text,
    "timestamp" timestamp with time zone NOT NULL,
    business_id uuid,
    related_department text,
    related_brain text,
    related_job text,
    related_contact text,
    outcome text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    reversible boolean DEFAULT false NOT NULL,
    reverse_of text,
    supersedes text,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE events; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.events IS 'Intelligence Event Bus · Infrastructure Runtime §5.1 · retention forever · audit truth';


--
-- Name: experiment_assignments; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.experiment_assignments (
    assignment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    experiment_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    variant_id text NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    computed_hash bigint NOT NULL
);


--
-- Name: TABLE experiment_assignments; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.experiment_assignments IS 'Sticky per (experiment_id, contact_id) · UNIQUE constraint enforces invariant #13';


--
-- Name: experiment_variants; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.experiment_variants (
    experiment_id uuid NOT NULL,
    variant_id text NOT NULL,
    name text,
    allocation_pct numeric(5,2) NOT NULL,
    target_node_id text,
    target_campaign_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT experiment_variants_allocation_pct_check CHECK (((allocation_pct > (0)::numeric) AND (allocation_pct <= (100)::numeric)))
);


--
-- Name: TABLE experiment_variants; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.experiment_variants IS 'Allocation must sum to 100 across variants of the same experiment (checked at activation)';


--
-- Name: experiments; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.experiments (
    experiment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    version integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    scope_type text DEFAULT 'journey_node'::text NOT NULL,
    scope_ref text,
    goal_event_type text DEFAULT 'clicked'::text NOT NULL,
    goal_within_seconds integer DEFAULT 604800 NOT NULL,
    seed bigint NOT NULL,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    activated_at timestamp with time zone,
    paused_at timestamp with time zone,
    ended_at timestamp with time zone,
    CONSTRAINT experiments_scope_type_check CHECK ((scope_type = ANY (ARRAY['journey_node'::text, 'campaign'::text]))),
    CONSTRAINT experiments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'ended'::text])))
);


--
-- Name: TABLE experiments; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.experiments IS 'Versioned experiment defs with immutable seed · one Active per slug · charter §12';


--
-- Name: food_business; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_business (
    internal_id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_listing_ref text NOT NULL,
    business_name text NOT NULL,
    category text NOT NULL,
    address text,
    city text DEFAULT 'Yogyakarta'::text NOT NULL,
    district text,
    coordinates_lng numeric(9,6),
    coordinates_lat numeric(8,6),
    phone text,
    whatsapp_number text,
    website text,
    public_social_links jsonb,
    opening_information jsonb,
    source text NOT NULL,
    source_reference text,
    source_ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    source_checked_at timestamp with time zone,
    source_licence_terms text,
    dedupe_hash text NOT NULL,
    claim_status public.nex_food_claim_status DEFAULT 'discovered'::public.nex_food_claim_status NOT NULL,
    owner_status public.nex_food_owner_status DEFAULT 'unknown'::public.nex_food_owner_status NOT NULL,
    hero_image_url text,
    hero_image_source text,
    hero_image_approved boolean DEFAULT false NOT NULL,
    hero_image_provenance jsonb,
    rating numeric(2,1),
    rating_source text,
    review_count integer,
    review_count_source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    source_updated_at timestamp with time zone,
    last_verified_at timestamp with time zone,
    verification_source text,
    categories text[] DEFAULT '{}'::text[] NOT NULL,
    country text NOT NULL,
    location_confidence text DEFAULT 'CITY'::text NOT NULL,
    neighbourhood text,
    street_line text,
    in_target_zone boolean,
    geocode_evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    location_verified_at timestamp with time zone,
    location_source text,
    recovered_evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence_recovered_at timestamp with time zone,
    evidence_source text,
    worker_id text,
    cycle_run_id uuid,
    CONSTRAINT food_business_country_iso_check CHECK ((country ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT food_business_location_confidence_check CHECK ((location_confidence = ANY (ARRAY['EXACT'::text, 'STREET'::text, 'AREA'::text, 'CITY'::text, 'UNKNOWN'::text]))),
    CONSTRAINT nex_food_business_category_check CHECK ((category = ANY (ARRAY['restaurant'::text, 'coffee-cafe'::text, 'ice-cream-dessert'::text, 'fast-food'::text]))),
    CONSTRAINT nex_food_business_public_ref_format_check CHECK ((public_listing_ref ~ '^#FL-[0-9]{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$'::text)),
    CONSTRAINT nex_food_business_rating_range_check CHECK (((rating IS NULL) OR ((rating >= (0)::numeric) AND (rating <= (5)::numeric)))),
    CONSTRAINT nex_food_business_review_count_nonneg_check CHECK (((review_count IS NULL) OR (review_count >= 0)))
);


--
-- Name: TABLE food_business; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_business IS 'NEX Food acquisition pipeline · master business record. Feeds the Food Directory + owner claim + HQ funnel. Per pinned doctrine: category-representative imagery only (no forced attribution), owner-provenanced pricing only (dishes live in separate nex.food_dish table in Phase 7).';


--
-- Name: COLUMN food_business.internal_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.internal_id IS 'Private UUID · never exposed to UI/URL/API/logs.';


--
-- Name: COLUMN food_business.public_listing_ref; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.public_listing_ref IS 'Shareable stable reference · format #FL-YYYY-XXXXX Crockford Base32.';


--
-- Name: COLUMN food_business.whatsapp_number; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.whatsapp_number IS 'Outreach channel only · MUST NOT be treated as the business identity (Philip 2026-08-21).';


--
-- Name: COLUMN food_business.dedupe_hash; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.dedupe_hash IS 'Composite hash: name-normalised + address-normalised + phone-last-6 + coord-rounded. Test case: Tempo Gelato vs Tempo Gelato Jogja must resolve to the same business when address/phone/coord match.';


--
-- Name: COLUMN food_business.claim_status; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.claim_status IS 'Listing-side status: discovered/verifying/listed/invited/claimed/paying. Different from owner_status (which tracks owner-side contact state).';


--
-- Name: COLUMN food_business.owner_status; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.owner_status IS 'Owner-side status: unknown/contacted/responded/verified. Different from claim_status. Both progress independently.';


--
-- Name: COLUMN food_business.hero_image_url; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.hero_image_url IS 'External URL only · never a blob. Supabase Storage / ImageKit / owner-authorised CDN. Per pinned RAM-aware doctrine.';


--
-- Name: COLUMN food_business.source_updated_at; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.source_updated_at IS 'When the underlying source (OSM element timestamp / permit update date / etc.) says the record was last updated. NULL when source does not expose this. This is NOT proof the business is still operating — see last_verified_at.';


--
-- Name: COLUMN food_business.last_verified_at; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.last_verified_at IS 'When NEX last obtained credible evidence the business is CURRENTLY OPERATING. NULL = never had credible evidence. Owner OTP verification is strongest. OSM element timestamp is weakest (someone said it existed then). Website fetch success is medium. Freshness bands: <12mo FRESH, <18mo AGING, <24mo STALE, >=24mo EXPIRED.';


--
-- Name: COLUMN food_business.verification_source; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.verification_source IS 'osm_element_timestamp | website_fetch | owner_otp | admin_manual | walker_reverify. Tracks the source of last_verified_at.';


--
-- Name: COLUMN food_business.categories; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.categories IS 'Task #85 · secondary/richer classification tokens sourced from OSM tags + cuisine + name heuristics. Primary category still lives in nex.food_business.category (single value · 4-enum). Populated at Walker insert time · never automatically mutated after that. Empty array means no secondary evidence available at ingest.';


--
-- Name: COLUMN food_business.country; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.country IS 'Country Foundation Step 3 · 2026-08-22 · ISO 3166-1 alpha-2 · required NOT NULL · no DEFAULT (every INSERT must explicitly declare). Backfilled to ''ID'' for pre-Step-3 Yogyakarta rows.';


--
-- Name: COLUMN food_business.location_confidence; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.location_confidence IS 'NEX Location Intelligence 5-state · EXACT (verified precise pin) / STREET (street known + coord precise) / AREA (neighbourhood assigned) / CITY (coord in city only) / UNKNOWN (no coord). Default CITY is honest starting point per project_nex_location_intelligence_2026_08_23.';


--
-- Name: COLUMN food_business.recovered_evidence; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.recovered_evidence IS 'NEX Path A Priority 1 · same shape as nex.accommodation_business.recovered_evidence · currently empty until food Walker preserves raw OSM tags (Priority 2 code change) or existing 806 rows backfilled via Overpass re-hit (Priority 3 · pending greenlight).';


--
-- Name: COLUMN food_business.worker_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.worker_id IS 'Persistence contract 2026-08-26 · worker_id matching nex.worker_heartbeat.worker_id (e.g. "acquisition:food:Yogyakarta"). NULL for pre-contract rows.';


--
-- Name: COLUMN food_business.cycle_run_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business.cycle_run_id IS 'Persistence contract 2026-08-26 · FK to worker_cycle_run.id. Walker SELECT-verify + walkers:proof derive records_new from DB truth via this FK. NULL for pre-contract rows.';


--
-- Name: food_enrichment_evidence; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_enrichment_evidence (
    evidence_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text NOT NULL,
    field_name text NOT NULL,
    value text,
    value_normalised text,
    source text NOT NULL,
    source_type public.nex_food_source_type NOT NULL,
    source_url text,
    confidence numeric(3,2) NOT NULL,
    agent_name public.nex_food_enrichment_agent NOT NULL,
    discovered_at timestamp with time zone DEFAULT now() NOT NULL,
    provenance_layer public.nex_food_field_trust DEFAULT 'source_import'::public.nex_food_field_trust NOT NULL,
    raw_snippet text,
    raw_payload jsonb,
    CONSTRAINT food_enrichment_evidence_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))
);


--
-- Name: TABLE food_enrichment_evidence; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_enrichment_evidence IS 'Append-only evidence log. Every enrichment agent output writes exactly one row per (business_ref, field, source, discovered_at). NEVER updates nex.food_business directly · a separate application step applies high-confidence evidence RESPECTING the trust hierarchy. owner_verified rows on nex.food_business_field_provenance are NEVER overwritten.';


--
-- Name: food_hq_rule; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_hq_rule (
    rule_key text NOT NULL,
    rule_value_int integer,
    rule_value_text text,
    description text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);


--
-- Name: TABLE food_hq_rule; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_hq_rule IS 'Configurable HQ conversion rules · thresholds live in DB, not hard-coded. Admin can tune without deploys. Never bypass source_import < nex_curated < admin_verified < owner_verified trust hierarchy.';


--
-- Name: food_business_completeness; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.food_business_completeness AS
 WITH weights AS (
         SELECT COALESCE(( SELECT food_hq_rule.rule_value_int
                   FROM nex.food_hq_rule
                  WHERE (food_hq_rule.rule_key = 'completeness_weight_identity'::text)), 20) AS w_identity,
            COALESCE(( SELECT food_hq_rule.rule_value_int
                   FROM nex.food_hq_rule
                  WHERE (food_hq_rule.rule_key = 'completeness_weight_location'::text)), 15) AS w_location,
            COALESCE(( SELECT food_hq_rule.rule_value_int
                   FROM nex.food_hq_rule
                  WHERE (food_hq_rule.rule_key = 'completeness_weight_contact'::text)), 20) AS w_contact,
            COALESCE(( SELECT food_hq_rule.rule_value_int
                   FROM nex.food_hq_rule
                  WHERE (food_hq_rule.rule_key = 'completeness_weight_hours'::text)), 10) AS w_hours,
            COALESCE(( SELECT food_hq_rule.rule_value_int
                   FROM nex.food_hq_rule
                  WHERE (food_hq_rule.rule_key = 'completeness_weight_food'::text)), 15) AS w_food,
            COALESCE(( SELECT food_hq_rule.rule_value_int
                   FROM nex.food_hq_rule
                  WHERE (food_hq_rule.rule_key = 'completeness_weight_menu'::text)), 10) AS w_menu,
            COALESCE(( SELECT food_hq_rule.rule_value_int
                   FROM nex.food_hq_rule
                  WHERE (food_hq_rule.rule_key = 'completeness_weight_media'::text)), 10) AS w_media
        ), scores AS (
         SELECT b.public_listing_ref AS business_ref,
            b.business_name,
            b.category,
            b.city,
            b.district,
            b.claim_status,
            b.owner_status,
                CASE
                    WHEN ((b.business_name IS NOT NULL) AND (b.business_name <> ''::text) AND (b.category IS NOT NULL)) THEN 1.0
                    ELSE 0.0
                END AS identity_score,
            (
                CASE
                    WHEN ((b.address IS NOT NULL) AND (b.address <> ''::text)) THEN 0.5
                    ELSE 0.0
                END +
                CASE
                    WHEN ((b.coordinates_lat IS NOT NULL) AND (b.coordinates_lng IS NOT NULL)) THEN 0.5
                    ELSE 0.0
                END) AS location_score,
            ((
                CASE
                    WHEN ((b.whatsapp_number IS NOT NULL) AND (b.whatsapp_number <> ''::text)) THEN 0.5
                    ELSE 0.0
                END +
                CASE
                    WHEN ((b.phone IS NOT NULL) AND (b.phone <> ''::text)) THEN 0.25
                    ELSE 0.0
                END) +
                CASE
                    WHEN ((b.website IS NOT NULL) AND (b.website <> ''::text)) THEN 0.25
                    ELSE 0.0
                END) AS contact_score,
                CASE
                    WHEN (b.opening_information IS NOT NULL) THEN 1.0
                    ELSE 0.0
                END AS hours_score,
            (
                CASE
                    WHEN (EXISTS ( SELECT 1
                       FROM nex.food_enrichment_evidence ev
                      WHERE ((ev.business_ref = b.public_listing_ref) AND (ev.field_name = 'cuisine'::text)))) THEN 0.5
                    ELSE 0.0
                END +
                CASE
                    WHEN (EXISTS ( SELECT 1
                       FROM nex.food_enrichment_evidence ev
                      WHERE ((ev.business_ref = b.public_listing_ref) AND (ev.field_name = ANY (ARRAY['dish_tokens'::text, 'food_category'::text]))))) THEN 0.5
                    ELSE 0.0
                END) AS food_score,
                CASE
                    WHEN (EXISTS ( SELECT 1
                       FROM nex.food_enrichment_evidence ev
                      WHERE ((ev.business_ref = b.public_listing_ref) AND (ev.field_name = ANY (ARRAY['menu_url'::text, 'ordering_url'::text, 'booking_url'::text]))))) THEN 1.0
                    ELSE 0.0
                END AS menu_score,
                CASE
                    WHEN ((b.hero_image_url IS NOT NULL) AND (b.hero_image_url <> ''::text) AND b.hero_image_approved) THEN 1.0
                    ELSE 0.0
                END AS media_score
           FROM nex.food_business b
        )
 SELECT s.business_ref,
    s.business_name,
    s.category,
    s.city,
    s.district,
    s.claim_status,
    s.owner_status,
    s.identity_score,
    s.location_score,
    s.contact_score,
    s.hours_score,
    s.food_score,
    s.menu_score,
    s.media_score,
    ((((((w.w_identity + w.w_location) + w.w_contact) + w.w_hours) + w.w_food) + w.w_menu) + w.w_media) AS max_score,
    round((((((((s.identity_score * (w.w_identity)::numeric) + (s.location_score * (w.w_location)::numeric)) + (s.contact_score * (w.w_contact)::numeric)) + (s.hours_score * (w.w_hours)::numeric)) + (s.food_score * (w.w_food)::numeric)) + (s.menu_score * (w.w_menu)::numeric)) + (s.media_score * (w.w_media)::numeric)), 2) AS completeness_score,
    round((((((((((s.identity_score * (w.w_identity)::numeric) + (s.location_score * (w.w_location)::numeric)) + (s.contact_score * (w.w_contact)::numeric)) + (s.hours_score * (w.w_hours)::numeric)) + (s.food_score * (w.w_food)::numeric)) + (s.menu_score * (w.w_menu)::numeric)) + (s.media_score * (w.w_media)::numeric)) / (NULLIF(((((((w.w_identity + w.w_location) + w.w_contact) + w.w_hours) + w.w_food) + w.w_menu) + w.w_media), 0))::numeric) * (100)::numeric), 1) AS completeness_pct
   FROM (scores s
     CROSS JOIN weights w);


--
-- Name: VIEW food_business_completeness; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON VIEW nex.food_business_completeness IS 'NEX_PROFILE_COMPLETENESS score per business · configurable weights via nex.food_hq_rule. Completeness ≠ trust · a field can be complete but low-trust.';


--
-- Name: food_business_field_provenance; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_business_field_provenance (
    business_ref text NOT NULL,
    field_name text NOT NULL,
    trust_layer public.nex_food_field_trust NOT NULL,
    written_at timestamp with time zone DEFAULT now() NOT NULL,
    written_by text,
    source_reference text,
    cycle_run_id uuid
);


--
-- Name: TABLE food_business_field_provenance; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_business_field_provenance IS 'One row per (business_ref, field_name). Tracks the CURRENT trust layer for that field so importers know whether they can overwrite. Enforced in application code · trust order: source_import < nex_curated < admin_verified < owner_verified. Higher trust NEVER overwritten by lower.';


--
-- Name: COLUMN food_business_field_provenance.cycle_run_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business_field_provenance.cycle_run_id IS 'Direct causality link (Task #74 · 2026-08-22). Which worker_cycle_run wrote this provenance row. The six-criteria evaluator JOINs on this FK for output/state evidence instead of inferring via time-window intersection. Historical rows (pre-Task-74) are NULL.';


--
-- Name: food_business_freshness; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.food_business_freshness AS
 SELECT public_listing_ref,
    business_name,
    city,
    claim_status,
    owner_status,
    source,
    source_ingested_at,
    source_updated_at,
    last_verified_at,
    verification_source,
    (
        CASE
            WHEN (last_verified_at IS NULL) THEN NULL::numeric
            ELSE (EXTRACT(epoch FROM (now() - last_verified_at)) / (86400)::numeric)
        END)::integer AS freshness_days,
        CASE
            WHEN (last_verified_at IS NULL) THEN 'UNVERIFIED'::text
            WHEN ((now() - last_verified_at) < '1 year'::interval) THEN 'FRESH'::text
            WHEN ((now() - last_verified_at) < '1 year 6 mons'::interval) THEN 'AGING'::text
            WHEN ((now() - last_verified_at) < '2 years'::interval) THEN 'STALE'::text
            ELSE 'EXPIRED'::text
        END AS freshness_status
   FROM nex.food_business b;


--
-- Name: VIEW food_business_freshness; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON VIEW nex.food_business_freshness IS 'Deterministic freshness band per business. Read by admin surfaces + Commercial Universe filter (when opted in). Discovery date does NOT masquerade as verification date — freshness is derived from last_verified_at ONLY.';


--
-- Name: food_business_freshness_summary; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.food_business_freshness_summary AS
 SELECT city,
    (count(*) FILTER (WHERE (freshness_status = 'FRESH'::text)))::integer AS fresh,
    (count(*) FILTER (WHERE (freshness_status = 'AGING'::text)))::integer AS aging,
    (count(*) FILTER (WHERE (freshness_status = 'STALE'::text)))::integer AS stale,
    (count(*) FILTER (WHERE (freshness_status = 'EXPIRED'::text)))::integer AS expired,
    (count(*) FILTER (WHERE (freshness_status = 'UNVERIFIED'::text)))::integer AS unverified,
    (count(*))::integer AS total
   FROM nex.food_business_freshness
  GROUP BY city;


--
-- Name: food_business_next_action; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_business_next_action (
    business_ref text NOT NULL,
    next_action public.nex_food_next_action NOT NULL,
    reason text NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    input_snapshot jsonb NOT NULL
);


--
-- Name: food_business_promotion; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_business_promotion (
    business_ref text NOT NULL,
    current_state text DEFAULT 'quality_pending'::text NOT NULL,
    quality_score integer,
    score_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    evaluated_at timestamp with time zone,
    entered_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_run_id uuid,
    CONSTRAINT food_business_promotion_current_state_check CHECK ((current_state = ANY (ARRAY['quality_pending'::text, 'ready_for_promotion'::text, 'needs_enrichment'::text, 'poor_evidence'::text, 'admin_reviewed'::text, 'owner_invited'::text, 'archived'::text]))),
    CONSTRAINT food_business_promotion_quality_score_check CHECK (((quality_score IS NULL) OR ((quality_score >= 0) AND (quality_score <= 100))))
);


--
-- Name: TABLE food_business_promotion; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_business_promotion IS 'Task #88 Phase 1 · Promotion lifecycle for discovered food businesses. Side table (not columns on food_business) so promotion state machine can iterate without touching the canonical discovery record. One row per business_ref. Every write comes from a worker_cycle_run (cycle_run_id FK · Direct-Provenance A). Never auto-advances to listed · admin/owner gate mandatory.';


--
-- Name: COLUMN food_business_promotion.current_state; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business_promotion.current_state IS 'Phase 1 writes quality_pending / ready_for_promotion / needs_enrichment / poor_evidence. Later phases write admin_reviewed (Phase 3) / owner_invited (Phase 4) / archived. No value advances to nex.food_business.claim_status without explicit admin/owner action.';


--
-- Name: COLUMN food_business_promotion.quality_score; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business_promotion.quality_score IS 'Integer 0-100. Weighted sum of per-criterion scores (see score_breakdown). Score determines READINESS, never automatic promotion.';


--
-- Name: COLUMN food_business_promotion.score_breakdown; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business_promotion.score_breakdown IS 'JSONB · per-criterion points earned. Keys match the pure scoring function in scripts/nex-promotion/quality-score.mjs.';


--
-- Name: COLUMN food_business_promotion.cycle_run_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business_promotion.cycle_run_id IS 'Direct-Provenance A · which worker_cycle_run last wrote this row. Enables the six-criteria evaluator to JOIN on causal FK rather than time-window intersect.';


--
-- Name: food_business_promotion_audit; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_business_promotion_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text NOT NULL,
    from_state text,
    to_state text NOT NULL,
    score_before integer,
    score_after integer,
    cycle_run_id uuid NOT NULL,
    reason text NOT NULL,
    written_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE food_business_promotion_audit; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_business_promotion_audit IS 'Task #88 Phase 1 · append-only log of every state/score change on food_business_promotion. Every row FK-linked to the worker_cycle_run that wrote it (Direct-Provenance A). Read by future admin queue UI + HQ funnel API for audit trail.';


--
-- Name: food_business_promotion_decision; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_business_promotion_decision (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    evidence_id uuid NOT NULL,
    business_ref text NOT NULL,
    field_name text NOT NULL,
    value text,
    value_normalised text,
    decision text NOT NULL,
    decided_by text DEFAULT 'admin:promotion-queue'::text NOT NULL,
    decided_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_run_id uuid NOT NULL,
    reason text,
    previous_field_value text,
    CONSTRAINT food_business_promotion_decision_decision_check CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text, 'replaced'::text])))
);


--
-- Name: TABLE food_business_promotion_decision; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_business_promotion_decision IS 'Task #88 Phase 3 · append-only admin adjudication of food_enrichment_evidence rows. Each row records an approve/reject/replace decision + the cycle_run_id (Direct-Provenance A) of the admin action. Rejected (biz,field,value) tuples are suppressed from the promotion queue view so future enrichment agents cannot re-present a rejected candidate.';


--
-- Name: COLUMN food_business_promotion_decision.decision; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business_promotion_decision.decision IS 'approved (accepted the value · writes to food_business.<field>) · rejected (permanent · queue suppresses future re-suggestion) · replaced (explicit overwrite of existing food_business.<field> value).';


--
-- Name: COLUMN food_business_promotion_decision.cycle_run_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business_promotion_decision.cycle_run_id IS 'Direct-Provenance A · every admin action registers a worker_cycle_run row (worker_type=promotion · worker_config=food:Yogyakarta:admin-decision) so provenance chain matches Walker / quality-check pattern.';


--
-- Name: COLUMN food_business_promotion_decision.previous_field_value; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_business_promotion_decision.previous_field_value IS 'Value of food_business.<field> immediately before the admin action · enables SQL-reversibility from the row alone.';


--
-- Name: food_business_source_snapshot; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_business_source_snapshot (
    snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text,
    source text NOT NULL,
    source_reference text NOT NULL,
    source_ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    source_licence_terms text,
    raw_payload jsonb NOT NULL,
    ingested_by text
);


--
-- Name: TABLE food_business_source_snapshot; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_business_source_snapshot IS 'IMMUTABLE audit trail of raw source imports. Never updated · never deleted. Re-imports write new rows with fresh source_ingested_at timestamps · the history is permanent. Reconstructs the discovery layer if the merged nex.food_business row is ever lost or wrong.';


--
-- Name: food_commercial_event; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_commercial_event (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text NOT NULL,
    event_type public.nex_food_event_type NOT NULL,
    event_value_idr numeric(14,2),
    customer_context jsonb,
    source_surface text,
    actor_ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE food_commercial_event; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_commercial_event IS 'Append-only commercial event log · every customer interaction with a business flows through here. Aggregated in nex.food_business_value materialized view. Feeds the NEX_VALUE_SCORE + next-action rules. Never mutated.';


--
-- Name: food_business_value; Type: MATERIALIZED VIEW; Schema: nex; Owner: -
--

CREATE MATERIALIZED VIEW nex.food_business_value AS
 SELECT b.public_listing_ref AS business_ref,
    b.business_name,
    b.claim_status,
    b.owner_status,
    (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'profile_view'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS profile_views,
    (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'search_appearance'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS search_appearances,
    (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'enquiry'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS enquiries,
    (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'qualified_enquiry'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS qualified_enquiries,
    (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'booking_request'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS booking_requests,
    (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'price_request'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS price_requests,
    (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'payment'::public.nex_food_event_type) THEN e.event_value_idr
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(14,2) AS revenue_idr,
    max(e.created_at) FILTER (WHERE (e.event_type = ANY (ARRAY['enquiry'::public.nex_food_event_type, 'qualified_enquiry'::public.nex_food_event_type, 'booking_request'::public.nex_food_event_type, 'price_request'::public.nex_food_event_type]))) AS last_customer_activity_at,
    (((((((COALESCE(sum(
        CASE
            WHEN (e.event_type = 'profile_view'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint) * 1) + (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'search_appearance'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint) * 1)) + (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'enquiry'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint) * 10)) + (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'qualified_enquiry'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint) * 25)) + (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'booking_request'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint) * 50)) + (COALESCE(sum(
        CASE
            WHEN (e.event_type = 'price_request'::public.nex_food_event_type) THEN 1
            ELSE 0
        END), (0)::bigint) * 15)))::integer AS nex_value_score
   FROM (nex.food_business b
     LEFT JOIN nex.food_commercial_event e ON ((e.business_ref = b.public_listing_ref)))
  GROUP BY b.public_listing_ref, b.business_name, b.claim_status, b.owner_status
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW food_business_value; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON MATERIALIZED VIEW nex.food_business_value IS 'Aggregated commercial signals per business. NEX_VALUE_SCORE is a weighted composite (Indonesia-first tuning). Refresh via REFRESH MATERIALIZED VIEW CONCURRENTLY nex.food_business_value. Feeds the next-action engine.';


--
-- Name: food_claim_code; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_claim_code (
    claim_code_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text NOT NULL,
    code_hash text NOT NULL,
    destination text NOT NULL,
    channel text DEFAULT 'whatsapp'::text NOT NULL,
    requested_by text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    consumed_at timestamp with time zone,
    invalidated_at timestamp with time zone,
    invalidated_reason text,
    pending_owner_data jsonb,
    entry_path text DEFAULT 'admin_cli'::text NOT NULL,
    CONSTRAINT nex_food_claim_code_channel_check CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'phone'::text, 'website'::text])))
);


--
-- Name: TABLE food_claim_code; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_claim_code IS 'Owner claim verification codes. Code hash stored (never plaintext). 10-minute expiry · 5-attempt limit · new code request invalidates previous. Successful verify flips nex.food_business.claim_status to claimed + owner_status to verified.';


--
-- Name: COLUMN food_claim_code.pending_owner_data; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_claim_code.pending_owner_data IS 'Owner-supplied fields captured at code-request time. Promoted to owner_verified provenance only after successful OTP verify. NEVER trusted until then.';


--
-- Name: COLUMN food_claim_code.entry_path; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.food_claim_code.entry_path IS 'admin_cli · self_service_claim · self_service_register — audit trail for how the claim was initiated.';


--
-- Name: food_enrichment_job; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_enrichment_job (
    job_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text NOT NULL,
    agent public.nex_food_enrichment_agent NOT NULL,
    status public.nex_food_enrichment_status DEFAULT 'pending'::public.nex_food_enrichment_status NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    input_snapshot jsonb,
    output_summary jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text
);


--
-- Name: TABLE food_enrichment_job; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_enrichment_job IS 'Job queue for batch-processable enrichment agent runs. One active (pending/running) job per (business, agent) at a time · avoids duplicate work. Failed jobs eligible for retry up to max_attempts. Resumable and failure-isolated · one bad job never stops the batch.';


--
-- Name: food_outreach_suppression; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_outreach_suppression (
    suppression_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text NOT NULL,
    channel public.nex_food_outreach_channel,
    reason text NOT NULL,
    suppressed_by text NOT NULL,
    suppressed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


--
-- Name: TABLE food_outreach_suppression; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_outreach_suppression IS 'Permanent opt-out list. Any row here for a given (business_ref, channel-or-ALL) BLOCKS all future outreach attempts. Rows are never automatically removed · admin must delete manually if the block was created in error.';


--
-- Name: food_commercial_universe; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.food_commercial_universe AS
 SELECT public_listing_ref,
    internal_id,
    business_name,
    category,
    city,
    district,
    whatsapp_number,
    phone,
    website,
    claim_status,
    owner_status,
        CASE
            WHEN ((whatsapp_number IS NOT NULL) AND (whatsapp_number <> ''::text)) THEN 'whatsapp'::text
            WHEN ((phone IS NOT NULL) AND (phone <> ''::text)) THEN 'phone'::text
            ELSE 'unknown'::text
        END AS primary_contact_channel,
    (EXISTS ( SELECT 1
           FROM nex.food_enrichment_job j
          WHERE ((j.business_ref = b.public_listing_ref) AND (j.status = 'needs_review'::public.nex_food_enrichment_status)))) AS ambiguous_identity_pending
   FROM nex.food_business b
  WHERE ((claim_status = ANY (ARRAY['listed'::public.nex_food_claim_status, 'invited'::public.nex_food_claim_status, 'claimed'::public.nex_food_claim_status, 'paying'::public.nex_food_claim_status])) AND (((whatsapp_number IS NOT NULL) AND (whatsapp_number <> ''::text)) OR ((phone IS NOT NULL) AND (phone <> ''::text))) AND (NOT (EXISTS ( SELECT 1
           FROM nex.food_outreach_suppression sup
          WHERE ((sup.business_ref = b.public_listing_ref) AND (sup.channel IS NULL))))));


--
-- Name: VIEW food_commercial_universe; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON VIEW nex.food_commercial_universe IS 'AUTOMATED ACQUISITION-READY businesses (Philip 2026-08-21 · CONSTITUTIONAL). Subset of nex.food_business that has verified contactability + is not suppressed. HQ funnel top-row reports COUNT(discovery_universe) vs COUNT(commercial_universe) + ratio. Do NOT publish "N total businesses" without the paired ratio.';


--
-- Name: food_next_action_audit; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_next_action_audit (
    audit_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text NOT NULL,
    from_action public.nex_food_next_action,
    to_action public.nex_food_next_action NOT NULL,
    reason text NOT NULL,
    input_snapshot jsonb NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    computed_by text
);


--
-- Name: TABLE food_next_action_audit; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_next_action_audit IS 'Every next-action recomputation writes exactly one row here. Permanent audit trail · never mutated · never deleted. Admin can trace WHY the engine recommended each action at each point in time.';


--
-- Name: food_outreach_attempt; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_outreach_attempt (
    attempt_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text NOT NULL,
    channel public.nex_food_outreach_channel NOT NULL,
    template_id text NOT NULL,
    status public.nex_food_outreach_status NOT NULL,
    status_reason text,
    destination text NOT NULL,
    rendered_body text NOT NULL,
    attempted_by text NOT NULL,
    provider_message_id text,
    provider_response jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE food_outreach_attempt; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_outreach_attempt IS 'Append-only audit log. Every outreach attempt writes exactly one row here, even dry runs. Rate-limit checks read business_ref + created_at.';


--
-- Name: food_outreach_template; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.food_outreach_template (
    template_id text NOT NULL,
    channel public.nex_food_outreach_channel NOT NULL,
    language text NOT NULL,
    purpose text NOT NULL,
    subject text,
    body text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT nex_food_outreach_template_language_check CHECK ((language = ANY (ARRAY['en'::text, 'id'::text])))
);


--
-- Name: TABLE food_outreach_template; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.food_outreach_template IS 'Reusable outreach message templates · one row per (channel, language, purpose) combination. Placeholders substituted at send time.';


--
-- Name: food_pending_self_service_claims; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.food_pending_self_service_claims AS
 SELECT cc.claim_code_id,
    cc.business_ref,
    cc.entry_path,
    cc.requested_at,
    cc.expires_at,
    cc.attempt_count,
    cc.destination,
    b.business_name,
    b.claim_status,
    b.owner_status,
    cc.pending_owner_data
   FROM (nex.food_claim_code cc
     JOIN nex.food_business b ON ((b.public_listing_ref = cc.business_ref)))
  WHERE ((cc.consumed_at IS NULL) AND (cc.invalidated_at IS NULL) AND (cc.expires_at > now()) AND (cc.entry_path = ANY (ARRAY['self_service_claim'::text, 'self_service_register'::text])));


--
-- Name: VIEW food_pending_self_service_claims; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON VIEW nex.food_pending_self_service_claims IS 'HQ observability of live owner-initiated claims. Never auto-promoted · admin-visible only.';


--
-- Name: food_reverification_candidates; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.food_reverification_candidates AS
 SELECT b.public_listing_ref,
    b.business_name,
    b.category,
    b.city,
    b.district,
    b.coordinates_lat,
    b.coordinates_lng,
    b.source,
    b.source_reference,
    b.last_verified_at,
    b.verification_source,
    f.freshness_status,
    f.freshness_days
   FROM (nex.food_business b
     JOIN nex.food_business_freshness f USING (public_listing_ref))
  WHERE ((b.claim_status = ANY (ARRAY['listed'::public.nex_food_claim_status, 'invited'::public.nex_food_claim_status, 'claimed'::public.nex_food_claim_status, 'paying'::public.nex_food_claim_status, 'discovered'::public.nex_food_claim_status])) AND ((f.freshness_status = ANY (ARRAY['AGING'::text, 'STALE'::text, 'EXPIRED'::text])) OR ((f.freshness_status = 'UNVERIFIED'::text) AND (b.claim_status = 'listed'::public.nex_food_claim_status))))
  ORDER BY
        CASE f.freshness_status
            WHEN 'EXPIRED'::text THEN 1
            WHEN 'STALE'::text THEN 2
            WHEN 'AGING'::text THEN 3
            WHEN 'UNVERIFIED'::text THEN 4
            ELSE 5
        END, b.last_verified_at;


--
-- Name: VIEW food_reverification_candidates; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON VIEW nex.food_reverification_candidates IS 'Businesses needing re-verification. Walker re-verify mode (future) picks from this view. Ordered by urgency: EXPIRED first, then STALE, AGING, UNVERIFIED-but-listed. Successful re-verify updates last_verified_at + verification_source. Failed re-verify leaves the record alone (does NOT auto-delete).';


--
-- Name: food_universe_ratio; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.food_universe_ratio AS
 SELECT ( SELECT (count(*))::integer AS count
           FROM nex.food_business
          WHERE (food_business.claim_status = ANY (ARRAY['discovered'::public.nex_food_claim_status, 'verifying'::public.nex_food_claim_status, 'listed'::public.nex_food_claim_status, 'invited'::public.nex_food_claim_status, 'claimed'::public.nex_food_claim_status, 'paying'::public.nex_food_claim_status]))) AS discovery_universe,
    ( SELECT (count(*))::integer AS count
           FROM nex.food_commercial_universe) AS commercial_universe,
    ((( SELECT (count(*))::integer AS count
           FROM nex.food_commercial_universe))::numeric / (NULLIF(( SELECT (count(*))::integer AS count
           FROM nex.food_business
          WHERE (food_business.claim_status = ANY (ARRAY['listed'::public.nex_food_claim_status, 'invited'::public.nex_food_claim_status, 'claimed'::public.nex_food_claim_status, 'paying'::public.nex_food_claim_status]))), 0))::numeric) AS commercial_ratio,
    now() AS computed_at;


--
-- Name: geo_landmark; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.geo_landmark (
    landmark_id text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    country text NOT NULL,
    city text NOT NULL,
    centroid_lat numeric NOT NULL,
    centroid_lng numeric NOT NULL,
    meaningful_area_ids text[] DEFAULT '{}'::text[] NOT NULL,
    source text NOT NULL,
    provenance jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT geo_landmark_category_check CHECK ((category = ANY (ARRAY['attraction'::text, 'transport'::text, 'shopping'::text, 'religious'::text, 'medical'::text, 'education'::text, 'other'::text])))
);


--
-- Name: TABLE geo_landmark; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.geo_landmark IS 'NEX Location Intelligence · landmark registry for Destination Graph + Distance Intelligence. Distances from business to landmark are computed on-demand, never precomputed combinatorially (per Location Intelligence storage doctrine).';


--
-- Name: graph_edges; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.graph_edges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_record_id text NOT NULL,
    to_record_id text NOT NULL,
    edge_type text NOT NULL,
    confidence real,
    provenance text,
    is_gap_marker boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT graph_edges_confidence_check CHECK (((confidence >= (0)::double precision) AND (confidence <= (1)::double precision)))
);


--
-- Name: identity_merge_log; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.identity_merge_log (
    merge_id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    existing_ref text NOT NULL,
    match_layer text NOT NULL,
    incoming_source text,
    incoming_source_reference text,
    incoming_name text,
    incoming_city text,
    incoming_website text,
    incoming_phone text,
    incoming_whatsapp text,
    incoming_lat numeric,
    incoming_lng numeric,
    incoming_extras jsonb DEFAULT '{}'::jsonb,
    enriched_fields text[] DEFAULT '{}'::text[],
    skipped_reason text,
    worker_id text,
    cycle_run_id uuid,
    merged_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT identity_merge_log_match_layer_check CHECK ((match_layer = ANY (ARRAY['source_ref'::text, 'website'::text, 'phone'::text, 'name_city'::text, 'geo_confirmed'::text])))
);


--
-- Name: TABLE identity_merge_log; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.identity_merge_log IS 'Append-only log of every observation the identity resolver merged into an existing entity. Preserves incoming source data + which layer fired + which fields were enriched. Philip 2026-08-27: never lose useful source data simply because we are deduplicating.';


--
-- Name: import_mappings; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.import_mappings (
    profile_id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    description text,
    header_signature text NOT NULL,
    mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    format_hint text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    used_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp with time zone,
    archived_at timestamp with time zone
);


--
-- Name: TABLE import_mappings; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.import_mappings IS 'Import Wizard · saved column-mapping profiles · reused across similar-shaped uploads';


--
-- Name: jobs; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.jobs (
    snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id text NOT NULL,
    source text,
    owner text,
    business_id uuid,
    created_at timestamp with time zone NOT NULL,
    knowledge_type text,
    target_brains jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text NOT NULL,
    progress real,
    completion_result jsonb,
    inbox_item_id text,
    title text,
    content_length integer,
    updated_at timestamp with time zone NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE jobs; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.jobs IS 'Infrastructure Runtime §5.2 · Worker Manager job snapshots · retention forever';


--
-- Name: journey_campaign_executions; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.journey_campaign_executions (
    execution_id uuid DEFAULT gen_random_uuid() NOT NULL,
    journey_state_id uuid NOT NULL,
    journey_id uuid NOT NULL,
    journey_slug text NOT NULL,
    journey_version integer NOT NULL,
    node_id text NOT NULL,
    campaign_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    status text DEFAULT 'in_flight'::text NOT NULL,
    dispatched_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    timed_out_at timestamp with time zone,
    last_checked_at timestamp with time zone DEFAULT now() NOT NULL,
    poll_count integer DEFAULT 0 NOT NULL,
    last_recipient_status text,
    outcome_reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT journey_campaign_executions_status_check CHECK ((status = ANY (ARRAY['in_flight'::text, 'completed'::text, 'failed_permanent'::text, 'timed_out'::text])))
);


--
-- Name: TABLE journey_campaign_executions; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.journey_campaign_executions IS 'One row per (journey_state, campaign) dispatched via SendCampaignAndWait · UNIQUE(journey_state_id) enforces idempotency · reads nex.campaign_recipients.send_status for progress · never polls providers directly';


--
-- Name: COLUMN journey_campaign_executions.status; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.journey_campaign_executions.status IS 'in_flight · completed · failed_permanent · timed_out · SendCampaignAndWait sets these based on canonical recipient send_status';


--
-- Name: journey_events; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.journey_events (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    journey_id uuid NOT NULL,
    journey_slug text NOT NULL,
    journey_version integer NOT NULL,
    state_id uuid,
    contact_id uuid,
    event_type text NOT NULL,
    from_node_id text,
    to_node_id text,
    emitted_command jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT journey_events_event_type_check CHECK ((event_type = ANY (ARRAY['JourneyStarted'::text, 'WaitEntered'::text, 'WaitExpired'::text, 'BranchTaken'::text, 'CampaignCommandEmitted'::text, 'CampaignCompleted'::text, 'GoalReached'::text, 'JourneyCompleted'::text, 'JourneyStopped'::text, 'JourneyFailed'::text])))
);


--
-- Name: TABLE journey_events; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.journey_events IS 'INSERT-only audit trail · full replayability · doctrine §3';


--
-- Name: journey_inbound_events; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.journey_inbound_events (
    inbound_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    trigger_key text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    contact_id uuid,
    source text DEFAULT 'webhook'::text NOT NULL,
    verified_signature boolean DEFAULT false NOT NULL,
    signature_algorithm text,
    request_headers jsonb DEFAULT '{}'::jsonb NOT NULL,
    raw_body_hash text,
    ip text,
    processed_at timestamp with time zone,
    matched_triggers integer DEFAULT 0 NOT NULL,
    matched_journey_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    processing_error text,
    CONSTRAINT journey_inbound_events_source_check CHECK ((source = ANY (ARRAY['webhook'::text, 'internal'::text])))
);


--
-- Name: TABLE journey_inbound_events; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.journey_inbound_events IS 'Immutable inbound webhook audit · signed AND unsigned recorded · charter §11.5';


--
-- Name: journey_states; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.journey_states (
    state_id uuid DEFAULT gen_random_uuid() NOT NULL,
    journey_id uuid NOT NULL,
    journey_slug text NOT NULL,
    journey_version integer NOT NULL,
    contact_id uuid NOT NULL,
    current_node_id text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    entered_at timestamp with time zone DEFAULT now() NOT NULL,
    last_transition_at timestamp with time zone DEFAULT now() NOT NULL,
    wait_until timestamp with time zone,
    random_seed integer NOT NULL,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    completed_at timestamp with time zone,
    stopped_reason text,
    last_command jsonb,
    CONSTRAINT journey_states_status_check CHECK ((status = ANY (ARRAY['active'::text, 'waiting'::text, 'completed'::text, 'stopped'::text, 'failed'::text])))
);


--
-- Name: TABLE journey_states; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.journey_states IS 'Per-contact execution state · journey_version captured at entry per Journey Charter §2';


--
-- Name: journey_triggers; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.journey_triggers (
    trigger_id uuid DEFAULT gen_random_uuid() NOT NULL,
    journey_id uuid NOT NULL,
    trigger_key text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    trigger_type text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    dedup_window_sec integer DEFAULT 60 NOT NULL,
    correlation_scope text DEFAULT 'per_contact'::text NOT NULL,
    last_fired_at timestamp with time zone,
    fire_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    activated_at timestamp with time zone,
    paused_at timestamp with time zone,
    archived_at timestamp with time zone,
    CONSTRAINT journey_triggers_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'archived'::text]))),
    CONSTRAINT journey_triggers_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['segment_join'::text, 'analytics_event'::text, 'compliance_transition'::text, 'inactivity'::text, 'custom_webhook'::text, 'schedule'::text])))
);


--
-- Name: TABLE journey_triggers; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.journey_triggers IS 'Versioned trigger config · one Active per (journey_id, trigger_key) · charter §11.3';


--
-- Name: journeys; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.journeys (
    journey_id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    version integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    trigger_type text DEFAULT 'segment_join'::text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    definition jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation_errors jsonb,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    activated_at timestamp with time zone,
    paused_at timestamp with time zone,
    archived_at timestamp with time zone,
    CONSTRAINT journeys_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'archived'::text]))),
    CONSTRAINT journeys_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['segment_join'::text, 'manual'::text])))
);


--
-- Name: TABLE journeys; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.journeys IS 'Versioned journey definitions · immutable once activated · one Active per slug';


--
-- Name: knowledge_dump_jobs; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.knowledge_dump_jobs (
    job_id text NOT NULL,
    source text NOT NULL,
    owner text NOT NULL,
    knowledge_type text,
    target_brains text[] DEFAULT '{}'::text[] NOT NULL,
    status text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    completion_result jsonb,
    inbox_item_id text,
    title text,
    content_length bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    shadow_written_at timestamp with time zone DEFAULT now() NOT NULL,
    shadow_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_dump_jobs_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT knowledge_dump_jobs_status_check CHECK ((status = ANY (ARRAY['received'::text, 'queued'::text, 'claimed'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: TABLE knowledge_dump_jobs; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.knowledge_dump_jobs IS 'Phase 11.2 · shadow copy of data/nex-jobs/jobs.jsonl. Latest-snapshot-wins semantic preserved (JSONL append-only history is dropped · the audit trail lives in nex.audit_log).';


--
-- Name: knowledge_feedback; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.knowledge_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question text,
    nex_answer text,
    correction text,
    lesson text,
    record_id text,
    domain text,
    topic_tags text[],
    feedback_kind text NOT NULL,
    severity text DEFAULT 'moderate'::text NOT NULL,
    feedback_source text DEFAULT 'philip'::text NOT NULL,
    submitted_by text,
    context jsonb,
    applied_to_prompts boolean DEFAULT false NOT NULL,
    applied_at timestamp with time zone,
    triggered_worker_proposal text,
    resulted_in_record text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_feedback_feedback_kind_check CHECK ((feedback_kind = ANY (ARRAY['correction'::text, 'approval'::text, 'edit'::text, 'rejection'::text, 'gap'::text, 'contradiction'::text, 'voice_drift'::text]))),
    CONSTRAINT knowledge_feedback_feedback_source_check CHECK ((feedback_source = ANY (ARRAY['philip'::text, 'customer'::text, 'worker-audit'::text, 'automated-check'::text]))),
    CONSTRAINT knowledge_feedback_severity_check CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'critical'::text])))
);


--
-- Name: knowledge_inbox; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.knowledge_inbox (
    id text NOT NULL,
    title text NOT NULL,
    kind text NOT NULL,
    status text NOT NULL,
    source text NOT NULL,
    hash text NOT NULL,
    created_at_ms bigint NOT NULL,
    created_at_iso timestamp with time zone NOT NULL,
    meta text,
    preview_text text,
    content_path text,
    file_path text,
    original_filename text,
    byte_size bigint,
    mime_type text,
    url text,
    processed_at_ms bigint,
    processed_notes text,
    shadow_written_at timestamp with time zone DEFAULT now() NOT NULL,
    shadow_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    object_bucket text,
    object_key text,
    description text,
    extraction_result jsonb,
    truth_class text,
    brain_slug text,
    topic_key text,
    CONSTRAINT knowledge_inbox_kind_check CHECK ((kind = ANY (ARRAY['text'::text, 'file'::text, 'url'::text, 'voice'::text, 'image'::text]))),
    CONSTRAINT knowledge_inbox_source_check CHECK ((source = ANY (ARRAY['chatgpt-approved'::text, 'claude-generated'::text, 'raw-research'::text, 'internet-article'::text, 'needs-verification'::text, 'gov-standards'::text, 'customer-qa'::text, 'personal-ideas'::text, 'wikipedia_en'::text, 'wikipedia_id'::text, 'wikidata'::text, 'wikivoyage'::text, 'commons'::text, 'bps_gov_id'::text, 'kemenparekraf'::text, 'openstreetmap'::text, 'wikimedia'::text, 'ollama_qwen2.5_id_translation'::text, 'ollama_qwen2.5_en_translation'::text, 'ollama_qwen2.5_summary'::text, 'ollama_qwen2.5_qa'::text, 'ollama_qwen2.5_english_lesson'::text, 'ollama_qwen2.5_grammar_check'::text, 'ollama_local_generic'::text]))),
    CONSTRAINT knowledge_inbox_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'processing'::text, 'review'::text, 'processed'::text, 'shadow'::text]))),
    CONSTRAINT knowledge_inbox_truth_class_valid CHECK (((truth_class IS NULL) OR (truth_class = ANY (ARRAY['confirmed_fact'::text, 'academic_reference'::text, 'traditional_folk'::text, 'spiritual_belief'::text, 'unconfirmed'::text, 'ai_generated'::text]))))
);


--
-- Name: TABLE knowledge_inbox; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.knowledge_inbox IS 'Phase 11.2 · shadow copy of data/knowledge-inbox/index.json. Dual-written by the filesystem storage layer when NEX_INBOX_SHADOW_POSTGRES=1. Reads stay on filesystem until Phase 11.3 flip. shadow_written_at = first insert · shadow_updated_at = last modification (either write path). hash is UNIQUE — matches findByHash dedup semantics.';


--
-- Name: COLUMN knowledge_inbox.object_bucket; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.knowledge_inbox.object_bucket IS 'Phase 3a · NEX Object Storage bucket name (e.g. "uploads"). NULL for pre-migration items that only have file_path. Set together with object_key.';


--
-- Name: COLUMN knowledge_inbox.object_key; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.knowledge_inbox.object_key IS 'Phase 3a · NEX Object Storage key. Together with object_bucket forms the location-transparent binary reference. NULL for pre-migration items.';


--
-- Name: COLUMN knowledge_inbox.description; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.knowledge_inbox.description IS 'User-supplied text description of the image. First-class input · often the strongest concept-extraction signal · works without vision.';


--
-- Name: COLUMN knowledge_inbox.extraction_result; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.knowledge_inbox.extraction_result IS 'Structured extraction output from the Image + Description Intelligence Worker. Shape: { concept, category, food, typical_visual_characteristics, related_concepts[], evidence, source, source_type, rights_status, ai_generated, vision_provider, ocr_provider, perceptual_hash, confidence, classification_band }. See project_nex_owns_intelligence_capabilities_2026_08_22 for provider-independence rules.';


--
-- Name: COLUMN knowledge_inbox.truth_class; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.knowledge_inbox.truth_class IS 'Philip 2026-08-27 · truth classification · confirmed_fact | traditional_folk | spiritual_belief | academic_reference · constitutional bar for how NEX presents the information to users. Never fabricated. Never dismissed as false.';


--
-- Name: knowledge_inbox_stats; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.knowledge_inbox_stats (
    stat_date date NOT NULL,
    completed_today integer DEFAULT 0 NOT NULL,
    images_analysed_lifetime integer DEFAULT 0 NOT NULL,
    voice_notes_transcribed_lifetime integer DEFAULT 0 NOT NULL,
    last_processed_at_ms bigint,
    shadow_written_at timestamp with time zone DEFAULT now() NOT NULL,
    shadow_updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE knowledge_inbox_stats; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.knowledge_inbox_stats IS 'Phase 11.2 · shadow copy of data/knowledge-inbox/stats.json (only the counts we own here — downstream record/FAQ/edge/duplicate counts live in nex.knowledge_records + nex.graph_edges + nex.worker_results per the Never Pretends Work Done doctrine).';


--
-- Name: knowledge_records; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.knowledge_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    record_id text NOT NULL,
    record_version text DEFAULT '1.0.0'::text NOT NULL,
    status text NOT NULL,
    supersedes text,
    canonical_owner text NOT NULL,
    authored_by text NOT NULL,
    authorised_by text,
    reviewed_by text,
    title text NOT NULL,
    category text NOT NULL,
    subcategory text,
    summary text NOT NULL,
    body_markdown text NOT NULL,
    industry_concepts text[],
    nex_concepts text[],
    primary_audience text NOT NULL,
    alt_audiences text[],
    sustainability_alert jsonb,
    embedding bytea,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_reviewed_at timestamp with time zone,
    review_due_at timestamp with time zone,
    deprecated_at timestamp with time zone,
    CONSTRAINT knowledge_records_primary_audience_check CHECK ((primary_audience = ANY (ARRAY['homeowner'::text, 'manufacturer'::text, 'engineer'::text]))),
    CONSTRAINT knowledge_records_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'UNDER_REVIEW'::text, 'AUTHORITATIVE'::text, 'DEPRECATED'::text, 'SUPERSEDED'::text])))
);


--
-- Name: kpe_chunks; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.kpe_chunks (
    chunk_id uuid NOT NULL,
    document_id uuid NOT NULL,
    order_index integer NOT NULL,
    heading_path jsonb DEFAULT '[]'::jsonb NOT NULL,
    content text NOT NULL,
    content_hash text NOT NULL,
    token_estimate integer,
    context_before text,
    context_after text,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE kpe_chunks; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.kpe_chunks IS 'Infrastructure Runtime §5.8 · KPE chunks · retention forever';


--
-- Name: kpe_decisions; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.kpe_decisions (
    chunk_id uuid NOT NULL,
    route jsonb DEFAULT '{}'::jsonb NOT NULL,
    decided_at timestamp with time zone NOT NULL,
    provider_used text,
    latency_ms integer,
    cost_estimate_gbp real,
    alternatives_considered jsonb DEFAULT '[]'::jsonb NOT NULL,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE kpe_decisions; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.kpe_decisions IS 'Infrastructure Runtime §5.8 · KPE routing decisions · retention forever';


--
-- Name: kpe_documents; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.kpe_documents (
    document_id uuid NOT NULL,
    source text NOT NULL,
    title text,
    content_hash text NOT NULL,
    byte_length integer,
    ingested_at timestamp with time zone NOT NULL,
    classifier_label text,
    classifier_confidence real,
    target_brains jsonb DEFAULT '[]'::jsonb NOT NULL,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE kpe_documents; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.kpe_documents IS 'Infrastructure Runtime §5.8 · KPE documents · retention forever';


--
-- Name: kpe_duplicates; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.kpe_duplicates (
    duplicate_id uuid NOT NULL,
    chunk_id uuid NOT NULL,
    matched_chunk_id uuid NOT NULL,
    similarity real NOT NULL,
    match_type text NOT NULL,
    detected_at timestamp with time zone NOT NULL,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE kpe_duplicates; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.kpe_duplicates IS 'Infrastructure Runtime §5.8 · KPE duplicate detections · 90d retention';


--
-- Name: kpe_edges; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.kpe_edges (
    edge_id uuid NOT NULL,
    from_id text NOT NULL,
    to_id text NOT NULL,
    type text NOT NULL,
    confidence real,
    created_at timestamp with time zone NOT NULL,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kpe_edges_confidence_check CHECK (((confidence IS NULL) OR ((confidence >= (0)::double precision) AND (confidence <= (1)::double precision))))
);


--
-- Name: TABLE kpe_edges; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.kpe_edges IS 'Infrastructure Runtime §5.8 · KPE knowledge graph edges · retention forever';


--
-- Name: kpe_human_reviews; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.kpe_human_reviews (
    review_id uuid NOT NULL,
    chunk_id uuid NOT NULL,
    document_id uuid NOT NULL,
    decision text NOT NULL,
    admin text NOT NULL,
    reason text,
    decided_at timestamp with time zone NOT NULL,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kpe_human_reviews_decision_check CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text])))
);


--
-- Name: TABLE kpe_human_reviews; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.kpe_human_reviews IS 'Infrastructure Runtime §5.8 · KPE human review decisions · retention forever';


--
-- Name: kpe_metadata; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.kpe_metadata (
    chunk_id uuid NOT NULL,
    authors jsonb DEFAULT '[]'::jsonb NOT NULL,
    dates jsonb DEFAULT '[]'::jsonb NOT NULL,
    versions jsonb DEFAULT '[]'::jsonb NOT NULL,
    urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    "references" jsonb DEFAULT '[]'::jsonb NOT NULL,
    language text,
    keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
    extracted_entities jsonb DEFAULT '[]'::jsonb NOT NULL,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE kpe_metadata; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.kpe_metadata IS 'Infrastructure Runtime §5.8 · KPE metadata · retention forever';


--
-- Name: kpe_processing_runs; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.kpe_processing_runs (
    run_id uuid NOT NULL,
    document_id uuid NOT NULL,
    source text,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone,
    stages_completed jsonb DEFAULT '[]'::jsonb NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    final_outcome text,
    chunks_created integer,
    decisions_made integer,
    brain_writes integer,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE kpe_processing_runs; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.kpe_processing_runs IS 'Infrastructure Runtime §5.8 · KPE processing runs · 180d retention';


--
-- Name: meaningful_area; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.meaningful_area (
    area_id text NOT NULL,
    name text NOT NULL,
    area_kind text NOT NULL,
    precedence integer DEFAULT 50 NOT NULL,
    country text NOT NULL,
    city text NOT NULL,
    centroid_lat numeric NOT NULL,
    centroid_lng numeric NOT NULL,
    radius_km numeric NOT NULL,
    character_tags text[] DEFAULT '{}'::text[] NOT NULL,
    description text,
    brain_phrasing_hint text,
    source text NOT NULL,
    provenance jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT meaningful_area_area_kind_check CHECK ((area_kind = ANY (ARRAY['neighbourhood'::text, 'corridor'::text, 'belt'::text, 'fallback'::text]))),
    CONSTRAINT meaningful_area_radius_km_check CHECK ((radius_km > (0)::numeric))
);


--
-- Name: TABLE meaningful_area; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.meaningful_area IS 'NEX Location Intelligence · customer-facing meaningful areas (Malioboro · Prawirotaman · etc.) with character tags for mood-language translation. NOT admin boundaries — those stay in nex.food_business.district / nex.accommodation_business.district.';


--
-- Name: media_object; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.media_object (
    media_id uuid DEFAULT gen_random_uuid() NOT NULL,
    object_type text NOT NULL,
    owner_id text NOT NULL,
    visibility text DEFAULT 'private'::text NOT NULL,
    storage_bucket text NOT NULL,
    storage_key text NOT NULL,
    storage_version text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    content_hash text NOT NULL,
    duration_ms integer,
    width_px integer,
    height_px integer,
    codec text,
    poster_media_id uuid,
    audio_codec text,
    sample_rate integer,
    channels integer,
    context_type text,
    context_ref text,
    uploaded_via text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    uploaded_from_user_agent text,
    cycle_run_id uuid,
    state text DEFAULT 'uploading'::text NOT NULL,
    deleted_at timestamp with time zone,
    hard_delete_after timestamp with time zone,
    title text,
    description text,
    extras jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_object_context_type_check CHECK (((context_type IS NULL) OR (context_type = ANY (ARRAY['profile'::text, 'business'::text, 'product'::text, 'feed'::text, 'live_recording'::text, 'call_recording'::text, 'chat'::text, 'document_library'::text, 'category_library'::text])))),
    CONSTRAINT media_object_deletion_pair CHECK (((state <> 'deleted'::text) OR ((deleted_at IS NOT NULL) AND (hard_delete_after IS NOT NULL)))),
    CONSTRAINT media_object_object_type_check CHECK ((object_type = ANY (ARRAY['image'::text, 'video'::text, 'audio'::text, 'document'::text]))),
    CONSTRAINT media_object_state_check CHECK ((state = ANY (ARRAY['uploading'::text, 'processing'::text, 'ready'::text, 'failed'::text, 'deleted'::text]))),
    CONSTRAINT media_object_storage_nonempty CHECK (((length(storage_bucket) > 0) AND (length(storage_key) > 0) AND (length(storage_version) > 0))),
    CONSTRAINT media_object_video_has_duration CHECK (((object_type <> 'video'::text) OR (duration_ms IS NULL) OR (duration_ms >= 0))),
    CONSTRAINT media_object_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'unlisted'::text, 'public'::text]))),
    CONSTRAINT media_object_visibility_owner_consistent CHECK ((owner_id <> ''::text))
);


--
-- Name: TABLE media_object; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.media_object IS 'NEX Media Foundation · Stage 1 · Philip 2026-08-27. Polymorphic media object for image/video/audio/document. Every NEX media feature (profile photo, business photo, product image/video, short video, LIVE recording, voice/video message, documents, thumbnails) references THIS ONE table. Do NOT add feature-specific media tables — extend this one. ADR-0118 governs ownership + phone-delete rule.';


--
-- Name: COLUMN media_object.owner_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.media_object.owner_id IS 'Pure-NEX identity string (matches nex.call_record.caller_user_id pattern). NOT a Supabase auth UUID. NEX-native identity flow only.';


--
-- Name: COLUMN media_object.state; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.media_object.state IS 'Lifecycle state per ADR-0118: uploading → processing → ready → failed | deleted. Soft delete sets state=deleted + deleted_at=now() + hard_delete_after=now()+7d. A janitor job (deferred) hard-deletes bytes when now() > hard_delete_after.';


--
-- Name: COLUMN media_object.hard_delete_after; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.media_object.hard_delete_after IS '7-day grace period per ADR-0118 § 4. Deleting from phone does NOT delete NEX copy. Deleting inside NEX starts the grace clock; bytes removed after 7 days.';


--
-- Name: mp_category; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.mp_category (
    category_id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    parent_id uuid,
    sort_order integer DEFAULT 100 NOT NULL,
    level integer,
    path text
);


--
-- Name: COLUMN mp_category.level; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.mp_category.level IS '1=master · 2=sub-category · 3=micro-niche. Nulls indicate legacy flat categories awaiting migration.';


--
-- Name: COLUMN mp_category.path; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.mp_category.path IS 'Full display path e.g. "Electronics > Smartphones & Accessories > Mobile Phones" for search/breadcrumb rendering.';


--
-- Name: mp_commerce_policy; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.mp_commerce_policy (
    policy_id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction text NOT NULL,
    category_id uuid,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    effective_to timestamp with time zone,
    seller_fee_rate numeric(5,4) NOT NULL,
    min_fee_idr integer DEFAULT 0 NOT NULL,
    max_fee_idr integer,
    currency text DEFAULT 'IDR'::text NOT NULL,
    notes text,
    CONSTRAINT fee_rate_bounds CHECK (((seller_fee_rate >= (0)::numeric) AND (seller_fee_rate <= (1)::numeric))),
    CONSTRAINT mp_commerce_policy_max_fee_idr_check CHECK (((max_fee_idr IS NULL) OR (max_fee_idr >= 0))),
    CONSTRAINT mp_commerce_policy_min_fee_idr_check CHECK ((min_fee_idr >= 0))
);


--
-- Name: mp_product; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.mp_product (
    product_id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    category_id uuid,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    condition nex.mp_product_condition DEFAULT 'new'::nex.mp_product_condition NOT NULL,
    has_variants boolean DEFAULT false NOT NULL,
    base_price_idr integer,
    base_stock integer,
    base_sku text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    qty_price_tiers jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT mp_product_base_price_idr_check CHECK (((base_price_idr IS NULL) OR (base_price_idr >= 0))),
    CONSTRAINT mp_product_base_stock_check CHECK (((base_stock IS NULL) OR (base_stock >= 0))),
    CONSTRAINT qty_price_tiers_wellformed CHECK (nex.qty_price_tiers_wellformed(qty_price_tiers)),
    CONSTRAINT qty_tiers_only_when_no_variants CHECK (((qty_price_tiers = '[]'::jsonb) OR (has_variants = false)))
);


--
-- Name: COLUMN mp_product.qty_price_tiers; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.mp_product.qty_price_tiers IS 'Quantity pricing tiers (signature behaviour #2). Absolute IDR per unit at qty>=minQty. Shape: [{"minQty":int>=2,"pricePerUnitIdr":int>0}]. Ascending minQty, descending price. Empty array = no tiers = base_price_idr applies to all quantities. Only valid on non-variant products.';


--
-- Name: mp_product_image; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.mp_product_image (
    image_id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    url text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    alt_text text
);


--
-- Name: mp_product_option; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.mp_product_option (
    option_id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);


--
-- Name: mp_product_option_value; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.mp_product_option_value (
    option_value_id uuid DEFAULT gen_random_uuid() NOT NULL,
    option_id uuid NOT NULL,
    value text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);


--
-- Name: mp_product_variant; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.mp_product_variant (
    variant_id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    sku text NOT NULL,
    price_idr integer NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    option_value_ids uuid[] NOT NULL,
    CONSTRAINT mp_product_variant_price_idr_check CHECK ((price_idr >= 0)),
    CONSTRAINT mp_product_variant_stock_check CHECK ((stock >= 0))
);


--
-- Name: mp_seller; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.mp_seller (
    seller_id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    city text,
    jurisdiction text DEFAULT 'ID/DIY/Yogyakarta'::text NOT NULL,
    status nex.mp_seller_status DEFAULT 'discovered'::nex.mp_seller_status NOT NULL,
    bio text,
    cover_image_ref text,
    logo_image_ref text,
    contact_ref text,
    discovered_from text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    worker_id text,
    cycle_run_id uuid,
    source text,
    source_reference text
);


--
-- Name: COLUMN mp_seller.worker_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.mp_seller.worker_id IS 'Persistence contract 2026-08-26 · worker_id matching nex.worker_heartbeat.worker_id (e.g. "acquisition:market:Yogyakarta"). Complements existing informal discovered_from text field. NULL for pre-contract rows.';


--
-- Name: COLUMN mp_seller.cycle_run_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.mp_seller.cycle_run_id IS 'Persistence contract 2026-08-26 · FK to worker_cycle_run.id. NULL for pre-contract rows.';


--
-- Name: worker_results; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.worker_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    worker_type text NOT NULL,
    worker_id text NOT NULL,
    output_kind text NOT NULL,
    output_payload jsonb NOT NULL,
    overall_confidence real,
    llm_provider text,
    llm_model text,
    llm_tokens_in integer,
    llm_tokens_out integer,
    llm_ms integer,
    flags text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT worker_results_overall_confidence_check CHECK (((overall_confidence >= (0)::double precision) AND (overall_confidence <= (1)::double precision)))
);


--
-- Name: nex_brain_status; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.nex_brain_status AS
 SELECT ( SELECT count(*) AS count
           FROM nex.worker_jobs
          WHERE (worker_jobs.status = 'waiting'::text)) AS jobs_waiting,
    ( SELECT count(*) AS count
           FROM nex.worker_jobs
          WHERE (worker_jobs.status = ANY (ARRAY['assigned'::text, 'running'::text]))) AS jobs_in_flight,
    ( SELECT count(*) AS count
           FROM nex.worker_jobs
          WHERE ((worker_jobs.status = 'completed'::text) AND (worker_jobs.completed_at > (now() - '24:00:00'::interval)))) AS jobs_completed_24h,
    ( SELECT count(*) AS count
           FROM nex.worker_jobs
          WHERE ((worker_jobs.status = 'failed'::text) AND (worker_jobs.created_at > (now() - '24:00:00'::interval)))) AS jobs_failed_24h,
    ( SELECT count(*) AS count
           FROM nex.knowledge_records
          WHERE (knowledge_records.status = 'AUTHORITATIVE'::text)) AS records_authoritative,
    ( SELECT count(*) AS count
           FROM nex.knowledge_records
          WHERE (knowledge_records.status = 'UNDER_REVIEW'::text)) AS records_under_review,
    ( SELECT count(*) AS count
           FROM nex.knowledge_records
          WHERE (knowledge_records.status = 'DRAFT'::text)) AS records_draft,
    ( SELECT count(*) AS count
           FROM nex.contradictions
          WHERE (contradictions.status = 'open'::text)) AS contradictions_open,
    ( SELECT count(*) AS count
           FROM nex.graph_edges
          WHERE (graph_edges.is_gap_marker = true)) AS gap_markers_open,
    ( SELECT COALESCE(sum((worker_results.llm_tokens_in + worker_results.llm_tokens_out)), (0)::bigint) AS "coalesce"
           FROM nex.worker_results
          WHERE (worker_results.created_at > (now() - '24:00:00'::interval))) AS llm_tokens_24h,
    ( SELECT count(*) AS count
           FROM nex.worker_results
          WHERE (worker_results.created_at > (now() - '24:00:00'::interval))) AS llm_calls_24h,
    ( SELECT count(*) AS count
           FROM nex.knowledge_feedback) AS feedback_total_lifetime,
    ( SELECT count(*) AS count
           FROM nex.knowledge_feedback
          WHERE (knowledge_feedback.created_at > (now() - '7 days'::interval))) AS feedback_last_7d,
    ( SELECT count(*) AS count
           FROM nex.knowledge_feedback
          WHERE (knowledge_feedback.applied_to_prompts = false)) AS feedback_unapplied;


--
-- Name: object_blob_current; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.object_blob_current (
    bucket text NOT NULL,
    key text NOT NULL,
    version_id text NOT NULL,
    is_delete_marker boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE object_blob_current; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.object_blob_current IS 'Phase 3a · pointer to the current-live version of each (bucket, key). Analogous to the .current file in the filesystem adapter. Updates are atomic. Soft delete leaves a delete-marker version in object_blobs and flips this pointer to is_delete_marker=true.';


--
-- Name: object_blobs; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.object_blobs (
    bucket text NOT NULL,
    key text NOT NULL,
    version_id text NOT NULL,
    content_hash text NOT NULL,
    size_bytes bigint NOT NULL,
    mime_type text DEFAULT 'application/octet-stream'::text NOT NULL,
    body bytea,
    is_delete_marker boolean DEFAULT false NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    uploaded_by text,
    business_id text,
    source_ref text,
    custom jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT object_blobs_size_bytes_check CHECK ((size_bytes >= 0))
);


--
-- Name: TABLE object_blobs; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.object_blobs IS 'Phase 3a · NEX Object Storage · Postgres-backed binary blob storage. Implements the ObjectStorage contract from src/lib/nex/storage/object-types.ts. Every put/get/delete goes through PostgresObjectStorage adapter · never direct SQL from services. Body stored as BYTEA. Registry-level manifest decorator continues to write nex.object_manifest.';


--
-- Name: object_manifest; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.object_manifest (
    manifest_id uuid NOT NULL,
    bucket text NOT NULL,
    key text NOT NULL,
    version_id text NOT NULL,
    content_hash text NOT NULL,
    size_bytes bigint NOT NULL,
    mime_type text NOT NULL,
    uploaded_at timestamp with time zone NOT NULL,
    uploaded_by text,
    business_id uuid,
    source_ref text,
    is_delete_marker boolean DEFAULT false NOT NULL,
    custom jsonb DEFAULT '{}'::jsonb NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE object_manifest; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.object_manifest IS 'Infrastructure Runtime §5.9 · ObjectStorage metadata index · retention forever · rows written by ObjectStorage registry after every put/delete';


--
-- Name: prediction_models; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.prediction_models (
    model_id uuid DEFAULT gen_random_uuid() NOT NULL,
    target text NOT NULL,
    model_version text NOT NULL,
    model_kind text NOT NULL,
    status text DEFAULT 'shadow'::text NOT NULL,
    feature_spec jsonb DEFAULT '[]'::jsonb NOT NULL,
    hyperparameters jsonb DEFAULT '{}'::jsonb NOT NULL,
    calibration jsonb DEFAULT '{}'::jsonb NOT NULL,
    training_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    deployed_at timestamp with time zone,
    retired_at timestamp with time zone,
    deployed_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT prediction_models_model_kind_check CHECK ((model_kind = ANY (ARRAY['linear_score'::text, 'logistic'::text, 'rules'::text, 'random_forest'::text, 'xgboost'::text, 'neural'::text, 'other'::text]))),
    CONSTRAINT prediction_models_status_check CHECK ((status = ANY (ARRAY['shadow'::text, 'active'::text, 'retired'::text])))
);


--
-- Name: TABLE prediction_models; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.prediction_models IS 'Model registry · versioned · rollback via status flip · UNIQUE partial index enforces one active per target · invariant #15';


--
-- Name: predictions; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.predictions (
    prediction_id uuid DEFAULT gen_random_uuid() NOT NULL,
    target text NOT NULL,
    model_id uuid NOT NULL,
    model_version text NOT NULL,
    contact_id uuid,
    subject_kind text DEFAULT 'contact'::text NOT NULL,
    subject_id text,
    prediction jsonb NOT NULL,
    confidence numeric(6,5) DEFAULT 0 NOT NULL,
    input_snapshot jsonb NOT NULL,
    reason jsonb DEFAULT '[]'::jsonb NOT NULL,
    window_days integer,
    correlation_id text,
    mode text DEFAULT 'recommendation'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT predictions_mode_check CHECK ((mode = ANY (ARRAY['recommendation'::text, 'optimisation'::text, 'shadow'::text]))),
    CONSTRAINT predictions_subject_kind_check CHECK ((subject_kind = ANY (ARRAY['contact'::text, 'segment'::text, 'campaign'::text, 'journey'::text, 'variant'::text])))
);


--
-- Name: TABLE predictions; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.predictions IS 'INSERT-only audit trail of every inference · every row carries model_version, input_snapshot, confidence, reason · invariant #15';


--
-- Name: predictive_controls; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.predictive_controls (
    singleton boolean DEFAULT true NOT NULL,
    paused boolean DEFAULT false NOT NULL,
    paused_at timestamp with time zone,
    paused_by text,
    paused_reason text,
    confidence_threshold numeric(6,5) DEFAULT 0.60 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT predictive_controls_singleton_check CHECK ((singleton = true))
);


--
-- Name: TABLE predictive_controls; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.predictive_controls IS 'Singleton row · global pause / kill switch + confidence threshold · pause blocks optimisation commands without a redeploy · invariant #15';


--
-- Name: provider_rate_config; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.provider_rate_config (
    provider text NOT NULL,
    min_interval_ms integer NOT NULL,
    max_concurrent integer NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT provider_rate_config_max_concurrent_check CHECK ((max_concurrent >= 1)),
    CONSTRAINT provider_rate_config_min_interval_ms_check CHECK ((min_interval_ms >= 0))
);


--
-- Name: TABLE provider_rate_config; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.provider_rate_config IS 'Per-provider throttle configuration. Governs how many concurrent leases and how much time must elapse between consecutive lease acquisitions.';


--
-- Name: provider_rate_lease; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.provider_rate_lease (
    lease_id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    walker_id text NOT NULL,
    cycle_run_id uuid,
    acquired_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:00:30'::interval) NOT NULL,
    released_at timestamp with time zone
);


--
-- Name: TABLE provider_rate_lease; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.provider_rate_lease IS 'Active + historical lease rows. Any walker calling a provider first acquires a lease · releases on completion/failure. Stale leases past expires_at are treated as released by the governor lib · no manual cleanup required.';


--
-- Name: provider_registry; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.provider_registry (
    provider_id text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    capabilities text[] DEFAULT '{}'::text[] NOT NULL,
    geography_scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    categories_scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    authentication text DEFAULT 'none'::text NOT NULL,
    credentials_secret_ref text,
    rate_limit_rps numeric,
    rate_limit_rpd integer,
    concurrency_limit integer DEFAULT 1 NOT NULL,
    cost_per_request_usd numeric(10,6) DEFAULT 0 NOT NULL,
    licence_id text NOT NULL,
    attribution_required boolean DEFAULT false NOT NULL,
    attribution_template text,
    freshness_class text DEFAULT 'realtime'::text NOT NULL,
    reliability_score smallint DEFAULT 50 NOT NULL,
    current_health_state text DEFAULT 'green'::text NOT NULL,
    terms_url text NOT NULL,
    last_reviewed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT provider_registry_current_health_state_check CHECK ((current_health_state = ANY (ARRAY['green'::text, 'yellow'::text, 'red'::text, 'circuit-open'::text, 'disabled'::text]))),
    CONSTRAINT provider_registry_reliability_score_check CHECK (((reliability_score >= 0) AND (reliability_score <= 100)))
);


--
-- Name: TABLE provider_registry; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.provider_registry IS 'NEX Discovery Fabric P8 · authoritative registry of every data provider we call. Walkers READ (via scripts/nex-worker/provider-registry.mjs). Health probes WRITE (future). Router READS (future). Never a provider-evasion mechanism.';


--
-- Name: COLUMN provider_registry.cost_per_request_usd; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.provider_registry.cost_per_request_usd IS 'Used by scripts/nex-worker/cost-oracle.mjs to project spend before a cycle. Zero for free providers · positive for commercial APIs.';


--
-- Name: COLUMN provider_registry.reliability_score; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.provider_registry.reliability_score IS '0-100 EMA of recent cycle outcomes. Written by health probe (future). Read by router (future). Default 50 = unproven.';


--
-- Name: COLUMN provider_registry.current_health_state; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.provider_registry.current_health_state IS 'green|yellow|red|circuit-open|disabled. Only health probes may transition; walkers observe. "disabled" is human-set (no credentials / not provisioned).';


--
-- Name: provider_topup_intent; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.provider_topup_intent (
    intent_id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    amount_idr integer NOT NULL,
    midtrans_order_id text NOT NULL,
    midtrans_transaction_id text,
    midtrans_payment_type text,
    snap_token text,
    snap_redirect_url text,
    state text DEFAULT 'pending'::text NOT NULL,
    last_webhook_at timestamp with time zone,
    last_webhook_status text,
    credited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT provider_topup_intent_amount_idr_check CHECK ((amount_idr = ANY (ARRAY[20000, 50000, 100000, 250000, 500000]))),
    CONSTRAINT provider_topup_intent_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'paid'::text, 'denied'::text, 'cancelled'::text, 'expired'::text, 'failed'::text])))
);


--
-- Name: TABLE provider_topup_intent; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.provider_topup_intent IS 'One row per top-up attempt · NEX-generated order_id is the Midtrans reference · idempotency backbone for the wallet-credit path · Philip 2026-08-29 · migration 140';


--
-- Name: COLUMN provider_topup_intent.credited_at; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.provider_topup_intent.credited_at IS 'Non-null AFTER the wallet has been credited exactly once. Together with the partial UNIQUE index on provider_wallet_transaction (migration 141), this makes a duplicate credit impossible even if the app logic is later broken.';


--
-- Name: provider_wallet; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.provider_wallet (
    provider_id uuid NOT NULL,
    balance_idr integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT provider_wallet_balance_idr_check CHECK ((balance_idr >= 0))
);


--
-- Name: TABLE provider_wallet; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.provider_wallet IS 'Provider NEX wallet · never negative · lock 38 · Philip 2026-08-29';


--
-- Name: provider_wallet_transaction; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.provider_wallet_transaction (
    transaction_id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    kind text NOT NULL,
    amount_idr integer NOT NULL,
    balance_after_idr integer NOT NULL,
    related_request_id uuid,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    related_topup_intent_id uuid,
    CONSTRAINT provider_wallet_transaction_balance_after_idr_check CHECK ((balance_after_idr >= 0)),
    CONSTRAINT provider_wallet_transaction_kind_check CHECK ((kind = ANY (ARRAY['topup'::text, 'network_fee'::text, 'refund'::text, 'adjustment'::text])))
);


--
-- Name: TABLE provider_wallet_transaction; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.provider_wallet_transaction IS 'Immutable wallet ledger · lock 44 · Philip 2026-08-29';


--
-- Name: record_versions; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.record_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    record_id text NOT NULL,
    version text NOT NULL,
    body_markdown text NOT NULL,
    change_summary text,
    changed_by text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recovery_attempts; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.recovery_attempts (
    attempt_id uuid NOT NULL,
    job_id text NOT NULL,
    level integer NOT NULL,
    level_name text NOT NULL,
    action text NOT NULL,
    at timestamp with time zone NOT NULL,
    outcome text NOT NULL,
    detail text,
    target_provider text,
    target_worker text,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recovery_attempts_level_check CHECK (((level >= 1) AND (level <= 5)))
);


--
-- Name: TABLE recovery_attempts; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.recovery_attempts IS 'Infrastructure Runtime §5.2 · Recovery Manager attempts · 180d retention';


--
-- Name: recovery_runs; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.recovery_runs (
    run_id uuid DEFAULT gen_random_uuid() NOT NULL,
    ran_at timestamp with time zone DEFAULT now() NOT NULL,
    label text,
    scenarios jsonb DEFAULT '[]'::jsonb NOT NULL,
    passed integer NOT NULL,
    failed integer NOT NULL,
    skipped integer NOT NULL,
    total integer NOT NULL,
    overall_status text NOT NULL,
    CONSTRAINT recovery_runs_overall_status_check CHECK ((overall_status = ANY (ARRAY['pass'::text, 'fail'::text, 'partial'::text])))
);


--
-- Name: TABLE recovery_runs; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.recovery_runs IS 'INSERT-only recovery-scenario history · one row per suite run · PASS/FAIL per scenario in JSONB';


--
-- Name: rollup_campaigns; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.rollup_campaigns (
    campaign_id uuid NOT NULL,
    sent integer DEFAULT 0 NOT NULL,
    delivered integer DEFAULT 0 NOT NULL,
    opens integer DEFAULT 0 NOT NULL,
    unique_opens integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    unique_clicks integer DEFAULT 0 NOT NULL,
    bounces integer DEFAULT 0 NOT NULL,
    complaints integer DEFAULT 0 NOT NULL,
    unsubscribes integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    suppressed integer DEFAULT 0 NOT NULL,
    delivery_rate numeric(5,2),
    open_rate numeric(5,2),
    click_rate numeric(5,2),
    ctor numeric(5,2),
    first_event_at timestamp with time zone,
    last_event_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE rollup_campaigns; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.rollup_campaigns IS 'Incremental per-campaign rollup · updated by ingest · 15 metric columns';


--
-- Name: rollup_country; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.rollup_country (
    country text NOT NULL,
    sent integer DEFAULT 0 NOT NULL,
    delivered integer DEFAULT 0 NOT NULL,
    opens integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    bounces integer DEFAULT 0 NOT NULL,
    unsubscribes integer DEFAULT 0 NOT NULL,
    delivery_rate numeric(5,2),
    open_rate numeric(5,2),
    click_rate numeric(5,2),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rollup_daily; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.rollup_daily (
    day date NOT NULL,
    sent integer DEFAULT 0 NOT NULL,
    delivered integer DEFAULT 0 NOT NULL,
    opens integer DEFAULT 0 NOT NULL,
    unique_opens integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    unique_clicks integer DEFAULT 0 NOT NULL,
    bounces integer DEFAULT 0 NOT NULL,
    complaints integer DEFAULT 0 NOT NULL,
    unsubscribes integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    suppressed integer DEFAULT 0 NOT NULL,
    delivery_rate numeric(5,2),
    open_rate numeric(5,2),
    click_rate numeric(5,2),
    ctor numeric(5,2),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rollup_monthly; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.rollup_monthly (
    month date NOT NULL,
    sent integer DEFAULT 0 NOT NULL,
    delivered integer DEFAULT 0 NOT NULL,
    opens integer DEFAULT 0 NOT NULL,
    unique_opens integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    unique_clicks integer DEFAULT 0 NOT NULL,
    bounces integer DEFAULT 0 NOT NULL,
    complaints integer DEFAULT 0 NOT NULL,
    unsubscribes integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    suppressed integer DEFAULT 0 NOT NULL,
    delivery_rate numeric(5,2),
    open_rate numeric(5,2),
    click_rate numeric(5,2),
    ctor numeric(5,2),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rollup_provider; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.rollup_provider (
    provider text NOT NULL,
    sent integer DEFAULT 0 NOT NULL,
    delivered integer DEFAULT 0 NOT NULL,
    opens integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    bounces integer DEFAULT 0 NOT NULL,
    complaints integer DEFAULT 0 NOT NULL,
    unsubscribes integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    avg_latency_ms integer,
    delivery_rate numeric(5,2),
    open_rate numeric(5,2),
    click_rate numeric(5,2),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rollup_segment; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.rollup_segment (
    segment_id uuid NOT NULL,
    sent integer DEFAULT 0 NOT NULL,
    delivered integer DEFAULT 0 NOT NULL,
    opens integer DEFAULT 0 NOT NULL,
    unique_opens integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    unique_clicks integer DEFAULT 0 NOT NULL,
    bounces integer DEFAULT 0 NOT NULL,
    unsubscribes integer DEFAULT 0 NOT NULL,
    campaigns_used_in integer DEFAULT 0 NOT NULL,
    delivery_rate numeric(5,2),
    open_rate numeric(5,2),
    click_rate numeric(5,2),
    engagement_score numeric(5,2),
    best_hour_utc integer,
    best_weekday integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: safety_audit_config; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.safety_audit_config (
    singleton_key text DEFAULT 'default'::text NOT NULL,
    default_retention_days integer DEFAULT 30 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT safety_audit_config_default_retention_days_check CHECK ((default_retention_days > 0)),
    CONSTRAINT safety_audit_config_singleton_key_check CHECK ((singleton_key = 'default'::text))
);


--
-- Name: safety_audit_event; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.safety_audit_event (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    action_id text NOT NULL,
    actor_user_id text NOT NULL,
    actor_display_name text NOT NULL,
    target_kind text NOT NULL,
    target_id text NOT NULL,
    target_user_id text,
    conversation_id text,
    wallet_transaction_id uuid,
    sparks_charged bigint DEFAULT 0 NOT NULL,
    success boolean NOT NULL,
    failure_reason text,
    idempotency_key text NOT NULL,
    request_ip_hash text,
    request_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    event_time_utc timestamp with time zone DEFAULT now() NOT NULL,
    retention_until timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    legal_hold boolean DEFAULT false NOT NULL,
    legal_hold_reason text,
    legal_hold_set_at timestamp with time zone,
    legal_hold_set_by text,
    CONSTRAINT safety_audit_event_event_type_check CHECK ((event_type = ANY (ARRAY['grenade'::text, 'vault'::text, 'admin_delete'::text, 'admin_adjust'::text, 'moderation_intervention'::text]))),
    CONSTRAINT safety_audit_event_sparks_charged_check CHECK ((sparks_charged >= 0)),
    CONSTRAINT safety_audit_event_target_kind_check CHECK ((target_kind = ANY (ARRAY['message'::text, 'user'::text, 'conversation'::text])))
);


--
-- Name: service_business; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.service_business (
    internal_id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_listing_ref text NOT NULL,
    business_name text NOT NULL,
    category_slug text NOT NULL,
    categories text[] DEFAULT '{}'::text[] NOT NULL,
    address text,
    city text NOT NULL,
    district text,
    coordinates_lng numeric,
    coordinates_lat numeric,
    phone text,
    whatsapp_number text,
    website text,
    public_social_links jsonb,
    source text NOT NULL,
    source_reference text,
    source_licence_terms text,
    source_updated_at timestamp with time zone,
    last_verified_at timestamp with time zone,
    verification_source text,
    owner_status text,
    hero_image_url text,
    worker_id text,
    cycle_run_id uuid,
    status text DEFAULT 'listed'::text NOT NULL,
    claimed boolean DEFAULT false NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    visibility text DEFAULT 'public'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    commercial_status text DEFAULT 'discovered'::text NOT NULL,
    qualification_reason jsonb,
    qualified_at timestamp with time zone,
    contactable_at timestamp with time zone,
    marketing_ready_at timestamp with time zone,
    last_marketing_action_at timestamp with time zone,
    next_eligible_action_at timestamp with time zone,
    marketing_cooldown_reason text,
    marketing_attempts_count integer DEFAULT 0 NOT NULL,
    conversion_status text DEFAULT 'none'::text NOT NULL,
    CONSTRAINT service_business_category_slug_check CHECK ((category_slug = ANY (ARRAY['gyms'::text, 'salons'::text, 'dentists'::text, 'opticians'::text, 'pharmacies'::text, 'car-repair'::text]))),
    CONSTRAINT service_business_commercial_status_check CHECK ((commercial_status = ANY (ARRAY['discovered'::text, 'qualified'::text, 'contactable'::text, 'marketing_ready'::text, 'attempted'::text, 'engaged'::text, 'invited'::text, 'trial'::text, 'paid'::text, 'declined'::text]))),
    CONSTRAINT service_business_conversion_status_check CHECK ((conversion_status = ANY (ARRAY['none'::text, 'trial_started'::text, 'trial_ended'::text, 'paid'::text, 'churned'::text]))),
    CONSTRAINT service_business_public_listing_ref_check CHECK ((public_listing_ref ~ '^#SB-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$'::text)),
    CONSTRAINT service_business_status_check CHECK ((status = ANY (ARRAY['listed'::text, 'archived'::text, 'suspended'::text]))),
    CONSTRAINT service_business_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'admin_only'::text, 'hidden'::text])))
);


--
-- Name: TABLE service_business; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.service_business IS 'NEX Workforce Phase 1 · public service businesses discovered by the parametric category walker (data/nex-job-registry.json). Doctrine mirrors food_business + accommodation_business: Discovery ≠ Outreach · owner_status guard · worker attribution · natural-key dedup.';


--
-- Name: COLUMN service_business.commercial_status; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.service_business.commercial_status IS '10-state funnel · owned by qualification engine (discovered→qualified→contactable→marketing_ready) and marketing workforce (attempted→engaged→invited→trial→paid→declined). See scripts/nex-commercial/_commercial-states.mjs.';


--
-- Name: COLUMN service_business.qualification_reason; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.service_business.qualification_reason IS 'Structured reason blob from last qualification engine run · records which gates the row passed (has_website, has_phone, ...) and why the current status was chosen. For HQ observability.';


--
-- Name: COLUMN service_business.next_eligible_action_at; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.service_business.next_eligible_action_at IS 'When (if ever) this business is eligible for its next marketing action. Set by marketing workforce ONLY. Value depends on per-business cadence policy (not a global 24h rule).';


--
-- Name: service_business_source_snapshot; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.service_business_source_snapshot (
    snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_ref text NOT NULL,
    source text NOT NULL,
    source_reference text NOT NULL,
    raw_payload jsonb NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    worker_id text,
    cycle_run_id uuid
);


--
-- Name: TABLE service_business_source_snapshot; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.service_business_source_snapshot IS 'Preserved raw payloads · one row per (source, source_reference) · enables future re-classification without re-fetching. Same pattern as food_business_source_snapshot / accommodation_business_source_snapshot.';


--
-- Name: service_request; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.service_request (
    request_id uuid DEFAULT gen_random_uuid() NOT NULL,
    learner_ref text NOT NULL,
    service_kind text DEFAULT 'bike'::text NOT NULL,
    destination_text text NOT NULL,
    destination_lat double precision,
    destination_lng double precision,
    origin_text text,
    origin_lat double precision,
    origin_lng double precision,
    provider_id uuid,
    state text DEFAULT 'DESTINATION'::text NOT NULL,
    state_entered_at timestamp with time zone DEFAULT now() NOT NULL,
    requested_at timestamp with time zone,
    accepted_at timestamp with time zone,
    approaching_at timestamp with time zone,
    nearby_at timestamp with time zone,
    service_started_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    failure_reason text,
    user_rating_of_provider integer,
    provider_rating_of_user integer,
    user_rating_note text,
    actual_distance_m integer,
    actual_duration_s integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    eligible_provider_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    broadcast_at timestamp with time zone,
    first_accept_window_seconds integer DEFAULT 15 NOT NULL,
    broadcast_expires_at timestamp with time zone,
    price_agreed_idr integer,
    network_fee_idr integer,
    network_fee_deducted_at timestamp with time zone,
    was_free_allowance boolean,
    CONSTRAINT service_request_first_accept_window_seconds_check CHECK (((first_accept_window_seconds >= 5) AND (first_accept_window_seconds <= 60))),
    CONSTRAINT service_request_network_fee_idr_check CHECK (((network_fee_idr IS NULL) OR (network_fee_idr >= 0))),
    CONSTRAINT service_request_price_agreed_idr_check CHECK (((price_agreed_idr IS NULL) OR (price_agreed_idr > 0))),
    CONSTRAINT service_request_provider_rating_of_user_check CHECK (((provider_rating_of_user >= 1) AND (provider_rating_of_user <= 5))),
    CONSTRAINT service_request_service_kind_check CHECK ((service_kind = ANY (ARRAY['bike'::text, 'parcel'::text, 'food'::text]))),
    CONSTRAINT service_request_state_check CHECK ((state = ANY (ARRAY['DESTINATION'::text, 'NETWORK_CHECK'::text, 'PROVIDERS'::text, 'REQUEST_BROADCAST'::text, 'CONNECTED'::text, 'APPROACHING'::text, 'NEARBY'::text, 'SERVICE'::text, 'COMPLETED'::text, 'CANCELLED_BY_USER'::text, 'DECLINED_BY_PROVIDER'::text, 'TIMED_OUT'::text, 'PROVIDER_LOST_SIGNAL'::text]))),
    CONSTRAINT service_request_user_rating_of_provider_check CHECK (((user_rating_of_provider >= 1) AND (user_rating_of_provider <= 5)))
);


--
-- Name: TABLE service_request; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.service_request IS 'NEX Mobility Connection State Machine · one row per service request · Philip 2026-08-29 · doctrine: NEX presents providers, user selects, provider accepts, NEX connects · NEX does not dispatch';


--
-- Name: COLUMN service_request.eligible_provider_ids; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.service_request.eligible_provider_ids IS 'The set of provider_ids the request was broadcast to · lock 28 · first to accept wins · others notified withdrawn';


--
-- Name: COLUMN service_request.first_accept_window_seconds; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.service_request.first_accept_window_seconds IS 'Internal mechanics · NEVER surfaced as a countdown to user · v1 = 15s per Grab Indonesia reference';


--
-- Name: COLUMN service_request.broadcast_expires_at; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.service_request.broadcast_expires_at IS 'Computed cutoff · if no accept by this timestamp, transition to TIMED_OUT and surface calm retry';


--
-- Name: COLUMN service_request.price_agreed_idr; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.service_request.price_agreed_idr IS 'Snapshot of the accepted provider price at CONNECT time · lock 31 · future provider price changes never corrupt this record';


--
-- Name: COLUMN service_request.network_fee_idr; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.service_request.network_fee_idr IS '8% of price_agreed_idr · 0 when consumed monthly allowance · lock 39';


--
-- Name: COLUMN service_request.was_free_allowance; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.service_request.was_free_allowance IS 'True when this completed request consumed one of the provider''s 2 free-fee monthly slots';


--
-- Name: service_request_offer; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.service_request_offer (
    offer_id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    offered_price_idr integer NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    seen_at timestamp with time zone,
    responded_at timestamp with time zone,
    response text,
    CONSTRAINT service_request_offer_offered_price_idr_check CHECK ((offered_price_idr > 0)),
    CONSTRAINT service_request_offer_response_check CHECK ((response = ANY (ARRAY['accepted'::text, 'declined'::text, 'withdrawn'::text, 'expired'::text])))
);


--
-- Name: TABLE service_request_offer; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.service_request_offer IS 'One row per (request, eligible_provider) pair · records the race · unique-accepted index enforces first-to-accept-wins at DB level · Philip 2026-08-29';


--
-- Name: social_accounts; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_accounts (
    account_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    platform text NOT NULL,
    display_name text,
    platform_account_id text,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    connected_at timestamp with time zone,
    last_success_at timestamp with time zone,
    last_error text,
    token_expires_at timestamp with time zone,
    access_token_ct bytea,
    refresh_token_ct bytea,
    granted_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    access_dek_id uuid,
    access_token_nonce bytea,
    access_token_auth_tag bytea,
    refresh_dek_id uuid,
    refresh_token_nonce bytea,
    refresh_token_auth_tag bytea,
    CONSTRAINT social_accounts_platform_check CHECK ((platform = ANY (ARRAY['facebook'::text, 'instagram'::text, 'linkedin'::text, 'tiktok'::text, 'google_business'::text, 'simulator'::text]))),
    CONSTRAINT social_accounts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'connected'::text, 'attention_required'::text, 'expired'::text, 'revoked'::text, 'disabled'::text])))
);

ALTER TABLE ONLY nex.social_accounts FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_accounts; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_accounts IS 'Charter §S-IX · encrypted tokens (Phase 1) · never exposed to UI';


--
-- Name: social_admin_access_log; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_admin_access_log (
    access_id bigint NOT NULL,
    admin_user_id text NOT NULL,
    target_tenant_id uuid NOT NULL,
    resource text NOT NULL,
    reason text NOT NULL,
    row_count integer,
    accessed_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY nex.social_admin_access_log FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_admin_access_log; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_admin_access_log IS 'Charter §0 Boundary 3 · every cross-tenant admin read logged here';


--
-- Name: social_admin_access_log_access_id_seq; Type: SEQUENCE; Schema: nex; Owner: -
--

CREATE SEQUENCE nex.social_admin_access_log_access_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: social_admin_access_log_access_id_seq; Type: SEQUENCE OWNED BY; Schema: nex; Owner: -
--

ALTER SEQUENCE nex.social_admin_access_log_access_id_seq OWNED BY nex.social_admin_access_log.access_id;


--
-- Name: social_audit_events; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_audit_events (
    audit_id bigint NOT NULL,
    tenant_id uuid NOT NULL,
    event_type text NOT NULL,
    actor text NOT NULL,
    subject_kind text,
    subject_id text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY nex.social_audit_events FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_audit_events; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_audit_events IS 'Charter enforcement · append-only INSERT-only';


--
-- Name: social_audit_events_audit_id_seq; Type: SEQUENCE; Schema: nex; Owner: -
--

CREATE SEQUENCE nex.social_audit_events_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: social_audit_events_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: nex; Owner: -
--

ALTER SEQUENCE nex.social_audit_events_audit_id_seq OWNED BY nex.social_audit_events.audit_id;


--
-- Name: social_brand_profiles; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_brand_profiles (
    tenant_id uuid NOT NULL,
    tone text DEFAULT 'friendly'::text NOT NULL,
    additional_whitelist text[] DEFAULT '{}'::text[] NOT NULL,
    forbidden_terms text[] DEFAULT '{}'::text[] NOT NULL,
    required_hashtags text[] DEFAULT '{}'::text[] NOT NULL,
    required_disclaimers jsonb DEFAULT '[]'::jsonb NOT NULL,
    preferred_cta_defaults jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_brand_profiles_tone_check CHECK ((tone = ANY (ARRAY['professional'::text, 'friendly'::text, 'premium'::text, 'traditional'::text, 'modern'::text, 'technical'::text, 'local'::text])))
);

ALTER TABLE ONLY nex.social_brand_profiles FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_brand_profiles; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_brand_profiles IS 'Charter §S-VIII Brand stage · per-tenant brand configuration · forbidden terms, required tags, tone whitelist supplement';


--
-- Name: social_category_automation; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_category_automation (
    tenant_id uuid NOT NULL,
    category text NOT NULL,
    mode text DEFAULT 'manual'::text NOT NULL,
    enabled_by text,
    enabled_at timestamp with time zone,
    last_check_in_at timestamp with time zone,
    auto_degraded_at timestamp with time zone,
    auto_degraded_reason text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_category_automation_category_check CHECK ((category = ANY (ARRAY['project'::text, 'educational'::text, 'inspiration'::text, 'product'::text, 'faq'::text, 'before_after'::text, 'testimonial'::text, 'seasonal'::text, 'company'::text, 'offer'::text]))),
    CONSTRAINT social_category_automation_mode_check CHECK ((mode = ANY (ARRAY['manual'::text, 'assisted'::text, 'automatic'::text])))
);

ALTER TABLE ONLY nex.social_category_automation FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_category_automation; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_category_automation IS 'Charter §S-V per-category opt-in · 14-day active-consent auto-degrade lives on this row';


--
-- Name: social_content_drafts; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_content_drafts (
    draft_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid,
    generation_mode text DEFAULT 'template_fill'::text NOT NULL,
    platform text NOT NULL,
    caption text NOT NULL,
    hashtags text[] DEFAULT '{}'::text[] NOT NULL,
    cta text,
    source_refs uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    claims jsonb DEFAULT '[]'::jsonb NOT NULL,
    provenance jsonb DEFAULT '{}'::jsonb NOT NULL,
    grounding_state text DEFAULT 'pending'::text NOT NULL,
    rejection_reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    validator_run_id uuid,
    CONSTRAINT social_content_drafts_generation_mode_check CHECK ((generation_mode = ANY (ARRAY['template_fill'::text, 'llm_composed'::text]))),
    CONSTRAINT social_content_drafts_grounding_state_check CHECK ((grounding_state = ANY (ARRAY['pending'::text, 'grounded'::text, 'rejected'::text])))
);

ALTER TABLE ONLY nex.social_content_drafts FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_content_drafts; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_content_drafts IS 'Charter §S-III · one row per generated draft · provenance JSONB traces every variable to source · grounding_state one-way transition';


--
-- Name: social_content_sources; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_content_sources (
    source_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    kind text NOT NULL,
    slug text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    rights_status text DEFAULT 'unknown'::text NOT NULL,
    contains_identifiable_persons boolean DEFAULT false NOT NULL,
    person_release_evidence_url text,
    attested_by text,
    attested_at timestamp with time zone,
    attestation_ip inet,
    expires_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_content_sources_kind_check CHECK ((kind = ANY (ARRAY['business_profile'::text, 'project'::text, 'product'::text, 'service'::text, 'offer'::text, 'testimonial'::text, 'faq'::text, 'company_milestone'::text, 'review_aggregate'::text, 'certification'::text, 'award'::text, 'press_mention'::text, 'service_area'::text]))),
    CONSTRAINT social_content_sources_rights_status_check CHECK ((rights_status = ANY (ARRAY['owned'::text, 'uploaded_by_customer_attested'::text, 'licensed_with_expiry'::text, 'licensed_expires_at_null_forbidden'::text, 'nex_owned_evergreen'::text, 'nex_owned_licensed_with_expiry'::text, 'approved_nex_asset'::text, 'ai_generated_provenance_pending'::text, 'unknown'::text, 'restricted'::text])))
);

ALTER TABLE ONLY nex.social_content_sources FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_content_sources; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_content_sources IS 'Charter §S-III + §S-IV · merchant-authorised source data · rights_status gates autopublish visibility';


--
-- Name: social_content_templates; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_content_templates (
    template_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    slug text NOT NULL,
    kind text NOT NULL,
    body text NOT NULL,
    variable_slots jsonb DEFAULT '[]'::jsonb NOT NULL,
    hashtags_slots jsonb DEFAULT '[]'::jsonb NOT NULL,
    cta_slot jsonb,
    min_source_refs integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_content_templates_kind_check CHECK ((kind = ANY (ARRAY['project'::text, 'educational'::text, 'inspiration'::text, 'product'::text, 'faq'::text, 'before_after'::text, 'testimonial'::text, 'seasonal'::text, 'company'::text, 'offer'::text]))),
    CONSTRAINT social_content_templates_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'retired'::text])))
);

ALTER TABLE ONLY nex.social_content_templates FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_content_templates; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_content_templates IS 'Charter §S-III · template-fill mode · typed variable slots · tenant-owned or Nex-owned global';


--
-- Name: social_controls; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_controls (
    singleton boolean DEFAULT true NOT NULL,
    global_pause boolean DEFAULT false NOT NULL,
    global_pause_at timestamp with time zone,
    global_pause_by text,
    global_pause_reason text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_controls_singleton_check CHECK ((singleton = true))
);

ALTER TABLE ONLY nex.social_controls FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_controls; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_controls IS 'Charter §S-V global kill switch';


--
-- Name: social_dek_wraps; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_dek_wraps (
    dek_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    purpose text NOT NULL,
    wrapped_dek bytea NOT NULL,
    wrap_nonce bytea NOT NULL,
    wrap_auth_tag bytea NOT NULL,
    kek_version text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rotated_at timestamp with time zone,
    retired_at timestamp with time zone,
    CONSTRAINT social_dek_wraps_purpose_check CHECK ((purpose = ANY (ARRAY['access_token'::text, 'refresh_token'::text, 'oauth_state'::text]))),
    CONSTRAINT social_dek_wraps_status_check CHECK ((status = ANY (ARRAY['active'::text, 'rotating'::text, 'retired'::text])))
);

ALTER TABLE ONLY nex.social_dek_wraps FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_dek_wraps; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_dek_wraps IS 'Charter §S-IX · per-tenant per-purpose DEKs wrapped by KEK · one active DEK per (tenant,purpose) at a time · rotation-ready';


--
-- Name: social_oauth_states; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_oauth_states (
    state_token text NOT NULL,
    tenant_id uuid NOT NULL,
    platform text NOT NULL,
    initiated_by text NOT NULL,
    redirect_to text,
    code_verifier bytea,
    code_verifier_nonce bytea,
    code_verifier_dek_id uuid,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY nex.social_oauth_states FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_oauth_states; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_oauth_states IS 'Phase 1 · single-use CSRF state for inflight OAuth flows · expires_at + consumed_at enforce one-shot semantics';


--
-- Name: social_publish_intents; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_publish_intents (
    intent_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    post_id uuid NOT NULL,
    platform text NOT NULL,
    account_id uuid NOT NULL,
    retry_epoch integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'in_flight'::text NOT NULL,
    provider_marker text,
    provider_post_id text,
    attempts integer DEFAULT 1 NOT NULL,
    lease_owner text,
    lease_expires_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    verified_at timestamp with time zone,
    error text,
    scheduled_id uuid,
    worker_id text,
    final_outcome text,
    CONSTRAINT social_publish_intents_final_outcome_check CHECK (((final_outcome = ANY (ARRAY['verified_published'::text, 'verified_no_op'::text, 'failed'::text, 'abandoned'::text])) OR (final_outcome IS NULL))),
    CONSTRAINT social_publish_intents_status_check CHECK ((status = ANY (ARRAY['in_flight'::text, 'verified_published'::text, 'verified_no_op'::text, 'failed'::text, 'abandoned'::text])))
);

ALTER TABLE ONLY nex.social_publish_intents FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_publish_intents; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_publish_intents IS 'Charter §S-VII · two-phase publish idempotency · UNIQUE(tenant,post,platform,account,epoch)';


--
-- Name: social_role_grants; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_role_grants (
    grant_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id text NOT NULL,
    role text NOT NULL,
    granted_by text,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    reason text,
    CONSTRAINT social_role_grants_publish_max_24h CHECK (((role <> 'nex_admin_publish'::text) OR ((expires_at IS NOT NULL) AND (expires_at <= (granted_at + '24:00:00'::interval))))),
    CONSTRAINT social_role_grants_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'marketing_manager'::text, 'staff'::text, 'viewer'::text, 'agency_manager'::text, 'nex_admin_support'::text, 'nex_admin_publish'::text])))
);

ALTER TABLE ONLY nex.social_role_grants FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_role_grants; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_role_grants IS 'Charter §S-V role scoping · nex_admin_publish max 24h (approved A5)';


--
-- Name: social_scheduled_posts; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_scheduled_posts (
    scheduled_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    draft_id uuid NOT NULL,
    account_id uuid NOT NULL,
    platform text NOT NULL,
    run_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    lease_owner text,
    lease_expires_at timestamp with time zone,
    intent_id uuid,
    last_error text,
    refused_reasons jsonb,
    enqueued_by text NOT NULL,
    enqueued_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT social_scheduled_posts_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'leased'::text, 'dispatched'::text, 'published'::text, 'refused_at_recheck'::text, 'failed'::text, 'paused_at_lease'::text, 'abandoned'::text])))
);

ALTER TABLE ONLY nex.social_scheduled_posts FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_scheduled_posts; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_scheduled_posts IS 'Charter §S-VI one-way pipeline · lease pattern · re-check pause on acquisition · Phase 4 worker consumes';


--
-- Name: social_tenants; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_tenants (
    tenant_id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    country text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_supabase_user_id text,
    merchant_slug text,
    CONSTRAINT social_tenants_kind_check CHECK ((kind = ANY (ARRAY['hq'::text, 'trade'::text]))),
    CONSTRAINT social_tenants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'deleted'::text])))
);

ALTER TABLE ONLY nex.social_tenants FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_tenants; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_tenants IS 'Charter §0 Boundary 1 · first-class multi-tenancy · HQ or trade';


--
-- Name: COLUMN social_tenants.owner_supabase_user_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.social_tenants.owner_supabase_user_id IS 'Phase 10 · Supabase Auth user id (hammerex_nex_users.supabase_user_id) for merchant-provisioned tenants · nullable for legacy HQ/admin tenants · unique when set + not deleted';


--
-- Name: COLUMN social_tenants.merchant_slug; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.social_tenants.merchant_slug IS 'Phase 10.1 · Hammerex trade-off listing slug for tier resolution (hammerex_trade_off_listings.slug) · nullable · set at provision time by matching the auth user email against listings.email';


--
-- Name: social_validator_runs; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.social_validator_runs (
    run_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    draft_id uuid,
    subject text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    total_ms integer,
    stages jsonb DEFAULT '[]'::jsonb NOT NULL,
    outcome text DEFAULT 'pending'::text NOT NULL,
    rejection_summary jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT social_validator_runs_outcome_check CHECK ((outcome = ANY (ARRAY['pending'::text, 'passed'::text, 'rejected'::text, 'failed_closed'::text]))),
    CONSTRAINT social_validator_runs_subject_check CHECK ((subject = ANY (ARRAY['draft'::text, 'ad_hoc'::text, 'at_adapter_call'::text])))
);

ALTER TABLE ONLY nex.social_validator_runs FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE social_validator_runs; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.social_validator_runs IS 'Charter §S-VIII pipeline audit · one row per run · INSERT-only · stages JSONB captures ordered per-stage outcomes';


--
-- Name: sources; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    record_id text,
    inbox_item_id text,
    source_tier text NOT NULL,
    source_url text,
    source_hash text,
    excerpt text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sources_source_tier_check CHECK ((source_tier = ANY (ARRAY['chatgpt-approved'::text, 'claude-generated'::text, 'raw-research'::text, 'internet-article'::text, 'needs-verification'::text, 'gov-standards'::text, 'customer-qa'::text, 'personal-ideas'::text])))
);


--
-- Name: sparks_product; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.sparks_product (
    product_id text NOT NULL,
    sparks_amount bigint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    display_name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sparks_product_sparks_amount_check CHECK ((sparks_amount > 0))
);


--
-- Name: sparks_product_price; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.sparks_product_price (
    product_id text NOT NULL,
    region text NOT NULL,
    currency text NOT NULL,
    amount_minor bigint NOT NULL,
    stripe_price_id text,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tracking_events; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.tracking_events (
    event_id uuid NOT NULL,
    session_id text,
    contact_id text,
    fingerprint text,
    event_name text NOT NULL,
    path text,
    referrer text,
    user_agent text,
    ip_prefix text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    server_received_at timestamp with time zone,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE tracking_events; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.tracking_events IS 'Infrastructure Runtime §5.5 · Event Tracking Service · 365d retention';


--
-- Name: transport_acquisition_outreach; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.transport_acquisition_outreach (
    outreach_id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    recipient_channel text NOT NULL,
    recipient_reference text NOT NULL,
    source_evidence_snapshot_id uuid NOT NULL,
    message_version text NOT NULL,
    sent_at timestamp with time zone,
    response text,
    response_at timestamp with time zone,
    opted_out_at timestamp with time zone,
    handled_by text,
    status text DEFAULT 'draft'::text NOT NULL,
    CONSTRAINT transport_acquisition_outreach_recipient_channel_check CHECK ((recipient_channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'sms'::text, 'call'::text]))),
    CONSTRAINT transport_acquisition_outreach_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready_to_send'::text, 'sent'::text, 'delivered'::text, 'responded'::text, 'opted_out'::text, 'refused'::text])))
);


--
-- Name: TABLE transport_acquisition_outreach; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.transport_acquisition_outreach IS 'Outreach ledger. Each outreach REQUIRES a source_evidence_snapshot_id proving the recipient contact was publicly advertised. No automatic sender in this migration · a separate approved unit would activate sending.';


--
-- Name: transport_acquisition_record; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.transport_acquisition_record (
    provider_id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_kind nex.transport_provider_kind DEFAULT 'unknown'::nex.transport_provider_kind NOT NULL,
    business_name text,
    contact_person_name text,
    canonical_phone_e164 text,
    public_whatsapp_link text,
    public_email text,
    website text,
    home_jurisdiction text,
    city text,
    province text,
    service_areas text[] DEFAULT '{}'::text[] NOT NULL,
    vehicle_types nex.transport_vehicle_ontology[] DEFAULT '{}'::nex.transport_vehicle_ontology[] NOT NULL,
    vehicle_models_public jsonb DEFAULT '[]'::jsonb NOT NULL,
    supports_airport boolean DEFAULT false NOT NULL,
    supports_parcel boolean DEFAULT false NOT NULL,
    supports_passenger boolean DEFAULT false NOT NULL,
    supports_tourist boolean DEFAULT false NOT NULL,
    supports_logistics boolean DEFAULT false NOT NULL,
    public_registration_info text,
    discovery_stage nex.transport_recruitment_stage DEFAULT 'discovered'::nex.transport_recruitment_stage NOT NULL,
    contactability nex.transport_contactability DEFAULT 'unknown'::nex.transport_contactability NOT NULL,
    review_flags nex.transport_review_flag[] DEFAULT '{}'::nex.transport_review_flag[] NOT NULL,
    first_discovered_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_run_id uuid,
    provenance jsonb DEFAULT '{}'::jsonb NOT NULL,
    worker_id text,
    CONSTRAINT dedupe_needs_key CHECK (((canonical_phone_e164 IS NOT NULL) OR (business_name IS NOT NULL)))
);


--
-- Name: TABLE transport_acquisition_record; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.transport_acquisition_record IS 'Publicly-advertised transport providers discovered by the Transport Walker. DISCOVERY only · never a verified driver. Deduplication key: canonical_phone_e164. All fields must trace to a public-source snapshot.';


--
-- Name: COLUMN transport_acquisition_record.canonical_phone_e164; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.transport_acquisition_record.canonical_phone_e164 IS 'E.164 normalised phone. Public phone/WhatsApp collapses here so 0812x = +62812x = 62812x resolve to one provider.';


--
-- Name: COLUMN transport_acquisition_record.discovery_stage; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.transport_acquisition_record.discovery_stage IS 'Recruitment funnel stage. NEVER skip stages. discovered → public_contact_verified → invitable → invited → interested → registration_started → registered → kyc_pending → vehicle_pending → insurance_pending → legal_review → verified → active. Terminals: declined · unreachable · opted_out.';


--
-- Name: COLUMN transport_acquisition_record.worker_id; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.transport_acquisition_record.worker_id IS 'Persistence contract 2026-08-26 · worker_id matching nex.worker_heartbeat.worker_id. Complements existing cycle_run_id (migration 093) for three-way SELECT-verify. NULL for pre-contract rows.';


--
-- Name: transport_acquisition_source_snapshot; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.transport_acquisition_source_snapshot (
    snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    source_url text NOT NULL,
    source_kind nex.transport_source_kind NOT NULL,
    source_captured_at timestamp with time zone DEFAULT now() NOT NULL,
    source_licence_terms text,
    raw_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    public_evidence_note text,
    ingested_by text,
    cycle_run_id uuid,
    CONSTRAINT source_kind_must_be_public CHECK ((source_kind <> 'unknown_or_disallowed'::nex.transport_source_kind))
);


--
-- Name: TABLE transport_acquisition_source_snapshot; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.transport_acquisition_source_snapshot IS 'Public-source snapshot per provider. CHECK constraint refuses to persist unknown_or_disallowed sources. Every field on transport_acquisition_record must trace back to at least one snapshot here.';


--
-- Name: user_wallet; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.user_wallet (
    user_id text NOT NULL,
    sparks_balance bigint DEFAULT 0 NOT NULL,
    lifetime_granted bigint DEFAULT 0 NOT NULL,
    lifetime_purchased bigint DEFAULT 0 NOT NULL,
    lifetime_spent bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_wallet_lifetime_granted_check CHECK ((lifetime_granted >= 0)),
    CONSTRAINT user_wallet_lifetime_purchased_check CHECK ((lifetime_purchased >= 0)),
    CONSTRAINT user_wallet_lifetime_spent_check CHECK ((lifetime_spent >= 0)),
    CONSTRAINT user_wallet_sparks_balance_check CHECK ((sparks_balance >= 0))
);


--
-- Name: video_feed_impression; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.video_feed_impression (
    impression_id uuid DEFAULT gen_random_uuid() NOT NULL,
    media_id uuid NOT NULL,
    viewer_id text NOT NULL,
    session_id text,
    watched_ms integer DEFAULT 0 NOT NULL,
    seen_at timestamp with time zone DEFAULT now() NOT NULL,
    unmuted boolean DEFAULT false NOT NULL,
    extras jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: TABLE video_feed_impression; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.video_feed_impression IS 'NEX Video Feed V1 impressions · Philip 2026-08-27. Row per view. Answers the ramp gate question for Stage 3 (social layer): "will people actually watch NEX videos?" Meaningful daily impressions + non-trivial watched_ms + return viewers → proceed to social layer. Otherwise do NOT build follow/like/comment on top of a dead feed.';


--
-- Name: wallet_transaction; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.wallet_transaction (
    transaction_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    kind text NOT NULL,
    delta_sparks bigint NOT NULL,
    idempotency_key text NOT NULL,
    related_transaction_id uuid,
    action_id text,
    purchase_ref text,
    operator_id text,
    note text,
    balance_after bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallet_transaction_balance_after_check CHECK ((balance_after >= 0)),
    CONSTRAINT wallet_transaction_kind_check CHECK ((kind = ANY (ARRAY['signup_grant'::text, 'promotion_grant'::text, 'admin_adjustment'::text, 'purchase'::text, 'spend_reserved'::text, 'spend_committed'::text, 'spend_refunded'::text])))
);


--
-- Name: work_item; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.work_item (
    work_item_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    job_slug text NOT NULL,
    city text NOT NULL,
    status text NOT NULL,
    worker_id uuid,
    cycle_run_id uuid,
    lease_owner text,
    lease_expires_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 4 NOT NULL,
    next_retry_at timestamp with time zone,
    last_error text,
    last_error_class text,
    error_history jsonb DEFAULT '[]'::jsonb NOT NULL,
    records_processed integer,
    records_new integer,
    cycle_outcome text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    CONSTRAINT work_item_attempt_count_nonneg CHECK ((attempt_count >= 0)),
    CONSTRAINT work_item_last_error_bounded CHECK (((last_error IS NULL) OR (char_length(last_error) <= 2048))),
    CONSTRAINT work_item_max_attempts_positive CHECK ((max_attempts > 0)),
    CONSTRAINT work_item_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'leased'::text, 'running'::text, 'completed'::text, 'retrying'::text, 'waiting_network'::text, 'failed'::text, 'dead_letter'::text])))
);


--
-- Name: TABLE work_item; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.work_item IS 'Phase 1B.1 (Philip 2026-09-02) · durable per-cycle work-item for the NEX Acquisition Workforce. One row per scheduled acquisition attempt. Written by the supervisor BEFORE spawning the child walker so a crash mid-cycle does not lose the unit of work. Empty in 1B.1 (schema only); consumer wiring is 1B.2.';


--
-- Name: COLUMN work_item.idempotency_key; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.work_item.idempotency_key IS 'sha256 of (job_slug + city + time-bucket). Bucket width = supervisor CYCLE_MIN_GAP_MS. Prevents duplicate enqueue of the SAME scheduled work; allows the SAME (job_slug, city) in the NEXT legitimate bucket.';


--
-- Name: COLUMN work_item.status; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.work_item.status IS 'State machine: queued/leased/running/completed/retrying/waiting_network/failed/dead_letter. Valid transitions documented in the migration header comment. No trigger enforcement in 1B.1.';


--
-- Name: COLUMN work_item.lease_expires_at; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.work_item.lease_expires_at IS 'NULL when status ∈ {queued, waiting_network, retrying, completed, failed, dead_letter}. Not NULL when status ∈ {leased, running}. Reclaim protocol lives in the supervisor.';


--
-- Name: COLUMN work_item.last_error; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.work_item.last_error IS 'Bounded to 2048 characters via CHECK constraint · consumer must not attempt to store unbounded child-process output.';


--
-- Name: COLUMN work_item.error_history; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.work_item.error_history IS 'JSONB array of prior errors. Consumer implementation MUST cap the number of retained entries (recommendation: last 20). No cap enforced in DDL.';


--
-- Name: COLUMN work_item.records_processed; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.work_item.records_processed IS 'Copied from child walker''s nex.worker_cycle_run.records_processed on completion. Advisory · not the source of truth for productivity (the count of status=completed rows in the productive window is).';


--
-- Name: worker_cycle_run; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.worker_cycle_run (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    worker_id text NOT NULL,
    worker_type text NOT NULL,
    worker_config text,
    job_id_external text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    duration_ms integer,
    status text DEFAULT 'running'::text NOT NULL,
    records_processed integer,
    records_new integer,
    records_rejected integer,
    errors_count integer DEFAULT 0 NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    audit_report_path text,
    doctrine_checks jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT worker_cycle_run_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'aborted'::text])))
);


--
-- Name: TABLE worker_cycle_run; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.worker_cycle_run IS 'Append-only cycle log. One row per completed worker cycle. Doctrine checks captured so reliability layer can prove invariants held (Discovery ≠ Outreach · Observe ≠ Teach · Candidate ≠ Promotion).';


--
-- Name: worker_24h_activity; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.worker_24h_activity AS
 SELECT worker_id,
    worker_type,
    worker_config,
    (count(*))::integer AS cycles_run,
    (count(*) FILTER (WHERE (status = 'completed'::text)))::integer AS cycles_completed,
    (count(*) FILTER (WHERE (status = 'failed'::text)))::integer AS cycles_failed,
    (COALESCE(sum(records_processed), (0)::bigint))::integer AS total_records_processed,
    (COALESCE(sum(records_new), (0)::bigint))::integer AS total_records_new,
    (COALESCE(sum(errors_count), (0)::bigint))::integer AS total_errors,
    min(started_at) AS first_cycle_at,
    max(started_at) AS last_cycle_at,
    COALESCE((round(avg(duration_ms)))::integer, 0) AS avg_duration_ms
   FROM nex.worker_cycle_run
  WHERE (started_at > (now() - '24:00:00'::interval))
  GROUP BY worker_id, worker_type, worker_config
  ORDER BY worker_type, worker_id;


--
-- Name: VIEW worker_24h_activity; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON VIEW nex.worker_24h_activity IS 'Rolling-24h aggregation per worker. Read by report-24h generator + voice endpoint.';


--
-- Name: worker_audit_events; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.worker_audit_events (
    event_id uuid NOT NULL,
    worker_type text NOT NULL,
    event_type text NOT NULL,
    actor text,
    job_id text,
    input_ref text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    latency_ms integer,
    tokens_in integer,
    tokens_out integer,
    provider text,
    model text,
    error text,
    business_id uuid,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE worker_audit_events; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.worker_audit_events IS 'Infrastructure Runtime §5.1 · Worker Manager audit trail · 90d retention';


--
-- Name: worker_schedule; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.worker_schedule (
    worker_id text NOT NULL,
    worker_type text NOT NULL,
    worker_config text,
    interval_seconds integer NOT NULL,
    grace_window_sec integer DEFAULT 300 NOT NULL,
    schedule_started_at timestamp with time zone DEFAULT now() NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    CONSTRAINT worker_schedule_grace_window_sec_check CHECK ((grace_window_sec >= 0)),
    CONSTRAINT worker_schedule_interval_seconds_check CHECK ((interval_seconds >= 60))
);


--
-- Name: TABLE worker_schedule; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.worker_schedule IS 'Per-worker schedule definition. Interval-based (not cron): worker is expected to run every interval_seconds starting from schedule_started_at. Grace window allows for late starts before flagging missed. Real cron/systemd/Vercel-cron is a deployment concern — this table only records what NEX EXPECTS.';


--
-- Name: worker_expected_runs; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.worker_expected_runs AS
 SELECT s.worker_id,
    s.worker_type,
    s.worker_config,
    s.interval_seconds,
    s.grace_window_sec,
    expected_at.expected_at,
    cr.id AS matched_cycle_run_id,
    cr.started_at AS matched_started_at,
    cr.finished_at AS matched_finished_at,
    cr.status AS matched_status,
        CASE
            WHEN (cr.id IS NOT NULL) THEN 'matched'::text
            WHEN ((expected_at.expected_at + ((s.grace_window_sec || ' seconds'::text))::interval) < now()) THEN 'missed'::text
            WHEN (expected_at.expected_at > now()) THEN 'future'::text
            ELSE 'pending'::text
        END AS run_status,
        CASE
            WHEN ((cr.id IS NULL) AND ((expected_at.expected_at + ((s.grace_window_sec || ' seconds'::text))::interval) < now())) THEN (EXTRACT(epoch FROM (now() - expected_at.expected_at)))::integer
            ELSE NULL::integer
        END AS missed_by_seconds
   FROM ((nex.worker_schedule s
     CROSS JOIN LATERAL generate_series(s.schedule_started_at, now(), ((s.interval_seconds || ' seconds'::text))::interval) expected_at(expected_at))
     LEFT JOIN LATERAL ( SELECT cr_1.id,
            cr_1.started_at,
            cr_1.finished_at,
            cr_1.status
           FROM nex.worker_cycle_run cr_1
          WHERE ((cr_1.worker_id = s.worker_id) AND (cr_1.started_at >= expected_at.expected_at) AND (cr_1.started_at <= (expected_at.expected_at + ((s.grace_window_sec || ' seconds'::text))::interval)))
          ORDER BY cr_1.started_at
         LIMIT 1) cr ON (true))
  WHERE ((s.enabled = true) AND (expected_at.expected_at > (now() - '7 days'::interval)));


--
-- Name: VIEW worker_expected_runs; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON VIEW nex.worker_expected_runs IS 'Every expected run for enabled workers over the last 7 days · joined with matching cycle_run within grace window. run_status: matched · missed · pending · future. Deterministic derivation from schedule + cycle_run · no LLM.';


--
-- Name: worker_heartbeat; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.worker_heartbeat (
    worker_id text NOT NULL,
    worker_type text NOT NULL,
    worker_config text,
    last_heartbeat_at timestamp with time zone NOT NULL,
    last_status text DEFAULT 'idle'::text NOT NULL,
    last_cycle_run_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT worker_heartbeat_status_check CHECK ((last_status = ANY (ARRAY['idle'::text, 'running'::text, 'waiting'::text, 'standby'::text, 'completed'::text, 'failed'::text, 'stopped'::text])))
);


--
-- Name: TABLE worker_heartbeat; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.worker_heartbeat IS 'Per-worker liveness. Every worker calls upsert on this table at cycle start + finish + failure. Reliability layer reads it to compute health.';


--
-- Name: COLUMN worker_heartbeat.last_status; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON COLUMN nex.worker_heartbeat.last_status IS 'Unified worker status vocabulary (Task #72 Step 1c 2026-08-22): idle (no cycle, was idle) · running (cycle in flight) · waiting (blocked on external resource · e.g. LLM) · standby (no cycle, ready) · completed (last cycle finished) · failed (last cycle failed) · stopped (deliberately shut down). "offline" is DERIVED from last_heartbeat_at freshness · NEVER stored.';


--
-- Name: worker_missed_runs_24h; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.worker_missed_runs_24h AS
 SELECT worker_id,
    worker_type,
    worker_config,
    expected_at,
    missed_by_seconds,
    grace_window_sec
   FROM nex.worker_expected_runs
  WHERE ((run_status = 'missed'::text) AND (expected_at > (now() - '24:00:00'::interval)))
  ORDER BY expected_at DESC;


--
-- Name: VIEW worker_missed_runs_24h; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON VIEW nex.worker_missed_runs_24h IS 'Rolling 24h missed-run alerts. Empty = every scheduled run either matched a cycle_run or is still within grace window. Non-empty = MISSED_RUN health state escalation for those workers · surfaced by watchdog + 24h report + voice.';


--
-- Name: worker_health_status; Type: VIEW; Schema: nex; Owner: -
--

CREATE VIEW nex.worker_health_status AS
 WITH latest_cycles AS (
         SELECT DISTINCT ON (worker_cycle_run.worker_id) worker_cycle_run.id,
            worker_cycle_run.worker_id,
            worker_cycle_run.worker_type,
            worker_cycle_run.worker_config,
            worker_cycle_run.job_id_external,
            worker_cycle_run.started_at,
            worker_cycle_run.finished_at,
            worker_cycle_run.duration_ms,
            worker_cycle_run.status,
            worker_cycle_run.records_processed,
            worker_cycle_run.records_new,
            worker_cycle_run.records_rejected,
            worker_cycle_run.errors_count,
            worker_cycle_run.summary,
            worker_cycle_run.audit_report_path,
            worker_cycle_run.doctrine_checks
           FROM nex.worker_cycle_run
          ORDER BY worker_cycle_run.worker_id, worker_cycle_run.started_at DESC
        ), recent_failure_counts AS (
         SELECT worker_cycle_run.worker_id,
            (count(*))::integer AS recent_failures
           FROM nex.worker_cycle_run
          WHERE ((worker_cycle_run.started_at > (now() - '24:00:00'::interval)) AND (worker_cycle_run.status = 'failed'::text))
          GROUP BY worker_cycle_run.worker_id
        ), recent_missed_counts AS (
         SELECT worker_missed_runs_24h.worker_id,
            (count(*))::integer AS recent_misses
           FROM nex.worker_missed_runs_24h
          GROUP BY worker_missed_runs_24h.worker_id
        )
 SELECT h.worker_id,
    h.worker_type,
    h.worker_config,
    h.last_heartbeat_at,
    h.last_status,
    (EXTRACT(epoch FROM (now() - h.last_heartbeat_at)))::integer AS seconds_since_heartbeat,
    lc.started_at AS last_cycle_started_at,
    lc.finished_at AS last_cycle_finished_at,
    lc.status AS last_cycle_status,
    lc.duration_ms AS last_cycle_duration_ms,
    lc.records_processed AS last_cycle_records_processed,
    lc.records_new AS last_cycle_records_new,
    lc.errors_count AS last_cycle_errors,
    COALESCE(rfc.recent_failures, 0) AS recent_failures_24h,
    COALESCE(rmc.recent_misses, 0) AS recent_missed_runs_24h,
        CASE
            WHEN (h.last_heartbeat_at IS NULL) THEN 'UNKNOWN'::text
            WHEN (COALESCE(rmc.recent_misses, 0) > 0) THEN 'MISSED_RUN'::text
            WHEN (COALESCE(rfc.recent_failures, 0) >= 3) THEN 'CRITICAL'::text
            WHEN (lc.started_at IS NULL) THEN 'DEACTIVATED'::text
            WHEN (((now() - h.last_heartbeat_at) > '01:00:00'::interval) AND ((lc.finished_at < (now() - '01:00:00'::interval)) OR (lc.started_at < (now() - '7 days'::interval)))) THEN 'DEACTIVATED'::text
            WHEN ((now() - h.last_heartbeat_at) > '01:00:00'::interval) THEN 'CRITICAL'::text
            WHEN (((now() - h.last_heartbeat_at) > '00:15:00'::interval) AND ((lc.errors_count > 0) OR (lc.status = 'failed'::text))) THEN 'WARNING'::text
            WHEN ((lc.errors_count > 0) OR (lc.status = 'failed'::text)) THEN 'WARNING'::text
            ELSE 'HEALTHY'::text
        END AS health
   FROM (((nex.worker_heartbeat h
     LEFT JOIN latest_cycles lc ON ((lc.worker_id = h.worker_id)))
     LEFT JOIN recent_failure_counts rfc ON ((rfc.worker_id = h.worker_id)))
     LEFT JOIN recent_missed_counts rmc ON ((rmc.worker_id = h.worker_id)));


--
-- Name: VIEW worker_health_status; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON VIEW nex.worker_health_status IS 'Deterministic per-worker health. States (worst first · alert): MISSED_RUN · CRITICAL · WARNING · HEALTHY. Informational: DEACTIVATED (no cycle_run in 7 days · historical/idle · not part of active fleet · added 2026-08-29) · UNKNOWN (never emitted a heartbeat). Pure SQL · zero LLM · verifiable.';


--
-- Name: worker_heartbeats_archive_2026_08_22; Type: TABLE; Schema: nex; Owner: -
--

CREATE TABLE nex.worker_heartbeats_archive_2026_08_22 (
    host_id text NOT NULL,
    last_seen_at timestamp with time zone NOT NULL,
    uptime_ms bigint DEFAULT 0 NOT NULL,
    cycles_total integer DEFAULT 0 NOT NULL,
    cycles_failed integer DEFAULT 0 NOT NULL,
    last_error text,
    last_cycle_summary jsonb,
    metadata jsonb,
    archived_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_reason text DEFAULT 'Fly cluster destroyed 2026-08-09 · Task #72 Step 1c heartbeat unification 2026-08-22'::text NOT NULL
);


--
-- Name: TABLE worker_heartbeats_archive_2026_08_22; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON TABLE nex.worker_heartbeats_archive_2026_08_22 IS 'Frozen snapshot of Supabase public.worker_heartbeats prior to unification (Task #72 Step 1c 2026-08-22). Historical Fly-cluster telemetry. Never written to after archive. Kept for audit evidence of the destroyed cluster.';


--
-- Name: social_admin_access_log access_id; Type: DEFAULT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_admin_access_log ALTER COLUMN access_id SET DEFAULT nextval('nex.social_admin_access_log_access_id_seq'::regclass);


--
-- Name: social_audit_events audit_id; Type: DEFAULT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_audit_events ALTER COLUMN audit_id SET DEFAULT nextval('nex.social_audit_events_audit_id_seq'::regclass);


--
-- Name: accommodation_business_field_provenance accommodation_business_field_provenance_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_business_field_provenance
    ADD CONSTRAINT accommodation_business_field_provenance_pkey PRIMARY KEY (business_ref, field_name);


--
-- Name: accommodation_business accommodation_business_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_business
    ADD CONSTRAINT accommodation_business_pkey PRIMARY KEY (internal_id);


--
-- Name: accommodation_business accommodation_business_public_listing_ref_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_business
    ADD CONSTRAINT accommodation_business_public_listing_ref_key UNIQUE (public_listing_ref);


--
-- Name: accommodation_business_source_snapshot accommodation_business_source_snapshot_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_business_source_snapshot
    ADD CONSTRAINT accommodation_business_source_snapshot_pkey PRIMARY KEY (snapshot_id);


--
-- Name: accommodation_enrichment_evidence accommodation_enrichment_evidence_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_enrichment_evidence
    ADD CONSTRAINT accommodation_enrichment_evidence_pkey PRIMARY KEY (evidence_id);


--
-- Name: alert_dispatches alert_dispatches_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.alert_dispatches
    ADD CONSTRAINT alert_dispatches_pkey PRIMARY KEY (dispatch_id);


--
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (rule_id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (alert_id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (event_id);


--
-- Name: analytics_records analytics_records_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.analytics_records
    ADD CONSTRAINT analytics_records_pkey PRIMARY KEY (record_id);


--
-- Name: analytics_rollup_queue analytics_rollup_queue_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.analytics_rollup_queue
    ADD CONSTRAINT analytics_rollup_queue_pkey PRIMARY KEY (queue_id);


--
-- Name: attributions attributions_conversion_id_model_source_event_id_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.attributions
    ADD CONSTRAINT attributions_conversion_id_model_source_event_id_key UNIQUE (conversion_id, model, source_event_id);


--
-- Name: attributions attributions_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.attributions
    ADD CONSTRAINT attributions_pkey PRIMARY KEY (attribution_id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (snapshot_id);


--
-- Name: automation_runs automation_runs_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.automation_runs
    ADD CONSTRAINT automation_runs_pkey PRIMARY KEY (run_id);


--
-- Name: benchmark_runs benchmark_runs_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.benchmark_runs
    ADD CONSTRAINT benchmark_runs_pkey PRIMARY KEY (run_id);


--
-- Name: bike_model bike_model_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.bike_model
    ADD CONSTRAINT bike_model_pkey PRIMARY KEY (slug);


--
-- Name: bike_rental_listing bike_rental_listing_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.bike_rental_listing
    ADD CONSTRAINT bike_rental_listing_pkey PRIMARY KEY (rental_id);


--
-- Name: bike_rental_listing bike_rental_listing_slug_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.bike_rental_listing
    ADD CONSTRAINT bike_rental_listing_slug_key UNIQUE (slug);


--
-- Name: brain_accommodation_prices brain_accommodation_prices_location_slug_tier_season_contex_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_accommodation_prices
    ADD CONSTRAINT brain_accommodation_prices_location_slug_tier_season_contex_key UNIQUE (location_slug, tier, season_context, source_reference);


--
-- Name: brain_accommodation_prices brain_accommodation_prices_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_accommodation_prices
    ADD CONSTRAINT brain_accommodation_prices_pkey PRIMARY KEY (price_id);


--
-- Name: brain_activities brain_activities_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_activities
    ADD CONSTRAINT brain_activities_pkey PRIMARY KEY (activity_id);


--
-- Name: brain_attractions brain_attractions_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_attractions
    ADD CONSTRAINT brain_attractions_pkey PRIMARY KEY (attraction_id);


--
-- Name: brain_did_you_know_indonesia brain_did_you_know_indonesia_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_did_you_know_indonesia
    ADD CONSTRAINT brain_did_you_know_indonesia_pkey PRIMARY KEY (fact_id);


--
-- Name: brain_did_you_know_indonesia brain_did_you_know_indonesia_slug_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_did_you_know_indonesia
    ADD CONSTRAINT brain_did_you_know_indonesia_slug_key UNIQUE (slug);


--
-- Name: brain_english_grammar brain_english_grammar_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_grammar
    ADD CONSTRAINT brain_english_grammar_pkey PRIMARY KEY (grammar_id);


--
-- Name: brain_english_grammar brain_english_grammar_rule_slug_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_grammar
    ADD CONSTRAINT brain_english_grammar_rule_slug_key UNIQUE (rule_slug);


--
-- Name: brain_english_lesson brain_english_lesson_lesson_slug_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_lesson
    ADD CONSTRAINT brain_english_lesson_lesson_slug_key UNIQUE (lesson_slug);


--
-- Name: brain_english_lesson brain_english_lesson_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_lesson
    ADD CONSTRAINT brain_english_lesson_pkey PRIMARY KEY (lesson_id);


--
-- Name: brain_english_practice brain_english_practice_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_practice
    ADD CONSTRAINT brain_english_practice_pkey PRIMARY KEY (practice_id);


--
-- Name: brain_english_progress brain_english_progress_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_progress
    ADD CONSTRAINT brain_english_progress_pkey PRIMARY KEY (progress_id);


--
-- Name: brain_english_vocabulary brain_english_vocabulary_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_vocabulary
    ADD CONSTRAINT brain_english_vocabulary_pkey PRIMARY KEY (vocab_id);


--
-- Name: brain_english_vocabulary brain_english_vocabulary_word_normalised_part_of_speech_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_vocabulary
    ADD CONSTRAINT brain_english_vocabulary_word_normalised_part_of_speech_key UNIQUE (word_normalised, part_of_speech);


--
-- Name: brain_local_guide brain_local_guide_location_slug_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_local_guide
    ADD CONSTRAINT brain_local_guide_location_slug_key UNIQUE (location_slug);


--
-- Name: brain_local_guide brain_local_guide_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_local_guide
    ADD CONSTRAINT brain_local_guide_pkey PRIMARY KEY (guide_id);


--
-- Name: brain_location brain_location_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_location
    ADD CONSTRAINT brain_location_pkey PRIMARY KEY (location_id);


--
-- Name: brain_location brain_location_slug_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_location
    ADD CONSTRAINT brain_location_slug_key UNIQUE (slug);


--
-- Name: brain_memories brain_memories_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_memories
    ADD CONSTRAINT brain_memories_pkey PRIMARY KEY (memory_id);


--
-- Name: brain_seasons brain_seasons_location_slug_season_kind_month_start_source__key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_seasons
    ADD CONSTRAINT brain_seasons_location_slug_season_kind_month_start_source__key UNIQUE (location_slug, season_kind, month_start, source_reference);


--
-- Name: brain_seasons brain_seasons_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_seasons
    ADD CONSTRAINT brain_seasons_pkey PRIMARY KEY (season_id);


--
-- Name: brain_transport brain_transport_origin_location_slug_dest_location_slug_mod_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_transport
    ADD CONSTRAINT brain_transport_origin_location_slug_dest_location_slug_mod_key UNIQUE (origin_location_slug, dest_location_slug, mode, source_reference);


--
-- Name: brain_transport brain_transport_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_transport
    ADD CONSTRAINT brain_transport_pkey PRIMARY KEY (transport_id);


--
-- Name: brain_traveler_rating brain_traveler_rating_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_traveler_rating
    ADD CONSTRAINT brain_traveler_rating_pkey PRIMARY KEY (rating_id);


--
-- Name: brain_user_saved_facts brain_user_saved_facts_learner_ref_fact_id_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_user_saved_facts
    ADD CONSTRAINT brain_user_saved_facts_learner_ref_fact_id_key UNIQUE (learner_ref, fact_id);


--
-- Name: brain_user_saved_facts brain_user_saved_facts_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_user_saved_facts
    ADD CONSTRAINT brain_user_saved_facts_pkey PRIMARY KEY (save_id);


--
-- Name: business_calling_config business_calling_config_business_table_business_ref_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.business_calling_config
    ADD CONSTRAINT business_calling_config_business_table_business_ref_key UNIQUE (business_table, business_ref);


--
-- Name: business_calling_config business_calling_config_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.business_calling_config
    ADD CONSTRAINT business_calling_config_pkey PRIMARY KEY (config_id);


--
-- Name: business_image business_image_business_type_business_country_business_ref__key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.business_image
    ADD CONSTRAINT business_image_business_type_business_country_business_ref__key UNIQUE (business_type, business_country, business_ref, image_type);


--
-- Name: business_image business_image_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.business_image
    ADD CONSTRAINT business_image_pkey PRIMARY KEY (id);


--
-- Name: business_knowledge business_knowledge_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.business_knowledge
    ADD CONSTRAINT business_knowledge_pkey PRIMARY KEY (knowledge_id);


--
-- Name: business_knowledge business_knowledge_vertical_business_ref_attribute_domain_a_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.business_knowledge
    ADD CONSTRAINT business_knowledge_vertical_business_ref_attribute_domain_a_key UNIQUE (vertical, business_ref, attribute_domain, attribute_key, source, source_reference);


--
-- Name: call_record call_record_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.call_record
    ADD CONSTRAINT call_record_pkey PRIMARY KEY (id);


--
-- Name: campaign_recipients campaign_recipients_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.campaign_recipients
    ADD CONSTRAINT campaign_recipients_pkey PRIMARY KEY (campaign_id, contact_id);


--
-- Name: campaign_segments campaign_segments_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.campaign_segments
    ADD CONSTRAINT campaign_segments_pkey PRIMARY KEY (campaign_id, segment_id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (campaign_id);


--
-- Name: category_candidate_calibration_annotation category_candidate_calibration_annotation_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_candidate_calibration_annotation
    ADD CONSTRAINT category_candidate_calibration_annotation_pkey PRIMARY KEY (id);


--
-- Name: category_candidate category_candidate_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_candidate
    ADD CONSTRAINT category_candidate_pkey PRIMARY KEY (id);


--
-- Name: category_candidate_score category_candidate_score_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_candidate_score
    ADD CONSTRAINT category_candidate_score_pkey PRIMARY KEY (id);


--
-- Name: category_image_library category_image_library_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_image_library
    ADD CONSTRAINT category_image_library_pkey PRIMARY KEY (id);


--
-- Name: category_registry category_registry_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_registry
    ADD CONSTRAINT category_registry_pkey PRIMARY KEY (id);


--
-- Name: category_registry category_registry_route_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_registry
    ADD CONSTRAINT category_registry_route_key UNIQUE (route);


--
-- Name: chat_message_archive chat_message_archive_event_id_original_message_id_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.chat_message_archive
    ADD CONSTRAINT chat_message_archive_event_id_original_message_id_key UNIQUE (event_id, original_message_id);


--
-- Name: chat_message_archive chat_message_archive_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.chat_message_archive
    ADD CONSTRAINT chat_message_archive_pkey PRIMARY KEY (archive_id);


--
-- Name: chat_message_deletion chat_message_deletion_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.chat_message_deletion
    ADD CONSTRAINT chat_message_deletion_pkey PRIMARY KEY (deletion_id);


--
-- Name: chat_message chat_message_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.chat_message
    ADD CONSTRAINT chat_message_pkey PRIMARY KEY (message_id);


--
-- Name: compliance_events compliance_events_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.compliance_events
    ADD CONSTRAINT compliance_events_pkey PRIMARY KEY (event_id);


--
-- Name: confidence_scores confidence_scores_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.confidence_scores
    ADD CONSTRAINT confidence_scores_pkey PRIMARY KEY (id);


--
-- Name: confidence_scores confidence_scores_record_id_claim_key_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.confidence_scores
    ADD CONSTRAINT confidence_scores_record_id_claim_key_key UNIQUE (record_id, claim_key);


--
-- Name: contact_duplicate_suggestions contact_duplicate_suggestions_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.contact_duplicate_suggestions
    ADD CONSTRAINT contact_duplicate_suggestions_pkey PRIMARY KEY (suggestion_id);


--
-- Name: contact_merges contact_merges_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.contact_merges
    ADD CONSTRAINT contact_merges_pkey PRIMARY KEY (merge_id);


--
-- Name: contact_segments contact_segments_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.contact_segments
    ADD CONSTRAINT contact_segments_pkey PRIMARY KEY (segment_id);


--
-- Name: contact_sources contact_sources_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.contact_sources
    ADD CONSTRAINT contact_sources_pkey PRIMARY KEY (source_row_id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (snapshot_id);


--
-- Name: contradictions contradictions_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.contradictions
    ADD CONSTRAINT contradictions_pkey PRIMARY KEY (id);


--
-- Name: conv_edges conv_edges_from_item_to_item_edge_type_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_edges
    ADD CONSTRAINT conv_edges_from_item_to_item_edge_type_key UNIQUE (from_item, to_item, edge_type);


--
-- Name: conv_edges conv_edges_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_edges
    ADD CONSTRAINT conv_edges_pkey PRIMARY KEY (id);


--
-- Name: conv_entities conv_entities_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_entities
    ADD CONSTRAINT conv_entities_pkey PRIMARY KEY (slug);


--
-- Name: conv_feedback conv_feedback_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_feedback
    ADD CONSTRAINT conv_feedback_pkey PRIMARY KEY (id);


--
-- Name: conv_intents conv_intents_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_intents
    ADD CONSTRAINT conv_intents_pkey PRIMARY KEY (slug);


--
-- Name: conv_knowledge_items conv_knowledge_items_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_knowledge_items
    ADD CONSTRAINT conv_knowledge_items_pkey PRIMARY KEY (id);


--
-- Name: conv_learning_candidate conv_learning_candidate_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_learning_candidate
    ADD CONSTRAINT conv_learning_candidate_pkey PRIMARY KEY (candidate_id);


--
-- Name: conv_outcomes conv_outcomes_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_outcomes
    ADD CONSTRAINT conv_outcomes_pkey PRIMARY KEY (conversation_id);


--
-- Name: conv_states conv_states_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_states
    ADD CONSTRAINT conv_states_pkey PRIMARY KEY (conversation_id);


--
-- Name: conv_turns conv_turns_conversation_id_turn_index_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_turns
    ADD CONSTRAINT conv_turns_conversation_id_turn_index_key UNIQUE (conversation_id, turn_index);


--
-- Name: conv_turns conv_turns_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_turns
    ADD CONSTRAINT conv_turns_pkey PRIMARY KEY (id);


--
-- Name: conversion_events conversion_events_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conversion_events
    ADD CONSTRAINT conversion_events_pkey PRIMARY KEY (conversion_id);


--
-- Name: conversion_events conversion_events_source_external_ref_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conversion_events
    ADD CONSTRAINT conversion_events_source_external_ref_key UNIQUE (source, external_ref);


--
-- Name: cost_budget cost_budget_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.cost_budget
    ADD CONSTRAINT cost_budget_pkey PRIMARY KEY (branch);


--
-- Name: delivery_job_attempts delivery_job_attempts_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.delivery_job_attempts
    ADD CONSTRAINT delivery_job_attempts_pkey PRIMARY KEY (attempt_id);


--
-- Name: delivery_jobs delivery_jobs_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.delivery_jobs
    ADD CONSTRAINT delivery_jobs_pkey PRIMARY KEY (job_id);


--
-- Name: delivery_workers_archive_2026_08_22 delivery_workers_archive_2026_08_22_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.delivery_workers_archive_2026_08_22
    ADD CONSTRAINT delivery_workers_archive_2026_08_22_pkey PRIMARY KEY (worker_id);


--
-- Name: deprecations deprecations_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.deprecations
    ADD CONSTRAINT deprecations_pkey PRIMARY KEY (id);


--
-- Name: discovery_orchestrator_pick discovery_orchestrator_pick_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.discovery_orchestrator_pick
    ADD CONSTRAINT discovery_orchestrator_pick_pkey PRIMARY KEY (pick_id);


--
-- Name: discovery_rotation_state discovery_rotation_state_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.discovery_rotation_state
    ADD CONSTRAINT discovery_rotation_state_pkey PRIMARY KEY (rotation_id);


--
-- Name: provider_profile driver_profile_learner_ref_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_profile
    ADD CONSTRAINT driver_profile_learner_ref_key UNIQUE (learner_ref);


--
-- Name: provider_profile driver_profile_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_profile
    ADD CONSTRAINT driver_profile_pkey PRIMARY KEY (provider_id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (template_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (event_id);


--
-- Name: experiment_assignments experiment_assignments_experiment_id_contact_id_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.experiment_assignments
    ADD CONSTRAINT experiment_assignments_experiment_id_contact_id_key UNIQUE (experiment_id, contact_id);


--
-- Name: experiment_assignments experiment_assignments_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.experiment_assignments
    ADD CONSTRAINT experiment_assignments_pkey PRIMARY KEY (assignment_id);


--
-- Name: experiment_variants experiment_variants_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.experiment_variants
    ADD CONSTRAINT experiment_variants_pkey PRIMARY KEY (experiment_id, variant_id);


--
-- Name: experiments experiments_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.experiments
    ADD CONSTRAINT experiments_pkey PRIMARY KEY (experiment_id);


--
-- Name: experiments experiments_slug_version_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.experiments
    ADD CONSTRAINT experiments_slug_version_key UNIQUE (slug, version);


--
-- Name: food_business_field_provenance food_business_field_provenance_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_field_provenance
    ADD CONSTRAINT food_business_field_provenance_pkey PRIMARY KEY (business_ref, field_name);


--
-- Name: food_business_next_action food_business_next_action_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_next_action
    ADD CONSTRAINT food_business_next_action_pkey PRIMARY KEY (business_ref);


--
-- Name: food_business food_business_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business
    ADD CONSTRAINT food_business_pkey PRIMARY KEY (internal_id);


--
-- Name: food_business_promotion_audit food_business_promotion_audit_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_promotion_audit
    ADD CONSTRAINT food_business_promotion_audit_pkey PRIMARY KEY (id);


--
-- Name: food_business_promotion_decision food_business_promotion_decision_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_promotion_decision
    ADD CONSTRAINT food_business_promotion_decision_pkey PRIMARY KEY (id);


--
-- Name: food_business_promotion food_business_promotion_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_promotion
    ADD CONSTRAINT food_business_promotion_pkey PRIMARY KEY (business_ref);


--
-- Name: food_business food_business_public_listing_ref_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business
    ADD CONSTRAINT food_business_public_listing_ref_key UNIQUE (public_listing_ref);


--
-- Name: food_business_source_snapshot food_business_source_snapshot_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_source_snapshot
    ADD CONSTRAINT food_business_source_snapshot_pkey PRIMARY KEY (snapshot_id);


--
-- Name: food_claim_code food_claim_code_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_claim_code
    ADD CONSTRAINT food_claim_code_pkey PRIMARY KEY (claim_code_id);


--
-- Name: food_commercial_event food_commercial_event_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_commercial_event
    ADD CONSTRAINT food_commercial_event_pkey PRIMARY KEY (event_id);


--
-- Name: food_enrichment_evidence food_enrichment_evidence_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_enrichment_evidence
    ADD CONSTRAINT food_enrichment_evidence_pkey PRIMARY KEY (evidence_id);


--
-- Name: food_enrichment_job food_enrichment_job_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_enrichment_job
    ADD CONSTRAINT food_enrichment_job_pkey PRIMARY KEY (job_id);


--
-- Name: food_hq_rule food_hq_rule_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_hq_rule
    ADD CONSTRAINT food_hq_rule_pkey PRIMARY KEY (rule_key);


--
-- Name: food_next_action_audit food_next_action_audit_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_next_action_audit
    ADD CONSTRAINT food_next_action_audit_pkey PRIMARY KEY (audit_id);


--
-- Name: food_outreach_attempt food_outreach_attempt_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_outreach_attempt
    ADD CONSTRAINT food_outreach_attempt_pkey PRIMARY KEY (attempt_id);


--
-- Name: food_outreach_suppression food_outreach_suppression_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_outreach_suppression
    ADD CONSTRAINT food_outreach_suppression_pkey PRIMARY KEY (suppression_id);


--
-- Name: food_outreach_template food_outreach_template_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_outreach_template
    ADD CONSTRAINT food_outreach_template_pkey PRIMARY KEY (template_id);


--
-- Name: geo_landmark geo_landmark_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.geo_landmark
    ADD CONSTRAINT geo_landmark_pkey PRIMARY KEY (landmark_id);


--
-- Name: graph_edges graph_edges_from_record_id_to_record_id_edge_type_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.graph_edges
    ADD CONSTRAINT graph_edges_from_record_id_to_record_id_edge_type_key UNIQUE (from_record_id, to_record_id, edge_type);


--
-- Name: graph_edges graph_edges_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.graph_edges
    ADD CONSTRAINT graph_edges_pkey PRIMARY KEY (id);


--
-- Name: identity_merge_log identity_merge_log_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.identity_merge_log
    ADD CONSTRAINT identity_merge_log_pkey PRIMARY KEY (merge_id);


--
-- Name: import_mappings import_mappings_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.import_mappings
    ADD CONSTRAINT import_mappings_pkey PRIMARY KEY (profile_id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (snapshot_id);


--
-- Name: journey_campaign_executions journey_campaign_executions_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journey_campaign_executions
    ADD CONSTRAINT journey_campaign_executions_pkey PRIMARY KEY (execution_id);


--
-- Name: journey_events journey_events_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journey_events
    ADD CONSTRAINT journey_events_pkey PRIMARY KEY (event_id);


--
-- Name: journey_inbound_events journey_inbound_events_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journey_inbound_events
    ADD CONSTRAINT journey_inbound_events_pkey PRIMARY KEY (inbound_event_id);


--
-- Name: journey_states journey_states_journey_id_contact_id_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journey_states
    ADD CONSTRAINT journey_states_journey_id_contact_id_key UNIQUE (journey_id, contact_id);


--
-- Name: journey_states journey_states_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journey_states
    ADD CONSTRAINT journey_states_pkey PRIMARY KEY (state_id);


--
-- Name: journey_triggers journey_triggers_journey_id_trigger_key_version_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journey_triggers
    ADD CONSTRAINT journey_triggers_journey_id_trigger_key_version_key UNIQUE (journey_id, trigger_key, version);


--
-- Name: journey_triggers journey_triggers_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journey_triggers
    ADD CONSTRAINT journey_triggers_pkey PRIMARY KEY (trigger_id);


--
-- Name: journeys journeys_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journeys
    ADD CONSTRAINT journeys_pkey PRIMARY KEY (journey_id);


--
-- Name: journeys journeys_slug_version_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journeys
    ADD CONSTRAINT journeys_slug_version_key UNIQUE (slug, version);


--
-- Name: knowledge_dump_jobs knowledge_dump_jobs_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.knowledge_dump_jobs
    ADD CONSTRAINT knowledge_dump_jobs_pkey PRIMARY KEY (job_id);


--
-- Name: knowledge_feedback knowledge_feedback_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.knowledge_feedback
    ADD CONSTRAINT knowledge_feedback_pkey PRIMARY KEY (id);


--
-- Name: knowledge_inbox knowledge_inbox_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.knowledge_inbox
    ADD CONSTRAINT knowledge_inbox_pkey PRIMARY KEY (id);


--
-- Name: knowledge_inbox_stats knowledge_inbox_stats_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.knowledge_inbox_stats
    ADD CONSTRAINT knowledge_inbox_stats_pkey PRIMARY KEY (stat_date);


--
-- Name: knowledge_records knowledge_records_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.knowledge_records
    ADD CONSTRAINT knowledge_records_pkey PRIMARY KEY (id);


--
-- Name: knowledge_records knowledge_records_record_id_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.knowledge_records
    ADD CONSTRAINT knowledge_records_record_id_key UNIQUE (record_id);


--
-- Name: kpe_chunks kpe_chunks_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.kpe_chunks
    ADD CONSTRAINT kpe_chunks_pkey PRIMARY KEY (chunk_id);


--
-- Name: kpe_decisions kpe_decisions_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.kpe_decisions
    ADD CONSTRAINT kpe_decisions_pkey PRIMARY KEY (chunk_id);


--
-- Name: kpe_documents kpe_documents_content_hash_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.kpe_documents
    ADD CONSTRAINT kpe_documents_content_hash_key UNIQUE (content_hash);


--
-- Name: kpe_documents kpe_documents_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.kpe_documents
    ADD CONSTRAINT kpe_documents_pkey PRIMARY KEY (document_id);


--
-- Name: kpe_duplicates kpe_duplicates_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.kpe_duplicates
    ADD CONSTRAINT kpe_duplicates_pkey PRIMARY KEY (duplicate_id);


--
-- Name: kpe_edges kpe_edges_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.kpe_edges
    ADD CONSTRAINT kpe_edges_pkey PRIMARY KEY (edge_id);


--
-- Name: kpe_human_reviews kpe_human_reviews_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.kpe_human_reviews
    ADD CONSTRAINT kpe_human_reviews_pkey PRIMARY KEY (review_id);


--
-- Name: kpe_metadata kpe_metadata_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.kpe_metadata
    ADD CONSTRAINT kpe_metadata_pkey PRIMARY KEY (chunk_id);


--
-- Name: kpe_processing_runs kpe_processing_runs_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.kpe_processing_runs
    ADD CONSTRAINT kpe_processing_runs_pkey PRIMARY KEY (run_id);


--
-- Name: llm_retry_queue llm_retry_queue_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.llm_retry_queue
    ADD CONSTRAINT llm_retry_queue_pkey PRIMARY KEY (id);


--
-- Name: meaningful_area meaningful_area_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.meaningful_area
    ADD CONSTRAINT meaningful_area_pkey PRIMARY KEY (area_id);


--
-- Name: media_object media_object_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.media_object
    ADD CONSTRAINT media_object_pkey PRIMARY KEY (media_id);


--
-- Name: mp_category mp_category_key_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_category
    ADD CONSTRAINT mp_category_key_key UNIQUE (key);


--
-- Name: mp_category mp_category_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_category
    ADD CONSTRAINT mp_category_pkey PRIMARY KEY (category_id);


--
-- Name: mp_commerce_policy mp_commerce_policy_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_commerce_policy
    ADD CONSTRAINT mp_commerce_policy_pkey PRIMARY KEY (policy_id);


--
-- Name: mp_product_image mp_product_image_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_image
    ADD CONSTRAINT mp_product_image_pkey PRIMARY KEY (image_id);


--
-- Name: mp_product_option mp_product_option_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_option
    ADD CONSTRAINT mp_product_option_pkey PRIMARY KEY (option_id);


--
-- Name: mp_product_option mp_product_option_product_id_name_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_option
    ADD CONSTRAINT mp_product_option_product_id_name_key UNIQUE (product_id, name);


--
-- Name: mp_product_option_value mp_product_option_value_option_id_value_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_option_value
    ADD CONSTRAINT mp_product_option_value_option_id_value_key UNIQUE (option_id, value);


--
-- Name: mp_product_option_value mp_product_option_value_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_option_value
    ADD CONSTRAINT mp_product_option_value_pkey PRIMARY KEY (option_value_id);


--
-- Name: mp_product mp_product_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product
    ADD CONSTRAINT mp_product_pkey PRIMARY KEY (product_id);


--
-- Name: mp_product mp_product_slug_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product
    ADD CONSTRAINT mp_product_slug_key UNIQUE (slug);


--
-- Name: mp_product_variant mp_product_variant_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_variant
    ADD CONSTRAINT mp_product_variant_pkey PRIMARY KEY (variant_id);


--
-- Name: mp_product_variant mp_product_variant_product_id_option_value_ids_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_variant
    ADD CONSTRAINT mp_product_variant_product_id_option_value_ids_key UNIQUE (product_id, option_value_ids);


--
-- Name: mp_product_variant mp_product_variant_product_id_sku_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_variant
    ADD CONSTRAINT mp_product_variant_product_id_sku_key UNIQUE (product_id, sku);


--
-- Name: mp_seller mp_seller_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_seller
    ADD CONSTRAINT mp_seller_pkey PRIMARY KEY (seller_id);


--
-- Name: mp_seller mp_seller_slug_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_seller
    ADD CONSTRAINT mp_seller_slug_key UNIQUE (slug);


--
-- Name: object_blob_current object_blob_current_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.object_blob_current
    ADD CONSTRAINT object_blob_current_pkey PRIMARY KEY (bucket, key);


--
-- Name: object_blobs object_blobs_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.object_blobs
    ADD CONSTRAINT object_blobs_pkey PRIMARY KEY (bucket, key, version_id);


--
-- Name: object_manifest object_manifest_bucket_key_version_id_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.object_manifest
    ADD CONSTRAINT object_manifest_bucket_key_version_id_key UNIQUE (bucket, key, version_id);


--
-- Name: object_manifest object_manifest_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.object_manifest
    ADD CONSTRAINT object_manifest_pkey PRIMARY KEY (manifest_id);


--
-- Name: prediction_models prediction_models_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.prediction_models
    ADD CONSTRAINT prediction_models_pkey PRIMARY KEY (model_id);


--
-- Name: prediction_models prediction_models_target_model_version_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.prediction_models
    ADD CONSTRAINT prediction_models_target_model_version_key UNIQUE (target, model_version);


--
-- Name: predictions predictions_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.predictions
    ADD CONSTRAINT predictions_pkey PRIMARY KEY (prediction_id);


--
-- Name: predictive_controls predictive_controls_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.predictive_controls
    ADD CONSTRAINT predictive_controls_pkey PRIMARY KEY (singleton);


--
-- Name: provider_rate_config provider_rate_config_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_rate_config
    ADD CONSTRAINT provider_rate_config_pkey PRIMARY KEY (provider);


--
-- Name: provider_rate_lease provider_rate_lease_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_rate_lease
    ADD CONSTRAINT provider_rate_lease_pkey PRIMARY KEY (lease_id);


--
-- Name: provider_registry provider_registry_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_registry
    ADD CONSTRAINT provider_registry_pkey PRIMARY KEY (provider_id);


--
-- Name: provider_topup_intent provider_topup_intent_midtrans_order_id_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_topup_intent
    ADD CONSTRAINT provider_topup_intent_midtrans_order_id_key UNIQUE (midtrans_order_id);


--
-- Name: provider_topup_intent provider_topup_intent_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_topup_intent
    ADD CONSTRAINT provider_topup_intent_pkey PRIMARY KEY (intent_id);


--
-- Name: provider_wallet provider_wallet_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_wallet
    ADD CONSTRAINT provider_wallet_pkey PRIMARY KEY (provider_id);


--
-- Name: provider_wallet_transaction provider_wallet_transaction_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_wallet_transaction
    ADD CONSTRAINT provider_wallet_transaction_pkey PRIMARY KEY (transaction_id);


--
-- Name: record_versions record_versions_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.record_versions
    ADD CONSTRAINT record_versions_pkey PRIMARY KEY (id);


--
-- Name: record_versions record_versions_record_id_version_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.record_versions
    ADD CONSTRAINT record_versions_record_id_version_key UNIQUE (record_id, version);


--
-- Name: recovery_attempts recovery_attempts_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.recovery_attempts
    ADD CONSTRAINT recovery_attempts_pkey PRIMARY KEY (attempt_id);


--
-- Name: recovery_runs recovery_runs_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.recovery_runs
    ADD CONSTRAINT recovery_runs_pkey PRIMARY KEY (run_id);


--
-- Name: rollup_campaigns rollup_campaigns_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.rollup_campaigns
    ADD CONSTRAINT rollup_campaigns_pkey PRIMARY KEY (campaign_id);


--
-- Name: rollup_country rollup_country_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.rollup_country
    ADD CONSTRAINT rollup_country_pkey PRIMARY KEY (country);


--
-- Name: rollup_daily rollup_daily_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.rollup_daily
    ADD CONSTRAINT rollup_daily_pkey PRIMARY KEY (day);


--
-- Name: rollup_monthly rollup_monthly_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.rollup_monthly
    ADD CONSTRAINT rollup_monthly_pkey PRIMARY KEY (month);


--
-- Name: rollup_provider rollup_provider_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.rollup_provider
    ADD CONSTRAINT rollup_provider_pkey PRIMARY KEY (provider);


--
-- Name: rollup_segment rollup_segment_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.rollup_segment
    ADD CONSTRAINT rollup_segment_pkey PRIMARY KEY (segment_id);


--
-- Name: discovery_rotation_state rotation_unique_per_round_surface; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.discovery_rotation_state
    ADD CONSTRAINT rotation_unique_per_round_surface UNIQUE (city, category, surface, round);


--
-- Name: safety_audit_config safety_audit_config_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.safety_audit_config
    ADD CONSTRAINT safety_audit_config_pkey PRIMARY KEY (singleton_key);


--
-- Name: safety_audit_event safety_audit_event_idempotency_key_event_type_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.safety_audit_event
    ADD CONSTRAINT safety_audit_event_idempotency_key_event_type_key UNIQUE (idempotency_key, event_type);


--
-- Name: safety_audit_event safety_audit_event_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.safety_audit_event
    ADD CONSTRAINT safety_audit_event_pkey PRIMARY KEY (event_id);


--
-- Name: service_business service_business_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.service_business
    ADD CONSTRAINT service_business_pkey PRIMARY KEY (internal_id);


--
-- Name: service_business service_business_public_listing_ref_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.service_business
    ADD CONSTRAINT service_business_public_listing_ref_key UNIQUE (public_listing_ref);


--
-- Name: service_business_source_snapshot service_business_source_snapshot_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.service_business_source_snapshot
    ADD CONSTRAINT service_business_source_snapshot_pkey PRIMARY KEY (snapshot_id);


--
-- Name: service_request_offer service_request_offer_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.service_request_offer
    ADD CONSTRAINT service_request_offer_pkey PRIMARY KEY (offer_id);


--
-- Name: service_request_offer service_request_offer_request_id_provider_id_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.service_request_offer
    ADD CONSTRAINT service_request_offer_request_id_provider_id_key UNIQUE (request_id, provider_id);


--
-- Name: service_request service_request_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.service_request
    ADD CONSTRAINT service_request_pkey PRIMARY KEY (request_id);


--
-- Name: social_accounts social_accounts_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_accounts
    ADD CONSTRAINT social_accounts_pkey PRIMARY KEY (account_id);


--
-- Name: social_accounts social_accounts_tenant_id_platform_platform_account_id_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_accounts
    ADD CONSTRAINT social_accounts_tenant_id_platform_platform_account_id_key UNIQUE (tenant_id, platform, platform_account_id);


--
-- Name: social_admin_access_log social_admin_access_log_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_admin_access_log
    ADD CONSTRAINT social_admin_access_log_pkey PRIMARY KEY (access_id);


--
-- Name: social_audit_events social_audit_events_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_audit_events
    ADD CONSTRAINT social_audit_events_pkey PRIMARY KEY (audit_id);


--
-- Name: social_brand_profiles social_brand_profiles_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_brand_profiles
    ADD CONSTRAINT social_brand_profiles_pkey PRIMARY KEY (tenant_id);


--
-- Name: social_category_automation social_category_automation_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_category_automation
    ADD CONSTRAINT social_category_automation_pkey PRIMARY KEY (tenant_id, category);


--
-- Name: social_content_drafts social_content_drafts_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_content_drafts
    ADD CONSTRAINT social_content_drafts_pkey PRIMARY KEY (draft_id);


--
-- Name: social_content_sources social_content_sources_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_content_sources
    ADD CONSTRAINT social_content_sources_pkey PRIMARY KEY (source_id);


--
-- Name: social_content_sources social_content_sources_tenant_id_kind_slug_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_content_sources
    ADD CONSTRAINT social_content_sources_tenant_id_kind_slug_key UNIQUE (tenant_id, kind, slug);


--
-- Name: social_content_templates social_content_templates_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_content_templates
    ADD CONSTRAINT social_content_templates_pkey PRIMARY KEY (template_id);


--
-- Name: social_content_templates social_content_templates_tenant_id_slug_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_content_templates
    ADD CONSTRAINT social_content_templates_tenant_id_slug_key UNIQUE (tenant_id, slug);


--
-- Name: social_controls social_controls_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_controls
    ADD CONSTRAINT social_controls_pkey PRIMARY KEY (singleton);


--
-- Name: social_dek_wraps social_dek_wraps_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_dek_wraps
    ADD CONSTRAINT social_dek_wraps_pkey PRIMARY KEY (dek_id);


--
-- Name: social_oauth_states social_oauth_states_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_oauth_states
    ADD CONSTRAINT social_oauth_states_pkey PRIMARY KEY (state_token);


--
-- Name: social_publish_intents social_publish_intents_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_publish_intents
    ADD CONSTRAINT social_publish_intents_pkey PRIMARY KEY (intent_id);


--
-- Name: social_publish_intents social_publish_intents_tenant_id_post_id_platform_account_i_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_publish_intents
    ADD CONSTRAINT social_publish_intents_tenant_id_post_id_platform_account_i_key UNIQUE (tenant_id, post_id, platform, account_id, retry_epoch);


--
-- Name: social_role_grants social_role_grants_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_role_grants
    ADD CONSTRAINT social_role_grants_pkey PRIMARY KEY (grant_id);


--
-- Name: social_role_grants social_role_grants_tenant_id_user_id_role_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_role_grants
    ADD CONSTRAINT social_role_grants_tenant_id_user_id_role_key UNIQUE (tenant_id, user_id, role);


--
-- Name: social_scheduled_posts social_scheduled_posts_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_scheduled_posts
    ADD CONSTRAINT social_scheduled_posts_pkey PRIMARY KEY (scheduled_id);


--
-- Name: social_tenants social_tenants_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_tenants
    ADD CONSTRAINT social_tenants_pkey PRIMARY KEY (tenant_id);


--
-- Name: social_tenants social_tenants_slug_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_tenants
    ADD CONSTRAINT social_tenants_slug_key UNIQUE (slug);


--
-- Name: social_validator_runs social_validator_runs_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_validator_runs
    ADD CONSTRAINT social_validator_runs_pkey PRIMARY KEY (run_id);


--
-- Name: sources sources_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.sources
    ADD CONSTRAINT sources_pkey PRIMARY KEY (id);


--
-- Name: sparks_product sparks_product_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.sparks_product
    ADD CONSTRAINT sparks_product_pkey PRIMARY KEY (product_id);


--
-- Name: sparks_product_price sparks_product_price_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.sparks_product_price
    ADD CONSTRAINT sparks_product_price_pkey PRIMARY KEY (product_id, region);


--
-- Name: tracking_events tracking_events_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.tracking_events
    ADD CONSTRAINT tracking_events_pkey PRIMARY KEY (event_id);


--
-- Name: transport_acquisition_outreach transport_acquisition_outreach_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.transport_acquisition_outreach
    ADD CONSTRAINT transport_acquisition_outreach_pkey PRIMARY KEY (outreach_id);


--
-- Name: transport_acquisition_record transport_acquisition_record_canonical_phone_e164_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.transport_acquisition_record
    ADD CONSTRAINT transport_acquisition_record_canonical_phone_e164_key UNIQUE (canonical_phone_e164);


--
-- Name: transport_acquisition_record transport_acquisition_record_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.transport_acquisition_record
    ADD CONSTRAINT transport_acquisition_record_pkey PRIMARY KEY (provider_id);


--
-- Name: transport_acquisition_source_snapshot transport_acquisition_source_snapshot_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.transport_acquisition_source_snapshot
    ADD CONSTRAINT transport_acquisition_source_snapshot_pkey PRIMARY KEY (snapshot_id);


--
-- Name: user_wallet user_wallet_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.user_wallet
    ADD CONSTRAINT user_wallet_pkey PRIMARY KEY (user_id);


--
-- Name: service_business ux_service_business_source_ref; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.service_business
    ADD CONSTRAINT ux_service_business_source_ref UNIQUE (source, source_reference);


--
-- Name: video_feed_impression video_feed_impression_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.video_feed_impression
    ADD CONSTRAINT video_feed_impression_pkey PRIMARY KEY (impression_id);


--
-- Name: wallet_transaction wallet_transaction_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.wallet_transaction
    ADD CONSTRAINT wallet_transaction_pkey PRIMARY KEY (transaction_id);


--
-- Name: wallet_transaction wallet_transaction_user_id_idempotency_key_key; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.wallet_transaction
    ADD CONSTRAINT wallet_transaction_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key);


--
-- Name: work_item work_item_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.work_item
    ADD CONSTRAINT work_item_pkey PRIMARY KEY (work_item_id);


--
-- Name: worker_audit_events worker_audit_events_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.worker_audit_events
    ADD CONSTRAINT worker_audit_events_pkey PRIMARY KEY (event_id);


--
-- Name: worker_cycle_run worker_cycle_run_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.worker_cycle_run
    ADD CONSTRAINT worker_cycle_run_pkey PRIMARY KEY (id);


--
-- Name: worker_heartbeat worker_heartbeat_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.worker_heartbeat
    ADD CONSTRAINT worker_heartbeat_pkey PRIMARY KEY (worker_id);


--
-- Name: worker_heartbeats_archive_2026_08_22 worker_heartbeats_archive_2026_08_22_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.worker_heartbeats_archive_2026_08_22
    ADD CONSTRAINT worker_heartbeats_archive_2026_08_22_pkey PRIMARY KEY (host_id);


--
-- Name: worker_jobs worker_jobs_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.worker_jobs
    ADD CONSTRAINT worker_jobs_pkey PRIMARY KEY (id);


--
-- Name: worker_results worker_results_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.worker_results
    ADD CONSTRAINT worker_results_pkey PRIMARY KEY (id);


--
-- Name: worker_schedule worker_schedule_pkey; Type: CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.worker_schedule
    ADD CONSTRAINT worker_schedule_pkey PRIMARY KEY (worker_id);


--
-- Name: alert_dispatches_alert_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX alert_dispatches_alert_idx ON nex.alert_dispatches USING btree (alert_id, dispatched_at DESC);


--
-- Name: alert_dispatches_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX alert_dispatches_time_idx ON nex.alert_dispatches USING btree (dispatched_at DESC);


--
-- Name: alerts_incident_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX alerts_incident_idx ON nex.alerts USING btree (incident_id) WHERE (incident_id IS NOT NULL);


--
-- Name: alerts_one_open_per_rule; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX alerts_one_open_per_rule ON nex.alerts USING btree (rule_id) WHERE (state = 'open'::text);


--
-- Name: alerts_rule_state_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX alerts_rule_state_idx ON nex.alerts USING btree (rule_id, state);


--
-- Name: alerts_state_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX alerts_state_idx ON nex.alerts USING btree (state, last_triggered_at DESC);


--
-- Name: analytics_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX analytics_business_id_idx ON nex.analytics_records USING btree (business_id, occurred_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: analytics_country_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX analytics_country_idx ON nex.analytics_records USING btree (country) WHERE (country IS NOT NULL);


--
-- Name: analytics_events_campaign_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX analytics_events_campaign_time_idx ON nex.analytics_events USING btree (campaign_id, event_timestamp DESC);


--
-- Name: analytics_events_ingest_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX analytics_events_ingest_idx ON nex.analytics_events USING btree (ingested_at DESC);


--
-- Name: analytics_events_recipient_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX analytics_events_recipient_idx ON nex.analytics_events USING btree (recipient_id) WHERE (recipient_id IS NOT NULL);


--
-- Name: analytics_events_type_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX analytics_events_type_time_idx ON nex.analytics_events USING btree (event_type, event_timestamp DESC);


--
-- Name: analytics_path_ts_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX analytics_path_ts_idx ON nex.analytics_records USING btree (path, occurred_at DESC) WHERE (path IS NOT NULL);


--
-- Name: analytics_provider_ts_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX analytics_provider_ts_idx ON nex.analytics_records USING btree (provider, occurred_at DESC);


--
-- Name: attributions_campaign_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX attributions_campaign_idx ON nex.attributions USING btree (campaign_id) WHERE (campaign_id IS NOT NULL);


--
-- Name: attributions_contact_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX attributions_contact_idx ON nex.attributions USING btree (contact_id, computed_at DESC);


--
-- Name: attributions_conversion_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX attributions_conversion_idx ON nex.attributions USING btree (conversion_id);


--
-- Name: attributions_experiment_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX attributions_experiment_idx ON nex.attributions USING btree (experiment_id, variant_id) WHERE (experiment_id IS NOT NULL);


--
-- Name: attributions_journey_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX attributions_journey_idx ON nex.attributions USING btree (journey_id) WHERE (journey_id IS NOT NULL);


--
-- Name: attributions_model_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX attributions_model_idx ON nex.attributions USING btree (model, computed_at DESC);


--
-- Name: automation_rules_authority_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX automation_rules_authority_idx ON nex.automation_rules USING btree (authority);


--
-- Name: automation_rules_business_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX automation_rules_business_idx ON nex.automation_rules USING btree (business_id, updated_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: automation_rules_enabled_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX automation_rules_enabled_idx ON nex.automation_rules USING btree (enabled, updated_at DESC);


--
-- Name: automation_rules_rule_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX automation_rules_rule_id_idx ON nex.automation_rules USING btree (rule_id, updated_at DESC);


--
-- Name: automation_runs_business_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX automation_runs_business_idx ON nex.automation_runs USING btree (business_id, triggered_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: automation_runs_rule_ts_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX automation_runs_rule_ts_idx ON nex.automation_runs USING btree (rule_id, triggered_at DESC);


--
-- Name: automation_runs_status_ts_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX automation_runs_status_ts_idx ON nex.automation_runs USING btree (status, triggered_at DESC);


--
-- Name: automation_runs_trigger_evt_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX automation_runs_trigger_evt_idx ON nex.automation_runs USING btree (triggered_by_event_id) WHERE (triggered_by_event_id IS NOT NULL);


--
-- Name: benchmark_runs_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX benchmark_runs_time_idx ON nex.benchmark_runs USING btree (ran_at DESC);


--
-- Name: bm_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX bm_business_id_idx ON nex.brain_memories USING btree (business_id, added_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: bm_slug_added_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX bm_slug_added_idx ON nex.brain_memories USING btree (brain_slug, added_at DESC);


--
-- Name: bm_source_job_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX bm_source_job_id_idx ON nex.brain_memories USING btree (source_job_id) WHERE (source_job_id IS NOT NULL);


--
-- Name: bm_source_owner_added_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX bm_source_owner_added_idx ON nex.brain_memories USING btree (source_owner, added_at DESC) WHERE (source_owner IS NOT NULL);


--
-- Name: campaign_recipients_pending_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX campaign_recipients_pending_idx ON nex.campaign_recipients USING btree (campaign_id) WHERE (send_status = 'pending'::text);


--
-- Name: campaign_recipients_status_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX campaign_recipients_status_idx ON nex.campaign_recipients USING btree (campaign_id, send_status);


--
-- Name: campaign_segments_segment_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX campaign_segments_segment_idx ON nex.campaign_segments USING btree (segment_id);


--
-- Name: campaigns_scheduled_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX campaigns_scheduled_idx ON nex.campaigns USING btree (scheduled_at) WHERE (status = ANY (ARRAY['scheduled'::text, 'sending'::text, 'paused'::text]));


--
-- Name: campaigns_status_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX campaigns_status_idx ON nex.campaigns USING btree (status) WHERE (archived_at IS NULL);


--
-- Name: campaigns_updated_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX campaigns_updated_idx ON nex.campaigns USING btree (updated_at DESC);


--
-- Name: category_candidate_active_dedup_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX category_candidate_active_dedup_idx ON nex.category_candidate USING btree (proposed_category_id) WHERE (admin_decision = ANY (ARRAY['pending'::text, 'approved'::text]));


--
-- Name: category_candidate_calibration_annotation_annotator_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX category_candidate_calibration_annotation_annotator_idx ON nex.category_candidate_calibration_annotation USING btree (annotator, annotated_at DESC);


--
-- Name: category_candidate_calibration_annotation_candidate_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX category_candidate_calibration_annotation_candidate_idx ON nex.category_candidate_calibration_annotation USING btree (candidate_id, annotated_at DESC);


--
-- Name: category_candidate_proposed_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX category_candidate_proposed_id_idx ON nex.category_candidate USING btree (proposed_category_id);


--
-- Name: category_candidate_score_candidate_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX category_candidate_score_candidate_idx ON nex.category_candidate_score USING btree (candidate_id, computed_at DESC);


--
-- Name: category_candidate_score_tier_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX category_candidate_score_tier_idx ON nex.category_candidate_score USING btree (provisional_tier, computed_at DESC);


--
-- Name: category_candidate_status_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX category_candidate_status_idx ON nex.category_candidate USING btree (admin_decision, created_at DESC);


--
-- Name: category_candidate_vertical_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX category_candidate_vertical_idx ON nex.category_candidate USING btree (suggested_parent_vertical);


--
-- Name: category_registry_active_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX category_registry_active_idx ON nex.category_registry USING btree (active) WHERE (active = true);


--
-- Name: category_registry_countries_gin_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX category_registry_countries_gin_idx ON nex.category_registry USING gin (countries);


--
-- Name: category_registry_parent_vertical_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX category_registry_parent_vertical_idx ON nex.category_registry USING btree (parent_vertical);


--
-- Name: chat_message_archive_message_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX chat_message_archive_message_idx ON nex.chat_message_archive USING btree (original_message_id);


--
-- Name: chat_message_conversation_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX chat_message_conversation_idx ON nex.chat_message USING btree (conversation_id, created_at DESC);


--
-- Name: chat_message_deletion_conv_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX chat_message_deletion_conv_idx ON nex.chat_message_deletion USING btree (conversation_id, event_time DESC);


--
-- Name: chat_message_deletion_wallet_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX chat_message_deletion_wallet_idx ON nex.chat_message_deletion USING btree (wallet_transaction_id) WHERE (wallet_transaction_id IS NOT NULL);


--
-- Name: chat_message_sender_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX chat_message_sender_idx ON nex.chat_message USING btree (sender_id, created_at DESC);


--
-- Name: compliance_events_contact_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX compliance_events_contact_idx ON nex.compliance_events USING btree (contact_id, created_at DESC);


--
-- Name: compliance_events_source_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX compliance_events_source_idx ON nex.compliance_events USING btree (source, created_at DESC);


--
-- Name: compliance_events_type_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX compliance_events_type_idx ON nex.compliance_events USING btree (event_type, created_at DESC);


--
-- Name: contact_dup_pending_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contact_dup_pending_idx ON nex.contact_duplicate_suggestions USING btree (detected_at DESC) WHERE ((decision IS NULL) OR (decision = 'pending'::text));


--
-- Name: contact_dup_unique_pair_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX contact_dup_unique_pair_idx ON nex.contact_duplicate_suggestions USING btree (contact_a, contact_b, match_kind);


--
-- Name: contact_merges_absorbed_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contact_merges_absorbed_idx ON nex.contact_merges USING btree (absorbed_contact_id);


--
-- Name: contact_merges_surviving_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contact_merges_surviving_idx ON nex.contact_merges USING btree (surviving_contact_id, decided_at DESC);


--
-- Name: contact_segments_last_used_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contact_segments_last_used_idx ON nex.contact_segments USING btree (last_used_at DESC NULLS LAST) WHERE (archived_at IS NULL);


--
-- Name: contact_segments_name_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contact_segments_name_idx ON nex.contact_segments USING btree (name);


--
-- Name: contact_sources_contact_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contact_sources_contact_idx ON nex.contact_sources USING btree (contact_id, observed_at DESC);


--
-- Name: contact_sources_source_ref_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contact_sources_source_ref_idx ON nex.contact_sources USING btree (source_type, source_ref) WHERE (source_ref IS NOT NULL);


--
-- Name: contact_sources_synchronised_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contact_sources_synchronised_idx ON nex.contact_sources USING btree (source_type, synchronised_at DESC) WHERE (synchronised_at IS NOT NULL);


--
-- Name: contact_sources_type_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contact_sources_type_idx ON nex.contact_sources USING btree (source_type, observed_at DESC);


--
-- Name: contact_sources_unique_ref_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX contact_sources_unique_ref_idx ON nex.contact_sources USING btree (source_type, source_ref) WHERE (source_ref IS NOT NULL);


--
-- Name: contacts_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contacts_business_id_idx ON nex.contacts USING btree (business_id, updated_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: contacts_canonical_email_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contacts_canonical_email_idx ON nex.contacts USING btree (canonical_email) WHERE (canonical_email IS NOT NULL);


--
-- Name: contacts_canonical_phone_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contacts_canonical_phone_idx ON nex.contacts USING btree (canonical_phone) WHERE (canonical_phone IS NOT NULL);


--
-- Name: contacts_compliance_state_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contacts_compliance_state_idx ON nex.contacts USING btree (compliance_state) WHERE ((deleted_at IS NULL) AND (compliance_state <> 'allowed'::text));


--
-- Name: contacts_contact_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contacts_contact_id_idx ON nex.contacts USING btree (contact_id, updated_at DESC);


--
-- Name: contacts_country_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contacts_country_idx ON nex.contacts USING btree (country) WHERE (country IS NOT NULL);


--
-- Name: contacts_email_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contacts_email_idx ON nex.contacts USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: contacts_lifecycle_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contacts_lifecycle_idx ON nex.contacts USING btree (lifecycle_stage) WHERE (lifecycle_stage IS NOT NULL);


--
-- Name: contacts_linked_biz_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contacts_linked_biz_idx ON nex.contacts USING btree (linked_business_id) WHERE (linked_business_id IS NOT NULL);


--
-- Name: contacts_never_contact_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contacts_never_contact_idx ON nex.contacts USING btree (never_contact) WHERE (never_contact = true);


--
-- Name: contacts_phone_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX contacts_phone_idx ON nex.contacts USING btree (phone) WHERE (phone IS NOT NULL);


--
-- Name: conv_edges_from_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_edges_from_idx ON nex.conv_edges USING btree (from_item, edge_type);


--
-- Name: conv_edges_to_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_edges_to_idx ON nex.conv_edges USING btree (to_item, edge_type);


--
-- Name: conv_edges_weight_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_edges_weight_idx ON nex.conv_edges USING btree (weight);


--
-- Name: conv_entities_aliases_gin; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_entities_aliases_gin ON nex.conv_entities USING gin (aliases);


--
-- Name: conv_entities_brain_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_entities_brain_idx ON nex.conv_entities USING btree (brain);


--
-- Name: conv_feedback_created_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_feedback_created_idx ON nex.conv_feedback USING btree (created_at DESC);


--
-- Name: conv_feedback_signal_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_feedback_signal_idx ON nex.conv_feedback USING btree (signal);


--
-- Name: conv_feedback_turn_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_feedback_turn_idx ON nex.conv_feedback USING btree (turn_id);


--
-- Name: conv_ki_brain_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_ki_brain_idx ON nex.conv_knowledge_items USING btree (brain);


--
-- Name: conv_ki_draft_only_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_ki_draft_only_idx ON nex.conv_knowledge_items USING btree (draft_only);


--
-- Name: conv_ki_entities_gin; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_ki_entities_gin ON nex.conv_knowledge_items USING gin (entities);


--
-- Name: conv_ki_intent_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_ki_intent_idx ON nex.conv_knowledge_items USING btree (canonical_intent);


--
-- Name: conv_ki_topics_gin; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_ki_topics_gin ON nex.conv_knowledge_items USING gin (topics);


--
-- Name: conv_outcomes_labelled_at_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_outcomes_labelled_at_idx ON nex.conv_outcomes USING btree (labelled_at DESC);


--
-- Name: conv_outcomes_outcome_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_outcomes_outcome_idx ON nex.conv_outcomes USING btree (outcome);


--
-- Name: conv_states_brain_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_states_brain_idx ON nex.conv_states USING btree (brain);


--
-- Name: conv_states_business_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_states_business_idx ON nex.conv_states USING btree (business_id);


--
-- Name: conv_states_state_gin; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_states_state_gin ON nex.conv_states USING gin (state jsonb_path_ops);


--
-- Name: conv_turns_convo_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_turns_convo_idx ON nex.conv_turns USING btree (conversation_id, turn_index);


--
-- Name: conv_turns_entities_gin; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_turns_entities_gin ON nex.conv_turns USING gin (detected_entities);


--
-- Name: conv_turns_intent_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conv_turns_intent_idx ON nex.conv_turns USING btree (detected_intent);


--
-- Name: conversion_events_contact_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conversion_events_contact_idx ON nex.conversion_events USING btree (contact_id, occurred_at DESC);


--
-- Name: conversion_events_correlation_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conversion_events_correlation_idx ON nex.conversion_events USING btree (correlation_id) WHERE (correlation_id IS NOT NULL);


--
-- Name: conversion_events_type_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX conversion_events_type_idx ON nex.conversion_events USING btree (event_type, occurred_at DESC);


--
-- Name: delivery_job_attempts_job_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX delivery_job_attempts_job_idx ON nex.delivery_job_attempts USING btree (job_id, attempt_no DESC);


--
-- Name: delivery_jobs_campaign_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX delivery_jobs_campaign_idx ON nex.delivery_jobs USING btree (campaign_id);


--
-- Name: delivery_jobs_lease_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX delivery_jobs_lease_idx ON nex.delivery_jobs USING btree (lease_expires_at) WHERE (status = 'running'::text);


--
-- Name: delivery_jobs_pending_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX delivery_jobs_pending_idx ON nex.delivery_jobs USING btree (status, scheduled_for) WHERE (status = ANY (ARRAY['pending'::text, 'running'::text]));


--
-- Name: discovery_rotation_state_lookup_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX discovery_rotation_state_lookup_idx ON nex.discovery_rotation_state USING btree (city, category, surface, round);


--
-- Name: email_templates_category_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX email_templates_category_idx ON nex.email_templates USING btree (category) WHERE (archived_at IS NULL);


--
-- Name: email_templates_seed_name_uniq; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX email_templates_seed_name_uniq ON nex.email_templates USING btree (name) WHERE (is_seed = true);


--
-- Name: email_templates_used_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX email_templates_used_idx ON nex.email_templates USING btree (last_used_at DESC NULLS LAST) WHERE (archived_at IS NULL);


--
-- Name: events_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX events_business_id_idx ON nex.events USING btree (business_id, "timestamp" DESC) WHERE (business_id IS NOT NULL);


--
-- Name: events_related_department_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX events_related_department_idx ON nex.events USING btree (related_department, "timestamp" DESC) WHERE (related_department IS NOT NULL);


--
-- Name: events_related_job_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX events_related_job_idx ON nex.events USING btree (related_job, "timestamp" DESC) WHERE (related_job IS NOT NULL);


--
-- Name: events_timestamp_desc_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX events_timestamp_desc_idx ON nex.events USING btree ("timestamp" DESC);


--
-- Name: events_type_ts_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX events_type_ts_idx ON nex.events USING btree (event_type, "timestamp" DESC);


--
-- Name: experiment_assignments_contact_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX experiment_assignments_contact_idx ON nex.experiment_assignments USING btree (contact_id);


--
-- Name: experiment_assignments_variant_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX experiment_assignments_variant_idx ON nex.experiment_assignments USING btree (experiment_id, variant_id);


--
-- Name: experiments_active_per_slug; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX experiments_active_per_slug ON nex.experiments USING btree (slug) WHERE (status = 'active'::text);


--
-- Name: experiments_status_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX experiments_status_idx ON nex.experiments USING btree (status, updated_at DESC);


--
-- Name: idx_accom_business_evidence_source; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accom_business_evidence_source ON nex.accommodation_business USING btree (evidence_source) WHERE (evidence_source IS NOT NULL);


--
-- Name: idx_accom_business_location_confidence; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accom_business_location_confidence ON nex.accommodation_business USING btree (location_confidence);


--
-- Name: idx_accom_business_neighbourhood; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accom_business_neighbourhood ON nex.accommodation_business USING btree (neighbourhood) WHERE (neighbourhood IS NOT NULL);


--
-- Name: idx_accommodation_business_amenities_gin; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_business_amenities_gin ON nex.accommodation_business USING gin (amenities);


--
-- Name: idx_accommodation_business_categories_gin; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_business_categories_gin ON nex.accommodation_business USING gin (categories);


--
-- Name: idx_accommodation_business_city_category; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_business_city_category ON nex.accommodation_business USING btree (city, category);


--
-- Name: idx_accommodation_business_claim_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_business_claim_status ON nex.accommodation_business USING btree (claim_status);


--
-- Name: idx_accommodation_business_cycle_run; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_business_cycle_run ON nex.accommodation_business USING btree (cycle_run_id) WHERE (cycle_run_id IS NOT NULL);


--
-- Name: idx_accommodation_business_dedupe; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX idx_accommodation_business_dedupe ON nex.accommodation_business USING btree (dedupe_hash);


--
-- Name: idx_accommodation_business_owner_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_business_owner_status ON nex.accommodation_business USING btree (owner_status);


--
-- Name: idx_accommodation_business_worker_id; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_business_worker_id ON nex.accommodation_business USING btree (worker_id) WHERE (worker_id IS NOT NULL);


--
-- Name: idx_accommodation_evidence_agent; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_evidence_agent ON nex.accommodation_enrichment_evidence USING btree (agent_name, discovered_at DESC);


--
-- Name: idx_accommodation_evidence_business_field; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_evidence_business_field ON nex.accommodation_enrichment_evidence USING btree (business_ref, field_name, discovered_at DESC);


--
-- Name: idx_accommodation_evidence_cycle; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_evidence_cycle ON nex.accommodation_enrichment_evidence USING btree (cycle_run_id) WHERE (cycle_run_id IS NOT NULL);


--
-- Name: idx_accommodation_provenance_cycle; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_provenance_cycle ON nex.accommodation_business_field_provenance USING btree (cycle_run_id) WHERE (cycle_run_id IS NOT NULL);


--
-- Name: idx_accommodation_provenance_trust; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_provenance_trust ON nex.accommodation_business_field_provenance USING btree (business_ref, trust_layer);


--
-- Name: idx_accommodation_snapshot_business; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_snapshot_business ON nex.accommodation_business_source_snapshot USING btree (business_ref, captured_at DESC);


--
-- Name: idx_accommodation_snapshot_cycle; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_accommodation_snapshot_cycle ON nex.accommodation_business_source_snapshot USING btree (cycle_run_id) WHERE (cycle_run_id IS NOT NULL);


--
-- Name: idx_analytics_rollup_queue_event; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_analytics_rollup_queue_event ON nex.analytics_rollup_queue USING btree (event_id);


--
-- Name: idx_analytics_rollup_queue_pending; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_analytics_rollup_queue_pending ON nex.analytics_rollup_queue USING btree (status, enqueued_at) WHERE (status = 'pending'::text);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_audit_actor ON nex.audit_log USING btree (actor, created_at DESC);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_audit_entity ON nex.audit_log USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_bike_model_brand; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_bike_model_brand ON nex.bike_model USING btree (brand);


--
-- Name: idx_bike_model_category; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_bike_model_category ON nex.bike_model USING btree (category);


--
-- Name: idx_bike_model_cc; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_bike_model_cc ON nex.bike_model USING btree (cc);


--
-- Name: idx_bike_rental_buy_option; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_bike_rental_buy_option ON nex.bike_rental_listing USING btree (has_buy_option) WHERE (has_buy_option = true);


--
-- Name: idx_bike_rental_city_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_bike_rental_city_status ON nex.bike_rental_listing USING btree (city, status);


--
-- Name: idx_bko_business_lookup; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_bko_business_lookup ON nex.business_knowledge USING btree (vertical, business_ref) WHERE (superseded_by IS NULL);


--
-- Name: idx_bko_domain_lookup; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_bko_domain_lookup ON nex.business_knowledge USING btree (vertical, attribute_domain, attribute_key) WHERE (superseded_by IS NULL);


--
-- Name: idx_bko_freshness; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_bko_freshness ON nex.business_knowledge USING btree (freshness_valid_until) WHERE ((freshness_valid_until IS NOT NULL) AND (superseded_by IS NULL));


--
-- Name: idx_brain_accom_prices_loc; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_accom_prices_loc ON nex.brain_accommodation_prices USING btree (location_slug);


--
-- Name: idx_brain_activities_kind; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_activities_kind ON nex.brain_activities USING btree (activity_kind);


--
-- Name: idx_brain_activities_loc; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_activities_loc ON nex.brain_activities USING btree (location_slug);


--
-- Name: idx_brain_attractions_kind; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_attractions_kind ON nex.brain_attractions USING btree (attraction_kind);


--
-- Name: idx_brain_attractions_loc; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_attractions_loc ON nex.brain_attractions USING btree (location_slug);


--
-- Name: idx_brain_guide_loc; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_guide_loc ON nex.brain_local_guide USING btree (location_slug);


--
-- Name: idx_brain_location_kind; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_location_kind ON nex.brain_location USING btree (kind);


--
-- Name: idx_brain_location_slug; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_location_slug ON nex.brain_location USING btree (slug);


--
-- Name: idx_brain_rating_entity; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_rating_entity ON nex.brain_traveler_rating USING btree (entity_kind, entity_ref);


--
-- Name: idx_brain_seasons_loc; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_seasons_loc ON nex.brain_seasons USING btree (location_slug);


--
-- Name: idx_brain_transport_dest; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_transport_dest ON nex.brain_transport USING btree (dest_location_slug);


--
-- Name: idx_brain_transport_origin; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_brain_transport_origin ON nex.brain_transport USING btree (origin_location_slug);


--
-- Name: idx_business_image_cycle_run; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_business_image_cycle_run ON nex.business_image USING btree (cycle_run_id) WHERE (cycle_run_id IS NOT NULL);


--
-- Name: idx_business_image_lookup; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_business_image_lookup ON nex.business_image USING btree (business_type, business_country, business_ref);


--
-- Name: idx_business_image_type; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_business_image_type ON nex.business_image USING btree (image_type);


--
-- Name: idx_call_record_callee; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_call_record_callee ON nex.call_record USING btree (callee_user_id, started_at DESC);


--
-- Name: idx_call_record_caller; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_call_record_caller ON nex.call_record USING btree (caller_user_id, started_at DESC);


--
-- Name: idx_call_record_end; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_call_record_end ON nex.call_record USING btree (end_reason);


--
-- Name: idx_call_record_path; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_call_record_path ON nex.call_record USING btree (path);


--
-- Name: idx_cat_img_library_category_active; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_cat_img_library_category_active ON nex.category_image_library USING btree (category_slug, active, priority) WHERE (active = true);


--
-- Name: idx_confidence_low; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_confidence_low ON nex.confidence_scores USING btree (confidence_band) WHERE (confidence_band = 'low'::text);


--
-- Name: idx_confidence_record; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_confidence_record ON nex.confidence_scores USING btree (record_id);


--
-- Name: idx_contradictions_open; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_contradictions_open ON nex.contradictions USING btree (status) WHERE (status = 'open'::text);


--
-- Name: idx_conv_learning_candidate_cycle; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_conv_learning_candidate_cycle ON nex.conv_learning_candidate USING btree (cycle_run_id);


--
-- Name: idx_conv_learning_candidate_language_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_conv_learning_candidate_language_status ON nex.conv_learning_candidate USING btree (language, status);


--
-- Name: idx_conv_learning_candidate_pending; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_conv_learning_candidate_pending ON nex.conv_learning_candidate USING btree (created_at DESC) WHERE (status = 'pending_review'::text);


--
-- Name: idx_conv_turns_cle_cycle; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_conv_turns_cle_cycle ON nex.conv_turns USING btree (cle_cycle_run_id) WHERE (cle_cycle_run_id IS NOT NULL);


--
-- Name: idx_conv_turns_cle_pending; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_conv_turns_cle_pending ON nex.conv_turns USING btree (created_at DESC) WHERE (cle_processed_at IS NULL);


--
-- Name: idx_deprecations_record; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_deprecations_record ON nex.deprecations USING btree (record_id);


--
-- Name: idx_dyk_active; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_dyk_active ON nex.brain_did_you_know_indonesia USING btree (priority DESC, created_at DESC) WHERE is_active;


--
-- Name: idx_dyk_category; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_dyk_category ON nex.brain_did_you_know_indonesia USING btree (category) WHERE is_active;


--
-- Name: idx_dyk_needs_translation; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_dyk_needs_translation ON nex.brain_did_you_know_indonesia USING btree (created_at) WHERE ((body_id IS NULL) AND (is_active = true));


--
-- Name: idx_dyk_region; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_dyk_region ON nex.brain_did_you_know_indonesia USING btree (region_slug) WHERE (is_active AND (region_slug IS NOT NULL));


--
-- Name: idx_edges_from; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_edges_from ON nex.graph_edges USING btree (from_record_id, edge_type);


--
-- Name: idx_edges_gap; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_edges_gap ON nex.graph_edges USING btree (is_gap_marker) WHERE (is_gap_marker = true);


--
-- Name: idx_edges_to; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_edges_to ON nex.graph_edges USING btree (to_record_id);


--
-- Name: idx_feedback_domain; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_feedback_domain ON nex.knowledge_feedback USING btree (domain, created_at DESC);


--
-- Name: idx_feedback_kind; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_feedback_kind ON nex.knowledge_feedback USING btree (feedback_kind, created_at DESC);


--
-- Name: idx_feedback_record; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_feedback_record ON nex.knowledge_feedback USING btree (record_id);


--
-- Name: idx_feedback_tags; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_feedback_tags ON nex.knowledge_feedback USING gin (topic_tags);


--
-- Name: idx_feedback_unapplied; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_feedback_unapplied ON nex.knowledge_feedback USING btree (applied_to_prompts) WHERE (applied_to_prompts = false);


--
-- Name: idx_food_business_categories_gin; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_business_categories_gin ON nex.food_business USING gin (categories);


--
-- Name: idx_food_business_cycle_run; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_business_cycle_run ON nex.food_business USING btree (cycle_run_id) WHERE (cycle_run_id IS NOT NULL);


--
-- Name: idx_food_business_evidence_source; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_business_evidence_source ON nex.food_business USING btree (evidence_source) WHERE (evidence_source IS NOT NULL);


--
-- Name: idx_food_business_location_confidence; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_business_location_confidence ON nex.food_business USING btree (location_confidence);


--
-- Name: idx_food_business_neighbourhood; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_business_neighbourhood ON nex.food_business USING btree (neighbourhood) WHERE (neighbourhood IS NOT NULL);


--
-- Name: idx_food_business_promotion_audit_biz_written; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_business_promotion_audit_biz_written ON nex.food_business_promotion_audit USING btree (business_ref, written_at DESC);


--
-- Name: idx_food_business_promotion_audit_cycle; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_business_promotion_audit_cycle ON nex.food_business_promotion_audit USING btree (cycle_run_id);


--
-- Name: idx_food_business_promotion_cycle_run; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_business_promotion_cycle_run ON nex.food_business_promotion USING btree (cycle_run_id) WHERE (cycle_run_id IS NOT NULL);


--
-- Name: idx_food_business_promotion_score; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_business_promotion_score ON nex.food_business_promotion USING btree (quality_score DESC NULLS LAST);


--
-- Name: idx_food_business_promotion_state; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_business_promotion_state ON nex.food_business_promotion USING btree (current_state);


--
-- Name: idx_food_business_value_ref; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX idx_food_business_value_ref ON nex.food_business_value USING btree (business_ref);


--
-- Name: idx_food_business_worker_id; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_business_worker_id ON nex.food_business USING btree (worker_id) WHERE (worker_id IS NOT NULL);


--
-- Name: idx_food_evidence_agent; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_evidence_agent ON nex.food_enrichment_evidence USING btree (agent_name, discovered_at DESC);


--
-- Name: idx_food_evidence_business_field; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_evidence_business_field ON nex.food_enrichment_evidence USING btree (business_ref, field_name, discovered_at DESC);


--
-- Name: idx_food_evidence_source_type; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_evidence_source_type ON nex.food_enrichment_evidence USING btree (source_type, confidence DESC);


--
-- Name: idx_food_job_business; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_job_business ON nex.food_enrichment_job USING btree (business_ref, agent, created_at DESC);


--
-- Name: idx_food_job_status_next; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_job_status_next ON nex.food_enrichment_job USING btree (status, next_attempt_at) WHERE (status = ANY (ARRAY['pending'::public.nex_food_enrichment_status, 'failed'::public.nex_food_enrichment_status]));


--
-- Name: idx_food_next_action_action; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_next_action_action ON nex.food_business_next_action USING btree (next_action);


--
-- Name: idx_food_next_action_audit_business; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_next_action_audit_business ON nex.food_next_action_audit USING btree (business_ref, computed_at DESC);


--
-- Name: idx_food_next_action_computed_at; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_food_next_action_computed_at ON nex.food_business_next_action USING btree (computed_at DESC);


--
-- Name: idx_geo_landmark_country_city_category; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_geo_landmark_country_city_category ON nex.geo_landmark USING btree (country, city, category);


--
-- Name: idx_grammar_cat; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_grammar_cat ON nex.brain_english_grammar USING btree (category);


--
-- Name: idx_grammar_cefr; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_grammar_cefr ON nex.brain_english_grammar USING btree (cefr_level);


--
-- Name: idx_jobs_lease; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_jobs_lease ON nex.worker_jobs USING btree (lease_expires_at) WHERE (status = ANY (ARRAY['assigned'::text, 'running'::text]));


--
-- Name: idx_jobs_queue; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_jobs_queue ON nex.worker_jobs USING btree (worker_type, status, priority, created_at) WHERE (status = ANY (ARRAY['waiting'::text, 'assigned'::text]));


--
-- Name: idx_knowledge_dump_jobs_created; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_knowledge_dump_jobs_created ON nex.knowledge_dump_jobs USING btree (created_at DESC);


--
-- Name: idx_knowledge_dump_jobs_inbox; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_knowledge_dump_jobs_inbox ON nex.knowledge_dump_jobs USING btree (inbox_item_id) WHERE (inbox_item_id IS NOT NULL);


--
-- Name: idx_knowledge_dump_jobs_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_knowledge_dump_jobs_status ON nex.knowledge_dump_jobs USING btree (status, updated_at DESC);


--
-- Name: idx_knowledge_inbox_brain_topic_source; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_knowledge_inbox_brain_topic_source ON nex.knowledge_inbox USING btree (brain_slug, topic_key, source);


--
-- Name: idx_knowledge_inbox_created; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_knowledge_inbox_created ON nex.knowledge_inbox USING btree (created_at_iso DESC);


--
-- Name: idx_knowledge_inbox_extraction_band; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_knowledge_inbox_extraction_band ON nex.knowledge_inbox USING btree (((extraction_result ->> 'classification_band'::text))) WHERE (extraction_result IS NOT NULL);


--
-- Name: idx_knowledge_inbox_object; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_knowledge_inbox_object ON nex.knowledge_inbox USING btree (object_bucket, object_key) WHERE ((object_bucket IS NOT NULL) AND (object_key IS NOT NULL));


--
-- Name: idx_knowledge_inbox_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_knowledge_inbox_status ON nex.knowledge_inbox USING btree (status, created_at_iso DESC);


--
-- Name: idx_knowledge_inbox_truth_class; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_knowledge_inbox_truth_class ON nex.knowledge_inbox USING btree (truth_class) WHERE (truth_class IS NOT NULL);


--
-- Name: idx_lesson_cefr; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_lesson_cefr ON nex.brain_english_lesson USING btree (cefr_level);


--
-- Name: idx_lesson_theme; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_lesson_theme ON nex.brain_english_lesson USING btree (topic_theme);


--
-- Name: idx_llm_retry_parent; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_llm_retry_parent ON nex.llm_retry_queue USING btree (parent_job_id);


--
-- Name: idx_llm_retry_pending; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_llm_retry_pending ON nex.llm_retry_queue USING btree (status, next_attempt_at) WHERE (status = 'pending'::text);


--
-- Name: idx_llm_retry_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_llm_retry_status ON nex.llm_retry_queue USING btree (status, updated_at DESC);


--
-- Name: idx_meaningful_area_country_city; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_meaningful_area_country_city ON nex.meaningful_area USING btree (country, city);


--
-- Name: idx_meaningful_area_kind_precedence; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_meaningful_area_kind_precedence ON nex.meaningful_area USING btree (area_kind, precedence);


--
-- Name: idx_mp_category_level; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_mp_category_level ON nex.mp_category USING btree (level);


--
-- Name: idx_mp_category_parent; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_mp_category_parent ON nex.mp_category USING btree (parent_id) WHERE (parent_id IS NOT NULL);


--
-- Name: idx_mp_category_path; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_mp_category_path ON nex.mp_category USING btree (path);


--
-- Name: idx_mp_option_value_option; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_mp_option_value_option ON nex.mp_product_option_value USING btree (option_id, sort_order);


--
-- Name: idx_mp_product_category; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_mp_product_category ON nex.mp_product USING btree (category_id) WHERE active;


--
-- Name: idx_mp_product_image_product; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_mp_product_image_product ON nex.mp_product_image USING btree (product_id, sort_order);


--
-- Name: idx_mp_product_seller; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_mp_product_seller ON nex.mp_product USING btree (seller_id);


--
-- Name: idx_mp_seller_cycle_run; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_mp_seller_cycle_run ON nex.mp_seller USING btree (cycle_run_id) WHERE (cycle_run_id IS NOT NULL);


--
-- Name: idx_mp_seller_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_mp_seller_status ON nex.mp_seller USING btree (status);


--
-- Name: idx_mp_seller_worker_id; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_mp_seller_worker_id ON nex.mp_seller USING btree (worker_id) WHERE (worker_id IS NOT NULL);


--
-- Name: idx_mp_variant_product; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_mp_variant_product ON nex.mp_product_variant USING btree (product_id) WHERE active;


--
-- Name: idx_nex_food_business_business_name_lower; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_business_business_name_lower ON nex.food_business USING btree (lower(business_name));


--
-- Name: idx_nex_food_business_city_category; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_business_city_category ON nex.food_business USING btree (city, category);


--
-- Name: idx_nex_food_business_claim_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_business_claim_status ON nex.food_business USING btree (claim_status);


--
-- Name: idx_nex_food_business_coords; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_business_coords ON nex.food_business USING btree (coordinates_lat, coordinates_lng) WHERE ((coordinates_lat IS NOT NULL) AND (coordinates_lng IS NOT NULL));


--
-- Name: idx_nex_food_business_dedupe_hash; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_business_dedupe_hash ON nex.food_business USING btree (dedupe_hash);


--
-- Name: idx_nex_food_business_owner_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_business_owner_status ON nex.food_business USING btree (owner_status);


--
-- Name: idx_nex_food_business_source; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_business_source ON nex.food_business USING btree (source);


--
-- Name: idx_nex_food_claim_code_active; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_claim_code_active ON nex.food_claim_code USING btree (business_ref, requested_at DESC) WHERE ((consumed_at IS NULL) AND (invalidated_at IS NULL));


--
-- Name: idx_nex_food_claim_code_expires_at; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_claim_code_expires_at ON nex.food_claim_code USING btree (expires_at) WHERE ((consumed_at IS NULL) AND (invalidated_at IS NULL));


--
-- Name: idx_nex_food_event_business_created; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_event_business_created ON nex.food_commercial_event USING btree (business_ref, created_at DESC);


--
-- Name: idx_nex_food_event_type_created; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_event_type_created ON nex.food_commercial_event USING btree (event_type, created_at DESC);


--
-- Name: idx_nex_food_field_provenance_trust; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_field_provenance_trust ON nex.food_business_field_provenance USING btree (business_ref, trust_layer);


--
-- Name: idx_nex_food_outreach_attempt_business_ref; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_outreach_attempt_business_ref ON nex.food_outreach_attempt USING btree (business_ref, created_at DESC);


--
-- Name: idx_nex_food_outreach_attempt_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_outreach_attempt_status ON nex.food_outreach_attempt USING btree (status, created_at DESC);


--
-- Name: idx_nex_food_outreach_suppression_business_ref; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_outreach_suppression_business_ref ON nex.food_outreach_suppression USING btree (business_ref);


--
-- Name: idx_nex_food_outreach_template_purpose_lang; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_outreach_template_purpose_lang ON nex.food_outreach_template USING btree (purpose, language) WHERE (active = true);


--
-- Name: idx_nex_food_snapshot_business_ref; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_nex_food_snapshot_business_ref ON nex.food_business_source_snapshot USING btree (business_ref, source_ingested_at DESC) WHERE (business_ref IS NOT NULL);


--
-- Name: idx_object_blobs_bucket_key; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_object_blobs_bucket_key ON nex.object_blobs USING btree (bucket, key, uploaded_at DESC);


--
-- Name: idx_object_blobs_hash; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_object_blobs_hash ON nex.object_blobs USING btree (content_hash);


--
-- Name: idx_object_blobs_uploaded_at; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_object_blobs_uploaded_at ON nex.object_blobs USING btree (uploaded_at DESC);


--
-- Name: idx_practice_cefr; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_practice_cefr ON nex.brain_english_practice USING btree (cefr_level);


--
-- Name: idx_practice_kind; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_practice_kind ON nex.brain_english_practice USING btree (practice_kind);


--
-- Name: idx_practice_lesson; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_practice_lesson ON nex.brain_english_practice USING btree (lesson_slug);


--
-- Name: idx_prl_active; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_prl_active ON nex.provider_rate_lease USING btree (provider, released_at, expires_at) WHERE (released_at IS NULL);


--
-- Name: idx_prl_walker; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_prl_walker ON nex.provider_rate_lease USING btree (walker_id, released_at);


--
-- Name: idx_progress_due; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_progress_due ON nex.brain_english_progress USING btree (next_review_at) WHERE (next_review_at IS NOT NULL);


--
-- Name: idx_progress_learner; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_progress_learner ON nex.brain_english_progress USING btree (learner_ref);


--
-- Name: idx_promotion_decision_business_field_decided; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_promotion_decision_business_field_decided ON nex.food_business_promotion_decision USING btree (business_ref, field_name, decided_at DESC);


--
-- Name: idx_promotion_decision_cycle; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_promotion_decision_cycle ON nex.food_business_promotion_decision USING btree (cycle_run_id);


--
-- Name: idx_promotion_decision_evidence; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_promotion_decision_evidence ON nex.food_business_promotion_decision USING btree (evidence_id);


--
-- Name: idx_promotion_decision_rejected_lookup; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_promotion_decision_rejected_lookup ON nex.food_business_promotion_decision USING btree (business_ref, field_name, value_normalised) WHERE (decision = 'rejected'::text);


--
-- Name: idx_provenance_cycle_run; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_provenance_cycle_run ON nex.food_business_field_provenance USING btree (cycle_run_id) WHERE (cycle_run_id IS NOT NULL);


--
-- Name: idx_provider_profile_available_broadcast; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_provider_profile_available_broadcast ON nex.provider_profile USING btree (city, status, is_available) WHERE ((is_available = true) AND (status = 'active'::text));


--
-- Name: idx_provider_profile_bike_slug; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_provider_profile_bike_slug ON nex.provider_profile USING btree (bike_slug);


--
-- Name: idx_provider_profile_city_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_provider_profile_city_status ON nex.provider_profile USING btree (city, status);


--
-- Name: idx_provider_registry_caps; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_provider_registry_caps ON nex.provider_registry USING gin (capabilities);


--
-- Name: idx_provider_registry_health; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_provider_registry_health ON nex.provider_registry USING btree (current_health_state, reliability_score DESC);


--
-- Name: idx_records_audience; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_records_audience ON nex.knowledge_records USING btree (primary_audience);


--
-- Name: idx_records_category; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_records_category ON nex.knowledge_records USING btree (category);


--
-- Name: idx_records_review_due; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_records_review_due ON nex.knowledge_records USING btree (review_due_at) WHERE (status = 'AUTHORITATIVE'::text);


--
-- Name: idx_records_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_records_status ON nex.knowledge_records USING btree (status);


--
-- Name: idx_results_flags; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_results_flags ON nex.worker_results USING gin (flags);


--
-- Name: idx_results_job; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_results_job ON nex.worker_results USING btree (job_id);


--
-- Name: idx_rotation_state_city_category; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_rotation_state_city_category ON nex.discovery_rotation_state USING btree (city, category);


--
-- Name: idx_rotation_state_cooldown; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_rotation_state_cooldown ON nex.discovery_rotation_state USING btree (cooldown_until) WHERE ((cooldown_until IS NOT NULL) AND (state = 'saturated'::nex.discovery_rotation_state_kind));


--
-- Name: idx_rotation_state_last_evaluated; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_rotation_state_last_evaluated ON nex.discovery_rotation_state USING btree (last_evaluated_at DESC);


--
-- Name: idx_rotation_state_state; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_rotation_state_state ON nex.discovery_rotation_state USING btree (state);


--
-- Name: idx_saved_learner; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_saved_learner ON nex.brain_user_saved_facts USING btree (learner_ref, saved_at DESC);


--
-- Name: idx_sb_snapshot_business_ref; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_sb_snapshot_business_ref ON nex.service_business_source_snapshot USING btree (business_ref);


--
-- Name: idx_service_business_category_city; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_business_category_city ON nex.service_business USING btree (category_slug, city);


--
-- Name: idx_service_business_commercial_by_category; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_business_commercial_by_category ON nex.service_business USING btree (category_slug, commercial_status);


--
-- Name: idx_service_business_commercial_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_business_commercial_status ON nex.service_business USING btree (commercial_status);


--
-- Name: idx_service_business_cycle_run; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_business_cycle_run ON nex.service_business USING btree (cycle_run_id);


--
-- Name: idx_service_business_last_verified; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_business_last_verified ON nex.service_business USING btree (last_verified_at NULLS FIRST);


--
-- Name: idx_service_business_next_eligible_action; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_business_next_eligible_action ON nex.service_business USING btree (next_eligible_action_at) WHERE ((next_eligible_action_at IS NOT NULL) AND (commercial_status = 'marketing_ready'::text));


--
-- Name: idx_service_offer_provider; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_offer_provider ON nex.service_request_offer USING btree (provider_id, sent_at DESC);


--
-- Name: idx_service_offer_request; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_offer_request ON nex.service_request_offer USING btree (request_id);


--
-- Name: idx_service_request_active_state; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_request_active_state ON nex.service_request USING btree (state) WHERE (state = ANY (ARRAY['REQUESTED'::text, 'CONNECTED'::text, 'APPROACHING'::text, 'NEARBY'::text, 'SERVICE'::text]));


--
-- Name: idx_service_request_broadcast_open; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_request_broadcast_open ON nex.service_request USING btree (broadcast_expires_at) WHERE (state = 'REQUEST_BROADCAST'::text);


--
-- Name: idx_service_request_learner_created; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_request_learner_created ON nex.service_request USING btree (learner_ref, created_at DESC);


--
-- Name: idx_service_request_provider_state; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_service_request_provider_state ON nex.service_request USING btree (provider_id, state);


--
-- Name: idx_sources_record; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_sources_record ON nex.sources USING btree (record_id);


--
-- Name: idx_sources_tier; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_sources_tier ON nex.sources USING btree (source_tier);


--
-- Name: idx_topup_intent_pending; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_topup_intent_pending ON nex.provider_topup_intent USING btree (created_at) WHERE (state = 'pending'::text);


--
-- Name: idx_topup_intent_provider_created; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_topup_intent_provider_created ON nex.provider_topup_intent USING btree (provider_id, created_at DESC);


--
-- Name: idx_transport_acq_jurisdiction; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_transport_acq_jurisdiction ON nex.transport_acquisition_record USING btree (home_jurisdiction, discovery_stage);


--
-- Name: idx_transport_acq_outreach_optout; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_transport_acq_outreach_optout ON nex.transport_acquisition_outreach USING btree (provider_id) WHERE (opted_out_at IS NOT NULL);


--
-- Name: idx_transport_acq_outreach_provider; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_transport_acq_outreach_provider ON nex.transport_acquisition_outreach USING btree (provider_id, sent_at DESC NULLS LAST);


--
-- Name: idx_transport_acq_review; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_transport_acq_review ON nex.transport_acquisition_record USING gin (review_flags) WHERE (array_length(review_flags, 1) IS NOT NULL);


--
-- Name: idx_transport_acq_snapshot_provider; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_transport_acq_snapshot_provider ON nex.transport_acquisition_source_snapshot USING btree (provider_id, source_captured_at DESC);


--
-- Name: idx_transport_acq_snapshot_url; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_transport_acq_snapshot_url ON nex.transport_acquisition_source_snapshot USING btree (source_url);


--
-- Name: idx_transport_acq_stage; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_transport_acq_stage ON nex.transport_acquisition_record USING btree (discovery_stage);


--
-- Name: idx_transport_acq_vehicle_types; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_transport_acq_vehicle_types ON nex.transport_acquisition_record USING gin (vehicle_types);


--
-- Name: idx_transport_worker_id; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_transport_worker_id ON nex.transport_acquisition_record USING btree (worker_id) WHERE (worker_id IS NOT NULL);


--
-- Name: idx_versions_record; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_versions_record ON nex.record_versions USING btree (record_id, changed_at DESC);


--
-- Name: idx_vocab_cefr; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_vocab_cefr ON nex.brain_english_vocabulary USING btree (cefr_level);


--
-- Name: idx_vocab_freq; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_vocab_freq ON nex.brain_english_vocabulary USING btree (frequency_rank) WHERE (frequency_rank IS NOT NULL);


--
-- Name: idx_vocab_pos; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_vocab_pos ON nex.brain_english_vocabulary USING btree (part_of_speech);


--
-- Name: idx_wallet_tx_provider_created; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_wallet_tx_provider_created ON nex.provider_wallet_transaction USING btree (provider_id, created_at DESC);


--
-- Name: idx_wallet_tx_related_request; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_wallet_tx_related_request ON nex.provider_wallet_transaction USING btree (related_request_id) WHERE (related_request_id IS NOT NULL);


--
-- Name: idx_wallet_tx_topup_intent; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_wallet_tx_topup_intent ON nex.provider_wallet_transaction USING btree (related_topup_intent_id) WHERE (related_topup_intent_id IS NOT NULL);


--
-- Name: idx_wcr_status; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_wcr_status ON nex.worker_cycle_run USING btree (status);


--
-- Name: idx_wcr_type_started; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_wcr_type_started ON nex.worker_cycle_run USING btree (worker_type, started_at DESC);


--
-- Name: idx_wcr_worker_started; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_wcr_worker_started ON nex.worker_cycle_run USING btree (worker_id, started_at DESC);


--
-- Name: idx_worker_heartbeat_last_at; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_worker_heartbeat_last_at ON nex.worker_heartbeat USING btree (last_heartbeat_at DESC);


--
-- Name: idx_worker_heartbeat_type; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_worker_heartbeat_type ON nex.worker_heartbeat USING btree (worker_type);


--
-- Name: idx_worker_schedule_enabled; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX idx_worker_schedule_enabled ON nex.worker_schedule USING btree (enabled) WHERE (enabled = true);


--
-- Name: import_mappings_header_sig_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX import_mappings_header_sig_idx ON nex.import_mappings USING btree (header_signature) WHERE (archived_at IS NULL);


--
-- Name: import_mappings_label_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX import_mappings_label_idx ON nex.import_mappings USING btree (label);


--
-- Name: import_mappings_last_used_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX import_mappings_last_used_idx ON nex.import_mappings USING btree (last_used_at DESC NULLS LAST) WHERE (archived_at IS NULL);


--
-- Name: ix_bcc_enabled; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_bcc_enabled ON nex.business_calling_config USING btree (business_table, voice_enabled, video_enabled) WHERE (voice_enabled OR video_enabled);


--
-- Name: ix_bcc_ref; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_bcc_ref ON nex.business_calling_config USING btree (business_ref);


--
-- Name: ix_food_business_source_ref; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_food_business_source_ref ON nex.food_business USING btree (source, source_reference) WHERE (source_reference IS NOT NULL);


--
-- Name: INDEX ix_food_business_source_ref; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON INDEX nex.ix_food_business_source_ref IS 'Phase 1a resolver Layer 1 lookup · non-unique because 401 pre-existing conflict groups block UNIQUE until Phase 2 cleanup. Upgrade to UNIQUE in migration 116 after cleanup lands.';


--
-- Name: ix_identity_merge_log_layer_time; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_identity_merge_log_layer_time ON nex.identity_merge_log USING btree (match_layer, merged_at DESC);


--
-- Name: ix_identity_merge_log_source; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_identity_merge_log_source ON nex.identity_merge_log USING btree (incoming_source, incoming_source_reference) WHERE (incoming_source IS NOT NULL);


--
-- Name: ix_identity_merge_log_table_existing; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_identity_merge_log_table_existing ON nex.identity_merge_log USING btree (table_name, existing_ref, merged_at DESC);


--
-- Name: ix_knowledge_inbox_brain_class; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_knowledge_inbox_brain_class ON nex.knowledge_inbox USING btree (brain_slug, truth_class, created_at_iso DESC);


--
-- Name: ix_media_object_content_hash; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_media_object_content_hash ON nex.media_object USING btree (content_hash) WHERE (state = 'ready'::text);


--
-- Name: ix_media_object_context; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_media_object_context ON nex.media_object USING btree (context_type, context_ref, state, uploaded_at DESC) WHERE (context_type IS NOT NULL);


--
-- Name: ix_media_object_hard_delete; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_media_object_hard_delete ON nex.media_object USING btree (hard_delete_after) WHERE (state = 'deleted'::text);


--
-- Name: ix_media_object_owner_state; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_media_object_owner_state ON nex.media_object USING btree (owner_id, state, uploaded_at DESC);


--
-- Name: ix_media_object_type_state; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_media_object_type_state ON nex.media_object USING btree (object_type, state, uploaded_at DESC);


--
-- Name: ix_media_object_visibility_public; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_media_object_visibility_public ON nex.media_object USING btree (visibility, uploaded_at DESC) WHERE ((visibility = 'public'::text) AND (state = 'ready'::text));


--
-- Name: ix_video_feed_impression_media_time; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_video_feed_impression_media_time ON nex.video_feed_impression USING btree (media_id, seen_at DESC);


--
-- Name: ix_video_feed_impression_time; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_video_feed_impression_time ON nex.video_feed_impression USING btree (seen_at DESC);


--
-- Name: ix_video_feed_impression_viewer_time; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX ix_video_feed_impression_viewer_time ON nex.video_feed_impression USING btree (viewer_id, seen_at DESC);


--
-- Name: jobs_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX jobs_business_id_idx ON nex.jobs USING btree (business_id, updated_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: jobs_inbox_item_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX jobs_inbox_item_id_idx ON nex.jobs USING btree (inbox_item_id) WHERE (inbox_item_id IS NOT NULL);


--
-- Name: jobs_job_id_updated_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX jobs_job_id_updated_idx ON nex.jobs USING btree (job_id, updated_at DESC);


--
-- Name: jobs_owner_created_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX jobs_owner_created_idx ON nex.jobs USING btree (owner, created_at DESC) WHERE (owner IS NOT NULL);


--
-- Name: jobs_status_updated_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX jobs_status_updated_idx ON nex.jobs USING btree (status, updated_at DESC);


--
-- Name: journey_campaign_executions_in_flight_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_campaign_executions_in_flight_idx ON nex.journey_campaign_executions USING btree (status, dispatched_at) WHERE (status = 'in_flight'::text);


--
-- Name: journey_campaign_executions_journey_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_campaign_executions_journey_idx ON nex.journey_campaign_executions USING btree (journey_id, dispatched_at DESC);


--
-- Name: journey_campaign_executions_state_uniq; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX journey_campaign_executions_state_uniq ON nex.journey_campaign_executions USING btree (journey_state_id);


--
-- Name: journey_events_contact_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_events_contact_idx ON nex.journey_events USING btree (contact_id, occurred_at DESC);


--
-- Name: journey_events_journey_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_events_journey_idx ON nex.journey_events USING btree (journey_id, occurred_at DESC);


--
-- Name: journey_events_state_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_events_state_idx ON nex.journey_events USING btree (state_id, occurred_at);


--
-- Name: journey_inbound_events_key_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_inbound_events_key_time_idx ON nex.journey_inbound_events USING btree (trigger_key, received_at DESC);


--
-- Name: journey_inbound_events_pending_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_inbound_events_pending_idx ON nex.journey_inbound_events USING btree (received_at) WHERE (processed_at IS NULL);


--
-- Name: journey_inbound_events_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_inbound_events_time_idx ON nex.journey_inbound_events USING btree (received_at DESC);


--
-- Name: journey_states_contact_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_states_contact_idx ON nex.journey_states USING btree (contact_id);


--
-- Name: journey_states_ready_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_states_ready_idx ON nex.journey_states USING btree (wait_until) WHERE (status = ANY (ARRAY['active'::text, 'waiting'::text]));


--
-- Name: journey_states_slug_ver_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_states_slug_ver_idx ON nex.journey_states USING btree (journey_slug, journey_version);


--
-- Name: journey_triggers_active_per_key; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX journey_triggers_active_per_key ON nex.journey_triggers USING btree (journey_id, trigger_key) WHERE (status = 'active'::text);


--
-- Name: journey_triggers_type_active_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journey_triggers_type_active_idx ON nex.journey_triggers USING btree (trigger_type) WHERE (status = 'active'::text);


--
-- Name: journeys_active_per_slug; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX journeys_active_per_slug ON nex.journeys USING btree (slug) WHERE (status = 'active'::text);


--
-- Name: journeys_status_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX journeys_status_idx ON nex.journeys USING btree (status, updated_at DESC);


--
-- Name: kpe_chunks_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_chunks_business_id_idx ON nex.kpe_chunks USING btree (business_id) WHERE (business_id IS NOT NULL);


--
-- Name: kpe_chunks_content_hash_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_chunks_content_hash_idx ON nex.kpe_chunks USING btree (content_hash);


--
-- Name: kpe_chunks_doc_order_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_chunks_doc_order_idx ON nex.kpe_chunks USING btree (document_id, order_index);


--
-- Name: kpe_decisions_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_decisions_business_id_idx ON nex.kpe_decisions USING btree (business_id, decided_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: kpe_decisions_tier_ts_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_decisions_tier_ts_idx ON nex.kpe_decisions USING btree (((route ->> 'tier'::text)), decided_at DESC);


--
-- Name: kpe_decisions_ts_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_decisions_ts_idx ON nex.kpe_decisions USING btree (decided_at DESC);


--
-- Name: kpe_docs_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_docs_business_id_idx ON nex.kpe_documents USING btree (business_id, ingested_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: kpe_docs_classifier_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_docs_classifier_idx ON nex.kpe_documents USING btree (classifier_label) WHERE (classifier_label IS NOT NULL);


--
-- Name: kpe_docs_content_hash_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_docs_content_hash_idx ON nex.kpe_documents USING btree (content_hash);


--
-- Name: kpe_docs_source_ingested_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_docs_source_ingested_idx ON nex.kpe_documents USING btree (source, ingested_at DESC);


--
-- Name: kpe_dupes_chunk_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_dupes_chunk_idx ON nex.kpe_duplicates USING btree (chunk_id);


--
-- Name: kpe_dupes_detected_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_dupes_detected_idx ON nex.kpe_duplicates USING btree (detected_at DESC);


--
-- Name: kpe_dupes_matched_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_dupes_matched_idx ON nex.kpe_duplicates USING btree (matched_chunk_id);


--
-- Name: kpe_edges_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_edges_business_id_idx ON nex.kpe_edges USING btree (business_id, created_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: kpe_edges_from_type_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_edges_from_type_idx ON nex.kpe_edges USING btree (from_id, type);


--
-- Name: kpe_edges_to_type_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_edges_to_type_idx ON nex.kpe_edges USING btree (to_id, type);


--
-- Name: kpe_edges_type_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_edges_type_idx ON nex.kpe_edges USING btree (type);


--
-- Name: kpe_metadata_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_metadata_business_id_idx ON nex.kpe_metadata USING btree (business_id) WHERE (business_id IS NOT NULL);


--
-- Name: kpe_metadata_language_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_metadata_language_idx ON nex.kpe_metadata USING btree (language) WHERE (language IS NOT NULL);


--
-- Name: kpe_reviews_admin_ts_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_reviews_admin_ts_idx ON nex.kpe_human_reviews USING btree (admin, decided_at DESC);


--
-- Name: kpe_reviews_chunk_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_reviews_chunk_idx ON nex.kpe_human_reviews USING btree (chunk_id);


--
-- Name: kpe_reviews_decision_ts_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_reviews_decision_ts_idx ON nex.kpe_human_reviews USING btree (decision, decided_at DESC);


--
-- Name: kpe_runs_doc_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_runs_doc_idx ON nex.kpe_processing_runs USING btree (document_id);


--
-- Name: kpe_runs_started_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX kpe_runs_started_idx ON nex.kpe_processing_runs USING btree (started_at DESC);


--
-- Name: object_manifest_bucket_key_uploaded_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX object_manifest_bucket_key_uploaded_idx ON nex.object_manifest USING btree (bucket, key, uploaded_at DESC);


--
-- Name: object_manifest_bucket_uploaded_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX object_manifest_bucket_uploaded_idx ON nex.object_manifest USING btree (bucket, uploaded_at DESC);


--
-- Name: object_manifest_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX object_manifest_business_id_idx ON nex.object_manifest USING btree (business_id, uploaded_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: object_manifest_content_hash_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX object_manifest_content_hash_idx ON nex.object_manifest USING btree (content_hash);


--
-- Name: object_manifest_source_ref_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX object_manifest_source_ref_idx ON nex.object_manifest USING btree (source_ref) WHERE (source_ref IS NOT NULL);


--
-- Name: prediction_models_one_active_per_target; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX prediction_models_one_active_per_target ON nex.prediction_models USING btree (target) WHERE (status = 'active'::text);


--
-- Name: prediction_models_target_status_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX prediction_models_target_status_idx ON nex.prediction_models USING btree (target, status);


--
-- Name: predictions_contact_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX predictions_contact_idx ON nex.predictions USING btree (contact_id, created_at DESC) WHERE (contact_id IS NOT NULL);


--
-- Name: predictions_model_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX predictions_model_idx ON nex.predictions USING btree (model_id, created_at DESC);


--
-- Name: predictions_subject_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX predictions_subject_idx ON nex.predictions USING btree (subject_kind, subject_id, created_at DESC);


--
-- Name: predictions_target_created_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX predictions_target_created_idx ON nex.predictions USING btree (target, created_at DESC);


--
-- Name: recovery_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX recovery_business_id_idx ON nex.recovery_attempts USING btree (business_id, at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: recovery_job_at_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX recovery_job_at_idx ON nex.recovery_attempts USING btree (job_id, at DESC);


--
-- Name: recovery_level_at_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX recovery_level_at_idx ON nex.recovery_attempts USING btree (level, at DESC);


--
-- Name: recovery_outcome_at_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX recovery_outcome_at_idx ON nex.recovery_attempts USING btree (outcome, at DESC);


--
-- Name: recovery_runs_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX recovery_runs_time_idx ON nex.recovery_runs USING btree (ran_at DESC);


--
-- Name: safety_audit_event_actor_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX safety_audit_event_actor_time_idx ON nex.safety_audit_event USING btree (actor_user_id, event_time_utc DESC);


--
-- Name: safety_audit_event_retention_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX safety_audit_event_retention_idx ON nex.safety_audit_event USING btree (retention_until) WHERE (legal_hold = false);


--
-- Name: safety_audit_event_target_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX safety_audit_event_target_time_idx ON nex.safety_audit_event USING btree (target_id, event_time_utc DESC);


--
-- Name: safety_audit_event_type_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX safety_audit_event_type_time_idx ON nex.safety_audit_event USING btree (event_type, event_time_utc DESC);


--
-- Name: social_accounts_tenant_status_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_accounts_tenant_status_idx ON nex.social_accounts USING btree (tenant_id, status);


--
-- Name: social_admin_access_log_target_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_admin_access_log_target_time_idx ON nex.social_admin_access_log USING btree (target_tenant_id, accessed_at DESC);


--
-- Name: social_audit_events_tenant_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_audit_events_tenant_time_idx ON nex.social_audit_events USING btree (tenant_id, created_at DESC);


--
-- Name: social_audit_events_type_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_audit_events_type_time_idx ON nex.social_audit_events USING btree (event_type, created_at DESC);


--
-- Name: social_content_drafts_tenant_state_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_content_drafts_tenant_state_idx ON nex.social_content_drafts USING btree (tenant_id, grounding_state, created_at DESC);


--
-- Name: social_content_drafts_validator_run_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_content_drafts_validator_run_idx ON nex.social_content_drafts USING btree (validator_run_id) WHERE (validator_run_id IS NOT NULL);


--
-- Name: social_content_sources_active_rights_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_content_sources_active_rights_idx ON nex.social_content_sources USING btree (tenant_id, active, rights_status);


--
-- Name: social_content_sources_tenant_kind_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_content_sources_tenant_kind_idx ON nex.social_content_sources USING btree (tenant_id, kind, active);


--
-- Name: social_content_templates_tenant_kind_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_content_templates_tenant_kind_idx ON nex.social_content_templates USING btree (tenant_id, kind, status);


--
-- Name: social_dek_wraps_one_active_per_purpose; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX social_dek_wraps_one_active_per_purpose ON nex.social_dek_wraps USING btree (tenant_id, purpose) WHERE (status = 'active'::text);


--
-- Name: social_dek_wraps_tenant_purpose_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_dek_wraps_tenant_purpose_idx ON nex.social_dek_wraps USING btree (tenant_id, purpose, status);


--
-- Name: social_oauth_states_pending_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_oauth_states_pending_idx ON nex.social_oauth_states USING btree (expires_at) WHERE (consumed_at IS NULL);


--
-- Name: social_oauth_states_tenant_expires_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_oauth_states_tenant_expires_idx ON nex.social_oauth_states USING btree (tenant_id, expires_at DESC);


--
-- Name: social_publish_intents_lease_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_publish_intents_lease_idx ON nex.social_publish_intents USING btree (lease_expires_at) WHERE (status = 'in_flight'::text);


--
-- Name: social_publish_intents_tenant_status_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_publish_intents_tenant_status_idx ON nex.social_publish_intents USING btree (tenant_id, status);


--
-- Name: social_role_grants_active_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_role_grants_active_idx ON nex.social_role_grants USING btree (tenant_id, user_id, role) WHERE (revoked_at IS NULL);


--
-- Name: social_scheduled_posts_ready_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_scheduled_posts_ready_idx ON nex.social_scheduled_posts USING btree (run_at) WHERE (status = 'queued'::text);


--
-- Name: social_scheduled_posts_tenant_status_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_scheduled_posts_tenant_status_idx ON nex.social_scheduled_posts USING btree (tenant_id, status, run_at);


--
-- Name: social_tenants_kind_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_tenants_kind_idx ON nex.social_tenants USING btree (kind, status);


--
-- Name: social_tenants_merchant_slug_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_tenants_merchant_slug_idx ON nex.social_tenants USING btree (merchant_slug) WHERE (merchant_slug IS NOT NULL);


--
-- Name: social_tenants_owner_lookup_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_tenants_owner_lookup_idx ON nex.social_tenants USING btree (owner_supabase_user_id, status) WHERE (owner_supabase_user_id IS NOT NULL);


--
-- Name: social_tenants_owner_uidx; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX social_tenants_owner_uidx ON nex.social_tenants USING btree (owner_supabase_user_id) WHERE ((owner_supabase_user_id IS NOT NULL) AND (status <> 'deleted'::text));


--
-- Name: social_validator_runs_draft_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_validator_runs_draft_idx ON nex.social_validator_runs USING btree (draft_id) WHERE (draft_id IS NOT NULL);


--
-- Name: social_validator_runs_tenant_time_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX social_validator_runs_tenant_time_idx ON nex.social_validator_runs USING btree (tenant_id, started_at DESC);


--
-- Name: tracking_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX tracking_business_id_idx ON nex.tracking_events USING btree (business_id, occurred_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: tracking_contact_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX tracking_contact_idx ON nex.tracking_events USING btree (contact_id, occurred_at DESC) WHERE (contact_id IS NOT NULL);


--
-- Name: tracking_occurred_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX tracking_occurred_idx ON nex.tracking_events USING btree (occurred_at DESC);


--
-- Name: tracking_session_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX tracking_session_idx ON nex.tracking_events USING btree (session_id, occurred_at DESC) WHERE (session_id IS NOT NULL);


--
-- Name: tracking_utm_campaign_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX tracking_utm_campaign_idx ON nex.tracking_events USING btree (utm_campaign, occurred_at DESC) WHERE (utm_campaign IS NOT NULL);


--
-- Name: uniq_food_job_active_per_business_agent; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX uniq_food_job_active_per_business_agent ON nex.food_enrichment_job USING btree (business_ref, agent) WHERE (status = ANY (ARRAY['pending'::public.nex_food_enrichment_status, 'running'::public.nex_food_enrichment_status]));


--
-- Name: uniq_knowledge_inbox_hash; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX uniq_knowledge_inbox_hash ON nex.knowledge_inbox USING btree (hash);


--
-- Name: uniq_nex_food_outreach_suppression_ref_all; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX uniq_nex_food_outreach_suppression_ref_all ON nex.food_outreach_suppression USING btree (business_ref) WHERE (channel IS NULL);


--
-- Name: uniq_nex_food_outreach_suppression_ref_channel; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX uniq_nex_food_outreach_suppression_ref_channel ON nex.food_outreach_suppression USING btree (business_ref, channel) WHERE (channel IS NOT NULL);


--
-- Name: uniq_nex_food_snapshot_source_ref_at; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX uniq_nex_food_snapshot_source_ref_at ON nex.food_business_source_snapshot USING btree (source, source_reference, source_ingested_at);


--
-- Name: uq_provider_wallet_transaction_one_network_fee_per_request; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX uq_provider_wallet_transaction_one_network_fee_per_request ON nex.provider_wallet_transaction USING btree (related_request_id) WHERE ((kind = 'network_fee'::text) AND (related_request_id IS NOT NULL));


--
-- Name: INDEX uq_provider_wallet_transaction_one_network_fee_per_request; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON INDEX nex.uq_provider_wallet_transaction_one_network_fee_per_request IS 'DB backstop · at most one network_fee ledger row per completed service request · Philip 2026-08-29 · migration 139 · doctrine v5 lock 44';


--
-- Name: uq_provider_wallet_transaction_one_topup_per_intent; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX uq_provider_wallet_transaction_one_topup_per_intent ON nex.provider_wallet_transaction USING btree (related_topup_intent_id) WHERE ((kind = 'topup'::text) AND (related_topup_intent_id IS NOT NULL));


--
-- Name: INDEX uq_provider_wallet_transaction_one_topup_per_intent; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON INDEX nex.uq_provider_wallet_transaction_one_topup_per_intent IS 'DB backstop · at most one topup ledger row per Midtrans intent · Philip 2026-08-29 · migration 141 · mirrors migration 139 for network_fee';


--
-- Name: uq_service_offer_one_accepted; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX uq_service_offer_one_accepted ON nex.service_request_offer USING btree (request_id) WHERE (response = 'accepted'::text);


--
-- Name: ux_accommodation_business_source_ref; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX ux_accommodation_business_source_ref ON nex.accommodation_business USING btree (source, source_reference) WHERE (source_reference IS NOT NULL);


--
-- Name: ux_knowledge_inbox_topic_source; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX ux_knowledge_inbox_topic_source ON nex.knowledge_inbox USING btree (brain_slug, topic_key, source) WHERE ((brain_slug IS NOT NULL) AND (topic_key IS NOT NULL));


--
-- Name: ux_mp_seller_source_ref; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX ux_mp_seller_source_ref ON nex.mp_seller USING btree (source, source_reference) WHERE (source_reference IS NOT NULL);


--
-- Name: ux_sb_snapshot_source_ref; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX ux_sb_snapshot_source_ref ON nex.service_business_source_snapshot USING btree (source, source_reference);


--
-- Name: wae_business_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX wae_business_id_idx ON nex.worker_audit_events USING btree (business_id, created_at DESC) WHERE (business_id IS NOT NULL);


--
-- Name: wae_job_id_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX wae_job_id_idx ON nex.worker_audit_events USING btree (job_id, created_at DESC) WHERE (job_id IS NOT NULL);


--
-- Name: wae_provider_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX wae_provider_idx ON nex.worker_audit_events USING btree (provider, created_at DESC) WHERE (provider IS NOT NULL);


--
-- Name: wae_worker_type_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX wae_worker_type_idx ON nex.worker_audit_events USING btree (worker_type, created_at DESC);


--
-- Name: wallet_transaction_action_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX wallet_transaction_action_idx ON nex.wallet_transaction USING btree (action_id, created_at DESC) WHERE (action_id IS NOT NULL);


--
-- Name: wallet_transaction_related_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX wallet_transaction_related_idx ON nex.wallet_transaction USING btree (related_transaction_id) WHERE (related_transaction_id IS NOT NULL);


--
-- Name: wallet_transaction_user_created_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX wallet_transaction_user_created_idx ON nex.wallet_transaction USING btree (user_id, created_at DESC);


--
-- Name: work_item_completed_finished_at_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX work_item_completed_finished_at_idx ON nex.work_item USING btree (finished_at DESC) WHERE (status = 'completed'::text);


--
-- Name: work_item_idempotency_key_uniq; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX work_item_idempotency_key_uniq ON nex.work_item USING btree (idempotency_key);


--
-- Name: work_item_job_city_status_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX work_item_job_city_status_idx ON nex.work_item USING btree (job_slug, city, status);


--
-- Name: work_item_lease_expires_at_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX work_item_lease_expires_at_idx ON nex.work_item USING btree (worker_id, lease_expires_at) WHERE (lease_expires_at IS NOT NULL);


--
-- Name: work_item_status_next_retry_at_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX work_item_status_next_retry_at_idx ON nex.work_item USING btree (status, next_retry_at);


--
-- Name: worker_jobs_input_payload_kjid_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX worker_jobs_input_payload_kjid_idx ON nex.worker_jobs USING btree (((input_payload ->> 'knowledge_job_id'::text))) WHERE (input_payload ? 'knowledge_job_id'::text);


--
-- Name: worker_jobs_input_ref_active_uniq; Type: INDEX; Schema: nex; Owner: -
--

CREATE UNIQUE INDEX worker_jobs_input_ref_active_uniq ON nex.worker_jobs USING btree (input_ref, worker_type) WHERE (status = ANY (ARRAY['waiting'::text, 'assigned'::text, 'running'::text]));


--
-- Name: INDEX worker_jobs_input_ref_active_uniq; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON INDEX nex.worker_jobs_input_ref_active_uniq IS 'D1 · prevents concurrent dispatchNewInboxItems from duplicating active jobs for the same inbox item + worker_type. See docs/headquarters-production-readiness/HEADQUARTERS-REFACTOR-PLAN.md row D1.';


--
-- Name: worker_jobs_input_ref_lookup_idx; Type: INDEX; Schema: nex; Owner: -
--

CREATE INDEX worker_jobs_input_ref_lookup_idx ON nex.worker_jobs USING btree (input_ref);


--
-- Name: chat_message_archive chat_message_archive_no_mutate; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER chat_message_archive_no_mutate BEFORE DELETE OR UPDATE ON nex.chat_message_archive FOR EACH ROW EXECUTE FUNCTION nex.chat_message_archive_reject_mutation();


--
-- Name: conv_knowledge_items conv_ki_enforce_draft_tier; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER conv_ki_enforce_draft_tier BEFORE INSERT OR UPDATE ON nex.conv_knowledge_items FOR EACH ROW EXECUTE FUNCTION nex.conv_ki_enforce_draft_tier();


--
-- Name: conv_knowledge_items conv_ki_touch_updated_at; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER conv_ki_touch_updated_at BEFORE UPDATE ON nex.conv_knowledge_items FOR EACH ROW EXECUTE FUNCTION nex.conv_touch_updated_at();


--
-- Name: conv_states conv_states_touch_updated_at; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER conv_states_touch_updated_at BEFORE UPDATE ON nex.conv_states FOR EACH ROW EXECUTE FUNCTION nex.conv_touch_updated_at();


--
-- Name: safety_audit_event safety_audit_event_default_retention; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER safety_audit_event_default_retention BEFORE INSERT ON nex.safety_audit_event FOR EACH ROW EXECUTE FUNCTION nex.safety_audit_event_apply_default_retention();


--
-- Name: safety_audit_event safety_audit_event_no_delete; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER safety_audit_event_no_delete BEFORE DELETE ON nex.safety_audit_event FOR EACH ROW EXECUTE FUNCTION nex.safety_audit_event_reject_mutation();


--
-- Name: safety_audit_event safety_audit_event_restricted_update; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER safety_audit_event_restricted_update BEFORE UPDATE ON nex.safety_audit_event FOR EACH ROW EXECUTE FUNCTION nex.safety_audit_event_reject_mutation();


--
-- Name: accommodation_business trg_accommodation_business_touch_updated_at; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER trg_accommodation_business_touch_updated_at BEFORE UPDATE ON nex.accommodation_business FOR EACH ROW EXECUTE FUNCTION nex.trg_accommodation_business_touch_updated_at();


--
-- Name: media_object trg_media_object_touch; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER trg_media_object_touch BEFORE UPDATE ON nex.media_object FOR EACH ROW EXECUTE FUNCTION nex.media_object_touch_updated_at();


--
-- Name: food_business trg_nex_food_business_touch_updated_at; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER trg_nex_food_business_touch_updated_at BEFORE UPDATE ON nex.food_business FOR EACH ROW EXECUTE FUNCTION nex.food_business_touch_updated_at();


--
-- Name: food_outreach_template trg_nex_food_outreach_template_touch; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER trg_nex_food_outreach_template_touch BEFORE UPDATE ON nex.food_outreach_template FOR EACH ROW EXECUTE FUNCTION nex.food_outreach_template_touch_updated_at();


--
-- Name: wallet_transaction wallet_transaction_no_delete; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER wallet_transaction_no_delete BEFORE DELETE ON nex.wallet_transaction FOR EACH ROW EXECUTE FUNCTION nex.wallet_transaction_reject_mutation();


--
-- Name: wallet_transaction wallet_transaction_no_update; Type: TRIGGER; Schema: nex; Owner: -
--

CREATE TRIGGER wallet_transaction_no_update BEFORE UPDATE ON nex.wallet_transaction FOR EACH ROW EXECUTE FUNCTION nex.wallet_transaction_reject_mutation();


--
-- Name: accommodation_business accommodation_business_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_business
    ADD CONSTRAINT accommodation_business_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;


--
-- Name: accommodation_business_field_provenance accommodation_business_field_provenance_business_ref_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_business_field_provenance
    ADD CONSTRAINT accommodation_business_field_provenance_business_ref_fkey FOREIGN KEY (business_ref) REFERENCES nex.accommodation_business(public_listing_ref) ON DELETE CASCADE;


--
-- Name: accommodation_business_field_provenance accommodation_business_field_provenance_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_business_field_provenance
    ADD CONSTRAINT accommodation_business_field_provenance_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;


--
-- Name: accommodation_business_source_snapshot accommodation_business_source_snapshot_business_ref_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_business_source_snapshot
    ADD CONSTRAINT accommodation_business_source_snapshot_business_ref_fkey FOREIGN KEY (business_ref) REFERENCES nex.accommodation_business(public_listing_ref) ON DELETE CASCADE;


--
-- Name: accommodation_business_source_snapshot accommodation_business_source_snapshot_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_business_source_snapshot
    ADD CONSTRAINT accommodation_business_source_snapshot_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;


--
-- Name: accommodation_enrichment_evidence accommodation_enrichment_evidence_business_ref_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_enrichment_evidence
    ADD CONSTRAINT accommodation_enrichment_evidence_business_ref_fkey FOREIGN KEY (business_ref) REFERENCES nex.accommodation_business(public_listing_ref) ON DELETE CASCADE;


--
-- Name: accommodation_enrichment_evidence accommodation_enrichment_evidence_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.accommodation_enrichment_evidence
    ADD CONSTRAINT accommodation_enrichment_evidence_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;


--
-- Name: alert_dispatches alert_dispatches_alert_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.alert_dispatches
    ADD CONSTRAINT alert_dispatches_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES nex.alerts(alert_id) ON DELETE CASCADE;


--
-- Name: alerts alerts_rule_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.alerts
    ADD CONSTRAINT alerts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES nex.alert_rules(rule_id) ON DELETE RESTRICT;


--
-- Name: analytics_events analytics_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.analytics_events
    ADD CONSTRAINT analytics_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES nex.campaigns(campaign_id) ON DELETE SET NULL;


--
-- Name: attributions attributions_conversion_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.attributions
    ADD CONSTRAINT attributions_conversion_id_fkey FOREIGN KEY (conversion_id) REFERENCES nex.conversion_events(conversion_id) ON DELETE CASCADE;


--
-- Name: bike_rental_listing bike_rental_listing_preferred_bike_slug_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.bike_rental_listing
    ADD CONSTRAINT bike_rental_listing_preferred_bike_slug_fkey FOREIGN KEY (preferred_bike_slug) REFERENCES nex.bike_model(slug);


--
-- Name: brain_english_practice brain_english_practice_lesson_slug_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_practice
    ADD CONSTRAINT brain_english_practice_lesson_slug_fkey FOREIGN KEY (lesson_slug) REFERENCES nex.brain_english_lesson(lesson_slug);


--
-- Name: brain_english_progress brain_english_progress_grammar_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_progress
    ADD CONSTRAINT brain_english_progress_grammar_id_fkey FOREIGN KEY (grammar_id) REFERENCES nex.brain_english_grammar(grammar_id) ON DELETE CASCADE;


--
-- Name: brain_english_progress brain_english_progress_lesson_slug_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_progress
    ADD CONSTRAINT brain_english_progress_lesson_slug_fkey FOREIGN KEY (lesson_slug) REFERENCES nex.brain_english_lesson(lesson_slug) ON DELETE CASCADE;


--
-- Name: brain_english_progress brain_english_progress_practice_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_progress
    ADD CONSTRAINT brain_english_progress_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES nex.brain_english_practice(practice_id) ON DELETE CASCADE;


--
-- Name: brain_english_progress brain_english_progress_vocab_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_english_progress
    ADD CONSTRAINT brain_english_progress_vocab_id_fkey FOREIGN KEY (vocab_id) REFERENCES nex.brain_english_vocabulary(vocab_id) ON DELETE CASCADE;


--
-- Name: brain_user_saved_facts brain_user_saved_facts_fact_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.brain_user_saved_facts
    ADD CONSTRAINT brain_user_saved_facts_fact_id_fkey FOREIGN KEY (fact_id) REFERENCES nex.brain_did_you_know_indonesia(fact_id) ON DELETE CASCADE;


--
-- Name: business_image business_image_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.business_image
    ADD CONSTRAINT business_image_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id);


--
-- Name: campaign_recipients campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.campaign_recipients
    ADD CONSTRAINT campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES nex.campaigns(campaign_id) ON DELETE CASCADE;


--
-- Name: campaign_segments campaign_segments_campaign_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.campaign_segments
    ADD CONSTRAINT campaign_segments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES nex.campaigns(campaign_id) ON DELETE CASCADE;


--
-- Name: campaign_segments campaign_segments_segment_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.campaign_segments
    ADD CONSTRAINT campaign_segments_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES nex.contact_segments(segment_id) ON DELETE RESTRICT;


--
-- Name: campaigns campaigns_template_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.campaigns
    ADD CONSTRAINT campaigns_template_id_fkey FOREIGN KEY (template_id) REFERENCES nex.email_templates(template_id) ON DELETE SET NULL;


--
-- Name: category_candidate_calibration_annotation category_candidate_calibration_annotation_against_score_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_candidate_calibration_annotation
    ADD CONSTRAINT category_candidate_calibration_annotation_against_score_id_fkey FOREIGN KEY (against_score_id) REFERENCES nex.category_candidate_score(id) ON DELETE SET NULL;


--
-- Name: category_candidate_calibration_annotation category_candidate_calibration_annotation_candidate_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_candidate_calibration_annotation
    ADD CONSTRAINT category_candidate_calibration_annotation_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES nex.category_candidate(id) ON DELETE SET NULL;


--
-- Name: category_candidate category_candidate_duplicate_of_registry_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_candidate
    ADD CONSTRAINT category_candidate_duplicate_of_registry_id_fkey FOREIGN KEY (duplicate_of_registry_id) REFERENCES nex.category_registry(id) ON DELETE SET NULL;


--
-- Name: category_candidate category_candidate_proposed_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_candidate
    ADD CONSTRAINT category_candidate_proposed_cycle_run_id_fkey FOREIGN KEY (proposed_cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;


--
-- Name: category_candidate_score category_candidate_score_candidate_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_candidate_score
    ADD CONSTRAINT category_candidate_score_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES nex.category_candidate(id) ON DELETE CASCADE;


--
-- Name: category_candidate category_candidate_superseded_by_candidate_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_candidate
    ADD CONSTRAINT category_candidate_superseded_by_candidate_id_fkey FOREIGN KEY (superseded_by_candidate_id) REFERENCES nex.category_candidate(id) ON DELETE SET NULL;


--
-- Name: category_registry category_registry_origin_candidate_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.category_registry
    ADD CONSTRAINT category_registry_origin_candidate_fkey FOREIGN KEY (origin_candidate_id) REFERENCES nex.category_candidate(id) ON DELETE SET NULL;


--
-- Name: chat_message_archive chat_message_archive_event_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.chat_message_archive
    ADD CONSTRAINT chat_message_archive_event_id_fkey FOREIGN KEY (event_id) REFERENCES nex.safety_audit_event(event_id) ON DELETE CASCADE;


--
-- Name: chat_message_deletion chat_message_deletion_message_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.chat_message_deletion
    ADD CONSTRAINT chat_message_deletion_message_id_fkey FOREIGN KEY (message_id) REFERENCES nex.chat_message(message_id);


--
-- Name: confidence_scores confidence_scores_record_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.confidence_scores
    ADD CONSTRAINT confidence_scores_record_id_fkey FOREIGN KEY (record_id) REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE;


--
-- Name: contact_duplicate_suggestions contact_duplicate_suggestions_merge_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.contact_duplicate_suggestions
    ADD CONSTRAINT contact_duplicate_suggestions_merge_id_fkey FOREIGN KEY (merge_id) REFERENCES nex.contact_merges(merge_id);


--
-- Name: contradictions contradictions_record_a_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.contradictions
    ADD CONSTRAINT contradictions_record_a_id_fkey FOREIGN KEY (record_a_id) REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE;


--
-- Name: contradictions contradictions_record_b_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.contradictions
    ADD CONSTRAINT contradictions_record_b_id_fkey FOREIGN KEY (record_b_id) REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE;


--
-- Name: conv_edges conv_edges_from_item_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_edges
    ADD CONSTRAINT conv_edges_from_item_fkey FOREIGN KEY (from_item) REFERENCES nex.conv_knowledge_items(id) ON DELETE CASCADE;


--
-- Name: conv_edges conv_edges_to_item_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_edges
    ADD CONSTRAINT conv_edges_to_item_fkey FOREIGN KEY (to_item) REFERENCES nex.conv_knowledge_items(id) ON DELETE CASCADE;


--
-- Name: conv_feedback conv_feedback_turn_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_feedback
    ADD CONSTRAINT conv_feedback_turn_id_fkey FOREIGN KEY (turn_id) REFERENCES nex.conv_turns(id) ON DELETE CASCADE;


--
-- Name: conv_knowledge_items conv_knowledge_items_canonical_intent_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_knowledge_items
    ADD CONSTRAINT conv_knowledge_items_canonical_intent_fkey FOREIGN KEY (canonical_intent) REFERENCES nex.conv_intents(slug) ON UPDATE CASCADE;


--
-- Name: conv_learning_candidate conv_learning_candidate_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_learning_candidate
    ADD CONSTRAINT conv_learning_candidate_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE CASCADE;


--
-- Name: conv_learning_candidate conv_learning_candidate_promotion_target_record_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_learning_candidate
    ADD CONSTRAINT conv_learning_candidate_promotion_target_record_id_fkey FOREIGN KEY (promotion_target_record_id) REFERENCES nex.knowledge_records(id) ON DELETE SET NULL;


--
-- Name: conv_turns conv_turns_cle_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_turns
    ADD CONSTRAINT conv_turns_cle_cycle_run_id_fkey FOREIGN KEY (cle_cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;


--
-- Name: conv_turns conv_turns_detected_intent_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.conv_turns
    ADD CONSTRAINT conv_turns_detected_intent_fkey FOREIGN KEY (detected_intent) REFERENCES nex.conv_intents(slug) ON UPDATE CASCADE;


--
-- Name: delivery_job_attempts delivery_job_attempts_job_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.delivery_job_attempts
    ADD CONSTRAINT delivery_job_attempts_job_id_fkey FOREIGN KEY (job_id) REFERENCES nex.delivery_jobs(job_id) ON DELETE CASCADE;


--
-- Name: delivery_jobs delivery_jobs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.delivery_jobs
    ADD CONSTRAINT delivery_jobs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES nex.campaigns(campaign_id) ON DELETE CASCADE;


--
-- Name: deprecations deprecations_record_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.deprecations
    ADD CONSTRAINT deprecations_record_id_fkey FOREIGN KEY (record_id) REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE;


--
-- Name: deprecations deprecations_superseded_by_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.deprecations
    ADD CONSTRAINT deprecations_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES nex.knowledge_records(record_id);


--
-- Name: provider_profile driver_profile_bike_slug_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_profile
    ADD CONSTRAINT driver_profile_bike_slug_fkey FOREIGN KEY (bike_slug) REFERENCES nex.bike_model(slug);


--
-- Name: experiment_assignments experiment_assignments_experiment_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.experiment_assignments
    ADD CONSTRAINT experiment_assignments_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES nex.experiments(experiment_id) ON DELETE CASCADE;


--
-- Name: experiment_assignments experiment_assignments_experiment_id_variant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.experiment_assignments
    ADD CONSTRAINT experiment_assignments_experiment_id_variant_id_fkey FOREIGN KEY (experiment_id, variant_id) REFERENCES nex.experiment_variants(experiment_id, variant_id);


--
-- Name: experiment_variants experiment_variants_experiment_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.experiment_variants
    ADD CONSTRAINT experiment_variants_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES nex.experiments(experiment_id) ON DELETE CASCADE;


--
-- Name: experiment_variants experiment_variants_target_campaign_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.experiment_variants
    ADD CONSTRAINT experiment_variants_target_campaign_id_fkey FOREIGN KEY (target_campaign_id) REFERENCES nex.campaigns(campaign_id) ON DELETE SET NULL;


--
-- Name: food_business food_business_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business
    ADD CONSTRAINT food_business_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;


--
-- Name: food_business_field_provenance food_business_field_provenance_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_field_provenance
    ADD CONSTRAINT food_business_field_provenance_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;


--
-- Name: food_business_promotion_audit food_business_promotion_audit_business_ref_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_promotion_audit
    ADD CONSTRAINT food_business_promotion_audit_business_ref_fkey FOREIGN KEY (business_ref) REFERENCES nex.food_business(public_listing_ref) ON DELETE CASCADE;


--
-- Name: food_business_promotion_audit food_business_promotion_audit_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_promotion_audit
    ADD CONSTRAINT food_business_promotion_audit_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE CASCADE;


--
-- Name: food_business_promotion food_business_promotion_business_ref_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_promotion
    ADD CONSTRAINT food_business_promotion_business_ref_fkey FOREIGN KEY (business_ref) REFERENCES nex.food_business(public_listing_ref) ON DELETE CASCADE;


--
-- Name: food_business_promotion food_business_promotion_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_promotion
    ADD CONSTRAINT food_business_promotion_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;


--
-- Name: food_business_promotion_decision food_business_promotion_decision_business_ref_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_promotion_decision
    ADD CONSTRAINT food_business_promotion_decision_business_ref_fkey FOREIGN KEY (business_ref) REFERENCES nex.food_business(public_listing_ref) ON DELETE CASCADE;


--
-- Name: food_business_promotion_decision food_business_promotion_decision_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_promotion_decision
    ADD CONSTRAINT food_business_promotion_decision_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id);


--
-- Name: food_business_promotion_decision food_business_promotion_decision_evidence_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.food_business_promotion_decision
    ADD CONSTRAINT food_business_promotion_decision_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES nex.food_enrichment_evidence(evidence_id) ON DELETE CASCADE;


--
-- Name: graph_edges graph_edges_from_record_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.graph_edges
    ADD CONSTRAINT graph_edges_from_record_id_fkey FOREIGN KEY (from_record_id) REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE;


--
-- Name: journey_campaign_executions journey_campaign_executions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journey_campaign_executions
    ADD CONSTRAINT journey_campaign_executions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES nex.campaigns(campaign_id) ON DELETE RESTRICT;


--
-- Name: journey_campaign_executions journey_campaign_executions_journey_state_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journey_campaign_executions
    ADD CONSTRAINT journey_campaign_executions_journey_state_id_fkey FOREIGN KEY (journey_state_id) REFERENCES nex.journey_states(state_id) ON DELETE CASCADE;


--
-- Name: journey_states journey_states_journey_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journey_states
    ADD CONSTRAINT journey_states_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES nex.journeys(journey_id) ON DELETE RESTRICT;


--
-- Name: journey_triggers journey_triggers_journey_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.journey_triggers
    ADD CONSTRAINT journey_triggers_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES nex.journeys(journey_id) ON DELETE CASCADE;


--
-- Name: knowledge_feedback knowledge_feedback_record_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.knowledge_feedback
    ADD CONSTRAINT knowledge_feedback_record_id_fkey FOREIGN KEY (record_id) REFERENCES nex.knowledge_records(record_id) ON DELETE SET NULL;


--
-- Name: knowledge_feedback knowledge_feedback_resulted_in_record_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.knowledge_feedback
    ADD CONSTRAINT knowledge_feedback_resulted_in_record_fkey FOREIGN KEY (resulted_in_record) REFERENCES nex.knowledge_records(record_id) ON DELETE SET NULL;


--
-- Name: knowledge_records knowledge_records_supersedes_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.knowledge_records
    ADD CONSTRAINT knowledge_records_supersedes_fkey FOREIGN KEY (supersedes) REFERENCES nex.knowledge_records(record_id);


--
-- Name: llm_retry_queue llm_retry_queue_parent_job_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.llm_retry_queue
    ADD CONSTRAINT llm_retry_queue_parent_job_id_fkey FOREIGN KEY (parent_job_id) REFERENCES nex.worker_jobs(id) ON DELETE CASCADE;


--
-- Name: media_object media_object_poster_media_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.media_object
    ADD CONSTRAINT media_object_poster_media_id_fkey FOREIGN KEY (poster_media_id) REFERENCES nex.media_object(media_id) ON DELETE SET NULL;


--
-- Name: mp_category mp_category_parent_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_category
    ADD CONSTRAINT mp_category_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES nex.mp_category(category_id);


--
-- Name: mp_commerce_policy mp_commerce_policy_category_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_commerce_policy
    ADD CONSTRAINT mp_commerce_policy_category_id_fkey FOREIGN KEY (category_id) REFERENCES nex.mp_category(category_id);


--
-- Name: mp_product mp_product_category_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product
    ADD CONSTRAINT mp_product_category_id_fkey FOREIGN KEY (category_id) REFERENCES nex.mp_category(category_id);


--
-- Name: mp_product_image mp_product_image_product_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_image
    ADD CONSTRAINT mp_product_image_product_id_fkey FOREIGN KEY (product_id) REFERENCES nex.mp_product(product_id) ON DELETE CASCADE;


--
-- Name: mp_product_option mp_product_option_product_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_option
    ADD CONSTRAINT mp_product_option_product_id_fkey FOREIGN KEY (product_id) REFERENCES nex.mp_product(product_id) ON DELETE CASCADE;


--
-- Name: mp_product_option_value mp_product_option_value_option_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_option_value
    ADD CONSTRAINT mp_product_option_value_option_id_fkey FOREIGN KEY (option_id) REFERENCES nex.mp_product_option(option_id) ON DELETE CASCADE;


--
-- Name: mp_product mp_product_seller_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product
    ADD CONSTRAINT mp_product_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES nex.mp_seller(seller_id) ON DELETE CASCADE;


--
-- Name: mp_product_variant mp_product_variant_product_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_product_variant
    ADD CONSTRAINT mp_product_variant_product_id_fkey FOREIGN KEY (product_id) REFERENCES nex.mp_product(product_id) ON DELETE CASCADE;


--
-- Name: mp_seller mp_seller_cycle_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.mp_seller
    ADD CONSTRAINT mp_seller_cycle_run_id_fkey FOREIGN KEY (cycle_run_id) REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;


--
-- Name: predictions predictions_model_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.predictions
    ADD CONSTRAINT predictions_model_id_fkey FOREIGN KEY (model_id) REFERENCES nex.prediction_models(model_id);


--
-- Name: provider_rate_lease provider_rate_lease_provider_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_rate_lease
    ADD CONSTRAINT provider_rate_lease_provider_fkey FOREIGN KEY (provider) REFERENCES nex.provider_rate_config(provider);


--
-- Name: provider_topup_intent provider_topup_intent_provider_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_topup_intent
    ADD CONSTRAINT provider_topup_intent_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES nex.provider_profile(provider_id) ON DELETE CASCADE;


--
-- Name: provider_wallet provider_wallet_provider_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_wallet
    ADD CONSTRAINT provider_wallet_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES nex.provider_profile(provider_id) ON DELETE CASCADE;


--
-- Name: provider_wallet_transaction provider_wallet_transaction_provider_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_wallet_transaction
    ADD CONSTRAINT provider_wallet_transaction_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES nex.provider_profile(provider_id) ON DELETE CASCADE;


--
-- Name: provider_wallet_transaction provider_wallet_transaction_related_request_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_wallet_transaction
    ADD CONSTRAINT provider_wallet_transaction_related_request_id_fkey FOREIGN KEY (related_request_id) REFERENCES nex.service_request(request_id) ON DELETE SET NULL;


--
-- Name: provider_wallet_transaction provider_wallet_transaction_related_topup_intent_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.provider_wallet_transaction
    ADD CONSTRAINT provider_wallet_transaction_related_topup_intent_id_fkey FOREIGN KEY (related_topup_intent_id) REFERENCES nex.provider_topup_intent(intent_id) ON DELETE SET NULL;


--
-- Name: record_versions record_versions_record_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.record_versions
    ADD CONSTRAINT record_versions_record_id_fkey FOREIGN KEY (record_id) REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE;


--
-- Name: rollup_campaigns rollup_campaigns_campaign_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.rollup_campaigns
    ADD CONSTRAINT rollup_campaigns_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES nex.campaigns(campaign_id) ON DELETE CASCADE;


--
-- Name: rollup_segment rollup_segment_segment_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.rollup_segment
    ADD CONSTRAINT rollup_segment_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES nex.contact_segments(segment_id) ON DELETE CASCADE;


--
-- Name: service_request_offer service_request_offer_provider_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.service_request_offer
    ADD CONSTRAINT service_request_offer_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES nex.provider_profile(provider_id);


--
-- Name: service_request_offer service_request_offer_request_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.service_request_offer
    ADD CONSTRAINT service_request_offer_request_id_fkey FOREIGN KEY (request_id) REFERENCES nex.service_request(request_id) ON DELETE CASCADE;


--
-- Name: service_request service_request_provider_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.service_request
    ADD CONSTRAINT service_request_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES nex.provider_profile(provider_id);


--
-- Name: social_accounts social_accounts_access_dek_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_accounts
    ADD CONSTRAINT social_accounts_access_dek_id_fkey FOREIGN KEY (access_dek_id) REFERENCES nex.social_dek_wraps(dek_id);


--
-- Name: social_accounts social_accounts_refresh_dek_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_accounts
    ADD CONSTRAINT social_accounts_refresh_dek_id_fkey FOREIGN KEY (refresh_dek_id) REFERENCES nex.social_dek_wraps(dek_id);


--
-- Name: social_accounts social_accounts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_accounts
    ADD CONSTRAINT social_accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE RESTRICT;


--
-- Name: social_brand_profiles social_brand_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_brand_profiles
    ADD CONSTRAINT social_brand_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: social_category_automation social_category_automation_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_category_automation
    ADD CONSTRAINT social_category_automation_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: social_content_drafts social_content_drafts_template_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_content_drafts
    ADD CONSTRAINT social_content_drafts_template_id_fkey FOREIGN KEY (template_id) REFERENCES nex.social_content_templates(template_id) ON DELETE SET NULL;


--
-- Name: social_content_drafts social_content_drafts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_content_drafts
    ADD CONSTRAINT social_content_drafts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: social_content_drafts social_content_drafts_validator_run_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_content_drafts
    ADD CONSTRAINT social_content_drafts_validator_run_id_fkey FOREIGN KEY (validator_run_id) REFERENCES nex.social_validator_runs(run_id);


--
-- Name: social_content_sources social_content_sources_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_content_sources
    ADD CONSTRAINT social_content_sources_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: social_content_templates social_content_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_content_templates
    ADD CONSTRAINT social_content_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: social_dek_wraps social_dek_wraps_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_dek_wraps
    ADD CONSTRAINT social_dek_wraps_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: social_oauth_states social_oauth_states_code_verifier_dek_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_oauth_states
    ADD CONSTRAINT social_oauth_states_code_verifier_dek_id_fkey FOREIGN KEY (code_verifier_dek_id) REFERENCES nex.social_dek_wraps(dek_id);


--
-- Name: social_oauth_states social_oauth_states_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_oauth_states
    ADD CONSTRAINT social_oauth_states_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: social_publish_intents social_publish_intents_account_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_publish_intents
    ADD CONSTRAINT social_publish_intents_account_id_fkey FOREIGN KEY (account_id) REFERENCES nex.social_accounts(account_id) ON DELETE RESTRICT;


--
-- Name: social_publish_intents social_publish_intents_scheduled_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_publish_intents
    ADD CONSTRAINT social_publish_intents_scheduled_id_fkey FOREIGN KEY (scheduled_id) REFERENCES nex.social_scheduled_posts(scheduled_id);


--
-- Name: social_publish_intents social_publish_intents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_publish_intents
    ADD CONSTRAINT social_publish_intents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE RESTRICT;


--
-- Name: social_role_grants social_role_grants_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_role_grants
    ADD CONSTRAINT social_role_grants_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: social_scheduled_posts social_scheduled_posts_account_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_scheduled_posts
    ADD CONSTRAINT social_scheduled_posts_account_id_fkey FOREIGN KEY (account_id) REFERENCES nex.social_accounts(account_id) ON DELETE RESTRICT;


--
-- Name: social_scheduled_posts social_scheduled_posts_draft_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_scheduled_posts
    ADD CONSTRAINT social_scheduled_posts_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES nex.social_content_drafts(draft_id) ON DELETE CASCADE;


--
-- Name: social_scheduled_posts social_scheduled_posts_intent_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_scheduled_posts
    ADD CONSTRAINT social_scheduled_posts_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES nex.social_publish_intents(intent_id) ON DELETE SET NULL;


--
-- Name: social_scheduled_posts social_scheduled_posts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_scheduled_posts
    ADD CONSTRAINT social_scheduled_posts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: social_validator_runs social_validator_runs_draft_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_validator_runs
    ADD CONSTRAINT social_validator_runs_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES nex.social_content_drafts(draft_id) ON DELETE SET NULL;


--
-- Name: social_validator_runs social_validator_runs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.social_validator_runs
    ADD CONSTRAINT social_validator_runs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: sources sources_record_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.sources
    ADD CONSTRAINT sources_record_id_fkey FOREIGN KEY (record_id) REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE;


--
-- Name: sparks_product_price sparks_product_price_product_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.sparks_product_price
    ADD CONSTRAINT sparks_product_price_product_id_fkey FOREIGN KEY (product_id) REFERENCES nex.sparks_product(product_id);


--
-- Name: transport_acquisition_outreach transport_acquisition_outreach_provider_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.transport_acquisition_outreach
    ADD CONSTRAINT transport_acquisition_outreach_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES nex.transport_acquisition_record(provider_id) ON DELETE CASCADE;


--
-- Name: transport_acquisition_outreach transport_acquisition_outreach_source_evidence_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.transport_acquisition_outreach
    ADD CONSTRAINT transport_acquisition_outreach_source_evidence_snapshot_id_fkey FOREIGN KEY (source_evidence_snapshot_id) REFERENCES nex.transport_acquisition_source_snapshot(snapshot_id);


--
-- Name: transport_acquisition_source_snapshot transport_acquisition_source_snapshot_provider_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.transport_acquisition_source_snapshot
    ADD CONSTRAINT transport_acquisition_source_snapshot_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES nex.transport_acquisition_record(provider_id) ON DELETE CASCADE;


--
-- Name: wallet_transaction wallet_transaction_related_transaction_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.wallet_transaction
    ADD CONSTRAINT wallet_transaction_related_transaction_id_fkey FOREIGN KEY (related_transaction_id) REFERENCES nex.wallet_transaction(transaction_id);


--
-- Name: wallet_transaction wallet_transaction_user_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.wallet_transaction
    ADD CONSTRAINT wallet_transaction_user_id_fkey FOREIGN KEY (user_id) REFERENCES nex.user_wallet(user_id);


--
-- Name: worker_results worker_results_job_id_fkey; Type: FK CONSTRAINT; Schema: nex; Owner: -
--

ALTER TABLE ONLY nex.worker_results
    ADD CONSTRAINT worker_results_job_id_fkey FOREIGN KEY (job_id) REFERENCES nex.worker_jobs(id) ON DELETE CASCADE;


--
-- Name: alert_dispatches; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.alert_dispatches ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_rules; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.alert_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: alerts; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_events; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.analytics_events ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_records; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.analytics_records ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_rollup_queue; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.analytics_rollup_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: attributions; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.attributions ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY audit_log_brain_app_all ON nex.audit_log TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: automation_rules; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.automation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_runs; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.automation_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: benchmark_runs; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.benchmark_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: brain_memories; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.brain_memories ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_recipients; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.campaign_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_segments; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.campaign_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_events; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.compliance_events ENABLE ROW LEVEL SECURITY;

--
-- Name: confidence_scores; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.confidence_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: confidence_scores confidence_scores_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY confidence_scores_brain_app_all ON nex.confidence_scores TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: contact_duplicate_suggestions; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.contact_duplicate_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_merges; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.contact_merges ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_segments; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.contact_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_sources; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.contact_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contradictions; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.contradictions ENABLE ROW LEVEL SECURITY;

--
-- Name: contradictions contradictions_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY contradictions_brain_app_all ON nex.contradictions TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: conversion_events; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.conversion_events ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_job_attempts; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.delivery_job_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_jobs; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.delivery_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: deprecations; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.deprecations ENABLE ROW LEVEL SECURITY;

--
-- Name: deprecations deprecations_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY deprecations_brain_app_all ON nex.deprecations TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: email_templates; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.events ENABLE ROW LEVEL SECURITY;

--
-- Name: experiment_assignments; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.experiment_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: experiment_variants; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.experiment_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: experiments; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.experiments ENABLE ROW LEVEL SECURITY;

--
-- Name: graph_edges; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.graph_edges ENABLE ROW LEVEL SECURITY;

--
-- Name: graph_edges graph_edges_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY graph_edges_brain_app_all ON nex.graph_edges TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: import_mappings; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.import_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: journey_campaign_executions; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.journey_campaign_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: journey_events; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.journey_events ENABLE ROW LEVEL SECURITY;

--
-- Name: journey_inbound_events; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.journey_inbound_events ENABLE ROW LEVEL SECURITY;

--
-- Name: journey_states; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.journey_states ENABLE ROW LEVEL SECURITY;

--
-- Name: journey_triggers; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.journey_triggers ENABLE ROW LEVEL SECURITY;

--
-- Name: journeys; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.journeys ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_dump_jobs; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.knowledge_dump_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_dump_jobs knowledge_dump_jobs_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY knowledge_dump_jobs_brain_app_all ON nex.knowledge_dump_jobs TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: knowledge_feedback; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.knowledge_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_feedback knowledge_feedback_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY knowledge_feedback_brain_app_all ON nex.knowledge_feedback TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: knowledge_inbox; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.knowledge_inbox ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_inbox knowledge_inbox_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY knowledge_inbox_brain_app_all ON nex.knowledge_inbox TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: knowledge_inbox_stats; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.knowledge_inbox_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_inbox_stats knowledge_inbox_stats_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY knowledge_inbox_stats_brain_app_all ON nex.knowledge_inbox_stats TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: knowledge_records; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.knowledge_records ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_records knowledge_records_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY knowledge_records_brain_app_all ON nex.knowledge_records TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: kpe_chunks; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.kpe_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: kpe_decisions; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.kpe_decisions ENABLE ROW LEVEL SECURITY;

--
-- Name: kpe_documents; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.kpe_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: kpe_duplicates; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.kpe_duplicates ENABLE ROW LEVEL SECURITY;

--
-- Name: kpe_edges; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.kpe_edges ENABLE ROW LEVEL SECURITY;

--
-- Name: kpe_human_reviews; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.kpe_human_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: kpe_metadata; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.kpe_metadata ENABLE ROW LEVEL SECURITY;

--
-- Name: kpe_processing_runs; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.kpe_processing_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: llm_retry_queue; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.llm_retry_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: llm_retry_queue llm_retry_queue_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY llm_retry_queue_brain_app_all ON nex.llm_retry_queue TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: object_blob_current; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.object_blob_current ENABLE ROW LEVEL SECURITY;

--
-- Name: object_blob_current object_blob_current_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY object_blob_current_brain_app_all ON nex.object_blob_current TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: object_blobs; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.object_blobs ENABLE ROW LEVEL SECURITY;

--
-- Name: object_blobs object_blobs_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY object_blobs_brain_app_all ON nex.object_blobs TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: object_manifest; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.object_manifest ENABLE ROW LEVEL SECURITY;

--
-- Name: prediction_models; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.prediction_models ENABLE ROW LEVEL SECURITY;

--
-- Name: predictions; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.predictions ENABLE ROW LEVEL SECURITY;

--
-- Name: predictive_controls; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.predictive_controls ENABLE ROW LEVEL SECURITY;

--
-- Name: record_versions; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.record_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: record_versions record_versions_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY record_versions_brain_app_all ON nex.record_versions TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: recovery_attempts; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.recovery_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: recovery_runs; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.recovery_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: rollup_campaigns; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.rollup_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: rollup_country; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.rollup_country ENABLE ROW LEVEL SECURITY;

--
-- Name: rollup_daily; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.rollup_daily ENABLE ROW LEVEL SECURITY;

--
-- Name: rollup_monthly; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.rollup_monthly ENABLE ROW LEVEL SECURITY;

--
-- Name: rollup_provider; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.rollup_provider ENABLE ROW LEVEL SECURITY;

--
-- Name: rollup_segment; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.rollup_segment ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_dispatches service_role_all_alert_dispatches; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_alert_dispatches ON nex.alert_dispatches TO service_role USING (true) WITH CHECK (true);


--
-- Name: alert_rules service_role_all_alert_rules; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_alert_rules ON nex.alert_rules TO service_role USING (true) WITH CHECK (true);


--
-- Name: alerts service_role_all_alerts; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_alerts ON nex.alerts TO service_role USING (true) WITH CHECK (true);


--
-- Name: analytics_records service_role_all_analytics; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_analytics ON nex.analytics_records TO service_role USING (true) WITH CHECK (true);


--
-- Name: analytics_events service_role_all_analytics_events; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_analytics_events ON nex.analytics_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: analytics_rollup_queue service_role_all_analytics_rollup_queue; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_analytics_rollup_queue ON nex.analytics_rollup_queue TO service_role USING (true) WITH CHECK (true);


--
-- Name: automation_rules service_role_all_arules; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_arules ON nex.automation_rules TO service_role USING (true) WITH CHECK (true);


--
-- Name: automation_runs service_role_all_aruns; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_aruns ON nex.automation_runs TO service_role USING (true) WITH CHECK (true);


--
-- Name: attributions service_role_all_attributions; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_attributions ON nex.attributions TO service_role USING (true) WITH CHECK (true);


--
-- Name: benchmark_runs service_role_all_benchmark_runs; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_benchmark_runs ON nex.benchmark_runs TO service_role USING (true) WITH CHECK (true);


--
-- Name: brain_memories service_role_all_bm; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_bm ON nex.brain_memories TO service_role USING (true) WITH CHECK (true);


--
-- Name: campaign_recipients service_role_all_campaign_recipients; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_campaign_recipients ON nex.campaign_recipients TO service_role USING (true) WITH CHECK (true);


--
-- Name: campaign_segments service_role_all_campaign_segments; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_campaign_segments ON nex.campaign_segments TO service_role USING (true) WITH CHECK (true);


--
-- Name: campaigns service_role_all_campaigns; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_campaigns ON nex.campaigns TO service_role USING (true) WITH CHECK (true);


--
-- Name: compliance_events service_role_all_compliance_events; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_compliance_events ON nex.compliance_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: contact_duplicate_suggestions service_role_all_contact_dup; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_contact_dup ON nex.contact_duplicate_suggestions TO service_role USING (true) WITH CHECK (true);


--
-- Name: contact_merges service_role_all_contact_merges; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_contact_merges ON nex.contact_merges TO service_role USING (true) WITH CHECK (true);


--
-- Name: contact_segments service_role_all_contact_segments; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_contact_segments ON nex.contact_segments TO service_role USING (true) WITH CHECK (true);


--
-- Name: contact_sources service_role_all_contact_sources; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_contact_sources ON nex.contact_sources TO service_role USING (true) WITH CHECK (true);


--
-- Name: contacts service_role_all_contacts; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_contacts ON nex.contacts TO service_role USING (true) WITH CHECK (true);


--
-- Name: conversion_events service_role_all_conversion_events; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_conversion_events ON nex.conversion_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: delivery_job_attempts service_role_all_delivery_job_attempts; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_delivery_job_attempts ON nex.delivery_job_attempts TO service_role USING (true) WITH CHECK (true);


--
-- Name: delivery_jobs service_role_all_delivery_jobs; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_delivery_jobs ON nex.delivery_jobs TO service_role USING (true) WITH CHECK (true);


--
-- Name: email_templates service_role_all_email_templates; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_email_templates ON nex.email_templates TO service_role USING (true) WITH CHECK (true);


--
-- Name: events service_role_all_events; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_events ON nex.events TO service_role USING (true) WITH CHECK (true);


--
-- Name: experiment_assignments service_role_all_experiment_assignments; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_experiment_assignments ON nex.experiment_assignments TO service_role USING (true) WITH CHECK (true);


--
-- Name: experiment_variants service_role_all_experiment_variants; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_experiment_variants ON nex.experiment_variants TO service_role USING (true) WITH CHECK (true);


--
-- Name: experiments service_role_all_experiments; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_experiments ON nex.experiments TO service_role USING (true) WITH CHECK (true);


--
-- Name: import_mappings service_role_all_import_mappings; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_import_mappings ON nex.import_mappings TO service_role USING (true) WITH CHECK (true);


--
-- Name: jobs service_role_all_jobs; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_jobs ON nex.jobs TO service_role USING (true) WITH CHECK (true);


--
-- Name: journey_campaign_executions service_role_all_journey_campaign_executions; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_journey_campaign_executions ON nex.journey_campaign_executions TO service_role USING (true) WITH CHECK (true);


--
-- Name: journey_events service_role_all_journey_events; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_journey_events ON nex.journey_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: journey_inbound_events service_role_all_journey_inbound_events; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_journey_inbound_events ON nex.journey_inbound_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: journey_states service_role_all_journey_states; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_journey_states ON nex.journey_states TO service_role USING (true) WITH CHECK (true);


--
-- Name: journey_triggers service_role_all_journey_triggers; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_journey_triggers ON nex.journey_triggers TO service_role USING (true) WITH CHECK (true);


--
-- Name: journeys service_role_all_journeys; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_journeys ON nex.journeys TO service_role USING (true) WITH CHECK (true);


--
-- Name: kpe_chunks service_role_all_kpe_chunks; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_kpe_chunks ON nex.kpe_chunks TO service_role USING (true) WITH CHECK (true);


--
-- Name: kpe_decisions service_role_all_kpe_decisions; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_kpe_decisions ON nex.kpe_decisions TO service_role USING (true) WITH CHECK (true);


--
-- Name: kpe_documents service_role_all_kpe_documents; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_kpe_documents ON nex.kpe_documents TO service_role USING (true) WITH CHECK (true);


--
-- Name: kpe_duplicates service_role_all_kpe_duplicates; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_kpe_duplicates ON nex.kpe_duplicates TO service_role USING (true) WITH CHECK (true);


--
-- Name: kpe_edges service_role_all_kpe_edges; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_kpe_edges ON nex.kpe_edges TO service_role USING (true) WITH CHECK (true);


--
-- Name: kpe_human_reviews service_role_all_kpe_human_reviews; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_kpe_human_reviews ON nex.kpe_human_reviews TO service_role USING (true) WITH CHECK (true);


--
-- Name: kpe_metadata service_role_all_kpe_metadata; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_kpe_metadata ON nex.kpe_metadata TO service_role USING (true) WITH CHECK (true);


--
-- Name: kpe_processing_runs service_role_all_kpe_processing_runs; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_kpe_processing_runs ON nex.kpe_processing_runs TO service_role USING (true) WITH CHECK (true);


--
-- Name: object_manifest service_role_all_object_manifest; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_object_manifest ON nex.object_manifest TO service_role USING (true) WITH CHECK (true);


--
-- Name: prediction_models service_role_all_prediction_models; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_prediction_models ON nex.prediction_models TO service_role USING (true) WITH CHECK (true);


--
-- Name: predictions service_role_all_predictions; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_predictions ON nex.predictions TO service_role USING (true) WITH CHECK (true);


--
-- Name: predictive_controls service_role_all_predictive_controls; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_predictive_controls ON nex.predictive_controls TO service_role USING (true) WITH CHECK (true);


--
-- Name: recovery_attempts service_role_all_recovery; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_recovery ON nex.recovery_attempts TO service_role USING (true) WITH CHECK (true);


--
-- Name: recovery_runs service_role_all_recovery_runs; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_recovery_runs ON nex.recovery_runs TO service_role USING (true) WITH CHECK (true);


--
-- Name: rollup_campaigns service_role_all_rollup_campaigns; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_rollup_campaigns ON nex.rollup_campaigns TO service_role USING (true) WITH CHECK (true);


--
-- Name: rollup_country service_role_all_rollup_country; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_rollup_country ON nex.rollup_country TO service_role USING (true) WITH CHECK (true);


--
-- Name: rollup_daily service_role_all_rollup_daily; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_rollup_daily ON nex.rollup_daily TO service_role USING (true) WITH CHECK (true);


--
-- Name: rollup_monthly service_role_all_rollup_monthly; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_rollup_monthly ON nex.rollup_monthly TO service_role USING (true) WITH CHECK (true);


--
-- Name: rollup_provider service_role_all_rollup_provider; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_rollup_provider ON nex.rollup_provider TO service_role USING (true) WITH CHECK (true);


--
-- Name: rollup_segment service_role_all_rollup_segment; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_rollup_segment ON nex.rollup_segment TO service_role USING (true) WITH CHECK (true);


--
-- Name: tracking_events service_role_all_tracking; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_tracking ON nex.tracking_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: worker_audit_events service_role_all_wae; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY service_role_all_wae ON nex.worker_audit_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: social_accounts; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: social_accounts social_accounts_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_accounts_tenant_delete ON nex.social_accounts FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_accounts social_accounts_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_accounts_tenant_insert ON nex.social_accounts FOR INSERT WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_accounts social_accounts_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_accounts_tenant_select ON nex.social_accounts FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: social_accounts social_accounts_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_accounts_tenant_update ON nex.social_accounts FOR UPDATE USING ((tenant_id = nex._current_social_tenant())) WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_admin_access_log; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_admin_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: social_admin_access_log social_admin_access_log_target_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_admin_access_log_target_insert ON nex.social_admin_access_log FOR INSERT WITH CHECK (nex._admin_bypass_active());


--
-- Name: social_admin_access_log social_admin_access_log_target_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_admin_access_log_target_select ON nex.social_admin_access_log FOR SELECT USING (((target_tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: analytics_events social_app_insert_social_events; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_app_insert_social_events ON nex.analytics_events FOR INSERT TO nex_social_app WITH CHECK ((provider ~~ 'social:%'::text));


--
-- Name: attributions social_app_select_attributions; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_app_select_attributions ON nex.attributions FOR SELECT TO nex_social_app USING (true);


--
-- Name: conversion_events social_app_select_conversions; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_app_select_conversions ON nex.conversion_events FOR SELECT TO nex_social_app USING (true);


--
-- Name: analytics_events social_app_select_social_events; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_app_select_social_events ON nex.analytics_events FOR SELECT TO nex_social_app USING ((provider ~~ 'social:%'::text));


--
-- Name: social_audit_events; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: social_audit_events social_audit_events_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_audit_events_tenant_delete ON nex.social_audit_events FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_audit_events social_audit_events_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_audit_events_tenant_insert ON nex.social_audit_events FOR INSERT WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_audit_events social_audit_events_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_audit_events_tenant_select ON nex.social_audit_events FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: social_audit_events social_audit_events_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_audit_events_tenant_update ON nex.social_audit_events FOR UPDATE USING ((tenant_id = nex._current_social_tenant())) WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_brand_profiles; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_brand_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: social_brand_profiles social_brand_profiles_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_brand_profiles_tenant_delete ON nex.social_brand_profiles FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_brand_profiles social_brand_profiles_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_brand_profiles_tenant_insert ON nex.social_brand_profiles FOR INSERT WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_brand_profiles social_brand_profiles_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_brand_profiles_tenant_select ON nex.social_brand_profiles FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: social_brand_profiles social_brand_profiles_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_brand_profiles_tenant_update ON nex.social_brand_profiles FOR UPDATE USING ((tenant_id = nex._current_social_tenant())) WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_category_automation; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_category_automation ENABLE ROW LEVEL SECURITY;

--
-- Name: social_category_automation social_category_automation_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_category_automation_tenant_delete ON nex.social_category_automation FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_category_automation social_category_automation_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_category_automation_tenant_insert ON nex.social_category_automation FOR INSERT WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_category_automation social_category_automation_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_category_automation_tenant_select ON nex.social_category_automation FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: social_category_automation social_category_automation_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_category_automation_tenant_update ON nex.social_category_automation FOR UPDATE USING ((tenant_id = nex._current_social_tenant())) WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_content_drafts; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_content_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: social_content_drafts social_content_drafts_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_drafts_tenant_delete ON nex.social_content_drafts FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_content_drafts social_content_drafts_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_drafts_tenant_insert ON nex.social_content_drafts FOR INSERT WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_content_drafts social_content_drafts_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_drafts_tenant_select ON nex.social_content_drafts FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: social_content_drafts social_content_drafts_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_drafts_tenant_update ON nex.social_content_drafts FOR UPDATE USING ((tenant_id = nex._current_social_tenant())) WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_content_sources; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_content_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: social_content_sources social_content_sources_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_sources_tenant_delete ON nex.social_content_sources FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_content_sources social_content_sources_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_sources_tenant_insert ON nex.social_content_sources FOR INSERT WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_content_sources social_content_sources_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_sources_tenant_select ON nex.social_content_sources FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: social_content_sources social_content_sources_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_sources_tenant_update ON nex.social_content_sources FOR UPDATE USING ((tenant_id = nex._current_social_tenant())) WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_content_templates; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_content_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: social_content_templates social_content_templates_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_templates_tenant_delete ON nex.social_content_templates FOR DELETE USING (((tenant_id = nex._current_social_tenant()) OR ((tenant_id IS NULL) AND nex._admin_bypass_active())));


--
-- Name: social_content_templates social_content_templates_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_templates_tenant_insert ON nex.social_content_templates FOR INSERT WITH CHECK (((tenant_id = nex._current_social_tenant()) OR ((tenant_id IS NULL) AND nex._admin_bypass_active())));


--
-- Name: social_content_templates social_content_templates_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_templates_tenant_select ON nex.social_content_templates FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR (tenant_id IS NULL) OR nex._admin_bypass_active()));


--
-- Name: social_content_templates social_content_templates_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_content_templates_tenant_update ON nex.social_content_templates FOR UPDATE USING (((tenant_id = nex._current_social_tenant()) OR ((tenant_id IS NULL) AND nex._admin_bypass_active()))) WITH CHECK (((tenant_id = nex._current_social_tenant()) OR ((tenant_id IS NULL) AND nex._admin_bypass_active())));


--
-- Name: social_controls; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_controls ENABLE ROW LEVEL SECURITY;

--
-- Name: social_controls social_controls_admin_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_controls_admin_update ON nex.social_controls FOR UPDATE USING (nex._admin_bypass_active()) WITH CHECK (nex._admin_bypass_active());


--
-- Name: social_controls social_controls_all_read; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_controls_all_read ON nex.social_controls FOR SELECT USING (true);


--
-- Name: social_dek_wraps; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_dek_wraps ENABLE ROW LEVEL SECURITY;

--
-- Name: social_dek_wraps social_dek_wraps_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_dek_wraps_tenant_delete ON nex.social_dek_wraps FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_dek_wraps social_dek_wraps_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_dek_wraps_tenant_insert ON nex.social_dek_wraps FOR INSERT WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_dek_wraps social_dek_wraps_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_dek_wraps_tenant_select ON nex.social_dek_wraps FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: social_dek_wraps social_dek_wraps_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_dek_wraps_tenant_update ON nex.social_dek_wraps FOR UPDATE USING ((tenant_id = nex._current_social_tenant())) WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_oauth_states; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_oauth_states ENABLE ROW LEVEL SECURITY;

--
-- Name: social_oauth_states social_oauth_states_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_oauth_states_tenant_delete ON nex.social_oauth_states FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_oauth_states social_oauth_states_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_oauth_states_tenant_insert ON nex.social_oauth_states FOR INSERT WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_oauth_states social_oauth_states_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_oauth_states_tenant_select ON nex.social_oauth_states FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: social_oauth_states social_oauth_states_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_oauth_states_tenant_update ON nex.social_oauth_states FOR UPDATE USING ((tenant_id = nex._current_social_tenant())) WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_publish_intents; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_publish_intents ENABLE ROW LEVEL SECURITY;

--
-- Name: social_publish_intents social_publish_intents_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_publish_intents_tenant_delete ON nex.social_publish_intents FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_publish_intents social_publish_intents_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_publish_intents_tenant_insert ON nex.social_publish_intents FOR INSERT WITH CHECK (((tenant_id = nex._current_social_tenant()) OR nex._worker_active()));


--
-- Name: social_publish_intents social_publish_intents_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_publish_intents_tenant_select ON nex.social_publish_intents FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active() OR nex._worker_active()));


--
-- Name: social_publish_intents social_publish_intents_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_publish_intents_tenant_update ON nex.social_publish_intents FOR UPDATE USING (((tenant_id = nex._current_social_tenant()) OR nex._worker_active())) WITH CHECK (((tenant_id = nex._current_social_tenant()) OR nex._worker_active()));


--
-- Name: social_role_grants; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_role_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: social_role_grants social_role_grants_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_role_grants_tenant_delete ON nex.social_role_grants FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_role_grants social_role_grants_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_role_grants_tenant_insert ON nex.social_role_grants FOR INSERT WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_role_grants social_role_grants_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_role_grants_tenant_select ON nex.social_role_grants FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: social_role_grants social_role_grants_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_role_grants_tenant_update ON nex.social_role_grants FOR UPDATE USING ((tenant_id = nex._current_social_tenant())) WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_scheduled_posts; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_scheduled_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: social_scheduled_posts social_scheduled_posts_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_scheduled_posts_tenant_delete ON nex.social_scheduled_posts FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_scheduled_posts social_scheduled_posts_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_scheduled_posts_tenant_insert ON nex.social_scheduled_posts FOR INSERT WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_scheduled_posts social_scheduled_posts_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_scheduled_posts_tenant_select ON nex.social_scheduled_posts FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active() OR nex._worker_active()));


--
-- Name: social_scheduled_posts social_scheduled_posts_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_scheduled_posts_tenant_update ON nex.social_scheduled_posts FOR UPDATE USING (((tenant_id = nex._current_social_tenant()) OR nex._worker_active())) WITH CHECK (((tenant_id = nex._current_social_tenant()) OR nex._worker_active()));


--
-- Name: social_tenants; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: social_tenants social_tenants_admin_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_tenants_admin_delete ON nex.social_tenants FOR DELETE USING (nex._admin_bypass_active());


--
-- Name: social_tenants social_tenants_admin_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_tenants_admin_insert ON nex.social_tenants FOR INSERT WITH CHECK (nex._admin_bypass_active());


--
-- Name: social_tenants social_tenants_self_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_tenants_self_select ON nex.social_tenants FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: social_tenants social_tenants_self_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_tenants_self_update ON nex.social_tenants FOR UPDATE USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active())) WITH CHECK (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: POLICY social_tenants_self_update ON social_tenants; Type: COMMENT; Schema: nex; Owner: -
--

COMMENT ON POLICY social_tenants_self_update ON nex.social_tenants IS 'Phase 7 · self-update OR admin bypass · admin bypass writes audited via Boundary-3 wrapper';


--
-- Name: social_validator_runs; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.social_validator_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: social_validator_runs social_validator_runs_tenant_delete; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_validator_runs_tenant_delete ON nex.social_validator_runs FOR DELETE USING ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_validator_runs social_validator_runs_tenant_insert; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_validator_runs_tenant_insert ON nex.social_validator_runs FOR INSERT WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: social_validator_runs social_validator_runs_tenant_select; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_validator_runs_tenant_select ON nex.social_validator_runs FOR SELECT USING (((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()));


--
-- Name: social_validator_runs social_validator_runs_tenant_update; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY social_validator_runs_tenant_update ON nex.social_validator_runs FOR UPDATE USING ((tenant_id = nex._current_social_tenant())) WITH CHECK ((tenant_id = nex._current_social_tenant()));


--
-- Name: sources; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.sources ENABLE ROW LEVEL SECURITY;

--
-- Name: sources sources_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY sources_brain_app_all ON nex.sources TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: tracking_events; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.tracking_events ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_audit_events; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.worker_audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_heartbeat; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.worker_heartbeat ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_heartbeat worker_heartbeat_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY worker_heartbeat_brain_app_all ON nex.worker_heartbeat TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: worker_jobs; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.worker_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_jobs worker_jobs_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY worker_jobs_brain_app_all ON nex.worker_jobs TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: worker_results; Type: ROW SECURITY; Schema: nex; Owner: -
--

ALTER TABLE nex.worker_results ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_results worker_results_brain_app_all; Type: POLICY; Schema: nex; Owner: -
--

CREATE POLICY worker_results_brain_app_all ON nex.worker_results TO nex_brain_app USING (true) WITH CHECK (true);


--
-- Name: food_business_value; Type: MATERIALIZED VIEW DATA; Schema: nex; Owner: -
--

REFRESH MATERIALIZED VIEW nex.food_business_value;


--
-- PostgreSQL database dump complete
--

\unrestrict f0W2CWahmZudcs4M3nKUITu4qZL4zFq3j5rdfeUaH4d3C9UOygxepbdLd8Fxe2M

