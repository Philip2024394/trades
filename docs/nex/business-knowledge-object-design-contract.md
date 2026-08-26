> **NEX's job is not to find the most highly rated place. NEX's job is to help the traveller make the right decision for their situation.**
> — Philip 2026-08-23 · the permanent architecture-doc sentence

---

# NEX Business Knowledge Object · Design Contract (v0.1 · 2026-08-23)

**Status:** DRAFT · awaiting Philip approval before ANY code · schema · or Walker changes
**Requested by:** Philip 2026-08-23 · *"Do the design/audit first. NO production code yet. NO schema changes yet. NO Walker changes yet. Return the design report and wait for my greenlight."*

**Governing doctrines:**
- `project_nex_business_knowledge_object_three_layer_2026_08_23` — 3-layer knowledge model
- `project_nex_intelligence_chain_discover_to_monetise_2026_08_23` — 7-stage pipeline
- `project_nex_location_intelligence_2026_08_23` — Location Intelligence constitutional
- `project_nex_location_distance_intelligence_precision_matched_to_confidence_2026_08_23` — Distance/travel-time precision-matching
- `project_nex_90pct_business_listing_doctrine_2026_08_23` — ≥90 auto-list gate
- `project_nex_walker_stays_pure_acquisition_2026_08_22` — Walker = acquisition only
- `project_nex_truth_invariant_2026_08_22` — never fabricate

**Guiding principle:** *"NEX should become as knowledgeable about a business and its surrounding environment as the business owner — ideally more useful to the customer than the owner is at explaining the location."*

---

## 0 · Ground rules (before the design)

Three inviolable rules bind every section below:

1. **Never throw away discovered information.** The existing `*_source_snapshot` tables (881 accom + 806 food) preserve every OSM tag as JSONB — that is the immutable raw evidence and MUST remain. Every new capability builds ON TOP of the snapshots, never replacing them.
2. **The Walker is the custodian, not the processor.** Walker = acquire + snapshot + basic typed columns + provenance. Enrichment/knowledge workers = extract structured knowledge. Brain = reason. The complete chain must be automatic, but each stage's boundary is preserved.
3. **Do not lower the ≥90 standard.** Weak data → enrich. Missing data → discover. Conflicting data → flag. Strong evidence → increase confidence. Never manufacture a 90 by loosening the bar.

---

## 1 · Business Knowledge Object · shape

Every business is a knowledge object with **10 attribute domains**, each with per-attribute provenance. Domain vocabulary is vertical-specific (accommodation has `room_count`, food has `cuisine`, trades has `certifications`, etc.); the shape is universal.

### 1a · Domain map

| Domain | Purpose | Examples (accommodation) | Examples (food) |
|---|---|---|---|
| **IDENTITY** | Who is this business? | official name · alt names · name:en/id · brand · operator · category · secondary categories | official name · alt names · brand · category · cuisine tokens |
| **LOCATION** | Where is it, honestly? | coords · confidence state · street · neighbourhood · district · target zone | same (universal domain) |
| **CHARACTER** | What is the atmosphere / style? | quiet · luxury · boutique · budget · family · romantic · business | quiet · lively · casual · fine-dining · romantic · family · work-friendly |
| **FACILITIES** | Physical infrastructure | WiFi · parking · pool · breakfast · restaurant · bar · gym · spa · laundry · AC · wheelchair | WiFi · parking · outdoor seating · air-con · wheelchair · high chairs |
| **SERVICES** | Actions the business performs | airport transfer · motorbike rental · room service · reservations · delivery · group services | delivery · takeaway · reservations · catering · private events |
| **OFFERS** | Commercial deals | group discounts · long-stay discounts · packages · seasonal offers · free breakfast/transfer | happy hour · set menus · group discounts · loyalty offers |
| **EXPERIENCE / CLAIMS** | Owner-authored + evidence-supported claims about experience | temple/sunset views · quiet street · walking distance to attraction · rice-field view | signature dishes · views · atmosphere claims · local specialities |
| **PRICING** | Prices with freshness + source | per-night rate · price range · what price includes | price range per person · set menu prices |
| **AVAILABILITY** | When + how to use | opening hours · reservation requirements · check-in/out · booking method | opening hours · reservation required · queue behaviour · booking method |
| **PROVENANCE** | Where every fact came from | source · source_type · source_url · discovered_at · confidence · raw_evidence · cycle_run_id · layer | (universal domain) |

### 1b · Attribute record shape (per fact)

Every attribute across every domain lives as a row in ONE polymorphic overlay table `nex.business_attribute` (proposed):

```
attribute_id       uuid PK
business_ref       text FK (polymorphic: food_business.public_listing_ref OR accommodation_business.public_listing_ref)
vertical           text ('food' | 'accommodation' | future)
domain             text ('IDENTITY' | 'LOCATION' | 'CHARACTER' | ... | 'PROVENANCE')
attribute_key      text ('has_pool' | 'brand' | 'group_discount' | 'sunset_view' | 'room_count' | ...)
attribute_value    jsonb (typed shape per attribute · flexible)
layer              text ('EVIDENCE' | 'CLAIM' | 'DERIVED')  -- see §6
source             text ('osm' | 'website:' | 'owner_form' | 'reverse_geo' | 'brain_derived')
source_type        text ('overpass_tag' | 'website_scrape' | 'review_text' | 'owner_input' | 'osrm_route')
source_url         text NULL
source_reference   text NULL (e.g. OSM node/12345, website URL slug)
raw_snippet        text NULL (verbatim source text if applicable)
raw_payload        jsonb NULL (structured raw evidence)
confidence         numeric (0.0-1.0) NOT NULL
discovered_at      timestamptz NOT NULL DEFAULT now()
last_verified_at   timestamptz NOT NULL DEFAULT now()
cycle_run_id       uuid NULL (FK to worker_cycle_run, when applicable)
superseded_by      uuid NULL (self-FK for evolution history)
created_by         text NOT NULL
```

Design notes:
- **Polymorphic** — one table serves all verticals. `vertical` + `business_ref` composite is the natural key with `attribute_key` for uniqueness scope.
- **Append-only history** — new attribute row per re-verification/enrichment · `superseded_by` chains for evolution (never silent overwrite).
- **JSONB `attribute_value`** — flexible per attribute (bool for `has_pool` · string for `brand` · int for `room_count` · nested object for `group_discount: { min_size: 5, discount_pct: 10 }`).
- **`layer` is the truth-level tag** — EVIDENCE (verified by source) · CLAIM (owner-said) · DERIVED (NEX computed from trusted evidence). See §6.

### 1c · Vertical-specific attribute vocabulary registration

Attribute keys are NOT free-form. Each vertical registers a whitelist:

```
nex.business_attribute_vocabulary
  vertical         text
  domain           text
  attribute_key    text
  data_type        text ('bool' | 'string' | 'int' | 'numeric' | 'jsonb')
  description      text
  first_registered timestamptz
  registered_by    text
  PRIMARY KEY (vertical, attribute_key)
```

Proposed initial vocabulary (subset · full list finalised after Philip approval):

**Accommodation:** `brand` · `operator` · `star_rating` · `room_count` · `has_pool` · `has_breakfast` · `has_wifi` · `has_ac` · `has_parking` · `has_wheelchair_access` · `has_airport_transfer` · `has_motorbike_rental` · `group_discount` · `long_stay_discount` · `check_in_time` · `check_out_time` · `pet_friendly` · `quiet` · `family_friendly` · `couple_friendly` · `view_type` (sunset · temple · rice_field · mountain · city)

**Food:** `brand` · `cuisine_primary` · `cuisine_secondary[]` · `has_wifi` · `has_parking` · `has_outdoor_seating` · `has_delivery` · `has_takeaway` · `has_reservations` · `price_range` (low/mid/high) · `atmosphere` (quiet/casual/lively/formal) · `signature_dishes[]` · `dietary` (halal/vegetarian/vegan) · `service_type` (dine_in/takeaway/delivery/all)

New attribute keys require a small admin registration step — prevents attribute-key sprawl.

---

## 2 · Provenance model

### 2a · Per-attribute provenance (built into the record shape above)

Every attribute carries `source` · `source_type` · `source_url` · `source_reference` · `raw_snippet` · `raw_payload` · `cycle_run_id`. Reconstructing the evidence chain for any fact is a single SELECT.

### 2b · Multi-source aggregation (compound confidence)

When multiple sources report the same attribute:

```
Business X · has_pool
  layer=EVIDENCE · source=osm · confidence=0.8 · raw="swimming_pool=yes"
  layer=EVIDENCE · source=website:hotelx.com · confidence=0.95 · raw_snippet="Our infinity pool..."
  layer=CLAIM    · source=owner_form:2026-08-01 · confidence=1.0 · raw="Yes, we have a pool"
```

**Compound confidence** = 1 − Π(1 − source_confidence) capped at 0.99 (never 1.0 · never absolute).

### 2c · Source authority tiers (proposed)

| Tier | Sources | Default confidence weighting |
|---|---|---|
| **T1** Owner-verified | owner_form (post-claim) · owner_direct_response | 0.90 (subject to claim being verified) |
| **T2** Cross-verifiable third-party | Google Places · Wikidata · official brand website | 0.85 |
| **T3** Open-source community | OSM (tag with recent check_date) · Wikidata claim | 0.80 |
| **T4** Community-scraped | website (unverified operator) · social profile | 0.65 |
| **T5** Inferred / derived | reverse-geocode · classifier · brain-derived | 0.50-0.75 depending on rule strength |

Tier is a **default** · specific attribute+source combinations can override (e.g. `owner_form` claiming "best sunset view" gets confidence penalty for superlative).

### 2d · Provenance invariants (locked)

- **Never** insert an attribute row without at least one populated provenance field.
- **Never** mutate an existing attribute row in place · always insert new + set `superseded_by`.
- **Never** promote CLAIM to EVIDENCE silently · requires a corroborating EVIDENCE-layer source with confidence ≥ 0.75.
- **Never** derive DERIVED from another DERIVED (max one derivation hop from EVIDENCE base).

---

## 3 · Location-confidence model (detail)

### 3a · The five states + assignment rules

| State | Assignment rule (deterministic) |
|---|---|
| **EXACT** | coord valid + in Yogya polygon + precision ≥5 dp + street_line resolved + street number present in address + meaningful neighbourhood assigned + source is verified (OSM check_date within 12mo OR owner-verified OR ≥2 sources agree) |
| **STREET** | coord valid + in Yogya polygon + precision ≥5 dp + address populated (street derivable) + meaningful neighbourhood assigned |
| **AREA** | coord valid + in Yogya polygon + meaningful neighbourhood assigned (no street detail) |
| **CITY** | coord valid + in Yogya polygon OR in-scope regency (Sleman · Bantul · Magelang tourism corridor) · NO meaningful-area match |
| **UNKNOWN** | coord missing OR coord invalid (0,0 · outside all in-scope polygons) OR classifier could not decide |

### 3b · Meaningful areas (initial v0.1 · to be refined)

Each area is `{ id, name, centroid_lat, centroid_lng, radius_km, character_tags[] }`:

| ID | Name | Centroid | Radius | Character |
|---|---|---|---|---|
| `malioboro` | Malioboro | -7.7925, 110.3660 | 0.8 km | shopping · tourism · lively · walkable |
| `prawirotaman` | Prawirotaman | -7.8135, 110.3670 | 0.8 km | backpacker · expat · cafés · nightlife · lively |
| `kaliurang` | Kaliurang | -7.5960, 110.4250 | 3.0 km | mountain · resort · quiet · nature |
| `borobudur` | Borobudur approach | -7.6079, 110.2038 | 3.0 km | temple · tourism · outside DIY |
| `prambanan` | Prambanan approach | -7.7521, 110.4914 | 3.0 km | temple · tourism · east Sleman |
| `yogya-city-core` | Yogyakarta city core | -7.8014, 110.3644 | 3.0 km | urban catch-all · fallback |

Area radius is a **soft** signal — a coord within `1.5 × radius` may be tagged but with reduced confidence · beyond `2.0 × radius` cannot be tagged as that area.

### 3c · Character tags on areas

Each meaningful area carries character tags (Philip's *"livelier at night"* / *"quiet street"* semantics) — feeds §4 relationship model + Brain reasoning without requiring per-business hand-authoring.

Example: `prawirotaman.character_tags = ['lively', 'nightlife', 'cafés', 'walkable', 'backpacker-friendly']` — a business tagged with this area inherits these characteristics as CONTEXT (not personal claims).

### 3d · Never-fabricate rules

- Never claim EXACT when evidence supports only STREET · AREA · CITY.
- Never invent `street_line` by reverse-guessing from coords alone (must be present in address string or reverse-geocoder response).
- Never assign a meaningful-area label when coord > 1.5 × area's radius from centroid.
- Every location decision writes a provenance row citing the exact rules that fired (in `geocode_evidence` jsonb).
- Default state is CITY, not EXACT.

---

## 4 · Geographic relationship model

A business does not exist in isolation. The model captures its relationships to landmarks, transport, other businesses, and area characteristics.

### 4a · Relationship types (all COMPUTED · not stored per-pair combinatorially)

| Relationship | Storage / computation | Precision constraint |
|---|---|---|
| business ↔ meaningful_area | stored (assigned in §3) | any confidence |
| business ↔ landmark (Malioboro / Borobudur / airport / train / bus terminal / hospital) | computed on-demand from coord × landmark coord · cached for hot pairs | precision matches business's location_confidence per Distance Intelligence doctrine |
| business ↔ nearby businesses (within R km) | computed on-demand · never stored per-pair · used for "walking cluster" / "restaurants nearby" answers | requires business's confidence ≥ STREET; nearby businesses' confidence surfaced individually |
| business ↔ transport point | same as landmark | same |

### 4b · Landmark registry (parallel to meaningful areas)

```
nex.geo_landmark
  landmark_id     text PK  -- 'malioboro-mall' · 'yogyakarta-tugu-station' · 'yia-airport' · 'borobudur-temple'
  name            text
  category        text     -- 'attraction' · 'shopping' · 'transport' · 'religious' · 'medical'
  centroid_lat    numeric
  centroid_lng    numeric
  meaningful_area_ids text[]  -- which areas this landmark sits inside
  source          text
  provenance      jsonb
```

Initial landmark set (~30 items) proposed for Yogyakarta:
- Attractions: Kraton · Taman Sari · Kotagede · Malioboro Street · Alun-Alun Kidul · Merapi viewpoint · Prambanan Temple · Borobudur Temple · Ratu Boko
- Transport: Yogyakarta International Airport (YIA) · Adisutjipto Airport · Tugu Station · Lempuyangan Station · Giwangan Bus Terminal · Jombor Bus Terminal
- Shopping: Malioboro Mall · Ambarrukmo Plaza · Jogja City Mall · Beringharjo Market · Pasar Sore
- Universities: UGM · UNY · UII
- Hospitals: RSUP Sardjito · RS Panti Rapih

### 4c · "Relationship compute" contract

For a customer query like *"restaurants near my hotel"*:

1. Read hotel's `location_confidence` — if UNKNOWN/CITY, degrade the answer honestly (see Distance Intelligence doctrine).
2. Compute nearby-business set via `ST_DWithin` (PostGIS) OR haversine (pure SQL) — cap radius to what confidence supports.
3. For each candidate, surface: its own `location_confidence` · distance to hotel (with matched precision qualifier) · its meaningful_area · its character tags.
4. Cache the (hotel_id → nearby set) result with a `confidence_at_compute_time` field · invalidate when either endpoint's confidence changes.

---

## 5 · Enrichment pipeline · build order

Philip approved the order **A → C → B → D**. Each stage delivers value independently.

### 5a · Path A · Snapshot re-parse (fastest · zero external API)

- Reads 1687 rows in `*_source_snapshot` tables (all rows we've ever discovered)
- Extracts EVERY OSM tag NEX doesn't currently type: `description` · `description:en/id` · `operator` · `brand` · `brand:wikidata` · `name:en/id/alt` · `opening_hours` (accom) · `email` · `check_date` · `contact:*` · rich address components (`addr:postcode` · `addr:province` · `addr:district` · `addr:neighbourhood` · `addr:subdistrict`) · `payment:*` · `reservation` · `wikidata` · building metadata
- Writes to `nex.business_attribute` with `layer=EVIDENCE` · `source='osm_replay'` · `source_reference=<osm_id>` · `raw_payload=<tag_pair>`
- Idempotent · dry-run mode default
- Expected impact: ~2000 new attribute rows across the 1687 businesses (rough — depends on OSM tag prevalence)

### 5b · Path C · Location Intelligence (Phase A+B previously scoped)

- **Sub-path C1** — schema (migration 087): adds `location_confidence` · `neighbourhood` · `street_line` · `in_target_zone` · `geocode_evidence` · `location_verified_at` · `location_source` to both food_business and accommodation_business
- **Sub-path C2** — meaningful-area registry table + landmark registry table + seed data
- **Sub-path C3** — reverse-geo enrichment worker: reads all 2127 rows · classifies 5 states · populates fields · writes provenance rows in `business_attribute`
- Idempotent · dry-run default
- Expected impact: ~80% of rows move from implicit-CITY to explicit-AREA once neighbourhood assignment runs

### 5c · Path B · Website / Source enrichment

- For rows with `website` populated (~54 accom · ~N food), fetch + parse:
  - About text (extracts CHARACTER + EXPERIENCE attributes)
  - Contact info (confirms/extends phone/whatsapp/email)
  - Pricing hints (per-night rates · price ranges)
  - Offers/packages
  - Amenities not in OSM
- Robots.txt-respecting · polite rate-limit · cached responses
- Writes attribute rows with `layer=EVIDENCE` · `source='website:<domain>'` · `source_url` populated · `raw_snippet` captured
- Where owner-authored superlatives detected (BEST/AMAZING/UNIQUE) → downgrade to layer=CLAIM with attribution

### 5d · Path D · Owner-claim enrichment (highest authority · slowest to activate)

- Requires the owner-claim funnel to exist (Task #47 / promotion pipeline work)
- Owner form writes layer=CLAIM rows (except identity fields where owner is authoritative)
- Confidence ceiling for CLAIMs stays at 0.85 for non-identity attributes until secondary EVIDENCE agrees
- Feeds MEASURE (7-stage pipeline) as owner-response-time is a behaviour signal too

### 5e · Non-negotiable staging

Path A and Path C1 can proceed in parallel (schema-only for C1). Path C2/C3 depends on C1. Path B depends on A being complete (needs typed `website` column + polite scraping infra). Path D depends on B (owner form validates against existing evidence).

---

## 6 · Computed vs sourced · the 3-layer truth model

Every attribute carries `layer ∈ { EVIDENCE, CLAIM, DERIVED }`:

### 6a · EVIDENCE

- Comes from a **verifiable external source** (OSM · Google Places · website · Wikidata · reverse-geocoder)
- Confidence starts at source_type default (T3=0.80 for OSM · T2=0.85 for Google Places · T4=0.65 for community-scraped website)
- Compound confidence rises with multi-source agreement (§2b)
- Surfaced to customer as fact ("Has WiFi" · "Rating 4.2 · 213 reviews")

### 6b · CLAIM

- Comes from the **business itself** (owner form · owner direct response · business's own website copy)
- Confidence capped at 0.85 for non-identity attributes (owner authoritative on their own identity · not on quality/reputation claims)
- Surfaced to customer with attribution ("Owner describes this as..." · "According to the property...")
- Superlatives (BEST · AMAZING · UNIQUE) automatically downgrade confidence by 0.20

### 6c · DERIVED

- Computed by NEX from EVIDENCE-layer facts (never from other DERIVED)
- Examples: `distance = f(business.coord, destination.coord)` · `walkability_score = f(nearby_landmarks, coord)` · `meaningful_area = f(coord, area_polygons)`
- Confidence = MIN(source_evidence_confidences) × derivation_rule_confidence
- Surfaced to customer as computed fact ("Approximately 15 minutes' walk" · "In the Prawirotaman area")

### 6d · Layer promotion rules

- CLAIM → EVIDENCE requires ≥1 corroborating EVIDENCE-layer source with confidence ≥ 0.75 on the SAME attribute_key
- EVIDENCE cannot be promoted to a higher layer (top of truth stack)
- DERIVED cannot be promoted (always derived from base evidence)
- Any layer can be superseded by a new row with `superseded_by` chain preserved

### 6e · Layer-aware Brain phrasing (customer-facing)

Brain reads the layer + confidence when composing answers:

- EVIDENCE + conf ≥ 0.90 → *"Has a pool"* (declarative)
- EVIDENCE + conf 0.65-0.89 → *"Appears to have a pool"* (softer)
- EVIDENCE + conf < 0.65 → *"May have a pool — I haven't confirmed"* (hedged)
- CLAIM (any confidence) → *"The property says they have a pool"* (attributed)
- DERIVED + conf ≥ 0.90 → *"Approximately 15 minutes' walk"* (with qualifier)
- DERIVED + conf < 0.90 → *"Roughly 15 minutes' walk"* (softer)
- No layer available → *"I don't have information about that yet"*

---

## 7 · How Brain consumes the knowledge object

### 7a · Query flow (proposed)

For a customer intent like *"quiet café within 5 minutes walking from Malioboro":*

1. **Intent extraction** (Brain) → { vertical=food, character=quiet, category=café, area=malioboro, max_walk_minutes=5 }
2. **Location-aware candidate set** (SQL) → businesses WHERE vertical=food AND category=café AND (meaningful_area='malioboro' OR distance_to('malioboro') within 5min×80m/min=400m) AND location_confidence >= AREA
3. **Character filter** → attributes WHERE attribute_key='atmosphere' AND value IN ('quiet','casual') AND confidence >= 0.65
4. **Relationship enrichment** → for each candidate, compute distance to Malioboro landmark with confidence-matched precision qualifier
5. **Answer composition** → surface per-candidate: name · distance (with qualifier) · area · character summary · evidence chain
6. **Ranking** → default: distance ascending; alternate: quality ≥90 first, then distance; customer can specify

### 7b · Evidence chain surfacing

Every recommendation must be able to answer *"why did NEX pick this?"* via the evidence chain. Design principle: the answer to "why" is a JOIN across the business_attribute rows that fired for the intent · never invented.

### 7c · Brain never fabricates attribute values

Reinforces `project_nex_brain_learns_patterns_not_facts_2026_08_22`. Brain reads existing attributes · learns patterns across many businesses (aggregate "kos owners in Yogya convert 3× faster with free-trial") · never writes per-business attributes without an EVIDENCE trail.

---

## 8 · Stale + conflicting information handling

### 8a · Staleness policy

Every attribute has `last_verified_at`. Staleness rules:

| Attribute domain | Fresh window | Stale action |
|---|---|---|
| IDENTITY (name · brand · category) | 24 months | Downgrade confidence by 0.10 · flag for re-verify |
| LOCATION | 12 months for STREET/EXACT · 24 months for AREA/CITY | Downgrade to next-lower confidence state |
| FACILITIES / SERVICES | 12 months | Downgrade confidence by 0.15 |
| OFFERS / PRICING | 3 months | Downgrade confidence by 0.30 · surface "Prices may have changed since 2026-05" |
| AVAILABILITY (hours) | 6 months | Same as facilities |
| EXPERIENCE / CLAIMS | 12 months | Same as facilities · never expires entirely |

**Never** delete a stale attribute — always downgrade + append a new row on re-verify with `superseded_by` chain.

### 8b · Conflict detection

Two sources reporting DIFFERENT values for the same attribute_key on the same business:

```
Business X · phone
  EVIDENCE osm      · +62-274-XXX · confidence 0.80 · last_verified 2025-11
  EVIDENCE website  · +62-274-YYY · confidence 0.85 · last_verified 2026-08
```

**Conflict resolution rules (in order):**
1. **Higher source-tier wins** (T1 owner_verified > T2 cross-verifiable > T3 open-source > T4 community-scraped)
2. **Fresher wins** (within same tier)
3. **Higher confidence wins** (within same tier + same freshness bucket)
4. **Unresolved conflict** → SAFETY=REVIEW · surface both to admin · never auto-choose · display both to customer with "verifying" flag

### 8c · Superlatives are not conflicts

Two sources saying "best café in Yogya" vs "best café in Prawirotaman" — both are CLAIM-layer attributed statements · not conflicting facts · both preserved with attribution.

### 8d · Never silently overwrite

Every enrichment run that changes an attribute value writes a NEW row with `superseded_by` pointing at the previous. The evolution history of every fact is a single SELECT.

---

## 9 · Interaction with the ≥90 listing gate

The Business Knowledge Object DIRECTLY feeds the ≥90 auto-list scorer (v0.1 contract at `docs/nex/business-listing-scorer-contract-90pct.md`).

### 9a · Which knowledge object domains feed which scorer tier

| Scorer Tier | Domains that feed it |
|---|---|
| **Tier A · Core Identity (40 pts)** | IDENTITY (name · brand · category confidence) + LOCATION (coords · address · district) |
| **Tier B · Contactability (20 pts)** | IDENTITY.contact channels (phone · whatsapp · website · social) |
| **Tier C · Freshness + Provenance (20 pts)** | PROVENANCE across all attributes (freshness · multi-source agreement · source depth) |
| **Tier D · Vertical Evidence (20 pts)** | FACILITIES + SERVICES + OFFERS + EXPERIENCE + PRICING + AVAILABILITY |

### 9b · How enrichment lifts scores toward 90

Currently: **0 rows** reach 90 because Tier B (contact) + Tier C (multi-source) + Tier D (vertical evidence) are largely empty.

After enrichment:
- **Path A (snapshot re-parse)** — recovers OSM's `operator` · `brand` · `check_date` · `contact:*` · `payment:*` · richer address components → boosts Tier A + Tier B + Tier C for ~10% of rows
- **Path C (location intelligence)** — populates neighbourhood → doesn't directly change scorer weights but SAFETY improves (no false EXACT surfaces)
- **Path B (website enrichment)** — pulls description · pricing · offers · facilities from websites → boosts Tier D significantly for the ~54 accom + N food rows with websites, adds a 2nd source for cross-agreement (Tier C)
- **Path D (owner claim)** — layer-1 CLAIMs for identity (owner authoritative) + facilities/services confirmation (owner + evidence = compound confidence) → substantial Tier D lift

### 9c · SAFETY tier reads the knowledge object too

- SAFETY_DUPLICATE reads `IDENTITY.dedupe_hash` across the business table
- SAFETY_IDENTITY_COLLISION reads `IDENTITY.business_name` + `LOCATION.coords` for near-duplicate detection
- SAFETY_COORD_INVALID reads `LOCATION.location_confidence` (UNKNOWN = veto)
- SAFETY_CONFLICTING_EVIDENCE reads the `superseded_by` chain and conflict-resolution outcomes from §8b
- SAFETY_THIN_PROVENANCE reads the source count per attribute

### 9d · The ≥90 threshold stays fixed

Reinforced: the threshold is a bar the DATA must reach, not a bar the SCORER lowers. Zero auto-list candidates today = correct signal. Enrichment is the answer, threshold adjustment is not.

---

## 10 · Expected resource cost on Victus

### 10a · Storage projections

| Table | Current | After Path A | After Path C | After Path B | After Path D |
|---|---|---|---|---|---|
| `business_attribute` (new) | 0 | ~15,000 rows | ~17,000 | ~25,000 | ~40,000 |
| `business_attribute_vocabulary` | 0 | ~50 entries | ~55 | ~80 | ~100 |
| `geo_landmark` | 0 | 0 | ~30 | ~30 | ~30 |
| `meaningful_area` | 0 | 0 | ~6 | ~6 | ~6 |
| `distance_cache` (Phase C+ · future) | 0 | 0 | 0 | 0 | ~1,000 hot pairs |

At ~500 bytes per attribute row: 40,000 rows ≈ **20 MB**. Trivial.

### 10b · Compute projections (per enrichment run)

- **Path A snapshot re-parse:** pure SQL over 1687 snapshot rows · ~2-5 seconds · zero external calls · runs in a single cycle
- **Path C reverse-geo:** in-memory polygon-point check across 2127 rows × 6 areas × 30 landmarks · ~1-2 seconds · zero external calls · runs in a single cycle
- **Path B website enrichment:** per-row HTTP fetch · ~2-5 seconds per website with polite delay · 108 rows total → **~10-20 minutes** wall-clock for full pass · rate-limited to avoid ban
- **Path D owner claim:** event-driven · runs on owner form submit · negligible

### 10c · RAM / CPU headroom check

Current Victus state: **680 MB free RAM · 12 CPU cores · load avg 0.00**. All enrichment paths:
- Peak ~50-80 MB per worker cycle
- No parallel scaling needed (single-threaded fine for <10K rows)
- No sustained CPU load
- **Compatible with current 6-worker load** without requiring the resource governor (already-planned governor is for Walker #3 addition, not for enrichment workers)

### 10d · DB pool impact

Enrichment workers use 1-2 connections each. Current pool: 9 active of 100. Adding all 4 enrichment paths simultaneously = +4-8 connections = still well within 60% governor ceiling.

### 10e · No new external API costs at Phase A + C

Phases A and C are 100% offline (snapshot replay + polygon math). Path B (website scraping) is polite HTTP with no paid API. Path D is internal.

---

---

## 11 · NEX Decision Context · Customer Trade-off Intelligence

Added at Philip's request 2026-08-23. **Design only** · no build until every underlying layer is live and audited.

### 11a · Why this section exists

The Business Knowledge Object (§ 1-2) tells NEX **what a business is**. Location Intelligence (§ 3-4) tells NEX **where it is and what surrounds it**. Decision Context tells NEX **why that information matters for a specific customer's request**.

Without this layer, NEX is a filtered search engine ("closest café to Malioboro"). With this layer, NEX is a reasoning guide ("Hotel A costs Rp100k more, but because you're planning to walk to restaurants and Malioboro, it may actually be the better value once transport is considered").

Philip 2026-08-23: *"The objective is NOT merely 'recommend the closest business.' The objective is: NEX understands the customer's actual objective and explains the practical trade-offs between the available choices."*

### 11b · The reasoning chain

```
BUSINESS → LOCATION → SURROUNDING AREA → DISTANCE / TRAVEL → PRICE
                                                              ↓
                              USER REQUIREMENT ← ← ← ← ← ← ← ←
                                       ↓
                                  TRADE-OFFS
                                       ↓
                                RECOMMENDATION (with explanation)
```

Every step in the chain reads from the layers below · never invents · never shortcuts. Every derived conclusion retains the underlying evidence chain (per § 2 provenance model + § 6 3-layer truth).

### 11c · Customer requirement dimensions (initial vocabulary · 8)

Every customer intent is parsed against these dimensions where signalled by the customer's message:

1. **Budget** — max spend total · max per unit (per night · per meal · per rental day) · currency-explicit
2. **Time available** — trip duration · daily time budget · scheduling constraints
3. **Walking preference** — willing/preferred walker · limited mobility · won't walk more than X min
4. **Transport preference** — has own vehicle · prefers taxi/ride-share · prefers public transport · no vehicle
5. **Group size** — solo · couple · family · small group · large group · accessibility needs
6. **Desired atmosphere** — quiet · lively · romantic · family-friendly · business · authentic-local · tourist
7. **Distance tolerance** — max distance to key destinations · willing to trade distance for other benefits
8. **Price/value trade-off orientation** — cheapest-wins · value-optimising · quality-first · time-priority

Dimensions are **inferred honestly** — if a dimension isn't signalled by the customer, NEX either asks a targeted follow-up OR reasons across possibilities and presents the trade-offs each yields. Never assumed.

### 11d-pre · Recent-experience signal · freshness NOT quality guarantee

Philip 2026-08-23: *"Don't make 'one positive review within 2 months' a quality guarantee. Make it a freshness signal."*

Five states NEX must distinguish:

| State | Marker | Meaning |
|---|---|---|
| Recent positive | 🟢 | Positive customer feedback / review / social mention within ~2 months |
| Recent negative | 🔴 | Negative feedback within ~2 months |
| Multiple recent signals | 🟢🟢 | Several positive OR negative within window (higher confidence) |
| No recent signal | ⚪ | Silence within window · notable for popular businesses but not conclusive |
| Old information only | ⚫ | Most recent signal older than freshness window |

**Rules for use:**
- **Never** promote a single recent-positive into *"This place is definitely excellent."* — phrase as *"There has been a recent positive customer signal."*
- **Never** silently suppress a recent-negative — surface honestly · customer decides how to weigh it.
- **Relevance filter** — signal about the food doesn't help when the customer asked about location · check whether signal domain matches the customer's requirement dimension before surfacing.
- **Volume matters** — 5 independent recent positives ≠ 1 · phrase accordingly.

**Signal source types (initial):** customer reviews (Google · TripAdvisor · direct NEX chat) · social mentions (via legitimate scraping) · direct NEX customer feedback · booking activity anomaly (surge/drop/pattern change) · owner response behaviour (response-time trend · sudden silence · reactivation).

**Schema impact (future · when this is built):** new table `nex.business_signal` with `business_ref` · `signal_type` · `polarity` · `observed_at` · `relevance_tags` · `source` · `source_url` · `raw_snippet` · `confidence` · provenance chain. Reads by Decision Context on candidate assembly · never overwrites Business Knowledge Object attributes.

### 11d-post · Destination mood · area character translation

Philip 2026-08-23: *"When someone says 'I don't want somewhere touristy and busy. I want somewhere relaxed.' NEX doesn't need the user to know the name of the neighbourhood. It can translate the human request → destination characteristics → businesses."*

**Translation flow:**

```
Customer mood-language ("relaxed" / "lively" / "quiet" / "authentic" / ...)
                       ↓
    Character-tag lookup against meaningful_area registry (§ 3c)
                       ↓
       Areas matching (each with match confidence)
                       ↓
Candidate businesses within those areas + individual character match
                       ↓
            Trade-off analysis + explanation
```

Customer never has to know the neighbourhood name. NEX translates.

**Reuses meaningful-area character_tags[] from § 3c.** No new area registry — just the reasoning that consumes it.

**Invariants:**
- Never invent an area characteristic to fit a customer mood.
- If no area matches the requested mood, say so honestly (*"I don't have a strong match for that in Yogyakarta right now — do you want me to search anyway?"*).
- Ambiguous requests ("somewhere fun") → clarifying question OR surface options for each interpretation.

### 11d · Trade-off categories (10 reasoning primitives)

These are the reasoning **templates** Brain composes to explain a recommendation:

1. Cheaper room but higher transport burden
2. More expensive room but walkable surroundings
3. Closer to customer's requested destination
4. Quieter area versus livelier area
5. Restaurant closer to attraction versus better atmosphere farther away
6. Family-friendly versus nightlife-oriented
7. Group discount versus normal price
8. Longer distance but materially better value
9. Walking option versus motorcycle/car requirement
10. Time saved versus money saved

Each primitive reads EVIDENCE + DERIVED facts and instantiates for the specific customer context. Never a hardcoded scoring formula — always a composed explanation.

### 11e · Reasoning flow (per customer request)

1. **Parse intent** into requirement dimensions (with confidence tags · unmarked = inferred)
2. **Assemble candidate set** by reading Business Knowledge Object + Location Intelligence — hard filters only (vertical · category · area · budget max)
3. **For each candidate, compute derived facts** relevant to the request (distance to landmark · walking time · total-with-transport cost · atmosphere match · group suitability)
4. **Identify applicable trade-off primitives** for this candidate set
5. **Compose an explanation** that surfaces the trade-offs with the evidence chain visible
6. **Never present a single "best" answer if trade-offs genuinely diverge** — surface 2-3 options with their respective trade-offs so the customer decides

### 11-lock · LOCK-IN: trade-offs not rankings · no single-score obsession (Philip 2026-08-23)

Philip 2026-08-23 verbatim: *"Don't let the system become obsessed with a single score. NEX should be able to say: 'This isn't the cheapest option, but it's the better overall choice for you because…' That means the future system needs trade-offs, not simply rankings."*

**Locked into the design:**

- **NO global ranking function.** No `overall_score = weighted_sum(price·distance·quality·atmosphere·...)` producing a single scalar "best."
- **Decision Context produces TRADE-OFFS** with the reasoning primitives (§ 11d) · never a scalar leaderboard.
- **Multiple options with their respective trade-offs** are the RIGHT output when dimensions genuinely diverge.
- **User priorities are DYNAMIC** — same underlying world data yields DIFFERENT recommendations depending on the user's stated priority.
- **The reasoning framework is intent-adaptive** — Brain re-reasons per query · not a precomputed ranking cache.

**User-changeable priority mechanism (first-class UX affordance · not re-search):**

| Customer says | Optimisation shift | Explicit trade-off |
|---|---|---|
| *"Cheapest."* | PRICING | Tier D vertical evidence traded off |
| *"I don't care about price, give me the nicest."* | CHARACTER + FACILITIES + recent-signal quality | PRICING traded off |
| *"I want somewhere quiet."* | CHARACTER=quiet + area character | central-location traded off |
| *"I want nightlife."* | CHARACTER=lively + area nightlife tags | quiet traded off |
| *"I don't want to use a car."* | 🚶 walkability + 🚕 transport-necessity=low | options requiring vehicle traded off |
| *"I want everything within walking distance."* | tight walkability radius | breadth traded for convenience |

Same knowledge object · same location intelligence · different reasoning composition per priority.

### 11-killer · The accommodation-relationship killer example (Philip 2026-08-23 verbatim)

> *"A user might say: 'I want a nice hotel for Rp450k.' A normal directory finds a Rp450k hotel. NEX should eventually think: 'There is a Rp350k hotel, but you'll probably spend Rp150k–250k more on transport during your stay because it's poorly positioned. The Rp450k hotel is within walking distance of restaurants, nightlife and the places you want to visit, so it may actually be the cheaper and more convenient choice.'"*

Concrete anchor for Axis #10 (accommodation relationship) + the walkability-eliminates-transport reasoning. Every future Decision Context test case should be measurable against this example.

### 11-signals · Behavioural signals feeding MEASURE stage (Philip 2026-08-23)

The following signals feed the MEASURE stage of the intelligence chain (`project_nex_intelligence_chain_discover_to_monetise_2026_08_23`) · not captured today · captured here so the reasoning framework knows what LEARN will eventually consume:

- What people search for · what they click · what they enquire about
- What prices they accept · what they reject
- Where they travel · how far they're willing to walk
- When they spend (time-of-day · day-of-week · seasonality)
- What categories they combine (hotel + restaurant + attraction sequences)
- Whether they prioritise price · convenience · atmosphere · quality (implicit priority inference)
- Which owners respond quickly · which owners convert enquiries · which businesses repeatedly satisfy customers

**Storage principle (locked):** these signals live in dedicated MEASURE-stage tables (proposed `nex.customer_interaction` + `nex.owner_response` when built) · NEVER inside the Business Knowledge Object · NEVER inside Location Intelligence · NEVER inside Decision Context reasoning code. Decision Context READS learned patterns from Brain · never writes them. Cross-ref: `project_nex_capture_payment_style_per_business_2026_08_23` for the payment-style specialisation.

### 11d-final · Destination-around-business rule + 10-axis reasoning (Philip 2026-08-23 amendment)

Philip 2026-08-23 verbatim: *"NEX should understand the destination around the business, not just the business itself."*

Reasoning about a business in isolation is a directory. Reasoning about a business PLUS its surroundings is a tour guide. Every candidate must be reasoned across surroundings — what's walkable, what area character the customer inherits, what they can do before/after/around.

**10-axis reasoning** (extends the earlier 6-axis · triggered by Philip's example: *"restaurant within 5 minutes of Malioboro · relaxed · good local food · somewhere to walk around afterward"*):

| # | Axis | Reads from | Question NEX answers |
|---|---|---|---|
| 1 | 📍 **Distance** | Location Intelligence + Distance Intelligence | How far · how long by which mode |
| 2 | 🍜 **Food / vertical-fit** | Business Knowledge Object (IDENTITY · CHARACTER · FACILITIES) | Does the offering match the request? |
| 3 | 🌴 **Mood** | Business CHARACTER + area character | Does atmosphere match how customer wants to feel |
| 4 | 🏛️ **Surroundings** | Meaningful-area registry + landmark registry + geographic relationships | What's around · area character |
| 5 | 🎭 **Character** | Business CHARACTER (nuance below area-level) | Individual venue feel vs area norm |
| 6 | 🚶 **Walkability-afterward** | Landmark + business set within walkable radius of candidate | Can customer keep walking · what's within reach after |
| 7 | ⭐ **Recent experience** | `business_signal` layer (freshness NOT quality guarantee) | Anything happening RIGHT NOW that changes NEX's answer |
| 8 | 💰 **Price fit** | PRICING domain + customer budget dimension | Does spend fit customer's stated preference |
| 9 | 🚕 **Transport necessity** | Distance + walking-preference dimension | Does customer NEED a vehicle OR can they walk |
| 10 | 🏨 **Accommodation relationship** | Cross-vertical join to customer's booked hotel/kos/guesthouse | Does this restaurant/attraction make the STAY location more valuable (walking eliminates transport)? |

**Axis #10 is the multiplier.** It's why choosing Hotel A (Rp450k, walkable to restaurants) can cost less overall than Hotel B (Rp350k, transport-dependent). The relationship between choices is the intelligence.

### 11d-cross · Cross-trip-type reasoning chains

Same 10-axis framework composes across different trip archetypes. NEX reasons ACROSS destinations, not just about single businesses:

- **Hotel-first** — hotel → restaurants → attractions → nightlife → shopping → transport
- **Restaurant-first** — restaurant → walking route → cultural site → café → evening entertainment
- **Family trip** — child-friendly activities → food → short walks between → cost
- **Business traveller** — hotel → airport → meeting location → restaurants near meeting → transport windows
- **Cultural tourism** — temple → nearby food → viewpoint → shopping → return transport
- **Long-stay expat** — kos/guesthouse → workspace → daily food → weekly shopping → gym → transport patterns

Framework is the SAME. Only requirement-dimension parsing + candidate assembly change.

### 11d-north · The big question NEX eventually answers

Philip 2026-08-23 verbatim: *"NEX can eventually answer not only: 'What's here?' but: 'Given what you want to do, where should you stay, eat, walk, visit and spend your money — and why?'"*

This is the North Star for Decision Context. Every design decision serves this question. The tour-guide test in § 11l-pre is how we check.

### 11d-signal · Recent-signal composite scoring (reinforcement)

Philip 2026-08-23: *"volume, source quality, sentiment and recency should all matter."*

Recent-signal weight is composite, never single-review promotion:

```
signal_weight = f(
  volume        : how many independent recent signals,
  source_quality: source tier (T1 owner > T2 cross-verifiable > T3 open-source > T4 community),
  sentiment     : positive · neutral · negative · with polarity strength,
  recency       : days since signal · linear decay within freshness window
)
```

A single 2-week-old T4 positive ≠ compound signal from 5 independent T2 sources over a month. NEX phrases each honestly.

### 11e-plus · Six-axis reasoning example (Philip 2026-08-23)

Customer: *"I'm staying near Malioboro. Where should I eat tonight?"*

NEX reasons across six axes for every candidate:

| Axis | Reads from | Example for a candidate restaurant |
|---|---|---|
| 📍 **Location** | Location Intelligence + Distance Intelligence | 6-min walk · 1.2 km by road · near Malioboro (confidence: STREET) |
| 🍜 **Business** | Business Knowledge Object (IDENTITY · CHARACTER · FACILITIES · SERVICES · PRICING) | Indonesian/local food · group-friendly · outdoor seating · Rp50-100k per person |
| 🌴 **Surroundings** | Meaningful-area character tags + geographic relationships | Lively evening area · shops within 200m · cultural attractions 400m |
| 🎭 **Mood** | Business CHARACTER + area character | Relaxed casual · not too touristy · walkable neighbourhood |
| 🏛️ **Culture** | Business + area cultural tags | Traditional/local · temple 500m · local market adjacent |
| ⭐ **Recent experience** | `business_signal` table (§ 11d-pre) | 🟢 Recent positive signal (2 weeks ago) · relevance: food quality |

Composed answer:

> *"I'd choose this one for you. It's about a 6-minute walk from Malioboro · the area is lively in the evening · and there has been a recent positive customer signal within the last few weeks. After dinner you can easily continue walking around the area rather than needing a bike."*

Every phrase traces to a real EVIDENCE / DERIVED / SIGNAL row · nothing invented.

### 11f · Example composition

Customer: *"I want a hotel in Yogyakarta for 3 nights. I want to visit Malioboro, Prambanan and some restaurants. My budget is Rp500k/night."*

Parsed dimensions: `budget=Rp500k/night` · `destinations=[malioboro, prambanan, restaurants]` · `duration=3 nights` · `walking-preference=unmarked` · `transport=unmarked`

Candidate set (filtered by budget + accommodation + Yogyakarta):
- Hotel A · Rp450k · location_confidence=STREET · Malioboro area
- Hotel B · Rp350k · location_confidence=STREET · Sleman-north · 5 km from Malioboro

Derived facts (all traceable via evidence chain):
- A → Malioboro: ~500 m · ~7 min walk (DERIVED from A.coords + malioboro_landmark.coords · precision matched to STREET)
- A → Prambanan: 17 km · ~35-45 min car (DERIVED)
- B → Malioboro: 5.2 km · ~15 min motorbike / ~25 min car (DERIVED)
- B → Prambanan: 12 km · ~25 min car (DERIVED)

Trade-off primitives that apply:
- #2 "more expensive but walkable surroundings" — A over B for Malioboro dining
- #3 "closer to destination" — B closer to Prambanan
- #1 / #9 "cheaper but higher transport burden" — B needs vehicle for Malioboro evenings
- #10 "time saved vs money saved" — A saves ~14 min × 3 evenings × 2 directions ≈ 1.4 h of transport

Composed answer:

> *"Hotel A is Rp450k/night · about 7 minutes' walk from Malioboro (confidence: street-level · exact door not verified). Hotel B is Rp350k/night but 5.2 km out — you'd need a motorbike or taxi for evening trips to Malioboro. Over 3 nights the Rp300k saving on B could be partly absorbed by transport costs. A is closer to Malioboro; B is slightly closer to Prambanan. If you're happy to walk evenings and take one longer trip for Prambanan, A may be the better value once transport is considered."*

Every fact in that answer traces to an EVIDENCE or DERIVED row · nothing invented · nothing more precise than the underlying confidence supports.

### 11g · What Decision Context is FORBIDDEN to invent

- **Prices** — must come from PRICING domain (EVIDENCE or CLAIM) · never inferred from category
- **Travel times** — must come from DERIVED distance × transport-mode function · never guessed
- **Offers/discounts** — must come from OFFERS domain (EVIDENCE or CLAIM) · never assumed
- **Atmosphere** — must come from CHARACTER domain (EVIDENCE via description text · review analysis · explicit tag) · never assumed from name or category alone
- **Business characteristics** — must come from FACILITIES / SERVICES / EXPERIENCE domains · never fabricated to fit the customer's request
- **Response times / behaviour patterns** — must come from BEHAVIOUR layer with n ≥ threshold · never fabricated for a specific business

### 11h · What Decision Context IS NOT

- **NOT a hardcoded recommendation formula.** No `best = 0.4 × price_score + 0.3 × distance_score + 0.3 × amenity_score` scalar. That's a search engine, not intelligence.
- **NOT a single "best answer" generator.** When trade-offs genuinely diverge, surface 2-3 options with their respective trade-offs. Let the customer decide.
- **NOT a "just recommend the closest" fallback.** Proximity is one dimension of 8, never the whole answer.
- **NOT a marketing engine.** Never favours businesses because of commercial relationship (subscription tier · sponsorship). Ranking = intent-fit, not payment.
- **NOT a decision made without an evidence chain.** Every recommendation surfaces WHY (with citations back to source attributes) on request.

### 11i · Interaction with the 7-stage intelligence chain

Decision Context = the RECOMMEND stage. It reads honestly from DISCOVER + VERIFY + UNDERSTAND + MEASURE + LEARN. It cannot fire correctly if any of those stages are 🔴 (not built) or 🟠 (thin). Per the intelligence chain doctrine: no stage may act on data the previous stage hasn't honestly delivered.

Current state map (from `project_nex_intelligence_chain_discover_to_monetise_2026_08_23`):
- DISCOVER 🟢 · VERIFY 🟡 · UNDERSTAND 🟠 · MEASURE 🔴 · LEARN 🟡 · **RECOMMEND 🟠** (this section is its future) · MONETISE 🔴

Decision Context CANNOT be built until UNDERSTAND is at least 🟡 (Path A + Path C landed) and MEASURE has at least basic behaviour telemetry.

### 11j · HQ visibility (when built)

Every recommendation NEX makes must be replayable in HQ:
- Customer intent that triggered it (with inference/confidence flags on parsed dimensions)
- Candidate set assembled
- Trade-offs considered
- Evidence rows that fired
- What was surfaced to the customer

**Auditable AI reasoning · never a black box.** This satisfies the Truth Invariant applied at the recommendation layer.

### 11k · Sequencing (locked)

Decision Context is **the last layer to build**. Prerequisites (in order):

1. Business Knowledge Object populated (§ 1 · needs Path A + B + D enrichment)
2. Location Intelligence populated with 5-state confidence (§ 3 · needs Phase A + C)
3. Distance Intelligence live (per `project_nex_location_distance_intelligence_precision_matched_to_confidence_2026_08_23`)
4. Brain learning patterns from ≥N conversations (per intelligence chain LEARN stage)

**Do NOT build Decision Context** until (1)-(4) are audited and live in the Yogyakarta laboratory. Design captured now so the reasoning framework doesn't get lost or accidentally hardcoded as the underlying layers land.

### 11l-pre · The mental model: "NEX as tour guide for any destination"

Philip 2026-08-23: *"'NEX as your tour guide for any destination' is actually a very strong mental model. The long-term architecture becomes: NEX knows the destination → understands the areas → understands the businesses → understands what's happening recently → understands the user's mood → recommends the best fit."*

This is the framing that drives every design decision below Decision Context. Every choice passes the tour-guide test:

- **Would a knowledgeable local guide say this to a customer?** — If not, NEX shouldn't either.
- **Would a knowledgeable local guide invent this?** — If not (they'd say *"I don't know"* or *"let me find out"*), NEX shouldn't either.
- **Would a knowledgeable local guide over-precise this?** — If they'd say *"about a 5-minute walk"*, NEX shouldn't say *"4 minutes 47 seconds."*
- **Would a knowledgeable local guide play favourites for a kickback?** — No. Neither does NEX (no commercial ranking).

### 11l · Bright lines

- Never invent prices · travel times · offers · atmosphere · characteristics.
- Never collapse trade-offs into a single scalar "best" when the dimensions genuinely diverge.
- Never rank by commercial relationship (subscription tier · sponsorship) — intent-fit only.
- Never present a recommendation without a retrievable evidence chain.
- Never phrase a derived conclusion with more precision than the underlying evidence supports (per Distance Intelligence precision-matching doctrine).

---

## Open questions for Philip (before greenlight)

1. **Attribute vocabulary approval** — do you want to see the initial ~50 attribute keys per vertical for approval BEFORE Path A runs, or is the polymorphic table's flexibility enough (approve category shape, let attribute keys accrete)?
2. **Meaningful areas** — the initial v0.1 set has 6 areas with centroid+radius. Do you want to validate/rename them, or shall we ship as-is and iterate?
3. **Landmark registry** — the ~30-item Yogyakarta landmark list needs your sign-off. Shall I attach the full list to this document?
4. **Table naming** — `business_attribute` polymorphic overlay OR per-vertical `food_business_attribute` + `accommodation_business_attribute`? Polymorphic recommended (one Brain interface); confirm.
5. **Layer promotion authority** — CLAIM → EVIDENCE promotion (§6d) currently requires ≥1 corroborating source. Should this require admin sign-off for high-stakes attributes (e.g. price · availability · owner-verification), or is the automatic promotion sufficient?
6. **Conflict resolution UI** — SAFETY=REVIEW conflicts go to HQ. New dedicated `/nex-head-quarters/knowledge-conflicts` page OR extension of existing Directory Factory review?
7. **Path A timing** — proceed as soon as approved, or wait until Path C1 (schema) is also approved so the two ship together?
8. **Website politeness** — Path B fetches external websites. Should NEX respect an explicit opt-out flag per business (e.g. owner request to not scrape), or is robots.txt sufficient?
9. **Historical evolution retention** — `superseded_by` chain preserves every version of every fact forever. At what row count should archival policy kick in?
10. **HQ visibility of enrichment progress** — new HQ page showing per-vertical enrichment coverage %? Or extension of existing Walker pages with an "Enrichment" tab?

---

## What is FORBIDDEN before greenlight

- Migration 087 (or any schema change)
- Any `business_attribute` INSERT
- Any modification to `nex-acquisition/` Walker code
- Running the reverse-geo enrichment against production data
- Adding tables `business_attribute` · `business_attribute_vocabulary` · `geo_landmark` · `meaningful_area`
- Website scraping of any URL
- Owner claim funnel changes

## What is REQUESTED after greenlight (staging)

1. Path A prototype as dry-run script (report per-attribute recovery counts before applying)
2. Path C1 migration + dry-run report of confidence-state distribution before applying
3. Path C2/C3 (meaningful areas + landmark seed + reverse-geo enrichment) once C1 lands
4. Path B (website enrichment) after A + C are audited
5. Path D (owner claim funnel) after all above

Every stage: dry-run + report + Philip approval before write. Truth Invariant + provenance chain preserved at every step.
