# Runbook · Dead-letter jobs (poison pill on the retry queue)

**Owner:** on-call engineer
**Severity:** P2 (single job) → P1 (recurring pattern)
**Related code:** `nex.llm_retry_queue`, `completeWithRetryPersistence()` at `src/lib/nex/brain/llm.ts:615-665`

## Symptom
- `nex.llm_retry_queue` has rows with `attempts >= max_attempts` and `status = 'failed'`
- Same job re-enqueues repeatedly, exhausts retries, dies
- Alert `llm_retry_queue_dead_letter_count > 0` fires

## Confirm
```sql
SELECT job_id, worker_type, attempts, max_attempts, last_error_snippet, updated_at
FROM nex.llm_retry_queue
WHERE status = 'failed' AND attempts >= max_attempts
ORDER BY updated_at DESC
LIMIT 20;
```

## Contain
Don't auto-retry. A dead-letter job is dead-letter *because* every retry failed. Blindly retrying wastes budget.

## Diagnose
Read the `last_error_snippet`:
- `invalid_response` → the LLM returned malformed JSON. Was the schema updated recently?
- `429` → provider budget hit. Move to `llm-circuit-open.md`.
- `timeout` → payload too large for the provider's timeout. Consider splitting input.
- `network_error` → intermittent; may resolve with next retry after cooldown.

Also look at `worker_jobs.input_payload` for the same `job_id` to see what the actual input was.

## Fix
### Recoverable (code fix + one-off retry)
1. Fix the code path
2. Reset the retry row:
   ```sql
   UPDATE nex.llm_retry_queue
   SET status = 'queued', attempts = 0, last_error_snippet = NULL, updated_at = now()
   WHERE job_id = '<uuid>';
   ```
3. Next manager cycle picks it up

### Unrecoverable
1. Mark the source `nex.worker_jobs` row as `status = 'dead_letter'` with an audit entry
2. Move to `nex.worker_jobs_archive` (or leave for investigation)
3. If the source was a user upload, respond with a graceful error message in the UI

## Verify
- Job either completes on retry or is cleanly parked in dead-letter
- Retry queue doesn't accumulate the same job endlessly

## Post-incident
- If pattern (same failure across many jobs): add a specific classifier in `llm.ts` to fail-fast instead of retrying
