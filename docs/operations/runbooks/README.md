# NEX Operations Runbooks

Every runbook here follows the same shape:

1. **Symptom** — what an operator sees first (alert / user report / dashboard flag)
2. **Confirm** — the exact query or check that proves it's this failure
3. **Contain** — the shortest reversible action to stop bleeding
4. **Diagnose** — how to identify root cause
5. **Fix** — permanent remediation
6. **Verify** — proof the fix stuck
7. **Post-incident** — audit-log entries, follow-ups

Rule: **every step in "Contain" must be reversible.** Anything irreversible lives in "Fix" and requires a second operator sign-off before running in production.

## Current runbooks

- `queue-stuck.md` — worker jobs claimed but never completing
- `cron-stale.md` — cron didn't fire when expected
- `llm-circuit-open.md` — provider circuit breaker opened
- `storage-unreachable.md` — filesystem / Postgres / Supabase read failure
- `postgres-conn-loss.md` — Postgres connection pool exhausted or dead
- `supabase-rls-lockout.md` — RLS policy blocks legitimate reads
- `heartbeat-missing.md` — worker heartbeat silent > 2 min
- `audit-growth.md` — audit-log table growing without bound
- `inbox-backlog.md` — knowledge-inbox items piling up unprocessed
- `dead-letter.md` — poison-pill jobs on the retry queue

## Naming convention

`{subsystem}-{failure-mode}.md`. One page, one failure mode.

## Adding a new runbook

Copy `queue-stuck.md` as the template. Every runbook must include audit-log queries and evidence citations to the code path being repaired.
