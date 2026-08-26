# Track B · Provider Abstraction · Router · Failure Model

**Safety boundary:** provider-INDEPENDENT, not provider-EVASIVE. Every mechanism routes AWAY from constrained providers to legitimate alternatives (own-hosted, contracted API, merchant-submitted). No mechanism defeats rate limits, spoofs identity, or circumvents terms.

## 1 · Provider Capability Registry

### Schema

```sql
CREATE TABLE nex.provider_registry (
  provider_id            text PRIMARY KEY,
  name                   text NOT NULL,
  kind                   text NOT NULL,              -- geocoding|search|directory|dataset|feed|self-hosted|merchant-submission
  capabilities           text[] NOT NULL,            -- places-lookup|business-search|product-search|geocode|reverse-geocode|opening-hours|contact-info|photos|reviews
  geography_scope        jsonb NOT NULL,             -- { "countries":["ID","MY"], "quality":{"ID-YO":95,"ID-JK":80} }
  categories_scope       jsonb NOT NULL,             -- { "strong":["food","accommodation"], "weak":["transport"] }
  authentication         text NOT NULL,              -- none|api-key|oauth|partner-contract
  credentials_secret_ref text,                       -- vault path, never inline
  rate_limit_rps         numeric,                    -- null = unlimited/self-hosted
  rate_limit_rpd         integer,
  concurrency_limit      integer NOT NULL DEFAULT 1,
  cost_per_request_usd   numeric(10,6) DEFAULT 0,
  cost_tier_json         jsonb,                      -- volume discounts
  licence_id             text NOT NULL,              -- ODbL|CC-BY|proprietary|merchant-consent
  attribution_required   boolean NOT NULL DEFAULT false,
  attribution_template   text,
  freshness_class        text NOT NULL,              -- realtime|daily|weekly|quarterly|static
  reliability_score      smallint NOT NULL DEFAULT 50,   -- 0-100, EMA
  current_health_state   text NOT NULL DEFAULT 'green',  -- green|yellow|red|circuit-open|disabled
  fallback_provider_ids  text[] NOT NULL DEFAULT '{}',
  retry_policy_id        text NOT NULL,
  terms_url              text NOT NULL,
  last_reviewed_at       timestamptz NOT NULL,
  circuit_opened_at      timestamptz,
  circuit_scope          text,                       -- 'global' | 'region:ID-YO' | 'category:transport'
  notes                  text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX idx_provider_registry_health ON nex.provider_registry (current_health_state, reliability_score DESC);
CREATE INDEX idx_provider_registry_caps   ON nex.provider_registry USING gin (capabilities);
```

### Five example rows

| provider_id | kind | capabilities | rate_limit | licence | health | notes |
|---|---|---|---|---|---|---|
| `nominatim-public` | geocoding | geocode, reverse-geocode, places-lookup | 1 rps · 86.4k rpd | ODbL | green | OSMF public server. **Never bypass 1rps.** Fallback → `nominatim-self`. |
| `overpass-public-de` | dataset | places-lookup, business-search, opening-hours | ~2 rps soft · 10k q/day soft | ODbL | yellow | overpass-api.de · frequent 502. Fallback → `overpass-self`. |
| `nominatim-self` | self-hosted | geocode, reverse-geocode, places-lookup | 50 rps configured · unlimited daily | ODbL (own OSM instance) | green | Own EU VM · authoritative for OSM · attribution still required. |
| `google-places` | search | business-search, places-lookup, opening-hours, contact-info, photos, reviews | 100 rps · 100k rpd | proprietary | green | Strong Java/ID coverage · $0.017/Text Search · budget gate applies. |
| `merchant-submission` | merchant-submission | business-search, contact-info, opening-hours, photos | n/a (write path) | merchant-consent | green | NEX-owned directory · zero cost · canonical · unmatched freshness. |

Companion tables: `nex.retry_policy` · `nex.provider_health_sample` · `nex.provider_budget`.

## 2 · Provider Router

### Contract

```ts
interface RouteRequest {
  intent: 'places-lookup' | 'business-search' | 'geocode' | 'reverse-geocode' | ...;
  geography: { countryISO: string; adminCode?: string; bbox?: BBox };
  taxonomy_node: string;
  previous_results?: { provider_id: string; outcome: CycleOutcome }[];
  budget_ctx: { branch: string; remaining_usd: number };
}
interface RouteDecision {
  ordered_providers: string[];
  budget_reservation_usd: number;
  rationale: string[];
}
```

### Algorithm

```
function route(req):
  candidates = registry.filter(cap match)
              .filter(geography quality > 0)
              .filter(not disabled, not circuit-open for scope)
              .filter(not already tried this cycle)
              .filter(within remaining budget)
              .filter(governor has headroom)
  score:
    0.40 * reliability_score
    0.25 * scope quality
    0.15 * category fit
    0.10 * freshness
    0.10 * cost score (free > cheap > expensive)
    - 0.20 if yellow health
  tiebreak: prefer merchant-submission > self-hosted > commercial
  return ordered_providers[]
```

Properties: **deterministic under stable inputs** (auditable), **reads health but does not write it** (Hystrix/resilience4j pattern), **integrates with Rotation Controller** — controller stays sole geographic authority, router picks provider WITHIN scope.

## 3 · Failure Classification State Machine

| cycle_outcome | Meaning | Circuit action | Retry | Router response |
|---|---|---|---|---|
| PRODUCTIVE | Records persisted | bump reliability +ε | n/a | done |
| PARTIAL | Some records + errors | none | n/a | done |
| NO_RESULTS | Empty legitimate 200 | none | n/a | try next provider |
| ALL_DEDUPED | All matched existing | none · healthy | n/a | done |
| COVERAGE_GAP | Confirms no data for (geo, tax) | mark scope weak | n/a | try next provider · log |
| RATE_LIMITED | 429 · throttled | half-open · cool 60s → 5m → 30m | exp backoff, max 3 | try next immediately |
| TIMEOUT | Network / read timeout | after 3 in 60s → yellow | exp with jitter, max 3 | retry same → next |
| PROVIDER_OUTAGE | 5xx / DNS cluster | open globally 5m → 30m → 2h | none within window | try next immediately |
| AUTH_FAILURE | 401 / 403 | disable until manual | none | try next · **PAGE** |
| POLICY_RESTRICTED | Provider refuses query type | narrow scope permanently | none | try next · do not reissue |
| REGIONAL_BLOCK | Refuses this geography | narrow geography_scope | none | try next · do not reissue in region |
| MALFORMED_RESPONSE | Schema drift | yellow at 3 · open at 10 | retry once | try next · snapshot for engineer |
| FATAL | Bug in our code | none | none | halt walker · alert |

### Diagram

```
                  ┌─────────────┐
                  │   CLOSED    │ reliability drift + / -
                  │  (route)    │
                  └──────┬──────┘
                         │  failure burst
                         ▼
                  ┌─────────────┐
                  │    OPEN     │ router skips in scope
                  │  cooling T  │ T = 60s → 5m → 30m → 2h
                  └──────┬──────┘
                         │  T elapsed
                         ▼
                  ┌─────────────┐
                  │  HALF-OPEN  │ single probe request
                  └──────┬──────┘
                         │  probe succeeds → CLOSED
                         │  probe fails → OPEN
                         │
      AUTH_FAILURE / persistent POLICY → DISABLED (human)
```

## 4 · Persistence Contract Preservation

Persistence spine (worker_id + cycle_run_id + invariant) UNCHANGED. New data lives in `worker_cycle_run.summary` jsonb:

```json
{
  "walker_id": "food-yogyakarta",
  "cycle_run_id": "01J...ULID",
  "cycle_outcome": "PRODUCTIVE",
  "records_new": 4,
  "provider_route": {
    "planned": ["overpass-public-de","overpass-self","google-places"],
    "attempted": [
      { "provider_id":"overpass-public-de", "outcome":"PROVIDER_OUTAGE", "http":502, "ms":8412 },
      { "provider_id":"overpass-self",      "outcome":"PRODUCTIVE",      "http":200, "ms":642, "records":4 }
    ],
    "budget_spent_usd": 0.0,
    "attribution": ["© OpenStreetMap contributors (ODbL)"]
  }
}
```

Cutover 5 acquisition freeze respected: Track B is a **capability layer under the existing scheduler**. No new scheduler · no new spawn authority · no MAX_SLOTS change. Rotation Controller keeps picking · Router only chooses provider order within an already-picked work item.

## 5 · Migration Examples

**5a · Food walker (currently Overpass-only)**: 502 storm on `overpass-public-de` → router falls to `overpass-self` → falls to `google-places` (budget-gated). Yogyakarta hand-tuned bboxes stay in config; only provider layer moves.

**5b · Market walker (Phase 3 planned Overpass fallback)**: Phase 3 becomes a registry entry marking `overpass-*` strong for `commerce.market` — no bespoke walker change needed.

**5c · New hair-salon walker**: taxonomy leaf + registry review → route `[google-places, overpass-self, merchant-submission]`. **Zero new walker file. Zero new HQ page.** Payoff: new taxonomy = data change, not engineering project.

## Sources

- Fowler, M. *CircuitBreaker*, martinfowler.com, 2014
- Nygard, M. *Release It!*, 2nd ed., 2018
- Netflix Hystrix wiki (archived)
- resilience4j documentation
- Envoy Proxy `outlier_detection`
- OSMF Nominatim usage policy
