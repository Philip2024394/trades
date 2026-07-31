---
title: NEX Router Validation Suite v1
version: 1.0
status: CANONICAL SPECIFICATION · NOT CODE · TO BE EXPANDED WITH REAL USER QUESTIONS
created: 2026-07-31
authored_by: Philip O'Farrell (schema + starter corpus) · composed by Gatekeeper
composes_with:
  - NEX-KNOWLEDGE-ARCHITECTURE-STANDARD-v1.md (Part 7.4 · four-failure test corpus)
  - nex-governance-ruling-2026-07-31-ten-router-diagnostic-failures-five-six-purchase-quote-service-intents-estimator-brain.md (six-failure test corpus)
  - nex-research-brief-2026-07-31-reasoning-and-retrieval-framework-for-question-router-build.md (Phase 2 research)
purpose: |
  Specification for validating the five-dimension Question Router.
  Not code · a specification that any Router implementation must satisfy.
  Starter corpus of 6 real questions (Philip's authored expected values).
  Expand to 100 · then 500 real user questions.
  When the Router passes this suite, it has proven it can think its way to the right evidence.
governance_note: |
  Per Philip's directive: "I would avoid adding more governance for its own sake."
  This file is a WORKING SPECIFICATION · not another governance ruling.
  Format is intentionally lean: table + schema + growth plan.
---

# NEX Router Validation Suite v1

**Purpose:** validate that the five-dimension Question Router can consistently map real user questions to the correct evidence — not the closest keyword match.

**When this suite passes consistently, the Router has proved it can THINK its way to the right evidence.**

---

## Schema

Each row in the suite is a real user question and the expected Router resolution across five dimensions plus a Clarify decision and the Evidence used.

| Field | Purpose |
|---|---|
| **User Question** | Real user query · verbatim |
| **Expected Intent** | Intent dimension (Learn · Browse · Buy · Compare · Quote · Service · etc.) |
| **Expected Subject** | Subject dimension (Staircase · Newel · Timber · etc.) |
| **Expected Brain** | Brain dimension (Staircase · Materials · Estimator · etc.) |
| **Expected Domain** | Knowledge Domain dimension (Classification · Reference Gallery · Components · Pricing · etc.) |
| **Expected Info Type** | Information Type dimension (Types · Images · Dimensions · Options · Cost · etc.) |
| **Clarify?** | Yes / No / Maybe — should Router respond with clarifying questions rather than direct answer? |
| **Evidence Used** | Which artefacts the Router selected (✓ used · ✗ NOT used but keyword-related · shown per row when populated) — **debugging column · explains WHY the Router produced the answer** |
| **Pass/Fail** | Populated when a Router implementation is tested against the row · on Fail also carries a **Failure Code** (see §Failure Code Taxonomy below) |

---

## Runtime Contract (authored by Philip · governs every user query)

Retrieval is NOT allowed before classification completes. Every user query must flow through this contract:

```
User Question
      │
      ▼
CLASSIFY
      │
      ├── Intent
      ├── Subject
      ├── Brain
      ├── Domain
      ├── Information Type
      └── Confidence
      │
      ▼
IF confidence < threshold
      │
      ├── Ask clarifying question
      │
      └── STOP
      │
ELSE
      │
      ▼
Retrieve Evidence
      │
      ▼
Compose Response
```

**Why this contract exists:** all six diagnosed Router failures share one root cause — retrieval ran before classification was complete. This contract makes that failure mode structurally impossible. A Router implementation that violates the contract fails automatically regardless of accuracy on individual dimensions.

---

## Starter Corpus (v1 · 6 rows · authored by Philip)

| User Question | Expected Intent | Expected Subject | Expected Brain | Expected Domain | Expected Info Type | Clarify? | Evidence Used | Pass/Fail |
|---|---|---|---|---|---|---|---|---|
| What type of staircase? | Learn | Staircase | Staircase | Classification | Types | No | *populated when tested* |  |
| Straight flight oak staircase images | Browse | Straight flight | Staircase | Reference Gallery | Images | No | *populated when tested* |  |
| What size newel post? | Learn | Newel post | Staircase | Components | Dimensions | No | *populated when tested* |  |
| What woods are available? | Learn | Timber | Materials | Species | Options | No | *populated when tested* |  |
| Need staircase | Buy | Staircase | Staircase | Sales | Inquiry | Yes | *populated when tested* |  |
| How much for straight flight stairs? | Quote | Straight flight | Estimator/Staircase | Pricing | Cost | Maybe | ✓ Pricing KB · ✓ Straight Flight Profile · ✓ Estimating Guide  //  ✗ Sweeping Stair Profile · ✗ Timber Knots · ✗ Installation Workflow |  |

**Evidence Used format:** `✓` marks artefacts the Router selected · `✗` marks keyword-related artefacts the Router deliberately did NOT select. Enables debugging of Router decisions.

---

## R005 Info-Type Class Coverage (Philip 2026-07-31 · added for Build 0.02)

Build 0.01 diagnosed R005 (Wrong Information Type) as the dominant failure with 4 cases. Rather than target one sentence, target R005 as a CLASS. The following 10 rows authored by Philip specifically test the Information Type dimension across buy/enquire/browse/learn intents:

| User Question | Expected Intent | Expected Subject | Expected Brain | Expected Domain | Expected Info Type | Clarify? | Evidence Used | Pass/Fail |
|---|---|---|---|---|---|---|---|---|
| Need staircase | Buy | Staircase | Staircase | Sales | Inquiry | Yes | *populated when tested* |  |
| Looking for stairs | Buy | Staircase | Staircase | Sales | Inquiry | Yes | *populated when tested* |  |
| Can I buy stairs? | Buy | Staircase | Staircase | Sales | Inquiry | Yes | *populated when tested* |  |
| Want oak stairs | Buy | Staircase | Staircase | Sales | Inquiry | Maybe | *populated when tested* |  |
| Need quote | Quote | Staircase | Staircase | Pricing | Pricing | Maybe | *populated when tested* |  |
| How much? | Quote | Staircase | Staircase | Pricing | Pricing | Yes | *populated when tested* |  |
| Show me images | Browse | Staircase | Staircase | Reference Gallery | Gallery | No | *populated when tested* |  |
| Different staircase types | Learn | Staircase | Staircase | Classification | Classification | No | *populated when tested* |  |
| What is a newel? | Learn | Newel post | Staircase | Components | Definition | No | *populated when tested* |  |
| What size newel? | Learn | Newel post | Staircase | Components | Dimensions | No | *populated when tested* |  |

**Rationale (Philip's authored guidance):** *"If Build 0.02 learns this class well, you'll probably reduce several failures at once instead of fixing one sentence."*

---

## Visual + Consultation Class Coverage (Philip 2026-07-31 · added for Build 0.04)

Three new intent classes surfaced during Router testing: **See** (visual intent — user wants images not definitions), **Consult** (customer wants a personalised recommendation · triggers clarifying-questions-first pattern), and correct handling of **Newel cap** as a subject distinct from Newel post.

| User Question | Expected Intent | Expected Subject | Expected Brain | Expected Domain | Expected Info Type | Clarify? | Evidence Used | Pass/Fail |
|---|---|---|---|---|---|---|---|---|
| Can I see what a stair tread looks like? | See | Tread | Staircase | Components | Visual | No | *populated when tested* |  |
| Can I see what a newel cap looks like? | See | Newel cap | Staircase | Components | Visual | No | *populated when tested* |  |
| What different options have you in newel caps? | Browse | Newel cap | Staircase | Reference Gallery | Options | No | *populated when tested* |  |
| Which type of staircase can fit my stairwell opening? | Consult | Staircase | Staircase | Recommendation | Recommendation | Yes | *populated when tested* |  |
| I need help finding the cheapest but best staircase | Consult | Staircase | Staircase | Recommendation | Recommendation | Yes | *populated when tested* |  |
| Is the landing balcony included in the staircase price? | Learn | Landing | Staircase | Scope of Work | Function | No | *populated when tested* |  |

**Rationale (Philip's authored guidance):** *"Whenever someone asks 'what does X look like?' or 'can I see X?', NEX should automatically present a labelled image or gallery before giving the explanation."* And: *"Consultation queries should trigger clarifying-questions-first (measurements · material · location) rather than returning a generic definition."*

---

## Comparison + Multi-intent Class Coverage (Philip 2026-07-31 · added for Build 0.05)

Two ★★★★★ priority failure classes per Philip's roadmap guidance. Comparison queries use "or" / "vs" / "compare" between options · Multi-intent queries combine Visual + Component + Material in a single query · Attribute extraction handles specifiers like "white oak" / "painted" / "curved".

| User Question | Expected Intent | Expected Subject | Expected Brain | Expected Domain | Expected Info Type | Clarify? | Evidence Used | Pass/Fail |
|---|---|---|---|---|---|---|---|---|
| Glass or oak balustrades? | Compare | Balustrade | Staircase | Design Languages | Comparison | No | *populated when tested* |  |
| Compare cut string vs closed string | Compare | String | Staircase | Design Languages | Comparison | No | *populated when tested* |  |
| Which is better, oak or walnut treads? | Compare | Tread | Staircase | Design Languages | Comparison | No | *populated when tested* |  |
| Can I see oak stair treads? | See | Tread | Staircase | Components | Visual | No | *populated when tested* |  |
| White oak stair treads | Learn | Tread | Staircase | Components | Definition | No | *populated when tested* |  |
| Oak staircase with glass balustrade | Learn | Staircase | Staircase | Components | Definition | No | *populated when tested* |  |

**Rationale (Philip's authored guidance):** *"The next gains are likely to come less from adding new subjects and more from handling richer combinations of subject, intent and metadata in a consistent way."*

---

## Curiosity + Reality + Confused Class Coverage (Philip 2026-07-31 · added for Build 0.06)

The pieces of Philip's authored Thinking Mode architecture that can be tested today without triggering the full v2 build:

- **Why / Understanding** — user asks for reasoning, not lookup ("Why does...", "Why is...", "Why can't...")
- **Reality Check** — user tests an assumption ("Can every staircase float?", "Can I fit a staircase myself?")
- **Confused state** — user names their confusion ("I'm confused about...", "I don't understand the difference")
- **Diagnostic** — user reports a symptom ("My staircase squeaks", "Why is there a gap?")

| User Question | Expected Intent | Expected Subject | Expected Brain | Expected Domain | Expected Info Type | Clarify? | Evidence Used | Pass/Fail |
|---|---|---|---|---|---|---|---|---|
| Why are stair strings so thick? | Why | String | Staircase | Engineering | Reasoning | No | *populated when tested* |  |
| Why is a newel post so large? | Why | Newel post | Staircase | Engineering | Reasoning | No | *populated when tested* |  |
| Why do staircases squeak? | Why | Staircase | Staircase | Engineering | Reasoning | No | *populated when tested* |  |
| Can every staircase be floating? | Reality | Staircase | Staircase | Reality Check | Reality | No | *populated when tested* |  |
| Can I fit a staircase myself? | Reality | Staircase | Staircase | Reality Check | Reality | Maybe | *populated when tested* |  |
| I'm confused about strings | Confused | String | Staircase | Teaching | Definition | Yes | *populated when tested* |  |
| What's the difference between a string and a skirt? | Compare | String | Staircase | Design Languages | Comparison | No | *populated when tested* |  |
| My staircase squeaks | Diagnostic | Staircase | Staircase | Troubleshooting | Diagnosis | No | *populated when tested* |  |

**Rationale (Philip's authored insight · full Thinking Mode architecture preserved separately as Standard v2 candidate):** *"Intent decides what the user wants. Thinking mode decides how NEX should solve the problem. A human staircase expert doesn't use the same mental process for every question."*

---

## Concept Resolution Class Coverage (Philip 2026-07-31 · added for Build 0.07)

Customers rarely know exact technical vocabulary. They describe by function · location · appearance. Router needs Subject Intelligence (`homeowner_terms` field in addition to aliases) to resolve descriptive queries to canonical subjects. Full Brain Evolution architecture preserved separately as v2 candidate.

| User Question | Expected Intent | Expected Subject | Expected Brain | Expected Domain | Expected Info Type | Clarify? | Evidence Used | Pass/Fail |
|---|---|---|---|---|---|---|---|---|
| What's that big wooden post at the bottom? | Learn | Newel post | Staircase | Components | Definition | No | *populated when tested* |  |
| The piece you hold going up | Learn | Handrail | Staircase | Components | Definition | No | *populated when tested* |  |
| The flat bit you stand on | Learn | Tread | Staircase | Components | Definition | No | *populated when tested* |  |
| The vertical piece between steps | Learn | Riser | Staircase | Components | Definition | No | *populated when tested* |  |
| The side of the staircase | Learn | String | Staircase | Components | Definition | No | *populated when tested* |  |

**Rationale (Philip's authored insight):** *"These aren't alias failures. They're concept failures. The user doesn't know the vocabulary. Subject ≠ Word. Your router currently thinks Word → Subject. I think it needs Description → Concept → Subject."*

---

## Growth Model (Philip's authored ladder · revised 2026-07-31)

- **v1** — **6 diagnostic questions** (this file · starter corpus · the six Router failures)
- **v2** — **100 representative questions** (broad Intent × Subject coverage)
- **v3** — **1,000 questions** (comprehensive coverage across every brain and domain)
- **v4** — **7,000 existing staircase questions** (derived from the existing authored Q&A corpus · see Two-Group Corpus Structure below)
- **v5** — **Live production questions** (after launch · new questions Nex hasn't seen before · measures Router **generalisation** vs matching known examples)

Each row is EVIDENCE (permanent) — the expected routing values are the ground truth against which Router implementations are measured.

**Why this matters (Philip's authored framing):** instead of saying *"The Router feels better"*, you can say *"The Router passes 482 of 500 tests."* Measurable · not intuitive.

---

## Two-Group Corpus Structure (Philip 2026-07-31)

### Group 1 — Existing Knowledge Questions (already authored)

Questions Philip has already answered in the Knowledge Base / Customer FAQ / Type Profiles / Glossary. Examples:

- *"What is a straight flight staircase?"*
- *"What size newel post?"*
- *"What woods are available?"*
- *"How long does installation take?"*
- *"Can I carpet oak stairs?"*
- *"What's the difference between cut string and closed string?"*
- *"How many balusters per tread?"*
- *"What is a kite winder?"*
- *"How much headroom is required?"*

**All ~7,000 lines of existing Q&A should become Router tests.** Purpose: baseline correctness on questions with known-good answers.

### Group 2 — Live Production Questions (future · after launch)

Real user questions Nex hasn't been exposed to yet. Examples of the pattern (from Philip):

- *"Need staircase"* · *"Want oak stairs"* · *"Can you quote?"* · *"Looking for walnut stairs"*
- *"Do you supply London?"* · *"Need stairs ASAP"*
- *"My opening is 2800 x 1800"* · *"Can you match my flooring?"* · *"Can I send photos?"*

**Purpose:** measure whether the Router GENERALISES rather than just matches known examples. Add continuously as real production questions arrive.

---

## Deriving Group 1 automatically (converter script · Philip 2026-07-31)

Philip's directive: *"If you already have 7,000 lines, don't manually create another 7,000 validation entries. Instead, write a small converter."*

**Converter built at:** `scripts/derive-nex-router-validation-entries.mjs`

Run:
```
node scripts/derive-nex-router-validation-entries.mjs
```

Output:
`data/nex-reference-brains/staircase-preparation/nex-router-validation-derived-entries-2026-07-31.md`

**How it works:** every authored artefact under `staircase-instances/` with Standard v1 metadata frontmatter (`brain` · `domain` · `intent` · `information_type` · `topics`) becomes a Router test row. The converter reads the frontmatter · extracts the Customer Question if present · maps metadata fields to Router expected values · outputs a growing validation table.

**Result today:** 5 derived entries from 69 evidence files (only 5 have full Standard v1 frontmatter). Every future authored artefact with proper frontmatter grows the corpus automatically. **Zero manual maintenance.**

**Implication for pre-Standard-v1 artefacts (the other 64):** they can be retrofitted with Standard v1 frontmatter to enter the derived corpus. Deferred per Author-Driven Rule · not required unless reality signals demand it.

---

## Pass/Fail Criteria

A row **PASSES** when the Router implementation resolves ALL of:

1. Intent matches the expected value (or a compatible synonym in the current Router vocabulary — Vocabulary Elasticity Principle)
2. Subject matches
3. Brain matches
4. Domain matches
5. Info Type matches
6. Clarify decision matches:
   - Expected "No" → Router must NOT ask a clarifying question
   - Expected "Yes" → Router MUST ask a clarifying question (Low-Confidence handling · Ruling #10)
   - Expected "Maybe" → Either is acceptable · Router uses its own judgement

A row **FAILS** when any of the above does not match.

**Aggregate acceptance criterion (composes with Ruling #3 outcome-based criterion):** the Router build succeeds when it passes ≥95% of rows without hand-tuning to specific rows.

---

## Failure Code Taxonomy (authored by Philip)

When a row FAILS, record WHICH TYPE of failure occurred. Aggregate failure-code counts make improvements targetable · *"the Router passes 487/500 · with 8 R001 · 3 R004 · 2 R007"* is far more actionable than *"13 fails."*

| Failure Code | Meaning |
|---|---|
| **R001** | Wrong intent detected |
| **R002** | Wrong subject detected |
| **R003** | Wrong brain selected |
| **R004** | Wrong knowledge domain |
| **R005** | Wrong information type |
| **R006** | Clarification should have been requested |
| **R007** | Retrieved incorrect evidence |
| **R008** | Response contradicted evidence |

**Recording format:** Pass/Fail column becomes `Pass` OR `Fail:R00X` (where R00X is the applicable code · multiple codes comma-separated when several apply · e.g. `Fail:R001,R004,R007`).

---

## Integration Guidance

Router implementations should read this file as the ground truth. Suggested implementation flow:

1. Router receives User Question
2. Router resolves the five dimensions using authored metadata (Standard v1 Part 5)
3. Router decides Clarify Yes/No based on Router-Confidence dimension (Ruling #10)
4. Router output is compared to the Expected columns
5. Pass/Fail is recorded per row · aggregate rate reported

**No hand-tuning to specific rows.** The Router must generalise · not memorise. Rows should be added continuously so memorisation is not a viable strategy.

---

## Vocabulary Notes (per Vocabulary Elasticity Principle)

Values used in the starter corpus reflect current router vocabulary. As Philip's authored guidance in Ruling #10 established, values within dimensions are empirical. Compatible synonyms accepted:

| Column | Accepted synonyms |
|---|---|
| Intent | Learn ≈ Explain · Buy ≈ Enquire · Quote ≈ Pricing · Browse ≈ Show |
| Brain | Estimator/Staircase acceptable while Estimator Brain remains a candidate (Ruling #10) |
| Domain | Sales ≈ Purchase/Inquiry · Reference Gallery ≈ Images |
| Info Type | Types ≈ Classification · Options ≈ Selection · Cost ≈ Price |

---

## Composition with the Constitution

- **Permanence Principle** — this suite is Evidence (permanent) · Router implementations are Runtime (ephemeral · can be swapped without changing the suite)
- **Evidence First** — expected values authored by Philip · not inferred by AI
- **Reality-Over-Speculation** — rows added when real questions demand new patterns · not proactively imagined
- **Trust Metric** — a Router that passes this suite is one you can trust to answer real conversations correctly
- **Vocabulary Elasticity** — dimensions constitutional · values within accepted with reasonable synonyms

---

## Growth Log

| Version | Date | Row count | Notes |
|---|---|---|---|
| v1 | 2026-07-31 | 6 | Starter corpus authored by Philip in the tenth-ruling test-corpus expansion + build directive · Evidence Used column added same-day per Philip's follow-up guidance · v1-v5 growth ladder locked · row 6 shows Evidence Used exemplar (✓ used · ✗ NOT used) · **Runtime Contract added same-day** (Classify-first · Confidence-check · Clarify OR Retrieve · violation = automatic fail) · **Failure Code Taxonomy added same-day** (R001-R008 · targetable improvement) · **Growth ladder revised same-day** (6 diagnostic → 100 representative → 1,000 → 7,000 existing → v5 live production) · **Two-Group Corpus Structure added** (Existing Knowledge Questions + Live Production Questions) · **Converter script built** at `scripts/derive-nex-router-validation-entries.mjs` · **5 entries derived** from existing 5 Standard-v1-compliant Customer FAQ articles · derived corpus grows automatically with every new authored artefact carrying full Standard v1 frontmatter |
| *(future)* | | | |

---

## Priority Order (Philip's authored guidance)

1. **Build the Router specification** *(this file)*
2. Create a growing validation corpus of real user questions
3. Connect the Router to the existing metadata
4. Measure pass/fail rates
5. Refine routing based on evidence — not intuition

**End of NEX Router Validation Suite v1**
