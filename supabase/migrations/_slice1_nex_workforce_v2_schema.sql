-- NEX Workforce v2 · Slice 1 · Schema migration · REVISION 4
-- Author: Claude · Date: 2026-09-04
-- Governing doctrine: doctrine_nex_workforce_fault_isolation_v1_2026_09_03.md
--
-- STAGED FOR REVIEW · NOT APPLIED YET
-- Filename prefix `_slice1_` (not a date) prevents Supabase auto-apply.
-- Rename to `20260904HHMMSS_nex_workforce_v2_schema.sql` only after Philip approves.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- REVISION 4 CHANGES (Philip 2026-09-04 · R3 validation exposed dedupe collision)
-- ─────────────────────────────────────────────────────────────────────────────
--   R4.1 · UNIQUE INDEX SCOPE FIX
--         R3 defined:
--           UNIQUE INDEX work_item_dedupe
--             ON work_item (city_slug, category_slug, source_slug, generation)
--         Problem: claim() bumps generation. When the orchestrator INSERTs a
--         NEW active row for a tuple that has a HISTORICAL completed/dead_letter
--         row, generation values collide and the INSERT fails.
--         The actual invariant we want is:
--             AT MOST ONE ACTIVE work_item per (city, category, source)
--         Historical rows are audit trail and must not block new cycles.
--         R4 replaces the R3 index with:
--           UNIQUE INDEX work_item_dedupe_active
--             ON work_item (city_slug, category_slug, source_slug)
--             WHERE state IN ('pending','leased','soft_fail');
--         This correctly enforces the intended invariant without constraining
--         terminal (completed/dead_letter) rows.
--         Generation is no longer part of any uniqueness constraint — it is
--         used ONLY for ghost-agent fencing inside helper functions (unchanged).
--
--   Nothing else in this migration changes from R3.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- REVISION 3 CHANGES (Philip 2026-09-03 audit of REVISION 2)
-- ─────────────────────────────────────────────────────────────────────────────
--   R3.1 · REAPER TERMINAL PATH FIX (🔴 was a bug in R2)
--         The reaper's dead-letter UPDATE was rejected by the state-transition
--         trigger because context='reaper' but leased→dead_letter required
--         context='fail_hard'. Added a distinct 'reaper_dead_letter' context.
--         The trigger now accepts leased→dead_letter for context IN
--         ('fail_hard', 'reaper_dead_letter'). The reaper sets 'reaper' for
--         Pass 1 (leased→pending) and 'reaper_dead_letter' for Pass 2
--         (leased→dead_letter). Two named contexts = two named intents.
--
--   R3.2 · HARD PER-SOURCE CAP (🔴 was overshoot-able in R2)
--         claim() now uses pg_try_advisory_xact_lock keyed by source_slug
--         to SERIALIZE the count-then-claim decision per source. Rewritten
--         as a pl/pgsql FOR loop over candidates: acquire per-source lock →
--         re-count under lock → claim if under cap → else CONTINUE. The
--         advisory lock is transaction-scoped so it releases at COMMIT/ROLLBACK.
--         True cap: at most max_concurrent_per_source leased rows per source
--         at any time. Different sources do not block each other.
--
--   R3.3 · HONEST DIRECT-UPDATE DOCUMENTATION (🟠 was misleading in R2)
--         The trigger enforces state-transition validity + terminal
--         immutability but permits same-state UPDATEs, so an admin role with
--         table-level UPDATE privilege can still directly mutate agent_id /
--         generation / cursor_json / lease_deadline / attempts /
--         next_eligible_at while state is unchanged. Comments corrected to
--         say this explicitly. Structural mutation isolation is Slice 3
--         (role separation). Slice 1 relies on audited helper-only use.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- REVISION 2 CHANGES (Philip 2026-09-03 review of REVISION 1)
-- ─────────────────────────────────────────────────────────────────────────────
--   R2.1 · DB-enforced state-machine trigger. Every state transition is
--         validated in the trigger; terminal states (completed, dead_letter)
--         are truly terminal at DB level; reaper-only transitions
--         (leased→pending) rejected unless mutation_context='reaper'.
--   R2.2 · Server-side helper functions replace client-side UPDATE discipline:
--         claim() heartbeat() checkpoint() complete() fail_soft() fail_hard()
--         reap_expired_leases() requeue_soft_fail_backoff_elapsed().
--         Each enforces four-field fence (agent_id + work_item_id +
--         generation + state='leased') server-side. Client code can only
--         SELECT these functions · never write UPDATE directly.
--   R2.3 · Canonical claim() function encapsulates FOR UPDATE SKIP LOCKED +
--         per-source concurrency cap · one authoritative claim path.
--   R2.4 · Generation fencing is enforced by every helper function (not just
--         claim). A ghost agent that lost its lease cannot mutate anything ·
--         function returns false, client aborts.
--   R2.5 · mutation_context session variable pattern: functions set the
--         context via set_config(...) before UPDATE; trigger reads via
--         current_setting(...) and enforces which context can perform which
--         transition. See §4 note on forgery limit for Slice 1 vs Slice 3.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- What this migration does
-- ─────────────────────────────────────────────────────────────────────────────
--   1. Creates a NEW schema `nex_workforce` alongside existing `nex` schema
--   2. Adds work-item queue with lease semantics (state + lease_deadline + agent_id)
--   3. Adds dead-letter table
--   4. Adds city_catalogue + job_registry
--   5. Adds agent_heartbeat + reaper_run audit tables
--   6. Adds rotation_eligible view
--   7. Adds state-machine trigger (DB-enforced transitions)
--   8. Adds 8 server-side helper functions (all mutations go through these)
--
-- What this migration does NOT do
-- ─────────────────────────────────────────────────────────────────────────────
--   - Touch `nex.work_item`, `nex.worker_cycle_run`, or any existing table
--   - Reconcile the 32 existing zombie rows in `nex.worker_cycle_run`
--   - Grant runtime roles / REVOKE UPDATE (deferred to Slice 3 · see §4 note)
--   - Seed any real production data (seed file is separate, also staged)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- §4 · Forgery / bypass limit note (honest disclosure)
-- ─────────────────────────────────────────────────────────────────────────────
-- Two limits worth knowing about, both mitigated by role separation in Slice 3:
--
-- LIMIT A · mutation_context is a session variable · a disciplined client
--   cannot accidentally forge it but a misbehaving admin-privileged client
--   could explicitly SET nex_workforce.mutation_context = 'reaper' and
--   perform a leased→pending UPDATE. Defense-in-depth, not a security boundary.
--
-- LIMIT B · the state-transition trigger only enforces state changes and
--   terminal immutability. It PERMITS same-state UPDATEs so heartbeat and
--   checkpoint can extend lease_deadline / update cursor_json without
--   changing state. Consequence: an admin-privileged client could bypass
--   the helper functions and directly mutate agent_id / generation /
--   cursor_json / lease_deadline / attempts / next_eligible_at / records_new /
--   last_error while state is unchanged. This can violate the four-field
--   fence invariants the helpers depend on.
--
-- For HARD anti-bypass we need role separation:
--   - `nex_workforce_admin` (schema owner) — has UPDATE on tables
--   - `nex_workforce_runtime` — has EXECUTE on functions only · REVOKE UPDATE
--     on tables. Agents connect as `nex_workforce_runtime` · CANNOT bypass
--     the helpers even by direct SQL.
--
-- Slice 1 runs with admin creds. ALL client code MUST be audited to go
-- through the helper functions only. The trigger blocks accidental
-- state-machine discipline breaks. Slice 3 makes bypass structurally
-- impossible via role separation (§5, commented until Slice 3 activation).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Slice 1 test contract (from doctrine, must pass before production cutover)
-- ─────────────────────────────────────────────────────────────────────────────
--   Fault scenarios · one candidate failure · one HTTP timeout · one DB timeout
--   · one rate-limit response · one agent process death · one lost lease · one
--   stale lease · one simultaneous independent worker.
--   Plus (Philip 2026-09-03 R2 requirements):
--   · terminal-state immutability (completed/dead_letter cannot mutate)
--   · ghost-agent generation fencing (function returns false on stale gen)
--   · concurrent claim measurement (actual per-source concurrency ceiling)

BEGIN;

CREATE SCHEMA IF NOT EXISTS nex_workforce;
COMMENT ON SCHEMA nex_workforce IS
  'NEX Workforce v2 · agent-grade fault-isolated execution model. Governed by '
  'doctrine_nex_workforce_fault_isolation_v1_2026_09_03.md. Independent of the '
  'legacy nex.* workforce tables (nex.work_item, nex.worker_cycle_run).';

-- ═════════════════════════════════════════════════════════════════════════════
-- § 1 · TABLES
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- CITY CATALOGUE · which cities the workforce may sweep
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE nex_workforce.city_catalogue (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  province    text,
  country     text NOT NULL DEFAULT 'Indonesia',
  bbox_json   jsonb,                              -- {sw:{lat,lon}, ne:{lat,lon}}
  enabled     boolean NOT NULL DEFAULT true,
  priority    integer NOT NULL DEFAULT 100,      -- higher = sweep sooner
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE nex_workforce.city_catalogue IS
  'Cities the workforce may sweep. No hardcoded DEFAULT_CITY in scripts. '
  'To add a city, INSERT one row here; rotation_eligible view picks it up.';

-- ─────────────────────────────────────────────────────────────────────────────
-- JOB REGISTRY · (category, source) work types
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE nex_workforce.job_registry (
  slug                        text PRIMARY KEY,   -- e.g. "restaurants-overpass"
  category_slug               text NOT NULL,      -- e.g. "restaurants"
  source_slug                 text NOT NULL,      -- e.g. "overpass"
  cadence_minutes             integer NOT NULL DEFAULT 60,  -- re-enqueue after N min
  max_concurrent_per_source   integer NOT NULL DEFAULT 3,   -- politeness cap
  max_attempts                integer NOT NULL DEFAULT 5,
  lease_minutes               integer NOT NULL DEFAULT 15,  -- initial lease budget
  enabled                     boolean NOT NULL DEFAULT true,
  priority                    integer NOT NULL DEFAULT 100,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_slug, source_slug)
);
COMMENT ON TABLE nex_workforce.job_registry IS
  'Available (category, source) job types. Governs cadence, retry budget, and '
  'per-source concurrency cap for politeness against upstream (Overpass, etc.).';

-- ─────────────────────────────────────────────────────────────────────────────
-- WORK_ITEM · the queue
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE nex_workforce.work_item (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug          text NOT NULL,
  category_slug      text NOT NULL,
  source_slug        text NOT NULL,
  generation         integer NOT NULL DEFAULT 1,   -- ↑ on every re-lease
  state              text NOT NULL DEFAULT 'pending'
                     CHECK (state IN ('pending','leased','completed','soft_fail','dead_letter')),
  priority           integer NOT NULL DEFAULT 100,

  -- Lease fields (NULL when state ∉ 'leased')
  agent_id           text,
  lease_deadline     timestamptz,

  -- Retry / backoff
  attempts           integer NOT NULL DEFAULT 0,
  max_attempts       integer NOT NULL DEFAULT 5,
  next_eligible_at   timestamptz NOT NULL DEFAULT now(),

  -- Checkpoint (resume-point for agent restart)
  cursor_json        jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Result tracking (populated on complete/soft_fail/dead_letter)
  last_error         text,
  last_error_class   text,        -- transient|partial|permanent|rate_limit|catastrophic|lease_expired|bulk_data_corruption|lease_lost
  records_new        integer,
  records_rejected   integer,

  -- Timeline
  enqueued_at        timestamptz NOT NULL DEFAULT now(),
  started_at         timestamptz,
  finished_at        timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- Structural invariants (in addition to state trigger below)
  CONSTRAINT work_item_lease_deadline_when_leased CHECK (
    (state = 'leased') = (lease_deadline IS NOT NULL AND agent_id IS NOT NULL)
  ),
  CONSTRAINT work_item_finished_when_terminal CHECK (
    (state IN ('completed','dead_letter')) = (finished_at IS NOT NULL)
  )
);

-- R4: partial unique index scoped to ACTIVE states only.
-- Enforces the intended invariant: at most one active work_item per tuple.
-- Historical rows (completed/dead_letter) are audit trail and do NOT
-- participate in uniqueness — the orchestrator can enqueue a new active
-- cycle for a tuple that has one or more historical rows.
CREATE UNIQUE INDEX work_item_dedupe_active
  ON nex_workforce.work_item (city_slug, category_slug, source_slug)
  WHERE state IN ('pending', 'leased', 'soft_fail');
CREATE INDEX work_item_claim
  ON nex_workforce.work_item (state, next_eligible_at, priority DESC, updated_at ASC)
  WHERE state = 'pending';
CREATE INDEX work_item_reap
  ON nex_workforce.work_item (state, lease_deadline)
  WHERE state = 'leased';
CREATE INDEX work_item_by_source
  ON nex_workforce.work_item (source_slug, state)
  WHERE state = 'leased';
CREATE INDEX work_item_by_agent
  ON nex_workforce.work_item (agent_id) WHERE agent_id IS NOT NULL;

COMMENT ON TABLE nex_workforce.work_item IS
  'The queue. Intended mutation path is via the server-side helper functions '
  '(claim / heartbeat / checkpoint / complete / fail_soft / fail_hard / '
  'reap_expired_leases / requeue_soft_fail_backoff_elapsed). The '
  'state-transition trigger enforces state-machine validity and terminal '
  'immutability, but PERMITS same-state UPDATEs — so a role with table-level '
  'UPDATE privilege can still directly mutate agent_id / generation / '
  'cursor_json / lease_deadline / attempts / next_eligible_at / records_new / '
  'last_error while state is unchanged. Slice 1 relies on audited '
  'helper-only use by all client code. Structural mutation isolation (revoke '
  'UPDATE, grant EXECUTE) is deferred to Slice 3 role separation (§5).';

-- ─────────────────────────────────────────────────────────────────────────────
-- WORK_ITEM_DEAD_LETTER · items that gave up
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE nex_workforce.work_item_dead_letter (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id       uuid NOT NULL REFERENCES nex_workforce.work_item(id),
  city_slug          text NOT NULL,
  category_slug      text NOT NULL,
  source_slug        text NOT NULL,
  attempts           integer NOT NULL,
  last_error         text NOT NULL,
  last_error_class   text NOT NULL,
  moved_at           timestamptz NOT NULL DEFAULT now(),
  reviewed           boolean NOT NULL DEFAULT false,
  review_notes       text
);
CREATE INDEX work_item_dead_letter_unreviewed
  ON nex_workforce.work_item_dead_letter (moved_at DESC)
  WHERE NOT reviewed;

-- ─────────────────────────────────────────────────────────────────────────────
-- AGENT_HEARTBEAT · liveness registry (observability only, not correctness)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE nex_workforce.agent_heartbeat (
  agent_id             text PRIMARY KEY,
  pid                  integer NOT NULL,
  host                 text NOT NULL,
  version              text,
  started_at           timestamptz NOT NULL DEFAULT now(),
  last_beat_at         timestamptz NOT NULL DEFAULT now(),
  current_work_item_id uuid REFERENCES nex_workforce.work_item(id),
  state                text NOT NULL DEFAULT 'idle'
                        CHECK (state IN ('idle','working','exiting'))
);
CREATE INDEX agent_heartbeat_live
  ON nex_workforce.agent_heartbeat (last_beat_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- REAPER_RUN · audit trail
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE nex_workforce.reaper_run (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz,
  zombies_reclaimed  integer NOT NULL DEFAULT 0,
  dead_lettered      integer NOT NULL DEFAULT 0,
  errors             integer NOT NULL DEFAULT 0,
  notes              text
);

-- ═════════════════════════════════════════════════════════════════════════════
-- § 2 · ROTATION VIEW
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW nex_workforce.rotation_eligible AS
SELECT
  c.slug          AS city_slug,
  j.category_slug,
  j.source_slug,
  j.slug          AS job_slug,
  (j.priority + c.priority) AS priority,
  j.cadence_minutes,
  j.max_concurrent_per_source,
  j.max_attempts,
  j.lease_minutes
FROM nex_workforce.city_catalogue c
CROSS JOIN nex_workforce.job_registry j
WHERE c.enabled AND j.enabled
  AND NOT EXISTS (
    SELECT 1 FROM nex_workforce.work_item wi
    WHERE wi.city_slug     = c.slug
      AND wi.category_slug = j.category_slug
      AND wi.source_slug   = j.source_slug
      AND (
        wi.state IN ('pending','leased')
        OR (wi.state = 'completed' AND wi.finished_at > now() - make_interval(mins => j.cadence_minutes))
        OR (wi.state = 'soft_fail' AND wi.next_eligible_at > now())
      )
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- § 3 · STATE-MACHINE TRIGGER
--
-- Allowed transitions (context = SET LOCAL nex_workforce.mutation_context)
--   INSERT       → state must be 'pending'
--   pending      → leased          context='claim'
--   leased       → completed       context='complete'
--   leased       → soft_fail       context='fail_soft'
--   leased       → dead_letter     context IN ('fail_hard', 'reaper_dead_letter')
--                                    · fail_hard          = agent gave up
--                                    · reaper_dead_letter = reaper: attempts exhausted
--   leased       → pending         context='reaper'    ← REAPER-ONLY (recoverable)
--   soft_fail    → pending         context='orchestrator' (backoff-elapsed requeue)
--   soft_fail    → dead_letter     context='fail_hard'
--   completed    → ∅               TERMINAL (no update allowed)
--   dead_letter  → ∅               TERMINAL (no update allowed)
--
-- No-state-change UPDATEs (heartbeat, checkpoint) skip the transition check;
-- they still need the trigger for the terminal-state guard.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION nex_workforce.enforce_state_transitions()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_item_state_transition
  BEFORE INSERT OR UPDATE ON nex_workforce.work_item
  FOR EACH ROW
  EXECUTE FUNCTION nex_workforce.enforce_state_transitions();

COMMENT ON FUNCTION nex_workforce.enforce_state_transitions() IS
  'BEFORE INSERT OR UPDATE trigger. Enforces state-machine validity. Terminal '
  'states (completed, dead_letter) rejected any mutation. State transitions '
  'require the caller to have set nex_workforce.mutation_context via '
  'set_config(). Reaper-only and orchestrator-only paths are explicitly named.';

-- ═════════════════════════════════════════════════════════════════════════════
-- § 4 · SERVER-SIDE HELPER FUNCTIONS
--
-- Intended path for all state mutations. Each enforces:
--   1. Correct mutation_context (via set_config, checked by trigger)
--   2. Four-field fence: agent_id + work_item_id + generation + state='leased'
--   3. Return boolean (or JSON row) indicating whether the mutation applied.
-- Client code that gets `false` MUST treat it as "lease lost" and abort.
--
-- IMPORTANT (R3.3 honest disclosure): a role with direct table UPDATE
-- privilege can bypass these helpers for SAME-STATE field mutations (e.g.
-- reassign agent_id, alter generation, change lease_deadline) because the
-- state-transition trigger permits same-state UPDATEs. The trigger only
-- enforces state-transition correctness and terminal immutability.
--
-- Slice 1 relies on all client code being audited to go through the helpers.
-- Slice 3 makes this structural via role separation (§5, commented): the
-- runtime role gets EXECUTE on the functions and no direct UPDATE on tables,
-- so bypass becomes impossible even for a compromised or misbehaving client.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- claim(agent_id) → jsonb  (NULL if nothing to claim)
--
-- Canonical claim path with HARD per-source concurrency cap (R3.2).
--
-- Two layers of concurrency:
--   (a) FOR UPDATE SKIP LOCKED on the candidate row → 100-way parallelism
--       across DIFFERENT rows. No two agents claim the same row.
--   (b) pg_try_advisory_xact_lock keyed by source_slug → SERIALIZES the
--       count-then-claim decision within a source. When agent A holds the
--       source lock, agent B trying the same source sees the lock unavailable
--       and CONTINUES to the next candidate (typically a different source or
--       returns NULL). Different sources acquire different lock keys and do
--       NOT block each other.
--
-- Why the R2 pattern was wrong: R2 used `count(*) < cap` inside the CTE,
-- but simultaneous transactions all read the same committed count before any
-- of their claims commit — so N agents could all see "0 leased" and all
-- claim, exceeding the cap. R3 fixes this by serializing the count-then-claim
-- decision per source.
--
-- Correctness argument for R3:
--   1. Advisory lock is held ONLY by nex_workforce.claim() (no other caller
--      uses this lock key). Different claim() calls for the same source
--      serialize on the lock.
--   2. Under the lock, we count leased rows for the source. Only claim() with
--      context='claim' can INCREASE the leased count (see trigger). Other
--      transitions (reaper→pending, complete, fail_soft, fail_hard, reaper→
--      dead_letter) only DECREASE it. So the count we read is a lower bound
--      on the "effective" count.
--   3. If count < cap under the lock, we claim (count becomes count+1 ≤ cap).
--   4. On COMMIT, the advisory lock releases; the next claim() for the same
--      source can then run and see the updated count.
--   Result: at any moment, leased count for a source ≤ max_concurrent_per_source.
--
-- Performance note: with 100 agents polling and few sources, the FOR loop may
-- iterate over many pending rows before finding one whose source is under cap
-- + free. If this becomes hot-path, add an at-cap short-circuit filter (with
-- caveat that the filter must NOT be used to skip the lock check — the lock
-- + re-count remain the source of truth for the cap decision).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nex_workforce.claim(p_agent_id text)
RETURNS jsonb AS $$
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nex_workforce.claim(text) IS
  'Atomically claim one eligible work_item with a HARD per-source concurrency '
  'cap. Uses FOR UPDATE SKIP LOCKED on the candidate row and '
  'pg_try_advisory_xact_lock keyed by source_slug to serialize the '
  'count-then-claim decision per source. Returns the full row as jsonb, or '
  'NULL if nothing eligible. Different sources do not block each other.';

-- ─────────────────────────────────────────────────────────────────────────────
-- heartbeat(agent_id, work_item_id, generation) → boolean
-- Extends lease_deadline. Same-state UPDATE, no trigger issue.
-- Returns false if lease lost (four-field fence rejected).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nex_workforce.heartbeat(
  p_agent_id     text,
  p_work_item_id uuid,
  p_generation   integer
) RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- checkpoint(agent_id, work_item_id, generation, cursor_json) → boolean
-- Persists progress + extends lease. Same-state UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nex_workforce.checkpoint(
  p_agent_id     text,
  p_work_item_id uuid,
  p_generation   integer,
  p_cursor_json  jsonb
) RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- complete(agent_id, work_item_id, generation, records_new, records_rejected) → boolean
-- Terminal transition leased → completed. Fence + trigger both enforce.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nex_workforce.complete(
  p_agent_id         text,
  p_work_item_id     uuid,
  p_generation       integer,
  p_records_new      integer,
  p_records_rejected integer
) RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- fail_soft(agent_id, work_item_id, generation, last_error, last_error_class, backoff_seconds) → boolean
-- leased → soft_fail. Sets next_eligible_at with exponential backoff.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nex_workforce.fail_soft(
  p_agent_id         text,
  p_work_item_id     uuid,
  p_generation       integer,
  p_last_error       text,
  p_last_error_class text,
  p_backoff_seconds  integer DEFAULT NULL
) RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- fail_hard(agent_id, work_item_id, generation, last_error, last_error_class) → boolean
-- Terminal transition (leased OR soft_fail) → dead_letter. Also INSERTs into
-- work_item_dead_letter for human review.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nex_workforce.fail_hard(
  p_agent_id         text,
  p_work_item_id     uuid,
  p_generation       integer,
  p_last_error       text,
  p_last_error_class text
) RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- reap_expired_leases() → (reclaimed int, dead_lettered int)
-- REAPER-ONLY path (leased → pending or leased → dead_letter).
-- Splits expired leases: below max_attempts → pending; at/over → dead_letter.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nex_workforce.reap_expired_leases()
RETURNS TABLE (reclaimed integer, dead_lettered integer) AS $$
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nex_workforce.reap_expired_leases() IS
  'Reaper: the ONLY caller allowed to transition leased→pending (Pass 1, '
  'context=reaper) and one of two callers allowed to transition '
  'leased→dead_letter (Pass 2, context=reaper_dead_letter; the other is '
  'agent-initiated fail_hard with context=fail_hard). Runs on cron (every 30s '
  'in production). Uses FOR UPDATE SKIP LOCKED so two reapers cannot collide. '
  'Splits expired leases into recoverable (state→pending) and terminal '
  '(state→dead_letter + INSERT into dead_letter table).';

-- ─────────────────────────────────────────────────────────────────────────────
-- requeue_soft_fail_backoff_elapsed() → int
-- ORCHESTRATOR-ONLY: soft_fail rows whose backoff has elapsed → pending.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nex_workforce.requeue_soft_fail_backoff_elapsed()
RETURNS integer AS $$
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nex_workforce.requeue_soft_fail_backoff_elapsed() IS
  'Orchestrator: the ONLY caller allowed to transition soft_fail→pending. '
  'Called on the enqueue tick to graduate soft-failed items back into the '
  'claimable queue once their backoff has elapsed.';

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 5 · SLICE 3 · role separation (COMMENTED · uncomment when Slice 3 ready)
--
-- CREATE ROLE nex_workforce_runtime NOLOGIN;
-- REVOKE ALL ON ALL TABLES    IN SCHEMA nex_workforce FROM PUBLIC;
-- REVOKE ALL ON ALL SEQUENCES IN SCHEMA nex_workforce FROM PUBLIC;
-- REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nex_workforce FROM PUBLIC;
-- GRANT USAGE ON SCHEMA nex_workforce TO nex_workforce_runtime;
-- GRANT SELECT ON ALL TABLES IN SCHEMA nex_workforce TO nex_workforce_runtime;
-- GRANT EXECUTE ON FUNCTION nex_workforce.claim(text) TO nex_workforce_runtime;
-- GRANT EXECUTE ON FUNCTION nex_workforce.heartbeat(text,uuid,integer) TO nex_workforce_runtime;
-- GRANT EXECUTE ON FUNCTION nex_workforce.checkpoint(text,uuid,integer,jsonb) TO nex_workforce_runtime;
-- GRANT EXECUTE ON FUNCTION nex_workforce.complete(text,uuid,integer,integer,integer) TO nex_workforce_runtime;
-- GRANT EXECUTE ON FUNCTION nex_workforce.fail_soft(text,uuid,integer,text,text,integer) TO nex_workforce_runtime;
-- GRANT EXECUTE ON FUNCTION nex_workforce.fail_hard(text,uuid,integer,text,text) TO nex_workforce_runtime;
-- GRANT EXECUTE ON FUNCTION nex_workforce.reap_expired_leases() TO nex_workforce_runtime;
-- GRANT EXECUTE ON FUNCTION nex_workforce.requeue_soft_fail_backoff_elapsed() TO nex_workforce_runtime;
-- -- Runtime CANNOT do direct UPDATE on tables. Cannot forge mutation_context
-- -- via direct UPDATE. Must go through the functions.
--
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- § 6 · DOWN migration (for rollback during Slice 1 review)
-- Uncomment to reverse:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS nex_workforce.requeue_soft_fail_backoff_elapsed();
-- DROP FUNCTION IF EXISTS nex_workforce.reap_expired_leases();
-- DROP FUNCTION IF EXISTS nex_workforce.fail_hard(text,uuid,integer,text,text);
-- DROP FUNCTION IF EXISTS nex_workforce.fail_soft(text,uuid,integer,text,text,integer);
-- DROP FUNCTION IF EXISTS nex_workforce.complete(text,uuid,integer,integer,integer);
-- DROP FUNCTION IF EXISTS nex_workforce.checkpoint(text,uuid,integer,jsonb);
-- DROP FUNCTION IF EXISTS nex_workforce.heartbeat(text,uuid,integer);
-- DROP FUNCTION IF EXISTS nex_workforce.claim(text);
-- DROP TRIGGER  IF EXISTS work_item_state_transition ON nex_workforce.work_item;
-- DROP FUNCTION IF EXISTS nex_workforce.enforce_state_transitions();
-- DROP VIEW  IF EXISTS nex_workforce.rotation_eligible;
-- DROP TABLE IF EXISTS nex_workforce.reaper_run;
-- DROP TABLE IF EXISTS nex_workforce.agent_heartbeat;
-- DROP TABLE IF EXISTS nex_workforce.work_item_dead_letter;
-- DROP TABLE IF EXISTS nex_workforce.work_item;
-- DROP TABLE IF EXISTS nex_workforce.job_registry;
-- DROP TABLE IF EXISTS nex_workforce.city_catalogue;
-- DROP SCHEMA IF EXISTS nex_workforce;
-- COMMIT;
