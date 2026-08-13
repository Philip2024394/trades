# Runbook · LLM circuit breaker open

**Owner:** on-call engineer
**Severity:** P1 (single provider) → P0 (all providers)
**Related code:** `src/lib/nex/brain/llm.ts:154-156` (breaker thresholds), `src/lib/nex/brain/llm.ts:495-604` (error escalation)

## Symptom
- `/api/nex/brain/llm-health` shows `circuit_open: true` for one or more providers
- LLM-dependent workers (Avery, Harper, Iris) stall
- Alert `llm_provider_failures_consecutive >= 3` fires

## Confirm
```
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/nex/brain/llm-health
```
Look for:
- `circuit: { open: true, opened_at: <ts>, cooldown_ends_at: <ts> }`
- `daily_calls` vs `budget` — is it exhaustion, not breaker?

## Contain (reversible)
Circuit auto-recovers after 60s cooldown. Do NOT force-close the circuit — the breaker exists to protect downstream cost/latency.

Instead, verify fallback chain is working:
```sql
SELECT worker_type, provider, COUNT(*)
FROM nex.worker_results
WHERE completed_at > now() - interval '5 minutes'
GROUP BY worker_type, provider;
```
Expect: other providers picking up traffic (Groq broken → fallthrough to Gemini or Anthropic).

If NO provider is completing work: this is a total-outage scenario → escalate to P0 and jump to Fix.

## Diagnose
- **Provider outage (external):** check provider status page — status.groq.com, status.google.com, status.anthropic.com
- **API-key expiry:** provider returns 401 consistently. Rotate the key.
- **Rate-limit hit:** `outcome: 429` in `nex.audit_log` for that provider. Wait for the reset window or upgrade tier.
- **Budget exhaustion:** daily-call cap in `.env` exhausted. Either raise budget or wait for UTC midnight rollover.

## Fix
### External outage (no ops action possible):
- Wait; system will auto-recover when provider returns
- If circuit is still open after cooldown but provider is healthy, restart the app (Vercel: redeploy same commit; Fly: `fly deploy`)

### Key rotated by provider:
1. Log into provider console → generate new key
2. Update Vercel env `<PROVIDER>_API_KEY` → redeploy
3. Confirm `nex.audit_log` shows `outcome: ok` within 2 min

### Budget too low:
- Raise `<PROVIDER>_DAILY_CALL_BUDGET` env value → redeploy
- Or: leave as-is and let mock fallback catch overflow (only in dev — never in prod)

## Verify
- `/api/nex/brain/llm-health` shows `circuit: { open: false }` for the provider
- `nex.worker_results` shows successful completions using that provider within 2 min

## Post-incident
- If external outage: record duration in postmortem, note whether fallback chain caught 100% of traffic
- If key rotation triggered outage: schedule proactive rotation reminder ~ 30 days before next expiry
