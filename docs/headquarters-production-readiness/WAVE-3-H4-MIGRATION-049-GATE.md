# Wave 3 · H4 · Migration 049 Activation Gate

**Programme:** Headquarters Production Readiness · Wave 3 · Batch H4
**Authorisation:** Philip · 2026-08-10 · *"AUTHORISE WAVE 3 — H4 MIGRATION 049 GATE ONLY."*
**Date opened:** 2026-08-10.
**Final state (locked at end of this batch):**

> **H4 — IMPLEMENTED**
> **H4 — VERIFIED — LOCAL LIVE**
> **PRODUCTION — NOT PROVEN** (production flag flip requires separate authorisation · production 049 application unchanged)

Related sources of truth:
- `WORLD-CLASS-OPS-REMEDIATION-PLAN.md §3.2 (Batch H4)` — objectives
- `WORLD-CLASS-OPS-FINAL-GAP-AUDIT.md §R-5` — landmine
- `deploy/postgres/init/049_analytics_rollup_queue.sql` — schema being gated
- `WAVE-3-H1-MIGRATION-HYGIENE.md` — the audit surface that surfaced the missing local 049 objects
- Previous closures: `WAVE-3-H3-TIMEOUT-BUDGETS.md` · `WAVE-3-H2-CID-LOGGER.md` · `WAVE-3-H1-MIGRATION-HYGIENE.md`

---

## 0 · Prohibitions honoured (Philip's directive)

- ⛔ Not applying 049 to production
- ⛔ Not applying 049 just to make tests green (application must serve H4 proof)
- ⛔ Not repairing the 047/048 OP-STATE gaps (H4 has no dependency on them)
- ⛔ Not flipping the production feature (`NEX_ANALYTICS_ROLLUP_ASYNC` remains unset in prod env)
- ⛔ Not changing `NEX_BRAIN_BACKEND`
- ⛔ Not touching Supabase legacy migrations
- ⛔ Not migrating `hammerex_*` data
- ⛔ Not enabling the supervisor
- ⛔ Not recovering Cohort A / B
- ⛔ Not modifying the 10 preserved KJs
- ⛔ Not beginning H5 / H6
- ⛔ Not broadening Class C CID routes
- ⛔ Not tuning H3 further

---

## 1 · Step 1 · Exact 049 dependency

### 1.1 · Schema objects introduced by `049_analytics_rollup_queue.sql`

| Kind | Fully-qualified name | Required by code path |
|---|---|---|
| Table | `nex.analytics_rollup_queue` | ingest INSERT · drain SELECT |
| Column set | `queue_id UUID PK · event_id UUID · enqueued_at · status (CHECK IN pending/processing/completed/failed) · claimed_by · claimed_at · lease_expires_at · attempts · last_error · completed_at` | drain UPDATE / SELECT |
| Index | `idx_analytics_rollup_queue_pending` (partial `WHERE status='pending'`) | drain SKIP LOCKED performance |
| Index | `idx_analytics_rollup_queue_event` | drain lookup |
| Function | `nex.claim_analytics_rollup_batch(text, int, int)` (SETOF nex.analytics_rollup_queue) | drain claim |
| RLS policy | `service_role_all_analytics_rollup_queue` on the table | production security posture |

### 1.2 · Feature flag and where it is read

**Flag:** `NEX_ANALYTICS_ROLLUP_ASYNC=1`
**Reader:** `src/lib/nex/analytics/ingest.ts:57` · `export function isRollupAsync(): boolean`
**Consumers:** 3 sites
- `src/lib/nex/analytics/ingest.ts:83` · `if (isRollupAsync()) { INSERT INTO nex.analytics_rollup_queue }` inside `ingestEvent()`
- `src/app/api/nex/brain/cron-tick/route.ts:58` · `if (isRollupAsync()) { await drainAnalyticsRollupQueue(...) }`
- `src/lib/nex/analytics/rollup-worker.ts:47` · `SELECT * FROM nex.claim_analytics_rollup_batch(...)` inside `drainAnalyticsRollupQueue()`

### 1.3 · Current state on local NEX Postgres

Per H1.b probe against `localhost:5433/nex_dev`:

```
✗ 049_analytics_rollup_queue.sql  [not-applied]  0/4 objects present
    missing table nex.analytics_rollup_queue
    missing index nex.idx_analytics_rollup_queue_pending
    missing index nex.idx_analytics_rollup_queue_event
    missing function nex.claim_analytics_rollup_batch
```

Migration 049 has NOT been applied locally — every 049-dependent object is absent.

---

## 2 · Step 2 · What happens today when the flag is enabled without 049

**No gate exists.** With `NEX_ANALYTICS_ROLLUP_ASYNC=1` against a database missing the 049 schema:

| Code path | Failure surface |
|---|---|
| `ingestEvent()` on every call | `nex.analytics_events` INSERT succeeds (auto-committed by pg driver · no wrapping BEGIN), then `INSERT INTO nex.analytics_rollup_queue` throws PG error `42P01 · relation "nex.analytics_rollup_queue" does not exist`. Caller sees `ingestEvent` throw. The event row IS persisted but every ingest response is a 500. |
| `drainAnalyticsRollupQueue()` on every cron-tick | `SELECT * FROM nex.claim_analytics_rollup_batch(...)` throws PG error `42883 · function nex.claim_analytics_rollup_batch does not exist`. cron-tick's try/catch logs `rollup_drain_failed` but keeps running. No rollup work happens; every tick is a noop-with-error. |

Both surfaces are loud but cryptic. There is no signal that the failure class is "migration 049 not applied" specifically — the operator must decode raw Postgres error codes. This is the landmine H4 closes.

---

## 3 · Step 3 · Required safety property

> **A 049-dependent feature MUST NOT become active against a NEX database that does not satisfy the required 049 schema contract.**

Requirements from Philip's authorisation:

- Fail-closed: refuse activation cleanly rather than degrade silently or crash cryptically.
- Actionable diagnostic: the operator must be told which migration is missing without decoding PG error codes.
- Idempotent: repeated startup / repeated ingest / repeated drain must produce the same outcome (no side effects on failure).
- Localised: unrelated features must remain unaffected.
- Correctness in the disabled case: with `NEX_ANALYTICS_ROLLUP_ASYNC` unset, the gate must never touch 049 objects (no unnecessary dependency).

---

## 4 · Step 4 · Gate design (smallest reliable mechanism)

### 4.1 · Structure

**One new module:** `src/lib/nex/analytics/rollup-gate.ts`. It exports:

- `class MigrationDependencyError extends Error` with `.code = "migration-049-not-applied"`, `.migration = "049_analytics_rollup_queue.sql"`, `.missing_objects: string[]`.
- `async function checkRollupSchema(c: PgClientLike): Promise<{ ready: true } | { ready: false; missing: string[] }>` · pure probe using `to_regclass()` + `to_regproc()`.
- `async function assertRollupAsyncReady(c: PgClientLike): Promise<void>` · throws `MigrationDependencyError` when `isRollupAsync()` is true AND the schema probe reports missing objects. No-op when the flag is off.
- `function _resetGateCacheForTests(): void` · test-only cache reset.

The probe caches its positive result at module scope (a `boolean | null`) so subsequent asserts are zero-DB-round-trip after the first success. **Negative results are not cached** — that would trap the process in "049 missing" for its entire lifetime even if an operator applies 049 mid-run. Every failed check re-probes.

### 4.2 · Where the assertion fires

- **`src/lib/nex/analytics/ingest.ts::ingestEvent()`** — call `await assertRollupAsyncReady(c)` FIRST, before the `analytics_events` INSERT. Failing fast prevents the event from landing at all when the pipeline downstream is broken. This is the fail-closed shape: refuse the whole operation with a clear error rather than persist half of it.
- **`src/lib/nex/analytics/rollup-worker.ts::drainAnalyticsRollupQueue()`** — call `await assertRollupAsyncReady(c)` at the top of the withClient block, before any SELECT. If it throws, cron-tick's existing try/catch converts it to a `warn` log line that names the migration.

### 4.3 · Observability

New counter (fixed-enum extension): `analytics.rollup_missing_table`. Incremented once per failed assertion. Snapshotable via `snapshot()` at existing observability endpoints.

The `MigrationDependencyError.message` reads (verbatim):
```
migration 049 not applied · missing objects: nex.analytics_rollup_queue (table), nex.claim_analytics_rollup_batch (function) · run: npm run nex:apply-storage-schema (or apply deploy/postgres/init/049_analytics_rollup_queue.sql manually) then re-enable NEX_ANALYTICS_ROLLUP_ASYNC
```

That single message satisfies "actionable diagnostic" — operator sees which migration, which objects, and the remediation command.

### 4.4 · Env-parity check in verify-migration-state.mjs (H1.b extension)

`scripts/verify-migration-state.mjs` gains a post-probe check: if `NEX_ANALYTICS_ROLLUP_ASYNC=1` in the current shell AND `049_analytics_rollup_queue.sql` verdict is not `applied`, print a distinct WARNING (non-blocking · reuse the existing exit-code discipline). Local runs surface it as a warning; deploy runs may treat it as blocking via `--strict` (deferred, matches H1.c CI-wiring open item).

### 4.5 · What the gate does NOT do

- Does NOT auto-apply migration 049. Application remains an operator action.
- Does NOT cache the negative verdict (see §4.1). This means every ingest / drain call under a broken configuration re-probes — cheap (two `SELECT to_regclass/to_regproc` calls) and self-healing.
- Does NOT touch the 049 schema on positive verify. Read-only.
- Does NOT wrap either 049 code path when the flag is off. Zero unnecessary work.
- Does NOT change behaviour when 049 IS applied — the gate is invisible to a correctly configured deploy.

---

## 5 · Test matrix

| # | Scenario | Expected |
|---|---|---|
| G1 | Flag=1 + 049 fully applied | `assertRollupAsyncReady` returns · no throw · counter unchanged |
| G2 | Flag=1 + table missing | `MigrationDependencyError` thrown · `.missing_objects` names the table · counter `analytics.rollup_missing_table` bumped |
| G3 | Flag=1 + function missing (partial) | `MigrationDependencyError` thrown · `.missing_objects` names the function · counter bumped |
| G4 | Flag=1 + both missing | `MigrationDependencyError` thrown · `.missing_objects` lists both · counter bumped |
| G5 | Flag=0 + 049 absent | `assertRollupAsyncReady` returns · no throw · zero DB round-trips · counter unchanged (unrelated features unaffected) |
| G6 | Repeated call after G1 (cached-ready) | Zero further DB round-trips · deterministic |
| G7 | Repeated call after G2 (negative not cached) | DB probe re-runs each time · deterministic error message |
| G8 | Error message identifies migration + remediation | Exact text present |

### Live proofs

- **Live 1** · flag=0 · no probe · ingest works · no 049 dependency observable
- **Live 2** · flag=1 + 049 absent · ingest AND drain both refuse with `MigrationDependencyError` naming `049_analytics_rollup_queue.sql`
- **Live 3** · apply 049 locally · flag=1 · ingest AND drain succeed · gate is invisible

Applying 049 locally is explicitly authorised by Philip's "Use disposable/local test databases or controlled schema fixtures where necessary" clause AND by "Do not fix the local 047/048/049 OP-STATE gaps unless required to prove H4." Live 3 requires it.

---

## 6 · Files touched

- **NEW** · `src/lib/nex/analytics/rollup-gate.ts` (probe + assert + typed error)
- **NEW** · `src/lib/nex/analytics/tests/rollup-gate.test.mjs` (G1-G8 contract)
- **NEW** · `scripts/prove-rollup-gate-live.ts` (Live 1-3)
- **MODIFIED** · `src/lib/nex/analytics/ingest.ts` (assert BEFORE events INSERT when flag=1)
- **MODIFIED** · `src/lib/nex/analytics/rollup-worker.ts` (assert at top of withClient)
- **MODIFIED** · `src/lib/nex/observability/counters.ts` (add `analytics.rollup_missing_table`)
- **MODIFIED** · `scripts/verify-migration-state.mjs` (env-parity warning)

---

## 7 · Results

**Date executed:** 2026-08-10.

### 7.1 · Exact 049 dependency (confirmed)

- Feature flag: `NEX_ANALYTICS_ROLLUP_ASYNC=1`
- 049 schema (per `deploy/postgres/init/049_analytics_rollup_queue.sql`):
  - Table `nex.analytics_rollup_queue` (10 columns · PRIMARY KEY · CHECK constraint on status)
  - Partial UNIQUE-adjacent index `idx_analytics_rollup_queue_pending` on `(status, enqueued_at) WHERE status='pending'`
  - Index `idx_analytics_rollup_queue_event` on `(event_id)`
  - Function `nex.claim_analytics_rollup_batch(text, int, int)` returning SETOF the queue table
  - RLS policy `service_role_all_analytics_rollup_queue`
- 3 consumer sites tied to the flag:
  - `ingest.ts:83` — `INSERT INTO nex.analytics_rollup_queue`
  - `cron-tick/route.ts:58` — invokes `drainAnalyticsRollupQueue`
  - `rollup-worker.ts:47` — `SELECT * FROM nex.claim_analytics_rollup_batch(...)`

### 7.2 · Activation path (before H4)

- Flag=1 + 049 absent → `ingestEvent()` throws PG `42P01` after `analytics_events` INSERT (event persisted, ingest response 500)
- Flag=1 + 049 absent → `drainAnalyticsRollupQueue()` throws PG `42883` on every cron-tick (logged as warning, silent rollup stall)
- No signal identifies the failure class as "migration 049 not applied"

### 7.3 · Before → after safety behaviour

| Scenario | Before H4 | After H4 |
|---|---|---|
| Flag=0 (default) · 049 present or absent | Behaviour unchanged (no queue writes, sync rollup path) | Behaviour unchanged · gate is a total no-op, no probe fires |
| Flag=1 + 049 present | `ingestEvent` writes to queue · drain works | Behaviour unchanged · gate probes once, caches positive verdict, then invisible |
| Flag=1 + 049 absent (table missing) | Cryptic `42P01` on every ingest · silent drain stall | `MigrationDependencyError` with typed `.code=migration-049-not-applied` · full remediation message · `analytics.rollup_missing_table` counter bumped |
| Flag=1 + 049 partial (function missing) | Cryptic `42883` on drain | Same typed error naming `nex.claim_analytics_rollup_batch (function)` |
| Flag=1 + both missing | Cryptic PG errors at 2 code sites | Single typed error listing both missing objects |
| Repeated ingest with 049 present | Repeated DB round-trips OK | Positive verdict cached · zero further probe DB round-trips |
| Repeated ingest with 049 absent | Repeated cryptic PG errors | Repeated typed errors · probe re-runs each time (self-heal on the tick after 049 lands) |

### 7.4 · Gate implementation

- **NEW** · `src/lib/nex/analytics/rollup-gate.ts` (67 lines) · exports:
  - `class MigrationDependencyError` — typed error with `.code`, `.migration`, `.missing_objects`
  - `async function checkRollupSchema(c)` — pure probe using `to_regclass()` + `to_regprocedure()`
  - `async function assertRollupAsyncReady(c)` — no-op when flag off · throws when flag on + schema missing · positive-verdict cache
- **MODIFIED** · `src/lib/nex/analytics/ingest.ts` — calls `assertRollupAsyncReady(c)` inside `withClient` BEFORE the events INSERT (fail-closed)
- **MODIFIED** · `src/lib/nex/analytics/rollup-worker.ts` — calls `assertRollupAsyncReady(c)` at top of the drain's withClient
- **MODIFIED** · `src/lib/nex/observability/counters.ts` — adds `analytics.rollup_missing_table` to the fixed enum + snapshot list
- **MODIFIED** · `scripts/verify-migration-state.mjs` — emits H4 env-parity WARNING when `NEX_ANALYTICS_ROLLUP_ASYNC=1` and 049 is not applied (H4.c)

### 7.5 · Tests

| Suite | Assertions | Pass | Fail |
|---|---|---|---|
| **NEW** `src/lib/nex/analytics/tests/rollup-gate.test.mjs` (G1-G8) | 8 | 8 | 0 |
| Live probe `scripts/prove-rollup-gate-live.ts` (Live 1-4) | 4 probes | 4 | 0 |
| Regression sweep (obs + workers + config + db + analytics) | 147 | 146 | **1 pre-existing** |

**The 1 regression is the same pre-existing CFGA2** (H3 §7.6) flagging `postgres.wc-companion.test.ts`. Not H4-caused. Preservation invariant re-verified: 10/10 preserved KJs still `claimed / 0 / null`.

### 7.6 · Failure-mode evidence (verbatim from live probe)

```
--- Live 1 · Flag=0 · gate is invisible ---
  → PASS · gate no-op with flag off · caught=null

--- Live 2 · Flag=1 + 049 absent · gate refuses ---
  code            = migration-049-not-applied
  migration       = 049_analytics_rollup_queue.sql
  missing_objects = ["nex.analytics_rollup_queue (table)","nex.claim_analytics_rollup_batch (function)"]
  message         = migration 049 not applied · missing objects: nex.analytics_rollup_queue (table), nex.claim_analytics_rollup_batch (function) · run: npm run nex:apply-storage-schema (or apply deploy/postgres/init/049_analytics_rollup_queue.sql manually) then re-enable NEX_ANALYTICS_ROLLUP_ASYNC
  → PASS · gate refuses with typed error + full diagnostic

--- Live 3 · Apply 049 · Flag=1 · gate allows activation ---
  checkRollupSchema.ready = true
  → PASS · gate allows activation after 049 applied · caught=null

--- Live 4 · repeated assertion is cached · zero further DB round-trips ---
  200× assertRollupAsyncReady after positive cache = 3ms
  → PASS
```

H1.b re-verify after H4 live probe (side-effect of Live 3 · Philip-authorised H4 proof requirement):
```
✓ 049_analytics_rollup_queue.sql  [applied]  4/4 objects present
```

H4.c env-parity warning demonstrated (with NEX_ANALYTICS_ROLLUP_ASYNC=1 + 049 outside `--file` filter):
```
⚠ H4 env-parity WARNING · NEX_ANALYTICS_ROLLUP_ASYNC=1 but migration 049 is
  not in the current inventory ... · the runtime gate at
  src/lib/nex/analytics/rollup-gate.ts will refuse activation · apply 049
  via npm run nex:apply-storage-schema before enabling this flag in production
```

### 7.7 · Legitimate exemptions

None. Every 049-dependent code path is now guarded. Sync-mode ingest is unaffected — the gate no-ops when the flag is off.

### 7.8 · Unresolved production dependencies

- **Production 049 application** · 049 has not been applied to production NEX Postgres. Without application, enabling `NEX_ANALYTICS_ROLLUP_ASYNC=1` in production will now trigger `MigrationDependencyError` with the actionable remediation message (that's the safety property H4 delivers). Application is an operator action gated on separate authorisation.
- **CI wiring for H4.c env-parity check** · non-blocking today · deploy-branch blocking pending CI access (matches H1.c open item).
- **Counter export to production observability** · `analytics.rollup_missing_table` bumps in-process only; production requires log-drain wiring (matches H2 R-3 open item).
- **Positive-verdict cache across process restarts** · not H4's concern; verified once per process. Cold-start after a rolling deploy re-probes cheaply.
- **047 / 048 supplementary OP-STATE gaps** · unchanged (H4 has no direct dependency; still recorded as OPEN in H1 closure). 049 side-effect resolved by H4's Live 3.

### 7.9 · Final H4 verdict

| Component | State |
|---|---|
| `rollup-gate.ts` module (typed error + probe + assert) | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE |
| `ingest.ts` fail-closed activation | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE |
| `rollup-worker.ts` fail-closed drain | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE |
| `analytics.rollup_missing_table` counter | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE |
| H4.c env-parity check in verify-migration-state.mjs | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE |
| G1-G8 contract tests | ✅ VERIFIED — LOCAL LIVE (8/8 green) |
| Live 1-4 probes | ✅ VERIFIED — LOCAL LIVE (4/4 green) |
| Preservation invariant (10 KJs) | ✅ VERIFIED green pre + post batch |
| Local 049 OP-STATE gap (H1 side-effect) | ✅ CLOSED as authorised H4 proof requirement (Live 3) |
| Production 049 application | ⛔ NOT ATTEMPTED (out of scope · requires separate authorisation) |
| Production flag flip | ⛔ NOT ATTEMPTED (same rationale) |
| CI wiring | ⛔ NOT ATTEMPTED (deploy-branch access) |

**Locked verdict:**

> **H4 — IMPLEMENTED**
> **H4 — VERIFIED — LOCAL LIVE**
> **PRODUCTION — NOT PROVEN**
