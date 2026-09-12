# Path C · Cross-Substrate Row-Level Overlap Analysis

**Date:** 2026-09-11
**Mode:** READ-ONLY · zero writes · zero migrations · zero authority changes · freeze in force
**Founder directive:** Analyse without resolving. Classify without merging.
**Answers:** LAM unresolved questions Q3 and Q4

---

## 1. Executive finding

**A · SEPARATE KNOWLEDGE POPULATIONS.**

The evidence overwhelmingly indicates that Supabase NEX-dedicated `knowledge_records` and the `nex_dev` domain-knowledge tables cover **complementary, non-overlapping knowledge populations**.

- **Supabase `knowledge_records`** = UK Trade Knowledge (doors · flooring · kitchens · staircases · technical guidance · customer guidance · platform architecture).
- **`nex_dev` domain tables** = Indonesia Travel/Business data + accommodation/food observed facts.

Zero row-level duplicates were detected. Zero title-level overlaps. Zero subject-level overlaps. The two substrates are architecturally separated by **domain** (UK trades vs Indonesia expansion), not merely by physical location.

The LAM classification stands: `knowledge_records` is canonical for Domain Knowledge (UK trades subset); the `nex.brain_*` tables and `nex.business_knowledge` are canonical for Indonesia-domain data and are DIFFERENT logical objects at row level.

The initial fear — that `nex.business_knowledge` might duplicate `knowledge_records` at row level — turned out to be a **naming coincidence**, not a design collision. Both use the word "knowledge" but store fundamentally different logical objects.

## 2. Quantitative overlap summary

| Source A | Source B | Records A × B | Overlap detected | Classification |
|---|---|---|---|---|
| Supabase `knowledge_records` (3,627) | `nex.business_knowledge` (1,258) | Different schemas · logical objects not comparable at row level | N/A · type mismatch | **INDEPENDENT (different logical object types)** |
| Supabase `knowledge_records` (3,627) | `nex.brain_did_you_know_indonesia` (39) | 3,627 × 39 = 141,453 pairs | **0 title-level hits** across all 39 Indonesia titles searched against Supabase title+summary text | **INDEPENDENT (different domains: UK trades vs Indonesia trivia)** |
| Supabase `knowledge_records` (3,627) | `nex.brain_attractions` (32) | Different schemas · knowledge_records = Markdown articles · brain_attractions = coordinate data | N/A · type mismatch | **INDEPENDENT (different logical object types)** |
| Supabase `knowledge_records` (3,627) | `data/nex-knowledge/kitchen/faqs.jsonl` (55) | 55 kitchen homeowner FAQs · all searched against Supabase | **0 hits** | **INDEPENDENT (different audience/format · consultative Q&A vs technical articles)** |
| Supabase `knowledge_records` (3,627) | `data/nex-knowledge/_shared/trade-business/faqs.jsonl` (12) | 12 trade-business-process FAQs · all searched against Supabase | **0 hits** | **INDEPENDENT (different subject · business process vs product knowledge)** |
| Supabase `knowledge_records` (3,627) | `nex.concepts` (44) | Each of 44 canonical_keys tested against Supabase record_id + title + category as word-boundary regex | **0 hits** | **INDEPENDENT (different domain: programming/meta vs UK trades)** |

**Total distinct overlaps found: 0.**

## 3. Substrate content breakdown (evidence for the finding)

### Supabase `knowledge_records` (3,627)

By status:
| Status | Rows |
|---|---:|
| DRAFT | 2,886 (79.6%) |
| UNDER_REVIEW | 282 (7.8%) |
| DEPRECATED | 262 (7.2%) |
| AUTHORITATIVE | 197 (5.4%) |

By founder authorisation:
| authorised_by | Rows |
|---|---:|
| Philip | 22 |
| (null) | 3,605 |

**Only 22 of 3,627 rows carry `authorised_by=Philip`.** The founder-qualified LAM classification is validated: *the table is canonical at substrate level; individual record authority is determined by status/governance fields*. Most rows are DRAFT-stage · not authoritative.

Top categories (all UK-trade domain):
| Category | Rows |
|---|---:|
| NEX door | 2,088 |
| NEX flooring | 620 |
| NEX kitchen | 458 |
| NEX Technical Guidance | 99 |
| NEX Customer Guidance | 51 |
| NEX staircase | 49 |
| NEX Components | 45 |
| NEX Trade Knowledge · Components · Staircase Components | 31 |
| NEX Trade Knowledge | 19 |
| NEX Trade Knowledge · Design & Engineering | 18 |
| NEX Trade Knowledge · Cost Benchmarking | 10 |
| NEX Trade Knowledge · Historical Context | 9 |
| NEX Customer Guidance · Decision Support | 8 |
| NEX Materials | 7 |
| NEX Platform Architecture · Knowledge Management | 6 |

Sample titles (all UK-trade):
- "American White Oak for Kitchen Worktops"
- "Sapele Hardwood Applications in Modern Staircase Design"
- "Blondel Formula: Architectural Standards for Step Proportions"
- "100mm Sphere Test for Baluster Spacing Compliance"
- "Cantilever Staircases: Structural Physics and Hidden Support Requirements"
- "Carpet Colours That Pair Beautifully with Oak Staircases"
- "NEX Knowledge Graph Architecture & Content Structuring Strategy"

### `nex.business_knowledge` (1,258)

Vertical:
| Vertical | Rows |
|---|---:|
| accommodation | 738 |
| food | 520 |

Attribute domain (per-row observed facts):
| attribute_domain | Rows |
|---|---:|
| location | 536 |
| physical | 131 |
| identity | 128 |
| contact | 107 |
| character | 94 |
| facilities | 85 |
| opening_availability | 77 |
| freshness | 29 |
| accessibility | 28 |
| suitability | 26 |
| commercial | 9 |
| family | 8 |

Sample rows:
- `#AC-2026-00008.addr_street_raw = "Jalan Abu Bakar Ali"` · source: osm_replay
- `#AC-2026-00008.addr_housenumber = "8"` · source: osm_replay
- `#AC-2026-0000B.name_en = "Wisma Gembira"` · source: osm_replay

**This is per-attribute OSM-observed business facts for Indonesian accommodations and food businesses. Not Markdown domain knowledge. Cannot overlap with Supabase at row level because it is a different logical object type entirely.**

### `nex.brain_did_you_know_indonesia` (39)

All Indonesia trivia · sample titles:
- "The Changing Volcanic Lakes" (Kelimutu)
- "The Javan Hawk-Eagle Inspiration"
- "Krakatoa's Eruption in 1883"
- "The Borobudur Temple Miracle"
- "Yogyakarta's Special Status"
- "The Wallace Line Division"
- "The Torajan Death Rituals"
- "The Bajau Sea Nomads"

**Zero titles overlap Supabase records. Zero subject overlap: Indonesia geography/culture vs UK trade products.**

### `nex.brain_attractions` (32)

All Indonesian attractions with coordinates:
- Museum UGM (Yogyakarta)
- Candi Prambanan (Yogyakarta)
- Candi Sambisari (Yogyakarta)
- Museum Rudana (Bali)
- Air Terjun Sri Gethuk (Yogyakarta)
- Turtle Conservation And Education Center (Bali)

**Coordinate-tagged attraction database. Not article knowledge. No comparison meaningful with Supabase at row level.**

### Repo `data/nex-knowledge/kitchen/faqs.jsonl` (55)

UK homeowner-facing kitchen consultative FAQs:
- "Which kitchen layout suits my room?"
- "How much storage do I need in a kitchen?"
- "Which worktop is best for my budget?"
- "What cabinet door style suits a modern home?"
- "Should I choose an island or a peninsula?"
- "Which kitchen colours increase house value?"

**Category-adjacent to Supabase "NEX kitchen" (458 records) but ZERO substring/subject overlap.** Kitchen FAQs are consultative Q&A ("suits my room?") · Supabase kitchen is trade-technical ("American White Oak for Kitchen Worktops"). Different audience, different function, different logical object shape.

### Repo `data/nex-knowledge/_shared/trade-business/faqs.jsonl` (12)

Trade business-process FAQs:
- "Do I need a site visit before you can give me a price?"
- "How much deposit do you take?"
- "What warranty do you offer?"
- "What's a snagging list and when does it happen?"

**Zero subject overlap with any current Supabase category. This is trade business-process knowledge · a domain not yet covered by Supabase's product-focused corpus.**

## 4. Row-level overlap register

```
[]
```

Empty. Zero overlapping rows detected in any pair examined.

## 5. Conflict register

```
[]
```

No conflicting claims detected across substrates. (Note: Supabase `contradictions` table has 8 internal contradictions detected by `quality-checker@677` within `knowledge_records` itself · those are internal, not cross-substrate.)

## 6. Authority analysis

### Which substrate currently appears to claim authority for each domain?

| Knowledge domain | Apparent authority | Evidence |
|---|---|---|
| **UK Trade product knowledge** (doors · flooring · kitchens · staircases · balusters · handrails · risers · treads · materials · cantilever physics) | **Supabase `knowledge_records`** | 3,627 rows · status ladder · `authorised_by=Philip` for 22 rows · Truth Engine primitive (`quality-checker@677`) actively detecting contradictions · 402 rows of `knowledge_feedback` from Philip |
| **UK trade business process** (site visits · quotations · deposits · warranties · snagging) | **Repo `data/nex-knowledge/_shared/trade-business/faqs.jsonl`** (12 rows · founder-authored) | Only substrate that holds these · authored by Philip · not yet in DB |
| **UK homeowner-facing kitchen consultative Q&A** | **Repo `data/nex-knowledge/kitchen/faqs.jsonl`** (55 rows · founder-authored) | Only substrate that holds these · authored by Philip · not yet in DB |
| **UK People-Say (staircase)** | **Repo `data/nex/human-language-map.json`** (16 concepts + 6 symptoms · founder-authored) | Only substrate that holds these · Rule B enforced |
| **UK intent phrasings** | **Repo `data/nex-intent-phrasings.jsonl`** (164 · founder-authored 2026-08-03) | Only substrate that holds these · not yet in DB |
| **Indonesia accommodation business facts** | **`nex_dev.nex.business_knowledge` (accommodation vertical · 738 rows)** + `nex.accommodation_business` (9,203 rows) + `nex.accommodation_business_field_provenance` (46,306 rows) | OSM-observed facts · comprehensive per-field provenance |
| **Indonesia food business facts** | **`nex_dev.nex.business_knowledge` (food vertical · 520 rows)** + `nex.food_business` (22,757 rows) + `nex.food_business_field_provenance` (105,320 rows) | Same pattern |
| **Indonesia trivia / did-you-know** | **`nex_dev.nex.brain_did_you_know_indonesia` (39 rows)** | Only substrate · verified_source cited per row |
| **Indonesia attractions** | **`nex_dev.nex.brain_attractions` (32 rows)** | Only substrate · coordinate-tagged |
| **Programming / NEX meta concepts** | **`nex_dev.nex.concepts` + `.concept_senses`** (my 44+51) | Only substrate · seeded 2026-09-11 |
| **General English vocabulary (A1)** | **`nex_dev.nex.brain_english_vocabulary`** (30 rows) | Only substrate · CC0 licensed · 2026-08-28 |

### Multiple apparent canonical representations of the same logical object?

**No.** Every logical object has exactly one apparent authority substrate. The domains cleanly partition:

- UK Trade knowledge (Supabase) ⊥ Indonesia data (nex_dev) — disjoint
- UK homeowner FAQs (repo) ⊥ Supabase trade articles — disjoint by audience/format
- Programming concepts (nex.concepts) ⊥ UK Trade knowledge (Supabase) — disjoint by domain

### Is authority explicit or inferred?

- Supabase authority is **EXPLICIT** via `authorised_by` + `status` fields.
- Nex_dev accommodation/food authority is **EXPLICIT** via per-field provenance table with `source_tier` enum.
- Nex_dev brain_did_you_know / brain_attractions authority is **INFERRED** (schema-level canonical · no explicit authorisation field).
- Repo orphans authority is **EXPLICIT** via file-level `authored_by` metadata.
- Nex.concepts authority is **INFERRED** (schema-level canonical · status enum exists but no founder authorisation field yet).

### Does the LAM remain valid?

**YES.** Rule 15 ("physical location does not determine logical authority") is validated · not invalidated. In fact, the domain-based separation between substrates makes cross-substrate confusion architecturally unlikely for the *current* content.

## 7. Provenance analysis

### What causes the observed cross-substrate distinction?

**Independent authorship + domain separation.** The two substrates were populated by different mechanisms:

- **Supabase `knowledge_records`** was populated by `Research Claude` sessions authoring UK-trade knowledge articles · with Philip authorising the AUTHORITATIVE rows (22 of them). Origin: research-generation + founder-review workflow, 2026-08-06 onward.
- **`nex_dev.nex.business_knowledge`** was populated by `osm_replay` (OpenStreetMap crawl replay) · captured 2026-08-22 · zero founder authorship. Automated capture pipeline.
- **`nex_dev.nex.brain_did_you_know_indonesia`** was populated with `verified_source` citations per row. Automated + human-verified.
- **`nex_dev.nex.brain_attractions`** was populated from external attraction data with coordinates.
- **Repo orphans** were authored by Philip directly in 2026-07-30 and 2026-08-03.
- **`nex_dev.nex.concepts`** was seeded by Master AI Engineer 2026-09-10 through 2026-09-11.

There is **no evidence** of:
- migration between substrates (rows have distinct provenance idioms)
- generated derivatives crossing substrates
- research duplication (each substrate targets a different domain)
- synchronization (schemas differ radically · sync would require transformation)

The substrates are architecturally separate by design and by origin.

## 8. LAM impact

### Does any LAM assumption become invalidated?

**No.** All seven LAM assumptions hold.

- Assumption 1 (nex_dev + Supabase NEX-dedicated are the only two active DB substrates) — **HOLDS**
- Assumption 2 (quality-checker@677 is the only currently-running Truth Engine verifier) — **HOLDS**
- Assumption 3 (knowledge_records.status is source of truth for record authority) — **HOLDS · validated · 22 Philip-authorised · 197 AUTHORITATIVE · 2,886 DRAFT**
- Assumption 4 (human-language-map.json is the only People-Say substrate) — **HOLDS · no other People-Say found**
- Assumption 5 (row-level overlap between Supabase knowledge_records and nex_dev domain tables is UNKNOWN) — **NOW ANSWERED · zero row-level overlap**
- Assumption 6 (nex_agent.* never contains knowledge) — **HOLDS (unchanged by Path C)**
- Assumption 7 (my 44 concepts don't overlap knowledge_records at row level) — **NOW CONFIRMED · zero hits on any of 44 canonical_keys**

### Does any invalidating-evidence condition trigger?

**No.** All 8 conditions still absent.

### Does the LAM need amendment?

**No amendment required.** The LAM correctly anticipated this outcome. Path C confirms what the LAM specified as architecturally desired: one logical authority per knowledge object, with domain-based partitioning across physical substrates.

## 9. Recommended next investigation

### Is Path B still necessary?

**YES, but reduced in urgency.** Path B (deeper Supabase read) would answer questions like:

- Distribution of `knowledge_records.status` transitions (how draft-flow works)
- Themes in the 402 `knowledge_feedback` rows (what Philip has historically rejected/approved)
- Contradiction status distribution (how the 8 detections are progressing)
- Category × status × authorised_by cross-tabulation

None of these are ADR-0310 blockers. They inform *governance operations* rather than architecture. Path B can happen any time before ADR-0310 drafts a migration path for the substrate — or can be deferred if founder decides substrate stays put.

### More important next moves

Given Path C's clean finding, the more valuable next moves are:

- **D · Founder decision on Domain Knowledge unification model.** Even though there's zero row-level overlap today, the LAM still specifies "one logical authority per knowledge layer." The current state = Supabase is logical authority for UK Trades, nex_dev is logical authority for Indonesia data. Does founder want to formalise this partition in ADR-0310, or does founder want a unified Domain Knowledge substrate model?
- **E · Founder decision on orphan asset homes.** Repo orphans (`human-language-map.json` · `nex-intent-phrasings.jsonl` · kitchen/faqs.jsonl · trade-business/faqs.jsonl) have no DB home. Where should they eventually land? (This was originally LAM Q8 · Path C reinforces that these orphans are unique authorities · not duplicates.)
- **F · Founder decision on the empty English tables** (`brain_english_grammar/lesson/practice/progress`). Path C did not touch these. Their design intent still unknown.
- **G · Amendment note in ADR-0309.1** capturing Path C's finding that assumptions 3/5/7 are now confirmed and the LAM stands. (Doctrine-only append · zero SQL.)

## 10. Freeze verification

Confirmed. Path C performed exclusively read-only operations:

- ✅ No SQL writes performed against `nex_dev`.
- ✅ No writes performed against Supabase.
- ✅ No migrations run.
- ✅ No schema changes.
- ✅ No status changes.
- ✅ No authority changes.
- ✅ No deletions.
- ✅ No synchronisation.
- ✅ No copies made between substrates.
- ✅ No source-file imports.
- ✅ No modifications to repo files (except this report + evidence JSON dumps into `data/nex-english-source-map/`).
- ✅ Gate 3 remains CLOSED.
- ✅ ADR-0310 remains undrafted.
- ✅ Comprehensive freeze remains in force.

### Evidence artefacts written to disk (analysis-only · no source data modified)

- `data/nex-english-source-map/supabase-knowledge-records-metadata.json` (3,627 rows · metadata only · no body_markdown)
- `data/nex-english-source-map/nex-business-knowledge-all.json` (1,258 rows)
- `data/nex-english-source-map/nex-brain-did-you-know-indonesia-all.json` (39 rows)
- `data/nex-english-source-map/nex-brain-attractions-all.json` (32 rows)
- `data/nex-english-source-map/path-c-overlap-analysis-2026-09-11.md` (this report)

No original source in Postgres or Supabase was touched. All dumps are read-only snapshots for founder review.

## Bottom line

**The Supabase `knowledge_records` substrate is NOT a duplicate of any `nex_dev` table.**

It is a **UK Trade Knowledge Article corpus** in a distinct domain from anything currently in `nex_dev` (which holds Indonesia data + programming concepts + English vocabulary).

The initial fear of two competing canonical brains for the same content is not supported by evidence. The two substrates are cleanly separated by *domain*, not just by physical location. The LAM's rule 15 ("physical location does not determine logical authority") is validated and the partition it describes is already how the substrates operate.

**ADR-0310, when it eventually drafts, must decide:**
1. Do we formalise the current partition (Supabase = UK Trades canonical · nex_dev = Indonesia/programming canonical) in the doctrine?
2. Do we unify the substrates into a single Domain Knowledge system (physical consolidation)?
3. Do we introduce a logical-authority router that resolves the correct substrate per query without moving data?

All three are architecturally valid. Founder decides.

Freeze remains in force. Path C complete.

---

**End of Path C · Cross-Substrate Overlap Analysis.**
