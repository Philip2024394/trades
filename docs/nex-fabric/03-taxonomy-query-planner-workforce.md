# Track C · Taxonomy Brain + Query Planner + Workforce Redesign

## 1 · Taxonomy Brain

```sql
CREATE TABLE nex.taxonomy_node (
  id               BIGSERIAL PRIMARY KEY,
  universe         TEXT NOT NULL CHECK (universe IN ('PLACES','COMMERCE')),
  parent_id        BIGINT REFERENCES nex.taxonomy_node(id) ON DELETE RESTRICT,
  slug             TEXT NOT NULL,
  path             LTREE NOT NULL,                       -- 'commerce.services.food.warung.padang'
  depth            SMALLINT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('family','category','subcategory','leaf','variant')),
  canonical_name   JSONB NOT NULL,                       -- {id:"Warung Padang", en:"Padang Eatery"}
  synonyms         JSONB NOT NULL DEFAULT '{}',          -- {id:["rumah makan padang","RM Padang"]}
  alt_spellings    TEXT[] NOT NULL DEFAULT '{}',
  provider_hints   JSONB NOT NULL DEFAULT '{}',          -- {overpass:{amenity:"restaurant",cuisine:"padang"}}
  query_patterns   JSONB NOT NULL DEFAULT '[]',
  yield_stats      JSONB NOT NULL DEFAULT '{}',          -- learned per provider
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','proposed','deprecated','merged')),
  merged_into_id   BIGINT REFERENCES nex.taxonomy_node(id),
  discovered_by    TEXT,
  approved_by      TEXT,
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, slug)
);
CREATE INDEX taxonomy_node_path_gist ON nex.taxonomy_node USING GIST (path);
```

### Three examples

| # | path | canonical_name | key metadata |
|---|---|---|---|
| A | `places.temples.hindu.prambanan_shaped` | `{id:"Candi Prambanan", en:"Prambanan-style Hindu Temple"}` | `provider_hints={overpass:{historic:"temple",religion:"hindu"}, wikidata:{P31:"Q842402"}}` |
| B | `commerce.products.furniture.teak_furniture` | `{id:"Furnitur Jati", en:"Teak Furniture"}` | `synonyms={id:["mebel jati","kayu jati"]}, provider_hints={facebook_marketplace:{...}, tokopedia:{cat:"14"}}` |
| C | `commerce.services.home.plumbing` | `{id:"Tukang Ledeng", en:"Plumbing"}` | `synonyms={id:["tukang pipa","service pipa air"]}, provider_hints={google_places:{type:"plumber"}}` |

### Taxonomy-discovery loop

Walker observes N candidates → normalise sub-category signals (cuisine, brand, service_type) → aggregate against known children → if cluster > threshold (≥30 candidates × ≥3 geographies × ≥2 providers) → INSERT with `status='proposed'` · `discovered_by='walker:...'` → HQ surfaces at `/nex-head-quarters/taxonomy/proposals` with evidence → human APPROVE / MERGE / REJECT → on approve status→'active', workforce registry fans out.

Pattern reference: Snowplow dynamic contexts · Segment Protocols proposal system. Never mutates structure autonomously.

## 2 · Query Planner

```ts
interface PlannedQuery {
  provider_id: string;
  surface: string;
  query_string: string;
  params: Record<string, unknown>;
  expected_latency_ms: number;
  cost_estimate: { credits: number; wall_ms: number };
  dedup_key: string;                    // sha1(provider|surface|normalized_query|geo_hash)
  priority: number;
  taxonomy_path: string;
  reason_codes: string[];               // ['LOCALISED_ID','SYNONYM_EXPANSION','GEO_BBOX_TIGHT']
}

function planQueries(input: {
  intent, taxonomy_node, geography, provider_router_output, budget, recent_query_ledger
}): PlannedQuery[];
```

### Algorithm

1. **Localisation** — canonical names in every language of the geography
2. **Synonym expansion** — top-K by historical yield
3. **Intent-shaped templates** — discover vs verify vs enrich
4. **Fan out across providers** — via `provider_router_output`
5. **Cache-aware dedup** — skip if `dedup_key` in recent_ledger within TTL
6. **Prioritise** — 50% historical yield + 20% cost + 20% provider diversity + 10% reason bonus
7. **Budget clamp**

### Three example plans

**A · Restaurants in Yogyakarta** (`places.commercial.restaurants`)

| # | provider | query | reason |
|---|---|---|---|
| 1 | overpass | `amenity=restaurant in bbox(yogya)` | STRUCTURED |
| 2 | overpass | `amenity=cafe in bbox(yogya)` | STRUCTURED |
| 3 | google_places | `restoran di Yogyakarta` | LOCALISED_ID |
| 4 | google_places | `warung Yogyakarta` | SYNONYM |
| 5 | nominatim | `rumah makan Yogyakarta` | SYNONYM |

**B · Plumbing in Jakarta** (`commerce.services.home.plumbing`)

| # | provider | query | reason |
|---|---|---|---|
| 1 | google_places | `plumber Jakarta` | LOCALISED_EN |
| 2 | google_places | `tukang ledeng Jakarta` | LOCALISED_ID |
| 3 | google_places | `jasa pipa 24 jam Jakarta Selatan` | SYNONYM+GEO_SUB |
| 4 | facebook_pages | `category=local_service, kw=ledeng` | STRUCTURED |

**C · Teak furniture in Bali** (`commerce.products.furniture.teak_furniture`)

| # | provider | query | reason |
|---|---|---|---|
| 1 | tokopedia | `cat=furniture, kw=jati, region=bali` | STRUCTURED |
| 2 | google_places | `mebel jati Bali` | LOCALISED_ID |
| 3 | ig_hashtag | `#jatibali geo=bali` | SOCIAL_TAG |

`entity_dedup_key = sha1(normalized_name|phone|address|coord_tile)` — same real-world entity found via 5 queries = 1 entity.

## 3 · Workforce Redesign

### New work-item registry

```sql
CREATE TABLE nex.discovery_work_item (
  id                  BIGSERIAL PRIMARY KEY,
  geography_id        BIGINT NOT NULL,
  taxonomy_node_id    BIGINT NOT NULL,
  provider_id         TEXT   NOT NULL,
  surface             TEXT   NOT NULL,
  query_family        TEXT   NOT NULL,
  state               TEXT   NOT NULL DEFAULT 'ELIGIBLE',
  freshness_score     REAL   NOT NULL DEFAULT 1.0,
  yield_score         REAL   NOT NULL DEFAULT 0.5,
  cost_score          REAL   NOT NULL DEFAULT 0.5,
  coverage_debt       REAL   NOT NULL DEFAULT 1.0,
  fairness_weight     REAL   NOT NULL DEFAULT 1.0,
  cycles_total        INT    NOT NULL DEFAULT 0,
  candidates_total    BIGINT NOT NULL DEFAULT 0,
  persisted_total     BIGINT NOT NULL DEFAULT 0,
  zero_streak         INT    NOT NULL DEFAULT 0,
  UNIQUE (geography_id, taxonomy_node_id, provider_id, surface, query_family)
);
CREATE INDEX dwi_priority ON nex.discovery_work_item
  ((freshness_score*0.35 + yield_score*0.30 + cost_score*0.10 + coverage_debt*0.15 + fairness_weight*0.10) DESC)
  WHERE state = 'ELIGIBLE';
```

### Picker at 100k+ scale

1. **Capacity envelopes** — global slots · per-provider free · per-geo fairness · budget remaining
2. **Pull top candidates** — expression index O(log n) even at 10M rows · over-fetch N × 8
3. **Stratified sampling** — GEO_QUOTA + TAX_QUOTA + PROVIDER_QUOTA (fairness)
4. **Atomic lease** — SERIALIZABLE txn

**Priority score:** `0.35 * freshness + 0.30 * yield + 0.15 * coverage_debt + 0.10 * cost + 0.10 * fairness`

**Freshness classes:** HOT 24h · WARM 7d · COLD 90d. Prevents burning cycles refreshing temples every hour.

### Concurrency ladder (governed budgets · not just MAX_SLOTS)

| Ladder | Global slots | Per-provider caps | Cost ceiling / 5-min tick |
|---|---|---|---|
| 1 | 1 | overpass=1, google=1 | 20 credits |
| 7 | 7 | overpass=2, google=3, fb=2 | 200 credits |
| 15 | 15 | overpass=2, google=5, fb=4, ig=2, olx=2 | 800 credits |
| 50 | 50 | overpass=3, google=15, fb=10, ig=8, olx=8, wikidata=6 | 4k credits |
| 100+ | 100 | google=30, fb=25, ig=15, olx=15, wikidata=10, misc=5 | 12k credits |

**Invariants across ladder:**
1. `sum(per_provider_cap) >= global_slots`
2. `per_provider_cap <= registry.published_concurrency`
3. Rate governor gates the request, not the worker
4. Cost ceiling caps monetary risk independent of slot count
5. Every step requires MEASURED 24-48h observation before next

## Migration path

**M1** additive schema (taxonomy_node, geography, provider, discovery_work_item) · backfill from existing WALKED_CATEGORIES + city-registry.ts
**M2** dual-write registry (trigger writes matching rows to new table)
**M3** dual-read shadow picker (logs would-pick to `worker_cycle_run.summary.shadow_pick` for 72h observation)
**M4** cutover behind flag `NEX_PICKER=v2` per orchestrator tick · category-by-category
**M5** deprecate old table (READ_ONLY after 30 days green · never dropped)

Preserves: ONE Geographic Authority · Cutover 5 acceptance · Discovery ≠ Outreach · persistence contract · Provider Rate Governor · SATURATED semantics.
