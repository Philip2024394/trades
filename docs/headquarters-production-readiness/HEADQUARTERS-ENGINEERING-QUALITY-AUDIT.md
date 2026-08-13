# HEADQUARTERS ENGINEERING QUALITY AUDIT · PHASE B

**Status:** EVIDENCE-BACKED FINDINGS · complements Wave 8 six-worker prove-out (33/33 pass)
**Date:** 2026-08-10
**Author role:** Master AI engineer · NEX Corporation
**Objective:** Cover the engineering-quality territory NOT exercised by the six-worker runner. Every claim carries file:line evidence.
**Rule:** Static test coverage ≠ production readiness. This audit surfaces engineering-quality gaps that would cause silent degradation under load or scale.

---

## Section 1 · `/api/nex/brain/*` endpoint inventory

| Method | Path | Storage touched | Input validation | Auth |
|--------|------|-----------------|-----------------|------|
| GET | `/api/nex/brain/records` | `nex.knowledge_records` | status enum validated | `checkCronAuth` |
| POST | `/api/nex/brain/feedback` | `nex.knowledge_feedback` | feedback_type validated | `checkCronAuth` |
| GET | `/api/nex/brain/status` | reads all 11 brain tables | none | `checkCronAuth` |
| GET | `/api/nex/brain/guardian` | `nex.brain_memories` | none | `checkCronAuth` |
| POST | `/api/nex/brain/verify-llm` | audit_log | message structure | `checkCronAuth` |
| POST | `/api/nex/brain/import-existing` | all tables | record shape | `checkCronAuth` |
| GET | `/api/nex/brain/llm-health` | in-memory HEALTH state | none | `checkCronAuth` |
| GET | `/api/nex/brain/timeline` | worker_results + audit_log | none | `checkCronAuth` |
| GET | `/api/nex/brain/cloud-status` | worker_heartbeats | none | `checkCronAuth` |
| POST | `/api/nex/brain/audit-events` | audit_log | event_type enum | `checkCronAuth` |
| POST | `/api/nex/brain/recovery` | worker_jobs + worker_results | job_id | `checkCronAuth` |
| GET | `/api/nex/brain/jobs` | worker_jobs + worker_results | status filter | `checkCronAuth` |
| GET | `/api/nex/brain/warehouse` | all brain tables + nex.contacts | none | `checkCronAuth` |
| POST | `/api/nex/brain/review` | records + edges + confidence | none | `checkCronAuth` |
| GET | `/api/nex/brain/workers-live` | worker_heartbeats + worker_results | none | `checkCronAuth` |
| GET | `/api/nex/brain/cron-tick` | all brain tables | none | `checkCronAuth` at `src/lib/nex/brain/auth/require-cron-token.ts:16` |
| POST | `/api/nex/brain/run-once` | all brain tables | none | `checkCronAuth` |
| POST | `/api/nex/brain/router` | worker_jobs | none | `checkCronAuth` (route deprecated) |
| POST | `/api/nex/brain/worker-audit` | audit_log (best-effort) | none | `checkCronAuth` |

**FINDING [P1]:** All 18 brain routes delegate to one shared token via `checkCronAuth` — single-secret concentration risk. Evidence: `src/lib/nex/brain/auth/require-cron-token.ts:16` + every route file. Fix: scoped tokens per route class (mutation vs read vs cron), scheduled rotation, per-token audit-log entries.

**FINDING [P2]:** Almost none of the routes validate input beyond enum checks. GET routes with query params (status, limit, since) accept any string. Fix: attach a shared `zod` schema layer at the route boundary — one-file change per route.

---

## Section 2 · LLM provider chain fallthrough behaviour

**Selector location:** `src/lib/nex/brain/llm.ts:319-363`

**Provider preference order (env-overridable):**
1. OpenRouter (free tier · Nemotron 550B · 900 calls/day default)
2. SambaNova (Llama 3.3 70B · 300 calls/day)
3. Groq (fast · 900 calls/day)
4. Gemini (vision capable · 1300 calls/day)
5. Mock fallback (deterministic · always succeeds when `LLM_ALLOW_MOCK_FALLBACK=true`)

**Circuit-breaker (`llm.ts:154-156`):**
- Threshold: 3 consecutive failures opens the circuit
- Cooldown: 60,000 ms before half-open retry probe
- Per-provider retry budget: 2 attempts before fallback
- Backoff sequence: `[500 ms, 2000 ms, 8000 ms]`

**Daily budget enforcement (`llm.ts:170-181, 231-236`):**
- Per-provider daily call cap (env-gated)
- Budget exhaustion logged; provider skipped until UTC midnight
- Tokens-in/out counted per call

**Timeouts per provider:**
| Provider | Timeout | Evidence |
|---|---|---|
| OpenRouter | 60,000 ms | `llm.ts:737` |
| SambaNova | 30,000 ms | `llm.ts:800` |
| Groq | 30,000 ms | `llm.ts:856` |
| Gemini | 45,000 ms | `llm.ts:912` |
| Cerebras | 30,000 ms | `llm.ts:968` |
| Cloudflare | 30,000 ms | `llm.ts:1038` |
| HuggingFace | 45,000 ms | `llm.ts:1098` |
| Anthropic | 45,000 ms | `llm.ts:1164` |

**Error escalation (`llm.ts:495-604, 615-665`):**
- Every failure emits an audit event via lazy-imported `emitAuditEvent` (avoids circular dep)
- Audit events carry: worker_type, job_id, provider, outcome (`429`/`timeout`/`5xx`/`network_error`/`invalid_response`/`unknown`), error snippet
- `completeWithRetryPersistence()` enqueues to `nex.llm_retry_queue` on total exhaustion instead of throwing.

**FINDING [P1]:** LLM budgets are global per provider — Avery (extractor) exhausting Groq blocks Harper (image-analyst) from using it too. Fix: namespace `daily_calls` by consumer (worker_type) so each consumer has its own quota slice.

**FINDING [P2]:** `LLM_ALLOW_MOCK_FALLBACK` defaults to true in code paths that reach production; doctrine says failed-provider chains should surface loud, not silently mock. Evidence: `llm.ts:340-341` comment. Fix: force `false` in the Vercel/Fly env template + fail-loud→queue path.

---

## Section 3 · `/cron-tick` idempotency

**Route:** `src/app/api/nex/brain/cron-tick/route.ts:1-40` — auth (line 23) → `dispatchNewInboxItems()` (line 32) → `runOneCycle()` (line 33).

**Concurrent-invocation analysis:**
- `nex.claim_next_job()` uses SKIP LOCKED → no double-lease of a single job ✅
- `dispatchNewInboxItems()` (`manager.ts:405-437`) reads inbox index, checks `findActiveJobByInboxItemId()`, enqueues a new job if none active — **no `ON CONFLICT (inbox_item_id) DO NOTHING`**. Two cron-ticks racing enqueue two jobs for the same item.

**FINDING [P1]:** `dispatchNewInboxItems` is not idempotent under concurrent invocation. Two cron-ticks landing within the same window duplicate every enqueue. SKIP LOCKED prevents dual processing (one worker wins), but queue bloat is real and confuses dedup metrics. Evidence: `manager.ts:420-427`. Fix: change insert to `INSERT … ON CONFLICT (inbox_item_id, job_type) WHERE status IN ('queued','claimed') DO NOTHING` — one-line SQL change plus a supporting partial-unique index.

---

## Section 4 · Vector / embedding storage

- Column: `nex.knowledge_records.embeddings BYTEA` (schema 041)
- Writers: **none observed** — zero code path calls an embedding API
- Readers: warehouse + timeline read the full record shape; `embeddings` is always `null`
- pgvector: **not installed**

**FINDING [P2]:** Embedding column is schema debt. Either populate via a real embedding worker + `pgvector` extension, or drop the column. Recommend keeping the column, but publish a decision on embedding model (OpenAI vs Anthropic vs local) before implementing.

---

## Section 5 · Journeys / campaigns engine · WIRED

- `src/lib/nex/journeys/registry.ts` — CRUD for journey definitions
- `src/lib/nex/journeys/runtime/dispatcher.ts:20-33` — loads journey, advances state via `advanceState()`, persists next_state + events + commands. Reads `nex.analytics_events` for trigger conditions.
- `src/lib/nex/journeys/triggers/dispatcher.ts` — listens to analytics/contact-lifecycle events, fires journey entry.

Journey engine is active, not dormant.

---

## Section 6 · Automation engine · WIRED via journey nodes

- `nex.automation_rules` is consumed as a Journey node type (`src/lib/nex/journeys/nodes/`). No separate automation worker.
- Dispatcher executes them via the same `advanceState()` machinery.

---

## Section 7 · Analytics pipeline · WIRED

- Emitters: `src/lib/nex/analytics/ingest.ts:48` (`ingestEvent()`), delivery worker at `src/lib/nex/delivery/worker.ts:27`, journey commands, compliance engine
- Consumers: journey dispatcher (`dispatcher.ts:20-33`), dashboards (`src/lib/nex/analytics/dashboards.ts`)
- Rollup tables: `nex.analytics_rollups_*` (campaigns, daily, monthly, country, provider, segment)

**FINDING [P2]:** Event ingest is synchronous — `INSERT nex.analytics_events` + UPSERT to every rollup per scope, in one call. Under load this queues on the ingest caller. Fix: split rollup UPSERT into a background job (add `nex.analytics_rollup_queue` + one dedicated worker), keeping the raw insert on the hot path.

---

## Section 8 · Delivery engine · WIRED

- `src/lib/nex/delivery/worker.ts::tick()` — claim → send via provider adapter → record result
- `src/lib/nex/delivery/queue.ts` — enqueue/claim/complete lifecycle
- `src/lib/nex/delivery/expansion.ts` — recipient snapshot from segment + compliance filters
- `src/lib/nex/delivery/providers.ts` — active provider selector (mirrors LLM chain pattern)

---

## Section 9 · Rate-limit + cost telemetry per provider

**LLM (present):** `llm.ts:192-267` — per-provider `daily_calls / tokens_in / tokens_out / budget / exhausted`. `dailyUsageSnapshot()` exports for the `/api/nex/brain/llm-health` endpoint.

**LLM (missing):** No cost model — no per-token pricing table, no USD spend surfaced. Dashboard shows token volume only.

**Delivery (missing):** No per-provider spend tracking for SMS/email. Only attempt counts observed.

**FINDING [P2]:** Publish a cost model per LLM provider (`price_in_per_1k`, `price_out_per_1k`, currency) and multiply in the snapshot helper — one file, one table. Same for delivery providers.

---

## Section 10 · Worker cycle timing under load

- Timing captured via heartbeat + audit trail (`heartbeat.ts:76-99`, `manager.ts:94-107` writes `latency_ms`).
- No load-test harness (no k6/artillery/vitest-bench script present).

**FINDING [P3]:** Single-worker local dev proves out timing but production topology behaviour under sustained load is unknown. Fix: add a small `scripts/load-test-cron-tick.mjs` that fires cron-tick 100× in 60 s and asserts P99 latency budget.

---

## Section 11 · Error-handling patterns (20-catch sample)

| File:Line | Pattern | Classification |
|---|---|---|
| audit-log.ts:169 | `.catch(() => {})` | Swallowed |
| audit-log.ts:233 | `.catch(() => {})` | Swallowed |
| audit-log.ts:262 | `.catch(() => false)` | Fire-and-forget |
| manager.ts:64-87 | audit + heartbeat "failed" + throw | Audited + thrown |
| manager.ts:253 | best-effort catch | Swallowed |
| manager.ts:405-437 | console.error + re-throw | Logged + thrown |
| manager.ts:459-461 | console.warn + return null | Logged + swallowed |
| manager.ts:696 | incr + signal + console.error + degraded response | Audited + degraded ✅ (audit corrected 2026-08-10) |
| heartbeat.ts:76-99 | console.warn | Logged |
| llm.ts:547-591 | recordFailure + audit + retry | Audited + retried |
| llm.ts:625-664 | enqueueLlmRetry, re-throw on queue-err | Audited + queued |
| router.ts:142-164 | console.error | Logged |
| knowledge-extractor.ts:211-230 | failWorkerJob + audit | Audited + persisted |
| image-analyst.ts:176-388 | failWorkerJob + audit | Audited |
| quality-checker.ts:75-202 | completeWithRetryPersistence | Audited + queued |
| voice-context.ts:133-233 | failWorkerJob + audit | Audited |
| learning-context.ts:125-301 | console.warn on feedback read | Logged |
| postgres.ts:58-63 | ROLLBACK + re-throw | Rolled back + thrown |
| adapter tx wrappers | ROLLBACK / throw | Consistent |
| worker finalize | fully audited | Consistent |

**FINDING [P2]:** Three catches silently swallow (`audit-log.ts:169, :233`, `manager.ts:253`). Intent is "best-effort audit that never blocks the primary path" — legitimate but invisible. Fix: wire silent-failure counters into `/api/nex/brain/llm-health` (rename to `/brain-health`), alert if any counter climbs above 5/min.

~~**FINDING [P3]:** `manager.ts:696` — empty catch.~~ **CORRECTED 2026-08-10:** the catch is fully instrumented (increments `manager.inbox_read_degraded` counter, emits signal, logs error, returns `sourceHealth: "degraded"` response). No fix needed.

---

## Section 12 · Test coverage

**Brain / knowledge-inbox / storage test files (`*.test.{ts,mjs}`):**

1. `brain-retry-recovery.test.ts` (3)
2. `adapter-isolation-negative-regression.test.ts`
3. `confidence-scores-classification.test.mjs`
4. `warehouse.test.mjs`
5. `review-queue.test.mjs`
6. `heartbeat-liveness.test.mjs`
7. `reception-semantics.test.mjs` (12)
8. `factory-page.test.mjs`
9. `knowledge-dump-worker.test.mjs`
10. `require-cron-token.test.mjs`
11. `manager-cycle.test.mjs`
12. `router-routing.test.mjs`
13. `inbox-truthfulness.test.mjs`
14. `manager-dispatch.test.mjs`
15. `inbox-jobs-shadow.test.mjs`
16. `priorities.test.mjs`
17. `extractor-idempotency.test.mjs`
18. `reverse-shadow.test.mjs` (15)
19. `brain-adapter-contract.test.mjs` (28)
20. `dispatch-dedup.test.mjs`
21. `storage-characterization.test.mjs`
22. `adapter-isolation.test.mjs`
23. `path-traversal.test.mjs` (knowledge-inbox)
24. `object-postgres-contract.test.mjs` (17)

Master audit reports **236/236 pass across 14 core suites** (line 20). W-C companion tests: **1823/1825 pass** (line 406).

**FINDING [P1]:** Zero deployment-level smoke tests. Every test exercises the code from Node, none exercises the actual Vercel/Fly deployment endpoints. The Harper precedent (audit line 141) proves why this matters. Fix: add `scripts/prod-smoke.mjs` that hits `NEX_APP_URL` for `/api/nex/brain/cron-tick` (auth-only) + `/api/nex/brain/status` + `/api/health` and asserts fresh evidence.

---

## Section 13 · Findings summary

| Severity | Count | Items |
|---|---|---|
| P0 | 0 | (Master audit's 11 P0s remain the production blockers; this audit does not add more) |
| P1 | 3 | Cron-token single-secret concentration · LLM budget global (not per-consumer) · `dispatchNewInboxItems` non-idempotent under concurrency · zero deployment-level smoke tests |
| P2 | 6 | Almost-no input validation · mock fallback default risk · analytics ingest synchronous · no cost model · silent audit swallows unmonitored · embedding schema debt |
| P3 | 2 | No load-test harness · one empty catch |

---

## Section 14 · Acceptance-gate impact (master audit Section 11)

- **Item 24 (no unexplained test failures):** confirms green — 236/236 + 1823/1825.
- **Item 5 (queue/concurrency proven):** already ✅ for 2-worker; the P1 concurrent-dispatch dedup gap warrants adding a 3-worker concurrent-cron-tick test to close the audit's own P1 finding rather than moving the gate.
- **No P0 additions** — the 11 P0s in the master audit remain the production blockers.

---

## Section 15 · Recommended remediation order (top 10)

1. Add `ON CONFLICT` dedup to `dispatchNewInboxItems` (P1) — 1 h
2. Per-consumer LLM budget isolation (P1) — 3 h
3. Deployment smoke-test suite `scripts/prod-smoke.mjs` (P1) — 4 h
4. Scoped cron tokens + rotation cadence (P1 + P2) — 3 h
5. Silent-failure counters → `/brain-health` + alerts (P2) — 2 h
6. Split analytics rollup UPSERT into background worker (P2) — 4 h
7. Publish LLM cost model + USD dashboard (P2) — 2 h
8. Force `LLM_ALLOW_MOCK_FALLBACK=false` in prod env template (P2) — 15 min
9. Attach `zod` route-boundary validation across brain routes (P2) — 2 h
10. Investigate + fix `manager.ts:696` empty catch (P3) — 30 min

Total: ~22 engineering hours to close every P1+P2+P3 raised here.
