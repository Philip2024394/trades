# Track D · Audit + Migration + Observability + Test Strategy

## 1 · Component audit (KEEP / KEEP-EXTEND / REFACTOR / REPLACE / DELETE)

### KEEP

- **`persistence-contract.mjs`** — pure, tested, well-scoped (94 lines). `verifyInsertedRow` + `checkPersistenceInvariant` + `isSaturationCountable` migrate as-is.
- **`reliability.mjs`** — `emitHeartbeat`/`startCycleRun`/`finishCycleRun` are correct primitives.
- **`_reactivation-policy.mjs`** — pure, tested, single-purpose (94 lines).
- **`_provider-refresh.mjs`** — correct primitive · sets `cooldown_until = NOW()` on filter · does NOT spawn.
- **Migrations 099, 100, 105-110** — attribution + rotation state · KEEP unchanged, extend additively.

### KEEP-EXTEND

- **`engine.mjs::persistCandidates`** — production quality. Weaknesses: `loadExistingUniverse()` O(N) per cycle · doesn't scale past ~50k rows/city (move to bloom filter or cursor+hash-lookup adapter). Two persistence code paths (contract + legacy `insertNewRecord`) · delete legacy after Phase 2.
- **`rejection-reasons.mjs`** — sound. Add: PROVIDER_RATE_LIMITED · PROVIDER_UNAUTHORIZED · QUERY_FAMILY_EXHAUSTED · PARTIAL_PROVIDER. (Or keep count small, put detail in `provider_signals` jsonb.)
- **`walkers-proof.mjs`** — strongest observability asset · anomaly classification covers 6 kinds already · extend for provider/coverage questions.
- **`_rotation-tick.mjs`** — genuinely production-quality evaluator with PROVIDER_ERROR filter, cooldown backfill, unproductive-backoff. `workItems()` builds `(city × category × surface)` — Fabric wants `(geography × taxonomy × provider × query-family)`. Dual mirror with `discovery-rotation.ts` is fragile · move constants to JSON registry both sides load.
- **HQ TS mirror** — `WorkItem` needs `queryFamilies: string[]` + `providers: string[]`.
- **Database schema** — `nex.discovery_rotation_state` add `provider text NULL` + `query_family text NULL` + change UNIQUE to 5-tuple. `nex.provider_rate_config` add `daily_budget` + `cost_per_call_micros` + `health_score`. `nex.provider_rate_lease` add `outcome text` + `latency_ms int` (becomes provider health telemetry).

### REFACTOR

- **`configs/*.mjs`** (food + accommodation) — mix 3 concerns: source list · classification taxonomy (`NEX_APPROVED_SECONDARY` at food-yogyakarta.mjs:40-60) · persistence adapter. Split for Fabric: Sources → Registry adapters · Taxonomy → Brain lookup · Persistence adapters → registered separately. Yogyakarta hand-tuned `smokeBboxes` MIRRORED between config and `discovery-rotation.ts:94-95` — two sources of truth · REFACTOR into single geography-registry lookup.
- **`_orchestrator-tick.mjs`** — sound structure but priority hardcoded switch (`:154`). Read priority weights from config table · emit richer pick metadata (state alone not enough with query-families + providers as dimensions).

### REPLACE

- **`_market-walker-discover.mjs`** (~600 lines) — inline openCycle/closeCycle, inline governor client copy-paste, own zone-cursor JSON parallel to rotation state, `CURATED_STOREFRONT_KEYWORDS` hardcoded. Replace with universal engine config: `{sources:[nominatimSource], taxonomy:MP_CATEGORY_L3_ROTATION, persistence:mpSellerAdapter}`.
- **`_transport-walker-cycle.mjs`** (~800 lines) — same problem worse. Hardcoded `QUERY_FAMILIES`, inline providers, byte-for-byte duplicate of market's `acquireProviderLease`. Signals abstraction miss: **provider adapters are not first-class**. Replace with single `ProviderRouter` + `ProviderAdapter` interface. Facebook GATED_ENV branch (`:633-654`) is the good pattern — HONEST reporting when provider not configured. Preserve.

### DELETE

- Two `_watch-*.mjs` files, `_check-trust-enum.mjs`, `_test-per-field-provenance-on-insert.mjs` under `nex-acquisition/` — pre-P2 dev scaffolding · superseded by walkers-proof + persistence-contract tests.

### Verdict summary

| Component | Verdict |
|---|---|
| engine.mjs | KEEP-EXTEND |
| configs/*.mjs | REFACTOR |
| _market-walker-discover.mjs | **REPLACE** |
| _transport-walker-cycle.mjs | **REPLACE** |
| persistence-contract.mjs | KEEP |
| rejection-reasons.mjs | KEEP-EXTEND |
| walkers-proof.mjs | KEEP-EXTEND |
| reliability.mjs | KEEP |
| _rotation-tick.mjs | KEEP-EXTEND |
| _reactivation-policy.mjs | KEEP |
| _provider-refresh.mjs | KEEP |
| _orchestrator-tick.mjs | REFACTOR |
| discovery-rotation.ts / auto-orchestrator.ts | KEEP-EXTEND |
| Migrations 099-110 | KEEP-EXTEND (additive) |
| Pre-P2 dev scaffolding | DELETE |

## 2 · Migration roadmap (7 phases · additive + dual-write + feature-flagged)

**Phase 1 · Foundational abstractions** (schema only · no walker changes)
Build: `nex.provider_registry` · `nex.taxonomy_node` · `nex.query_family` · TS interfaces · `src/lib/nex-fabric/provider-router.ts` skeleton (hardcoded returns) · `src/lib/nex-fabric/taxonomy-brain.ts` skeleton.
Untouched: all walkers. Risks: none (pure additive). Gate: unit tests pass · migrations idempotent · TS builds · walkers:proof HEALTHY.

**Phase 2 · Migrate market walker (reference implementation)**
Why market: simplest (single provider, single vertical), largest structural payoff (deletes ~600 lines).
Build: `configs/market-city-factory.mjs` for universal engine · market source via `ProviderRouter.acquire("nominatim")` · taxonomy via `TaxonomyBrain.sampleForCycle(...)`.
Risks: market cycle regression. Mitigation: dual-run under flag `NEX_MARKET_FABRIC=true` for 48h · compare `records_new` within ±5%.

**Phase 3 · Migrate transport, food, accommodation** (order of complexity)
Repeat Phase 2 pattern. Transport gets Query Planner wrapping `QUERY_FAMILIES` inside `TaxonomyBrain.queryFamiliesFor(...)`.
Facebook gated branch behaviour preserved (NOT_CONFIGURED / REFUSED status codes).

**Phase 4 · Deprecate old work-item shape**
Add `provider` + `query_family` columns (nullable) to `nex.discovery_rotation_state` and `nex.discovery_orchestrator_pick`. Rotation-tick `workItems()` becomes 5-tuple. Aggregation view for HQ sidebar.
Risks: rotation-state row explosion (10× to 100×). Mitigation: aggregation view.

**Phase 5 · Enable multi-provider routing**
Add second provider per branch. ProviderRouter.decide() honours health + cost + query-family compatibility. Chaos-test each failover path.
Gate: kill any single provider → walkers:proof reports PROVIDER_ERROR_STORM for that provider only · others keep discovering.

**Phase 6 · Scale concurrency** 1 → 7 → 15 → 50 → 100+
Measure at each step: provider queue wait · DB pool saturation · orchestrator pick latency. Only bump when observation shows headroom. Provider min_interval values untouched (governor authoritative).
Constraint: MAX_SLOTS bump is code change · never runtime-tunable · protects against accidental abuse.

**Phase 7 · Expand taxonomy**
Indonesia Discovery: 25+ place categories via `nex.taxonomy_node` (currently 4 hardcoded in `WALKED_CATEGORIES`). NEX Market: products + services first-class with product-count/service-count leaf metrics.
Constraint: every new taxonomy node must reference at least one query-family · no orphan taxonomy.

## 3 · Observability architecture (HQ redesign)

**COMMAND** (`/nex-head-quarters`)
- Verdict badge (HEALTHY / DEGRADED / CRITICAL) from walkers-proof
- Open incident count (unresolved anomalies 24h)
- Coverage headline · last productive acquisition · global records/hour spark

**INDONESIA DISCOVERY** (`/nex-head-quarters/discovery`)
- City × Category heatmap · click → drill into per-surface state + per-provider health + per-query-family
- Reactivation queue ordered by `cooldown_until`
- Provider Router decision log (last 100 · with reason)

**NEX MARKET** (`/nex-head-quarters/commerce`)
- Per-taxonomy-node discovery yield (mp_category L3 × 24h records)
- Product count + service count per city (after Phase 7)
- Seller state pipeline · Top-10 "cold" categories (0 new in 7d)

**WORKFORCE** (`/nex-head-quarters/workers`)
- Worker heartbeat grid · orchestrator picks/hour + queue depth + free slots
- Provider Rate Governor: per-provider active leases + wait p50/p95/max + budget consumed
- Storage: attribution coverage % per destination

**REVIEW** (`/nex-head-quarters/review`)
- Candidates awaiting human approval (ambiguous matches)
- Anomaly log (INVARIANT_FAILED, DUPLICATE_ASSIGNMENT, STUCK_CYCLE)
- Truthfulness audit trail · provider unauthorized events

### "Answer everything" JSON endpoint

Extend `walkers-proof` → `scripts/nex-worker/fabric-report.mjs` returning:

```json
{
  "verdict": "HEALTHY | DEGRADED | CRITICAL",
  "answers": {
    "are_walkers_alive": { "answer": true, "evidence": {...} },
    "what_are_they_discovering": {...},
    "which_providers_healthy": [...],
    "which_providers_degraded": [...],
    "where_is_coverage_poor": [...],
    "why_did_walker_produce_zero": {...},
    "zero_root_cause_breakdown_24h": {...},
    "provider_yield_24h": [...],
    "cycle_cost": {...},
    "undiscovered_taxonomy": [...],
    "needs_new_strategy": [...]
  },
  "raw_evidence": { /* existing walkers-proof unchanged */ }
}
```

Each `answers.*` = pure function over existing tables + 3 new Phase-1 tables. No LLM · no fabrication · every number citable to SQL.

## 4 · Test strategy

```
              ┌─────────────┐
              │ Chaos (5%)  │  BLOCKING before Phase 5
              ├─────────────┤
              │ E2E (10%)   │  BLOCKING per walker migrated
              ├─────────────┤
              │ Integration │  BLOCKING per phase gate
              │ (25%)       │
              ├─────────────┤
              │ Unit (60%)  │  BLOCKING every PR
              └─────────────┘
```

**Unit** — ProviderRouter.decide() 12+ scenarios · TaxonomyBrain.sampleForCycle() · QueryPlanner.expandFamily() · failure state machine grid · preserve `persistence-contract.test.mjs` + `_reactivation-policy.test.mjs`. Target: 90% coverage on `src/lib/nex-fabric/` · 100% on pure functions.

**Integration** — full pipeline with mocked provider adapters (3 providers · 2 return data · 1 fails → PROVIDER_ERROR NOT counted toward saturation) · rotation+orchestrator round-trip · persistence invariant under 10 parallel walkers.

**Contract** — every `ProviderAdapter` must pass: `describeSurfaces()` non-empty · `estimateRate()` matches governor config · `costPerCall()` integer micros · `healthProbe()` < 5s · `search()` returns correct provenance shape · simulated 429/503/timeout returns correct rejection reason.

**Chaos** — kill one provider mid-cycle → failover works · no data loss · PROVIDER_ERROR count accurate. 401 from provider → surface `unauthorized_at` → HQ REVIEW anomaly · no retry storm. 100 concurrent spawns → governor serializes · lease latency p95 < 30s. DB pool exhaustion → graceful backoff · no zombies.

**Regression (all P2-P6 tests preserved as-is · BLOCKING every PR):**
- `persistence-contract.test.mjs` · `rejection-reasons.test.mjs` · `engine-records-persisted.test.mjs` · `country-awareness.test.mjs` · `_reactivation-policy.test.mjs` · `p3-reactivation-test.mjs` · `p5-provider-error-saturation-test.mjs`

Any change to P2-P6 test file = Phase-boundary red flag requiring Philip approval.

## Cross-cutting hard constraints

1. Provider-INDEPENDENT, not provider-EVASIVE (every adapter carries `auth_mode` + `legal_notes` + `rate_source_url` · ToS violations block merge)
2. Discovery ≠ Outreach (Gate 5 never fires from Fabric walkers)
3. Persistence invariant authoritative (`db_count === insert_verified` · any mismatch = FAILED)
4. PROVIDER_ERROR never consumes saturation attempt (`isSaturationCountable` filter constitutional through migration)
5. Rotation Controller remains sole geographic authority (no walker spawns except via orchestrator)
