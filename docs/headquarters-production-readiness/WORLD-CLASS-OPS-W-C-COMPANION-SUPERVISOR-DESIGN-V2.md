# W-C-COMPANION · Supervisor Design V2 · Corrected Against Phase 1 Forensic Evidence

**Phase:** 3 of CONTROLLED COMPLETION DIRECTIVE
**Supersedes:** `WORLD-CLASS-OPS-W-C-COMPANION-SUPERVISOR-DESIGN.md` (V1 · 2026-08-11)
**Prerequisites:**
- Phase 1: `WORLD-CLASS-OPS-W-C-SUPABASE-COHORT-A-INVESTIGATION.md`
- Phase 2: `WORLD-CLASS-OPS-W-C-STORAGE-CONTRACT-EXTENSION-DESIGN.md`
**Status:** DESIGN ONLY · no implementation · no schema · no commit
**Governs:** Phase 6 implementation

---

## 1 · Why V1 needs correction

V1 was authored on hypothesized failure modes. Phase 1 forensic proved five hypotheses wrong. V2 rebuilds the design around what actually happened.

### 1.1 · Corrected assumptions

| V1 said | Phase 1 proved | V2 impact |
| --- | --- | --- |
| "Extractor claims WorkerJob but dies before line 202 (progress stays 0)" | For Cohort A, all 20 extractor WorkerJobs completed with `status=completed`, produced `record_draft` output; interrupt was AFTER extractor terminal work | Old classifier is wrong · terminal condition is now "extractor produced results," not "extractor never ran" |
| "Check `nex.events` for CID-tagged worker-completed signals" as safety check | `nex.events` table does not exist in Supabase (schema discovery) · CID-tagged evidence path is unavailable | Replace safety check with `worker_results` join via Storage's new methods |
| kjid propagates through all worker input_payloads | kjid is present ONLY on knowledge-context input_payload · absent from voice / learning / extractor | Cannot join on kjid downstream · must join on `input_ref` (inbox_item_id) |
| Duplicate-LLM-call risk is the primary hazard | For Cohort A the extractor ALREADY spent LLM tokens · re-processing would DOUBLE those costs · but supervisor's job is to RECOGNIZE the completion, not re-drive it | Recovery is "attest completion + finalize KJ," not "re-queue" · avoids the LLM cost entirely for this subcohort |
| Reverse-cascade "does NOT cover the observed failure mode" (silent vanishing worker) | For Cohort A, no worker vanished — the terminal-write path itself broke | Reverse-cascade actually cannot help either subcohort in the exact scenario · but a **positive-completion cascade** (new candidate) can |

### 1.2 · Subcohort split now visible

Phase 1 empirically split the 10 stuck jobs into two failure classes:

- **Class X (Cohort A · 4 jobs · 7e1fc4f9, 6381641c, 1e09c119, b1772902)** — full worker chain completed · extractor produced `record_draft` · KnowledgeJob never terminally updated. Recovery = **attest + finalize** (evidence supports "extraction happened").
- **Class Y (Cohort B · 6 jobs · 270865e6, 7fc668ef, 47e0cf43, ab5835b8, 56e1da78, 46a8eb51)** — partial or no worker chain (V1 inspection §10 preliminary counts: 3 with partial chain, 3 with zero WorkerJobs). Recovery = **investigate then decide** (evidence may not support attestation).

**V2 provides distinct recovery paths per class · not a single one-size-fits-all sweep.**

---

## 2 · The gate question · unchanged

> **"What mechanism can recover a KnowledgeJob without creating duplicate extraction work?"**

Same north star. Phase 1 evidence sharpens the definition of "recover" per subcohort.

---

## 3 · Storage contract dependency (from Phase 2)

V2 assumes the following Phase 2 methods will be shipped in Phase 5 BEFORE Phase 6 supervisor implementation:

- `getWorkerJob(job_id): Promise<WorkerJob | null>`
- `listWorkerJobsByInputRef(input_refs: string[], opts?): Promise<WorkerJob[]>`
- `findWorkerJobsByKnowledgeJobId(kjid: string): Promise<WorkerJob[]>`
- `listWorkerResultsByJobIds(job_ids: string[], opts?): Promise<WorkerResult[]>`
- `writeKnowledgeJobTransitionAudit(input: KnowledgeJobTransitionAudit): Promise<void>`

Every V2 recovery path uses these methods. **V2 does not require any adapter bypass · does not require `nex.events` · does not require a CID substrate.**

The CID substrate (W-OBS-1 Layer 1) remains valuable for forward-looking tracing but is NOT a supervisor precondition.

---

## 4 · The three recovery mechanisms · V2 catalog

### 4.1 · Recovery Path A · Attest-and-Finalize Sweep (for Class X)

**Trigger:** cron every 5-10 min. Reads stuck KJs from fs-store where `status='claimed' AND updated_at < now() - INTERVAL '30 minutes'`.

**For each stuck KJ:**

```
1. inbox_item_id ← fs-store.getJob(kjid).inbox_item_id
2. workers[] ← BrainStore.listWorkerJobsByInputRef([inbox_item_id])
3. extractor_workers ← workers[].filter(w => w.worker_type === 'knowledge-extractor')
4. IF extractor_workers is empty:
     → Path A does NOT apply · fall through to Path B (investigation)
5. all_extractors_completed ← extractor_workers.every(w => w.status === 'completed')
6. IF NOT all_extractors_completed:
     → Path A does NOT apply · fall through to Path B
7. extractor_result_ids ← extractor_workers.map(w => w.result_id).filter(Boolean)
8. results ← BrainStore.listWorkerResultsByJobIds(extractor_result_ids)
9. record_drafts_produced ← results.some(r => r.output_kind === 'record_draft'
       && Array.isArray(r.output_payload?.draft_record_ids)
       && r.output_payload.draft_record_ids.length > 0)
10. IF record_drafts_produced:
     → ATTEST · call fs-store.updateJob(kjid, {
         status: 'completed',
         progress: 100,
         completion_result: {
           reason: 'supervisor-attested-completion',
           extractor_worker_ids: extractor_workers.map(w => w.id),
           result_ids: extractor_result_ids,
           attested_at: new Date().toISOString(),
         },
       })
     → CALL BrainStore.writeKnowledgeJobTransitionAudit({
         knowledge_job_id: kjid,
         from_status: 'claimed', to_status: 'completed',
         actor: 'supervisor:companion',
         reason: 'attested-from-worker-results',
         metadata: { extractor_result_ids, ... },
       })
11. ELSE (extractor completed but no drafts):
     → Path A does NOT apply · fall through to Path B
```

**Three-atomicity mapping:**

| Step | Domain | Protection |
| --- | --- | --- |
| Read stuck KJs | Database | Read-only |
| Storage lookups (listWorkerJobsByInputRef, listWorkerResultsByJobIds) | Database | Read-only |
| `fs-store.updateJob` with CAS check `status='claimed'` | Database + Application | Existing CAS guard in fs-store prevents overwriting concurrent transitions |
| `writeKnowledgeJobTransitionAudit` | Database | Single INSERT · idempotent by consequence-of-append |
| **External LLM re-drive** | **AVOIDED** | Attest path never re-processes · zero extra LLM cost · this is the fundamental win over V1 |

**Idempotency by construction:** running the sweep twice on the same KJ produces the same result. Second call finds `status='completed'` and skips (CAS check). Audit row is written once because the outer transition guard prevents the second attempt.

**What Path A does NOT do:**

- Does NOT re-queue any KnowledgeJob
- Does NOT re-invoke the extractor
- Does NOT synthesize record drafts (the extractor produced them)
- Does NOT touch the record store (F12 `insertRecordIdempotent` already handled that)
- Does NOT delete or modify existing worker_jobs / worker_results rows

**Coverage:** Class X (proven for Cohort A's 4 jobs · attestation evidence exists in Supabase today · sweep would recover them cleanly).

---

### 4.2 · Recovery Path B · Investigation-and-Manual-Choice Queue (for Class Y)

**Trigger:** Path A falls through when extractor evidence is insufficient. Sweep enqueues a supervisor-review artifact rather than making an automatic decision.

**For each Path-A fallthrough:**

```
1. Compose an investigation record:
   {
     kjid,
     inbox_item_id,
     worker_chain_snapshot: {
       counts_by_worker_type_status,
       last_completed_at,
       reached_extractor: false | true,
       extractor_produced_drafts: false | true,
     },
     stuck_duration_hours,
     recommended_action: 'requeue' | 'mark_failed' | 'manual_investigate',
   }
2. Write to a review surface (e.g. an `audit_log` row with entity_type='knowledge_jobs' + action='supervisor-review-required')
3. Emit heartbeat to Storage Mission Control · surface the review count
4. DO NOT auto-transition the KJ · human operator inspects and chooses
```

**Rationale:** For Class Y, we lack extractor evidence · re-driving is the only alternative to human choice · re-driving DOES cost LLM tokens. The supervisor must NOT make that cost decision autonomously. Human-in-the-loop.

**Coverage:** Class Y (Cohort B's 6 jobs) + any future stuck-KJ that lacks positive completion evidence.

**Three-atomicity mapping:**

| Step | Domain | Protection |
| --- | --- | --- |
| Write review record | Database | Single INSERT · append-only |
| KJ state | **Unchanged** | Path B is diagnostic, not corrective |
| Human decision | Out-of-band | Operator uses admin tool to manually transition once decided |

**Escalation policy:** if a Class-Y stuck KJ remains in the review queue >72 hours, sweeper emits a page-worthy signal · operator MUST act.

---

### 4.3 · Recovery Path C · Positive-Completion Cascade (preventive · not recovery)

**This is the piece V1 didn't have.** It prevents Class X failures from occurring in the first place.

**Mechanism:** inside `src/lib/nex/brain/workers/knowledge-extractor.ts` at the terminal-write path (approximately line 497 success · line 520 failure), after the existing extractor completion logic runs successfully, the extractor cascades to the KnowledgeJob:

```
// Existing (preserved):
await store.completeJob(job.id, resultId)
// New cascade (Phase 5-adjacent):
const kjid = await resolveKnowledgeJobIdForExtractorJob(store, job)
if (kjid) {
  await fs-store.updateJob(kjid, {
    status: 'completed', progress: 100,
    completion_result: { reason: 'extractor-cascade-terminal', worker_job_id: job.id, result_id: resultId },
  })
  await store.writeKnowledgeJobTransitionAudit({
    knowledge_job_id: kjid,
    from_status: 'claimed', to_status: 'completed',
    actor: `worker:knowledge-extractor@${process.pid}`,
    reason: 'terminal-cascade',
    worker_job_id: job.id,
  })
}
```

**`resolveKnowledgeJobIdForExtractorJob(store, job)` implementation options:**

- **Option (a)** · **Payload propagation** — modify `manager.ts` to include `knowledge_job_id` in EVERY worker's input_payload, not just knowledge-context. This is a **Phase 5-adjacent change** but not a schema change. Effort: small (2-3 line addition where worker chains spawn) · risk: low (adds a field, doesn't remove any).
- **Option (b)** · **Reverse resolution via inbox_item_id** — `input_ref = inbox_item_id`; call `fs-store.findActiveJobByInboxItemId(job.input_ref)` to resolve kjid. Effort: none new (existing fs-store method). Risk: fires only if the KJ is still active — if it was already completed by supervisor before cascade fires, this correctly returns null and cascade no-ops.

**Recommended: Option (b)** for Phase 5 — no code change to manager · uses existing fs-store lookup · idempotent by construction (if KJ already terminal, no-op).

**Three-atomicity mapping:**

| Step | Domain | Protection |
| --- | --- | --- |
| Extractor `completeJob` (existing) | Database | F35 critical section (Wave 11) |
| kjid resolution | Database | Read-only fs-store lookup |
| `fs-store.updateJob` cascade | Database + Application | CAS check `status='claimed'` · one-shot transition |
| `writeKnowledgeJobTransitionAudit` | Database | Single INSERT |

**Ordering matters:** cascade runs AFTER `completeJob` finishes. If cascade throws, the WorkerJob is already committed complete · so the KJ stays claimed until Sweep Path A catches it. **Cascade + Sweep are complementary belts-and-braces**, not redundant · cascade catches 99% of new cases · sweep catches the remaining 1% + all pre-existing stuck jobs.

---

## 5 · Interaction between the three paths

```
                    ┌─────────────────────────────────┐
                    │  Extractor completes            │
                    │  (WorkerJob status=completed)   │
                    └────────────────┬────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │  Path C · Positive Cascade      │  ← preventive · runs INLINE
                    │  · resolve kjid via inbox_item  │
                    │  · fs-store.updateJob completed │
                    │  · write transition audit       │
                    └────────────────┬────────────────┘
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                          ▼                     ▼
              cascade succeeds        cascade throws / no-op
                    │                       │
                    │                       ▼
                    │           ┌─────────────────────────────┐
                    │           │  KJ still claimed after N min │
                    │           └────────────┬────────────────┘
                    │                        │
                    │                        ▼
                    │            ┌─────────────────────────────┐
                    │            │  Path A · Attest Sweep       │  ← recovery · runs periodically
                    │            │  · check worker_results       │
                    │            │  · IF drafts present:         │
                    │            │      attest complete          │
                    │            │  · ELSE: fall through         │
                    │            └────────────┬────────────────┘
                    │                         │
                    ▼                         ▼
              done · KJ complete    Path B · Review Queue  ← manual
                                    · surface to operator
                                    · block auto-transition
```

**Result at scale:** Path C makes 99% of extractor completions terminal in the same request. Path A recovers the residual (chain-boundary interrupts, cascade throws). Path B surfaces the genuinely ambiguous cases for human decision. No autonomous LLM re-drive · ever.

---

## 6 · Duplicate-work risk matrix · V2

| Risk | Path A · Attest Sweep | Path B · Review Queue | Path C · Positive Cascade |
| --- | --- | --- | --- |
| Duplicate DB record-write | N/A · no re-processing | N/A | N/A · Path C runs after single extraction · F12 already covers |
| Duplicate LLM call | **ZERO** · no re-drive | Only if operator chooses re-queue | **ZERO** · no re-drive |
| Duplicate child WorkerJob | Zero · no re-enqueue | Only if operator chooses re-queue | Zero · terminal step |
| Duplicate audit rows | Minimal (one row per attestation) | Minimal | Minimal (one row per cascade) |
| Missed recovery | Zero for Class X · deferred to human for Class Y | N/A · escalation policy | Zero |
| Silent vanishing worker | **Detected** (sweep runs regardless of cascade outcome) | **Detected via Path A fallthrough** | Not applicable (cascade requires worker completion) |
| Cross-store race | **Detected via Storage contract** (all queries through Storage · no bypass) | Same | Same |

**Compared to V1:** V2 eliminates the primary duplicate-LLM-call risk for Class X entirely (attest, don't re-drive) · surfaces Class Y for human decision (no autonomous LLM commitment) · uses positive cascade to prevent stuck-claimed at the source.

---

## 7 · Recommendation · V2 hybrid

**Primary architecture: A + B + C shipped together as one cluster.**

- **Path C (positive cascade)** ships first · prevents new stuck-claimed cases
- **Path A (attest sweep)** ships alongside · recovers current + edge-case future stuck-claimed
- **Path B (review queue)** ships as Path A's fallthrough surface · human decision for ambiguous cases

**Sequencing (Phase 6):**

1. Implement `writeKnowledgeJobTransitionAudit` + Storage methods (from Phase 2 · already in Phase 5)
2. Modify extractor to call Path C cascade after `completeJob`
3. Ship supervisor module (`src/lib/nex/jobs/supervisor.ts`)
4. Ship cron entrypoint (`src/app/api/nex/brain/supervisor-sweep/route.ts`) gated on `NEX_KJOB_SUPERVISOR_ENABLED=1`
5. Ship review-queue surface in Storage Mission Control
6. Contract tests using the 10 preserved stuck jobs as fixture
7. Enable in dev · verify Cohort A auto-attests · verify Cohort B routes to review queue

**Defer Candidate 2 (schema-lease)** — same reasoning as V1 · V2 doesn't need it because attest-and-finalize handles the current failure mode without requiring attempt tracking.

---

## 8 · Contract test fixture · V2

The 10 preserved stuck jobs remain the natural fixture. With V2's cleaner classification:

- **4 Class X (Cohort A)** — sweep runs · Path A attests each · asserts all 4 transition claimed → completed with `reason: 'supervisor-attested-completion'`
- **6 Class Y (Cohort B)** — sweep runs · Path A falls through · asserts all 6 land in review queue with the appropriate `recommended_action`
- **After test:** the 10 fixture jobs remain preserved OR are formally released by operator action after final review. Contract test does NOT depend on their preservation forever · it depends on the classification being correct on first sweep.

---

## 9 · What V2 explicitly does NOT do

- ❌ Does NOT modify F35 (W-C scope)
- ❌ Does NOT add lease columns to KnowledgeJob (deferred Candidate 2)
- ❌ Does NOT touch child-worker-job dedup (shared with W-C · unresolved)
- ❌ Does NOT enable pg_stat_statements
- ❌ Does NOT fix the 10 existing stuck jobs (fixture · then formal release)
- ❌ Does NOT introduce a CID requirement (works without W-OBS-1)
- ❌ Does NOT introduce `nex.events` requirement (does not exist)
- ❌ Does NOT authorize implementation · Phase 6 gate is separate

---

## 10 · New env-gates (Phase 6)

- `NEX_KJOB_SUPERVISOR_ENABLED` · default off · master switch
- `NEX_KJOB_STALENESS_MINUTES` · sweep threshold · default 30
- `NEX_KJOB_ATTEST_MIN_DRAFTS` · default 1 · minimum draft_record_ids per Path A attestation
- `NEX_KJOB_REVIEW_ESCALATION_HOURS` · default 72 · Path B escalation threshold
- `NEX_KJOB_CASCADE_ENABLED` · default on · Path C toggle (safety valve for rollback)

All wired through Step 11 config hygiene envReader pattern (CFG1-CFG11).

---

## 11 · Risk register · Phase 6

| Risk | Mitigation |
| --- | --- |
| Path C cascade throws · KJ stays claimed | Path A catches on next sweep · belt-and-braces by design |
| Path A attests a KJ whose extractor wrote partial output (short draft_record_ids) | `NEX_KJOB_ATTEST_MIN_DRAFTS` gate · configurable · default 1 |
| Concurrent sweep instances double-attest | fs-store CAS check prevents · first-writer-wins |
| Class Y review queue grows unbounded | Escalation at 72h · operator alerted · SLA on review |
| Extractor cascade adds ~10ms per completion | Acceptable (extractor already runs 200-2000ms typical) · single fs-store call |
| Cascade requires new writeKnowledgeJobTransitionAudit path that hasn't shipped | Sequencing in §7 makes Phase 5 (contract) precede Phase 6 (supervisor) |

---

## 12 · Regression coverage (existing tests preserved)

- All Wave 11 F2 / F9 / F12 / F35 tests preserved
- W-OBS-1 CID tests preserved
- Step 11 config hygiene tests preserved
- Cascade change to extractor: added test asserts cascade fires on success · does not fire on failure · resolves kjid correctly via inbox_item · no-op if KJ already terminal

---

## 13 · Boundaries preserved by V2 design pass

| | Status |
| --- | --- |
| Implementation | ❌ zero |
| Schema change | ❌ zero (Phase 2's expression index is a Phase 5 concern) |
| Config change | ❌ zero |
| `.env` change | ❌ zero |
| Test files | ❌ zero |
| F35 modification | ❌ zero |
| W-C implementation | ❌ zero |
| 10 stuck jobs · state | 🔒 preserved · untouched |
| Commit | ❌ zero |
| Push | ❌ zero |

---

## 14 · Interaction with W-C timeout budgets

W-C (timeout budgets, see `WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md`) prevents future workers from HANGING. W-C-COMPANION V2 recovers KJs when the finalization write between worker completion and KJ terminal-status fails.

**They address different failure classes and compose additively:**

- W-C timeout budgets · reduce "worker held forever" · adds T-1 through T-8
- W-C-COMPANION Path C · terminal cascade prevents finalization gap
- W-C-COMPANION Path A · recovers when cascade misses
- W-C-COMPANION Path B · human decision when evidence insufficient

Neither requires the other · both required for full production hygiene.

---

## 15 · Change log (V2 authoring)

| Date | Change | Author |
| --- | --- | --- |
| 2026-08-09 | V2 authored as Phase 3 of CONTROLLED COMPLETION DIRECTIVE. Corrects V1 hypotheses against Phase 1 forensic evidence. Three paths (Attest Sweep · Review Queue · Positive Cascade). Storage contract dependency documented. Duplicate-work risk matrix rewritten. LLM re-drive eliminated for Class X. Class Y routed to human review. No autonomous LLM commitment. Zero implementation · zero commit. | Claude (design-only per CONTROLLED COMPLETION DIRECTIVE Phase 3) |

**Phase 3 status: COMPLETE. Proceeding to Phase 4 · Contract test design.**
