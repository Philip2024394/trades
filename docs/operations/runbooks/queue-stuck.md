# Runbook · Queue stuck (jobs claimed but never completing)

**Owner:** on-call engineer
**Severity:** P1 (delays user work) → P0 (if queue drains stop entirely)
**Related code:** `src/lib/nex/brain/manager.ts`, `deploy/postgres/init/041_nex_brain_schema.sql` (nex.claim_next_job SKIP LOCKED)

## Symptom
- Reception dashboard shows "jobs claimed: N, active: N" but "completed in last 5 min: 0"
- Users report inbox items sitting at `processing…` for > 10 min
- Alert `worker_jobs_claim_age_p99 > 600s` fires

## Confirm
```sql
SELECT job_id, worker_type, status, attempts, claimed_at, claimed_by,
       now() - claimed_at AS age
FROM nex.worker_jobs
WHERE status = 'claimed'
  AND claimed_at < now() - interval '10 minutes'
ORDER BY claimed_at ASC
LIMIT 20;
```
Any rows returned = stuck claims.

## Contain (reversible)
1. Check worker heartbeats to see if the claiming worker is alive:
   ```sql
   SELECT worker_id, worker_type, last_seen, now() - last_seen AS silence
   FROM nex.worker_heartbeats
   WHERE last_seen > now() - interval '1 hour'
   ORDER BY last_seen DESC;
   ```
2. If claiming worker is silent > 2 min: it's dead. Move to Fix.
3. If claiming worker is alive but not completing: check `/api/nex/brain/llm-health` for circuit-breaker open — if so, follow `llm-circuit-open.md` instead.

## Diagnose
- **Dead-worker scenario:** heartbeat gap > 2 min AND status=claimed rows accumulate. Root cause is usually process crash (OOM, deploy mid-cycle, Fly machine terminated).
- **Slow-worker scenario:** heartbeat fresh but same job in claimed for > 10 min. Usually LLM timeout on a specific provider.
- **Provider outage:** `/api/nex/brain/llm-health` shows one or more providers with `exhausted:true` or circuit `open:true`.

## Fix
### If dead worker (heartbeat gap > 2 min):
Manually release claims (requires operator sign-off):
```sql
-- Preview first
SELECT job_id, worker_type, claimed_by, attempts
FROM nex.worker_jobs
WHERE status = 'claimed' AND claimed_at < now() - interval '10 minutes';

-- Release for re-claim
UPDATE nex.worker_jobs
SET status = 'queued',
    claimed_at = NULL,
    claimed_by = NULL,
    attempts = attempts + 1
WHERE status = 'claimed' AND claimed_at < now() - interval '10 minutes';
```
Audit each row via `emitAuditEvent({ event_type: 'job_released_stuck', ... })` — or if UI CRUD exists, use it.

### If slow worker (heartbeat fresh):
- Do NOT release — you'll create duplicate work.
- Restart the worker if you have deploy access.
- Investigate `worker_results` for the specific `job_id` to see what LLM call is hanging.

## Verify
- Query in "Confirm" section returns zero rows within 5 minutes
- Dashboard `worker_jobs_claim_age_p99` drops below 60 s
- Users can retry stuck inbox items successfully

## Post-incident
- If dead-worker scenario: add reason (OOM / crash / deploy / other) to postmortem
- If slow-worker scenario: check provider-specific timing and consider raising `LlmCallOptions.timeout_ms` for that worker
- Update this runbook if you discovered a new signal
