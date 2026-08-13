# Runbook · Cron stale (scheduled cron didn't fire when expected)

**Owner:** on-call engineer
**Severity:** P1 (per-minute crons) or P2 (daily/weekly crons)
**Related code:** `vercel.json`, `src/lib/nex/brain/auth/require-cron-token.ts`

## Symptom
- No new `worker_heartbeats` rows in > 3× the expected interval
- Reception dashboard "Last cron fire" clock frozen
- User reports "nothing is processing"

## Confirm
```sql
-- last cron-tick evidence
SELECT MAX(last_seen) AS last_heartbeat FROM nex.worker_heartbeats;

-- last inbox job dispatched
SELECT MAX(created_at) AS last_job FROM nex.worker_jobs;

-- last audit event
SELECT MAX(created_at) AS last_audit FROM nex.audit_log;
```
Any of these > 3× expected interval = cron isn't firing.

## Contain (reversible)
Manual invoke:
```pwsh
$auth = $env:CRON_SECRET
$url = "https://YOUR-DOMAIN/api/nex/brain/cron-tick"
Invoke-RestMethod -Uri $url -Headers @{ "Authorization" = "Bearer $auth" } -Method GET
```
Response should include `{ ok: true, scanned: N, ... }`. This confirms the endpoint itself works — the failure is on the scheduler side.

## Diagnose
- **Vercel side:** Vercel dashboard → your project → Deployments → most recent → "Cron Jobs" tab. Check last execution time + status per cron.
- **Auth failure:** If Vercel shows the cron ran but returned 401/403, `CRON_SECRET` may have been rotated without updating Vercel env. Check env value matches `require-cron-token.ts` expectation.
- **Deployment freeze:** If Vercel shows no recent invocations at all, verify the project isn't paused (billing / manual pause).
- **Path missing:** If Vercel logs `404`, the cron path in `vercel.json` doesn't match a `route.ts` — verify with `find src/app/api/cron -name route.ts`.

## Fix
1. Auth mismatch: update `CRON_SECRET` on Vercel to match `require-cron-token.ts` acceptance
2. Path mismatch: add missing route or remove orphaned entry from `vercel.json`, redeploy
3. Vercel paused: unpause in dashboard
4. If Vercel is having platform issues (status.vercel.com), post an incident update and wait

## Verify
- New `worker_heartbeats` row within 2 minutes of expected cron time
- `nex.worker_jobs.created_at MAX` shows recent activity
- Dashboard cron-fire clock resumes

## Post-incident
- Was the cron silently failing before the alert fired? Check log drain for prior 401/404 patterns.
- If yes: raise alert threshold for `cron_lag > 2× interval` (see `F12` in refactor plan)
