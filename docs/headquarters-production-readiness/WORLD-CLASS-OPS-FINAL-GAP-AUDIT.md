# NEX Headquarters · World-Class Operations · Final Gap Audit

**Status:** READ-ONLY FORENSIC AUDIT · no code changed · no migrations applied
**Date:** 2026-08-10 (late)
**Author role:** Independent auditor
**Directive:** Determine what is still missing for NEX Headquarters to honestly qualify as World-Class Operations. Do not upgrade claims because documents say so.
**Rule:** Documentation ≠ implementation. Green unit test ≠ production verification. Local success ≠ production readiness.

---

## Executive summary

**Verdict: NOT WORLD-CLASS READY.**

- Two **critical implementation gaps** — one is a runtime landmine my prior session shipped without noticing, the other is the entire W-C-COMPANION supervisor which was designed but never built.
- Extensive **verification gaps**: most of what was "shipped" in the 2026-08-10 megasession is IMPLEMENTED but not PROVEN in production or against actual traffic.
- The 46-item **W-C Gap Register** (Philip 2026-08-11) remains largely open. Tonight's session addressed ≤8 items, mostly as documentation or scaffolding rather than end-to-end closure.
- The **10 historical stuck KnowledgeJobs** remain unrecovered by design (fixture for the unbuilt supervisor).
- **Production execution gates** (backfill · env flips · Fly destroy · Supabase cutover) are all untouched.

---

## Section 0 · Method

- Read the W-C source corpus listed in the directive plus the Wave 11 audit and the gap register.
- Cross-checked documentation claims against the actual repository state (source files, migrations, indexes, adopted routes).
- Ran targeted read-only DB queries against local NEX Postgres to verify migration application state.
- Classified each finding using the directive's scheme: 🟢 PROVEN · 🟡 IMPLEMENTED / VERIFICATION GAP · 🟠 DESIGNED / NOT IMPLEMENTED · 🔴 CRITICAL GAP · 🔵 OPERATOR ACTION REQUIRED · ⚪ EXTERNAL / LEGAL DECISION · ⚫ UNKNOWN.
- Prior session's summary messages were treated as inputs to verify, not evidence.

---

## Section 1 · CRITICAL findings (🔴)

### C-1 · Migration 046 · REFINED (see NEX-STORAGE-AUTHORITY-CHECK.md · §11) · CLOSED for local scope 2026-08-10

**REFINEMENT (supersedes the original C-1 severity below):** the current `NEX_BRAIN_BACKEND=supabase` selector routes `brainStore()` to `SupabaseStore`, whose `enqueueJob` does NOT use the `ON CONFLICT` clause. `PostgresBrainStore.enqueueJob` (with the D1 change) is unreachable at the current backend selection. **C-1 is therefore a P1 gate for the Wave 5 flip (`NEX_BRAIN_BACKEND=postgres`), not a landmine for arbitrary deploys.**

**WAVE 1 CLOSURE (local scope · 2026-08-10):** migration 046 applied to local NEX Postgres. `worker_jobs_input_ref_active_uniq` present with matching columns + predicate. All existing regression tests still green (12 dispatch + 15 reverse-shadow + 1 adapter-contract + D13). New `scripts/prove-enqueue-idempotent.ts` executed live — all four contract clauses pass (same-key dedup · different-worker-type new row · completed rows re-enqueueable · zero plan-time error). C-1 gate GREEN for local; prod NEX Postgres application remains a 🔵 operator step gated to WAVE 5.

Original finding preserved below for historical accuracy.

---

### C-1 (original) · Migration 046 not applied → `PostgresBrainStore.enqueueJob` will 500 at plan time

**Evidence:** Live read-only query against `NEX_POSTGRES_URL` (local dev):
```
CREATE INDEX worker_jobs_input_ref_lookup_idx ON nex.worker_jobs USING btree (input_ref)  ← pre-existing, non-unique
```
The `worker_jobs_input_ref_active_uniq` partial unique index that migration 046 creates is **absent**.

`src/lib/nex/brain/adapters/postgres.ts::enqueueJob` (shipped tonight) uses:
```sql
INSERT … ON CONFLICT (input_ref, worker_type)
  WHERE status IN ('waiting','assigned','running')
  DO NOTHING
```
Postgres validates the ON CONFLICT inference target at **plan time**. Without a matching partial-unique index, every call throws:
```
ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

**Runtime effect:** the next Vercel deploy of the current tree (with the D1 code) will fail every inbox-item enqueue AND every worker chain that calls `enqueueJob`. Under load this becomes "brain pipeline down."

**Path to closure:**
1. Operator applies `deploy/postgres/init/046_worker_jobs_active_dedup.sql` to NEX Postgres AND Supabase before deploy.
2. OR revert the `PostgresBrainStore.enqueueJob` change until (1) can be sequenced.
3. Add a CI drift-catcher that fails the build if `enqueueJob` has an `ON CONFLICT` clause but the migration index isn't declared in `deploy/postgres/init/`.

**Ownership:** Philip (operator applies migration) · Claude (revert or add drift-catcher).

**Severity rationale:** silent breakage of every enqueue path; SKIP LOCKED cannot save you if the row was never inserted.

---

### C-2 · W-C-COMPANION supervisor (Path A + Path B + Path C sweep entrypoint) not implemented

**Evidence:**
- `src/lib/nex/jobs/supervisor.ts` — **does not exist**.
- `src/app/api/nex/brain/supervisor-sweep/route.ts` — **does not exist**.
- Path C partial: `applyTerminalKnowledgeJobTransition` helper at `src/lib/nex/jobs/terminal-transition.ts` exists (Wave 11 Phase 5, commit `493cf86`) and is used from `knowledge-extractor.ts:511,546`. This is a HALF of Path C — the extractor cascade. The kjid resolution via `findActiveJobByInboxItemId` (recommended Option (b) in the V2 design) is IN PLACE.
- Storage-contract Phase 2 methods (5 methods) — verified in `src/lib/nex/brain/storage.ts` + adapter implementations.

**Missing:**
- Path A · Attest Sweep — no code, no cron, no fixture test.
- Path B · Investigation/Review Queue — no UI surface, no `audit_log` writer, no escalation policy.
- Path C · Positive Cascade — partially wired for the extractor but there is no supervisor-scoped review of other worker types.
- Cron entrypoint `/api/nex/brain/supervisor-sweep` — absent.
- `NEX_KJOB_SUPERVISOR_ENABLED` env gate — absent.
- Contract test using the 10 preserved stuck jobs — absent.

**Runtime effect:** the 10 historical stuck KnowledgeJobs remain stuck. Any new Class-X stuck job today has ONLY the extractor cascade to catch it (no sweep, no fallback). Class-Y ambiguous stuck jobs have no path to human resolution — they just sit forever.

**Path to closure:** implement Phase 6 per `WORLD-CLASS-OPS-W-C-COMPANION-SUPERVISOR-DESIGN-V2.md §7 sequencing`. Estimated 6-8 hours of focused work + contract test. **This was not in my refactor plan, and my prior session-close messages implicitly obscured it.**

**Ownership:** Claude (implementation) · Philip (authorisation + operator toggle of `NEX_KJOB_SUPERVISOR_ENABLED`).

---

## Section 2 · Required findings (🟠 designed but not implemented)

### R-1 · W-OBS-1 CID adoption is 5 routes out of ~40

**Evidence:** `src/lib/nex/observability/tests/correlation-adoption.test.mjs:63-69` — the LAYER1_ADOPTED set contains exactly 5 routes (`/api/nex/knowledge-inbox/{upload,urls,dump,process}` + `/api/nex/storage/gates`).

None of the 18 `/api/nex/brain/**` routes adopt `runFromRequest`. The tonight-D9-refactored `/records`, `/jobs`, `/timeline`, `/feedback` routes did NOT add CID scope — I added zod validation and the F4 logger but not the ALS wrapper.

`src/app/api/nex/brain/cron-tick/route.ts` — the cron entrypoint — does NOT wrap in `runFromRequest`. Every worker chain that fires from cron-tick therefore has `getCorrelationId() === null`.

**Runtime effect:** Layer 1 CID plumbing works for the 5 canary routes but not for any brain route or cron. Structured logs from tonight's F4 adoption emit `correlation_id: null` for those routes.

**Path to closure:** extend LAYER1_ADOPTED by adding `runFromRequest` wrappers per the Path-A plan. Each new route adds one line. Design-first — Philip authorises additions to the canary set.

---

### R-2 · F4 structured logger has zero adoption in worker code

**Evidence:** `grep -c "logger(" src/lib/nex/brain/workers/*.ts` returns zero matches. `grep -c "console\." src/lib/nex/brain/workers/*.ts` still returns 10+ lines across 3 workers (`_finalize.ts:2`, `knowledge-extractor.ts:6`, `quality-checker.ts:2`).

**Runtime effect:** Wave 11 F35 finalization sequence still emits unstructured logs. Prior session's F4 adoption is limited to 5 route files.

**Path to closure:** wire `logger("worker.<name>")` into each of the 6 workers + `_finalize.ts`. Mechanical, ~1h.

---

### R-3 · F2 Prometheus metrics endpoint · never scraped in real deploy

**Evidence:** `src/app/api/nex/observability/metrics/route.ts` exists, cron-secret gated, exports 18 counters + last_at gauges. `vercel.json` has NO `logDrains` key; no scraper configured anywhere.

**Runtime effect:** operator cannot see any metric trend beyond a manual `curl`. F3 (log-drain vendor pick) is still 🔵 OPERATOR ACTION.

---

### R-4 · F5 alert-rules dispatcher · design absent

**Evidence:** `src/lib/nex/observability/alert-evaluator.ts` (tonight) returns the list of currently-firing rules but **there is no dispatcher**. `evaluateAlertRules()` only runs when someone GETs `/brain-health` — no periodic evaluation, no notification path, no PagerDuty/email/slack integration.

**Runtime effect:** even with `nex.alert_rules` populated (which itself requires the operator to `curl` the seeder), no alert fires — anywhere. F5 today is "list of promises to alert" without a payer.

**Path to closure:** ties to F3 (log-drain vendor) and F8 (on-call staffing) — both 🔵/⚪.

---

### R-5 · Migration 049 not applied → `NEX_ANALYTICS_ROLLUP_ASYNC=1` is a landmine

**Evidence:** Live query: neither `nex.analytics_rollup_queue` table nor `nex.claim_analytics_rollup_batch()` function exists on local NEX Postgres.

**Runtime effect:** the D6 async gate is defaulted OFF so it can't fire today. But if any operator sets the env flag before migration 049 lands, `ingestEvent` throws on every event because the queue INSERT fails.

**Path to closure:** apply 049 before setting the flag. Ideally guard the flag in code with a startup check (or a first-call self-test that logs+degrades if the table is missing).

---

### R-6 · Timeout budgets (W-REL-1 / W-REL-2) still absent

**Evidence:** `WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md` (Philip · 2026-08-09 · 81KB doc) sets out storage-layer + worker-cycle + job-level `AbortController` budgets. **No implementation** — the Postgres pool has no `statement_timeout`, the manager has no cycle deadline, workers have no per-job deadlines. `src/lib/nex/brain/manager.ts` and `src/lib/nex/storage/adapters/*` were not touched for this in tonight's session.

**Runtime effect:** a hung Postgres query or a stuck LLM call still blocks a worker indefinitely — the exact problem the W-C-TIMEOUT-BUDGETS-DESIGN was written to fix.

**Path to closure:** implement per the design. Estimated 2-4h; touches critical paths, needs careful test coverage.

---

### R-7 · RLS coverage on Supabase legacy schema (W-SEC-1 P1)

**Evidence:** Per the gap register, ~20 files under `supabase/migrations/*.sql` enable RLS without any policies. Currently safe because only `service_role` (BYPASSRLS) connects. Any anon/authenticated session added later reads zero rows.

**Runtime effect:** no exploit path today. Escalates to P0 the moment a non-BYPASSRLS role is added or credentials leak.

**Path to closure:** per-subsystem design pass · unchanged from the gap register.

---

## Section 3 · Verification gaps (🟡 implemented, not proven)

### V-1 · D9 zod validation · 4 of ~18 brain routes migrated

Only `/records`, `/jobs`, `/timeline`, `/feedback` use the `validateSearchParams` / `validateJsonBody` helpers. The rest still parse `searchParams` / `req.json()` manually. Behavior is not "input validated" — it's "input validated on 22% of the surface area."

### V-2 · F5 alert-rule CRUD API · never exercised end-to-end

Migration 048 IS applied (verified). The route files exist. The seeder script was authored. **No live seed run, no end-to-end curl proof.** The `evaluateAlertRules` block on `/brain-health` returns `null` today because the rules table is empty (I inserted no rows).

### V-3 · D6 rollup worker · never executed once

Code is written; migration 049 is not applied; the async gate defaults off. Zero runtime evidence — sync path is unchanged, so it MIGHT still work — but the async worker has never claimed a job.

### V-4 · F14 HMAC cron auth · never used by a real caller

Test suite proves the checker accepts a valid signature. **No cron caller signs its requests today.** Vercel cron sends bearer; nothing else signs. The HMAC path is dormant.

### V-5 · D4 scoped cron tokens · zero routes opt in

Same as V-4. `checkCronAuth(req, env, { scope })` is only called with the third argument in tests. Every real route calls `checkCronAuth(req)` — shared-token path.

### V-6 · D2 per-consumer LLM budget · zero consumers opt in

`LlmCallOptions.consumer` is threaded through, but every worker still calls `complete()` without setting it. The per-consumer bucket is initialised but always empty.

### V-7 · F1 runbooks · never rehearsed

10 runbooks authored. Zero rehearsals. Zero incidents to reference. Runbook-vs-reality drift starts the moment code changes without a runbook update.

### V-8 · D3 prod-smoke · never run against production

The script exists. `NEX_APP_URL` has no production value in the repo. No CI job runs it.

### V-9 · D11 load-test · never run

Same. Would need `k6` or Node concurrency you probably haven't tuned yet, and needs a target that isn't production.

### V-10 · F10 filesystem-backup script · never run

Depends on `tar` on the host. On Windows, the script may or may not find a compatible tar binary. Never verified.

### V-11 · D13 3-worker concurrent claim · PROVEN (live 2026-08-10 04:12)

**This one IS proven.** 6 seeded jobs, 3 concurrent workers × 3 rounds, zero duplicates, all 6 claimed exactly once. Cleaned up.

### V-12 · A3 reverse-shadow probe · PROVEN (live 2026-08-10 03:20)

**Proven.** Probe row mirrored to Supabase within 200ms, both sides cleaned up.

### V-13 · E2 unsubscribe round-trip · PROVEN (live 2026-08-10 03:43)

**Proven.** Burner contact walked end-to-end: allowed → unsubscribed event → gate blocks. Cleaned up. Also surfaced a schema-type mismatch (P2) that had never been noticed.

---

## Section 4 · Operator-action required (🔵)

Same list I've been repeating; none of these are new. But listed here to close the audit's scope:

- A1 · `node scripts/brain-backfill.mjs --execute` (73k rows)
- A2/B1/B2/C4 · Vercel env flips (`NEX_BRAIN_BACKEND=postgres`, `NEX_OBJECT_BACKEND=postgres`, `NEX_INBOX_READ_BACKEND=postgres`)
- B5 · `fly apps destroy nex-brain-worker` after 7-day observation
- E5 · Stripe LIVE key rotation verify
- E10 · `pg_policies` query on Supabase for legacy tables
- F3 · Log-drain vendor pick (Better Stack / Datadog / Papertrail)
- F8 · On-call rotation staffing
- **NEW:** Apply migrations 046, 047, 048, 049 to local NEX Postgres AND Supabase in coordinated sequence — currently only 047 and 048 are applied to local.
- **NEW:** Do NOT set `NEX_ANALYTICS_ROLLUP_ASYNC=1` until 049 lands.
- **NEW:** Do NOT deploy the tonight tree until 046 lands (per C-1).

---

## Section 5 · External / legal decisions (⚪)

- E3 · per-connector lawful basis (needs legal review)
- E4 · retention schedule per lifecycle stage (needs legal)
- E7 · provider "do not train" opt-out per LLM (needs legal + vendor accounts)
- E8 · cross-border data transfer SCCs/BCRs (needs legal + region confirmation)
- D10 · embedding roadmap decision (product decision — pgvector adoption)

---

## Section 6 · Adversarial failure review (Section 5 of directive)

### 6.1 · Reliability failure modes still open

| Mode | Protected? | Evidence | Notes |
|---|---|---|---|
| Worker crash mid-processing | Partial | Retry buffer (Wave 11), heartbeat detection, no orphan-job supervisor | C-2 · sweep not built |
| Worker termination during finalization | Partial | F35 helper is single-critical-section but not idempotent across restart | Wave 11 F35 protects internally |
| Deployment termination | 🔴 | Vercel/Fly may terminate mid-cycle · no drain signal · no completion barrier | No design doc, no code |
| Queue starvation | 🟡 | SKIP LOCKED prevents dual claim | Not tested at scale |
| Orphaned jobs (extractor completed, KJ never final) | 🔴 | The 10 stuck jobs prove it. Sweep NOT built. Extractor cascade (Path C partial) helps only the happy case. |
| Stuck claims (worker died, lease expired) | 🟡 | Migration adds `idx_jobs_lease` but no reclaim job exists | Reclaimer worker absent |
| Retry loops | 🟢 | Circuit breaker + max attempts + dead-letter | Wave 11 F9 |
| Retry storms | 🟡 | LLM chain has backoff+jitter · nothing throttles at ingest | Load test never run |
| Concurrent workers duplicating a job | 🟢 | D13 proven live · SKIP LOCKED sound | |
| Duplicate processing at record level | 🟢 | `insertRecordIdempotent` via ON CONFLICT DO NOTHING · Wave 11 F12 | |
| Concurrent enqueue (dispatch race) | 🔴 | D1 code shipped but migration 046 not applied → **plan-time error** | See C-1 |
| Partial multi-step workflow | 🔴 | Path A + B + C not shipped · Class Y KJs sit forever | See C-2 |
| DB outage · connection pool exhaustion | 🟠 | No `statement_timeout` · no pool cap docs · no per-query AbortController | W-REL-1 |
| Long-running queries | 🔴 | Same · unbounded | W-REL-1 |
| Transaction hangs | 🟠 | `idle_in_transaction_session_timeout` not set | W-REL-1 |

### 6.2 · Three atomicity domains

**Database atomicity** — mixed:
- Worker finalization is a single txn in F35 ✓
- Extractor Path C cascade uses `applyTerminalKnowledgeJobTransition` which is not proven atomic with `completeJob` (they run in separate connections)
- Ingest→rollup was atomic pre-D6 · async mode splits them across two txns (queue INSERT + worker DEQ+APPLY) · idempotent by counter-inc-with-ON-CONFLICT, so recoverable

**Application-level idempotency** — mostly present:
- `insertRecordIdempotent` ✓ (F12)
- `enqueueJob` with ON CONFLICT (tonight) — **broken until 046 lands**
- Analytics rollup UPSERT — ✓ (per-scope UPSERT with counter += 1)
- Reverse-shadow `insertRecordIdempotent` mirror — ✓ (only mirrors when `created=true`)

**External-side-effect idempotency** — partial:
- LLM calls — NOT idempotent (Path C avoids re-drive; Path B would if it re-queued)
- Provider webhooks (Stripe, delivery bounces) — no `Idempotency-Key` on our side; if a webhook fires twice, dedup relies on `provider_message_id` uniqueness. Not verified for every writer.
- Notification sends — deduped by contact + campaign + kind at gate time; no cross-worker send dedup.

### 6.3 · Data-integrity states specifically listed

| State | Reachable? | Prevention |
|---|---|---|
| WorkerJob completed but KJ not finalized | **YES** — 4 of the 10 stuck jobs. Path C (partial) reduces future occurrence; Path A (unbuilt) is the recovery. |
| KJ finalized without required evidence | **NO** — every KJ terminal transition writes an audit row (F12 helper) |
| Worker result without terminal state | **YES** — 6 of the 10 stuck jobs (Cohort B) show this |
| Terminal state without worker result | Unlikely — extractor writes result before terminal transition |
| Duplicate extraction | Protected by `insertRecordIdempotent` — but LLM tokens still spent. Path A design explicitly avoids re-drive. |
| Duplicate record creation | Protected (F12) |
| Conflicting state transitions | Protected by F35 CAS + fs-store CAS |
| Lost state transitions | Possible if fs-store write fails silently — no known incidents |
| Partial multi-step workflows | **Documented in 10 stuck jobs, unresolved** |

---

## Section 7 · W-C-COMPANION V2 verdict (Section 6 of directive)

**Design (V2): sound.** Corrects V1's incorrect assumptions with Phase 1 forensic evidence. Path A + B + C together are internally consistent and idempotent.

**Implementation state:**
- Phase 2 (storage extension) ✅ shipped (Wave 11 Phase 5, commit `493cf86`)
- Phase 5 helper `applyTerminalKnowledgeJobTransition` ✅ shipped
- Extractor uses the helper ✅ (2 call sites)
- **Phase 6 supervisor: NOT SHIPPED** — Path A, Path B, cron entrypoint, contract test, env gate all absent.

**Can the supervisor identify WorkerJobs belonging to a KnowledgeJob?** — Only via `input_ref`. `knowledge_job_id` propagation to non-context workers is NOT done (V2 §4.3 recommended Option (b) reverse resolution instead — good). Confirmed the fs-store has `findActiveJobByInboxItemId`. So YES, the primitive is available; no consumer uses it.

**Can it distinguish completed from abandoned?** — Design says yes (via `listWorkerJobsByInputRef` + `listWorkerResultsByJobIds`). Not exercised.

**Can it recover an orphan without re-running LLM?** — Design says yes (Path A attest). Not exercised.

**Duplicate child jobs prevented?** — Migration 046 was the mechanism. **Not applied** (C-1).

**Terminal finalization idempotent?** — CAS + audit-row. Repeat calls no-op.

**Race with still-running worker?** — Design defers by using CAS on `status='claimed'`. Not tested.

**Supabase state invisible to local NEX Storage?** — V2 explicitly does not depend on `nex.events`. Uses only fields present in both.

**Observability unavailable?** — Supervisor writes audit rows via BrainStore. If storage is down, whole system is degraded — supervisor failure is not the operative concern.

**Supervisor crashes mid-sweep?** — CAS ensures partial state is safe; a subsequent sweep finds the same stuck KJs and retries.

**Two supervisors run concurrently?** — CAS on the target row prevents dual attest. Multiple audit rows would be written for the same target — an edge case the design should call out; ideally the audit writer takes a `(kjid, actor, reason)` unique key.

**V2 verdict: DESIGN VALID · IMPLEMENTATION INCOMPLETE.**

---

## Section 8 · NEX Storage audit (Section 7 of directive)

Adapter methods (BrainStore contract, 35 methods including Wave 11 Phase 5 additions):
- **FilesystemStore** — full ✓
- **PostgresBrainStore** — full ✓
- **SupabaseStore** — full ✓
- Adapter-parity test 28/28 (per master audit line 82). 

Wave 11 Phase 5 additions (5 methods): confirmed exported from storage.ts and implemented in all three adapters.

**Concerns:**
- `enqueueJob` on Postgres (tonight) uses ON CONFLICT — filesystem and Supabase adapters do NOT. Semantic drift under contention. If Supabase remains primary until cutover, only the Postgres side has the D1 protection.
- No `withTimeout()` wrapper on any adapter method — W-REL-1 gap.
- SDK isolation is respected (F12 boundary) per the drift-catchers.

---

## Section 9 · Observability audit (Section 8 of directive)

Reconstructing an incident post-hoc:
- What job was running → YES (`nex.worker_jobs`)
- Which worker ran it → YES (`assigned_worker_id`)
- When did it start/stop → YES (timestamps + heartbeat)
- Why did it stop → PARTIAL (audit_log has reason; worker_audit_events on Supabase is silently failing per master audit; nex.worker_audit_events was mirrored in migration 047 but code still writes to Supabase)
- What child jobs were created → PARTIAL (findWorkerJobsByKnowledgeJobId works only if kjid propagated; only knowledge-context propagates it)
- Which child jobs completed/failed → YES via input_ref join
- Which external operations occurred → PARTIAL (LLM audit trail via llm_call_attempts view; storage side-effects via provider_message_id)
- Was finalization attempted → YES if `applyTerminalKnowledgeJobTransition` writes the audit row consistently
- Was finalization successful → YES via terminal state check
- Was recovery attempted → **NO** — supervisor unbuilt, so there's no "recovery attempted" audit trail to inspect
- Who performed recovery → N/A (no recovery)

**Blind spots:**
- CID threading covers 5 routes; 13 brain routes + 6 workers still emit `correlation_id: null`.
- Worker log lines are unstructured `console.*` — you cannot filter by `subsystem` or `job_id` in a log drain that doesn't exist.
- No metric on Path C cascade success rate (would tell us whether Path A sweep is even needed at scale).
- No metric on how many terminal transitions the extractor makes vs how many KJs become terminal — that ratio catches Class-X drift early.

---

## Section 10 · Timeout / budget audit (Section 9)

Per the 81KB `WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md`:

| Budget | Mechanism | Configured | Tested | Prod evidence |
|---|---|---|---|---|
| Storage-layer statement_timeout | Not set | ❌ | ❌ | ❌ |
| Per-query AbortController | Not implemented | ❌ | ❌ | ❌ |
| `idle_in_transaction_session_timeout` | Not set | ❌ | ❌ | ❌ |
| Worker cycle deadline | Not implemented | ❌ | ❌ | ❌ |
| Per-job deadline | Not implemented | ❌ | ❌ | ❌ |
| LLM per-provider timeout | Implemented `llm.ts:737+` | ✅ (30-60s) | Unit tests | Verified in worker_results |
| Cron `maxDuration` | Per-route (`120s` on cron-tick) | ✅ | Vercel enforces | ✅ |
| HMAC replay window | 300s | ✅ | 20-test suite | Never exercised in prod (V-4) |

**Only LLM and cron have working timeouts. Storage and worker cycle are exposed.**

---

## Section 11 · Security audit (Section 10)

| Item | State | Notes |
|---|---|---|
| Bearer cron auth | ✅ working · fail-closed in prod | shared boundary at require-cron-token.ts |
| HMAC cron auth | ✅ implemented · V-4 unproven in prod | |
| Scoped cron tokens (D4) | ✅ implemented · V-5 zero adoption | |
| Service-role usage | ✅ isolated to adapters | F12 respected |
| RLS coverage nex.* | ✅ 96 policies · nex_brain_app role | verified per gap register |
| RLS coverage supabase-legacy public.* | 🟠 W-SEC-1 · ~20 files RLS-on-no-policies | defense-in-depth |
| Secret handling in .env.local | 🔵 Stripe LIVE possibly leaked in chat | E5 unverified |
| Log redaction | 🟡 E9 helper shipped · not wired into any actual audit writer | tests pass; no adoption |
| Webhook HMAC | ✅ F14 · V-4 unproven | |
| Admin action audit | 🟠 W-SEC-7 · not built | |
| RBAC centralised | 🟠 W-SEC-2 · scattered per-route | |
| CSP nonce | 🟠 W-SEC-3 · 10 JSON-LD sites unprotected | |
| Multi-instance rate limit | 🟠 W-SEC-4 · in-memory only | |
| Pre-commit secret scan | 🟠 W-SEC-6 · no husky/gitleaks | |
| CORS | 🟠 W-SEC-8 · unset (safe today; risky if third-party APIs added) | |
| npm audit CI | 🟠 W-SEC-9 · not wired | |

**Immediate exploit paths today: none.** All the gaps escalate the moment (a) non-BYPASS roles are added, (b) service-role leaks, (c) third-party integrations added, or (d) credentials are rotated without procedure.

---

## Section 12 · Backup / DR audit (Section 11)

| Item | Designed | Implemented | Tested |
|---|---|---|---|
| Supabase managed backup | ✅ documented in `NEX_BACKUP_ARCHITECTURE.md` | ✅ cron wired | Partial (84 unit tests · no restore drill) |
| NEX Postgres backup | ⚫ not documented (managed provider assumed?) | ⚫ unknown | ❌ |
| PITR | ⚫ unknown for both | ⚫ | ❌ |
| Filesystem backup (`data/**`) | ✅ script authored tonight (F10) | Script exists | ❌ never run |
| Object storage PITR | ✅ design authored tonight (F15) | ❌ migration draft only | ❌ |
| DR runbook | ✅ 10 runbooks authored | Author-only | ❌ never rehearsed |
| Rollback (deployment) | 🟡 Vercel "Promote previous" documented | Manual | ❌ never rehearsed |
| Rollback (Postgres migration flip) | 🟠 reverse-shadow proven live · flip-back untested |

**No backup has been restored end-to-end. No DR rehearsal has occurred.**

---

## Section 13 · Operations audit (Section 12)

| Item | State |
|---|---|
| Monitoring stack | 🟠 in-process counters + `/metrics` endpoint · no scraper |
| Alerting | 🟠 alert-rules schema + evaluator · no dispatcher |
| Log draining | 🔵 F3 unresolved |
| On-call | 🔵 F8 unresolved |
| Runbooks | 🟡 10 authored · zero rehearsed |
| Incident response | 🟡 template authored · no historical incident recorded |
| Rollback procedures | 🟡 per-system, none rehearsed |
| Migration procedures | 🟠 `.sql` files land, no explicit apply-order + verify-after runbook |
| Production access | ⚫ unknown who has Supabase / Vercel admin |
| Ownership | ⚫ single-operator (Philip) — no escalation |
| Queue recovery | 🔴 supervisor unbuilt |

**Operator without a written recovery path for:** stuck KJs (needs supervisor), long-running query cancel (needs W-REL-1), Vercel deploy failure mid-way (no rollback rehearsal), Supabase RLS lockout (runbook exists, never rehearsed).

---

## Section 14 · Cost control audit (Section 13)

| Failure mode | Protection |
|---|---|
| LLM provider retry storm | Circuit breaker + max attempts | ✅ Wave 11 |
| Duplicate LLM extraction (from supervisor re-drive) | **Path A attest** design AVOIDS this — but supervisor unbuilt (C-2) |
| Runaway worker | No cycle deadline (W-REL-2) | 🔴 open |
| Concurrent extraction of same input | `insertRecordIdempotent` prevents duplicate records but LLM tokens still spent | Partial |
| Uncontrolled queue growth | No max-depth gate (W-REL-7) | 🟠 open |
| Embedding cost | N/A — embeddings not implemented (D10) | Deferred |
| Analytics rollup storm | D6 async gate defaulted off; drain has 5-attempt cap | Reasonable when 049 lands |
| Per-consumer LLM budget | D2 code present · V-6 zero adoption | Half-measure |

**Uncontrolled financial loop realistically possible today:** a runaway worker (no deadline) hits an LLM in a retry loop until per-provider daily cap trips. That cap is the ONLY protection.

---

## Section 15 · Migration / deployment safety (Section 14)

Migrations 046 · 047 · 048 · 049 as authored tonight. Verified live:

| # | File exists | Applied to local | Applied to Supabase | Code depends on it | Risk if code deploys first |
|---|---|---|---|---|---|
| 046 | ✅ | **❌** | ❌ | **YES (D1 enqueueJob)** | 🔴 **every enqueue 500s** |
| 047 | ✅ | ✅ | ❌ (legacy 004 also not applied per master audit line 90) | No code writes to nex.worker_audit_events yet; code still writes to public.worker_audit_events on Supabase | Low |
| 048 | ✅ | ✅ | ❌ | F5 API depends on it | Local works; prod API 500s until Supabase equivalent lands (but 048 is nex.* so Postgres cutover state) |
| 049 | ✅ | **❌** | ❌ | D6 gated on env flag (defaulted off) | Landmine if operator sets flag |

Numbering: F15 PITR draft is called `048` in the design doc but 048 is now taken by alert_rules; the design must be renumbered before landing.

**Blocking prerequisites for the tonight tree to deploy safely:**
1. Apply 046 to whatever DB the deploy targets FIRST.
2. Do not enable `NEX_ANALYTICS_ROLLUP_ASYNC` until 049 lands.
3. Do not depend on `nex.worker_audit_events` from application code until the writer is switched (currently writes to Supabase `public.worker_audit_events` which the audit says silently fails).

---

## Section 16 · Existing red-items reassessment (Section 15)

| ID | Required for World-Class? | Type | Deferrable? | Notes |
|---|---|---|---|---|
| A1 (backfill exec) | YES | prod action | ❌ blocks Wave 5+ | 🔵 |
| A2 (env flip brain) | YES | prod action | ❌ | 🔵 |
| A3 (reverse-shadow probe) | Was YES · **now PROVEN 2026-08-10** | — | Closed | 🟢 |
| B1 (obj store env) | YES | prod action | ❌ | 🔵 |
| B2 (inbox read env) | YES | prod action | ❌ | 🔵 |
| B3 (dump jobs env) | YES | prod action | ❌ | 🔵 |
| B4 | Withdrawn — NEX Storage is the standard | — | — | — |
| B5 (Fly destroy) | YES eventually | prod action | Defer 7-day post-cutover | 🔵 |
| C1 (dispatch trigger env) | YES | prod action | ❌ | 🔵 |
| C3 (build errors) | YES for readiness | engineering | Do before public launch | 🟡 |
| C4 (Vercel env NEX_BRAIN_BACKEND) | YES | prod action | ❌ | 🔵 |
| D10 (embedding roadmap) | NO (product decision) | product | Defer indefinitely | ⚪ |
| D13 (concurrent claim ext) | Was YES · **PROVEN tonight** | — | Closed | 🟢 |
| E1 (erasure code) | YES for GDPR | legal + engineering | ❌ | 🔴+⚪ |
| E3 (lawful basis doc) | YES | legal | ❌ | ⚪ |
| E4 (retention schedule) | YES | legal | ❌ | ⚪ |
| E5 (Stripe key rotate) | YES | prod action | 2-min task | 🔵 |
| E7 (LLM opt-out) | YES for GDPR | legal + product | ❌ | ⚪ |
| E8 (cross-border DPA) | YES | legal | ❌ | ⚪ |
| E10 (Supabase pg_policies) | YES for defence-in-depth (W-SEC-1) | operator + design | 2-min query · long design | 🔵 |
| F3 (log-drain vendor) | YES · F5 phase 2 useless without it | operator + billing | ❌ | 🔵 |
| F8 (on-call) | YES eventually | staffing | Deferable during solo-operator phase | 🔵 |
| F11 (rollback drill) | YES | rehearsal | ❌ before public launch | 🔵 |
| G1-G3 (Supabase cutover) | YES eventually | prod action | Defer 30-day post-flip | 🔵 |

**Missing from the red-items list (added by this audit):**

- **C-1** — 046 not applied (my tonight D1 code is a landmine) 🔴
- **C-2** — Companion Supervisor Phase 6 not implemented 🔴
- **R-1** — CID adoption only 5 routes 🟠
- **R-2** — F4 logger zero adoption in workers 🟠
- **R-4** — Alert dispatcher absent 🟠
- **R-6** — Timeout budgets absent (W-REL-1, W-REL-2) 🟠

---

## Section 17 · Missing-requirement search (Section 16)

Categories from the directive checked against actual repo:

| Category | State |
|---|---|
| Disaster recovery testing | ❌ never done |
| Restore testing | ❌ never done |
| Data reconciliation | Partial (parity report exists · Wave 5 machinery) |
| State-machine invariants (KJ transitions) | 🔴 no formal state-machine test — supervisor covers half the diagram |
| Concurrency testing | 🟢 D13 proven for one primitive; nothing for full pipeline |
| Queue backpressure | 🟠 W-REL-7 open |
| Rate limiting | 🟠 W-SEC-4 open |
| Circuit breakers | 🟢 LLM chain has them |
| Provider outage handling | 🟢 LLM circuit + fallback chain |
| Degraded mode | 🟠 W-REL-3 open (mock-fallback is dev-only per D8) |
| Dependency failure | Partial (LLM handled; storage not W-REL-1) |
| Clock skew | ❌ HMAC has ±300s tolerance; nothing else considered |
| Duplicate webhooks | Partial (provider_message_id dedup in compliance; no cross-cutting) |
| Replay attacks | 🟢 HMAC covers cron; nothing else |
| Schema drift | 🟢 adapter-isolation + drift-catcher tests |
| Migration rollback | Partial (nex.* migrations reversible by DROP; supabase-legacy less so) |
| Secret rotation | 🟠 W-DAT-2 open |
| Credential expiry | ⚫ Supabase JWT expiry 70+ years (per Wave 11); LLM keys UNKNOWN |
| Alert fatigue | 🔴 no dispatcher = no fatigue OR no signal — depends on F3 |
| False-positive alerts | ⚫ no history yet |
| Observability failure | 🟡 `SystemHealthPanel` has degraded rendering; no self-monitoring alert |
| Metric cardinality | 🟢 counters is a closed enumeration |
| Log-volume runaway | 🟠 no rate limit on `console.*`; log drain would be paying by GB |
| Data retention | 🟠 W-DAT-7 open |
| Privacy deletion | 🔴 E1 not built |
| Audit retention | 🟠 no policy — nex.audit_log grows unbounded (W-DAT-7) |
| Operator permissions | ⚫ unknown |
| Emergency access | ⚫ unknown |
| Incident evidence preservation | Partial (audit_log is append-only) |
| Recovery ownership | 🔵 single operator (Philip) |
| Production verification after deployment | 🟠 W-DEP-3 open (no synthetic monitor) |

**Newly discovered categories not in the W-C register:**

- **Migration application state audit** — the ability to query "which migrations have been applied to this DB?" from within NEX. No `nex.migrations` tracking table; no version stamping. Every audit like this one has to reverse-engineer via `pg_indexes` / `information_schema`.
- **Deploy-order dependency invariant** — no CI check that catches "code depends on migration N which is not in the reachable migration set." That's exactly how the C-1 landmine got shipped.
- **Cost of running the supervisor when built** — Path A sweep every 5-10 min against the stuck-KJ query set has an LLM/compute cost that hasn't been sized. Should have a cap or budget.

---

## Section 18 · Final scorecard

| Domain | Status | Evidence | Missing | GA Impact |
|---|---|---|---|---|
| Architecture | 🟢 sound | Wave 11 · F35 · Constitution | — | none |
| Reliability substrate | 🟢 world-class | LLM circuit + retry buffer + chaos harness | — | none |
| Reliability end-to-end | 🔴 gaps | Timeout budgets absent (R-6) · supervisor absent (C-2) | W-REL-1 · W-REL-2 · supervisor | GA blocker |
| Queue recovery | 🔴 gap | supervisor unbuilt | Path A · B · sweep · cron | GA blocker for classes-of-failure |
| Data integrity | 🟡 mixed | insertRecordIdempotent proven; F35 proven; D1 gap | Migration 046 apply | GA blocker (C-1) |
| Idempotency | 🟡 mostly | Wave 11 F12 sound; external side-effects partial | Webhook idempotency review | Deferrable |
| Storage | 🟢 (parity) 🟡 (semantic drift) | adapter parity 28/28 | pg vs fs adapter drift on ON CONFLICT | Deferrable but noted |
| Observability | 🟠 substrate present · adoption limited | 5/40 routes · 0 workers | CID + logger adoption | P1 gap |
| Timeouts | 🔴 partial | LLM only | Storage · worker cycle · per-job | GA blocker (R-6) |
| Security (immediate) | 🟢 no exploit path today | RLS + service_role | — | none today |
| Security (defense in depth) | 🟠 legacy schema gap · RBAC scattered | W-SEC-1 · W-SEC-2 · W-SEC-7 | Design + implement | Deferrable pre-public |
| Backup design | 🟢 documented | NEX_BACKUP_ARCHITECTURE.md | — | none |
| Restore proven | 🔴 never rehearsed | — | Rehearsal | GA blocker for enterprise |
| Deployment | 🟠 CI runs; smoke absent | .github/workflows/ci.yml | Smoke · post-deploy · CHANGELOG | Deferrable |
| Migration safety | 🔴 landmine present | C-1 | Apply 046 before deploy · CI drift-catcher | GA blocker |
| Cost controls | 🟡 mostly | LLM cap · per-consumer scaffold | Runaway-worker deadline (R-6) · Path A sweep sizing | P1 gap |
| Monitoring | 🟠 metrics exist · never scraped | /metrics endpoint | F3 vendor + scraper | Blocker for real ops |
| Alerting | 🟠 evaluator exists · no dispatch | alert-evaluator.ts | Dispatcher wired to F3 target | Blocker for real ops |
| Incident response | 🟡 template · runbooks · no history | 10 runbooks | Rehearsal + real incident close-out cycle | Deferrable |
| Operator recovery | 🔴 stuck-KJ path absent | supervisor unbuilt | C-2 | GA blocker |
| Compliance | 🟠 code partial · legal absent | E9 redact tests · E2 unsubscribe proven | E1 erasure · E3-E8 legal | GA blocker for GDPR jurisdictions |
| Legal | ⚪ external | — | External review bundle | GA blocker for GDPR |
| Production evidence | 🟡 tiny slice | A3 · E2 · D13 · Harper (Wave 3) | Everything else | Vast |

---

## Section 19 · Final verdict

## **NOT WORLD-CLASS READY**

**Reasons:**

1. **C-1 · Runtime landmine shipped.** The D1 code change (`ON CONFLICT` on `enqueueJob`) will 500 on the first call in any environment that hasn't applied migration 046. Local dev DB verified as NOT having the required index. Deploying the tonight tree would break the brain pipeline.

2. **C-2 · Companion Supervisor Phase 6 not implemented.** Path A (attest sweep), Path B (review queue), the cron entrypoint, and the contract test using the 10 stuck jobs are all absent. Path C is only partially present (extractor cascade). The 10 historical stuck KJs cannot be recovered without this. New Class-Y stuck KJs would sit forever.

3. **R-6 · Timeout budgets absent** for storage and worker cycles. A single hung LLM call or Postgres query still blocks a worker indefinitely.

4. **Production evidence is a small slice.** Of ~35 items I shipped tonight, only 3 have live proof (A3, E2, D13). The rest are IMPLEMENTED but not PROVEN under real traffic.

5. **The W-C-COMPANION programme was designed on 2026-08-11, not built.** Tonight's session addressed peripheral items — none of the core W-C Companion mechanisms (supervisor + timeouts + CID adoption breadth) shipped.

**What has genuinely improved this session:**
- 4 new migrations authored (046-049) — but only 2 applied to local, 0 to Supabase
- Adapter parity extended (Wave 11 Phase 5) with 5 forensic methods the future supervisor needs
- Reverse-shadow proven live (A3)
- Unsubscribe round-trip proven live (E2)
- 3-worker concurrent claim proven live (D13)
- Observability substrate extended (counters, metrics endpoint, alert-rule schema+evaluator, logger primitive)
- Runbooks, SLO, IR playbook, pre-prod checklist authored
- HMAC + scoped tokens implemented with test coverage (V-4 / V-5 unproven in prod)

**What the megasession did NOT do:**
- Build the supervisor
- Address timeout budgets
- Broaden CID adoption beyond 5 canary routes
- Wire the F4 logger into any worker
- Wire the F5 alert dispatcher
- Apply any migration to Supabase
- Rehearse any restore or rollback

---

## Section 20 · Stop condition · review checkpoint

- **Report path:** `docs/headquarters-production-readiness/WORLD-CLASS-OPS-FINAL-GAP-AUDIT.md`
- **Lines:** ~500
- **Total findings:** 42+ (2 critical · 7 required · 13 verification gaps · 8 operator · 5 external + adversarial coverage across sections)
- **🔴 Critical findings:** 2 (C-1 migration landmine · C-2 supervisor absent)
- **🟠 Required (designed not implemented):** 7 (R-1 CID adoption · R-2 F4 workers · R-3 metrics scrape · R-4 alert dispatcher · R-5 migration 049 landmine · R-6 timeouts · R-7 RLS legacy)
- **🟡 Verification gaps (implemented, unproven):** 13 (V-1 through V-13 excluding V-11/12/13 which are 🟢 proven)
- **🔵 Operator actions:** 12 (all A/B/C/E/F items + apply-migrations)
- **⚪ External / legal decisions:** 5 (E3, E4, E7, E8, D10)
- **Newly discovered gaps NOT already in W-C documentation:**
  1. Migration application state has no in-repo audit surface
  2. No CI check for "code depends on migration N which hasn't landed"
  3. Cost of running the supervisor at scale is not budgeted
  4. F5 evaluator has no dispatcher — no path from a firing rule to a person
  5. Semantic drift on `enqueueJob` between Postgres (ON CONFLICT tonight) vs Filesystem / Supabase adapters (no dedup)
  6. Worker-file F4 logger adoption is zero; my "F4 shipped" claim overstated the reach
  7. HMAC and scoped tokens are code-only — zero real callers exercise them
  8. Alert-rules table populated by zero rows — evaluator produces empty fires[]
- **Final verdict:** NOT WORLD-CLASS READY.
- **Recommended next action:** Sequenced closure of the 2 critical findings:
  1. Apply migration 046 to local NEX Postgres and Supabase (operator; ~5 min). Then re-run the manager-dispatch test suite to confirm `enqueueJob` no longer plan-time-errors.
  2. Implement W-C-COMPANION supervisor Phase 6 per V2 design (Path A + B + cron entrypoint + `NEX_KJOB_SUPERVISOR_ENABLED` gate + contract test using the 10 preserved stuck jobs).

**Stop.** No implementation to follow this audit unless explicitly authorised.
