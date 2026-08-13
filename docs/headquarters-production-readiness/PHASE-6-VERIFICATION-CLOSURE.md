# Phase 6 · Verification Closure

**Programme:** Headquarters Production Readiness · W-C-COMPANION Phase 6 (KnowledgeJob supervisor)
**Purpose:** Close out local verification and record the end state before production activation is even considered.
**Date:** 2026-08-10
**Authorisation:** Philip 2026-08-10 · *"PHASE 6 — VERIFICATION CLOSURE / PRE-PRODUCTION CLEANUP ONLY"* with strict prohibitions listed in §7 below.
**Final state (locked at this closure):**

> **PHASE 6 — VERIFIED — LOCAL LIVE**
> **PRODUCTION — NOT PROVEN**
> **SUPERVISOR — DISABLED (`NEX_KJOB_SUPERVISOR_ENABLED` unset / 0)**

Companion documents:
- `W-C-COMPANION-PHASE-6-DESIGN.md` — the design + full §21 evidence ledger (updated in this closure)
- `PHASE-6-PRESERVATION-INCIDENT-FORENSIC-REPORT.md` — forensic evidence of the incident
- `PHASE-6-PRESERVATION-INCIDENT-RESOLUTION.md` — restoration + safety-boundary hardening
- `ARCHITECTURAL-STANCE.md` · `WORLD-CLASS-OPS-REMEDIATION-PLAN.md` — programme-level context

---

## 1 · Scope of this closure

Philip's directive of 2026-08-10 listed five closure tasks:

1. **Reconcile NEW-1** — establish one authoritative Phase 6 implementation across `supervisor.*` and `kjob-supervisor.*`, document the decision, do not silently delete useful prior work.
2. **Correct Phase 6 design documentation** — fix the `listWorkerResultsByJobIds → listWorkerResultsByIds` typo, record final implementation / file mapping, record the preservation incident + resolution, record the new `probe_mode` + `only_kjids` safety boundary.
3. **Exercise `scripts/supervisor-resolve.mjs` against disposable burner data only** — verify preserved-KJ guard, terminal transition, audit, cleanup, no production records touched.
4. **Update the Phase 6 evidence ledger** with explicit IMPLEMENTED / VERIFIED — LOCAL LIVE / PRODUCTION-PROVEN state per component.
5. **Produce this document.**

Every task below reports the outcome honestly, including what was NOT attempted.

---

## 2 · Task 1 · NEW-1 reconciliation (Option C · controlled merge)

**Decision:** Option C — kept classifier, kept orchestrator, deprecated fetch-orchestrator in place.

| File | Role after closure | Status |
|---|---|---|
| `src/lib/nex/jobs/supervisor.ts` | **Authoritative Phase 6 orchestrator.** Path A (attest) + Path B (review) + advisory-lock + audit + metrics + probe_mode/only_kjids safety boundary. | ACTIVE |
| `src/lib/nex/jobs/kjob-supervisor.ts` | **Authoritative Phase 6 classifier** · pure discriminated-union `classifyStuckKJ` · consumed by `supervisor.ts::tryAttestOne` · 17/17 vitest assertions. | ACTIVE |
| `src/lib/nex/jobs/kjob-supervisor-fetch.ts` | **Deprecated in-place.** Large deprecation header at top of file. Zero external import sites (grep-verified). Physical deletion deferred pending explicit authorisation. | DEPRECATED |
| `src/app/api/nex/brain/supervisor-sweep/route.ts` | **Route surface.** Accepts `?probe_mode=1&only_kjids=<csv>` query params · plumbs through to `runSupervisorSweep`. | ACTIVE |
| `scripts/supervisor-resolve.mjs` | **Operator CLI** for Path B resolution. Contains preserved-KJ guard on 8-char prefix. Invoked via `npx tsx` (imports `.ts` modules). | ACTIVE |

**Verification method:** import-graph grep — `supervisor.ts` is imported by the route + 2 probe scripts (attest, review); `kjob-supervisor.ts` is imported only by `supervisor.ts` + its own vitest; `kjob-supervisor-fetch.ts` has no external importers.

**No files were silently deleted.** The deprecated file remains with a clear header so future readers see the decision context.

---

## 3 · Task 2 · Design documentation corrections

Applied to `W-C-COMPANION-PHASE-6-DESIGN.md`:

| Correction | Location | State |
|---|---|---|
| **Typo fix:** `listWorkerResultsByJobIds` → `listWorkerResultsByIds` | 6 occurrences fixed · 0 of old name remaining · verified by grep | ✅ |
| **NEW-1 RESOLUTION note** — Option C · controlled merge, files + roles + rationale | §22 (Architectural conflicts) | ✅ |
| **POST-INCIDENT SAFETY BOUNDARY** — probe_mode + only_kjids required for programmatic sweeps in probe scope; guard throws when missing/empty | §22 · after NEW-1 RESOLUTION note | ✅ |
| **FINAL FILE MAPPING table** — 13 rows: each Phase 6 file, its role, its authoritative status, its import graph | §22 · after POST-INCIDENT SAFETY BOUNDARY | ✅ |
| **§21 Evidence ledger** — rewritten with dated per-component state (11 rows, 7 green, 1 closed incident, 3 explicitly open) | §21 | ✅ |

---

## 4 · Task 3 · Operator CLI exercise against burner data

Script: `scripts/prove-supervisor-cli.ts` (added this closure · self-cleaning · exit 0 on PASS · exit 2 on FAIL).

Preflight: snapshot the 10 preserved fixture kjids from `nex.knowledge_dump_jobs` on local NEX Postgres. All 10 must be `status='claimed' · progress=0 · completion_result=NULL` (restored state).

### 4.1 · Sub-invariant 1 · Preserved-KJ guard

- **Target:** `b1772902-0000-4000-8000-000000000000` (canonical preserved 8-char prefix + invented tail — proves the guard fires on prefix alone).
- **Command:** `npx tsx scripts/supervisor-resolve.mjs <target> --action=complete --note "guard test"` (no `--force-preserved`).
- **Observed:** stderr `REFUSED · kjid b1772902-… matches a preserved fixture prefix. Add --force-preserved to override.` · exit **2**.
- **Verdict: PASS.**

### 4.2 · Sub-invariant 2 · Terminal transition on burner

- Burner created via `createJob()` (system-generated UUID · zero prefix collision with the 10 preserved).
- Burner moved to `claimed` via `updateJob({ status: "claimed" })`; 500 ms wait for fs-store's fire-and-forget shadow write to land.
- CLI invoked: `npx tsx scripts/supervisor-resolve.mjs <burnerUuid> --action=complete --note "cli-closure <timestamp>"`.
- CLI stdout: `{"ok": true, "kjid": "<burner>", "from": "claimed", "to": "completed", "action": "complete"}`.
- Post-CLI `getJob(burnerUuid)` returned `status=completed · progress=100 · completion_result={"brains_linked":[],"operator_note":"cli-closure","memories_added":0}`.
- **Verdict: PASS.**

> **Windows/tsx note:** the tsx runner emitted a benign uv teardown assertion on process exit (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` · exit code `3221226505` / `0xC0000409`). This fires **after** `main()` completed successfully and `process.exit(0)` was requested — CLI printed `"ok": true` and the DB reflects the completed transition. Cosmetic Windows-only artifact; does not affect correctness. Recorded here so no future reader mistakes it for a real failure.

### 4.3 · Sub-invariant 3 · Audit behaviour (Supabase side)

- Post-CLI Supabase query: `SELECT id, entity_id, action, actor, notes, created_at FROM audit_log WHERE entity_id = '<burner>' ORDER BY created_at DESC LIMIT 5`.
- Returned exactly 1 row: `action=supervisor-resolve-complete · actor=operator:supervisor-resolve.mjs@unknown · notes="cli-closure"`.
- **Verdict: PASS.**

### 4.4 · Sub-invariant 4 · No production records touched

- Post-flight snapshot of the 10 preserved fixture kjids compared row-by-row against preflight snapshot.
- **All 10 unchanged** · `status=claimed · progress=0 · completion_result=NULL` before and after.
- **Verdict: PASS · preservation invariant intact.**

### 4.5 · Cleanup performed

- Burner row deleted from `nex.knowledge_dump_jobs` (local NEX Postgres).
- Burner audit rows deleted from `audit_log` on Supabase.
- `fs-store` `jobs.jsonl` retains its append-only burner snapshots (not evidence of anything preserved · noted, not remediated).

### 4.6 · Invocation correction (documented, not silent)

The CLI's original header advertised invocation as `node scripts/supervisor-resolve.mjs`. Under plain Node 22 on Windows, that fails at import time because the CLI dynamic-imports `.ts` modules (`fs-store.ts`, `brain/storage.ts`) and Node's ESM resolver rejects extension-less relative TS imports without a loader hook. Corrected in the CLI's header and usage-error message to `npx tsx scripts/supervisor-resolve.mjs`. This is a documentation fix; the CLI's runtime behaviour is unchanged.

---

## 5 · Task 4 · Evidence ledger update

`W-C-COMPANION-PHASE-6-DESIGN.md §21` rewritten. The new 11-row table records date, result, and artifact for each component. Summary:

| Rows | State | Count |
|---|---|---|
| 1-7 | ✅ IMPLEMENTED / VERIFIED — LOCAL LIVE | 7 |
| 8 | ⚠️ CLOSED (preservation incident · contained + restored + hardened) | 1 |
| 9-11 | ⛔ NOT ATTEMPTED (production activation · Cohort A · Cohort B · 24 h cadence) | 3 |

Rows 9-11 remain OPEN. Phase 6 must NOT be declared PRODUCTION-PROVEN until they are dated green by a Philip-authorised production run.

---

## 6 · Programme state locked at this closure

| Item | State |
|---|---|
| `NEX_KJOB_SUPERVISOR_ENABLED` | **Unset / 0** (supervisor disabled) |
| Cohort A (4 KJs) | **Not recovered** · remain in preserved / restored state (`claimed / 0 / null`) |
| Cohort B (6 KJs) | **Not processed** · remain in preserved / restored state (`claimed / 0 / null`) |
| Production sweep | **Not run** at any time during this closure |
| Preservation invariant | **Verified before + after every probe** in this closure · always green |
| Wave 3 | **Not started** |
| Deprecated file `kjob-supervisor-fetch.ts` | Retained with deprecation header · not deleted |
| Pre-existing regression failures | Kept separately classified (see §8) |

---

## 7 · Prohibitions honoured (strict phased order)

Philip's closure directive listed prohibitions. Each honoured:

- ✅ Did **not** enable `NEX_KJOB_SUPERVISOR_ENABLED`.
- ✅ Did **not** recover Cohort A.
- ✅ Did **not** process Cohort B.
- ✅ Did **not** run the production sweep.
- ✅ Did **not** touch the 10 preserved KJs (verified before AND after every probe).
- ✅ Did **not** touch Supabase beyond (a) reading `audit_log` to verify one burner row, (b) deleting only the burner's own audit rows in cleanup.
- ✅ Did **not** begin Wave 3.
- ✅ Did **not** declare PRODUCTION-PROVEN.

---

## 8 · Pre-existing regression failures (unchanged)

Three brain-suite regressions predate Phase 6 and remain out of scope for this closure per the directive *"Keep the three pre-existing Brain regression failures separately classified as pre-existing unless new evidence shows Phase 6 caused them."*

- `src/lib/nex/brain/tests/extractor-idempotency.test.mjs`
- `src/lib/nex/brain/tests/knowledge-dump-worker.test.mjs`
- `src/lib/nex/brain/tests/storage-characterization.test.mjs` (test `SC15`)

**No new evidence in this closure links these to Phase 6.** They remain OPEN as pre-existing, tracked separately.

---

## 9 · What must happen before Phase 6 can be declared PRODUCTION-PROVEN

In order · with explicit Philip authorisation gates between each:

1. **Production activation authorisation** · Philip explicitly authorises setting `NEX_KJOB_SUPERVISOR_ENABLED=1` in the target environment. Include: rollback plan · monitoring window · specific opex owner.
2. **Cohort A production run** · Operator executes runbook §12 against Cohort A · verifies at least 1 KJ transitions to `completed` with `actor:supervisor:companion` reason `attested-from-worker-results` · audit row present in Supabase.
3. **Cohort B production run** · Operator observes 6 Cohort B audit rows appear in review queue · resolves each via CLI · all 6 terminal.
4. **24 h continuous operation** · Zero errors · zero unexpected attestations of non-stuck KJs · `/api/nex/brain/llm-health` shows `supervisor.error=0` throughout.
5. **Ledger update** · Rows 9-11 of `W-C-COMPANION-PHASE-6-DESIGN.md §21` dated green with evidence artifacts attached.

Only after step 5 may PHASE 6 be re-labelled **PRODUCTION-PROVEN**.

---

## 10 · Closure sign-off

**Author:** Claude · master AI engineer · under Philip's 2026-08-10 verification-closure directive.
**Date closed:** 2026-08-10.
**Effective state (repeated for locking):**

> **PHASE 6 — VERIFIED — LOCAL LIVE**
> **PRODUCTION — NOT PROVEN**
> **SUPERVISOR — DISABLED**
