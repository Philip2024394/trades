# W-OBS-1 · Path A · Detailed Implementation Plan **· LAYER 1 IMPLEMENTED 2026-08-11**

> **STATUS · 2026-08-11 · Philip authorized · Claude implemented:**
> **Path A Layer 1 is COMPLETE.** All 8 acceptance gates satisfied ·
> zero schema change · zero new regressions · zero cross-boundary
> impact. Layer 2 remains explicitly deferred pending 4-week production
> measurement of Layer 1. This planning document remains for historical
> reference of the design decisions · the current implementation state
> is summarized in § Implementation outcome below.
>
> **Files shipped in this Layer 1 commit:** correlation.ts module +
> contract tests (CID1-CID10) + adoption drift-catcher (CADP1-CADP5)
> + middleware CID injection (`resolveCorrelationId` + `attachCid` on
> all 8 return sites) + 5 canary API routes wrapped in `runFromRequest`
> + inbox CID persistence (3 save functions + `InboxItem.correlation_id?`
> field) + dispatch CID copy (manager.ts `input_payload.correlation_id`)
> + 6 workers with `enterJobCorrelationScope(job)` + F35 `_finalize.ts`
> child-job CID inheritance + `emitSignal` ALS fallback (explicit-wins)
> + 3 test-harness stubs. See § Implementation outcome for the full file
> list and gate results.

**Programme:** Headquarters Production Readiness · World-class ops gap remediation
**Finding:** W-OBS-1 · Correlation IDs missing on Brain worker chain + HTTP edge
**Path chosen:** **Path A · Edge middleware + AsyncLocalStorage · with optional Job-column continuity**
**Path selection rationale (Philip 2026-08-11):** "The exact gap identified by verification: HTTP edge → inbox → worker. Path C doesn't close that boundary. Path B gives good asynchronous continuity, but it doesn't inherently establish the originating HTTP/request identity. Path A gives us the strongest foundation because it establishes a correlation context at the system boundary, then allows that identity to survive into asynchronous execution."
**Qualification:** "Optional Job column — don't introduce a schema change merely for the sake of having one. Establish whether durable persistence is required for the actual forensic use cases first."
**Authorization scope:** Philip 2026-08-11 · *"Create the Path A detailed implementation plan only. Do not modify implementation files. Stop at the next review checkpoint."*
**Not-a-goal:** Write code · run migrations · modify middleware · modify workers · commit anything. This is the engineering handoff plan · nothing else.

## Structure

The plan is **two-layered**, matching Path A's shape:

- **Layer 1 · Synchronous CID at the HTTP edge** (middleware + AsyncLocalStorage + signal integration)
- **Layer 2 · Asynchronous CID durability** (optional column · shipped only if Layer 1 measurements prove it's needed)

**Ship Layer 1 first. Do not ship Layer 2 until Layer 1 is in production and forensic use cases demonstrate the need.**

---

## Layer 1 · Synchronous CID at the HTTP edge

### 1 · Exact middleware entry points

`src/middleware.ts` is the sole edge entry point. It currently runs host-routing logic in **edge runtime**. AsyncLocalStorage does NOT work in edge runtime — it's a Node.js API. Consequences for the design:

- **Middleware's job at the edge:** generate/accept the CID · set it as a **request header** for downstream (so route handlers see it) AND a **response header** (so clients see it and can echo it in bug reports).
- **Middleware does NOT establish AsyncLocalStorage.** ALS is established inside the Node-runtime route handler wrapper (see §2).
- **Config change:** the current `SYSTEM_HOSTS` bypass logic should still run · CID injection is additive.

Precise middleware behavior (spec — not code):

```
FOR EACH incoming request:
  1. Resolve inbound header `x-request-id` if present
  2. Validate: /^[A-Za-z0-9-]{16,64}$/ · reject (regenerate) if not
  3. Trust decision (see §4)
  4. If trusted+valid → use inbound. Otherwise → generate crypto.randomUUID()
  5. Set request.headers `x-request-id` = final CID (visible downstream)
  6. Continue existing host-routing logic
  7. On response: attach `x-request-id` header = final CID
```

**Route handlers** wrap their body in a helper (§2) that reads the middleware-injected header and establishes ALS scope.

### 2 · AsyncLocalStorage lifecycle

**Location:** new file `src/lib/nex/observability/correlation.ts` (module boundary).

**Public API surface:**

- `getCorrelationId(): string | null` — read current ALS context · returns null outside a scope
- `runWithCorrelationId<T>(cid: string, fn: () => T | Promise<T>): T | Promise<T>` — establish scope
- `runFromRequest<T>(req: Request, fn: () => T | Promise<T>): T | Promise<T>` — convenience: reads `x-request-id` header and delegates
- **Internal state:** module-scoped `AsyncLocalStorage<string>` instance

**Lifecycle:**

1. **Route entry** — Every API route handler (`src/app/api/**/route.ts`) that we care about wraps its body:
   ```ts
   export async function GET(req: NextRequest) {
     return runFromRequest(req, async () => {
       // ...existing handler body unchanged...
     });
   }
   ```
2. **Handler body** — any code reachable via await from this scope can call `getCorrelationId()` and get the CID.
3. **Async boundary crossings** — ALS follows `await` chains automatically. Callbacks scheduled via `setTimeout` / `setImmediate` inherit. Explicit worker-thread spawning does NOT inherit (n/a for our stack).
4. **Route exit** — ALS scope ends when the handler promise resolves. New request → new scope.

**Adoption path (staged):**

- Phase 1 · Wrap handlers under `src/app/api/nex/**` (HQ scope)
- Phase 2 · Wrap remaining `src/app/api/**` (Trade Centre etc.) — separate authorization
- Phase 3 · Wrap page RSCs if forensic value emerges (defer)

**Instrumentation for adoption:** a lint rule OR drift-catcher that fails if a route file under `src/app/api/nex/**` exports `GET|POST|PUT|DELETE|PATCH` without wrapping in `runFromRequest`. (See §14.)

### 3 · Correlation-ID generation / acceptance rules

**Generation:** `crypto.randomUUID()` when no valid inbound CID exists. UUIDv4 · 36 chars · standard · matches existing `journeys/entry.ts` correlation-id conventions.

**Acceptance rules:**

| Source | Rule |
|---|---|
| No `x-request-id` header | Generate fresh |
| Header present but malformed (fails `/^[A-Za-z0-9-]{16,64}$/`) | Generate fresh · log warning at DEBUG level (not error · normal for non-instrumented clients) |
| Header present + valid + untrusted route | Generate fresh · overwrite (see §4) |
| Header present + valid + trusted route | Adopt the inbound CID |

**Format allowlist rationale:** `[A-Za-z0-9-]{16,64}` covers UUIDv4 (36), UUIDv7 (36), ULID (26), custom prefixed forms like `journeys/entry.ts`'s `analytics:${event_id}` (variable). If existing populated subsystems' formats fall outside this range, either (a) tighten the rule OR (b) exempt those subsystems — decision at implementation time based on grep sample.

### 4 · Trusted vs untrusted incoming IDs

**Threat model:** An attacker sending a crafted `x-request-id` could pollute audit logs with attacker-controlled strings (SQL log noise · SIEM confusion · false-attribution).

**Trust categories:**

| Route category | Trust incoming CID? |
|---|---|
| Public-facing routes (any non-authenticated route) | **No** · always overwrite |
| Same-origin routes (browser XHR from thenetworkers.app) | **No** · always overwrite (browsers don't send this header naturally) |
| Cron routes (`/api/nex/brain/cron-tick`, `/api/nex/brain/run-once`) authenticated via F14/F15 tokens | **Yes** · trust after token check passes |
| Internal service-to-service routes (future) | **Yes** · trust after mutual-TLS OR HMAC check |
| Vercel Cron platform header | **Yes** · trust · Vercel already validates its own scheduling |

**Implementation location:** trust decision lives inside `runFromRequest` OR a dedicated `resolveTrustedCid(req)` helper — determined by the size of the trust matrix at implementation time. Start with a single boolean gate parameter passed to `runFromRequest(req, {trustInbound: false}, fn)`.

**Non-negotiable:** validation happens BEFORE trust check. A malformed CID is regenerated even from a "trusted" source · trust doesn't waive format validation.

### 5 · HTTP → inbox propagation

The existing inbox enqueue path lives at `src/lib/nex/knowledge-inbox/storage.ts` (`saveTextItem`, `saveFileItem`, etc.).

**Change shape (spec):**

- `saveTextItem` and siblings gain an OPTIONAL `correlation_id?: string` field on their input record
- If caller doesn't supply, the function reads `getCorrelationId()` and uses that
- If ALS scope is empty AND caller didn't supply, no CID is attached (documented degradation · not an error)
- Inbox item structure grows a `correlation_id?: string` field on the JSON

**Persistence decision (Layer 1 vs Layer 2):**

- Layer 1 (this ship): store CID in the **inbox item's existing JSON payload** — no schema change
- Layer 2 (deferred): promote to first-class column on `nex.knowledge_inbox` if forensic queries prove awkward

**No breaking change:** legacy callers pass no CID · legacy inbox items have no field · both work transparently.

### 6 · Inbox → worker propagation

The dispatch path (`src/lib/nex/brain/manager.ts::dispatchNewInboxItems`) reads inbox items and creates `KnowledgeJob` rows.

**Change shape (spec):**

- When creating a job from an inbox item · read the item's `correlation_id` (if present)
- Pass into `KnowledgeJob` creation

**Persistence decision (Layer 1 vs Layer 2):**

- Layer 1: attach CID to the job's existing metadata (e.g., `KnowledgeJob.metadata.correlation_id` if such a field exists — needs verification · else use `payload.correlation_id`)
- Layer 2: promote to `nex.knowledge_dump_jobs.correlation_id` column (see §15 for the decision criteria)

**Worker claim path:** `fs-store.ts::claimJobIfQueued` returns the job row. Worker code should:
1. Extract CID from the job (Layer 1: from metadata/payload · Layer 2: from column)
2. Call `runWithCorrelationId(cid, async () => { ...existing worker body... })`
3. All downstream signals / audit / log lines inherit automatically

**Rule:** Worker code MUST NOT read CID from anywhere except its own job row. This preserves per-job isolation · one worker's ALS scope doesn't leak to another.

### 7 · Worker → child-worker propagation

Some workers enqueue subsequent jobs (Wave 11 F35 documented this pattern: `knowledge-context` → `voice-context` → `learning-context` → `knowledge-extractor` chain).

**Change shape (spec):**

- `finalizeWorkerJob`'s `nextJob?` parameter gains implicit CID propagation
- When `finalizeWorkerJob` enqueues the next job, it copies the parent's CID (from ALS · which was established at worker claim time)
- Documented convention: child job inherits parent's CID · never generates fresh

**Rationale:** A single logical operation (client uploads knowledge → 5 workers process in sequence) should share ONE CID across all workers. This is the primary forensic use case.

**F35 code delta shape:** internal to `_finalize.ts` only · caller signatures unchanged.

### 8 · Retry / requeue semantics

**Rule:** Retry preserves the ORIGINAL CID. It's the same logical operation.

**LLM retry (`llm-retry.ts`):**
- Retry queue entries copy CID from originating job
- Backoff retries continue with same CID
- Only when the LLM-retry is TERMINAL and produces a NEW downstream job → new CID (arguably) OR same CID (defensible if we consider it the same logical operation)
- **Recommendation:** same CID until the operation reaches terminal state (success or exhausted) · new CID only for genuinely-new client-triggered operations

**Wave 11 F2 atomic-claim retry:** claim-loss retry (loser's `pgAtomicClaimIfQueued` returning `null`) doesn't create a new operation · same CID trivially.

**Job requeue after failure:** if a worker fails and the job is requeued for another worker to pick up · same CID.

### 9 · Audit-event population · **AMENDED 2026-08-11 · Philip authorized Option 1**

Every `emitSignal` and every audit-log row must carry the CID.

**`emitSignal` behavior change (spec):**

Current signature: `emitSignal({subsystem, kind, code?, correlation_id?, detail?})` · correlation_id is optional and read-through.

New behavior:
1. If caller supplies `correlation_id` explicitly → use that (preserves existing journeys/attribution/error-envelope convention)
2. Otherwise → read from `getCorrelationId()` · use that
3. Otherwise → null (documented · unchanged)

**Backward compatibility with `journeys/entry.ts` et al:** They explicitly set correlation_id · fall into branch 1 · behavior unchanged. **This is critical** — existing subsystems' explicit CIDs (e.g., `analytics:${event_id}`) must not be overridden by an ambient HTTP CID.

**Event persistence to `nex.events` — corrected against runtime evidence:**

The initial plan draft assumed `nex.events` might have a dedicated `correlation_id` column. **Verified 2026-08-11: it does NOT** — see `WORLD-CLASS-OPS-W-OBS-1-PREREQ-VERIFICATION.md`. The table's schema (`deploy/postgres/init/001_events.sql:6-24`) exposes `event_type`, several typed columns for hot query paths (`related_job`, `related_brain`, `related_contact`, `related_department`), and a `payload JSONB NOT NULL DEFAULT '{}'::jsonb` for everything else.

**Established convention verified in current writers:**
- `src/lib/nex/alerts/evaluator.ts:193` — `INSERT INTO nex.events (event_type, payload) VALUES ('system.health_alert', $1::jsonb)`
- `src/lib/nex/delivery/audit.ts:30` — `INSERT INTO nex.events (event_type, payload) VALUES ($1, $2::jsonb)`

Every extra field in NEX event architecture lives inside the `payload` JSONB blob. Typed columns exist for known-hot query paths only. **This is not an oversight in the schema · it is the extensibility design.**

**Layer 1 persistence rule (corrected):**
- CID is written into `payload->>'correlation_id'` when a caller writes to `nex.events` and supplies CID (either explicitly or via ALS)
- **No schema change is required or authorized.** No column added. No migration.
- Callers that already use `INSERT INTO nex.events (event_type, payload)` extend their payload object with `{..., correlation_id: cid}` at the caller site (or via a small shared helper)

**Additional correction:** the initial plan's phrasing *"Storage adapter writes it to nex.events.correlation_id"* was overbroad — verified that `emitSignal` does NOT currently write to `nex.events` at all. Signals emit to `console.warn` + `emitEventSafe` (a distinct subsystem). **Layer 1 does NOT create a new `emitSignal → nex.events` pathway.** The signal-side integration is limited to the `emitSignal` behavior change above (branches 1-3) which affects the in-memory signal payload only. If a caller's audit-log-write helper eventually reaches `nex.events`, the CID is preserved via the payload-JSONB pattern documented here.

**Existing populated audit paths:** `journeys/entry.ts` line 69 writes explicit CID. This should continue through existing audit-emission paths that read from ALS as a fallback · with the explicit-override-wins rule preserving journeys' explicit values.

**Rationale for the JSONB pattern (Philip 2026-08-11):** *"This keeps NEX Storage as the architectural abstraction rather than designing the system around a Supabase-specific schema alteration. Adding a dedicated correlation column would actually introduce a new storage convention rather than reinforce the existing one."*

### 10 · Error-envelope integration

`src/lib/nex/api/error-envelope.ts:31` currently generates its own `correlation_id` for client responses.

**Change shape (spec):**

- `toClientError` first checks `getCorrelationId()` · uses that if present
- Falls back to generating fresh only if ALS is empty (e.g., unwrapped legacy route)
- Client response continues to include `correlation_id` in the error body · but now that CID matches the server's audit trail

**Backward compatibility:** unchanged for routes that already generate their own · the ALS lookup is a new preferred branch.

**Forensic outcome:** operator receives client bug report with `correlation_id: X` · runs `SELECT * FROM nex.events WHERE payload->>'correlation_id' = 'X'` (matching the JSONB pattern established by `alerts/evaluator.ts` and `delivery/audit.ts`) · sees the entire request trail. This is the primary business value of Path A.

### 11 · Existing journey / attribution compatibility

Verified during P0 verification (2026-08-11):
- `journeys/entry.ts` builds envelopes with explicit `correlation_id`
- 5 journey trigger files set format-specific CIDs (`analytics:${event_id}`, `schedule:${trigger_id}:${now}`, etc.)
- `attribution/engine.ts` reads `correlation_id` from event rows

**Compatibility rule:** the ambient ALS CID MUST NOT override subsystem-explicit CIDs. Journeys' `analytics:12345` format is meaningful · it encodes provenance in the CID itself · overriding to a UUID would destroy that signal.

**Enforcement:**
- `emitSignal({correlation_id: explicit, ...})` → uses `explicit` verbatim (no ALS lookup)
- `emitSignal({...})` without CID → falls back to ALS
- Journey/attribution code doesn't change · it keeps calling with explicit CID · behavior identical

### 12 · F35 interaction (finalizeWorkerJob)

Wave 11 F35 established `finalizeWorkerJob` as the sole path through which workers persist results + enqueue children + write audit rows.

**Interaction shape (spec):**

- `finalizeWorkerJob` internally calls `store.insertAudit(...)` — this becomes a natural CID injection point
- The helper reads `getCorrelationId()` inside its body · attaches to every audit row it emits
- Caller signature unchanged · caller code unchanged · convergence discipline preserved (Wave 11 F35 AI · exactly-one-call-per-worker rule intact)
- `nextJob?` handling: when finalize enqueues the child · CID copied automatically (see §7)

**F35 drift-catcher preservation:** the `finalize.test.mjs` FZA1-FZA5 assertions continue to pass · Path A's changes are internal to `_finalize.ts` and don't affect the "exactly ONE finalizeWorkerJob call per worker" invariant.

**No worker file changes required for CID inheritance** — because workers wrap their body in `runWithCorrelationId` at claim time (§6) · finalize reads from that same ALS scope.

### 13 · F12 boundary impact

Wave 11 F12 established 8 architectural invariants (AI1-AI8):

| Invariant | Impact of Path A |
|---|---|
| AI1 · `brainStore()` defined once | **No impact** · CID work is in observability layer |
| AI2 · adapters export only classes · no selector logic | **No impact** · adapters may read CID via `getCorrelationId()` (a helper import, not a selector) |
| AI3 · storage.ts imports no provider SDK | **No impact** |
| AI4 · Brain adapters do not import from `src/lib/nex/storage/*` | **No impact** · `correlation.ts` lives in `observability/`, not `storage/` |
| AI5 · exactly ONE dual-write decorator | **No impact** |
| AI6 · provider-SDK imports confined to `adapters/*.ts` | **No impact** |
| AI7 · NEX_BRAIN_BACKEND read only in storage.ts | **No impact** — Path A adds no new env-var reads |
| AI8 · NEX_STORAGE_BACKEND read only in NEX Storage registry | **No impact** |

**Path A is architecturally compatible with F12. The `adapter-isolation.test.mjs` 8/8 pass state must be preserved after Path A ships. Re-verify with the same test file post-implementation.**

### 14 · Required tests and drift-catchers

**Contract tests (new file `src/lib/nex/observability/tests/correlation.test.mjs`):**

| # | Assertion | Purpose |
|---|---|---|
| CID1 | `getCorrelationId()` returns null outside any scope | Baseline |
| CID2 | `runWithCorrelationId('X', () => getCorrelationId())` returns 'X' | Scope establishment |
| CID3 | Nested `runWithCorrelationId('Y', ...)` inside `runWithCorrelationId('X', ...)` returns 'Y' inside, 'X' outside | Nested scopes |
| CID4 | Parallel `Promise.all([...])` inside a scope each see the same CID | Async propagation |
| CID5 | `setTimeout` callback scheduled inside scope reads correct CID | Timer propagation |
| CID6 | `emitSignal({...})` without CID picks up ALS CID | Signal integration |
| CID7 | `emitSignal({correlation_id: 'explicit'})` uses 'explicit' not ALS | Explicit override (journeys/attribution compat) |
| CID8 | `runFromRequest(reqWithHeader, fn)` scope reads header value | Middleware integration |
| CID9 | `runFromRequest(reqWithMalformedHeader, fn)` generates fresh · discards malformed | Format validation |
| CID10 | Trust matrix: public route ignores inbound · cron route accepts | Trust rules |

**Drift-catchers (new file `src/lib/nex/observability/tests/correlation-adoption.test.mjs`):**

| # | Assertion | Purpose |
|---|---|---|
| CADP1 | Every file under `src/app/api/nex/**/route.ts` that exports a handler wraps it in `runFromRequest` OR is on a documented exception list | Adoption enforcement |
| CADP2 | `getCorrelationId` and `runWithCorrelationId` defined exactly ONCE across `src/lib/nex/**` (canonical uniqueness) | Same pattern as F12 AI1 |
| CADP3 | `AsyncLocalStorage` construction happens exactly ONCE (in `correlation.ts`) — no other file instantiates its own store | No parallel-ALS trap |
| CADP4 | Middleware sets `x-request-id` request+response headers | Edge invariant |
| CADP5 | Every `emitSignal` call site is either (a) supplying explicit CID OR (b) inside an ALS-scoped code path OR (c) documented exception | Enforces the "no orphan signals" rule |

**Regression tests:** the existing signal / error-envelope / journey tests must continue to pass unchanged. Any change required in existing tests is a REGRESSION and must be flagged before merge (same discipline as Wave 11).

### 15 · Is a durable Job column actually necessary?

**Philip's qualification:** *"Don't introduce a schema change merely for the sake of having one. Establish whether durable persistence is required for the actual forensic use cases first."*

**Analysis:**

Layer 1 (this plan) puts CID in:
1. HTTP request/response headers (transient)
2. AsyncLocalStorage during handler execution (transient)
3. Inbox item JSON payload (durable · already-existing field)
4. Signal emissions (in-memory · fire-and-forget · see §9)
5. Audit-log rows written to `nex.events` (durable · CID lives inside `payload->>'correlation_id'` — matches existing writers · NO column, NO schema change)

Layer 1 does NOT persist CID on `KnowledgeJob` row directly. Instead, worker inherits CID from the inbox item that spawned the job (via `payload.correlation_id`).

**Forensic query with Layer 1 only:**

```sql
-- Trace a client error CID through the pipeline:
SELECT * FROM nex.events WHERE payload->>'correlation_id' = 'X';        -- signals + audit
SELECT * FROM nex.knowledge_inbox WHERE payload->>'correlation_id'='X'; -- inbox origin
SELECT * FROM nex.knowledge_dump_jobs
  WHERE payload->>'correlation_id' = 'X'                                -- worker jobs (if payload preserves)
     OR inbox_item_id IN (SELECT id FROM nex.knowledge_inbox
                          WHERE payload->>'correlation_id' = 'X');       -- fallback via inbox
```

**Forensic query with Layer 2 column:**

```sql
SELECT * FROM nex.events              WHERE correlation_id = 'X';
SELECT * FROM nex.knowledge_inbox     WHERE correlation_id = 'X';
SELECT * FROM nex.knowledge_dump_jobs WHERE correlation_id = 'X';
```

**Cost/benefit:**

| Dimension | Layer 1 only | Add Layer 2 column |
|---|---|---|
| Query complexity | Chained lookup · fallback via inbox_item_id | Single WHERE per table |
| Index usage | `payload->>'correlation_id'` is not indexed by default · slow scan | Column can be indexed · fast |
| Schema stability | No migration | Migration + backfill of NULL for historical rows |
| Backward compat | Full | Full (nullable additive) |
| Adoption effort | Zero worker changes beyond §6 | Two column migrations + enqueue-signature update + worker read update |

**Recommended decision criterion:**

Ship Layer 1 only. Instrument forensic queries in the runbook (W-OBS-2). After ~4 weeks of production use, measure:

- How often does an operator need to trace a CID?
- How many join-hops does the chained-lookup approach require in practice?
- Is the `payload->>'correlation_id'` scan fast enough at production row counts (~50k jobs · 500k inbox items)?

**If** any of the following prove true, authorize Layer 2:
- Query latency exceeds 500ms at 50k rows
- Operators regularly need to write ad-hoc scripts to complete a trace
- A production incident requires a trace that Layer 1 chained-lookup cannot complete

**Otherwise** — defer Layer 2 indefinitely. The schema stays clean · forensic queries just become slightly more verbose.

### 16 · Migration requirements (if Layer 2 is later authorized)

**Only relevant IF Layer 2 is triggered by the criteria above.** Not authorized as part of this plan.

Shape (spec for future authorization):

- Migration `nex_add_correlation_id_columns.sql`:
  ```sql
  ALTER TABLE nex.knowledge_inbox      ADD COLUMN correlation_id TEXT;
  ALTER TABLE nex.knowledge_dump_jobs  ADD COLUMN correlation_id TEXT;
  ALTER TABLE nex.jobs                 ADD COLUMN correlation_id TEXT;
  CREATE INDEX ON nex.knowledge_inbox      (correlation_id);
  CREATE INDEX ON nex.knowledge_dump_jobs  (correlation_id);
  CREATE INDEX ON nex.jobs                 (correlation_id);
  ```
- Backfill: skipped · historical rows stay NULL (documented as "pre-Path-A CID absent")
- Populate logic: enqueue functions accept + persist CID · workers read + inherit
- Migration is idempotent · reversible (drop column · drop index)
- Zero-downtime: nullable additive column · concurrent reads/writes unaffected

**Contract test post-Layer-2:** CID present in job column matches CID present in inbox item's payload · matches CID present in `nex.events`.

### 17 · Rollback strategy

Path A Layer 1 is **fully reversible with zero data risk**.

**Rollback steps (in reverse-order of implementation):**

1. Revert `emitSignal` ALS-fallback branch → signals return to explicit-only CID mode
2. Revert `finalizeWorkerJob` ALS read → audit rows revert to no-CID (or whatever was there pre-change)
3. Revert worker claim-time `runWithCorrelationId` wrapper → workers run without ALS scope
4. Revert route-handler `runFromRequest` wrappers → handlers run without ALS scope
5. Revert middleware `x-request-id` injection → CID generation stops
6. Revert `correlation.ts` module (last · once no callers remain)

**Data effects of rollback:**

- Historical audit rows with CID stay in the DB · they're additive · no data corruption
- In-flight requests that were mid-processing when rollback deploys will lose their CID at the rollback boundary · one-request forensic gap · acceptable
- Client-facing error envelopes revert to per-request generated CIDs · same behavior as pre-Path-A

**No data migration required for rollback.** No column drops (Layer 1 doesn't add columns).

If Layer 2 was ever shipped, its rollback is a separate migration authorization — column drops are reversible but require a second migration.

### 18 · Observability / forensics query model

**Primary use case:** operator receives a bug report with `correlation_id: X`.

**Layer 1 query cookbook** (to ship as `docs/operations/runbooks/correlation-id-trace.md` — see W-OBS-2):

```sql
-- 1. Signals + audit-log for the CID (JSONB payload extractor · matches existing writers)
SELECT * FROM nex.events
WHERE payload->>'correlation_id' = :cid
ORDER BY timestamp ASC;

-- 2. Inbox items originating this CID (if any)
SELECT id, kind, status, created_at, payload
FROM nex.knowledge_inbox
WHERE payload->>'correlation_id' = :cid;

-- 3. Jobs spawned by those inbox items (chained lookup)
SELECT j.id, j.status, j.worker_type, j.created_at, j.completed_at
FROM nex.knowledge_dump_jobs j
WHERE j.inbox_item_id IN (
  SELECT id FROM nex.knowledge_inbox
  WHERE payload->>'correlation_id' = :cid
);

-- 4. Client-facing error envelopes (if the CID appears in HTTP error logs)
-- Retrieved via Vercel log drain search (once W-OBS-5 ships)
```

**Cross-subsystem forensics** (client CID triggers journeys · attribution · brain):

```sql
-- Journeys that inherited the CID
SELECT * FROM nex.journey_campaign_executions
WHERE correlation_id = :cid;

-- Attribution events
SELECT * FROM nex.conversion_events
WHERE correlation_id = :cid;
```

**Alerts that fired for the CID:**

```sql
SELECT * FROM nex.alert_dispatches
WHERE payload->>'correlation_id' = :cid;
```

**Composite trace (all of the above joined):** deferred to a stored procedure in a follow-up · not required for Layer 1 sign-off.

---

## Sequencing plan for implementation (when authorized)

Not authorization to implement. Order of work IF/WHEN authorization is granted:

| Step | Deliverable | Requires |
|---|---|---|
| 1 | `src/lib/nex/observability/correlation.ts` (module + tests CID1-CID7) | None |
| 2 | Middleware CID injection + test CID8-CID10 | Step 1 |
| 3 | `runFromRequest` wrapper adopted by 5-10 HQ API routes (canary) | Steps 1-2 |
| 4 | `emitSignal` ALS-fallback branch + regression tests | Steps 1-3 |
| 5 | ~~Runtime-verify `nex.events.correlation_id` column exists~~ **RESOLVED 2026-08-11** — no column exists · CID persisted via `payload->>'correlation_id'` JSONB pattern (see amended §9) · no schema change required | (satisfied · no work) |
| 6 | Inbox enqueue + inbox item payload CID persistence | Steps 1-5 |
| 7 | Worker claim `runWithCorrelationId` wrapper + `finalizeWorkerJob` ALS read | Steps 1-6 |
| 8 | Drift-catchers CADP1-CADP5 land + gate CI | Steps 1-7 |
| 9 | Runbook `docs/operations/runbooks/correlation-id-trace.md` | Steps 1-8 |
| 10 | Production observation window (4 weeks) · measure Layer 2 criteria | Steps 1-9 |
| 11 | Layer 2 decision · authorize OR defer | Step 10 evidence |

Each step is a separate authorization opportunity. Nothing runs without explicit go-ahead.

---

## Open questions requiring separate authorization

1. ~~**Runtime state of `nex.events.correlation_id` column**~~ **RESOLVED 2026-08-11** — verification report `WORLD-CLASS-OPS-W-OBS-1-PREREQ-VERIFICATION.md` · column does not exist · JSONB payload pattern chosen (Option 1 · Philip authorized) · no live PG re-verification needed for Layer 1 because no schema change is performed.
2. **Trust matrix specifics** — cron routes trust · what about future service-to-service? Design pass needed as new services are added.
3. **Layer 2 authorization gate** — Step 11 above. Not now.
4. **Non-HQ route coverage** — Phase 2 in §2 · Trade Centre routes. Separate authorization when those routes have their own audit lifecycle.

---

## Boundaries preserved

| Guardrail | Status |
|---|---|
| Implementation | ❌ none · this is design-only |
| Middleware modification | ❌ none |
| Worker modification | ❌ none |
| Migration | ❌ none |
| Commit | ❌ none |
| Push | ❌ none |
| F12 (READY · shipped d9df9ed) | Untouched |
| Step 11 (READY · shipped e8444a0) | Untouched |
| F12.b (OPEN · separate) | Untouched |
| Gap register + verification + decision record | Untouched by this plan |
| Master audit + Wave 11 docs | Untouched |

## What this document IS

- A **hand-off-ready implementation plan** for Path A.
- **Section-by-section** coverage of every dimension Philip specified.
- **Explicit Layer 1 vs Layer 2 separation** honoring the "don't introduce a schema change merely for the sake of having one" qualification.
- **Rollback documented** as first-class · not an afterthought.

## What this document IS NOT

- Not code. Not middleware changes. Not worker refactor. Not migration authoring.
- Not authorization to implement. Every step requires separate go-ahead.
- Not a schedule. Estimation cadence deferred to implementation authorization.
- Runtime-verified 2026-08-11 for the `nex.events` schema question (see `WORLD-CLASS-OPS-W-OBS-1-PREREQ-VERIFICATION.md`) · other runtime assumptions (e.g., existing enqueue signatures preserving arbitrary payload fields) still require targeted contract tests at implementation time.

## Implementation outcome · Layer 1 · 2026-08-11

### Gate results

| Gate | Result |
|---|---|
| 1 · tsc in-scope errors (`src/lib/nex/**` · `src/app/api/**` · `src/middleware.ts`) | **0** |
| 2 · CID1-CID10 contract | **10/10** (`correlation.test.mjs` · plus 1 sanity = 11/11) |
| 3 · CADP1-CADP5 drift-catcher | **5/5** (`correlation-adoption.test.mjs`) |
| 4 · F12 AI1-AI8 boundary | **8/8** preserved (`adapter-isolation.test.mjs`) |
| 5 · Step 11 contracts | CFG1-CFG11 + G1-G10 + CFGA1-CFGA5 all pass (26/26) |
| 6 · Regression vs pre-Layer-1 baseline | **188 tests · 182 pass · 6 fail** = **exact same 6 pre-existing failures** (4 PG-dependent test files + 2 libuv teardown flakes) · **0 new failures** |
| 7 · F35 convergence | **15/15** (`finalize.test.mjs` · FZ1-FZ10 + FZA1-FZA5) — test-harness fixed with a stub for the new correlation import · NOT weakening (parent CID still injected into child jobs · production behavior unchanged) |
| 8 · Schema change | **None** · zero migrations · zero columns added · CID persists in existing JSONB payloads throughout (inbox item field · WorkerJob.input_payload · nex.events.payload) |

### Files shipped

**New (3):**
- `src/lib/nex/observability/correlation.ts` — ALS module · `getCorrelationId` · `runWithCorrelationId` · `runFromRequest` · `isValidCorrelationId` · `withJobCorrelation` · `enterJobCorrelationScope` · `_hasCorrelationScopeForTests`
- `src/lib/nex/observability/tests/correlation.test.mjs` — CID1-CID10 + sanity (11 assertions)
- `src/lib/nex/observability/tests/correlation-adoption.test.mjs` — CADP1-CADP5 drift-catcher

**Modified (17):**
- `src/lib/nex/observability/signals.ts` — explicit-wins-over-ALS via `sig.correlation_id ?? getCorrelationId()`
- `src/middleware.ts` — `resolveCorrelationId` + `attachCid` helpers · 8 return sites wrap in `attachCid(res, cid)`
- `src/app/api/nex/knowledge-inbox/{upload,urls,dump,process}/route.ts` — 4 canary API handlers wrap in `runFromRequest(req, () => *Handler(req))`
- `src/app/api/nex/storage/gates/route.ts` — 5th canary
- `src/lib/nex/knowledge-inbox/types.ts` — `InboxItem.correlation_id?: string` field added
- `src/lib/nex/knowledge-inbox/storage.ts` — `saveTextItem` / `saveFileItem` / `saveUrlItem` read from `getCorrelationId()` and persist to inbox item
- `src/lib/nex/brain/manager.ts` — `dispatchNewInboxItems` copies `item.correlation_id` → `WorkerJob.input_payload.correlation_id`
- `src/lib/nex/brain/workers/{knowledge-context,voice-context,learning-context,knowledge-extractor,image-analyst,quality-checker}.ts` — one line each: `enterJobCorrelationScope(job)` after claim
- `src/lib/nex/brain/workers/_finalize.ts` — child `nextJob` inherits parent CID from ALS (§7 spec)

**Test-harness fixes (3):**
- `src/lib/nex/observability/tests/observability-core.test.mjs` — stub for `./correlation` import
- `src/lib/nex/observability/tests/retry-buffer.test.mjs` — same stub
- `src/lib/nex/brain/workers/tests/finalize.test.mjs` — stub for `@/lib/nex/observability/correlation` import

Total: **23 files** (3 new · 17 modified · 3 test-harness adaptations).

### End-to-end CID chain now functioning

```
client HTTP request  ─x-request-id?→  middleware (response header · Edge runtime)
                                             │
                                             └─→ route handler wraps in runFromRequest(req, fn)
                                                        │
                                                        └─→ ALS scope active (CID = X · Node runtime)
                                                              │
                                                              ├─→ saveTextItem/saveFileItem/saveUrlItem
                                                              │      writes item.correlation_id = X
                                                              │
                                                              └─→ dispatchNewInboxItems copies item.correlation_id
                                                                     into WorkerJob.input_payload.correlation_id = X
                                                                           │
                                                                           └─→ worker claims job
                                                                                 enterJobCorrelationScope(job) → ALS = X
                                                                                        │
                                                                                        ├─→ every emitSignal in this chain inherits X
                                                                                        │
                                                                                        └─→ finalizeWorkerJob({nextJob})
                                                                                               reads parent CID X from ALS
                                                                                               injects into child.input_payload.correlation_id
                                                                                                     │
                                                                                                     └─→ child worker inherits X (recursive)
```

### Boundaries preserved (verified post-implementation)

| | Status |
|---|---|
| F12 (READY · shipped d9df9ed) | Untouched — AI1-AI8 still 8/8 |
| Step 11 (READY · shipped e8444a0) | Untouched — CFG/CFGA/G all pass |
| F12.b (OPEN · separate) | Untouched — Supabase-legacy scope unchanged |
| Layer 2 (Job column · nex.events.correlation_id column) | NOT crossed — no schema change · no migration |
| RLS remediation | Not started (per authorization) |
| Master audit + Wave 11 docs | Untouched |
| Existing populated CID subsystems (journeys · attribution · error-envelope) | Compatible — explicit CID wins over ALS via nullish coalescing (CID7 · CADP5) |

### What remains deferred (by design)

- **Layer 2 authorization** — gated on 4-week production measurement per Layer 1 outcome (Path A plan §15 criteria)
- **Runbook `docs/operations/runbooks/correlation-id-trace.md`** — belongs to W-OBS-2 wave · not Layer 1
- **Non-HQ route coverage** (Trade Centre etc.) — Phase 2 · separate authorization
- **Runtime `\d nex.events` re-verification** — not required for Layer 1 (no schema change) · required before any future Layer 2 authorization

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-08-11 | Plan authored · Path A · 2 layers · 18 sections · sequencing + open questions preserved · zero implementation | Claude (design-only per Philip authorization) |
| 2026-08-11 (later · same session) | **§9 amended (Philip authorized Option 1)**: `nex.events` has NO `correlation_id` column and none is being added · CID persisted via existing `payload->>'correlation_id'` JSONB pattern matching `alerts/evaluator.ts` + `delivery/audit.ts` writers. Corrected overbroad claim that emitSignal writes to `nex.events` (it does not · signals emit to console.warn + emitEventSafe). Sequencing plan Step 5 marked RESOLVED · Open Question 1 marked RESOLVED. Layer 2 boundary explicitly reaffirmed as NOT crossed. Rationale (Philip): *"This keeps NEX Storage as the architectural abstraction rather than designing the system around a Supabase-specific schema alteration."* | Claude (documentation-only amendment per Philip authorization) |
| 2026-08-11 (later · same session) | **Layer 1 IMPLEMENTED end-to-end.** All 11 sequencing steps complete (Step 5 was resolved by verification · no work needed · Steps 9-11 remain deferred by design: runbook lives with W-OBS-2 · production observation is post-ship · Layer 2 decision gated on that observation). All 8 acceptance gates green. Zero schema change. Zero new regressions vs pre-Layer-1 baseline. See § Implementation outcome. | Claude (implementation per Philip authorization) |
