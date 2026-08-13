# Phase 6 · Preservation Incident · Resolution

**Type:** INCIDENT RESOLUTION · authorised restoration + safety-boundary hardening
**Date:** 2026-08-10 (late)
**Status:** **INCIDENT RESTORED — SAFETY BOUNDARY HARDENED**
**Authoriser:** Philip · 2026-08-10 · "PHASE 6 INCIDENT — AUTHORISE RESTORATION + SAFETY-BOUNDARY HARDENING"
**Predecessor:** `PHASE-6-PRESERVATION-INCIDENT-FORENSIC-REPORT.md` (evidence base · treated as authoritative)

---

## 1 · Incident summary (recap)

At 2026-08-09T22:59:18-33 UTC, the Path B live probe `scripts/prove-supervisor-review.ts` called `runSupervisorSweep` against the real local NEX Postgres + Supabase-backed `brainStore()`. The sweep discovered and attested all 10 preserved fixture kjids. Forensic report captured every mutation.

This document records the authorised restoration + the technical safety boundary added so this class of accident cannot recur.

---

## 2 · The 10 affected kjids · restored state

| # | kjid | before restoration | after restoration | forensic audit id (kept) | reversal audit id (new) |
|---|---|---|---|---|---|
| 1 | `46a8eb51-617c-404b-8237-6a515ad6125a` | completed/100 | claimed/0 | `5791a2a6-…c3d8` | `<see result JSON>` |
| 2 | `56e1da78-6a97-461a-bc38-cc505d25e00a` | completed/100 | claimed/0 | `edde2651-…093d` | new |
| 3 | `ab5835b8-05c8-485e-b1ef-399fe9a48b0a` | completed/100 | claimed/0 | `93a762de-…59f3` | new |
| 4 | `47e0cf43-5e4c-4d69-a509-59e232e141f1` | completed/100 | claimed/0 | `96853054-…ac8d` | new |
| 5 | `7fc668ef-cbbc-42a4-b2ef-16e1cde41680` | completed/100 | claimed/0 | `32912b40-…d552` | new |
| 6 | `270865e6-f2ca-4fc0-8648-151417c85f64` | completed/100 | claimed/0 | `cb8e3281-…1831e` | `1e666e1f-…32d65` |
| 7 | `b1772902-7348-49cd-aed4-48d221ea2d69` | completed/100 | claimed/0 | `1e487d36-…62e5` | `fb9d9540-…8630` |
| 8 | `1e09c119-f9ed-4400-9dc7-722fc7ae223d` | completed/100 | claimed/0 | `c76a582c-…0006` | `388dca0f-…9ae7` |
| 9 | `6381641c-eb29-4007-8f3c-2942933cb62d` | completed/100 | claimed/0 | `70972677-…9fd` | `56ef079c-…4613` |
| 10 | `7e1fc4f9-efb5-4892-8d55-51b347babe1c` | completed/100 | claimed/0 | `ae12e59e-…1d74` | `e61172ad-…f4f4` |

Restoration mutations · per kjid:
1. **fs-store JSONL** — appended one new snapshot with `status='claimed', progress=0, completion_result=null, updated_at=<now>`.
2. **Local `nex.knowledge_dump_jobs`** — `UPDATE ... SET status='claimed', progress=0, completion_result=NULL, updated_at=NOW(), shadow_updated_at=NOW() WHERE job_id=$ AND status='completed'`. Row-count guard = 1 for every kjid.
3. **Supabase `public.audit_log`** — one NEW row per kjid with `actor='operator', action='claimed', before_state={status:'completed', reversal_target:<forensic-audit-id>}, after_state={status:'claimed', progress:0, completion_result:null}, notes` containing the incident report reference.
4. **Original supervisor audit rows preserved** — every one of the 10 forensic rows still exists at its original id (verified in the post-restoration read).

Full mutation transcript captured in the `incident-restore.mjs` run output (script deleted after successful execution; JSON summary retained in this document under §5).

---

## 3 · Original forensic audit references

All 10 supervisor:companion audit rows from the incident remain on Supabase `public.audit_log`, unchanged:

```
5791a2a6-7b92-4a11-bbc2-b9a55075c3d8  · 46a8eb51-...  · created 22:59:25.570774+00:00
edde2651-6e51-4827-b0ac-493ef8a9093d  · 56e1da78-...  · created 22:59:26.347836+00:00
93a762de-b616-4059-afce-31e5a38359f3  · ab5835b8-...  · created 22:59:27.039081+00:00
96853054-4aa8-49b2-bec6-740dfe39ac8d  · 47e0cf43-...  · created 22:59:27.749866+00:00
32912b40-497e-4fe2-b1fc-e567ba3ad552  · 7fc668ef-...  · created 22:59:28.463057+00:00
cb8e3281-467f-4705-8356-7ee73b1a831e  · 270865e6-...  · created 22:59:29.290071+00:00
1e487d36-9864-4582-a60b-0dc6479262e5  · b1772902-...  · created 22:59:30.407002+00:00
c76a582c-2a47-477e-a189-b433f8a40006  · 1e09c119-...  · created 22:59:31.291949+00:00
70972677-ebb2-46df-af20-6f254028d9fd  · 6381641c-...  · created 22:59:32.222708+00:00
ae12e59e-93fd-4a54-9da2-c75a83d21d74  · 7e1fc4f9-...  · created 22:59:33.428707+00:00
```

Post-restoration verification query confirmed all 10 rows still present. **They must not be deleted. Ever.**

---

## 4 · Orphan burner cleanup evidence

**Orphan:** `job_id=8ad968eb-19a5-4221-80b7-618004d86af0` · status=`queued` · title=`super-burner review probe 1786316358683-90cf7563` · inbox_item_id=`super-burner-1786316358683-90cf7563-inbox`.

Pre-cleanup verification (all passed):
- Not in the 10 preserved kjid list · confirmed
- `nex.worker_jobs WHERE input_ref = 'super-burner-...-inbox'` returned 0
- `nex.worker_results` joined via `worker_jobs.result_id` returned 0
- No legitimate downstream records

Cleanup evidence row written to Supabase `public.audit_log`:
- id `459098ee-2279-48f7-9d51-f19d45bf4fd3`
- actor=`operator` · action=`orphan_cleanup` · before_state=`{status:'queued', title:..., inbox_item_id:...}` · after_state=null
- notes reference this resolution + the incident report

Then `DELETE FROM nex.knowledge_dump_jobs WHERE job_id = '8ad968eb-...'` — 1 row removed. Post-verification: 0 rows for that job_id.

fs-store JSONL retains the original burner snapshot (append-only) as historical trace.

---

## 5 · Restoration script output (verification summary)

```json
{
  "restored": 10 (all 10 kjids · before completed/100 → after claimed/0 · reversal audit ids captured),
  "orphan_cleanup": {
    "orphan_id": "8ad968eb-19a5-4221-80b7-618004d86af0",
    "evidence_audit_id": "459098ee-2279-48f7-9d51-f19d45bf4fd3"
  },
  "verification": {
    "post_status_all_claimed":         true,
    "post_progress_all_zero":          true,
    "post_completion_result_all_null": true,
    "forensic_rows_intact":            true,
    "reversal_rows_written":           true,
    "orphan_gone":                     true
  }
}
```

Every flag green. Every original forensic row still present. Every restoration mutation bounded to the 10 fixtures + 1 orphan.

---

## 6 · Safety-boundary implementation

### 6.1 · Root cause revisited
The pre-incident supervisor entrypoint had **no allow-list parameter**. Probes had to either bypass the sweep (impossible without duplicating the classifier + apply path) OR accept that whatever `listJobs` returned as claimed+stuck would be processed. Neither was safe. The `NEX_KJOB_SUPERVISOR_ENABLED` gate was enforced only at the ROUTE, not at the module boundary.

### 6.2 · Change · `src/lib/nex/jobs/supervisor.ts`

Added two options to `SupervisorRunOptions`:

```ts
probe_mode?: boolean;
only_kjids?: string[];
```

Enforcement, at the top of `runSupervisorSweep` BEFORE any DB access:

```ts
if (opts.probe_mode === true) {
  if (opts.only_kjids === undefined) throw new Error("[supervisor] probe_mode=true requires opts.only_kjids to be defined · refusing sweep · ...");
  if (!Array.isArray(opts.only_kjids)) throw new Error("[supervisor] probe_mode=true requires opts.only_kjids to be an array · got " + typeof opts.only_kjids);
  if (opts.only_kjids.length === 0)    throw new Error("[supervisor] probe_mode=true requires opts.only_kjids to be non-empty · refusing sweep");
}
```

Application, at the discovery boundary (after `detectStuck`, before classifier/action):

```ts
const stuckAll = detectStuck(allClaimed, cfg, now);
const stuck = opts.only_kjids
  ? stuckAll.filter((kj) => opts.only_kjids!.includes(kj.job_id))
  : stuckAll;
```

Structured-log visibility · in `sweep_started`:

```ts
log.info("sweep_started", {
  batch_id, max_per_tick, stuck_after_min,
  probe_mode: opts.probe_mode === true,
  only_kjids: opts.only_kjids ?? null,
});
```

Plus an `allow_list_filtered` log line when rejections happened.

### 6.3 · Explicit non-relies (design commitments)

- `MAX_PER_TICK` is **not** a safety mechanism — it caps work per tick; it doesn't scope which KJs are eligible.
- The probe's own uuid-guard is **not** a safety mechanism — it only checks the probe's burner uuid; it doesn't stop the sweep from discovering other KJs.
- The operator runbook is **not** the only protection — the runbook says "start at MAX_PER_TICK=1"; that would still have attested ONE preserved fixture.

The technical safety boundary now lives in the supervisor module itself. Probes that call it with `probe_mode: true` **cannot** touch anything outside their allow-list. Probes that forget `probe_mode: true` while still passing an `only_kjids` still get the filter (operator-override semantics). Production sweep from the route handler passes neither → full-sweep backward-compat preserved.

---

## 7 · Tests proving allow-list isolation

New file: `src/lib/nex/jobs/tests/supervisor-safety-boundary.test.mjs` · 8 tests · all green.

| ID | Test | Purpose |
|---|---|---|
| SB1 | `probe_mode=true + only_kjids=undefined` → throws | fail-closed on missing list |
| SB2 | `probe_mode=true + only_kjids=[]`        → throws | fail-closed on empty list |
| SB3 | `probe_mode=true + only_kjids=[burner]` · 3 real KJs discovered · only burner processed · **the three real KJs remain `claimed` post-sweep** | core allow-list isolation |
| SB4 | `probe_mode=true + only_kjids=[b1,b2]` · 10 real KJs discovered · only b1+b2 processed · **zero audit rows for the 10 real KJs** | allow-list holds under load |
| SB5 | `probe_mode` omitted + no `only_kjids` → full sweep (backward-compat) | production path unaffected |
| SB6 | `probe_mode=false` + `only_kjids=[a]` → filter still applies (operator override) | non-probe scoping still works |
| SB7 | Source drift-catcher — asserts the source of `supervisor.ts` contains the guard expressions | prevents silent removal in future refactors |
| SB8 | The 10 preserved fixture prefixes present in the incident-report doc | historical evidence not silently deleted |

Additionally: the existing `preservation · no test file references any of the 10 real stuck kjids` drift-catcher in `supervisor-idempotency.test.mjs` still passes; the new safety-boundary test is explicitly excluded because its role is to CHECK the preservation, not violate it.

**Full supervisor suite: 42/42 green. Classifier vitest suite (retained): 17/17 green.**

---

## 8 · UUID-contract finding (Phase E)

The incident exposed a real API gap: `createJob()` in `src/lib/nex/jobs/fs-store.ts` **generates its own UUID** via `randomUUID()` at the top of the function. The `job_id` field on the input is silently ignored. The probe's cleanup step used the wrong uuid because it trusted an input that was never persisted.

**Contract as documented (not changed):**
- `createJob(input)` returns a `KnowledgeJob` whose `job_id` is server-assigned.
- Callers MUST capture `returned.job_id` and use that for any subsequent operation.
- Existing callers do this correctly. The Phase 6 probes did NOT. That was the probe's bug.

**Not changed:** `createJob()` behaviour. Changing the API would break every existing caller and requires separate authorisation.

**Documented via the safety-boundary test suite:** any future probe that instantiates a burner KJ via `createJob` MUST use the returned uuid for both the sweep's `only_kjids` allow-list and for cleanup. This is enforced by convention + code review; a stronger machine-check (e.g. a lint rule) can be added later if drift is observed.

---

## 9 · Additional discoveries

### 9.1 · Supabase env-var pair ambiguity
During restoration, the naïve `.env.local` resolution `NEX_SUPABASE_URL || SUPABASE_URL` combined with `NEX_SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY` produced a URL/key mispairing when `NEX_SUPABASE_URL` was unset — resulting in "Invalid API key" errors. The SupabaseStore adapter's resolution order is `NEX_SUPABASE_URL || NEXT_PUBLIC_NEX_SUPABASE_URL || SUPABASE_URL` for URL and `NEX_SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY` for KEY. The restoration script matched THAT same order to write to the same project the incident wrote to.

**Follow-up recommendation (not authorised this session):** add a paired-resolution helper in `src/lib/nex/brain/storage.ts` that returns `{url, key, project_label}` from a single pair, refusing to mix. Would prevent future scripts from silently targeting the wrong project.

### 9.2 · The 10 fixtures are now legitimately claimed again
Post-restoration, each of the 10 kjids has 4 snapshots in fs-store JSONL (queued → claimed → completed (incident) → claimed (restoration)) and 2 audit rows on Supabase (supervisor:companion, then operator). The narrative is fully auditable end-to-end.

### 9.3 · Reconciliation drift with pre-existing incident-report doc
Some fixture uuids appear in both the forensic report (§3, §4.5) and the restoration script. The safety-boundary test SB8 asserts the incident report continues to list all 10 · so future refactors that accidentally rewrite the report will fail loudly.

---

## 10 · Remaining Phase 6 verification requirements

For Phase 6 to reach `VERIFIED — LOCAL LIVE` (a separate authorisation from this incident-resolution work), the following are still open:

1. **Update the three probe scripts** to pass `probe_mode: true, only_kjids: [<burner-uuid returned by createJob>]`:
   - `scripts/prove-supervisor-attest.ts`
   - `scripts/prove-supervisor-review.ts`
   - `scripts/prove-supervisor-lock.ts` (advisory-lock probe · no store discovery · but still should carry `probe_mode: true` for consistency once it invokes any store surface)
2. **Author the three probes' cleanup path** to use the uuid RETURNED by `createJob`, not the uuid the probe generated locally.
3. **Do NOT re-run the probes yet.** Per Philip's directive, the next step after this resolution report is to **test the safety boundary itself** (done · SB1-SB8 pass). Only THEN should the probes re-run · and only after Philip's separate authorisation for that step.
4. **Preservation drift-catcher extension (optional)** — add a runtime check that scans `scripts/prove-supervisor-*.ts` files for the pattern `runSupervisorSweep(` + confirms the same call site sets `probe_mode: true` + a non-empty `only_kjids` literal or variable. Would catch a future probe that forgets the guard.

---

## 11 · Prohibitions honoured

Per Philip's directive:
- No supervisor sweep run without allow-list ✓
- No probe re-run before new safety boundary was tested ✓ (tested with fakes only · SB1-SB8)
- Supervisor not enabled in production ✓ (`NEX_KJOB_SUPERVISOR_ENABLED` never set)
- No real stuck KJs recovered (the restoration returned them to claimed, not recovered them) ✓
- The 10 original forensic audit rows are unmodified ✓
- Supabase `worker_jobs` untouched ✓ (verified in forensic report §4.7)
- Supabase `worker_results` untouched ✓ (same)
- `NEX_BRAIN_BACKEND` unchanged ✓ (still `supabase`)
- No production migrations applied ✓
- Wave 3 not begun ✓
- Phase 6 NOT declared VERIFIED ✓
- Phase 6 NOT declared PRODUCTION-PROVEN ✓

---

## 12 · Final status

**INCIDENT RESTORED — SAFETY BOUNDARY HARDENED.**

- 10 preserved fixtures back in original `claimed / progress=0 / completion_result=NULL` state on both fs-store and local NEX Postgres shadow.
- 10 original forensic audit rows preserved as immutable evidence on Supabase.
- 10 new operator/claimed audit rows written on Supabase recording the authorised reversal.
- Orphan burner removed; evidence audit written.
- Safety boundary technically enforced in `supervisor.ts`; 8 contract tests prove the enforcement holds against a synthetic 10-real-KJ discovery scenario.
- UUID contract documented; probe scripts flagged for update as the next authorised step.
- Full supervisor suite: 42/42 · Classifier suite: 17/17 · Safety-boundary suite: 8/8.

**Phase 6 status remains: NOT VERIFIED · NOT PRODUCTION-PROVEN.** The next authorisation should update the probe scripts to use `probe_mode: true` + `only_kjids: [burnerUuid]` and re-run them against local NEX Postgres · not before.

---

## 13 · Stop condition

Restoration complete. Safety boundary hardened. No further mutations. Awaiting the next authorised step — which per Philip's directive should be the probe-script update, then a real local burner test with the allow-list · not any broader operation.

**Stop.**
