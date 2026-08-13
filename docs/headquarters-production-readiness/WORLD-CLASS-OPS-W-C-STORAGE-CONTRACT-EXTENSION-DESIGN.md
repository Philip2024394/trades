# WORLD-CLASS-OPS · W-C · Storage Contract Extension Design

**Phase:** 2 of CONTROLLED COMPLETION DIRECTIVE
**Status:** DESIGN ONLY · no implementation · no contract change · no adapter change
**Inputs:**
- `WORLD-CLASS-OPS-W-C-NEX-STORAGE-CONTRACT-INSPECTION.md` (contract gap identified)
- `WORLD-CLASS-OPS-W-C-SUPABASE-COHORT-A-INVESTIGATION.md` (empirical join-key evidence)
**Governs:** Phase 5 implementation of contract extension · Phase 6 supervisor consumption
**Doctrine anchors:** F12 AI2 (adapter isolation), Constitution NEX Backend Provider-Agnostic (2026-08-07), Constitution NEX Postgres Version Independence (2026-08-07)

---

## 1 · Design goals

1. Make the Cohort A forensic question answerable via NEX Storage — permanently.
2. Give W-C-COMPANION's supervisor the query surface it needs to operate without bypassing Storage.
3. Add no capability the current 3 adapters (filesystem · postgres · supabase) cannot implement cleanly.
4. Add no capability that entangles Brain runtime with NEX-Storage runtime (F12 AI4).
5. Zero performance cliff at production scale (worker_jobs table already 18,960 rows in a 4-day window → assume 100k+ per month at steady-state).

---

## 2 · The evidence base for what to add (from Phase 1)

| Empirical fact from Phase 1 | Contract implication |
| --- | --- |
| `worker_jobs.input_payload.knowledge_job_id` is present only on the knowledge-context worker, NOT on the extractor / voice-context / learning-context children | kjid alone is an INSUFFICIENT join key · need `input_ref` (inbox_item_id) as a batch join key too |
| `worker_results` join back to `worker_jobs` via `worker_jobs.result_id → worker_results.id` (one-to-one) | Result lookup by `job_id` or by `id` set is required |
| `audit_log` has zero rows with `entity_id = kjid` — KJ transitions leave no Supabase trace | Need a supervisor-friendly write path for KJ transition audit |
| Cohort A had 5 dispatch rounds → 20 WorkerJobs per inbox item | Batch fetch by input_ref must handle many rows per input_ref |
| The manager writes `audit_log.notes` with a "Manager enqueued context job for inbox item X · linked KnowledgeJob Y" phrase | Text-search of notes is a fallback bridge (kjid → inbox_item_id) — not primary but useful |

---

## 3 · Method-by-method design

### 3.1 · `getWorkerJob(job_id: string): Promise<WorkerJob | null>`

**Purpose:** singular fetch by id. Trivial gap in the current contract (`countJobs` gives aggregates; nothing gives one row by id).

**Signature:**
```ts
interface BrainStore {
  // …existing methods…
  getWorkerJob(job_id: string): Promise<WorkerJob | null>;
}
```

**Adapter cost:**
- Filesystem: `readTable("worker_jobs").find(j => j.id === job_id) ?? null`
- Postgres: `SELECT * FROM nex.worker_jobs WHERE id = $1 LIMIT 1`
- Supabase: `.from("worker_jobs").select("*").eq("id", job_id).maybeSingle()`

**Return-null semantics:** absence returns `null`, not throw. Supervisor code that iterates a stale kjid → job_id set must not crash on the missing row.

**Test surface:** contract test asserts round-trip after `enqueueJob` returns a job whose id resolves via `getWorkerJob`.

---

### 3.2 · `listWorkerJobsByInputRef(input_refs: string[], opts?: { limit?: number }): Promise<WorkerJob[]>`

**Purpose:** primary join-key method for supervisor. Given a set of inbox_item_ids (from stuck KnowledgeJobs), fetch every WorkerJob they spawned across all worker types and rounds.

**Signature:**
```ts
interface BrainStore {
  listWorkerJobsByInputRef(
    input_refs: string[],
    opts?: { limit?: number },
  ): Promise<WorkerJob[]>;
}
```

**Batch semantics:** accepts an array to allow a single supervisor sweep to process N stuck jobs in one round-trip. `limit` caps the result set to prevent runaway pagination (default: 500).

**Adapter cost:**
- Filesystem: `readTable("worker_jobs").filter(j => input_refs.includes(j.input_ref))`
- Postgres: `SELECT * FROM nex.worker_jobs WHERE input_ref = ANY($1::text[]) ORDER BY created_at LIMIT $2` — **needs index `(input_ref)`** if not already present
- Supabase: `.from("worker_jobs").select("*").in("input_ref", input_refs).order("created_at").limit(limit)`

**Empty array behavior:** returns `[]` immediately; no adapter round-trip.

**Ordering:** results ORDER BY `created_at ASC` so callers can walk chronology without a second sort.

**Test surface:** contract test seeds 2 WorkerJobs with distinct input_refs, asserts filter returns only the matched ones; asserts empty-array returns `[]`; asserts limit truncates.

---

### 3.3 · `findWorkerJobsByKnowledgeJobId(kjid: string): Promise<WorkerJob[]>`

**Purpose:** narrow forensic path — resolve the kjid → knowledge-context WorkerJobs directly. Useful when the caller has ONLY a kjid (no inbox_item_id).

**Signature:**
```ts
interface BrainStore {
  findWorkerJobsByKnowledgeJobId(kjid: string): Promise<WorkerJob[]>;
}
```

**Returns:** typically the 1-N knowledge-context WorkerJobs (one per dispatch round). Downstream chain jobs (voice / learning / extractor) are NOT returned by this method because they don't carry kjid — the caller must chain to `listWorkerJobsByInputRef` using the returned rows' `input_ref` to complete the picture.

**Design rationale:** we do NOT put "return the whole chain" in one method because that would leak the manager's dispatch topology into the Storage contract. Separation of concerns: Storage answers "which jobs match this criterion", the supervisor composes the two queries.

**Adapter cost:**
- Filesystem: `readTable("worker_jobs").filter(j => j.input_payload?.knowledge_job_id === kjid)`
- Postgres: `SELECT * FROM nex.worker_jobs WHERE input_payload->>'knowledge_job_id' = $1` — **needs expression index `((input_payload->>'knowledge_job_id'))`** for scale
- Supabase: `.from("worker_jobs").select("*").contains("input_payload", { knowledge_job_id: kjid })` — same expression index needed on Supabase side (Phase 1 forensic proved this query times out without one at 18k rows)

**Schema change required:** expression index. See §5.

**Test surface:** contract test seeds a WorkerJob with `input_payload = { knowledge_job_id: "test-kjid" }`, asserts method returns it; seeds one without, asserts filter excludes.

---

### 3.4 · `listWorkerResultsByJobIds(job_ids: string[], opts?: { limit?: number }): Promise<WorkerResult[]>`

**Purpose:** join extractor outputs back to their WorkerJobs. Needed by the supervisor to confirm "extractor produced record_draft" as a terminal condition.

**Signature:**
```ts
interface BrainStore {
  listWorkerResultsByJobIds(
    job_ids: string[],
    opts?: { limit?: number },
  ): Promise<WorkerResult[]>;
}
```

**Join direction:** `worker_results.job_id` is the FK back to `worker_jobs.id` (Phase 1 schema discovery confirmed the column name is `job_id`, not `worker_job_id`).

**Adapter cost:**
- Filesystem: `readTable("worker_results").filter(r => job_ids.includes(r.job_id))`
- Postgres: `SELECT * FROM nex.worker_results WHERE job_id = ANY($1::uuid[]) LIMIT $2` — `worker_results.job_id` should already be indexed as a FK
- Supabase: `.from("worker_results").select("*").in("job_id", job_ids).limit(limit)`

**Test surface:** seed job → result → assert lookup by job_id returns the result.

---

### 3.5 · `writeKnowledgeJobTransitionAudit(input: KnowledgeJobTransitionAudit): Promise<void>`

**Purpose:** close the observability gap identified in Phase 1 §4. Every KnowledgeJob transition (claimed → completed, claimed → failed, claimed → released) must leave an `audit_log` row with `entity_id = kjid` and `entity_type = "knowledge_jobs"`.

**Signature:**
```ts
interface KnowledgeJobTransitionAudit {
  knowledge_job_id: string;   // → audit_log.entity_id
  from_status: KnowledgeJobStatus;
  to_status: KnowledgeJobStatus;
  actor: string;              // "worker:knowledge-extractor@11300", "supervisor:companion", "manager", "manual"
  reason?: string;            // short human string
  correlation_id?: string;    // W-OBS-1 CID for cross-cutting trace
  worker_job_id?: string;     // optional origin worker_job.id
  metadata?: Record<string, unknown>; // shoved into `notes` JSON
}

interface BrainStore {
  writeKnowledgeJobTransitionAudit(input: KnowledgeJobTransitionAudit): Promise<void>;
}
```

**Storage mapping:**
- `entity_type` = `"knowledge_jobs"` (new distinct value from the existing `"worker_jobs"`)
- `entity_id` = `input.knowledge_job_id`
- `action` = `input.to_status` (e.g. `"completed"`, `"failed"`, `"released"`)
- `actor` = `input.actor`
- `before_state` = `{ status: input.from_status }`
- `after_state` = `{ status: input.to_status }`
- `notes` = JSON.stringify(rest)

**Adapter cost:** identical to existing `insertAudit` shape · single INSERT · no read.

**Adopters (Phase 5 & later):**
- Every terminal write to fs-store's `updateJob` when `patch.status` in {completed, failed, released} must call `writeKnowledgeJobTransitionAudit` alongside it. Enforced by drift-catcher (§7).
- Supervisor (Phase 6) uses this for its own transitions with `actor = "supervisor:companion"`.

**Test surface:** seed a transition; assert `listAudit({ entity_id: kjid })` retrieves the row with correct `from_status`/`to_status`.

---

### 3.6 · Rejected candidates (documented so we don't add them)

| Rejected | Reason |
| --- | --- |
| `listWorkerJobs(filter: { status?, worker_type?, since? })` | Too permissive · invites callers to build custom joins in application code · violates F12 AI4 (Brain runtime should not know Storage topology) · use the narrow methods |
| `getKnowledgeJob(kjid)` on BrainStore | Duplicates fs-store's existing `getJob`. KnowledgeJob is fs-store's boundary, not BrainStore's. |
| `findWorkerJobsByInputPayloadKey(key, value)` (Shape B from inspection doc) | Generic JSONB filter is a schema-change trap · every new key becomes a new index requirement · narrow methods with dedicated indexes are cheaper long-term |
| Batch mutation methods (bulk completeJob, bulk failJob) | Not needed by supervisor · would risk atomicity confusion with pgAtomicClaimIfQueued invariants |
| SQL-string escape hatch on BrainStore | Kills adapter portability · violates Provider-Agnostic doctrine |

---

## 4 · Types added to `src/lib/nex/brain/storage.ts`

Existing types kept unchanged. New types:

```ts
// New audit-write shape for KnowledgeJob transitions.
// Sits alongside existing AuditEntry shape used by insertAudit.
export interface KnowledgeJobTransitionAudit {
  knowledge_job_id: string;
  from_status: KnowledgeJobStatus;
  to_status: KnowledgeJobStatus;
  actor: string;
  reason?: string;
  correlation_id?: string;
  worker_job_id?: string;
  metadata?: Record<string, unknown>;
}
```

Note: `KnowledgeJobStatus` type must be imported from `src/lib/nex/jobs/fs-store.ts` OR re-declared in `storage.ts`. Recommended: **re-declare in storage.ts** to keep the BrainStore contract self-contained (fs-store is a Brain runtime, storage is the NEX Storage runtime — F12 AI4 forbids cross-import). Two independent enum declarations for the same conceptual set is acceptable — the contract test asserts they stay aligned.

---

## 5 · Schema changes (Postgres · Supabase)

Two new indexes required.

### 5.1 · Expression index for kjid lookup (§3.3)

```sql
-- Postgres 17 · applied to both local shadow and Supabase primary
CREATE INDEX CONCURRENTLY IF NOT EXISTS worker_jobs_input_payload_kjid_idx
  ON nex.worker_jobs ((input_payload->>'knowledge_job_id'))
  WHERE input_payload ? 'knowledge_job_id';
```

- Partial index (`WHERE` clause) keeps size proportional to knowledge-context rows only (~25% of the table based on Phase 1 counts)
- CONCURRENTLY avoids table lock on the running Supabase primary
- Migration file: `data/migrations/2026_08_XX_worker_jobs_kjid_expression_index.sql`

### 5.2 · Confirming FK/BTree index for input_ref lookup (§3.2)

Sample `\d worker_jobs` (deferred to Phase 5 verification) should already show `worker_jobs_input_ref_idx` because manager join-lookups rely on it. If missing:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS worker_jobs_input_ref_idx
  ON nex.worker_jobs (input_ref);
```

### 5.3 · Filesystem adapter has no schema

Filesystem adapter is a fallback for tests. It performs full-scan; no index required. Contract-test seed sizes stay small (< 100 rows) so full-scan is fine.

### 5.4 · Migration ordering + Version Independence

Per `constitution_nex_postgres_version_independence_2026_08_07.md`: the migration file is idempotent, uses CONCURRENTLY, and can be re-run on any supported Postgres major (17, 18). No PG-17-specific syntax. Verified on PG 17.5 locally in Phase 5.

---

## 6 · Adapter isolation (F12 AI2 · AI4)

All new method implementations follow the existing pattern:

- `src/lib/nex/brain/adapters/filesystem.ts` · new pure-JS implementations
- `src/lib/nex/brain/adapters/postgres.ts` · new SQL implementations · uses `pg` client already isolated to this file
- `src/lib/nex/brain/adapters/supabase.ts` · new supabase-js call implementations · uses `@supabase/supabase-js` client already isolated to this file

**Sacred rule preserved:** no application code outside `adapters/*.ts` will import `pg` or `@supabase/supabase-js` to use the new methods. All go through `storage.ts` selector.

Known-exception file list (unchanged from Wave 11 F12.b): `audit-log.ts` + `warehouse.ts` remain the only files outside `adapters/` allowed to import Supabase SDK. Neither will be modified in this cluster.

---

## 7 · Drift-catcher additions

`scripts/nex/f12-drift-check.mjs` (existing) must gain new assertions:

**Assertion CADP4a:** every method in the BrainStore interface must have an implementation in every adapter.
```
Regex sweep of BrainStore interface source → set of method names
For each adapter file → assert every method name appears
Fail if any adapter is missing a method
```
This is a generalization of the existing F12 checks and closes a class of drift where adding a contract method silently breaks one adapter.

**Assertion CADP4b:** no file outside `src/lib/nex/brain/adapters/` may import `@supabase/supabase-js` or the `pg` package (except the known-exception list). Already exists as CADP2 · extends to catch new adapters if they get added elsewhere.

**Assertion KJT1:** every call site that writes `KnowledgeJob.status` to a terminal value (`completed`, `failed`, `released`) must be preceded or followed by a call to `writeKnowledgeJobTransitionAudit` on the same code path.
```
Regex sweep of *.ts files for: updateJob\([^)]*status:\s*["'](completed|failed|released)["']
Then check the surrounding function body contains: writeKnowledgeJobTransitionAudit
Emit list of unmatched sites for manual review
```
This is a HEURISTIC drift-catcher · false positives require inline `// drift-exempt: <reason>` comments. Manual review at first run to seed exemptions.

---

## 8 · Contract test additions

`tests/nex/brain-storage-contract.test.mjs` (existing pattern) gains one test per new method:

1. **getWorkerJob**: seed, fetch, assert equal; fetch missing id, assert null.
2. **listWorkerJobsByInputRef**: seed 3 jobs with 2 distinct input_refs; assert filter returns matching subset; empty input_refs returns `[]`; limit truncates.
3. **findWorkerJobsByKnowledgeJobId**: seed 2 knowledge-context jobs with matching kjid and 1 without; assert filter returns 2; assert result excludes the negative.
4. **listWorkerResultsByJobIds**: seed 2 jobs + 2 results linked by job_id; assert filter returns 2; empty input returns `[]`.
5. **writeKnowledgeJobTransitionAudit**: write transition; `listAudit({ entity_id: kjid })` returns the row with correct fields.

**Cross-adapter run matrix:** test suite executes against filesystem adapter always; against postgres and supabase adapters when the respective env vars are set. This matches the existing pattern.

---

## 9 · Consumer changes anticipated (Phase 6+ · not in Phase 2)

Only two callers of the new methods should exist in Phase 6:

**W-C-COMPANION supervisor (Phase 6):**
1. Read stuck KJs from fs-store: `fs-store.listJobs({status: "claimed"})` (existing)
2. For each stuck KJ, resolve inbox_item_id from fs-store record (existing field)
3. `BrainStore.listWorkerJobsByInputRef([...inbox_ids])` (NEW)
4. `BrainStore.listWorkerResultsByJobIds([...extractor_job_ids])` (NEW)
5. If terminal condition met (extractor completed + record_draft output present), transition KJ:
   - `fs-store.updateJob(kjid, {status: "completed", ...})` (existing)
   - `BrainStore.writeKnowledgeJobTransitionAudit({from: "claimed", to: "completed", actor: "supervisor:companion", reason: "supervisor-detected-orphan"})` (NEW)

**Every existing terminal-write site in workers (Phase 5 retrofit):**
- `knowledge-extractor.ts` terminal writes at fs-store `updateJob({status: completed|failed})` gain a paired `writeKnowledgeJobTransitionAudit` call
- Same for any other worker that terminally transitions a KnowledgeJob (audit script identifies sites)

No other consumers · no CRUD leakage into application code.

---

## 10 · Non-goals for this cluster

Explicit list of things Phase 2 does NOT add · to prevent scope creep:

- ❌ No KnowledgeJob lease mechanism (that's a separate W-C-COMPANION concern for Phase 6)
- ❌ No manager re-dispatch throttling (behavior is correct given stuck-KJ input)
- ❌ No pipeline restructure (kjid propagation into extractor payload is Phase 5-optional)
- ❌ No index-management UI (Storage Mission Control tab may follow later)
- ❌ No batch mutation methods
- ❌ No SQL escape hatch
- ❌ No changes to the 10 stuck KnowledgeJobs (preserved as fixtures)

---

## 11 · Sequencing to Phase 5

Phase 5 implementation order:

1. Add types to `src/lib/nex/brain/storage.ts` (interface change) · compilation-red state
2. Implement filesystem adapter · compile-green
3. Add contract test skeleton · filesystem passes
4. Implement postgres adapter + expression-index migration + apply to local PG 17 shadow
5. Implement supabase adapter + apply expression-index migration to Supabase primary via SQL editor OR CLI
6. Add drift-catcher assertions CADP4a, KJT1
7. Retrofit existing terminal-write sites with `writeKnowledgeJobTransitionAudit` calls
8. Run full test matrix · fix regressions
9. Commit + push behind explicit Philip authorization at Phase 5 gate

**Estimated LOC:** ~350-450 across storage.ts + 3 adapters + 5 contract tests + 1 migration + drift-catcher additions. Not massive; not trivial. All reversible via git if a call goes wrong.

---

## 12 · Risk register for Phase 5

| Risk | Mitigation |
| --- | --- |
| Supabase index creation blocks the running writer stream | Use `CONCURRENTLY` · verify with `\di+` on local first · time the Supabase apply for a low-traffic window |
| KnowledgeJobStatus type drift between fs-store and storage.ts | Contract test asserts identical enum values · CI fails on divergence |
| KJT1 drift-catcher fires false positives on refactored sites | Reviewable list on first run · inline exemptions with reason strings |
| New methods cause N+1 in supervisor loop | Batch signatures on `listWorkerJobsByInputRef` and `listWorkerResultsByJobIds` explicitly prevent N+1 by design |
| Filesystem adapter full-scan degrades in tests with large seeds | Cap contract-test seed sizes at 100 rows |
| Migration ordering collides with parallel Wave 11 F17 shadow-writer changes | Sequence migration filename by date · no shared table locks |

---

## 13 · What Phase 2 does NOT authorize

- Phase 5 implementation (separate authorization at that gate)
- Any adapter file edit
- Any storage.ts interface edit
- Any migration file creation
- Any drift-catcher script edit
- Any commit / push

This is design-only. Phase 3 (W-C-COMPANION supervisor design correction) may reference this document · Phase 5 executes it.

---

**Phase 2 status: COMPLETE. Proceeding to Phase 3 · W-C-COMPANION supervisor design correction against real forensic evidence.**
