# Staircase Supplier Matching Engine — Specification

**Data file:** `data/staircase-supplier-matching-rules.json`
**Version:** V1
**Purpose:** Turn a customer requirement (natural language or structured) into a ranked shortlist of matched suppliers from the 119-record UK merchant directory.

Completes **Phase 4** of Philip's roadmap. Bridges the gap between "customer knows what they want" and "customer knows who to call."

---

## What it is

An **intent-to-supplier routing layer**. Takes:
- A requirement (materials, manufacture, installation, glass, flooring, loft, finishing, tool hire, machinery, software)
- A location (postcode or region)
- Verification preference (verified-only / verified-first / any)

Returns:
- Ranked top-5 suppliers with scoring reasoning
- Verification badges per Business Trust doc
- Never-accuse wording when no verified matches exist

---

## Input dimensions

**10 requirement types** covering the full supply chain:
- `material_supply` — buying stair components
- `stair_manufacture` — bespoke stair or kit build
- `installation` — fitting only
- `glass_balustrade` — glass supply / fit
- `flooring` — hallway / landing floor
- `loft_access` — ladder or loft stair
- `finishing` — lacquer / oil / paint
- `tool_hire` — hire equipment
- `machinery` — workshop kit purchase
- `software` — CAD / stair-manufacturing software

**Material sub-filter** across 11 species / types (american_white_oak, european_oak, walnut, ash, pine, mdf, plywood, toughened_glass, laminated_glass, stainless_steel, black_metal).

**Region input** as UK postcode (e.g. `M20 4AB`) or region name (e.g. `Leeds` / `Scotland`).

**Verification preference:**
- `verified_only` — Level 3 + Level 4 badges only
- `verified_first` — all levels, sorted with verified on top (default)
- `any` — all levels, sorted purely by relevance score

**Priority** (optional) — `distance_first | specialisation_first | verification_first | price_range_first`.

---

## Matching algorithm (6 steps)

```
1. Category filter          → merchants where primary_category is in the route's primary or secondary set
2. Material filter          → merchants with required material tags in staircase_relevance.categories or tags
3. Region filter            → merchants whose coverage.regions matches user region OR is UK-wide
4. Verification filter      → apply verification_preference
5. Score & sort             → compute combined score per merchant
6. Present top N            → default 5, with per-match reasoning
```

---

## Supplier type routing

The heart of the engine. Every requirement type maps to specific merchant categories with a minimum staircase-relevance threshold:

| Requirement | Primary category | Secondary | Min relevance |
|---|---|---|---|
| Oak treads supply | timber_merchant · stair_specialist | general_builders_merchant | 4 |
| Walnut treads supply | timber_merchant | stair_specialist | 4 |
| MDF risers supply | sheet_materials · general_builders_merchant | timber_merchant | 3 |
| Veneer sheet supply | sheet_materials | timber_merchant | 4 |
| Stair parts (handrail / newel / spindle) | stair_specialist | general_builders_merchant | 4 |
| Fixings + adhesive | fixings | general_builders_merchant | 3 |
| Finishing (oil / lacquer) | finishing_supplier | timber_merchant | 4 |
| Ironmongery | ironmongery | general_builders_merchant | 3 |
| Bespoke stair manufacture | stair_manufacturer | — | 5 |
| Kit staircase | stair_specialist · stair_manufacturer | — | 4 |
| Glass balustrade | glass_balustrade | stair_specialist | 4 |
| Flooring supply | flooring_supplier | — | 3 |
| Loft ladder supply | loft_ladder_supplier | loft_installer | 3 |
| Loft install | loft_installer | — | 4 |
| Tool hire | tool_hire | — | 3 |
| Machinery | machinery_supplier | — | 3 |
| Software | software_vendor | — | 3 |

---

## Scoring weights

Each merchant gets a composite score. Higher = better match.

| Signal | Points |
|---|---|
| **Verification level** — Partner | 100 |
| Verified | 75 |
| Claimed | 50 |
| Listed | 25 |
| **Staircase relevance** — 5-star | 50 |
| 4-star | 35 |
| 3-star | 20 |
| **Regional match** — exact postcode area | 40 |
| County match | 30 |
| Region match | 20 |
| National coverage | 15 |
| **Category match** — primary specialist | 60 |
| Secondary capability | 30 |
| General coverage | 15 |
| **Service bonuses** (when relevant to query) | +10-15 each |

**Trust always beats commercial placement.** A verified 4-star merchant scores higher than a listed 5-star Partner-tier record. This is the anti-lead-selling principle in action — you can pay for verification (via subscription tier) but you cannot pay to jump the trust queue.

---

## Regional coverage resolution

Postcode → region mapping for the top ~30 UK postcode areas is built in. Example:

| Postcode | Region | Matches merchants covering |
|---|---|---|
| `LS` (Leeds) | west_yorkshire | Yorkshire · UK-wide |
| `M` (Manchester) | greater_manchester | North West England · UK-wide |
| `BT` (Belfast) | northern_ireland | Northern Ireland · UK-wide |
| `EH` (Edinburgh) | edinburgh | Scotland · UK-wide |
| `NW10` (London) | north_west_london | London · Greater London · South East · UK-wide |

If the input postcode is not in the map, the engine falls back to the region name if given, or asks a clarifying question.

---

## Natural-language requirement translation

The engine accepts plain-English customer input. Pattern matches route to structured requirements:

- *"Where can I get oak treads?"* → `material_supply / oak_treads`
- *"I need a stair made in oak"* → `stair_manufacture / bespoke`
- *"Fit a loft ladder"* → `loft_access_installation`
- *"Osmo oil for my stair"* → `material_supply / finishing`
- *"CNC router for my workshop"* → `machinery`
- *"Compass Software"* → `software`

When intent is ambiguous, the engine asks a **clarifying question** rather than guessing.

---

## Presentation rules

Per Philip's Business Trust doc and the answer-engine confidence model:

- Return top 5 by default (max 15 if requested)
- Show verification badge per merchant (Partner / Verified / Claimed / Listed)
- Show one-line reason: *"Hardwood specialist in your region, 5-star staircase relevance"*
- Show services relevant to the query (delivery / trade account / cutting)
- **When no verified matches exist**, show listed matches with the standard unverified caveat wording
- Always offer "broaden search" if fewer than 3 matches
- **Never rank paid placement above verification** — trust wins

---

## Worked example

**Input:** *"Where can I get oak treads near Leeds?"*

**Parsed:**
```
requirement_type: material_supply
specific: oak_treads
route_key: material_supply_oak_treads
region_input: "Leeds"
resolved_region: west_yorkshire
```

**Applied filters:**
- Category → timber_merchant · stair_specialist · general_builders_merchant
- Material → OAK / HARDWOOD tag required
- Region → Yorkshire / UK-wide coverage
- Verification → verified_first (V1 all merchants listed, so falls back to listed with caveat)

**Top 5 matches (scored):**

| Company | Score | Reasoning |
|---|---|---|
| Howarth Timber Leeds | 165 | 5-star relevance + primary specialist + Yorkshire coverage — premier North England hardwood specialist with a Leeds branch |
| Yorkshire Timber Halifax | 165 | 5-star relevance + primary specialist + Yorkshire — stair-parts specialist carrying oak |
| Arnold Laver | 150 | 5-star relevance + primary specialist + national — premium hardwood with nearby Sheffield branch |
| International Timber | 150 | 5-star relevance + primary specialist + national — fallback if regional stock is limited |
| Jewson Leeds | 120 | 4-star relevance + secondary + Yorkshire — for MDF risers and installation supplies alongside oak treads |

**Presentation:** *"5 hardwood suppliers matched for oak stair treads near Leeds. None currently verified by NEX — we recommend confirming stock, price and lead time directly."*

---

## Cross-references

- **Consumes:** `data/uk-merchant-directory.json` (119 supplier records with categories, staircase_relevance, tags, verification_level)
- **Consumes:** `data/staircase-quote-engine.json` (regional multipliers, indirectly informs coverage inference)
- **Consumes:** `data/staircase-design-recommendation-rules.json` (design spec → recommended materials to source)
- **Enforces:** `docs/brains/nex-business-listing-and-trust-architecture.md` (verification levels, badge display, unverified-match wording)
- **Enforces:** `docs/brains/nex-answer-engine-confidence-model.md` (Level 2 verified DB, Level 3 external discovery)

---

## Not in V1

- **Distance-in-miles calculation** from postcode — needs geocoding pass on all branch addresses
- **Live stock availability** — requires supplier API integrations
- **General installer directory** — V1 only has loft installers; general stair installers deferred
- **Cross-country matching** — US and AU merchant directories not yet populated
- **Customer-rating weighting** — requires verified-transaction reviews to be live
- **Multi-material bundle matching** — one query "oak stair + matching floor + fittings" returning bundled shortlists

---

## The Phase 4 tick

Phase 4 (Supplier Matching Engine) is now formally shipped as its own module: rules JSON + spec doc + worked example + integration with existing trust architecture and confidence model. Consumes the merchant directory, honours the trust protection rules, feeds the customer project workflow (Phase 5).
