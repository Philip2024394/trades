# W-OBS-1 · Correlation-ID Threading · Design Decision Record

**Programme:** Headquarters Production Readiness · World-class ops gap remediation
**Finding:** W-OBS-1 · Correlation IDs missing on Brain worker chain + HTTP edge
**Verified state:** `WORLD-CLASS-OPS-P0-VERIFICATION.md` (2026-08-11)
**Authorization:** Philip 2026-08-11 · *"Design-only: produce the W-OBS-1 correlation-ID threading decision record. No code changes. No migrations. No middleware changes. No worker refactor."*
**Not-a-goal:** Choose a path · implement anything · commit anything. This doc is decision-support, not a decision.

## Verified starting state (from P0 verification report)

- **Populated in:** `src/lib/nex/journeys/entry.ts` + all 5 journey triggers · `src/lib/nex/attribution/engine.ts` · `src/lib/nex/attribution/types.ts` · `src/lib/nex/api/error-envelope.ts`
- **NOT populated in:** all 9 Brain worker files (`_finalize`, `image-analyst`, `knowledge-context`, `knowledge-extractor`, `learning-context`, `llm-retry`, `memory-guardian`, `quality-checker`, `voice-context`)
- **Not generated at edge:** `src/middleware.ts` is host-routing only · no `x-request-id` generation · no proxy header trust
- **De-facto worker identity:** `job_id` (Wave 11 F35 · threaded via `finalizeWorkerJob`)
- **De-facto edge identity:** none · client sees only response body
- **Storage:** `signals.ts` supports the field · `nex.events.correlation_id` column presumed present (needs runtime verify) · no `AsyncLocalStorage` anywhere in the tree

## The three viable paths

Terminology used consistently below:
- **CID** = the correlation identifier value (opaque string · typically UUID or path-encoded)
- **edge** = Next.js middleware / API route handler
- **worker** = one of the 9 Brain worker functions
- **audit** = a row landing in `nex.events` · `nex.audit_log` · `nex.worker_audit_events`

### Path A · Edge-middleware generation + AsyncLocalStorage propagation

**How it works:**
1. `src/middleware.ts` gets a `x-request-id` block: generate a UUID for every request (or trust an inbound header if within same-org proxy allowlist)
2. Store CID in Node.js `AsyncLocalStorage` context established at the route boundary
3. `emitSignal` reads from ALS by default · optional explicit override retained
4. Worker log helper reads from ALS
5. Audit inserts read from ALS
6. Inbox enqueue writes CID into `KnowledgeJob.correlation_id` column so the async worker chain (which is disconnected from the originating request) can inherit it later

**Requires:** middleware edit · ALS setup wrapper · logger wrapper · optional Job-schema column for async continuity

### Path B · Job-column propagation

**How it works:**
1. Add `correlation_id TEXT` column to `nex.knowledge_dump_jobs` and `nex.jobs`
2. Every enqueue accepts `correlation_id` parameter · populates from caller-context if available · else generates fresh
3. Workers read from job row · thread through `finalizeWorkerJob` chain
4. Audit rows written by workers include the CID from the job
5. HTTP-side callers OPTIONALLY provide CID when calling enqueue

**Requires:** two column migrations · enqueue-signature change · worker read propagation · no middleware · no ALS

### Path C · Adopt existing `job_id` as canonical correlation

**How it works:**
1. Documentation-only redefinition: "in Brain workers, `job_id` IS the correlation identifier"
2. Update `signals.ts` docs to say `correlation_id` and `job_id` are interchangeable for Brain worker paths
3. Storage adapter continues to write `job_id` where it already does · no schema change
4. HTTP edge → inbox → job → worker chain still LOSES upstream CID (the gap that motivated this finding stays open for the edge → inbox boundary)

**Requires:** documentation only · no code · no migration · does NOT close the edge-to-inbox gap

## 10-dimension comparison matrix

| # | Dimension | Path A · Edge + ALS | Path B · Job-column | Path C · `job_id` rename |
|---|---|---|---|---|
| 1 | **Existing request identity** | NONE at edge today · Path A ADDS it (net new capability) | NONE at edge today · Path B doesn't add unless HTTP callers explicitly generate + pass CID (edge gap not closed automatically) | NONE at edge today · Path C explicitly leaves this open |
| 2 | **Existing worker identity** | Preserved · `job_id` continues · CID inherited additively | Preserved · `job_id` continues · CID additive via new column | `job_id` REBRANDED as CID · no dual identity |
| 3 | **Existing audit identity** | Preserved · audit rows already have `job_id` · CID adds a second field | Preserved · same shape · CID adds a second field | No change to audit rows · rename is doc-only |
| 4 | **Retry/requeue behavior** | Retry inherits ALS context IF the retry runs in the same async chain · reads from Job column IF the retry crosses a queue boundary (Path A implies dual mechanism) | Retry inherits CID from Job column · single mechanism · deterministic | Retry uses `job_id` · already deterministic · no behavior change |
| 5 | **Parent/child worker relationships** | Parent worker's ALS scope propagates to children spawned in the same async tree · cross-worker chains (parent enqueues child job) require Path B-like Job-column fallback | Parent enqueues child with parent's CID as the child's CID · single mechanism · clean parent-child trace | Parent's `job_id` != child's `job_id` · so parent-child correlation requires a separate lineage field (this problem exists TODAY) |
| 6 | **Idempotency / deduplication** | Idempotency keyed on Job's stable identity (`job_id` or `record_id`) · CID is additive · no dedup impact | Same · CID is additive · no dedup impact | Same · no change · idempotency continues to key on `job_id` |
| 7 | **Backward compatibility** | Adds a nullable column · no breaking change · legacy audit readers unaffected · legacy callers see NULL until they populate | Adds a nullable column · no breaking change · legacy audit readers unaffected · legacy callers see NULL until they populate | Zero code change · 100% backward compatible · only documentation changes semantics |
| 8 | **Database schema impact** | Optional column on `nex.knowledge_dump_jobs` + `nex.jobs` if using the async-continuity fallback · plus `nex.events.correlation_id` should be verified/added | Required column on `nex.knowledge_dump_jobs` + `nex.jobs` · confirm `nex.events.correlation_id` exists or add | Zero schema impact |
| 9 | **HTTP edge coverage** | **FULL** · every request gets a CID whether it hits a synchronous route, triggers a journey, or enqueues an inbox item | **PARTIAL** · only routes that explicitly generate + pass CID to enqueue benefit · other routes (esp. legacy) continue without | **NONE** · edge is not addressed |
| 10 | **Operational querying / forensics** | **STRONGEST** · one CID joins client error → journey → attribution → inbox → worker → audit · single SQL predicate `WHERE correlation_id = X` across all tables | **STRONG for pipeline** · one CID joins inbox → worker → audit · edge join requires the HTTP caller to also populate a compatible identity into their subsystem (extra manual step) | **WEAKEST across the edge boundary** · Brain-worker-chain forensics is fine (via `job_id`) · edge-to-worker join impossible without an external lookup table (still ends in "which inbox item?") |

## Cross-cutting considerations

### C-1 · Interaction with existing populated subsystems

Journeys / attribution / error-envelope already thread CID under their own conventions. Path A wraps around them: if their code sets an explicit CID, ALS respects the explicit override. Path B doesn't interact with them at all (they don't use jobs). Path C is journey/attribution-agnostic (only touches Brain workers).

### C-2 · Impact on Wave 11 F35 `finalizeWorkerJob`

- Path A: additive · `finalizeWorkerJob` gets a helper to read CID from ALS · no signature change required
- Path B: `finalizeWorkerJob` gets a new `correlation_id` field on `WorkerJob` type · minor signature change · well-scoped
- Path C: no change · `finalizeWorkerJob` continues untouched

### C-3 · Impact on Wave 11 F12 `adapter-isolation.test.mjs`

None of the paths affect AI1-AI8. Path A adds middleware code (unaffected). Path B adds a column via migration (unaffected). Path C is doc-only.

### C-4 · Test surface

- Path A · new test: fire request with `x-request-id: TEST-123` · walk pipeline · assert TEST-123 appears in ≥3 audit rows across worker chain
- Path B · new test: enqueue job with `correlation_id: TEST-456` · worker processes · assert TEST-456 lands in every audit row for that job
- Path C · new test: none (doc-only) · but existing tests should be updated to assert `job_id` == correlation identifier in relevant contracts

### C-5 · Effect on the master-audit's HEADQUARTERS-PRODUCTION-READINESS section 12 (unaudited gaps)

Path A most fully closes the "cross-subsystem forensics impossible" gap. Path B closes it for the pipeline · leaves the edge → subsystem hop uncovered. Path C explicitly does not close it and is best framed as a stopgap.

### C-6 · Interaction with distributed tracing (W-REL-9)

If OTel is adopted later, the CID must map cleanly to OTel's `trace_id`. Path A is the closest fit — OTel middleware generates the trace_id at the edge and propagates via context (the ALS analog). Path B integrates with OTel via a "trace context in job payload" pattern (well-supported but requires convention). Path C incompatible (a single `job_id` can't be the trace_id when a trace crosses multiple jobs).

### C-7 · Cost / risk shape

| Aspect | Path A | Path B | Path C |
|---|---|---|---|
| Implementation surface | Middleware + ALS wrapper + logger + optional Job column | Two column migrations + enqueue-signature change + worker propagation | Zero |
| Risk of unexpected regression | Low (additive · but ALS has known edge cases around framework internals — Next.js edge runtime vs Node.js runtime differ) | Low (single column · well-understood pattern) | Zero |
| Effort estimate (relative) | Medium | Small | Trivial (docs only) |
| Long-term value | High (full end-to-end trace · OTel-ready) | Medium (pipeline covered · edge gap remains) | Low (mostly rebrand · gap not closed) |

## What this analysis does NOT do

- **Does not recommend a path.** All three are viable within different scope choices. The decision belongs to Philip.
- **Does not size effort in wall-clock time.** Relative sizing only.
- **Does not authorize implementation.** Any path chosen requires a separate implementation authorization following the same discipline as F12 and Step 11 (targeted test PASS → integration regression PASS → evidence recorded → VERIFIED CLOSED).
- **Does not verify runtime state of `nex.events.correlation_id` column.** Every schema-impact claim above assumes the current migration state · runtime verification (`\d nex.events`) required before any Path A or B implementation.

## Suggested decision-question wording (for Philip)

If a decision is being made now, the key question is:

> **How important is the HTTP edge → inbox boundary for cross-subsystem incident forensics?**

- **Critical → Path A** (only path that closes the edge → inbox gap automatically)
- **Nice-to-have but not blocking → Path B** (closes pipeline · leaves edge gap for later)
- **Deferrable indefinitely → Path C** (documentation only · gap explicitly stays)

## Boundaries preserved

- **No implementation.** Zero code · zero migrations · zero middleware changes · zero worker refactor.
- **No commit.** Doc sits uncommitted at `docs/headquarters-production-readiness/WORLD-CLASS-OPS-W-OBS-1-DECISION-RECORD.md`.
- **No decision made.** Path selection is Philip's next step · analysis is complete but consultative only.
- **F12 = READY · Step 11 = READY · F12.b = OPEN · gap register updated with P0 corrections** · all boundaries intact.

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-08-11 | Decision record authored · 3 paths × 10 dimensions + 7 cross-cutting considerations · no recommendation issued · no implementation authorized | Claude (design-only per Philip authorization) |
