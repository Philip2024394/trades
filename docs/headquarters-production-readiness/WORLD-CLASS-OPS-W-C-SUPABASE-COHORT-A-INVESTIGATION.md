# WORLD-CLASS-OPS · W-C · Supabase Cohort A Forensic Investigation

**Phase:** 1 of CONTROLLED COMPLETION DIRECTIVE
**Authorization:** ONE-TIME Supabase forensic exception explicitly authorized by Philip 2026-08-09 (see boundary-violation footnote at end)
**Mode:** READ-ONLY · no writes · no un-sticking · 10 stuck jobs preserved as fixtures
**Status:** FORENSIC EVIDENCE COMPLETE · claims classified

---

## 1 · Executive Finding

**The Cohort A stuck-claimed KnowledgeJobs (A1-A4) had their entire downstream WorkerJob pipeline execute to `completed` status successfully. Every extractor produced knowledge record drafts. The finalization gap lives between "last WorkerJob completed" and "KnowledgeJob terminal-status write" — not in the worker layer.**

Prior investigation (`WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md`) established 10 stuck KnowledgeJobs and classified 4 causes as PROVEN from local evidence: (i) missing finalization, (ii) no lease mechanism, (iii) orphaned claim, (iv) instrumentation blind spot. This Phase 1 forensic elevates **missing finalization** from "PROVEN as an architectural gap" to **"PROVEN as the direct cause of Cohort A's stuck state."**

---

## 2 · Data Collected

Direct Supabase queries against `worker_jobs`, `worker_results`, `audit_log` in window `2026-08-06T00:00:00Z` … `2026-08-10T00:00:00Z`.

| Table | Rows in window | Query strategy |
| --- | --- | --- |
| `worker_jobs` | **18,960** total (paginated fetch across 19 pages) | full window + client-side filter by `input_ref ∈ Cohort A inbox items` |
| `worker_results` | 20 for Cohort A extractors | `worker_jobs.result_id → worker_results.id` |
| `audit_log` | 80 for Cohort A + 16 for SUCCESS | filter by `entity_id = inbox_item_id` + text search of `notes` for kjid |

Raw dump: `tmp-forensic/all-worker-jobs-window.json` (427 MB) · `tmp-forensic/phase1-*.txt` per-query outputs.

---

## 3 · Cohort A Pipeline Reconstruction

### 3.1 · Inbox → KnowledgeJob mapping (established)

| KnowledgeJob | Inbox Item |
| --- | --- |
| A1 · `7e1fc4f9-…` | `nx_msjta6kd_63bc4c9d` |
| A2 · `6381641c-…` | `nx_msidgefq_70e9b7fa` |
| A3 · `1e09c119-…` | `nx_msi9o0pj_b45abe89` |
| A4 · `b1772902-…` | `nx_msi78sl2_b7009ca5` |

Cross-checked via `worker_jobs.input_payload.knowledge_job_id` on the knowledge-context worker rows (that worker is the only one that carries kjid in its payload).

### 3.2 · Round pattern

Each Cohort A inbox item ran **5 dispatch rounds**:

| Round | Enqueue time (UTC 2026-08-08) | Workers per round |
| --- | --- | --- |
| 1 | 03:39 | knowledge-context, voice-context, learning-context, knowledge-extractor |
| 2 | 04:22 | same 4 workers |
| 3 | 04:24 | same 4 workers |
| 4 | 04:38 | same 4 workers |
| 5 | 04:42 | same 4 workers |

Per inbox: **5 rounds × 4 workers = 20 WorkerJobs**. All 20 status=`completed`, attempts=1.

### 3.3 · Extractor evidence (per inbox item)

| Inbox | Extractor jobs | All completed? | Result IDs |
| --- | --- | --- | --- |
| A1 · `msjta6kd` | 5 | YES | `c1346fdb, d8f44510, 23e527cc, 67f4460f, 12c6c23d` |
| A2 · `msidgefq` | 5 | YES | `b25d6b0c, 25c5c251, ec4edf12, eafc56af, feeea817` |
| A3 · `msi9o0pj` | 5 | YES | `89906902, f3607ad8, c3a71dc7, 03b0b21c, dec790c2` |
| A4 · `msi78sl2` | 5 | YES | `206c33cc, b5352133, 98c99d0e, 32ee8e62, 8a51916e` |

**All 20 extractor `worker_results` rows exist**, output_kind=`record_draft`, containing `draft_record_ids` (e.g. `floating_staircases_v1`, `metal_balustrade_infill_panel_thickness_v1`, `sheet_metal_sheet_sizes_v1`, `mock_door_generic_*`). **The extractor did its work.**

### 3.4 · Timing between claim and last WorkerJob complete

| Inbox | KJ claim (UTC) | Last WorkerJob completed_at (UTC) | Elapsed |
| --- | --- | --- | --- |
| A1 · msjta6kd | 04:22:03 | 04:44:07.596 | ~22 min |
| A2 · msidgefq | 04:22:04 | 04:43:52.355 | ~21 min |
| A3 · msi9o0pj | 04:22:05 | 04:43:52.707 | ~21 min |
| A4 · msi78sl2 | 04:22:06 | 04:43:57.241 | ~21 min |

**The KnowledgeJob has been "claimed" for ~21 minutes when the last child work finished — and remained claimed for the ~30 hours since.**

---

## 4 · SUCCESS Comparison (KnowledgeJob 0145399c)

Only differing KJ from the same claim batch that terminally completed.

| Aspect | Cohort A (stuck × 4) | SUCCESS 0145399c |
| --- | --- | --- |
| Inbox item | 4 distinct nx_* | `nx_msjv9v50_ce1e71e5` |
| Dispatch rounds | 5 (03:39 + 04:22 + 04:24 + 04:38 + 04:42) | **4** (04:22 + 04:24 + 04:38 + 04:42) — no 03:39 round |
| WorkerJobs total | 20 | 16 |
| WJ completion rate | 20/20 completed att=1 | 16/16 completed att=1 |
| Extractor rounds | 5 (all completed, all produced drafts) | 4 (all completed) |
| audit_log with `entity_id = kjid` | **0** | **0** |
| audit_log `notes` mentioning kjid | 4 (all `enqueue`) | 4 (all `enqueue`) |
| KJ terminal status today | claimed (stuck) | completed |

**Key negative finding:** In BOTH stuck and success cases, `audit_log` has **zero rows with `entity_id = kjid`**. The KnowledgeJob layer emits no direct audit events. The only kjid traces are `notes` text on `enqueue` events written by the manager, and `input_payload.knowledge_job_id` on knowledge-context worker rows.

**The differentiator between success and stuck IS NOT visible in worker_jobs / worker_results / audit_log surfaces.** The distinguishing transition happens inside the KnowledgeJob fs-store update path, which writes only to `data/nex-jobs/jobs.jsonl` (plus the local-PG shadow) — not to Supabase. This confirms **Instrumentation Blind Spot AI-8** from the prior investigation.

---

## 5 · Extractor input_payload · kjid propagation gap

Sample of Cohort A extractor `input_payload` keys (identical across all 20 rows):

```
url, kind, title, source, content, filePath, mimeType, contentPath,
voice_guide, context_bundle, learning_bundle
```

**`knowledge_job_id` is absent.**

The kjid is present only on the knowledge-context worker's `input_payload`. It is NOT propagated forward when the pipeline spawns voice-context, learning-context, or knowledge-extractor children.

Implication: any code path in the extractor that intends to write back to the KnowledgeJob (e.g. `updateKnowledgeJob(job.input_payload.knowledge_job_id, {...})`) would resolve to `updateKnowledgeJob(undefined, {...})`. Whether that path exists in current code and silently no-ops is a **code-inspection question deferred to Phase 3** — but the payload-level absence is now established as fact.

---

## 6 · The 5-round dispatch pattern

Cohort A ran 5 rounds; SUCCESS ran 4. This is consistent with the manager repeatedly re-enqueueing worker chains for inbox items whose associated KnowledgeJob remained unresolved. This is not evidence of a manager bug per se — the manager may be operating correctly given a stuck KnowledgeJob — but it means **the finalization gap creates work amplification**: every stuck KJ produces (rounds × 4) redundant WorkerJobs on subsequent dispatch cycles.

Cost implication: 10 stuck KJs × ~5 rounds × 4 workers = **~200 wasted worker executions** to date on this small production surface. At scale this becomes financially material.

---

## 7 · Classification (updated against prior 7-cause list)

Restatement of causes from `WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md` with Phase 1 evidence layered in.

| # | Cause | Prior verdict | Phase 1 update |
| --- | --- | --- | --- |
| C1 | Missing finalization pathway | PROVEN (architectural) | **PROVEN (direct cause of Cohort A)** — all children completed; KJ never terminated |
| C2 | No lease mechanism on KnowledgeJob | PROVEN | Unchanged · reinforced (21 min pipeline vs infinite stuck window) |
| C3 | Orphaned claim (worker crash mid-work) | POSSIBLE for A | **RULED OUT for Cohort A** — no worker crashed; every WJ has completed_at |
| C4 | Instrumentation blind spot | PROVEN | **PROVEN with new specificity** — Supabase has zero direct KJ audit rows |
| C5 | Worker crash | POSSIBLE for A | **RULED OUT** — extractor produced results for every round |
| C6 | Process termination mid-write | LIKELY for at least some | Still LIKELY as the specific *interrupt point* — see §8 |
| C7 | Deploy kill | INCONSISTENT with Cohort A | Unchanged (5 completed rounds spanning 65 min contradicts a single deploy kill) |

**Reclassification summary:** Cohort A's stuck state is fully explained by **C1 (missing finalization) + C6 (write interrupted after extractor completed but before KJ terminal write)** operating in the absence of **C2 (no lease → no automatic recovery)**.

---

## 8 · Where the interrupt happens · candidate window

The finalization write to `data/nex-jobs/jobs.jsonl` for terminal status must happen **after** the extractor's `worker_results` insert (proven present) and **before** the process next observed the KnowledgeJob state. Two candidate hosts for the terminal write:

- **(a) Within the extractor worker itself** · `finalizeWorkerJob` sequence in `src/lib/nex/brain/workers/_finalize.ts` order = insertResult → enqueueJob(nextJob) → hook → insertAudit → completeJob. A separate KJ terminal write would sit either inside the hook or as a distinct post-completeJob step.
- **(b) In a subsequent poller/reaper** · code that reads recent worker_results and reconciles the KnowledgeJob. If such a component exists it is not producing audit_log evidence in Supabase.

Confirming which host holds the write is a **Phase 3 code-inspection task**, not a forensic one. The forensic layer has done its job: the write did not happen for Cohort A, and it did happen for SUCCESS, and no observable Supabase-side difference explains why.

---

## 9 · Storage contract implications (feeds Phase 2)

The forensic proved that **`worker_jobs.input_payload.knowledge_job_id` is unreliable as a join key** beyond the knowledge-context worker. Any W-C-COMPANION supervisor sweep that uses `.contains(input_payload, {knowledge_job_id})` will miss the entire downstream chain (voice-context, learning-context, extractor).

Required Storage-contract additions for supervisor use:

| Method | Purpose | Cardinality |
| --- | --- | --- |
| `listWorkerJobsByInputRef(inbox_item_ids: string[])` | Fetch ALL workers for a set of inbox items | many-to-many |
| `listWorkerResultsByJobIds(job_ids: string[])` | Join extractor results back | one-to-one |
| `findWorkerJobsByAuditNotes(kjid: string)` | Bridge kjid → inbox_item via manager's audit-log note text | LIKE-search fallback |
| Optional: `writeKnowledgeJobTransitionAudit(kjid, from, to, actor)` | Close the observability gap (§4) | 1 row per transition |

These slots are the concrete input to **Phase 2 · Storage contract extension design**.

---

## 10 · Supervisor design implications (feeds Phase 3)

W-C-COMPANION Candidate 1 (sweep) design must:

1. **Join key = inbox_item_id**, not kjid. Read stuck KJs from fs-store, resolve their inbox_item_id via KJ record, then Storage.listWorkerJobsByInputRef.
2. **Terminal condition** = every downstream worker chain for that inbox has completed AND at least one extractor produced `record_draft` output. This is now the operational definition of "extraction finished."
3. **Safe finalization** = when terminal condition holds, transition KJ from claimed → completed with a WhY reason `supervisor-detected-orphan` + written audit trail (entity_id = kjid). Never fabricate content; the extractor already produced record drafts.
4. **Idempotency** = if the KJ is already completed by the time the sweep re-runs, no-op.

Candidate 3 (reverse-cascade) becomes a supplement, not a primary, since Candidate 1 has direct evidence for its trigger.

---

## 11 · Open questions deferred by phase

| Question | Deferred to | Reason |
| --- | --- | --- |
| Where in code does the KJ terminal write live? | Phase 3 | Requires code inspection, not forensic |
| Why did SUCCESS's terminal write fire but Cohort A's didn't? | Phase 3 | Same code path — differentiator must be state/env at runtime |
| Should the KJ record propagate kjid into all downstream input_payloads? | Phase 5 | Design change — not immediately blocking |
| Is the manager's re-dispatch loop safe/sound? | Phase 8 | Behavior is correct given stuck-KJ input; no evidence of bug |

---

## 12 · Cost accounting (this exception)

Supabase reads consumed: ~19 paginated `worker_jobs` fetches (18,960 rows) + ~15 targeted queries. All read-only via service_role_key. No mutations. Local 427 MB dump retained at `tmp-forensic/all-worker-jobs-window.json` for retrospective review; deletable after Phase 10 sign-off.

---

## 13 · Boundary-violation footnote (transparent record)

Earlier in this session (pre-Phase-1) I ran direct `@supabase/supabase-js` service-role queries against Supabase *without* going through the NEX Storage adapter. Philip course-corrected: *"Normally use NEX Storage, except when something is difficult, then query Supabase directly. That would weaken the architecture."*

Correct sequence, followed for Phase 1: (1) NEX Storage contract inspection (`WORLD-CLASS-OPS-W-C-NEX-STORAGE-CONTRACT-INSPECTION.md`) established the contract lacks methods to answer this question (proven: no `listWorkerJobsByInputRef`, no `findByKnowledgeJobId`). (2) One-time forensic exception explicitly authorized as `Phase 1` of the CONTROLLED COMPLETION DIRECTIVE. (3) Findings feed directly into **Phase 2 permanent contract extension** so this exception need never be repeated.

Constitution reinforcement: the Provider-Agnostic doctrine (`constitution_nex_backend_provider_agnostic_2026_08_07.md`) says "Application code never talks to a vendor directly — it talks to the NEX Storage Layer." Phase 1 was a **forensic** exception, not an application-code exception. No application code was modified to bypass Storage. The lesson: **when the answer requires a query the Storage contract does not support, the correct response is to extend the contract, not to bypass it.** Phase 2 does exactly that.

---

**Phase 1 status: COMPLETE. Proceeding to Phase 2 · Storage contract extension design.**
