-- NEX Workforce v2 · Slice 1g · Persistence Boundary Migration
-- Author: Claude · Date: 2026-09-04
-- Governing doctrine: doctrine_nex_slice1g_persistence_boundary_locked_2026_09_04.md
--
-- STAGED FOR REVIEW · NOT APPLIED YET (filename lacks date prefix)
-- Rename to `20260904HHMMSS_nex_workforce_slice1g_persistence.sql` only after Philip approves.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- What this migration does
--   1. Enables pgcrypto (for digest() used in evidence_id consistency CHECK)
--   2. nex_workforce.evidence_record — IMMUTABLE evidence ledger (insert-only)
--   3. nex_workforce.candidate_staging — durable per-lease payload storage
--   4. nex_workforce.persist_audit — audit trail per persist_batch
--   5. nex_workforce.stage_candidates(...) — atomic fence + evidence INSERT + staging INSERT
--   6. nex_workforce.persist_batch(...) — generic wrapper using regprocedure persister_fn
--   7. Slice 3 role grants (COMMENTED · Slice 3 gate)
--
-- What this migration does NOT do
--   - No mock target table (tests create their own fixtures)
--   - No first real persist_to_<TARGET> function (Slice 1h)
--   - No RLS policies on nex.* (Slice 1h, per target)
--   - No CREATE ROLE (Slice 3)
--   - No changes to R4 tables or helpers
--
-- Locked invariants (see doctrine):
--   - Provenance never depends on mutable state (evidence_record is authoritative)
--   - Runtime has ZERO direct table grants (Slice 3 enforces via grants)
--   - Fence NEVER includes lease_deadline > now() (state-authoritative)
--   - Atomic fence + write + audit in one TX
--   - Monotonic UPSERT with retrieved_at + evidence_id tiebreak (enforced per persister)

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 0 · Enable pgcrypto for SHA-256 in the evidence_id consistency CHECK
-- ═════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 1 · evidence_record · IMMUTABLE ledger
--
-- Every source response captured by a capability creates ONE row here (via
-- stage_candidates, idempotent on ON CONFLICT). The row is immutable for the
-- life of any nex.* row that references its evidence_id. No UPDATE/DELETE
-- grants issued outside nex_workforce_admin (Slice 3).
--
-- Provenance query pattern:
--   SELECT er.* FROM nex.<target> t
--   JOIN nex_workforce.evidence_record er ON er.evidence_id = t.source_evidence_id
--   WHERE t.<pk> = <id>;
--
-- Never depends on work_item.cursor_json, which mutates on re-lease.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE nex_workforce.evidence_record (
  evidence_id       text PRIMARY KEY,             -- canonical sha256 (§4b)
  work_item_id      uuid NOT NULL,                -- captured at fetch time (may not match current wi state)
  generation        integer NOT NULL,             -- captured at fetch time
  source_slug       text NOT NULL,
  city_slug         text NOT NULL,
  category_slug     text NOT NULL,

  -- Source response metadata (immutable · fields that hash into evidence_id)
  query_hash        text NOT NULL,
  response_sha256   text NOT NULL,
  retrieved_at      timestamptz NOT NULL,
  request_id        text,
  http_status       integer NOT NULL,
  byte_length       integer NOT NULL,
  candidate_count   integer NOT NULL,

  -- Optional provenance detail (also immutable once written)
  generator_note    text,
  osm_base          text,
  http_headers_json jsonb,

  created_at        timestamptz NOT NULL DEFAULT now(),

  -- Consistency invariant · evidence_id MUST hash correctly from constituent fields.
  -- Rejects any INSERT where caller supplies a mismatched evidence_id.
  -- Slice 4.1 (2026-09-04): fully-qualified as extensions.digest per Supabase
  -- pgcrypto placement. Historical note: unqualified digest() was OID-bound at
  -- DDL time so this constraint continued to resolve after ALTER EXTENSION
  -- SET SCHEMA, but the explicit form removes the resolution dependency and
  -- matches the Slice 4.1 doctrine.
  CONSTRAINT evidence_id_consistency CHECK (
    evidence_id = encode(
      extensions.digest(
        work_item_id::text || '::' ||
        generation::text   || '::' ||
        query_hash         || '::' ||
        response_sha256,
        'sha256'
      ),
      'hex'
    )
  ),

  -- Data sanity
  CONSTRAINT evidence_id_hex_shape CHECK (evidence_id ~ '^[a-f0-9]{64}$'),
  CONSTRAINT byte_length_nonneg    CHECK (byte_length >= 0),
  CONSTRAINT candidate_count_nonneg CHECK (candidate_count >= 0)
);

CREATE INDEX evidence_record_by_work_item ON nex_workforce.evidence_record (work_item_id, generation);
CREATE INDEX evidence_record_by_response  ON nex_workforce.evidence_record (response_sha256);
CREATE INDEX evidence_record_by_source    ON nex_workforce.evidence_record (source_slug, city_slug, category_slug);

COMMENT ON TABLE nex_workforce.evidence_record IS
  'IMMUTABLE evidence ledger. Every source response captured by a capability is '
  'recorded here (INSERT-only, idempotent on PK). Provenance for nex.* rows is '
  'traced via source_evidence_id → evidence_record.evidence_id · NEVER through '
  'the mutable work_item.cursor_json. Retention: never deleted while any nex.* '
  'row references its evidence_id (Slice 1g R3 doctrine).';

-- ═════════════════════════════════════════════════════════════════════════════
-- § 2 · candidate_staging · durable per-lease payload storage
--
-- Populated by stage_candidates in the same TX as evidence_record.
-- Read by persist_batch, which marks persisted=true / rejected=true.
-- 14-day retention (via separate cleanup job · NOT the reaper's job).
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE nex_workforce.candidate_staging (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id        uuid NOT NULL,
  generation          integer NOT NULL,

  -- Denormalized for query convenience + isolation-check tests
  city_slug           text NOT NULL,
  category_slug       text NOT NULL,
  source_slug         text NOT NULL,

  -- Link to immutable evidence (FK ensures evidence_record row exists first)
  evidence_id         text NOT NULL REFERENCES nex_workforce.evidence_record(evidence_id),

  -- Candidate identity + payload
  candidate_index     integer NOT NULL,          -- 0..N-1 stable ordering from source response
  natural_key         text NOT NULL,             -- capability-defined (e.g. "osm:node:12345")
  payload_json        jsonb NOT NULL,            -- normalized (not raw response body)
  payload_bytes       integer NOT NULL,

  -- Persistence status
  persisted           boolean NOT NULL DEFAULT false,
  persisted_at        timestamptz,
  persisted_to_table  text,
  persisted_to_pk     text,
  rejected            boolean NOT NULL DEFAULT false,
  rejection_reason    text,
  rejected_at         timestamptz,

  -- Timeline
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT staging_dedupe UNIQUE (work_item_id, generation, candidate_index),
  CONSTRAINT staging_rejected_xor_persisted CHECK (NOT (rejected AND persisted)),
  CONSTRAINT staging_payload_bytes_positive CHECK (payload_bytes > 0),
  CONSTRAINT staging_payload_bytes_cap      CHECK (payload_bytes <= 32768)  -- 32 KB per candidate cap
);

CREATE INDEX staging_pending
  ON nex_workforce.candidate_staging (work_item_id, generation)
  WHERE persisted = false AND rejected = false;
CREATE INDEX staging_by_evidence  ON nex_workforce.candidate_staging (evidence_id);
CREATE INDEX staging_by_natural_key ON nex_workforce.candidate_staging (source_slug, natural_key);

COMMENT ON TABLE nex_workforce.candidate_staging IS
  'Durable per-lease payload storage. Populated by stage_candidates in the same '
  'TX as the evidence_record. Consumed by persist_batch, which marks '
  'persisted=true (or rejected=true) row-by-row. 14-day retention via a '
  'separate cleanup job (NOT the reaper). Payload size cap: 32 KB per '
  'candidate.';

-- ═════════════════════════════════════════════════════════════════════════════
-- § 3 · persist_audit · audit trail per persist_batch call
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE nex_workforce.persist_audit (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at                    timestamptz NOT NULL DEFAULT now(),
  agent_id              text NOT NULL,
  work_item_id          uuid NOT NULL,
  generation            integer NOT NULL,
  persister_fn          text NOT NULL,             -- regprocedure name that ran
  batch_size            integer NOT NULL,
  new_rows              integer NOT NULL DEFAULT 0,
  updated_rows          integer NOT NULL DEFAULT 0,
  rejected_rows         integer NOT NULL DEFAULT 0,
  evidence_ids          text[] NOT NULL DEFAULT '{}'::text[],  -- one per candidate processed
  duration_ms           integer NOT NULL,
  ok                    boolean NOT NULL,
  err                   text
);

CREATE INDEX persist_audit_by_work_item ON nex_workforce.persist_audit (work_item_id, at DESC);
CREATE INDEX persist_audit_by_evidence  ON nex_workforce.persist_audit USING gin (evidence_ids);

COMMENT ON TABLE nex_workforce.persist_audit IS
  'One row per persist_batch invocation. Provides "which nex.* rows came from '
  'which evidence" via evidence_ids array + persister_fn name.';

-- ═════════════════════════════════════════════════════════════════════════════
-- § 4 · stage_candidates helper
--
-- ATOMIC in one transaction:
--   1. SELECT FOR UPDATE work_item · acquires row-lock, blocks reaper concurrently
--   2. Verify fence (agent_id + generation + state='leased')
--   3. INSERT INTO evidence_record ON CONFLICT DO NOTHING (idempotent · same
--      evidence_id from retry produces no-op)
--   4. INSERT INTO candidate_staging (multi-row) ON CONFLICT (work_item_id,
--      generation, candidate_index) DO NOTHING (idempotent)
--
-- Returns TRUE on successful stage, FALSE on fence failure (caller aborts).
--
-- p_evidence_meta is a jsonb blob with fields matching evidence_record columns:
--   { source_slug, city_slug, category_slug, query_hash, response_sha256,
--     retrieved_at, request_id, http_status, byte_length, candidate_count,
--     generator_note, osm_base, http_headers_json }
--
-- p_candidates is a jsonb array where each element has:
--   { candidate_index, natural_key, payload_json, payload_bytes }
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION nex_workforce.stage_candidates(
  p_agent_id       text,
  p_work_item_id   uuid,
  p_generation     integer,
  p_evidence_id    text,
  p_evidence_meta  jsonb,
  p_candidates     jsonb
) RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nex_workforce.stage_candidates(text, uuid, integer, text, jsonb, jsonb) IS
  'Atomic evidence + staging INSERT in one transaction. Fenced by four-field '
  'work_item check. Idempotent: same evidence_id + same candidates from a '
  'retry produce no-op via ON CONFLICT DO NOTHING on both tables. Returns '
  'false if fence fails · caller aborts as lease_lost.';

-- ═════════════════════════════════════════════════════════════════════════════
-- § 5 · persist_batch · generic wrapper (regprocedure persister_fn)
--
-- ATOMIC in one transaction:
--   1. SELECT FOR UPDATE work_item · locks row, blocks reaper race
--   2. Verify fence
--   3. Select next batch of unpersisted staging rows (LIMIT batch_size)
--   4. For each: EXECUTE persister_fn(...) returning (ok, target_pk, new_row, ...)
--   5. Mark successfully-persisted rows persisted=true (same TX)
--   6. Mark rejected rows rejected=true (same TX)
--   7. INSERT persist_audit row (same TX)
--   8. COMMIT
--
-- Returns (persisted_count, rejected_count, remaining_count).
--
-- SECURITY: p_persister_fn is REGPROCEDURE type · PostgreSQL validates it's a
-- real function OID at parse time · no arbitrary SQL injection possible. The
-- persister function itself is hard-coded to ONE target table (see Slice 1h).
--
-- persister_fn contract (all persisters must have this signature):
--   FUNCTION nex_workforce.<persister_fn_name>(
--     p_agent_id      text,
--     p_work_item_id  uuid,
--     p_generation    integer,
--     p_evidence_id   text,
--     p_retrieved_at  timestamptz,
--     p_source_slug   text,
--     p_natural_key   text,
--     p_payload_json  jsonb
--   ) RETURNS TABLE (
--     ok                boolean,
--     target_pk         text,
--     new_row           boolean,
--     updated_row       boolean,
--     rejected          boolean,
--     rejection_reason  text
--   );
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
  v_retrieved_at timestamptz;
BEGIN
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

  -- Cast to regproc (name-only) NOT regprocedure (name+argtypes) so that
  -- format('%s(...)', v_persister_fn_name) below produces valid SQL. Casting
  -- to text via regprocedure would include the arg-type list, resulting in
  -- schema.func(TYPES)(ARGS) → syntax error.
  v_persister_fn_name := p_persister_fn::regproc::text;

  -- 2. Iterate batch of unpersisted rows · FOR UPDATE SKIP LOCKED (defense
  --    against concurrent persist_batch, shouldn't happen but safe)
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
    -- 3. Call the persister function · regprocedure guarantees valid function OID
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
      -- 4. Mark persisted (same TX as target write)
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
      -- 5. Mark rejected (same TX)
      UPDATE nex_workforce.candidate_staging
         SET rejected         = true,
             rejected_at      = clock_timestamp(),
             rejection_reason = COALESCE(v_result.rejection_reason, 'persister rejected')
       WHERE id = v_staging.id;
      v_rejected := v_rejected + 1;
    ELSE
      -- ok=false and rejected=false · persister returned a non-terminal
      -- error · leave staging row unchanged so next batch retries.
      NULL;
    END IF;
  END LOOP;

  -- 6. Count remaining unpersisted rows (informational)
  SELECT COUNT(*) INTO v_remaining
    FROM nex_workforce.candidate_staging
   WHERE work_item_id = p_work_item_id
     AND generation   = p_generation
     AND persisted    = false
     AND rejected     = false;

  -- 7. Audit row (same TX)
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

COMMENT ON FUNCTION nex_workforce.persist_batch(text, uuid, integer, regprocedure, integer) IS
  'Atomic per-batch persister wrapper. FOR UPDATE row-lock on work_item + '
  'fence check + per-candidate call to the passed persister function + mark '
  'persisted/rejected + audit · all in ONE transaction. Persister function is '
  'REGPROCEDURE type (validated at parse time · no SQL injection). Each '
  'target has its own hard-coded persister function (Slice 1h). Returns '
  '(persisted_count, rejected_count, remaining_count, fence_ok).';

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 6 · Slice 3 role separation (COMMENTED · Slice 3 gate)
--
-- CREATE ROLE nex_workforce_persister_<TARGET> NOLOGIN;
-- GRANT INSERT, UPDATE ON nex.<TARGET> TO nex_workforce_persister_<TARGET>;
-- ALTER FUNCTION nex_workforce.persist_to_<TARGET>(...) OWNER TO nex_workforce_persister_<TARGET>;
-- GRANT EXECUTE ON FUNCTION nex_workforce.persist_batch(text, uuid, integer, regprocedure, integer) TO nex_workforce_runtime;
-- GRANT EXECUTE ON FUNCTION nex_workforce.stage_candidates(text, uuid, integer, text, jsonb, jsonb) TO nex_workforce_runtime;
-- REVOKE ALL ON nex_workforce.evidence_record FROM nex_workforce_runtime;
-- REVOKE ALL ON nex_workforce.candidate_staging FROM nex_workforce_runtime;
-- -- IMPORTANT: runtime is NOT a member of any persister_<TARGET> role.
-- --            Only EXECUTE on functions. No direct table access.
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- § 7 · DOWN migration (COMMENTED · uncomment to reverse)
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS nex_workforce.persist_batch(text, uuid, integer, regprocedure, integer);
-- DROP FUNCTION IF EXISTS nex_workforce.stage_candidates(text, uuid, integer, text, jsonb, jsonb);
-- DROP TABLE IF EXISTS nex_workforce.persist_audit;
-- DROP TABLE IF EXISTS nex_workforce.candidate_staging;
-- DROP TABLE IF EXISTS nex_workforce.evidence_record;
-- COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════
