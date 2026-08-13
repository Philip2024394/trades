# Runbook · Audit-log table growth unbounded

**Owner:** on-call engineer
**Severity:** P2 (query slowdown) → P1 (approaching disk limits)
**Related code:** `nex.audit_log`, `nex.compliance_events`, `nex.events`

## Symptom
- Queries against `nex.audit_log` slow (> 1s for filtered reads)
- Storage warning from provider
- Dashboard queries time out

## Confirm
```sql
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS size,
       n_live_tup, n_dead_tup
FROM pg_stat_user_tables
WHERE schemaname = 'nex'
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
```
Any table > 5 GB warrants a plan.

## Contain (reversible)
- Add a covering index for common query patterns if missing
- Rewrite hot queries with tighter time-window filters

## Diagnose
- Are we writing at the expected rate, or has a caller started duplicate-writing?
- Is there an ON DELETE anywhere expected to prune, that isn't running?

## Fix
1. **Archive strategy** (safest): move rows > 90 days to `nex.audit_log_archive` on the same DB with cheaper index; keep last 90d hot
2. **Cold storage**: dump-and-drop rows > 1 year to Postgres COPY, store in `nex.object_blobs` bucket `archive`
3. Never `DELETE FROM nex.audit_log WHERE created_at < now() - interval '1 year'` in one shot on a large table — use `DELETE ... LIMIT 10000` loop in a background job

## Verify
- Table size reduced
- Query latency returns to < 200 ms P99

## Post-incident
- Schedule the archive job as a monthly cron
- Set a size-based alert (> N GB warrants review)
