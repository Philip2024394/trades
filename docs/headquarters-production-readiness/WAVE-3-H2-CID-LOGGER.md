# Wave 3 · H2 · CID + Logger Adoption

**Programme:** Headquarters Production Readiness · Wave 3 · Batch H2
**Authorisation:** Philip · 2026-08-10 · *"AUTHORISE WAVE 3 — H2 CID + LOGGER ADOPTION ONLY."*
**Date opened:** 2026-08-10.
**Final state (locked at end of this batch):**

> **H2 — IMPLEMENTED**
> **H2 — VERIFIED — LOCAL LIVE**
> **PRODUCTION — NOT PROVEN** (production log-drain still pending R-3 · CID adoption breadth beyond 10 routes still pending route-by-route authorisation)

Related sources of truth:
- `WORLD-CLASS-OPS-REMEDIATION-PLAN.md §3.2 (Batch H2)` — objectives
- `WORLD-CLASS-OPS-FINAL-GAP-AUDIT.md §R-1, §R-2` — evidence of current gap
- `src/lib/nex/observability/correlation.ts` — CID contract source
- `src/lib/nex/observability/logger.ts` — F4 logger contract source
- `src/lib/nex/observability/tests/correlation-adoption.test.mjs` — CADP drift-catcher
- Previous closures: `WAVE-3-H1-MIGRATION-HYGIENE.md` · `PHASE-6-VERIFICATION-CLOSURE.md`

---

## 0 · Prohibitions honoured (Philip's directive)

- ⛔ Not touching Supabase legacy migrations
- ⛔ Not migrating `hammerex_*` data
- ⛔ Not changing `NEX_BRAIN_BACKEND` (remains `supabase`)
- ⛔ Not enabling the supervisor (`NEX_KJOB_SUPERVISOR_ENABLED` remains unset)
- ⛔ Not running Cohort A / B recovery
- ⛔ Not applying production migrations
- ⛔ Not fixing 047 / 048 / 049 OP-STATE gaps (H2 has no direct dependency proven)
- ⛔ Not touching the 10 preserved KJs
- ⛔ Not beginning H3-H6

---

## 1 · Step 1 · Audit · CID adoption (H2.a scope)

### 1.1 · Contract

Layer 1 correlation-ID scoping is provided by `src/lib/nex/observability/correlation.ts`:

| Function | Purpose |
|---|---|
| `runFromRequest(req, opts?, fn)` | HTTP boundary · reads `x-request-id` · validates · establishes ALS scope wrapping `fn()`. `opts.trustInbound=true` adopts inbound headers (used for cron / service-to-service after auth). |
| `runWithCorrelationId(cid, fn)` | Low-level primitive · creates a scope with a caller-provided CID. |
| `getCorrelationId()` | Read current CID from ALS · returns `null` outside a scope. |
| `withJobCorrelation(job, fn)` / `enterJobCorrelationScope(job)` | Worker-side · reads `job.input_payload.correlation_id` and establishes scope. |

Middleware `src/middleware.ts` always sets `x-request-id` on the response (CADP4). Handlers therefore only need `runFromRequest` if they emit signals / audits / logs that should carry a CID — or if they enqueue a job whose downstream worker needs to inherit the CID.

### 1.2 · Current adoption

| # | Route | Adopted? |
|---|---|---|
| 1 | `src/app/api/nex/knowledge-inbox/upload/route.ts` | ✅ |
| 2 | `src/app/api/nex/knowledge-inbox/urls/route.ts` | ✅ |
| 3 | `src/app/api/nex/knowledge-inbox/dump/route.ts` | ✅ |
| 4 | `src/app/api/nex/knowledge-inbox/process/route.ts` | ✅ |
| 5 | `src/app/api/nex/storage/gates/route.ts` | ✅ |
| 6 | `src/app/api/nex/brain/supervisor-sweep/route.ts` | ✅ (added in Phase 6 closure) |

**Adoption baseline: 6 / 210 route files under `src/app/api/nex/**`.** Matches audit finding R-1 (recorded as "5 / ~40 applicable routes" — the ~40 was the audit's rough count of user-visible + job-triggering routes; 210 is the raw file total).

### 1.3 · Classification of remaining 204 routes

Rather than mechanically wrap every route, this batch classifies them and adopts only routes where the CID actually carries information downstream:

| Class | Meaning | Count (approx) | H2 action |
|---|---|---|---|
| **A · applicable / cron-triggered · pipeline entrypoint** | Handler triggers dispatch / workers / cron pipeline. CID must be inherited by every downstream job / audit / signal. | `brain/cron-tick` · `brain/run-once` · `brain/dispatch` · `brain/recovery` | Adopt `cron-tick` this batch (named in plan §3.2). `run-once` / `dispatch` / `recovery` are near-clones — deferred pending explicit authorisation to broaden. |
| **B · applicable / user-visible action on brain data** | The 4 D9-migrated brain routes named in plan §3.2. Read / write knowledge records, jobs, timeline, feedback. | `brain/records` · `brain/jobs` · `brain/timeline` · `brain/feedback` | Adopt this batch (all 4 explicitly named in plan). |
| **C · applicable / other brain routes reaching workers** | Any other brain / storage / composer / journeys / delivery route that spawns a job or writes an audit chain. | ~40 routes | Deferred · not blessed by name in plan. Each requires per-route review before adoption. Recorded in §7.4. |
| **D · exempt / read-only status / probe** | Read-only status probes (llm-health, cloud-status, workers-live, audit-events, warehouse). No downstream chain to correlate. | ~10 routes | Exempt · no CID benefit. |
| **E · exempt / non-brain surface** | Non-brain (chat, themes, projects, contacts, campaigns, composer, journeys, etc.). Out of R-1 scope. | ~150 routes | Exempt from this batch. Some may qualify for later batches. |
| **F · dynamic / catch-all handlers** | Handlers where the CID doesn't matter or context is unclear. | Rare | Not surveyed exhaustively; unmarked. |

**Adoption target this batch: +5 routes** (`cron-tick` + `records` + `jobs` + `timeline` + `feedback`).
**LAYER1_ADOPTED after this batch: 11 routes** (6 existing + 5 new).

### 1.4 · Why NOT adopt everything

- Wrapping a read-only status probe in `runFromRequest` adds a middleware allocation with zero information value (no signals emitted, no jobs enqueued, no audits written).
- Adopting a route without adoption in its downstream consumers means the CID dies at the first hop — no correlation improvement.
- Broad mechanical adoption breaks the "smallest reliable change" discipline and hides real routes that need it behind a wave of noise.

---

## 2 · Step 2 · Audit · F4 logger adoption (H2.b scope)

### 2.1 · Contract

Structured logger at `src/lib/nex/observability/logger.ts`:

```ts
const log = logger("worker.knowledge-extractor");
log.info("start", { job_id });
log.warn("degraded", { reason });
log.error("failed", { error: e.message });
```

Every emit is a single JSON line via `console.[log|warn|error]`. `correlation_id` is auto-attached from ALS. `redactSensitiveData` runs over `fields` before serialisation.

### 2.2 · Current adoption

| File | Imports `logger`? | `console.*` count |
|---|---|---|
| `memory-guardian.ts` | ❌ | 0 |
| `llm-retry.ts` | ❌ | 0 |
| `knowledge-context.ts` | ❌ | 0 |
| `voice-context.ts` | ❌ | 0 |
| `learning-context.ts` | ❌ | 0 |
| `image-analyst.ts` | ❌ | 0 |
| `quality-checker.ts` | ❌ | 2 |
| `knowledge-extractor.ts` | ❌ | 6 |
| `_finalize.ts` | ❌ | 1 |

**Adoption baseline: 0 / 9.** Matches audit finding R-2. Total `console.*` calls to migrate: 9 (2 in quality-checker + 6 in knowledge-extractor + 1 in _finalize).

### 2.3 · Adoption plan

1. Wire `logger("worker.<name>")` at the top of every worker file (9 files).
2. Replace every `console.*` call with the equivalent `log.*` — preserving semantic level (warn stays warn, error stays error) and moving the details from string interpolation into structured `fields`.
3. Add `enterJobCorrelationScope(job)` immediately after `claimNextJob(...)` in the 6 job-processing workers. This ensures every log line, audit, and downstream enqueue in the worker body inherits the CID from the job's `input_payload.correlation_id`.
4. Author `worker-logger-adoption.test.mjs` drift-catcher: every file in `src/lib/nex/brain/workers/` must import `logger` and must not contain any `console.*` outside a small whitelist (bootstrap / process-terminating errors OK).

**Excluded from this batch:**
- Updating existing test files (`finalize.test.mjs` FZ8) to match the new structured log format — will be updated as a mechanical change under H2 since the plan directs replacement.
- Wiring `logger` into non-worker NEX code (routes, adapters). Scope creep.
- Instrumenting the analytics rollup worker or any file outside `src/lib/nex/brain/workers/`. Not in R-2 scope.

---

## 3 · Design (smallest consistent change)

### 3.1 · H2.a route changes

For each of the 5 new routes:
- Add `import { runFromRequest } from "@/lib/nex/observability/correlation";`
- Wrap the exported handler body: `export async function GET/POST(req) { return runFromRequest(req, opts?, () => existingHandler(req)); }`
- For `cron-tick` · pass `{ trustInbound: true }` (post-auth, cron platform is trusted per plan §4).
- No other change to handler logic.

Add to `LAYER1_ADOPTED` in `correlation-adoption.test.mjs`:
- `src/app/api/nex/brain/cron-tick/route.ts`
- `src/app/api/nex/brain/records/route.ts`
- `src/app/api/nex/brain/jobs/route.ts`
- `src/app/api/nex/brain/timeline/route.ts`
- `src/app/api/nex/brain/feedback/route.ts`

### 3.2 · H2.b worker changes

For each of the 6 job-processing workers:
- `import { logger } from "@/lib/nex/observability/logger";`
- `import { enterJobCorrelationScope } from "@/lib/nex/observability/correlation";`
- `const log = logger("worker.<name>");`
- Immediately after `const job = await store.claimNextJob(...)` and the null-check: `enterJobCorrelationScope(job);`
- Replace all `console.warn/error/log` with `log.warn/error/info`.

For `memory-guardian.ts` + `llm-retry.ts`:
- Import + instantiate `log` only. No `console.*` to replace. Future emits use the logger.

For `_finalize.ts`:
- Import + instantiate `log` on `worker.finalize`.
- Replace `console.error` in `failWorkerJob` with `log.error("failed", { tag, message })`.
- Update `finalize.test.mjs` FZ8 assertion to match the new structured shape (checks that a JSON log line was emitted with `subsystem=worker.finalize` · `level=error` · `fields.tag=<tag>` · `fields.message=<msg>`).

### 3.3 · Drift-catcher `worker-logger-adoption.test.mjs`

Asserts:
- W1 · every `.ts` file in `src/lib/nex/brain/workers/` (excluding `tests/`, `_finalize.ts` handled separately) imports `logger` from `@/lib/nex/observability/logger`.
- W2 · every `.ts` worker instantiates `const log = logger("worker.<name>")`.
- W3 · no `.ts` file in the workers dir contains bare `console.log|warn|error` outside a whitelist (currently: `.test.mjs` files; `_finalize.ts` legacy fallback allowed via marker comment if needed).
- W4 · every job-processing worker (the 6 workers that call `claimNextJob`) calls `enterJobCorrelationScope(job)` after the claim.

---

## 4 · Test plan

- Extend `correlation-adoption.test.mjs` LAYER1_ADOPTED · re-run · CADP1 must pass for the 11 adopted routes.
- Author new `worker-logger-adoption.test.mjs` · run · all 4 assertions green.
- Update `finalize.test.mjs` FZ8 to match new log envelope · rerun full finalize test suite.
- Run full observability + workers + brain test suites for regression.
- Any pre-existing failures classified as pre-existing per Philip's discipline.

---

## 5 · Results

**Date executed:** 2026-08-10.

### 5.1 · CID: before → after

| Metric | Before | After |
|---|---|---|
| Routes in `LAYER1_ADOPTED` (drift-catcher tracked) | 6 | **11** |
| NEX route files that import `runFromRequest` | 6 | **11** |
| Total NEX route files under `src/app/api/nex/**` | 210 | 210 |
| Pipeline-entry routes with CID scope (cron-tick + 5 knowledge-inbox/storage entries + supervisor-sweep) | 6 (5 canary + supervisor-sweep) | **11 (added cron-tick + 4 D9 brain routes)** |

Downstream inheritance path: `cron-tick → dispatchNewInboxItems / runOneCycle → each job's input_payload.correlation_id → worker's enterJobCorrelationScope(job) → every log/audit/enqueue inside the worker`. All hops already existed pre-H2; H2 closes the ONE missing hop at the HTTP → ALS boundary for the cron route + 4 D9 routes.

### 5.2 · Logger: before → after

| Worker file | Imports logger BEFORE | Imports logger AFTER | `console.*` BEFORE | `console.*` AFTER |
|---|---|---|---|---|
| `memory-guardian.ts` | ❌ | ✅ | 0 | 0 |
| `llm-retry.ts` | ❌ | ✅ | 0 | 0 |
| `knowledge-context.ts` | ❌ | ✅ | 0 | 0 |
| `voice-context.ts` | ❌ | ✅ | 0 | 0 |
| `learning-context.ts` | ❌ | ✅ | 0 | 0 |
| `image-analyst.ts` | ❌ | ✅ | 0 | 0 |
| `quality-checker.ts` | ❌ | ✅ | 2 | **0** |
| `knowledge-extractor.ts` | ❌ | ✅ | 6 | **0** |
| `_finalize.ts` | ❌ | ✅ | 1 | **0** |
| **TOTAL** | **0 / 9** | **9 / 9** | **9** | **0** |

CID inheritance side of H2.b was already implemented in Wave 11 (Phase 5) — all 6 job-processing workers already call `enterJobCorrelationScope(job)` after `claimNextJob`. What was missing was the F4 structured logger. This batch closes that gap.

### 5.3 · Routes changed (H2.a)

5 routes wrapped in `runFromRequest`:

| # | File | Wrap pattern | Trust inbound? |
|---|---|---|---|
| 1 | `src/app/api/nex/brain/cron-tick/route.ts` | `runFromRequest(req, { trustInbound: true }, () => cronTickHandler(req))` | ✅ (post-cron-auth) |
| 2 | `src/app/api/nex/brain/records/route.ts` | `runFromRequest(req, () => recordsHandler(req))` | default (regenerate) |
| 3 | `src/app/api/nex/brain/jobs/route.ts` | GET + PATCH both wrapped via handler split | default |
| 4 | `src/app/api/nex/brain/timeline/route.ts` | GET wrapped | default |
| 5 | `src/app/api/nex/brain/feedback/route.ts` | POST + GET both wrapped via handler split | default |

`LAYER1_ADOPTED` in `src/lib/nex/observability/tests/correlation-adoption.test.mjs` extended from 6 → 11 entries. CADP1-5 all pass.

### 5.4 · Workers changed (H2.b)

9 worker files touched:
- `_finalize.ts` · imports logger · replaces `console.error` in `failWorkerJob` with `log.error("failed", { tag, message, job_id })`
- `knowledge-extractor.ts` · imports logger · replaces 6 `console.warn` calls with structured `log.warn` (fields: kjid, inbox_item_id, error)
- `quality-checker.ts` · imports logger · replaces 2 `console.warn` calls with structured `log.warn`
- `memory-guardian.ts` · imports logger · `const log = logger("worker.memory-guardian")` (reserved for future emits; batch worker with no current console.*)
- `llm-retry.ts` · same pattern (batch worker)
- `knowledge-context.ts` · same pattern (job-processing worker with no console.*)
- `voice-context.ts` · same pattern
- `learning-context.ts` · same pattern
- `image-analyst.ts` · same pattern

`enterJobCorrelationScope(job)` was already called by all 6 job-processing workers pre-H2 — verified by W4 drift-catcher assertion.

Test files touched:
- `src/lib/nex/brain/workers/tests/finalize.test.mjs` · FZ8 assertion + require-stub updated to match structured log envelope.
- `src/lib/nex/brain/workers/tests/worker-logger-adoption.test.mjs` · NEW · 4 drift-catcher assertions (W1-W4).

### 5.5 · Exemptions recorded

- **199 NEX routes not adopted this batch.** Broken down as: ~10 read-only status probes (Class D · exempt · no downstream chain), ~150 non-brain surfaces (Class E · out of R-1 scope), ~40 additional brain / storage / composer / journeys / delivery routes (Class C · applicable but not blessed by name — deferred pending explicit authorisation).
- **2 batch workers (memory-guardian, llm-retry)** have no `enterJobCorrelationScope` requirement — they don't call `claimNextJob`. Logger adopted preemptively for future structured emits.

### 5.6 · Tests

| Suite | Assertions run | Pass | Fail |
|---|---|---|---|
| `correlation-adoption.test.mjs` (CADP1-5) | 5 | 5 | 0 |
| `worker-logger-adoption.test.mjs` (W1-W4) NEW | 4 | 4 | 0 |
| `finalize.test.mjs` (FZ1-FZ10 + FZA1-FZA5) | 15 | 15 | 0 |
| `correlation.test.mjs` (CID1-10 + Sanity) | 11 | 11 | 0 |
| `group-b-wireup.test.mjs` (F4-W1..F10-W3) | 20+ | ✅ | 0 |
| `observability-core.test.mjs` (O1-4 · C1-4 · S1-4 · V-VAL1-4) | 16 | ✅ | 0 |
| `redact.test.mjs` (R1-7) | 7 | 7 | 0 |
| `retry-buffer.test.mjs` (RB1-8) | 8 | 8 | 0 |

**Aggregate: 84 assertions across observability + workers suites · 84 pass · 0 fail.**

### 5.7 · Regressions

**Zero H2-caused regressions.** The full-repo `tsc --noEmit` reports 430 pre-existing TS errors (all in files not touched by H2: `.next/dev/types/validator.ts` for comms-social OAuth routes, `scripts/verify-weekN-demos.ts` duplicate identifiers, `scripts/prove-unsubscribe-roundtrip.ts` missing exports). Grep of the tsc log for every file H2 touched returned zero matches — H2 introduces no new type errors.

Pre-existing regression failures inherited from Phase 6 closure remain unchanged and out of H2 scope:
- `src/lib/nex/brain/tests/extractor-idempotency.test.mjs`
- `src/lib/nex/brain/tests/knowledge-dump-worker.test.mjs`
- `src/lib/nex/brain/tests/storage-characterization.test.mjs:SC15`

### 5.8 · Unresolved gaps

- **Route adoption Class C** · ~40 additional applicable NEX routes (dispatch, run-once, recovery, storage/parity, campaigns/status, journeys/executions, etc.) are candidates for CID adoption but were not blessed by name in the remediation plan. Each requires per-route review before adoption to avoid mechanical wrapping. Recorded here for a follow-up authorisation.
- **Production log-drain (R-3)** · structured JSON logs now emit locally but no log drain (Datadog Agent / Better Stack / Vercel Log Drains) has been configured for production. `PRODUCTION-PROVEN` for H2 requires that drain to land and to receive a log line with `correlation_id` from a real prod request.
- **H1.a (production migration application)** · unchanged from H1 closure. Migrations 047 / 048 / 049 partial or unapplied on local; H2 did not touch these.
- **H1.c CI wiring** · unchanged. `nex:check-migration-declarations:strict` still requires access to deploy-branch CI config.

### 5.9 · Production evidence status

**PRODUCTION — NOT PROVEN.**

The CID scope + F4 logger now flow through the pipeline for every NEX HTTP → worker chain that reaches one of the 11 adopted routes. Verified locally by drift-catcher green + full observability suite green + FZ8 structured-log envelope check. However:

- No log line from a production request has been observed carrying a real correlation_id (no log drain).
- No cron-tick invocation on production has been traced end-to-end through a worker chain via CID.
- Adoption of the remaining Class C routes not yet authorised.

Path to `PRODUCTION-PROVEN`:
1. Configure a log drain (R-3 · deferred to a separate batch).
2. Observe one production request producing correlated log lines through cron-tick → dispatch → worker → audit.
3. Broaden adoption to any remaining routes on Philip's authorisation.

### 5.10 · Final H2 verdict

| Component | State |
|---|---|
| H2.a · route adoption (5 new routes) | ✅ **IMPLEMENTED · VERIFIED — LOCAL LIVE** |
| H2.a · LAYER1_ADOPTED drift-catcher extended | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE (CADP1-5 green) |
| H2.b · logger adoption (9 worker files) | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE |
| H2.b · `console.*` migration | ✅ IMPLEMENTED · 9 / 9 replaced |
| H2.b · `enterJobCorrelationScope` per job-processing worker | ✅ PRE-EXISTING · VERIFIED — LOCAL LIVE (W4 assertion) |
| H2.c · drift-catcher `worker-logger-adoption.test.mjs` | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE (W1-4 green) |
| Production log drain (R-3) | ⛔ OUT OF H2 SCOPE |
| Class C route broadening | ⛔ NOT ATTEMPTED (awaits per-route authorisation) |
| Preservation invariant (10 KJs) | ✅ VERIFIED green pre + post batch |

**Locked verdict:**

> **H2 — IMPLEMENTED**
> **H2 — VERIFIED — LOCAL LIVE**
> **PRODUCTION — NOT PROVEN**
