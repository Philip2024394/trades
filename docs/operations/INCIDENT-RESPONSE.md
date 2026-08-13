# NEX Incident Response Playbook

**Status:** LIVING · updated after every incident
**Date:** 2026-08-10

## The five stages

Every incident, without exception, moves through these five stages. Skipping any stage is how single-hour outages become full-day outages.

1. **Detect** — alert fires OR user reports OR operator notices
2. **Triage** — on-call assesses severity, decides whether to page others
3. **Mitigate** — reversible contain-action stops the bleeding
4. **Validate** — confirm mitigation worked, service healthy
5. **Learn** — postmortem within 72h, action items tracked to completion

## Severity levels

| Severity | Definition | Response |
|---|---|---|
| **P0** | Users cannot use core features · data at risk · security exposure | Page on-call immediately, 24/7 |
| **P1** | Significant degradation · SLO breach imminent · single subsystem down | Business hours: 30-min ack. Out-of-hours: next business day. |
| **P2** | Minor degradation · workaround exists · single user impacted | Next business day |
| **P3** | Cosmetic / non-urgent | Bundle with regular work |

## Detect

- **Automated:** alert from Vercel, from `/api/nex/brain/llm-health`, from log-drain destination (once F3 wired)
- **User report:** support inbox, direct message, community post
- **Operator observation:** during dashboard review

## Triage

**Two questions:**
1. Is this actually the system, or is it user error / expected behaviour?
2. If it is the system: what severity?

If unsure, escalate up (P2 → P1). Under-severing loses trust; over-severing wastes people once.

## Mitigate

Consult the runbook for the failure mode. Every runbook has a **"Contain (reversible)"** section — start there.

**Rule:** never take an irreversible action (data delete, force-fix that voids audit) as a first response. Every reversible action buys you time to diagnose properly.

## Validate

Not "the alert cleared" — the alert may have cleared because the check timed out. Validation means:
- A representative user action works end-to-end
- Metrics are trending back within SLO bounds
- No secondary alerts fire in the next 15 min

## Learn

Postmortem due within 72 h. Use `POSTMORTEM-TEMPLATE.md`. Blame-free.

## Communication template

**During incident:**
> [P?] [subsystem] [1-line symptom] · investigating · updates every 15 min

**Update:**
> [P?] [subsystem] · [what we know] · [what we're doing] · next update by [time]

**Resolved:**
> [P?] [subsystem] · resolved [time] · duration [X min] · postmortem due [date]

## On-call escalation (once F8 lands)

1. Primary on-call responds within SLO
2. If primary hasn't ack'd within SLO: secondary on-call paged
3. If secondary hasn't ack'd within SLO: founder paged

Until F8 lands: Philip is primary + secondary + escalation. Every incident is his page.

## Public status

Once a status page exists (deferred), update it before internal comms. Users trust the status page more than support replies.
