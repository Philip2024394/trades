> **NEX's job is not to find the most highly rated place. NEX's job is to help the traveller make the right decision for their situation.**
> — Philip 2026-08-23 · the permanent architecture-doc sentence

---

# NEX Competitive Moat & World-Class Intelligence Design Audit (v0.1 · 2026-08-23)

**Status:** DRAFT · design audit only · **do NOT build anything from this document without Philip's explicit greenlight per capability**
**Doctrine anchor:** `project_nex_local_decision_engine_10_features_2026_08_23`
**Companion:** `docs/nex/business-knowledge-object-design-contract.md` (the 11-section design contract this audit maps against)

**Purpose (Philip's ask):**
> *"Map every proposed capability against the existing 11-section Business Knowledge Object contract. Identify what NEX can uniquely own, what competitors already do, what we should integrate rather than rebuild, what data the Walkers must collect now to enable it later, and what must remain future/gated."*

---

## 0 · The identity reframe (governing lens for the whole audit)

**NEX is a Local Decision Engine.** Not a directory · not a search engine · not a chatbot · not a travel planner. Every capability must serve the question:

> *"What is the best base from which this person can experience this destination — given what they want to do, their time, their budget, their preferences, and the honest evidence available?"*

The moat is NOT conversational AI. Google Ask Maps just launched Indonesian conversational discovery. The moat is what NEX DOES with the intelligence: total trip economics · walkability-afterward reasoning · business reliability · friction reasoning · explainable why-this-won.

---

## 1 · Capability → Existing Design Contract Map

Mapping each of Philip's 24 capabilities to the existing 11-section Business Knowledge Object contract:

| # | Capability | Maps to contract section(s) | Existing coverage | Gap |
|---|---|---|---|---|
| 1 | Destination Graph | § 4 (Geographic relationship model) · § 11e-plus | Concept covered — relationships computed on-demand | Need Relationship Graph subsection explicit; landmark/business/attraction/transport edges |
| 2 | Total Trip Cost | § 11d (Trade-off primitives) · § 11f (Hotel A vs B example) | Concept present in the killer example | Needs formal "True Trip Cost" primitive: room + transport + meals + activities + time |
| 3 | Time Cost (walk/bike/car/traffic/weather) | Distance Intelligence memory · § 3 | Precision-matching locked | Weather / heat / traffic are FUTURE Phase C+ additions |
| 4 | Walkability as lifestyle signal | § 11d Axis #6 (walkability-afterward) | Axis captured | Cluster-of-destinations reasoning not yet defined |
| 5 | Area Personality Engine | § 3c (character_tags on meaningful areas) | Framework present | Evidence-backed derivation (Brain learning) is future |
| 6 | Mood Search (intent decomposition) | § 11d-post (mood → area translation) | Concept present | 70/30 blended-intent parsing is Decision Context runtime |
| 7 | The NEX "Why?" | § 11 (Explainable Recommendations) | Locked | Runtime explanation composer future |
| 8 | Personal Travel Memory | Not in contract — needs new section 12 | ❌ Missing | Should add as § 12 with privacy-by-design guardrails |
| 9 | Personal Spending Intelligence | Payment-style capture memory | Doctrine present | No schema/design yet |
| 10 | "People Like You" | Not in contract — needs new section 13 | ❌ Missing | Requires MEASURE + LEARN + min-sample-threshold gates |
| 11 | Business Behaviour Intelligence | § 11-signals (behavioural signals list) | Signals list captured | No schema for `nex.owner_response` yet |
| 12 | Business Reliability Score | Not in contract — needs new section 14 | ❌ Missing (partial via ≥90 scorer) | Multidimensional internal model · never public stars |
| 13 | Friction Score | Not in contract — needs new section 15 | ❌ Missing | Should be a first-class attribute across LOCATION + BUSINESS + BOOKING |
| 14 | Experience Density | Not in contract — needs new section 16 | ❌ Missing | "How much can I do from here without travelling" as a location property |
| 15 | Destination Bubbles | § 4 (geographic relationship) · extends | Partially covered by area+relationship | Named cluster concept needs to be surfaced |
| 16 | Day/Night Transformation | Not in contract — needs new section 17 | ❌ Missing | Temporal overlay on character tags |
| 17 | Temporal Destination Intelligence | Not in contract | ❌ Missing | Morning/afternoon/evening/season/weather/events overlay |
| 18 | Recent Experience Engine | § 11d-pre (recent-signal 5-state) | Locked | Composite scoring formula captured; schema `nex.business_signal` deferred |
| 19 | Owner vs Customer Knowledge combined | § 6 (3-layer truth: EVIDENCE / CLAIM / DERIVED) | Locked | Runtime combination logic future |
| 20 | "NEX doesn't know" as feature | § 3d (never-fabricate) · § 11l bright lines | Locked | UI/UX phrasing templates future |
| 21 | Decision Receipt | § 11j (HQ visibility of every recommendation) | Locked | Runtime audit trail future |
| 22 | Learning economics of a place | Not in contract — needs new section 18 | ❌ Missing | Destination economics rollup |
| 23 | Local Decision Engine identity | This whole audit + `project_nex_local_decision_engine_10_features_2026_08_23` | Locked as CONSTITUTIONAL identity | Framing lens for all future decisions |
| 24 | Competitive positioning acknowledgement | § 3 below | Captured in this audit | Repeat check as competitors evolve |

**Gap summary:** 8 capabilities need dedicated new sections in the design contract (Personal Travel Memory · "People Like You" · Business Reliability Score · Friction Score · Experience Density · Day/Night Transformation · Temporal Destination Intelligence · Learning Economics). Recommend adding as § 12-18 in a follow-up contract revision **only after Philip approves this audit**.

---

## 2 · What NEX Uniquely Owns · The Moat

Where NEX can genuinely differentiate. Do NOT dilute effort chasing table-stakes competitors already do well.

| Moat capability | Why competitors don't have it | Data required | Build status |
|---|---|---|---|
| **True Trip Cost** (room + transport + meals + activities + time) | Google/Yelp/TripAdvisor sell rooms/reviews/reservations · none frame the whole trip's economics | Needs Location Intelligence + Distance Intelligence + PRICING attribute + typical spending patterns | ❌ Not built · design in Section 11 |
| **Walkability-afterward reasoning** (what can the user reach AFTER the primary intent) | Google shows distance · not "what evening cluster is walkable from here" | Needs destination graph edges + landmark set + area character | ❌ Not built · Axis #6 captured |
| **Business Reliability Intelligence** (multidimensional internal: responsiveness · quote behaviour · availability · conversion) | Yelp exposes response quality for services · fragmented across platforms · never as a single reasoning input | Needs `nex.owner_response` + `nex.customer_interaction` + longitudinal observation | ❌ Not built · signals list captured |
| **Owner quote behaviour** (low/high quoting · consistency · hidden fees · negotiation willingness) | Almost invisible in current directories · service-only in Yelp | Needs enquiry-quote-booking pipeline observation | ❌ Not built |
| **Transport-vs-price trade-off** (Rp350k+transport vs Rp450k+walk) | No competitor makes this the central UX | Needs Distance Intelligence + PRICING + transport-cost estimator | ❌ Not built |
| **Experience Density** ("14 restaurants + 6 cafés + 2 attractions within 10min walk") | Not exposed as a location property anywhere I've seen | Needs relationship graph + landmark + business coord density | ❌ Not built |
| **Friction Score** (distance · unclear location · slow owner · difficult booking · cash-only · language) | No competitor scores friction as a first-class dimension | Needs MEASURE + LOCATION + BOOKING + BEHAVIOUR | ❌ Not built |
| **Destination Character Graph** (evidence-backed area personality: mood + culture + energy + suitability) | TripAdvisor has destination pages · not a reasoning graph | Needs area registry + business character aggregation + review corpus | 🟡 Partial (§ 3c character_tags) |
| **Business → surrounding-world reasoning** (recommend a business by the LIFE around it) | Google shows nearby POIs · doesn't reason across them for a recommendation | Needs Destination Graph + Decision Context | ❌ Not built |
| **Why-this-won explanation** (defensible, auditable, controllable) | Google/Yelp/TripAdvisor recommendations are largely black-box | Needs Decision Receipt logging + evidence chain surfacing | ❌ Not built |
| **Uncertainty as a feature** ("NEX doesn't know" · "not enough recent evidence to be definitive") | AI competitors either overstate confidence or hedge everything | Needs confidence propagation through every layer | ✅ Locked in doctrines · runtime future |

**Moat depth = data + reasoning + explanation.** Data collection ≠ moat. Reasoning + explanation over reliable data = moat. This is why Philip's *"don't accumulate data without a world-class purpose"* is the correct sequencing constraint.

---

## 3 · What Competitors Already Do · Don't Rebuild

Ruthlessly acknowledge tables-stakes. Do NOT build clones of these.

| Capability | Competitor | State |
|---|---|---|
| Maps rendering | Google | 🟢 elite · integrate, don't rebuild |
| Turn-by-turn navigation | Google | 🟢 elite · integrate via link-out |
| Massive review corpus | Google · Yelp · TripAdvisor | 🟢 huge · we build EVIDENCE INTELLIGENCE on top, not a competing corpus |
| Basic conversational AI search | Google Ask Maps (now in Indonesia) · Yelp · TripAdvisor | 🟢 rapidly advancing · we must EXCEED it, not clone |
| Reservations / booking rails | Google · OpenTable · Yelp | 🟢 established · integrate where legitimate |
| Basic trip planning | Google · TripAdvisor | 🟢 growing · we build DECISION REASONING, not itinerary generation |
| Personalisation from search history | Google · Yelp | 🟢 mature · we build CONTROLLABLE preference memory (opt-in, correctable) |
| Owner response time (services vertical) | Yelp | 🟢 exists for services · we extend across ALL local commerce |

**Rule:** if a capability is 🟢 at Google/Yelp/TripAdvisor and it's not a moat item, we either integrate their surface OR we accept it as table-stakes and do not spend engineering on it.

---

## 4 · What We Integrate (rather than rebuild)

| System | What we use | What we don't rebuild |
|---|---|---|
| **OSM / Overpass** | Coord + tags + address + neighbourhood evidence | Complete map rendering (use OSM tiles or Mapbox for display) |
| **OSRM or GraphHopper** (self-hosted or hosted) | Route + travel-time computation | Do not build our own routing engine |
| **Google Maps / Places** (opt-in · if licensing works) | Cross-source verification of address/hours/phone | Don't own the map layer |
| **Existing review corpora** (Google Places API · legitimate scraping where allowed) | Recent-signal ingestion + cross-source evidence | Don't try to run our own giant review platform |
| **PostgreSQL + PostGIS** | Spatial queries (`ST_DWithin` · polygon-point) | Don't hand-roll spatial indexing |
| **VoxCPM2 · Qwen local · Tesseract** (already in memory) | STT / vision / LLM inference | Don't run cloud AI as default (Truth Invariant: NEX runs on local loop) |

---

## 5 · What Walkers Must Collect NOW · Enabling Future Without Changing Scope

**Critical:** Walker STAYS pure acquisition (`project_nex_walker_stays_pure_acquisition_2026_08_22`). But the Walker's *output shape* determines what future capabilities can be built without re-crawling.

Good news: The existing `nex.accommodation_business_source_snapshot` + `nex.food_business_source_snapshot` tables **already preserve full OSM tag payloads as JSONB**. Nothing acquired is being lost. Future capabilities can extract from snapshots without changing the Walker.

**What Walkers should DO NOW to enable later (in order of cheapest → most involved):**

| Action | Cost | Enables |
|---|---|---|
| **Nothing** for OSM-provided rich attributes — Path A snapshot re-parse will extract from existing snapshots | ✅ zero | Description · operator · brand · check_date · payment · contact:* · addr:district · addr:neighbourhood |
| **Nothing** for location intelligence — Path C reverse-geo enrichment runs against existing coords | ✅ zero | 5-state location_confidence · meaningful-area assignment · landmark relationships |
| **Consider** enabling `businessWebsiteSource()` for accommodation (comment in `configs/accommodation-yogyakarta.mjs:201` says currently disabled) | 🟡 small | Description · pricing hints · offers · about text (via Path B when built) |
| **Consider** Walker-adjacent capture of Google Places cross-reference (opt-in per-cycle) — this is enrichment not acquisition, but Walker COULD tag which businesses need it | 🟡 small | Cross-source agreement for Tier C confidence + T2 source authority |
| **Do NOT** add MEASURE-stage capture to Walker — that's a separate customer-interaction subsystem | ❌ blocked | Behavioural signals require dedicated `nex.customer_interaction` table when built |
| **Do NOT** add reasoning/scoring to Walker — that's Enrichment + Brain + Decision Context | ❌ blocked | Reliability score · friction score · trade-off reasoning all downstream |

**Recommendation:** Walker keeps eating exactly as it is today. The snapshots preserve everything we need. Enrichment layer (when built) does the work.

---

## 6 · What Must Remain Future / Gated

Nothing in this list should be built without an explicit doctrine memory + Philip greenlight per phase.

**Gated behind Business Knowledge Object contract + Location Intelligence completion:**
- Destination Graph edges + landmark set + Experience Density computation
- Total Trip Cost formula + transport cost estimator
- Time Cost with traffic/weather overlay
- Area Personality Engine (evidence-backed derivation via Brain patterns)
- Mood Search intent decomposition
- Destination Bubbles (named cluster identification)
- Day/Night Transformation temporal overlay

**Gated behind MEASURE-stage capture (`nex.customer_interaction` + `nex.owner_response` tables):**
- Business Behaviour Intelligence
- Business Reliability Score (multidimensional internal)
- Personal Spending Intelligence
- "People Like You" (with min-sample + confidence-threshold guards)
- Friction Score (needs booking + communication observation)
- Recent Experience Engine (`nex.business_signal` table)

**Gated behind Brain integration + Decision Context runtime:**
- The NEX "Why?" runtime composer
- Decision Receipt runtime logging
- Trade-off Reasoning runtime engine
- Personal Travel Memory (privacy-by-design controllable memory)
- Cross-trip-type reasoning chains

**Gated behind economic-observation aggregation:**
- Learning economics of a place (destination economics rollup)
- Value-zone identification
- Tourist-vs-local pricing detection

---

## 6b · SUITABILITY & SAFETY INTELLIGENCE (new constitutional dimension · 2026-08-23 amendment)

Added at Philip's request 2026-08-23 as an 11th constitutional feature alongside the original 10. Doctrine anchor: `project_nex_suitability_and_safety_intelligence_2026_08_23`.

### 6b.1 · The gap · what nobody currently does

Philip's explicit ask: *"research whether Google, Yelp, Tripadvisor, Maps, travel platforms or specialist services already provide equivalent contextual safety + child-suitability reasoning, rather than merely having safety information somewhere in their database."*

**Key distinction: HAVING safety data ≠ CONTEXTUAL safety reasoning.**

| Provider | Safety data they hold | Contextual reasoning they do | Gap NEX fills |
|---|---|---|---|
| **Google Maps** | Accessibility flags · popular times · some traffic overlays · Street View for visual assessment · government advisories link-out | Almost none — surfaces filters, doesn't reason "would I recommend this to THIS family at THIS time?" | Contextual composition + explainable why |
| **Yelp** | Safety complaints surface via review text · services-vertical response quality | Category-driven, not context-driven · no reasoning about the customer's situation | The context-per-customer layer |
| **TripAdvisor** | "Family-friendly" · "Kid-friendly" · "Wheelchair accessible" as binary filter tags · Safety incidents treated as distinct trust/safety concerns | Filter-based, not reasoning-based · doesn't distinguish "suitable for 12-year-old with life jacket" from "suitable for 6-year-old" | Context + evidence-tier + freshness layer |
| **Kidadl / VeryWellFamily / TripSavvy for Kids** | Curated family-friendly content | Editorial recommendations · not real-time · not personalised · not evidence-tier tagged | Live evidence-based reasoning per specific family |
| **US State Dept · UK FCDO · other government advisories** | Authoritative country/region advisories | Country-level · not per-venue · not per-activity · not personalised to customer situation | Per-venue + per-activity contextualisation |
| **Specialist adventure/activity operators** | Their own equipment records | Only for their own operations · fragmented | Cross-operator + cross-activity NEX view |

**Genuine gap NEX fills: contextual safety reasoning per specific customer + specific situation + evidence-tier + freshness — with the "Would I recommend this to THIS family?" test replacing universal filters.**

### 6b.2 · Constitutional rule (INVIOLABLE)

**NEX must NEVER convert missing safety information into "safe".** Absence of evidence is NEVER evidence of safety. This is a first-order Truth Invariant violation and any NEX code path that infers safety from popularity · rating · price · category · or absence-of-negative is broken.

### 6b.3 · The 5-tier source classification (Philip's exact ask)

Every safety/suitability claim NEX makes carries one of these source-tier tags, always attributed to the customer:

| Tier | Meaning |
|---|---|
| **VERIFIED** | Authoritative / current evidence (owner-verified + specific + recent · govt advisory · certified operator) |
| **OBSERVED** | Credible recent observation / review signal (multiple aligned recent reports) |
| **OWNER CLAIM** | Supplied by the business itself · unverified |
| **INFERRED** | NEX inference from geographic/environmental evidence · always clearly labelled |
| **UNKNOWN** | NEX does not have enough evidence |

### 6b.4 · Freshness-awareness (Philip amendment)

A 5-year-old observation must never be presented as today's condition. Per-domain freshness windows:

- Water activities / life jacket / equipment: 3 months
- Traffic exposure / road context: 12 months
- Terrain / infrastructure condition: 24 months
- Owner facility claims (high chairs · wheelchair access): 12 months
- Government advisories: use their own validity dates

Stale attributes auto-downgrade tier (VERIFIED → OBSERVED → UNKNOWN). NEX phrases accordingly.

### 6b.5 · Tour-guide tone (NOT warning-system tone)

Philip verbatim: *"Safety shouldn't become a scary '⚠️ Dangerous' warning system. That would make it annoying and destroy trust."*

- ✅ *"Boat trip: Good option for your family, but I'd confirm life jackets are available for both children before booking. I don't have verified evidence for the operator's current equipment."*
- ❌ *"⚠️ WATER ACTIVITY DETECTED — HAZARD"*

Respect the traveller's intelligence. Help them navigate. Don't compliance-checklist them into ignoring NEX.

### 6b.6 · The extended tour-guide test (locked · 4 questions)

Every recommendation must pass all four:

1. **What is around this place?** (Destination Graph)
2. **What will it cost the traveller in total?** (True Trip Cost)
3. **What experience will the traveller actually have?** (Character + Experience Density + Recent Signal)
4. **Is this appropriate and reasonably safe for this particular traveller?** (Suitability Intelligence · context-dependent)

Failing #4 fails the recommendation regardless of #1-3.

### 6b.7 · Suitability & safety in the moat table

Adding rows to the moat table in § 2:

| Moat capability | Why competitors don't have it | Data required | Build status |
|---|---|---|---|
| **Contextual Suitability Reasoning** ("Would I recommend this to THIS family at THIS time?") | TripAdvisor has binary filter tags · nobody does the per-customer-per-situation reasoning | Suitability attributes with 5-tier source + freshness + provenance | ❌ Not built · doctrine + design captured |
| **Evidence-tier Safety Intelligence** (VERIFIED / OBSERVED / OWNER CLAIM / INFERRED / UNKNOWN with freshness) | Others surface safety data but don't tier the evidence · absence-of-evidence often becomes silent "safe" | New SUITABILITY attribute domain in Business Knowledge Object | ❌ Not built |
| **"Before you go" briefing** (compact local intelligence per area: walking · traffic · water · food · children · weather · character) | No competitor composes this as a single briefing — closest is TripAdvisor destination pages (editorial, not per-customer) | Area registry + safety attributes + character tags | ❌ Not built · design captured |
| **Trip construction from constraint description** ("5 days · wife + 2 children · culture + food + walking · minimise cars") | Google/TripAdvisor do itinerary generation · none reason across suitability + trip economics + character + walking | Full stack: Business Knowledge Object + Location + Distance + Suitability + Decision Context | ❌ Not built |
| **Contextual food/water/transport safety phrasing** ("choose bottled water" · "agree fare before riding") | Some travel apps have generic country-level advice · nobody per-venue-per-customer | Suitability signals + Brain phrasing templates | ❌ Not built |

### 6b.8 · Schema shape (design-only · no build)

Suitability attributes live in the same polymorphic `nex.business_attribute` overlay proposed in the design contract (§ 1b), with a new `domain='SUITABILITY'` alongside IDENTITY/LOCATION/CHARACTER/etc.

Example attribute rows:

```
domain=SUITABILITY  attribute_key=child_suitability_state  attribute_value={"state":"conditional","age_min":8,"reason":"steep stairs"}  layer=EVIDENCE  source=owner_form  tier=OWNER_CLAIM  last_verified_at=2026-06-15  confidence=0.7
domain=SUITABILITY  attribute_key=life_jacket_provision   attribute_value={"provided":true,"child_sizes":true,"checked_at":"2026-08-01"}  layer=EVIDENCE  source=owner_form+photo  tier=VERIFIED  last_verified_at=2026-08-01  confidence=0.9
domain=SUITABILITY  attribute_key=night_walking_context   attribute_value={"lit":true,"pavement":"present","traffic":"low"}  layer=EVIDENCE  source=recent_observation  tier=OBSERVED  last_verified_at=2026-08-10  confidence=0.75
```

Same shape as every other attribute · no special-case schema · no schema built until Philip greenlights.

### 6b.9 · The reframe · this is now an 11th constitutional feature

The original 10 constitutional features become 11:

11. 🛡️ **Suitability & Safety Intelligence** — contextual, evidence-tiered, freshness-aware · never universal · never scary warning-system · always tour-guide tone · absence-of-evidence NEVER equals evidence-of-safety

## 7 · The 11 Constitutional Features · Locked (2026-08-23 amended · Safety added)

Every future NEX capability must serve one of these. Anything that doesn't is table-stakes or a distraction.

1. 🧠 **Destination Brain** — understands an entire area
2. 🗺️ **Relationship Graph** — business ↔ hotel ↔ restaurant ↔ attraction ↔ transport ↔ neighbourhood
3. 💰 **True Trip Cost** — price + transport + time + convenience
4. 🚶 **Experience Density** — how much can I do from here without travelling
5. 🎭 **Destination Character** — mood · culture · energy · family · nightlife · quietness (evidence-backed)
6. 📊 **Behaviour Intelligence** — what users actually choose · spend · reject · return to
7. 🤝 **Business Reliability Intelligence** — response · quote · availability · conversion · satisfaction (internal model)
8. ⭐ **Temporal Evidence** — what's happening RECENTLY (freshness composite)
9. ⚖️ **Trade-off Reasoning** — NEVER a single score
10. 🔍 **Explainable Recommendations** — defensible why · auditable · never black box
11. 🛡️ **Suitability & Safety Intelligence** — contextual · evidence-tiered · freshness-aware · never universal · never scary warning-system · always tour-guide tone · absence-of-evidence is NEVER evidence-of-safety

## 7b · DESTINATION CONTEXT GRAPH (Philip 2026-08-23 · CONSTITUTIONAL extension · pre-C2 blocker)

Doctrine anchor: `project_nex_destination_context_graph_2026_08_23`. Migration 087 stays UNAPPLIED until this section is captured.

### 7b.1 · The graph shape (11 nodes)

Every recommendation traverses this graph. Edges COMPUTED on-demand, never stored per-pair combinatorially.

```
Business → Immediate Surroundings → Area/Neighbourhood/Corridor/Belt → Destination
                                            │
     ┌──────────┬──────────┬──────────┬──────┴──────┬──────────┬──────────┐
     ↓          ↓          ↓          ↓             ↓          ↓          ↓
 Attractions  Activities  Food     Transport      Safety   Suitability  Temporal
                                                                       (recent signals)
```

Each node reads from its owning subsystem (Business Knowledge Object · Location Intelligence · Distance Intelligence · Suitability Intelligence · `business_signal` · Decision Context).

### 7b.2 · Distance metric distinctions (Philip's list · never conflate)

| Metric | Owning subsystem | Available today | Honest phrasing |
|---|---|---|---|
| 5 min away GEOGRAPHICALLY | Path C · straight-line | ✅ yes | *"about 5 min straight-line"* |
| 5 min WALKING (routed) | Distance Intelligence · OSRM/GraphHopper | 🔴 future | *(not available yet)* |
| 15 min by SCOOTER | Distance Intelligence | 🔴 future | *(not available yet)* |
| 25 min by CAR | Distance Intelligence | 🔴 future | *(not available yet)* |
| EASY with children | SUITABILITY + Distance + Terrain | 🔴 future | *(needs suitability signals)* |
| NOT suitable after dark | SUITABILITY + Temporal + area character | 🔴 future | *(needs night-context signal per area)* |
| GOOD rainy-day option | Business Knowledge weather-sensitivity attribute | 🔴 future | *(needs indoor/outdoor tag)* |
| CULTURAL / QUIET / BUSY / TOURISTY / LOCAL / FAMILY / ADVENTURE / ROMANTIC / FOOD-FOCUSED | Business CHARACTER + area character_tags | 🟡 partial (area character live via Path C · business character empty) | *"in the Prawirotaman neighbourhood · a relaxed backpacker + café district"* |

### 7b.3 · Before / During / After identity (extension)

NEX identity now covers three trip phases:

| Phase | NEX role | Owning subsystems |
|---|---|---|
| **BEFORE** | Help traveller choose the RIGHT BASE | Location + Distance + Suitability + Business Knowledge + Decision Context |
| **DURING** | Navigate real-time decisions · agree fares · translate confirmations · surface material info · protect against surprises | Traveller Protection + Suitability + Language layer (future) + Temporal signals |
| **AFTER** | Learn what happened → aggregate patterns → next traveller benefits | MEASURE stage + Brain LEARN + `business_signal` (future) |

The DURING phase is what makes NEX active traveller protection, not just search.

### 7b.4 · The 8 traveller questions · architectural mapping

**Q1 · *"Where should I stay if I want culture and walking?"***

| Need | Layer | Available today | Gap |
|---|---|---|---|
| accommodation candidates | food/accom Walker | ✅ 881 discovered | ≥90 gate blocks visibility (correct — see empty-state doctrine) |
| walkable location | Path C landmark radius | ✅ post-application | migration 087 not applied yet |
| "culture" attribute per business | Business Knowledge CHARACTER domain | 🟠 domain designed · unpopulated | needs attribute vocabulary + enrichment |
| trade-off phrasing | Decision Context | 🔴 not built | future |

**Q2 · *"I'm travelling with two children — what activities around this hotel are actually suitable?"***

| Need | Layer | Available today | Gap |
|---|---|---|---|
| activities vertical | separate Walker | 🔴 not exists | doesn't exist yet · attractions/landmarks partially cover |
| radius query from hotel | Path C landmark distances | ✅ post-application | 087 pending |
| child-suitability per activity | Suitability & Safety Intelligence | 🔴 no signals captured | new SUITABILITY domain + 5-tier source classification (VERIFIED/OBSERVED/OWNER CLAIM/INFERRED/UNKNOWN) |
| tour-guide contextual answer | Decision Context + Traveller Protection | 🔴 not built | future |

**Q3 · *"What can we do nearby if it rains?"***

| Need | Layer | Available today | Gap |
|---|---|---|---|
| nearby POIs | Path C | ✅ post-application | 087 pending |
| indoor vs outdoor per POI | Business Knowledge FACILITIES / weather-sensitivity | 🔴 attribute not captured | new attribute key needed |
| weather-alternative reasoning | Decision Context | 🔴 not built | future |

**Q4 · *"What activities are safe enough for my family based on current evidence?"***

| Need | Layer | Available today | Gap |
|---|---|---|---|
| activities set | (see Q2) | 🔴 | future |
| safety-evidence tier + freshness | Suitability & Safety Intelligence | 🔴 no signals captured | 5-tier source · freshness windows per domain |
| "for my family" contextual filter | Decision Context + Suitability | 🔴 not built | contextual reasoning · "would I recommend to THIS family?" |
| honest "NEX doesn't know" phrasing | Traveller Protection (materiality test) | ✅ doctrinal | phrasing templates future |

**Q5 · *"Can we walk back here after dinner?"***

| Need | Layer | Available today | Gap |
|---|---|---|---|
| route back | Distance Intelligence · routed walking | 🔴 straight-line only today | OSRM/GraphHopper integration |
| night safety context | area character_tags temporal + SUITABILITY | 🟡 area character static · no night-specific | temporal-context signal per area |
| lit/pavement/traffic factors | Business/area attribute | 🔴 not captured | needs enrichment (potentially observations layer) |

**Q6 · *"Which hotel gives us the best overall base for experiencing Yogyakarta without relying on transport?"***

**This is the ACCOMMODATION-RELATIONSHIP KILLER question (from Decision Context memory).** What's needed:

| Need | Layer | Available today | Gap |
|---|---|---|---|
| walkable landmark cluster per hotel | Path C landmark radius | ✅ post-application (36% accom already <500m from a landmark) | 087 pending |
| "without transport" filter | walkability + Distance Intelligence | 🟡 walkability computable now · transport-necessity needs routed times | Distance Intelligence phase |
| trade-off reasoning "cheaper hotel + transport vs pricier hotel walkable" | Decision Context axis #10 | 🔴 not built | Decision Context runtime |
| True Trip Cost | Decision Context · Trip Cost primitive | 🔴 not built | future |

**Q7 · *"What should I know before taking this boat/water activity?"***

| Need | Layer | Available today | Gap |
|---|---|---|---|
| activities · specifically boat/water | Walker for activities | 🔴 no activities vertical | new Walker (blocked on governor per parallel-Walkers doctrine) |
| life-jacket evidence · equipment adequacy | Suitability & Safety Intelligence · VERIFIED source tier | 🔴 no signals captured | requires operator-verification workflow |
| "Before You Go" briefing composition | Traveller Protection Principle signature capability | ✅ doctrinal · phrasing anchors locked | Brain composer future |
| Post-trip feedback loop | Recent Experience Engine · self-improving intelligence network | 🔴 `business_signal` table not built | future |

**Q8 · *"What should I agree with the driver before getting in?"***

| Need | Layer | Available today | Gap |
|---|---|---|---|
| transport-safety intelligence (fare agreement · route risk · price-transparency norms per area) | Suitability & Safety Intelligence · sub-domain #3 (transport) + #12 (price transparency) | 🔴 no signals captured | new attribute vocabulary + regional norms |
| language / translation of confirmation questions | Language layer (Traveller Protection · signature capability) | 🔴 not built | Brain phrasing + potentially local LLM translation |
| retain agreed price/context as travel record | MEASURE-stage (customer_interaction) | 🔴 not built | future |

### 7b.5 · What each subsystem contributes

| Subsystem | Contributes to graph | State today |
|---|---|---|
| **Business Knowledge Object** | Identity · Character · Facilities · Services · Offers · Experience · Pricing · Availability · Provenance domains | 🟠 designed · unpopulated |
| **Location Intelligence (Path C)** | 5-state confidence · area (with kind: neighbourhood/corridor/belt/fallback) · landmark relationships · walkability radius counts | 🟡 designed + tested · migration 087 not applied |
| **Distance Intelligence** | Routed walking/scooter/car · precision matched to location_confidence | 🔴 not built |
| **Suitability & Safety Intelligence** | 5-tier source (VERIFIED/OBSERVED/OWNER CLAIM/INFERRED/UNKNOWN) · freshness-aware · contextual per traveller · 13 sub-domains | 🟠 designed · unpopulated |
| **Temporal / Recent Signals (business_signal)** | 5-state recent-signal (positive/negative/multiple/none/old) · composite scoring (volume · source · sentiment · recency) | 🔴 not built |
| **Decision Context** | 10-axis reasoning · trade-offs · 12 protective questions · 3-options phrasing · why-this-won | 🟠 designed · runtime not built |
| **Brain LEARN** | Aggregate patterns · never per-business facts · behaviour signals | 🟡 partial · patterns from conversation only · no MEASURE data |

### 7b.6 · What Google / Yelp / TripAdvisor CANNOT provide through this architecture

Extending the earlier competitive analysis:

| Capability | Google Maps | Yelp | TripAdvisor | NEX gap-fill via Destination Context Graph |
|---|---|---|---|---|
| "Where should I stay for culture + walking?" | 🟡 filters exist · no reasoning | 🟡 category-based · no reasoning | 🟡 filters · no reasoning | 🏆 Decision Context 10-axis over graph |
| "Activities suitable for children · evidence-based" | 🔴 no per-activity child-suitability reasoning | 🔴 category-only | 🟡 kid-friendly filter (binary) | 🏆 contextual SUITABILITY with 5-tier source + "would I recommend to THIS family?" |
| "What to do nearby if it rains" | 🟡 categories · no weather-sensitivity reasoning | 🔴 | 🔴 | 🏆 Business Knowledge weather-sensitivity + Decision Context |
| "Can we walk back after dinner" | 🟡 route + time only · no night-context | 🔴 | 🔴 | 🏆 routed walking + night-safety-context + area temporal shift |
| "Best base without transport reliance" | 🔴 no transport-vs-price trade-off | 🔴 | 🔴 | 🏆 Axis #10 accommodation-relationship + True Trip Cost |
| "Before you go" per-plan briefing | 🔴 generic country advisories | 🔴 | 🟡 destination pages editorial | 🏆 plan-specific composition drawing from 13 protection sub-domains |
| "Agree fare with driver + translate" | 🔴 | 🔴 | 🔴 | 🏆 DURING-trip active protection · language layer |

**Google Ask Maps (now in Indonesia) is table-stakes for BEFORE searching.** DURING (active protection) + AFTER (self-improving feedback loop) is where the moat compounds.

### 7b.7 · What Path C ALONE unlocks vs what's still required

**Path C alone (with migration 087 applied + enrichment run):**

| Traveller question | Solved by Path C? |
|---|---|
| Q1 culture + walking | Partial — walking side answerable · culture side needs BUSINESS CHARACTER enrichment |
| Q2 kids activities | Partial — nearby landmark radius works · suitability signals not captured |
| Q3 rainy-day options | Partial — nearby POIs listed · indoor/outdoor tag missing |
| Q4 family safety evidence | No — needs SUITABILITY signals with source tier |
| Q5 walk back after dinner | Partial — walkability estimable · night-context missing |
| Q6 best base for walking | **YES · this is Path C's biggest immediate WOW** — walkable landmark density per hotel + area character composable now |
| Q7 boat activity briefing | No — needs activities vertical + SUITABILITY signals |
| Q8 driver fare agreement | No — needs transport-safety intelligence + language layer |

**Path C alone unlocks Q6 fully and partially unlocks Q1/Q2/Q3/Q5** — the walkable-base reasoning becomes real. Q4/Q7/Q8 require SUITABILITY and future subsystems.

### 7b.8 · Recommended architecture after Destination Context Graph captured

The graph is now a captured doctrine. Application ordering DOES NOT change — still C1 (geographic validation · done) → C2 (apply 087) → C3 (scorer upgrade) → C4 (Distance Intelligence).

What DOES change: every future subsystem design (SUITABILITY signals · Business Knowledge attribute vocabulary · `business_signal` layer · MEASURE-stage tables · Language layer) must show how it lights up graph edges to answer the 8 test questions HONESTLY.

### 7b.9 · Ultimate test (locked)

Philip verbatim: *"Can NEX help a traveller make a better decision before, during, and after visiting the destination while remaining completely honest about what it does and does not know?"*

Every architectural decision passes if it moves NEX toward YES for a specific traveller situation · fails if it produces false confidence · fails if it manufactures safety/suitability from weak evidence · fails if it introduces a global score.

## 8 · Competitive matrix (Philip's · reproduced + endorsed)

| Capability | Google | Yelp | TripAdvisor | NEX response |
|---|---|---|---|---|
| Maps | 🟢 elite | 🟡 | 🟡 | Don't compete head-on |
| Navigation | 🟢 elite | 🟡 | 🟡 | Integrate/use routing |
| Reviews | 🟢 huge | 🟢 huge | 🟢 huge | Build evidence intelligence |
| AI search | 🟢 rapidly advancing | 🟢 | 🟢 | Must exceed basic conversational search |
| Reservations | 🟢 growing | 🟢 | 🟢 | Action layer |
| Trip planning | 🟢 growing | 🟡 | 🟢 | Build decision reasoning |
| Personalisation | 🟢 | 🟢 | 🟢 | Build controllable preference memory |
| Business data | 🟢 enormous | 🟢 strong | 🟢 travel-focused | Build richer local knowledge |
| Destination character | 🟡 | 🟡 | 🟢 | **NEX core** |
| Total trip economics | 🔴 | 🔴 | 🟡 | **NEX core** |
| Walkability-afterward reasoning | 🟡 | 🔴 | 🟡 | **NEX core** |
| Business responsiveness intelligence | 🟡 | 🟢 services | 🟡 | **NEX core** |
| Owner quote behaviour | 🔴 | 🟢 services | 🔴 | **NEX core** |
| Transport-vs-price tradeoff | 🟡 | 🔴 | 🟡 | **NEX core** |
| Experience-density | 🔴 | 🔴 | 🔴 | **NEX opportunity** |
| Friction score | 🔴 | 🔴 | 🔴 | **NEX opportunity** |
| Destination mood graph | 🟡 | 🟡 | 🟢 | **NEX opportunity** |
| Business → surrounding-world reasoning | 🟡 | 🟡 | 🟡 | **NEX opportunity** |
| Why-this-won explanation | 🟡 | 🟡 | 🟡 | **NEX opportunity** |

**Competitive warning:** Google Ask Maps launched Indonesian conversational discovery. Yelp has AI + services quote workflows. TripAdvisor has AI trip building. **Conversational AI is table-stakes now, not a moat.** The moat is what NEX DOES with the reasoning.

---

## 9 · Sequencing Recommendation (for Philip's greenlight per phase)

Given the doctrine that Walkers keep eating while we design the brain, the safe next-actions in order:

1. **Do nothing new to the Walker.** Food + accommodation continue non-stop chained. This is the "eating" that keeps Philip's laboratory data alive.
2. **Approve or amend the Business Knowledge Object design contract** (11 sections + gaps identified in § 1 above).
3. **Approve or amend this competitive audit** (10 constitutional features + moat + sequencing).
4. **Path A · snapshot re-parse** — zero external calls · zero Walker change · recovers ~1000-2000 attribute rows from existing snapshots. Enables everything downstream. Suggest: greenlight when comfortable with the design.
5. **Path C1 · Location Intelligence schema (migration 087)** — 5-state confidence + neighbourhood + street_line + in_target_zone + geocode_evidence.
6. **Path C2/C3 · meaningful-area registry + landmark registry + reverse-geo enrichment** — the AREA=0 gap disappears · Destination Graph edges become computable.
7. **Follow-up design contract revision** — add § 12-18 for the missing capabilities identified in § 1 above (Personal Travel Memory · People Like You · Business Reliability Score · Friction Score · Experience Density · Day/Night Transformation · Temporal Destination Intelligence · Learning Economics).
8. **MEASURE-stage schema design** — `nex.customer_interaction` + `nex.owner_response` + `nex.business_signal` tables designed but not built until Philip greenlights.
9. **Path B · website enrichment** — after Path A + C give us the confidence + structure to consume website data reliably.
10. **Distance Intelligence** — needs OSRM/GraphHopper integration decision (build local OR hosted).
11. **Path D · Owner claim funnel** — after all above.
12. **Decision Context runtime** — LAST · needs everything above.

**Every step gated on: design approved · dry-run first · report · Philip approval · then apply.**

---

## 10 · Open questions for Philip (before greenlight of this audit)

1. **Do you want § 12-18 added to the Business Knowledge Object contract now** (a follow-up revision) or captured only in doctrine memories for later?
2. **Integration approach for maps/navigation** — commit to OSM tiles + OSRM (fully local · Truth Invariant compatible) OR consider Mapbox/Google (better fidelity, external dependency)?
3. **Review corpus strategy** — build ingest from Google Places API for cross-source (legal opt-in) OR stay OSM-only and only use owner-claim / NEX-native reviews?
4. **"People Like You" ethics** — the min-sample-size + confidence-threshold guards need explicit numbers before design. Suggested v0.1: min 30 users, min 0.75 similarity confidence, never surface individual profiles. Confirm?
5. **Business Reliability Score visibility** — internal-only (feeds Decision Context reasoning) or ever surfaced to customer (with attribution)?
6. **Friction Score bright line** — should friction be a filter (below X we don't recommend) or a ranking factor (surface but flagged) or both depending on customer intent?
7. **Total Trip Cost UI** — do we show the itemised breakdown (room + transport + meals + activities) or only the composite comparison ("A is Rp100k more but may cost less overall")?
8. **Walker cadence during design phase** — food + accommodation stay non-stop chained · no third Walker per governor doctrine · confirm no changes?
9. **Timeline sensitivity** — Google Ask Maps is live in Indonesia now. Do you want an aggressive path to shipping ANY differentiated capability (e.g. Experience Density on the /accommodation directory) OR do you want the full architecture right first?
10. **HQ visibility for design progress** — new `/nex-head-quarters/intelligence-roadmap` page showing which of the 24 capabilities are 🔴/🟡/🟢, or defer HQ surface until first capability ships?

---

## What is FORBIDDEN before greenlight

- Any code · schema · migration · Walker change per capability listed above.
- Any HQ UI showing "reasoning" or "recommendation explanation" that isn't backed by real reasoning.
- Any customer-facing claim of Experience Density · Friction Score · Business Reliability without the underlying data captured.
- Any single-score ranking function anywhere (per Decision Context lock-in).

## What is REQUESTED after greenlight

- Per-capability design memos as each is unlocked.
- Dry-run + report for every schema/enrichment step.
- Regression suite for every reasoning layer.
- Kill-switch on Decision Context runtime when first shipped.
- HQ visibility of every recommendation's why-chain.
