# NEX · Accommodation Intelligence Workforce & Room / Services Data — Audit + Design Proposal

Philip · AUTHORIZE · 2026-09-06 · AUDIT + DESIGN ONLY · no implementation performed.

Sources: four parallel Explore audits of the running NEX codebase (`src/lib/nex/**`, `src/lib/nex-hq/**`, `scripts/nex-acquisition/**`, `deploy/postgres/init/**`, `docs/DECISIONS/**`). Every claim is cited to file:line evidence.

---

## 1 · Current architecture (bird's-eye)

NEX's accommodation-intelligence stack today has three loosely-coupled layers, all evidence-anchored:

```
┌─────────────────────────────────────────────────────────────────┐
│  ACQUISITION (scripts/nex-acquisition/**)                       │
│                                                                 │
│  Universal Acquisition Engine (engine.mjs)                      │
│    · parametrised by vertical config                            │
│    · accommodation-yogyakarta.mjs · food-yogyakarta.mjs · …     │
│    · sources/osm-overpass.mjs · sources/business-website.mjs    │
│                                                                 │
│  Orchestrated by:                                               │
│    · scripts/nex-discovery-orchestrator/_orchestrator-tick.mjs  │
│    · scripts/nex-discovery-rotation/_rotation-tick.mjs          │
│  Cron cadence: rotation 10 min · orchestrator 5 min             │
│  Currently DEFAULT-PAUSED for accommodation + food              │
├─────────────────────────────────────────────────────────────────┤
│  STORAGE (nex.* Postgres)                                       │
│                                                                 │
│  nex.accommodation_business        (canonical record · 41 cols) │
│  nex.accommodation_business_source_snapshot   (raw OSM tags)    │
│  nex.accommodation_business_field_provenance  (per-field trust) │
│  nex.accommodation_enrichment_evidence        (staged, empty)   │
│  nex.worker_cycle_run · nex.discovery_rotation_state            │
├─────────────────────────────────────────────────────────────────┤
│  READ / PRESENT (src/lib/nex/brain/**)                          │
│                                                                 │
│  world-adapters/accommodation-postgres.ts  → WorldRecord        │
│  presentation.ts                            → PresentedCard     │
│  entity-attribute-contract.ts               → AttributeMap (6-state) │
│  entity-result-cards.ts                     → EntityResultCard  │
│  entity-attribute-query.ts                  → attribute Qs      │
│  entity-pipeline.ts                         → stage contract    │
└─────────────────────────────────────────────────────────────────┘
```

Two facts drive everything downstream:

1. **The read path selects only 19 of 41 accommodation columns** (`accommodation-postgres.ts:26-49`). Provenance, freshness, and image-approval columns exist in the store but never reach `WorldRecord`.
2. **Everything that isn't a first-class column lives in flat `amenities: text[]`** — facilities, services, room attributes, capabilities all share one bucket.

## 2 · Existing accommodation workforce

**Walker inventory** (`scripts/nex-acquisition/engine.mjs:1-22` + config `accommodation-yogyakarta.mjs`):
- ONE Universal Acquisition Engine, parametrised per vertical
- ONE accommodation config (Yogyakarta + Magelang corridor)
- Config classifies OSM elements into 8 categories via tag rules + kos name-tokens

**Orchestration layer** (`src/lib/nex-hq/**`):
- `auto-orchestrator.ts` · queue-building + picker (MAX_SLOTS=10, FAIRNESS_CONSECUTIVE_CAP=2)
- `discovery-rotation.ts` · state machine `build → saturated → maintenance → reactivate` per (city, category, surface); SATURATION_THRESHOLD_CYCLES=3, COOLDOWN_HOURS=6 for accommodation
- `worker-config-resolver.ts` · parses `worker_config` strings like `accommodation:Yogyakarta:malioboro`

**Scheduler** (script-based, not Vercel cron):
- `_rotation-tick.mjs` every 10 min → updates `nex.discovery_rotation_state`
- `_orchestrator-tick.mjs` every 5 min when `NEX_ORCHESTRATOR_ENABLED=true` → spawns walker processes

**Current state**: `NEX_ORCHESTRATOR_PAUSED_CATEGORIES="food,accommodation"` is the default (`_orchestrator-tick.mjs:38-42`). Reason cited: *"100% ALL_DEDUPED on Yogyakarta-only bboxes, waste Overpass budget."* Reversible via ENV.

## 3 · Current hotel collection

**What ingests today** for a `category='hotel'` OSM element:
- Identity: `business_name`, `address`, `city`, `district`, `coordinates_lat`, `coordinates_lng`
- Contact: `phone`, `whatsapp_number`, `website`, `public_social_links` — only when the OSM element carries them (typically minority)
- Meta: `star_rating` (rare in OSM), `room_count` (rare), `hero_image_url` (mostly null)
- Amenities: flat `text[]` populated from OSM tags like `internet_access=yes → "wifi"`, `swimming_pool=yes → "pool"`
- Provenance: full raw payload cached in `nex.accommodation_business_source_snapshot`
- Trust: written to `nex.accommodation_business_field_provenance` at `trust_layer='source_import'`

**What does NOT ingest today**: room_types, bed_types, occupancy, private-vs-shared bathroom, per-room facilities, price, price_range, availability, booking_url, opening hours, check-in / check-out policies, email, alternate_name.

## 4 · Current villa collection

Same pipeline as hotel; no villa-specific extraction. Villa is discriminated **only** by `tourism=hotel + hotel=villa` OSM tag combo, or by matching `chalet` (`accommodation-yogyakarta.mjs:176-198`).

**Villa attributes declared in the AttributeContract but NOT in storage**:
- `bedrooms`, `bathrooms`, `capacity`, `private_pool`, `full_kitchen` (`entity-attribute-contract.ts:257-261`)

These attributes are visible to the read layer (attribute-query gate can answer "does the villa have a private pool?") but every answer resolves to `UNKNOWN` because no ingestion path populates them.

**Current state**: Contract is ready. Data is empty.

## 5 · Current kos collection

**What's implemented**:
- `category='kos'` is a valid enum value (migration 079, 2026-08-22)
- Classifier detects kos via name-token match: `/\bkos([- ]?kosan)?\b/i` (`accommodation-slots.ts:105`)

**Everything else missing**:
- Monthly rate — no field
- Furnished / unfurnished — no field
- Shared vs private bathroom — no field
- Gender policy (male / female / mixed) — no field
- Minimum rental period — no field
- Electricity billing model — no field
- Kitchen access — only as amenity token

Kos is currently a **name-based label with hotel semantics**, not a distinct entity model. Migration 079 explicitly says: *"Walker uses name-based detection … Never inferred from cheap-looking building alone."*

## 6 · Other accommodation categories

`homestay`, `hostel`, `apartment`, `resort`, `guesthouse` are enum-valid but receive **zero vertical-specific treatment**. Same ingestion, same schema, same contract, same card renderer. `presentation.ts:412-419` maps `accommodation` vertical to the single noun pair `"stay" / "stays"` regardless of subtype.

## 7 · Current schema

**Canonical table**: `nex.accommodation_business` — 41 columns, 19 selected by adapter (`accommodation-postgres.ts:26-49`).

**Adapter-selected fields (customer-reachable)**:
```
public_listing_ref · business_name · category · categories · city · district
· address · coordinates_lat · coordinates_lng · phone · whatsapp_number
· website · public_social_links · star_rating · room_count · amenities
· hero_image_url · rating · review_count · claim_status · owner_status
· updated_at
```

**Dead-in-read-path** (in DB but never surfaced): `internal_id · source · source_reference · source_ingested_at · source_checked_at · source_licence_terms · source_updated_at · last_verified_at · verification_source · dedupe_hash · star_rating_source · hero_image_source · hero_image_approved · hero_image_provenance · rating_source · review_count_source · created_at · created_by`

**Enums**:
- `claim_status ∈ {discovered, verifying, listed, invited, claimed, paying}` — 6 values
- `owner_status ∈ {unknown, contacted, responded, verified}` — 4 values
- `category ∈ {hotel, villa, guesthouse, homestay, resort, hostel, apartment, kos}` — 8 values

**Evidence tables that already exist**:
- `nex.accommodation_business_source_snapshot` · raw OSM payload per ingestion
- `nex.accommodation_business_field_provenance` · `(business_ref, field_name) → (trust_layer, cycle_run_id, written_by, source_reference)` · trust_layer ∈ `{source_import, nex_curated, admin_verified, owner_verified, admin_rejected}`
- `nex.accommodation_enrichment_evidence` · pre-staged Phase C table, EMPTY today

## 8 · Room-level gap analysis

**Verdict**: no room entity exists.

- No `nex.accommodation_room` table
- No `room_type`, `bed_type`, `occupancy`, `room_size` columns anywhere
- No structured `Room` type in TypeScript
- Only signal: `room_count` (bare integer, `accommodation-postgres.ts:80`) — meaning "we know there are N rooms" but nothing about kind, cost, or capacity per room

**Downstream consequence**: NEX cannot answer *"do they have a double room?"* today. Not because the gate is missing but because the underlying evidence isn't captured.

**What would be needed** (design only, do not implement):
- `nex.accommodation_room` first-class table with `(id, business_ref, room_type, bed_type, occupancy, private_bathroom, has_ac, has_wifi, size_sqm, price_per_night, price_currency, availability_flag, evidence_source, cycle_run_id, last_verified_at)`
- Row-per-room-type (not row-per-physical-room). One `hotel` might have `{DELUXE_KING × 12, STANDARD_TWIN × 20, FAMILY_QUAD × 6}` = 3 rows
- A Room-Evidence adapter that extracts room-type structured data from an owner-provided source (own-site JSON-LD, booking widget payload, owner claim form)

**OSM-only ingestion cannot populate this table**. Room-level intelligence requires either owner attestation OR an authoritative external source (Booking, Agoda, own-site JSON-LD `HotelRoom` type). None of those are wired today.

## 9 · Facility gap analysis

**Currently modelled** as flat `amenities: text[]` populated from OSM tags. Aliases resolved by `AMENITY_ALIASES` in `entity-attribute-contract.ts`.

**What works** (contract-supported, contract-tested):
- pool, wifi, parking, restaurant, cafe, bar, gym, spa, garden, terrace, elevator, reception, security, accessibility, ac, tv, balcony, kitchen, fridge

**What's missing at the data level**:
- No `private_pool` vs `pool` discrimination (both surface as `pool` amenity)
- No `pool_size`, `pool_type` (infinity, saltwater, kids), `pool_hours`
- No `wifi_speed`, `wifi_free_vs_paid`
- No `parking_free_vs_paid`, `parking_valet`
- No `elevator_count`, `wheelchair_accessible_specific_room`

**What's missing structurally**: everything above lives as a boolean-shaped amenity token. Present = probably-there (UNVERIFIED). Absent = UNKNOWN (never KNOWN_NO).

## 10 · Service gap analysis

Same schema mechanism as facilities (flat `amenities[]`) — no distinction between **facility** (something physically present at the property) and **service** (something the property does for you).

**Services currently token-supported**: laundry, breakfast, airport_transfer, room_service, housekeeping, front_desk, luggage_storage, transport_help.

**Missing at data level**:
- Service HOURS (24-hour vs limited)
- Service PRICING (breakfast included vs paid; airport transfer cost)
- Service RESERVATION requirement (do you have to book breakfast the night before?)
- Service AVAILABILITY (currently operating vs suspended)

**Missing structurally**: no `nex.accommodation_service` sub-table. If NEX wanted to say "breakfast served 06:30-10:00 Mon-Sun for IDR 75,000", nothing today can store that.

## 11 · Static / dynamic classification

Proposed classification per attribute class (subject to your validation):

| Attribute class | Class | Refresh cadence | Notes |
| --- | --- | --- | --- |
| `name`, `alternate_name` | STATIC | rare | Only on rebrand; annual refresh sufficient |
| `address`, `coordinates`, `city`, `district` | STATIC | rare | Same |
| `category`, `accommodation_type` | STATIC | rare | Only on classification correction |
| `phone`, `whatsapp`, `email`, `website`, `social_links` | SEMI_DYNAMIC | quarterly | Contacts change |
| `star_rating` (regulator-issued) | SEMI_DYNAMIC | annually | Regulatory refresh |
| `rating` (guest-review aggregate) | DYNAMIC | monthly | Fresh reviews shift it |
| `review_count` | DYNAMIC | monthly | Same |
| `room_count` | SEMI_DYNAMIC | annually | Structural |
| `room_types` (kind + count) | SEMI_DYNAMIC | annually | Structural |
| `facilities` (pool, wifi, gym) | SEMI_DYNAMIC | 6-month | Additions/removals rare but real |
| `services` (laundry, breakfast) | SEMI_DYNAMIC | 6-month | Same |
| `capabilities` (booking_url, booking_provider) | SEMI_DYNAMIC | quarterly | Contract-driven |
| `price`, `price_range` | DYNAMIC | daily / on-demand | Real-time is expensive; refresh daily is a reasonable default |
| `availability` (rooms open tonight) | DYNAMIC | real-time | Only pull on user request |
| `hours_of_operation` (breakfast times, front-desk hours) | SEMI_DYNAMIC | annually | Rarely change |
| `image` (hero) | SEMI_DYNAMIC | quarterly | Rebrand / renovation |
| `policy` (smoking, pets, check-in / check-out) | SEMI_DYNAMIC | annually | Same |

Contrasts with current single 90-day freshness clock in `entity-attribute-contract.ts:96`. A per-class freshness matrix is a design win — you keep the 90-day default for facilities but tune identity to "never stale" and availability to "always fetch fresh".

## 12 · Evidence hierarchy

**Existing** (`nex.accommodation_business_field_provenance.trust_layer`, migration 078):

```
source_import  <  nex_curated  <  admin_verified  =  owner_verified
                  admin_rejected  (never applied · audit only)
```

**Proposed refinement** for the AttributeMap runtime (aligning names with existing DB enum plus one addition):

```
owner_verified      · owner attested (WA claim + verified code)
admin_verified      · NEX staff verified via direct source contact
authoritative       · authoritative external (regulator, chamber of commerce)
directory_listed    · directory record (OSM · Foursquare OS · similar)
inferred            · derived from other evidence (e.g. category=hotel implies rooms exist)
unknown             · no evidence
```

`inferred` should be **treated identically to `unknown` for user-facing replies** — never surfaced as fact. Distinguishing it in observability lets us measure how often the retrieval layer would like to lean on inference (and refuse to).

`resolveStateWithEvidence()` in `entity-attribute-contract.ts:373-425` already implements owner-verified vs directory tiers. Adding `authoritative` and `inferred` is a small extension.

## 13 · Source inventory (what's legally + technically fetchable today)

| Source | Status | Coverage today | Notes |
| --- | --- | --- | --- |
| OpenStreetMap Overpass | **ACTIVE** | ID hotel/guesthouse/hostel/motel/apartment · building=hotel · leisure=resort | ODbL 1.0 · attribution required · 5-endpoint failover; rate-governed 2s/1-concurrent |
| Business own-website | **ACTIVE (enrichment only)** | contact, WA, social, images (og:image + JSON-LD) | ADR-0022 compliant; own-site only |
| Google Places API | **FROZEN (food-only shadow)** | not accommodation | Field-mask cost control · pending identity-resolver integration |
| tourism.go.id / Kemenparekraf | Documented, not wired | 0 | Ecosystem doc lists as candidate seed |
| Satu Data Indonesia (BPS) | Documented, not wired | 0 | Same |
| Foursquare OS Places | Documented, not wired | 0 | Apache 2.0 · high-value seed + dedup ground truth |
| Booking.com / Agoda | **Not wired** | 0 | No ADR authorising scrape / no API auth |
| Wikidata SPARQL | Documented, not wired | 0 | Optional enrichment |
| Owner-submitted (claim endpoint) | Exists for FOOD only | 0 for accommodation | `/api/nex-food/claim/start` template · same shape could apply to accommodation |
| Merchant-uploaded evidence (WA voice, photo, PDF) | Not wired | 0 | Ingestion pipeline missing |

**Read of the source landscape**: OSM + own-site enrichment gets you a solid identity + contact + amenities-token skeleton. Getting to room_types, prices, availability requires either owner attestation OR a licensed feed. **NEX has no path to structured room data today** without one of those.

## 14 · Freshness model

**Currently implemented** in `entity-attribute-contract.ts:96-101`:
- Default freshness: 90 days
- `identity` and `meta` categories: infinite (never stale)
- Everything else: 90 days
- STALE state fires when: positive evidence exists AND age > freshness AND record is NOT owner-verified

**Proposed refinement** (design only):

```
Class            Freshness    Rationale
─────────────    ─────────    ─────────────────────────────────────────
Identity         ∞            Only stale on merge/rebrand — always fresh
Coordinates      ∞            Physical location doesn't drift
Contact          90 days      Phone/WA/website changes on ownership change
Star rating      365 days     Regulatory annual review typical
Guest rating     30 days      Review aggregate drifts monthly
Facilities       180 days     Physical assets don't move; but renovations happen
Services         180 days     Similar
Room types       180 days     Structural
Capabilities     90 days      Booking-partner integration state can change
Prices           1 day        Rate cards change nightly
Availability     0 (on-demand)  Never cache — always live
Hours            365 days     Rarely revised
Images           180 days     Rebrand cycle
Policies         365 days     Slow-moving
```

Requires an `AttributeDef.freshnessMs` per attribute (contract already supports this) — but for the values to fire STALE properly, the DB needs a per-attribute `last_verified_at`, which does NOT exist today.

**Design decision needed**: do per-attribute freshness with a new table (`nex.accommodation_attribute_freshness (business_ref, attribute_id, last_verified_at, verification_tier)`) or approximate with attribute-CATEGORY freshness (one `last_verified_at` per category using the existing single record-level column).

## 15 · Conflict handling

**Current implementation** (`entity-attribute-contract.ts:378-393`): `CONFLICTING` state is *reserved* — the enum value exists but no producer emits it. Comment: *"For now, only produce CONFLICTING when we've explicitly detected both KNOWN_YES and KNOWN_NO evidence from different sources. Not reachable in current sources; kept for future use."*

**Design proposal**:
- When an enrichment adapter writes to `nex.accommodation_enrichment_evidence` with a value that disagrees with an existing `field_provenance` entry OR with a raw OSM tag, produce a `CONFLICTING` observation
- Never silently prefer newer evidence — enter admin adjudication (`nex.accommodation_business_promotion_decision`-style workflow)
- Runtime: attribute-query gate already has a `CONFLICTING` reply string ready (`entity-attribute-query.ts:299-302`)

**Conflict source examples** we should be ready for:
- OSM says `swimming_pool=yes`, owner claim says "we don't have a pool — that's the neighbours"
- Own-site JSON-LD lists `restaurant`, guest reviews say "no restaurant, just breakfast"
- Two OSM edits from different mappers disagreeing on category (`hotel` vs `guesthouse`)

## 16 · Owner verification path

**Existing pattern** (Food vertical): `POST /api/nex-food/claim/start` (evidence agent 2 audit §H):
- Two shapes: existing business claim (issues WA code) or new business registration (creates row at `claim_status='listed'` + `owner_status='contacted'`)
- Verify route (referenced) completes the loop — sets `owner_status='verified'`
- Every write audited to `nex.audit_log` with actor + before/after
- Every promotion carries `cycle_run_id` for provenance chain

**Accommodation status**: NO equivalent endpoint exists. Accommodation has no `/api/nex-accommodation/claim/*` route.

**Proposed path** (design only — do not implement):
1. `POST /api/nex-accommodation/claim/start` mirroring food shape
2. Owner WA code delivery via existing `nex.whatsapp_outbox` infrastructure
3. On verify: `owner_status='verified'` + write per-field provenance rows at `trust_layer='owner_verified'` for any fields the owner attests
4. Owner-attested attributes upgrade to `KNOWN_YES` in the read path automatically (already wired via `recordEvidenceTier`)

**Do NOT build an owner dashboard in this slice.** WA-code claim + subsequent WA-based Q&A is the minimum viable owner-attestation surface.

## 17 · Workforce architecture recommendation

**Recommend ONE walker, NOT eight**.

Reasoning:
- OSM tags for hotel / villa / hostel / apartment / guesthouse / resort all share the same tag families (`tourism=*` + `building=*` + `leisure=*`)
- Category discrimination is a classifier decision inside the walker, not a walker fork
- Adding a walker per category would multiply orchestrator overhead and split provenance trails
- Only `kos` has meaningfully different classifier logic (name-token match), and it's already handled inside the accommodation classifier

**Recommend TWO enrichment adapters** (new; layered on top of walker):
1. **Business-Website Enrichment Adapter** (`business-website.mjs` exists; extend it for accommodation)
   - Fetch own-site page
   - Parse JSON-LD `Hotel` / `LodgingBusiness` / `HotelRoom` schema.org objects
   - Extract room types, bed types, capacity, private_pool flag, check-in / check-out, hours, prices
   - Write to `nex.accommodation_enrichment_evidence` at `provenance_layer='source_import'`, `source_type='official_website'`
2. **Owner-Claim Adapter** (build new — mirrors `/api/nex-food/claim/start`)
   - Accept owner attestations via WA claim code
   - Write to `nex.accommodation_business_field_provenance` at `trust_layer='owner_verified'`

**Refresh cadence** by stage (design):
- **DISCOVER**: existing 5-min orchestrator tick when unpaused
- **COLLECT**: same walker pass
- **NORMALIZE**: same pass; extend classifier to emit per-category subline
- **ENRICH**: new stage · daily cadence for own-site fetches (respect robots.txt + rate limits)
- **VERIFY**: on-demand triggered by owner-claim inbound
- **STORE**: unchanged
- **RANK**: unchanged (existing scoring)
- **REFRESH**: driven by the per-attribute freshness matrix in §14 — pull triggers a targeted re-COLLECT for STALE attributes only, not a full re-walk

## 18 · Universal vs vertical-specific fields

**Universal accommodation fields** (apply to all 8 categories):
- Identity: name, alternate_name, address, district, city, coordinates, category
- Contact: phone, whatsapp, website, email, social_links
- Media: hero_image, image_gallery
- Facilities (any hotel-shaped thing has some subset): wifi, parking, ac, restaurant, laundry, breakfast
- Services: room_service, housekeeping, luggage_storage, front_desk
- Meta: rating, review_count, star_rating
- Provenance: source, cycle_run, trust_layer, last_verified_at

**Vertical-specific extensions**:

| Category | Extension fields |
| --- | --- |
| villa | bedrooms, bathrooms, guest_capacity, private_pool_flag, full_kitchen, garden, bbq, staff_included |
| kos | monthly_rate, furnished, shared_vs_private_bathroom, gender_policy, minimum_rental_months, electricity_billing_model, indoor_bathroom_flag |
| resort | activities[], on-site attractions, all-inclusive_flag |
| hostel | dorm_bed_count, mixed_dorm_flag, private_dorm_option, kitchen_access |
| apartment | bedrooms, bathrooms, kitchen_type, weekly_rate |
| homestay | host_included_meals, homeowner_present_flag |
| guesthouse | (largely hotel-shaped) |
| hotel | check_in_time, check_out_time, family_room_flag |

**Schema shape recommendation**: keep `nex.accommodation_business` as the canonical row-per-property. Put vertical-specific fields in a JSONB column `vertical_details` (add one column, get all 8 verticals covered) OR create per-category extension tables (`nex.villa_details`, `nex.kos_details`) linked by `business_ref`. JSONB is simpler but weaker for indexing/query; per-category tables are more work but query cleanly. Design decision needed before implementation.

## 19 · Update / change-detection model

**Currently implemented** (`scripts/nex-acquisition/engine.mjs:55-143`):
- `computeDedupeHash({name, address, phone, lat, lng})` — line 55-62
- `matchAgainstExisting()` — line 111-143: exact hash match, then fuzzy Jaccard on name + haversine distance
- Returns kind: `new` | `exact` | `high` (score ≥ 0.85) | `ambiguous` (0.60-0.85)

**What's missing**:
- No observed-value-changed logging
- No before/after audit for a field mutation
- `updated_at` bumps on every row UPDATE without capturing which fields changed
- No detection of ADDED / REMOVED amenity tokens between consecutive ingests

**Design proposal** (build on existing `field_provenance` table):
- On each re-walk of an existing row, diff amenity tokens (added vs removed vs unchanged)
- For each changed field, write a NEW provenance row with `written_at = now()`, capturing the new value's source
- Never overwrite an owner-verified value with a directory-import value (already the guard per migration 078 comment)
- Emit change events to a simple `nex.accommodation_field_change_log(business_ref, field_name, old_value, new_value, observed_at, cycle_run_id)` — small table, high signal

## 20 · Customer-query coverage matrix

Question · data required · currently available · acquisition possible · verification possible · freshness

| # | Question | Data required | Available today | Acquisition possible | Verification possible | Freshness class |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | "Does the first hotel have a pool?" | `facility:pool` | UNVERIFIED (via amenity token) | ✅ (own-site + owner) | ✅ (owner claim) | SEMI_DYNAMIC (180d) |
| 2 | "Which hotel has laundry?" | `service:laundry` | UNVERIFIED | ✅ | ✅ | SEMI_DYNAMIC (180d) |
| 3 | "Do they have double rooms?" | `room:bed_type` | UNKNOWN — no field | Partial (own-site JSON-LD if published) | ✅ (owner claim) | SEMI_DYNAMIC |
| 4 | "What rooms does the second one have?" | `room:list` | UNKNOWN — no room entity | Partial | ✅ | SEMI_DYNAMIC |
| 5 | "How many can the villa sleep?" | `villa:capacity` | UNKNOWN | Partial | ✅ | STATIC |
| 6 | "Does the villa have a private pool?" | `villa:private_pool` | UNKNOWN (pool token conflates) | Partial (own-site) | ✅ | STATIC |
| 7 | "Does the kos have AC?" | `kos:ac_flag` | UNVERIFIED | ✅ | ✅ | SEMI_DYNAMIC |
| 8 | "Is the bathroom inside?" | `kos:indoor_bathroom_flag` | UNKNOWN — no field | Partial | ✅ | STATIC |
| 9 | "Does the guesthouse have a kitchen?" | `facility:kitchen` | UNVERIFIED | ✅ | ✅ | SEMI_DYNAMIC |
| 10 | "Can I book the first one?" | `capability:BOOKING` | KNOWN UNAVAILABLE (correctly) | ⚠ requires booking integration | N/A | STATIC |
| 11 | "Is it available tonight?" | `availability:tonight` | UNKNOWN | ❌ requires live PMS | ❌ | DYNAMIC (0s) |
| 12 | "Which one is cheapest?" | `price:from_idr` | UNKNOWN — no price field | Partial (own-site + booking) | Partial | DYNAMIC (24h) |
| 13 | "Which one is closest?" | `coordinates` | KNOWN | ✅ | ✅ | STATIC |
| 14 | "Where did you find them?" | `provenance` | KNOWN (result-followup gate) | ✅ | ✅ | STATIC |
| 15 | "Do they have family rooms?" | `room:family_room_flag` | UNKNOWN | Partial | ✅ | SEMI_DYNAMIC |
| 16 | "Is it pet-friendly?" | `policy:pet_policy` | UNKNOWN — no field | Partial | ✅ | STATIC |
| 17 | "What time is check-in?" | `policy:check_in_time` | UNKNOWN | Partial | ✅ | STATIC |

**Reading the matrix**:
- Questions 1, 2, 7, 9 (facility/service Yes/No) — **shippable today** if we accept UNVERIFIED replies
- Questions 3–6, 8, 15–17 (structural + policy) — need own-site enrichment ingestion
- Questions 11, 12 (availability, price) — need booking-integration or licensed feed
- Questions 10, 13, 14 — already answered correctly today

## 21 · Data-quality model

**Not** a single "coverage %" target. Recommend a **per-class coverage report** where every metric is broken down by state (KNOWN_YES / UNVERIFIED / UNKNOWN / CONFLICTING / STALE / KNOWN_NO):

```
Per city × category × attribute-class:
  identity_coverage       (KNOWN_YES % / UNVERIFIED % / UNKNOWN %)
  contact_coverage
  media_coverage
  facility_coverage
  service_coverage
  room_coverage
  policy_coverage
  capability_coverage
  freshness_coverage      (fraction of KNOWN_YES fields within their freshness window)
  evidence_coverage       (fraction of KNOWN_YES fields with a valid cycle_run_id + source_reference)
```

Extend the existing `computeCoverage()` in `entity-attribute-contract.ts` (already 6-state aware) to bucket by attribute category and roll up per record → per (city, category).

## 22 · Security / governance boundaries

**Non-negotiables** (from ADRs already in the repo):

- **ADR-0022** — No third-party image copy from Google Business Profile / Facebook / Instagram / any indexed source. Only merchant-provided or merchant-authorised media may be displayed after a claim.
- **ADR-0023** — Directory imports store text-only per an explicit field list; never invent data; never create login credentials; never mark verified at create. All records start `status='listed', claimed=false, verified=false, visibility=public`. Claims ATTACH to existing listing.
- **SOURCE ≠ CAPABILITY** — OSM-sourced does not imply not-bookable. Capability lives in the `CAPABILITY_REGISTRY`, evidence-tracked separately.
- **UNKNOWN ≠ NO** — Missing evidence must never become a negative claim.
- **No fabrication** — Never generate a room name, a price, an amenity NEX can't cite.
- **Attribution required** — OSM data carries ODbL 1.0 attribution ("© OpenStreetMap contributors"). Own-site content carries the business's own attribution.
- **Cost budget respect** — `nex.cost_budget` per-branch daily cap ($10/day accommodation) governs any paid-API adapter (Google Places, future feeds).

## 23 · Implementation phases (proposal)

**Phase A · Contract & storage extensions (SCHEMA slice, no runtime change)**
- Add `nex.accommodation_room` table (per-room-type row-per-hotel)
- Add `nex.accommodation_business.vertical_details JSONB` column for villa/kos/etc.-specific fields
- Add `nex.accommodation_field_change_log`
- Add per-attribute freshness map (either via new table or JSONB per row)
- No walker changes. No presentation changes. Wire schema only.

**Phase B · Owner-verification pathway (mirror food)**
- `/api/nex-accommodation/claim/start` + verify routes
- WA-code delivery via existing outbox
- Provenance writes at `trust_layer='owner_verified'`

**Phase C · Enrichment adapter (own-site JSON-LD)**
- Extend `business-website.mjs` for accommodation with schema.org `LodgingBusiness` / `Hotel` / `HotelRoom` parsers
- Writes to `nex.accommodation_enrichment_evidence`
- Admin adjudication queue for CONFLICTING evidence

**Phase D · Category-aware presentation**
- Villa cards surface bedrooms/bathrooms/capacity/private_pool
- Kos cards surface monthly rate / gender policy / indoor bathroom
- Extend `HIGHLIGHT_PRIORITY` per (vertical, category)

**Phase E · Refresh cadence**
- Per-attribute freshness clock in place; STALE fires per-attribute correctly
- Targeted re-COLLECT for STALE attributes only

**Phase F · Price + availability (optional · long-horizon)**
- Requires a licensed OTA feed or a partner PMS integration
- Not in scope until an authorised source is signed

Each phase is its own AUTHORIZE. None of Phase A-F is implemented by this audit.

## 24 · Files likely required (estimate — NOT a file list to ship)

- Migrations: `deploy/postgres/init/1XX_nex_accommodation_room.sql`, `1XX_nex_accommodation_vertical_details.sql`, `1XX_nex_accommodation_field_change_log.sql`, `1XX_nex_accommodation_attribute_freshness.sql`
- Schema types: `src/lib/nex/brain/world-adapters/types.ts` (add `Room` type + `verticalDetails`)
- Adapter: `src/lib/nex/brain/world-adapters/accommodation-postgres.ts` (extend SELECT_COLS + rowToRecord)
- Contract: `src/lib/nex/brain/entity-attribute-contract.ts` (per-attribute freshness map · CONFLICTING producer · new evidence tiers)
- Query gate: `src/lib/nex/brain/entity-attribute-query.ts` (room-question classifier + reply builder)
- Enrichment: `scripts/nex-acquisition/sources/business-website.mjs` (JSON-LD `Hotel`/`HotelRoom` parser)
- Enrichment: new `scripts/nex-acquisition/enrichment/accommodation-website.mjs` orchestrator
- Owner: `src/app/api/nex-accommodation/claim/start/route.ts`, `/verify/route.ts`, service lib
- Presentation: `src/lib/nex/brain/presentation.ts` (per-category noun + vertical extension surfacing)
- Card projection: `src/lib/nex/brain/entity-result-cards.ts` (per-category HIGHLIGHT_PRIORITY branch)
- Rotation config: `scripts/nex-discovery-rotation/**` (add per-attribute-class refresh triggering)
- Tests: parallel per module (contract, query, room extraction, JSON-LD parse, owner-claim path)

Estimated total: **~20-25 files across 5-6 slices** (Phase A alone is ~6, Phase B ~5, Phase C ~5, Phase D ~4).

## 25 · Risks

**R1 · Silent scope expansion into a "full hotel PMS"** — the AUTHORIZE explicitly forbids building booking infrastructure. Every enrichment field added must first pass "does NEX genuinely need this for its user experience today?" Otherwise we build a data warehouse nobody visits.

**R2 · Own-site scraping fragility** — schema.org `LodgingBusiness` markup is inconsistent across Indonesian hotel sites. Many have zero structured data. An enrichment adapter that reads own-site is high-effort per hotel and low-yield in aggregate.

**R3 · OSM data debt** — vast majority of Indonesian accommodation rows lack even basic amenity tags. The problem is upstream. Improving NEX's contract doesn't change what OSM knows.

**R4 · Owner-claim adoption** — building a claim endpoint doesn't create claims. Without a business-side outreach programme (partnerships, WA outreach, incentive), verified rows remain scarce.

**R5 · Freshness policy drift** — a per-attribute freshness matrix generates lots of tiny refresh triggers. Without a rate-governor budget, this can produce unbounded Overpass / own-site fetches. Cost-budget integration is a prerequisite, not an afterthought.

**R6 · CONFLICTING adjudication backlog** — activating the CONFLICTING producer without an admin queue means conflicting evidence stalls in the enrichment table forever. Phase C must ship the admin queue alongside the producer.

**R7 · Vertical fragmentation** — the temptation to build a Villa Agent + a Kos Agent + a Homestay Agent will accelerate as feature requests come in. Recommend explicitly resisting: one walker, one adapter, category-aware presentation.

**R8 · Test-baseline drift** — any schema change (Phase A) must be paired with a baseline reconciliation like we did for Wave 3. Every future slice reports pre + post test counts.

## 26 · Explicitly deferred items

Per §21 of the AUTHORIZE, this audit does NOT authorize and this design proposal does NOT include:
- Autonomous production workers of any kind
- Scheduler changes (rotation-tick / orchestrator-tick unmodified)
- Daemon or background-loop introductions
- 24/7 workforce activation for accommodation (still `NEX_ORCHESTRATOR_PAUSED_CATEGORIES` default)
- Automatic production mutation of `owner_status` or `claim_status`
- Booking infrastructure or booking API
- Owner outreach (WA outbound to unclaimed businesses)
- Messaging businesses for enrichment
- Autonomous claim creation
- New agents (single walker doctrine preserved)

Also deferred to future AUTHORIZE:
- Room-level intelligence implementation (Phase A schema + Phase C ingestion)
- Villa / kos vertical-specific storage (Phase A schema)
- Owner-verification endpoint (Phase B)
- Own-site JSON-LD enrichment (Phase C)
- Category-aware presentation (Phase D)
- Per-attribute freshness triggers (Phase E)
- Price and availability integration (Phase F, requires licensed source)
- Owner dashboard UI
- CONFLICTING adjudication admin queue
- Change-log table implementation

---

# HARD STOP

AUDIT + DESIGN complete. No production data modified. No workers added. No scheduler changes. No database migrations run. No room tables created. No enrichment started. No autonomous collection. No owner-verification endpoint implemented. No booking integration. No customer-UI changes.

**Design proposal awaits your AUTHORIZE** for Phase A (schema extensions), Phase B (owner-verification pathway), Phase C (own-site JSON-LD enrichment), Phase D (category-aware presentation), Phase E (per-attribute freshness), or a scoped subset.

Recommended sequencing: **Phase A → Phase B → Phase C → Phase D → Phase E → Phase F**, each as its own AUTHORIZE with its own file budget and its own regression baseline. Each phase should ship with its own test-count reconciliation per the baseline discipline established during Wave 3 review.
