# Runbook · Storage unreachable

**Owner:** on-call engineer
**Severity:** P0 (writes fail) → P1 (reads degrade)
**Related code:** `src/lib/nex/storage/**`, `getObjectStorage()` at `object-registry.ts:48`

## Symptom
- User request 500s with `ENOENT`, `ECONNREFUSED`, or `PGRST*` codes
- `nex.audit_log` bursts with `outcome: storage_error`
- Dashboard subsystem tile red for storage

## Confirm
Determine which storage tier is failing:
```sql
-- Postgres reachability
SELECT now(); -- if this errors, PG connection is down

-- Object storage
SELECT count(*) FROM nex.object_blobs;
```
If PG queries themselves fail, jump to `postgres-conn-loss.md`.
If a specific object-storage `get()` returns null but the DB is fine, it's a per-object issue not a tier failure.

## Contain (reversible)
For **image-analyst ENOENT** (pre-Phase-3a items after Wave 6):
- The legacy filesystem-fallback path still exists. If a job fails once, re-enqueue it and it will retry via the object-store adapter.
- Do NOT flip `NEX_OBJECT_BACKEND` back to filesystem in production — that's a step backwards.

For **Supabase RLS lockout** during transition period:
- Jump to `supabase-rls-lockout.md`.

## Diagnose
- Filesystem: `data/` dir mounted? Disk full? — check the deploy environment.
- Postgres: connection pool exhausted, replication lag, or credential rotation broken?
- Supabase: outage at status.supabase.com?

## Fix
### Filesystem (dev-only)
- Free disk space, ensure `data/` mount survives
- Should not occur in production post-Wave 6

### Postgres
- Restart connection pool (redeploy)
- Rotate DB password if credential is stale
- Check `pg_stat_activity` for hung queries

### Supabase
- If external outage: post incident + wait
- If credential: rotate service-role key on both Supabase dashboard and Vercel env

## Verify
- Fresh `nex.audit_log` rows within 2 min showing `outcome: ok`
- User can complete an upload or read successfully
- Dashboard subsystem tile returns green

## Post-incident
- Was there a preceding alert we missed? Add finer-grained health-check if so
- If tier failed silently for > 5 min before detection, tighten the alert threshold
