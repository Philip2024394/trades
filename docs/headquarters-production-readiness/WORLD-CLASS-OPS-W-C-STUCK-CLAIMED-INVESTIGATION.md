# W-C · Stuck-Claimed Jobs · Forensic Investigation Report

**Programme:** Headquarters Production Readiness · W-C timeout budgets · pre-implementation forensic
**Target:** the 10 `nex.knowledge_dump_jobs` rows found stuck in `status = 'claimed'` during live PG verification
**Environment:** local dev · PG 17.10 on `localhost:5433` · database `nex_dev` · filesystem primary at `data/nex-brain/*` and `data/nex-jobs/*`
**Date:** 2026-08-11
**Authorization:** Philip 2026-08-11 · *"INVESTIGATE STUCK-CLAIMED — READ-ONLY FORENSICS ONLY. Do not 'fix' the stuck jobs during the investigation. We want the forensic state preserved."*
**Preservation discipline:** ZERO writes to any DB · zero file mutations · every stuck-claimed row observed by this investigation was in status `claimed` at start and at end.

---

## 0 · Guardrails held (verified at end)

| | Result |
|---|---|
| Any stuck job "fixed" or advanced | ❌ zero — all 10 remain in `claimed` |
| Any DB write | ❌ zero — SELECT/SHOW only |
| Any file mutation | ❌ zero — read-only |
| Any schema change | ❌ zero |
| Any config change | ❌ zero |
| `.env` modification | ❌ zero |
| F35 modification | ❌ zero |
| Worker/implementation change | ❌ zero |
| Commit / push | ❌ zero |
| `pg_stat_statements` enable | ❌ not touched |

---

## 1 · The 10 stuck-claimed jobs · full snapshot

Sorted by `created_at`:

| # | job_id (short) | source | knowledge_type | created_at (UTC) | updated_at (UTC) | age (h) | since_update (h) |
|---|---|---|---|---|---|---|---|
| 1 | `b1772902` | Knowledge Dump | (none) | 2026-08-07 00:21 | 2026-08-08 04:22 | 52.4 | 24.4 |
| 2 | `1e09c119` | Knowledge Dump | platform:Doors | 2026-08-07 01:29 | 2026-08-08 04:22 | 51.3 | 24.4 |
| 3 | `6381641c` | Knowledge Dump | (none) | 2026-08-07 03:15 | 2026-08-08 04:22 | 49.5 | 24.4 |
| 4 | `7e1fc4f9` | Knowledge Dump | (none) | 2026-08-08 03:25 | 2026-08-08 04:22 | 25.4 | 24.4 |
| 5 | `270865e6` | Knowledge Dump | platform:Staircases | 2026-08-08 04:38 | 2026-08-08 04:42 | 24.2 | 24.1 |
| 6 | `7fc668ef` | Knowledge Dump | (none) | 2026-08-08 17:15 | 2026-08-08 17:15 | 11.5 | 11.5 |
| 7 | `47e0cf43` | Knowledge Dump | (none) | 2026-08-08 17:16 | 2026-08-08 18:55 | 11.5 | 9.9 |
| 8 | `ab5835b8` | Knowledge Dump | (none) | 2026-08-08 21:07 | 2026-08-08 21:07 | 7.7 | 7.7 |
| 9 | `56e1da78` | Knowledge Dump | (none) | 2026-08-08 21:15 | 2026-08-08 21:20 | 7.5 | 7.5 |
| 10 | `46a8eb51` | Knowledge Dump | (none) | 2026-08-08 21:22 | 2026-08-08 21:23 | 7.4 | 7.4 |

**Common properties across all 10:**
- `status = 'claimed'`
- `progress = 0`
- `completion_result = NULL`
- `source = 'Knowledge Dump'` · `owner = 'admin'`

## 2 · Two distinct cohorts identified

**Cohort A (jobs #1-4)** — 4 jobs all claimed within a 3.6-second window at 2026-08-08 04:22:01-05 UTC. This is a single dispatch cycle iterating through 4 backlog items in rapid succession.

**Cohort B (jobs #5-10)** — 6 jobs claimed individually across 2026-08-08 and 2026-08-09 · various minute-scale gaps between claims.

## 3 · Shadow-write evidence · confirms Postgres is the SHADOW, not primary

Query on `shadow_written_at` and `shadow_updated_at` columns:

| Cohort | Sample | Shadow lag |
|---|---|---|
| **Cohort A** | 5 rows (includes 270865e6 which was claim-adjacent) | **17,386-18,626 seconds (~5 hours)** — shadow was BACKFILLED on 2026-08-08 16:32 · not written in real-time |
| **Cohort B** | 5 rows | 0.003-0.228 seconds — normal real-time shadow-write |

**Interpretation:** Cohort A jobs were originally claimed via the filesystem primary at 04:22 UTC · the Postgres shadow row wasn't written until 5+ hours later during a batch shadow catch-up run (Wave 11 F17 / Phase 11.2 shadow-write remediation timing).

**Verdict for §3:** the Postgres `nex.knowledge_dump_jobs` we're inspecting is a SHADOW · not the primary lifecycle source. **The primary is the filesystem JSONL at `data/nex-jobs/jobs.jsonl`** (per `src/lib/nex/jobs/fs-store.ts:18` and `:56`).

## 4 · Primary lifecycle source · the JSONL evidence

`data/nex-jobs/jobs.jsonl` is 228 lines · 81 unique `job_id`s · append-only snapshots.

**Snapshot count per stuck job: EXACTLY 2 for all 10.**

Reading the actual snapshots (representative sample · pattern is identical for all 10):

```
job b1772902  · snap 1: status=queued  created=2026-08-07T00:21  updated=2026-08-07T00:21  progress=0
              · snap 2: status=claimed created=2026-08-07T00:21  updated=2026-08-08T04:22  progress=0
              · (no snap 3 — job never advanced from claimed)
```

**Comparison to a completed job (`4ddcb080`):**

```
snap 1: status=queued    updated=2026-08-07T00:51:29.157Z  progress=0
snap 2: status=completed updated=2026-08-07T00:51:29.345Z  progress=100
snap 3: status=completed updated=2026-08-07T00:51:29.360Z  progress=100  (duplicate write)
```

**Two structural observations:**

1. **Completed jobs skip `claimed` and `processing` entirely** — they go `queued → completed` in ~200 ms via a synchronous fast-path (probably in-request processing at dump time)
2. **Stuck jobs went `queued → claimed` and stopped** — the async worker-chain path started (dispatch cycle claimed them) but the terminal write to `knowledge_dump_jobs` never happened

## 5 · Where the completion write comes from · code trace

**Manager dispatch (`src/lib/nex/brain/manager.ts:278`):**
- Only caller of `claimJobIfQueued(linkedKJob.job_id)` in the entire codebase (verified via grep)
- After successful claim (line 279): `knowledge_job_id = claim.claimed.job_id`
- Immediately enqueues a WorkerJob (line 286): `store.enqueueJob({worker_type: "knowledge-context", ..., input_payload: {..., knowledge_job_id, ...}})`
- Comment on line 274: *"The extractor closes the loop with `completed` / `failed` after processing."*

**Extractor closes loop (`src/lib/nex/brain/workers/knowledge-extractor.ts`):**
- Line 43: `import { updateJob as updateKnowledgeJob } from "@/lib/nex/jobs/fs-store"`
- Line 199-200: captures `knowledgeJobId` from `job.input_payload`
- Line 202 (first act of extractor): `await updateKnowledgeJob(knowledgeJobId, { status: "processing", progress: 50 })`
- Lines 495-497 (success path): `await updateKnowledgeJob(knowledgeJobId, { status: "completed", ... })`
- Lines 518-520 (failure path): `await updateKnowledgeJob(knowledgeJobId, { status: "failed", ... })`

**Critical:** every stuck job has `progress = 0`. Extractor's FIRST act is to write `progress = 50`. **Therefore: extractor never started for any of the 10 stuck jobs.**

Since only the extractor writes terminal status to `knowledge_dump_jobs`, and no extractor ran, the jobs are frozen at `claimed`.

## 6 · Did the enqueued WorkerJobs ever exist? · The WorkerJob store trace

The manager's `store.enqueueJob(...)` on line 286 writes to whichever backend `brainStore()` selected. Three possible backends (per F12): filesystem · Supabase · Postgres.

**Filesystem primary check (`data/nex-brain/worker_jobs.json`):**
- File size: 482 KB · 40 total WorkerJobs · **all with `status = "completed"`**
- File mtime: **2026-08-06 07:21** — 24+ hours BEFORE the earliest stuck job was claimed (2026-08-07 00:21)
- Grep for any of the 10 stuck `knowledge_job_id`s inside the file: **0 matches** for every one
- Worker types in the file: knowledge-context (8) · voice-context (8) · learning-context (8) · knowledge-extractor (5) · quality-checker (8) · image-analyst (3)

**Postgres shadow check (`nex.worker_jobs`):** 0 rows total (verified in §12.3 of live-verification report)

**Verdict:** The WorkerJobs enqueued by manager.ts for the 10 stuck knowledge_job_ids exist in **NEITHER filesystem primary nor Postgres shadow**. Therefore they were either:

- (a) enqueued to a **Supabase-backed store** that this dev environment cannot see (most likely · matches the pre-Phase-11 backend where Supabase was authoritative), OR
- (b) enqueued to a store instance that has since been reset/wiped

## 7 · Observability trail · what audit / event evidence exists

Cross-referenced every possible audit table:

| Source | Rows referencing any stuck job_id |
|---|---|
| `nex.events` (total 2 rows · both storage.roundtrip.verify) | **0** |
| `nex.audit_log` (0 rows total) | 0 (table empty) |
| `nex.worker_audit_events` (0 rows total) | 0 (table empty) |
| `nex.worker_heartbeats` (0 rows total) | 0 (table empty) |
| `nex.recovery_attempts` (0 rows total) | 0 (table empty) |
| `data/nex-audit-log/*.jsonl` (filesystem primary) | Not searched — outside stuck-job window · file dated 2026-08-02 |

**Every observability table in this Postgres is empty.** The 10 stuck jobs left **NO forensic trail** in the DB observability layer.

`nex.events` (which W-C would populate via `emitSignal`) has only 2 test rows from `storage.roundtrip.verify` on 2026-08-07 12:58 — coincidentally after Cohort A jobs were created but before they were claimed.

## 8 · The "5th job of the batch" · one out of five DID complete

At 2026-08-08 04:22 UTC · **5 jobs** were claimed in the same dispatch cycle:

| ts (UTC) | job_id | fate |
|---|---|---|
| 04:22:00.112 | `0145399c` | **completed at 04:45:16** (~23 min after claim) |
| 04:22:01.924 | `7e1fc4f9` | STUCK · never advanced |
| 04:22:02.751 | `6381641c` | STUCK · never advanced |
| 04:22:03.330 | `1e09c119` | STUCK · never advanced |
| 04:22:05.539 | `b1772902` | STUCK · never advanced |

**One out of five completed. Four out of five stuck.**

- `0145399c` was **freshly-created** (04:21:41 · claimed 19s later) — fast path
- The 4 stuck were **backlog items** (older creations · from 2026-08-07 or earlier that day)

Workers WERE running at that time (they processed `0145399c`). Whatever happened to the other 4 was per-job · not "workers were down." Possible reasons:
- Worker chain crashed partway through for those 4 specifically
- LLM provider error / rate limit for those specific payloads
- Payload-content triggered a code path that hung
- Worker deployment rolled during their processing
- **Cannot distinguish without WorkerJob-side records** (which live in Supabase · not here)

## 9 · Classification against Philip's 7 causes

Format: **cause · verdict (PROVEN / LIKELY / POSSIBLE / NOT DETERMINABLE) · evidence**

### 9.1 · Worker crash

**Verdict: POSSIBLE · cannot distinguish from other causes.**

- Evidence for: Cohort A had 1/5 completions while workers were clearly running (0145399c completed) — the other 4 could have crashed mid-work
- Evidence against: no crash logs · no worker heartbeats to see gaps · WorkerJob records that would show partial progress live in Supabase (inaccessible from this env)
- **NOT DETERMINABLE from local data alone.** Would require Supabase inspection.

### 9.2 · Lease expiry

**Verdict: PROVEN · NO LEASE MECHANISM EXISTS for `nex.knowledge_dump_jobs`.**

- The KnowledgeJob type (`src/lib/nex/jobs/fs-store.ts:66-88`) has NO `lease_expires_at` · NO `assigned_worker_id` · NO `assigned_at` columns
- The claim function `claimJobIfQueued` sets `status = "claimed"` and never a lease
- No cron / supervisor / re-claim path exists for stale `claimed` entries
- **Compare:** `nex.worker_jobs` DOES have `lease_expires_at` + `assigned_at` — WorkerJobs get automatic re-claim; KnowledgeJobs do NOT
- **PROVEN: KnowledgeJob has no lease-expiry safety net · therefore lease expiry cannot have fired · therefore no automated recovery exists for orphaned claims**

### 9.3 · Missing finalization

**Verdict: PROVEN.**

- knowledge-extractor is the sole writer of `completed`/`failed` to `knowledge_dump_jobs` (line 43 imports · line 495 + 520 write)
- Extractor's first act is `progress = 50` (line 202)
- All 10 stuck jobs have `progress = 0`
- **Therefore extractor never began execution for these 10 jobs.**
- Finalization was NEVER attempted — this is not "started but failed to finalize", it's "never reached the finalization writer at all"

### 9.4 · Retry-state failure

**Verdict: NOT DETERMINABLE.**

- `llm_retry_queue` table not inspected (would require additional read · relevant if the extractor got as far as LLM retry)
- But since extractor never ran (progress = 0), it never reached retry state anyway
- **Ruled out for these 10 · but retry-state issues would only be relevant if extractor had started**

### 9.5 · Process / deployment termination

**Verdict: POSSIBLE for Cohort A · LIKELY not for Cohort B.**

- Cohort A · 4 stuck + 1 succeeded in the same batch → **partial batch fail is inconsistent with deployment kill** (deploy kill would take all 5 out equally · not 1 success + 4 fails)
- Cohort B · 6 individual failures across multiple hours · **each could plausibly be its own crash**
- Deployment logs would clarify · not available from this env
- **INCONSISTENT with Cohort A pattern · possible for Cohort B**

### 9.6 · Orphaned claim (dispatch called `claimJobIfQueued` but downstream chain never activated)

**Verdict: PROVEN as the terminal shape · CAUSE not determinable.**

- `claimJobIfQueued` succeeded (fs-store.jobs.jsonl shows the transition)
- WorkerJob enqueue call at manager.ts:286 must have executed (no exception unwind would leave shadow-write intact)
- Downstream WorkerJob chain either (a) never claimed the enqueued WorkerJob · (b) claimed but failed silently · (c) claimed and completed but wrote to a store we can't see (Supabase)
- **The visible terminal state is "orphaned claim."** Whether that's due to workers-not-running · workers-crashing · or store-writes-elsewhere is not determinable from this env.

### 9.7 · Instrumentation blind spot

**Verdict: PROVEN · this is the biggest single finding.**

- Zero events in `nex.events` for any of the 10 job_ids
- Zero rows in `nex.worker_heartbeats` · `nex.worker_audit_events` · `nex.audit_log` · `nex.recovery_attempts` — every audit table is empty on this instance
- Filesystem primary `data/nex-audit-log/*.jsonl` dated 2026-08-02 · pre-dates all 10 stuck jobs
- **The Brain observability layer captured nothing about the lifecycle of these jobs beyond the JSONL snapshots themselves**
- **This is exactly the case Wave 11 GROUP B remediation was designed to prevent** (F3 through F10 · Step 6a/6b · shipped in commit `6b3458d`) — those signals would now capture worker-failure events · but the 10 stuck jobs pre-date that remediation being active

## 10 · Consolidated interpretation

**What is PROVEN:**

1. All 10 stuck jobs successfully transitioned `queued → claimed` via the fs-store primary
2. All 10 shadow-writes to Postgres reflect that transition (Cohort A with 5h backfill lag · Cohort B in real-time)
3. Extractor never began execution for any of the 10 (progress stayed at 0)
4. No terminal state was ever written · no worker chain crashed with a recorded audit trail here
5. **`nex.knowledge_dump_jobs` has NO lease-expiry mechanism** — once orphaned in `claimed`, there is no automated recovery
6. **The observability layer captured NOTHING** about these lifecycles (audit + heartbeat + events all empty)
7. Workers WERE running (proven by `0145399c` completing during the same dispatch cycle as Cohort A)
8. WorkerJob store where downstream chain would have written is NOT in this local dev env (filesystem primary stale since 2026-08-06 · Postgres shadow empty · Supabase inaccessible)

**What is NOT DETERMINABLE from this environment:**

- Whether the workers-that-were-running actually claimed the enqueued WorkerJobs for these 10
- Whether the LLM chain succeeded/failed for these payloads specifically
- Whether the workers experienced a crash · rate-limit · silent throw · deployment rollover during processing
- Whether a WorkerJob completion was written to a Supabase-backed store that we cannot see

**What could be determined with additional access:**

- Supabase inspection of `worker_jobs` + `worker_results` + `audit_log` around 2026-08-07 to 2026-08-09 · would show whether WorkerJobs for these 10 knowledge_job_ids exist there and what their terminal state was
- Worker deployment logs (Vercel Cron logs · Fly worker logs) for the 2026-08-07 to 2026-08-09 window · would show crashes/deploys
- LLM provider logs for that window · would show provider-side errors

## 11 · Implications for W-C architecture · this changes the plan

### 11.1 · Timeouts alone would NOT fix stuck-claimed KnowledgeJobs

The W-C design's T-6 (15m worker cycle deadline) + T-7 (5m per-job budget) apply to **WorkerJobs**, not KnowledgeJobs.

- Even if T-6 had been in place · a worker that timed out at 15 min would fire `failWorkerJob` on the WorkerJob (updating `nex.worker_jobs` OR the equivalent Supabase row)
- **KnowledgeJob would still be orphaned** because the extractor is the sole writer of terminal state to `knowledge_dump_jobs` · and extractor didn't run
- Without extractor running · no `failWorkerJob` cascade reaches back to the KnowledgeJob

**Consequence:** W-C timeouts prevent workers from hanging indefinitely · but they do NOT prevent the specific "orphaned KnowledgeJob claim" pattern observed in the 10 stuck cases.

### 11.2 · KnowledgeJob needs its own supervisor (NEW finding · out of W-C scope)

The gap that produced the 10 stuck cases is architectural · not timeout-related:

- `nex.knowledge_dump_jobs` claim transitions have NO supervisor
- No cron sweep re-queues stale `claimed` entries
- No lease-expiry column exists (`lease_expires_at` is present on `nex.worker_jobs` but NOT on `nex.knowledge_dump_jobs`)
- No downstream cascade updates KnowledgeJob if the WorkerJob chain fails

**A supervisor is a NEW authorization requirement.** Possible shapes (not choosing here · design-only):

- **Sweep pattern (application-level):** cron job periodically SELECT * FROM nex.knowledge_dump_jobs WHERE status='claimed' AND updated_at < now() - interval '30 minutes' AND progress = 0 · re-queue or mark failed. No schema change.
- **Lease pattern (schema change):** add `lease_expires_at + assigned_worker_id + claimed_at` columns · claim sets a lease · sweep reclaims expired leases. **Schema change · Layer-2-adjacent · separate authorization required.**
- **Reverse-cascade pattern:** when a WorkerJob's `failJob` fires · look up the linked KnowledgeJob via `input_payload.knowledge_job_id` · update its status. Application-level · no schema change · but requires the WorkerJob chain to actually reach `failJob` (which the 10 stuck cases show doesn't always happen).

### 11.3 · W-C observability signals would help NEW cases · not existing ones

W-C's proposed signal emission (`worker-timeout` · `timeout-worker-cycle` · etc) via existing `emitSignal` would populate `nex.events` for future cases. That gives future forensic investigators the trail these 10 jobs lack. **Value confirmed · not questioned.**

### 11.4 · The three-atomicity distinction (§5.5 of design) applies directly

Reading the stuck-claimed pattern through the three domains:

- **Database atomicity:** each individual write in the chain (claim update · WorkerJob enqueue) is atomically-committed. No partial DB state.
- **Application-level idempotency:** the missing layer. `claimJobIfQueued` sets status but there is no supervisor to un-set it if the downstream chain fails. This is the layer that needs the fix.
- **External side-effect idempotency:** if the LLM chain succeeded on the provider side but the response was lost (worker crash before response processing), the LLM cost was paid but not accounted for. Consistent with §6.2 of design.

**The stuck-claimed pattern is definitively an application-level idempotency gap.** Not a DB atomicity failure. Not an external side-effect failure per se.

## 12 · Design amendments recommended for W-C

Based on this investigation · design-change recommendations · NOT applied here · require separate authorization to touch the W-C design doc:

### Amendment A · Add explicit scope-clarification: W-C does NOT fix stuck-claimed KnowledgeJobs

W-C timeouts protect WorkerJobs from hanging indefinitely. They do NOT remediate the class of failure observed in the 10 stuck cases. Design should state this explicitly so operators don't expect W-C alone to fix the stuck-claimed pattern.

### Amendment B · Add W-C-COMPANION · KnowledgeJob supervisor (separate authorization)

The stuck-claimed remediation is a companion cluster · not W-C itself. Choose between:
1. Application-level sweep (no schema change)
2. Lease-column addition (schema change · separate authorization)
3. Reverse-cascade on WorkerJob fail (application-level · relies on chain reaching failJob)

Not choosing here. Design decision required.

### Amendment C · Elevate empirical observability-gap finding

Every audit/heartbeat/event table was empty for the 10 stuck jobs. Wave 11 GROUP B remediation (shipped in `6b3458d`) would now capture this class of event · **but only if workers actually run and emit signals**. Design should note that observability + timeout signals compose only when workers reach the emit-signal path.

### Amendment D · Instrumentation lifecycle · what's now recorded going forward

Post-Wave-11 (commit `6b3458d`) + post-W-OBS-1 Layer 1 (commit `08a116a`):
- Correlation IDs will thread through new work
- `emitSignal` will land in `nex.events.payload->>'correlation_id'`
- `failWorkerJob` will land in worker_jobs rows

**Any NEW stuck-claimed occurrence going forward should have a much stronger forensic trail than these 10.** The 10 stuck cases are a "before" baseline · not a "still happening" pattern.

## 13 · Answer to Philip's framing question

> *"Can Headquarters reconstruct the lifecycle and determine why those jobs remain claimed using existing data, signals, logs, and worker state — without changing schema?"*

**Answer: PARTIAL.** Existing data proves:

- ✅ WHEN they were claimed
- ✅ WHAT payload/inbox item they were for
- ✅ THAT no downstream extractor ran for them (progress = 0)
- ✅ THAT the observability layer was silent throughout their lifecycle
- ✅ THAT there is NO lease-expiry / supervisor mechanism for their queue
- ✅ THAT the fix is not "add timeouts" alone · it's "add supervisor" + timeouts

**Existing data does NOT prove:**
- WHY the specific downstream WorkerJob chains failed for these 10 (requires Supabase inspection OR worker deployment logs)
- WHETHER workers crashed · were killed · exhausted retries · or completed silently against a different store

**The observability boundary is:** the transition from `nex.knowledge_dump_jobs.status = "claimed"` to the WorkerJob layer's outcome. That boundary was invisible to the observability layer at the time these jobs stuck. **Post-Wave-11 · post-W-OBS-1 · that boundary is now instrumented for new cases.**

## 14 · What must NOT happen based on this investigation

- ❌ Do NOT retry these 10 jobs to "unstick" them without first understanding · the state is forensic evidence
- ❌ Do NOT infer W-C values from this small sample (23 completed · 10 stuck) · not statistically meaningful for T-6 / T-7 tuning
- ❌ Do NOT casually add `lease_expires_at` to `nex.knowledge_dump_jobs` · schema change with implications for `claimJobIfQueued` semantics · separate authorization
- ❌ Do NOT proceed with W-C implementation assuming it will fix the stuck-claimed pattern · it will NOT
- ❌ Do NOT enable `pg_stat_statements` as part of "reacting to this finding" · separate concern · separate authorization

## 15 · Recommended next authorized decisions

Multiple options · Philip picks · not choosing here:

**(A) Apply Amendments A-D to `WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md`** — documentation-only · continues the "measure reality first · amend design from evidence" pattern.

**(B) Open new cluster · W-C-COMPANION · KnowledgeJob supervisor** — design pass first · scope decision on which supervisor shape · separate from W-C implementation.

**(C) Authorize Supabase inspection** — if we have access · would resolve the "what happened to the WorkerJob chain" question · would confirm/deny whether workers crashed vs completed-elsewhere.

**(D) Authorize W-C implementation as-scoped** — with explicit acknowledgment that stuck-claimed remediation requires the companion cluster (option B). W-C alone still ships value (prevents new hangs · adds signal trail · protects finalize critical section).

**(E) Redirect entirely.**

## 16 · Boundaries preserved by this investigation

| | Status |
|---|---|
| Any stuck job "fixed" | ❌ zero — all 10 remain in `claimed` (verified end state matches start state) |
| Any DB write | ❌ zero — SELECT / SHOW / \d only |
| Any file mutation | ❌ zero |
| Schema · migration · config · `.env` | ❌ untouched |
| F35 · workers · implementation | ❌ untouched |
| `pg_stat_statements` | ❌ not enabled |
| Commit · push | ❌ none |
| PG 18 substitution | ❌ never touched |
| Fabricated data | ❌ zero |
| Consumed authorization for W-C implementation | ❌ none |
| Consumed authorization for schema change | ❌ none |
| W-C design doc | UNMODIFIED · amendments A-D are RECOMMENDATIONS · not applied |

## 17 · Working tree state after investigation

- New file: `docs/headquarters-production-readiness/WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md` (this report)
- No other file touched
- 0 staged changes
- Origin still at `08a116a`

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-08-11 | Read-only forensic investigation authored · 10 stuck-claimed jobs classified · lifecycle reconstructed from JSONL primary + Postgres shadow + observability tables + code trace · 7-cause classification done · key finding: `nex.knowledge_dump_jobs` has NO lease-expiry mechanism · W-C alone does not fix this class · new W-C-COMPANION cluster recommended · zero fixes attempted · state preserved | Claude (forensic-only per Philip authorization) |
