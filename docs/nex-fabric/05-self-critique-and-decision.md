# NEX Discovery Fabric · Self-Critique + Philip's Decision

**Generated: 2026-08-26**

Philip explicitly asked Claude to challenge its own Fabric proposal after the 4-track research exercise. This document captures the honest critiques and the resulting minimal scope.

## 14 honest critiques of the Fabric proposal

### 1 · The 100k+ work-item claim is speculative
Track C proposed a Rotation Controller picking from 100k+ work-items using composite priority index and stratified sampling. This is theory, not evidence. Current system has ~92 rows in `discovery_rotation_state` and already exhibits saturation/reactivation edge cases we barely understand. Scaling the picker 1000× without production traffic showing the current picker is actually the bottleneck is premature. Simpler: keep `(city × category × surface)` shape until we hit its actual ceiling.

### 2 · Provider Router adds a new failure surface
Introducing a router between rotation-tick and walker means a bug in the router can starve every walker of work. Today when Nominatim errors, one vertical hurts. With a router, a bad routing decision could hurt all verticals for that geography. The system becomes globally coupled in a way it isn't today.

### 3 · The 7-phase migration overestimates our ability to dual-run
Every phase claims "additive · no walker changes" but Phases 4-5 change work-item shape AND enable multi-provider routing. Dual-writing to two rotation-state schemas with different unique constraints is genuinely hard. Rollback stories are optimistic. Phase 4 requires a 5-tuple unique constraint change — that's not "additive," that's a schema break behind a flag.

### 4 · Taxonomy-discovery loop is a hard research problem
"Walker observes signals → auto-proposes new taxonomy leaf" glosses over ontology alignment across heterogeneous provider schemas. And "human APPROVE/MERGE/REJECT" implies HQ workflow, notification system, audit trail, versioning — a multi-quarter project. For P7 launch, taxonomy should be curated by hand and grown deliberately.

### 5 · Self-hosted Nominatim + Overpass costs are optimistic
Track A said "~$40-120/mo VPS for own Nominatim." Reality: initial planet import takes 2-3 days, requires 200+ GB SSD, weekly diff processing is fragile. Overpass initial import needs 200GB+ RAM. These are engineering projects, not a Docker `run` command.

### 6 · Foursquare OS Places licensing not validated for our use case
Apache 2.0 is permissive but the FSQ OS release still has an attribution clause + potential future changes. Building the T0 seed on a single vendor's open-data release is single-point-of-failure of a different kind. OSM planet dump is more durable (ODbL, community-owned).

### 7 · Failure state machine at 13 states is probably too many
Operators will not correctly triage 13 outcomes. Better: keep ~7 outcomes, add a `provider_signals` jsonb with detail (http_status, latency_ms, retry_count). Router uses signals, humans read outcomes.

### 8 · "Provider-independent, not provider-evasive" is well-stated but hard to hold
The moment we add per-provider adapters + circuit breakers + budget gates + failover routing, we've built exactly the machinery that "just happens to" defeat rate limits when configured aggressively. The safety boundary lives in policy + code review, not architecture.

### 9 · Migration destroys the P5/P6 evidence chain if not preserved carefully
The persistence contract is proven ONLY on the current shape. If we change work-item shape or cycle_outcome vocabulary, we invalidate P5/P6 acceptance evidence. Regression test suite is our only guardrail — and it currently has 5 pre-existing failures in `discovery-rotation.test.ts` that were already broken before P6.

### 10 · The "answer everything" JSON endpoint is a category error
Bundling 11 questions into one JSON payload creates a monolithic contract. Better: separate endpoints per question, each versioned, each cheap to render, each independently cacheable.

### 11 · The scaling ladder skips a validation step
1 → 7 → 15 → 50 → 100+ workers. But between 15 and 50 lies the actual capacity question — does own-Nominatim + own-Overpass with 3 vCPUs handle 50 concurrent walkers? We don't know. Recommend adding a load-test rung.

### 12 · Structural verdicts on files not fully read
Track D's verdict on `_transport-walker-cycle.mjs` said "REPLACE · 800 lines duplicating engine" — Claude only saw 100 lines of it. Same critique applies to market walker. Real recommendation: audit line-by-line before any REPLACE decision.

### 13 · Missing from all four tracks: cost governance
No agent proposed a hard budget circuit-breaker. Google Places at $17/1k Text Search × 100 workers × 100 cycles/day × 100 queries/cycle = $17k/day best case. A bug in the router could drain a $10k/mo budget in an hour.

### 14 · Missing: how does NEX know when a taxonomy branch is "done"
Assumes surfaces reactivate periodically. But some categories (temples in Yogyakarta) are near-complete — walking them every 6h wastes budget. Missing concept: "coverage confidence" per (geography × taxonomy). Without this, scale = waste.

## Philip's scope decision · 2026-08-26

**MINIMAL scope survives:**

### A · Provider Registry (ship)
A canonical `nex.provider_registry` table holding rate limits, concurrency limits, cost per request, licence, attribution requirements, current health state, and terms URL for every provider NEX uses. Existing walkers migrate to READ from it (rather than hardcoding rate/health). No router yet.

### B · Cost Oracle (ship)
A `nex.cost_budget` table + gate helper. Before every provider call, walker consults budget for its taxonomy branch. If exhausted → new `BUDGET_EXHAUSTED` cycle_outcome (honest, non-productive). Integrates with existing Provider Rate Governor (governor = rate; oracle = cost).

### DEFERRED (not shipped in this pass)
- Provider Router (multi-provider failover) — Critique #2, #8
- Taxonomy Brain — Critique #4, #14
- Work-item reshape from `(city × category)` to `(geography × taxonomy × provider × query-family)` — Critique #1, #3, #9
- Self-hosted Nominatim/Overpass infrastructure — Critique #5
- Multi-provider adapters — Critique #2, #8, #13
- Expanded 13-state failure machine — Critique #7
- "Answer everything" monolithic endpoint — Critique #10
- `_market-walker-discover.mjs` and `_transport-walker-cycle.mjs` REPLACE — Critique #12
- Scaling ladder to 50+/100+ workers — Critique #11

### RATIONALE
The two minimal pieces prevent the biggest failure modes (silent provider death · runaway cost) without introducing the global coupling that comes with a router or the abstract complexity of Taxonomy Brain. Full Fabric can build on this foundation once minimal proves stable. If minimal doesn't reveal problems worth solving, that's evidence the fuller Fabric is over-engineering.

### Also preserved: P7 Stages 2-4 suspended
The concurrency ramp (3 → 7 → 15 workers) is a proof of the CURRENT architecture. Scaling something we're about to refactor is wasted work. Resume after minimal Fabric proves stable.

## What survives unchanged from P1-P6

- Persistence contract (worker_id + cycle_run_id + three-way verify + invariant)
- Rejection reason vocabulary
- `isSaturationCountable` filter (PROVIDER_ERROR / FATAL excluded)
- Reactivation policy (per-category cooldowns · 2× backoff)
- Rotation Controller as sole geographic authority
- Autonomous nex-dev-scheduler with NEX_ORCHESTRATOR_ENABLED=true
- Watchdog + walkers:proof anomaly classification
