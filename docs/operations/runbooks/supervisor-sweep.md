# Runbook · Supervisor Sweep (W-C-COMPANION Phase 6)

**Owner:** on-call engineer / master AI engineer
**Governs:** the KnowledgeJob supervisor described in `docs/headquarters-production-readiness/W-C-COMPANION-PHASE-6-DESIGN.md`
**Preserves:** the 10 real stuck KJs in `nex.knowledge_dump_jobs`. Do NOT run the recovery sweep against production until Philip explicitly authorises.

---

## What it does

The supervisor sweeps `nex.knowledge_dump_jobs` for stuck-claimed rows and either:
- **Path A · attest** — proves the extractor already completed (via `worker_results.output_kind='record_draft'`) and transitions the KJ to `completed` without re-driving LLM work.
- **Path B · review queue** — writes a `supervisor-review-required` row to `audit_log` when evidence is insufficient; operator inspects + resolves via CLI.
- **Path C · positive cascade** — already lives in the extractor (`applyTerminalKnowledgeJobTransition`), not this sweep's concern.

## Enable / disable

Environment variable **only**. Change requires redeploy.

| Env var | Purpose | Default | Recommended first-run |
|---|---|---|---|
| `NEX_KJOB_SUPERVISOR_ENABLED` | Master gate. Unset → sweep is a 200 no-op. | unset | `1` |
| `NEX_KJOB_SUPERVISOR_MAX_PER_TICK` | KJs processed per sweep | `25` | **`1`** for first recovery run |
| `NEX_KJOB_SUPERVISOR_STUCK_AFTER_MIN` | Wall-clock threshold in minutes | `30` | leave as default |
| `CRON_SECRET_SUPERVISOR` | Scoped token for `/api/nex/brain/supervisor-sweep` | unset (falls back to shared `CRON_SECRET`) | Set a distinct value for defence-in-depth |

## Cron schedule

Proposed for `vercel.json` (NOT yet added — awaits deployment authorisation):
```
{ "path": "/api/nex/brain/supervisor-sweep", "schedule": "*/7 * * * *" }
```

Rationale: 7 minutes stays inside the design's 5-10 min window and is relatively prime with the 1-minute `cron-tick`.

## Recovery of the 10 preserved stuck KJs (Cohort A + Cohort B)

**Do NOT execute without Philip's explicit go per recovery step.**

1. Confirm deployment tree contains the Phase 6 files (`supervisor.ts`, `supervisor-sweep/route.ts`).
2. On Vercel Project Settings, set:
   - `NEX_KJOB_SUPERVISOR_ENABLED=1`
   - `NEX_KJOB_SUPERVISOR_MAX_PER_TICK=1`
   - Optional: `CRON_SECRET_SUPERVISOR=<new 32-hex>`
3. Redeploy. Wait for one cron tick (7 min).
4. Trigger manually as sanity check:
   ```
   curl -H "Authorization: Bearer $CRON_SECRET_SUPERVISOR" \
     https://<domain>/api/nex/brain/supervisor-sweep
   ```
   Expect response like:
   ```
   { "ok": true, "disabled": false, "result": { "candidates_scanned": 1, "attested": ["<kjid>"], ...} }
   ```
5. Verify in Supabase (or wherever `brainStore()` currently points):
   ```
   SELECT status, updated_at, completion_result
     FROM nex.knowledge_dump_jobs
    WHERE job_id = '<kjid>';
   ```
   Expect `status='completed'`.
6. Verify audit row:
   ```
   SELECT * FROM nex.audit_log
    WHERE entity_type='knowledge_jobs'
      AND entity_id='<kjid>'
      AND action='completed'
    ORDER BY created_at DESC LIMIT 1;
   ```
7. If step 5+6 look correct, raise `NEX_KJOB_SUPERVISOR_MAX_PER_TICK` to `25` and redeploy.
8. Sweep will process remaining Cohort-A jobs on next ticks. Watch dashboard / logs for `supervisor.error` counter.
9. Cohort B (Path B) will populate the review queue:
   ```
   SELECT entity_id, after_state->>'recommended_action' AS action, notes, created_at
     FROM nex.audit_log
    WHERE entity_type='knowledge_jobs' AND action='supervisor-review-required'
    ORDER BY created_at DESC;
   ```
10. Operator inspects each Path-B row. For each kjid:
    ```
    node scripts/supervisor-resolve.mjs <kjid> --action=requeue|mark_failed|complete --note "reason"
    ```
    If the kjid matches a preserved-fixture 8-char prefix, add `--force-preserved` after reviewing the audit trail.

## Path B follow-through decision matrix

| `recommended_action` | Typical meaning | Operator choice |
|---|---|---|
| `requeue`             | No worker chain ran · safe to re-drive · nothing spent | `--action=requeue` (returns KJ to `queued`; manager will re-dispatch) |
| `mark_failed`         | Extractor terminal · no drafts produced · LLM already spent | `--action=mark_failed` (records the fact + closes) |
| `manual_investigate`  | Worker chain partial · ambiguous | Look at underlying `worker_jobs` + `worker_results`; usually `mark_failed` unless workers are still in flight (rare after 30 min) |

## Emergency stop

`NEX_KJOB_SUPERVISOR_ENABLED` → unset (or any value ≠ `"1"`) → redeploy. Next tick returns `{ ok: true, disabled: true }`. Zero writes.

## Observability

Counters (via `/api/nex/observability/metrics`):
- `supervisor.sweep_started` · `supervisor.sweep_completed`
- `supervisor.kj_attested` · `supervisor.kj_review_queued`
- `supervisor.path_a_fallthrough` · `supervisor.cascade_terminal`
- `supervisor.error`

Signals (via structured logs / future log-drain):
- `sweep-completed` — per sweep summary
- `review-queued` — per Path-B enqueue
- `escalation-required` — KJ in review queue > 72 h
- `sweep-skipped-concurrent` — advisory lock held
- `error` — per-KJ failure

Recommended alert rules (once dispatcher lands):
- `supervisor.error gt 3 window=300 severity=p1`
- `supervisor.kj_review_queued gt 10 window=3600 severity=p2`
- `supervisor.sweep_completed lt 1 window=1200 severity=p1`  ← sweep silent for 20 min = 3× cadence

## Rollback

- Env-var rollback: unset `NEX_KJOB_SUPERVISOR_ENABLED`, redeploy. Effect: no future sweeps. Existing attestations are NOT reverted.
- Data rollback per attested KJ: `UPDATE nex.knowledge_dump_jobs SET status='claimed', updated_at=NOW() WHERE job_id='<kjid>'`. Not automated. Auditable via the `writeKnowledgeJobTransitionAudit` row.
- Data rollback per review-queue row: `DELETE FROM nex.audit_log WHERE id='<row-id>'`. Not automated.

## Failure playbook

| Symptom | Likely cause | Action |
|---|---|---|
| `/api/nex/brain/supervisor-sweep` → 401 | Bad `CRON_SECRET` / `CRON_SECRET_SUPERVISOR` | Verify env; regenerate token |
| `/api/nex/brain/supervisor-sweep` → 500 | `advisory_lock_pool_unavailable` OR sweep body threw | Check DB connectivity; check `supervisor.error` counter; inspect route logs |
| `skipped_concurrent: true` every tick | Advisory lock never released (stuck open transaction) | Restart the process holding it (Vercel redeploy releases pool) |
| Sweep runs, `candidates_scanned: 0` for hours, but you know jobs are stuck | Check `NEX_KJOB_SUPERVISOR_STUCK_AFTER_MIN` (may be too high) OR `progress` field on the stuck rows (must be 0) |
| Path A attested a KJ operator didn't want attested | Check the audit row for evidence used; if extraction really did happen, attest was correct. If not, `UPDATE` back to `claimed`, investigate why `record_draft` existed. |

## Related

- Design: `docs/headquarters-production-readiness/W-C-COMPANION-PHASE-6-DESIGN.md`
- V2 architecture: `WORLD-CLASS-OPS-W-C-COMPANION-SUPERVISOR-DESIGN-V2.md`
- Storage contract: `WORLD-CLASS-OPS-W-C-STORAGE-CONTRACT-EXTENSION-DESIGN.md`
- Stuck-claimed forensics: `WORLD-CLASS-OPS-W-C-STUCK-CLAIMED-INVESTIGATION.md`
- Architectural stance: `docs/headquarters-production-readiness/ARCHITECTURAL-STANCE.md`
