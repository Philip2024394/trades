# HEADQUARTERS OPERATIONAL AUDIT · PHASE B

**Status:** DRAFT · day-2 ops gaps enumerated
**Date:** 2026-08-10
**Author role:** Master AI engineer · NEX Corporation
**Objective:** Cover backup / DR / monitoring / on-call / incident-response — the categories master audit Section 12 explicitly says are unaudited.
**Rule:** Foundation is strong; the gaps are in *operator experience*, not correctness.

---

## Executive summary

Zero P0 operational blockers at deployment time. The system will boot and process work correctly. What's missing is the day-2 layer: operators will fly with weak monitoring export, no runbooks, and no incident-response playbook. This audit enumerates every gap and grades severity so a 4-week sprint can close it.

| Category | Count | Impact |
|---|---|---|
| P0 | 0 | ✅ None |
| P1 (ops maturity) | ~15 | Operators blind day 1 without them |
| P2 (deferrable ~4 weeks) | ~10 | Nice-to-have soon, safe to defer |
| P3 | 1 | Cleanup |

---

## Section 1 · Backup / restore / PITR

### 1.1 Supabase (managed)
**Status: ✅ DOCUMENTED · PARTIALLY IMPLEMENTED**

Evidence: `docs/TRADE_OS_SPEC/NEX_BACKUP_ARCHITECTURE.md` (174 lines).
- Full backups every Sunday; incrementals Mon-Sat
- Restore flow: preview + mandatory pre-snapshot + confirm-gated execute
- Storage: private bucket · 5-min signed URLs · SHA-256 integrity
- Automation: cron `/api/cron/nex-backup-daily` in `vercel.json`
- 84 passing tests (integrity helpers + table ordering)

**Gap:** Teaching-upload file bytes not currently included in backups (documented, deferred).

### 1.2 NEX Postgres (self-hosted)
**Status: ⏳ READY · EXECUTION PENDING**

Wave 5 machinery already built (master audit line 402):
- `scripts/brain-parity-report.mjs` — 73,233 rows across 11 tables identified
- `scripts/brain-backfill.mjs` — 154 chunks · ON CONFLICT DO NOTHING · idempotent
- reverse-shadow decorator `MirrorToSupabaseBrainStore` — 15/15 contract tests

**Critical gap:** Backfill `--execute` not authorised. No rollback rehearsal.

### 1.3 Filesystem data directories
**Status: ❌ NO BACKUP FOUND**

- `data/knowledge-inbox/files/`, `data/nex-events/events.jsonl`, `data/nex-brains/{slug}/memories.jsonl`
- Wave 3 removes filesystem dependency for inbox files; per-brain memories + Event Bus remain filesystem-primary in dev.
- In production, filesystem loss = permanent knowledge loss.

### 1.4 Object storage
**Status: ✅ ARCHITECTURE PROVEN**

`nex.object_blobs` + `nex.object_blob_current` verified live (Harper end-to-end, master audit line 400). Contract test 17-assertion suite passes.

**Gap:** No PITR / no S3-style Glacier tier. Hard deletes are permanent.

---

## Section 2 · Disaster recovery runbook · ❌ MISSING

Zero executable runbook files. Missing coverage for 10 critical failure modes:
1. Storage unreachable (filesystem ENOENT / Postgres conn loss / Supabase RLS lockout)
2. Queue backlog (jobs claim-locked / retry overflow)
3. Worker heartbeat missing (offline detection / force-restart)
4. Dead-letter jobs (poison-pill / manual intervention)
5. LLM provider outage (circuit breaker open / rate-limit / API-key rotation)
6. Cron failure cascade (stale runs / double-fire prevention)
7. Inbox processing stall (backlog / disk full)
8. Brain records duplication (constraint violation recovery)
9. Audit trail exhaustion (table growth / query performance)
10. Custom alert threshold tuning (operator-initiated · no current UI)

---

## Section 3 · Monitoring / alerting stack

### 3.1 Implemented (foundation is strong)

- Observability counters: 14 named metrics at `src/lib/nex/observability/counters.ts` (worker_jobs_claimed / worker_results_ok / llm_calls / storage_reads / etc.)
- Outcome type: `Outcome<T>` discriminated union at `src/lib/nex/observability/outcome.ts`
- Signal emission: bounded JSON with 240-char cap + secrets-redacted at `src/lib/nex/observability/signals.ts`
- SystemHealthPanel dashboard renders subsystem status + 12 hardcoded alert rules
- Reliability substrate: 10-provider LLM circuit-breaker chain · exponential backoff with jitter · retry buffer (capacity 1000) · chaos-test adapter

### 3.2 Missing (creates operator blindness)

- **Sentry / Datadog / Prometheus:** zero integration
- **Metrics export endpoint:** no `/api/nex/observability/metrics` Prometheus route
- **Log aggregation:** `vercel.json` has no `logDrains` key. Vercel logs evaporate at 24h · Fly logs at 7d
- **Structured logging:** hundreds of plain `console.log` calls · no JSON wrapping with `job_id`/`brain_id`/`correlation_id`
- **Alert threshold CRUD:** hardcoded in React component; operator cannot tune without code push
- **SLO / SLI contract:** no documented uptime target · latency SLA · error-rate threshold
- **Incident correlation:** no automatic grouping by subsystem or correlation_id + time proximity
- **MTTD / MTTA / MTTR targets:** not defined

---

## Section 4 · On-call rotation · ❌ MISSING

- No rotation table
- No PagerDuty / Opsgenie integration
- Alerts dispatch to static env-var recipients only
- No escalation policy

---

## Section 5 · Incident response · ❌ PLAYBOOK MISSING

`docs/headquarters-production-readiness/` contains 8 audit documents + investigation records — zero post-incident runbooks. Missing:
- Incident response flow (alert → page → triage → mitigate → validate → RCA)
- Postmortem template
- RCA evidence linking (correlation_id → related alerts → affected records)

---

## Section 6 · Deployment procedures

### 6.1 Vercel (frontend + API) — ⏳ PARTIALLY DOCUMENTED
- `vercel.json`: 28 crons registered (7 orphaned per Vercel A3 audit)
- ES-06 spec covers CI/CD (lint → typecheck → vitest → build → preview → staging → prod)
- Branch protection: 1-review · passing CI · linear history
- **Missing:** rollback SOP · staged rollout config · post-deploy smoke-test automation

### 6.2 Fly · ✅ DECOMMISSIONED
Both machines scaled to 0 (2026-08-09T19:40Z). Startup guard `NEX_WORKER_CONSENT_V2=YES` prevents accidental resurrection. Recommend `fly apps destroy` after 7-day post-cutover stability window.

### 6.3 Database migrations · ⏳ 45 APPLIED · SAFETY TESTING MISSING
- Files numbered 001-045 across Postgres + Supabase layering
- **Missing:** pre-deploy backup of production schema · post-migration verification script · rollback rehearsal

---

## Section 7 · Rollback procedures per system

| System | Rollback path | Rehearsed? |
|---|---|---|
| Brain records | reverse-backfill + reverse-shadow (15/15 tests) | ❌ No |
| Inbox items | flip `NEX_INBOX_READ_BACKEND` off | ⏳ Feature-level only |
| Knowledge Dump jobs | same env-flag off | ⏳ Feature-level only |
| Image files | permanent in `nex.object_blobs` · no version history | ❌ No recovery path |
| Workers | redeploy from alternate source | ⏳ Topology + deployment tested separately, not together |

**Gap:** No integrated multi-system rollback rehearsal. A "rollback all recent changes" fire drill has never been run.

---

## Section 8 · Fresh clone build test

- CI runs lint · typecheck · vitest · Next.js production build on every PR
- 236 passing brain-suite tests (2026-08-09) + 1823/1825 in W-C companion
- Vercel preview auto-deploys per PR
- Local dev confirmed on Windows 11

**Missing:**
- Isolated Linux-VM fresh-clone procedure documented
- Dockerfile-based containerised build step
- End-to-end flow diagram (clone → install → build → test → deploy → smoke)

---

## Section 9 · Cron scheduling audit

- 28 Vercel cron endpoints registered in `vercel.json` (7 orphaned per Vercel A3 audit)
- 4 additional `pg_cron` jobs on Supabase (2 backup mirrors + 2 pure-SQL sweeps)
- CRONS.md reconciled with source files + purposes

**Gaps:**
- No stale-run alerting: cron silently not firing → operator learns from user reports days later
- No `nex.cron_runs` table: each cron's history inferred from side effects
- No circuit breaker for cron failure
- No per-cron SLA definition

---

## Section 10 · Storage-abstraction health

Contract-verified: BrainStore 35/35 · ObjectStorage 17-assertion suite. Adapter-isolation 15/15.

**Missing:** periodic health pings. Filesystem/Postgres/Supabase/ImageKit are error-on-use only — operators find out about degradation from user reports.

---

## Section 11 · Environment parity

- Dev (`.env.local`): all backends optional; cron auth optional
- Prod (Vercel + Fly secrets): documented required vars; `.env.example` lists 100 lines

**Drift risks:**
- Hardcoded env in decommissioned `fly.toml` still visible (`NEX_BRAIN_BACKEND=supabase` legacy)
- Feature flags scattered — `RUN_IMAGE_ANALYST=1` documented in comments only, not code-checked
- Cron auth is token-only (no HMAC signature, replay-vulnerable within token lifetime)

Missing:
- Pre-deploy env-diff report
- Config-schema validation
- Secrets-rotation SOP
- Feature-flag CRUD system

---

## Section 12 · Runbook gap register (synthesis)

Ten critical system areas with zero runbook coverage today. Priority P1 across the board.

| System | Runbook needed |
|---|---|
| Brain queue | stuck-claimed rescue · claim-timeout recovery · dead-letter |
| Image-analyst | object-storage read failure · provider latency spike · corruption detection |
| Inbox | backlog accumulation · filesystem inaccessible · Postgres conn loss |
| Cron scheduler | stale-run detection (>2× interval) · double-fire prevention · secret rotation |
| Postgres | conn-pool exhaustion · replication lag · slow-query escalation |
| Supabase legacy | RLS policy lockout · storage quota · service-role key rotation |
| Worker heartbeats | missing heartbeat (>2 min) · offline detection · force-restart |
| Audit trail | table growth · query slowdown · archival/purge |
| LLM provider | circuit breaker open · rate-limit · API-key expiry · fallback chain |
| Custom alerts | operator-defined threshold tuning · rule CRUD · channel management |

---

## Findings summary

**Zero P0 blockers.** ~15 P1 (day-2 ops maturity). ~10 P2 (deferrable 4 weeks). 1 P3 (dead-code cleanup).

## Acceptance-gate impact (master audit Section 11)

| # | Item | Impact |
|---|---|---|
| 21 | Backup/recovery tested | ⏳ ~75% — Supabase backups automated + tested; Postgres rollback drill still deferred |
| 22 | Monitoring/alerting tested | ⏳ ~25% — foundation exists; export + alerting + runbooks all missing |
| 23 | Production build from clean checkout | ⏳ ~80% — CI proven; fresh-isolated-VM procedure undocumented |

Overall gate readiness: ~60% on the day-2-ops axis.

## Recommended near-term actions (Week 1 · zero-cost quick wins)

1. **Author 4-5 highest-frequency runbooks** — start with queue-stuck, LLM-circuit-open, cron-stale (2 h total)
2. **Export `/api/nex/observability/metrics` in Prometheus format** — new route reading from `counters.snapshot()` (2 h)
3. **Add stale-cron detection** in SystemHealthPanel — query last-mutation timestamp per cron, flag if lag > 2× schedule (1 h)
4. **Signed HMAC on cron auth** — `X-Signature: sha256=<hex>` over `timestamp.body`, reject > 5 min old (45 min)
5. **Author `docs/operations/PRE-PRODUCTION-CHECKLIST.md`** — clone → install → build → test → smoke → promote (30 min)

Total: ~6 hours. Cuts day-1 blindness by ~60%.

## Recommended 4-week ops posture

| Domain | Effort |
|---|---|
| Observability export (Datadog integration · structured logging · SLO dash) | 20 h |
| Incident response (10 runbooks · postmortem template · RCA workflow) | 15 h |
| On-call rotation + PagerDuty | 8 h |
| Security gates (RBAC · CSP nonce · secret-scanning hook) | 12 h |
| Release engineering (CHANGELOG · conv. commits · automated release notes) | 10 h |
| Data safety (rollback rehearsal · GDPR playbook · rotation automation) | 12 h |

Total ~77 h (roughly two engineer-weeks) — moves gates 21/22 from partial to PASS.
