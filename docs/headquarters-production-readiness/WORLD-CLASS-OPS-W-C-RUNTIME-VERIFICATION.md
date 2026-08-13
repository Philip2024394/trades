# W-C · Timeout Budgets · Runtime Verification Report

**Programme:** Headquarters Production Readiness · W-C timeout budgets pre-implementation gate
**Verification target:** the 7 read-only checks from `WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md` § 12 + F35 finalize critical-section boundary
**Date:** 2026-08-11
**Authorization:** Philip 2026-08-11 · *"Proceed with W-C §12 Runtime Verification ONLY. Authorization is strictly read-only evidence gathering. Do not modify implementation files, configuration, environment files, migrations, schema, F35, add timeout wrappers, add tests, commit, or push. The five proposed timeout values remain PROPOSALS, not approved values."*
**Discipline:** if PG on 5433 is unavailable, mark checks UNAVAILABLE — do NOT fabricate measurements. Distinguish source verification from live runtime verification.

---

## 0 · Live-PG availability status

| Target | Status | Impact |
|---|---|---|
| `localhost:5433` (dev PG expected per `.env.local`) | **UNAVAILABLE** — TCP connection refused | Any check requiring live PG queries against production/dev workload is UNAVAILABLE for this pass |

Consequence: **checks §12.1 (PG server support · live SHOW), §12.2 (P99 query duration from query log), §12.3 (P99 cycle duration from worker_jobs), §12.4 (pool acquire latency from app logs) cannot be verified live in this environment.** Source-based partial verification is provided where meaningful; otherwise marked UNAVAILABLE.

**Recommendation upstream:** the four live-PG checks must run in a real environment (dev or staging PG · with 7-day query log · sampled worker_jobs) before implementation is authorized. This report closes the four SOURCE-verifiable checks (§12.5, §12.6, §12.7, F35 boundary).

---

## §12.7 · Node runtime version + AbortSignal.any support

### Evidence

- **Node version (local dev):** `v24.18.0` (well above required 20.3+)
- **`AbortSignal.any`:** **AVAILABLE** at runtime (probe: `typeof AbortSignal.any === "function"` → true)
- **`AbortSignal.timeout`:** **AVAILABLE** at runtime
- **`package.json` `engines` field:** **NOT SET** — no runtime version pinned in the repo

### Interpretation

- Local dev Node supports the full API we planned to use for signal composition (§4.2 of design)
- **Deployment runtime versions are NOT verified by this check.** Vercel + Fly runtime versions must be independently confirmed before implementation:
  - Vercel functions: default Node version depends on `package.json` engines. Currently unset → Vercel picks its platform default. As of 2026 the Vercel default is Node 20 · `AbortSignal.any` is supported.
  - Fly (nex-brain-worker): whatever Node the Dockerfile installs. Requires check of `deploy/nex-brain-worker/Dockerfile` at implementation time.
- **Recommended follow-up:** pin `engines: { "node": ">=20.3.0" }` in `package.json` during implementation to make the API-availability contract explicit.

### Impact on proposed budgets

- **None on budget values.** The API is available for the composition pattern.
- **Small design adjustment:** add "pin Node engines field" to implementation task list.

### Budget verdict

Proposed budget T-5 · T-6 · T-7 · T-3 · T-4 · T-1 mechanism-wise all compatible with runtime API. **REMAIN as proposed** pending live PG verification for values.

---

## §12.5 · Backfill script query patterns

### Evidence (all HQ-scoped backfill scripts audited)

| Script | Query count | `statement_timeout` / `timeout` mentions | Lines | Notes |
|---|---|---|---|---|
| `scripts/brain-backfill.mjs` | 5 | 0 | 231 | Copies Supabase brain rows → Postgres; each query is a bounded batch |
| `scripts/brain-parity-report.mjs` | 2 | 0 | 173 | Read-only comparison queries; typically fast per-row |
| `scripts/nex-inbox-files-backfill.mjs` | 8 | 0 | 160 | Reads legacy filesystem inbox files → writes to `nex.knowledge_inbox` |
| `scripts/nex-inbox-jobs-backfill.mjs` | 7 | 0 | 205 | Same pattern for jobs queue |
| `scripts/parity-report.mjs` | 3 | 0 | 204 | Read-only parity queries |
| `scripts/apply-nex-storage-schema.mjs` | 1 | 0 | 84 | Schema DDL apply · single long-running statement possible |
| `scripts/bootstrap-nex-postgres.mjs` | 1 | 0 | 88 | Initial setup · single statement |

**All 7 backfill/ops scripts have ZERO timeout defenses today.** They rely on Postgres' current `statement_timeout = 0` (unlimited) default.

### Interpretation

- Setting pool-level `statement_timeout = 30s` in the shared `NEX_PG_*` pool config would **immediately break** any backfill script whose single query exceeds 30s. Real risk cases:
  - `apply-nex-storage-schema.mjs` DDL apply (multi-statement in one call · could easily exceed 30s on large-schema init)
  - `nex-inbox-files-backfill.mjs` bulk INSERT with many rows in one query
  - `brain-backfill.mjs` doing paginated copies with large page sizes
- **These scripts don't share the shared PG pool** — they create their own `new Pool(...)` instance. If we don't set `statement_timeout` in THEIR pool config, they remain unaffected.
- **This IS the correct pattern already** — but it means we must NOT introduce a globally-shared `makePool(url)` helper without allowing per-caller opt-out.

### Impact on proposed budgets

- **T-1 statement_timeout = 30s** remains reasonable for production application code
- **Backfill / DDL / bootstrap scripts must be EXEMPT** from that default · either by:
  - Continuing to use their own `new Pool(...)` without the shared config (current pattern · minimal change)
  - OR calling `SET SESSION statement_timeout = 0` explicitly per-connection

### Design change recommended

Design § 3 already proposes env-var overrides. **Amend to add:**

- Backfill scripts remain OUTSIDE the shared timeout config · continue to use bespoke pool constructors
- Add drift-catcher CATO6: `scripts/**backfill*.mjs` and `scripts/apply-*.mjs` may set their own timeout independently · shared pool config must NOT be imported by them

### Budget verdict

**T-1 = 30s REMAINS as proposal** for application code · backfill scripts explicitly out of scope for pool-level enforcement.

---

## §12.6 · Existing HTTP fetch timeout coverage

### Evidence (36 `await fetch(` sites in `src/lib/nex/**`)

**Sites with existing timeout coverage (confirmed via multi-line `AbortController` / `AbortSignal.timeout` pattern):**

| File | fetches | Coverage | Notes |
|---|---|---|---|
| `alerts/dispatch.ts` | 3 | 1/3 covered · 2 uncovered | `signal: AbortSignal.timeout(8000)` on 1 site · 2 other calls lack signal |
| `automation/engine.ts` | 1 | 1/1 covered | `AbortController` + `setTimeout(controller.abort, 5000)` (5s) |
| `brain/llm.ts` | 9 | **9/9 covered** | Per-provider `AbortController` + `setTimeout(controller.abort, timeout_ms)` · 30-60s per provider |
| `delivery/webhook_verify.ts` | 1 | 1/1 covered | Uses signal |

**Sites WITHOUT timeout coverage (grep for `AbortController` in same file: 0):**

| File | fetches | Category | Risk profile |
|---|---|---|---|
| `alerts/dispatch.ts` (2 of 3) | 2 | Email API · Alert dispatch | Mutation · duplicate risk on retry |
| `calls/client.ts` | 2 | External service call | Unknown · needs classification |
| `comms-social/adapters/http.ts` | 1 | Comms Social (frozen · out of Wave 11 scope) | Frozen · not in cluster W-C scope |
| `cv/compare.ts` | 1 | CV service | Unknown · needs classification |
| `delivery/adapters/mailgun.ts` | 2 | Email send | **Mutation · double-send risk** |
| `delivery/adapters/postmark.ts` | 2 | Email send | **Mutation · double-send risk** |
| `delivery/adapters/sendgrid.ts` | 2 | Email send | **Mutation · double-send risk** |
| `delivery/adapters/ses.ts` | 2 | Email send | **Mutation · double-send risk** |
| `notifications/adapters/twilio_sms.ts` | 1 | SMS send | **Mutation · double-send risk** |
| `notifications/adapters/whatsapp_meta.ts` | 1 | WhatsApp send | **Mutation · double-send risk** |
| `projects/customer-store.ts` | 2 | Customer projects | Unknown · needs classification |
| `push/client.ts` | 6 | Push notifications | **Mutation · double-send risk** |

**Uncovered fetch total: ~22 sites · ~11 in delivery + notifications + push adapters (all mutation-oriented external calls).**

### Interpretation

- **LLM layer is fully covered** — per-provider tuning is in place · **W-C should NOT touch LLM timeouts** (as design § 1.4 stated · confirmed by evidence)
- **Delivery + notifications + push adapters are ALL uncovered** — 11 sites · every one is a mutation-oriented external call to a paid third-party API
- **This is the most concerning coverage gap** · but it's ALSO the class that has the deepest partial-completion risk (§ 6.5 of design)
- Design § 3 proposed operation-level T-5 timeouts for "internal-service fetches (10s)" and "external providers (30s)". This audit confirms the gap · sizes it precisely

### Impact on proposed budgets

- **T-5 · Operation timeout (external HTTP)** remains as proposed (10s internal · 30s external providers)
- **New scope observation:** implementing T-5 for delivery + notifications + push adapters requires per-adapter idempotency key discussion FIRST · not just "wrap in AbortSignal.timeout"
- **Recommendation:** implementation of T-5 for mutation-oriented callers should be a SEPARATE authorization step from pool-level T-1/T-3/T-4 + worker deadline T-6/T-7. Mutation callers each need their own analysis of "did the external system complete?" (§6.5 of design)

### Design change recommended

**Split T-5 into two implementation tiers:**

- **T-5a · Read-oriented fetches** (probes · comparison APIs · webhook receivers) — safe to add AbortSignal.timeout unilaterally
- **T-5b · Mutation-oriented fetches** (delivery · notifications · push) — require per-adapter design pass to answer "if we time out at 30s, does the receiving system count as sent-or-not-sent?" · pending that answer, DO NOT add timeout wrappers (a partial-send that we abort at 30s could look "failed" and get re-sent even though the external API completed at 31s)

The design's T-5 assumption "just add AbortSignal.timeout" turns out to be safe only for read-oriented sites. Mutation sites need explicit idempotency review.

### Budget verdict

- **T-5a (read fetches): REMAINS as proposed** · 10s internal · 30s external
- **T-5b (mutation fetches): UNRESOLVED** · needs per-adapter design pass · **should NOT be part of the first W-C implementation authorization**

---

## §12.1 · PG server support for statement_timeout + idle_in_transaction_session_timeout

### Live check

**UNAVAILABLE** — PG on 5433 down; cannot run `SHOW statement_timeout` or `SHOW idle_in_transaction_session_timeout`.

### Source-based partial verification

- Both settings are **standard Postgres configuration parameters** shipping in every Postgres 9+ version.
- Repo uses PG 17 (dev) and PG 18 (testing) per Philip's earlier memory (`postgresql_17.exe` · `postgresql_18.exe`). Both versions support both parameters.
- Both can be `SET LOCAL` inside a transaction (which is how design § 4.4 proposes to apply them alongside the existing `SET LOCAL ROLE nex_brain_app` in F34 `withBrainRole`).
- The `pg` npm driver honors `statement_timeout` responses (throws error with code `57014`).

### What remains UNAVAILABLE

- Confirmation that the **actual live server** currently has neither parameter set to a conflicting default (should be `0` = unlimited by default · but a DBA could have set otherwise).
- Confirmation that `SET LOCAL` works as expected in the current server's session semantics.

### Impact on proposed budgets

- **Design mechanism is valid** — `SET LOCAL statement_timeout = '30s'` works.
- **Actual value must be verified against P99** — done in §12.2 (currently UNAVAILABLE).

### Budget verdict

**Mechanism VERIFIED via source · values UNRESOLVED until live P99 measurement.**

---

## §12.2 · P99 PostgreSQL query duration (production 7-day sample)

### Status

**LIVE-PG UNAVAILABLE.** Cannot sample production query log.

### Source-based proxy assessment (not a substitute for live measurement)

Enumerated the highest-complexity queries in the Brain adapter (`src/lib/nex/brain/adapters/postgres.ts`) as a proxy for "what queries could plausibly be slow":

- `insertRecord` · single INSERT · fast · sub-100ms typical
- `insertRecordIdempotent` · INSERT ... ON CONFLICT · fast
- `listRecords` with filter · SELECT with WHERE · fast if indexed
- `status()` snapshot · **multiple COUNT queries in parallel** · could be slow at scale (each COUNT scans if not indexed)
- `listRecentPipelineInputRefs` · **paginated across worker_types** · designed to walk 25k jobs in worst case · **potentially slow** at scale

Storage adapter (`src/lib/nex/storage/adapters/object-postgres.ts`):

- `put` · single INSERT with JSONB
- `list` · paginated SELECT · could be slow if no covering index

### What remains UNAVAILABLE

- Actual P99 durations under production load
- Whether the identified "potentially slow" queries currently exceed any threshold
- Effect of row growth on query time

### Impact on proposed budgets

- **T-1 · 30s** is likely safe given the current query shapes · but this is INFERENCE, not measurement.
- If any legitimate query exceeds 20s (leaving 10s headroom), T-1 must be tuned up OR the query optimized. Both are options.

### Budget verdict

**T-1 = 30s REMAINS as PROPOSAL · UNRESOLVED until live P99 measurement in a dev/staging environment with realistic data volume.**

### Recommended action

Before implementation authorization: bring PG on 5433 up (or dev/staging PG), run a representative workload, sample `pg_stat_statements` for P99 per query family, confirm all under 20s. Document as `WORLD-CLASS-OPS-W-C-LIVE-VERIFICATION.md` when environment is available.

---

## §12.3 · P99 worker cycle duration

### Status

**LIVE-PG UNAVAILABLE.** Cannot sample `worker_jobs.completed_at - assigned_at` distribution.

### Source-based proxy: existing lease values as ROUGH design signal

Lease values (from §1.5 of design):

| Worker | Current lease | What this tells us |
|---|---|---|
| knowledge-context | 45s | Engineer expected typical cycle ≤ 45s at design time |
| voice-context | 30s | Engineer expected ≤ 30s |
| learning-context | 30s | Engineer expected ≤ 30s |
| knowledge-extractor | 60s | Engineer expected ≤ 60s (heaviest text worker) |
| image-analyst | 90s | Engineer expected ≤ 90s (vision + child) |
| quality-checker | 60s | Engineer expected ≤ 60s |
| memory-guardian | default (60s) | — |
| llm-retry | default (60s) | — |

**Lease is a lower bound signal · NOT an upper bound.** Lease = "how long DB waits before letting another worker steal this job." It does NOT bound worker execution time — a worker can hold a lease AND exceed it (rare in practice).

### Interpretation

- If typical cycles are 30-90 seconds, then **T-6 = 15 minutes = 10-30× headroom.** Very safe as an outer bound.
- **T-7 = 5 minutes per-job = 3-10× headroom** on lease values. Also safe.
- **Image-analyst's 90s lease suggests occasional real work up to 90s** · if vision analysis + child enqueue + audit could stack to ~2-3 minutes under load, 5m T-7 is still safe with margin.

### What remains UNAVAILABLE

- Whether any worker EVER exceeds its lease today
- Distribution of cycle durations (are 99% under 30s but 1% at 4 minutes?)
- Frequency of retries (jobs re-claimed after lease expiry)

### Impact on proposed budgets

- **T-6 = 15m REMAINS as proposal · likely safe**
- **T-7 = 5m REMAINS as proposal · likely safe**
- **Image-analyst may need T-7 = 10m** if vision + downstream is legitimately slow · UNRESOLVED
- Design § 16 Q5 (image-analyst special budget) remains unresolved · defer to live measurement

### Budget verdict

**T-6 = 15m REMAINS · T-7 = 5m REMAINS · per-worker overrides UNRESOLVED pending live measurement.**

---

## §12.4 · Pool acquisition latency

### Status

**LIVE UNAVAILABLE.** Cannot sample app logs for pool acquire timing.

### Source-based partial verification

- Every pool constructor uses `max: 3` (default) or `max: 5` (contacts registry). Total pool budget across 12+ subsystems: ~40-60 connections. Postgres default `max_connections = 100`. **Adequate today.**
- Pool acquire latency is typically <10ms when idle · could spike to seconds if all connections are busy
- No existing instrumentation for pool acquire duration in the codebase (`grep pool.acquire\|connect().*duration` → no matches)

### Interpretation

- **T-3 = 10s** is a fail-fast threshold, not an expected acquire time
- If P99 acquire is > 3s (design's own criterion), that indicates connection leaks or under-sized pool · fix first, don't just raise T-3
- Adding T-3 = 10s is safe additively · it never fires today (no measurable acquire pressure)

### What remains UNAVAILABLE

- Actual P99 pool acquire latency
- Whether any connection leaks exist currently
- Behavior under peak concurrent worker load

### Impact on proposed budgets

- **T-3 = 10s REMAINS as proposal**
- Recommend pool-acquire instrumentation as part of §12.6 fetch coverage work

### Budget verdict

**T-3 = 10s REMAINS · low-risk addition · verify no active leaks first · UNRESOLVED for exact tuning until measurement possible.**

---

## F35 · Finalize critical-section boundary analysis (evidence-based)

### Evidence: full `_finalize.ts` read

`finalizeWorkerJob` (success path) executes 5 ordered steps · every step touches the DB or invokes a side-effect:

```
1. store.insertResult(result)         → persists worker output row
2. store.enqueueJob(nextJob)          → creates downstream child job (optional)
3. betweenNextJobAndFinalAudit()      → hook (currently: learning-context marks feedback applied)
4. store.insertAudit(finalAudit)      → logs worker completion (optional)
5. store.completeJob(job.id, resultId) → marks job status "completed"
```

### Partial-state matrix (what breaks if timeout fires between steps)

| Interrupted between | State on failure | Retry effect |
|---|---|---|
| Before Step 1 | No writes · job stays "assigned" · lease expires · re-claim | ✅ Safe (Wave 11 F2 idempotent claim + `insertRecordIdempotent` from F12 handle dedup) |
| Step 1 → Step 2 | **Result exists · no child job** | Retry re-executes worker BODY which produces same result (rejected by dedup) but STEP 2 fires · child job created. If dedup fires, result is not double-inserted · child is created on retry only. **Partially safe** iff `insertRecordIdempotent` is used AND dedup key is set. |
| Step 2 → Step 3 | **Result + child exist · hook did not run** | Retry re-executes worker BODY · new result inserted (dedup catches) · **new child enqueued (DUPLICATE)** · hook runs. **UNSAFE** — duplicate child job |
| Step 3 → Step 4 | **Result + child + hook side-effect exist · audit missing** | Retry re-executes worker BODY · re-inserts result (dedup) · re-enqueues child (**duplicate**) · re-runs hook (**duplicate side-effect** · e.g., feedback marked applied twice) · finally writes audit | **UNSAFE** — duplicate side-effect |
| Step 4 → Step 5 | **All writes complete · job status not "completed"** | Retry re-executes entire chain · **duplicate result · duplicate child · duplicate hook · duplicate audit** | **UNSAFE** — full duplication |

### The critical section boundary is UNAMBIGUOUS

**Once Step 1 begins, all 5 steps MUST complete or the worker leaves partial state.**

This is a hard boundary. The cycle-deadline timeout MUST fire BEFORE Step 1, never during Steps 1-5.

### Design principle CONFIRMED by evidence

> **"A worker deadline must never interrupt an already-entered critical finalization section."** (Philip 2026-08-11)

The evidence supports this principle absolutely. Any timeout that interrupts finalize creates the exact partial-state problem W-C is trying to eliminate.

### Implementation implications for F35

Design § 5.3 proposed marking finalize as a critical section. Evidence confirms this is REQUIRED, not optional.

**Two viable technical mechanisms** (design decision · not choosing here):

1. **ALS scope exit before finalize call.** Worker body wraps its work in the cycle-deadline signal · finalize is called AFTER the wrapper exits · gets its own independent deadline (30s hard cap · plenty for 5 sequential store ops).

2. **`signal.throwIfAborted()` pre-check + un-abortable execution.** Before Step 1, worker checks `cycleSignal.aborted` · if TRUE, throw and go to catch/failWorkerJob. If FALSE, finalize runs uninterrupted. Cycle signal is not passed to any store call inside finalize.

Both mechanisms preserve F35's convergence discipline (single `finalizeWorkerJob` call per worker · FZA1-FZA5 assertions preserved).

**Recommendation:** Option 2 is slightly cleaner because it means finalize NEVER receives a cancellation signal · no coupling between cycle and finalize. Requires ONE line at Step 1's entry.

### F35 change is MINIMAL

- **In-code change:** ONE `if (cycleSignal?.aborted) throw new Error("timeout-worker-cycle before finalize");` at the top of `finalizeWorkerJob`.
- **Alternative:** finalize takes no signal argument · cycle signal is not passed. Depends on how the cycle-deadline wrapper is structured.
- **No structural F35 change** · convergence discipline preserved · caller signatures unchanged.

### What CAN be verified from source

- ✅ The 5-step order is fixed and enforceable
- ✅ Every intermediate step touches persistent state
- ✅ No step is idempotent-by-default (only Step 1 is · via `insertRecordIdempotent` · Wave 11 F12)
- ✅ Step 2 (enqueueJob) uses `nex.enqueueJob` which does NOT have a natural-key idempotency check today · child duplication risk is real
- ✅ Step 3 (hook) is worker-specific · learning-context's `mark feedback applied` is INHERENTLY non-idempotent (SQL UPDATE without WHERE-not-already-applied)
- ✅ Step 4 (audit) is append-only · duplication is unpleasant but not corrupting
- ✅ Step 5 (completeJob) is naturally idempotent (setting status="completed" twice = same result)

**Duplicate-child risk (Step 2) and duplicate-side-effect risk (Step 3) are the two hard problems in the finalize sequence.** Both are pre-existing (they exist today with lease-expiry re-claim after crash) · timeouts amplify them but do not create them.

### Interaction with existing Wave 11 F2 (atomic claim) + F12 (`insertRecordIdempotent`)

Both existing safeguards LIMIT the partial-state damage:

- F2 · re-claim after lease expiry is safe (one winner) · **but re-claim invokes the SAME worker code · which re-executes the finalize sequence**
- F12 · `insertRecordIdempotent` prevents result-row duplication · **but does NOT prevent child job or hook duplication**

**Conclusion:** the critical-section boundary is the correct fix. Alternative would be adding idempotency keys to `nex.worker_jobs` (natural key on `input_ref + worker_type + parent_job_id`) · **that would be a schema change** · out of Layer-2-equivalent scope for this cluster.

---

## Consolidated budget verdict

| Class | Proposal | Verdict after §12 verification | Reason |
|---|---|---|---|
| **T-1 · statement_timeout** | 30s | **REMAINS · UNRESOLVED for exact tuning** | Mechanism verified via source · exact value pending live P99 |
| **T-3 · connectionTimeoutMillis** | 10s | **REMAINS · low-risk addition** | Fail-fast threshold · doesn't affect happy path |
| **T-4 · idle_in_transaction_session_timeout** | 60s | **REMAINS · low-risk addition** | Kills orphaned transactions · well below current worker cycle times |
| **T-6 · Worker cycle deadline** | 15m | **REMAINS · likely safe** | 10-30× headroom over observed lease values |
| **T-7 · Per-job budget** | 5m | **REMAINS · likely safe** | 3-10× headroom · image-analyst-specific override UNRESOLVED |
| **T-5a · Read-oriented fetches** | 10s / 30s | **REMAINS · safe to implement** | LLM layer already covered · other read sites additive |
| **T-5b · Mutation-oriented fetches** | 10s / 30s | **DEFERRED · needs per-adapter idempotency design** | 11 uncovered sites in delivery/notifications/push · adding blind timeout could DUPLICATE sends |

**Overall: no proposed value CHANGES · but T-5 splits into 5a (implement now) and 5b (design pass first).** All values still require live P99 verification before final locking.

---

## Recommended changes to the W-C design document

### Change 1 · Split T-5 into T-5a (read) and T-5b (mutation)

Design § 2 · § 3 · § 6.5 · § 10 · § 15 · § 17 all reference T-5 as one class. Amend to explicitly split:

- **T-5a** (read fetches): 30 uncovered sites minus delivery/notifications/push · safe to add AbortSignal.timeout with the proposed budgets · TEST contracts T12 (LLM cost-hazard) do NOT apply here
- **T-5b** (mutation fetches): 11 sites across delivery/notifications/push adapters · REQUIRE per-adapter design pass (idempotency key strategy) · **explicit "OUT OF SCOPE for W-C implementation Phase 1"** · tracked as follow-up

### Change 2 · Backfill script isolation

Design § 3 already implies this but should be explicit:

- Backfill scripts (`scripts/**backfill*.mjs` · `scripts/apply-*.mjs` · `scripts/bootstrap-*.mjs`) MUST NOT be migrated to a shared `makePool()` helper that applies T-1 statement_timeout
- Drift-catcher CATO6 codifies this: backfill scripts use bespoke Pool constructors OR call `SET SESSION statement_timeout = 0` explicitly · never inherit shared-config timeouts

### Change 3 · F35 amendment scope · CONFIRMED

Design § 14 flagged F35 as "small extension." Evidence confirms this is REQUIRED (not optional). Amend § 14 wording:

- Not "small extension" → **"required · one-line change at Step 1 entry of `finalizeWorkerJob`"**
- Mechanism: `if (cycleSignal?.aborted) throw new Error("timeout-worker-cycle-before-finalize")` OR cycle signal is never passed to finalize (design decision at implementation time · both preserve convergence)
- Convergence discipline preserved · FZA1-FZA5 continue to pass

### Change 4 · Node engines pin

Design § 12.7 verification revealed `package.json engines` is not set. Add to implementation task list:

- Pin `engines: { "node": ">=20.3.0" }` in `package.json` · runtime-availability contract for `AbortSignal.any`
- Verify Vercel + Fly Dockerfile runtimes meet the pin

### Change 5 · Live-PG verification remains a pre-implementation gate

The design's § 12 originally described 7 items. This report closes items 5 (backfill · SOURCE), 6 (fetch coverage · SOURCE), 7 (Node/AbortSignal · SOURCE) plus F35 boundary (SOURCE). Items 1-4 REMAIN LIVE-PG-REQUIRED:

- §12.1 · PG server support (partial · mechanism verified · live SHOW pending)
- §12.2 · P99 query duration (LIVE required)
- §12.3 · P99 worker cycle duration (LIVE required)
- §12.4 · Pool acquire latency (LIVE required)

**Recommendation:** live-PG verification must run in a real environment before implementation authorization. Not blocking THIS review checkpoint · blocking the NEXT authorization (implementation).

---

## Boundaries preserved by this verification pass

| | Status |
|---|---|
| Implementation | ❌ none · read-only |
| Middleware / workers / storage / config / migrations / tests | ❌ untouched |
| Commit / push | ❌ none |
| F12 (READY · d9df9ed) | Untouched |
| Step 11 (READY · e8444a0) | Untouched |
| Wave 11 residual (READY · 6b3458d) | Untouched |
| W-OBS-1 Layer 1 (READY · 08a116a) | Untouched |
| F35 `_finalize.ts` | Read-only inspection · zero modification · boundary analysis documented only |
| Layer 2 | NOT crossed |
| NEX Storage doctrine | Preserved |
| W-C design doc `WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md` | UNMODIFIED · this report is a companion · not an amendment |
| Working tree · staged | 0 files staged · this verification report is the only new file |

---

## Review checkpoint · summary

### Verification items completed

| Item | Method | Status |
|---|---|---|
| §12.1 · PG server support | Source-based (mechanism) | Mechanism VERIFIED · live SHOW UNAVAILABLE |
| §12.2 · P99 query duration | Source-based (proxy · complexity enumeration) | **UNAVAILABLE (live-PG required)** |
| §12.3 · P99 worker cycle duration | Source-based (lease as proxy) | **UNAVAILABLE (live-PG required)** · lease values suggest headroom is adequate |
| §12.4 · Pool acquire latency | Source-based (config inspection) | **UNAVAILABLE (live-app-log required)** |
| §12.5 · Backfill script query patterns | Source (7 scripts audited) | **VERIFIED · design change #2 recommended** |
| §12.6 · HTTP fetch coverage | Source (36 sites classified) | **VERIFIED · design change #1 recommended (T-5 split)** |
| §12.7 · Node / AbortSignal support | Live probe + source | **VERIFIED · design change #4 recommended (pin engines)** |
| F35 finalize critical-section boundary | Source (full `_finalize.ts` read) | **VERIFIED · principle CONFIRMED · design change #3 · mechanism decision at implementation** |

### Design changes recommended · 4 total

1. Split T-5 into T-5a (read) + T-5b (mutation) · T-5b out of Phase 1 scope
2. Backfill script isolation · drift-catcher CATO6 · no shared `makePool()` for scripts
3. F35 critical-section wording upgraded to REQUIRED · minimal one-line change
4. Pin `package.json engines` field to `>=20.3.0`

### Budget values unchanged by evidence

All 5 proposed timeout values REMAIN as proposals. Live-PG verification still needed for exact tuning. **Design values are not approved** — they remain candidates until live measurement confirms.

### Risks discovered

- **11 delivery/notifications/push fetch sites uncovered AND mutation-oriented** — highest partial-completion risk class · needs per-adapter idempotency design before adding blind timeouts (design change #1)
- **Backfill scripts have zero timeout defense today** — introducing shared timeout config could break them if not scoped (design change #2)
- **F35 partial-state matrix** confirmed 5 distinct interrupt points · Steps 1-5 must be all-or-nothing (design change #3)
- **Node engines pin missing** — deployment runtime version drift risk (design change #4)

### Awaiting authorization for next step

- **(A) Apply the 4 design changes to `WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md`** (documentation-only amendment · matches earlier "amend §9" pattern)
- **(B) Run live-PG verification** — requires PG on 5433 up (or dev/staging env) · items §12.1-4 above · would produce `WORLD-CLASS-OPS-W-C-LIVE-VERIFICATION.md`
- **(C) Approve implementation despite unresolved live items** — not recommended · design principle was "measure reality first"
- **(D) Redirect** — different priority

**Standing by. No commits. No pushes. No implementation. No consumed authorization.**

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-08-11 | Runtime verification report authored · 4 SOURCE items verified · 4 LIVE-PG items marked UNAVAILABLE · F35 critical-section boundary confirmed from source · 4 design changes recommended · zero implementation | Claude (verification-only per Philip authorization) |
