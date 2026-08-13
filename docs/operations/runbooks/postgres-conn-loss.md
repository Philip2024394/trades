# Runbook · Postgres connection loss

**Owner:** on-call engineer
**Severity:** P0
**Related code:** `src/lib/nex/storage/adapters/**postgres*`, `NEX_POSTGRES_URL` env

## Symptom
- Every `nex.*` query 500s
- `PGRST*` / `ECONNREFUSED` / `pool timeout` in logs
- Vercel function errors climb sharply

## Confirm
From a terminal that can reach the DB:
```
psql "$NEX_POSTGRES_URL" -c "select now();"
```
If this fails: outage confirmed.

## Contain (reversible)
- Vercel redeploy (drops all live connections, opens fresh pool)
- If pool exhaustion: this alone often fixes it

## Diagnose
1. **Pool exhaustion:** `SELECT count(*) FROM pg_stat_activity;` on the DB. If near `max_connections`, kill long-running queries or raise the pool cap.
2. **Credential rotation broken:** password changed on DB but not in Vercel env. `psql` will return `authentication failed`.
3. **Network partition:** VPC / firewall / DNS. `nslookup` the host.
4. **Provider outage:** if using managed PG (Supabase, Neon, RDS), check provider status.

## Fix
### Pool exhaustion
```sql
-- Find offenders
SELECT pid, usename, state, wait_event, query
FROM pg_stat_activity
WHERE state != 'idle' AND now() - query_start > interval '5 minutes';

-- Terminate one
SELECT pg_terminate_backend(<pid>);
```
Then tune `pool_size` in the connection string / adapter.

### Credential
- Update `NEX_POSTGRES_URL` on Vercel + local `.env.local`
- Redeploy

### Network / provider
- Wait, escalate to provider, no local fix

## Verify
- `psql "$NEX_POSTGRES_URL" -c "select 1"` returns `1`
- Vercel function errors drop
- Fresh writes appear in `nex.audit_log`

## Post-incident
- What alerted us? If nothing, add a periodic health-check hitting `nex.audit_log`
- If pool exhaustion: raise cap or investigate whether an endpoint is leaking connections
