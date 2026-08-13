# NEX Service-Level Objectives (SLO)

**Status:** DRAFT · propose-and-review, not yet contractual
**Date:** 2026-08-10
**Owner:** Master AI engineer

## Purpose

SLOs are the machine-readable line between "system healthy" and "system needs help." Every SLO here is measurable from `nex.audit_log` + `worker_heartbeats` + reception dashboard signals. No made-up metrics.

## User-facing SLOs

| SLO | Target | Window | Signal source | Alert threshold |
|---|---|---|---|---|
| Homeowner post → first trade reply | 90% within 48h | Rolling 30d | `first_reply_latency_48h` metric (project north-star) | < 85% for 24h |
| Merchant page uptime | 99.5% | Monthly | Vercel status | any 5-min blackout |
| Inbox upload → first processing signal | P95 < 60s | Rolling 24h | `nex.knowledge_inbox.created_at` vs first `worker_jobs` row | P95 > 120s for 15 min |
| Brain query response | P95 < 800ms | Rolling 24h | `/api/nex/brain/*` request duration in Vercel logs | P95 > 2s for 15 min |

## Internal SLOs (subsystem)

| Subsystem | SLI | Target |
|---|---|---|
| Cron scheduler | Cron fires within 2× scheduled interval | 99% |
| Worker cycle | Claim → complete latency P99 | < 60s |
| Reverse-shadow | Postgres write → Supabase mirror | < 30s |
| LLM chain | Any provider succeeds | 99.5% (chain of 10) |
| Audit-log write | Fire-and-forget success | 99.9% |
| Object storage put | Successful put | 99.9% |

## Incident-response targets

| Metric | Target | Definition |
|---|---|---|
| MTTD (mean time to detect) | < 5 min for P0, < 30 min for P1 | Alert fires → operator ack |
| MTTA (mean time to acknowledge) | < 10 min for P0 (business hours), < 30 min out-of-hours | Operator ack → operator engaged |
| MTTR (mean time to recover) | < 60 min for P0, < 4 h for P1 | Operator engaged → service healthy |

Business hours = 09:00-18:00 UK. Out-of-hours = anything else; only P0 pages.

## Error budget

For 99.5% monthly uptime: **3.6 hours of downtime allowed per month.**

- Downtime budget consumed by outages > 5 min
- If budget exhausted mid-month: freeze non-urgent deploys, prioritise reliability work
- Budget reset on 1st of each month

## SLO review cadence

- Quarterly: re-check whether these targets are still right (are we over-serving? under-serving?)
- Post-incident: if an SLO was breached without alerting, tighten the alert
- Annually: rewrite this doc based on data

## Not-yet-SLO'd (call-out list)

Subsystems that ship without an SLO are shipping *unmeasured*. This is a list of things we know we should add SLOs for but haven't:
- Contact-registry write throughput
- Analytics ingest latency
- Delivery worker throughput
- Vector/embedding search (once implemented)

Adding items here does not commit to a target — it commits to *measuring* first.
