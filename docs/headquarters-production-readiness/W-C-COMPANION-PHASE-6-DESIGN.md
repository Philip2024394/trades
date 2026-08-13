# W-C-COMPANION · Phase 6 · Implementation Design

**Status:** DESIGN ONLY · no code · no schema · no migration · no fixture change
**Wave:** 2 of the WORLD-CLASS-OPS-REMEDIATION-PLAN
**Authorisation:** Philip · 2026-08-10 · "AUTHORISE WAVE 2 — W-C-COMPANION PHASE 6 DESIGN ONLY"
**Governs:** the future Phase 6 implementation (separate authorisation)
**Prior art (do NOT re-decide):**
- `WORLD-CLASS-OPS-W-C-COMPANION-SUPERVISOR-DESIGN-V2.md` — the V2 architecture (Path A/B/C · attest strategy · idempotency)
- `WORLD-CLASS-OPS-W-C-STORAGE-CONTRACT-EXTENSION-DESIGN.md` — the 5-method extension (shipped Wave 11 Phase 5)
- `WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md` — the empirical basis (10 preserved stuck KJs · Cohorts A/B)
- `WORLD-CLASS-OPS-W-C-SUPABASE-COHORT-A-INVESTIGATION.md` — join-key evidence
- `NEX-STORAGE-AUTHORITY-CHECK.md` — the transitional architecture: Supabase currently authoritative for Brain

This design supersedes NONE of the above. It fills the "Phase 6 implementation spec" gap in V2 §7.

---

## 0 · What this design will not do

- Will not modify F35 (`_finalize.ts`) — off limits.
- Will not add lease columns to `nex.knowledge_dump_jobs` — deferred per V2 §7 (Candidate 2).
- Will not add a `correlation_id` column to any KJ table — that is W-OBS-1 Layer 2, deferred.
- Will not touch `pg_stat_statements`, Supabase, prod NEX Postgres, or migrations.
- Will not attempt to fix the 10 preserved stuck KJs during Phase 6 initial ship. Phase 6 initial ship provides the mechanism; the 10 fixtures are recovered by operator action under the runbook.
- Will not migrate any Supabase-legacy subsystem to NEX Postgres. Phase C work per `ARCHITECTURAL-STANCE.md`.

---

## 1 · Preconditions inventory

| # | Precondition | Current state | Evidence |
|---|---|---|---|
| P1 | `writeKnowledgeJobTransitionAudit` on `BrainStore` | ✅ shipped | `types.ts:277-286` (contract) · Wave 11 Phase 5 commit `493cf86` |
| P2 | `listWorkerJobsByInputRef` on `BrainStore` | ✅ shipped | contract-extension design §3.2 · Wave 11 Phase 5 |
| P3 | `findWorkerJobsByKnowledgeJobId` on `BrainStore` | ✅ shipped | contract-extension design §3.3 · needs expression index on Postgres/Supabase (migration `005_worker_jobs_kjid_expression_index.sql`) |
| P4 | `getWorkerJob` on `BrainStore` | ✅ shipped | §3.1 |
| P5 | `listWorkerResultsByIds` on `BrainStore` | ✅ shipped | §3.4 |
| P6 | `applyTerminalKnowledgeJobTransition` helper | ✅ shipped · `src/lib/nex/jobs/terminal-transition.ts` | 104-line module, idempotent no-op on same-status second call |
| P7 | `findActiveJobByInboxItemId` in fs-store (Path C reverse resolution) | ✅ exists · relied on by manager dispatch | `manager.ts:275`, existing method |
| P8 | Extractor writes `output_kind: "record_draft"` on success | ✅ verified | `knowledge-extractor.ts:483` |
| P9 | `worker_results.output_payload.draft_record_ids` present on success | Assumed per V2 §4.1 step 9 | Contract not verified end-to-end; **Test T1** will lock it |
| P10 | Postgres `pg_try_advisory_lock` available | ✅ native to PG 12+ · localhost:5433 runs PG 17.10 | Standard PG feature |
| P11 | `audit_log` table accepts arbitrary `action` string values | Unverified · **Test T2** will check the CHECK constraint (if any) allows `supervisor-review-required` |
| P12 | `applyTerminalKnowledgeJobTransition` accepts only `TerminalTargetStatus = "completed" \| "failed"` | ✅ verified · `terminal-transition.ts:39` | V2 §4.2 uses `"released"` — this design will only use `"completed"` / `"failed"` and document `"released"` as out-of-scope |
| P13 | `NEX_BRAIN_BACKEND` selector · Path C fires from the extractor which uses whatever `brainStore()` returns | ✅ verified | Path C is backend-agnostic |
| P14 | The 10 preserved stuck KJs remain untouched · fixture preservation | ✅ per stuck-claimed investigation guardrails · zero writes since 2026-08-11 |

**Any RED cell** must close before Phase 6 implementation starts. Currently P9 + P11 are the only ⚫ items; both are covered by tests T1/T2 in §16.

---

## 2 · File plan

Every file the implementation will add · one line of purpose · no other file may be created without amending this design.

| Path | Purpose |
|---|---|
| `src/lib/nex/jobs/supervisor.ts` | Path A + Path B in one module · pure functions accepting `BrainStore` + `KnowledgeJobStore` DI |
| `src/lib/nex/jobs/supervisor-stuck-detector.ts` | Isolated stuck-KJ query · re-used by test + production runner |
| `src/app/api/nex/brain/supervisor-sweep/route.ts` | Cron entrypoint · GET (sweep) + POST (force-sweep) |
| `src/lib/nex/jobs/tests/supervisor-attest-sweep.test.mjs` | Path A contract |
| `src/lib/nex/jobs/tests/supervisor-review-queue.test.mjs` | Path B contract |
| `src/lib/nex/jobs/tests/supervisor-idempotency.test.mjs` | Advisory-lock + duplicate-run coverage |
| `src/lib/nex/jobs/tests/supervisor-race.test.mjs` | Race between sweep + still-running worker · CAS-behaviour |
| `docs/operations/runbooks/supervisor-sweep.md` | Operator SOP · enable/pause · review-queue triage |
| `scripts/supervisor-resolve.mjs` | Operator CLI to advance review-queue KJs (Path B follow-through) |

No changes to migrations. No changes to `_finalize.ts`. No changes to `terminal-transition.ts`. No changes to `fs-store.ts`. No changes to any existing test.

If the implementation surfaces a need to modify any of those, the design must be revisited — **do not silently expand scope**.

---

## 3 · Path A · Attest sweep · complete specification

### 3.1 · Purpose
Recover Class-X stuck KJs (Cohort A shape: extractor completed but KJ never terminally updated) by ATTESTING the completion from `worker_results` evidence. Never re-drives LLM work.

### 3.2 · Inputs
- Env: `NEX_KJOB_SUPERVISOR_ENABLED` (must equal `"1"`)
- Env: `NEX_KJOB_SUPERVISOR_MAX_PER_TICK` (default `25`; caps KJs processed per invocation)
- Env: `NEX_KJOB_SUPERVISOR_STUCK_AFTER_MIN` (default `30`; wall-clock threshold)
- DI: `store: Pick<BrainStore, "listWorkerJobsByInputRef" | "listWorkerResultsByIds" | "writeKnowledgeJobTransitionAudit">`
- DI: `kjStore: { getJob, updateJob, listJobs }` (from `src/lib/nex/jobs/fs-store`)

### 3.3 · Outputs
```ts
type PathASweepResult = {
  claimed_sweep_lock: boolean;         // false = another sweep in progress · skipped
  candidates_scanned: number;          // stuck KJs scanned
  attested: string[];                  // kjids that Path A completed
  fell_through_to_path_b: string[];    // kjids Path A could not attest
  errors: Array<{ kjid: string; message: string }>;
  duration_ms: number;
};
```

### 3.4 · State transitions produced
| Input state | Path A action | Output state |
|---|---|---|
| KJ.status = 'claimed' · extractor WorkerJob completed · `record_draft` exists | ATTEST | KJ.status = 'completed' (via `applyTerminalKnowledgeJobTransition`) + `writeKnowledgeJobTransitionAudit` row |
| KJ.status = 'claimed' · no extractor WorkerJob found | Fall through to Path B | Unchanged |
| KJ.status = 'claimed' · extractor WorkerJob exists but not completed | Fall through to Path B | Unchanged |
| KJ.status = 'claimed' · extractor completed but no `record_draft` in results | Fall through to Path B | Unchanged |
| KJ.status ≠ 'claimed' (raced to completed/failed between selection and action) | No-op via `applyTerminalKnowledgeJobTransition` idempotency check | Unchanged |

### 3.5 · Database interactions
| Step | DB call | Read/Write | Adapter method |
|---|---|---|---|
| 1 | Read stuck candidates | R | `kjStore.listJobs({ status: 'claimed', include_all_states: true, since_ms: N * 30 min })` filtered by `updated_at < now() - 30 min` client-side |
| 2 | Per candidate: read KJ current state | R | `kjStore.getJob(kjid)` |
| 3 | Per candidate: read WorkerJobs by inbox_item_id | R | `store.listWorkerJobsByInputRef([inbox_item_id])` |
| 4 | Per candidate: read WorkerResults for extractor jobs | R | `store.listWorkerResultsByIds(extractor_result_ids)` |
| 5 | Attest: write KJ terminal | R+W (JSONL append + PG shadow-upsert) | `applyTerminalKnowledgeJobTransition(store, { kjid, patch: { status: 'completed', progress: 100, completion_result: {...} }, actor: 'supervisor:companion', reason: 'attested-from-worker-results', metadata: { ... } })` |
| 6 | Attest: audit row | W | Written by helper (step 5) via `store.writeKnowledgeJobTransitionAudit` — non-fatal · logged if it throws |

**No mutations to `nex.worker_jobs` or `nex.worker_results` in Path A.** Ever. Read-only against those tables.

### 3.6 · Failure modes and retry behaviour
| Failure at step | Effect | Recovery |
|---|---|---|
| 1 | Sweep errors out · zero attested · `errors` empty · advisory-lock released | Next sweep tick retries |
| 2 | Per-KJ `getJob` returns null · candidate dropped from batch | Not retried this tick · picked up next tick if still stuck |
| 3 or 4 | Adapter throws (Postgres/Supabase down) | Per-KJ catch · `errors.push({kjid, message})` · continue loop · next KJ processed · next tick retries |
| 5 | `applyTerminalKnowledgeJobTransition` throws (fs-store write fails) | Per-KJ catch · errors.push · KJ remains stuck · next tick retries |
| 6 | Audit-writer throws | Non-fatal per helper design · KJ state authoritative · `[terminal-transition] KJ transition audit failed` logged |

**Retry budget:** unlimited implicit (cron re-fires every 7 min). Deliberately no per-KJ attempt counter in Phase 6 — the batch cap prevents runaway. If a specific KJ keeps failing at step 5, it stays in the stuck query set indefinitely; operator inspects.

### 3.7 · Concurrency behaviour
Guarded by advisory lock (§7 below). If a second sweep starts while the first holds the lock, second returns `{ claimed_sweep_lock: false, ... }` after zero work.

Within a single sweep, KJs are processed **sequentially** — no per-KJ parallelism. Rationale: bounded work per tick, simpler audit trail, no need to reason about intra-sweep contention.

### 3.8 · Audit evidence produced
Per attested KJ · exactly one row via `writeKnowledgeJobTransitionAudit`:
```json
{
  "knowledge_job_id": "<kjid>",
  "from_status": "claimed",
  "to_status": "completed",
  "actor": "supervisor:companion",
  "reason": "attested-from-worker-results",
  "worker_job_id": "<extractor-worker-job-id>",
  "correlation_id": "<if present on the extractor WorkerJob's input_payload>",
  "metadata": {
    "extractor_result_ids": ["<r1>", "<r2>"],
    "attested_at": "<ISO>",
    "batch_id": "<sweep-uuid>"
  }
}
```

Per sweep · one signal via `emitSignal`:
```json
{
  "subsystem": "supervisor",
  "kind": "sweep-completed",
  "code": "path-a",
  "detail": "attested=N reviewed=M errors=E duration_ms=D"
}
```

### 3.9 · Test requirements
Contract test file: `src/lib/nex/jobs/tests/supervisor-attest-sweep.test.mjs`
- **A1** · Seeds a burner KJ + completed extractor WorkerJob + `record_draft` WorkerResult · asserts sweep attests it · KJ terminal · audit row written
- **A2** · Same as A1 but with two burner KJs · asserts both attested in one sweep
- **A3** · Seeds a burner KJ with NO WorkerJobs · asserts Path A falls through (no attest, no error)
- **A4** · Seeds a burner KJ with extractor WorkerJob that is `status='running'` · asserts Path A falls through
- **A5** · Seeds a burner KJ with completed extractor but result output_kind ≠ `record_draft` · asserts Path A falls through
- **A6** · Runs the sweep twice back-to-back on the same seeded burner · asserts second run is a no-op (idempotency)

### 3.10 · Rollback behaviour
Path A performs `claimed → completed` transitions. Rollback = `UPDATE nex.knowledge_dump_jobs SET status = 'claimed', updated_at = NOW() WHERE job_id = ?` at the DB level, but this is a manual operator action not built into Phase 6. **Rationale:** attest decisions are supposed to be correct-by-evidence; if wrong, it's a defect to fix, not a routine rollback. The audit row provides forensic trail for any post-hoc reversal.

---

## 4 · Path B · Review queue · complete specification

### 4.1 · Purpose
For Class-Y stuck KJs (Cohort B shape: partial or no worker chain · evidence insufficient to attest), enqueue an operator-review artifact. **Never** auto-decide.

### 4.2 · Inputs
Path B is invoked as Path A's fallthrough. Inputs are inherited (KJ snapshot, worker-chain snapshot). No separate cron.

### 4.3 · Outputs
```ts
type PathBReviewOutcome = {
  kjid: string;
  action: "review-queued";
  audit_row_id: string;
  recommended_action: "requeue" | "mark_failed" | "manual_investigate";
};
```

### 4.4 · State transitions produced
| Input | Path B action | KJ state | Audit row |
|---|---|---|---|
| Any Path-A fallthrough | Queue review artifact | UNCHANGED (still `claimed`) | Written to `audit_log` |

Path B **never** transitions the KJ. It writes ONE `audit_log` row and stops.

### 4.5 · Database interactions
Single INSERT via `store.insertAudit` (existing method · confirmed in BrainStore):
```ts
await store.insertAudit({
  entity_type: "knowledge_jobs",
  entity_id: kjid,
  action: "supervisor-review-required",
  actor: "supervisor:companion",
  before_state: null,
  after_state: {
    recommended_action: "<based on worker-chain snapshot>",
    worker_chain_snapshot: {
      counts_by_worker_type_status: { ... },
      last_completed_at: "<ISO or null>",
      reached_extractor: <boolean>,
      extractor_produced_drafts: <boolean>,
    },
    stuck_duration_hours: <number>,
    inbox_item_id: "<>",
    correlation_id: "<if present>",
  },
  notes: `Supervisor review required · <one-line summary>`,
});
```

**Deliberate dedup approach:** call `store.listAudit({ entity_id: kjid, action: "supervisor-review-required", limit: 1 })` BEFORE inserting; if a row exists in the last 24h, skip the write. Prevents review-queue noise while keeping the audit table append-only.

### 4.6 · Recommended-action heuristics
| Worker-chain state | recommended_action |
|---|---|
| Zero WorkerJobs for the inbox_item_id | `requeue` (safe to re-drive; nothing spent) |
| WorkerJobs exist but none completed | `manual_investigate` (could be mid-flight; needs human eyes) |
| Extractor completed but zero drafts produced | `mark_failed` (extractor terminal · no evidence of value · re-driving costs LLM without expected result) |
| Any other combination | `manual_investigate` |

Heuristics are advisory only; operator ultimately chooses.

### 4.7 · Failure modes and retry behaviour
- `insertAudit` throws · Path B catch · logged · Path A sweep continues to next KJ · this KJ shows up next tick and is retried.
- No retry storm risk: dedup query prevents multiple rows per 24h per kjid.

### 4.8 · Concurrency behaviour
Two concurrent sweeps guarded by the advisory lock (§7). Within a single sweep, sequential; the pre-insert dedup query prevents duplicate rows even if the same kjid is somehow processed twice.

### 4.9 · Audit evidence produced
The `audit_log` row itself IS the evidence. Plus one signal per Path B action:
```json
{
  "subsystem": "supervisor",
  "kind": "review-queued",
  "code": "recommended:<action>",
  "detail": "kjid=<> reason=<one-word>"
}
```

### 4.10 · Escalation policy
- KJ in review queue > 72 h → sweep fires `escalation-required` signal per tick until the KJ transitions.
- Signal payload includes `kjid`, `queued_at`, `hours_open`, `recommended_action`.

### 4.11 · Test requirements
Contract test file: `src/lib/nex/jobs/tests/supervisor-review-queue.test.mjs`
- **B1** · Burner KJ · zero WorkerJobs · sweep · assert audit row written with `recommended_action=requeue`
- **B2** · Burner KJ · partial chain · sweep · assert `recommended_action=manual_investigate`
- **B3** · Burner KJ · extractor completed no drafts · sweep · assert `recommended_action=mark_failed`
- **B4** · Run twice back-to-back · second sweep does NOT create a second review row (dedup query) · assert audit_log has exactly one row for that kjid
- **B5** · Burner KJ · stuck > 72 h (simulated by adjusting `updated_at`) · sweep · assert `escalation-required` signal fires

### 4.12 · Rollback behaviour
Rollback = deleting the review-queue audit row (SQL DELETE). Not automated. Auditable via the row itself.

---

## 5 · Path C · Positive cascade · current state audit + closure

### 5.1 · What is already shipped
`src/lib/nex/jobs/terminal-transition.ts` — the `applyTerminalKnowledgeJobTransition` helper. Called from `knowledge-extractor.ts:511` (success) and `:546` (failure).

Verified this session:
- Helper is idempotent (`from_status === to_status` short-circuits at line 77-79).
- Helper writes the audit row after the KJ update (line 84-102).
- Audit-write failure is non-fatal (logged, swallowed).
- Called from BOTH extractor success and failure paths.
- Uses `findActiveJobByInboxItemId(job.input_ref)` via manager · resolves kjid without needing payload propagation.

### 5.2 · Gap identified
Path C **only fires from the extractor**. Terminal transitions from other workers (`quality-checker`, `image-analyst` when image chain does not reach extractor) do NOT cascade to KJ terminal.

For the current failure modes (extractor-terminal-write-broke pattern from Cohort A), this is sufficient — the extractor IS the terminal worker for extraction chains.

For image chains that terminate at `image-analyst` without extractor, no Path C fires. **These would rely entirely on Path A sweep to detect and attest.** Design decision: **do NOT extend Path C to other workers in Phase 6 initial ship.** Reason: image chains produce a different result shape (no `record_draft`); attest condition (§3.4) would need extension. Bundled into a Phase 6.1 follow-up if operator observes stuck image-chain KJs.

### 5.3 · State transitions produced (already shipped)
Extractor success: WorkerJob `assigned → completed` (F35) → cascade → KJ `claimed → completed` (via helper).
Extractor failure: WorkerJob `assigned → failed` (F35) → cascade → KJ `claimed → failed` (via helper).

### 5.4 · Database interactions (already shipped)
1. `updateJob(kjid, { status, progress, completion_result })` — fs-store JSONL append + PG shadow upsert
2. `store.writeKnowledgeJobTransitionAudit(...)` — audit row

### 5.5 · Failure modes (already handled)
- Helper `from_status === to_status` skip
- Audit-write failure non-fatal
- kjid resolution returns null (KJ already completed elsewhere) → helper no-ops

### 5.6 · Concurrency behaviour
Race between cascade + Path A sweep: helper's idempotency check makes second call a no-op. Race between two cascades (impossible in practice · one extractor per WorkerJob): helper still handles it.

### 5.7 · Test coverage delta
Existing coverage in `terminal-transition.ts` region is not formally documented — a Phase 6 test suite item is to add contract tests **`C1-C4`** locking:
- **C1** · idempotent second call from extractor success · one audit row
- **C2** · extractor failure cascades to KJ `failed`
- **C3** · kjid unresolvable (KJ already completed) · helper no-ops
- **C4** · audit-write throws · KJ state still updated · warning logged

### 5.8 · Rollback
No rollback needed for Path C in Phase 6 — the helper is already deployed and stable. Removing it would require an extractor code change out of scope.

---

## 6 · Cron entrypoint · complete specification

### 6.1 · Route
`GET /api/nex/brain/supervisor-sweep`
`POST /api/nex/brain/supervisor-sweep` (operator force-fire; identical logic, non-cron auth)

### 6.2 · Auth
`checkCronAuth(req, env, { scope: "supervisor" })` — reads `CRON_SECRET_SUPERVISOR` first; falls back to shared `CRON_SECRET` / `NEX_BRAIN_CRON_TOKEN` if scoped token unset. **First real consumer of the D4 scoped-tokens feature.**

Compatible with HMAC (F14): a cron caller may sign with the scoped secret instead.

### 6.3 · Gate
`NEX_KJOB_SUPERVISOR_ENABLED=1` required. Unset → returns:
```json
{ "ok": true, "disabled": true, "reason": "NEX_KJOB_SUPERVISOR_ENABLED != 1" }
```
Status 200 (not an error condition · Vercel Cron treats 5xx as retry).

### 6.4 · Concurrency guard
Wraps the sweep in `SELECT pg_try_advisory_lock(<CONST>)`. If lock acquisition fails:
```json
{ "ok": true, "skipped_concurrent": true }
```

Lock constant: pick a 64-bit int that is not used elsewhere. Proposal: hash of the string `"nex.supervisor.sweep"` truncated to bigint. Document the value in the runbook so future locks don't collide.

`SELECT pg_advisory_unlock(<CONST>)` in `finally`. Even a runner crash releases the lock at connection close (advisory locks are session-scoped).

### 6.5 · Behaviour matrix
| Env / lock state | Response body | Status |
|---|---|---|
| `NEX_KJOB_SUPERVISOR_ENABLED != 1` | `{ ok: true, disabled: true }` | 200 |
| Enabled · lock acquired · sweep runs | `{ ok: true, disabled: false, result: PathASweepResult }` | 200 |
| Enabled · lock NOT acquired | `{ ok: true, skipped_concurrent: true }` | 200 |
| Auth fails | via `cronAuthErrorBody(auth)` | 401 or 500 |
| Sweep throws | logged via `logger.error("sweep_failed", { error })` + counter `supervisor.error` incremented + response `{ ok: false, error: "sweep_failed" }` | 500 |

### 6.6 · Cron schedule
Proposed: `*/7 * * * *` in `vercel.json`. Rationale:
- Inside the V2 §4.1 5-10 min window
- Relatively prime with the 1-min `cron-tick` (avoids collision every minute)
- 205 sweeps per day at default `MAX_PER_TICK=25` = 5125 potential attestations per day · well beyond any expected steady-state stuck rate

### 6.7 · Batch cap enforcement
`NEX_KJOB_SUPERVISOR_MAX_PER_TICK` (default `25`). Enforcement:
- `kjStore.listJobs({ status: 'claimed', ... })` client-side filter for `updated_at < now() - 30 min` → SLICE first N.
- Sweep iterates exactly N KJs, then returns.

### 6.8 · Inputs · outputs · state transitions
Inputs: HTTP request only. All configuration via env.
Outputs: JSON summary per §6.5.
State transitions: none at the route layer; all state changes happen in `supervisor.ts`.

### 6.9 · Failure handling
- Auth error: 401/500 · no state change · no lock held.
- Lock cannot acquire: 200 · no state change.
- Sweep throws: 500 · lock released in `finally` · `supervisor.error` counter · next tick retries.

### 6.10 · Concurrency behaviour
Advisory lock is the ONLY concurrency primitive. HTTP-level rate-limiting not required (cron secret already gates).

### 6.11 · Test requirements
- **E1** · Route file has `checkCronAuth(req, env, { scope: "supervisor" })` (grep test)
- **E2** · Route returns `disabled:true` when env unset
- **E3** · Route returns `skipped_concurrent:true` when a second call races before first releases
- **E4** · Route returns 500 with `supervisor.error` counter incremented if sweep throws
- **E5** · Route wraps in `runFromRequest` (CADP1 compliance · adopts the correlation-ID plumbing to LAYER1_ADOPTED)

### 6.12 · Rollback behaviour
Remove `NEX_KJOB_SUPERVISOR_ENABLED` env value → next tick returns `disabled:true` → no sweep runs → no writes. Zero data change. Fully reversible.

---

## 7 · Advisory-lock concurrency protection · complete specification

### 7.1 · Primitive
`SELECT pg_try_advisory_lock(<CONST_INT64>)` returns `true` (locked) or `false` (someone else holds it).

### 7.2 · Lock constant
Proposal: `bigint('7291374928374623942')` (arbitrary 63-bit prime · document in supervisor.ts). If Postgres integer collision with another advisory lock elsewhere in the codebase is discovered, choose a different constant + amend this doc.

### 7.3 · Scope
Session-scoped. Bound to the pg connection. Auto-released on connection close. Explicit release in `finally` block via `SELECT pg_advisory_unlock(<CONST>)`.

### 7.4 · Behaviour on failure
- Sweep body throws before unlock → `finally` unlocks → next tick clean.
- Node process crashes → connection close releases → next tick clean.
- pg pool exhaustion → advisory lock never acquired → next tick retries.

### 7.5 · Test requirements
- **L1** · Two concurrent sweep calls · one gets lock · other returns `skipped_concurrent:true`
- **L2** · Sweep throws before unlock · lock released · immediate second sweep succeeds
- **L3** · Simulated pool disconnect mid-sweep · lock released · next sweep OK

### 7.6 · Alternative considered
Row-level `SELECT ... FOR UPDATE SKIP LOCKED` on a supervisor-lease table. Rejected: adds a table + a migration; advisory lock is zero-schema and just as safe for a single-writer sweep.

---

## 8 · Batch caps and bounded execution · complete specification

### 8.1 · Layers of bounds
1. `NEX_KJOB_SUPERVISOR_MAX_PER_TICK` (default 25) — per-sweep KJ cap
2. `listJobs({ limit: 500 })` — max KJs fetched even for stuck query · then client-side filter + slice
3. `listWorkerJobsByInputRef({ limit: 500 })` — per-KJ WorkerJob cap (per contract-extension §3.2)
4. `listWorkerResultsByIds({ limit: 500 })` — per-KJ WorkerResult cap
5. Sweep cron cadence `*/7 * * * *` — natural rate cap; sweep cannot fire more than 205 times/day per instance

### 8.2 · Non-goal
No per-KJ processing timeout in Phase 6. Rationale: each KJ processing is bounded by the 5 sync DB calls above; if any hangs, the request-level `maxDuration = 60` (proposed) on the route ends the entire sweep.

### 8.3 · maxDuration
`export const maxDuration = 60` in the route (Vercel). Well under `cron-tick`'s 120s but generous for 25 KJs × ~5 DB round-trips each = 125 round-trips.

### 8.4 · Failure mode: request timeout
Advisory lock released via `finally`. Next tick retries with fresh candidate set. No data corruption.

### 8.5 · Test requirements
- **N1** · Seeds 30 stuck burner KJs · `MAX_PER_TICK=10` · sweep processes exactly 10 · third-tick catches remainder
- **N2** · Set `maxDuration` short + slow DB · sweep aborts · lock released · subsequent sweep OK

---

## 9 · Idempotency guarantees · exhaustive

### 9.1 · Per-mechanism
| Mechanism | Idempotent? | Why |
|---|---|---|
| Path A · `applyTerminalKnowledgeJobTransition` | ✅ | Helper short-circuits when `from_status === to_status` |
| Path A · `writeKnowledgeJobTransitionAudit` | ⚠️ Written per-attest · duplicate calls WOULD write duplicate audit rows | Mitigated by helper `changed:false` short-circuit before audit is called |
| Path B · `insertAudit` | ✅ via pre-insert dedup query with `entity_id + action` in last 24 h |
| Path C · `applyTerminalKnowledgeJobTransition` | ✅ same helper |
| Sweep-level | ✅ via advisory lock |
| Extractor cascade race with sweep | ✅ helper wins whichever fires first; second is a no-op |

### 9.2 · Corner case — advisory-lock down + double-fire
If advisory-lock query itself fails (extremely rare), the sweep proceeds without lock. Two sweeps could then process the same KJ. Helper idempotency prevents duplicate terminal transitions. **But** Path A audit could write TWO rows (one per sweep) because both sweeps see `changed:true` for the first-to-write. Accepted risk: audit rows are append-only; two rows for the same transition are visually noisy but not incorrect. Alternate mitigation (not in initial ship): the helper writes audit only if `changed:true`, and the audit writer accepts an idempotency key. Deferred to Phase 6.1 if noise becomes a real problem.

### 9.3 · Test requirements
- **I1** · Run Path A sweep 3× on same burner · exactly ONE audit row emitted (helper `changed:true` on first, `changed:false` on second and third)
- **I2** · Simulated advisory-lock failure · run 2 concurrent sweeps · assert at most ONE terminal transition (helper covers) · audit rows may be 1 or 2 (document accepted noise)

---

## 10 · Retry and failure semantics · summary table

| Layer | Failure | Retry? | How often |
|---|---|---|---|
| Route auth | 401 · no retry | — | operator fixes token · next tick works |
| Sweep body · sweep-level throw | Advisory lock released · error counter · next cron tick | Yes | 7 min |
| Per-KJ processing error | Caught · errors[] entry · loop continues · same KJ retried next tick | Yes | 7 min |
| `applyTerminalKnowledgeJobTransition` fs-store write | Per-KJ catch · errors[] · KJ stays stuck | Yes | 7 min |
| Audit writer failure | Non-fatal · logged · KJ state authoritative | No | — |
| Path B insertAudit failure | Per-KJ catch · errors[] · KJ stays in stuck query | Yes | 7 min |
| Postgres pool exhaustion | Sweep 500 · lock never acquired · next tick works when pool recovers | Yes | 7 min |

**No per-KJ attempt counter.** Deliberate. A KJ that keeps failing shows up in every sweep and in the errors[] array — operator sees the pattern via logs / `/brain-health` (once counter is wired) and intervenes.

---

## 11 · Stuck-KJ detection · complete specification

### 11.1 · Definition
A "stuck" KJ satisfies all of:
- `status = 'claimed'` (via `listJobs`)
- `updated_at < now() - NEX_KJOB_SUPERVISOR_STUCK_AFTER_MIN minutes` (client-side)
- `progress = 0` (client-side) — matches every one of the 10 preserved stuck fixtures per §3.1 investigation

### 11.2 · Not-stuck cases
- `status = 'claimed'` but `progress > 0` — worker chain has started; supervisor stays hands-off (belongs to the worker retry / F35 finalization path)
- `status = 'processing'` — same
- `updated_at ≥ threshold` — recent claim; worker chain may still be in flight

### 11.3 · Detection query (per fs-store)
```ts
const jobs = await kjStore.listJobs({ status: 'claimed', include_all_states: true, since_ms: 30 * 24 * 60 * 60 * 1000 /* 30d window */ });
const stuck = jobs.filter(j =>
  j.progress === 0 &&
  new Date(j.updated_at).getTime() < Date.now() - (STUCK_AFTER_MIN * 60 * 1000),
);
return stuck.slice(0, MAX_PER_TICK);
```

### 11.4 · Postgres alternative (future optimisation)
Not in Phase 6 initial ship. Requires the fs-store to expose a `listStuck` primitive. Kept out to avoid enlarging the contract.

### 11.5 · Test requirements
- **D1** · Seed 5 burner KJs: 3 stuck (matches all conditions), 2 not-stuck (recent · or progress>0) · assert `stuckDetector.detect()` returns exactly the 3

---

## 12 · Recovery of the 10 preserved stuck KJs · runbook

**Precondition:** Phase 6 initial ship deployed AND `NEX_KJOB_SUPERVISOR_ENABLED=1` on the target env.

**Rehearsal environment:** local dev first (though local has 0 rows currently · operator-owned). Cohort A/B live in Supabase legacy — recovering them requires the supervisor to run against Supabase-backed store. **This is a critical architectural point:** the supervisor works on whichever `brainStore()` returns. If `NEX_BRAIN_BACKEND=supabase`, sweep queries hit Supabase; kjids come from the fs-store JSONL (per-machine).

**Sequence:**

1. Operator sets `NEX_KJOB_SUPERVISOR_ENABLED=1` on Vercel with `NEX_KJOB_SUPERVISOR_MAX_PER_TICK=1`.
2. Wait one cron tick (7 min).
3. Inspect the response JSON of `/api/nex/brain/supervisor-sweep` (via Vercel logs or manual GET). Expect:
   - Either 1 Cohort A KJ attested (Path A success), OR
   - 1 Cohort B KJ Path-B-queued.
4. If attested: confirm the KJ transitioned `claimed → completed` on the Supabase-backed shadow row.
5. Bump `NEX_KJOB_SUPERVISOR_MAX_PER_TICK` to `25` (default).
6. Wait N ticks until all Cohort A jobs (4) are attested.
7. Inspect the review queue via `SELECT * FROM audit_log WHERE entity_type='knowledge_jobs' AND action='supervisor-review-required'` — expect 6 rows (Cohort B).
8. For each Cohort B kjid, operator inspects the `after_state.recommended_action` + underlying worker chain evidence and chooses:
   - `requeue` → runs `scripts/supervisor-resolve.mjs <kjid> --action=requeue` (spec below)
   - `mark_failed` → runs `--action=mark_failed`
   - `manual_investigate` → any custom action; ends with `--action=complete` if data supports it
9. All 10 fixtures now terminal. Preservation formally released.

**Preservation guarantee during Phase 6 TESTING (before operator runs step 1):**
- Contract tests use burner KJs, never the 10 real fixtures.
- Runbook fires only after Philip explicitly authorises step 1.
- No pre-step-1 code path in Phase 6 touches the 10 fixtures.

---

## 13 · Operator controls · complete specification

| Control | Mechanism | Behaviour |
|---|---|---|
| Enable / disable | `NEX_KJOB_SUPERVISOR_ENABLED=1` env | Unset → route returns `disabled:true` · no sweep · zero writes |
| Cap per tick | `NEX_KJOB_SUPERVISOR_MAX_PER_TICK` env (default 25) | Sweep processes at most N KJs |
| Stuck threshold | `NEX_KJOB_SUPERVISOR_STUCK_AFTER_MIN` env (default 30) | Detection window |
| Manual force-fire | `POST /api/nex/brain/supervisor-sweep` | Synchronous sweep · same body as GET · operator-triggered |
| Review-queue resolve | `scripts/supervisor-resolve.mjs <kjid> --action=requeue\|mark_failed\|complete` | Advances a Path B queued KJ via `updateJob(kjid, {status})` |
| Review-queue inspection | `SELECT * FROM audit_log WHERE entity_type='knowledge_jobs' AND action='supervisor-review-required' ORDER BY created_at DESC` | Read-only; foundation for future UI |
| Emergency stop | Unset `NEX_KJOB_SUPERVISOR_ENABLED` + redeploy | No runtime toggle · env change requires redeploy |

**No web UI in Phase 6 initial ship.** UI is a Phase 6.1 follow-up.

---

## 14 · Audit / event trail · complete specification

### 14.1 · Per-attest (Path A)
- 1 row via `writeKnowledgeJobTransitionAudit` (§3.8 shape)
- 1 lifecycle event via existing `emitEventSafe` in `fs-store.updateJob` (event_type `knowledge_job_completed`)
- 1 counter increment: `supervisor.kj_attested`

### 14.2 · Per-review-queue (Path B)
- 1 row via `insertAudit` (§4.5 shape)
- 1 signal via `emitSignal` (§4.9)
- 1 counter increment: `supervisor.kj_review_queued`
- 1 counter increment: `supervisor.path_a_fallthrough`

### 14.3 · Per-sweep
- 1 signal `sweep-completed` (§3.8) with attested/reviewed/errors counts
- 1 counter increment: `supervisor.sweep_started` (start) + `supervisor.sweep_completed` (end)

### 14.4 · Per-error
- 1 signal per KJ error
- 1 counter increment: `supervisor.error`

### 14.5 · No new tables
Everything writes to existing `audit_log` and `nex.events` (via `emitEventSafe`).

---

## 15 · Metrics and observability · complete specification

### 15.1 · New counters (added to `src/lib/nex/observability/counters.ts`)
```
supervisor.sweep_started
supervisor.sweep_completed
supervisor.kj_attested
supervisor.kj_review_queued
supervisor.path_a_fallthrough
supervisor.cascade_terminal   // Path C · already firing via extractor · this is the metric name
supervisor.error
```

Each counter appears in the `snapshot()` roster AND the `/api/nex/observability/metrics` HELP text.

### 15.2 · New signals (via existing `emitSignal`)
| kind | code | detail example |
|---|---|---|
| `sweep-completed` | `path-a` | `attested=3 reviewed=1 errors=0 duration_ms=812` |
| `review-queued` | `recommended:requeue` | `kjid=b1772902 reason=no-worker-jobs` |
| `escalation-required` | `72h` | `kjid=270865e6 hours_open=76` |
| `error` | `<error-code>` | `kjid=<> stage=list-worker-jobs` |
| `sweep-skipped-concurrent` | `advisory-lock` | (no detail) |

### 15.3 · Structured logs
Via F4 logger `logger("supervisor")`:
- `info("sweep_started", { batch_id })`
- `info("kj_attested", { kjid, extractor_result_ids })`
- `info("kj_review_queued", { kjid, recommended_action })`
- `warn("sweep_error", { kjid, stage, error })`
- `info("sweep_completed", { batch_id, ...counts })`

### 15.4 · Live-firing surfacing
Once alert rules populated (F5 seeder), an operator can add:
- `supervisor.error > 3 window=300 → p1` (three sweep errors in 5 min)
- `supervisor.kj_review_queued > 10 window=3600 → p2` (queue growth spike)
- `supervisor.sweep_completed` lt 1 window=1200 → p1 (sweep silent for 20 min · 3x cadence)

### 15.5 · Test requirements
- **O1** · Assert every counter name is present in `KNOWN_COUNTERS` (drift-catcher)
- **O2** · Assert `emitSignal` is called with `subsystem: "supervisor"` on happy-path attest
- **O3** · Assert Prometheus `/metrics` endpoint includes each supervisor counter after a sweep

---

## 16 · Contract-test architecture · complete specification

### 16.1 · Test file layout
```
src/lib/nex/jobs/tests/
  supervisor-attest-sweep.test.mjs      // Path A (A1-A6)
  supervisor-review-queue.test.mjs      // Path B (B1-B5)
  supervisor-idempotency.test.mjs       // Advisory lock (L1-L3) + Idempotency (I1-I2) + Cascade cases (C1-C4)
  supervisor-race.test.mjs              // Race (N1-N2, E3, D1)
```

Test-runner adapter: `node --test src/lib/nex/jobs/tests/*.test.mjs`. Uses esbuild-transform loader per `require-cron-token.test.mjs` pattern for TS supervisor.ts.

### 16.2 · Fixture strategy · burner KJs
Every test creates its own burner KJ set with a unique prefix like `super-test-{timestamp}-{uuid8}`.
Every test cleans up in `after()` — DELETEs its own kjids from fs-store snapshot lines (via a `_removeJobLinesForTests(kjids: string[])` test helper) AND from PG shadow via direct SQL.
**No test references the 10 real stuck kjids.** A drift-catcher asserts no test file contains any of these substrings: `b1772902`, `1e09c119`, `6381641c`, `7e1fc4f9`, `270865e6`, `7fc668ef`, `47e0cf43`, `ab5835b8`, `56e1da78`, `46a8eb51`.

### 16.3 · Test-runner precondition guards
Each test file starts with a `describe.skip` guard that skips when:
- `NEX_POSTGRES_URL` unset (some tests need PG)
- Migration 046 not applied AND test needs enqueue idempotency (skip gracefully with warning)

### 16.4 · Full test inventory
| ID | Test | File |
|---|---|---|
| A1-A6 | Path A attest / fall-through / no-op | attest-sweep |
| B1-B5 | Path B queue / dedup / escalation | review-queue |
| C1-C4 | Path C cascade / idempotency / no-op / audit failure | idempotency |
| I1-I2 | Cross-mechanism idempotency | idempotency |
| L1-L3 | Advisory lock | idempotency |
| N1-N2 | Batch cap · timeout | race |
| E1-E5 | Cron entrypoint contract | race |
| D1 | Stuck detector | race |
| O1-O3 | Observability (counters, signals, Prometheus) | idempotency |
| T1 | Contract test locking `worker_results.output_payload.draft_record_ids` shape | attest-sweep prerequisite |
| T2 | Contract test verifying `audit_log.action` accepts `supervisor-review-required` | review-queue prerequisite |

**Total: 30 tests across 4 files.**

### 16.5 · Regression tests to run after each Phase 6 code change
- All 30 supervisor tests (`node --test src/lib/nex/jobs/tests/*.test.mjs`)
- Full pre-existing brain test suite (12+ files · 200+ assertions)
- `scripts/prove-concurrent-claim-3.ts` (regression on nex.claim_next_job SKIP LOCKED still holds)
- `scripts/prove-enqueue-idempotent.ts` (D1 dedup still holds)

---

## 17 · Burner-fixture strategy · preservation of the 10 real stuck KJs

### 17.1 · Guarantee
The 10 real stuck kjids remain in `data/nex-jobs/jobs.jsonl` and in the Supabase `nex.knowledge_dump_jobs` shadow **untouched** through Phase 6 authorship, testing, and initial deployment. Their formal release happens only when the operator executes the §12 runbook and explicitly acknowledges each recovery.

### 17.2 · How preservation is enforced
1. **Test-time enforcement:** the drift-catcher in §16.2 asserts no test file references the 10 kjids by substring. Any accidental inclusion fails CI.
2. **Runtime enforcement:** the stuck-detector query returns kjids sorted by `updated_at ASC` and slices at `MAX_PER_TICK`. Initially `MAX_PER_TICK=1` per the runbook — operator sees each recovery one at a time and can pause before proceeding.
3. **Operator-explicit go:** `NEX_KJOB_SUPERVISOR_ENABLED=1` is the gate. It stays unset in every non-recovery environment.
4. **Reverse-shadow safety net:** if the 10 fixtures exist on Supabase (Cohort A/B) and `NEX_BRAIN_SHADOW_SUPABASE=1` is active during a Wave 5 flip, any transition of a fixture would mirror pg→supabase — but during Phase 6 test/dev this env-var stays 0. Recovery run happens on Supabase-backed `NEX_BRAIN_BACKEND=supabase` — no mirror.

### 17.3 · What is explicitly forbidden during Phase 6 authoring
- No `updateJob("b1772902", ...)` (or any of the other 9 kjids) anywhere in code or tests.
- No `DELETE FROM nex.knowledge_dump_jobs WHERE job_id IN (...)` matching those kjids.
- No manual `fs.appendFile(jobsFile(), ...)` writing a fixture kjid.

### 17.4 · What operator runbook §12 does
Executes the supervisor against production data · which INCLUDES the 10 fixtures at that point · which IS the point. Preservation ends when the operator authorises the sweep to fire on production data.

---

## 18 · Deliverable A · State-machine diagram · KJ recovery lifecycle

```
                  ┌──────────────────┐
                  │  queued          │
                  └────────┬─────────┘
                           │ claimJobIfQueued (CAS)
                           ▼
                  ┌──────────────────┐
                  │  claimed         │◄─────────────┐
                  └────────┬─────────┘              │
                           │                        │
        ┌──────────────────┼──────────────────┐     │
        │ progress > 0     │ progress = 0     │     │
        │ within 30 min    │ AND stuck > 30m  │     │
        ▼                  ▼                  │     │
  ┌───────────┐   ┌──────────────────┐        │     │
  │ processing│   │  STUCK CANDIDATE │        │     │
  └─────┬─────┘   └────────┬─────────┘        │     │
        │                  │                  │     │
        │                  ▼                  │     │
        │       ┌──────────────────────┐      │     │
        │       │  Supervisor sweep    │      │     │
        │       │  (Path A)            │      │     │
        │       └──────────┬───────────┘      │     │
        │                  │                  │     │
        │       ┌──────────┴──────────┐       │     │
        │       │                     │       │     │
        │       ▼                     ▼       │     │
        │   extractor          extractor       │     │
        │   completed +        NOT completed   │     │
        │   record_draft       OR no drafts    │     │
        │       │                     │       │     │
        │       ▼                     ▼       │     │
        │  ┌─────────┐        ┌──────────────┐│     │
        │  │ATTEST   │        │ Path B       ││     │
        │  │(claimed │        │ (review queue)│     │
        │  │ →       │        └──────┬───────┘│     │
        │  │  completed)              │       │     │
        │  └────┬────┘                │       │     │
        │       │                     ▼       │     │
        │       │             ┌──────────────┐│     │
        │       │             │ Operator     ││     │
        │       │             │ chooses:     ││     │
        │       │             │ requeue /    ││     │
        │       │             │ mark_failed /│     │
        │       │             │ complete     ││     │
        │       │             └──────┬───────┘│     │
        │       │                    │        │     │
        │       │       ┌────────────┼────────┘     │
        │       │       │            │              │
        │       │       ▼            ▼              │
        │       │  requeue       failed        completed
        │       │       │            │              │
        │       │       ▼            │              │
        │       │  ┌────────┐        │              │
        │       │  │queued  │────────┘              │
        │       │  └────────┘  (returns to top)     │
        │       │                                    │
        └───────┴──────────┬─────────────────────────┘
                           ▼
                  ┌──────────────────┐
                  │   completed      │
                  │  (terminal)      │
                  └──────────────────┘

                  ┌──────────────────┐
                  │   failed         │
                  │  (terminal)      │
                  └──────────────────┘
```

**States:** `queued` · `claimed` · `processing` · `STUCK CANDIDATE` (derived) · `completed` · `failed`.
**Transitions:** as above · every transition writes a KJ snapshot AND (for supervisor transitions) an audit row.

---

## 19 · Deliverable B · Sequence diagram · complete supervisor run

```
Vercel Cron        Route Handler                 Supervisor Module              BrainStore                    fs-store              Postgres
     │                    │                              │                          │                            │                       │
     │ GET /supervisor-sweep                             │                          │                            │                       │
     │───────────────────▶│                              │                          │                            │                       │
     │                    │                              │                          │                            │                       │
     │             checkCronAuth (scope: supervisor)     │                          │                            │                       │
     │                    │──────────────────────────────┼──────────────────────────┼────────────────────────────┼──────────────────────▶│
     │                    │◀─── ok ──────────────────────┼──────────────────────────┼────────────────────────────┼───────────────────────│
     │                    │                              │                          │                            │                       │
     │             NEX_KJOB_SUPERVISOR_ENABLED?          │                          │                            │                       │
     │                    │                              │                          │                            │                       │
     │             enabled ─ acquire advisory lock       │                          │                            │                       │
     │                    │──────────────────────────────┼──────────────────────────┼────────────────────────────┼──────────────────────▶│
     │                    │◀─── locked (true) ───────────┼──────────────────────────┼────────────────────────────┼───────────────────────│
     │                    │                              │                          │                            │                       │
     │             call sweep(store, kjStore)            │                          │                            │                       │
     │                    │─────────────────────────────▶│                          │                            │                       │
     │                    │                              │  listJobs({status:claimed, ...})                       │                       │
     │                    │                              │─────────────────────────────────────────────────────▶│                       │
     │                    │                              │◀── [KJ candidates] ──────────────────────────────────│                       │
     │                    │                              │                                                                              │
     │                    │                              │  detect stuck (client-side filter + slice N)                                  │
     │                    │                              │                          │                            │                       │
     │                    │                              │  for each stuck KJ:                                                           │
     │                    │                              │    getJob(kjid)                                                               │
     │                    │                              │───────────────────────────────────────────────────▶│                       │
     │                    │                              │◀── KJ snapshot ─────────────────────────────────────│                       │
     │                    │                              │                                                                              │
     │                    │                              │    listWorkerJobsByInputRef([inbox_item_id])         │                       │
     │                    │                              │────────────────────────▶│                                                    │
     │                    │                              │                          │─── SELECT ─────────────────────────────────────▶│
     │                    │                              │                          │◀── worker_jobs rows ────────────────────────────│
     │                    │                              │◀── [WorkerJob[]] ────────│                                                    │
     │                    │                              │                                                                              │
     │                    │                              │    listWorkerResultsByIds([extractor_result_ids]) │                       │
     │                    │                              │────────────────────────▶│                                                    │
     │                    │                              │                          │─── SELECT ─────────────────────────────────────▶│
     │                    │                              │                          │◀── worker_results rows ─────────────────────────│
     │                    │                              │◀── [WorkerResult[]] ─────│                                                    │
     │                    │                              │                                                                              │
     │                    │                              │    decision matrix (Path A attest / Path B queue)                             │
     │                    │                              │                                                                              │
     │                    │                              │    (Path A) applyTerminalKnowledgeJobTransition(store, {kjid, ...})           │
     │                    │                              │──────────────────────────────────────────▶│                                   │
     │                    │                              │                          │              │─── updateJob (JSONL append) ───▶│
     │                    │                              │                          │              │─── shadowUpsertJob ────────────▶│
     │                    │                              │                          │              │─── writeKnowledgeJobTransitionAudit ─▶│
     │                    │                              │◀─── {changed:true, snapshot} ─────────────│                                   │
     │                    │                              │                                                                              │
     │                    │                              │    OR (Path B) listAudit(dedup) + insertAudit(review row)                     │
     │                    │                              │────────────────────────▶│                                                    │
     │                    │                              │                          │─── SELECT ─────────────────────────────────────▶│
     │                    │                              │                          │─── INSERT ─────────────────────────────────────▶│
     │                    │                              │◀── rowId ────────────────│                                                    │
     │                    │                              │                                                                              │
     │                    │                              │    emitSignal + logger.info + counter incr                                    │
     │                    │                              │                          │                            │                       │
     │                    │                              │  next KJ ... (loop up to MAX_PER_TICK)                                        │
     │                    │                              │                          │                            │                       │
     │                    │             release advisory lock                       │                            │                       │
     │                    │──────────────────────────────┼──────────────────────────┼────────────────────────────┼──────────────────────▶│
     │                    │◀─── unlocked ────────────────┼──────────────────────────┼────────────────────────────┼───────────────────────│
     │                    │                              │                                                                              │
     │                    │◀─── PathASweepResult ────────│                          │                            │                       │
     │                    │                              │                          │                            │                       │
     │◀── 200 { ok:true, result:{...} } ────────────────│                          │                            │                       │
```

---

## 20 · Deliverable C · Exact contract tests before Phase 6 implementation is considered complete

30 tests grouped in 4 files (§16.4). Additionally:

- **Test-suite pass:** `node --test src/lib/nex/jobs/tests/*.test.mjs` returns 30/30.
- **Regression pass:** entire `src/lib/nex/brain/tests/*.test.mjs` still 200+/200+.
- **Prod-representative probes still green:** `prove-concurrent-claim-3.ts` · `prove-enqueue-idempotent.ts` · `prove-reverse-shadow-live.ts` · `prove-unsubscribe-roundtrip.ts` all PASS.
- **Drift-catcher new:** `src/lib/nex/jobs/tests/supervisor-fixture-preservation.test.mjs` asserts no test file references the 10 real kjids by substring.
- **CADP1 extension:** `LAYER1_ADOPTED` in `correlation-adoption.test.mjs` gains `src/app/api/nex/brain/supervisor-sweep/route.ts`; test remains green.

---

## 21 · Deliverable D · Evidence for IMPLEMENTED → VERIFIED → PRODUCTION-PROVEN

**Ledger last dated: 2026-08-10 (Verification Closure)**
**Effective state: PHASE 6 — VERIFIED — LOCAL LIVE · PRODUCTION — NOT PROVEN · SUPERVISOR — DISABLED**

| # | State | Component / Requirement | Date | Result | Artifact |
|---|---|---|---|---|---|
| 1 | **IMPLEMENTED** | `supervisor.ts` · `kjob-supervisor.ts` (classifier) · `supervisor-sweep/route.ts` · `scripts/supervisor-resolve.mjs` · all supporting brain-store methods exist and typecheck | 2026-08-10 | ✅ | `npx tsc --noEmit` green · import-graph grep confirms sole orchestrator + zero external import sites for deprecated `kjob-supervisor-fetch.ts` |
| 2 | **VERIFIED (local · unit)** | 42/42 supervisor tests + 17/17 classifier tests + 8/8 safety-boundary tests all green · brain suite otherwise green | 2026-08-10 | ✅ | `node --test src/lib/nex/jobs/tests/supervisor*.test.mjs` |
| 3 | **VERIFIED (local · live · Path A)** | Burner probe: seed stuck KJ + completed extractor + record_draft · call `runSupervisorSweep(probe_mode: true, only_kjids: [burner])` · observe attestation + audit + cleanup + preservation invariant | 2026-08-10 | ✅ | `scripts/prove-supervisor-attest.ts` · PASS · burner attested · all 10 preserved fixtures unchanged |
| 4 | **VERIFIED (local · live · Path B)** | Burner probe: seed stuck KJ with **no** worker chain · assert Path B queues audit row · cleanup + preservation invariant | 2026-08-10 | ✅ | `scripts/prove-supervisor-review.ts` · PASS · review-queued · all 10 preserved fixtures unchanged |
| 5 | **VERIFIED (local · live · concurrency)** | Real Next.js dev server (port 3008) · fire 2 concurrent sweep requests · one 200 · other `skipped_concurrent` via pg advisory lock | 2026-08-10 | ✅ | `scripts/prove-supervisor-lock.ts` · PASS |
| 6 | **VERIFIED (local · live · safety boundary)** | Direct-call test of `runSupervisorSweep` with `probe_mode` missing/false throws · with `only_kjids` empty throws · non-listed kjid ignored in scope | 2026-08-10 | ✅ | `src/lib/nex/jobs/tests/supervisor-safety-boundary.test.mjs` · 8/8 |
| 7 | **VERIFIED (local · live · operator CLI)** | Burner probe: guard REFUSES preserved-prefix without `--force-preserved` (exit 2) · legitimate burner transitions claimed→completed · audit row on Supabase · all 10 preserved fixtures unchanged | 2026-08-10 | ✅ | `scripts/prove-supervisor-cli.ts` · PASS · guard exit=2 · burner attested + audit row · preservation invariant green |
| 8 | **INCIDENT (contained + closed)** | Path B probe pre-safety-boundary attested all 10 preserved fixtures; restoration authorised and executed; new operator audit rows written; forensic evidence rows retained | 2026-08-10 | ⚠️ CLOSED | `PHASE-6-PRESERVATION-INCIDENT-FORENSIC-REPORT.md` + `PHASE-6-PRESERVATION-INCIDENT-RESOLUTION.md` |
| 9 | **PRODUCTION-PROVEN (Cohort A)** | Operator runs runbook §12 · at least 1 Cohort A KJ transitions to `completed` via `actor:supervisor:companion` reason `attested-from-worker-results` · audit row exists in Supabase | — | ⛔ NOT ATTEMPTED (blocked by verification closure directive · `NEX_KJOB_SUPERVISOR_ENABLED` remains 0) | Awaits explicit production authorisation |
| 10 | **PRODUCTION-PROVEN (Cohort B)** | Operator observes 6 Cohort B audit rows appear in review queue · resolves each via CLI · all 6 terminal | — | ⛔ NOT ATTEMPTED (same block) | Awaits explicit production authorisation |
| 11 | **PRODUCTION-PROVEN (sweep cadence)** | 24 h continuous operation with `NEX_KJOB_SUPERVISOR_ENABLED=1` · zero errors · zero unexpected attestations of non-stuck KJs · `/api/nex/brain/llm-health` shows `supervisor.error=0` | — | ⛔ NOT ATTEMPTED (same block) | Awaits explicit production authorisation |

**Verification closure gate (2026-08-10):** rows 1-7 green + row 8 closed. Phase 6 is VERIFIED — LOCAL LIVE. Rows 9-11 remain OPEN. **Phase 6 must NOT be declared PRODUCTION-PROVEN until rows 9-11 are dated green by an explicit production run authorised by Philip.**

---

## 22 · Deliverable E · Architectural conflicts discovered

Reported honestly per the directive · not fixed silently.

### NEW-1 RESOLUTION (Philip 2026-08-10 · Option C · controlled merge)

- **Kept authoritative:** `supervisor.ts` (Path A + Path B + orchestration + advisory-lock + metrics + audit) as the intended Phase 6 orchestration layer per the approved design.
- **Kept + reused:** `kjob-supervisor.ts` (pure classifier `classifyStuckKJ`) — its discriminated-union output is stricter than the ad-hoc tuple the orchestrator originally used, and it carries 17 vitest assertions. `supervisor.ts::tryAttestOne` now delegates classification to it.
- **Deprecated in-place:** `kjob-supervisor-fetch.ts` — its orchestration is superseded by `supervisor.ts`. File retains a large deprecation header stating "DO NOT import from this file in new code". Zero import sites confirmed via grep. Physical deletion deferred pending explicit removal authorisation.
- **Design-typo correction:** all references in this document to `listWorkerResultsByJobIds` have been corrected to the real method name `listWorkerResultsByIds` (5 occurrences updated).

### POST-INCIDENT SAFETY BOUNDARY (Philip 2026-08-10 · Wave 2)

During Phase 6 live verification the Path B probe invoked the un-scoped supervisor sweep against the real store and attested all 10 preserved fixture kjids. Full forensic + resolution in:

- `PHASE-6-PRESERVATION-INCIDENT-FORENSIC-REPORT.md` — evidence
- `PHASE-6-PRESERVATION-INCIDENT-RESOLUTION.md` — restoration + hardening

**What changed in code as a result** (all present in `src/lib/nex/jobs/supervisor.ts` and this design's implementation):

- `SupervisorRunOptions.probe_mode?: boolean` — when `true`, sweep throws synchronously before any DB access if `only_kjids` is undefined, non-array, or empty.
- `SupervisorRunOptions.only_kjids?: string[]` — applied at the discovery boundary (after `detectStuck`, before classifier / attest / review-queue). KJs outside the list are dropped.
- Route entrypoint accepts `?probe_mode=1&only_kjids=<csv>` query params, plumbs them through, and bypasses the `NEX_KJOB_SUPERVISOR_ENABLED` gate ONLY when `probe_mode=1` (safety lives in supervisor's own guard).
- 8-test contract suite `src/lib/nex/jobs/tests/supervisor-safety-boundary.test.mjs` locks the guard shape and behaviour.

**Explicit non-relies:** MAX_PER_TICK is NOT a safety mechanism · probe's own uuid guard is NOT sufficient · operator runbook is NOT the only protection. The safety boundary now lives in the supervisor module itself.

### FINAL FILE MAPPING (post-reconciliation · post-incident)

| File | Role | Status |
|---|---|---|
| `src/lib/nex/jobs/supervisor.ts` | Orchestrator (Path A + Path B + advisory-lock + metrics + audit + probe_mode guard) | authoritative |
| `src/lib/nex/jobs/kjob-supervisor.ts` | Pure classifier (`classifyStuckKJ`) | authoritative · imported by supervisor.ts |
| `src/lib/nex/jobs/kjob-supervisor-fetch.ts` | Original store-fetch orchestrator | DEPRECATED in-place · zero import sites · retained until explicit removal |
| `src/lib/nex/jobs/supervisor-stuck-detector.ts` | Pure stuck-detector | authoritative |
| `src/lib/nex/jobs/terminal-transition.ts` | `applyTerminalKnowledgeJobTransition` helper (Wave 11 Phase 5) | authoritative · Path C · pre-existing |
| `src/app/api/nex/brain/supervisor-sweep/route.ts` | Cron entrypoint (probe_mode+only_kjids aware) | authoritative |
| `scripts/supervisor-resolve.mjs` | Operator CLI (Path B follow-through) | authoritative |
| `scripts/prove-supervisor-attest.ts` | Path A live probe (probe_mode + only_kjids) | authoritative |
| `scripts/prove-supervisor-review.ts` | Path B live probe (probe_mode + only_kjids) | authoritative |
| `scripts/prove-supervisor-lock.ts` | Route-level lock probe (probe_mode + only_kjids via query params) | authoritative |
| `src/lib/nex/jobs/tests/supervisor-*.test.mjs` × 4 | Contract test suite (attest · review · idempotency · race) | authoritative |
| `src/lib/nex/jobs/tests/supervisor-safety-boundary.test.mjs` | Safety-boundary drift-catcher | authoritative |
| `src/lib/nex/jobs/kjob-supervisor.test.ts` | Pure-classifier vitest suite | authoritative · retained as-is |
| `docs/operations/runbooks/supervisor-sweep.md` | Operator runbook | authoritative |

### E-1 · fs-store `updateJob` is NOT CAS at the DB level

**Fact:** `src/lib/nex/jobs/fs-store.ts:291-327` — `updateJob` reads then appends. No `WHERE status = ?` guard. Two concurrent callers can both write a snapshot without conflict.

**Consequence for Phase 6:** Path A idempotency relies entirely on the `applyTerminalKnowledgeJobTransition` helper's application-level `from_status === to_status` short-circuit. The advisory lock closes the concurrency window for the sweep vs sweep case; the sweep vs extractor cascade case is still protected by the helper. But an application-level check is weaker than a DB-level CAS.

**Not fixed here:** would require adding CAS to `updateJob` (schema change or transactional-select-then-update in Postgres); crosses into fs-store territory and would affect every caller. Deferred to a separate authorisation. Documented risk: if the helper is bypassed by a future caller, races can produce duplicate terminal transitions.

### E-2 · Supabase currently authoritative for the 10 stuck KJs' WorkerJobs

**Fact:** per `WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md` §6 + `NEX-STORAGE-AUTHORITY-CHECK.md` §5, the WorkerJobs that would prove attest conditions for the 10 stuck KJs live in Supabase (not local NEX Postgres).

**Consequence for Phase 6:** Path A tests using burner fixtures work fine locally. But recovery of the 10 real Cohort A fixtures requires the supervisor to run against a Supabase-backed `brainStore()` — meaning `NEX_BRAIN_BACKEND=supabase` at recovery time. The sweep design is backend-agnostic, so this is compatible; but the recovery test (§12 runbook) must run BEFORE any Wave 5 flip to Postgres, because after the flip the Supabase `worker_jobs` rows are no longer authoritative (reverse-shadow only mirrors pg→supa going forward, not the other direction).

**Not fixed here:** an architectural gap for the sequencing. Documented as a runbook-ordering requirement.

### E-3 · `writeKnowledgeJobTransitionAudit` implementation on each adapter is not audited by Phase 6

**Fact:** Contract exists (`types.ts:277-286`); implementations shipped in Wave 11 Phase 5. Phase 6 relies on the audit writer being idempotent-friendly (no duplicate-key errors on retries) and honest about failures (either succeeds or throws).

**Consequence:** if a specific adapter's implementation swallows a partial failure (e.g., writes half a row), Phase 6 will see `changed:true, snapshot:next` but the audit row may not exist. This is Path A's non-fatal design so it doesn't corrupt KJ state, but the audit trail could have gaps.

**Not fixed here:** would require an audit-writer contract test suite that Phase 6 assumes but does not add. Recommend a separate task to author `write-kj-transition-audit-contract.test.mjs` before Phase 6 goes to PRODUCTION-PROVEN.

### E-4 · Path C only cascades from the extractor · other terminal workers do not

**Fact:** `applyTerminalKnowledgeJobTransition` is only called from `knowledge-extractor.ts`. Other terminal workers (`quality-checker`, `image-analyst` when image chain terminates before extractor) do not cascade.

**Consequence:** for chains that terminate at a non-extractor worker, no Path C fires. Path A sweep catches them if `record_draft` is produced elsewhere · which it currently is NOT (only extractor writes `record_draft` per verification tonight). So these chains would perpetually fall through to Path B on stuck. That's the correct outcome (human decision needed) but should be documented in the runbook.

**Not fixed here:** extending Path C to other workers would require defining new attest conditions (per-worker output_kind expectations). Deferred to Phase 6.1.

### E-5 · `applyTerminalKnowledgeJobTransition` restricted to `"completed" | "failed"` — V2 §7 references `"released"`

**Fact:** `terminal-transition.ts:39` — `type TerminalTargetStatus = Extract<JobStatus, "completed" | "failed">`. `JobStatus` includes `"released"` in principle but the helper rejects it.

**Consequence for Phase 6:** Path A / B / C in this design use only `"completed"` and `"failed"`. `"released"` is out of scope. If a future operator flow needs a "release without terminal outcome" transition, the helper must be extended first · or Phase 6 must bypass the helper (which contradicts helper's raison d'être).

**Not fixed here:** deliberate scope limit.

### E-6 · `audit_log.action` accepts arbitrary strings · not verified

**Fact:** Test T2 in §16 flags this as unverified. If a CHECK constraint restricts values, Path B's insert would fail.

**Consequence:** first Phase 6 implementation step is T2. If it fails, either extend the CHECK constraint (migration) or pick an existing accepted `action` value + encode intent in `notes`.

### E-7 · Route file `LAYER1_ADOPTED` set requires design-review addition

**Fact:** `correlation-adoption.test.mjs:63-69` — the CADP1 test enforces which routes MUST use `runFromRequest`. Adding the supervisor-sweep route requires a design-review authorisation (see the test comment).

**Consequence:** Phase 6 implementation includes an edit to that test's constant. Should be called out in the code-review checklist so it isn't accidentally omitted.

### E-8 · Migration 046 landmine is still relevant for supervisor + Wave 5

**Fact:** Path A sweep issues `enqueueJob`? No — sweep is read-only against worker_jobs. It does NOT enqueue. So migration 046 is not a Phase 6 dependency directly. But if a Path B operator action later chooses `requeue`, the CLI script (`supervisor-resolve.mjs`) may invoke `store.enqueueJob(...)` and hit the ON CONFLICT clause. **Migration 046 must be applied to any DB where `NEX_BRAIN_BACKEND=postgres` AND supervisor is active AND operator uses `requeue`.**

**Consequence:** documented as a preconditions row in §1 (already P14 range · will be added: P15 = "migration 046 applied to target DB" gated by Phase B flip).

---

## 23 · Not-in-scope for Phase 6 (recap)

- Lease columns on KJ table (V2 §7 Candidate 2)
- CID column on KJ table (W-OBS-1 Layer 2)
- Web UI for review queue (Phase 6.1)
- Extend Path C to non-extractor terminal workers (Phase 6.1)
- Extend `applyTerminalKnowledgeJobTransition` to accept `"released"` (Phase 6.1)
- Migrate Supabase-legacy subsystems (Phase C · out of World-Class scope)
- Add CAS to fs-store `updateJob` (E-1 · needs separate authorisation)

---

## 24 · Sign-off checklist

Phase 6 implementation authorisation may proceed when:
- [ ] Every precondition in §1 is ✅ (currently P9 + P11 need T1/T2 verification during implementation)
- [ ] Every §22 architectural conflict has a resolution note (documented risk OR deferred to Phase 6.1 OR fixed in a separate authorised change)
- [ ] The runbook §12 sequence is agreed with Philip
- [ ] The advisory-lock constant in §7.2 is chosen and documented
- [ ] Fixture-preservation rules §17.3 are acknowledged
- [ ] The 4 test files + 30 tests are agreed in scope

---

## 25 · Stop condition

Design authored. Read-only work complete. No code written. No migrations touched. No fixtures modified. No prior documents changed. Preconditions inventory + architectural conflicts reported honestly.

Phase 6 implementation is NOT authorised by this document. That is a separate step per §24 sign-off.

**Stop.**
