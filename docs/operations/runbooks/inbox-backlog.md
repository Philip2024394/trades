# Runbook · Inbox backlog

**Owner:** on-call engineer
**Severity:** P1
**Related code:** `src/lib/nex/knowledge-inbox/**`, `dispatchNewInboxItems()` at `src/lib/nex/brain/manager.ts:405-437`

## Symptom
- `nex.knowledge_inbox` items pile up with `status='new'` for > 15 min
- Users report uploaded items not being processed
- Dashboard "Inbox pending" count rising minute-over-minute

## Confirm
```sql
SELECT status, count(*) AS n
FROM nex.knowledge_inbox
GROUP BY status
ORDER BY n DESC;

SELECT MAX(created_at) AS last_new,
       COUNT(*) FILTER (WHERE status = 'new') AS pending_new
FROM nex.knowledge_inbox;
```
Rising `pending_new` = dispatcher stalled.

## Contain (reversible)
- Manual invoke `/api/nex/brain/cron-tick` — see `cron-stale.md` for the curl
- Watch `pending_new` decrease

## Diagnose
- Cron not firing? → `cron-stale.md`
- Cron firing but not dispatching? → check `nex.audit_log` for `dispatch_dedup_hit` bursts (D1 finding — concurrent dispatches)
- Workers claiming but not completing? → `queue-stuck.md`
- Storage read failure? → `storage-unreachable.md`

## Fix
- Root cause per Diagnose branch
- If dispatchNewInboxItems is duplicating: the D1 fix (partial unique index + ON CONFLICT) prevents recurrence

## Verify
- Backlog drains over 5-10 min
- New items enter processing within 60 s of upload

## Post-incident
- If backlog grew > 100 items, consider bumping worker cadence for that window
