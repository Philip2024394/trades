-- NEX Workforce v2 · Slice 3 R2 · Production Role Hardening + SECURITY DEFINER
-- Author: Claude · Date: 2026-09-04
-- Governing authorization:
--   R1 · Philip 2026-09-04 · "BUILD SLICE 3 — PRODUCTION SECURITY & RUNTIME
--        AUTHORIZATION · DESIGN + PORTABLE VALIDATION ONLY"
--   R2 · Philip 2026-09-04 · "NEXT GATE: SLICE 3 DESIGN REVIEW + PREPARATION ONLY"
--
-- REVISION 2.1 (2026-09-04) · Adds portable-probe hardening on § 6a so the
-- full-migration rehearsal succeeds under production-shape non-superuser
-- probe. Concretely: the post-ALTER-OWNER GRANT EXECUTE on
-- mock_persist_target is now issued via SET LOCAL ROLE persister_mock (same
-- pattern already used in § 2 and § 5). ZERO effect on Project B (§ 6a IF
-- block is dead code there · mock_target never exists). This eliminates the
-- last skipped rehearsal test and makes R3R-02..R3R-06 executable.
--
-- REVISION 2 (2026-09-04) · Applies the PG 16+ privilege lessons discovered by
-- Slice 1h R2 → R3 → R4 (never validated on Project B until now):
--
--   A. Grant `nex_workforce_admin` to CURRENT_USER `WITH SET TRUE, INHERIT FALSE`
--      immediately after CREATE ROLE. Required by every subsequent
--      `ALTER FUNCTION ... OWNER TO nex_workforce_admin` under PG 16+
--      (creator gets ADMIN OPTION but not SET · Supabase-managed postgres is
--      rolsuper=false and needs explicit SET). INHERIT FALSE prevents silent
--      inheritance of admin's runtime privileges by the migration executor.
--
--   B. Grant CREATE (not just USAGE) on `nex_workforce` to admin. `ALTER
--      FUNCTION ... OWNER TO admin` requires the new owner to have CREATE
--      on the function's schema. REVOKE at end of migration for runtime
--      cleanliness (admin needs USAGE-only after ownership transfers).
--
--   C. Reorder per-function ops: REVOKE ALL FROM PUBLIC and any COMMENT ON
--      FUNCTION must happen WHILE the migration executor still owns the
--      function (before ALTER FUNCTION OWNER transfers ownership). ACL and
--      description persist across ownership change.
--
--   D. Same three fixes applied to the portable-fixture repair block
--      (mock_persist_target) so § 6a works under a non-superuser probe too.
--
-- The R1 header (unchanged intent · applies fine on portable superuser) is
-- preserved below for context.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- STAGED · PORTABLE VALIDATION ONLY · NOT APPLIED TO PROJECT B
-- ═════════════════════════════════════════════════════════════════════════════
-- Filename lacks date prefix so it will NOT auto-apply to Project B.
-- Rename to `20260904HHMMSS_nex_workforce_slice3_role_hardening.sql` ONLY after
-- Philip explicitly authorizes "APPLY SLICE 3 TO PROJECT B".
--
-- ─────────────────────────────────────────────────────────────────────────────
-- What this migration does
--   § 0  · sanity prereqs
--   § 1  · CREATE ROLE nex_workforce_admin (NOLOGIN NOBYPASSRLS)
--          - owns hardened SECURITY DEFINER wrappers
--          - has CRUD on nex_workforce.* tables
--          - has EXECUTE on persist_to_food_business (so persist_batch can invoke it)
--          - NEVER inherited by runtime
--   § 2  · Grant nex_workforce_admin the table privileges its owned functions need
--   § 3  · ALTER 10 existing workforce functions to SECURITY DEFINER
--          OWNER = nex_workforce_admin
--          SET search_path = pg_catalog, pg_temp
--          claim, heartbeat, checkpoint, complete, fail_soft, fail_hard,
--          stage_candidates, persist_batch, reap_expired_leases,
--          requeue_soft_fail_backoff_elapsed
--   § 4  · CREATE FUNCTION nex_workforce.enqueue_from_view() SECURITY DEFINER
--          - AM2 fix · replaces orchestrator's inline INSERT..SELECT..ON CONFLICT
--          - Same semantic · one SQL round-trip · function-boundary write
--   § 5  · CREATE ROLE nex_workforce_app (NOLOGIN NOBYPASSRLS)
--          - "runtime capability" role · SET LOCAL ROLE target for nex_app_runtime
--          - EXECUTE on the full workforce function surface
--          - SELECT (read-only) on workforce tables for observability + orch reads
--          - ZERO direct INSERT/UPDATE/DELETE anywhere
--   § 6  · REVOKE ALL on hardened functions FROM PUBLIC · explicit grants only
--   § 7  · Slice 3 production wiring (COMMENTED · Project B application gate)
--          - GRANT nex_workforce_app TO nex_app_runtime WITH INHERIT TRUE, SET TRUE
--   § 8  · DOWN migration (COMMENTED)
--
-- What this migration does NOT do
--   - Does NOT create nex_workforce_runtime as a LOGIN role for production
--     (the SET LOCAL ROLE pattern reuses nex_app_runtime · no new LOGIN role)
--   - Does NOT modify persist_to_food_business (Slice 1h locked)
--   - Does NOT modify nex.food_business RLS (Slice 1h locked)
--   - Does NOT create any target-side changes beyond persister-role-safe grants
--   - Does NOT disable RLS anywhere
--   - Does NOT modify enforce_state_transitions trigger, _crockford5 helper
--
-- Locked invariants preserved
--   - nex.food_business FORCE ROW LEVEL SECURITY stays ON
--   - persist_to_food_business ownership + SECURITY DEFINER + search_path stay locked
--   - nex_workforce_persister_food_business role attributes NOBYPASSRLS + NOLOGIN
--   - Four-field fence (agent_id + work_item_id + generation + state='leased')
--   - Monotonic UPSERT rule for target
--   - Evidence ledger immutability (INSERT-only)

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 0 · Sanity prereqs
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'nex_workforce') THEN
    RAISE EXCEPTION 'nex_workforce schema missing · apply R4 first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'nex') THEN
    RAISE EXCEPTION 'nex schema missing · apply base schema first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_persister_food_business') THEN
    RAISE EXCEPTION 'nex_workforce_persister_food_business role missing · apply Slice 1h first';
  END IF;
END $body$;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 1 · nex_workforce_admin · owner of SECURITY DEFINER wrappers
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_admin') THEN
    CREATE ROLE nex_workforce_admin NOLOGIN NOBYPASSRLS;
  END IF;
END $body$;
ALTER ROLE nex_workforce_admin NOLOGIN NOBYPASSRLS;

-- R2 fix A · GRANT admin TO CURRENT_USER WITH SET TRUE, INHERIT FALSE
--
-- Required by every subsequent `ALTER FUNCTION ... OWNER TO nex_workforce_admin`
-- statement under PG 16+ · CREATE ROLE grants ADMIN OPTION but NOT SET, and
-- Supabase-managed postgres is rolsuper=false so it cannot bypass the SET
-- requirement. INHERIT FALSE prevents the executor from silently inheriting
-- admin's runtime privileges (executor can `SET LOCAL ROLE admin` when needed
-- for admin/debug · but its own queries never gain admin's grants).
GRANT nex_workforce_admin TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;

-- R2 fix B · GRANT USAGE + CREATE (not just USAGE) on nex_workforce
-- Required so `ALTER FUNCTION ... OWNER TO admin` can succeed · target owner
-- must have CREATE on the function's schema at ownership-transfer time.
-- CREATE is REVOKED at end of migration (see § 6c) for runtime cleanliness.
GRANT USAGE, CREATE ON SCHEMA nex_workforce TO nex_workforce_admin;
GRANT USAGE           ON SCHEMA nex           TO nex_workforce_admin;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 2 · Grant nex_workforce_admin the table privileges its owned SECURITY DEFINER
--       functions require. Evidence_record is INSERT+SELECT ONLY (immutable ledger).
-- ═════════════════════════════════════════════════════════════════════════════
-- Admin needs full CRUD on the tables its SECURITY DEFINER functions mutate.
-- reap_expired_leases INSERTs a reaper_run row, then UPDATEs finished_at on it.
-- The function bodies are HARD-CODED · admin cannot be abused via arbitrary
-- SQL from runtime (runtime never inherits admin).
GRANT SELECT, INSERT, UPDATE, DELETE ON nex_workforce.work_item             TO nex_workforce_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex_workforce.evidence_record       TO nex_workforce_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex_workforce.candidate_staging     TO nex_workforce_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex_workforce.persist_audit         TO nex_workforce_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex_workforce.agent_heartbeat       TO nex_workforce_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex_workforce.reaper_run            TO nex_workforce_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex_workforce.work_item_dead_letter TO nex_workforce_admin;
GRANT SELECT                         ON nex_workforce.city_catalogue        TO nex_workforce_admin;
GRANT SELECT                         ON nex_workforce.job_registry          TO nex_workforce_admin;
GRANT SELECT                         ON nex_workforce.rotation_eligible     TO nex_workforce_admin;

-- Sequences used by SERIAL/gen columns (defensive · admin owns write path)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA nex_workforce TO nex_workforce_admin;

-- R2 fix · GRANT EXECUTE ON persist_to_food_business requires owner privileges.
-- persist_to_food_business is owned by nex_workforce_persister_food_business
-- (Slice 1h locked). The migration executor (postgres in production ·
-- non-superuser under Supabase) doesn't own the function so it cannot directly
-- issue GRANT EXECUTE. However Slice 1h R4 established
-- `GRANT nex_workforce_persister_food_business TO CURRENT_USER WITH SET TRUE`,
-- so the executor can SET LOCAL ROLE persister and issue the GRANT as owner.
DO $body$
BEGIN
  SET LOCAL ROLE nex_workforce_persister_food_business;
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb) TO nex_workforce_admin';
END $body$;
RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 3 · Convert workforce functions to SECURITY DEFINER · owner = admin
--
-- This is the AM1 fix. Before Slice 3, all these functions ran as caller
-- privileges, requiring runtime to have direct table grants. After Slice 3,
-- they run as nex_workforce_admin (via SECURITY DEFINER) and runtime only
-- needs EXECUTE.
--
-- Each ALTER also sets search_path = pg_catalog, pg_temp for SECURITY DEFINER
-- safety (per Postgres SECURITY DEFINER hardening best practice).
-- ═════════════════════════════════════════════════════════════════════════════
-- R2 fix C · per-function ordering (ALL owner-required ops FIRST, then ALTER OWNER LAST) ·
--   1. REVOKE ALL FROM PUBLIC — requires ownership
--   2. ALTER FUNCTION SECURITY DEFINER SET search_path — requires ownership
--   3. ALTER FUNCTION OWNER TO admin — transfers ownership (must be LAST)
--
-- All owner-requiring operations must complete WHILE the migration executor
-- still owns the function. Once ALTER OWNER completes, executor no longer
-- owns (unless it has admin membership WITH INHERIT TRUE · we explicitly use
-- INHERIT FALSE so ownership rights don't leak).
--
-- Postgres ALTER FUNCTION requires OWNER TO in its own statement · other
-- action clauses (SECURITY DEFINER, SET search_path) go in a second statement.

REVOKE ALL ON FUNCTION nex_workforce.claim(text) FROM PUBLIC;
ALTER  FUNCTION nex_workforce.claim(text) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
ALTER  FUNCTION nex_workforce.claim(text) OWNER TO nex_workforce_admin;

REVOKE ALL ON FUNCTION nex_workforce.heartbeat(text, uuid, integer) FROM PUBLIC;
ALTER  FUNCTION nex_workforce.heartbeat(text, uuid, integer) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
ALTER  FUNCTION nex_workforce.heartbeat(text, uuid, integer) OWNER TO nex_workforce_admin;

REVOKE ALL ON FUNCTION nex_workforce.checkpoint(text, uuid, integer, jsonb) FROM PUBLIC;
ALTER  FUNCTION nex_workforce.checkpoint(text, uuid, integer, jsonb) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
ALTER  FUNCTION nex_workforce.checkpoint(text, uuid, integer, jsonb) OWNER TO nex_workforce_admin;

REVOKE ALL ON FUNCTION nex_workforce.complete(text, uuid, integer, integer, integer) FROM PUBLIC;
ALTER  FUNCTION nex_workforce.complete(text, uuid, integer, integer, integer) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
ALTER  FUNCTION nex_workforce.complete(text, uuid, integer, integer, integer) OWNER TO nex_workforce_admin;

REVOKE ALL ON FUNCTION nex_workforce.fail_soft(text, uuid, integer, text, text, integer) FROM PUBLIC;
ALTER  FUNCTION nex_workforce.fail_soft(text, uuid, integer, text, text, integer) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
ALTER  FUNCTION nex_workforce.fail_soft(text, uuid, integer, text, text, integer) OWNER TO nex_workforce_admin;

REVOKE ALL ON FUNCTION nex_workforce.fail_hard(text, uuid, integer, text, text) FROM PUBLIC;
ALTER  FUNCTION nex_workforce.fail_hard(text, uuid, integer, text, text) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
ALTER  FUNCTION nex_workforce.fail_hard(text, uuid, integer, text, text) OWNER TO nex_workforce_admin;

REVOKE ALL ON FUNCTION nex_workforce.stage_candidates(text, uuid, integer, text, jsonb, jsonb) FROM PUBLIC;
ALTER  FUNCTION nex_workforce.stage_candidates(text, uuid, integer, text, jsonb, jsonb) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
ALTER  FUNCTION nex_workforce.stage_candidates(text, uuid, integer, text, jsonb, jsonb) OWNER TO nex_workforce_admin;

-- persist_batch is CREATE OR REPLACE'd in § 3b (whitelist body added) then
-- ownership-hardened there. If we transferred ownership here, § 3b's
-- CREATE OR REPLACE would fail because postgres no longer owns it. § 3b now
-- REVOKE + CREATE OR REPLACE + SECURITY DEFINER + ALTER OWNER in the correct
-- order so persist_batch is fully handled there.

REVOKE ALL ON FUNCTION nex_workforce.reap_expired_leases() FROM PUBLIC;
ALTER  FUNCTION nex_workforce.reap_expired_leases() SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
ALTER  FUNCTION nex_workforce.reap_expired_leases() OWNER TO nex_workforce_admin;

REVOKE ALL ON FUNCTION nex_workforce.requeue_soft_fail_backoff_elapsed() FROM PUBLIC;
ALTER  FUNCTION nex_workforce.requeue_soft_fail_backoff_elapsed() SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
ALTER  FUNCTION nex_workforce.requeue_soft_fail_backoff_elapsed() OWNER TO nex_workforce_admin;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 3b · persist_batch · add persister-allow-list check (Slice 3 refinement)
--
-- Slice 1g's persist_batch accepted ANY regprocedure. Under Slice 3 hardening
-- (persist_batch = SECURITY DEFINER as admin), that meant runtime could invoke
-- any function admin implicitly has EXECUTE on (test fixtures like
-- mock_persist_target, other hypothetical persisters, etc.).
--
-- The Slice 1h persister naming convention locks in one-target-per-role:
-- each target's persister function is owned by nex_workforce_persister_<TARGET>.
-- persist_batch enforces this: it rejects any persister whose owner role name
-- does not match `^nex_workforce_persister_.+`.
--
-- Slice 3 refinement · does NOT weaken Slice 1g · adds structural safeguard.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION nex_workforce.persist_batch(
  p_agent_id       text,
  p_work_item_id   uuid,
  p_generation     integer,
  p_persister_fn   regprocedure,
  p_batch_size     integer DEFAULT 100
) RETURNS TABLE (
  persisted_count  integer,
  rejected_count   integer,
  remaining_count  integer,
  fence_ok         boolean
) AS $$
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
$$ LANGUAGE plpgsql;

-- R2 fix C · all owner-required ops FIRST (REVOKE PUBLIC + SECURITY DEFINER
-- + search_path) · then ALTER OWNER LAST.
REVOKE ALL ON FUNCTION nex_workforce.persist_batch(text, uuid, integer, regprocedure, integer) FROM PUBLIC;
ALTER  FUNCTION nex_workforce.persist_batch(text, uuid, integer, regprocedure, integer) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
ALTER  FUNCTION nex_workforce.persist_batch(text, uuid, integer, regprocedure, integer) OWNER TO nex_workforce_admin;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 4 · enqueue_from_view · SECURITY DEFINER wrapper for orchestrator INSERT
--
-- Slice 1e originally used inline SQL:
--   INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, priority, state)
--   SELECT ... FROM nex_workforce.rotation_eligible
--   ON CONFLICT (city_slug, category_slug, source_slug)
--     WHERE state IN ('pending', 'leased', 'soft_fail')
--   DO NOTHING
--   RETURNING id;
--
-- Under Slice 3 hardening, orchestrator no longer has direct INSERT grant on
-- work_item. This SECURITY DEFINER wrapper preserves the EXACT semantic and
-- the "one SQL round-trip per orchestrator tick" contract of Slice 1e.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION nex_workforce.enqueue_from_view()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $body$
DECLARE
  v_enqueued integer;
BEGIN
  WITH inserted AS (
    INSERT INTO nex_workforce.work_item
      (city_slug, category_slug, source_slug, priority, state)
    SELECT city_slug, category_slug, source_slug, priority, 'pending'
      FROM nex_workforce.rotation_eligible
    ON CONFLICT (city_slug, category_slug, source_slug)
      WHERE state IN ('pending', 'leased', 'soft_fail')
    DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO v_enqueued FROM inserted;
  RETURN v_enqueued;
END;
$body$;

-- R2 fix C · ALL owner-required ops (REVOKE PUBLIC + COMMENT + already-set
-- SECURITY DEFINER + search_path from CREATE) run WHILE executor still owns
-- the newly-created function. ALTER OWNER runs LAST.
REVOKE ALL ON FUNCTION nex_workforce.enqueue_from_view() FROM PUBLIC;

COMMENT ON FUNCTION nex_workforce.enqueue_from_view() IS
  'Slice 3 · SECURITY DEFINER wrapper for Slice 1e orchestrator INSERT. '
  'Runs as nex_workforce_admin so nex_workforce_app can invoke via EXECUTE without '
  'direct INSERT on work_item. Preserves Slice 1e semantic: INSERT from '
  'rotation_eligible view with ON CONFLICT DO NOTHING against partial unique '
  'index. Returns count of newly-enqueued rows.';

-- Ownership transfer LAST
ALTER FUNCTION nex_workforce.enqueue_from_view() OWNER TO nex_workforce_admin;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 5 · nex_workforce_app · runtime capability role · EXECUTE only
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_app') THEN
    CREATE ROLE nex_workforce_app NOLOGIN NOBYPASSRLS;
  END IF;
END $body$;
ALTER ROLE nex_workforce_app NOLOGIN NOBYPASSRLS;

-- Schema usage
GRANT USAGE ON SCHEMA nex_workforce TO nex_workforce_app;
GRANT USAGE ON SCHEMA nex           TO nex_workforce_app;

-- Read-only observability + orchestrator reads
GRANT SELECT ON nex_workforce.work_item              TO nex_workforce_app;
GRANT SELECT ON nex_workforce.evidence_record        TO nex_workforce_app;
GRANT SELECT ON nex_workforce.candidate_staging      TO nex_workforce_app;
GRANT SELECT ON nex_workforce.persist_audit          TO nex_workforce_app;
GRANT SELECT ON nex_workforce.agent_heartbeat        TO nex_workforce_app;
GRANT SELECT ON nex_workforce.reaper_run             TO nex_workforce_app;
GRANT SELECT ON nex_workforce.work_item_dead_letter  TO nex_workforce_app;
GRANT SELECT ON nex_workforce.city_catalogue         TO nex_workforce_app;
GRANT SELECT ON nex_workforce.job_registry           TO nex_workforce_app;
GRANT SELECT ON nex_workforce.rotation_eligible      TO nex_workforce_app;

-- EXECUTE on the workforce function surface (now all SECURITY DEFINER as admin
-- OR SECURITY DEFINER as persister for persist_to_food_business).
--
-- R2 fix · these functions are OWNED by nex_workforce_admin (from § 3). GRANT
-- EXECUTE on them requires ownership or GRANT OPTION. The migration executor
-- (postgres in production · probe in portable rehearsal) is a MEMBER of admin
-- with SET but INHERIT FALSE · so executor doesn't automatically get admin's
-- grant privileges. Use SET LOCAL ROLE admin to issue the GRANTs as admin.
DO $body$
BEGIN
  SET LOCAL ROLE nex_workforce_admin;
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.claim(text)                                             TO nex_workforce_app';
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.heartbeat(text, uuid, integer)                          TO nex_workforce_app';
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.checkpoint(text, uuid, integer, jsonb)                  TO nex_workforce_app';
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.complete(text, uuid, integer, integer, integer)         TO nex_workforce_app';
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.fail_soft(text, uuid, integer, text, text, integer)     TO nex_workforce_app';
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.fail_hard(text, uuid, integer, text, text)              TO nex_workforce_app';
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.stage_candidates(text, uuid, integer, text, jsonb, jsonb) TO nex_workforce_app';
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.persist_batch(text, uuid, integer, regprocedure, integer) TO nex_workforce_app';
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.reap_expired_leases()                                   TO nex_workforce_app';
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.requeue_soft_fail_backoff_elapsed()                     TO nex_workforce_app';
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.enqueue_from_view()                                     TO nex_workforce_app';
END $body$;
RESET ROLE;
-- R2 fix · GRANT EXECUTE on persist_to_food_business requires persister-owner
-- privileges (same pattern as § 2 admin grant). SET LOCAL ROLE persister to
-- issue the GRANT as owner. Postgres has SET on persister from Slice 1h R4.
DO $body$
BEGIN
  SET LOCAL ROLE nex_workforce_persister_food_business;
  EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb) TO nex_workforce_app';
END $body$;
RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 6 · REVOKE ALL from PUBLIC · SUPERSEDED by per-function REVOKE in § 3 / § 3b / § 4
--
-- R2 restructuring: each function's REVOKE PUBLIC now runs immediately before
-- its ALTER OWNER (while the executor still owns the function). See § 3, § 3b,
-- § 4 for the per-function REVOKE + ALTER OWNER + SECURITY DEFINER sequence.
-- This block previously ran all REVOKEs at the end · which fails under a
-- non-superuser executor because ownership had already transferred to admin.
-- Kept only as a documentation marker.
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- § 6a · Portable-fixture repair (Slice 1g mock_target/mock_persist_target)
--
-- The persistence_boundary_contract test creates nex_workforce.mock_target +
-- mock_persist_target as test-only fixtures. Slice 3 hardening breaks them in
-- two ways which we repair here (NO-OP in Project B · mock_target never exists):
--
--   (i)  persist_batch is SECURITY DEFINER as admin. Its dynamic-EXECUTE of
--        mock_persist_target needs admin to have CRUD on mock_target.
--
--   (ii) persist_batch's Slice 3 whitelist rejects any persister whose owner
--        role does not match ^nex_workforce_persister_.  We create a portable-
--        only role nex_workforce_persister_mock_target and reassign the mock
--        function's owner. This preserves the whitelist's strict production
--        semantic while letting the Slice 1g test suite continue passing.
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='nex_workforce' AND tablename='mock_target') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON nex_workforce.mock_target TO nex_workforce_admin';
    RAISE NOTICE 'portable-fixture repair · granted admin CRUD on mock_target';

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_persister_mock_target') THEN
      CREATE ROLE nex_workforce_persister_mock_target NOLOGIN NOBYPASSRLS;
    END IF;
    -- R2 fix A · SET grant on the mock persister role for ALTER FUNCTION OWNER
    EXECUTE 'GRANT nex_workforce_persister_mock_target TO CURRENT_USER WITH SET TRUE, INHERIT FALSE';
    -- R2 fix B · target role needs USAGE + CREATE on schema to own an object there
    EXECUTE 'GRANT USAGE, CREATE ON SCHEMA nex_workforce TO nex_workforce_persister_mock_target';
    -- Ownership assignment + minimal grants so the mock persister function can
    -- INSERT/UPDATE its target when persist_batch calls it under Slice 3.
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON nex_workforce.mock_target TO nex_workforce_persister_mock_target';

    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname='nex_workforce' AND p.proname='mock_persist_target') THEN
      -- R2 fix C · owner-required ops FIRST · ALTER OWNER LAST
      EXECUTE 'REVOKE ALL ON FUNCTION nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb) FROM PUBLIC';
      EXECUTE 'ALTER FUNCTION nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb) SECURITY DEFINER SET search_path = pg_catalog, pg_temp';
      EXECUTE 'ALTER FUNCTION nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb) OWNER TO nex_workforce_persister_mock_target';
      -- R2.1 fix · post-ownership GRANT EXECUTE must be issued AS the new owner.
      -- Under portable production-shape probe (rolsuper=FALSE, INHERIT FALSE on
      -- persister_mock), probe can no longer grant on the function it just
      -- transferred. SET LOCAL ROLE persister_mock so the GRANT runs as owner.
      -- Superuser bypasses this check on Project B · § 6a is dead code there
      -- (mock_target never exists) · this change is portable-hardening only.
      SET LOCAL ROLE nex_workforce_persister_mock_target;
      EXECUTE 'GRANT EXECUTE ON FUNCTION nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb) TO nex_workforce_admin';
      RESET ROLE;
      -- R2 fix runtime cleanliness · REVOKE CREATE from mock persister after transfer
      EXECUTE 'REVOKE CREATE ON SCHEMA nex_workforce FROM nex_workforce_persister_mock_target';
      RAISE NOTICE 'portable-fixture repair · mock_persist_target owner reassigned to satisfy Slice 3 whitelist';
    END IF;
  END IF;
END $body$;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 6b · Structural role separation · runtime NEVER inherits persister
--
-- If nex_workforce_persister_food_business had been granted to nex_workforce_app
-- by mistake, revoke it. Idempotent no-op otherwise.
-- ═════════════════════════════════════════════════════════════════════════════
DO $body$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_auth_members am
    JOIN pg_roles r  ON r.oid  = am.roleid
    JOIN pg_roles m  ON m.oid  = am.member
    WHERE r.rolname = 'nex_workforce_persister_food_business'
      AND m.rolname = 'nex_workforce_app'
  ) THEN
    EXECUTE 'REVOKE nex_workforce_persister_food_business FROM nex_workforce_app';
    RAISE NOTICE 'revoked accidental persister membership from nex_workforce_app';
  END IF;
END $body$;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 6c · R2 fix · REVOKE CREATE on nex_workforce from nex_workforce_admin
--
-- CREATE was granted in § 1 solely so PostgreSQL would allow the many
-- `ALTER FUNCTION ... OWNER TO admin` statements. All ownership transfers
-- are now complete · runtime admin role no longer needs CREATE on the
-- schema. Runtime state: USAGE only.
--
-- R2.1 fix · REVOKE must be issued by schema owner (or a member of the schema
-- owner) · nex_workforce_admin was never grantor nor schema owner, so self-
-- REVOKE as admin is a silent no-op under PG 16+. On Project B postgres owns
-- nex_workforce and issues this REVOKE directly. Under the portable probe,
-- probe INHERITs postgres and passes the "member-of-owner" check. Either way,
-- issue the REVOKE as the migration executor · NOT as admin.
--
-- Defense-in-depth: even if CREATE remained, admin is NOLOGIN + only
-- SECURITY DEFINER hard-coded functions run as admin at runtime · none of
-- those functions execute CREATE. But USAGE-only is strictly cleaner.
-- ═════════════════════════════════════════════════════════════════════════════
REVOKE CREATE ON SCHEMA nex_workforce FROM nex_workforce_admin;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 7 · Slice 3 PRODUCTION wiring (COMMENTED · Project B application gate)
--
-- The ONE production-role change Slice 3 proposes:
--
--   GRANT nex_workforce_app TO nex_app_runtime WITH INHERIT TRUE, SET TRUE;
--
-- This mirrors the existing pattern used for nex_brain_app and nex_social_app
-- (Phase 12 regrant). It allows the production application (connecting as
-- nex_app_runtime) to do:
--
--   BEGIN;
--   SET LOCAL ROLE nex_workforce_app;
--   SELECT nex_workforce.claim(...);        -- SECURITY DEFINER runs as admin
--   SELECT nex_workforce.stage_candidates(...);
--   SELECT nex_workforce.persist_batch(...);
--   ...
--   COMMIT;
--
-- No new LOGIN role required. No new connection string. No .env.local change.
--
-- Applied via Supabase Management API (like phase12-regrant-with-inherit.mjs),
-- NOT via this migration file. This migration file only handles portable-cluster
-- validation and the workforce-schema-scoped grants that CAN be applied to
-- Project B by future authorization.
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- § 8 · DOWN migration (COMMENTED · manual apply if reversal ever needed)
--
-- BEGIN;
-- -- Reverse SECURITY DEFINER + ownership
-- ALTER FUNCTION nex_workforce.claim(text)                                       OWNER TO postgres SECURITY INVOKER RESET search_path;
-- ALTER FUNCTION nex_workforce.heartbeat(text, uuid, integer)                    OWNER TO postgres SECURITY INVOKER RESET search_path;
-- ALTER FUNCTION nex_workforce.checkpoint(text, uuid, integer, jsonb)            OWNER TO postgres SECURITY INVOKER RESET search_path;
-- ALTER FUNCTION nex_workforce.complete(text, uuid, integer, integer, integer)   OWNER TO postgres SECURITY INVOKER RESET search_path;
-- ALTER FUNCTION nex_workforce.fail_soft(text, uuid, integer, text, text, integer) OWNER TO postgres SECURITY INVOKER RESET search_path;
-- ALTER FUNCTION nex_workforce.fail_hard(text, uuid, integer, text, text)        OWNER TO postgres SECURITY INVOKER RESET search_path;
-- ALTER FUNCTION nex_workforce.stage_candidates(text, uuid, integer, text, jsonb, jsonb) OWNER TO postgres SECURITY INVOKER RESET search_path;
-- ALTER FUNCTION nex_workforce.persist_batch(text, uuid, integer, regprocedure, integer) OWNER TO postgres SECURITY INVOKER RESET search_path;
-- ALTER FUNCTION nex_workforce.reap_expired_leases()                             OWNER TO postgres SECURITY INVOKER RESET search_path;
-- ALTER FUNCTION nex_workforce.requeue_soft_fail_backoff_elapsed()               OWNER TO postgres SECURITY INVOKER RESET search_path;
-- -- Drop enqueue wrapper
-- DROP FUNCTION IF EXISTS nex_workforce.enqueue_from_view();
-- -- Revoke + drop nex_workforce_app
-- REVOKE ALL ON SCHEMA  nex_workforce, nex FROM nex_workforce_app;
-- REVOKE ALL ON ALL TABLES    IN SCHEMA nex_workforce FROM nex_workforce_app;
-- REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nex_workforce FROM nex_workforce_app;
-- DROP ROLE IF EXISTS nex_workforce_app;
-- -- Revoke + drop nex_workforce_admin
-- REVOKE ALL ON SCHEMA  nex_workforce, nex FROM nex_workforce_admin;
-- REVOKE ALL ON ALL TABLES    IN SCHEMA nex_workforce FROM nex_workforce_admin;
-- REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nex_workforce FROM nex_workforce_admin;
-- REVOKE ALL ON ALL SEQUENCES IN SCHEMA nex_workforce FROM nex_workforce_admin;
-- DROP ROLE IF EXISTS nex_workforce_admin;
-- COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════
