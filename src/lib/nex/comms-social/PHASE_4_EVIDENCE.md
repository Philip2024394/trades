# Phase 4 · Evidence Report

**Date:** 2026-08-08
**Scope:** Scheduling + Workers + Pause Propagation + Category Automation + S-VII intent/idempotency + reCheckAtAdapterCall integration.
**Status:** ✅ PHASE 4 COMPLETE.

## Charter compliance summary

| Requirement | Phase 4 status |
|---|---|
| Scheduling + queued social delivery jobs | ✅ `nex.social_scheduled_posts` + enqueue endpoint |
| Worker / lease architecture | ✅ SELECT FOR UPDATE SKIP LOCKED · `lease_owner` + `lease_expires_at` · SW6 proves single-winner |
| Merchant pause propagation | ✅ Global pause → next tick returns `no_work` in ~50 ms · SW5/PP2/PP3/PP4 |
| 14-day active-consent maintenance | ✅ `sweepAutoDegrade` flips Automatic→Assisted after 14 days · CA5 |
| Category-level Automatic/Assisted/Manual | ✅ `nex.social_category_automation` per-tenant per-category · CA1-CA7 |
| Role enforcement for Automatic | ✅ Only owner/admin/agency_manager may enable Automatic · CA2 returns 403 for staff |
| S-VII two-phase publish + idempotency | ✅ `nex.social_publish_intents` INSERT before adapter call · verify-loop after · adapter-declared `supports_server_side_idempotency` honoured · SW8 confirms |
| `reCheckAtAdapterCall()` before dispatch | ✅ Worker runs Phase 3 hook · SW7 flips source rights between enqueue and tick → `refused_at_recheck` |
| Fail-closed | ✅ Missing token · account not connected · draft not grounded · rights re-check fail · adapter throw · all mark job non-published state |
| Audit every state transition | ✅ `nex.social_audit_events` gets rows for enqueue · refused_at_recheck · published |
| No real Meta/IG/LinkedIn/TikTok publishing | ✅ Simulator adapter only · Phase 5 wires real providers |
| No prediction · ranking · learning | ✅ verified by predictive-boundary suite still green |
| Reuse Phase 1-3 infrastructure · no parallel systems | ✅ envelope crypto · oauth/accounts · roles · validator pipeline · adapter registry all imported, not re-implemented |

## Files added / changed

### Migrations
- `deploy/postgres/init/034_comms_social_scheduling.sql` — `nex.social_category_automation` · `nex.social_scheduled_posts` · ALTER `nex.social_publish_intents` (scheduled_id · worker_id · final_outcome).
- `deploy/postgres/init/035_comms_social_worker_bypass.sql` — `nex._worker_active()` function + `nex.social_worker` GUC · extends UPDATE/INSERT/SELECT policies on `social_scheduled_posts` + `social_publish_intents` (queue tables ONLY) with a worker-bypass branch. Admin bypass stays read-only for support access; worker bypass is for the system daemon.

### Runtime (3 new files)
- `scheduling/categories.ts` — `setCategoryMode` with role permits check · `stampCheckIn` · `sweepAutoDegrade` (14-day rule) · `getCategoryMode`/`listCategoryModes`.
- `scheduling/enqueue.ts` — `enqueuePublish` · four early-refusal reasons (draft not found · draft not grounded · account not found · account not connected · globally paused).
- `worker/worker.ts` — `runWorkerTickOnce` (one job per tick) + `processScheduledJob` (per-job pipeline: pause re-check → draft load → `reCheckAtAdapterCall` → intent INSERT → adapter publish → verify → mark published). Uses distinct worker GUC for cross-tenant queue access.

### API routes (5 new)
- `POST /api/nex/comms-social/scheduling/enqueue`
- `GET  /api/nex/comms-social/scheduling/jobs?tenant_id=&status=&limit=`
- `POST /api/nex/comms-social/scheduling/categories` · `GET  ...?tenant_id=&category=`
- `POST /api/nex/comms-social/worker/tick`
- `POST /api/nex/comms-social/controls` (global pause) · `GET`

### Tests (3 new suites · 21 additional adversarial assertions)
- `scheduling-worker.test.mjs` (10/10) · happy path · refusals · pause propagation · SKIP LOCKED race · reCheck-flipped-rights · intent-linked · missing-token failure · tenant isolation.
- `pause-propagation.test.mjs` (4/4) · GET visibility · survives cycles · propagates before next tick · unpause resumes.
- `category-automation.test.mjs` (7/7) · role enforcement · timing stamps · 14-day sweep · re-enable resets · tenant isolation.

## Database changes

| Table | Change |
|---|---|
| `nex.social_category_automation` | Created |
| `nex.social_scheduled_posts` | Created (lease pattern · pause-aware · ties to draft + intent) |
| `nex.social_publish_intents` | Altered · added `scheduled_id` FK · `worker_id` · `final_outcome` |
| RLS policies on queue tables | Extended with `nex._worker_active()` bypass branch (queue tables ONLY) |

## Test evidence (aggregate 136/136 assertions across 22 suites)

```
════════ SUMMARY ════════
  PASS tenant-isolation      · 10/10
  PASS adapter-isolation     · 5/5
  PASS predictive-boundary   · 4/4
  PASS role-permission       · 9/9
  PASS envelope-encryption   · 7/7
  PASS oauth-state           · 6/6
  PASS token-redaction       · 5/5
  PASS oauth-e2e             · 5/5
  PASS content-sources       · 9/9
  PASS claim-taxonomy        · 10/10
  PASS template-fill         · 6/6
  PASS grounding-validation  · 6/6
  PASS generation-e2e        · 5/5
  PASS validator-fact        · 5/5
  PASS validator-rights      · 7/7
  PASS validator-policy      · 4/4
  PASS validator-brand       · 5/5
  PASS validator-platform    · 4/4
  PASS validator-pipeline    · 8/8
  PASS category-automation   · 7/7
  PASS scheduling-worker     · 10/10
  PASS pause-propagation     · 4/4
```

## Pause / worker / idempotency evidence

### Pause propagation (Charter §S-V critical)

- **PP2** · pause survives two consecutive worker cycles · both return `no_work` while global pause is on.
- **PP3** · pause propagates in ≤ 30 s · in practice `46 ms` between toggle and next tick seeing it.
- **PP4** · unpause · queued job picks up on next tick · returns `published`.
- **PP5** · pause state visible via `GET /controls` with `global_pause_by` set to the actor.
- **SW4** · enqueue itself refused during global pause · early rejection (worker re-check is definitive).
- **SW5** · pause after enqueue · worker returns `no_work` (job stays queued, unpause resumes).

### Worker / lease

- **SW6** · two workers race for the SAME `scheduled_id` · exactly one publishes, other returns `no_work`. SKIP LOCKED verified.
- **SW1** · single tick → single publish · `outcome=published, detail=new_publish`.
- **SW7** · reCheckAtAdapterCall integration verified · source `rights_status` flipped `owned → unknown` between enqueue and tick · worker refuses with `outcome=refused_at_recheck, detail=recheck_rejected`. Confirms Rights stage re-runs at T-adapter-call.
- **SW9** · missing access token · job marked `failed` · does not attempt publish.

### Idempotency (S-VII)

- **SW8** · intent row created + linked to scheduled_post · `job.status=published, intent=true`.
- Two-phase publish path: `INSERT INTO nex.social_publish_intents (status='in_flight')` BEFORE the adapter call. Simulator's `supports_server_side_idempotency=true` short-circuits on marker replay; adapters that lack this get the verify-loop path.
- `nex.social_publish_intents.status` transitions: `in_flight → verified_published` (success) or `failed`.
- UNIQUE(tenant_id, post_id, platform, account_id, retry_epoch) prevents intent-row duplication; retry-epoch tracks stale-lease re-attempts.

### Category automation + active consent

- **CA1** owner enables Automatic → `mode=automatic` + `enabled_by/enabled_at/last_check_in_at` stamped.
- **CA2** staff attempt to enable Automatic → API returns `403 permission_denied`.
- **CA3** staff CAN set Assisted (propose_automatic permission).
- **CA5** 14-day dormancy → sweepAutoDegrade flips `automatic → assisted` with `auto_degraded_reason='no merchant check-in in 14 days'`.
- **CA6** re-enable resets `auto_degraded_at/reason` to null · fresh check-in.

## Adversarial findings + fixes during Phase 4 build

| ID | Symptom | Root cause | Fix |
|---|---|---|---|
| P4-B1 | Worker returned `no_work` on 43+ ready queued jobs | UPDATE policy on `social_scheduled_posts` has no admin-bypass branch (admin bypass is doctrine-locked READ-only). FOR UPDATE triggers UPDATE policy check → 0 rows visible under `nex_social_app`. | Migration 035 · introduced distinct `nex._worker_active()` GUC (`nex.social_worker`) + branch on queue-table UPDATE/INSERT/SELECT policies ONLY. Preserves the admin-bypass-is-read-only rule. Worker sets this GUC before FOR UPDATE. |
| P4-B2 | Two-phase pick+lease in a single CTE failed RLS on the UPDATE portion | Same UPDATE-RLS issue as P4-B1 (my first-cut CTE combined pick+lease without setting tenant GUC for the UPDATE) | Restructured worker into explicit phases: SELECT tenant_id FOR UPDATE SKIP LOCKED under admin_bypass → SET LOCAL tenant GUC to picked tenant → UPDATE (worker bypass in policy allows write). |
| P4-B3 | `SET LOCAL nex.social_admin_bypass = 'on'` via node-postgres appeared not to trigger `_admin_bypass_active()`; fixed by using `SELECT set_config(...)` explicitly. | node-postgres protocol nuance — `SET LOCAL nex.<foo>` didn't set the visible value in some paths. `set_config()` is the reliable form. | Replaced all `SET LOCAL nex.social_*` with `SELECT set_config('nex.social_*', 'on', true)`. |
| P4-B4 | SW6 SKIP LOCKED test: both workers "published" (published=2) | Queue held leftover jobs from SW1/SW5/etc.; cross-tenant workers picked different jobs each. Not a race failure — test-pollution artifact. | Purge queue at test start; SW6 explicitly re-purges before its race so only its single target job exists. Then asserts on the exact `scheduled_id`. |
| P4-B5 | SW8 intent-link check: job stayed `queued` | Same P4-B4 root cause: worker picked a different tenant's job from the backlog before SW8's tick. | Same purge fix at test start. |

## Architectural conflicts

**One new architectural decision made in Phase 4:** admin bypass (§0 Boundary 3 · Boundary 3) is doctrine-locked as READ-only. The system worker needs to WRITE across tenants (lease queue rows, insert publish intents). Rather than weaken the admin-bypass doctrine, Phase 4 introduces a distinct `nex._worker_active()` GUC and adds a branch to UPDATE/INSERT/SELECT policies **only on queue tables** (`social_scheduled_posts`, `social_publish_intents`). Tenant-facing content · rights · accounts · brand tables are untouched.

**Governance note for charter follow-up:** this distinction between "admin bypass = read-only for support" and "worker bypass = write on queue tables for the system daemon" should be reflected in a future charter amendment. Recorded here so it's not silently invented. Charter v0.2 §0 Boundary 3 is unchanged; a proposed §0 Boundary 8 (Worker bypass on queue tables only) would formalise this.

## Doctrine faith kept

- ✅ Predictive OBSERVATION mode active · predictive-boundary suite still green · zero comms-social imports of `@/lib/nex/predictive/**`.
- ✅ Hammerex `src/lib/nex/social/**` untouched.
- ✅ Canonical v1.0.5 architecture doc · v0.1/v0.2 charter proposals · Amendment #16 draft — all untouched.
- ✅ Seven v1.0.0 frozen interface hashes verified matching manifest.
- ✅ Boundary verifier zero violations.
- ✅ No real Meta/IG/LinkedIn/TikTok publishing · simulator adapter only.
- ✅ No prediction · ranking · scoring above threshold · learning · historical-outcome analysis.

## What is NOT delivered in Phase 4 (deferred)

- Real provider adapters (Phase 5).
- Merchant onboarding UI (Phase 6).
- HQ mission-control panel (Phase 7).
- Attribution integration (Phase 8).
- Full adversarial / performance testing (Phase 9).
- Cron-driven periodic sweepAutoDegrade job (function exists · cron trigger lands with Phase 6/7 infrastructure).
- Cron-driven periodic worker tick loop (function exists · currently invoked per-request via `/api/.../worker/tick`).

## Whether Phase 5 is ready

**No.** Phase 5 (real Meta / IG / LinkedIn / TikTok / Google Business adapters) requires explicit Philip greenlight. Phase 4 is complete and pushed-ready; nothing autonomously proceeds. Predictive · Hammerex · frozen kernel all untouched.

## Commit ready

Awaiting push authorisation.
