# Runbook · Worker heartbeat missing

**Owner:** on-call engineer
**Severity:** P1 (one worker) → P0 (all workers)
**Related code:** `src/lib/nex/brain/heartbeat.ts:76-99`

## Symptom
- Factory page shows worker as "Offline" (not "Standby")
- No new `nex.worker_heartbeats` row for a worker in > 2 min
- Jobs of that worker's type queued but not being claimed

## Confirm
```sql
SELECT worker_id, worker_type, status, last_seen, now() - last_seen AS silence
FROM nex.worker_heartbeats
ORDER BY last_seen DESC;
```
Silence > 2 min = offline. Silence < 30s = healthy.

## Contain
Don't kill anything yet. Silent workers may be mid-LLM-call (long timeouts up to 60s can look silent).

If silent > 5 min → worker is dead.

## Diagnose
- Vercel function crash: logs will show the crash reason
- OOM: check function memory usage in Vercel dashboard
- Deploy interrupted mid-cycle: look at deploy log timing vs silence start
- Fly (if resurrected against advice): heartbeat stops, machine may be OOM

## Fix
1. Redeploy on Vercel — starts fresh workers on next cron-tick
2. If dead worker had a claimed job, follow `queue-stuck.md` to release it

## Verify
- New heartbeat row within 60 s of redeploy
- Queued jobs of that worker's type start clearing

## Post-incident
- If OOM: bump memory allocation
- If crash-loop: investigate the specific error and consider a code fix
