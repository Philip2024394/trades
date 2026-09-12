--
-- PostgreSQL database dump
--

\restrict XHUZscM3sRDCW1uWafP5AnIiUCARBtVflAMMkQKrzBtkcIESi7dAbBvUJpI1eoS

-- Dumped from database version 17.6
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
-- Name: nex_workforce; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA nex_workforce;


--
-- Name: _crockford5(text); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce._crockford5(p_input text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
DECLARE
  v_alpha text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; -- Crockford Base32 (no I, L, O, U)
  v_bytes bytea;
  v_num   numeric := 0;
  v_i     integer;
  v_out   text := '';
BEGIN
  -- Slice 4.1 (2026-09-04): fully-qualified as extensions.digest per Supabase
  -- pgcrypto placement · under hardened search_path = pg_catalog, pg_temp the
  -- explicit extensions.<fn> form is required · unqualified/`public`-schema
  -- variants fail on Supabase where pgcrypto lives in extensions.
  v_bytes := extensions.digest(p_input, 'sha256');
  FOR v_i IN 0..4 LOOP
    v_num := v_num * 256 + get_byte(v_bytes, v_i);
  END LOOP;
  FOR v_i IN 1..5 LOOP
    v_out := substring(v_alpha FROM ((v_num % 32)::integer + 1) FOR 1) || v_out;
    v_num := trunc(v_num / 32);
  END LOOP;
  RETURN v_out;
END;
$$;


--
-- Name: checkpoint(text, uuid, integer, jsonb); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.checkpoint(p_agent_id text, p_work_item_id uuid, p_generation integer, p_cursor_json jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  DECLARE
    v_lease_minutes integer;
    v_updated       integer;
  BEGIN
    PERFORM set_config('nex_workforce.mutation_context', 'checkpoint', true);

    SELECT j.lease_minutes INTO v_lease_minutes
    FROM nex_workforce.work_item wi
    JOIN nex_workforce.job_registry j
      ON j.category_slug = wi.category_slug AND j.source_slug = wi.source_slug
    WHERE wi.id = p_work_item_id;

    UPDATE nex_workforce.work_item
    SET cursor_json    = p_cursor_json,
        lease_deadline = now() + make_interval(mins => COALESCE(v_lease_minutes, 15)),
        updated_at     = now()
    WHERE id         = p_work_item_id
      AND agent_id   = p_agent_id
      AND generation = p_generation
      AND state      = 'leased';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated = 1;
  END;
  $$;


--
-- Name: claim(text); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.claim(p_agent_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  DECLARE
    v_row nex_workforce.work_item;
    v_candidate RECORD;
    v_lock_acquired boolean;
    v_current_count integer;
  BEGIN
    IF p_agent_id IS NULL OR length(p_agent_id) = 0 THEN
      RAISE EXCEPTION 'claim requires non-null agent_id';
    END IF;

    PERFORM set_config('nex_workforce.mutation_context', 'claim', true);

    -- Loop over pending candidates in priority order. SKIP LOCKED so we don't
    -- collide with other agents on the same row. For each candidate, attempt
    -- the per-source advisory lock; if held, skip to next candidate. Otherwise
    -- re-check cap under the lock and claim if under cap.
    FOR v_candidate IN
      SELECT wi.id,
             wi.source_slug,
             j.lease_minutes,
             j.max_concurrent_per_source
      FROM nex_workforce.work_item wi
      JOIN nex_workforce.job_registry j
        ON j.category_slug = wi.category_slug
       AND j.source_slug   = wi.source_slug
      WHERE wi.state = 'pending'
        AND wi.next_eligible_at <= now()
      ORDER BY wi.priority DESC, wi.updated_at ASC
      FOR UPDATE OF wi SKIP LOCKED
    LOOP
      -- Try per-source advisory lock (transaction-scoped, auto-released at COMMIT).
      -- Key prefix scopes the lock namespace to nex_workforce.claim; hashtext
      -- collapses the string to the int4 accepted by pg_try_advisory_xact_lock.
      v_lock_acquired := pg_try_advisory_xact_lock(
        hashtext('nex_workforce.claim.source:' || v_candidate.source_slug)
      );

      IF NOT v_lock_acquired THEN
        -- Another claim() transaction holds this source's lock. Skip this
        -- candidate; the SKIP LOCKED row lock we hold releases naturally at
        -- transaction end (or the FOR loop moves to the next FETCH).
        CONTINUE;
      END IF;

      -- Advisory lock held. Re-count leased rows for this source under the lock.
      SELECT count(*)
        INTO v_current_count
      FROM nex_workforce.work_item wi3
      WHERE wi3.state = 'leased'
        AND wi3.source_slug = v_candidate.source_slug;

      IF v_current_count >= v_candidate.max_concurrent_per_source THEN
        -- Source is at cap. Skip this candidate. Advisory lock releases at COMMIT
        -- but we're not committing yet — the lock is held for the rest of this
        -- transaction, which is fine because we're not going to claim this
        -- source in this call anyway. (Same-transaction lock re-acquisition of
        -- the same key is a no-op.)
        CONTINUE;
      END IF;

      -- Under-cap and lock held. Claim this candidate.
      UPDATE nex_workforce.work_item wi
      SET state          = 'leased',
          agent_id       = p_agent_id,
          generation     = wi.generation + 1,
          attempts       = wi.attempts + 1,
          lease_deadline = now() + make_interval(mins => v_candidate.lease_minutes),
          started_at     = COALESCE(wi.started_at, now()),
          updated_at     = now()
      WHERE wi.id = v_candidate.id
      RETURNING wi.* INTO v_row;

      -- Success. One claim per call. Advisory lock releases at COMMIT.
      RETURN to_jsonb(v_row);
    END LOOP;

    -- Nothing claimable this call (queue drained OR every eligible candidate's
    -- source is at cap OR under contention). Client should sleep + retry.
    RETURN NULL;
  END;
  $$;


--
-- Name: complete(text, uuid, integer, integer, integer); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.complete(p_agent_id text, p_work_item_id uuid, p_generation integer, p_records_new integer, p_records_rejected integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  DECLARE v_updated integer;
  BEGIN
    PERFORM set_config('nex_workforce.mutation_context', 'complete', true);

    UPDATE nex_workforce.work_item
    SET state            = 'completed',
        finished_at      = now(),
        agent_id         = NULL,
        lease_deadline   = NULL,
        records_new      = p_records_new,
        records_rejected = p_records_rejected,
        updated_at       = now()
    WHERE id         = p_work_item_id
      AND agent_id   = p_agent_id
      AND generation = p_generation
      AND state      = 'leased';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated = 1;
  END;
  $$;


--
-- Name: enforce_state_transitions(); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.enforce_state_transitions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  DECLARE
    v_context text := current_setting('nex_workforce.mutation_context', true);
  BEGIN
    -- INSERT: only 'pending' state permitted at birth
    IF TG_OP = 'INSERT' THEN
      IF NEW.state <> 'pending' THEN
        RAISE EXCEPTION 'work_item may only be inserted with state=pending, got state=%', NEW.state;
      END IF;
      RETURN NEW;
    END IF;

    -- Terminal states can NEVER be mutated (not even for heartbeat / lease field updates)
    IF OLD.state IN ('completed', 'dead_letter') THEN
      RAISE EXCEPTION 'work_item state=% is terminal and immutable (id=%)', OLD.state, OLD.id;
    END IF;

    -- Same-state UPDATEs (heartbeat, checkpoint) are allowed for non-terminal states
    IF OLD.state = NEW.state THEN
      RETURN NEW;
    END IF;

    -- State changed. Validate transition + required context.
    IF OLD.state = 'pending' AND NEW.state = 'leased' THEN
      IF v_context IS DISTINCT FROM 'claim' THEN
        RAISE EXCEPTION 'pending→leased requires mutation_context=claim (got context=%)', COALESCE(v_context, '(unset)');
      END IF;
    ELSIF OLD.state = 'leased' AND NEW.state = 'completed' THEN
      IF v_context IS DISTINCT FROM 'complete' THEN
        RAISE EXCEPTION 'leased→completed requires mutation_context=complete (got context=%)', COALESCE(v_context, '(unset)');
      END IF;
    ELSIF OLD.state = 'leased' AND NEW.state = 'soft_fail' THEN
      IF v_context IS DISTINCT FROM 'fail_soft' THEN
        RAISE EXCEPTION 'leased→soft_fail requires mutation_context=fail_soft (got context=%)', COALESCE(v_context, '(unset)');
      END IF;
    ELSIF OLD.state = 'leased' AND NEW.state = 'dead_letter' THEN
      -- Two accepted contexts:
      --   'fail_hard'          → agent-initiated (agent decided to give up)
      --   'reaper_dead_letter' → reaper-initiated (attempts exhausted after lease expiry)
      IF COALESCE(v_context, '') NOT IN ('fail_hard', 'reaper_dead_letter') THEN
        RAISE EXCEPTION 'leased→dead_letter requires mutation_context IN (fail_hard, reaper_dead_letter) (got context=%)', COALESCE(v_context, '(unset)');
      END IF;
    ELSIF OLD.state = 'leased' AND NEW.state = 'pending' THEN
      -- REAPER-ONLY · the only path where a leased row returns to pending.
      -- A misbehaving client cannot accidentally do this; requires explicit
      -- SET nex_workforce.mutation_context = 'reaper'.
      IF v_context IS DISTINCT FROM 'reaper' THEN
        RAISE EXCEPTION 'leased→pending is reaper-only (got context=%). Clients must not requeue leased work; use fail_soft/fail_hard.', COALESCE(v_context, '(unset)');
      END IF;
    ELSIF OLD.state = 'soft_fail' AND NEW.state = 'pending' THEN
      -- Orchestrator-only backoff-elapsed requeue
      IF v_context IS DISTINCT FROM 'orchestrator' THEN
        RAISE EXCEPTION 'soft_fail→pending is orchestrator-only backoff-elapsed requeue (got context=%)', COALESCE(v_context, '(unset)');
      END IF;
    ELSIF OLD.state = 'soft_fail' AND NEW.state = 'dead_letter' THEN
      IF v_context IS DISTINCT FROM 'fail_hard' THEN
        RAISE EXCEPTION 'soft_fail→dead_letter requires mutation_context=fail_hard (got context=%)', COALESCE(v_context, '(unset)');
      END IF;
    ELSE
      RAISE EXCEPTION 'invalid state transition %→% (id=%)', OLD.state, NEW.state, OLD.id;
    END IF;

    RETURN NEW;
  END;
  $$;


--
-- Name: enqueue_from_view(); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.enqueue_from_view() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
    DECLARE
      v_enqueued integer;
    BEGIN
      WITH inserted AS (
        INSERT INTO nex_workforce.work_item
          (city_slug, category_slug, source_slug, priority, state, bbox_json)
        SELECT city_slug, category_slug, source_slug, priority, 'pending', bbox_json
          FROM nex_workforce.rotation_eligible
        ON CONFLICT (city_slug, category_slug, source_slug)
          WHERE state IN ('pending', 'leased', 'soft_fail')
        DO NOTHING
        RETURNING id
      )
      SELECT COUNT(*)::integer INTO v_enqueued FROM inserted;
      RETURN v_enqueued;
    END;
    $$;


--
-- Name: fail_hard(text, uuid, integer, text, text); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.fail_hard(p_agent_id text, p_work_item_id uuid, p_generation integer, p_last_error text, p_last_error_class text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  DECLARE v_row nex_workforce.work_item;
  BEGIN
    PERFORM set_config('nex_workforce.mutation_context', 'fail_hard', true);

    UPDATE nex_workforce.work_item
    SET state            = 'dead_letter',
        agent_id         = NULL,
        lease_deadline   = NULL,
        finished_at      = now(),
        last_error       = p_last_error,
        last_error_class = p_last_error_class,
        updated_at       = now()
    WHERE id         = p_work_item_id
      AND generation = p_generation
      AND state      IN ('leased', 'soft_fail')
      AND (agent_id = p_agent_id OR state = 'soft_fail')  -- soft_fail rows have NULL agent_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RETURN false;
    END IF;

    INSERT INTO nex_workforce.work_item_dead_letter (
      work_item_id, city_slug, category_slug, source_slug, attempts,
      last_error, last_error_class
    ) VALUES (
      v_row.id, v_row.city_slug, v_row.category_slug, v_row.source_slug, v_row.attempts,
      p_last_error, p_last_error_class
    );

    RETURN true;
  END;
  $$;


--
-- Name: fail_soft(text, uuid, integer, text, text, integer); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.fail_soft(p_agent_id text, p_work_item_id uuid, p_generation integer, p_last_error text, p_last_error_class text, p_backoff_seconds integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  DECLARE
    v_updated integer;
    v_backoff integer;
    v_attempts integer;
  BEGIN
    PERFORM set_config('nex_workforce.mutation_context', 'fail_soft', true);

    SELECT attempts INTO v_attempts
    FROM nex_workforce.work_item
    WHERE id = p_work_item_id;

    -- Exponential backoff: 15s * 2^attempts, capped at 1 hour
    v_backoff := COALESCE(p_backoff_seconds,
      LEAST(3600, (15 * POWER(2, LEAST(COALESCE(v_attempts, 1), 10)))::integer)
    );

    UPDATE nex_workforce.work_item
    SET state            = 'soft_fail',
        agent_id         = NULL,
        lease_deadline   = NULL,
        last_error       = p_last_error,
        last_error_class = p_last_error_class,
        next_eligible_at = now() + make_interval(secs => v_backoff),
        updated_at       = now()
    WHERE id         = p_work_item_id
      AND agent_id   = p_agent_id
      AND generation = p_generation
      AND state      = 'leased';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated = 1;
  END;
  $$;


--
-- Name: heartbeat(text, uuid, integer); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.heartbeat(p_agent_id text, p_work_item_id uuid, p_generation integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  DECLARE
    v_lease_minutes integer;
    v_updated       integer;
  BEGIN
    PERFORM set_config('nex_workforce.mutation_context', 'heartbeat', true);

    SELECT j.lease_minutes INTO v_lease_minutes
    FROM nex_workforce.work_item wi
    JOIN nex_workforce.job_registry j
      ON j.category_slug = wi.category_slug AND j.source_slug = wi.source_slug
    WHERE wi.id = p_work_item_id;

    UPDATE nex_workforce.work_item
    SET lease_deadline = now() + make_interval(mins => COALESCE(v_lease_minutes, 15)),
        updated_at     = now()
    WHERE id         = p_work_item_id
      AND agent_id   = p_agent_id
      AND generation = p_generation
      AND state      = 'leased';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated = 1;
  END;
  $$;


--
-- Name: persist_batch(text, uuid, integer, regprocedure, integer); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.persist_batch(p_agent_id text, p_work_item_id uuid, p_generation integer, p_persister_fn regprocedure, p_batch_size integer DEFAULT 100) RETURNS TABLE(persisted_count integer, rejected_count integer, remaining_count integer, fence_ok boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $_$
DECLARE
  v_wi_row     RECORD;
  v_staging    RECORD;
  v_result     RECORD;
  v_started    timestamptz := clock_timestamp();
  v_persisted  integer := 0;
  v_rejected   integer := 0;
  v_new        integer := 0;
  v_updated    integer := 0;
  v_remaining  integer := 0;
  v_evidence_ids text[] := '{}'::text[];
  v_persister_fn_name text;
  v_persister_owner   text;
  v_retrieved_at timestamptz;
BEGIN
  -- ── Slice 3 · persister-allow-list check ───────────────────────────────────
  -- Reject any persister whose owner role is NOT nex_workforce_persister_*.
  -- This prevents runtime from tricking persist_batch (SECURITY DEFINER as
  -- admin) into invoking arbitrary functions admin has implicit EXECUTE on.
  SELECT r.rolname INTO v_persister_owner
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
   WHERE p.oid = p_persister_fn::oid;

  IF v_persister_owner IS NULL
  OR v_persister_owner !~ '^nex_workforce_persister_' THEN
    RAISE EXCEPTION 'unauthorized_persister: % (owner=%)',
      p_persister_fn::regproc::text, COALESCE(v_persister_owner, 'unknown')
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 1. Fence · row-lock work_item
  SELECT id, agent_id, generation, state
    INTO v_wi_row
    FROM nex_workforce.work_item
   WHERE id = p_work_item_id
   FOR UPDATE;

  IF v_wi_row.id IS NULL
  OR v_wi_row.agent_id  IS DISTINCT FROM p_agent_id
  OR v_wi_row.generation <> p_generation
  OR v_wi_row.state      <> 'leased' THEN
    persisted_count := 0;
    rejected_count  := 0;
    remaining_count := -1;
    fence_ok        := false;
    RETURN NEXT;
    RETURN;
  END IF;

  v_persister_fn_name := p_persister_fn::regproc::text;

  -- 2. Iterate batch
  FOR v_staging IN
    SELECT s.id, s.evidence_id, s.natural_key, s.source_slug, s.payload_json,
           er.retrieved_at
      FROM nex_workforce.candidate_staging s
      JOIN nex_workforce.evidence_record er ON er.evidence_id = s.evidence_id
     WHERE s.work_item_id = p_work_item_id
       AND s.generation   = p_generation
       AND s.persisted    = false
       AND s.rejected     = false
     ORDER BY s.candidate_index
     LIMIT p_batch_size
     FOR UPDATE OF s SKIP LOCKED
  LOOP
    EXECUTE format(
      'SELECT ok, target_pk, new_row, updated_row, rejected, rejection_reason '
      'FROM %s($1, $2, $3, $4, $5, $6, $7, $8)',
      v_persister_fn_name
    )
    INTO v_result
    USING p_agent_id, p_work_item_id, p_generation,
          v_staging.evidence_id, v_staging.retrieved_at,
          v_staging.source_slug, v_staging.natural_key, v_staging.payload_json;

    v_evidence_ids := v_evidence_ids || v_staging.evidence_id;

    IF v_result.ok AND NOT v_result.rejected THEN
      UPDATE nex_workforce.candidate_staging
         SET persisted          = true,
             persisted_at       = clock_timestamp(),
             persisted_to_table = split_part(v_persister_fn_name, '.', 2),
             persisted_to_pk    = v_result.target_pk
       WHERE id = v_staging.id;
      v_persisted := v_persisted + 1;
      IF v_result.new_row     THEN v_new     := v_new + 1;     END IF;
      IF v_result.updated_row THEN v_updated := v_updated + 1; END IF;
    ELSIF v_result.rejected THEN
      UPDATE nex_workforce.candidate_staging
         SET rejected         = true,
             rejected_at      = clock_timestamp(),
             rejection_reason = COALESCE(v_result.rejection_reason, 'persister rejected')
       WHERE id = v_staging.id;
      v_rejected := v_rejected + 1;
    ELSE
      NULL;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_remaining
    FROM nex_workforce.candidate_staging
   WHERE work_item_id = p_work_item_id
     AND generation   = p_generation
     AND persisted    = false
     AND rejected     = false;

  INSERT INTO nex_workforce.persist_audit (
    agent_id, work_item_id, generation,
    persister_fn, batch_size,
    new_rows, updated_rows, rejected_rows,
    evidence_ids, duration_ms, ok
  ) VALUES (
    p_agent_id, p_work_item_id, p_generation,
    v_persister_fn_name, p_batch_size,
    v_new, v_updated, v_rejected,
    v_evidence_ids,
    (EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::integer,
    true
  );

  persisted_count := v_persisted;
  rejected_count  := v_rejected;
  remaining_count := v_remaining;
  fence_ok        := true;
  RETURN NEXT;
END;
$_$;


--
-- Name: persist_to_food_business(text, uuid, integer, text, timestamp with time zone, text, text, jsonb); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.persist_to_food_business(p_agent_id text, p_work_item_id uuid, p_generation integer, p_evidence_id text, p_retrieved_at timestamp with time zone, p_source_slug text, p_natural_key text, p_payload_json jsonb) RETURNS TABLE(ok boolean, target_pk text, new_row boolean, updated_row boolean, rejected boolean, rejection_reason text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $_$
DECLARE
  v_wi_row       RECORD;
  v_name         text;
  v_amenity      text;
  v_category     text;
  v_lat          numeric;
  v_lon          numeric;
  v_phone        text;
  v_website      text;
  v_addr_street  text;
  v_addr_city    text;
  v_addr_full    text;
  v_public_ref   text;
  v_dedupe_hash  text;
  v_name_norm    text;
  v_addr_norm    text;
  v_phone_last6  text;
  v_coord_key    text;
  v_match_count  integer;
  v_existing_pk  uuid;
  v_existing_rt  timestamptz;
  v_existing_ev  text;
  v_existing_city text;
  v_row_pk       uuid;
  -- Slice 1h R5 · authoritative city derivation
  v_city         text;
BEGIN
  -- ─── § 7.1 · Defense-in-depth fence check ─────────────────────────────────
  -- R5: also select city_slug so we can derive authoritative city.
  SELECT id, agent_id, generation, state, city_slug
    INTO v_wi_row
    FROM nex_workforce.work_item
   WHERE id = p_work_item_id
   FOR UPDATE;

  IF v_wi_row.id IS NULL
  OR v_wi_row.agent_id  IS DISTINCT FROM p_agent_id
  OR v_wi_row.generation <> p_generation
  OR v_wi_row.state      <> 'leased' THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.1b · Slice 1h R5 · Authoritative city derivation ─────────────────
  -- The persister derives the city display name from the fenced work_item's
  -- city_slug via city_catalogue lookup. The OSM payload's addr:city tag is
  -- used only for the address string (v_addr_city), NEVER for the city column.
  -- If the work_item's city_slug is not registered in city_catalogue, the
  -- persist FAILS CLOSED (no default, no fallback). This prevents any silent
  -- data corruption if an orchestrator ever enqueues a work_item whose city
  -- isn't in the registered production catalogue.
  SELECT name INTO v_city
    FROM nex_workforce.city_catalogue
   WHERE slug = v_wi_row.city_slug;

  IF v_city IS NULL THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('city_not_registered:%s', COALESCE(v_wi_row.city_slug, 'NULL'));
    RETURN NEXT;
    RETURN;
  END IF;

  -- Defense-in-depth: reject empty / whitespace-only / oversized city names.
  -- The food_business.city column has no explicit length CHECK, so bound
  -- defensively at 200 characters (well beyond any real Indonesian city name).
  IF btrim(v_city) = '' OR length(v_city) > 200 THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('invalid_city:slug=%s,name_len=%s', v_wi_row.city_slug, length(COALESCE(v_city, '')));
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.2 · Source-slug + natural-key contract validation ────────────────
  IF p_source_slug NOT IN ('overpass', 'osm_overpass') THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := format('unsupported_source_slug:%s', p_source_slug);
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_natural_key IS NULL OR p_natural_key !~ '^(node|way|relation)/[0-9]+$' THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := 'invalid_source_reference';
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.3 · Extract candidate fields ─────────────────────────────────────
  v_name        := NULLIF(btrim(p_payload_json #>> '{tags,name}'), '');
  v_amenity     := lower(NULLIF(p_payload_json #>> '{tags,amenity}', ''));
  v_lat         := NULLIF(p_payload_json ->> 'lat', '')::numeric;
  v_lon         := NULLIF(p_payload_json ->> 'lon', '')::numeric;
  v_phone       := NULLIF(p_payload_json #>> '{tags,phone}', '');
  v_website     := NULLIF(p_payload_json #>> '{tags,website}', '');
  v_addr_street := NULLIF(p_payload_json #>> '{tags,addr:street}', '');
  -- addr:city is used ONLY for the address string · NEVER for the city column
  v_addr_city   := NULLIF(p_payload_json #>> '{tags,addr:city}', '');

  IF v_name IS NULL THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := 'missing_name';
    RETURN NEXT;
    RETURN;
  END IF;

  v_category := CASE v_amenity
    WHEN 'restaurant' THEN 'restaurant'
    WHEN 'cafe'       THEN 'coffee-cafe'
    WHEN 'ice_cream'  THEN 'ice-cream-dessert'
    WHEN 'fast_food'  THEN 'fast-food'
    ELSE NULL
  END;

  IF v_category IS NULL THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true; rejection_reason := format('unknown_category:amenity=%s', COALESCE(v_amenity, 'NULL'));
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.4 · Derive dedupe_hash (SLICE 4.1 v2 · extensions.digest) ────────
  v_name_norm := regexp_replace(lower(v_name), '\s+', ' ', 'g');
  v_addr_norm := regexp_replace(lower(COALESCE(v_addr_street, '') || '|' || COALESCE(v_addr_city, '')), '\s+', ' ', 'g');
  v_phone_last6 := CASE
    WHEN v_phone IS NULL THEN ''
    ELSE right(regexp_replace(v_phone, '\D', '', 'g'), 6)
  END;
  v_coord_key := CASE
    WHEN v_lat IS NULL OR v_lon IS NULL THEN ''
    ELSE to_char(round(v_lat, 3), 'FM9990.999') || ',' || to_char(round(v_lon, 3), 'FM9990.999')
  END;
  v_dedupe_hash := encode(
    extensions.digest(v_name_norm || '|' || v_addr_norm || '|' || v_phone_last6 || '|' || v_coord_key, 'sha256'),
    'hex'
  );

  -- ─── § 7.5 · Derive address text + public_listing_ref ────────────────────
  v_addr_full := NULLIF(btrim(
    COALESCE(v_addr_street, '')
    || CASE WHEN v_addr_city IS NOT NULL THEN ', ' || v_addr_city ELSE '' END
  ), '');
  v_public_ref := '#FL-' || to_char(p_retrieved_at, 'YYYY') || '-' || nex_workforce._crockford5(p_natural_key);

  -- ─── § 7.6 · Match count · 0 / 1 / >=2 branching (RF-1 resolution) ───────
  SELECT count(*)::integer INTO v_match_count
    FROM nex.food_business
   WHERE source = 'osm_overpass' AND source_reference = p_natural_key;

  -- ─── § 7.6a · CASE C · ≥2 matches → REJECT identity_ambiguous ────────────
  IF v_match_count >= 2 THEN
    ok := false; target_pk := NULL; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('identity_ambiguous:%s_matches', v_match_count);
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.6b · CASE A · 0 matches → INSERT ─────────────────────────────────
  -- R5: city column now takes v_city (authoritative from work_item · not hardcoded)
  IF v_match_count = 0 THEN
    INSERT INTO nex.food_business (
      public_listing_ref,
      business_name,
      category,
      address,
      city,
      country,
      coordinates_lat,
      coordinates_lng,
      phone,
      website,
      source,
      source_reference,
      source_ingested_at,
      source_checked_at,
      source_licence_terms,
      source_evidence_id,
      source_retrieved_at,
      dedupe_hash,
      hero_image_url,
      hero_image_source,
      hero_image_approved,
      created_by
    ) VALUES (
      v_public_ref,
      v_name,
      v_category,
      v_addr_full,
      v_city,                                       -- R5 · authoritative from city_catalogue
      'ID',                                         -- Indonesia · unchanged from R4
      v_lat,
      v_lon,
      v_phone,
      v_website,
      'osm_overpass',
      p_natural_key,
      now(),
      p_retrieved_at,
      'openstreetmap:odbl-1.0',
      p_evidence_id,
      p_retrieved_at,
      v_dedupe_hash,
      NULL,
      NULL,
      false,
      'nex_workforce_v2:persist_to_food_business'
    )
    RETURNING internal_id INTO v_row_pk;

    ok := true; target_pk := v_row_pk::text; new_row := true; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- ─── § 7.6c · CASE B · 1 match → monotonic UPDATE ────────────────────────
  -- R5: also read existing.city to enforce identity-preserving city check.
  -- If existing.city differs from authoritative v_city, REJECT (do NOT
  -- rewrite city as a monotonic field · Section 8: preserve identity model).
  SELECT internal_id, source_retrieved_at, source_evidence_id, city
    INTO v_existing_pk, v_existing_rt, v_existing_ev, v_existing_city
    FROM nex.food_business
   WHERE source = 'osm_overpass' AND source_reference = p_natural_key
   FOR UPDATE;

  -- R5 · identity-preserving city check
  IF v_existing_city IS DISTINCT FROM v_city THEN
    ok := false; target_pk := v_existing_pk::text; new_row := false; updated_row := false;
    rejected := true;
    rejection_reason := format('city_conflict:existing=%s,new=%s', COALESCE(v_existing_city, 'NULL'), v_city);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Monotonic guard · newer wins, ties broken by evidence_id lex order (unchanged from R4)
  IF v_existing_rt IS NOT NULL
  AND p_retrieved_at < v_existing_rt THEN
    ok := true; target_pk := v_existing_pk::text; new_row := false; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_existing_rt IS NOT NULL
  AND p_retrieved_at = v_existing_rt
  AND (v_existing_ev IS NULL OR p_evidence_id <= v_existing_ev) THEN
    ok := true; target_pk := v_existing_pk::text; new_row := false; updated_row := false;
    rejected := false; rejection_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- UPDATE proceeds · city intentionally omitted from SET clause (already
  -- validated equal to v_city above · would be idempotent no-op anyway).
  UPDATE nex.food_business
     SET business_name       = v_name,
         category            = v_category,
         address             = v_addr_full,
         coordinates_lat     = v_lat,
         coordinates_lng     = v_lon,
         phone               = v_phone,
         website             = v_website,
         source_checked_at   = p_retrieved_at,
         source_evidence_id  = p_evidence_id,
         source_retrieved_at = p_retrieved_at,
         dedupe_hash         = v_dedupe_hash
   WHERE internal_id = v_existing_pk;

  ok := true; target_pk := v_existing_pk::text; new_row := false; updated_row := true;
  rejected := false; rejection_reason := NULL;
  RETURN NEXT;
  RETURN;
END;
$_$;


--
-- Name: reap_expired_leases(); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.reap_expired_leases() RETURNS TABLE(reclaimed integer, dead_lettered integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  DECLARE
    v_run_id        uuid;
    v_reclaimed     integer := 0;
    v_dead_lettered integer := 0;
  BEGIN
    INSERT INTO nex_workforce.reaper_run DEFAULT VALUES RETURNING id INTO v_run_id;

    -- ─── Pass 1 · reclaim recoverable expired leases (leased → pending) ────
    -- Context 'reaper' allows leased→pending. This is the only transition
    -- allowed under this context.
    PERFORM set_config('nex_workforce.mutation_context', 'reaper', true);

    WITH expired_recoverable AS (
      SELECT id
      FROM nex_workforce.work_item
      WHERE state = 'leased'
        AND lease_deadline < now()
        AND attempts < max_attempts
      FOR UPDATE SKIP LOCKED
    ),
    reclaimed_rows AS (
      UPDATE nex_workforce.work_item wi
      SET state            = 'pending',
          agent_id         = NULL,
          lease_deadline   = NULL,
          last_error       = 'lease_expired',
          last_error_class = 'lease_expired',
          next_eligible_at = now() + make_interval(secs => LEAST(3600, (15 * POWER(2, LEAST(wi.attempts, 10)))::integer)),
          updated_at       = now()
      FROM expired_recoverable e
      WHERE wi.id = e.id
      RETURNING wi.id
    )
    SELECT count(*) INTO v_reclaimed FROM reclaimed_rows;

    -- ─── Pass 2 · dead-letter exhausted expired leases (leased → dead_letter) ──
    -- R3.1 fix: previously the reaper stayed on context='reaper' for this pass,
    -- which the trigger rejected (leased→dead_letter requires 'fail_hard' or
    -- 'reaper_dead_letter'). Switch context here so the trigger accepts the
    -- transition as reaper-initiated (attempts exhausted after lease expiry).
    PERFORM set_config('nex_workforce.mutation_context', 'reaper_dead_letter', true);

    WITH expired_terminal AS (
      SELECT id, city_slug, category_slug, source_slug, attempts
      FROM nex_workforce.work_item
      WHERE state = 'leased'
        AND lease_deadline < now()
        AND attempts >= max_attempts
      FOR UPDATE SKIP LOCKED
    ),
    dead_rows AS (
      UPDATE nex_workforce.work_item wi
      SET state            = 'dead_letter',
          agent_id         = NULL,
          lease_deadline   = NULL,
          finished_at      = now(),
          last_error       = 'lease_expired · attempts exhausted',
          last_error_class = 'lease_expired',
          updated_at       = now()
      FROM expired_terminal e
      WHERE wi.id = e.id
      RETURNING wi.id, wi.city_slug, wi.category_slug, wi.source_slug, wi.attempts
    ),
    dead_letter_inserts AS (
      INSERT INTO nex_workforce.work_item_dead_letter (
        work_item_id, city_slug, category_slug, source_slug, attempts,
        last_error, last_error_class
      )
      SELECT id, city_slug, category_slug, source_slug, attempts,
             'lease_expired · attempts exhausted', 'lease_expired'
      FROM dead_rows
      RETURNING 1
    )
    SELECT count(*) INTO v_dead_lettered FROM dead_letter_inserts;

    UPDATE nex_workforce.reaper_run
    SET finished_at       = now(),
        zombies_reclaimed = v_reclaimed,
        dead_lettered     = v_dead_lettered
    WHERE id = v_run_id;

    reclaimed := v_reclaimed;
    dead_lettered := v_dead_lettered;
    RETURN NEXT;
  END;
  $$;


--
-- Name: requeue_soft_fail_backoff_elapsed(); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.requeue_soft_fail_backoff_elapsed() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  DECLARE v_count integer;
  BEGIN
    PERFORM set_config('nex_workforce.mutation_context', 'orchestrator', true);

    UPDATE nex_workforce.work_item
    SET state      = 'pending',
        updated_at = now()
    WHERE state             = 'soft_fail'
      AND next_eligible_at <= now();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
  END;
  $$;


--
-- Name: stage_candidates(text, uuid, integer, text, jsonb, jsonb); Type: FUNCTION; Schema: nex_workforce; Owner: -
--

CREATE FUNCTION nex_workforce.stage_candidates(p_agent_id text, p_work_item_id uuid, p_generation integer, p_evidence_id text, p_evidence_meta jsonb, p_candidates jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
DECLARE
  v_wi_row  RECORD;
BEGIN
  -- 1. Fence · row-lock work_item (blocks reaper mid-persist race)
  SELECT id, agent_id, generation, state
    INTO v_wi_row
    FROM nex_workforce.work_item
   WHERE id = p_work_item_id
   FOR UPDATE;

  IF v_wi_row.id IS NULL
  OR v_wi_row.agent_id  IS DISTINCT FROM p_agent_id
  OR v_wi_row.generation <> p_generation
  OR v_wi_row.state      <> 'leased' THEN
    RETURN false;
  END IF;

  -- 2. Immutable evidence · idempotent via PK ON CONFLICT DO NOTHING
  INSERT INTO nex_workforce.evidence_record (
    evidence_id, work_item_id, generation,
    source_slug, city_slug, category_slug,
    query_hash, response_sha256, retrieved_at, request_id,
    http_status, byte_length, candidate_count,
    generator_note, osm_base, http_headers_json
  ) VALUES (
    p_evidence_id, p_work_item_id, p_generation,
    p_evidence_meta->>'source_slug',
    p_evidence_meta->>'city_slug',
    p_evidence_meta->>'category_slug',
    p_evidence_meta->>'query_hash',
    p_evidence_meta->>'response_sha256',
    (p_evidence_meta->>'retrieved_at')::timestamptz,
    p_evidence_meta->>'request_id',
    (p_evidence_meta->>'http_status')::integer,
    (p_evidence_meta->>'byte_length')::integer,
    (p_evidence_meta->>'candidate_count')::integer,
    p_evidence_meta->>'generator_note',
    p_evidence_meta->>'osm_base',
    p_evidence_meta->'http_headers_json'
  )
  ON CONFLICT (evidence_id) DO NOTHING;

  -- 3. Staging rows · idempotent via (work_item_id, generation, candidate_index) unique
  INSERT INTO nex_workforce.candidate_staging (
    work_item_id, generation,
    city_slug, category_slug, source_slug,
    evidence_id, candidate_index, natural_key, payload_json, payload_bytes
  )
  SELECT
    p_work_item_id, p_generation,
    p_evidence_meta->>'city_slug',
    p_evidence_meta->>'category_slug',
    p_evidence_meta->>'source_slug',
    p_evidence_id,
    (c->>'candidate_index')::integer,
    c->>'natural_key',
    c->'payload_json',
    (c->>'payload_bytes')::integer
  FROM jsonb_array_elements(p_candidates) c
  ON CONFLICT (work_item_id, generation, candidate_index) DO NOTHING;

  RETURN true;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_heartbeat; Type: TABLE; Schema: nex_workforce; Owner: -
--

CREATE TABLE nex_workforce.agent_heartbeat (
    agent_id text NOT NULL,
    pid integer NOT NULL,
    host text NOT NULL,
    version text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    last_beat_at timestamp with time zone DEFAULT now() NOT NULL,
    current_work_item_id uuid,
    state text DEFAULT 'idle'::text NOT NULL,
    CONSTRAINT agent_heartbeat_state_check CHECK ((state = ANY (ARRAY['idle'::text, 'working'::text, 'exiting'::text])))
);


--
-- Name: candidate_staging; Type: TABLE; Schema: nex_workforce; Owner: -
--

CREATE TABLE nex_workforce.candidate_staging (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_item_id uuid NOT NULL,
    generation integer NOT NULL,
    city_slug text NOT NULL,
    category_slug text NOT NULL,
    source_slug text NOT NULL,
    evidence_id text NOT NULL,
    candidate_index integer NOT NULL,
    natural_key text NOT NULL,
    payload_json jsonb NOT NULL,
    payload_bytes integer NOT NULL,
    persisted boolean DEFAULT false NOT NULL,
    persisted_at timestamp with time zone,
    persisted_to_table text,
    persisted_to_pk text,
    rejected boolean DEFAULT false NOT NULL,
    rejection_reason text,
    rejected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staging_payload_bytes_cap CHECK ((payload_bytes <= 32768)),
    CONSTRAINT staging_payload_bytes_positive CHECK ((payload_bytes > 0)),
    CONSTRAINT staging_rejected_xor_persisted CHECK ((NOT (rejected AND persisted)))
);


--
-- Name: city_catalogue; Type: TABLE; Schema: nex_workforce; Owner: -
--

CREATE TABLE nex_workforce.city_catalogue (
    slug text NOT NULL,
    name text NOT NULL,
    province text,
    country text DEFAULT 'Indonesia'::text NOT NULL,
    bbox_json jsonb,
    enabled boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evidence_record; Type: TABLE; Schema: nex_workforce; Owner: -
--

CREATE TABLE nex_workforce.evidence_record (
    evidence_id text NOT NULL,
    work_item_id uuid NOT NULL,
    generation integer NOT NULL,
    source_slug text NOT NULL,
    city_slug text NOT NULL,
    category_slug text NOT NULL,
    query_hash text NOT NULL,
    response_sha256 text NOT NULL,
    retrieved_at timestamp with time zone NOT NULL,
    request_id text,
    http_status integer NOT NULL,
    byte_length integer NOT NULL,
    candidate_count integer NOT NULL,
    generator_note text,
    osm_base text,
    http_headers_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT byte_length_nonneg CHECK ((byte_length >= 0)),
    CONSTRAINT candidate_count_nonneg CHECK ((candidate_count >= 0)),
    CONSTRAINT evidence_id_consistency CHECK ((evidence_id = encode(extensions.digest((((((((work_item_id)::text || '::'::text) || (generation)::text) || '::'::text) || query_hash) || '::'::text) || response_sha256), 'sha256'::text), 'hex'::text))),
    CONSTRAINT evidence_id_hex_shape CHECK ((evidence_id ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: job_registry; Type: TABLE; Schema: nex_workforce; Owner: -
--

CREATE TABLE nex_workforce.job_registry (
    slug text NOT NULL,
    category_slug text NOT NULL,
    source_slug text NOT NULL,
    cadence_minutes integer DEFAULT 60 NOT NULL,
    max_concurrent_per_source integer DEFAULT 3 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    lease_minutes integer DEFAULT 15 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: persist_audit; Type: TABLE; Schema: nex_workforce; Owner: -
--

CREATE TABLE nex_workforce.persist_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id text NOT NULL,
    work_item_id uuid NOT NULL,
    generation integer NOT NULL,
    persister_fn text NOT NULL,
    batch_size integer NOT NULL,
    new_rows integer DEFAULT 0 NOT NULL,
    updated_rows integer DEFAULT 0 NOT NULL,
    rejected_rows integer DEFAULT 0 NOT NULL,
    evidence_ids text[] DEFAULT '{}'::text[] NOT NULL,
    duration_ms integer NOT NULL,
    ok boolean NOT NULL,
    err text
);


--
-- Name: reaper_run; Type: TABLE; Schema: nex_workforce; Owner: -
--

CREATE TABLE nex_workforce.reaper_run (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    zombies_reclaimed integer DEFAULT 0 NOT NULL,
    dead_lettered integer DEFAULT 0 NOT NULL,
    errors integer DEFAULT 0 NOT NULL,
    notes text
);


--
-- Name: work_item; Type: TABLE; Schema: nex_workforce; Owner: -
--

CREATE TABLE nex_workforce.work_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    city_slug text NOT NULL,
    category_slug text NOT NULL,
    source_slug text NOT NULL,
    generation integer DEFAULT 1 NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    agent_id text,
    lease_deadline timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    next_eligible_at timestamp with time zone DEFAULT now() NOT NULL,
    cursor_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_error text,
    last_error_class text,
    records_new integer,
    records_rejected integer,
    enqueued_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bbox_json jsonb,
    CONSTRAINT work_item_finished_when_terminal CHECK (((state = ANY (ARRAY['completed'::text, 'dead_letter'::text])) = (finished_at IS NOT NULL))),
    CONSTRAINT work_item_lease_deadline_when_leased CHECK (((state = 'leased'::text) = ((lease_deadline IS NOT NULL) AND (agent_id IS NOT NULL)))),
    CONSTRAINT work_item_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'leased'::text, 'completed'::text, 'soft_fail'::text, 'dead_letter'::text])))
);


--
-- Name: rotation_eligible; Type: VIEW; Schema: nex_workforce; Owner: -
--

CREATE VIEW nex_workforce.rotation_eligible AS
 SELECT c.slug AS city_slug,
    j.category_slug,
    j.source_slug,
    j.slug AS job_slug,
    (j.priority + c.priority) AS priority,
    j.cadence_minutes,
    j.max_concurrent_per_source,
    j.max_attempts,
    j.lease_minutes,
    c.bbox_json
   FROM (nex_workforce.city_catalogue c
     CROSS JOIN nex_workforce.job_registry j)
  WHERE (c.enabled AND j.enabled AND (NOT (EXISTS ( SELECT 1
           FROM nex_workforce.work_item wi
          WHERE ((wi.city_slug = c.slug) AND (wi.category_slug = j.category_slug) AND (wi.source_slug = j.source_slug) AND ((wi.state = ANY (ARRAY['pending'::text, 'leased'::text])) OR ((wi.state = 'completed'::text) AND (wi.finished_at > (now() - make_interval(mins => j.cadence_minutes)))) OR ((wi.state = 'soft_fail'::text) AND (wi.next_eligible_at > now()))))))));


--
-- Name: work_item_dead_letter; Type: TABLE; Schema: nex_workforce; Owner: -
--

CREATE TABLE nex_workforce.work_item_dead_letter (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_item_id uuid NOT NULL,
    city_slug text NOT NULL,
    category_slug text NOT NULL,
    source_slug text NOT NULL,
    attempts integer NOT NULL,
    last_error text NOT NULL,
    last_error_class text NOT NULL,
    moved_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed boolean DEFAULT false NOT NULL,
    review_notes text
);


--
-- Name: agent_heartbeat agent_heartbeat_pkey; Type: CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.agent_heartbeat
    ADD CONSTRAINT agent_heartbeat_pkey PRIMARY KEY (agent_id);


--
-- Name: candidate_staging candidate_staging_pkey; Type: CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.candidate_staging
    ADD CONSTRAINT candidate_staging_pkey PRIMARY KEY (id);


--
-- Name: city_catalogue city_catalogue_pkey; Type: CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.city_catalogue
    ADD CONSTRAINT city_catalogue_pkey PRIMARY KEY (slug);


--
-- Name: evidence_record evidence_record_pkey; Type: CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.evidence_record
    ADD CONSTRAINT evidence_record_pkey PRIMARY KEY (evidence_id);


--
-- Name: job_registry job_registry_category_slug_source_slug_key; Type: CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.job_registry
    ADD CONSTRAINT job_registry_category_slug_source_slug_key UNIQUE (category_slug, source_slug);


--
-- Name: job_registry job_registry_pkey; Type: CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.job_registry
    ADD CONSTRAINT job_registry_pkey PRIMARY KEY (slug);


--
-- Name: persist_audit persist_audit_pkey; Type: CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.persist_audit
    ADD CONSTRAINT persist_audit_pkey PRIMARY KEY (id);


--
-- Name: reaper_run reaper_run_pkey; Type: CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.reaper_run
    ADD CONSTRAINT reaper_run_pkey PRIMARY KEY (id);


--
-- Name: candidate_staging staging_dedupe; Type: CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.candidate_staging
    ADD CONSTRAINT staging_dedupe UNIQUE (work_item_id, generation, candidate_index);


--
-- Name: work_item_dead_letter work_item_dead_letter_pkey; Type: CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.work_item_dead_letter
    ADD CONSTRAINT work_item_dead_letter_pkey PRIMARY KEY (id);


--
-- Name: work_item work_item_pkey; Type: CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.work_item
    ADD CONSTRAINT work_item_pkey PRIMARY KEY (id);


--
-- Name: agent_heartbeat_live; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX agent_heartbeat_live ON nex_workforce.agent_heartbeat USING btree (last_beat_at DESC);


--
-- Name: evidence_record_by_response; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX evidence_record_by_response ON nex_workforce.evidence_record USING btree (response_sha256);


--
-- Name: evidence_record_by_source; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX evidence_record_by_source ON nex_workforce.evidence_record USING btree (source_slug, city_slug, category_slug);


--
-- Name: evidence_record_by_work_item; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX evidence_record_by_work_item ON nex_workforce.evidence_record USING btree (work_item_id, generation);


--
-- Name: persist_audit_by_evidence; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX persist_audit_by_evidence ON nex_workforce.persist_audit USING gin (evidence_ids);


--
-- Name: persist_audit_by_work_item; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX persist_audit_by_work_item ON nex_workforce.persist_audit USING btree (work_item_id, at DESC);


--
-- Name: staging_by_evidence; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX staging_by_evidence ON nex_workforce.candidate_staging USING btree (evidence_id);


--
-- Name: staging_by_natural_key; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX staging_by_natural_key ON nex_workforce.candidate_staging USING btree (source_slug, natural_key);


--
-- Name: staging_pending; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX staging_pending ON nex_workforce.candidate_staging USING btree (work_item_id, generation) WHERE ((persisted = false) AND (rejected = false));


--
-- Name: work_item_by_agent; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX work_item_by_agent ON nex_workforce.work_item USING btree (agent_id) WHERE (agent_id IS NOT NULL);


--
-- Name: work_item_by_source; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX work_item_by_source ON nex_workforce.work_item USING btree (source_slug, state) WHERE (state = 'leased'::text);


--
-- Name: work_item_claim; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX work_item_claim ON nex_workforce.work_item USING btree (state, next_eligible_at, priority DESC, updated_at) WHERE (state = 'pending'::text);


--
-- Name: work_item_dead_letter_unreviewed; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX work_item_dead_letter_unreviewed ON nex_workforce.work_item_dead_letter USING btree (moved_at DESC) WHERE (NOT reviewed);


--
-- Name: work_item_dedupe_active; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE UNIQUE INDEX work_item_dedupe_active ON nex_workforce.work_item USING btree (city_slug, category_slug, source_slug) WHERE (state = ANY (ARRAY['pending'::text, 'leased'::text, 'soft_fail'::text]));


--
-- Name: work_item_reap; Type: INDEX; Schema: nex_workforce; Owner: -
--

CREATE INDEX work_item_reap ON nex_workforce.work_item USING btree (state, lease_deadline) WHERE (state = 'leased'::text);


--
-- Name: work_item work_item_state_transition; Type: TRIGGER; Schema: nex_workforce; Owner: -
--

CREATE TRIGGER work_item_state_transition BEFORE INSERT OR UPDATE ON nex_workforce.work_item FOR EACH ROW EXECUTE FUNCTION nex_workforce.enforce_state_transitions();


--
-- Name: agent_heartbeat agent_heartbeat_current_work_item_id_fkey; Type: FK CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.agent_heartbeat
    ADD CONSTRAINT agent_heartbeat_current_work_item_id_fkey FOREIGN KEY (current_work_item_id) REFERENCES nex_workforce.work_item(id);


--
-- Name: candidate_staging candidate_staging_evidence_id_fkey; Type: FK CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.candidate_staging
    ADD CONSTRAINT candidate_staging_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES nex_workforce.evidence_record(evidence_id);


--
-- Name: work_item_dead_letter work_item_dead_letter_work_item_id_fkey; Type: FK CONSTRAINT; Schema: nex_workforce; Owner: -
--

ALTER TABLE ONLY nex_workforce.work_item_dead_letter
    ADD CONSTRAINT work_item_dead_letter_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES nex_workforce.work_item(id);


--
-- Name: agent_heartbeat; Type: ROW SECURITY; Schema: nex_workforce; Owner: -
--

ALTER TABLE nex_workforce.agent_heartbeat ENABLE ROW LEVEL SECURITY;

--
-- Name: city_catalogue; Type: ROW SECURITY; Schema: nex_workforce; Owner: -
--

ALTER TABLE nex_workforce.city_catalogue ENABLE ROW LEVEL SECURITY;

--
-- Name: job_registry; Type: ROW SECURITY; Schema: nex_workforce; Owner: -
--

ALTER TABLE nex_workforce.job_registry ENABLE ROW LEVEL SECURITY;

--
-- Name: reaper_run; Type: ROW SECURITY; Schema: nex_workforce; Owner: -
--

ALTER TABLE nex_workforce.reaper_run ENABLE ROW LEVEL SECURITY;

--
-- Name: city_catalogue wa_city_catalogue_select; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wa_city_catalogue_select ON nex_workforce.city_catalogue FOR SELECT TO nex_workforce_admin USING (true);


--
-- Name: job_registry wa_job_registry_select; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wa_job_registry_select ON nex_workforce.job_registry FOR SELECT TO nex_workforce_admin USING (true);


--
-- Name: reaper_run wa_reaper_run_insert; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wa_reaper_run_insert ON nex_workforce.reaper_run FOR INSERT TO nex_workforce_admin WITH CHECK (true);


--
-- Name: reaper_run wa_reaper_run_select; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wa_reaper_run_select ON nex_workforce.reaper_run FOR SELECT TO nex_workforce_admin USING (true);


--
-- Name: reaper_run wa_reaper_run_update; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wa_reaper_run_update ON nex_workforce.reaper_run FOR UPDATE TO nex_workforce_admin USING (true) WITH CHECK (true);


--
-- Name: work_item_dead_letter wa_wi_dl_insert; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wa_wi_dl_insert ON nex_workforce.work_item_dead_letter FOR INSERT TO nex_workforce_admin WITH CHECK (true);


--
-- Name: work_item wa_work_item_insert; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wa_work_item_insert ON nex_workforce.work_item FOR INSERT TO nex_workforce_admin WITH CHECK (true);


--
-- Name: work_item wa_work_item_select; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wa_work_item_select ON nex_workforce.work_item FOR SELECT TO nex_workforce_admin USING (true);


--
-- Name: work_item wa_work_item_update; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wa_work_item_update ON nex_workforce.work_item FOR UPDATE TO nex_workforce_admin USING (true) WITH CHECK (true);


--
-- Name: work_item; Type: ROW SECURITY; Schema: nex_workforce; Owner: -
--

ALTER TABLE nex_workforce.work_item ENABLE ROW LEVEL SECURITY;

--
-- Name: work_item_dead_letter; Type: ROW SECURITY; Schema: nex_workforce; Owner: -
--

ALTER TABLE nex_workforce.work_item_dead_letter ENABLE ROW LEVEL SECURITY;

--
-- Name: city_catalogue wp_food_business_city_catalogue_select; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wp_food_business_city_catalogue_select ON nex_workforce.city_catalogue FOR SELECT TO nex_workforce_persister_food_business USING (true);


--
-- Name: work_item wp_food_business_work_item_select; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wp_food_business_work_item_select ON nex_workforce.work_item FOR SELECT TO nex_workforce_persister_food_business USING (true);


--
-- Name: work_item wp_food_business_work_item_update; Type: POLICY; Schema: nex_workforce; Owner: -
--

CREATE POLICY wp_food_business_work_item_update ON nex_workforce.work_item FOR UPDATE TO nex_workforce_persister_food_business USING (true) WITH CHECK (true);


--
-- PostgreSQL database dump complete
--

\unrestrict XHUZscM3sRDCW1uWafP5AnIiUCARBtVflAMMkQKrzBtkcIESi7dAbBvUJpI1eoS

