# W-C · Timeout Budgets End-to-End · Design Document **· AMENDED 2026-08-11 (runtime + live + forensic verification findings)**

> **STATUS · 2026-08-11 · three amendment passes** (design → runtime
> verification → live-PG verification → **stuck-claimed forensic
> investigation**). This doc has been amended three times in one
> session as evidence accumulated. No implementation authorized in
> any pass. Every proposed value REMAINS a PROPOSAL.
>
> **Companion evidence documents (read together):**
>
> - `WORLD-CLASS-OPS-W-C-RUNTIME-VERIFICATION.md` — source verification of § 12.5-7 + F35 boundary
> - `WORLD-CLASS-OPS-W-C-LIVE-VERIFICATION.md` — live PG 17 confirmation of § 12.1 + partial § 12.3
> - `WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md` — read-only forensic classification of the 10 stuck-claimed jobs found during live verification
>
> **Cumulative findings that shaped this design:**
>
> 1. **`pg_stat_statements` NOT installed** on the dev PG · no historical P99 · T-1 = 30s unresolved
> 2. **`nex.worker_jobs` is EMPTY** on dev · P99 by worker_type not measurable · T-6/T-7 unresolved
> 3. **10 of 39 `nex.knowledge_dump_jobs` stuck in "claimed"** for up to 52+ hours · **W-C empirically vindicated as needed** · **but W-C alone does NOT fix this class** (see § 1.7 scope clarification and § 15.2 W-C-COMPANION)
> 4. Proxy P99 suggests T-6 and T-7 may be tight · exact values unresolved
> 5. **`nex.knowledge_dump_jobs` has NO lease-expiry / supervisor mechanism** — architectural gap independent of timeouts · needs its own cluster (W-C-COMPANION)
> 6. **The 10 stuck jobs are preserved untouched** as forensic evidence for eventual contract tests
> 7. **Wave 11 GROUP B (shipped in `6b3458d`) + W-OBS-1 Path A Layer 1 (shipped in `08a116a`) mean any NEW stuck-claimed case going forward will have a much stronger forensic trail** than these 10 (§ 12.8)

> **STATUS · 2026-08-11 · Philip authorized amendment · Claude executed:**
> Runtime verification pass (`WORLD-CLASS-OPS-W-C-RUNTIME-VERIFICATION.md`)
> found four evidence-backed corrections. This document has been amended
> to reflect them. Live-PG verification (§12 items 1-4) remains pending
> before implementation authorization. Values in § 3 remain PROPOSALS
> until live P99 measurement confirms.
>
> **Amendments applied (see `## Change log`):**
>
> 1. **T-5 SPLIT** into T-5a (read-oriented · safe to implement in Phase 1)
>    and T-5b (mutation-oriented delivery/notifications/push · **DEFERRED**
>    pending per-adapter idempotency design). Blindly timing out a
>    payment/notification/delivery mutation can produce the exact
>    "external side effect happens twice" failure Headquarters must
>    prevent.
> 2. **Backfill isolation** — new drift-catcher CATO6 · backfill scripts
>    must not inherit shared Headquarters timeout configuration.
> 3. **F35 protection upgraded to REQUIRED** — the invariant is:
>    *"Once `finalizeWorkerJob` enters its critical finalization
>    section, the worker deadline must not interrupt that section."*
>    This is more precise than "all-or-nothing" · some steps are
>    application/external side effects with different atomicity
>    properties (see new § 5.5 atomicity distinction).
> 4. **Node engines pin** — `package.json` `engines` must guarantee the
>    runtime required for `AbortSignal.any`. Proposed `>=20.3.0` remains
>    subject to verification against the actual deployment/runtime
>    matrix (Vercel Functions default · Fly Dockerfile Node install).

**Programme:** Headquarters Production Readiness · World-Class ops gap remediation
**Cluster:** W-C · Timeout Budgets (Findings W-REL-1 · W-REL-2 · plus Philip's decomposition of "hung worker")
**Position in 17-step plan:** Step 3
**Authorization:** Philip 2026-08-11 · *"Open Cluster W-C · Timeout Budgets for DESIGN ONLY. Do not authorize implementation yet."*
**Not-a-goal:** implementation · migrations · configuration changes · commits · pushes · consuming implementation authorization.
**North star:** NEX Headquarters must become trustworthy infrastructure beneath NEX Brain. "Doesn't hang" is the property this cluster protects · but *"a stuck worker isn't merely a performance problem — it can become a lost piece of intelligence or an invisible operational failure"* (Philip 2026-08-11). This design treats every timeout as a **state-transition event**, not merely a resource-release event.

---

## 1 · Landscape enumeration (evidence-based)

Surveyed from working tree (post `08a116a`).

### 1.1 · PostgreSQL query sites

- **Total `await *.query(` sites in `src/lib/nex/`:** 545 (excluding tests)
- **Top files:**
  - `brain/adapters/postgres.ts` · 41 queries · **primary Brain PG surface**
  - `storage/adapters/object-postgres.ts` · 14 queries · **NEX Storage object adapter**
  - `alerts/evaluator.ts` · 24 queries
  - `comms-social/worker/worker.ts` · 32 queries (frozen · out of scope · noted for coverage)
  - `contacts/merge.ts` · 16 queries (Trade Centre · out of Wave 11 scope)
  - `composer/templates_registry.ts` · 14 queries (Trade Centre)
  - `alerts/dispatch.ts` · fetch calls (see 1.3)
  - `db.ts` · shared pool (no queries · pool factory only)

### 1.2 · Pool construction sites

- **Total `new Pool(` sites:** 12+ (each subsystem creates its own pool alongside `src/lib/nex/db.ts`)
- **Pattern (uniform):** `new Pool({ connectionString, max: 3-5, ssl: needsSsl ? {rejectUnauthorized:false} : undefined })`
- **What is NOT set today:**
  - `statement_timeout` (per-query cancellation at DB side)
  - `idle_in_transaction_session_timeout` (kills orphaned transactions)
  - `connectionTimeoutMillis` (pool acquisition timeout)
  - `query_timeout` (pg client-side)
- **Every pool config is bespoke** — no shared helper. F28 shipped `getPostgresUrl()` for URL centralization but pool config remains per-subsystem.

### 1.3 · HTTP fetch sites (external network I/O)

- **Total `await fetch(` sites in `src/lib/nex/`:** 36
- **Notable existing timeout coverage:**
  - `alerts/dispatch.ts` · 3 sites using `AbortSignal.timeout(8000)` (8s) — webhook dispatch
  - `automation/engine.ts` · `AbortController` + `setTimeout(..., 5000)` — 5s
- **Uncovered sites:** ~30 fetch calls without any timeout wrapper (need enumeration during implementation · not doing now)

### 1.4 · LLM call sites

- **Direct `await runLlmChain\|providerCall` in worker code:** 0 — workers call through a layer
- **LLM layer location:** `src/lib/nex/brain/llm.ts`
- **Existing timeout pattern:** every provider function has `AbortController` + `setTimeout(controller.abort, options.timeout_ms ?? DEFAULT)`
- **Defaults observed:**
  - Groq · 30000 (30s)
  - Nemotron · 60000 (60s · noted in comment: "550B is slower than Groq")
  - Mistral · 30000
  - Gemini · 30000 · 45000 (varies by endpoint)
  - Claude / Anthropic · 45000
- **Verdict:** LLM timeout coverage exists and is per-provider-tuned. **This cluster does not touch LLM timeouts** — they work.

### 1.5 · Worker cycle entry points

- **8 workers** (one entry function each):
  - `knowledge-context.ts::runKnowledgeContext`
  - `voice-context.ts::runVoiceContext`
  - `learning-context.ts::runLearningContext`
  - `knowledge-extractor.ts::runKnowledgeExtractor`
  - `image-analyst.ts::runImageAnalyst`
  - `quality-checker.ts::runQualityChecker`
  - `memory-guardian.ts::runMemoryGuardian`
  - `llm-retry.ts::runLlmRetryOnce`
- **Existing lease values (worker's claim lease from DB · NOT a cycle timeout):**
  - knowledge-context · 45s
  - voice-context · 30s
  - learning-context · 30s
  - knowledge-extractor · 60s
  - image-analyst · 90s
  - quality-checker · 60s
  - memory-guardian · (uses default)
  - llm-retry · (uses default)
- **Critical distinction:** `lease_seconds` tells the DB "reclaim this job if worker dies" — it's a DB-side safety net, not a client-side deadline. The worker itself has **no self-imposed cycle limit today**. A worker can hold the lease, do slow work, and the DB will reclaim only after `lease_expires_at`.

### 1.6 · Transaction pattern

- Brain adapter uses private `withTx` (F34.b · known-exception): `BEGIN → SET LOCAL ROLE nex_brain_app → fn(c) → COMMIT` with `catch → ROLLBACK`
- Wave 11 F34 shared `withBrainRole` + `withBrainRoleStrict` in `src/lib/nex/db/with-brain-role.ts` (6 sites migrated)
- **Timeout implication:** if a timeout throws inside `withTx`/`withBrainRole`, the catch fires and ROLLBACK runs. **This is the correct behavior — transactions abort cleanly on timeout.**

---

## 1.7 · Scope clarification · what W-C does NOT solve (Amendment A · added 2026-08-11)

Empirical forensic evidence (`WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md`) established that the **10 stuck-claimed jobs observed on the dev DB are NOT remediated by W-C timeouts alone**. The class of failure they represent has a distinct architectural fix requirement.

**W-C DOES solve:**

- Worker cycles hanging indefinitely (T-6 caps them)
- Per-job runaway processing (T-7 caps per-item work)
- Runaway single SQL statements (T-1 caps them)
- Orphaned transactions (T-4 kills them)
- Blocked pool acquisition (T-3 fails fast)
- Uncovered idempotent external calls (T-5a)
- Timeout-induced partial state during F35 finalize (§ 5.6 critical-section invariant)
- Emission of `worker-timeout` signals with W-OBS-1 correlation IDs for forensic trails going forward

**W-C does NOT solve:**

- **Stuck-claimed `nex.knowledge_dump_jobs` orphaned by silent downstream WorkerJob failure.** The extractor is the sole writer of terminal status to `knowledge_dump_jobs`. If the downstream chain doesn't reach the extractor (worker crash · silent throw · deployment kill · LLM error), the KnowledgeJob stays at `claimed` indefinitely. **No lease-expiry mechanism exists on that queue.** Timeouts on WorkerJobs don't cascade back to un-stick a KnowledgeJob whose extractor never ran.
- **Application-level idempotency gap on `nex.worker_jobs` child-enqueue.** Retry of a partially-finalized worker can duplicate child jobs (documented in § 6.3 · verified by forensic evidence).
- **External side-effect ambiguity on mutation-oriented fetches** (T-5b · deferred).
- **Recovery of the existing 10 stuck jobs.** They are preserved as forensic evidence · to be un-stuck deliberately AFTER the supervisor architecture (§ 15.2 W-C-COMPANION) is designed and implementation-authorized.

**Consequence:** any operator or reader who expects W-C to fix the 10 stuck jobs will be surprised. This section makes the boundary explicit. **W-C is a foundational reliability layer · not a complete recovery solution.** The supervisor layer (W-C-COMPANION) is required to complete the story.

---

## 2 · The five timeout classes (formal definition)

Different timeout mechanisms cover different scopes. The design must not conflate them.

| # | Class | Enforcement point | Cancels what | Recovery semantics |
|---|---|---|---|---|
| **T-1** | **Statement timeout** (DB-side) | Postgres server (`statement_timeout = 30s`) | The current SQL statement | Transaction aborts · client throws `57014 · query_canceled` |
| **T-2** | **Query timeout** (client-side) | pg driver (`query_timeout` option or per-call `AbortSignal`) | Client stops waiting for response · connection may still process | Client throws · pg driver may either release connection or destroy it depending on driver internals |
| **T-3** | **Pool acquisition timeout** | pg Pool (`connectionTimeoutMillis`) | Waiting for a free connection | Caller throws · no query was ever sent |
| **T-4** | **Idle-in-transaction timeout** (DB-side) | Postgres server (`idle_in_transaction_session_timeout = 60s`) | Connection holding an idle transaction | Server closes the connection · pending transaction aborts · pool re-creates connection |
| **T-5a** | **Operation timeout · READ-oriented** (application-level) | `AbortController` around an idempotent read (LLM query · probe · comparison API · webhook verify) | Whatever the AbortSignal is passed to | Caller throws `AbortError` · retry is idempotent · **safe to implement Phase 1** |
| **T-5b** | **Operation timeout · MUTATION-oriented** (application-level) | `AbortController` around a state-changing external call (delivery send · notification send · push send · payment) | Whatever the AbortSignal is passed to | Caller throws `AbortError` · **external system MAY have completed the mutation** · retry can produce duplicate side-effect · **DEFERRED · needs per-adapter idempotency design** |
| **T-6** | **Worker deadline** (application-level · new) | Wrapper around each worker cycle | Worker's entire cycle from claim to finalize | Worker throws · `failWorkerJob` fires · lease expires naturally · job requeues |
| **T-7** | **Per-job budget** (application-level · new) | Nested wrapper inside worker · per-job override | Single job's processing | Same as T-6 but scoped per-job (some jobs legitimately need longer) |
| **T-8** | **Retry backoff timeout** (existing · not this cluster) | LLM retry queue (30s → 2m → 10m → 30m → 2h) | The wait between attempts | N/A |

**T-1, T-3, T-4** are **DB-side** — configured in the pool constructor. Cheap · reliable · always effective.
**T-5a, T-5b, T-6, T-7** are **application-side** — cooperative · require caller to honor the signal.
**T-2** is a middle ground — pg driver enforced but at client boundary.

**This cluster's Phase 1 scope:** T-1, T-3, T-4, T-6, T-7, T-5a.
**Deferred (needs per-adapter idempotency design first):** T-5b — 11 uncovered mutation-oriented fetch sites in `src/lib/nex/delivery/adapters/{mailgun,postmark,sendgrid,ses}.ts` · `src/lib/nex/notifications/adapters/{twilio_sms,whatsapp_meta}.ts` · `src/lib/nex/push/client.ts` (6 sites) · plus 2 uncovered mutation sites in `src/lib/nex/alerts/dispatch.ts`.
**Out of scope:** T-8 (already exists) · LLM provider timeouts (already exist per §1.4).

---

## 3 · Proposed timeout values (proposals only · verify against workload)

**All values below are proposals · they must be validated against actual NEX workload characteristics before any implementation lands.** The runtime verification requirements in §12 include this validation.

| Class | Proposed default | Rationale | Validation needed |
|---|---|---|---|
| **T-1 · `statement_timeout`** | **30s** | Longest observed Brain query (backfill-adjacent selects) is estimated ≤10s at current row counts. 30s = 3× headroom. LLM providers can take up to 60s but those are NOT SQL statements. | Measure P99 query duration in production for 7 days. Adjust if any legitimate query exceeds 20s. Backfill scripts may need to override with a higher per-connection value. |
| **T-3 · `connectionTimeoutMillis`** | **10s** | If we can't get a connection within 10s, the pool is exhausted. Better to fail fast and let the caller retry than to stack blocked callers. | Measure current pool acquire latency. If P99 > 3s, either raise `max` or investigate connection leaks first. |
| **T-4 · `idle_in_transaction_session_timeout`** | **60s** | An idle transaction beyond 60s is almost certainly a code bug (forgot to COMMIT/ROLLBACK). Kill the connection · abort the transaction. | Measure how often transactions currently take >30s. If common, first investigate why (long LLM call inside transaction? · unlikely but possible). |
| **T-6 · Worker cycle deadline** | **15 minutes default** · overridable per worker type | Longest legitimate worker cycle observed = image-analyst which can do vision analysis + record insert + child job enqueue. Currently these run in ~1-3 minutes. 15m = 5-15× headroom. | Measure P99 cycle duration per worker type from `worker_jobs.completed_at - assigned_at`. Adjust image-analyst upward if 15m is insufficient at scale. |
| **T-7 · Per-job budget** | **5 minutes default** · overridable | A single job (one inbox item worth of processing) should complete in 5 minutes. If it takes longer, LLM chain is likely stuck OR the item is pathological. | Same measurement as T-6. Per-job < per-cycle because a cycle may include claim overhead + finalize. |
| **T-5a · Operation timeout · READ-oriented** | **10s** for internal probes · **30s** for external read APIs (LLM already handled per-provider) | Existing `alerts/dispatch.ts` uses 8s for one call. LLM providers 30-60s per-provider (unchanged). Idempotent reads are safe to abort. | Enumeration completed in `WORLD-CLASS-OPS-W-C-RUNTIME-VERIFICATION.md` §12.6 · ~9 sites eligible for Phase 1 (e.g., cv/compare · calls/client · webhook_verify · alerts/dispatch email-check · projects/customer-store). |
| **T-5b · Operation timeout · MUTATION-oriented** | **DEFERRED** (do NOT set a value yet) | 11 sites confirmed uncovered · every one performs a state-changing external call (email send · SMS · WhatsApp · push notification · alert dispatch webhook). Timing out at 30s when external system completed at 31s means we retry and **the receiver gets it twice** — payment · notification · email double-delivery. This is the exact class of failure Headquarters must prevent. | Each adapter needs its own idempotency-key design (e.g., Mailgun v-api-key · Twilio idempotency-key header · WhatsApp message-id dedup). **Phase 1 explicitly does NOT set T-5b timeouts** · these sites remain uncovered until per-adapter design lands as a separate authorization. Continued unbounded wait is the LESSER evil vs blind timeout with duplicate-send risk. |

**No hardcoded magic numbers.** Every value goes through a shared config module (matches Step 11 pattern via `src/lib/nex/config/`). Env-var overrides for prod tuning:
- `NEX_PG_STATEMENT_TIMEOUT_MS` (default 30000)
- `NEX_PG_CONNECTION_TIMEOUT_MS` (default 10000)
- `NEX_PG_IDLE_TX_TIMEOUT_MS` (default 60000)
- `NEX_WORKER_CYCLE_DEADLINE_MS` (default 900000 · 15m)
- `NEX_WORKER_JOB_BUDGET_MS` (default 300000 · 5m)

These become 5 additional feature gates · schema-compatible with the Step 11 `gates.ts` pattern.

### 3.1 · Live-evidence status per value (added 2026-08-11 after live-PG verification)

Every proposed value is a **PROPOSAL** · none is approved by live evidence. See `WORLD-CLASS-OPS-W-C-LIVE-VERIFICATION.md` for full data.

| Class | Value | Live-evidence status | Reason |
|---|---|---|---|
| T-1 statement_timeout | 30s | **UNRESOLVED** | `pg_stat_statements` not installed on dev · no P99 data (see Step 1a) |
| T-3 connectionTimeoutMillis | 10s | **UNRESOLVED-but-safe** | Idle instance · no load to measure · additive · fail-fast |
| T-4 idle_in_transaction_session_timeout | 60s | **UNRESOLVED-but-safe** | No stuck transactions observable · additive |
| T-6 Worker cycle deadline | 15m | **UNRESOLVED · possibly tight** | `nex.worker_jobs` empty on dev · `knowledge_dump_jobs` proxy p99 = 21m end-to-end (queue-wait + execution combined) · pure-execution portion unknown · needs per-worker-type P99 in production |
| T-7 Per-job budget | 5m | **UNRESOLVED · possibly tight** | `knowledge_dump_jobs` proxy p95 = 10m end-to-end · needs per-worker-type P99 in production |
| T-5a Read-oriented fetches | 10s / 30s | Out of live-PG scope | (external HTTP) |
| T-5b Mutation-oriented fetches | DEFERRED | Unchanged | Needs per-adapter idempotency design |

**Consequence:** T-6 and T-7 tuning is now explicitly gated on per-worker-type production P99 measurement. Design does NOT approve them from dev proxy data alone.

---

## 4 · AbortController / deadline propagation design

### 4.1 · The two mechanisms

- **Node.js `AbortController`** — standard cooperative signal. Callers pass `signal` to `fetch()`, LLM SDK, or check `signal.aborted`.
- **Node.js `AbortSignal.timeout(ms)`** — shorthand that creates a self-aborting signal. Cleaner for one-shot budgets.

### 4.2 · Signal composition (nesting)

A worker cycle has multiple nested budgets:
```
worker cycle deadline (T-6 · 15m)
  └─ per-job budget (T-7 · 5m)
       └─ per-external-call (T-5 · 30s per LLM call · 10s per internal fetch)
            └─ per-statement (T-1 · 30s enforced at DB)
```

**Proposed signal composition using `AbortSignal.any([...])`:**
```
// spec · not code:
const cycleSignal = AbortSignal.timeout(CYCLE_DEADLINE_MS);
const jobSignal   = AbortSignal.any([cycleSignal, AbortSignal.timeout(JOB_BUDGET_MS)]);
const callSignal  = AbortSignal.any([jobSignal, AbortSignal.timeout(30_000)]);
fetch(url, { signal: callSignal });
```

`AbortSignal.any` (Node 20+) fires on the FIRST parent to abort. So a slow LLM call under a running-out job budget aborts at whichever comes first. **Deadline propagation is automatic.**

### 4.3 · Storing the deadline for downstream inheritance

**Proposed pattern:** the worker's ALS scope (from W-OBS-1) is extended to also carry the CYCLE deadline · not just the CID. A new helper `getWorkerDeadline(): AbortSignal | null` returns the current cycle's remaining signal.

Any deep-nested code (adapter query · third-party call) that wants to honor the worker deadline calls `getWorkerDeadline()` and passes to its own operation. If no deadline is active (e.g., called outside a worker), returns null · caller uses its own timeout.

**This does NOT require every call site to know about deadlines** — only the worker cycle wrapper establishes the signal · deep code opts in.

### 4.4 · Pool-level enforcement

Pool config gains three fields at connection acquisition:
- `statement_timeout` set via `SET LOCAL statement_timeout = '30s'` at transaction start (belt-and-braces alongside pool-level)
- `idle_in_transaction_session_timeout` via `SET LOCAL ...`
- `connectionTimeoutMillis` at pool construction

Because the F34 `withBrainRole` already runs `BEGIN → SET LOCAL ROLE nex_brain_app`, we ADD two SET LOCALs for the timeouts. Zero adapter API change. **F12 AI2 (adapters export only classes) preserved · no selector logic added.**

### 4.5 · Middleware / route handler concern (out of scope)

HTTP route handlers already run under Next.js request lifecycle · Vercel enforces a `maxDuration` (currently 60s for the upload route). This is a **separate deadline** enforced by the platform · not managed by this cluster. Note only.

---

## 5 · Timeout error semantics

### 5.1 · Error taxonomy

Every timeout produces a **typed error** with a stable `code` field:

| Code | Class | Meaning |
|---|---|---|
| `timeout-statement` | T-1 | Postgres cancelled the query at `statement_timeout` |
| `timeout-query` | T-2 | Client abandoned the query (pg driver) |
| `timeout-pool-acquire` | T-3 | Pool exhausted |
| `timeout-idle-transaction` | T-4 | Server killed an idle transaction |
| `timeout-operation` | T-5 | Application-level AbortController fired |
| `timeout-worker-cycle` | T-6 | Worker cycle deadline exceeded |
| `timeout-job-budget` | T-7 | Per-job budget exceeded |

**Vocabulary lock** — new codes require design review · matches the F14/F15 `require-cron-token` stable-code discipline.

### 5.2 · What throws vs what recovers

- **All timeouts THROW** at the point of enforcement. No timeout silently returns null.
- **Worker cycles catch the throw** via existing `try/catch` around the body · `failWorkerJob(store, job, err, 'tag')` fires (F35 path).
- **`failWorkerJob` records the failure to the DB** with `err.message` · currently truncated to 500 chars (per F35 spec). Timeout code becomes part of that message.

### 5.3 · Interaction with F35 `finalizeWorkerJob`

- If timeout fires BEFORE `finalizeWorkerJob` is called: worker throws · `failWorkerJob` runs · job goes to `failed` · retry buffer eventually re-dispatches.
- If timeout fires DURING `finalizeWorkerJob` (e.g., insertResult succeeded but completeJob times out): **F35 invariant may be at risk**. Design implication: `finalizeWorkerJob` itself should NOT be interrupted by cycle deadline. Proposed: the CYCLE signal fires cleanup on the WORK BODY only · finalize runs under an independent short deadline (30s hard cap · plenty of budget · below any T-4).
- **This requires a small extension to F35** — mark the finalize phase as "critical section, do not abort" via a scoped signal-override. Details in §14.

### 5.4 · Retry-buffer interaction

Wave 11 F9 shipped a bounded retry buffer (`retry-buffer.ts` · capacity 1000). Timeout events should:
1. Emit a `worker-timeout` signal (§7)
2. Rely on existing `failWorkerJob` → lease expires → job requeues (DB-side reclaim)
3. NOT double-enqueue via retry buffer · that path is for audit-emit failures only

### 5.5 · Atomicity distinction · database vs application vs external side-effect

**Precise language matters.** The F35 finalize sequence spans three different atomicity domains · each with different guarantees. Conflating them produces incorrect timeout design.

| Atomicity type | What it protects | Mechanism | Timeout interaction |
|---|---|---|---|
| **Database atomicity** | A single SQL statement OR a group of statements bracketed by `BEGIN … COMMIT` | Postgres transaction · ROLLBACK on any failure | If timeout fires inside a transaction, ROLLBACK runs cleanly · no partial write · adapter's `withBrainRole` catch handles this. **Fully safe.** |
| **Application-level idempotency** | A logical operation that MAY execute more than once safely | Explicit dedup key at the caller (e.g., `insertRecordIdempotent` uses `ON CONFLICT record_id DO NOTHING` · Wave 11 F12) | Retry after timeout is safe **only** for callers that have implemented idempotency. `store.enqueueJob` today has **no natural-key idempotency** · retry duplicates the child job. |
| **External side-effect idempotency** | A call to an external service that we cannot roll back | Idempotency key sent to the external API (e.g., Twilio's `Idempotency-Key` header · Stripe's `idempotency_key`) | Timeout can leave the external system in an INDETERMINATE state · retry can produce duplicate side-effect unless the external API honors the key. **This is why T-5b is deferred.** |

**Consequence for F35:**
- Steps 1 (insertResult) · 4 (insertAudit) · 5 (completeJob) live in the **database-atomicity** domain — protected by transactional wrappers OR by their own idempotency (`completeJob` is naturally idempotent · setting `status = "completed"` twice is a no-op).
- Step 2 (enqueueJob) lives in the **application-level-idempotency** domain — no natural key today · retry produces duplicate child job.
- Step 3 (hook · e.g., learning-context marks feedback applied) lives in the **application-level-idempotency** domain — depends on hook implementation.
- **None of the current F35 steps are external-side-effect** — they all write to `nex.*` tables. But future workers that call external APIs (send email · post to Slack) would introduce that domain and need dedicated design.

### 5.6 · F35 critical-section invariant (REQUIRED · not optional)

**Verified from source** (`_finalize.ts` full read · reported in `WORLD-CLASS-OPS-W-C-RUNTIME-VERIFICATION.md` F35 section) that the 5-step `finalizeWorkerJob` sequence has 4 interior interrupt points where partial state produces duplicate downstream work on retry:

- Step 1→2: safe (F12 idempotent insert covers) · but only if worker uses `insertRecordIdempotent`
- Step 2→3: **duplicate child job** (no natural key on `nex.worker_jobs` for child dedup today)
- Step 3→4: **duplicate hook side-effect** (application-level · depends on hook)
- Step 4→5: audit exists · retry duplicates (append-only audit is tolerable · child duplication is not)

**The invariant** (Philip 2026-08-11 · exact wording):

> **Once `finalizeWorkerJob` enters its critical finalization section, the worker deadline must not interrupt that section.**

**What this does NOT claim:**
- ❌ Does NOT claim the DB sequence itself is transactionally all-or-nothing (it isn't · each step is its own transaction · `insertAudit` and `insertRecordIdempotent` are separate write commits)
- ❌ Does NOT claim the sequence is atomic in the strict sense
- ❌ Does NOT eliminate the need for per-step application-level idempotency (child dedup remains a separate concern · see § 6.3)

**What this DOES claim:**
- ✅ The worker deadline (T-6) MUST NOT fire once Step 1 begins
- ✅ Finalize runs to completion (or fails on its own individual-step failure) regardless of ambient cycle time
- ✅ This eliminates one class of partial-state (timeout-induced) · leaving only step-level failure classes (which existing catch/retry handles)

**Implementation shape (design decision · not committed here):**

Two viable one-line mechanisms:

1. `if (cycleSignal?.aborted) throw new Error("timeout-worker-cycle-before-finalize");` at the very top of `finalizeWorkerJob` · rejects entry only, never during
2. Alternative: cycle signal is not passed as an argument to finalize · the worker wrapper simply does not pass it through the finalize call boundary

Both preserve F35 convergence (single `finalizeWorkerJob` call per worker · FZA1-FZA5 assertions unchanged). Selection deferred to implementation authorization.

---

## 6 · **DEEP DIVE — what happens to in-progress work when timeout fires** (per Philip's directive)

*"For NEX, the more important question is: What happens to the work that was in progress when we kill it?"*

This section examines each of the 5 questions Philip raised · one per subsection.

### 6.1 · DB operation times out → did the transaction roll back?

**Case A · T-1 statement timeout fires INSIDE `withTx` / `withBrainRole`:**
- Postgres returns error `57014 · query_canceled`
- pg driver throws
- Existing `withTx` catch block runs `await c.query("ROLLBACK")`
- Transaction aborts cleanly · **no partial write · no orphaned lock**
- Connection returns to pool

**Case B · T-4 idle-in-transaction fires:**
- Server closes the connection
- Pending transaction aborts server-side
- Client's next `.query()` fails with connection error
- Pool re-establishes connection
- **No partial write** but the code's expectation of a live transaction is violated · needs graceful handling in caller (retry from BEGIN)

**Case C · T-1 fires OUTSIDE an explicit transaction (autocommit):**
- The single statement is cancelled server-side
- Connection stays open · no rollback needed (nothing to roll back)
- Next query on that connection works normally

**Verdict for §6.1:** With F34 `withBrainRole` semantics (BEGIN…ROLLBACK-on-throw), DB timeouts are cleanly recoverable. **No new work needed here beyond honoring the pattern in the 6 non-brain-adapter files that also touch PG.**

**Risk:** If ANY code path uses PG without a transaction wrapper AND the timeout fires mid-multi-step logical operation (e.g., "check X then insert Y"), we could see partial writes. **Design action:** during implementation, audit the ~500 non-adapter query sites for multi-step patterns. Flag any that need transactional wrapping.

### 6.2 · LLM call times out → did we already receive/process a response?

**What happens on `AbortController.abort()`:**
- The underlying `fetch()` is aborted
- If response body was in-flight, the reader stops · we've received PARTIAL bytes but not a parseable JSON
- If the LLM provider was in the middle of streaming, the provider's server-side generation MAY continue and MAY complete (they don't know we cancelled)
- We are STILL BILLED for the tokens generated up to the point they realize we disconnected

**State implications:**
- **We paid but got nothing** — real cost
- **No local state was mutated** by the timeout (we hadn't received the response to mutate on)
- **Retry is safe idempotent-wise** — no local state to reconcile
- **Retry is expensive** — pay-again for the same tokens
- **The provider MAY have logged the request** — provider-side logs will show a successful request that we abandoned

**Design implications:**
1. **Timeout signal MUST record `provider_cost_hazard: true`** for operator awareness
2. **Retry policy for LLM timeouts should be more conservative than retry for network errors** — max 2 retries at increasing timeout, then human queue via existing llm-retry (Wave 11 F9)
3. **Timeout duration matters** — 30s abort when server needed 45s = wasted 30s of compute. Existing per-provider tuning helps · this cluster does NOT change LLM timeouts (per §1.4)

**Verdict for §6.2:** LLM timeouts are semantically safe but financially wasteful. **No new work in W-C beyond emitting signals with cost-hazard flag.** Not adding new LLM behavior · just observability.

### 6.3 · Worker times out → can retry safely?

**Failure modes when cycle deadline (T-6) fires mid-worker:**

Consider the standard worker chain: `claim → readItem → callLLM → insertRecord → enqueueChildJob → insertAudit → completeJob`.

If timeout fires between:
- **claim ↔ readItem**: safe. Nothing persisted. Job lease expires · someone re-claims.
- **readItem ↔ callLLM**: safe. Read is idempotent.
- **callLLM ↔ insertRecord**: safe if callLLM succeeded (we discard the result and retry) OR if callLLM was in-flight (see §6.2).
- **insertRecord ↔ enqueueChildJob**: **CRITICAL** — record is persisted but no child. Retry would `insertRecordIdempotent` (Wave 11 F12 fix · uses ON CONFLICT DO NOTHING) so no dup. Child would be enqueued on retry. **SAFE via idempotency.**
- **enqueueChildJob ↔ insertAudit**: **RISK** — child job exists. Audit missing. Retry would try to enqueue child again → potentially duplicate child. **NEEDS design decision.**
- **insertAudit ↔ completeJob**: **RISK** — audit exists · job status not updated to completed. Retry would fire the whole chain again → duplicate audit · duplicate child. **NEEDS design decision.**

**Proposed mitigation (must be validated in implementation):**

1. **Enforce that `finalizeWorkerJob` (F35) is treated as a critical section** — see §5.3. The cycle deadline aborts the WORK phase · finalize gets its own short deadline that never composes with cycle.
2. **Child job enqueue must be idempotent** — add a natural key on `nex.jobs` (e.g., `input_ref + worker_type + parent_job_id`) with `ON CONFLICT DO NOTHING`. **This is a schema-adjacent change** — must NOT be introduced here (Layer 2 boundary). Alternative: worker checks `SELECT 1 FROM nex.jobs WHERE input_ref=? AND worker_type=? LIMIT 1` before enqueue. Application-level idempotency.
3. **Audit inserts are already append-only** — duplicate audits are unpleasant but not corrupting. Accept minor duplication risk in exchange for guaranteed audit-eventually-lands.
4. **completeJob is naturally idempotent** — sets status to `completed` · setting it again is a no-op.

**Verdict for §6.3:** Retry safety requires:
- Making `finalizeWorkerJob` a critical section that outlives the cycle deadline (small F35 tweak · in-scope)
- Idempotent child job enqueue (application-level check · in-scope for W-C · no schema change)
- Accepting minor audit-log duplication risk (documented behavior)

### 6.3.1 · **EMPIRICAL EVIDENCE · stuck-claimed jobs verified in live dev workload** (added 2026-08-11)

The §6.3 discussion above framed the stuck-claimed pattern as a *risk that could fire*. Live PG verification found **it is actively firing in the dev workload.**

**Verified facts from live query against `nex.knowledge_dump_jobs` on 2026-08-11:**

| Status | Count | Oldest | Newest |
|---|---|---|---|
| completed | 23 | — | — |
| **claimed (STUCK)** | **10** | **52+ hours old** | 7 hours old |
| queued | 5 | — | — |
| failed | 1 | 28h old at terminal | — |

**Interpretation:**

- **~26% of a 39-job sample is stuck in `claimed`** for hours to days without transitioning
- Some workers claimed jobs · began processing · then died / crashed / hung mid-execution · `completeJob` (equivalent for this queue) never fired
- Lease-expiry re-claim is not implemented for `knowledge_dump_jobs`
- **This IS the F35 partial-state failure class in the wild** · not a hypothetical risk

**Impact on W-C priority:**

- The cluster's necessity is empirically confirmed · not just architecturally derived
- The F35 critical-section invariant (§ 5.6) has a real failure to prevent · not a theoretical one
- The three-atomicity distinction (§ 5.5) applies directly to the stuck-claimed pattern (application-level idempotency is the missing layer)

**Impact on W-C scope:**

- Does NOT change what W-C implements — timeout enforcement + F35 critical section
- Does highlight that timeouts alone don't solve `nex.knowledge_dump_jobs` stuck-claimed cases — those need EITHER lease-expiry re-claim OR their own timeout-aware supervisor. Belongs to production-readiness track (see § 15.1 W-C-PREREQ) · not W-C implementation
- Timeouts prevent NEW cases from accumulating going forward · they don't remediate the existing 10

**Design change (this amendment):** the risk in § 6.3 is upgraded from "could produce" to "verified to produce." No new implementation requirement · just factual reframing.

### 6.3.2 · Observability blind-spot · empirical elevation (Amendment C · added 2026-08-11)

Beyond the stuck-claim pattern itself, the forensic investigation surfaced a distinct finding worth elevating in its own right:

**Every observability table in the Postgres shadow was EMPTY for the 10 stuck jobs:**

| Source | Rows referencing any of the 10 job_ids |
|---|---|
| `nex.events` | 0 (table had 2 rows total · both unrelated `storage.roundtrip.verify`) |
| `nex.audit_log` | 0 (table empty) |
| `nex.worker_audit_events` | 0 (table empty) |
| `nex.worker_heartbeats` | 0 (table empty) |
| `nex.recovery_attempts` | 0 (table empty) |

**Interpretation:**

- The Brain observability layer captured NOTHING about the lifecycle of these 10 jobs beyond the fs-store JSONL snapshots
- This is not "the trail is incomplete" — it is "there IS no trail" in the DB observability layer
- The 10 stuck jobs pre-date Wave 11 GROUP B remediation being active in this environment · so this is the "before" state · not the "current" state

**What changed after Wave 11 GROUP B (shipped in commit `6b3458d`) + W-OBS-1 Path A Layer 1 (shipped in `08a116a`):**

- Every worker signal now flows via `emitSignal` and lands in `nex.events.payload` with a correlation ID
- Every worker cycle establishes an ALS scope via `enterJobCorrelationScope(job)` — signals inherit the CID automatically
- `failWorkerJob` writes to `nex.worker_jobs.last_error` — traceable back to the job's originating context

**Consequence:** any NEW stuck-claimed occurrence going forward should have a much stronger forensic trail than these 10 · because:

- The signal → audit chain now records worker start · progress · failure with CID
- Correlation IDs let operators join across `nex.events` · `nex.worker_jobs` · `nex.knowledge_dump_jobs` (via payload lookup)
- The observability substrate that would have made these 10 diagnosable is now in place for the next occurrence

**This does not remediate the 10 existing stuck jobs · but it means their pattern won't recur in the dark.** Future stuck-claimed cases will be forensically visible.

**Design implication:** W-C-COMPANION supervisor design should assume this observability layer exists · does NOT need to rebuild it · can rely on `nex.events` for cross-referencing worker failure to KnowledgeJob claim state.

### 6.4 · Child job created → parent times out → who owns the child?

**Current state (post W-OBS-1 Layer 1):**
- Child job inherits parent's CID via `_finalize.ts::finalizeWorkerJob` → `input_payload.correlation_id`
- Child is a fully-formed WorkerJob in `nex.worker_jobs` · status `waiting`
- Downstream worker will claim it independently

**Timeout scenario:**
- Parent enqueues child successfully
- Parent then times out before writing final audit or completeJob
- Child is in the queue · parent is marked `failed` (via failWorkerJob)
- Child gets processed normally by whichever worker claims it
- **Result: child work happens · parent is recorded as failed**

**Semantic question:** does the child represent commitment that the parent SHOULD complete? Or is it fire-and-forget?

Looking at the actual chain (`knowledge-context` → `voice-context` → `learning-context` → `knowledge-extractor`):
- Each stage does DIFFERENT work · each is meaningful on its own
- A `knowledge-context` that ran and enqueued `voice-context` did useful work · even if it later times out during audit
- The `voice-context` job doesn't need `knowledge-context`'s status to run · it only needs `input_payload`

**Verdict:** Children are **commitments · not undoable**. Parent's timeout does NOT retract the child. This is the correct semantic and matches existing behavior. **No design change needed for parent-child relationship.**

**Risk to document:** if a parent times out AFTER partial-enqueueing (e.g., meant to enqueue 3 children · timeout hits after 2), the third child never happens. **Mitigation:** enqueue all children before doing anything else · or wrap child-enqueue in an idempotent-set operation so retry can catch up. Detail belongs to per-worker implementation.

### 6.5 · External API times out → did the external system actually complete the operation?

**The classic distributed-systems ambiguity.** For NEX today:

**Read-oriented external calls (safe on timeout · retry idempotent):**
- LLM providers (Groq · Nemotron · Mistral · Anthropic · Gemini) — see §6.2
- Vision APIs
- Webhook FETCHES (rare)

**Mutation-oriented external calls (unsafe on timeout · retry may double-effect):**
- **Alert webhooks** (`alerts/dispatch.ts`) — currently uses 8s timeout · if external system took 9s and completed, we don't know · retry would trigger the alert twice
- **Delivery engine send** (email · SMS · social posts) — outside Brain but part of HQ · double-send is bad
- **External APIs from imports/backfill** — depends on the specific API

**Design implications:**
- **NEW requirement:** every mutation-oriented external call MUST accept an idempotency key (typically UUID) that the external system honors OR that we track ourselves for de-dup
- **For alerts:** the existing dispatch already writes an `alert_dispatch` audit row · dedup can check that row before retry
- **For deliveries:** the delivery engine already has per-provider idempotency (F5 · F35 finalize chain)

**Verdict for §6.5:** Read-oriented calls (dominant in Brain) are safe. Mutation-oriented calls (alerts · delivery) need caller-side idempotency. **This is an EXISTING concern · not created by timeouts · but timeouts amplify it. Document as a known consideration · do not attempt to solve mutation-idempotency in this cluster.**

---

## 7 · Signal shape (W-OBS-1 CID inheritance)

New `SignalKind` values (extend `src/lib/nex/observability/signals.ts` enum):

```
| "timeout-statement"
| "timeout-query"
| "timeout-pool-acquire"
| "timeout-idle-transaction"
| "timeout-operation"
| "timeout-worker-cycle"
| "timeout-job-budget"
```

Signal payload structure (spec):

```
emitSignal({
  subsystem: "brain" | "storage" | "inbox" | "jobs" | ...,
  kind: "timeout-<class>",
  code: "<call-site-tag>",           // e.g. "brain.adapter.insertRecord"
  correlation_id: undefined,         // auto-populated from ALS via Layer 1
  detail: JSON.stringify({
    class: "T-1" | "T-6" | ...,
    budget_ms: 30000,
    elapsed_ms: 30124,
    at_step: "insertRecord",         // where in the chain
    provider_cost_hazard: true,      // for LLM timeouts only
  }),
});
```

**CID inheritance from W-OBS-1 Layer 1 is automatic** — signals inside the ALS scope (established by `enterJobCorrelationScope(job)` in each worker) inherit CID via the `sig.correlation_id ?? getCorrelationId()` shipped in commit `08a116a`.

---

## 8 · Nested / child job interaction

Per §4.2, signals compose via `AbortSignal.any([...])`. First-to-fire wins.

**Cycle-deadline vs job-budget precedence:**
- Cycle deadline is OUTERMOST (worker's total time)
- Job budget is INNER (per-job wrapper · optional · not all workers use per-job)
- Cycle typically 15m · Job typically 5m · so job budget usually fires first for pathological work
- If a worker processes MULTIPLE jobs per cycle (currently workers don't · they claim one · but might in future), each job gets a fresh 5m from a shared 15m cycle budget

**Child-job enqueue:**
- Child job's CID = parent's CID (already shipped in W-OBS-1 Layer 1)
- Child job gets a FRESH cycle deadline when its own worker claims it (not inherited from parent's remaining budget)
- Rationale: parent's timeout was about parent's work · not about ambient budget for entire logical operation. Each worker gets its own budget.

**Design decision to lock:** child jobs do NOT inherit parent's remaining deadline. Each cycle stands alone.

---

## 9 · Precedence when caller already has own timeout

**Rule:** the tighter of the two wins. Compose via `AbortSignal.any([caller_signal, cycle_signal])`.

Concrete cases:
- **LLM caller passes `timeout_ms: 60000`** but cycle has 2 minutes left → fetch runs under `any([60s signal, 2m cycle signal])` → 60s wins (tighter)
- **LLM caller passes `timeout_ms: 300000` (5 min)** but cycle has 1 minute left → 1m cycle wins
- **LLM caller passes no timeout** → default 30-60s per provider · composed with cycle

**Consequence:** existing LLM callers do not need to be changed. Their explicit timeouts remain effective. Cycle deadline is an ADDITIONAL upper bound.

**Preserving existing behavior:** because every current LLM timeout is ≤ 60s and cycle deadline is 15m, the composition changes NOTHING for normal-path LLM calls. Only pathological (>15m worker) sees the cycle abort.

---

## 10 · Test contracts (T1-T30 · design only)

### 10.1 · DB-side timeout contracts

- **T1** · `statement_timeout` set on connection · slow query aborts at 30s ± 500ms · error code `57014`
- **T2** · `statement_timeout` cancels inside `withTx` · ROLLBACK fires · no partial write · state unchanged from BEGIN
- **T3** · `idle_in_transaction_session_timeout` kills connection after 60s idle · pool re-establishes · next query works
- **T4** · `connectionTimeoutMillis` fires when pool is exhausted · caller throws with `timeout-pool-acquire` code
- **T5** · Backfill scripts can OVERRIDE `statement_timeout` per-connection via `SET SESSION` · doesn't affect other pool connections

### 10.2 · Worker deadline contracts

- **T6** · Worker cycle wrapper establishes deadline · `getWorkerDeadline()` returns signal with correct remaining time
- **T7** · Slow worker (mock 20-minute LLM chain) aborts at cycle deadline · throws `timeout-worker-cycle` · `failWorkerJob` fires
- **T8** · `finalizeWorkerJob` runs even if cycle deadline expired mid-work (critical section semantics)
- **T9** · Timeout during body → `failWorkerJob` → lease expires → job requeues → next worker retries (integration test)
- **T10** · Per-job budget can be overridden by worker type (e.g., image-analyst can have 10m instead of 5m)

### 10.3 · Signal contracts

- **T11** · Timeout signal carries CID from W-OBS-1 ALS scope (integration with existing CID contracts)
- **T12** · Timeout signal `detail` payload includes: class · budget_ms · elapsed_ms · at_step
- **T13** · LLM timeout signal includes `provider_cost_hazard: true` flag
- **T14** · `SignalKind` enum extension is backward-compatible · old callers still work

### 10.4 · Nested composition contracts

- **T15** · `AbortSignal.any([inner, outer])` fires on inner when inner is tighter
- **T16** · `AbortSignal.any([inner, outer])` fires on outer when outer becomes tighter mid-flight
- **T17** · Child job's own worker gets fresh cycle deadline (NOT inherited)
- **T18** · Parent's timeout does NOT retract child jobs already in `nex.worker_jobs`

### 10.5 · Config contracts

- **T19** · Missing env var → default value from config module
- **T20** · Invalid env var (non-numeric or negative) → throws at startup · never uses malformed value
- **T21** · Env var value is capped at reasonable maximum (e.g., cycle deadline ≤ 1h · prevents 24h workers)

### 10.6 · Safety contracts

- **T22** · Timeout error propagates through `withBrainRole` catch · never swallowed
- **T23** · Timeout inside `finalizeWorkerJob` critical section does NOT abort finalize · continues to `completeJob`
- **T24** · Retry buffer NOT double-enqueued on timeout (F9 discipline preserved)
- **T25** · Child job idempotency check prevents duplicate child on retry

### 10.7 · Drift-catchers (CATO1-CATO6)

- **CATO1** · Every HQ pool constructor sets `statement_timeout` OR is on documented exception list (backfill scripts · see CATO6)
- **CATO2** · Every worker's `runXxx` entry function is wrapped in the cycle-deadline helper
- **CATO3** · `SignalKind` enum contains all timeout codes (T-1 · T-2 · T-3 · T-4 · T-5a · T-6 · T-7 — T-5b codes reserved but not emitted in Phase 1)
- **CATO4** · `getWorkerDeadline` defined exactly once in `src/lib/nex/observability/**` (mirrors CADP2/CADP3 uniqueness pattern from W-OBS-1)
- **CATO5** · No file outside `src/lib/nex/config/timeouts.ts` reads `NEX_*_TIMEOUT_MS` env vars via `process.env` direct read (mirrors AI7 + CFGA2 patterns)
- **CATO6** · Backfill scripts (`scripts/**backfill*.mjs` · `scripts/apply-*.mjs` · `scripts/bootstrap-*.mjs` · `scripts/parity-report.mjs` · `scripts/brain-parity-report.mjs`) do NOT import from `src/lib/nex/config/timeouts.ts` · they use their own bespoke pool config with unbounded `statement_timeout`. Explicit exception list per grep-assertion so a future edit accidentally sharing config fails CI. Setting `statement_timeout = 30s` for a DDL apply that legitimately takes minutes = deploy failure. Runtime-verification report §12.5 confirmed 7 scripts affected (0 timeout mentions across 27 queries) · every one needs to stay out.

---

## 11 · Drift-catchers (see 10.7)

Same discipline as F12 AI1-AI8 and W-OBS-1 CADP1-CADP5. Enforce architectural invariants automatically. Adopted routes stay adopted · new pool constructors get statement_timeout · no shortcut env-var reads.

---

## 12 · Runtime verification requirements (BEFORE implementation)

**Verification pass authored 2026-08-11** — see `WORLD-CLASS-OPS-W-C-RUNTIME-VERIFICATION.md`. Item status:

1. **PG server supports `statement_timeout` and `idle_in_transaction_session_timeout`** — SOURCE-VERIFIED (mechanism valid · both standard Postgres 9+ features · pg driver honors) · **live `SHOW` PENDING** (5433 was down in verification pass).
2. **P99 query duration by table** — **UNAVAILABLE · live-PG required** — source proxy assessment of query complexity in verification report §12.2 · not a substitute for measurement.
3. **P99 worker cycle duration by worker type** — **UNAVAILABLE · live-PG required** — lease values (30-90s) suggest 15m/5m headroom is adequate but this is inference, not measurement.
4. **Pool acquire latency** — **UNAVAILABLE · live-app-log required** — no existing instrumentation.
5. ~~Backfill script query patterns~~ **✅ VERIFIED** — 7 scripts audited · ZERO timeout defenses today · 27 queries at risk if shared config leaks. Drove design change CATO6 (backfill isolation).
6. ~~Existing timeout coverage audit~~ **✅ VERIFIED** — 36 fetch sites classified · LLM layer fully covered · 11 mutation-oriented sites (delivery · notifications · push) UNCOVERED · drove T-5 split into T-5a (safe) and T-5b (deferred).
7. ~~Verify `AbortSignal.any` is available~~ **✅ VERIFIED** — Node 24.18.0 supports both `AbortSignal.any` and `AbortSignal.timeout`. `package.json` `engines` field NOT SET — drove implementation-task addition (pin to `>=20.3.0` subject to deployment matrix verification).

**Items 5-7 CLOSED via source verification. Items 1-4 REMAIN OPEN pending live-PG environment.**

**None of the 7 items required implementation. All were read-only verification. Additional F35 boundary verification (not originally in §12) also completed and drove the § 5.6 critical-section invariant.**

### 12.8 · Forensic trail state · before vs after (Amendment D · added 2026-08-11)

The stuck-claimed investigation established the observability baseline in two epochs:

**Before commit `6b3458d` (Wave 11 GROUP B) + `08a116a` (W-OBS-1 Path A Layer 1):**
- 10 stuck-claimed KnowledgeJobs · zero forensic trail (§ 6.3.2 evidence)
- Diagnosability limited to fs-store JSONL snapshots · no correlation IDs · no signal events · no worker heartbeats
- Cross-store trace (KnowledgeJob → WorkerJob → outcome) impossible from local dev env

**After those commits (current baseline):**
- Correlation ID established at HTTP edge · propagated through inbox → worker → child worker → signals + audit
- `emitSignal` writes CID-tagged events to `nex.events.payload` (via existing JSONB pattern · no schema change)
- Worker heartbeats + audit events populated as workers run
- Cross-store trace possible via CID predicate on `nex.events`

**For W-C implementation:** the design's signal emissions (§ 7 · new SignalKind values `timeout-*`) will land into the post-Wave-11 substrate. Timeout events for future workers will be immediately queryable by CID. **No new observability infrastructure is required by W-C** — it inherits what Wave 11 + W-OBS-1 shipped.

**For W-C-COMPANION (supervisor):** the observability layer is a hard requirement for the supervisor to distinguish "WorkerJob genuinely never ran" from "WorkerJob ran and completed against Supabase we can't see." Post-Wave-11 · this distinction is at least visible in `nex.events` when workers run in this environment. Supervisor design (§ 15.2) should explicitly consume `nex.events` for its reconciliation logic.

**For long-term operations:** the post-Wave-11 baseline means every NEW stuck-claimed pattern arrives with a forensic trail attached. The 10 pre-existing stuck jobs stand as a "before" corpus · not a recurring failure class.

---

## 13 · Rollback + failure-safety

### 13.1 · What can break?

- **False positives:** a legitimately slow-but-completing query is aborted at 30s → statement fails → transaction rolls back → data operation lost until retry. **Mitigation:** T-1 tuning based on P99 measurement (§12.2). If any query legitimately needs longer, either optimize or override per-caller.
- **Cascading failures:** timeout on connection A means retry on connection B · but if all connections are slow, we exhaust the pool. **Mitigation:** `connectionTimeoutMillis` gives fast-fail · exponential backoff at caller · circuit-breaker patterns (already present for LLM).
- **Regression in existing timeout paths:** LLM timeouts already exist · adding cycle-deadline could double-fire. **Mitigation:** `AbortSignal.any` composition guarantees only the first-to-fire propagates · existing behavior preserved.

### 13.2 · Rollback strategy

Every change is env-var gated:
- `NEX_PG_STATEMENT_TIMEOUT_MS` — omit or set to `0` to disable T-1
- `NEX_WORKER_CYCLE_DEADLINE_MS` — set to `0` to disable T-6
- (etc for each new env var)

**Config-based rollback**: unset the env vars · timeouts revert to previous unbounded behavior. Requires a Vercel/Fly restart to take effect but no code deploy.

**Code rollback (worst case):** revert the two commits (implementation + tests). Backward-compatible additions · no schema change · reverts trivially.

### 13.3 · Failure-safety principles

1. **Every timeout THROWS** — never silently masks a stuck operation as success
2. **Every timeout EMITS a signal** with CID for forensics
3. **Every timeout PRESERVES transaction integrity** via existing ROLLBACK path
4. **Every timeout is DOCUMENTED** in the retry-buffer or worker-jobs record so operators can find them
5. **No timeout INVENTS new "success" state** (matches Wave 11 F5 rule that operators must be able to distinguish "healthy but idle" from "read failed")

---

## 14 · Mapping against F12 · Step 11 · W-OBS-1 · F35 · NEX Storage

| Boundary | Impact of W-C | Verified? |
|---|---|---|
| **F12 AI1** — `brainStore()` defined once in storage.ts | ✅ untouched — pool config changes live inside adapter constructors, not selector |
| **F12 AI2** — adapters export pure classes · no selector logic | ✅ untouched — new pool config is inside adapter class init, not a factory |
| **F12 AI3** — storage.ts imports no provider SDK | ✅ untouched |
| **F12 AI4** — brain adapters don't import from `src/lib/nex/storage/*` | ✅ untouched — timeout module lives under `src/lib/nex/config/` (Step 11 sibling) OR `src/lib/nex/observability/` (W-OBS-1 sibling) · not under storage/ |
| **F12 AI5** — exactly one dual-write decorator | ✅ untouched |
| **F12 AI6** — provider SDK imports confined to adapters | ✅ untouched · timeouts don't need SDK access |
| **F12 AI7** — `NEX_BRAIN_BACKEND` read only in storage.ts | ✅ untouched · new env vars are TIMEOUT-scoped, read only in a new config module |
| **F12 AI8** — `NEX_STORAGE_BACKEND` read only in NEX Storage registry | ✅ untouched |
| **Step 11 config pattern** (CFG helpers) | ✅ **REUSED** — new timeout config module follows same shape: canonical reader · strict + nullable variants · drift-catcher on env-var reads |
| **Step 11 feature gates** (F29 `getFeatureGates`) | ✅ EXTENDED — add 5 new gates for timeout values. Snapshot API grows. |
| **W-OBS-1 CID substrate** (Layer 1) | ✅ **REUSED** — timeout signals emit via existing `emitSignal` · CID inherited automatically from ALS. **No new plumbing.** |
| **W-OBS-1 ALS module** (`correlation.ts`) | ✅ EXTENDED — add `getWorkerDeadline(): AbortSignal \| null` companion to `getCorrelationId()`. Same ALS pattern · same module · single responsibility. |
| **F35 finalize path** (`_finalize.ts`) | ✅ **REQUIRED · one-line change** (was "small extension" pre-verification). Invariant (§ 5.6): *"Once `finalizeWorkerJob` enters its critical finalization section, the worker deadline must not interrupt that section."* Verified from source that Steps 1-5 have 4 interior partial-state interrupt points · without this invariant, timeout during finalize produces duplicate downstream work (child job · hook side-effect). Two viable mechanisms · selection deferred to implementation. F35 convergence discipline (FZA1-FZA5) preserved. |
| **NEX Storage adapter API** | ✅ untouched — timeouts wrap around adapter calls · never change the adapter interface |
| **NEX Storage doctrine (typed columns + JSONB payload)** | ✅ untouched — no schema changes at all |
| **Layer 2 (`nex.knowledge_dump_jobs.correlation_id` column · `nex.events.correlation_id` column)** | ✅ NOT crossed — timeouts don't need durable CID storage · they emit signals to `nex.events.payload` via existing pattern |
| **F12.b** (audit-log.ts + warehouse.ts direct SDK imports) | ✅ independent — timeout config is separate from SDK isolation work |
| **RLS remediation (W-SEC-1)** | ✅ independent — timeout tables live in `nex.*` schema which has full RLS coverage already (verified in P0 verification report) |

---

## 15 · Duplicate-work · partial-write · corrupted-state · incorrect-retry risks

Consolidated from §6:

| Risk | Where it could fire | Mitigation in this design |
|---|---|---|
| **Duplicate work** — retry after timeout re-runs an already-complete operation | Worker times out AFTER insertResult but BEFORE completeJob | F35 critical-section extension (§14) · `insertRecordIdempotent` already handles record dedup |
| **Duplicate child job** — parent times out AFTER enqueueing child · retry re-enqueues | knowledge-context → voice-context chain · manager.ts dispatch loop | Application-level check `SELECT 1 FROM nex.worker_jobs WHERE input_ref=? AND worker_type=? LIMIT 1` before enqueue |
| **Partial write** — timeout mid-transaction leaves DB in partial state | Any multi-statement operation NOT wrapped in `withBrainRole` | Audit the ~500 non-adapter query sites for multi-step patterns · flag for transaction wrapping |
| **Corrupted state** — timeout leaves connection in indeterminate state | T-4 idle-in-transaction fires · pool re-uses closed connection | pg driver already handles closed-connection detection · pool re-establishes. Verified during runtime verification (§12.1) |
| **Incorrect retry** — retry policy sees timeout as "failure" and retries LLM call · costs double | LLM timeout in a worker · worker fails · lease expires · re-claim retries LLM | LLM has its own retry budget in `llm-retry.ts` (Wave 11 F9) · rely on that · do NOT add new retry logic in this cluster |
| **Cost hazard on LLM timeout** — LLM provider billed us for tokens we never received | Any LLM call that times out | Signal `provider_cost_hazard: true` for operator awareness · no automated action |
| **External mutation ambiguity** — external API MAY have completed before we timed out | Alert webhook · delivery send · rare in Brain | Document as known risk · caller-side idempotency (existing pattern) · not solved by this cluster |
| **Cascading pool exhaustion** — one slow query holds a connection · all others block | Under load · with many workers | T-3 connectionTimeoutMillis + T-4 idle-tx timeout · fast-fail rather than pile up |

---

## 15.1 · W-C-PREREQ · Instrumentation gap surfaced by live verification

**Not part of W-C implementation. Tracked here for coherent handoff to whichever workstream picks it up.**

Live verification found that `nex.knowledge_dump_jobs` uses `created_at + updated_at` only · no dedicated `claimed_at` or `completed_at` timing columns. That means cycle-duration measurement in that queue is contaminated by queue-wait time · cannot cleanly isolate execution time.

`nex.worker_jobs` DOES have the right shape (`assigned_at + completed_at + lease_expires_at`) but is empty on dev. When it has data, per-worker-type P99 becomes measurable there.

**Before authorizing any schema change to `nex.knowledge_dump_jobs`:**
1. First determine whether existing signals · `nex.events` audit trail · OR `updated_at` transitions can reconstruct enough of the job lifecycle to diagnose the 10 stuck-claimed cases
2. If yes · no schema change needed · job model is fine as-is · dev observation is only about missing execution data
3. If no · schema change is a separate authorization with its own design pass

**Do NOT casually fold column additions into W-C. It's a separate concern.**

## 15.2 · W-C-COMPANION · KnowledgeJob supervisor / recovery architecture (Amendment B · added 2026-08-11 · SEPARATE cluster)

**Not part of W-C implementation. Tracked here as its own cluster identifier for the eventual design pass.**

Empirical evidence (§ 6.3.1 · `WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md`) shows `nex.knowledge_dump_jobs` has no lease-expiry / supervisor mechanism. Once a job is claimed and the downstream WorkerJob chain fails to reach the extractor (sole writer of terminal status), the job is orphaned in `claimed` forever with no automated recovery.

### 15.2.1 · The recovery gap in one sentence

*Because knowledge-extractor is the sole writer of `completed`/`failed` to `nex.knowledge_dump_jobs`, and there is no supervisor to un-stick jobs whose extractor never ran, any silent WorkerJob-chain failure produces a permanent orphan.*

### 15.2.2 · Three candidate architectural shapes

Not choosing here. Design decision when W-C-COMPANION is authorized. Each candidate must explicitly identify which of the three atomicity domains (§ 5.5) it relies on for protection.

**Candidate 1 · Application-level sweep**

- Periodic cron job: `SELECT * FROM nex.knowledge_dump_jobs WHERE status='claimed' AND updated_at < now() - interval 'N minutes' AND progress = 0`
- For each stale row: re-queue OR mark failed with a documented reason
- **No schema change.** Sweeps existing state · reads existing columns
- **Atomicity domain: application-level idempotency.** The sweep must reset status idempotently AND must reason about "did the WorkerJob complete but write to a store we can't see?" — false-positive risk
- **Trade-off:** simple · low risk · but the "re-queue vs mark-failed" decision is heuristic

**Candidate 2 · Schema-level lease**

- Add `lease_expires_at` + `claimed_at` + `assigned_worker_id` columns to `nex.knowledge_dump_jobs` (mirrors `nex.worker_jobs`)
- Claim sets a lease · sweep reclaims expired leases · atomic UPDATE ... WHERE lease_expired
- **Schema change · SEPARATE authorization required** (Layer-2-adjacent · matches the W-OBS-1 Layer 2 discipline)
- **Atomicity domain: database atomicity.** The reclaim is a single UPDATE with WHERE clause · strong guarantee
- **Trade-off:** most robust · but requires migration + backfill + updates to `claimJobIfQueued` semantics + updates to all readers

**Candidate 3 · Reverse-cascade from WorkerJob outcome**

- When `failWorkerJob` fires on a WorkerJob · look up the linked KnowledgeJob via `input_payload.knowledge_job_id` · propagate failure back
- Requires the WorkerJob chain to REACH `failJob` (which our forensic evidence shows doesn't always happen — some workers just vanish)
- **Atomicity domain: application-level idempotency + external side-effect awareness** (WorkerJob may have completed against a different store than KnowledgeJob's shadow · reconciliation logic must be idempotent)
- **Trade-off:** elegant when it works · unreliable when workers silently die without invoking failJob

### 15.2.3 · The design question that gates the choice

**"What mechanism can recover a KnowledgeJob without creating duplicate extraction work?"**

Each candidate must explicitly answer:

- If we un-stick an orphaned KnowledgeJob · and it turns out the extractor DID run against a Supabase-backed store · will re-processing cause duplicate LLM costs / duplicate downstream memory-writes?
- Does the answer rely on DB transaction (candidate 2 has this) · application idempotency (`insertRecordIdempotent` from F12 handles record dedup · but child-job dedup is NOT covered per § 6.3) · or external idempotency (LLM providers don't offer this natively)?

The three-domain rule (§ 5.5) makes this question first-class. Any candidate that can't answer it precisely is under-designed.

### 15.2.4 · Interaction with W-C

- W-C ships FIRST (prevents new hangs · adds signal trail · protects finalize critical section)
- W-C-COMPANION ships LATER (recovers orphaned KnowledgeJobs · closes the remaining stuck-claimed gap)
- Both together = full stuck-claimed remediation
- W-C alone = new cases prevented · existing cases still orphaned (until W-C-COMPANION or manual intervention)

### 15.2.5 · The existing 10 stuck jobs

**PRESERVED as forensic evidence.** Per Philip 2026-08-11 · "They're now valuable forensic evidence. We've deliberately preserved them, and the investigation has given us something we didn't have before: a real-world example of the failure mode we're designing against. That's gold for the eventual contract tests."

**Do NOT un-stick the 10 during W-C or W-C-COMPANION implementation.** They become the fixture for a contract test that verifies the supervisor actually reclaims stale-claimed rows. After the supervisor is proven against them (as a contract-test target), un-sticking them is a deliberate operational action · not part of implementation.

## 16 · Unresolved architectural questions

Design decisions requiring separate authorization before implementation:

1. ~~**Should T-6 cycle deadline abort `finalizeWorkerJob`?**~~ **RESOLVED 2026-08-11** — runtime verification confirmed 4 interior partial-state interrupt points in F35's 5-step sequence. Philip 2026-08-11 approved principle: *"Once `finalizeWorkerJob` enters its critical finalization section, the worker deadline must not interrupt that section."* See § 5.6. Selection between the two implementation mechanisms remains deferred to implementation authorization.
2. **How to enforce T-1 `statement_timeout` across the 12+ pool constructors?** Two options:
   - a. Modify every pool constructor (~12 files · touches Trade Centre code which is out of Wave 11 scope)
   - b. Introduce a shared `makePool(url)` helper that every subsystem uses · migrate one at a time · start with HQ-only (Brain adapter · storage adapter · db.ts)
   - Recommendation: (b) HQ-scoped-only · Trade Centre pools remain untouched · adds to F28 pattern (config centralization)
3. **Env-var naming pattern** — currently proposed `NEX_PG_STATEMENT_TIMEOUT_MS`. Consistent with existing `NEX_POSTGRES_URL`. Confirm the naming convention.
4. **Should backfill scripts get a global higher timeout, or per-script override?** Per-script is safer (matches least-privilege) but requires each script to explicitly SET SESSION. Global higher-timeout is easier but leaks bad-query risk.
5. **Should image-analyst have a special T-7 job budget (10m instead of 5m)?** Runtime verification will inform this. Decide after §12.3 measurement.
6. **Do we need a per-worker-TYPE cycle deadline OR is 15m enough universally?** Same as #5 · measurement-driven.
7. **How do timeout signals interact with the reverse-shadow (F3) safety net?** If pg-to-supabase-shadow.ts's mirror() fires a shadow write during a timing-out worker, does the mirror get cancelled? Design implication: mirror writes should honor the same signal · or explicitly exempt themselves as fire-and-forget (existing pattern).
8. **AsyncLocalStorage in edge runtime** — worker code runs in Node runtime · not an issue. But if any future timeout config runs in edge middleware, `getWorkerDeadline()` would fail. Document as Node-only.

---

## 17 · Recommendation for next authorized step

**Design phase complete.** Not authorized to proceed.

**Recommended next authorization** (if user chooses to advance):

**Step 1 · Runtime verification** (evidence-only · no implementation)
- Run the 7 verification items from §12
- Report P99 measurements, backfill patterns, connection latency, PG server support
- Document any workload-driven adjustments to proposed values in §3
- **New doc:** `WORLD-CLASS-OPS-W-C-RUNTIME-VERIFICATION.md`

**Step 1a · Enable `pg_stat_statements` for evidence gathering** (added 2026-08-11 after live-PG verification)
- Live verification found `pg_stat_statements` NOT installed · `shared_preload_libraries` empty on dev
- Enabling requires: edit `postgresql.conf` to add `pg_stat_statements` to `shared_preload_libraries` · restart PG · `CREATE EXTENSION pg_stat_statements` · **all outside the working tree · deployment/config change**
- **This is a SEPARATE authorization** — configuration change to a running PG instance is not a W-C implementation task · deliberate infrastructure decision
- After enable + 24h+ of representative workload · resample P99 to resolve T-1
- Until this happens · T-1 = 30s stays as informed proposal · not evidence-approved

**Step 1b · Investigate stuck-claimed-job pattern separately** (added 2026-08-11 after live-PG verification)
- Live verification found 10 of 39 dev `nex.knowledge_dump_jobs` stuck in `claimed` status for up to 52+ hours
- This is empirical evidence of the F35 partial-state failure class · not hypothetical
- **BEFORE assuming `claimed_at`/`completed_at` columns are needed:** first determine whether existing job state · `nex.events` audit trail · OR `updated_at` transitions can reconstruct enough of the lifecycle to diagnose why 10 jobs stuck
- If lifecycle can be reconstructed from existing data · no schema change needed
- If not · then a `claimed_at + completed_at` addition is a separate schema authorization · not folded into W-C
- **Investigation belongs to production-readiness track · not W-C implementation**

**Step 2 · Implementation** (only after Step 1 evidence approved · Steps 1a and 1b at minimum surfaced with findings)
- **Pin `package.json` `engines`** to a value that guarantees `AbortSignal.any` availability. Currently proposed `>=20.3.0` · subject to verification against the actual deployment matrix (Vercel Functions runtime default · Fly `deploy/nex-brain-worker/Dockerfile` Node install). If the deployment matrix requires a higher floor, the pin follows.
- Author `src/lib/nex/config/timeouts.ts` (matches Step 11 pattern)
- Extend `src/lib/nex/observability/correlation.ts` with `getWorkerDeadline()`
- Add `AbortSignal.any` wrapper helper
- Modify HQ pool constructors (Brain adapter · storage adapter · db.ts · shared makePool helper) — **backfill scripts EXCLUDED per CATO6**
- Extend F35 `_finalize.ts` with the critical-section invariant (§ 5.6 · REQUIRED · one-line change · design decision on mechanism deferred to implementation)
- Extend `SignalKind` enum with T-1, T-2, T-3, T-4, T-5a, T-6, T-7 codes (T-5b codes reserved but not emitted in Phase 1)
- Add contract tests T1-T25
- Add drift-catchers CATO1-CATO6
- Update `.env.example` with 5 new gates
- Update `getFeatureGates` to include timeout gates
- **T-5b deferred** · not added in Phase 1 · per-adapter idempotency design authorized separately

**Step 3 · Regression + gate verification** (same 8-gate discipline as Layer 1)

**Step 4 · Review checkpoint · commit + push authorization**

---

## 18 · Boundaries preserved by this design phase

| | Status |
|---|---|
| Implementation | ❌ none |
| Middleware | ❌ untouched |
| Workers | ❌ untouched |
| Storage | ❌ untouched |
| Migrations | ❌ none |
| Schema change | ❌ none |
| Config change | ❌ none |
| Commit | ❌ none |
| Push | ❌ none |
| F12 (READY · d9df9ed) | Untouched · AI1-AI8 mapping done in §14 |
| Step 11 (READY · e8444a0) | Untouched · pattern reused per §14 |
| W-OBS-1 Layer 1 (READY · 08a116a) | Untouched · CID substrate reused for timeout signals |
| Wave 11 residual (6b3458d) | Untouched · F35 amendment proposed only |
| Layer 2 (correlation column · Job column) | NOT crossed |
| F12.b (audit-log + warehouse SDK) | Independent |
| Supabase-legacy RLS (W-SEC-1) | Independent |
| NEX Storage doctrine | ✅ Preserved — no schema · no adapter API change · no Supabase-specific pattern introduced |

---

## 19 · Design document review checkpoint

**Design document path:** `docs/headquarters-production-readiness/WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md`

**Proposed timeout classes (5 new gates):**
- T-1 · `statement_timeout` = 30s
- T-3 · `connectionTimeoutMillis` = 10s
- T-4 · `idle_in_transaction_session_timeout` = 60s
- T-6 · Worker cycle deadline = 15m
- T-7 · Per-job budget = 5m (overridable per worker)
- Plus operation-level T-5 for uncovered fetch sites at implementation time

**External-call coverage:**
- 545 PG query sites (top 10 files enumerated · pool-level enforcement covers all)
- 36 HTTP fetch sites (6 already timeout-wrapped · 30 uncovered · enumeration deferred to implementation)
- LLM layer: already per-provider tuned · **not changed by this cluster**
- 8 worker cycles: all get T-6 wrapper via shared helper

**Unresolved architectural questions:** 8 (see §16 · all require Philip decision before implementation)

**Runtime checks required before implementation:** 7 items (see §12 · none require code change)

**Proposed test contracts:** 25 assertions (T1-T25) + 5 drift-catchers (CATO1-CATO5) = 30 total

**Risks discovered:**
- Timeout during F35 finalize sequence could leave worker chain in partial-completion state → design requires critical-section extension (see §5.3, §16 Q1)
- Retry after mid-worker timeout can duplicate child jobs → application-level idempotency check needed (§6.3, §15)
- LLM timeouts have real financial cost (paid tokens we never consumed) → signal-only mitigation via `provider_cost_hazard` flag (§6.2)
- Pool constructor sprawl (12+ subsystems) → recommend HQ-scoped enforcement first · shared `makePool` helper introduction (§16 Q2)
- External mutation ambiguity (alert webhooks · delivery) → documented risk · caller-side idempotency remains a separate concern (§6.5)

**Design does NOT propose:**
- Any schema change
- Any migration
- Any modification to Trade Centre pool constructors
- Any modification to Wave 11 F35 finalize semantics beyond a scoped critical-section wrap
- Any Layer 2 crossing
- Any new dual-write decorator
- Any Supabase-specific pattern

**Awaiting authorization for:**
- Runtime verification pass (§12 · read-only)
- OR direct implementation authorization (which would require Q1-Q7 in §16 to be resolved first)
- OR redirect

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-08-11 | Design authored · 19 sections · 25 contract tests + 5 drift-catchers proposed · 5 new timeout gates specified · 7 runtime verification items · 8 unresolved questions · zero implementation · zero commits | Claude (design-only per Philip authorization) |
| 2026-08-11 (later · same session) | **AMENDED with runtime-verification findings** (per `WORLD-CLASS-OPS-W-C-RUNTIME-VERIFICATION.md`). 4 evidence-backed corrections applied: (1) T-5 SPLIT into T-5a read-oriented (safe · Phase 1) and T-5b mutation-oriented (DEFERRED pending per-adapter idempotency design · 11 uncovered sites in delivery/notifications/push/alerts adapters could double-send if blindly timed out); (2) new drift-catcher CATO6 · backfill isolation · 7 scripts audited · MUST NOT inherit shared HQ timeout config; (3) F35 protection UPGRADED from "small extension" to REQUIRED · precise invariant: *"Once `finalizeWorkerJob` enters its critical finalization section, the worker deadline must not interrupt that section"* (Philip 2026-08-11 exact wording) · new § 5.6 documents the invariant and 4 interior partial-state interrupt points · new § 5.5 distinguishes DB atomicity vs application-level idempotency vs external side-effect idempotency; (4) `package.json engines` pin added to implementation task list · Node 24 verified locally but deployment matrix (Vercel + Fly) requires independent runtime verification. §12 verification items 5/6/7 CLOSED via source · items 1-4 REMAIN OPEN pending live-PG. §16 Q1 CLOSED (F35 critical section principle approved). Zero code / migration / config changes. | Claude (documentation-only amendment per Philip authorization) |
| 2026-08-11 (later · same session) | **AMENDED with live-PG verification findings (Option B per Philip)** (per `WORLD-CLASS-OPS-W-C-LIVE-VERIFICATION.md`). PG 17.10 on 5433 confirmed against `nex_dev` · timeout mechanisms verified (§12.1 SET LOCAL works). 4 evidence-backed corrections applied: (1) new § 3.1 · per-value live-evidence status · every value marked UNRESOLVED with reasoning · T-6/T-7 explicitly gated on per-worker-type production P99; (2) new Step 1a in §17 · `pg_stat_statements` enable is a SEPARATE authorization (PG config + restart · not a W-C task) · required to resolve T-1; (3) new Step 1b + new § 15.1 W-C-PREREQ · `nex.knowledge_dump_jobs` instrumentation-gap investigation is SEPARATE from W-C · investigate whether existing state/events/updated_at can reconstruct lifecycle BEFORE assuming schema change is needed · do NOT casually fold column additions into W-C; (4) new § 6.3.1 · empirical vindication of the F35 partial-state class (10 of 39 dev knowledge_dump_jobs stuck in `claimed` for up to 52+ hours · not hypothetical). Every timeout value REMAINS a PROPOSAL · none approved by live evidence. Zero code / migration / config changes. | Claude (documentation-only amendment · Option B per Philip authorization) |
| 2026-08-11 (later · same session) | **AMENDED with stuck-claimed forensic investigation findings** (per `WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md` · read-only forensics · 10 stuck jobs preserved untouched). 4 amendments applied: **(A)** new § 1.7 scope clarification · W-C does NOT solve stuck-claimed orphans · lists what W-C DOES vs DOES NOT solve so operators aren't surprised; **(B)** new § 15.2 W-C-COMPANION cluster tracking · KnowledgeJob supervisor as SEPARATE cluster · 3 candidate shapes (application-sweep · schema-lease · reverse-cascade) each mapped to the three-atomicity domain rule · design decision deferred to future authorization · **10 stuck jobs preserved as forensic fixture for eventual contract tests**; **(C)** new § 6.3.2 · observability blind-spot ELEVATED · every audit/heartbeat/event table was empty for the 10 stuck jobs · Wave 11 GROUP B + W-OBS-1 substrate now in place so future cases will be forensically visible; **(D)** new § 12.8 · before-vs-after forensic-trail state · W-C signals inherit the post-Wave-11 substrate · supervisor design (§ 15.2) should consume `nex.events` for reconciliation. **Key architectural insight added: W-C timeout protection and KnowledgeJob recovery are two different problems.** No schema change · no migration · no fix applied to the 10 stuck jobs · no config change · no F35 modification · no commit · no push. | Claude (documentation-only amendment per Philip authorization) |
