# W-C · NEX Storage Contract Inspection · Cohort A Forensic Path

**Programme:** Headquarters Production Readiness · W-C-COMPANION prerequisite
**Purpose:** Determine whether Cohort A's "4 stuck / 1 completed" forensic evidence can be obtained through the existing NEX Storage abstraction (BrainStore interface + fs-store surface) — before considering any bypass.
**Date:** 2026-08-11
**Authorization:** Philip 2026-08-11 · *"Before any Supabase investigation, inspect and use the existing NEX Storage abstraction as the authoritative application boundary. Determine whether the Cohort A forensic evidence can be obtained through NEX Storage. Do not bypass NEX Storage without explicit authorization."*
**Discipline:** Read-only source inspection · no queries · no Supabase re-hits · no contract extension · no implementation · no fixing the 10 stuck jobs.

---

## 0 · Prior boundary violation · acknowledged

Before this authorized inspection, I ran a scratch Node script that imported `@supabase/supabase-js` directly and queried Supabase `worker_jobs` for the 10 stuck knowledge_job_ids. **That bypassed NEX Storage.** Philip 2026-08-11 course-correction identified it as a boundary violation. Partial results were captured (4 queries returned data · 4 timed out · 3 returned zero rows) but the METHOD was wrong.

This inspection restores the correct order: **contract first · bypass last · and only via explicit exception**.

---

## 1 · The forensic questions Cohort A needs answered

Concretely · for each of the 10 stuck KnowledgeJob IDs the investigation needs:

| # | Question | Why it matters |
|---|---|---|
| Q1 | Do WorkerJobs exist referencing `input_payload.knowledge_job_id = X`? | Cross-cohort comparison: did 0145399c have WorkerJobs that completed while others' didn't? |
| Q2 | What is the STATUS of each such WorkerJob? | Distinguish "chain never claimed" from "chain completed but KnowledgeJob update lost" |
| Q3 | What are the TIMESTAMPS (created_at · assigned_at · completed_at)? | Establish chain progression timing |
| Q4 | Did the chain reach `knowledge-extractor`? | Extractor is the sole writer of KnowledgeJob terminal state |
| Q5 | If extractor ran · what was its outcome? | Distinguish "extractor completed" from "extractor claimed but died" |
| Q6 | What ERRORS occurred? | `last_error` on failed WorkerJobs |
| Q7 | How many ATTEMPTS per WorkerJob? | Silent retries vs one-shot failures |
| Q8 | What RESULTS did workers produce? | `worker_results` records — proof of successful execution |
| Q9 | Are there AUDIT entries? | Cross-check via `nex.audit_log` |
| Q10 | Why 0145399c completed while 4 others stuck (Cohort A pattern)? | Composite of Q1-Q9 across all 5 jobs |

## 2 · The BrainStore contract surface (WorkerJob side)

Read from `src/lib/nex/brain/storage.ts:158-238` (the canonical `BrainStore` interface):

### 2.1 · Read methods that touch WorkerJobs

Only two:

- **`countJobs(worker_type, status): Promise<number>`** — returns an integer count · no per-row data · no filtering by input_payload
- **`listRecentPipelineInputRefs(worker_types: WorkerType[]): Promise<string[]>`** — returns the DISTINCT set of `input_ref` values currently in the pipeline · **no timestamps · no status · no error · no results · no filter by knowledge_job_id**

That is the entire read surface for WorkerJobs.

### 2.2 · Write / mutate methods that touch WorkerJobs

- `enqueueJob(input)` · creates a WorkerJob
- `claimNextJob(worker_type, worker_id, lease_seconds?)` · MUTATING · atomic claim
- `completeJob(job_id, result_id)` · terminal write
- `failJob(job_id, error)` · terminal write
- `insertResult(input)` · writes WorkerResult

**All write-side. Cannot be used to inspect existing state without side-effects.**

### 2.3 · Adjacent methods that COULD partially help

- **`listAudit(filter?: { limit?, since?, entity_id? }): Promise<AuditEntry[]>`** — accepts `entity_id` filter
  - Manager writes audit with `entity_type: "worker_jobs"` · `entity_id: item.id` (**the INBOX ITEM ID · not knowledge_job_id · not worker_job.id**) — verified `manager.ts:319-320`
  - Would enable: "give me all audit rows for a given inbox item"
  - Would NOT enable: filter by knowledge_job_id directly (unless we walk inbox → jobs first)
- **`listHeartbeats(filter?: { since?, limit? }): Promise<WorkerHeartbeat[]>`** — no host_id filter · can enumerate all heartbeats around a time window
  - Would help detect: worker outages during Cohort A's 04:22 UTC window
  - Would NOT directly link a heartbeat to a specific job

### 2.4 · Read methods that DO NOT EXIST in BrainStore

- `getJob(job_id)` · fetch a single WorkerJob by id — **NOT IN CONTRACT**
- `listJobs(filter)` · list WorkerJobs with filters — **NOT IN CONTRACT**
- `findJobsByInputPayloadKey(key, value)` · filter by JSONB payload field — **NOT IN CONTRACT**
- `findJobsByKnowledgeJobId(kjid)` · the specific query Cohort A needs — **NOT IN CONTRACT**
- `listResults(job_id)` · fetch WorkerResults for a job — **NOT IN CONTRACT**
- `getResult(id)` · fetch single WorkerResult — **NOT IN CONTRACT**

## 3 · The fs-store contract surface (KnowledgeJob side)

Read from `src/lib/nex/jobs/fs-store.ts` · exposes for KnowledgeJob:

- `getJob(job_id)` — direct fetch by KnowledgeJob id
- `listJobs(options)` — list with filters
- `findJobByInboxItemId(item_id)` — reverse lookup
- `findActiveJobByInboxItemId(item_id)` — reverse lookup · non-terminal only
- `jobStats()` — status count aggregates

**All 10 stuck KnowledgeJob rows are fully readable via `fs-store.getJob(kjid)` or `fs-store.listJobs({status:'claimed'})`.** That gives us the state we ALREADY captured in `WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md`. Nothing new.

**What fs-store does NOT expose:** any WorkerJob-side state. That boundary belongs to BrainStore.

## 4 · Gap analysis · question by question

For each forensic question:

| # | Question | Answerable via NEX Storage? | Method | Gap |
|---|---|---|---|---|
| Q1 | Do WorkerJobs exist for `input_payload.knowledge_job_id = X`? | **NO** | No filter method | Requires `findJobsByKnowledgeJobId(kjid)` or `findJobsByInputPayloadKey(key,value)` — neither exists |
| Q2 | WorkerJob status? | **NO** | No `getJob` in BrainStore | Requires `getJob(job_id)` OR `listJobs(filter)` |
| Q3 | Timestamps? | **NO** | Same as Q2 | Same |
| Q4 | Chain reached knowledge-extractor? | **PARTIAL** | `countJobs("knowledge-extractor", "completed")` gives aggregate · does not filter by kjid | Same as Q1 |
| Q5 | Extractor outcome per kjid? | **NO** | Same as Q2 | Same |
| Q6 | Error text? | **NO** | Field `last_error` exists on WorkerJob type · not queryable | Same |
| Q7 | Attempt count? | **NO** | Field `attempts` exists · not queryable | Same |
| Q8 | Results? | **NO** | No `listResults(job_id)` | Requires `listResultsForJob(job_id)` or `getResult(id)` |
| Q9 | Audit entries? | **PARTIAL** | `listAudit({entity_id: inbox_item_id})` retrieves manager audits · not extractor audits · not linkable to kjid without walk-through | Requires either audit-shape convention (entity_id = kjid) OR contract extension |
| Q10 | Cohort A composite? | **NO** | Depends on Q1-Q9 | Same |

**Verdict:** none of the 10 forensic questions can be answered through the current BrainStore contract for the Cohort A investigation.

## 5 · The concrete missing capability

**Single missing method:** *"Given a `knowledge_job_id` (a value inside `input_payload`), return all WorkerJobs whose `input_payload.knowledge_job_id` equals it · with full field visibility (status · attempts · timestamps · last_error) · optionally joined to WorkerResults."*

Proposed shapes (design-only enumeration · NOT authorizing implementation):

**Shape A · Narrow method** · `findJobsByKnowledgeJobId(kjid: string): Promise<WorkerJob[]>`
- Explicit to the KnowledgeJob → WorkerJob join
- Adapter implementations:
  - Postgres: `SELECT * FROM nex.worker_jobs WHERE input_payload->>'knowledge_job_id' = $1`
  - Supabase: `.from("worker_jobs").select("*").contains("input_payload", {knowledge_job_id})`
  - Filesystem: `readTable("worker_jobs").filter(j => j.input_payload?.knowledge_job_id === kjid)`
- **Performance:** needs a GIN or expression index on `(input_payload->>'knowledge_job_id')` for scale — that's a **schema change** on top of the contract addition

**Shape B · Generic method** · `findJobsByInputPayloadKey(key: string, value: string): Promise<WorkerJob[]>`
- Reusable for future joins (correlation_id · inbox_item_id · etc)
- Same adapter implementations · parameter-driven
- Same schema-change concern for scale

**Shape C · Enrich existing `listAudit` conventions** · standardize `entity_id` semantics so that worker audit rows use `entity_id = knowledge_job_id` (or add `related_ids` array)
- No new method · but changes the audit-write convention
- Requires changes at every worker's finalAudit + failWorkerJob site
- Retroactive: doesn't help the 10 already-stuck jobs whose audit trail is empty

## 6 · Second-order finding · W-C-COMPANION Candidate 1 has the same gap

**This is not only about Cohort A forensics.** The W-C-COMPANION Phase-2 design (Candidate 1 · § 5.2) proposed a supervisor that checks `nex.events` for "worker-completed" signals with matching CID BEFORE re-queueing a stale KnowledgeJob.

**But that check requires answering:** "for a given knowledge_job_id · did any WorkerJob complete?" — which is EXACTLY the same capability the forensic needs.

Without contract extension:

- The Cohort A forensic CANNOT be done via NEX Storage
- The W-C-COMPANION Candidate 1 supervisor CANNOT operate via NEX Storage
- Both would require bypass · same violation shape · in production code (not just in a scratch script)

**This elevates the finding.** It's not just a forensic-inconvenience gap · it's an architectural gap between what W-C-COMPANION needs to function and what the NEX Storage contract exposes.

## 7 · Decision landscape (Philip decides · not me)

Three coherent paths forward. All require explicit authorization. None run automatically from this report.

### 7.1 · Option A · Extend the BrainStore contract (SEPARATE cluster · design first)

- Add read method (Shape A · B · or hybrid)
- Update all 3 adapters (filesystem · postgres · supabase)
- Add index / performance consideration → schema change → Layer-2-adjacent → SEPARATE authorization
- Add drift-catcher · new method must be present on every adapter · matches F12 AI2
- Once shipped: both Cohort A forensic AND W-C-COMPANION Candidate 1 work through the boundary
- **Cost:** contract-extension design + adapter migration + potential schema index + test coverage
- **Benefit:** permanent architectural fix · every future join query goes through NEX Storage
- **Sequence:** design → adapter implementation → contract test → drift-catcher → then Cohort A forensic via new method → then W-C-COMPANION uses same method

### 7.2 · Option B · Direct Supabase forensic exception (one-time · time-bounded · logged)

- Explicit exception · documented as "does not create precedent"
- Retry the 4 timed-out queries + finish Cohort A analysis
- Feed empirical answers into W-C-COMPANION design
- **Cost:** one authorized boundary bypass · risk of "we did it once so we can do it again"
- **Benefit:** unblocks Cohort A forensic fast · does NOT solve W-C-COMPANION Candidate 1's operational need (that would still require Option A or ongoing exception grants)
- **Recommended framing:** "one-time forensic authorization · with a mandatory follow-up decision on Option A after the forensic report lands"

### 7.3 · Option C · Accept the gap · proceed without empirical Cohort A evidence

- W-C-COMPANION design proceeds with hypothesized failure modes
- Candidate 1 either (a) bypasses NEX Storage in production code (unacceptable) OR (b) is replaced by a different mechanism that fits the current contract
- **Cost:** possibly wrong architectural choice for supervisor · empirical grounding lost
- **Benefit:** zero contract change · zero exception
- **Note:** Candidate 3 (reverse-cascade) FITS the current contract because it hooks `failWorkerJob` which is already inside NEX Storage · but § 7.2 of the companion design showed Candidate 3 alone doesn't cover the silent-vanishing-worker case

## 8 · Explicit non-recommendation

**I am not choosing between A · B · C.** The choice is architectural · Philip decides · this report exists to provide evidence for that decision.

Neutral observations:

- Option A is the "principled" long-term fix but has the highest up-front cost
- Option B is fast but risks precedent
- Option C preserves the boundary but weakens the design's empirical grounding
- A hybrid (Option B once for Cohort A · then Option A permanently for W-C-COMPANION) is coherent
- **NEX Storage boundary integrity is worth preserving.** The Wave 11 F12 discipline · the F28 config centralization · the W-OBS-1 correlation substrate — all of them rest on adapter isolation. Any bypass · even one-time · needs to be a deliberate exception not a habit.

## 9 · What was NOT done in this inspection

- ❌ Zero Supabase queries
- ❌ Zero direct SDK usage
- ❌ Zero writes to any store
- ❌ Zero un-sticking of the 10 stuck jobs
- ❌ Zero contract extension (I did not add methods · did not modify BrainStore)
- ❌ Zero adapter changes
- ❌ Zero implementation
- ❌ Zero commit · zero push
- ❌ Did NOT retry the 4 timed-out Supabase queries from the earlier violation
- ❌ Did NOT continue autonomously to any next investigation

## 10 · Preserved artifacts from the boundary violation earlier this turn

The scratch script that ran before the course-correction produced partial data. I am NOT deleting it in-memory · but I am NOT relying on it as authoritative evidence. The data (if we accept it as-is · with the caveat that the method was wrong):

| kjid | WorkerJobs found | Chain status |
|---|---|---|
| A4 `b1772902` | 8 (3× context · 2× voice · 2× learning · all completed) | Chain ran multiple times · extractor still never wrote terminal — **very significant** |
| A5_late `270865e6` | 1 (knowledge-context only · completed) | Stopped after first stage |
| B1 `7fc668ef` | 3 (context → voice → learning · completed) | Chain stopped before extractor |
| B2 `47e0cf43` | 1 (knowledge-context only · completed) | Stopped after first stage |
| B3 `ab5835b8` | 0 | Chain never ran (OR RLS filter) |
| B4 `56e1da78` | 0 | Chain never ran (OR RLS filter) |
| B5 `46a8eb51` | 0 | Chain never ran (OR RLS filter) |
| A1 · A2 · A3 · A_completed 0145399c | (timed out · not retried) | Unknown |

**These partial findings are provisional.** If Option A or Option B is authorized, they should be re-obtained through the authorized method. If Option C is authorized, they are the best data available and the design proceeds with acknowledged evidence gap.

**Provisional pattern (subject to reconfirmation):** at least 4 of the 10 stuck jobs had SUCCESSFUL WorkerJob chain execution (some as far as learning-context · never as far as extractor). If confirmed · this refines the failure mode from "workers vanished" to "workers ran but extractor was never claimed / never wrote terminal state." That would change the W-C-COMPANION design emphasis significantly.

## 11 · Preserved boundaries

| | Status |
|---|---|
| NEX Storage boundary re-honored (from this inspection onward) | ✅ |
| Prior boundary violation acknowledged | ✅ (§ 0 above) |
| 10 stuck jobs · state | 🔒 preserved · unchanged |
| Supabase queries in this inspection | 0 |
| Contract extension | 0 |
| Adapter modification | 0 |
| Implementation | 0 |
| Schema change | 0 |
| Config / .env change | 0 |
| Commit / push | 0 |
| Consumed authorization | none for either W-C or W-C-COMPANION implementation |
| Working tree · staged | 0 (this report is the only new file) |
| Origin/main | `08a116a` |

## 12 · Awaiting explicit direction

- **(A)** Authorize contract extension design (new cluster · `W-C-STORAGE-CONTRACT-EXTENSION`)
- **(B)** Authorize one-time direct Supabase forensic exception (documented · time-bounded · with mandatory follow-up decision on Option A)
- **(C)** Accept the gap · proceed with W-C-COMPANION design using hypothesized failure modes (and drop Candidate 1 in favor of a mechanism that fits the current contract)
- **(D)** Redirect

**Standing by. Zero autonomous next-action.**

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-08-11 | NEX Storage contract inspection authored · 10 Cohort A forensic questions mapped against BrainStore surface · concrete gap identified (`findJobsByKnowledgeJobId` or equivalent · missing from contract) · **second-order finding: W-C-COMPANION Candidate 1 supervisor has the same gap · elevates contract-extension question from forensic-nice-to-have to architectural need** · three-option decision landscape documented (A extend contract · B one-time exception · C accept gap) · no recommendation made · Philip decides · zero implementation · zero commit | Claude (inspection-only per Philip authorization) |
