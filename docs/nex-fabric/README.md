# NEX Discovery Fabric · Research + Architecture Archive

**Generated: 2026-08-26 · Philip approved research-first, no-code direction**

This directory holds the full research + architecture brainstorm produced after P6 (persistence contract + watchdog complete) when Philip paused incremental patching and directed a world-class-provider-independent redesign.

**Guiding principle throughout:** provider-INDEPENDENT, not provider-EVASIVE. No CAPTCHA bypasses, ban evasion, rate-limit circumvention, or ToS violations. When a provider constrains a workload, the answer is "route to another legitimate provider or own-hosted infrastructure" — never "engineer around the constraint."

## Files

1. [`01-provider-ecosystem-research.md`](./01-provider-ecosystem-research.md) — Track A · State-of-the-art provider landscape (OSM/Nominatim/Overpass · commercial APIs · government open data · Indonesia-specific sources · self-hosted alternatives · cost ceilings)
2. [`02-provider-abstraction-router-failure.md`](./02-provider-abstraction-router-failure.md) — Track B · Provider Registry schema · Router decision algorithm · Failure state machine (CLOSED/OPEN/HALF_OPEN/DISABLED · scoped circuit breakers)
3. [`03-taxonomy-query-planner-workforce.md`](./03-taxonomy-query-planner-workforce.md) — Track C · Taxonomy Brain (PLACES + COMMERCE universes) · Query Planner (localisation + synonym expansion + provider fan-out) · Workforce redesign (100k+ work-item picker · fairness algorithm · concurrency ladder 1→100+)
4. [`04-audit-migration-observability-tests.md`](./04-audit-migration-observability-tests.md) — Track D · Brutally honest KEEP/REFACTOR/REPLACE/DELETE audit of current code · 7-phase migration roadmap · HQ redesign (COMMAND/INDONESIA DISCOVERY/NEX MARKET/WORKFORCE/REVIEW) · Test pyramid
5. [`05-self-critique-and-decision.md`](./05-self-critique-and-decision.md) — 14 honest critiques of the Fabric proposal · Philip's scope decision (minimal · Provider Registry + Cost Oracle only) · rationale for what does NOT ship in this pass

## Decision summary

Philip 2026-08-26: **Minimal scope survives.**
- **Ship:** Provider Registry (canonical rate/health/cost/legal) + Cost Oracle (hard per-branch budget circuit breaker)
- **Defer:** Provider Router · Taxonomy Brain · Work-item reshape · Self-hosted infrastructure · Multi-provider adapters · Expanded failure state machine
- **Reason:** the two minimal pieces prevent the biggest failure modes (silent provider death · runaway cost) without introducing global coupling · full Fabric can build on this foundation once minimal proves stable

## What is preserved unchanged from P1-P6

- Persistence contract (worker_id + cycle_run_id + three-way verify + invariant)
- Rejection reason vocabulary (7 reasons, 7 outcomes)
- `isSaturationCountable` filter (PROVIDER_ERROR / FATAL excluded)
- Reactivation policy (per-category cooldowns · 2× backoff · provider-refresh trigger)
- Rotation Controller as sole geographic authority
- Autonomous scheduler (nex-dev-scheduler with NEX_ORCHESTRATOR_ENABLED=true)
- Watchdog + walkers:proof anomaly classification
- Discovery ≠ Outreach constitutional lock
