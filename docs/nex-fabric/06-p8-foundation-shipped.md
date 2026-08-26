# P8 · Foundation Slice Shipped · 2026-08-26

Chief Architect record.

## What shipped

**Migration 111 · `nex.provider_registry`** (23 columns · additive · reversible)
- 5 seed rows: `nominatim-public` (green · 1rps · ODbL) · `overpass-public-de` (yellow · 2rps · ODbL) · `nominatim-self` (disabled · 50rps · aspirational) · `google-places` (disabled · $0.017/req · aspirational) · `merchant-submission` (green · ∞ · merchant-consent)
- Every row carries: capabilities, geography_scope, categories_scope, rate limits, concurrency, cost per request, licence, attribution requirements, health state, terms URL, last_reviewed_at
- **Only writer permitted:** future health-probe subsystem. Walkers READ.

**Migration 112 · `nex.cost_budget`** (8 columns · one row per branch)
- 4 seed rows: `food` · `accommodation` · `market` · `transport` — each `daily_cap_usd = $10.00` conservative starting cap
- `spent_today_usd` incremented atomically by `cost-oracle.recordSpend`
- `circuit_open_at` stamped when cap reached · closed on daily reset (`cost-oracle.resetDailyIfNeeded`)

**Helpers**
- `scripts/nex-worker/provider-registry.mjs` — read-only accessor · `getProvider` · `listProviders({healthState, capability})` · `listHealthyProviders` · `updateHealth` (probe-only write)
- `scripts/nex-worker/cost-oracle.mjs` — `checkBudget({branch, providerId, projectedCalls})` returns `{allowed, remainingUsd, capUsd, spentUsd, providerCostPerRequest, projectedSpendUsd, reason}` · `recordSpend` uses SERIALIZABLE + FOR UPDATE · `resetDailyIfNeeded` handles UTC calendar rollover

**Contract extensions**
- `rejection-reasons.mjs` — `CYCLE_OUTCOMES.BUDGET_EXHAUSTED` added · `computeCycleOutcome({budgetExhausted:true, ...})` short-circuits to BUDGET_EXHAUSTED (wins over PROVIDER_ERROR/PARTIAL because walker never queried)
- `persistence-contract.mjs` — `INFRASTRUCTURAL_NOISE_OUTCOMES` now `{PROVIDER_ERROR, FATAL, BUDGET_EXHAUSTED}` · `isSaturationCountable('BUDGET_EXHAUSTED') === false` (we didn't search · no evidence about the surface · MUST NOT consume a saturation attempt)

**Tests: 78/78 pass** across 5 files (cost-oracle, provider-registry, persistence-contract, rejection-reasons, reactivation-policy).

## What was explicitly NOT shipped (deferred per anti-complexity discipline)

- Walker integration of cost-oracle checks into food/accommodation/market/transport walkers
- Provider signal capture (`provider_signals[]` in cycle summary)
- walkers-proof extensions for budget-consumed / provider-health / cost-per-cycle sections
- BUDGET_CIRCUIT_OPEN anomaly in watchdog

**Reason:** all 3 live providers today are FREE (Nominatim, Overpass, merchant-submission). Only aspirational providers are paid (google-places = disabled). Wiring cost-oracle into walkers today protects a $0.00 spend path. The foundation is READY — integration lands when the first paid provider is actually wired.

## What survives from earlier phases (untouched)

- P1 attribution schema (worker_id, cycle_run_id on 3 destination tables + transport)
- P2 persistence contract (three-way SELECT-verify, DB-truth invariant, honest cycle_outcome)
- P3 reactivation policy (per-category cooldowns 6h/6h/6h/12h + 2× backoff + provider-refresh trigger)
- P5 PROVIDER_ERROR + FATAL saturation filter (now joined by BUDGET_EXHAUSTED)
- P6 walkers-proof + watchdog anomaly classification
- P7 Stage 1 evidence: persistent scheduler autonomous cycle chain proven

## Chief Architect verdict

Foundation earned its existence:
- **Concrete problem solved:** we have zero cost governance today. When google-places wires, one bug could spend a month's budget in an hour. Foundation prevents that from being possible.
- **What existing system can't do:** current governor tables track rate/concurrency, not cost. Registry consolidates rate+cost+health+licence into one truth. Cost budget adds hard circuit-breaker independent of rate.
- **What failure it introduces:** a new table can be queried incorrectly (mitigated: helpers are the only sanctioned reader; direct-query is anti-pattern). Cost oracle SERIALIZABLE txn could deadlock (mitigated: retry classification patterns from Provider Rate Governor available for reuse).
- **How rolled back:** two `DROP TABLE IF EXISTS` in migration headers. Zero destination-table impact. Full reversal in < 30 seconds.
- **Measurable value:** proven when a paid provider is wired and BUDGET_EXHAUSTED cycles land honestly instead of silent overspend.
