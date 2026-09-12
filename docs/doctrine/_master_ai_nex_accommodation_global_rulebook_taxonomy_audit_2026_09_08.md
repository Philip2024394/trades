# NEX Accommodation Agent · GLOBAL ACCOMMODATION TAXONOMY AUDIT (§39)

**Authorship:** Master AI Engineer · executing Founder BEGIN 2026-09-08 · 42-section GLOBAL ACCOMMODATION INTELLIGENCE RULE BOOK UPGRADE
**Rule-book version produced:** v4 · 2026-09-08
**Prior version preserved:** v3 (Indonesia BEGIN additive layer) + v2 (property + taxonomy foundation) + doctrine 2026-09-07 (durable spec)
**Deliverable status:** §37 + §39 · GREEN
**Op-Truth §OP.5 · final_status:** null (Founder governance not yet closed)

---

## §37 · What existed BEFORE this BEGIN (preserved · not overwritten)

| File | Purpose | Section coverage from 42-section BEGIN |
|---|---|---|
| `src/lib/nex/intelligence-storage-grid/accommodation/taxonomy.ts` | Type taxonomy · style/purpose/service tags · alias resolver | §3-§7 · §16 vocab (BoardMealPlan · BreakfastKind) · §17 vocab (BedType) · §18-§19 vocab (ImageClassification · ImageScope) · §26 country-specific preservation · §31 alias resolver · §39 audit function |
| `src/lib/nex/intelligence-storage-grid/accommodation/property-schema.ts` | Property record shape · rooms · facilities · services · food · policies · nearby | §9 PropertyIdentity · §10 PropertyLocation · §11-§12 RoomUnitRecord (structured BedConfiguration + BathroomConfiguration · answerable bed questions) · §13 FacilityAssertion · §14 ServiceAssertion · §15 FoodAndDrinkOffering · §16 BreakfastOffering · §17 BoardMealPlan · §18-§19 AccommodationImage (with room_type_id + scope + rights_metadata) · §20 PropertyPolicies · §21 AccessibilityFeatures · §22-§23 (in policies) · §24 NearbyReference (compact form) · §32 WorldClassPropertyRecord + computePropertyCompleteness scorer |
| `src/lib/nex/intelligence-storage-grid/accommodation/adapter-postgres.ts` | Thin read-only wrapper over 5 existing Postgres tables (9,203 rows + 46,114 provenance rows) | §31 storage substrate · §32 data authority · zero DDL · zero schema change |
| `docs/doctrine/nex_accommodation_intelligence_agent_world_class_doctrine_2026_09_07.md` (854 lines) | Durable spec · 34 §-sections · Image intelligence addendum | Governing principles · continuous mission · field-level truth model · confidence engine · language intelligence · entity resolution · location · image · document/OCR · pricing · availability · freshness · quality · source diversity · real persistence · data authority · NEX Brain contract · Chat card contract · search/matching · 518-city scale · 24/7 observability · failure recovery · security/truth · testing · real-world proof · architectural roadmap |

**From prior session's Indonesia BEGIN (2026-09-08 · same day · additive · this session's Phase A):**

| File | Purpose | 42-section overlap |
|---|---|---|
| `activity-taxonomy.ts` (470 lines) | Activity/nature/culture/entertainment/wellness/food-experience/shopping/nightlife/transport-hub/service registry + activity checklist | §24 (nearby vocabulary) · partial §35 (cross-agent · destination-side) |
| `nearby-relationship.ts` (331 lines) | Cross-domain relationship edges · deterministic Haversine · city-boundary-not-a-wall | §24 (richer form of nearby) · §35 (cross-domain graph) · §6 fabrication-safe distance |
| `evidence-claims.ts` (302 lines) | Popularity + subjective + seasonal claim validators · UNKNOWN downgrade | §30 no-fabrication discipline · §31 KnowledgeStatus alignment |
| `rule-book-v3.test.ts` (500 lines · 59 tests) | Contract tests for above three modules | Test coverage for the additions above |

**Duplication assessment (Founder-mandated in §37):**

| Potential duplicate | Actual verdict | Reason |
|---|---|---|
| `property-schema.ts::NearbyReference` VS `nearby-relationship.ts::RelationshipEdge` | **Complementary · not duplicate** | `NearbyReference` is a compact embed inside a property record (fast property-page rendering). `RelationshipEdge` is a standalone graph edge (traversal). These are the normalized/denormalized-view duality used everywhere in NEX. Change report documents intended relationship. |
| `taxonomy.ts::COUNTRY_SPECIFIC_TYPES` VS `country-profile.ts::country_specific_type_slugs` | **Complementary · not duplicate** | Taxonomy owns the type registry (one place). Country profile REFERENCES slugs (never re-defines). Enforced by test `country_specific_type_slugs reference REAL slugs from taxonomy`. |
| `activity-taxonomy.ts::ACTIVITY_TYPES` VS Food/Transport domain taxonomies | **No collision** (Food/Transport taxonomies not yet built) · when they are, cross-domain relationships use `EndpointKind` enum to keep clean separation |
| No competing rule-book file exists elsewhere in `src/lib/nex/**` | **Verified by grep** for `rule.?book\|ruleBook\|RULE_BOOK\|RuleBook` — 6 hits, all in `intelligence-storage-grid/accommodation/` | No shadow rule-book found in other accommodation code paths (`nex-accommodation/list-businesses.ts` is UI/SSR only · `indonesia/directory-knowledge.ts` is data-plane bridge only) |

---

## §37 · What was ADDED this session (additive · governance-approved by this BEGIN)

| File | Lines | Purpose | 42-section coverage |
|---|---|---|---|
| `taxonomy.ts` (extended) | +76 lines · `FOUNDER_BEGIN_ADDITIONS_2026_09_08` block · merged into `ALL_EXTENDED_TYPES` | 25 new accommodation type entries Founder listed in §3-§6 §8 that were absent | §3 (4) · §4 (8) · §5 (6) · §6 (6) · §8 (1 nordic) |
| `country-profile.ts` (new) | 458 lines | Country accommodation profile schema (§27) · discovery checklist (§28) · 8 seed profiles (JP · MA · PT · ES · IT · FR · IN · ID) · cultural terminology preservation (§26) | §8 · §26 · §27 · §28 |
| `acceptance-questions.ts` (new) | 316 lines | Machine-readable corpus of ~50 traveller questions mapped to schema fields · §40 topic coverage tracker · §41 UNKNOWN discipline | §25 · §29 living-document feedback · §40 · §41 |
| `rule-book-v4-founder-42.test.ts` (new) | 350 lines · 68 tests | Contract tests: no-duplication · Founder-listed types present · alias resolution correctness · country profile discipline · §40 topic coverage · §41 UNKNOWN discipline | §37 · §39 · §41 verification |

**Bug found during audit (fixed):** `holiday-park` had `"holiday village"` in its aliases which collided with the `holiday-village` type's own alias — the alias-index Map overwrote silently. Test `no alias appears against two different types` now catches this class of bug going forward. Fix: removed the colliding alias from `holiday-park` (holiday-village is the more accurate target).

**Version stamp:** every entry in `FOUNDER_BEGIN_ADDITIONS_2026_09_08` and every seed country profile carries `profile_version: "v1.2026-09-08"`. Every audit report should quote this version.

---

## §39 · GLOBAL ACCOMMODATION TAXONOMY AUDIT (Founder-mandated output format)

### Existing types

Total: **~90** extended types across CORE (29) · SPECIALISED (14) · CAMPING (5) · OTHER (9) · COUNTRY_SPECIFIC (16) · FOUNDER_BEGIN_ADDITIONS_2026_09_08 (25).

Actual runtime count is available via `taxonomyAudit()`. All backed by the canonical 7-value SQL enum (`hotel · villa · guesthouse · homestay · resort · hostel · apartment`) which is NEVER extended without a Postgres migration.

### Newly discovered types (added by this BEGIN)

25 types Founder listed in §3-§6 §8 that were missing before this session:

- §3 CORE: `apartment-complex` · `rural-accommodation` · `palace` · `all-suite-hotel`
- §4 SPECIALISED: `love-hotel` · `teepee` · `dome-accommodation` · `igloo-accommodation` · `cruise-ship-accommodation` · `floating-accommodation` · `lighthouse-accommodation` · `railway-sleeper-accommodation`
- §5 CAMPING: `caravan` (+ static-caravan alias) · `mobile-home` · `campervan-accommodation` · `tent` (generic) · `trailer-tent` · `cabin-camp`
- §6 OTHER: `seasonal-workers-accommodation` · `group-accommodation` · `holiday-camp` · `educational-accommodation` · `conference-accommodation` · `medical-health-accommodation`
- §8 NORDIC/ARCTIC: `ice-hotel` (+ snow-hotel alias)

### Potential duplicates

**One found and fixed:** `"holiday village"` alias was attached to both `holiday-park` and `holiday-village`. Removed from `holiday-park`. Test asserts no future recurrence.

**No other duplicates.** Alias-index integrity test now passes with zero conflicts.

### Aliases

Total aliases registered (from `taxonomyAudit().total_aliases`): **grows with every added type** — every type contributes at minimum {slug, display_name, ...aliases[]}. Current 25 additions contributed ~40 new aliases including Indonesian/Japanese/Moroccan/Portuguese/Spanish/Italian/French/Nordic terms.

### Country-specific types

**16 COUNTRY_SPECIFIC_TYPES** preserved from prior work: ryokan · minshuku · machiya · riad · dar · kasbah · pousada · quinta · parador · casa-rural · agriturismo · albergo-diffuso · gite · chambre-dhotes · heritage-hotel-in · haveli.

**+1 added this session:** ice-hotel (Nordic/Arctic).

**Indonesian country-specific types** (in `OTHER_TYPES` for canonical-category reasons but semantically country-specific): kos · kost-kosan · penginapan · wisma · losmen. Preserved verbatim per §26.

### Types requiring special handling (§4 · §6 evidence-required)

**44 types** carry `requires_evidence_note` (per `taxonomyAudit().types_requiring_evidence`). These are types where the classifier MUST verify commercial-visitor-accommodation status before assigning (e.g. castle · palace · lighthouse · cruise ship · seasonal-workers-accommodation · medical-health · love-hotel · igloo · timeshare · workers-hostel).

### Types that are STYLES rather than TYPES

**10 STYLE_TAGS** (per `taxonomy.ts::STYLE_TAGS`): boutique · luxury · historic · modern · traditional · eco · design · heritage · family · adults_only.

Enforced in taxonomy: "boutique hotel" is a `hotel` with style_tag=boutique — NOT a distinct type. §7 discipline preserved.

### Types that are PURPOSES rather than TYPES

**12 PURPOSE_TAGS** (per `taxonomy.ts::PURPOSE_TAGS`): business · airport · beach · ski · golf · medical · wellness · romantic · family · backpacker · long_stay · extended_stay.

Enforced: "beach resort" is a `resort` with purpose_tag=beach — NOT a distinct type.

### Types that are ACCOMMODATION UNITS rather than PROPERTIES

**13 UNIT_KINDS** (per `taxonomy.ts::UNIT_KINDS`): room · suite · studio · apartment · villa · cabin · tent · pod · dormitory_bed · capsule · yurt · treehouse · houseboat_cabin.

Enforced: a dormitory-bed is a UNIT inside a hostel · not a property itself.

### Types requiring evidence before classification

Same as "special handling" above (44 types). All classifier callers must gate on `requires_evidence_note` and defer classification until source evidence supports the type.

---

## §37 · Change report

**What changed on disk (additive · no overwrite · no deletion):**

1. `taxonomy.ts` — added `FOUNDER_BEGIN_ADDITIONS_2026_09_08` (25 entries) + merged into `ALL_EXTENDED_TYPES` + added `founder_begin_additions_2026_09_08` field to `taxonomyAudit()` return shape. Fixed pre-existing `holiday-park` alias collision by removing colliding "holiday village" entry.
2. `country-profile.ts` — NEW file (458 lines). Contract + 8 seed profiles + discovery checklist.
3. `acceptance-questions.ts` — NEW file (316 lines). Corpus + §40 topic coverage tracker.
4. `rule-book-v4-founder-42.test.ts` — NEW file (350 lines · 68 tests). Cross-cutting acceptance discipline.

**What did NOT change:** `property-schema.ts` (0 modifications) · `adapter-postgres.ts` (0 modifications) · doctrine file 2026-09-07 (0 modifications · addendum forthcoming as separate action, not in-file edit) · Wave 11 · Master AI Waves 1-4 · other agents · Postgres schema · L4 · L4 bakeoff · UI · SSR · CI configuration.

**Test baseline delta:** 59 tests (v3) → 127 tests (v3 + v4). +68 new tests. Zero regressions. Zero TypeScript errors.

**Bug fixed as a side-effect of audit:** silent alias collision on "holiday village" — could never be corrected before because no test caught it.

**Hard-stop items enforced (§36 from Indonesia BEGIN + §30 · §36 of this BEGIN):**
- No fabrication paths introduced
- No duplicate database created
- No new agent created
- No L4 change
- No L4 bakeoff change
- No paid AI introduced
- No infrastructure purchase
- No modification to unrelated systems
- No silent taxonomy change (all additions labelled with the FOUNDER_BEGIN_ADDITIONS_2026_09_08 block + traceable to specific Founder §-numbers)
- Prior rule-book preserved (§37 discipline honoured)

---

## §40 · Founder acceptance test result

Every §40 topic is now testable against a corpus. Current coverage from `acceptanceQuestionRegistryStats()`:

**Topics with question coverage:** ROOM · BEDS · OCCUPANCY · FACILITIES · SERVICES · FOOD · BREAKFAST · IMAGES · POLICIES · LOCATION · NEARBY · EVIDENCE · FRESHNESS · COMPARISON.

**Topics presently gapped (honestly reported):** PROPERTY_LOOKUP · TYPE · COUNTRY · RELATIONSHIPS · UNKNOWNS — corpus can expand into these categories as agent encounters real user questions in those categories (§29 living-document feedback loop). Test framework detects the gap; no fabrication used to fill.

**§41 verification:**
- **"If I gave the Accommodation Agent a completely new country tomorrow, does its rule book tell it what to look for?"** → YES. `generateDiscoveryChecklist("XX")` for an unseeded country returns all 13 §28 questions marked UNANSWERED. Agent has structured research plan without needing prior data.
- **"If a traveller asks almost any normal accommodation question, does the rule book tell the agent which information it should have collected to answer it?"** → YES for the 50 questions in the current corpus; corpus is expandable via §29 discipline. UNKNOWN discipline enforced everywhere (verified by test `all discovery-checklist statuses degrade to UNANSWERED without fabricating`).
- **"Can the Accommodation Agent continuously discover what it does not know and research it?"** → YES (contract layer). Actual continuous discovery requires Phase B worker activation (separate BEGIN — hard-stop threshold preserved).

---

## §38 · Research pass · sources considered

Given hard-stop `no infrastructure purchase` and `no external API access without separate BEGIN`, the research pass was limited to:

**Documented references (from prior NEX doctrine + established codebase knowledge):**
- ISO 18513 tourism accommodation vocabulary (referenced in existing doctrine)
- UN Tourism / UNWTO accommodation classification framework (referenced in existing doctrine)
- Indonesian tourism ministry terminology (Kemenparekraf Melati star ratings · encoded in ID profile)
- Portuguese Turismo de Portugal RNET (encoded in PT profile)
- French Atout France ratings (encoded in FR profile)
- Indian Ministry of Tourism ratings (encoded in IN profile)

**Not conducted this session (would require separate authorization):**
- Live scraping of tourism authority sites — hard-stop §22 (Indonesia BEGIN) + §36 (this BEGIN)
- Provider aggregator taxonomy comparison (Booking.com / Expedia / Agoda taxonomies) — requires ToS review and separate BEGIN
- Field survey of hosts about local terminology in each country — outside NEX scope

**Countries with seed profiles established this session:** JP · MA · PT · ES · IT · FR · IN · ID. Other countries pending §28 discovery checklist runs (each is its own BEGIN or bulk expansion BEGIN).

---

## §29 · Living document — what happens NEXT

This BEGIN is COMPLETE at the CONTRACT LAYER. Everything below is Phase B and requires a separate Founder BEGIN each:

1. `ACCOMMODATION-RULEBOOK-V4-DOCTRINE-ADDENDUM` — extend the 854-line doctrine at `docs/doctrine/nex_accommodation_intelligence_agent_world_class_doctrine_2026_09_07.md` with a v4-linked addendum. (Documentation only. Trivial. Can be done same-BEGIN if Founder authorizes doctrine touch.)
2. `ACCOMMODATION-RULEBOOK-V4-COUNTRY-EXPANSION-N` — add seed profiles for N additional countries (per country · per §28 checklist run).
3. `ACCOMMODATION-RULEBOOK-V4-ACCEPTANCE-CORPUS-EXPAND` — grow the question corpus into currently-gapped §40 topics (PROPERTY_LOOKUP · TYPE · COUNTRY · RELATIONSHIPS · UNKNOWNS).
4. `ACCOMMODATION-RULEBOOK-V4-WIRE-TO-WORKER` — when the Phase B worker activates, wire discovery checklist to prioritise research (§28 → gap-engine).
5. `ACCOMMODATION-RULEBOOK-V4-WIRE-TO-CHAT` — wire acceptance corpus into composition so an incoming user question can be answered structurally (schema-field lookup → UNKNOWN fallback per §41).

---

## Success condition (Founder §41 · restated for closure)

- **Does the rule book tell the agent what to look for in a new country?** — YES. Contract in `country-profile.ts` + `DISCOVERY_QUESTIONS` covers all 13 §28 questions. Tested.
- **Does the rule book tell the agent what to collect to answer a traveller question?** — YES for 50 currently-catalogued §25 questions with schema-field paths. Corpus grows. UNKNOWN when evidence missing. Tested.
- **Can the agent continuously discover what it does not know?** — YES at the CONTRACT LAYER (research_gaps field · discovery checklist · living-document §29 discipline). Actual continuous execution needs Phase B worker BEGIN.

**FOUNDER STATUS: BEGIN COMPLETE at contract layer · GREEN.**
