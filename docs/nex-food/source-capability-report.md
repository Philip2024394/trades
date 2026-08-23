# NEX Food · Source Capability Report

> **Purpose.** Before activating any new discovery or enrichment source for NEX Food,
> this document evaluates it against the same criteria: legality, technical accessibility,
> field yield, cost, attribution, Indonesia/Yogyakarta coverage. Philip greenlights
> sources one at a time.
>
> **Excluded by doctrine (Philip 2026-08-21):** Google Places API, Google Search
> scraping, and any dark-pattern automation that bypasses CAPTCHA / auth / robots /
> rate limits / anti-bot controls. See pinned doctrine
> `project_nex_food_discovery_yogyakarta_v1_2026_08_21` → "NEX owns its discovery
> infrastructure · NO Google Places" section.

---

## Legend

- **Legality** — permitted for automated NEX use (Y / Y-conditional / N / Y-with-attribution)
- **Cost** — free / API key / paid
- **Coverage (Yogyakarta food)** — rich / moderate / thin / absent
- **Est. yield** — approximate additional businesses / additional contactability rows this source could add on top of what we have

---

## SECTION A · Currently active sources (in NEX today)

### A1 · OpenStreetMap · Overpass API

| Attribute | Detail |
|---|---|
| Legality | **Y** · Open Database License (ODbL) permits automated use with attribution |
| Cost | Free |
| Auth | None |
| Rate limit | Public endpoint · shared with global usage · ~1 request/sec advisory · 5 concurrent mirrors we already rotate |
| Attribution | Must display "© OpenStreetMap contributors · ODbL" wherever data appears (already wired on `/food` footer) |
| Coverage (Yogyakarta food) | **Moderate** · 812 named POIs city-wide (well below actual · 719 restaurant permits per city 2024 registry alone) |
| Fields provided | name · address · coordinates · phone (sometimes) · website (sometimes) · opening_hours (rare) · cuisine · social handles (rare) · dietary flags (rare) · service flags (takeaway/delivery) · accessibility · wifi |
| Contactability yield in NEX today | 78 phone · 9 WhatsApp · 43 website (of 806 rows) · **10.7% of universe** |
| Status | **ACTIVE** (Phase 2 + Phase 8.0.1 re-extract) |
| Notes | Gaps: warungs · angkringan · street stalls · newer places under-represented |

### A2 · Business websites (per-business fetch)

| Attribute | Detail |
|---|---|
| Legality | **Y-conditional** · public website content · we respect robots.txt · identifying User-Agent · light rate limit |
| Cost | Free |
| Auth | None (public pages only) |
| Rate limit | Self-imposed 5 concurrent · 1 req/sec per domain |
| Attribution | None required for facts extracted (phone / hours) · courtesy backlink where design permits |
| Coverage | Only businesses that HAVE a website URL (43 today) · 20/43 sites returned parseable HTML in our scan |
| Fields provided | WhatsApp links (`wa.me/*`) · phone (`tel:*`) · Instagram / Facebook / TikTok links · linktr.ee follow-through (very high yield · linktr.ee pages expose everything) |
| Contactability yield delivered | +9 WhatsApp · +5 Facebook · +5 TikTok · +2 YouTube on the 20 successful fetches |
| Status | **ACTIVE** (Phase 8.0.2) |
| Notes | Best-effort · many small business sites are Wix/Weebly SPAs that don't expose contact in initial HTML |

### A3 · Owner claims (NEX-native)

| Attribute | Detail |
|---|---|
| Legality | **Y** · owner voluntarily submits their own data via `/food/claim/[ref]` |
| Cost | Free · WhatsApp verification code is our own send |
| Auth | 6-digit code sent to WhatsApp destination + verified on submit |
| Trust tier | `owner_verified` · highest below no one · never overwritten by any automated import |
| Coverage | Grows organically as owners discover their listings + claim |
| Fields provided | Anything the owner chooses to input · dish photos · prices · hours · updated contacts · new categories · dietary declarations |
| Status | **READY** (Phase 6 · 1 real claim recorded to date · Nanamia Pizzeria) |
| Notes | This is the highest-trust source · gold standard · scales with directory SEO + word-of-mouth |

---

## SECTION B · Candidate open-data sources (evaluated · not yet active)

### B1 · Wikidata (via SPARQL)

| Attribute | Detail |
|---|---|
| Legality | **Y** · CC0 (public domain) · fully permitted automated use |
| Cost | Free |
| Auth | None (SPARQL endpoint public) |
| Rate limit | 60s query timeout · shared endpoint · ~1 query/sec recommended |
| Attribution | CC0 · no attribution required (courtesy backlink appropriate) |
| Coverage (Yogyakarta food) | **Thin** · Wikidata has ~50-100 notable restaurants globally in Yogyakarta (chain flagships · historic warungs like Gudeg Yu Djum · Michelin-mentioned) · not the long-tail |
| Fields provided | name · official website · social media handles · founding date · owner name (rarely) · latitude/longitude · notable-ness references (Wikipedia article link) |
| Est. yield for NEX | +30-100 businesses across all Yogyakarta · high-quality subset · basically the "famous" tier |
| Recommendation | **Activate as a secondary layer** · every business it identifies is a known-good famous place · low-noise addition |

### B2 · Wikipedia (article scraping · CC-BY-SA)

| Attribute | Detail |
|---|---|
| Legality | **Y** · CC-BY-SA · permitted automated use with attribution + share-alike |
| Cost | Free |
| Rate limit | ~1 req/sec per Wikimedia guidelines |
| Attribution | Must display "Wikipedia" + link back where used |
| Coverage | Even thinner than Wikidata · most restaurants don't warrant Wikipedia articles |
| Fields provided | prose description · founding history · notability · sometimes photos (Wikimedia Commons · separate licensing check per photo) |
| Est. yield for NEX | +5-20 businesses · deep enrichment for a handful of famous ones (e.g. Gudeg Yu Djum · historic Malioboro places) |
| Recommendation | **Later** · low-yield · use only if a NEX brain query needs prose context |

### B3 · OpenAddresses / Nominatim (address enrichment only)

| Attribute | Detail |
|---|---|
| Legality | **Y** · Nominatim ODbL (from OSM) · OpenAddresses public-domain fragments |
| Cost | Free |
| Rate limit | Nominatim: 1 req/sec · OpenAddresses: bulk downloads |
| Fields provided | Reverse geocoding · address standardisation · postal codes |
| Est. yield for NEX | Not new businesses · fills in missing `addr:*` fields for 500+ existing OSM rows with only coordinates |
| Recommendation | **Activate as an enrichment agent** · no new discovery · improves existing 806 |

### B4 · Yogyakarta Open Data Portal (`dataset.jogjakota.go.id`)

| Attribute | Detail |
|---|---|
| Legality | **Y** · Indonesian government open data · public domain / open licence per portal |
| Cost | Free |
| Format | XLSX (aggregate counts by district) · not per-business |
| Coverage | 719 restaurant permits (2024) · 845 (2023) · 200 (2022) · **but AGGREGATE not per-record** |
| Fields provided | Count of permits per kemantren (district) · NO business names/addresses |
| Est. yield | Zero direct business records · but valuable **validation reference** (compare NEX count vs official permit count per district to identify coverage gaps) |
| Recommendation | **Activate as a validation dashboard input only** · surfaces in HQ as "official 2024 permits: 719 · NEX discovered: N · gap: X" |

### B5 · Foursquare Places API (successor to Foursquare City Guide)

| Attribute | Detail |
|---|---|
| Legality | **Y-conditional** · developer terms require API key · attribution required |
| Cost | Free tier: 1,000 calls/day · paid tiers above |
| Auth | API key (requires developer sign-up) |
| Attribution | "Powered by Foursquare" required on any surface displaying their data |
| Coverage (Yogyakarta food) | **Thin-to-moderate** · Foursquare's Indonesia dataset is lighter than Google · possibly 200-500 Yogyakarta food POIs |
| Fields provided | name · address · phone · categories · tips · check-ins (social signal) · no email/WhatsApp |
| Est. yield | Speculative · likely 100-300 businesses · some overlap with OSM |
| **Blocker** | Requires developer account · same friction Philip is avoiding with Google Places |
| Recommendation | **HOLD** · same "third-party API + attribution" pattern Philip wants to avoid · only activate if OSM+website+owner-claim proves insufficient |

### B6 · Yelp Fusion API

| Attribute | Detail |
|---|---|
| Legality | **Y-conditional** · API key + ToS acknowledgment |
| Cost | Free tier: 500 calls/day |
| Coverage (Yogyakarta food) | **Very thin** · Yelp barely operates in Indonesia · likely <100 Yogyakarta food POIs |
| **Blocker** | API key requirement · thin coverage doesn't justify the setup |
| Recommendation | **REJECT** · not worth the setup for this region |

### B7 · GoBiz / Grab merchant lists (Indonesian food delivery platforms)

| Attribute | Detail |
|---|---|
| Legality | **N** · both platforms have anti-scraping ToS · no public API for third-party discovery |
| Coverage | Would be rich (thousands of Yogyakarta merchants) if accessible |
| Recommendation | **REJECT** · doctrine violation (bypassing anti-bot / ToS) |
| Notes | These are competing directories · legitimate access would require a partnership deal with GoTo Group / Grab · out of scope |

### B8 · TripAdvisor Indonesia / TheFork

| Attribute | Detail |
|---|---|
| Legality | **N** · ToS forbids automated scraping · robots.txt restricts crawlers |
| Recommendation | **REJECT** · doctrine violation |

### B9 · Instagram / Facebook (public profile data)

| Attribute | Detail |
|---|---|
| Legality | **N for automation** · both require Business Graph API partnership + review process · anonymous HTML scraping blocked at login wall (verified in our Phase 8.1.1 attempt) |
| Recommendation | **REJECT for automated discovery** · only usable if the business explicitly submits their handle via owner-claim flow |
| Notes | Individual businesses can still LINK their public IG/FB in the owner dashboard once claimed · that becomes owner-provided data · legitimate |

### B10 · Public government/tourism directories

Examples: Dinas Pariwisata Yogyakarta · Visit Jogja · TourismYogyakarta.com

| Attribute | Detail |
|---|---|
| Legality | **Y-conditional** · public directories · robots.txt varies · terms vary per site |
| Cost | Free |
| Coverage | Curated · usually only tourist-facing famous places · 50-200 per city |
| Fields provided | name · address · phone (sometimes) · category · description |
| Recommendation | **Evaluate per site** · Dinas Pariwisata data may already be under Indonesian government open data licence · candidate for owner-consent import |

### B11 · Owner-submitted CSV / API (self-registration channel)

| Attribute | Detail |
|---|---|
| Legality | **Y** · owner-provided · consent-based |
| Cost | Free (build cost only) |
| Coverage | Depends on outreach + marketing driving owners to submit |
| Fields provided | Whatever the submission form asks for |
| Recommendation | **Build as Phase 7.5** · a "Register your business" form on `/food/register` · owner submits · admin verifies · listing created directly with `admin_verified` trust |
| Notes | Complements owner-claim (which is for EXISTING listings) · this is for businesses NEX hasn't discovered yet |

---

## SECTION C · Recommendation matrix

| Source | Legality | Yogyakarta yield | Setup cost | Ongoing cost | Trust tier | Recommend now? |
|---|---|---|---|---|---|---|
| **OSM Overpass** | ✅ ODbL | +812 (done) | Zero | Zero | source_import | **KEEP · already active** |
| **Business websites** | ✅ Public+robots | +9 WhatsApp (done) | Zero | Zero | official_website | **KEEP · already active** |
| **Owner claims** | ✅ Consent | Grows organically | Zero (done) | Zero | owner_verified | **KEEP · already active** |
| **Wikidata SPARQL** | ✅ CC0 | +30-100 famous | Small (~1 file) | Zero | public_directory | **NEW · recommend activating** |
| **Wikipedia** | ✅ CC-BY-SA | +5-20 famous · deep prose | Small | Zero | public_directory | **Defer to Priority 4+** |
| **Nominatim reverse-geocode** | ✅ ODbL | Address enrichment for 500+ existing | Small | Zero | source_import | **NEW · recommend activating** |
| **Yogyakarta Open Data portal** | ✅ Open | Validation counts only | Small | Zero | validation-only | **NEW · recommend as HQ metric** |
| **Owner-submitted CSV form** | ✅ Consent | Depends on marketing | Medium build | Zero | admin_verified | **Build as Phase 7.5** |
| Foursquare API | ⚠️ Conditional | +100-300 | Card sign-up | Free tier | public_directory | **HOLD** · same friction Philip avoiding |
| Yelp Fusion API | ⚠️ Conditional | <100 | Card sign-up | Free tier | public_directory | **REJECT** · thin coverage |
| GoBiz / Grab | ❌ ToS | Rich but blocked | — | — | — | **REJECT** · doctrine |
| TripAdvisor | ❌ ToS | Moderate but blocked | — | — | — | **REJECT** · doctrine |
| Instagram/Facebook auto | ❌ Anti-bot | Blocked at login wall | — | — | — | **REJECT** · use owner-provided only |
| Google Places API | ❌ Philip-excluded | +300-500 contacts | Card sign-up | Free tier | — | **REJECT** · doctrine |
| Google Search scrape | ❌ ToS + doctrine | — | — | — | — | **REJECT** · doctrine |

---

## SECTION D · Recommended activation order

Given Philip's stated priorities (contactability > completeness · commercial acquisition universe > discovery universe · legitimate sources only · no billing dependency), the sensible order:

### Tier 1 · activate immediately (zero cost · zero friction)

1. **Nominatim reverse-geocode agent** — for the ~450 existing OSM rows with coordinates but missing address components, hit Nominatim to fill `addr:street` / `addr:suburb` / `addr:postcode`. Improves search/filter usefulness. No new businesses discovered. Small script.

2. **Wikidata SPARQL agent** — SPARQL query for `?item wdt:P31/wdt:P279* wd:Q11707` (instance of restaurant) with location bounded to Yogyakarta. Returns ~30-100 famous businesses. Dedupe against existing 806. Insert new as `claim_status='discovered'`. Small script.

3. **Yogyakarta Open Data portal (validation-only)** — pull the aggregate 2024 permit count per kemantren. Surface in HQ as "coverage vs official". Doesn't add new businesses, but tells us where our directory is thinnest.

### Tier 2 · build after Tier 1 proves value

4. **Owner-submitted registration form** (`/food/register`) — for businesses NEX hasn't discovered. Owner submits name/address/WhatsApp/hours/category. Admin verifies. Enters as `admin_verified` immediately (highest automated tier). Complements the existing owner-claim flow (which is for existing listings).

5. **Government/tourism directory agents** (per-site evaluation) — Dinas Pariwisata Yogyakarta first · check for open data licence · build one-off importer if licence permits.

### Tier 3 · only if commercial pressure justifies

6. **Foursquare API** — only if Tier 1+2 combined coverage still leaves the commercial universe well below the target (e.g. <30% ratio) and Philip decides an API-key source is warranted.

### Never (unless Philip explicitly reverses doctrine)

- Google Places API · Google Search scrape · TripAdvisor · GoBiz / Grab · Instagram/Facebook auto-scrape · Yelp

---

## Change log

- **2026-08-21** — Initial report (Philip 2026-08-21 doctrine change · "NEX owns its discovery infrastructure").
