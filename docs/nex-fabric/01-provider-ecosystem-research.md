# Track A · Provider Ecosystem Landscape

**Safety boundary (recurring):** provider-INDEPENDENT, never provider-EVASIVE. When a provider's rate limit / ToS blocks a use case, route excess load to another legitimate provider or own-infrastructure — never engineer around the control. No CAPTCHA bypass, IP rotation-for-evasion, ToS circumvention, robots.txt violation, or identity spoofing.

## Ranked capability matrix (top 18)

Columns: Access · Cost · Rate/Concurrency · Indonesia coverage · Category strength · Freshness · Licence · NEX fit

| # | Provider | Access | Cost | Rate/Concurrency | ID coverage | Strength | Freshness | Licence | NEX fit |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **OSM planet dump** | Public bulk | Free (bandwidth) | N/A (weekly file) | Excellent | Places, amenities, shops | Weekly full · minutely diffs | ODbL | **Foundational.** Ingest to own DB; source of truth for own Nominatim/Overpass. |
| 2 | **Self-hosted Nominatim** | Docker | ~$40–120/mo VPS | Unlimited (own box) | Same as OSM | Forward + reverse geocoding | Rebuild weekly | ODbL | **Primary geocoder.** Removes 1 req/s cap on public. |
| 3 | **Self-hosted Overpass** | Docker | ~$60–200/mo, ~200GB | Set via env var | Same as OSM | Category + geo queries | Minutely diffs | ODbL | **Primary structured query.** Removes "Usage limit reached" outages. |
| 4 | **Photon** | Self-host | ~$30–80/mo | Unlimited | Same as OSM | Fast autocomplete on OSM | Rebuild periodic | Apache 2.0 (code) + ODbL (data) | Complements Nominatim for typeahead. |
| 5 | **Pelias** | Self-host | ~$80–200/mo | Unlimited | Multi-source | Multi-source geocoder | Configurable | MIT (code) + source licences | Alternative when WOF/OA matter. |
| 6 | **Foursquare OS Places** | Bulk (HuggingFace) | **Free (Apache 2.0)** | Bulk download | 100M+ POIs worldwide (ID present) | 22 core attrs | Quarterly-ish | Apache 2.0 · attribution required | **High-value seed** + de-dup ground truth. |
| 7 | **Wikidata SPARQL / dumps** | Public + bulk | Free | SPARQL: 60s query-time/min | Indonesia OK for notable places | Structured (coord/country/type) | Live | CC0 | Bulk dumps for enrichment. |
| 8 | **Google Places API (New)** | API key | Essentials $5/1k, Pro $17/1k | Adjustable per-method | Best-in-class Indonesia | Reviews, photos, hours, ratings | Real-time | Proprietary · caching restricted | **Enrichment tier only.** NOT bulk crawler. |
| 9 | **Mapbox Search / Geocoding** | API key | 50k free/mo → $5/1k | 600 req/min default | Good ID via OSM+overlays | Geocoding, POI | Real-time | Proprietary · broader storage rights | Reasonable fallback. |
| 10 | **HERE Places / Geocoding** | API key | 1k tx/day free tier | Freemium | Moderate ID | POI, addresses | Real-time | Proprietary | Fallback for structured POI. |
| 11 | **TomTom Search API** | API key | 2.5k req/day free | Volume-based | Moderate ID | POI, addresses | Real-time | Proprietary | Backup only. |
| 12 | **BPS Indonesia Web API** | Free key | Free | Per-key throttling | **Excellent** national | Sector counts, tourism directory | Annual/quarterly | Government open data | Enrichment + taxonomy driver. |
| 13 | **Satu Data / Kemenparekraf** | Public portal CSV/JSON | Free | No strict RL | **Excellent** national | Tourism/MSME directories | Irregular | Open Government Licence | Seed candidate lists. |
| 14 | **Brave Search API** | API key | 2k q/mo free · $5/1k | 1 qps free | Global (thinner ID vs Google) | Web + Local with business fields | Real-time (Brave index) | Proprietary | Cheap SERP-style URL discovery. |
| 15 | **SerpAPI / DataForSEO** | API key | $75–150/mo or per-req | Plan-based | Global | Google Maps/Search SERP | Real-time | 3rd-party · respect downstream ToS | **Tactical, not systemic.** |
| 16 | **schema.org JSON-LD + sitemap.xml + RSS** | Public web (robots-respecting) | Free | Per-host politeness (1/2s) | Excellent for merchant sites | LocalBusiness, Product, Service, Hours | Real-time | Site-dependent · own the extraction | **High-value.** Once URL known, cleanest first-party path. |
| 17 | **Tokopedia / Shopee Open Platforms** | Partner OAuth | Free (partner) | Per-app quotas | Excellent ID commerce | Products, categories, seller profile | Real-time | Partner ToS · authorised shop only | **NEX Market · opted-in merchants only.** |
| 18 | **OpenCorporates** | Key (free tier) | 200 req/day free | Free tier + paid | Indonesia limited | Legal entity graph | Slow | Various (CC-BY-SA many jurisdictions) | Optional legitimacy signal. |

## Recommended provider MIX · Indonesia Discovery (places)

| Tier | Surface | Role |
|---|---|---|
| **T0 own-infra** | Own OSM DB → own Nominatim + Overpass + Photon | 95% of routine queries |
| **T0 bulk seed** | FSQ OS Places (Apache 2.0 quarterly) | Seed + de-dup ground truth |
| **T1 government** | BPS + Satu Data + Kemenparekraf | Authoritative directories |
| **T2 public fallback** | Public Nominatim / Overpass (1 rps) | Own-infra warm-restarting |
| **T3 enrichment** | Google Places → Mapbox → HERE | Per-card only. Respect 30-day cache limit for atmosphere fields. |
| **T4 SERP discovery** | Brave Search (Local + Web) → SerpAPI | Discover candidate URLs → structured web extraction |
| **T5 structured web** | schema.org JSON-LD + sitemap.xml + RSS | Once URL known · cleanest first-party |
| **T6 enrichment** | Wikidata SPARQL/dumps · OpenCorporates | Optional graph enrichment |

## Recommended provider MIX · NEX Market (commerce)

| Tier | Surface | Role |
|---|---|---|
| **T0** | Tokopedia + Shopee Open Platforms (per-shop OAuth) | Only after merchant consent |
| **T1** | Merchant self-submission + POS integrations | Direct-signed · strongest freshness |
| **T2** | schema.org Product/Offer/Service JSON-LD from merchant sites | Public first-party markup |
| **T3** | GS1 GTIN + GDSN partner feeds | Catalog normalisation |
| **T4** | Google Shopping (Merchant Center partner) · Alibaba OpenAPI | Optional partner tier |

Explicitly out of scope: scraping Tokopedia/Shopee/Bukalapak/Lazada storefronts outside partner API — ToS-incompatible.

## Surfaces that MUST be self-hosted to scale

| Surface | Why | Est monthly infra |
|---|---|---|
| Nominatim | Public = 1 rps cap · own removes bottleneck | ~$40–120 VPS + weekly diff CPU |
| Overpass | "Usage limit reached" causing outages · public concurrency-capped | ~$60–200 (200GB disk + RAM) |
| Photon | Autocomplete latency on public not viable at scale | ~$30–80 |
| Pelias (optional) | If WOF/OA multi-source needed | ~$80–200 (ES cluster) |
| Own POI store (FSQ OS + OSM) | The one durable first-party asset | Storage only |

**Rule:** No production NEX cycle should be blocked by a public shared endpoint's rate limit or outage. Public endpoints are backup tier only.

## Surfaces NEX should NOT rely on

| Surface | Reason |
|---|---|
| Google Places as bulk crawler | 30-day cache limit on atmosphere fields · per-request cost prohibitive at 1M+ · ToS restricts storage of ratings/reviews |
| Yelp Fusion for Indonesia | Thin outside US · ToS restricts non-display use |
| Scraping Tokopedia/Shopee/Bukalapak/Lazada | ToS-incompatible · partner API is correct path |
| SerpAPI as systemic backbone | Downstream Google ToS burden · use tactical only |
| Public Wikidata SPARQL for bulk | 60s query-time/min hard limit · use dumps instead |
| Public Nominatim / Overpass as primary | 1 rps / concurrency caps designed for hobby traffic |
| Facebook Places at scale | Requires app review + user OAuth · not a crawler surface |
| Any provider requiring CAPTCHA-solving or IP rotation | **Constitutionally forbidden.** |

## Cost / capacity ceiling at scale

Assumes own POI store · enrichment only on high-value cards · Brave/SerpAPI tactical only.

| Records target | Own-infra | Commercial enrichment budget (opt) |
|---|---|---|
| **1M** | ~$200/mo | Google Places top 5% = 50k Pro calls ≈ $850/mo |
| **10M** | ~$600–1,200/mo | 200k Pro enrichments ≈ $3,400/mo + Brave $250/mo |
| **100M** worldwide | ~$4k–8k/mo | 2M enrichments ≈ $34k/mo tiered |

Ceiling driver at scale: compute + storage, not per-request API cost.

## Sources

- Nominatim Usage Policy — operations.osmfoundation.org/policies/nominatim/
- wiktorn/Overpass-API Docker (OVERPASS_RATE_LIMIT env)
- Google Places pricing 2026 (Woosmap, Google Developers)
- Foursquare OS Places (opensource.foursquare.com)
- Wikidata SPARQL query limits
- Portal Satu Data Indonesia (data.go.id) · BPS Web API · Kemenparekraf catalog
- Pelias GitHub · Photon GitHub
- Tokopedia developer portal · Shopee Open Platform
- Brave Search API pricing 2026
