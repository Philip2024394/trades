# Wave 11 · Engineering Quality + Refactoring Audit

**Programme:** Headquarters Production Readiness
**Wave:** 11 (precedes Wave 12 Security · Wave 13 Compliance · Wave 10 Operations Truth)
**Started:** 2026-08-09
**Auditor:** Claude
**Directed by:** Philip

## Purpose

Surface structural / quality problems in the Headquarters surface area **before** Security and Compliance audits run. Security should audit the post-refactoring architecture, not code about to change.

## Guardrails (locked)

- No production changes · no migration execution · no env flips
- No Fly resume · no push · no frozen-system changes
- Every finding uses the **8-column format** (§ Finding Format below)
- Every finding uses the **three-state model** for state (OPEN · READY · VERIFIED CLOSED) plus BLOCKED where measurement is prevented
- Nothing marked VERIFIED CLOSED without executable evidence
- No test-weakening / deletion to make the audit pass

## In-Scope Surface

Wave 11 audits the code path that carries an item from user → inbox → dispatch → worker → knowledge record. Specifically:

| Area | Path | Rationale |
|---|---|---|
| Brain adapter seam | `src/lib/nex/brain/adapters/` · `src/lib/nex/brain/storage.ts` · `src/lib/nex/brain/pg-to-supabase-shadow.ts` | Highest concurrency + shadow write timing risk |
| Worker pipeline | `src/lib/nex/brain/workers/*` · `src/lib/nex/brain/manager.ts` · `src/lib/nex/jobs/*` | 6 workers · claim/retry/heartbeat semantics |
| Object storage | `src/lib/nex/storage/` | New this session · needs review |
| Knowledge inbox | `src/lib/nex/knowledge-inbox/` | Refactored this session (read-flip) |
| API surface | `src/app/api/nex/**/route.ts` (Headquarters-relevant) | Input validation · auth · error handling |
| Config surface | env-var gates · defaults · guards | Central hygiene · gates documented |

## Out-of-Scope

- Trade Centre / Yard / SiteBook / non-Headquarters merchant surfaces
- Predictive · Comms Social · Hammerex Social (frozen systems)
- Kernel below `src/lib/nex/brain/*` that is used but not owned by Headquarters
- Test coverage of frozen systems

## Finding Format · 8 columns (mandatory)

Every finding fills every column. No shortcuts.

| # | Column | Rule |
|---|---|---|
| 1 | **Finding** | One clear sentence naming the problem |
| 2 | **Severity** | P0 (blocks prod) · P1 (serious) · P2 (important) · P3 (nice-to-fix) |
| 3 | **Evidence** | File path + line numbers · exact quote where possible · reproducible command |
| 4 | **Affected code** | Every file that would need to change |
| 5 | **Required change** | Concrete diff-shape description (not "improve error handling" — say WHAT) |
| 6 | **Test** | Executable test that fails today because of this problem |
| 7 | **Retest** | Exact command + expected output that proves the fix |
| 8 | **Closure condition** | The three-state model target (typically READY for engineering findings · VERIFIED CLOSED when observed) |

## Severity semantics

- **P0** · Blocks production deployment. Data loss risk · silent corruption · irreversible action · security defect. Cannot be shipped.
- **P1** · Serious. Correctness bug in a non-critical path · operational risk · flaky behaviour · maintainability wall. Should be fixed before production.
- **P2** · Important. Quality improvement · test-gap · duplication that will bite later. Fix before scaling.
- **P3** · Nice-to-fix. Style · minor cleanup · comment quality · refactor opportunity. Backlog.

## Audit passes (order matters)

1. **Pass 1 · Silent-failure sweep** — empty catch · promise-swallow · logged-and-continued errors
2. **Pass 2 · Concurrency + adapter seam** — pool leaks · race conditions · claim/lease semantics · shadow-write timing
3. **Pass 3 · Type-safety leaks** — `any` · casts · unchecked JSON · missing validation at seams
4. **Pass 4 · Boundary validation** — API input validation · adapter contract enforcement
5. **Pass 5 · Test coverage of critical paths** — Wave 3/6/7 machinery all have adapter tests? Runner tests?
6. **Pass 6 · Config + env-var hygiene** — every gate documented · defaults sane · no undocumented magic strings
7. **Pass 7 · Dead code + orphan sweep** — unused exports · unreachable branches · half-migrated code
8. **Pass 8 · Duplication + abstraction quality** — same shape repeated · missing seams · leaky abstractions

Each pass produces findings. Findings accumulate in the § Findings register below.

## Findings register

Every finding uses the 8-column format. Wide-table content — use horizontal scroll if needed.

---

### F1 · Inbox filesystem RMW race on concurrent writes

| Column | Content |
|---|---|
| **Pass** | 2 · Concurrency + adapter seam |
| **Severity** | **P1 for the current single-writer topology · escalates to P0 the moment Headquarters accepts concurrent writers** (multi-user, Slack ingest, automated feeds, multiple browser tabs, or multi-region deployment). **The safety property depends on deployment topology, NOT on an intrinsic application invariant** (Philip 2026-08-09 correction). Every scaling milestone must reassess this finding. |
| **Evidence** | `src/lib/nex/knowledge-inbox/storage.ts:345-351` (appendItem), `:353-368` (updateStatuses), `:371-386` (setItemStatus), `:388-407` (deleteItem). All four functions do read-modify-write on `index.json` with no file lock. `writeIndex` uses tmp+rename (atomic at OS level for a single rename) but the read→write window is not protected. |
| **Affected code** | `src/lib/nex/knowledge-inbox/storage.ts` (four functions above) |
| **Required change** | Either (a) serialise all four mutations behind a single in-process mutex keyed on `INDEX_PATH`, OR (b) route writes exclusively through Postgres and treat filesystem as read-only after Wave 6 write-flip. Option (b) is the strategic direction — this finding closes when write-flip lands. Do NOT add file-locking on top of the JSON store; the correct fix is to eliminate the JSON store as authoritative. |
| **Test** | Regression test that fires N concurrent `saveTextItem()` calls against the storage layer (N=10 with unique content each) and asserts `(await readIndex()).length === 10`. Test **fails today** (last-write-wins loses N-1 items with high probability under contention). |
| **Retest** | `node --test src/lib/nex/knowledge-inbox/tests/concurrent-append.test.mjs` should pass with all 10 items landing. |
| **State** | **OPEN** — no fix in flight. Wave 6c write-flip removes this from production once Wave 5 backfill completes AND write path routes to Postgres. Until then, single-user Headquarters is the mitigating assumption. |

---

### F2 · Fs-store JSONL claim uses documented single-dispatcher assumption

| Column | Content |
|---|---|
| **Pass** | 2 · Concurrency + adapter seam |
| **Severity** | **P0 (escalated 2026-08-10 by Philip after live evidence)** — was P1 while topology-dependent · reclassified P0 because the underlying race is provably real and six-worker deployment is a known future topology change. |
| **F2 · Full escalation framing (Philip 2026-08-10 · required per audit discipline)** | **Current evidence:** live test `claim-race.test.mjs::CR4a` fires two `Promise.all` claims of the same `job_id` against the pre-remediation JSONL CAS approximation · both consistently succeed. Test output: `[CR4a] F2 race manifested · both claimed job_id <uuid>`. **Impact:** duplicate worker execution possible against the same job · double LLM cost · potential double-write of derived state · idempotency shield in enqueue prevents DB corruption but not wasted computation. **Current containment:** single Vercel Cron dispatcher + Fly workers scaled to zero means only one concurrent claim path exists in production TODAY · the race is unreached. **Future production exposure:** the six-worker Headquarters deployment (Wave 8 target) explicitly runs multiple worker processes · each calls `claimJobIfQueued` concurrently · the race becomes materially reachable. **Required invariant:** exactly ONE claimant per queued job · regardless of process count · regardless of dispatch cadence. **Closure:** atomic database claim (Postgres `UPDATE ... WHERE status='queued'` returning row-count) + concurrent regression test passes AT the database boundary · not at the caller. |
| **Evidence** | `src/lib/nex/jobs/fs-store.ts:158-190`. Lines 158-169 comment explicitly acknowledges: *"Adequate for the single-cron-instance dispatcher model this queue runs under."* The `claimJobIfQueued` re-read verification (lines 183-189) approximates CAS by detecting a race after it happened, but both losers can already have appended state changes. LIVE PROOF: `claim-race.test.mjs::CR4a`. |
| **Affected code** | `src/lib/nex/jobs/fs-store.ts::claimJobIfQueued` + new `src/lib/nex/jobs/pg-claim.ts` (atomic primitive) |
| **Required change** | Route KnowledgeJob claims through Postgres atomic UPDATE with `WHERE status='queued'` — the second concurrent UPDATE finds status='claimed' and returns rowCount=0 (deterministic loser). Fall back to legacy JSONL CAS only when Postgres is unavailable OR the shadow row hasn't landed. |
| **Test** | Three tests in `src/lib/nex/jobs/tests/claim-race.test.mjs`: (a) CR4a keeps documenting the legacy fallback race by stubbing pg-claim as unavailable · (b) CR4b fires 2 concurrent atomic claims against a real Postgres row · asserts exactly-one-winner · (c) CR4c fires 10-way concurrent claims · asserts 1 winner + 9 losers · every loser observes `status=claimed`. |
| **Retest** | `node --test src/lib/nex/jobs/tests/claim-race.test.mjs` — 10/10 assertions pass with `NEX_POSTGRES_URL` configured. CR4b + CR4c skip cleanly when Postgres unavailable. |
| **State** | **READY** (2026-08-10) — `pg-claim.ts` implements the atomic primitive · `claimJobIfQueued` migrated to use it · CR4b and CR4c prove exactly-one-winner at the database boundary against real Postgres. Legacy JSONL fallback preserved for pg-unavailable case (still documented as topology-dependent). **VERIFIED CLOSED** requires: (a) production deploy on Postgres backend, (b) six-worker prove-out run against production confirms zero double-claims across observation window, (c) F2 assumption removed from register only after that observation. |
| **Deployment gate** | **Six-worker production deployment is BLOCKED until F2 is VERIFIED CLOSED.** Philip 2026-08-10: "Six workers are precisely where you don't want to discover that two workers can legitimately win the same job." |

---

### F3 · Silent shadow-write divergence · no operator-visible drift metric

| Column | Content |
|---|---|
| **Pass** | 2 · Concurrency + adapter seam |
| **Severity** | **P1** (violates NEX Runtime doctrine's "honest '—' for uninstrumented" principle — pretends sync is healthy when it may be silently drifting) |
| **Evidence** | `src/lib/nex/brain/pg-to-supabase-shadow.ts:62-66`. `mirror()` catches every secondary failure and only logs when `NEX_BRAIN_SHADOW_SUPABASE_DEBUG=1` is set. There is no counter of shadow failures · no metric surfaced to `NexStoragePanel` · no `nex.events` audit row for "shadow write failed". Operator has NO signal of drift until they manually run `scripts/brain-parity-report.mjs`. |
| **Affected code** | `src/lib/nex/brain/pg-to-supabase-shadow.ts`, plus a new metric surface (e.g. `src/lib/nex/brain/shadow-metrics.ts`) and a section in `NexStoragePanel` |
| **Required change** | Every `mirror()` failure MUST (a) increment an in-process counter exposed via `/api/nex/brain/shadow-health` AND (b) write a `nex.events` row of type `shadow-write-failed` with method name + error. The mirror can remain fire-and-forget for latency reasons, but the failure must be observable. |
| **Test** | Contract test that instantiates `MirrorToSupabaseBrainStore` with a secondary that always throws · asserts (a) primary write still returns · (b) shadow-failure counter increments · (c) audit event `shadow-write-failed` is written. |
| **Retest** | `node --test src/lib/nex/brain/tests/reverse-shadow-drift-visibility.test.mjs` passes. |
| **State** | **OPEN** — reverse-shadow was VERIFIED CLOSED as a code path in Wave 7, but the observability gap was not audited then. This audit surfaces it. |

---

### F4 · Manager inbox bulk writeback swallow

| Column | Content |
|---|---|
| **Pass** | 1 · Silent-failure sweep |
| **Severity** | **P1** |
| **Evidence** | `src/lib/nex/brain/manager.ts:320-326`. Try/catch around `updateInboxItemStatuses(statusUpdates)` logs the error and continues · dispatch cycle reports `reconciled_inbox_status = 0` (undefined defaulted) when the writeback silently fails. Downstream cron-tick JSON says success even though inbox never reflects the transition. |
| **Affected code** | `src/lib/nex/brain/manager.ts` reconciliation block |
| **Required change** | Convert the catch into a partial-failure model: return `{ reconciled: N, failed: [{id, reason}] }` from `reconcileWorkerToInboxStatus()`. The cron-tick response body then surfaces failures. Do NOT silently rethrow (that would abort the whole cycle) · but the caller must see the failure count and the failed IDs. |
| **Test** | Regression test that patches `updateInboxItemStatuses` to throw · calls `runCycle()` · asserts the return payload contains `reconciled_inbox_status_failed.length > 0` AND the item IDs are enumerated. |
| **Retest** | `node --test src/lib/nex/observability/tests/group-b-wireup.test.mjs` — F4-W1 + F4-W2 pass (writeback returns `WritebackOutcome` · caller matches on success/partial/failed · surfaces status in dispatch return). |
| **State** | **READY** (2026-08-10) — `updateInboxItemStatuses` returns `{kind: "success" \| "partial" \| "failed", ...}`. `dispatchNewInboxItems` matches on `wb.kind` and surfaces `inbox_writeback_status` in the return payload · counter `manager.inbox_writeback_failed` + signal `inbox-writeback-failed` fire on the failed branch · partial branch reports `dropped_targets` count. `inbox-truthfulness.test.mjs::IB6` + `IB7` updated to assert the new contract (not weakened · tracks the remediation). VERIFIED CLOSED after production observation. |

---

### F5 · Manager readInboxIndex silently returns empty on error

| Column | Content |
|---|---|
| **Pass** | 1 · Silent-failure sweep |
| **Severity** | **P1** — a bad `index.json` or Postgres blip causes the entire dispatch loop to think there are ZERO waiting items. Pipeline appears healthy while it does nothing. |
| **Evidence** | `src/lib/nex/brain/manager.ts:577-580`. Catch returns `[]` after logging. The dispatch loop then finds nothing to dispatch and completes normally. No health signal fires. |
| **Affected code** | `src/lib/nex/brain/manager.ts::readInboxIndex` and every caller that treats `[]` as "healthy but idle" |
| **Required change** | Return `{ items: InboxItem[], sourceHealth: "ok" | "degraded" }` from `readInboxIndex()`. When degraded, cron-tick payload surfaces `inbox_read_degraded: true` AND increments a counter. Dashboard shows a red banner. |
| **Test** | Regression test that patches `readIndex()` to throw · calls `readInboxIndex()` · asserts `sourceHealth === "degraded"` AND caller-visible signal fires. |
| **Retest** | `node --test src/lib/nex/observability/tests/group-b-wireup.test.mjs` — F5-W1 · F5-W2 · F5-W3 all pass (return shape includes sourceHealth · caller surfaces `inbox_source_health` · degraded path fires counter+signal). |
| **State** | **READY** (2026-08-10) — private `readInboxIndex` now returns discriminated `ReadInboxResult` (sourceHealth: "ok" or "degraded" + reason). `dispatchNewInboxItems` surfaces `inbox_source_health` in the return payload. Degraded branch fires `manager.inbox_read_degraded` counter + `inbox-read-degraded` signal. **"queue empty" is now distinct from "read failed"** in every consumer. VERIFIED CLOSED after production observation. |

---

### F6 · routeJobSafe silently swallows routing failures

| Column | Content |
|---|---|
| **Pass** | 1 · Silent-failure sweep |
| **Severity** | **P1** — a `routeJob` failure means the Knowledge Dump completes but memories never land in the target brain. Dashboard shows green · brains are empty. |
| **Evidence** | `src/lib/nex/brain/router.ts:284-288`. `routeJobSafe()` fires `routeJob().catch(logAndContinue)` · no counter · no audit event · no dashboard signal. |
| **Affected code** | `src/lib/nex/brain/router.ts` |
| **Required change** | Write a `nex.events` audit row of type `route-failed` with `{ job_id, target_brains, error }` on every failure. Increment a counter surfaced to `NexStoragePanel`. Optionally mark the KnowledgeJob's `completion_result.routing = { attempted: N, succeeded: M, failed: [...] }`. |
| **Test** | Regression test that patches `routeJob` to throw for a specific job_id · asserts a `route-failed` audit event lands AND the KnowledgeJob `completion_result.routing.failed` includes that job. |
| **Retest** | `node --test src/lib/nex/observability/tests/group-b-wireup.test.mjs` — F6-W1 passes. |
| **State** | **READY** (2026-08-10) — `routeJobSafe` catch now increments `router.route_failed` counter + emits `route-failed` signal with `code=<err.code>` and `detail=job_id=<id>`. Log line preserved. **Dashboard-green while brains empty** scenario now surfaced via observability. VERIFIED CLOSED after production observation of a real routing failure. |

---

### F7 · Enqueue-loop swallow · some inbox items silently skipped

| Column | Content |
|---|---|
| **Pass** | 1 · Silent-failure sweep |
| **Severity** | **P1** |
| **Evidence** | `src/lib/nex/knowledge-inbox/storage.ts:551-553`. Loop that enqueues waiting inbox items catches per-item errors and continues. The processing report says "enqueued 5" even if item 3 silently failed. |
| **Affected code** | `src/lib/nex/knowledge-inbox/storage.ts::processInbox` (approximate name) |
| **Required change** | Return `{ enqueued: [ids], failed: [{id, reason}] }` from the batch processor. Every caller MUST surface `failed`. Do NOT continue past a failure silently. |
| **Test** | Regression test that stubs one item's enqueue to throw · asserts the return payload lists that item in `failed[]`. |
| **Retest** | `node --test src/lib/nex/observability/tests/group-b-wireup.test.mjs` — F7-W1 · F7-W2 · F7-W3 · F7-W4 all pass. |
| **State** | **READY** (2026-08-10) — enqueue loop tracks `enqueueFailed: Array<{id, reason}>` · each failure fires `inbox.enqueue_failed` counter + `enqueue-failed` signal. `ProcessingReport` extended with optional `enqueueFailed[]` field. Report `note` reflects partial state honestly (`X enqueued · Y failed`). Complete success and partial success are distinct return states — cannot be conflated. VERIFIED CLOSED after production observation. |

---

### F8 · createJobSafe returns null on failure with no caller-observable signal

| Column | Content |
|---|---|
| **Pass** | 1 · Silent-failure sweep |
| **Severity** | **P1** (was flagged P0 · rescored because callers *can* observe the null and error out · but they typically don't) |
| **Evidence** | `src/lib/nex/jobs/fs-store.ts:139-147`. `createJobSafe` returns `null` on any error. Grep for callers · most check `if (!job)` but a few do `job.id` immediately (needs audit — subsequent pass will find them). |
| **Affected code** | `src/lib/nex/jobs/fs-store.ts` + every caller of `createJobSafe` |
| **Required change** | Either (a) rename to `tryCreateJob(): Promise<{ok: true, job} | {ok: false, reason: string}>` forcing every caller to switch on the result, OR (b) write a `nex.events` audit row on every failure so the operator has a signal even if the caller silently drops it. |
| **Test** | Regression test that patches `createJob` to throw · calls `createJobSafe` · asserts the failure is recorded in audit AND the return value carries a distinguishable failure marker. |
| **Retest** | `node --test src/lib/nex/observability/tests/group-b-wireup.test.mjs` — F8-W1 passes. |
| **State** | **READY** (2026-08-10) — `createJobSafe` catch increments `jobs.create_failed` counter + emits `create-job-failed` signal with source + truncated title. Backward-compatible null return preserved (existing callers work) BUT the failure is now observable independently. VERIFIED CLOSED after production observation. |

---

### F9 · Audit-log batch failures swallowed after logging

| Column | Content |
|---|---|
| **Pass** | 1 · Silent-failure sweep |
| **Severity** | **P2** (audit reliability is important but not correctness-critical for the pipeline) |
| **Evidence** | `src/lib/nex/brain/audit-log.ts:160-162` and `:210-212`. Both `emitAuditEventSync` and batch variant use `void ...catch(() => {})` fire-and-forget. If Supabase is intermittently down, audit gaps form silently. |
| **Affected code** | `src/lib/nex/brain/audit-log.ts` |
| **Required change** | Maintain an in-memory ring buffer of failed audit events (bounded, e.g. 1000 rows). Retry the buffer every N seconds against the primary store. Surface `pending_audit_events` counter to `NexStoragePanel`. On process shutdown, flush best-effort to a local jsonl. |
| **Test** | Contract test that patches the primary emit to fail 3 times then succeed · asserts all 3 failed events eventually land · asserts the retry counter reports correctly. |
| **Retest** | `node --test src/lib/nex/observability/tests/retry-buffer.test.mjs` — 8/8 pass (RB1-RB8) · `group-b-wireup.test.mjs::F9-W1-W4` all pass. |
| **State** | **READY** (2026-08-10) — new bounded ring buffer `src/lib/nex/observability/retry-buffer.ts` (capacity=1000 · overflow evicts oldest + fires `audit-emit-dropped` signal). `emitAuditEvent` + `emitAuditEvents` catches enqueue failed events. New `drainAuditRetryBuffer()` operator-invokable retry with `MAX_RETRY_ATTEMPTS=3` · returns `{attempted, succeeded, requeued, dropped}` summary · fires `audit-emit-retried` / `audit-emit-dropped` signals per outcome. **Bounded memory: capacity constant · not caller-tunable · test RB8 asserts bounds.** VERIFIED CLOSED after production observation. |

---

### F10 · Inbox Postgres-read fallback silent · no drift signal

| Column | Content |
|---|---|
| **Pass** | 1 · Silent-failure sweep |
| **Severity** | **P2** |
| **Evidence** | `src/lib/nex/knowledge-inbox/storage.ts:108-113`. When `readIndexFromPostgres()` returns null (Postgres unreachable or read failed), code silently falls back to filesystem with a `console.warn`. Operator cannot distinguish "brief blip" from "Postgres down for hours." |
| **Affected code** | `src/lib/nex/knowledge-inbox/storage.ts::readIndex`, `readStats` |
| **Required change** | Every fallback event writes a `nex.events` audit row of type `pg-read-fallback` AND increments a counter. `NexStoragePanel` shows a "PG read health" section that goes yellow after 3 fallbacks in 5 minutes. |
| **Test** | Regression test that patches `readIndexFromPostgres` to return null · asserts a `pg-read-fallback` audit event lands AND the counter increments. |
| **Retest** | `node --test src/lib/nex/observability/tests/group-b-wireup.test.mjs` — F10-W1 · F10-W2 · F10-W3 all pass. |
| **State** | **READY** (2026-08-10) — inbox `readIndex` + `readStats` fallback paths + jobs `getJob/listJobs/jobStats` fallback paths (via new `emitJobsPgFallback` helper) all fire `inbox.pg_read_fallback` / `jobs.pg_read_fallback` counters + `pg-read-fallback` signals with `code=<method>`. **A successful filesystem fallback is FALLBACK, not SUCCESS** — Philip's rule enforced at 5 callsites. VERIFIED CLOSED after production observation. |

---

### F11 · ObjectStorage selector cached at module load · env change requires restart

| Column | Content |
|---|---|
| **Pass** | 2 · Concurrency + adapter seam |
| **Severity** | **P2** (documented invariant — operator MUST restart on env change — but not enforced by code) |
| **Evidence** | `src/lib/nex/storage/object-registry.ts:46-54`. `getObjectStorage()` caches its return value in module-scoped `cached` variable. `NEX_OBJECT_BACKEND=postgres` set post-startup has no effect until process restart. |
| **Affected code** | `src/lib/nex/storage/object-registry.ts` |
| **Required change** | Either (a) document the "restart required" invariant loudly (comment + operator docs), OR (b) re-read env vars on every call and rebuild only when the backend name changes. Recommended: (a) — env changes at runtime are an operational anti-pattern; the enforcement should be that the operator knows this. Add a startup log line: `[NEX Object Storage] backend=<name> · cached at PID <pid> · env changes require restart`. |
| **Test** | Static assertion test that reads the source file and confirms the caching-invariant comment is present with the exact language above. |
| **Retest** | `node --test src/lib/nex/storage/tests/registry-caching-doc.test.mjs` passes. |
| **State** | **OPEN** |

---

### F12 · Storage.ts monolith · violates the "adapters as separate files" doctrine

| Column | Content |
|---|---|
| **Pass** | 2 · Adapter seam / organization |
| **Severity** | **P2** (organizational · not a correctness bug · but makes review/test/replace harder and violates NEX Runtime doctrine on adapter isolation) |
| **Evidence** | `src/lib/nex/brain/storage.ts` is ~2000+ lines and contains `PostgresBrainStore` (line 1487), likely also `SupabaseBrainStore` + `FilesystemBrainStore`. The NEX Infrastructure Runtime doctrine says: *"adapters isolated · only `adapters/{provider}.ts` may import the provider SDK."* The `src/lib/nex/brain/adapters/` folder does NOT exist. |
| **Affected code** | Full refactor of `src/lib/nex/brain/storage.ts` → `src/lib/nex/brain/storage.ts` (selector only) + `src/lib/nex/brain/adapters/postgres.ts` + `adapters/supabase.ts` + `adapters/filesystem.ts` + `adapters/mirror-to-supabase.ts` (existing shadow decorator moved) |
| **Required change** | Mechanical extract-class refactor. Selector API in `storage.ts` must remain byte-identical. Every adapter file becomes independently testable. Contract test (`brain-adapter-contract.test.mjs`) must run against every adapter. This is a P2 chore not a P1 defect · but it MUST land before Security Audit begins to give Security a clean surface to review. |
| **Test** | `brain-adapter-contract.test.mjs` runs against each adapter file independently. Import-only test that confirms `import { PostgresBrainStore } from "./adapters/postgres"` resolves. |
| **Retest** | `node --test src/lib/nex/brain/tests/adapter-isolation.test.mjs` + existing 236-assertion suite unchanged. |
| **State** | **READY** (2026-08-11) — behavior-preserving extraction complete. `src/lib/nex/brain/storage.ts` reduced from 1012 → 303 lines · now a selector-only shell. Three adapters live at `adapters/{filesystem,postgres,supabase}.ts` (566 + 530 + 772 lines · every SQL string · every fs call · every method signature byte-identical to pre-extraction). `MirrorToSupabaseBrainStore` in `pg-to-supabase-shadow.ts` NOT moved — it is not a raw adapter (decorator over `BrainStore` interface · no provider-SDK import) and moving is pure organizational churn that would not strengthen the invariant. `pg-to-supabase-shadow.ts::isReverseShadowEnabled` refactored to consume `activeBackend()` from storage.ts (AI7 invariant · centralised env-var reading). **Drift-catcher** at `src/lib/nex/brain/tests/adapter-isolation.test.mjs` (8 assertions AI1-AI8) codifies the Philip 2026-08-11 architectural invariant · every violation fails CI. VERIFIED CLOSED after production observation confirms no adapter regressions. |
| **Architectural invariant enforced (AI1-AI8)** | AI1 · `brainStore()` defined exactly once (storage.ts) · AI2 · adapters export only classes · no selector logic · no cached singletons · no env-var branching · AI3 · storage.ts imports NO provider SDK · AI4 · brain adapters do NOT import from `src/lib/nex/storage/*` (Brain × NEX Storage boundary) · AI5 · exactly ONE dual-write decorator (MirrorToSupabaseBrainStore · gated by NEX_BRAIN_SHADOW_SUPABASE=1) · AI6 · provider-SDK imports in brain/** confined to adapters/*.ts with F12.b exception list · AI7 · NEX_BRAIN_BACKEND read ONLY in storage.ts · AI8 · NEX_STORAGE_BACKEND read ONLY in NEX Storage registry · Brain does NOT reach into NEX Storage's env. |

---

### F12.b · brain/audit-log.ts + brain/warehouse.ts import @supabase/supabase-js directly

| Column | Content |
|---|---|
| **Pass** | 8 · Duplication + abstraction quality (scope-verification during Step 10) |
| **Severity** | **P2** (organisational · same class as F12 · discovered while extracting SupabaseStore) |
| **Evidence** | Scope-verification grep during Step 10: `grep -rn "@supabase/supabase-js" src/lib/nex/brain/` returned three files — `storage.ts` (removed by F12), `audit-log.ts:23`, `warehouse.ts:22`. Both are non-adapter files that talk to Supabase directly · violating the F12 doctrine that "only `adapters/{provider}.ts` may import the provider SDK." |
| **Affected code** | `src/lib/nex/brain/audit-log.ts` · `src/lib/nex/brain/warehouse.ts` |
| **Required change** | Refactor both to consume the `SupabaseStore` adapter (or a purpose-built specialised adapter under `adapters/`) rather than importing the SDK directly. Behavior-preserving. Follows the same pattern F12 established for storage.ts. |
| **Test** | The F12 drift-catcher's AI6 assertion already encodes the known exception list — the two files are ALLOWED in the exception list today but the list may NOT GROW. When F12.b closes, remove both files from `F12B_KNOWN_EXCEPTIONS` and AI6 will refuse any new violation. |
| **Retest** | `node --test src/lib/nex/brain/tests/adapter-isolation.test.mjs` — AI6 fails if a third file imports the SDK outside adapters/ OR if a listed file no longer imports (then the exception should be removed). |
| **State** | **OPEN · INTENTIONALLY SCOPED SEPARATELY** (Philip 2026-08-11): "Codify the violation/drift-catcher and leave the separate remediation scoped." F12.b will be addressed in a follow-up step · not by expanding F12. The drift-catcher prevents the violation from growing in the meantime. |

---

### F13 · quality-checker N+1 · unbounded sequential lookups per edge

| Column | Content |
|---|---|
| **Pass** | 2 · Concurrency + adapter seam |
| **Severity** | **P2** — latency concern under scale. A record with 500 edges takes 500 round-trips. |
| **Evidence** | `src/lib/nex/brain/workers/quality-checker.ts:271-275`. Sequential `for` loop calls `store.getRecord(edge.to_record_id)` per edge with `await`. Also `:206-209` — `Promise.all` on only 2 items (fine), but the downstream `getRecord` loop is the hot path. |
| **Affected code** | `src/lib/nex/brain/workers/quality-checker.ts::checkClauses` |
| **Required change** | Add a batch method `store.getRecords(ids: string[]): Promise<Map<string, KnowledgeRecord>>` to the BrainStore contract. Every adapter implements it (Postgres uses `= ANY(ids)`, Supabase uses `in.(...)`). quality-checker calls it once per record. |
| **Test** | Benchmark test that creates a record with 100 edges and asserts `checkClauses` completes in <500ms locally (was ~5000ms sequential). |
| **Retest** | `node --test src/lib/nex/brain/tests/quality-checker-batch-performance.test.mjs` passes. |
| **State** | **OPEN** |

---

---

### F14 · cron-tick endpoint unauthenticated in production if both env vars unset

| Column | Content |
|---|---|
| **Pass** | 4 · Boundary validation |
| **Severity** | **P0** — production deployment without `CRON_SECRET` AND `NEX_BRAIN_CRON_TOKEN` yields a completely open endpoint that (a) drains LLM budget on demand, (b) generates unbounded knowledge records, (c) can be used to DoS the pipeline. The comment on line 38 acknowledges intent ("dev / local") but code does not enforce it. |
| **Evidence** | `src/app/api/nex/brain/cron-tick/route.ts:22-42`. Line 38 sets `openIfNoTokens = !vercelSecret && !brainToken` · line 40 allows request through if `openIfNoTokens` is true regardless of `NODE_ENV`. Verified by reading the file: any GET with no auth header succeeds when both env vars are unset. |
| **Affected code** | `src/app/api/nex/brain/cron-tick/route.ts`, `src/app/api/nex/brain/run-once/route.ts` (same pattern · F15) |
| **Required change** | If `process.env.NODE_ENV === "production"`, require AT LEAST one of `CRON_SECRET` or `NEX_BRAIN_CRON_TOKEN` to be set AND the request to satisfy at least one — fail-closed with 500 (not 401) at the start of the handler if the invariant is violated (so misconfigured deploys refuse to serve rather than accepting anonymous traffic). Add a startup log line during module load: `[cron-tick] NODE_ENV=production requires CRON_SECRET or NEX_BRAIN_CRON_TOKEN`. |
| **Test** | Regression test that sets `NODE_ENV=production` + no tokens · calls the handler · asserts response is 500 with message `misconfigured` (NOT 200). Then sets one token but no auth header · asserts 401. Then sets one token and matching auth · asserts 200. |
| **Retest** | `NODE_ENV=production node --test src/app/api/nex/brain/cron-tick/tests/auth.test.mjs` — 3 scenarios pass. |
| **State** | **READY** (2026-08-10) — shared boundary implemented + tested + both routes migrated + `.env.example` documented. VERIFIED CLOSED after production deploy proves 500 misconfigured fires without env vars. |

---

### F15 · run-once endpoint unauthenticated in production if `NEX_BRAIN_CRON_TOKEN` unset

| Column | Content |
|---|---|
| **Pass** | 4 · Boundary validation |
| **Severity** | **P0** — same class as F14 · comment at lines 12-15 explicitly acknowledges "If it's unset, the endpoint is unauthenticated (fine for local dev)" but no `NODE_ENV` guard exists. Prod deploy without the env var = anyone can trigger unbounded processing cycles. |
| **Evidence** | `src/app/api/nex/brain/run-once/route.ts:31-42`. Verified: `if (requiredToken) { ... }` — no `else`. Missing token → auth block skipped entirely. |
| **Affected code** | `src/app/api/nex/brain/run-once/route.ts` |
| **Required change** | Same as F14 · additionally consider a shared helper `src/lib/nex/brain/auth/require-cron-token.ts` used by both handlers so this class of defect can't reappear per-route. |
| **Test** | Shared with F14 — `src/lib/nex/brain/tests/require-cron-token.test.mjs` covers both routes since both migrated to the shared boundary. |
| **Retest** | `node --test src/lib/nex/brain/tests/require-cron-token.test.mjs` — 13/13 assertions pass. |
| **State** | **READY** (2026-08-10) — shared boundary + both routes migrated + tests pass. VERIFIED CLOSED after production deploy. |

---

### F16 · Path-traversal risk · readItemContent joins user-lookup-derived paths without confinement

| Column | Content |
|---|---|
| **Pass** | 4 · Boundary validation |
| **Severity** | **P1** — realistic attack requires an attacker to influence `index.json` first (e.g. via a separate write defect), but the fs.readFile call has NO confinement check. Classic chained vulnerability enabler. |
| **Evidence** | `src/lib/nex/knowledge-inbox/storage.ts:413-423`. `readItemContent` line 416: `fs.readFile(path.join(ROOT, item.contentPath), "utf8")` with no `path.resolve` + `.startsWith(ROOT)` assertion. Called from `src/app/api/nex/knowledge-inbox/[id]/route.ts:72` after a lookup by URL-supplied `id`. |
| **Affected code** | `src/lib/nex/knowledge-inbox/storage.ts::readItemContent` |
| **Required change** | Add a guard at the top of `readItemContent`: `const resolved = path.resolve(ROOT, item.contentPath); if (!resolved.startsWith(path.resolve(ROOT) + path.sep)) { throw new Error("path-escape"); }`. Do NOT silently return null on the escape — throw so the caller can 500 and audit. |
| **Test** | 13 assertions in `src/lib/nex/knowledge-inbox/tests/path-traversal.test.mjs` covering the pure guard function AND the caller behavior AND regression on existing null-return paths. |
| **Retest** | `node --test src/lib/nex/knowledge-inbox/tests/path-traversal.test.mjs` — 13/13 pass. |
| **State** | **READY** (2026-08-10) — new `assertPathConfined(base, relative)` helper exported from `storage.ts` (reusable by future filesystem readers · voice · image · URL bundles). `readItemContent` calls it BEFORE `fs.readFile`. On escape it throws `path-escape` (with `err.code = "path-escape"`). Caller `src/app/api/nex/knowledge-inbox/[id]/route.ts::GET` catches the throw, logs full detail server-side, returns 500 with stable `{ ok: false, error: "path_escape" }` body (no resolved path leaks to client). VERIFIED CLOSED after production deploy proves the guard fires on a deliberately corrupted `contentPath`. |

---

### F17 · pg-reads rowToInboxItem casts enum strings without validating against the enum set

| Column | Content |
|---|---|
| **Pass** | 3 · Type-safety leaks |
| **Severity** | **P1** — if a Postgres row has `kind = "garbage"` (schema drift, corrupt row, or a future migration bug), the cast silently succeeds and downstream code branches on an invalid enum value. Status machines and routers rely on the enum. |
| **Evidence** | `src/lib/nex/knowledge-inbox/pg-reads.ts:56-78`. `rowToInboxItem` does `kind: r.kind as InboxKind`, `status: r.status as InboxStatus`, `source: r.source as KnowledgeSource` with no runtime validation. |
| **Affected code** | `src/lib/nex/knowledge-inbox/pg-reads.ts::rowToInboxItem` |
| **Required change** | Add runtime validation using the source-of-truth enum sets (already exported from `types.ts`). If validation fails, log the corrupt row's id + field + observed value, mark it as `deleted` for the return set (don't crash the caller), and write a `nex.events` row of type `pg-row-invalid-enum` for the operator. |
| **Test** | Regression test that stubs a Postgres row with `kind = "invalid-value"` · asserts (a) `readIndexFromPostgres` does NOT include that row in the returned array, (b) a `pg-row-invalid-enum` audit event is written. |
| **Retest** | `node --test src/lib/nex/knowledge-inbox/tests/pg-enum-validation.test.mjs` passes. |
| **State** | **OPEN** |

---

### F18 · manager.ts readInboxIndex JSON.parse trusts shape after Array.isArray only

| Column | Content |
|---|---|
| **Pass** | 3 · Type-safety leaks |
| **Severity** | **P1** — one corrupted item in the array leaks through as `InboxItemLite` and breaks `dispatchNewInboxItems` when it accesses `.id` or `.status` on undefined. |
| **Evidence** | `src/lib/nex/brain/manager.ts:347-348`. `const parsed = JSON.parse(raw); items = Array.isArray(parsed) ? (parsed as InboxItemLite[]) : [];`. Same pattern in `src/lib/nex/knowledge-inbox/storage.ts:117-119`. |
| **Affected code** | `src/lib/nex/brain/manager.ts::readInboxIndex` + `src/lib/nex/knowledge-inbox/storage.ts::readIndex` |
| **Required change** | After Array.isArray, `filter` the array by a per-item validator (`isValidInboxItem(x): x is InboxItem`) that checks required fields. Log + drop invalid items. Emit a `nex.events` row per drop. This is the SAME strategic fix as F17 — add a shared `validateOrDrop<T>` helper used by all JSON-loading paths. |
| **Test** | Regression test that writes an `index.json` containing 5 valid items and 1 malformed object (missing `id`) · asserts `readIndex()` returns exactly 5 items AND emits 1 audit event. |
| **Retest** | `node --test src/lib/nex/knowledge-inbox/tests/malformed-item-filter.test.mjs` passes. |
| **State** | **OPEN** |

---

### F19 · fs-store JSONL parse to KnowledgeJob without shape validation

| Column | Content |
|---|---|
| **Pass** | 3 · Type-safety leaks |
| **Severity** | **P1** — same shape as F18 · applies to the KnowledgeJob queue. |
| **Evidence** | `src/lib/nex/jobs/fs-store.ts:300, :336`. `const j = JSON.parse(line) as KnowledgeJob;` with no field validation. Also `src/lib/nex/brain/router.ts:152, :184` for MemoryRecord. |
| **Affected code** | `src/lib/nex/jobs/fs-store.ts` + `src/lib/nex/brain/router.ts` + `src/lib/nex/storage/adapters/jsonl.ts:60` |
| **Required change** | Same as F18 — apply the shared `validateOrDrop<T>` helper. Silently-skipped malformed lines are dishonest; they should be counted and surfaced. |
| **Test** | Regression test that writes a jobs.jsonl with 3 valid + 1 malformed line · asserts `listJobs()` returns 3 + 1 audit event. |
| **Retest** | `node --test src/lib/nex/jobs/tests/malformed-line-filter.test.mjs` passes. |
| **State** | **OPEN** |

---

### F20 · Upload route's binary detection was permissive and post-decode

| Column | Content |
|---|---|
| **Pass** | 4 · Boundary validation |
| **Severity** | **P1** — a truly-binary file (small PDF, short JPEG header, protobuf) with <20 NUL bytes in the decoded string slipped into the text pipeline and corrupted downstream extraction. |
| **Evidence · CORRECTED 2026-08-10** | **Pass 4 agent + initial audit both misreported this.** The actual code was `content.split("\0").length - 1` (counts NUL bytes in the decoded string), NOT `content.split(" ")` as originally reported. The Read tool rendered the literal NUL as a space visually. The real defect: (a) detection ran AFTER UTF-8 decode which mishandles invalid byte sequences · (b) threshold `< 20` NULs was permissive · a small binary file with 1-19 NULs slipped through. |
| **Affected code** | `src/app/api/nex/knowledge-inbox/upload/route.ts` |
| **Required change** | Replace with a raw-byte NUL scan BEFORE UTF-8 decode. Threshold ≥1 NUL in the first 4KB = binary. Extract to shared `detectBinaryContent()` helper so future upload paths use the same rule. |
| **Test** | 6 assertions in `src/lib/nex/api/tests/validators.test.mjs` (V9-V14) cover the helper: space-heavy text NOT binary (V9), single-NUL binary (V10), JPEG header binary (V11), empty buffer non-binary (V12), sample-window bound (V13), CSV text non-binary (V14). |
| **Retest** | `node --test src/lib/nex/api/tests/validators.test.mjs` — 19/19 pass. |
| **State** | **READY** (2026-08-10) — shared `detectBinaryContent(bytes, sampleSize=4096)` helper in `src/lib/nex/api/validators.ts`. Upload route consumes it BEFORE UTF-8 decode. Binary payloads masquerading as text extension now flow to the binary save path. VERIFIED CLOSED after production upload test with a real small JPEG. |

---

### F21 · brain router accepts `brain` query param without allowlist check

| Column | Content |
|---|---|
| **Pass** | 4 · Boundary validation |
| **Severity** | **P1** — `listMemories(brain, ...)` may resolve `brain` into a filesystem path or DB key. If `brain` accepts `../`, an attacker can read outside the brains directory. Even if the storage layer resolves safely, the API exposes an implicit enumeration attack (client can probe existence of arbitrary brain names). |
| **Evidence** | `src/app/api/nex/brain/router/route.ts:32-36`. `const brain = searchParams.get("brain")` → passed directly to `listMemories(brain, ...)`. |
| **Affected code** | `src/app/api/nex/brain/router/route.ts` + `src/lib/nex/brain/router.ts::listMemories` |
| **Required change** | (a) Define the set of legal brain slugs (already in NEX doctrine — staircase · door · interior · kitchen · bathroom · tools · timber · flooring · lighting · roofing · marketing per ADR-0033). Validate at API boundary. Return 400 with `unknown_brain` if not in the set. (b) `listMemories` at the storage layer also asserts the slug format `/^[a-z][a-z0-9_-]{2,30}$/` as defense in depth. |
| **Test** | 8 assertions in `src/lib/nex/api/tests/validators.test.mjs` (V1-V8): trade slugs accepted, HQ slugs accepted, `../etc` rejected via shape check, capitalised input rejected (STRICT · no auto-lowercase), unknown slugs rejected, missing/non-string input rejected, URL-encoded traversal rejected, allowlist stable and non-empty. |
| **Retest** | `node --test src/lib/nex/api/tests/validators.test.mjs` — 8/8 slug tests pass · brain-router GET wired to consume the helper. |
| **State** | **READY** (2026-08-10) — shared `assertBrainSlug(input)` helper in `src/lib/nex/api/validators.ts` · STRICT semantics (no case/whitespace coercion · attacker fingerprinting blocked at boundary). Brain-router GET now returns 400 `invalid_param` or `unknown_brain` for bad input BEFORE touching storage. VERIFIED CLOSED after production observation confirms no legitimate caller regressed. |

---

### F22 · Storage.ts wide use of `as unknown as KnowledgeRecord` — no runtime shape validation

| Column | Content |
|---|---|
| **Pass** | 3 · Type-safety leaks |
| **Severity** | **P2** — same class as F17/F18 but at the brain adapter layer. Risk is theoretical unless schema drifts, which shouldn't happen under normal ops. |
| **Evidence** | `src/lib/nex/brain/storage.ts:1525, 1552, 1558, 1565, 1577, 1589, 1601, 1614, 1622` — every Postgres query result gets a bare cast. |
| **Affected code** | `src/lib/nex/brain/storage.ts::PostgresBrainStore` |
| **Required change** | Adopt a per-table zod schema (or similar) applied at the adapter boundary. On schema-mismatch, log + audit + return null (never propagate corrupt row to caller). This finding LANDS during the F12 adapter-extraction refactor · the new `adapters/postgres.ts` gets the schemas as part of its extraction. |
| **Test** | Contract test that mocks the pg client to return a row missing a required field · asserts the adapter returns null and emits an audit event (not propagating the corrupt row). |
| **Retest** | `node --test src/lib/nex/brain/tests/adapter-schema-validation.test.mjs` passes. |
| **State** | **OPEN** · closes when F12 refactor lands. |

---

### F23 · object-postgres adapter trusts caller-supplied `business_id`

| Column | Content |
|---|---|
| **Pass** | 4 · Boundary validation |
| **Severity** | **P2** (in Headquarters single-tenant use · escalates to P0 the moment NEX serves multiple tenants — which is the strategic direction) |
| **Evidence** | `src/lib/nex/storage/adapters/object-postgres.ts:97-141` (put). `input.business_id` is written to the row without cross-checking against an authenticated caller identity. RLS on the table will filter READS but not enforce that a caller can only WRITE to their own business_id. |
| **Affected code** | `src/lib/nex/storage/adapters/object-postgres.ts::put`, `::head`, `::list` |
| **Required change** | Introduce an auth-context object passed to every adapter call: `{ business_id: string, user_id: string }`. Adapter asserts `input.business_id === ctx.business_id` before insert. This becomes a contract for every Runtime service · not just object storage. |
| **Test** | Contract test that calls `put` with a business_id that doesn't match ctx · asserts it throws `cross-tenant-write`. |
| **Retest** | `node --test src/lib/nex/storage/tests/tenant-isolation.test.mjs` passes. |
| **State** | **OPEN** · must be addressed BEFORE any multi-tenant deployment. |

---

### F24 · Leaky error responses expose internal paths + DB error text to clients

| Column | Content |
|---|---|
| **Pass** | 4 · Boundary validation |
| **Severity** | **P2** — every leaked path/error text is a small piece of an attack chain. Fix once via a shared error-envelope helper. |
| **Evidence** | `src/app/api/nex/brain/router/route.ts:61-63` returns `err.message` in the response body · similar pattern in `worker-audit/route.ts:65`. `err.message` from `fs.readFile` includes the full path (ENOENT: /data/nex-brains/...). |
| **Affected code** | Every API route handler under `src/app/api/nex/**` that returns `err.message` in the response body |
| **Required change** | Introduce `src/lib/nex/api/error-envelope.ts` with `toClientError(err): { code: string, message: string }` that maps known error classes to safe messages and logs the full detail server-side with a correlation id. Client gets `code + correlation_id`, never the raw message. |
| **Test** | 10 assertions in `src/lib/nex/api/tests/error-envelope.test.mjs` (EE1-EE10): safe response shape, allowlist-safe codes surfaced, unknown/rogue codes coerced to fallback, missing/non-string/null err handled, server-side log includes correlation id, response body NEVER contains slashes / stack frames / ECONNREFUSED, allowlist includes all Wave 11 finding codes. |
| **Retest** | `node --test src/lib/nex/api/tests/error-envelope.test.mjs` — 10/10 pass · brain-router GET + worker-audit both migrated. |
| **State** | **READY** (2026-08-10) — shared `toClientError(err, opts)` helper in `src/lib/nex/api/error-envelope.ts`. Two routes migrated (brain-router GET, worker-audit GET). Remaining routes migrate opportunistically as they're touched (a wholesale sweep is deferred to Step 15 hygiene). VERIFIED CLOSED after production observation confirms no filesystem paths or stack frames appear in client responses. |

---

### F25 · Empty-string env vars pass truthy check

| Column | Content |
|---|---|
| **Pass** | 4 · Boundary validation |
| **Severity** | **P3** (rare in practice · but worth tightening) |
| **Evidence** | `src/app/api/nex/brain/worker-audit/route.ts:58-66`. `if (!url \|\| !key)` treats empty string as falsy (correct), but if either is set to a whitespace-only value, downstream `createClient(url, key)` throws with internal detail. |
| **Affected code** | Multiple route handlers reading env vars for external clients |
| **Required change** | Introduce `src/lib/nex/config/env.ts::requireEnv(name): string` that asserts the var is set to a non-empty, non-whitespace string · throws with a clear message identifying which env is missing. Every external client construction uses this helper. |
| **Test** | 5 assertions in `src/lib/nex/api/tests/validators.test.mjs` (V15-V19): returns value when set, throws MissingEnvError with `.code='misconfigured'` when unset / empty / whitespace-only, non-throwing `readEnvOrNull` variant. |
| **Retest** | `node --test src/lib/nex/api/tests/validators.test.mjs` — 5/5 pass · worker-audit route migrated. |
| **State** | **READY** (2026-08-10) — shared `requireEnvNonEmpty(name, env)` + `readEnvOrNull(name, env)` helpers in `src/lib/nex/api/validators.ts`. Worker-audit route now uses `readEnvOrNull` so whitespace-only env values are treated as missing (returns safe `misconfigured` code, not a leaked stack). Remaining routes migrate opportunistically. VERIFIED CLOSED after production observation. |

---

---

### F26 · Critical dispatch/routing paths have ZERO test coverage

| Column | Content |
|---|---|
| **Pass** | 5 · Test coverage of critical paths |
| **Severity** | **P0** — four highest-risk paths in the Headquarters pipeline have zero direct tests. Silent failures in any of them corrupt or lose data with no test-suite signal. |
| **Evidence** | Test-coverage sweep · verified by enumerating `src/lib/nex/**/tests/*.test.mjs` and cross-referencing. The four paths without direct tests: (a) `src/lib/nex/brain/manager.ts::dispatchNewInboxItems` · (b) `src/lib/nex/brain/manager.ts::runOneCycle` · (c) `src/lib/nex/brain/router.ts::routeJob` · (d) `src/lib/nex/jobs/fs-store.ts::claimJobIfQueued` (race scenario untested). |
| **Affected code** | All four functions above |
| **Required change** | Add four test files: `manager-dispatch.test.mjs`, `manager-cycle.test.mjs`, `router-routing.test.mjs`, `claim-race.test.mjs`. Each locks the critical invariants that a silent-fail would break. |
| **Test** | The four new test files themselves ARE the closure evidence. |
| **Retest** | `node --test src/lib/nex/brain/tests/manager-dispatch.test.mjs src/lib/nex/brain/tests/manager-cycle.test.mjs src/lib/nex/brain/tests/router-routing.test.mjs src/lib/nex/jobs/tests/claim-race.test.mjs` — 39 total assertions pass (10 + 8 + 12 + 9). |
| **State** | **READY** (2026-08-10) — 4 test files created and passing (39 assertions). Notable: `claim-race.test.mjs::CR4a` LIVE-CONFIRMED the F2 race — two concurrent Promise.all claims of the same job_id BOTH succeed under the current JSONL CAS approximation. F2 escalation evidence added to the F2 register row. VERIFIED CLOSED when production topology also runs these tests as part of CI. |

---

### F27 · Six workers each have ZERO direct behavioural tests

| Column | Content |
|---|---|
| **Pass** | 5 · Test coverage of critical paths |
| **Severity** | **P1** — the six-worker prove-out runner (Wave 8) exercises the workers end-to-end but there is no per-worker unit test that isolates the worker's own logic. Contract changes in one worker won't fail an isolated test. |
| **Evidence** | Enumerated `src/lib/nex/brain/workers/*.ts` — 6 workers. Enumerated `src/lib/nex/brain/tests/*.test.mjs` — the only worker-related tests are `extractor-idempotency.test.mjs` (Avery duplicate gate only) and `warehouse.test.mjs` (state machine only). Neither directly exercises the extract/analyze/check logic. |
| **Affected code** | 6 workers under `src/lib/nex/brain/workers/` |
| **Required change** | Add one behavioural test per worker: mock the LLM/vision provider, assert the worker's output shape + audit-event emission. Six new test files: `knowledge-context.test.mjs`, `voice-context.test.mjs`, `learning-context.test.mjs`, `knowledge-extractor.test.mjs`, `image-analyst.test.mjs`, `quality-checker.test.mjs`. |
| **Test** | Six new test files. Each has at least: happy-path + provider-failure + audit-event assertion. |
| **Retest** | `node --test src/lib/nex/brain/tests/{knowledge-context,voice-context,learning-context,knowledge-extractor,image-analyst,quality-checker}.test.mjs` — all six pass. |
| **State** | **OPEN** |

---

### F28 · NEX_POSTGRES_URL · 47 read sites · divergent behaviour on missing var

| Column | Content |
|---|---|
| **Pass** | 6 · Config + env-var hygiene |
| **Severity** | **P1** — same env-var read in 47 places · some callers return null · some throw · some fall back to a hardcoded `postgresql://postgres:Admin1phil@localhost:5433/nex_dev` (script-level defaults). A production deploy that forgets the env var behaves inconsistently across code paths. Scoped to Headquarters (some of the 47 sites are outside HQ — the finding is that the pattern is unsafe, and every HQ site should route through a single validated reader). |
| **Evidence** | Pass 6 agent survey. Verified sites: `src/lib/nex/storage/adapters/postgres.ts:43` (throws) · `src/lib/nex/contacts/registry.ts:35` (returns null) · `scripts/brain-backfill.mjs` (hardcoded fallback) · `src/lib/nex/knowledge-inbox/pg-reads.ts:36` and `src/lib/nex/jobs/pg-reads.ts:25` (both use silent-null pattern). |
| **Affected code** | Every HQ site that reads `NEX_POSTGRES_URL` directly + a new central config module |
| **Required change** | Introduce `src/lib/nex/config/pg.ts::getPostgresUrl()` that (a) returns a validated URL string, (b) throws with a clear message if unset in production, (c) returns the local-dev fallback ONLY when `NODE_ENV !== "production"`. Every HQ callsite migrates to this helper. |
| **Test** | Regression test that unsets `NEX_POSTGRES_URL` with `NODE_ENV=production` and asserts `getPostgresUrl()` throws with the exact `missing-postgres-url-in-production` code. |
| **Retest** | `NODE_ENV=production NEX_POSTGRES_URL= node --test src/lib/nex/config/tests/pg.test.mjs` passes. |
| **State** | **OPEN** |

---

### F29 · Feature gates have no runtime visibility in dashboards

| Column | Content |
|---|---|
| **Pass** | 6 · Config + env-var hygiene |
| **Severity** | **P1** — three critical migration gates (`NEX_INBOX_READ_BACKEND`, `NEX_INBOX_SHADOW_POSTGRES`, `NEX_BRAIN_SHADOW_SUPABASE`, `NEX_OBJECT_BACKEND`) have NO runtime signal to the operator. There is no dashboard that says "currently reading inbox from Postgres" vs "filesystem". A silent flip means the operator has no way to detect it happened. |
| **Evidence** | Pass 6 agent survey · verified: `src/lib/nex/knowledge-inbox/pg-reads.ts:36` reads `NEX_INBOX_READ_BACKEND` with no logging path · `NexStoragePanel.tsx` shows storage stats but not gate state. |
| **Affected code** | `src/lib/nex/brain/config-signals.ts` (new) + `NexStoragePanel.tsx` new "Feature Gates" section + `/api/nex/storage/gates` new endpoint |
| **Required change** | Create `/api/nex/storage/gates` that reads each gate env var and returns `{ inbox_read: "postgres" | "filesystem", inbox_shadow: "on" | "off", brain_shadow: "on" | "off", object_backend: "postgres" | "filesystem", brain_backend: "postgres" | "supabase" | "filesystem" }`. `NexStoragePanel` renders these prominently with color coding (yellow when a gate differs from the target production state). |
| **Test** | Regression test that sets each gate to specific values · calls `/api/nex/storage/gates` · asserts every field is returned with the expected value. |
| **Retest** | `node --test src/app/api/nex/storage/gates/tests/gate-visibility.test.mjs` passes. |
| **State** | **OPEN** |

---

### F30 · NEX_BRAIN_CRON_TOKEN undocumented in .env.local · read by production code

| Column | Content |
|---|---|
| **Pass** | 6 · Config + env-var hygiene |
| **Severity** | **P2** (contributes to F14/F15 · same underlying issue framed as documentation) |
| **Evidence** | Pass 6 agent survey. `NEX_BRAIN_CRON_TOKEN` is read at `src/app/api/nex/brain/cron-tick/route.ts:24` and `scripts/nex-brain-worker.mjs:30` but does NOT appear in `.env.local` or `.env.example`. |
| **Affected code** | `.env.local`, `.env.example`, `README.md` |
| **Required change** | Add `NEX_BRAIN_CRON_TOKEN` to `.env.example` with a clear comment explaining what it does + that unsetting it in production is a security defect (see F14/F15). Also add `CRON_SECRET` documentation with the same warning. |
| **Test** | `.env.example` inspection — must contain both `CRON_SECRET` and `NEX_BRAIN_CRON_TOKEN` with REQUIRED-IN-PRODUCTION annotations. |
| **Retest** | `grep -c "REQUIRED-IN-PRODUCTION" .env.example` returns ≥2 · `grep "NEX_BRAIN_CRON_TOKEN" .env.example` returns match. |
| **State** | **READY** (2026-08-10) — `.env.example` created with both vars documented, REQUIRED-IN-PRODUCTION labelled, F31 also covered. Full env-var-documentation grep test deferred to Step 11 (GROUP F). |

---

### F31 · NEX_WORKER_CONSENT_V2 startup gate undocumented outside code

| Column | Content |
|---|---|
| **Pass** | 6 · Config + env-var hygiene |
| **Severity** | **P2** |
| **Evidence** | `scripts/nex-brain-cloud-worker.ts:90` uses this env var as a MANDATORY startup gate with `process.exit(1)` if not exactly `"YES"`. Only documented inline. No `.env.example` entry. |
| **Affected code** | `.env.example` + `deploy/nex-brain-worker/fly.toml` operator comments |
| **Required change** | Add `NEX_WORKER_CONSENT_V2=YES` to `.env.example` with the exact rationale (Wave 4 conscious-resume gate) and a link back to the Wave 4 doc. |
| **Test** | Same env-var-documentation grep test from F30 covers this. |
| **Retest** | Same as F30. |
| **State** | **OPEN** |

---

### F32 · dailyUsageSnapshot dead export with misleading JSDoc

| Column | Content |
|---|---|
| **Pass** | 7 · Dead-code + orphan sweep |
| **Severity** | **P2** — dead export with a comment claiming it is "consumed by /api/nex/brain/llm-health, dashboards, and probe scripts" but zero imports exist. Misleading to future readers. |
| **Evidence** | Pass 7 agent · `src/lib/nex/brain/llm.ts:240`. Grep across `src/**/*.ts` returns zero imports outside the definition file. |
| **Affected code** | `src/lib/nex/brain/llm.ts::dailyUsageSnapshot` |
| **Required change** | Either (a) delete the export and its supporting code, OR (b) wire it into `/api/nex/brain/llm-health` as the JSDoc claims. Decision belongs to Wave 9 (Provider/AI Readiness Audit) which will re-scope what LLM metrics are surfaced. |
| **Test** | Grep test asserting `dailyUsageSnapshot` is either imported by at least one route/component OR has been deleted. |
| **Retest** | `node --test src/lib/nex/brain/tests/dead-export-check.test.mjs` passes. |
| **State** | **OPEN** — defer decision to Wave 9. |

---

### F33 · sourcePriority duplication + F33.b divergence discovered during scope-verification

| Column | Content |
|---|---|
| **Pass** | 8 · Duplication + abstraction quality |
| **Severity** | **P1** for the 4 identical duplicates (drift risk realised = code silently diverged as F33.b proves) · **P1** for F33.b divergence (silent value drift in enqueue priority for items dispatched via runProcessInbox) |
| **Evidence · CORRECTED 2026-08-10** | Original audit: "4 identical switch statements." **Scope verification during Step 9 found 5 sites, not 4.** The 5th (`src/lib/nex/knowledge-inbox/storage.ts::runProcessInbox`) uses a DIVERGENT SHAPE (`Record<KnowledgeSource, number>` literal instead of switch function) AND DIVERGENT VALUES: gov-standards=3 vs canonical 1 · chatgpt-approved/claude-generated=3 vs 2 · customer-qa=4 vs 3 · raw-research=5 vs 4 · personal-ideas=7 vs 6 (internet-article=5 and needs-verification=7 match). The audit's original 4-way count was accurate for the sourcePriority FUNCTION but missed the equivalent Record LITERAL at a 5th site. |
| **Affected code** | New shared module `src/lib/nex/brain/priorities.ts` + 4 identical callsites (manager · 3 context workers) + F33.b callsite (storage.ts) preserved inline pending product decision |
| **Required change** | (F33) Extract canonical `sourcePriority(source: KnowledgeSource): number` to `src/lib/nex/brain/priorities.ts`. Migrate the 4 identical sites (behavior-preserving). (F33.b) Preserve storage.ts's divergent table inline with an explicit F33.b marker documenting the value delta and the alignment procedure — behavior-preserving pending Philip's product decision on whether alignment is authorized (alignment WOULD change enqueue priority for items dispatched via runProcessInbox). |
| **Test** | 9 assertions in `src/lib/nex/brain/tests/priorities.test.mjs` · **4 contract** (SP1-SP4): full-enum priority table · unknown-source fallback · lower-runs-first invariant · every-source-defined. **5 drift-catcher** (SPA1-SPA5): every migrated site imports canonical · no local switch remains · every import is used (no dead imports) · exactly ONE file defines the function across `src/lib/nex/**` · **F33.b divergence marker MUST remain in storage.ts** (so future editors know product approval is required before alignment). |
| **Retest** | `node --test src/lib/nex/brain/tests/priorities.test.mjs` — 9/9 pass. |
| **State** | **READY** (2026-08-10) for the 4-way duplication portion · canonical helper at `src/lib/nex/brain/priorities.ts` · 4 sites migrated · zero behavior change. **F33.b remains OPEN · INTENTIONALLY PRESERVED** (Philip 2026-08-10): "runProcessInbox uses a distinct priority policy. This is intentionally preserved because alignment changes production enqueue ordering. No refactor may silently alter these values. Alignment requires explicit product authorization." SPA5 enforces the marker's preservation in source · any future step (including F12) that touches storage.ts must respect the F33.b freeze. |

---

### F34 · withBrainRole helper duplicated across pg-integration sites with divergent signatures

| Column | Content |
|---|---|
| **Pass** | 8 · Duplication + abstraction quality |
| **Severity** | **P1** — **6 duplication sites verified during Step 7** (audit under-counted at 3 — my own Step 3 F2 remediation added the 6th via `pg-claim.ts`). 5 identical `Promise<T \| null>` implementations + 1 divergent `Promise<T>` throwing-on-null (`object-postgres.ts`). Contract mismatch across the adapter layer. |
| **Evidence** | 6 files: `src/lib/nex/knowledge-inbox/pg-reads.ts` · `src/lib/nex/knowledge-inbox/pg-shadow.ts` · `src/lib/nex/jobs/pg-reads.ts` · `src/lib/nex/jobs/pg-shadow.ts` · `src/lib/nex/jobs/pg-claim.ts` · `src/lib/nex/storage/adapters/object-postgres.ts`. Confirmed by grep during Step 7. |
| **Affected code** | New shared module `src/lib/nex/db/with-brain-role.ts` + 6 callsites (5 migrate to base variant, 1 to strict variant) |
| **Required change** | Extract to `src/lib/nex/db/with-brain-role.ts` with TWO variants: `withBrainRole<T>(fn)` returning `Promise<T \| null>` (nullable pool state) AND `withBrainRoleStrict<T>(fn, contextTag)` returning `Promise<T>` throwing with `.code="pg-not-configured"` on null pool. Both semantics preserved · migration behavior-preserving. |
| **Test** | 10 assertions in `src/lib/nex/db/tests/with-brain-role.test.mjs` (WBR1-WBR10): BEGIN+SET LOCAL ROLE ordering · COMMIT on success · ROLLBACK on throw with error propagation · null return on absent pool · connection release even on throw · exact role name (drift-catcher) · ROLLBACK failure does not mask fn's throw · strict variant throws with correct code · strict returns unwrapped · strict rethrows. **Plus 3 adoption drift-catcher assertions** (WBRA1-WBRA3) in `with-brain-role-adoption.test.mjs`: every migrated site imports from shared module · no site retains a local `async function withBrainRole<T>` implementation · exactly ONE file defines the helper across `src/lib/nex/**`. |
| **Retest** | `node --test src/lib/nex/db/tests/*.mjs` — 13/13 pass. |
| **State** | **READY** (2026-08-10) — canonical helper landed with both variants. 6 callsites migrated (behavior-preserving). Adoption drift-catcher enforces the invariant that no new local copy can reappear. `inbox-jobs-shadow.test.mjs::S4` updated to track the F34 consolidation (invariant "both shadow modules use nex_brain_app role" preserved · assertion now verifies both files IMPORT the shared helper AND the shared helper OWNS the `SET LOCAL ROLE` string · original safety property unchanged). **F12 prerequisite unblocked** — the storage.ts extraction can now use the shared helper rather than propagating another duplicate. VERIFIED CLOSED after production observation confirms no adapter regressions. |

---

### F35 · finalizeWorkerJob helper missing · insertResult+enqueue+audit+completeJob chain duplicated in 6 workers

| Column | Content |
|---|---|
| **Pass** | 8 · Duplication + abstraction quality |
| **Severity** | **P1** — the six workers all manually chain result-persist + (enqueue-next) + audit + job-complete. Any one worker can silently forget the audit or completeJob step (which is exactly the F6/F9 silent-audit-failure concern from Pass 1). A shared helper prevents this class entirely. |
| **Evidence** | Verified in Step 8 · 6 worker files each implement the finalization chain. Pattern varies genuinely: 3 workers (context/voice/learning) enqueue a next-stage job in the chain · learning-context has an additional side-effect (mark feedback applied) between enqueue and audit · image-analyst + knowledge-extractor emit per-record audits earlier and have no final worker-completion audit · quality-checker has per-record decision audits. All 6 nonetheless share the insertResult + completeJob bracket. |
| **Affected code** | New shared helper `src/lib/nex/brain/workers/_finalize.ts` + 6 workers |
| **Required change** | Extract `finalizeWorkerJob(store, { job, resultInput, nextJob?, betweenNextJobAndFinalAudit?, finalAudit? })` firing insertResult → enqueueJob (if given) → hook (if given) → insertAudit (if given) → completeJob in exact order. Plus `failWorkerJob(store, job, err, tag)` for the catch path. Every worker calls both exactly once. |
| **Test** | 15 assertions in `src/lib/nex/brain/workers/tests/finalize.test.mjs` — **10 contract tests** (FZ1-FZ10) covering: minimal call · full call ordering · optional-slot handling (nextJob absent · finalAudit absent · image-analyst pattern) · hook ordering + throw propagation · job_id injection · failWorkerJob message extraction + non-Error coercion + completeJob-never-fires-on-failure. **5 drift-catcher assertions** (FZA1-FZA5): every worker imports both helpers · zero direct `store.insertResult` outside finalize · zero direct `store.completeJob` outside finalize · zero direct `store.failJob` outside failWorkerJob · **exactly ONE finalizeWorkerJob + exactly ONE failWorkerJob call per worker** (proves genuine convergence · not merely importing the helper). |
| **Retest** | `node --test src/lib/nex/brain/workers/tests/finalize.test.mjs` — 15/15 pass. |
| **State** | **READY** (2026-08-10) — canonical helper at `_finalize.ts` · 6 workers migrated (knowledge-context · voice-context · learning-context · knowledge-extractor · image-analyst · quality-checker). Genuine divergence preserved: per-record audits (image-analyst · quality-checker) stay inline as they're domain logic · post-completeJob side-effects (knowledge-extractor's KnowledgeJob sync) stay inline. What converges is the insertResult → completeJob bracket and the audit ordering within it. **Convergence proved** by FZA5 · exactly ONE call per worker per direction. Regression: 176/178 pass (same 2 pre-existing libuv flakes). VERIFIED CLOSED after production observation confirms no worker regressions. |

---

### F36 · extractKeywords vs extractTopicKeywords · divergent implementations of the same intent

| Column | Content |
|---|---|
| **Pass** | 8 · Duplication + abstraction quality |
| **Severity** | **P2** — two workers implement keyword extraction with different stopword handling, different output types, and different thresholds. Not a bug today but the drift is real: adding a stopword requires editing both. |
| **Evidence** | Pass 8 agent · `src/lib/nex/brain/workers/knowledge-context.ts:241-268` (returns `string[]`, slice to 80) · `workers/learning-context.ts:397-407` (returns `Set<string>`, slice to 200). |
| **Affected code** | New shared module `src/lib/nex/brain/text/keywords.ts` + 2 callsites |
| **Required change** | Extract `extractKeywords(text: string, opts?: { max?: number, asSet?: boolean }): string[] \| Set<string>` OR (cleaner) `extractKeywords(text, opts)` returning `{ terms, scored, top: (n) => string[] }`. Callsites choose their view. |
| **Test** | Contract test with a fixture text asserting the exact top-K keywords for two configurations. |
| **Retest** | `node --test src/lib/nex/brain/tests/keyword-extraction.test.mjs` passes. |
| **State** | **OPEN** |

---

### F37 · MirrorToSupabaseBrainStore misread as dead code · IS a live safety net · corrective note

| Column | Content |
|---|---|
| **Pass** | 7 · Dead-code + orphan sweep · CORRECTED |
| **Severity** | **N/A** — corrective note, not a defect |
| **Evidence** | Pass 7 agent proposed deletion of `src/lib/nex/brain/pg-to-supabase-shadow.ts`. This is INCORRECT. Wave 7 (Reverse shadow build · completed 2026-08-09) explicitly built this decorator as the rollback safety net for the future production flip to `NEX_BRAIN_BACKEND=postgres`. It has NOT been activated yet (env flags are OFF) but it MUST remain in the code until at least (a) production is fully on Postgres AND (b) an observation window closes AND (c) rollback rehearsal completes. |
| **Affected code** | `src/lib/nex/brain/pg-to-supabase-shadow.ts` — KEEP |
| **Required change** | Add a header comment to the file explicitly stating "Wave 7 safety net · retention criteria: keep until reverse-shadow observation window closes AND rollback rehearsal completes." to prevent future accidental deletion. |
| **Test** | Static test that asserts `src/lib/nex/brain/pg-to-supabase-shadow.ts` exists AND contains the header comment. |
| **Retest** | `node --test src/lib/nex/brain/tests/safety-net-header.test.mjs` passes. |
| **State** | **CORRECTIVE NOTE · not a defect** |

---

## Summary counts (updated 2026-08-10 · post-F2-escalation)

- **P0:** 4 (F14, F15, F26, **F2** — escalated from P1 by Philip after live CR4a evidence)
- **P1:** 19 (F1, F3, F4, F5, F6, F7, F8, F16, F17, F18, F19, F20, F21, F27, F28, F29, F33, F34, F35)
- **P2:** 13 (F9, F10, F11, F12, F13, F22, F23, F24, F30, F31, F32, F36, **F12.b** — surfaced during Step 10 scope-verification)
- **P3:** 1 (F25)
- **Corrective notes:** 1 (F37)
- **Total distinct findings:** 37
- **Passes complete:** 8 / 8

## Remediation progress (updated 2026-08-10)

| Finding | State | Closure evidence |
|---|---|---|
| **F14** · cron-tick unauthenticated | **READY** | 13/13 assertions in `require-cron-token.test.mjs` |
| **F15** · run-once unauthenticated  | **READY** | Shared boundary at `src/lib/nex/brain/auth/require-cron-token.ts` |
| **F30** · env-var documentation      | **READY** | `.env.example` created with REQUIRED-IN-PRODUCTION labels |
| **F31** · NEX_WORKER_CONSENT_V2 docs | **READY** | Same `.env.example` covers this |
| **F26** · critical-path zero tests   | **READY** | 4 new test files · 39 assertions all pass |
| **F2**  · atomic claim (**escalated P0**) | **READY · deployment-gated** | 10/10 assertions in `claim-race.test.mjs` · CR4b + CR4c prove exactly-one-winner live against Postgres · **VERIFIED CLOSED requires production observation · six-worker deploy blocked until then** |
| **F16** · path-traversal on readItemContent | **READY** | 13 assertions in `path-traversal.test.mjs` · `assertPathConfined` helper + throw-not-null semantics · caller GET route surfaces 500 with `path_escape` code |
| **F20** · binary detection (real NUL scan) | **READY** | 6 assertions (V9-V14) · `detectBinaryContent` helper · upload route consumes BEFORE UTF-8 decode |
| **F21** · brain allowlist | **READY** | 8 assertions (V1-V8) · `assertBrainSlug` STRICT · brain-router GET consumes at boundary |
| **F24** · leaky error responses | **READY** | 10 assertions (EE1-EE10) · `toClientError` envelope · 2 routes migrated (router GET · worker-audit) · sweep of remaining routes deferred to Step 15 |
| **F25** · empty-string env vars   | **READY** | 5 assertions (V15-V19) · `readEnvOrNull` + `requireEnvNonEmpty` · worker-audit route migrated |
| **Observability core** | **READY** | 4 modules · 16 assertions in `observability-core.test.mjs` · outcome / counters / signals / validate |
| **F3** · shadow-write divergence visibility | **READY** | `mirror()` now increments `shadow.mirror_success`/`shadow.mirror_failed` + emits `shadow-write-failed` signal · reverse-shadow.test.mjs regression 15/15 preserved |
| **F17** · pg-reads enum casts silent | **READY** | pg-reads.ts uses `validateOrDrop` at boundary · rows with invalid kind/status/source dropped + counted + signalled · never propagated |
| **F18** · manager JSON.parse trust | **READY** | `updateInboxItemStatuses` uses `validateOrDrop` at fs.readFile boundary · malformed items dropped + counted |
| **F19** · fs-store JSONL parse trust | **READY** | shared `parseJobsJsonl(raw)` helper uses `validateOrDrop` · both listJobs and jobStats consume · malformed lines counted + signalled |
| **F4** · manager writeback partial-failure return | **READY** | `WritebackOutcome` (success/partial/failed) · caller matches on kind · `manager.inbox_writeback_failed` counter |
| **F5** · manager readInboxIndex sourceHealth | **READY** | `ReadInboxResult` (ok/degraded) · dispatch surfaces `inbox_source_health` · counter + signal on degraded |
| **F6** · routeJobSafe signal + counter | **READY** | `router.route_failed` counter + `route-failed` signal on catch |
| **F7** · enqueue-loop partial-failure return | **READY** | `enqueueFailed[]` in ProcessingReport · per-item counter + signal |
| **F8** · createJobSafe observable failure | **READY** | `jobs.create_failed` counter + `create-job-failed` signal · null return preserved |
| **F9** · audit retry ring buffer | **READY** | bounded capacity=1000 · overflow evicts oldest + signals · drain with `MAX_RETRY_ATTEMPTS=3` · 8/8 buffer tests pass |
| **F10** · PG-read fallback signal | **READY** | inbox+jobs (5 callsites) · `inbox.pg_read_fallback`/`jobs.pg_read_fallback` counters + `pg-read-fallback` signals |
| **F34** · withBrainRole shared helper | **READY** | canonical + strict variants at `src/lib/nex/db/with-brain-role.ts` · 6 callsites migrated · 13 assertions · **F12 prerequisite unblocked** |
| **F35** · finalizeWorkerJob shared helper | **READY** | canonical helper + failWorkerJob at `src/lib/nex/brain/workers/_finalize.ts` · 6 workers converged · 15 assertions (10 contract + 5 drift-catcher · convergence proven via exactly-one-call rule) |
| **F33** · sourcePriority shared table | **READY** (4-way duplication portion) | canonical `src/lib/nex/brain/priorities.ts` · 4 sites migrated · 9 assertions |
| **F33.b** · storage.ts divergent priority table | **OPEN · INTENTIONALLY PRESERVED** (Philip 2026-08-10) | `runProcessInbox` uses a distinct priority policy. This is intentionally preserved because alignment changes production enqueue ordering. **No refactor may silently alter these values. Alignment requires explicit product authorization.** SPA5 drift-catcher enforces the marker stays in the source. |
| **F12** · storage.ts monolith → 3 adapters + selector shell | **READY** (2026-08-11 · Step 10 · **Philip 2026-08-11 architectural invariant enforced**) | storage.ts 1012 → 303 lines · three adapters at `adapters/{filesystem,postgres,supabase}.ts` (byte-identical extraction) · MirrorToSupabaseBrainStore kept in pg-to-supabase-shadow.ts (decorator · not a raw adapter) · `isReverseShadowEnabled` refactored to consume `activeBackend()` (AI7) · drift-catcher `adapter-isolation.test.mjs` locks 8 architectural invariants (AI1-AI8) covering selector uniqueness · adapter purity · SDK isolation · Brain × NEX Storage boundary · dual-write uniqueness · env-var boundary. **The whole point of F12** — Philip 2026-08-11 — "finish the extraction without recreating the historical Brain × NEX Storage duplication" — enforced in test code, not comments. |
| **F12.b** · brain/audit-log.ts + brain/warehouse.ts import @supabase/supabase-js directly | **OPEN · INTENTIONALLY SCOPED SEPARATELY** (Philip 2026-08-11) | Scope-verification during Step 10 surfaced two non-adapter files importing the Supabase SDK directly. Not expanded into F12 · codified in AI6's known-exception list · drift-catcher prevents the list from GROWING. Separate remediation step. |
| all remaining findings | OPEN | pending steps 11-15 |

---

# FINAL REGISTER · Wave 11 · Engineering Quality + Refactoring Audit

## Newly discovered in Passes 5-8 (over the Pass 1-4 baseline)

| # | Finding | Severity | Pass |
|---|---|---|---|
| F26 | Critical dispatch/routing paths have zero test coverage | **P0** | 5 |
| F27 | Six workers have zero direct behavioural tests | P1 | 5 |
| F28 | NEX_POSTGRES_URL divergent behaviour across 47 read sites | P1 | 6 |
| F29 | Feature gates have no runtime visibility in dashboards | P1 | 6 |
| F30 | NEX_BRAIN_CRON_TOKEN undocumented (contributes to F14/F15) | P2 | 6 |
| F31 | NEX_WORKER_CONSENT_V2 undocumented outside code | P2 | 6 |
| F32 | dailyUsageSnapshot dead export with misleading JSDoc | P2 | 7 |
| F33 | sourcePriority() 4-way duplication | P1 | 8 |
| F34 | withBrainRole helper duplicated 3× with inconsistent signatures | P1 | 8 |
| F35 | finishWorkerJob helper missing · 6-worker duplication | P1 | 8 |
| F36 | extractKeywords vs extractTopicKeywords divergent implementations | P2 | 8 |
| F37 | MirrorToSupabaseBrainStore corrective note (NOT dead) | N/A | 7 |

## Related-findings groups (fix-together clusters)

**GROUP A · Auth boundary (P0)**
- F14 · cron-tick unauthenticated in production if both tokens unset
- F15 · run-once unauthenticated in production if `NEX_BRAIN_CRON_TOKEN` unset
- F30 · NEX_BRAIN_CRON_TOKEN undocumented (same root cause)
- **Fix all three under one shared helper:** `src/lib/nex/brain/auth/require-cron-token.ts` used by both routes + documented env var + startup assertion.

**GROUP B · Silent-failure cluster (P1)**
- F3 · shadow-write no divergence visibility
- F4 · manager inbox bulk writeback swallow
- F5 · manager readInboxIndex silent-empty
- F6 · routeJobSafe silent
- F7 · enqueue-loop swallow
- F8 · createJobSafe silent-null
- F9 · audit-log batch failures swallowed
- F10 · inbox Postgres-read fallback silent
- F17 · pg-reads enum cast silent
- F18 · manager JSON.parse trust
- F19 · fs-store JSONL parse trust
- **Fix all under one strategic architecture:** new `src/lib/nex/observability/` layer with (a) counters (b) audit-event emission of `<subsystem>-failure` types (c) `NexStoragePanel` health section (d) shared `validateOrDrop<T>` for JSON parse trust.

**GROUP C · Concurrency + topology-dependent invariants (P1)**
- F1 · inbox filesystem RMW race
- F2 · fs-store JSONL claim race
- F26 · claimJobIfQueued has no race test
- **Fix path:** F26 test lands first (documents the race), then Group C closes when Wave 6c write-flip removes filesystem as authoritative for the inbox AND KnowledgeJob claims migrate to `nex.claim_next_job` SKIP LOCKED (same pattern as worker_jobs).

**GROUP D · Type-safety at JSON boundaries (P1/P2)**
- F17 · pg-reads enum cast
- F18 · manager JSON.parse
- F19 · fs-store JSONL parse
- F22 · storage.ts adapter shape casts
- **Fix all under one helper:** `src/lib/nex/config/parse.ts::validateOrDrop<T>` (Group B strategic fix covers this).

**GROUP E · Boundary validation at API surface (P0/P1)**
- F14, F15 · auth (see GROUP A)
- F16 · path-traversal on readItemContent
- F20 · broken null-byte detection in upload
- F21 · brain-router allowlist
- F24 · leaky error responses
- F25 · empty-string env vars
- **Fix under two components:** (i) shared `src/lib/nex/api/error-envelope.ts` (covers F24 · improves F14/F15 error responses) · (ii) shared `src/lib/nex/api/validators.ts` with `assertPathConfined`, `assertBrainSlug`, `assertBinaryVsText` (covers F16, F20, F21).

**GROUP F · Config + env-var hygiene (P1/P2)**
- F28 · NEX_POSTGRES_URL divergent behaviour
- F29 · feature gates invisible
- F30, F31 · undocumented env vars
- **Fix under one component:** `src/lib/nex/config/env.ts` with (a) typed reader per env var (b) startup validation (c) `getFeatureGates()` API for dashboard (d) `.env.example` completion + doc-check test.

**GROUP G · Duplication + abstraction (P1/P2)**
- F33 · sourcePriority 4× duplication
- F34 · withBrainRole 3× duplication (**prerequisite for F12**)
- F35 · finishWorkerJob missing helper (**complements Group B**)
- F36 · extractKeywords divergent
- **Fix order:** F34 first (prerequisite for F12), then F35 (which composes with Group B observability), then F33 and F36 (pure extraction, no dependencies).

**GROUP H · Storage.ts monolith refactor (P2 organizational · prerequisite for Wave 12)**
- F12 · storage.ts 2000+ lines contains all adapters inline
- F22 · unknown-cast pattern in PostgresBrainStore (lands during the F12 extraction)
- F37 · MirrorToSupabaseBrainStore keep-header note (formalizes retention during F12)
- **Behavior-preserving extraction ONLY** (per Philip's guardrail). Not a redesign. Tests must be byte-identical before/after.

**GROUP I · Test-coverage backfill (P0/P1)**
- F26 · critical dispatch/routing paths (P0)
- F27 · six workers behavioural tests (P1)
- **Fix under one milestone:** author 10 new test files (4 for F26 + 6 for F27). Every test file authored BEFORE the corresponding remediation code touches the file — protects against regression.

## Dependencies between findings

```
GROUP A (F14, F15, F30) ────────────────────────► independent · start immediately
                                                                  │
GROUP I (F26, F27) ─────────────────────────────► needed as regression harness for every remaining group
                                                                  │
GROUP B (silent-failure cluster) ───────────────► needs the observability layer built first
                                                                  │
                                    ┌─────────────────────────────┴────────────────────┐
                                    │                                                   │
GROUP C (concurrency) ──────────────► waits on Wave 6 write-flip                       │
                                                                                        │
GROUP D (JSON parse trust) ─────────► folded into GROUP B                              │
                                                                                        │
GROUP E (API validation) ───────────► independent · can run in parallel with A/B/G     │
                                                                                        │
GROUP F (config hygiene) ───────────► partly composes with A (env var docs)            │
                                                                                        │
GROUP G · F34 (withBrainRole) ──────► BLOCKS GROUP H · F12 · MUST land first          │
                              │                                                         │
                              │                                                         │
GROUP H · F12 (storage.ts) ◄──┘  needs F34 · needs GROUP I tests as safety net         │
                                                                                        │
GROUP G · F35 (finishWorkerJob) ────► composes with GROUP B                            │
GROUP G · F33 (sourcePriority) ─────► independent · trivial                            │
GROUP G · F36 (keywords) ───────────► independent · trivial                            │
```

## Recommended remediation order

Per Philip's ordering hint (`F14/F15 → F16 → silent-failure → concurrency → F12 → remaining P1 → P2/P3`), refined with the dependency graph:

| # | Task | Findings closed | Prerequisites | Est. shape |
|---|---|---|---|---|
| **1** | **GROUP A · Auth boundary** | F14, F15, F30 | none | 1 shared helper + 2 route edits + `.env.example` + 3 tests |
| **2** | **GROUP I · Test-coverage backfill** | F26, F27 | none | 10 new test files (4 dispatch/routing + 6 workers). No production code changes. Provides regression harness for remaining work. |
| **3** | **F16 · Path-traversal guard** | F16 | GROUP I | 5-line change in `readItemContent` + 1 test |
| **4** | **GROUP E · API validation** | F20, F21, F24, F25 | GROUP I | 2 new shared modules (error-envelope + validators) + 4 route edits + 4 tests |
| **5** | **GROUP B · Observability layer** | F3, F4, F5, F6, F7, F8, F9, F10, F17, F18, F19, F22 | GROUP I | new `src/lib/nex/observability/` + new `validateOrDrop` + panel section + wire-up across 12 sites |
| **6** | **G · F34 · withBrainRole shared helper** | F34 | none | Move + 3 callsite migrations + 1 contract test |
| **7** | **G · F35 · finishWorkerJob shared helper** | F35 | GROUP B (audit path) | New helper + 6 worker migrations + 1 contract test |
| **8** | **G · F33 · sourcePriority extraction** | F33 | none | Move + 4 callsite migrations + 1 contract test |
| **9** | **G · F36 · keyword extraction unification** | F36 | none | Move + 2 callsite migrations + 1 contract test |
| **10** | **GROUP H · F12 storage.ts extraction** | F12, F22, F37 | F34 (step 6) + GROUP I | Behavior-preserving mechanical extraction. Tests byte-identical before/after. |
| **11** | **GROUP F · Config hygiene** | F28, F29, F31 | none | new `src/lib/nex/config/` + startup validators + gates API + panel wire-up |
| **12** | **GROUP C · Concurrency** | F1, F2 | Wave 6 write-flip (external) | closes when inbox writes route through Postgres AND KnowledgeJob claims migrate to `nex.claim_next_job` |
| **13** | **F32 · dailyUsageSnapshot decision** | F32 | Wave 9 (Provider/AI Readiness) | wire it up OR delete · defer |
| **14** | **F23 · Cross-tenant safety** | F23 | Multi-tenant deployment decision | closes before ANY multi-tenant launch · NOT a Headquarters blocker |
| **15** | **F11, F13, F25 · Minor hygiene** | F11, F13, F25 | none | small cleanups · defer to background time |

## Production blockers (must close before Headquarters is production-ready)

- **F14** (cron-tick open) · **P0** · closes after step 1
- **F15** (run-once open) · **P0** · closes after step 1
- **F26** (critical paths untested) · **P0** · closes after step 2
- **F16** (path-traversal enabler) · **P1** · closes after step 3
- **F20** (broken null-byte detection) · **P1** · closes after step 4
- **F21** (brain allowlist missing) · **P1** · closes after step 4
- **F28** (env-var chaos) · **P1** · closes after step 11
- **F29** (invisible feature gates) · **P1** · closes after step 11
- **F34** (withBrainRole prerequisite for F12) · **P1** · closes after step 6
- **Group B observability** (F3, F4, F5, F6, F7, F8, F9, F17, F18, F19) · **P1** · closes after step 5

## Findings that CAN wait until after launch (not production blockers)

- **F23** (cross-tenant safety) — Headquarters is single-tenant. **Mandatory closure BEFORE any multi-tenant deployment.** Not a launch blocker for Headquarters.
- **F32** (dailyUsageSnapshot) — dead export or wire it up · defer to Wave 9
- **F1 / F2** (concurrency) — **safety property depends on topology, not intrinsic**. Current single-writer/single-dispatcher topology holds them at P1. **Must be reassessed at every scaling milestone** (multi-user access, additional dispatchers, multi-region deployment). Recommended: close via Wave 6 write-flip which naturally eliminates the filesystem-authoritative window.
- **F11** (cached object-storage selector) — documented invariant. Comment + operator awareness is adequate.
- **F13** (quality-checker N+1) — latency concern under scale · not a correctness issue.
- **F25** (empty-string env vars) — rare in practice.
- **F31** (NEX_WORKER_CONSENT_V2 undocumented) — the code enforces the gate; documentation is a P2 nicety.
- **F33, F35, F36** (duplication refactors) — architectural hygiene · improves maintainability but does not block launch.

## Exact tests required to close each P0/P1

Every P0 and P1 requires an executable test that fails today and passes after the fix. Tests already stated in each finding row above. Consolidated master list:

| Finding | Test file (new) | Failure signal today | Retest command |
|---|---|---|---|
| F14 | `src/app/api/nex/brain/cron-tick/tests/auth.test.mjs` | prod deploy w/o tokens returns 200 | `NODE_ENV=production node --test <file>` |
| F15 | `src/app/api/nex/brain/run-once/tests/auth.test.mjs` | prod deploy w/o token returns 200 | `NODE_ENV=production node --test <file>` |
| F26 | 4 test files: `manager-dispatch`, `manager-cycle`, `router-routing`, `fs-store-claim-race` | zero coverage today | `node --test <files>` |
| F1 | `src/lib/nex/knowledge-inbox/tests/concurrent-append.test.mjs` | 10 concurrent saves land <10 items | `node --test <file>` |
| F2 | `src/lib/nex/jobs/tests/claim-race.test.mjs` | 2 concurrent claims both succeed | `node --test <file>` |
| F3 | `src/lib/nex/brain/tests/reverse-shadow-drift-visibility.test.mjs` | mirror failure not surfaced | `node --test <file>` |
| F4 | `src/lib/nex/brain/tests/manager-writeback-partial-failure.test.mjs` | writeback throws · caller sees success | `node --test <file>` |
| F5 | `src/lib/nex/brain/tests/manager-degraded-read.test.mjs` | read throws · returns [] silently | `node --test <file>` |
| F6 | `src/lib/nex/brain/tests/router-failure-visibility.test.mjs` | routeJob throws · no audit | `node --test <file>` |
| F7 | `src/lib/nex/knowledge-inbox/tests/process-partial-failure.test.mjs` | per-item throw silently skipped | `node --test <file>` |
| F8 | `src/lib/nex/jobs/tests/create-job-failure-signal.test.mjs` | createJob throws · null returned silently | `node --test <file>` |
| F16 | `src/lib/nex/knowledge-inbox/tests/path-traversal.test.mjs` | `contentPath = "../etc/passwd"` reads it | `node --test <file>` |
| F17 | `src/lib/nex/knowledge-inbox/tests/pg-enum-validation.test.mjs` | invalid enum silently passes | `node --test <file>` |
| F18 | `src/lib/nex/knowledge-inbox/tests/malformed-item-filter.test.mjs` | malformed item silently included | `node --test <file>` |
| F19 | `src/lib/nex/jobs/tests/malformed-line-filter.test.mjs` | malformed line silently included | `node --test <file>` |
| F20 | `src/app/api/nex/knowledge-inbox/upload/tests/binary-detection.test.mjs` | binary w/ <20 spaces saved as text | `node --test <file>` |
| F21 | `src/app/api/nex/brain/router/tests/brain-allowlist.test.mjs` | `?brain=../etc` returns 200 | `node --test <file>` |
| F27 | 6 test files, one per worker | zero coverage today | `node --test <files>` |
| F28 | `src/lib/nex/config/tests/pg.test.mjs` | prod w/o URL uses hardcoded local | `NODE_ENV=production NEX_POSTGRES_URL= node --test <file>` |
| F29 | `src/app/api/nex/storage/gates/tests/gate-visibility.test.mjs` | operator has no way to see gate state | `node --test <file>` |
| F33 | `src/lib/nex/brain/tests/priorities.test.mjs` | change in one file · others silently drift | `node --test <file>` |
| F34 | `src/lib/nex/db/tests/with-brain-role.test.mjs` | 3 divergent implementations | `node --test <file>` |
| F35 | `src/lib/nex/brain/tests/finish-job-helper.test.mjs` | 6-worker duplication · silent audit-skip risk | `node --test <file>` |

## Cross-references to prior waves

- **Wave 8 (six-worker prove-out)** is the ONLY existing end-to-end regression harness. It exercises the pipeline but does not isolate per-function contracts. F26 + F27 close that gap.
- **Wave 5 backfill scripts** are NOT dead code — they are Wave 5 tools that will be used once Philip authorizes the backfill. Pass 7 agent's suggestion to delete them was corrected.
- **Wave 7 reverse-shadow decorator** is NOT dead code — F37 documents this explicitly.
- **F1 + F2 concurrency findings** compose with **Wave 6c write-flip** (currently READY): once the write-flip lands and filesystem is no longer authoritative for the inbox/jobs, F1 and F2 close automatically.

## Guardrails preserved throughout Wave 11

- No production changes · no env flips · no push · no test deletions
- Every P0/P1 finding was verified by re-reading source before scoring
- Three-state model preserved (all 36 findings are OPEN · none prematurely marked READY or VERIFIED CLOSED)
- BLOCKED not used (no measurement was prevented)
- F12 refactor explicitly scoped as "behavior-preserving extraction, NOT redesign"
- F23 tenant-safety note is explicit: "Not a Headquarters blocker · mandatory before multi-tenant deployment"
- F1/F2 topology-dependency amendment applied per Philip's correction

## State distribution across all findings

- **OPEN: 25**
- READY: 0
- VERIFIED CLOSED: 0
- BLOCKED: 0

## Meta-observations after Passes 1-4

- **F14 + F15 are the top priority.** Both are one-line fixes at the top of each handler (add `NODE_ENV=production` invariant). These MUST land before Wave 12 Security Audit — Security should not audit code with known auth defects at the boundary.
- **Silent-failure pattern is still the largest cluster** — 8 P1 findings (F4, F5, F6, F7, F8, F17, F18, F19) all remediate under one strategic fix: a shared `validateOrDrop<T>` helper + operational health surface (`src/lib/nex/observability/`). Recommend the shared-helper approach over per-site patching.
- **Storage.ts monolith (F12) is a pre-requisite** for the F22 schema-validation work and for Wave 12 security review. Recommend F12 land next after the two P0s.
- **Cross-tenant safety (F23) is not currently a Headquarters concern** but MUST be resolved before any multi-tenant deployment. Flag this in Wave 13 Compliance Audit.
- **No P0 concurrency defects** — filesystem races (F1, F2) all remain P1 because the enforcing invariants (single-user, single-dispatcher) are documented. But they are architectural fragility that inflates the blast radius of any future operator error.
- **Passes 5-8 still to run:** test coverage · config/env-var hygiene · dead code / orphan sweep · duplication / abstraction. None of these are likely to surface new P0 defects — they will mostly generate P2/P3 hygiene items.

## State legend

- **OPEN** — problem present · no fix in flight
- **READY** — fix code exists but production has not switched
- **VERIFIED CLOSED** — production switched · exercised · observed · rollback rehearsed
- **BLOCKED** — cannot be measured / fixed in this environment · requires controlled test or external dependency

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-08-09 | Wave 11 audit doc scaffold authored · scope + format + passes defined | Claude |
| 2026-08-09 (later) | **Passes 1 + 2 complete** · 13 findings (0 P0 · 8 P1 · 5 P2) · silent-failure sweep + concurrency/adapter seam · verified all P1+ findings by re-reading source. Filesystem races (F1, F2) held at P1 because documented single-writer/single-dispatcher invariants are enforced by topology not by code. | Claude |
| 2026-08-09 (later) | **Passes 3 + 4 complete** · +12 findings (2 P0 · 6 P1 · 3 P2 · 1 P3). **F14 + F15 are new P0s** — cron-tick and run-once endpoints are unauthenticated in production if their respective env-var tokens are unset. Verified by reading both route files. Both need one-line fix (NODE_ENV=production invariant) BEFORE Wave 12 Security Audit begins. **F16 path-traversal on readItemContent** verified P1. **F20 upload null-byte detection is broken** verified P1 (counts spaces instead of NUL bytes). | Claude |
| 2026-08-09 (later) | **F1/F2 topology-dependency amendment applied** per Philip 2026-08-09. Every concurrency finding whose safety property depends on deployment topology (rather than an intrinsic application invariant) now explicitly names the escalation trigger. | Claude |
| 2026-08-09 (later) | **Passes 5 + 6 + 7 + 8 complete · Wave 11 evidence baseline SEALED** · +12 findings (1 P0 · 6 P1 · 4 P2 · 1 corrective note). **F26 is a new P0** — the four highest-risk pipeline paths (`dispatchNewInboxItems`, `runOneCycle`, `routeJob`, `claimJobIfQueued` race) have zero direct test coverage. Six workers untested at function level (F27). Config hygiene surfaced multi-site divergent behaviour on `NEX_POSTGRES_URL` (F28) and invisible feature gates (F29). Duplication cluster identified 3 P1 refactors (F33 sourcePriority · F34 withBrainRole · F35 finishWorkerJob). MirrorToSupabaseBrainStore corrective note (F37) prevents accidental deletion of the Wave 7 safety net. **Final register produced** with 8 fix-together groups + dependency graph + 15-step remediation order + explicit production blockers + wait-list + per-finding test contracts. **No remediation performed** per Philip's directive · complete baseline first. | Claude |
| 2026-08-10 | **Remediation authorized by Philip.** State-transition rule imposed: OPEN → remediation implemented → targeted test PASS → integration regression PASS → evidence recorded → VERIFIED CLOSED. **Additional constraint:** F14/F15/F30 must be ONE shared authentication boundary, not two independent patches. Tests must cover BOTH production and development configurations. | Philip |
| 2026-08-10 | **Step 1 · Group A · F14 + F15 + F30 → READY.** Shared boundary implemented at `src/lib/nex/brain/auth/require-cron-token.ts` (140 LOC, pure function, injectable env for tests). Invariant enforced: `NODE_ENV=production AND (CRON_SECRET OR NEX_BRAIN_CRON_TOKEN)` — deploy without either fails-closed with 500 misconfigured. Dev convenience preserved (both unset in NODE_ENV≠production → allow with one-time warn). Both routes migrated to consume the shared boundary. `.env.example` created with F30 documentation + F31 startup-gate context. **Targeted test PASS:** `src/lib/nex/brain/tests/require-cron-token.test.mjs` 13/13 assertions pass covering 6 mandated scenarios × prod/dev + edge cases. **Integration regression:** all inner assertions across the 14 brain-tests files pass (dispatch-dedup 10/10, review-queue 12/12) — 2 tests report "failed" only due to Node libuv `UV_HANDLE_CLOSING` teardown race on Windows unrelated to this remediation (assertions all green). **State:** F14/F15/F30 are READY. VERIFIED CLOSED requires production deploy + live curl proving the 500 fires without tokens. | Claude |
| 2026-08-10 | **Step 2 · Group I · F26 → READY.** Four test files created providing the regression harness for every subsequent remediation step: `manager-dispatch.test.mjs` (10 assertions on `dispatchNewInboxItems` shape), `manager-cycle.test.mjs` (8 assertions on `runOneCycle` worker ordering + heartbeat priming + short-circuit invariants), `router-routing.test.mjs` (12 assertions on `routeJob` idempotency + `normaliseBrain` memory-isolation guard), `claim-race.test.mjs` (9 assertions on `claimJobIfQueued`). **Total 39 new assertions · all pass.** **CRITICAL LIVE FINDING:** `claim-race.test.mjs::CR4a` fired two `Promise.all` claims of the same job_id and BOTH consistently succeeded — the F2 race is provably real under Promise.all concurrency. Test output logs: `[CR4a] F2 race manifested · both claimed job_id <uuid>`. F2 register row updated with this live evidence. CR4b (target invariant of exactly-one-winner) is `.todo` until Group C (Wave 6c write-flip to Postgres SKIP LOCKED) lands and remediates F2. **Integration regression preserved** — 62/65 pass, 2 pre-existing libuv teardown flakes with all internal assertions green, 1 intentional todo. | Claude |
| 2026-08-10 | **F2 ESCALATED P1 → P0 by Philip.** Direction: "The live CR4a race is no longer theoretical. Once Headquarters has multiple workers, this is potentially a duplicate-processing/data-integrity failure." Step 3 (F16) paused. Priority order revised · Group C moves to Step 3. Full framing added to F2 register row: current evidence · impact · current containment · future exposure · required invariant · closure criteria. Deployment gate declared: six-worker production deploy BLOCKED until F2 VERIFIED CLOSED. | Philip |
| 2026-08-10 | **Step 3 · Group C · F2 → READY.** New module `src/lib/nex/jobs/pg-claim.ts` (110 LOC) provides atomic exactly-one-winner primitive via `UPDATE nex.knowledge_dump_jobs SET status='claimed' WHERE job_id=$1 AND status='queued' RETURNING *`. Postgres row-lock guarantees the second concurrent UPDATE returns rowCount=0. `claimJobIfQueued` refactored to consume the atomic primitive first · falls back to `legacyJsonlClaimIfQueued` (renamed from previous inline body) only when pg-unavailable OR shadow row not yet in place. **Test evidence:** CR4a preserved as historical regression proving legacy race exists (pg-claim stubbed as unavailable). **CR4b un-`.todo`'d** and rewritten as live-PG integration test: seeds a fresh `nex.knowledge_dump_jobs` row · fires 2 `Promise.all` `pgAtomicClaimIfQueued` calls · asserts exactly 1 winner + 1 loser with `observed_status='claimed'`. CR4c added: same shape with 10-way concurrency · asserts 1 winner + 9 losers. **All 10/10 CR* assertions pass live against `postgresql://localhost:5433/nex_dev`.** Full regression: 64/66 (2 pre-existing libuv teardown flakes unchanged). F2 remediation added ZERO regressions. **State:** F2 READY. VERIFIED CLOSED requires production-deploy observation window per the deployment gate. Six-worker deploy remains blocked until then. | Claude |
| 2026-08-10 | **F2 direction confirmed by Philip · deployment gate stays locked.** "READY ≠ fixed. F2 specifically cannot reach VERIFIED CLOSED from tests alone. It needs production evidence from the actual new worker topology." Next sensible move: F16 path-traversal. Wave 11 remediation continues in code. | Philip |
| 2026-08-10 | **Step 4 · F16 → READY.** Path-traversal guard implemented. New exported helper `assertPathConfined(base, relative)` in `src/lib/nex/knowledge-inbox/storage.ts` resolves both to absolute paths and throws `path-escape` (with `err.code = "path-escape"`) when the resolved path is neither exactly the base nor prefixed by `base + path.sep`. Handles POSIX `..` traversal, Windows-style backslash traversal, absolute paths outside base, and sneaky `content/../../secret` normalisation. `readItemContent` calls the guard BEFORE `fs.readFile` — on escape it THROWS (does not silently return null). Caller `src/app/api/nex/knowledge-inbox/[id]/route.ts::GET` catches `err.code === "path-escape"`, logs full detail server-side, returns 500 `{ ok: false, error: "path_escape" }` (never leaks resolved path to client). **Test:** 13 assertions in `src/lib/nex/knowledge-inbox/tests/path-traversal.test.mjs` covering the pure guard (PT1-PT8) + the caller behavior (PT9) + existing behavior preservation (PT10-PT12). Full regression: 77/79 (2 pre-existing libuv flakes unchanged). Zero regressions from F16. | Claude |
| 2026-08-10 | **Step 5 · GROUP E · F20 + F21 + F24 + F25 → READY.** Two shared modules created: (i) `src/lib/nex/api/error-envelope.ts` (140 LOC) — `toClientError(err, opts)` maps errors to safe codes + correlation_id · full detail logged server-side · allowlist of safe codes prevents rogue `err.code` from leaking · client response NEVER contains slashes, stack frames, or credentials. (ii) `src/lib/nex/api/validators.ts` (160 LOC) — `assertBrainSlug(input)` (F21 · STRICT · 23-slug allowlist · rejects case/whitespace variants), `detectBinaryContent(bytes, sampleSize=4096)` (F20 · raw-bytes NUL scan BEFORE UTF-8 decode), `requireEnvNonEmpty(name, env)` + `readEnvOrNull(name, env)` (F25 · rejects whitespace-only). **Wire-up:** upload/route.ts consumes detectBinaryContent · router/route.ts::GET consumes assertBrainSlug + toClientError · worker-audit/route.ts consumes readEnvOrNull + toClientError. **Test evidence:** 29/29 assertions pass across `error-envelope.test.mjs` (10) + `validators.test.mjs` (19). Full regression: 106/108 (2 pre-existing libuv flakes unchanged). Zero regressions from Group E. **F20 audit-language correction:** the original F20 finding text said "counts spaces instead of NUL bytes" — CORRECTED to "counts NUL bytes AFTER decode with permissive ≥20 threshold." The Read tool rendered the literal NUL as a space, misleading both the Pass 4 agent and my initial framing. The remediation shape (raw-bytes scan) is unchanged — still correct. | Claude |
| 2026-08-10 | **Step 6a · GROUP B · observability infrastructure + F3/F17/F18/F19 → READY** (per-finding · not blanket · per Philip's rule that "shared helper exists" ≠ finding closed). Four modules created under `src/lib/nex/observability/`: (i) `outcome.ts` — discriminated union {success · skipped · rejected · failed · unavailable · fallback} · every non-success path names a reason (Philip: "do not invent 'healthy' states"). (ii) `counters.ts` — closed enum of 14 named counters · per-process snapshot API · honest `—` for uninstrumented counters (never fabricated). (iii) `signals.ts` — `emitSignal({subsystem, kind, code?, correlation_id?, detail?})` · bounded detail (240 chars max · quotes escaped) · fire-and-forget · never throws · SECURITY: never logs secrets/paths/credentials. (iv) `validate.ts` — `validateOrDrop<T>(rows, validator, opts)` shared JSON-boundary helper · invalid rows dropped + counted + signalled with per-row reason. **Contract tests:** 16/16 pass in `observability-core.test.mjs` (positive AND failure signal each tested). **Wire-up:** F3 (`mirror()` in pg-to-supabase-shadow.ts now instruments success + failure with counters + signals · reverse-shadow.test.mjs updated with test shim · 15/15 assertions preserved) · F17 (pg-reads.ts::rowToInboxItem replaced by shape validator + validateOrDrop · invalid enum values now dropped instead of silently propagated) · F18 (manager.ts::updateInboxItemStatuses uses validateOrDrop at fs.readFile boundary) · F19 (fs-store.ts new `parseJobsJsonl` shared helper · used by both listJobs and jobStats · malformed lines counted + signalled). **Full regression: 122/124 pass** (same 2 pre-existing libuv teardown flakes · zero regressions from this step). **Remaining GROUP B findings (F4, F5, F6, F7, F8, F9, F10) stay OPEN** — shared infrastructure ready · per-site wiring pending. | Claude |
| 2026-08-10 | **Step 6b · GROUP B · F4/F5/F6/F7/F8/F9/F10 → READY** (all remaining Group B). **F4** · `updateInboxItemStatuses` returns discriminated `WritebackOutcome` (success/partial/failed) · caller matches on kind + surfaces `inbox_writeback_status` in dispatch return + counter `manager.inbox_writeback_failed` fires on failed branch. **F5** · `readInboxIndex` returns `ReadInboxResult` (sourceHealth: ok/degraded + reason) · dispatch return extended with `inbox_source_health` + optional `inbox_source_reason` — "queue empty" is now distinct from "read failed". **F6** · `routeJobSafe` catch fires `router.route_failed` counter + `route-failed` signal with err.code. **F7** · enqueue loop tracks `enqueueFailed: Array<{id, reason}>` · per-item counter + signal · `ProcessingReport.enqueueFailed[]` added · report note honestly reports partial state. **F8** · `createJobSafe` catch fires `jobs.create_failed` counter + `create-job-failed` signal · backward-compatible null return preserved. **F9** · new bounded ring buffer `src/lib/nex/observability/retry-buffer.ts` (capacity=1000 · caller-untunable) · `emitAuditEvent`/`emitAuditEvents` enqueue failed events · new `drainAuditRetryBuffer()` with `MAX_RETRY_ATTEMPTS=3` returns `{attempted, succeeded, requeued, dropped}` · overflow evicts oldest + fires `audit-emit-dropped`. **F10** · 5 callsites (inbox readIndex/readStats + jobs getJob/listJobs/jobStats via shared `emitJobsPgFallback` helper) all fire `pg-read-fallback` counter + signal — successful filesystem fallback is FALLBACK not SUCCESS. **New assertions:** 8 in `retry-buffer.test.mjs` + 18 in `group-b-wireup.test.mjs` (structural drift-catcher) = 26 new. **Tests updated (not weakened):** `inbox-truthfulness.test.mjs::IB6+IB7` rewritten to assert the new WritebackOutcome + inbox_source_health contract. `manager-dispatch.test.mjs::MD9+MD10` rewritten to assert the same. Both updates track the remediation · original safety invariants (writeback never throws to caller · 5-field-baseline preserved) still asserted. **Full regression: 148/150 pass** (same 2 pre-existing libuv teardown flakes · zero regressions from Step 6b). | Claude |
| 2026-08-10 | **Step 7 · F34 · withBrainRole shared helper → READY.** Established finding scope first: verified 6 duplication sites (audit had said 3 · my own Step 3 F2 remediation added the 6th via `pg-claim.ts`). 5 identical `Promise<T \| null>` shapes + 1 divergent `Promise<T>` throwing-on-null (`object-postgres.ts`). New canonical helper at `src/lib/nex/db/with-brain-role.ts` exports BOTH variants: `withBrainRole` (nullable) + `withBrainRoleStrict` (throws with `.code="pg-not-configured"`). Behavior preserved at all 6 sites. **Adoption drift-catcher** (`with-brain-role-adoption.test.mjs`) enforces: every migrated site imports from shared module · no local `async function withBrainRole<T>` remains · exactly ONE file defines the helper across `src/lib/nex/**`. **Contract test:** 10 assertions (WBR1-WBR10) cover BEGIN+SET LOCAL ROLE ordering · COMMIT/ROLLBACK semantics · null return · connection release · exact role name · ROLLBACK-failure-does-not-mask-fn-throw · strict variant correctness. **Existing tests updated (not weakened):** `inbox-jobs-shadow.test.mjs::S4` rewritten to assert the F34 consolidation invariant (both files IMPORT shared helper AND shared helper OWNS the `SET LOCAL ROLE` string) — original safety property "both modules use nex_brain_app role" preserved. `claim-race.test.mjs::CR4b + CR4c` shims extended to inject the new shared helper into the inline-transpiled module. **Full regression: 161/163 pass** (same 2 pre-existing libuv teardown flakes unchanged · zero regressions from Step 7). **F12 prerequisite unblocked** — the future storage.ts extraction can now use the shared helper. | Claude |
| 2026-08-10 | **Step 8 · F35 · finalizeWorkerJob shared helper → READY.** Established finding scope first · verified 6 workers each maintain their own insertResult+enqueue+audit+completeJob chain with GENUINE domain divergence (context/voice/learning enqueue a next stage · learning-context has a side-effect between enqueue and audit · image-analyst + knowledge-extractor + quality-checker emit per-record audits earlier and have no final worker-completion audit). Canonical helper at `src/lib/nex/brain/workers/_finalize.ts` exports `finalizeWorkerJob(store, { job, resultInput, nextJob?, betweenNextJobAndFinalAudit?, finalAudit? })` firing insertResult → enqueueJob → hook → insertAudit → completeJob in exact order · plus `failWorkerJob(store, job, err, tag)` returning the extracted message for downstream side-effects (knowledge-extractor's KnowledgeJob failure sync). **All 6 workers migrated** with EXACTLY ONE finalizeWorkerJob call + EXACTLY ONE failWorkerJob call each (proves genuine convergence per Philip's rule that workers must not merely import the helper while retaining divergent logic around it). Contract test 10 assertions (FZ1-FZ10) · drift-catcher 5 assertions (FZA1-FZA5) including zero-direct-store-call rules · **15/15 pass**. Full regression: 176/178 (same 2 pre-existing libuv teardown flakes · zero regressions from Step 8). | Claude |
| 2026-08-10 | **Step 9 · F33 · sourcePriority extraction → READY · with F33.b divergence surfaced.** Scope-verification during Step 9 CHANGED the finding characterization: original F33 said "4-way duplication of identical switch" · actual state was **5 sites** (4 identical `sourcePriority` functions + 1 divergent `priorityForSource` Record<KnowledgeSource, number> literal in `storage.ts::runProcessInbox` with different values across 6 of 8 sources · gov-standards=3 vs canonical 1 · chatgpt-approved=3 vs 2 · etc). Canonical `src/lib/nex/brain/priorities.ts` created and 4 identical sites migrated (manager + 3 context workers · zero behavior change). **F33.b divergent site preserved inline** with an explicit marker documenting the value delta + the alignment procedure · pending Philip's product decision on whether aligning storage.ts's runProcessInbox enqueue priorities is authorized (alignment WOULD change enqueue priority for items dispatched via that path). 9 assertions in `priorities.test.mjs` · 4 contract (SP1-SP4) + 5 drift-catcher (SPA1-SPA5) including a dedicated F33.b marker-preservation test so no future edit silently aligns without approval. Full regression: 185/187 pass (same 2 pre-existing libuv teardown flakes · zero regressions from Step 9). | Claude |
| 2026-08-11 | **Philip locked stronger F12 scope.** "The whole point of F12 is to finish the extraction without recreating the historical Brain × NEX Storage duplication." Explicit invariants named: storage.ts is the SOLE Brain selector · adapters are pure classes (no selector logic, no cached singletons, no env-var branching) · brain adapters MUST NOT import from `src/lib/nex/storage/*` · exactly ONE dual-write decorator (MirrorToSupabaseBrainStore · gated by NEX_BRAIN_SHADOW_SUPABASE=1) · provider-SDK imports confined to adapters/ · env-var reads centralised. Acceptance test must prove "for any Brain operation, there is exactly ONE authoritative selected persistence path" and "NEX Storage and Brain Storage cannot both persist the same Brain responsibility." | Philip |
| 2026-08-11 | **Step 10 · F12 storage.ts extraction → READY · F12.b surfaced.** Behavior-preserving extraction complete. `src/lib/nex/brain/storage.ts` reduced from 1012 → 303 lines · now a selector-only shell. Three adapters at `adapters/{filesystem,postgres,supabase}.ts` (566 + 530 + 772 LOC · byte-identical class bodies · zero SQL / fs / method-signature drift). `MirrorToSupabaseBrainStore` in `pg-to-supabase-shadow.ts` NOT relocated (it is a decorator over the BrainStore interface · not a raw adapter · no provider-SDK import · moving would be pure organisational churn that would not strengthen the invariant · F37 keep-status preserved). `pg-to-supabase-shadow.ts::isReverseShadowEnabled` refactored to consume `activeBackend()` from storage.ts (AI7 · centralised env-var interpretation · RS3 updated to track). **Drift-catcher** `src/lib/nex/brain/tests/adapter-isolation.test.mjs` locks 8 architectural invariants (AI1-AI8) covering: selector uniqueness (AI1) · adapter purity (AI2 · no selector logic · no cached singletons · no env-var branching · no NEX_BRAIN_BACKEND read) · storage.ts imports no provider SDK (AI3) · brain adapters do not import from `src/lib/nex/storage/*` (AI4 · Brain × NEX Storage boundary) · exactly one dual-write decorator (AI5 · MirrorToSupabaseBrainStore in pg-to-supabase-shadow.ts · gated by NEX_BRAIN_SHADOW_SUPABASE=1 AND isSupabaseConfigured()) · provider-SDK imports confined to adapters/ with F12.b known-exception list that cannot grow (AI6) · NEX_BRAIN_BACKEND read only in storage.ts (AI7) · NEX_STORAGE_BACKEND read only in NEX Storage registry AND brain does not reach into NEX Storage's env (AI8). **8/8 drift-catcher assertions pass.** **Existing tests updated (not weakened):** brain-adapter-contract.test.mjs::C6 (parity check reads adapters/supabase.ts) · storage-characterization.test.mjs::SC12+SC14 (SupabaseStore location + adapter-source lookups) · dispatch-dedup.test.mjs::DD3+DD4+DD5 (adapter-source lookups) · reverse-shadow.test.mjs::RS3 (activeBackend() delegation replaces raw NEX_BRAIN_BACKEND string check). Every update tracks the F12 refactor — original safety properties preserved. **F12.b scope-verification finding surfaced:** audit-log.ts + warehouse.ts import @supabase/supabase-js directly (2 files) · codified in AI6's F12B_KNOWN_EXCEPTIONS set · drift-catcher refuses to let the list grow. **NOT expanded into F12** per Philip's directive. **Full regression: 83/89 pass** (+8 new drift-catcher assertions from AI1-AI8 · zero new F12-caused failures · 6 failures = 4 pre-existing PG-dependent test files that need PG on 5433 which is currently down + 2 pre-existing libuv teardown flakes unchanged since Wave 8). **tsc-brain-clean:** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → 11 total errors in the repo · **0 in `src/lib/nex/brain/**`** · extraction is type-clean. VERIFIED CLOSED requires PG-live full-regression proving 79/81 baseline preserved + production observation confirming no adapter regressions. | Claude |
