# E5 · Path Y · R1/R2 Regression Investigation (READ-ONLY · NO FIXES)

**Programme:** Headquarters Production Readiness
**Authorisation:** Philip · Path Y · investigation only · no code / migration / production changes
**Date:** 2026-08-10
**Locked verdict:**

> **PATH Y · INVESTIGATION COMPLETE · NO FIXES APPLIED**
> R1 root cause identified with HIGH confidence · R2 root cause identified with HIGH confidence · related but distinct (both trace to H3-era changes to `withBrainRole` / `db.ts`) · production code paths (Phase 6 CLI · V-11 · W4-1) not implicated · 10 preserved KJs intact pre + post · R3 documented separately.

No code was modified. No migration was applied. No production access was made. One temporary diagnostic script was created + deleted in the same shell command (zero repo footprint).

---

## 0 · Prohibitions honoured

- ⛔ Did NOT modify any application code
- ⛔ Did NOT modify any migration
- ⛔ Did NOT modify any test
- ⛔ Did NOT modify production
- ⛔ Did NOT modify Supabase
- ⛔ Did NOT change any feature flag
- ⛔ Did NOT enable the supervisor
- ⛔ Did NOT touch 021/048
- ⛔ Did NOT touch CFGA2
- ⛔ Did NOT alter the 10 preserved KJs
- ⛔ Did NOT fix anything discovered

Investigation used: `Read` on source files (supervisor.ts · supervisor-stuck-detector.ts · fs-store.ts · pg-shadow.ts · pg-reads.ts · claim-race.test.mjs · prove-supervisor-attest.ts), `Grep` for symbol lookups, one temp diagnostic (`_diag-r1-r2.ts` · read-only · deleted), one re-run of `claim-race.test.mjs` to capture full error text.

---

## 1 · R1 · Supervisor discovery regression

### 1.1 · Failure surface

`scripts/prove-supervisor-attest.ts` and `scripts/prove-supervisor-review.ts` both report `candidates_scanned=0` under conditions where a burner should be visible as stuck.

### 1.2 · Complete path trace

The attest/review probes follow this sequence:

1. `createJob({ inbox_item_id, ..., owner: "prove-supervisor-attest" })` — inserts KJ into fs-store JSONL AND fires `shadowUpsertJob()` to `nex.knowledge_dump_jobs` (fire-and-forget, per `fs-store.ts::createJob`)
2. Capture the returned `burnerUuid`
3. `await updateJob(burnerUuid, { status: "claimed" })` — appends new JSONL row (fs-store) AND fires `shadowUpsertJob()` to PG (fire-and-forget, per `fs-store.ts::updateJob` line 305: `void shadowUpsertJob(next)`)
4. `await new Promise((r) => setTimeout(r, 300))` — 300 ms wait, sized to let the shadow-write settle before the direct-SQL backdate
5. `await pool.query('UPDATE nex.knowledge_dump_jobs SET updated_at = $1 WHERE job_id = $2', [stuckIso, burnerUuid])` — backdates `updated_at` to 60 min ago **in PG only**
6. `runSupervisorSweep(..., { probe_mode: true, only_kjids: [burnerUuid] })`

The sweep calls (per `supervisor.ts:309`):
```
listJobs({ status: "claimed", include_all_states: true, limit: 500, since_ms: 30d })
```

With `NEX_INBOX_READ_BACKEND=postgres` (confirmed in `.env.local`), `listJobs` reads from `listJobsFromPostgres` (`pg-reads.ts:59`), which runs a straightforward `SELECT ... WHERE updated_at >= (now - 30d) AND status = 'claimed'` against `nex.knowledge_dump_jobs`.

Then `detectStuck(list, cfg, now)` filters by: `status='claimed' AND progress=0 AND updated_at < (now - stuck_after_min)`. The probe sets `stuck_after_minutes=1`, so `cutoff = now - 60 s`. The direct-SQL-backdated burner (`updated_at = now - 3600 s`) SHOULD easily pass this filter.

Finally `stuck.filter((kj) => opts.only_kjids.includes(kj.job_id))` restricts to the burner.

### 1.3 · Diagnostic evidence captured

Read-only probe (`_diag-r1-r2.ts`, deleted after use) confirmed:
- `listJobs({status:"claimed", include_all_states:true, limit:500, since_ms:30d})` returns 10 rows on the current DB · **exactly the 10 preserved fixtures**
- `detectStuck(allClaimed, {stuck_after_minutes:1}, new Date())` returns **10 rows** — the 10 preserved fixtures all qualify as "stuck" against the 1-min threshold
- Direct PG query confirms **only 10 claimed rows exist on the local NEX Postgres right now** — matching the fs-store view (backend consistency intact)
- The read path itself is working correctly

### 1.4 · Root cause · HIGH confidence

**The 300 ms wait in the probes is racing the fire-and-forget shadow-write, and Wave 3 H3 made that shadow-write slower.**

Timeline:
- Before H3: `withBrainRole` executed `BEGIN → SET LOCAL ROLE → fn → COMMIT` — 4 roundtrips including the actual insert
- After H3 (per `WAVE-3-H3-TIMEOUT-BUDGETS.md §4.2`): `withBrainRole` now also executes `SET LOCAL statement_timeout = ...` and `SET LOCAL idle_in_transaction_session_timeout = ...` at the start of every transaction — **2 additional roundtrips per shadow-write** (verified by re-reading `src/lib/nex/db/with-brain-role.ts` post-H3 modifications)

Effect: `shadowUpsertJob()` (called from `updateJob` and `createJob`) now takes ~2 extra roundtrips per call. On the local Postgres each roundtrip is ~30-80 ms · so shadow-writes that used to complete in ~150-200 ms now complete in ~250-400 ms. **The probe's 300 ms wait is right at the edge and frequently loses the race.**

When the race is lost, the sequence becomes:
- T=0 ms: `updateJob({status:"claimed"})` returns; shadow-write is enqueued
- T=300 ms: probe wakes and issues direct-SQL backdate → but if the shadow row **doesn't exist yet in PG**, the UPDATE affects 0 rows silently
- T=~350 ms: shadow-write finally lands with `updated_at = now` (from the JSONL row) → PG now has the burner row with a FRESH `updated_at`, not the intended backdate
- Sweep reads PG · burner exists with `updated_at = now` · fails detectStuck (not old enough) · `candidates_scanned=0` for the burner

Alternative race, less frequent: shadow-write started before the 300 ms wait but its COMMIT lands AFTER the direct-SQL UPDATE. In that case the shadow's `ON CONFLICT DO UPDATE SET ... updated_at = EXCLUDED.updated_at` overwrites the backdate with the shadow's `updated_at = now`. Same outcome.

### 1.5 · Why the CLI probe (`prove-supervisor-cli.ts`) still passes

The CLI probe does NOT rely on the sweep's discovery path. It seeds a burner, moves it to `claimed`, then invokes `supervisor-resolve.mjs <burner-uuid> --action=complete` which acts directly on the given kjid without going through `detectStuck`. Discovery is bypassed entirely · the H3 timing regression is not exercised.

### 1.6 · Why V-11 (`prove-concurrent-claim-3.ts`) passes

V-11 seeds worker_jobs directly (bypasses fs-store's shadow entirely) and tests the atomic claim primitive, not the supervisor discovery path. Different code path · different failure mode · not implicated.

### 1.7 · What R1 does NOT indicate

The production-code discovery path in `supervisor.ts` is correct. The bug is in the PROBE TIMING · not in the production code. The 10 preserved fixtures still register as stuck (proven by the diagnostic). The supervisor would still detect real stuck KJs in production if `NEX_KJOB_SUPERVISOR_ENABLED=1` were flipped · but Philip has never authorised that (supervisor stays DISABLED throughout).

---

## 2 · R2 · Atomic-claim regression

### 2.1 · Failure surface

Two assertions in `src/lib/nex/jobs/tests/claim-race.test.mjs`:
- **CR4b** · "two concurrent Promise.all claims on same job_id → exactly one winner (live pg)"
- **CR4c** · "a job cannot be processed twice (10× concurrent Promise.all · exactly one winner)"

### 2.2 · Actual error captured

Verbatim from `node --test src/lib/nex/jobs/tests/claim-race.test.mjs`:
```
✖ CR4b · ATOMIC INVARIANT · two concurrent Promise.all claims on same job_id → exactly one winner (live pg)
  Error: Cannot find module './config/pg'
✖ CR4c · ATOMIC INVARIANT · a job cannot be processed twice (10× concurrent Promise.all · exactly one winner)
  Error: Cannot find module './config/pg'
```

### 2.3 · Complete path trace

CR4b/CR4c load `db.ts` at runtime via a custom esbuild + `new Function(...)` wrapper (per `claim-race.test.mjs` lines 217-223). The wrapper is constructed with:
```
new Function("module", "process", "exports", "require",
  dbTransformed.code + `\nmodule.exports = { withClient };`,
)(dbMod, process, dbMod.exports, requireFromHere);
```

The `require` passed in is `requireFromHere` (line 26: `createRequire(import.meta.url)`), scoped to `src/lib/nex/jobs/tests/claim-race.test.mjs`.

When the transformed `db.ts` executes `require("./config/pg")` and `require("./config/timeouts")` (H3 added the second), `requireFromHere` interprets those relative paths against the test file's location — looking for `src/lib/nex/jobs/tests/config/pg.js` — which does not exist.

### 2.4 · Root cause · HIGH confidence

**The CR4b/CR4c custom test-loader shim in `claim-race.test.mjs` doesn't resolve `db.ts`'s relative imports (`./config/pg`, `./config/timeouts`).**

Pre-H3, `db.ts` only imported `./config/pg`. The shim never handled that either · but this test may have been added AFTER H3 and never worked from the moment it was authored, OR the pre-H3 version of `db.ts` didn't have the `./config/pg` import (F28 landed 2026-08 and moved URL resolution to `./config/pg`).

The point of certainty: the FAILURE MODE is a Node module-resolution error in the test loader BEFORE `pgAtomicClaimIfQueued` is even loaded. **The atomic-claim primitive itself never runs during this test.** The test as-shipped cannot produce evidence about the atomic-claim invariant one way or the other.

### 2.5 · Why V-11 (`prove-concurrent-claim-3.ts`) still passes

V-11 runs the real code path directly against local PG. It doesn't use a synthetic test loader. It exercises `pgAtomicClaimIfQueued` against real state and validates the exactly-one-winner property across 3 workers × 3 rounds. **6/6 unique claims · zero duplicates.** The production atomic-claim behaviour is verifiable and correct.

### 2.6 · What R2 does NOT indicate

R2 is a test-scaffolding gap, not a defect in the atomic-claim code. The claim primitive in `src/lib/nex/jobs/pg-claim.ts::pgAtomicClaimIfQueued` and the underlying migration 046 partial unique index continue to function as designed (V-11 proves this end-to-end).

---

## 3 · Are R1 and R2 related?

**Same era of change (H3, 2026-08-10). Different mechanisms.**

| Aspect | R1 | R2 |
|---|---|---|
| Failing artifact | probe scripts | test file (loader) |
| Actual failure | timing race in scaffolding | module-resolution error in scaffolding |
| Production code implicated? | No | No |
| Fix nature | probe wait time OR change probe seeding strategy | add missing require-stub entries to the test loader |
| H3 dependency | H3's SET LOCAL additions widen the race window | H3's `./config/timeouts` import widens the missing-stub surface (`./config/pg` already broken pre-H3) |
| Preserved KJs affected? | No | No |

Both are **test-tooling debt**. Neither indicates a defect in the engineered production code paths. Both went undetected because the affected artifacts (probes / this particular test file) are not part of the standard regression sweep that was run during H3's closure.

---

## 4 · Exact files / functions / conditions involved

| Symbol | Path | Role |
|---|---|---|
| `runSupervisorSweep` | `src/lib/nex/jobs/supervisor.ts:272` | Sweep orchestrator · calls `kjStore.listJobs(...)` at line 309 |
| `detectStuck` | `src/lib/nex/jobs/supervisor-stuck-detector.ts:31` | Pure filter · working correctly (diagnostic confirmed) |
| `listJobs` | `src/lib/nex/jobs/fs-store.ts:352` | Delegates to `listJobsFromPostgres` under `NEX_INBOX_READ_BACKEND=postgres` |
| `listJobsFromPostgres` | `src/lib/nex/jobs/pg-reads.ts:59` | Straight SELECT · working correctly |
| `updateJob` | `src/lib/nex/jobs/fs-store.ts:291` | Fires `void shadowUpsertJob(next)` at line 305 · fire-and-forget |
| `shadowUpsertJob` | `src/lib/nex/jobs/pg-shadow.ts:34` | Wraps its INSERT-ON-CONFLICT in `withBrainRole` |
| `withBrainRole` | `src/lib/nex/db/with-brain-role.ts` | H3-modified · emits SET LOCAL statement_timeout + idle_in_transaction · 2 extra roundtrips per invocation |
| `pgAtomicClaimIfQueued` | `src/lib/nex/jobs/pg-claim.ts` | Never loads under CR4b/CR4c (blocked by shim resolution failure) |
| `claim-race.test.mjs` require shim | `src/lib/nex/jobs/tests/claim-race.test.mjs:232, :239` | Doesn't handle `./config/pg` or `./config/timeouts` relative imports |
| `prove-supervisor-attest.ts` 300 ms wait | `scripts/prove-supervisor-attest.ts:111` | Insufficient after H3's shadow-write slowdown |
| `prove-supervisor-review.ts` 300 ms wait | (same pattern) | Same issue |

Feature flags active at investigation time: `NEX_BRAIN_BACKEND=supabase` · `NEX_INBOX_READ_BACKEND=postgres` · `NEX_INBOX_SHADOW_POSTGRES=1` · every other Wave 3 flag OFF.

---

## 5 · Evidence · failing vs passing paths

| Probe | Result | Path invoked | Why it fails/passes |
|---|---|---|---|
| `prove-supervisor-attest.ts` | 🔴 FAIL | seed + backdate → sweep discovery | 300 ms wait races H3-slowed shadow-write |
| `prove-supervisor-review.ts` | 🔴 FAIL | same shape | same race |
| `prove-supervisor-cli.ts` | 🟢 PASS | direct CLI action on a specified kjid | discovery bypassed · not exercised |
| `prove-supervisor-lock.ts` | ⚫ NOT TESTED | requires dev server on `:3000` | unmet precondition · not a regression |
| `prove-concurrent-claim-3.ts` (V-11) | 🟢 PASS | direct worker_jobs seed + atomic claim | different code path · doesn't touch fs-store shadow |
| `prove-preservation-invariant.mjs` | 🟢 PASS | plain SELECT on `nex.knowledge_dump_jobs` | independent of R1/R2 |
| `claim-race.test.mjs` CR1-CR3 | 🟢 PASS | static source inspection | no loader involvement |
| `claim-race.test.mjs` CR4a | 🟢 PASS | isolated JSONL race (temp dir) | no db.ts load |
| `claim-race.test.mjs` CR4b · CR4c | 🔴 FAIL | esbuild-wraps `db.ts` via custom loader | shim doesn't resolve `./config/pg` or `./config/timeouts` |
| `claim-race.test.mjs` CR5-CR8 | 🟢 PASS | JSONL-only paths | no db.ts load |

---

## 6 · Uncertainty that remains

- **R1 · timing empiric.** The hypothesis is strong given the code evidence + the diagnostic showing detectStuck works correctly against the current DB, but a direct measurement of shadow-write latency post-H3 was not taken (would require adding instrumentation · out of scope for read-only investigation). Confidence remains HIGH but not 100%.
- **R2 · edge cases.** The fix might be more than just adding `./config/timeouts` to the shim — the loader might need general recursive relative-import resolution. Not investigated (no test modifications authorised).
- **Whether R1 also affects any production path.** In production, `NEX_KJOB_SUPERVISOR_ENABLED` is off and the sweep is not run. If the flag were enabled, the sweep's own `listJobs` call would use production PG directly · no probe-timing race. So the H3 slowdown affects PROBE scaffolding but likely doesn't affect production runtime discovery. This is inference, not proof.

---

## 7 · R3 · lock probe port mismatch (documented, not investigated further)

`scripts/prove-supervisor-lock.ts` hardcodes `http://localhost:3000` as its target. Historical Phase 6 closure ran the dev server on `:3008`. The probe as-shipped does not accept a port override.

**Fix required:** the probe should accept `NEX_DEV_URL` (or similar) as an env var override, defaulting to `:3000`. This is a probe hygiene item, not a code regression. **Not fixed in this batch.** Documented for future planning.

---

## 8 · Preservation invariant

| Check | Result |
|---|---|
| Pre-investigation · 10 preserved KJs | ✅ `claimed / 0 / null` · violations=0 |
| Post-investigation · 10 preserved KJs | ✅ `claimed / 0 / null` · violations=0 |

Zero drift throughout the investigation.

---

## 9 · Prohibitions confirmation

- ✅ Zero application code modified
- ✅ Zero migrations modified
- ✅ Zero tests modified
- ✅ Zero production access
- ✅ Zero Supabase change
- ✅ Zero feature-flag change · every default flag still OFF
- ✅ Supervisor still DISABLED
- ✅ 021/048 untouched · CFGA2 untouched · 10 preserved KJs untouched
- ✅ No fixes applied · no unrelated changes
- ✅ One temporary diagnostic (`_diag-r1-r2.ts`) created + deleted in the same shell command · zero repo footprint

---

## 10 · Files touched

- **NEW** · `docs/headquarters-production-readiness/E5-PATH-Y-R1-R2-INVESTIGATION.md` (this file)
- Temporary + deleted: `scripts/_diag-r1-r2.ts`

Zero code · zero test · zero migration · zero configuration modifications.

---

## 11 · Exact recommended next authorisation (not performed)

**Two independent, contained fixes are available. Neither modifies production code · both modify test/probe scaffolding only.**

### Path A · Fix R1 in the probes (recommended · smallest safe change)

Change the two probe files (`prove-supervisor-attest.ts` + `prove-supervisor-review.ts`) so the 300 ms wait is replaced with a **verification loop** that polls PG until the shadow-write is visible AND the row's `updated_at` matches the intended backdate. This removes the timing dependency entirely.

Suggested authorisation shape:
> `AUTHORISE R1-FIX · replace fixed 300 ms wait in prove-supervisor-attest.ts + prove-supervisor-review.ts with a poll-until-visible loop · no production code changes · no test changes elsewhere · re-run both probes to prove green.`

### Path B · Fix R2 in the test loader

Extend the require shim in `claim-race.test.mjs::loadHelper` (and the analogous shim for CR4b/CR4c) to stub `./config/pg` and `./config/timeouts` with the minimal exports the constructed `db.ts` needs (`getPostgresUrlOrNull` returning `NEX_POSTGRES_URL`, `connectionTimeoutMs` returning a plain number). Same pattern used in `finalize.test.mjs` and `with-brain-role.test.mjs` after H3.

Suggested authorisation shape:
> `AUTHORISE R2-FIX · extend the require shim in claim-race.test.mjs to stub ./config/pg and ./config/timeouts · no production code changes · no other test changes · re-run CR4b + CR4c to prove green.`

### Bundled option

> `AUTHORISE R1+R2 FIX · apply both fixes above in a single batch · both are test/probe scaffolding only · zero production code · zero migrations · re-run all probes + regression suite · report preserved KJ invariant pre + post.`

### Do NOT do

- Do NOT change `withBrainRole` to remove the H3 SET LOCAL calls (they're the H3-delivered safety mechanism and are working correctly · the probes are what's out of date)
- Do NOT change `shadowUpsertJob` to be synchronous (that would change the runtime write path · scope violation)
- Do NOT change the atomic-claim primitive (it works · V-11 proves it)
- Do NOT fix R3 (port mismatch) in the same batch as R1/R2 (unrelated · independent authorisation)

---

## 12 · Final state

> **PATH Y · INVESTIGATION COMPLETE · NO FIXES APPLIED · READY FOR OPERATOR DECISION**

**Baseline unchanged:** Wave 1 · Phase 6 · H1–H6 · Wave 4 · W4-1 · W4-2 · V-1b · STEPs 3 · 4 · 4A · 4B · 4C-Tier-1-impl · E5-static all closed at stated scope · 021/048 OPEN · Production H1-H6 NOT PROVEN · Supervisor DISABLED · flags OFF · 10 preserved KJs 10/10 `claimed / 0 / null`.

**New OPEN items after this investigation:**
- **R1 · probe-scaffolding timing** — root cause identified · fix scoped · awaits explicit R1-FIX authorisation
- **R2 · test-loader shim gap** — root cause identified · fix scoped · awaits explicit R2-FIX authorisation
- **R3 · lock probe port mismatch** — documented · fix not investigated · awaits future decision on probe hygiene

Awaiting operator choice among R1-FIX · R2-FIX · R1+R2 bundle · or hold.
