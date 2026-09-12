# NEX Universal Business & Product Taxonomy · v1 · T0 Canonical Specification

**Ratified 2026-09-05 · Philip AUTHORIZED T0.** Content-authorship + validation tooling only. Zero runtime integration.

---

## What this is

This directory contains the **canonical taxonomy specification** for NEX. It is the single classification foundation for:

- Businesses
- Products
- Services
- Search
- Business Brain
- Marketing (Local · National · International)
- Location Intelligence
- Logistics
- Every future NEX specialist employee

It is **content** (JSON) plus **validation tooling** (`scripts/nex-taxonomy/validate.mjs`). It is NOT runtime code. It is NOT wired into any application. It is NOT a database schema. Those follow in later authorized slices (T1 storage · T2 business classification · T3 product classification · T4 service classification · downstream).

---

## Doctrine references (all pinned in Philip's memory)

- `doctrine_nex_universal_business_product_taxonomy_2026_09_05.md` — parent design doctrine
- `doctrine_nex_product_service_creation_experience_2026_09_05.md` — Product Creator consumes this taxonomy at P1
- `doctrine_nex_product_international_markets_country_pricing_2026_09_05.md` — market registry composition
- `doctrine_nex_product_international_commercial_pricing_extension_2026_09_05.md` — Incoterms/prices are NOT taxonomy
- `doctrine_nex_marketing_local_national_international_modes_2026_09_05.md` — Marketing composes with taxonomy but doesn't own it
- `doctrine_nex_customer_identity_email_location_marketing_eligibility_2026_09_05.md` — Marketing Eligibility runs alongside classification
- `doctrine_nex_business_brain_specialist_employees_2026_09_05.md` — `brain_domain_hints` route to specialists
- `doctrine_nex_pwa_offline_first_2026_09_05.md` — taxonomy is cacheable per PWA freshness
- `doctrine_nex_owner_currency_customer_display_2026_09_05.md` — currency is not taxonomy
- `doctrine_nex_japan_first_class_market_2026_09_05.md` — Japan is first-class market from Day 1
- `doctrine_nex_owner_controlled_reply_2026_09_05.md` — inbound context uses taxonomy classification
- `doctrine_nex_one_universal_chat_2026_09_05.md` and `doctrine_nex_one_contacts_list_business_as_section_2026_09_05.md` — surfaces consume taxonomy
- `doctrine_nex_marketing_owner_experience_language_2026_09_05.md` — owner-facing language
- `doctrine_nex_business_marketing_employee_2026_09_05.md` — Marketing Employee product doctrine

---

## The two core invariants of this specification

> 1. **NEX owns the taxonomy. The LLM reasons over it.** If any model provider disappears, the taxonomy remains.
>
> 2. **The taxonomy has six orthogonal dimensions joined by explicit classification records — not one giant tree.**

Six dimensions:

| Dimension | File | What it answers |
|---|---|---|
| **Industry** | `v1/industries.json` | What is this business? |
| **Product** | `v1/products.json` | What physical good does this business sell? |
| **Service** | `v1/services.json` | What activity/capability does this business provide? |
| **Business Role** | `v1/roles.json` | What commercial role does this business play? |
| **Market** | `v1/markets.json` | Where does this business operate / target? |
| **Language** *(cross-cutting)* | `i18n_key` on every node | Owner/customer display language |

Plus the **example classifications**: `v1/examples.json` — 20 real business types classified end-to-end, used as the T0 architectural correctness fixture.

---

## Absolute prohibitions (enforced by validator)

- ❌ Variants (size · colour · pack) are **NOT** taxonomy nodes → they live on the product record
- ❌ Attributes (species · voltage · dimensions · material) are **NOT** taxonomy nodes → they live in per-node `attribute_hints` and per-item structured attributes
- ❌ Incoterms (FOB · CIF · EXW) are **NOT** taxonomy nodes → they live in Commercial Pricing
- ❌ Currencies are **NOT** taxonomy nodes
- ❌ Locations (`Yogyakarta` · `Tokyo`) are **NOT** taxonomy nodes → Location Intelligence dimension
- ❌ Promotions are **NOT** taxonomy nodes → they live on the product record
- ❌ Countries are **NOT** embedded in taxonomy slugs → Market dimension
- ❌ Languages are **NOT** embedded in canonical slugs → `label_i18n` map
- ❌ Product taxonomy does **NOT** contain services · Service taxonomy does **NOT** contain products — separate trees
- ❌ Business Roles are **NOT** industries — separate dimension
- ❌ AI-guess classification is **NEVER** indistinguishable from owner-confirmed (per `confidence` enum on future classification records)

---

## Canonical node shape

Every node in every dimension file follows this shape:

```json
{
  "id": "food.seafood.fish.tuna.frozen",
  "domain": "product",
  "slug": "food.seafood.fish.tuna.frozen",
  "parent_id": "food.seafood.fish.tuna",
  "depth": 5,
  "label_en": "Frozen Tuna",
  "label_i18n": {
    "en": "Frozen Tuna",
    "id": "Tuna Beku",
    "ja": "冷凍マグロ"
  },
  "i18n_key": "taxonomy.product.food.seafood.fish.tuna.frozen",
  "status": "active",
  "version_introduced": 1,
  "version_deprecated": null,
  "replacement_id": null,
  "aliases": ["frozen tuna", "tuna beku", "冷凍マグロ", "maguro frozen"],
  "brain_domain_hints": ["knowledge", "market_research", "sea_freight", "cold_chain", "marketing"],
  "attribute_hints": ["species", "grade", "weight_per_piece", "packaging", "origin", "processing_method"],
  "notes": null
}
```

### Field rules (LOCKED)

- `id` = current-slug (T0 uses slug-as-id · T1 storage layer will assign opaque UUID + preserve slug as stable secondary identifier)
- `domain` ∈ `industry | product | service | role | market`
- `slug` = dot-path, lowercase, underscores allowed for multi-word segments, English-derived, **never** contains country/language/version/incoterm/price/promotion
- `parent_id` = another node's `id` in the **same** dimension file, or `null` for top-level
- `depth` = derived (top-level = 1, children add 1) — validator recomputes and asserts consistency
- `label_en` = required · canonical English display
- `label_i18n` = required · must contain `en` · `id` and `ja` populated where confidently known (never invented)
- `i18n_key` = stable dotted key rooted at `taxonomy.{domain}.{slug}` — future i18n system uses this
- `status` ∈ `draft | active | deprecated | replaced | withdrawn`
- `version_introduced` = integer version this node was introduced (initial release = `1`)
- `version_deprecated` = integer or `null` — when set, `replacement_id` must also be set
- `replacement_id` = successor node id if this one is `deprecated | replaced`
- `aliases` = array of strings · search matching · never creates new canonical identity
- `brain_domain_hints` = array of NEX Brain specialist role slugs (see below)
- `attribute_hints` = array of attribute keys that a UI (Product Creator) should surface for this classification (advisory only · not schema)
- `notes` = free text or `null`

### Governance rules

- Adding a node → status `draft` → curator approval → `active`
- Renaming a node → **never** silently reuse ID · deprecate + create new + set `replacement_id`
- Splitting a node → deprecate parent · create new children with `replacement_id` pointing at new parent
- Merging nodes → all sources → `deprecated` with `replacement_id` pointing at target
- Withdrawal → only if zero classifications reference the node (verified at T1+)

---

## Brain domain hints (canonical vocabulary)

Values referenced by `brain_domain_hints` must be one of the following. These are the specialist workforce roles from the Business Brain doctrine:

| Slug | Specialist role | Notes |
|---|---|---|
| `knowledge` | Knowledge Employee | Persistent domain knowledge · every category |
| `market_research` | Market Research Employee | Per-country · per-industry buyer signals |
| `logistics` | Logistics umbrella | Composed of sea/air/cold agents |
| `sea_freight` | Sea Freight Agent | Container · reefer · bulk |
| `air_freight` | Air Freight Agent | Cargo air · perishables · high-value |
| `cold_chain` | Cold Chain Agent | Refrigerated storage · transport · handling |
| `location_intelligence` | Location Intelligence | Distance · travel · geographic composition |
| `marketing` | Marketing Employee | Campaigns · eligibility · outreach |
| `regulatory_compliance` | Regulatory / Compliance | Trade law · health/food · pharma · export |
| `commodity_pricing` | Commodity Pricing | Coffee · palm · minerals · agricultural |
| `technical` | Technical Advisory | Machinery specs · engineering |
| `hospitality` | Hospitality-specific knowledge | Booking · seasonality · local |
| `local_market` | Local Market Intelligence | Neighbourhood · city-level |
| `food` | Food-specific knowledge | Menu · dietary · seasonality |
| `visit_planning` | Visit Planning | Owner travel · buyer visits |

The validator asserts every `brain_domain_hints` entry appears in this canonical vocabulary.

---

## The 45 top-level industries

Per parent doctrine §5, the ratified count is 45. The current derivable list from the doctrine's "kept" markers plus the doctrine's 3 explicit additions arithmetic to **41**. To reach 45 canonicalized in T0, the following **4 additions** are proposed for Philip's review — flagged with `notes: "PROPOSED_T0_TO_REACH_45"` in `industries.json`:

1. **Forestry & Timber** — genuinely missing from the ratified list · orthogonal to Agriculture (forestry is a distinct commercial vertical: harvesting, sawmills, wood products at source)
2. **Biotechnology & Life Sciences** — orthogonal to Healthcare (treatment) and Pharmaceuticals (drugs) · research · diagnostics · biotech contract manufacturing
3. **Public Utilities & Infrastructure** — separate from Energy & Utilities · roads · bridges · water treatment · urban infrastructure operators
4. **Postal & Courier Services** — adjacent to but distinct from Transport.Logistics · consumer-oriented mail · parcels · last-mile

Philip may accept these 4 additions (final count 45 · matches doctrine claim), remove any (count drops · document as reconciled to N < 45), or replace with alternatives.

**T0 delivers with all 45 (38 preserved from original + 3 doctrine additions + 4 proposed T0 additions) so downstream planning can proceed with the doctrine's target count. Any subset removed by review is a low-risk edit before T1.**

The complete list is in `v1/industries.json`.

---

## Product / Service depth policy

- Normal target: **L1 → L4** where useful (per parent doctrine §7)
- L5 permitted for genuinely distinct commercial identity (e.g. `food.seafood.fish.tuna.frozen` — Fresh Tuna and Frozen Tuna are different commercial products despite same species)
- No L6 without governance approval
- Attributes (species · size · voltage) live on the product record via `attribute_hints`, NEVER new levels
- Variants live on the product record via `variants[]`, NEVER new levels

Full depth demonstrated in T0 for the 10 verticals required by parent doctrine §39: **Seafood · Manufacturing · Construction · Technology · Textiles · Automotive · Hospitality · Logistics · Professional Services · Agriculture**.

Additional depth for other industries is authored to sufficient breadth to prove the model works · governance approves expansions in future slices.

---

## Business roles

Four role families (per parent doctrine §9), ~30 specific roles.

| Family | Example roles |
|---|---|
| `production_roles` | manufacturer · producer · farmer · fisher · processor · packager · assembler |
| `trade_roles` | exporter · importer · wholesaler · distributor · retailer · reseller · trader · broker · agent · marketplace_operator |
| `service_roles` | service_provider · consultant · contractor · installer · repair_provider · logistics_provider · freight_forwarder · carrier · warehouse_operator · cold_storage_operator · customs_broker |
| `support_roles` | certifier · inspector · laboratory · standards_body · rating_agency |

Complete list in `v1/roles.json`.

---

## Markets

Initial market registry uses ISO 3166-1 alpha-2 codes. Japan is `first_class = true` from Day 1 (per Japan doctrine).

Initial set (10 markets):
- `ID` Indonesia · `first_class`
- `JP` Japan · `first_class`
- `SG` Singapore
- `MY` Malaysia
- `TH` Thailand
- `US` United States
- `GB` United Kingdom
- `DE` Germany (as EU entry point)
- `AU` Australia
- `INTL` International (special · non-country · used when visibility is not country-scoped)

New markets are added by inserting a row · no code change required.

Complete list in `v1/markets.json`.

---

## Language / i18n

- Canonical identity: `id` field (slug-derived in T0 · UUID-backed in T1+)
- Developer-readable stable slug: `slug` field
- Owner/customer display: `label_i18n` map (`en` mandatory · `id` and `ja` populated where known)
- Future i18n system consumes `i18n_key` for label lookups

**Never** embed language in canonical identity. Never use `sepatu-lari` as a slug. Use `apparel.footwear.sports.running_shoes` and provide `label_i18n.id = "Sepatu Lari"`.

---

## Aliases and search hints

Aliases live inline in each node's `aliases` array. Include:

- Common English synonyms · `running shoes`, `running trainers`, `jogging shoes`
- Indonesian equivalents · `sepatu lari`
- Japanese equivalents where confidently known · `ランニングシューズ` · `冷凍マグロ`
- Trade / industry terms · `reefer` for refrigerated shipping
- Regional local terms · `ryokan` (JP-specific for `hospitality.accommodation.ryokan`)

Aliases are **search matching** metadata. They **do not** create new canonical identity. `prawns` and `shrimp` both resolve to `food.seafood.shellfish.shrimp_prawn`.

---

## Deterministic resolution vs LLM assistance

Per parent doctrine §17 and Philip's T0 §19:

1. Deterministic resolution runs first (exact match · alias lookup · prefix)
2. LLM assistance runs ONLY when deterministic yields ambiguity
3. LLM output is CANDIDATE only · validated against NEX taxonomy · never accepted raw
4. LLM never invents new canonical nodes · governance-only path for new nodes

Never `every query → LLM → arbitrary category`.

---

## Validation tooling

Run: `node scripts/nex-taxonomy/validate.mjs`

Validates (per Philip's T0 §36):

- ✓ Industry count matches target (45)
- ✓ No duplicate `id`s within a dimension
- ✓ No duplicate `slug`s within a dimension
- ✓ No cycles in `parent_id` chains
- ✓ No orphan nodes (`parent_id` references a non-existent node)
- ✓ Depth consistency (`depth` = ancestor count + 1)
- ✓ Product/Service separation (no cross-dimension `parent_id`)
- ✓ Business Role separation
- ✓ Market separation
- ✓ Alias uniqueness within a dimension where required
- ✓ Valid `i18n_key` format (`taxonomy.{domain}.{slug}`)
- ✓ `brain_domain_hints` reference canonical vocabulary only
- ✓ All 20 architectural example classifications succeed
- ✓ Multi-vertical business examples classify cleanly
- ✓ Variants are NOT taxonomy nodes (checked via naming heuristic + explicit test cases)
- ✓ Attributes are NOT incorrectly taxonomy nodes
- ✓ Incoterms are NOT taxonomy nodes
- ✓ Locations are NOT taxonomy nodes
- ✓ Promotions are NOT taxonomy nodes
- ✓ Version fields consistent (deprecated → replacement_id set)
- ✓ Every node's `label_i18n.en === label_en`

The validator exits **1** on any failure with a structured report. Exit **0** on clean pass.

---

## Governance (T0)

- **Owner** of this specification: NEX curator team (implicitly Philip until curator role is defined in future slice)
- **Adding a node**: propose · reviewer approves · status `draft` → `active`
- **Deprecating a node**: status `deprecated` · `replacement_id` set · never delete
- **Renaming**: deprecate + create new (never mutate slug of active node)
- **Version bumps**: cumulative — each release increments `taxonomy_version` in `v1/metadata.json`

---

## What T0 explicitly does NOT include

- No runtime code
- No Product Creator integration (P1 · deferred)
- No Search integration (T5 · deferred)
- No Brain Routing integration (T6 · deferred)
- No Marketing integration (T7 · deferred)
- No database migration (T1 · deferred)
- No RLS · no grants · no roles · no `.env` · no workforce · no C12 · no scheduler · no legacy

---

## Architectural extensibility test (per T0 §38)

> *"If a new business appears tomorrow that does not fit perfectly into the current taxonomy, can NEX add it without redesigning the whole system?"*

**YES.** Because:

1. **Industries · Products · Services · Roles are separate dimensions** — a new business type doesn't require redesigning the tree · it requires selecting from each dimension (potentially adding a leaf via governance)
2. **Multi-dimensional joins are on the classification record**, not on the taxonomy — a new business classifies against existing dimensions
3. **`aliases`** absorb owner-vernacular without requiring new nodes
4. **`Other` slot in every top-level industry** captures genuine novelty · owner description feeds governance queue · curator promotes to a new node when a pattern is confirmed
5. **`brain_domain_hints`** allow specialist routing to be reused even for new leaves (a new seafood product still routes to sea_freight + cold_chain)
6. **Versioning** allows nodes to be added or deprecated without breaking historical classifications (`replacement_id` chains)
7. **Attribute hints** are advisory · Product Creator can extend attribute forms per-product without taxonomy changes

The extensibility path for a genuinely new industry:
- Governance proposes new industry (justify orthogonality · check for overlap)
- Reviewer approves → industry added at `status: draft` → activated → all downstream classifications work immediately
- No downstream file rewrites required

---

## Files in this directory

```
data/nex-taxonomy/
├── README.md               (this file · specification)
└── v1/
    ├── metadata.json       (version · release · governance state)
    ├── industries.json     (45 top-level industries · flat)
    ├── products.json       (product tree · 10 verticals demonstrated L1-L4)
    ├── services.json       (service tree · 10 verticals demonstrated L1-L4)
    ├── roles.json          (~30 business roles across 4 families)
    ├── markets.json        (10 markets · ISO 3166-1 alpha-2 · Japan first_class)
    └── examples.json       (20 example business classifications · T0 correctness fixture)

scripts/nex-taxonomy/
└── validate.mjs            (Node validation script · runs all §36 checks)
```

---

## Consuming this taxonomy (future · not now)

Later slices will consume this JSON:

- **T1**: import into `taxonomy_node` table · assign opaque UUIDs · preserve slugs · index for lookup
- **T2/T3/T4**: business/product/service classification records reference `taxonomy_node.id`
- **T5**: Search resolver consumes aliases + brain hints + label_i18n
- **T6**: Brain Routing consumes `brain_domain_hints` deterministically
- **P1**: Product Creator's Category picker replaces mock in `src/lib/nexapp/mockProductCreator.ts` with real fetch
- **T7**: Marketing composes with taxonomy for campaign targeting per Marketing Modes doctrine
- **T9**: Full Japanese `label_i18n.ja` expansion beyond high-priority nodes

Until then, this specification stands alone as content. Zero integration.

---

## T0 status

- **Design**: COMPLETE
- **Implementation**: NOT AUTHORIZED (T0 is content authorship only)
- **Database**: UNCHANGED
- **Production**: UNCHANGED
- **Environment**: UNCHANGED
- **Workforce**: UNCHANGED
- **C12**: UNTOUCHED
- **Scheduler**: UNCHANGED
- **Legacy**: UNCHANGED

Next authorized slice: **T1 Taxonomy Storage** (only after T0 accepted).

---

**End of T0 canonical specification README.**
