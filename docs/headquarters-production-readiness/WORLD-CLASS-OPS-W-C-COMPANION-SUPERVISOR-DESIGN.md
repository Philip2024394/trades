# W-C-COMPANION · KnowledgeJob Supervisor · Design-Only Investigation

**Programme:** Headquarters Production Readiness · W-C-COMPANION cluster · KnowledgeJob recovery architecture
**Position:** SEPARATE cluster · not W-C · not W-C-PREREQ · introduced by forensic evidence (`WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md`)
**Date:** 2026-08-11
**Authorization:** Philip 2026-08-11 · *"Authorize Phase 2 — W-C-COMPANION design-only investigation."* · Boundaries: *"no implementation, schema changes, config changes, tests, commit, or push."*
**Not-a-goal:** Implementation · schema change · migration · test authoring · fixing the 10 stuck jobs · committing · pushing · consuming implementation authorization for either W-C or W-C-COMPANION.
**North star:** *"How can Headquarters recover an orphaned KnowledgeJob without creating duplicate extraction work?"* Answer that against the three-atomicity model · not "which mechanism is cutest."

---

## 1 · Verified starting state (from forensic evidence)

Established by `WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md`:

- 10 KnowledgeJobs in `nex.knowledge_dump_jobs` stuck at `status='claimed'` · `progress=0` · up to 52+ hours old
- All 10 have EXACTLY 2 JSONL snapshots (`queued → claimed → DEAD`) — extractor never began (its first act writes `progress=50`)
- `nex.knowledge_dump_jobs` has NO lease-expiry columns · NO assigned_worker_id · NO attempt tracking
- Filesystem primary at `data/nex-jobs/jobs.jsonl` is the canonical KnowledgeJob store
- Postgres shadow via `pg-shadow.ts::shadowUpsertJob` (fires on createJob + updateJob when `NEX_INBOX_SHADOW_POSTGRES=1`)
- PG-side atomic claim primitive exists (`pg-claim.ts::pgAtomicClaimIfQueued`) — provides exactly-one-winner semantics on the shadow table
- 1 of 5 batch-claimed jobs completed while workers were running · 4/5 stuck → workers WERE running · per-job failures caused the stuck cases · specifics not determinable from local env
- Observability layer was empty for the 10 stuck jobs · but post Wave-11 GROUP B + W-OBS-1 Layer 1 · new cases will emit CID-tagged signals to `nex.events`
- **10 stuck jobs REMAIN preserved as forensic fixture**

## 2 · The gate question

> **"What mechanism can recover a KnowledgeJob without creating duplicate extraction work?"**

*Duplicate extraction work* means, concretely:

- Duplicate LLM calls (paid tokens · real cost · not just latency)
- Duplicate child WorkerJob enqueue (child dedup NOT idempotent today · see § 5.2 of the design doc)
- Duplicate audit rows (append-only · tolerable but noisy)
- Duplicate downstream memory writes (Wave 11 F12 `insertRecordIdempotent` covers this via `ON CONFLICT record_id DO NOTHING` — safe)

The record-write itself is idempotent (F12 shipped). The **LLM call and child-job enqueue are the two hazards** any supervisor must protect against.

## 3 · Three-atomicity refresher · every candidate must name its domain

Per the W-C design § 5.5 (Philip 2026-08-11 elevation candidate):

- **Database atomicity** — a Postgres transaction (BEGIN…COMMIT/ROLLBACK) protects a group of DB writes as a unit
- **Application-level idempotency** — a logical operation may execute more than once safely because the caller provides an explicit dedup key (e.g., `insertRecordIdempotent` uses `ON CONFLICT record_id`)
- **External side-effect idempotency** — a call to an external service (LLM · payment · notification) that we cannot roll back requires an idempotency key sent to the provider · OR caller-side dedup tracking

Cross-boundary work MUST explicitly name which domain protects it. This is the language every candidate answers to.

## 4 · Lifecycle trace · KnowledgeJob → WorkerJob → extractor (from source)

Traced from `manager.ts` + `fs-store.ts` + `_finalize.ts` + `knowledge-extractor.ts`:

```
[T0] User POST /api/nex/knowledge-inbox/dump
     → fs-store.createJob({source, owner, ...}) creates JSONL snapshot 1
       status='queued' · progress=0
     → pg-shadow.ts::shadowUpsertJob mirrors to nex.knowledge_dump_jobs

[T1] Cron / manual POST /api/nex/brain/dispatch
     → manager.ts::dispatchNewInboxItems() runs
     → for each waiting inbox item:
         · findActiveJobByInboxItemId(item.id) → finds queued KnowledgeJob K
         · claimJobIfQueued(K.job_id) → CAS transition queued → claimed (JSONL snap 2)
           uses pg-claim.pgAtomicClaimIfQueued (Wave 11 F2) for exactly-one-winner
         · store.enqueueJob({worker_type:"knowledge-context", input_payload:{knowledge_job_id: K.job_id, ...}})
           creates WorkerJob W with primary in brainStore()-selected backend

[T2] Worker chain (via cron / continuous):
     · knowledge-context worker claims W → runs → finalizeWorkerJob() enqueues voice-context W'
     · voice-context W' claims → runs → finalizeWorkerJob() enqueues learning-context W''
     · learning-context W'' claims → runs → finalizeWorkerJob() enqueues knowledge-extractor W'''
     · knowledge-extractor W''' claims → runs
         at line 202: updateKnowledgeJob(K, {status:'processing', progress:50})
                      ↑ FIRST update to K since claim · JSONL snap 3
         · LLM extraction · insertRecordIdempotent · etc
         at line 497 (success): updateKnowledgeJob(K, {status:'completed', progress:100, completion_result:{...}})
                                ↑ TERMINAL update · JSONL snap 4
         at line 520 (failure): updateKnowledgeJob(K, {status:'failed', ...})
                                ↑ TERMINAL update

[T3] KnowledgeJob K is now `completed` or `failed`
```

**Critical observation:** the extractor is the **ONLY** source of terminal state on KnowledgeJob. Grep confirms 3 sites in extractor + 0 elsewhere.

**Failure modes that produce stuck-claimed:**

- **Worker chain never runs** (workers not deployed / down at dispatch time)
- **Chain runs but breaks between stages** (context worker OK · voice-context crashes · extractor never runs)
- **Extractor claims WorkerJob W''' but dies before line 202** (progress stays 0 · matches all 10 stuck)
- **Extractor completes but writes to a store we can't see** (WorkerJob completion in Supabase · KnowledgeJob-side write races or fails silently)

For all four modes, the ORPHANED terminal state is: KnowledgeJob at `claimed` · progress 0 · no completion_result.

## 5 · Candidate 1 · Application-level sweep · full analysis

### 5.1 · Mechanism

A periodic cron job (frequency TBD · propose every 5-10 min):

```sql
SELECT job_id, created_at, updated_at, inbox_item_id, source
FROM nex.knowledge_dump_jobs
WHERE status = 'claimed'
  AND progress = 0
  AND updated_at < now() - INTERVAL '30 minutes';   -- staleness threshold
```

For each stale row, the sweeper decides one of:

1. **Re-queue** — write JSONL snap `{status:'queued', ...}` via `fs-store.updateJob(job_id, {status:'queued'})` · shadow mirrors
2. **Mark failed** — write JSONL snap `{status:'failed', completion_result:{reason:'sweep-orphan-detected', ...}}`
3. **Mark completed** — only if evidence exists in `nex.events` that the extractor DID complete against a different store

The decision uses the **W-OBS-1 correlation trail** as a safety check.

### 5.2 · Observability-integrated safety check (the piece that makes sweep safe)

Before re-queueing, sweeper checks:

```sql
-- Was there a worker-completed signal with matching correlation_id for this KnowledgeJob's inbox_item?
SELECT count(*)
FROM nex.events
WHERE event_type ILIKE 'nex_signal_worker_%'
  AND payload->>'kind' = 'worker-completed'
  AND payload->>'correlation_id' IN (
    SELECT payload->>'correlation_id'
    FROM nex.knowledge_inbox
    WHERE id = :inbox_item_id
  );
```

If count > 0 · extractor completed elsewhere · mark KnowledgeJob completed · do not re-queue.
If count = 0 · no completion evidence · re-queue OR mark failed based on age threshold.

**This check only works for jobs created after `08a116a` (W-OBS-1 Layer 1 shipped).** For the 10 pre-existing stuck jobs · no CID exists · they must be handled manually or by heuristic (e.g., after 24h stuck · mark failed).

### 5.3 · Three-atomicity mapping (Candidate 1)

| Step | Domain | Protection |
|---|---|---|
| Sweep SELECT | Database | Read-only snapshot · serializable-safe |
| `updateJob(K, {status:'queued'})` | Database + Application | fs-store append-only JSONL (DB · single append) + shadowUpsertJob upsert (DB · atomic) + application-level idempotency (`status='claimed'` guard in updateJob if we add it) |
| Re-queueing decision | Application | Sweep must re-issue safely if it runs before completion arrives · CAS check on status before update prevents overwrite of concurrent transition |
| External LLM call (on re-processed job) | **External** | LLM has NO natural idempotency key · Wave 11 F12 `insertRecordIdempotent` prevents duplicate record-write · but LLM tokens are re-charged. **Cost hazard is real · matches § 6.2 of design.** |

**Explicit domain names:** database (for the sweep + write) · application (for the safety check + CAS guard) · external side-effect awareness (for the LLM cost hazard · accepted trade-off).

### 5.4 · Duplicate-work risk

| Risk | Present? | Mitigation |
|---|---|---|
| Duplicate record-write | **NO** | Wave 11 F12 `insertRecordIdempotent` covers |
| Duplicate LLM call | **YES** — accepted | Sweep threshold (30 min) + observability check reduces frequency · but not to zero |
| Duplicate child job | **YES** — this is the exposure | Same problem as § 6.3 of W-C design · child dedup not native · sweep re-queue enqueues fresh WorkerJob chain |
| Duplicate audit | **YES · tolerable** | Append-only · noisy but not corrupting |

**The duplicate-child-job risk is inherited from W-C's own unresolved question.** Sweep doesn't create the risk · it exposes it more visibly. Both W-C and W-C-COMPANION share this concern.

### 5.5 · Trade-offs

**Advantages:**

- **No schema change** · lowest-risk delivery
- **Uses existing observability substrate** (post-W-OBS-1 · CID-in-nex.events)
- **Explicit staleness threshold** is operator-visible + tunable via env var
- **Composes with W-C** — W-C prevents future workers from hanging · sweep catches the residual orphans
- Idempotent by construction · safe to run every 5-10 min

**Disadvantages:**

- **Reactive · not preventive** — jobs sit stuck for up to N minutes before recovery
- Requires the sweep query to be efficient (indexed on `status` + `updated_at` · which already exists: `idx_knowledge_dump_jobs_status`)
- The 10 pre-existing stuck jobs lack CID trail · safety check can't help them · manual heuristic required for legacy set
- Re-queue creates duplicate WorkerJob child · same problem W-C already inherits

## 6 · Candidate 2 · Schema-level lease · full analysis

### 6.1 · Mechanism

Add columns to `nex.knowledge_dump_jobs` (mirroring `nex.worker_jobs` shape):

- `claimed_at TIMESTAMP WITH TIME ZONE`
- `lease_expires_at TIMESTAMP WITH TIME ZONE`
- `assigned_worker_id TEXT`
- `attempts INTEGER NOT NULL DEFAULT 0`
- `last_error TEXT`
- Partial index: `CREATE INDEX ON nex.knowledge_dump_jobs (lease_expires_at) WHERE status = 'claimed'`

Modify `fs-store.ts::claimJobIfQueued`:

```
claimJobIfQueued(job_id, {worker_id, lease_seconds}) →
  UPDATE ... SET status='claimed', claimed_at=NOW(),
                assigned_worker_id=worker_id,
                lease_expires_at=NOW()+lease_seconds
```

Sweep atomic UPDATE (reclaim expired):

```
UPDATE nex.knowledge_dump_jobs
SET status = 'queued',
    claimed_at = NULL,
    assigned_worker_id = NULL,
    lease_expires_at = NULL,
    attempts = attempts + 1
WHERE status = 'claimed'
  AND lease_expires_at < NOW()
  AND attempts < MAX_ATTEMPTS
RETURNING job_id;
```

### 6.2 · Filesystem primary implications

**KnowledgeJob type in `fs-store.ts:66-88` would grow those fields.** JSONL snapshots gain them. Every existing snapshot lacks them (backward-compat via nullable · but every reader must handle `undefined`).

**Every caller of `claimJobIfQueued`** must supply `worker_id` and `lease_seconds` (currently only `manager.ts:278` calls it · so this is a bounded change).

**This is a coordinated change: schema + filesystem type + call-site.** Not a small migration.

### 6.3 · Three-atomicity mapping (Candidate 2)

| Step | Domain | Protection |
|---|---|---|
| Claim (SET lease) | **Database** | Single atomic UPDATE with `WHERE status='queued'` clause · leverages same F2 exactly-one-winner |
| Sweep reclaim (SET queued) | **Database** | Single atomic UPDATE with `WHERE lease_expires_at < NOW()` · deterministic · zero application-level reasoning required |
| Attempt counter | **Database** | Atomic increment via `attempts = attempts + 1` |
| Max-attempts cap | Application | Sweep filters by `attempts < N` · after N attempts · mark failed rather than re-queue infinitely |
| External LLM on retry | **External** | Same LLM cost hazard as Candidate 1 · unchanged |

**Advantage vs Candidate 1:** the reclaim decision lives entirely in database atomicity. No application-level reasoning about staleness. Cleaner semantics.

### 6.4 · Duplicate-work risk

Same as Candidate 1 (duplicate LLM call · duplicate child job). The mechanism is different but the exposure is identical: any re-processing potentially duplicates external side-effects.

**Additional risk unique to Candidate 2:** filesystem primary snapshot shape change · deployment must migrate old JSONL rows to new schema · or code must handle both shapes. Non-trivial.

### 6.5 · Trade-offs

**Advantages:**

- **Strongest DB-level guarantees** (atomic UPDATE handles reclaim without heuristic)
- **Attempt counter is durable** — after N failed attempts, mark failed permanently (prevents infinite loop)
- **Assigned worker ID** helps forensic tracing (who claimed it)
- **Standard pattern** — matches `nex.worker_jobs` (proven design)
- **Lease-per-claim** enables shorter-then-configurable timeouts at the KnowledgeJob level (not just WorkerJob)

**Disadvantages:**

- **Schema change** · migration authorization · coordination with filesystem primary snapshot shape
- **Coordinated change across 3 layers** (schema · filesystem type · call-site · readers)
- **More invasive** · higher risk of introducing bugs during rollout
- Overkill at current scale (39 jobs sample · not 39,000)
- Doesn't help the pre-existing 10 stuck jobs any better than Candidate 1

## 7 · Candidate 3 · Reverse-cascade from WorkerJob outcome · full analysis

### 7.1 · Mechanism

Modify `failWorkerJob` in `_finalize.ts` to include cascade logic:

```
failWorkerJob(store, job, err, tag) → {
  await store.failJob(job.id, err.message)         // existing
  const kjobId = job.input_payload?.knowledge_job_id
  if (kjobId) {
    await updateKnowledgeJob(kjobId, {
      status: 'failed',
      completion_result: { reason: 'worker-chain-failure', worker: tag, error: err.message }
    })
  }
}
```

### 7.2 · Coverage limitation (this is the hard one)

**Reverse-cascade only fires when `failWorkerJob` is invoked.** The forensic evidence shows the 10 stuck jobs' WorkerJob chains produced ZERO `failWorkerJob` calls (no last_error entries · no audit rows · no observability trail).

**Failure modes reverse-cascade covers:**
- ✅ Worker's try/catch fires · `failWorkerJob` runs · KnowledgeJob updated
- ✅ Explicit worker error paths (LLM exhausted · content validation failed)

**Failure modes reverse-cascade does NOT cover:**
- ❌ Worker process crashes without invoking try/catch (SIGKILL · OOM · deployment kill)
- ❌ Worker completes but writes to a different store instance (Supabase · not visible here)
- ❌ Worker chain interrupted between stages (context → voice-context transition · no worker in between to invoke failJob)
- ❌ Lease-expiry-re-claim on WorkerJob side (if it exists) also needs to propagate

### 7.3 · Three-atomicity mapping (Candidate 3)

| Step | Domain | Protection |
|---|---|---|
| `store.failJob` on WorkerJob | **Database** | Adapter's `withBrainRole` transaction · ROLLBACK on throw |
| `updateKnowledgeJob` (cascade) | **Database + Application** | fs-store append + shadowUpsertJob · same as Candidate 1's write path |
| Ordering between failJob and cascade | **Application** | Two-phase · if `updateKnowledgeJob` throws · cascade is inconsistent (KnowledgeJob still `claimed`) |
| "Did the worker actually reach `failJob`?" | **UNPROTECTED** | Reverse-cascade cannot answer if the worker vanished silently |

**Explicit domain gap:** reverse-cascade has NO answer for the "worker vanished" case. That's the exact case that produced the 10 stuck jobs. Alone, it's insufficient.

### 7.4 · Duplicate-work risk

Lower than Candidates 1 & 2 because reverse-cascade never RE-QUEUES · it only marks failed. But it doesn't RECOVER · it just closes the loop.

- Duplicate LLM call: **NO** (no re-processing initiated)
- Duplicate child job: **NO**
- Duplicate audit: minimal
- **Missed recovery: YES** — if the KnowledgeJob failed transiently and a retry would succeed, reverse-cascade marks it failed permanently with no retry

### 7.5 · Trade-offs

**Advantages:**

- **Cleanest semantics** when workers actually reach their catch block
- **No sweep polling** · reactive at the point of failure
- **No schema change**
- Simple to implement

**Disadvantages:**

- **Does NOT cover the observed failure mode** (workers vanished · never reached failJob)
- **No retry mechanism** — every cascaded failure is terminal (or requires manual re-queue)
- **Alone, does NOT close the stuck-claimed gap**
- Best used as SUPPLEMENT to Candidate 1 or 2 · not primary

## 8 · Duplicate-work risk matrix (consolidated)

| Risk | C1 · sweep | C2 · schema-lease | C3 · reverse-cascade |
|---|---|---|---|
| Duplicate DB record-write | Mitigated (F12 ON CONFLICT) | Mitigated (F12) | N/A (no re-processing) |
| Duplicate LLM call on retry | **Accepted** (staleness threshold + CID safety check reduce freq) | **Accepted** (attempt counter caps · CID check possible) | **Avoided** (no retry) |
| Duplicate child WorkerJob enqueue | **Present** (inherits from W-C) | **Present** (same) | N/A |
| Duplicate audit rows | Tolerable | Tolerable | Minimal |
| Missed recovery (job permanently failed when retry would succeed) | Minimal (sweep re-queues) | Minimal (lease reclaim re-queues) | **Present** (no retry mechanism) |
| Silent vanishing worker | **Detected** (sweep) | **Detected** (lease expiry) | **Not detected** |
| Cross-store completion race (Supabase vs local) | **Detected via CID check in nex.events** | Not detected without additional logic | N/A |

## 9 · Recommendation · staged hybrid

### 9.1 · Primary: **Candidate 1 (application-level sweep) + observability-integrated safety check**

**Why this wins:**

1. **Directly answers the gate question** — sweep with CID safety check prevents duplicate extraction work by consulting `nex.events` for completion evidence before re-queueing
2. **No schema change** · matches the "measure-reality-first · minimize-change" discipline
3. **Uses the substrate we already shipped** (Wave 11 GROUP B · W-OBS-1 Layer 1 · `nex.events` with CID)
4. **Composes cleanly with W-C** — W-C prevents new hangs · sweep catches the residual
5. **Handles the observed failure mode** (silent vanishing workers · which reverse-cascade does not)
6. **Explicitly names all three atomicity domains** (§ 5.3)
7. **Sample size (39 jobs · 10 stuck) does not yet justify Candidate 2's schema-change cost**

### 9.2 · Supplement: **Candidate 3 (reverse-cascade)** as fast-path when failJob fires

**Why include it:**

- When workers DO reach their catch block · cascade fires immediately (no sweep-interval wait)
- Cheaper for the common failure case
- Sweep handles the residual (silent vanish · missed cascade · orphaned across store boundaries)

**Composition:** cascade fires at workerJob failure · sweep runs every 5-10 minutes as safety net · both write via `updateKnowledgeJob` so state machine stays coherent.

### 9.3 · Defer: **Candidate 2 (schema-lease)**

**Why deferred:**

- Schema change + filesystem primary snapshot shape change + coordinated migration = substantial risk
- Adequate observability + sweep works at current scale
- **Escalate to Candidate 2 IF:**
  - Sweep proves too slow / inefficient at 10x+ current scale
  - Attempt tracking becomes operationally required
  - OR a separate finding forces a schema change to `nex.knowledge_dump_jobs` anyway (then folding in lease is efficient)

Candidate 2 remains architecturally sound · just not the first move.

### 9.4 · What the recommended architecture DOES NOT do

- Does NOT modify F35 (that's W-C's scope · separate)
- Does NOT modify the KnowledgeJob type in filesystem primary (no new fields)
- Does NOT touch child-worker-job idempotency (still open · same as W-C · shared concern)
- Does NOT enable pg_stat_statements (separate)
- Does NOT fix the 10 existing stuck jobs (they stay preserved · become the contract-test fixture after sweep is proven in dev)

## 10 · Implementation sketch (design-only · NOT authorized)

If/when W-C-COMPANION Phase 1 is authorized · the implementation shape would be:

**New files (design only · not being written):**

- `src/lib/nex/jobs/supervisor.ts` — new module · exports `sweepStaleClaimedJobs()` + `cascadeKnowledgeJobFailure()`
- `src/app/api/nex/brain/supervisor-sweep/route.ts` — cron entry point (5-min interval · gated on `NEX_KJOB_SUPERVISOR_ENABLED=1`)
- Contract tests + drift-catchers per Wave 11 discipline

**Modified files:**

- `src/lib/nex/brain/workers/_finalize.ts` — `failWorkerJob` gains cascade call (Candidate 3 supplement)

**New env-gates:**

- `NEX_KJOB_SUPERVISOR_ENABLED` — default off · opt-in
- `NEX_KJOB_STALENESS_MINUTES` — sweep threshold · default 30
- `NEX_KJOB_MAX_ATTEMPTS` — safety cap on re-queue · default 3

**Tests:**

- Contract: 10 pre-existing stuck jobs are the test fixture · assert sweep classifies each correctly (re-queue if young enough · mark failed if past max attempts · mark completed if CID trail shows completion)
- Drift: sweep only reads · never writes without going through `fs-store.updateJob` (idempotency guarantee)
- Regression: existing W-OBS-1 CID tests preserved · Wave 11 F2 F9 F12 F35 all preserved

**Rollback:**

- `NEX_KJOB_SUPERVISOR_ENABLED=0` → sweep stops · no state corruption possible (sweep is a pure add · never a required precondition)

## 11 · Contract-test fixture · the 10 preserved stuck jobs

The 10 preserved KnowledgeJobs are the natural fixture for supervisor contract tests:

- 4 in Cohort A (batch-claimed 2026-08-08 04:22 UTC · 3 without knowledge_type · 1 platform:Doors)
- 6 in Cohort B (individually claimed over 2 days · mostly no knowledge_type · 1 platform:Staircases)
- All with `progress=0`, `completion_result=null`, `status='claimed'`
- All old enough to trigger any reasonable staleness threshold

**After W-C-COMPANION implementation:**

- Contract test runs sweep against dev DB · asserts all 10 transition to `failed` (no CID trail exists · max-attempts is 0 for pre-existing) OR the operator explicitly marks them per manual policy
- Un-sticking is then a DELIBERATE OPERATIONAL ACTION · not an implementation side effect

**Do NOT un-stick them during design or implementation.** They stay preserved · they earn their contract-test value · then they get un-stuck once the mechanism is proven.

## 12 · Explicit answers to the gate question

> **"What mechanism can recover a KnowledgeJob without creating duplicate extraction work?"**

**Answer (for the recommended hybrid):**

Sweep + observability-integrated safety check + reverse-cascade supplement recovers orphaned KnowledgeJobs via three coordinated protections:

1. **Database atomicity** — every `updateJob` write is a single atomic transaction · shadow mirror follows
2. **Application-level idempotency** — sweep is idempotent by construction (repeat runs on same rows produce same result) · CAS guard on status prevents overwriting a concurrent completion · Wave 11 F12 `insertRecordIdempotent` covers record dedup on any re-processing
3. **External side-effect idempotency (partial)** — LLM has no native idempotency · CID safety check consulting `nex.events` for prior worker-completed signals is the best available substitute · duplicate LLM call is a bounded accepted cost when the staleness threshold and safety check both agree the job needs re-processing

**What CANNOT be fully prevented:**

- Duplicate LLM tokens if extractor completed against a store we can't see AND no worker-completed signal was emitted with the matching CID
- Duplicate child WorkerJob enqueue (shared concern with W-C)

These residual risks are documented · accepted · not silent · and the accepted-cost profile is smaller than the alternative (jobs stuck forever · workflow blocked · manual operator intervention required for every stuck case).

## 13 · Boundaries preserved by this design pass

| | Status |
|---|---|
| Implementation | ❌ zero |
| Schema change | ❌ zero |
| Migration | ❌ zero |
| Config change | ❌ zero |
| `.env` change | ❌ zero |
| Test files | ❌ zero |
| F35 modification | ❌ zero |
| W-C implementation | ❌ zero |
| W-C-COMPANION implementation | ❌ zero |
| 10 stuck jobs · state | 🔒 preserved · untouched |
| pg_stat_statements | ❌ not enabled |
| Commit | ❌ none |
| Push | ❌ none |
| Consumed implementation authorization | ❌ none for either W-C or W-C-COMPANION |
| Working tree · staged | 0 files |
| Origin/main | `08a116a` (unchanged) |

## 14 · Awaiting authorization for next step

- **(A) Apply cross-references to `WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md`** — link § 15.2 to this new detailed design · documentation-only
- **(B) Authorize W-C implementation** (Phase 1 of the ship sequence) — W-C-COMPANION follows separately
- **(C) Authorize W-C-COMPANION implementation** (Phase 1 · application sweep + supplement cascade · no schema) — deliberate risk decision
- **(D) Investigate Supabase-side for the 4 Cohort A partial-completion cases** — would clarify why 1/5 completed while 4/5 stuck (currently NOT DETERMINABLE from local env)
- **(E) Redirect**

**Standing by. Zero authorization consumed.**

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-08-11 | W-C-COMPANION design-only investigation authored · 3 candidates compared (application-sweep · schema-lease · reverse-cascade) · each explicitly mapped to three-atomicity domain rule · duplicate-work risk matrix authored · **recommendation: Candidate 1 (application sweep with CID-integrated safety check) as primary + Candidate 3 (reverse-cascade) as supplement · Candidate 2 (schema-lease) deferred** · 10 stuck jobs designated as contract-test fixture · zero implementation · zero schema · zero commit | Claude (design-only per Philip authorization) |
