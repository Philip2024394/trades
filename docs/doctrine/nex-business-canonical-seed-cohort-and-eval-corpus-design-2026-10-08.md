# NEX Business Canonical · Seed Cohort + Eval Corpus · Joint Design Artifact

**Status · DESIGN ARTIFACT ONLY · READ-ONLY**
**Authority · founder-authorised 2026-10-08 as Deliverable C of the 169-prerequisite wave**
**Scope · the FRAMEWORK + SCHEMAS for the seed cohort and the evaluation corpus**
**NOT in scope · actual seed curation · actual pair labelling · any migration file · any DB mutation · any resolver execution**

This document defines the shape of two deliberately-coupled artifacts that must land BEFORE Migration 169 can be authored:

1. a **50–100 row seed cohort** of high-confidence canonical business/place entities, deliberately selected to exercise every one of the 10 resolver-risk categories from sealed Rule 5i
2. an **evaluation corpus** of founder/admin-labelled pairs (starting 200 positive + 200 negative/ambiguous) that measures the resolver against the sealed Rule 5j gates

The two artifacts are coupled because the seed cohort is the single most useful source of positive-pair candidates for the eval corpus. Designing them separately would risk two schemas that later need reconciliation.

---

## 1 · Why these two artifacts exist together

**Seed cohort purpose.** Give the resolver a non-empty, deliberately diverse pool to measure against. Rule 5g's "warm-pool" architecture requires that `nex.business_canonical` contain real entities BEFORE the resolver runs over any legacy backfill. Without the seed cohort, the first-pass resolver scores every legacy row against an empty pool → every row verdicts NO_MATCH → ~59,596 canonicals created in one shove, which is exactly the Rule 5g-forbidden "take 35,900 records and shove them into the new table" failure mode.

**Eval corpus purpose.** Measure the resolver's precision, recall, false-merge rate, and abstention behaviour against founder-labelled ground truth · gate Migration 169 authoring on the sealed Rule 5j thresholds · ensure §10 compliance survives at scale.

**Why joint.** Positive pairs come most naturally from the seed cohort: "which legacy rows should MATCH this seed?" is a tractable labelling question. Negative pairs come from "same-city same-category rows that must NOT merge." Ambiguous pairs come from the §10 boundary (0.55-0.85 score range, same-name different-owner, etc.). The seed cohort anchors all three.

---

## 2 · What this artifact is NOT

- **Not actual seed data.** No concrete rows are selected here. The curation workflow runs separately under a different authorisation.
- **Not actual eval labels.** No pairs are labelled here. The labelling workflow runs separately under a different authorisation.
- **Not code.** No resolver runner, no fixture-loader, no candidate-generator script.
- **Not migration 170.** The `nex.business_evidence` table shape is sealed in Rule 5k's reorder; this document does not propose that schema.
- **Not migration 169.** Rule 5m requires 7 proofs before 169 can be authored; this document is prerequisite work for proofs #1 and #2.
- **Not a DB connection.** Zero live DB queries are implied by this document. Candidate selection reads legacy table shapes from committed migration files; it does NOT read live data.

---

## 3 · Seed cohort selection framework

### 3.1 · The 10 resolver-risk categories (Rule 5i verbatim)

Every seed must map to at least one category. The cohort must deliberately include seeds that cover every category. Easy examples alone are not acceptable.

| # | Category | What it exercises |
|---|---|---|
| **R1** | Proven live accommodation records | Baseline · currently served by Phase 27 `/api/nex/directory` · identity is well-formed and already publicly displayed |
| **R2** | OSM / Wikidata-linked entities | External identity signals (`osm_id`, `wikidata_qid`) that give the resolver strongest MATCH confidence |
| **R3** | Duplicate-source representations | Same real business seen by multiple ingestion cycles · tests `source_reference` dedup logic |
| **R4** | Same-name different-owner cases | The §25 forced-AMBIGUOUS pattern · chain-franchise or namesake businesses |
| **R5** | Cross-vertical sibling names | Hotel + restaurant at the same address · tests `entity_type` partitioning in the resolver pool |
| **R6** | Thin-evidence records | Name-only · no phone / website / coordinates · tests the §10 "never fabricate identity" guard |
| **R7** | Intra-source duplicates | e.g. the 401 `(source, source_reference)` conflict groups in `nex.food_business` per migration 114 |
| **R8** | Website-present + website-absent | Both branches · website is a strong identity signal when present and must be absent-tolerant when missing |
| **R9** | Transliteration / name-variation | Latin, Bahasa, Chinese, Arabic variants of the same name · tests `nex.name_norm()` + alias handling |
| **R10** | Geographic collision | Same-city same-category different-owner · tests coordinates vs name disambiguation |

**Coverage requirement.** Every one of R1–R10 must have ≥ 3 seeds in the cohort. 50-seed minimum × 10 categories = at least 3 per category after natural overlap. The target 100-seed upper bound allows ≥ 5 per category plus overlap breathing room.

### 3.2 · High-confidence ranking criteria per category

A seed is "high-confidence" when its identity is unambiguous enough that a founder/admin can confirm the canonical identity by inspection. The criteria differ by category:

| Category | High-confidence criteria |
|---|---|
| **R1** | `claim_status='listed'` on `nex.accommodation_business` · currently rendered by Phase 27 with no complaints · `last_verified_at` within 12 months |
| **R2** | At least one of `osm_id` resolvable to a current OSM element AND/OR `wikidata_qid` resolvable to a current Wikidata item · identity signals from two independent sources |
| **R3** | Two or more legacy rows with the same `source_reference` AND the same normalised phone or normalised website apex · verifiably the same business across cycles |
| **R4** | Two or more candidate rows share `name_norm` + `city` but differ on `owner_nex_id` OR phone E.164 OR website apex OR coordinates > 500 m apart · the §25 pattern |
| **R5** | A single real-world address or coordinate pair that hosts both an `entity_type='accommodation'` row AND an `entity_type='food'` row (e.g. a hotel with a restaurant) |
| **R6** | Legacy row with `business_name` populated but `phone IS NULL AND website IS NULL AND coordinates_lat IS NULL` · requires inclusion as a hard test · high confidence here means "the seed is this thin, deliberately" |
| **R7** | Food rows that appear in the 401 pre-existing `(source, source_reference)` conflict groups per migration 114 header |
| **R8** | At least 50% website-present and 50% website-absent across the cohort · absolute per-seed criterion is whichever branch is being tested |
| **R9** | A seed with ≥ 2 populated aliases where the alias is a transliteration variant of `name_canonical` (e.g. "Jiǔdiàn" ↔ "Hotel" ↔ "Hotél") |
| **R10** | A pair of seeds at different coordinates in the same city with the same `name_norm` + `entity_type` but different owners · tests the location vs name signal weighting |

### 3.3 · Provenance + approval metadata per seed

Every seed carries full provenance so an audit of the eval results can trace back to who approved what and why.

**Required metadata fields (every seed record):**

- `seed_id` — stable identifier, format `seed-YYYY-MM-DD-NNNN` zero-padded
- `created_by` — founder OR admin handle (not an automated generator)
- `created_at` — ISO-8601 timestamp
- `approved_by` — founder (every seed requires founder-level approval)
- `approved_at` — ISO-8601 timestamp
- `legacy_source_table` — the `nex.*` table the identity came from (if any)
- `legacy_source_ref` — the specific `public_listing_ref` or `internal_id`
- `risk_categories` — array of R1–R10 the seed is deliberately exercising
- `high_confidence_rationale` — free-text explanation of why this seed is high-confidence per the §3.2 criteria
- `notes` — free-text additional context

**No seed enters the cohort without `approved_by = 'founder'`.** Semi-automated candidate suggestions (e.g. "here are 20 R2-category OSM+Wikidata-linked candidates") are permitted as a FEEDER into the approval workflow, but they are not seeds until explicitly approved.

### 3.4 · Seed cohort data file schema

**File path · `tests/fixtures/canonical/seed-cohort-v1.jsonl`** (one JSON object per line).

**Record shape:**

```json
{
  "seed_id": "seed-2026-10-08-0001",
  "entity_type": "accommodation",
  "country": "ID",
  "identity": {
    "name_canonical": "<human-readable business/place name>",
    "aliases": ["<alias 1>", "<alias 2>"],
    "phone_e164": "+6281234567890" | null,
    "website_apex": "example.com" | null,
    "osm_id": "node/12345" | null,
    "wikidata_qid": "Q42" | null,
    "city": "Yogyakarta",
    "district": "Umbulharjo" | null,
    "coordinates": { "lat": -7.7971, "lng": 110.3708 } | null,
    "address_jsonb": { "line1": "...", "postal_code": "..." } | null
  },
  "legacy_source": {
    "table": "nex.accommodation_business",
    "public_listing_ref": "#AC-2026-00123",
    "internal_id": "<uuid>"
  },
  "risk_categories": ["R1", "R2"],
  "high_confidence_rationale": "Phase 27 rendered live since 2026-09; OSM node tag + Wikidata QID both resolve; phone verified E.164",
  "provenance": {
    "created_by": "admin:ops",
    "created_at": "2026-10-08T14:22:00+07:00",
    "approved_by": "founder",
    "approved_at": "2026-10-08T15:01:00+07:00",
    "selection_source": "Phase 27 listed accommodation query 2026-10-08",
    "notes": ""
  }
}
```

**Invariants:**
- `seed_id` globally unique inside the file
- `entity_type` must be one of the sealed 9 values from migration 167 · abstentions per Rule 5l stay OUT of the seed cohort
- `country` must match the migration 167 regex `^[A-Z]{2}$`
- `identity.phone_e164` if present must match `^\+[1-9][0-9]{6,14}$`
- `identity.wikidata_qid` if present must match `^Q[0-9]+$`
- `provenance.approved_by` must be `"founder"`
- A seed with no `legacy_source` is permitted only for synthetic test cases (R6 thin-evidence edge cases, R9 transliteration constructed cases); such seeds must declare `legacy_source: null` explicitly and the `notes` field must explain the synthetic rationale

**File lifecycle:**
- Versioned by name (`seed-cohort-v1.jsonl`, future `v2`, etc.) · never overwritten in place
- Committed to git · reviewable in PR
- When loaded into `nex.business_canonical` for the warm-pool pass, every row will carry a provenance trail back to this file (mechanism TBD in the seed-loading authorisation; outside this document's scope)

---

## 4 · Eval corpus structure

### 4.1 · Three category files

The corpus is split across THREE JSONL files to preserve label-class separation:

| File | Label class | Starting target | Expansion target |
|---|---|---|---|
| `tests/fixtures/eval/entity-pair-corpus-positive.jsonl` | `MATCH` (same real business across both sides of the pair) | 200 | 500 (if measurement requires) |
| `tests/fixtures/eval/entity-pair-corpus-negative.jsonl` | `NO_MATCH` (verifiably different real businesses despite overlap) | 200 | 500 (if measurement requires) |
| `tests/fixtures/eval/entity-pair-corpus-ambiguous.jsonl` | `AMBIGUOUS` (genuinely cannot be decided from the evidence) | ~50 (not a hard start target) | 100-150 |

The ambiguous file is smaller because its purpose is to measure the resolver's abstention correctness (soft gate ≥ 80%) rather than to drive precision/recall. 50 ambiguous pairs is enough to measure abstention within ±5%.

### 4.2 · Pair record schema (same across all three files)

```json
{
  "pair_id": "pair-2026-10-08-pos-0001",
  "label": "MATCH",
  "left": {
    "source_kind": "seed_cohort" | "legacy_table" | "synthetic",
    "source_ref": "seed-2026-10-08-0001" | "#AC-2026-00123" | "synthetic-R6-0001",
    "identity_snapshot": {
      "name_canonical": "...",
      "aliases": ["..."],
      "phone_e164": "..." | null,
      "website_apex": "..." | null,
      "osm_id": "..." | null,
      "wikidata_qid": "..." | null,
      "country": "ID",
      "city": "...",
      "district": "..." | null,
      "coordinates": { "lat": ..., "lng": ... } | null
    }
  },
  "right": {
    "source_kind": "...",
    "source_ref": "...",
    "identity_snapshot": { "...same shape..." }
  },
  "candidate_source": {
    "generator": "wikidata_qid_overlap" | "trigram_prefilter" | "founder_manual" | "admin_manual" | "synthetic_r4_namesake" | "synthetic_r5_cross_vertical" | "synthetic_r9_transliteration",
    "generated_at": "2026-10-08T10:00:00+07:00",
    "notes": "optional free-text rationale for how this pair was generated"
  },
  "label_decision": {
    "label": "MATCH",
    "rationale": "Both sides carry Wikidata Q12345. Phone E.164 identical. Confirmed by founder review.",
    "labelled_by": "founder",
    "labelled_at": "2026-10-08T16:30:00+07:00",
    "label_version": 1,
    "superseded_by_pair_id": null
  },
  "risk_categories_exercised": ["R2", "R3"],
  "notes": ""
}
```

### 4.3 · Candidate generation — a FEEDER, NOT ground truth

**Rule 5i verbatim: "Semi-automated OSM/Wikidata candidate pair GENERATION is permitted (positives inferred from shared QID). Semi-automated labels MUST NOT silently become ground truth."**

Candidate generators propose pairs for human review · they never set `label_decision.label`. The following generators are enumerated for provenance purposes · each produces candidate pairs that enter the labelling queue, not the corpus directly:

| Generator | What it proposes | Why it is NOT ground truth |
|---|---|---|
| `wikidata_qid_overlap` | Two legacy rows that share a Wikidata QID → positive candidate | Different OSM imports may tag the same QID on different real places by error · requires human verification |
| `trigram_prefilter` | Two legacy rows with name_norm trigram similarity > 0.6 → mixed candidates (positive, negative, or ambiguous — unknown until labelled) | Trigram collisions are frequent in franchise names and transliterations |
| `founder_manual` | A founder-nominated pair (via a review UI or inline note) | Still requires explicit `label_decision.labelled_by = "founder"` for traceability — the nomination itself is a candidate, the label is separate |
| `admin_manual` | An admin-nominated pair | Admin can propose; final label requires admin sign-off recorded in `label_decision.labelled_by` |
| `synthetic_r4_namesake` | A constructed R4 same-name-different-owner pair | Synthetic pairs are permitted only for categories R4, R5, R6, R9, R10 where real-data collisions are rare but must be exercised |
| `synthetic_r5_cross_vertical` | A constructed R5 cross-vertical pair | Same rule as R4 |
| `synthetic_r9_transliteration` | A constructed R9 transliteration pair | Same rule as R4 |

**Hard rules:**
- `candidate_source.generator` is required on every pair · tells the audit how this pair arrived in the labelling queue
- `label_decision.labelled_by` MUST be `"founder"` OR `"admin:<handle>"` · never `"wikidata_qid_overlap"` or any generator name
- Semi-automated candidate generation can run as a batch script, but the output lands in a labelling queue, not in `*-corpus-{positive,negative,ambiguous}.jsonl` directly

### 4.4 · The labelling workflow (ground truth gate)

1. Candidate generators (or founder/admin manually) propose pairs → a labelling queue
2. Founder or admin reviews each pair · sets `label_decision.label` + `rationale` + their own identity in `labelled_by`
3. Labelled pair is written to the appropriate corpus file (positive / negative / ambiguous)
4. If a label is later revised, a new pair record is written with `label_version: 2` and the old record's `superseded_by_pair_id` field points at the new `pair_id` · old records are NEVER mutated in place

**Immutability:** once committed to the corpus, a pair's `label_decision` is append-only via supersession · never overwritten.

---

## 5 · Positive-pair generation from seed cohort × legacy

This is the most productive source of positive pairs and the single strongest reason the two artifacts are co-designed.

**The pattern:** for each seed in the cohort, identify legacy rows that SHOULD match it. Each such match is a positive pair candidate.

**Workflow:**

1. Pick a seed (e.g. `seed-2026-10-08-0017` · a R2 OSM+Wikidata-linked accommodation in Ubud)
2. Query legacy tables (READ-ONLY · outside this document's authorisation) for rows that COULD match on identity signals
3. For each candidate legacy row, propose a pair `(seed_identity, legacy_identity)` with `candidate_source.generator = "trigram_prefilter"` or `"wikidata_qid_overlap"`
4. Founder/admin reviews each proposed pair · labels MATCH (positive corpus), NO_MATCH (negative corpus), or AMBIGUOUS (ambiguous corpus)

**Benefit over labelling in a vacuum:** the seed anchors each pair in a concrete real-world entity · the labeller does not have to adjudicate "what IS this?" first · only "is THIS legacy row the same real-world thing?"

**Negative-pair generation from the cohort:** for each seed with a R4 (same-name different-owner) or R10 (geographic collision) role, generate pairs against legacy rows that share name_norm + city but differ on phone / website / coords / owner. These are high-value negatives because they live on the §25 forced-AMBIGUOUS boundary.

**Ambiguous-pair generation from the cohort:** for each R6 (thin-evidence) seed, generate pairs against legacy rows that share only name_norm. These are the §10 abstention test cases.

---

## 6 · Corpus size trajectory

**Start: 200 positive + 200 negative + ~50 ambiguous.**

- 200 positive at ≥ 3 per R1–R10 category · 20 per category baseline leaves room for category concentration where real data is dense (R1 live accommodation can carry many pairs; R6 synthetic thin-evidence needs fewer)
- 200 negative distributed so that R4 (same-name different-owner) and R10 (geographic collision) each have ≥ 40 pairs — these are the two highest false-merge risk patterns
- 50 ambiguous distributed across R6, R9, and the §10 boundary zone

**Expansion to 500+500 is permitted ONLY if measurement requires it:**

A measurement run against the 200+200 corpus falls into one of three outcomes:

| Outcome | Expansion decision |
|---|---|
| HARD gates pass (false-merge ≤ 1% AND precision ≥ 98%) · SOFT gates pass or acceptable | **No expansion required.** 200+200 is sufficient. Proceed to Migration 170 authoring. |
| HARD gates pass · one or both SOFT gates fail (recall < 70% OR abstention < 80%) | **Measured expansion.** Add 50-100 pairs targeted at the soft-gate failure mode (more positives for recall, more labelled-ambiguous for abstention). Re-measure. |
| Any HARD gate fails | **Expansion will not fix a HARD-gate failure.** The resolver is not yet gated-ready. Response is to review resolver scoring or threshold interpretation · NOT to add corpus pairs hoping metrics change. See Rule 5j: no threshold relaxation. |

The 500+500 upper bound is a budget estimate · the actual expansion target may be smaller if targeted additions suffice.

---

## 7 · Provenance invariants

Every evaluation result must be auditable back to:
- the specific pairs that produced it (pair_ids)
- the specific labels that defined ground truth (`label_decision`)
- the specific humans who approved those labels (`labelled_by`)
- the specific generators that originally proposed each candidate (`candidate_source`)

**Required invariants:**

- Every pair in the corpus files has a non-null `candidate_source.generator`
- Every pair has a non-null `label_decision.labelled_by` ∈ {`founder`, `admin:<handle>`}
- Every label revision is append-only via `label_version` + `superseded_by_pair_id` · never in-place mutation
- Every measurement run records the file commit hash of the three corpus files it measured against · reproducibility is a hard requirement
- The seed cohort file `seed-cohort-v1.jsonl` has a `provenance.approved_by = "founder"` on every record

**What this enables:** when the resolver measurement is reported in the Rule 5m evidence report, every number can be traced to a specific set of labelled pairs; every pair can be traced to a specific labelling decision; every labelling decision can be defended as founder/admin-approved ground truth.

---

## 8 · The handoff pipeline (seed → corpus → measurement → report → 170 → 169)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Seed cohort curated                                        │
│    · 50-100 rows                                              │
│    · covers R1-R10                                            │
│    · approved_by: founder                                     │
│    · lives at tests/fixtures/canonical/seed-cohort-v1.jsonl   │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Seed cohort loaded into nex.business_canonical             │
│    · via bounded prerequisite migration or data script        │
│    · AUTHORISED SEPARATELY · outside this document            │
│    · gives the resolver a WARM pool for measurement           │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Eval corpus labelled                                       │
│    · 200+ positive · 200+ negative · ~50 ambiguous            │
│    · from seed × legacy pair generation (§5)                  │
│    · founder/admin labels only                                │
│    · lives at tests/fixtures/eval/*.jsonl                     │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Resolver measurement run                                   │
│    · entity-universe/identity-matching.ts matchBusiness()     │
│    · against each pair in the corpus                          │
│    · computes precision · recall · false-merge · abstention   │
│    · AUTHORISED SEPARATELY · outside this document            │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Measurement against Rule 5j gates                          │
│    · false-merge ≤ 1% HARD                                    │
│    · precision ≥ 98% HARD                                     │
│    · recall ≥ 70% SOFT                                        │
│    · abstention ≥ 80% SOFT on labelled-ambiguous              │
│    · NO threshold relaxation permitted                        │
└───────────────────────────┬──────────────────────────────────┘
                            │
                   gates pass?
                   /          \
                NO             YES
                 │              │
     expand corpus              ▼
     per §6 OR                ┌──────────────────────────────┐
     review resolver          │ 6. Rule 5m evidence report   │
     scoring                   │    produced · 7 proofs       │
                              └───────────────┬──────────────┘
                                              │
                                              ▼
                              ┌──────────────────────────────┐
                              │ 7. Migration 170             │
                              │    (nex.business_evidence)   │
                              │    AUTHORED                  │
                              │    AUTHORISED SEPARATELY     │
                              └───────────────┬──────────────┘
                                              │
                                              ▼
                              ┌──────────────────────────────┐
                              │ 8. Migration 170 APPLIED     │
                              │    (deployment window)       │
                              │    AUTHORISED SEPARATELY     │
                              └───────────────┬──────────────┘
                                              │
                                              ▼
                              ┌──────────────────────────────┐
                              │ 9. Migration 169             │
                              │    (nex_legacy_canonical_    │
                              │     backfill)                │
                              │    AUTHORED                  │
                              │    AUTHORISED SEPARATELY     │
                              └───────────────┬──────────────┘
                                              │
                                              ▼
                              ┌──────────────────────────────┐
                              │ 10. Migration 169 APPLIED    │
                              │     (deployment window)      │
                              │     AUTHORISED SEPARATELY    │
                              │     warm-pool backfill       │
                              │     against the full 59,596+ │
                              │     legacy corpus            │
                              └──────────────────────────────┘
```

**Steps 2, 4, 7, 8, 9, 10 each require their own founder authorisation.** This document does not authorise any of them. The handoff is linear and gated at every joint.

---

## 9 · Boundary summary (what this document does, and does not)

**This document DOES:**

- Define the seed cohort file schema at `tests/fixtures/canonical/seed-cohort-v1.jsonl`
- Define the three eval corpus file schemas at `tests/fixtures/eval/entity-pair-corpus-{positive,negative,ambiguous}.jsonl`
- Define the 10 risk categories and the per-category high-confidence criteria
- Define the provenance and approval metadata invariants
- Define the semi-automated candidate generators as a FEEDER, not a ground-truth source
- Define the 200+200+~50 starting corpus target and the expansion rule
- Define the handoff pipeline from seed to Migration 169 apply

**This document does NOT:**

- Select any actual seed row
- Label any actual pair
- Author any migration file (166 FROZEN, 167 FROZEN, 168 empty, 169/170 not authored)
- Open any DB connection
- Execute the resolver against any legacy row
- Author the seed-loading mechanism (migration or data script)
- Author the resolver measurement runner
- Author the Rule 5m evidence report (that comes AFTER measurement passes gates)

The next concrete bounded step inside the wave — curating the first actual seed records or labelling the first actual pairs — requires its own founder authorisation.
