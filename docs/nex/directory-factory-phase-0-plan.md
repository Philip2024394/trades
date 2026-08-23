# NEX Directory Factory · Phase 0 Plan · Registry-to-DB migration + CATEGORY_CANDIDATE table

**Status:** DESIGN DOCUMENT ONLY · awaiting Philip approval · zero code / schema / route / migration changes made.

**Date:** 2026-08-23

**Doctrine anchors (binding):**
- `project_nex_directory_factory_doctrine_2026_08_22` (13 locked decisions + Phase 0 gate)
- `project_nex_continuous_discovery_vision_self_expanding_2026_08_22` (self-expanding NEX vision)
- `project_nex_walker_stays_pure_acquisition_2026_08_22` (Walker never auto-decides)
- `project_nex_universal_directory_image_doctrine_2026_08_22` (Image Phase 1 already shipped)
- `project_nex_country_scope_from_phone_country_code_2026_08_22` (country foundational)
- `project_nex_truth_invariant_2026_08_22` (never fabricate)
- `project_nex_canonical_mobile_viewport_2026_08_23` (390×844 UI reference)

**Governing rule (write it on the wall):**
> Discover automatically · Propose intelligently · Approve deliberately · Build automatically after approval.

**Constitutional invariant (never violated by this plan):**
> Walker MUST NEVER silently invent or publish a new directory. Every new customer-facing category is a deliberate human act.

---

## Complete intended post-approval pipeline (the goal state)

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐    ┌──────────────────────┐
│  1. WALKER   │───▶│ 2. CATEGORY_     │───▶│ 3. HQ Directory      │───▶│ 4. Philip approves  │───▶│ 5. Factory           │
│  discovers   │    │    CANDIDATE     │    │    Factory surface   │    │    (or rejects)     │    │    automatically     │
│  ≥50 rows ×  │    │    proposal      │    │    (/nex-head-       │    │    (single click    │    │    wires:            │
│  ≥2 cycles + │    │    (never live)  │    │     quarters/        │    │    per candidate)   │    │                      │
│  evidence    │    │                  │    │     directory-       │    │                     │    │  · Registry entry    │
│              │    │                  │    │     factory)         │    │                     │    │  · Route (dispatch)  │
│              │    │                  │    │                      │    │                     │    │  · Wheel entry       │
│              │    │                  │    │                      │    │                     │    │  · Brain intent      │
│              │    │                  │    │                      │    │                     │    │  · Image resolver    │
│              │    │                  │    │                      │    │                     │    │  · DB adapter        │
│              │    │                  │    │                      │    │                     │    │  · Acceptance tests  │
└──────────────┘    └──────────────────┘    └──────────────────────┘    └─────────────────────┘    └──────────────────────┘
    Walker              nex.category_        HQ SUB-page               ONLY human gate               all wired through
    stays pure          candidate            (never a dashboard        (activation forbidden         ONE canonical
    (Task-#86           (this table          fork per Singularity      on confidence alone)          category_id
    doctrine)           designed in           doctrine)                                             (no per-vertical
                        Phase 0)                                                                    forks)
```

**Approval gate is human-only. Business count alone is NEVER sufficient. Never auto-promote on confidence. Ever.**

---

## PHASE 0 SCOPE (this document)

Phase 0 is the ISOLATED, BEHAVIOUR-PRESERVING foundation work:

1. Create `nex.category_registry` DB table
2. Create `nex.category_candidate` DB table
3. Seed `nex.category_registry` with the 10 existing TypeScript entries
4. Add a fail-fast validator: TS ↔ DB match
5. Prepare (but do not activate) the retirement path for the legacy `CATEGORIES` array + hardcoded `NexDirectoryCards`
6. Regression suite proving Food / Accommodation / all six live routes unchanged

**Explicitly OUT OF SCOPE for Phase 0:**
- Walker candidate-writer (adds CANDIDATE rows) — later phase
- `/nex-head-quarters/directory-factory` approval UI — later phase
- Factory activation engine — later phase
- Wiring runtime consumers to read from DB (helpers still read TS array in Phase 0) — later phase
- Route creation, wheel changes to live routes, Brain rewiring — later phase
- Migration of any existing static route to dynamic dispatcher — deferred by Decision #7
- Image Phase 2 (Track A · separate milestone) — not this document
- Any per-vertical code fork — forbidden always

---

## Item 1 · Existing Registry entries (verbatim from `src/lib/nex/category-registry.ts`)

10 entries · sequence preserved · full field dump for the seed operation.

| # | id | parent_vertical | active | route | countries | display_en / display_id | icon | visual.glyph | business_table | category_filter | brain_keywords |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `food` | food | **true** | `/food` | `["ID"]` | Food / Makanan | 🍜 | Utensils | `nex.food_business` | (null) | food · makanan · restaurant · restoran · eat · makan |
| 2 | `accommodation` | accommodation | **true** | `/accommodation` | `["ID"]` | Accommodation / Penginapan | 🏨 | Bed | `nex.accommodation_business` | (null) | accommodation · penginapan · stay · menginap · tempat menginap · where to stay · somewhere to stay |
| 3 | `hotel` | accommodation | **true** | `/hotel` | `["ID"]` | Hotel / Hotel | 🏨 | Hotel | `nex.accommodation_business` | `category='hotel'` | hotel · hotels · cheap hotel · boutique hotel |
| 4 | `villa` | accommodation | false | `/villa` | `["ID"]` | Villa / Villa | 🏡 | Palmtree | `nex.accommodation_business` | `category='villa'` | villa · villas · private villa · family villa |
| 5 | `guesthouse` | accommodation | **true** | `/guesthouse` | `["ID"]` | Guesthouse / Wisma | 🏠 | Home | `nex.accommodation_business` | `category='guesthouse'` | guesthouse · guest house · wisma · penginapan kecil |
| 6 | `homestay` | accommodation | false | `/homestay` | `["ID"]` | Homestay / Homestay | 🏘️ | HeartHandshake | `nex.accommodation_business` | `category='homestay'` | homestay · homestays · rumah warga |
| 7 | `resort` | accommodation | false | `/resort` | `["ID"]` | Resort / Resort | 🌴 | Sun | `nex.accommodation_business` | `category='resort'` | resort · resorts · spa resort · beach resort |
| 8 | `hostel` | accommodation | **true** | `/hostel` | `["ID"]` | Hostel / Hostel | 🛏️ | Users | `nex.accommodation_business` | `category='hostel'` | hostel · hostels · backpacker · dorm |
| 9 | `apartment` | accommodation | false | `/apartment` | `["ID"]` | Apartment / Apartemen | 🏢 | Building2 | `nex.accommodation_business` | `category='apartment'` | apartment · apartments · apartemen · long stay · serviced apartment |
| 10 | `kos` | accommodation | **true** | `/kos` | `["ID"]` | Kos (monthly rental) / Kos | 🛖 | KeyRound | `nex.accommodation_business` | `category='kos'` | kos · kost · kosan · indekos · kos-kosan · monthly rental · boarding house |

**Active count:** 6 (`food`, `accommodation`, `hotel`, `guesthouse`, `hostel`, `kos`) · **Inactive count:** 4 (`villa`, `homestay`, `resort`, `apartment`).

---

## Item 2 · Proposed DB schema

### Table A · `nex.category_registry`

The canonical DB source of truth for NEX categories (post-Phase-0 · in Phase 0 it mirrors the TS array).

```sql
CREATE TABLE nex.category_registry (
    id                 text PRIMARY KEY
                       CHECK (id ~ '^[a-z][a-z0-9-]*$'),         -- kebab-case only

    parent_vertical    text NOT NULL
                       CHECK (parent_vertical IN ('food','accommodation','rentals','services','tourism')),

    display_name_en    text NOT NULL,
    display_name_id    text NOT NULL,

    icon               text,                                     -- emoji · legacy compat
    visual_glyph       text NOT NULL,                            -- lucide-react export name (PascalCase)
    visual_family      text,                                     -- optional grouping token

    route              text NOT NULL UNIQUE
                       CHECK (route ~ '^/[a-z][a-z0-9/-]*$'),

    active             boolean NOT NULL DEFAULT false,           -- Factory activates via update

    brain_keywords     jsonb NOT NULL DEFAULT '[]'::jsonb
                       CHECK (jsonb_typeof(brain_keywords) = 'array'),

    countries          text[] NOT NULL
                       CHECK (
                         array_length(countries, 1) >= 1
                         AND countries <@ ARRAY['ID','GB','US','MY','SG','TH','VN','PH','AU','NZ']::text[]  -- provisional whitelist · expand as markets open
                       ),

    business_table     text,                                     -- polymorphic dispatch
    category_filter    text,                                     -- SQL WHERE fragment applied to business_table

    schema_version     text NOT NULL DEFAULT 'v1',
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    activated_at       timestamptz,                              -- null until Factory activates
    activated_by       text,                                     -- Philip / admin id at activation

    -- ORIGIN TRACKING · which candidate (if any) produced this row
    origin_candidate_id  text,                                   -- FK below · nullable for the 10 seed rows
    FOREIGN KEY (origin_candidate_id)
        REFERENCES nex.category_candidate(id)
        ON DELETE SET NULL
);

CREATE INDEX category_registry_parent_vertical_idx  ON nex.category_registry (parent_vertical);
CREATE INDEX category_registry_active_idx           ON nex.category_registry (active) WHERE active = true;
CREATE INDEX category_registry_countries_gin_idx    ON nex.category_registry USING GIN (countries);
```

### Table B · `nex.category_candidate`

Walker's proposal target · Philip's approval subject · Factory's build input. This is the "bridge" that turns discovery into an approved directory.

```sql
CREATE TABLE nex.category_candidate (
    id                       text PRIMARY KEY
                             DEFAULT gen_random_uuid()::text,

    -- What Walker proposes
    proposed_category_id     text NOT NULL
                             CHECK (proposed_category_id ~ '^[a-z][a-z0-9-]*$'),
    proposed_name            text NOT NULL,
    display_name_en          text NOT NULL,
    display_name_id          text,                               -- nullable · English-first for GB market
    suggested_parent_vertical text NOT NULL
                             CHECK (suggested_parent_vertical IN ('food','accommodation','rentals','services','tourism')),
    brain_keywords           jsonb NOT NULL DEFAULT '[]'::jsonb
                             CHECK (jsonb_typeof(brain_keywords) = 'array'),
    suggested_countries      text[] NOT NULL
                             CHECK (array_length(suggested_countries, 1) >= 1),

    -- Evidence (Decision #8: threshold ≥50 businesses × ≥2 cycles + strong evidence)
    business_count           integer NOT NULL
                             CHECK (business_count >= 50),
    cycle_count              integer NOT NULL
                             CHECK (cycle_count >= 2),
    confidence               numeric(4,3) NOT NULL
                             CHECK (confidence >= 0 AND confidence <= 1),
    evidence                 jsonb NOT NULL DEFAULT '{}'::jsonb, -- {osm_tags[], name_patterns[], geographic_clusters[], category_patterns[]}
    discovered_businesses    jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{business_type, business_ref, name, ...}] · caps at N for display

    -- Image evidence (Decision #9 · Universal Image Doctrine cross-ref)
    image_candidates         jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{url, source, confidence, business_ref}] · EVIDENCE ONLY · never live
    image_candidates_note    text DEFAULT
        'These are evidence only. They MUST NOT become live business images without going through the Universal Image resolver acceptance thresholds.',

    -- Provenance
    proposed_by              text NOT NULL,                      -- worker name (e.g. 'food-yogyakarta') or cycle_run_id
    proposed_cycle_run_id    text                                -- Direct-Provenance A · nullable if aggregated across cycles
                             REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL,
    created_at               timestamptz NOT NULL DEFAULT now(),

    -- Admin adjudication (Decision #12: humans ONLY activate)
    admin_decision           text NOT NULL DEFAULT 'pending'
                             CHECK (admin_decision IN ('pending','approved','rejected','duplicate','superseded')),
    admin_reviewed_at        timestamptz,
    admin_reviewed_by        text,
    admin_notes              text,

    -- Duplicate/collision tracking (for admin_decision = 'duplicate' or 'superseded')
    duplicate_of_registry_id text REFERENCES nex.category_registry(id) ON DELETE SET NULL,
    superseded_by_candidate_id text REFERENCES nex.category_candidate(id) ON DELETE SET NULL
);

CREATE INDEX category_candidate_status_idx        ON nex.category_candidate (admin_decision, created_at DESC);
CREATE INDEX category_candidate_proposed_id_idx   ON nex.category_candidate (proposed_category_id);
CREATE INDEX category_candidate_vertical_idx      ON nex.category_candidate (suggested_parent_vertical);
```

### Rationale for schema choices

- **PRIMARY KEY on `id` text** (registry) rather than surrogate int: matches the canonical `category_id` identity doctrine — Wheel / Brain / Directory all speak the same id.
- **`origin_candidate_id` nullable FK** (registry): seed rows have no candidate origin; Factory-activated rows carry provenance to their source candidate.
- **`jsonb` for `brain_keywords`, `evidence`, `discovered_businesses`, `image_candidates`**: shape evolves; JSONB avoids schema churn per candidate iteration. Rigid columns for scalar fields keep query plans predictable.
- **`countries text[]` NOT NULL** (both tables): country foundation invariant — no magic ALL, no empty inventory claims.
- **`admin_decision` state machine** enforces exactly the "human-gated activation" doctrine. No confidence-based auto-approval column exists.
- **`business_count >= 50 AND cycle_count >= 2` CHECK constraints** encode Decision #8 at the schema level — the database refuses to store a candidate that doesn't meet the discovery threshold.
- **`image_candidates_note` default string** is a self-documenting Truth Invariant reminder: this column is EVIDENCE only, never live.

---

## Item 3 · Trade Registry merge plan

**Current state** of `src/lib/nex/centre-publishing/tradeCategoryRegistry.ts` (audit result):

| Trade id | Status | Public URL | Notes |
|---|---|---|---|
| `staircase_refacing` | enabled | `/nex-app/refacing/companies` | Priority 1 · UK market |
| `staircase_manufacture` | enabled | `/nex-app/centre?category=Staircase+Manufacture` | Priority 2 · UK market |
| `kitchens` | disabled | `/nex-app/kitchens/companies` | Placeholder · UK |

**Merge decision matrix:**

| Trade id | Migration decision | Rationale |
|---|---|---|
| `staircase_refacing` | **PRESERVE AS-IS in trade registry · do NOT migrate into `nex.category_registry` in Phase 0** | Has extended semantics (`capabilityLabels`, `capabilityOrder`, `qualificationRubric`, `discoverySources`, `seedFolder`) that the general Registry schema doesn't model. Distinct data model. Route lives under `/nex-app/refacing/*`. Migrating in Phase 0 would either flatten the trade-specific data (data loss) or bloat the general Registry with trade-only columns (over-generalisation). |
| `staircase_manufacture` | **PRESERVE AS-IS in trade registry** | Same reasoning — has trade-specific `capabilityLabels` / `qualificationRubric` / `discoverySources`. |
| `kitchens` | **PRESERVE AS-IS · currently disabled** | Same reasoning + it's disabled today. |

**But the doctrine (Decision #3) forbids two competing registries. How do we honour it?**

Introduce a **canonical registry membership** in Phase 0 that ALLOWS one row per NEX-recognised category, with two subtypes:

- **General categories** (Food / Accommodation / etc.) — fully modelled in `nex.category_registry`.
- **Trade categories** (Staircase Refacing / Kitchens / etc.) — represented as a **thin row in `nex.category_registry`** whose `business_table` points to the trade-specific storage, and whose extended semantics remain in the trade registry file. The general Registry knows the category **exists** and can list it; the trade registry file is the specialised implementation.

**Concrete Phase 0 delta for trade registry:**

Add 3 thin rows to the seed of `nex.category_registry`:

| id | parent_vertical | active | route | countries | icon | visual_glyph | business_table | category_filter |
|---|---|---|---|---|---|---|---|---|
| `staircase-refacing` | services | true | `/nex-app/refacing/companies` | `["GB"]` | 🪜 | Stairs | (nullable — trade-specific storage) | (null) |
| `staircase-manufacture` | services | true | `/nex-app/centre?category=Staircase+Manufacture` | `["GB"]` | 🔨 | Hammer | (nullable) | (null) |
| `kitchens` | services | false | `/nex-app/kitchens/companies` | `["GB"]` | 🍳 | ChefHat | (nullable) | (null) |

**Two-tier rule (locked by this plan · to be confirmed by Philip):**
- Row **exists** in `nex.category_registry` → NEX knows it and can surface it.
- Extended trade semantics **live** in `src/lib/nex/centre-publishing/tradeCategoryRegistry.ts` → the specialised implementation.
- Trade route resolution goes via existing trade code paths (not via the generic directory shell) — Decision #7 preserves existing routes untouched.

**Conflict-resolution rule (canonical):** if the same `id` slug ever collides across trade and general registries, the general `nex.category_registry` row is authoritative for identity + surface presence; trade file governs internal implementation. Doctrine violation if `id` conflict occurs — surface as error, resolve deliberately.

**⚠️ DECISION REQUIRING PHILIP APPROVAL (see §11 below).**

---

## Item 4 · Legacy wheel migration plan

**Two legacy structures** to retire:

### 4a · `CATEGORIES` array in `src/lib/nexapp/mockData.ts`

Current content (verified 2026-08-23):

```typescript
export const CATEGORIES = [
  { slug: "food",     label: "Food",     position: "top-left"     },
  { slug: "plumbers", label: "Plumbers", position: "top-right"    },
  { slug: "shopping", label: "Shopping", position: "bottom-left"  },
  { slug: "services", label: "Services", position: "bottom-right" },
];
```

**Doctrine says (Decision #4):** "must be deprecated · the wheel must consume ONLY the canonical registry."

**Reality check (audit result):** the wheel this was designed for (the four-corner category shortcut in the old NEX home) was replaced during recent Explore-mode work with `NexExploreSatellites` + `NexDirectoryCards`. The 4-position `CATEGORIES` array is likely **unused** in the current /nexapp code path.

**Phase 0 action:**
1. Grep every reference to `CATEGORIES` (uppercase, exported) in `src/`.
2. If unused: mark for deletion in Phase 0 as a zero-risk cleanup.
3. If still consumed anywhere: leave the array in place, add a `@deprecated · pending Registry migration` JSDoc, plan the consumer's refactor as an explicit sub-task (not part of Phase 0 unless trivial).

### 4b · Hardcoded categories in `src/components/nexapp/NexDirectoryCards.tsx`

Current content (verified 2026-08-23):

```typescript
const CATEGORIES: CategoryCard[] = [
  { slug: "food",          label: "Food",          route: "/food",          … },
  { slug: "accommodation", label: "Accommodation", route: "/accommodation", … },
  { slug: "hotel",         label: "Hotels",        route: "/hotel",         … },
  { slug: "kos",           label: "Kos",           route: "/kos",           … },
  { slug: "hostel",        label: "Hostels",       route: "/hostel",        … },
  { slug: "guesthouse",    label: "Guesthouses",   route: "/guesthouse",    … },
];
```

**This is a doctrine violation TODAY** — hardcoded categories duplicating the Registry.

**Phase 0 action (behaviour-preserving):**
1. Refactor `NexDirectoryCards` to consume `activeCategoriesForCountry(country)` from the Registry (TS array reader unchanged in Phase 0).
2. Filter to the 6 currently listed (food, accommodation, hotel, kos, hostel, guesthouse) — Registry already contains all 6 active for `ID`.
3. Preserve current visual (initial tile + label + description + `›` chevron).
4. Description strings: keep current inline strings; adding `description` to the Registry is a Phase 1 concern (schema-additive, not in Phase 0).
5. Order: current order is Food → Accommodation → Hotel → Kos → Hostel → Guesthouse. Preserve exactly (add a Registry `sort_order` column? deferred to Phase 1).

**Regression:** the drawer's rendered card list must be byte-identical before and after (same 6 cards, same order, same visuals). This is testable via snapshot.

### 4c · Wheel visual four-first priority

The old doctrine mentions "the wheel's four-first visual priority". In the current /nexapp, the four-position wheel is replaced by the 5-satellite Explore radial. There is no live "four-first priority" to preserve. Phase 0 records this fact and moves on.

---

## Item 5 · Compatibility strategy

**Guiding rule:** every public export of `src/lib/nex/category-registry.ts` continues to work with identical signatures and identical return values after Phase 0.

### Public API surface (must remain unchanged)

```typescript
export type NexVertical
export interface CategoryEntry
export const CATEGORY_REGISTRY: CategoryEntry[]
export function getCategory(id: string): CategoryEntry | undefined
export function categoriesForVertical(vertical: NexVertical): CategoryEntry[]
export function activeCategories(): CategoryEntry[]
export function activeCategoriesForCountry(country: string): CategoryEntry[]
export type IntentResolution
export function resolveIntent(phrase: string, country: string): IntentResolution
```

### Phase 0 internal behaviour

- `CATEGORY_REGISTRY` remains an in-file TS constant with the same 10 entries.
- Helpers continue to read from the TS constant (no async, no DB reads at import time).
- A build-time (or dev-server-boot) validator checks: `TS entries === nex.category_registry rows`. Mismatch = fail-fast with clear diagnostic.
- The DB table exists alongside · consumers (Walker, HQ Directory Factory when built) that need candidate/factory operations query DB directly via a small adapter (`src/lib/nex/category-registry.db.ts` — new file in Phase 0).

### Later phases (deliberately NOT in Phase 0)

- Phase 1: async helpers (or server-component-only helpers) that read from DB. Then TS array becomes a build-time-only source of truth for migration seeds.
- Phase 2: TS array deleted; DB is the sole source.

**No consumer code (Food, Accommodation, /hotel /kos etc., Brain, wheel drawer) changes its imports in Phase 0.** The changes are purely additive under the hood.

---

## Item 6 · Rollback plan

Phase 0 is safe to roll back at any point because it has zero runtime dependencies.

### If rollback needed BEFORE deploying Phase 0

- Delete the migration file(s).
- Delete `src/lib/nex/category-registry.db.ts`.
- No production impact — never shipped.

### If rollback needed AFTER deploying Phase 0

1. `DROP TABLE IF EXISTS nex.category_candidate;` (created first · dropped last)
2. `DROP TABLE IF EXISTS nex.category_registry;`
3. Delete `src/lib/nex/category-registry.db.ts` (the DB adapter).
4. Delete the validator + its startup hook.
5. Delete regression tests specific to Phase 0.

**No user-facing effect** because:
- `CATEGORY_REGISTRY` TS constant untouched.
- All helpers read from TS constant.
- No route depends on the DB tables in Phase 0.
- Walker doesn't write to `nex.category_candidate` in Phase 0.

**Rollback SQL is provided in the migration** as an explicit `-- ROLLBACK` comment block matching Task-#88 pattern.

---

## Item 7 · Regression tests

Every test below is created in Phase 0 and must pass before Phase 0 is declared complete.

### 7.1 · Registry ↔ DB parity (fail-fast at startup)

```typescript
describe("Phase 0 · Registry TS ↔ DB parity", () => {
  it("all 10 TS entries exist in nex.category_registry", async () => { … });
  it("no orphan DB rows without TS counterpart", async () => { … });
  it("field-by-field equality for every entry", async () => { … });
});
```

### 7.2 · Existing routes still resolve

```typescript
describe("Phase 0 · route resolution invariant", () => {
  it.each(["/food","/accommodation","/hotel","/guesthouse","/kos","/hostel"])(
    "%s still returns 200 with expected content",
    async (path) => { … await fetch + assertions }
  );
});
```

### 7.3 · Brain intent still matches

```typescript
describe("Phase 0 · resolveIntent invariant", () => {
  it("food · ID → matched_active (id=food)", …);
  it("hotel · ID → matched_active (id=hotel)", …);
  it("villa · ID → matched_inactive (id=villa)", …);
  it("hotel · GB → matched_active_wrong_country", …);
  it("nonsense · ID → unknown", …);
});
```

### 7.4 · Drawer renders identical cards (post-4b refactor)

Snapshot test on `NexDirectoryCards` render output at canonical viewport (390×844):
- 6 cards, same order, same labels, same route hrefs.
- Snapshot diff = zero after refactor.

### 7.5 · Walker byte-invariance

Run Task-#84 rotation smoke test:
- Same cycle configs.
- Same food-business rows written.
- Same claim_status='discovered' outcomes.
- Zero new schema writes from Walker (Walker doesn't touch new tables in Phase 0).

### 7.6 · Migration idempotence

- `psql -f 082_nex_category_registry.sql` runs cleanly.
- Running it twice does NOT error (idempotent seed via `INSERT … ON CONFLICT (id) DO NOTHING`).
- Rollback SQL runs cleanly.

### 7.7 · Constraint enforcement

- Attempting to insert `nex.category_candidate` with `business_count < 50` fails at DB level.
- Attempting to insert with `cycle_count < 2` fails.
- Attempting to insert `nex.category_registry` with a bad country code fails.
- Attempting a duplicate route fails.

**All regression tests must be added to CI (or the local test runner) as blocking checks before Phase 0 ships.**

---

## Item 8 · Byte-invariant confirmation

Phase 0 delivery is complete only when ALL these are demonstrably TRUE:

| Invariant | How verified |
|---|---|
| Food route content unchanged | `curl /food` before + after · byte-identical HTML |
| Accommodation route content unchanged | same |
| /hotel /guesthouse /kos /hostel content unchanged | same, all four |
| Walker discovery output unchanged | Task-#84 smoke test rows identical |
| Walker never writes to `nex.category_candidate` | verified by explicit "no-op" test in Phase 0 |
| `nex.food_business` schema unchanged | `\d nex.food_business` diff = empty |
| `nex.accommodation_business` schema unchanged | same |
| `nex.business_image` schema unchanged | same |
| Brain intent responses unchanged | Regression 7.3 passes |
| Category wheel/drawer renders identical | Regression 7.4 snapshot diff = empty |
| HQ existing pages render identically | manual sweep of all HQ routes |
| Category Registry TS exports API-identical | consumer imports still compile without change |

**Any invariant fails → Phase 0 is not done. No partial ship.**

---

## §9 · Post-approval pipeline (later phases · this document scopes but does not build)

Phase 0 lays the DB foundation. Subsequent phases realise the full "auto-directory" pipeline:

### Phase 1 · Walker candidate writer
- Walker calls `proposeCategory(evidence)` when discovery threshold hit.
- Writes to `nex.category_candidate` with `admin_decision='pending'`.
- Never touches `nex.category_registry`.
- Cross-refs Walker-stays-pure doctrine.

### Phase 2 · HQ approval surface
- `/nex-head-quarters/directory-factory` route (per Decision #1).
- Lists pending candidates as tiles.
- Shows evidence · discovered businesses (sample) · image candidates (evidence label) · confidence.
- One-click Approve / Reject / Duplicate-of / Rename buttons.
- Writes `admin_decision` + `admin_reviewed_by` + `admin_reviewed_at`.

### Phase 3 · Factory activation engine
- When candidate approved: validate registry uniqueness · verify Brain keyword non-collision · verify acquisition support exists (Decision #6 pluggable classifier) · verify image resolver has fallback for the parent_vertical · run negative-regression test suite.
- On green: `INSERT INTO nex.category_registry` with `active=true` + `activated_at` + `activated_by`.
- Store `origin_candidate_id` on the registry row for provenance.

### Phase 4 · Runtime dispatcher (dynamic routes)
- New categories use dynamic route dispatcher (Decision #7 · existing static routes remain).
- Dispatcher reads Registry by url slug.

### Phase 5 · Wheel + Brain integration
- Wheel drawer auto-picks up new categories via `activeCategoriesForCountry()`.
- Brain intent resolves via existing `resolveIntent()`.

### Phase 6 · City rollout
- Same Factory reused for Bali / Jakarta / Bandung / Surabaya / … (Decision #13).
- No architecture change per city.

**These phases are outside this document's scope. Each requires its own gated plan.**

---

## §10 · Migration files that WOULD be created in Phase 0 (design only)

**No files created by this document.** Listed for approval clarity:

- `deploy/postgres/init/082_nex_category_registry.sql` — table + indexes + seed (10 general + 3 trade thin rows) + validator function.
- `deploy/postgres/init/083_nex_category_candidate.sql` — table + indexes + CHECK constraints.
- `src/lib/nex/category-registry.db.ts` — thin DB adapter for candidate writes (Walker) + candidate reads (HQ, later). Registry reads still TS.
- `src/lib/nex/category-registry.validator.ts` — startup TS-vs-DB validator with fail-fast diagnostic.
- `src/lib/nex/category-registry.test.ts` — extended with Phase 0 regression suite.
- `src/components/nexapp/NexDirectoryCards.tsx` — small refactor (consume Registry helper · preserve rendered output).

Migration numbering: last shipped migration is `081_nex_business_country.sql` (2026-08-22). Phase 0 uses `082` + `083`.

---

## §11 · Decisions requiring your explicit approval

Before ANY implementation, please approve or amend each of the following:

**D1 · Two-tier trade merge (Item 3):** thin rows in `nex.category_registry` for `staircase-refacing`, `staircase-manufacture`, `kitchens` with extended semantics still living in `tradeCategoryRegistry.ts`. Alternative options: (a) full merge (would require extending Registry schema to hold trade fields) or (b) keep trade registry entirely separate and formally exempt it from Decision #3 for now.

**D2 · Country whitelist in schema:** `nex.category_registry.countries` CHECK constraint enumerates a fixed list (`ID GB US MY SG TH VN PH AU NZ`). Alternative: no whitelist, accept any ISO-2 string. Whitelist prevents typos but requires migration when new markets open.

**D3 · `admin_decision` state values:** `pending / approved / rejected / duplicate / superseded`. Add `deferred`? `merged`? Or is 5 states enough for now?

**D4 · Candidate threshold at DB level:** `business_count >= 50 AND cycle_count >= 2` enforced by CHECK constraints (Decision #8). Alternative: enforce only in application layer. DB-level = defence in depth · TS-level = flexibility. Current plan = both.

**D5 · Legacy `CATEGORIES` array in `mockData.ts`:** Phase 0 grep + delete-if-unused or `@deprecated` JSDoc. Approve deletion if audit confirms zero consumers.

**D6 · Migration file location:** `deploy/postgres/init/082_*.sql` + `083_*.sql` follows existing numbering. Approve.

**D7 · Regression suite location:** extend `src/lib/nex/category-registry.test.ts` (Vitest). Approve.

**D8 · Registry `description` field:** not in Phase 0 (drawer keeps inline strings). Add in Phase 1 alongside candidate-approval-writes-registry flow. Approve deferral.

**D9 · Registry `sort_order` field:** not in Phase 0 (drawer keeps hardcoded order). Add in Phase 1. Approve deferral.

**D10 · Trade route paths (`/nex-app/refacing/companies` etc.):** stored as-is in the seed. These are legacy paths that pre-date Decision #7's "leave existing routes untouched" rule. Approve preserving them exactly.

---

## §12 · Unresolved architectural risks

**R1 · Trade registry doctrine split:** Decision #3 says "one canonical registry." The two-tier rule in Item 3 arguably violates that in spirit. Mitigation: the general Registry knows every category exists; only implementation lives in the trade file. Risk: future confusion about which file to touch. Ask if a full merge (option D1a) is preferred despite the schema complexity cost.

**R2 · Candidate deduplication:** two Walker cycles might propose the same `hair-salon` slug independently. Plan handles this via `admin_decision='duplicate'` + `duplicate_of_registry_id` / `superseded_by_candidate_id` — but the LOGIC to detect duplicates on write is a Phase 1 concern, not Phase 0. Risk: candidate table grows with easy-to-detect duplicates until Phase 1 lands.

**R3 · Country list growth:** the CHECK whitelist (D2) needs a migration every time a new market opens. Not a Phase 0 blocker but worth naming.

**R4 · Brain-keyword collisions across candidates:** if Walker proposes `hair-salon` with keyword "salon" and someone later proposes `nail-salon` also with keyword "salon", Brain resolution becomes ambiguous. Not solvable in Phase 0 (no candidates exist yet) but the approval surface (Phase 2) must include a keyword-collision check.

**R5 · Existing image resolver dependency:** Universal Image doctrine says Image Phase 1 ships before Factory Phase 0. Phase 1 IS shipped (`resolveDirectoryHero.ts` + tests). No blocker.

**R6 · Registry `id` renames are dangerous:** once a category ships live and Walker/Businesses reference the id, renaming requires a coordinated migration. Doctrine already covers this ("NEVER change once shipped without a versioned rename migration"). Not a Phase 0 issue but the rule needs enforcement in code review going forward.

**R7 · Test infrastructure:** the Phase 0 regression suite assumes Vitest + a running Postgres for DB-parity tests. If tests must run without a live DB (CI-in-Docker etc.), the parity check becomes a build-time script that runs against a spun-up test DB. Approve which testing strategy.

---

## §13 · Confirmation of zero code / schema changes

At the moment of writing this document:

- No file in `src/**` was modified.
- No migration file was created in `deploy/postgres/init/**`.
- No file in `scripts/**` was modified.
- No file in `docs/DECISIONS/**` was modified.
- No route was created or altered.
- No DB was migrated.
- No test file was created or modified.
- The Category Registry TS file, business tables, Walker scripts, HQ routes, and drawer are all UNTOUCHED.

The only artifact created is **this document** (`docs/nex/directory-factory-phase-0-plan.md`).

**Awaiting Philip's explicit approval of the design (§11 decisions D1–D10) before any Phase 0 implementation begins.**
