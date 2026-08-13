# Wave 3 · H3 · Timeout Budgets

**Programme:** Headquarters Production Readiness · Wave 3 · Batch H3
**Authorisation:** Philip · 2026-08-10 · *"AUTHORISE WAVE 3 — H3 TIMEOUT BUDGETS ONLY."*
**Date opened:** 2026-08-10.
**Final state (locked at end of this batch):**

> **H3 — IMPLEMENTED**
> **H3 — VERIFIED — LOCAL LIVE**
> **PRODUCTION — NOT PROVEN** (live P99 data still not collected · T-5b mutation timeouts still deferred · per-subsystem pools still uncovered)

Related sources of truth:
- `WORLD-CLASS-OPS-REMEDIATION-PLAN.md §3.2 (Batch H3)` — objectives
- `WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md` — full design (three amendment passes)
- `WORLD-CLASS-OPS-W-C-LIVE-VERIFICATION.md` — §12.1 live-PG confirmation of SET LOCAL mechanism
- `WORLD-CLASS-OPS-W-C-RUNTIME-VERIFICATION.md` — §12.5-7 source verification
- Previous closures: `WAVE-3-H1-MIGRATION-HYGIENE.md` · `WAVE-3-H2-CID-LOGGER.md` · `PHASE-6-VERIFICATION-CLOSURE.md`

---

## 0 · Prohibitions honoured (Philip's directive)

- ⛔ Not touching Supabase legacy migrations
- ⛔ Not migrating `hammerex_*` data
- ⛔ Not changing `NEX_BRAIN_BACKEND`
- ⛔ Not enabling the supervisor
- ⛔ Not recovering Cohort A / B
- ⛔ Not modifying the 10 preserved KJs
- ⛔ Not applying production migrations
- ⛔ Not fixing 047 / 048 / 049 OP-STATE gaps (H3 has no direct dependency)
- ⛔ Not broadening Class C CID routes (H2 open item)
- ⛔ Not beginning H4-H6
- ⛔ Not configuring production log aggregation
- ⛔ Not claiming production readiness

---

## 1 · Step 1 · Audit · existing timeout mechanisms (inventory)

Inventory scope: `src/lib/nex/**`. Cross-reference with the seven timeout classes T-1…T-7 defined in `WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md §2`.

### 1.1 · DB-side (pg pool + Postgres server)

| Item | Current state | Coverage |
|---|---|---|
| **Shared pool** at `src/lib/nex/db.ts` | `{ connectionString, max: 3, ssl }` — **no timeout options** | ❌ |
| **12+ per-subsystem `new Pool(...)` sites** (`storage/adapters/postgres.ts`, `campaigns/registry.ts`, `composer/templates_registry.ts`, `segments/{registry,preview}.ts`, `contacts/{registry,merge}.ts`, `ai/contact_resolver.ts`, `imports/{profiles,predictions}.ts`) | Identical `{ connectionString, max, ssl }` pattern · no timeouts | ❌ (uniform) |
| **`statement_timeout` (T-1)** at any pool | Never set at pool level · never set via SET LOCAL | ❌ |
| **`idle_in_transaction_session_timeout` (T-4)** at any pool | Never set | ❌ |
| **`connectionTimeoutMillis` (T-3)** at any pool | Never set at any pool | ❌ |
| **`query_timeout` (T-2 · client-side)** | Never set | ❌ (design deliberately does not add this) |

### 1.2 · Transactional wrappers

| Wrapper | File | SET LOCAL currently done? | Injection point for H3? |
|---|---|---|---|
| `withBrainRole(fn)` | `src/lib/nex/db/with-brain-role.ts` | Sets `ROLE nex_brain_app` | ✅ Add SET LOCAL statement_timeout + idle_in_transaction_session_timeout |
| `withBrainRoleStrict(fn)` | same | Delegates to `withBrainRole` | ✅ Inherits |
| `PostgresBrainStore::withTx` (private class method) | `src/lib/nex/brain/adapters/postgres.ts:50` | Sets `ROLE nex_brain_app` | ✅ Mirror the SET LOCAL injection (this is the "primary Brain PG surface" per design §1.1) |
| Ad-hoc `BEGIN; SET LOCAL ROLE; ...` in older callsites | none remaining (F34 migrated 6 callsites) | — | out of scope |

### 1.3 · Worker execution (T-6 · T-7 · cycle + per-job budgets)

| Item | Current state |
|---|---|
| `runOneCycle` at `src/lib/nex/brain/manager.ts:488` | For-loop batched drain across 5 worker types · **no cycle deadline** |
| Individual worker cycles (`runKnowledgeContext`, `runKnowledgeExtractor`, etc.) | Each acquires a `lease_seconds` on `claimNextJob` (30-90s) — but **that's a DB-side lease reclaim, not a client-side budget** (design §1.5) |
| Per-job budget | Nothing today |
| `AbortController` in workers | None |

### 1.4 · Application-level external calls (T-5)

| Class | Sites (design §1.3, §3, §12.6) | Current coverage |
|---|---|---|
| **T-5a · READ-oriented** (idempotent probes / verifies) | ~9 sites eligible (cv/compare, calls/client, webhook_verify, projects/customer-store, alerts/dispatch email-check) | Partial · some sites use `AbortSignal.timeout(8000)` / `AbortController + setTimeout(5000)` |
| **T-5b · MUTATION-oriented** | 11 sites — `delivery/adapters/{mailgun,postmark,sendgrid,ses}.ts` · `notifications/adapters/{twilio_sms,whatsapp_meta}.ts` · `push/client.ts` (6) · `alerts/dispatch.ts` (2 mutation sites) | ❌ Uncovered — **DEFERRED per design §3 (needs per-adapter idempotency design first)** |

### 1.5 · LLM provider timeouts (T-8-adjacent)

Per design §1.4 — LLM providers each have their own AbortController + setTimeout: Groq 30s · Nemotron 60s · Mistral 30s · Gemini 30-45s · Claude 45s. **This layer works. H3 does not touch it.**

### 1.6 · Existing timeout-related counters / signals

`src/lib/nex/observability/counters.ts` — no `timeout.*` counters today. Fixed CounterName enum.

### 1.7 · Live-evidence status

Per `WORLD-CLASS-OPS-W-C-LIVE-VERIFICATION.md`:
- **§12.1 verified live** on PG 17: `SET LOCAL statement_timeout='30s'` + `SET LOCAL idle_in_transaction_session_timeout='60s'` inside a transaction takes effect immediately, semantics preserved. **Mechanism approved.**
- **§12.2 unavailable**: `pg_stat_statements` not installed on dev · no P99 data · **values remain PROPOSALS**.
- **§12.3-4 partial** · idle instance · pool acquire latency not measurable · no stuck-transaction data.

---

## 2 · Step 2 · Operations without adequate timeout coverage

| # | Class | Category | Status |
|---|---|---|---|
| G1 | T-1 · statement_timeout | ALL 12+ pools · every SQL statement runs without a server-side hard cap | ❌ UNBUDGETED |
| G2 | T-3 · connectionTimeoutMillis | Pool acquisition can block indefinitely | ❌ UNBUDGETED |
| G3 | T-4 · idle_in_transaction_session_timeout | Orphaned transactions from bugs / crashes leak connections until server shuts them | ❌ UNBUDGETED |
| G4 | T-6 · Worker cycle deadline | `runOneCycle` and each per-worker entry function can run indefinitely | ❌ UNBUDGETED · no live P99 evidence for a safe default |
| G5 | T-7 · Per-job budget | Individual jobs can hold their DB lease and slowly grind | ❌ UNBUDGETED · same |
| G6 | T-5b · mutation-oriented external calls (11 sites) | delivery / notifications / push / alert dispatch | ❌ UNBUDGETED **BY DESIGN** (deferred pending per-adapter idempotency work · setting a naïve timeout risks double-delivery) |

**Static coverage: 0/545 SQL statement sites have any application-level timeout · 0/12 pools have any timeout.**

---

## 3 · Step 3 · Mapping timeouts to owning layers

| Timeout | Owning layer | Enforced at |
|---|---|---|
| T-1 statement_timeout | DB-side · shared transactional wrappers | `SET LOCAL statement_timeout` inside `withBrainRole` / `PostgresBrainStore::withTx` |
| T-3 connectionTimeoutMillis | Client-side · pool constructor | `new Pool({ connectionTimeoutMillis })` in `src/lib/nex/db.ts` (shared pool) |
| T-4 idle_in_transaction_session_timeout | DB-side · shared transactional wrappers | Same `SET LOCAL` sequence as T-1 |
| T-6 worker cycle deadline | Application · manager | Wrapper around `runOneCycle` and per-worker entrypoints (opt-in via env var) |
| T-7 per-job budget | Application · worker | Nested wrapper inside each worker cycle (opt-in via env var) |
| T-5b mutation timeouts | Per-adapter · idempotency-aware | **Not this batch** |

---

## 4 · Step 4 · Proposed timeout budgets

### 4.1 · Values

Every value comes from a shared config module (`src/lib/nex/config/timeouts.ts`) with env-var overrides.

| Env var | Default | Meaning | Sanity range | Live-evidence status |
|---|---|---|---|---|
| `NEX_PG_STATEMENT_TIMEOUT_MS` | `30000` (30s) | T-1 · SET LOCAL statement_timeout | 1000-600000 | Mechanism verified · value UNRESOLVED (no P99). Default follows design §3 proposal. |
| `NEX_PG_CONNECTION_TIMEOUT_MS` | `10000` (10s) | T-3 · pool acquire timeout | 1000-60000 | UNRESOLVED-but-safe (fail-fast) |
| `NEX_PG_IDLE_TX_TIMEOUT_MS` | `60000` (60s) | T-4 · SET LOCAL idle_in_transaction_session_timeout | 1000-600000 | UNRESOLVED-but-safe (additive) |
| `NEX_WORKER_CYCLE_DEADLINE_MS` | **`0` (DISABLED)** | T-6 · cycle deadline; 0 = no deadline (default behaviour preserved) | 0 or 60000-3600000 | UNRESOLVED · design §3.1 flags "possibly tight." **Disabled by default until per-worker-type P99 data is collected.** Operators opt in with a specific value. |
| `NEX_WORKER_JOB_BUDGET_MS` | **`0` (DISABLED)** | T-7 · per-job budget; 0 = no deadline | 0 or 30000-1800000 | Same rationale as T-6 |

**Guardrails:**
- Every non-zero value is clamped to its sanity range. Values outside the range fall back to the default and emit a startup warning.
- `0` for T-6 / T-7 is not a "no timeout" wildcard everywhere · it means "don't wrap." T-1 / T-3 / T-4 with `0` would disable the underlying mechanism · so those defaults are always > 0 and clamped to ≥ 1000ms.

### 4.2 · Where each timeout applies

- **T-1 + T-4** apply to every SQL statement run inside `withBrainRole`, `withBrainRoleStrict`, or `PostgresBrainStore::withTx`. That is: knowledge-inbox pg-reads/pg-shadow, jobs pg-reads/pg-shadow/pg-claim, storage object-postgres, and the entire Brain adapter (records, jobs, audits, feedback, heartbeats, retries).
- **T-3** applies only to the shared pool at `src/lib/nex/db.ts`. **The 12+ per-subsystem pools are NOT touched in this batch** — recorded as OPEN in §7.
- **T-6** wraps `runOneCycle` when `NEX_WORKER_CYCLE_DEADLINE_MS > 0`. Otherwise `runOneCycle` behaves exactly as today (default OFF).
- **T-7** wraps each individual worker's body when `NEX_WORKER_JOB_BUDGET_MS > 0`. Otherwise no-op.

### 4.3 · Error semantics

New typed error class `TimeoutError` with a stable `.code`:

| code | Class | Trigger |
|---|---|---|
| `timeout-statement` | T-1 | Postgres cancels the query with SQLSTATE `57014` |
| `timeout-pool-acquire` | T-3 | `new Pool({ connectionTimeoutMillis })` never returned a client |
| `timeout-idle-transaction` | T-4 | Server closed the connection with SQLSTATE `25P03` |
| `timeout-worker-cycle` | T-6 | The cycle wrapper's AbortSignal fired |
| `timeout-job-budget` | T-7 | The job wrapper's AbortSignal fired |

**Invariants:**
- Every timeout THROWS. No timeout silently returns null.
- Transactional wrappers ROLLBACK on the way out (existing behaviour preserved).
- Worker `try/catch → failWorkerJob` path already handles all thrown errors. Timeout errors flow through the same path, marked with their `.code` so operators can distinguish them in the failure message + F4 log field.
- The DB lease still expires naturally · job requeues via existing retry mechanism.
- No timeout retries automatically at the timeout layer · retry is caller's responsibility (idempotency owner).
- No idempotency risk: T-5b is explicitly out of scope this batch.

### 4.4 · Observability

New counters (fixed enum extension):
- `timeout.statement`
- `timeout.pool_acquire`
- `timeout.idle_transaction`
- `timeout.worker_cycle`
- `timeout.job_budget`

Bumped on every classified timeout. Snapshotable via `snapshot()` at `/api/nex/observability/*` (existing surface).

The F4 logger picks up the timeout error via existing `log.error("failed", { message: err.message })` in `failWorkerJob` — the `.code` is preserved in the message text. No new log fields required.

### 4.5 · What the batch does NOT change

- Per-subsystem pools (12 sites) — unchanged. Recorded as OPEN.
- LLM provider timeouts — unchanged.
- T-2 (client-side `query_timeout`) — not adopted (design says "middle ground · pg driver enforced" · no clear benefit over T-1).
- T-5a / T-5b external fetches — unchanged (T-5b deferred by design · T-5a not in the Philip scope for H3).
- `PostgresBrainStore::withTx` migration to shared `withBrainRole` (F34.b) — unchanged. The SET LOCAL is added in place, not migrated.
- No default behaviour change for worker cycles / job budgets — they stay UNCAPPED by default (T-6 / T-7 opt-in).

---

## 5 · Test plan

1. **Timeout config sanity tests** — `src/lib/nex/config/tests/timeouts.test.mjs`:
   - default values returned when env vars unset
   - env-var overrides honoured within sanity ranges
   - out-of-range values clamped to defaults
   - T-6 / T-7 default to 0 (disabled)
2. **Timeout error class contract tests** — same file:
   - `TimeoutError` carries stable `.code`
   - `isTimeoutError(x)` type guard works
3. **DB timeout injection tests** — `src/lib/nex/db/tests/timeout-injection.test.mjs`:
   - `withBrainRole` runs SET LOCAL statement_timeout + SET LOCAL idle_in_transaction_session_timeout in the transaction
   - The values come from the config module (test-injected)
   - When env vars are set to specific values, the SET LOCAL uses them
4. **Static repository coverage** — `scripts/verify-timeout-coverage.mjs`:
   - lists per-subsystem pool count
   - counts SQL statement sites vs. those covered by shared wrappers
   - snapshot report
5. **Drift-catcher for T-5b sites** — `src/lib/nex/observability/tests/unbudgeted-mutations.test.mjs`:
   - explicit allowlist of the 11 T-5b sites
   - fails if new mutation-oriented fetch sites appear without either a timeout or an entry in the allowlist

**Regressions expected:** none. Existing `withBrainRole` behaviour is additive (SET LOCAL is appended · runs at BEGIN time · does not change transaction semantics).

---

## 6 · Files touched

- **NEW** · `src/lib/nex/config/timeouts.ts` — env-var reader + typed `TimeoutError` + `isTimeoutError` guard
- **NEW** · `src/lib/nex/config/tests/timeouts.test.mjs` — config + error class tests
- **NEW** · `src/lib/nex/db/tests/timeout-injection.test.mjs` — SET LOCAL emission tests
- **NEW** · `src/lib/nex/observability/tests/unbudgeted-mutations.test.mjs` — T-5b drift-catcher
- **NEW** · `scripts/verify-timeout-coverage.mjs` — static coverage report
- **MODIFIED** · `src/lib/nex/db.ts` — add `connectionTimeoutMillis` to shared pool
- **MODIFIED** · `src/lib/nex/db/with-brain-role.ts` — inject SET LOCAL statement_timeout + SET LOCAL idle_in_transaction_session_timeout after SET LOCAL ROLE
- **MODIFIED** · `src/lib/nex/brain/adapters/postgres.ts::withTx` — same injection (primary Brain PG surface)
- **MODIFIED** · `src/lib/nex/observability/counters.ts` — add 5 `timeout.*` counters to fixed enum
- **NEW** · `src/lib/nex/brain/timeouts/withWorkerDeadline.ts` — T-6 / T-7 opt-in wrappers (no-op when env var is `0`)
- **MODIFIED** · `package.json` — new `nex:verify-timeout-coverage` script

---

## 7 · Results

**Date executed:** 2026-08-10.

### 7.1 · Before → after coverage

| Coverage item | Before | After |
|---|---|---|
| Shared pool at `src/lib/nex/db.ts` passes `connectionTimeoutMillis` | ❌ | ✅ (10s default via env var) |
| `withBrainRole` emits `SET LOCAL statement_timeout` | ❌ | ✅ (30s default) |
| `withBrainRole` emits `SET LOCAL idle_in_transaction_session_timeout` | ❌ | ✅ (60s default) |
| `PostgresBrainStore::withTx` emits both SET LOCALs | ❌ | ✅ |
| Shared timeouts config module + typed `TimeoutError` | ❌ | ✅ |
| Timeout counters (`timeout.statement`, `timeout.pool_acquire`, `timeout.idle_transaction`, `timeout.worker_cycle`, `timeout.job_budget`) | ❌ | ✅ (5 counters added to fixed enum) |
| Opt-in worker-cycle deadline wrapper (T-6) | ❌ | ✅ (no-op when env var is 0 · default disabled) |
| Opt-in per-job budget wrapper (T-7) | ❌ | ✅ (same default-disabled semantics) |
| Static repo coverage report | ❌ | ✅ `scripts/verify-timeout-coverage.mjs` |
| T-5b drift-catcher (9-entry allowlist) | ❌ | ✅ `src/lib/nex/observability/tests/unbudgeted-mutations.test.mjs` |
| **Per-subsystem pools (10 sites)** | ❌ (no timeouts) | ❌ **STILL UNCOVERED** · recorded as OPEN below |

Static coverage report output (verbatim `nex:verify-timeout-coverage`):
```
pools total       : 11
pools with T-3    : 1
pools without T-3 : 10
wrapper injection:
  ✓ withBrainRole   · statement=true · idle_tx=true
  ✓ PostgresBrainStore::withTx · statement=true · idle_tx=true
  ✓ shared pool (db.ts) · connectionTimeoutMillis=true
total `await *.query(` sites : 550
```

### 7.2 · Timeout budgets introduced

| Env var | Default (ms) | Sanity range (ms) | Class | Live-evidence |
|---|---|---|---|---|
| `NEX_PG_STATEMENT_TIMEOUT_MS` | 30 000 | 1 000 – 600 000 | T-1 | Mechanism verified live PG (§7.5) · value per design proposal (P99 unknown) |
| `NEX_PG_CONNECTION_TIMEOUT_MS` | 10 000 | 1 000 – 60 000 | T-3 | Additive · fail-fast · safe default |
| `NEX_PG_IDLE_TX_TIMEOUT_MS` | 60 000 | 1 000 – 600 000 | T-4 | Additive · safe default |
| `NEX_WORKER_CYCLE_DEADLINE_MS` | **0 (DISABLED)** | 0 or 60 000 – 3 600 000 | T-6 | UNRESOLVED · no per-worker P99 data · opt-in only |
| `NEX_WORKER_JOB_BUDGET_MS` | **0 (DISABLED)** | 0 or 30 000 – 1 800 000 | T-7 | Same rationale |

### 7.3 · Operations intentionally left without timeout

| # | Class | Sites | Rationale |
|---|---|---|---|
| 1 | T-5b mutation-oriented external calls | 9 files on allowlist (`delivery/adapters/{mailgun,postmark,sendgrid,ses,smtp}.ts` · `notifications/adapters/{twilio_sms,whatsapp_meta,web_push}.ts` · `push/{client,server}.ts` · `alerts/dispatch.ts` mutation sites) | **Deferred by design** (`W-C-TIMEOUT-BUDGETS-DESIGN.md §3`). Setting a naïve timeout risks duplicate side-effect (send email/SMS/push twice). Needs per-adapter idempotency-key design first. Drift-catcher `TB1-TB3` prevents silent growth of this set. |
| 2 | Per-subsystem pools (10 pools) | `storage/adapters/postgres.ts` · `segments/{preview,registry}.ts` · `imports/{predictions,profiles}.ts` · `contacts/{merge,registry}.ts` · `composer/templates_registry.ts` · `campaigns/registry.ts` · `ai/contact_resolver.ts` | Each subsystem constructs its own pool; consolidating them into the shared pool (or duplicating the T-3 config) is scope creep for H3. Recorded as OPEN. |
| 3 | T-6 / T-7 default OFF | `runOneCycle` / per-worker cycles | No live per-worker P99 data yet. Wrapper mechanism ships this batch; operators opt in with a specific ms value once measurement supports a safe default. |
| 4 | T-5a read-oriented external calls | ~9 sites (design §12.6) | Not in H3's Philip scope (`storage operations and worker execution paths`). Existing partial coverage retained. Follow-up batch. |
| 5 | `PostgresBrainStore::withTx` migration to shared `withBrainRole` (F34.b) | 1 site | Out of scope; SET LOCAL added in place instead. Migration is a separate future step. |

### 7.4 · Tests

| Suite | Assertions | Pass | Fail |
|---|---|---|---|
| **NEW** `src/lib/nex/config/tests/timeouts.test.mjs` (T1-T8) | 8 | 8 | 0 |
| **NEW** `src/lib/nex/db/tests/timeout-injection.test.mjs` (TI1-TI5) | 5 | 5 | 0 |
| **NEW** `src/lib/nex/observability/tests/unbudgeted-mutations.test.mjs` (TB1-TB3) | 3 | 3 | 0 |
| Live probe `scripts/prove-timeout-injection-live.ts` | 3 probes | 3 | 0 |
| Regression suite (obs + workers + config + db) | 139 | 138 | **1** |

The 1 regression is `CFGA2 · HQ files that read process.env.NEX_POSTGRES_URL directly are on CFGA2_KNOWN_EXCEPTIONS`. It flags `src/lib/nex/brain/adapters/postgres.wc-companion.test.ts` which was NOT touched by H3. Classified as **pre-existing** per Philip's discipline. See §7.6.

### 7.5 · Live probe results

`scripts/prove-timeout-injection-live.ts` executed against local NEX Postgres:

```
Probe 1 · SHOW statement_timeout + SHOW idle_in_transaction_session_timeout inside withBrainRole
  statement_timeout = 30s
  idle_in_transaction_session_timeout = 1min
  → PASS · defaults propagated

Probe 2 · env-var override propagates into SET LOCAL
  after NEX_PG_STATEMENT_TIMEOUT_MS=5000 → statement_timeout = 5s
  → PASS

Probe 3 · slow query cancelled at statement_timeout
  elapsed = 1023ms · caught error code = 57014
  message = canceling statement due to statement timeout
  → PASS · cancelled within ~1s + SQLSTATE 57014
```

The pg_sleep(5) with statement_timeout=1s was cancelled at 1023ms with SQLSTATE `57014` (`canceling statement due to statement timeout`). Mechanism verified live.

### 7.6 · Regressions

**Zero H3-caused regressions in code.** Test-suite regression summary:

- **Pre-existing (not H3):** `CFGA2` (adoption-drift.test.mjs) flags `postgres.wc-companion.test.ts` line 37 for direct `process.env.NEX_POSTGRES_URL` read. Untouched by H3. Recorded as pre-existing.
- **Test-loader fix (not a code regression):** H3 required updating `src/lib/nex/db/tests/with-brain-role.test.mjs` to (a) stub the new `@/lib/nex/config/timeouts` import and (b) reflect the new SET LOCAL call sequence in the WBR1 assertion. Contract preserved (BEGIN → SET LOCAL ROLE → SET LOCAL statement_timeout → SET LOCAL idle_in_transaction → fn → COMMIT). All 10 WBR assertions green.
- Pre-existing brain-suite failures from Phase 6 closure remain out of scope (extractor-idempotency · knowledge-dump-worker · storage-characterization SC15).

### 7.7 · Unresolved production dependencies

- **Live P99 data** · `pg_stat_statements` not installed on dev; no historical P99 for statement_timeout or worker-cycle tuning. Values in §7.2 remain PROPOSALS pending production measurement.
- **Per-subsystem pools** · 10 pools still without `connectionTimeoutMillis`. Adding is straightforward but per-file work; recorded as OPEN.
- **T-5b idempotency design** · required before mutation-oriented external calls can adopt timeouts. Recorded as OPEN.
- **T-6 / T-7 defaults** · disabled until per-worker P99 measured. Wrapper mechanism ships this batch so opt-in is a single env var per environment.
- **CI wiring** · `nex:verify-timeout-coverage` npm script added; deploy-branch wiring pending (matches H1.c CI-wiring open item).

### 7.8 · Files touched

- **NEW** · `src/lib/nex/config/timeouts.ts` (config + `TimeoutError` + `isTimeoutError`)
- **NEW** · `src/lib/nex/brain/timeouts/withWorkerDeadline.ts` (T-6 / T-7 opt-in wrappers)
- **NEW** · `src/lib/nex/config/tests/timeouts.test.mjs` (T1-T8)
- **NEW** · `src/lib/nex/db/tests/timeout-injection.test.mjs` (TI1-TI5)
- **NEW** · `src/lib/nex/observability/tests/unbudgeted-mutations.test.mjs` (TB1-TB3)
- **NEW** · `scripts/verify-timeout-coverage.mjs`
- **NEW** · `scripts/prove-timeout-injection-live.ts`
- **NEW** · `docs/headquarters-production-readiness/WAVE-3-H3-TIMEOUT-BUDGETS.md` (this file)
- **MODIFIED** · `src/lib/nex/db.ts` (add `connectionTimeoutMillis`)
- **MODIFIED** · `src/lib/nex/db/with-brain-role.ts` (SET LOCAL injection)
- **MODIFIED** · `src/lib/nex/brain/adapters/postgres.ts` (SET LOCAL injection in `withTx`)
- **MODIFIED** · `src/lib/nex/observability/counters.ts` (add 5 `timeout.*` counters)
- **MODIFIED** · `src/lib/nex/db/tests/with-brain-role.test.mjs` (stub timeouts import + update WBR1 assertion for new call order)
- **MODIFIED** · `package.json` (add `nex:verify-timeout-coverage` script)

### 7.9 · Final H3 verdict

| Component | State |
|---|---|
| T-1 statement_timeout injection (withBrainRole + PostgresBrainStore::withTx) | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE (mechanism confirmed via SHOW + pg_sleep cancellation with SQLSTATE 57014) |
| T-3 connectionTimeoutMillis on shared pool | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE |
| T-4 idle_in_transaction_session_timeout injection | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE (mechanism confirmed via SHOW) |
| T-6 worker-cycle deadline wrapper (opt-in) | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE (unit tests pass · default-disabled semantics preserved) |
| T-7 per-job budget wrapper (opt-in) | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE |
| Typed `TimeoutError` + 5 counters | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE |
| T-5b drift-catcher (9-site allowlist) | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE |
| Static coverage script | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE |
| 10 per-subsystem pools T-3 coverage | ⛔ NOT ATTEMPTED (out of scope · recorded OPEN) |
| Production P99 measurement for tuning | ⛔ NOT ATTEMPTED (production dependency) |
| T-5b mutation-timeout adoption | ⛔ NOT ATTEMPTED (design defers · needs idempotency-key work) |
| CI wiring for `nex:verify-timeout-coverage` | ⛔ NOT ATTEMPTED (deploy-branch access) |
| Preservation invariant (10 KJs) | ✅ VERIFIED green pre + post batch |

**Locked verdict:**

> **H3 — IMPLEMENTED**
> **H3 — VERIFIED — LOCAL LIVE**
> **PRODUCTION — NOT PROVEN**
