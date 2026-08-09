# WORLD-CLASS-OPS · P0 Verification Report

**Programme:** Headquarters Production Readiness · Gap-register verification
**Date:** 2026-08-11
**Author role:** Chief Engineer AI · NEX Corporation
**Purpose:** Establish exact runtime state, intended access model, and blast radius for the 2 P0 findings surfaced in `WORLD-CLASS-OPS-GAP-REGISTER.md`. **Evidence only · no fixes.**
**Authorization scope:** Philip 2026-08-11 · *"P0 verification pass on W-SEC-1 and W-OBS-1, with evidence only—no fixes."*

## Method

Direct static analysis of the working tree via `grep -rn` counts + per-file inspection of migration files, brain adapter files, middleware, and observability modules. No runtime queries against PG/Supabase (PG on 5433 currently down in this environment · Supabase read-only). Runtime behavioral claims below are inferred from source · **must be re-verified in a production shell before any remediation is authorized**.

---

## W-SEC-1 · RLS runtime state · **SURVEY WAS INCORRECT · REALITY IS SPLIT**

### What the survey (WORLD-CLASS-OPS-GAP-REGISTER.md § W-SEC-1) claimed

> "RLS enabled on 44 tables · **0 `CREATE POLICY`** in `nex.*` schema migrations. RLS is *enabled but empty* means the tables are LOCKED · every query returns 0 rows for any role without `BYPASS RLS` · or worse, the service role bypasses so no isolation actually exists."

Severity assigned by the survey: **P0**.

### What is actually true (evidence)

The survey conflated two entirely different schemas and audited only one location. Precise counts:

| Location | RLS-enable statements | CREATE POLICY statements | Verdict |
|---|---|---|---|
| `deploy/postgres/init/*.sql` (nex.* schema · our Postgres) | 36 tables | **96 policies** | **FULLY protected** |
| `supabase/migrations/*.sql` (public schema · Supabase legacy) | 116 files with RLS mentions | Many · but **~20 files enable RLS with 0 policies in the same file** | **PARTIAL · defense-in-depth broken on the RLS-only-tables** |

**Per-nex-table coverage sampled** (`deploy/postgres/init/`):

Every one of the 30 nex.* tables sampled has `rls_enable=1+` AND `create_policy=1+`. Examples:
- `nex.events · rls_enable=1 · create_policy=1`
- `nex.jobs · rls_enable=1 · create_policy=1`
- `nex.brain_memories · rls_enable=1 · create_policy=1`
- `nex.contacts · rls_enable=1 · create_policy=1`
- `nex.social_tenants · rls_enable=7 · create_policy=12`

**The `nex_brain_app` role exists and has explicit per-table policies** — verified in `deploy/postgres/init/042_nex_brain_role_and_extended_tables.sql`:

- Line 120: `CREATE ROLE nex_brain_app NOLOGIN`
- Line 125: `GRANT USAGE ON SCHEMA nex TO nex_brain_app`
- Line 142: table-level GRANT to `nex_brain_app`
- Line 185: DO block iterates every nex.* table and executes `CREATE POLICY %I_brain_app_all ON nex.%I FOR ALL TO nex_brain_app USING (true) WITH CHECK (true)`
- Line 194: comment confirms *"NEX Brain application role · NOLOGIN · used by the PostgresBrainStore adapter (Phase 11.1b). Every transaction that touches nex.<brain table> must SET LOCAL ROLE nex_brain_app first so RLS enforces role-scoped isolation."*

**Application connection path**: `src/lib/nex/brain/adapters/postgres.ts:53` — `await c.query("SET LOCAL ROLE nex_brain_app")` in every transaction. Verified by the Wave 11 F34 shared helper `withBrainRole`. So the runtime path is:

```
connect as service_role (Supabase pattern)
  → SET LOCAL ROLE nex_brain_app
  → policies enforce access as nex_brain_app
  → defense-in-depth active
```

**Supabase-legacy tables with RLS-enable-but-no-policy** — verified sample:

| File | RLS statements | Policies in same file | Policies in later migrations |
|---|---|---|---|
| `20260709000000_os_foundation.sql` | 7 | 0 | 0 (verified for sampled tables) |
| `20260717120500_os_consent_architecture.sql` | 4 | 0 | 0 (verified for sampled tables) |
| `20260710140000_uploads_usage.sql` | 1 | 0 | (not sampled) |
| `20260714000000_os_event_bus.sql` | 3 | 0 | (not sampled) |
| `20260714000200_os_billing.sql` | 4 | 0 | (not sampled) |
| `20260717120100_os_business_apps.sql` | 8 | 0 | (not sampled) |
| `20260717120200_os_trade_circle.sql` | 4 | 0 | (not sampled) |
| ... (13 more files with same shape) | ... | 0 | (not sampled) |

Total identified: **~20 Supabase migration files enable RLS on tables but define no policies**. Actual affected table count is higher (multiple tables per file).

### Runtime effect (inferred · MUST be re-verified in a prod shell)

For an RLS-enabled Postgres table with zero policies:
- All queries by non-`BYPASSRLS` roles → return 0 rows (RLS default-deny)
- Queries by roles with `BYPASSRLS` → return all rows regardless of RLS
- Supabase `service_role` has `BYPASSRLS` by default

The application appears to connect via `service_role` for these Supabase tables (evidenced by service-role keys in env config). Therefore:
- App reads/writes succeed (service_role bypasses)
- Any non-service_role connection (anon, authenticated user session) → **effective 0-row visibility**
- **Defense-in-depth is a false comfort** — the tables LOOK protected but only because no non-bypass role is actively used

### Recategorized severity

| Region | Original survey | Verified reality | Corrected severity |
|---|---|---|---|
| `nex.*` schema (our Postgres) | P0 · 0 policies | 36 tables · 96 policies · nex_brain_app role · defense-in-depth active | **NO GAP** |
| Supabase legacy `public` schema | (mixed into P0 above) | ~20 files with RLS-enabled-but-no-policy · runtime bypassed via service_role | **P1 · defense-in-depth gap** |

Not P0 because the current connection topology (service_role only) means no exploit path exists TODAY. Escalates to P0 the moment:
- Anon/authenticated Supabase user sessions are added
- Service_role credentials leak
- A future subsystem connects as a non-BYPASS role

### Intended access model

- **`nex.*` schema**: nex_brain_app role · SET LOCAL ROLE per transaction · policies scoped to that role. Model is EXPLICIT and DOCUMENTED (file 042 header comment).
- **Supabase legacy `public` schema**: intended access model **UNCLEAR from code alone**. Different subsystems likely have different intended ownership models:
  - `os_billing.sql` — probably per-merchant ownership
  - `os_consent_architecture.sql` — probably per-contact ownership
  - `os_project_workflow.sql` — probably per-homeowner + trade partner
  - `os_event_bus.sql` — probably operator-only
  - Each needs case-by-case design based on subsystem's business rules

### Blast radius (if remediation were authorized)

- **Zero blast radius for `nex.*` schema** — policies already exist · nothing to change
- **High-risk blast radius for Supabase-legacy tables** — authoring policies WITHOUT knowing intended access model = potential production breakage:
  - Adding `authenticated users can read own rows` requires knowing the ownership column per table
  - Adding wrong policy could break existing UX for logged-in users
  - Adding overly-permissive policy could expose data cross-tenant

### Verification-only conclusion

- Survey conflated two schemas. Actual gap is defense-in-depth on ~20 Supabase-legacy tables, not correctness across the board.
- Remediation cannot be a blanket sweep. It requires per-table (or per-subsystem) access-model design, likely by whoever owns each subsystem.
- Fix does NOT belong in the Brain module remediation stream — it belongs to whichever team owns each subsystem (os_billing owner, os_consent owner, etc.).

### Recommended next authorized step (not authorized here)

Per-subsystem access-model design pass, one Supabase-legacy file at a time. Each design step produces: (a) intended access model doc · (b) policy migration · (c) contract test (positive + negative role tests) · (d) staged rollout in preview.

---

## W-OBS-1 · Correlation-ID runtime state · **SURVEY PARTIALLY CORRECT · SCOPE NARROWER**

### What the survey (WORLD-CLASS-OPS-GAP-REGISTER.md § W-OBS-1) claimed

> "`src/lib/nex/observability/signals.ts:44` — `correlation_id?` field exists · optional. `grep correlation_id src/lib/nex/brain/workers/**` → **zero callers populate it**. `grep x-request-id src/**` → zero results. `src/middleware.ts` does NOT generate a request ID."

Severity assigned by the survey: **P1** (escalates to **P0** at first cross-subsystem incident).

### What is actually true (evidence)

**Correlation IDs ARE populated in multiple subsystems** — the survey's "zero callers" claim was scoped to Brain workers, but the phrasing implied system-wide. Verified callers:

| Subsystem | File | Behavior |
|---|---|---|
| Journeys engine | `src/lib/nex/journeys/entry.ts:64,69` | Envelope carries `correlation_id: string` · propagated to every downstream event |
| Journey triggers | `src/lib/nex/journeys/triggers/analytics_event.ts:48` | `correlation_id: \`analytics:${event_id}\`` |
| Journey triggers | `src/lib/nex/journeys/triggers/compliance_transition.ts:42` | `correlation_id: \`compliance:${event_id}\`` |
| Journey triggers | `src/lib/nex/journeys/triggers/custom_webhook.ts:46` | `correlation_id: \`webhook:${inbound_event_id}\`` |
| Journey triggers | `src/lib/nex/journeys/triggers/inactivity.ts:55` | `correlation_id: \`${tick_id}:inactivity:${contact_id}\`` |
| Journey triggers | `src/lib/nex/journeys/triggers/schedule.ts:71` | `correlation_id: \`schedule:${trigger_id}:${now}\`` |
| Attribution engine | `src/lib/nex/attribution/engine.ts:209` | Reads `correlation_id` from event rows |
| Attribution types | `src/lib/nex/attribution/types.ts:17` | `correlation_id: string \| null` field declared |
| Client error envelope | `src/lib/nex/api/error-envelope.ts:31` | Returns `correlation_id` in every safe error response |

**Where correlation IDs are NOT threaded (the real gap)** — verified per Brain worker:

| File | `correlation_id` count | `job_id` count | `brain_id` count |
|---|---|---|---|
| `_finalize.ts` | 0 | 6 | 0 |
| `image-analyst.ts` | 0 | 1 | 0 |
| `knowledge-context.ts` | 0 | 1 | 0 |
| `knowledge-extractor.ts` | 0 | 2 | 0 |
| `learning-context.ts` | 0 | 1 | 0 |
| `llm-retry.ts` | 0 | 4 | 0 |
| `memory-guardian.ts` | 0 | 0 | 0 |
| `quality-checker.ts` | 0 | 1 | 0 |
| `voice-context.ts` | 0 | 1 | 0 |

**Zero brain workers thread `correlation_id`.** All 9 workers use `job_id` as a de-facto identity (Wave 11 F35 `finalizeWorkerJob` formalized this).

**HTTP edge (verified)**:
- `src/middleware.ts` — 40+ lines · **host-routing middleware only** (custom-domain lookup for tradesperson URLs). Does NOT generate `x-request-id`. Does NOT propagate any identity header.
- `grep x-request-id src/**` → 0 results
- `grep AsyncLocalStorage src/**` → 0 results

**Log format (verified)** — sampled 3 workers:
- `knowledge-extractor.ts:201` — `console.warn("[knowledge-extractor] KnowledgeJob processing sync failed:", ...)` · plain string · no ID
- `knowledge-extractor.ts:245` — `console.warn(\`[knowledge-extractor] no context bundle attached for inbox item ${inboxItemId}\`)` · has inbox-item ID but not correlation
- `image-analyst.ts` — similar unstructured pattern

### Runtime effect

- If an operator receives a client-facing error with `correlation_id: X` (via error-envelope), they CAN trace it back to journeys/attribution paths.
- If the same client action later triggers a Brain worker chain (via inbox upload · KnowledgeJob dispatch), the correlation ID is **LOST at the inbox boundary** — workers see only `job_id` which is a NEW identity generated at enqueue time.
- Cross-subsystem incident forensics (client action → inbox → worker → audit) is impossible without external join across `job_id` and inbox-item-id.

### Scope-corrected severity

| Region | Original survey | Verified reality | Corrected severity |
|---|---|---|---|
| Journeys / attribution / error-envelope | (mixed into P1 above) | Already threaded end-to-end | **NO GAP** |
| Brain worker chain (9 workers) | P1 | 0/9 workers thread it | **P1** (unchanged) |
| HTTP edge (middleware) | P1 | No generation · no propagation | **P1** (unchanged) |
| Knowledge inbox → job → worker chain | (implied) | Breaks the chain because `job_id` replaces edge identity | **P1** (specific · was implied) |

Overall corrected severity: **P1**, unchanged, but scope halved. The gap is specifically:
1. HTTP edge does not generate a request ID
2. The inbox → job boundary does not preserve upstream correlation IDs
3. Brain workers do not carry any correlation ID through their finalize chain

### Intended architecture (options · no decision authorized)

Three viable paths, each with different blast radius:

**Option A · Edge-middleware pattern** (recommended by industry norm)
- `src/middleware.ts` generates `x-request-id: <uuid>` on every request (or trusts an inbound header if within same-org proxy)
- `AsyncLocalStorage` in Node.js runtime propagates the ID to any code triggered by that request
- Every `emitSignal` reads from ALS · every audit row inherits · every worker log carries it
- Existing populated subsystems (journeys/attribution) continue to work · they explicitly-set-then-inherit
- **Blast radius: Low** — additive · legacy readers unaffected

**Option B · Job-column pattern**
- Add `correlation_id TEXT` column to `nex.knowledge_dump_jobs` and `nex.jobs`
- Populate at enqueue time (from upstream context if available · else generate new)
- Workers read from job row · thread through `finalizeWorkerJob` chain
- **Blast radius: Low** — additive column · existing enqueues get NULL initially

**Option C · Use existing `job_id` as de-facto correlation**
- Rename the concept · adopt `job_id` as the correlation-ID name
- Threads immediately (already exists across 8/9 workers)
- **Blast radius: Zero code changes · Documentation-only**
- **Cost: Doesn't solve the edge → inbox → worker chain gap · only worker → audit is covered**

### Blast radius (if remediation were authorized)

- **Option A**: Low · additive · well-understood pattern
- **Option B**: Low · single migration + populate logic
- **Option C**: Zero code · but doesn't actually close the gap

### Verification-only conclusion

- Gap is real but scope is narrower than the survey implied. Journeys/attribution/error-envelope are already threaded correctly.
- The specific missing pieces: HTTP edge · inbox → job boundary · Brain worker `_finalize.ts` chain.
- Multiple viable implementation paths exist. **Choice of path is a design decision that requires separate authorization.**

### Recommended next authorized step (not authorized here)

Design decision on correlation-ID threading approach (A / B / C or hybrid). Once chosen, the implementation is small (single middleware · one column migration · or documentation-only depending on path).

---

## Summary · both P0s corrected against verified reality

| Finding | Original severity | Verified severity | Notable correction |
|---|---|---|---|
| **W-SEC-1 · RLS coverage** | P0 · "0 policies in nex.*" | Split: **nex.* NO GAP** · **Supabase-legacy P1 defense-in-depth** | Survey missed the entire `deploy/postgres/init/` layer AND the `nex_brain_app` role construction · gap is only in Supabase-legacy |
| **W-OBS-1 · Correlation-ID threading** | P1 (escalates to P0 at incident) | **P1** unchanged · scope narrower | Journeys + attribution + error-envelope ALREADY threaded · gap is Brain worker chain + HTTP edge specifically |

## Impact on the gap register

Both P0 classifications in `WORLD-CLASS-OPS-GAP-REGISTER.md` need correction:
- W-SEC-1 should be downgraded from **P0** to **P1** (defense-in-depth · Supabase-legacy scope only)
- W-OBS-1 severity is unchanged (P1) but scope should be tightened

**No P0 world-class blockers remain after this verification pass.** The gap register's `Executive summary` P0 count of 2 should become **0**.

## What this doc IS

- A **verification report** grounding the survey's P0 findings in evidence.
- A **severity correction** based on that evidence.
- A **blast-radius analysis** that informs — but does not authorize — remediation.

## What this doc IS NOT

- Not a fix. **No policy authoring · no middleware changes · no worker refactor.**
- Not authorization to remediate. Both findings still require separate authorization AND a design decision before implementation.
- Not a runtime-verified proof. All runtime behavioral claims are inferred from source and MUST be re-verified in a production shell (`SELECT * FROM pg_policies WHERE schemaname = 'nex'` and `SELECT * FROM pg_policies WHERE schemaname = 'public'` are the two shell queries that should be run to confirm).
- Not a rewrite of the gap register. The register stays as authored · this doc is the delta that should inform its next revision.

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-08-11 | Verification pass authored · both P0 severities corrected against evidence · no remediation performed | Claude |
