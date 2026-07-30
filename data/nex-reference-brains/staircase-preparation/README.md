# Staircase Reference Brain — Preparation

> **Purpose:** Layer 1 of the Three-Layer Knowledge Architecture (Philip 2026-07-28 · HARD LAW).
>
> This directory holds **evidence** the AI has collected — standards, regulations, manufacturer manuals, industry guidance, workshop observations from named experts. Nothing here enters the Reference Brain (`hammerex_nex_brain_*`) directly. Human experts author Layer 2 modules from this evidence base, and only Layer 2 modules ever become source-of-truth for runtime answers.

---

## The three-layer rule (immovable)

```
Layer 1 · Evidence
  ↓ (curation · expert review)
Layer 2 · Expert Knowledge         ← Rule B: human-authored ONLY
  ↓ (runtime composition)
Layer 3 · Runtime Intelligence
```

**Rule B recap (Chief Reference Brain Engineer HARD LAW):**

> *"No AI-generated trade content enters a Reference Brain without a named expert's approval. AI CAN organise / dedupe / find-contradictions / suggest-topics / adversarial-question — AI NEVER authors trade content."*

Everything in `evidence/` and `candidates/` is Layer 1. **Nothing here is a fact that NEX quotes at customers.** It is source material a named expert draws on when authoring Layer 2.

---

## Directory layout

```
staircase-preparation/
├── evidence/                          Cited or expert-observed material · never runtime-quoted
│   ├── regulations/                   Approved Doc K · TGD K · BS 5395 · BS 6180 · BWF guides
│   ├── manufacturer-practice/         Verified conventions from named UK manufacturers
│   └── workshop-observations/         Named-expert observations · needs verification path
│
├── questions/                         Curated question catalogue · what customers ask NEX
│   ├── README.md                      Format spec + Rule B rationale
│   └── 01-*.md ... N-*.md             Grouped questions with canonical + homeowner + trade variants
│
├── layer-2-drafts/                    Pre-database authoring canvas · one file per Layer 2 module
│   ├── README.md                      Rule B split · scaffold-vs-author contract · promotion path
│   └── <module-slug>.md               Scaffolded by Claude · authored by named expert · never both
│
├── candidates/                        Raw dumps from research sessions · pre-curation
│                                       (LLM transcripts · article summaries · etc.)
│
└── discarded/                         Content that failed Rule B or is off-topic
                                        (kept as an audit trail · never re-extracted without cause)
```

---

## Front-matter shape (every evidence file must have this)

```markdown
---
topic:               <short human-readable title>
source_type:         regulation | manufacturer_practice | expert_observation | trade_body_guidance
evidence_type:       regulation | standard | manufacturer | trade_body | industry_best_practice | workshop_observation | historic_reference | material_science | engineering_principle
                     # Philip 2026-07-30 · governs how NEX phrases the answer at runtime
                     # (regulation → "required by regulation" · standard → "published standard"
                     #  · manufacturer → "manufacturer specification" · trade_body → "trade body guidance"
                     #  · industry_best_practice → "widespread industry convention (varies by maker)"
                     #  · workshop_observation → "based on long-term joinery experience"
                     #  · historic_reference → "documented historical information"
                     #  · material_science → "documented material behaviour"
                     #  · engineering_principle → "engineering principle")
                     # `industry_best_practice` added 2026-07-30 to distinguish widespread manufacturing
                     # convention (e.g. string thickness options) from formal trade body guidance.
authority_frame:     documented_experience | credentialled_authority
                     # Optional · for expert_observation and workshop_observation only.
                     # documented_experience = practitioner-observed (Junior Francis, Philip)
                     # credentialled_authority = external expert citation (RIBA architect, BWF committee)
verification:        "<one-sentence how the claim is verified>"
                     # Required when authority_frame = documented_experience
                     # Example: "Personally observed during staircase manufacture and installation."
source_document:     <exact document name if applicable>
source_person:       <named expert if applicable>
source_date:         YYYY-MM-DD
source_transcript:   candidates/<path if extracted from raw dump>
verification_status: cited | awaiting_citation | awaiting_expert_review | verified | contradicts_other
review_decision:     verify_and_author | verify_and_author_pending_citation | send_for_citation | discard
                     # set by named expert when reviewed
reviewed_by:         <expert name>
reviewed_at:         YYYY-MM-DD
layer_2_priority:    <integer — Philip's authoring order · or `—` if not in current top-N sequence>
phrasing_note:       <optional — required-phrasing constraint from the reviewer>
attribution_note:    <optional — audit trail for any source_person reassignment>
promoted_to_brain:   false                   # NEVER `true` in this directory
brain_module_target: <staircase-module-slug if a Layer 2 target exists>

confidence:                                  # Philip 2026-07-30 · Evidence Confidence field
  level:             VERY_HIGH | HIGH | MEDIUM | LOW
  basis:                                    # ordered list of what the confidence rests on
    - workshop_observation
    - verified_by_author
    - trade_body_citation
    - manufacturer_documentation
    - approved_document_reference
    - repeated_field_practice
    - documented_experience_of_named_practitioner
  limitations:                              # ordered list of caveats · required, must not be empty
    - not_universal
    - construction_may_vary
    - awaiting_external_reference
  status:            <optional — awaiting_external_reference | contradicts_other | etc.>
                     # Makes NEX runtime able to EXPLAIN why it's confident, not just give an answer.
---

## Claim
<the actual claim, one paragraph, no marketing prose>

## Author's note
<optional — the expert's own reasoning or workshop observation>

## Cross-references
<links to related files in this directory or existing code artefacts>

## Verification needed before Layer 2 promotion
- [ ] <specific verification step>
- [ ] ...
```

---

## The curation workflow

1. **Research session produces raw material** — LLM transcript, article, manufacturer PDF, video notes, workshop conversation.
2. **AI (Claude / Nex) reads the raw** and does what Rule B permits: organise, dedupe, cluster by topic, flag contradictions, suggest missing topics. Result: candidate files in `candidates/`.
3. **AI extracts individual claims** from candidates into `evidence/` files with the front-matter above. Each extraction MUST cite its source or name its expert. AI never invents claims.
4. **Human expert reviews** each evidence file. For each, the expert decides:
   - **Verify + author** — the expert writes the Layer 2 module (in `hammerex_nex_brain_drafts`), citing the evidence file. Expert is the named author (Rule C — attributable origin).
   - **Send for citation** — the claim is real but needs a source. Back to `evidence/` with `verification_status: awaiting_citation`.
   - **Discard** — the claim is wrong, marketing prose, off-topic, or duplicates an existing Layer 2 module. Move to `discarded/` with a one-line reason.
5. **Layer 2 module goes to `draft` → `technical_review` → `approved` → `published`** per the Seven-State Knowledge Lifecycle. Only `published` modules enter `hammerex_nex_brain_versions` and become runtime-quotable.

---

## What NEVER goes in evidence/

Even before human review, these categories fail Rule B on sight:

- **Marketing prose** — *"the staircase is the invisible journey of generations"* · *"the tool creates accuracy · the craftsman creates meaning"* · anything that reads like a brochure.
- **Philosophical repetition** — the same "beginner vs craftsman vs master" framing written 15 different ways.
- **Off-topic material** — Titanic history, career advice, business models, trade-comparison guides.
- **Nex identity / persona roleplay** — "Nex stepping into the line" · assistant self-description · anything about Nex itself rather than the trade.
- **Unverifiable regulation-adjacent claims** — *"industry standard is X"* without a named document, or *"most manufacturers use Y"* without a survey.

If a raw dump contains a mix of valuable claims and disqualifying content, **extract the valuable claims into evidence/**, move the raw dump to `candidates/` with the disqualifying sections flagged, and do NOT extract disqualifying content.

---

## Contradiction handling

If two evidence files disagree (e.g. one manufacturer says 12mm housing depth, another says 15mm), **do not resolve the contradiction in evidence/**. Log both, mark each with `verification_status: contradicts_other`, and reference each from the other. Resolution is Layer 2 (expert judgement) territory.

Philip's Reference Brain Validation v1.0 protocol Phase 3 says: *expert reviews every answer, records correct/partial/wrong/should-be-unknown*. Contradictions surface at that phase — evidence layer stores them faithfully.

---

## Current state (2026-07-30 · post-Philip-review)

**Directory populated. 197 curated questions + 7 evidence files. Philip reviewed all 7 evidence files 2026-07-30. Nothing promoted to `hammerex_nex_brain_versions` yet.**

### Questions catalogue (11 shipped + 1 placeholder)

12 topic files at `questions/01-*.md` through `questions/12-*.md`. Full status table lives in `questions/README.md`. Question numbers Q001-Q197 are stable — retire with *(retired)* rather than renumbering.

**Restructure 2026-07-30 (Philip):** `07-heritage-and-history.md` split into `07-heritage.md` (heritage-value + restoration + famous staircases including Titanic) and `08-historic-construction-methods.md` (craft technique in past eras — placeholder, no questions yet). Files 08→09, 09→10, 10→11, 11→12 renumbered.

### Evidence files (7 shipped · all reviewed by Philip 2026-07-30)

Philip's review decisions and Layer 2 authoring priority:

| # | File | `evidence_type` | Decision | Priority |
|---|------|-----------------|----------|----------|
| 1 | `evidence/workshop-observations/stopped-wedge-principle.md` | workshop_observation | ✅ Verify + Author | **1 (first)** |
| 2 | `evidence/workshop-observations/top-tread-machining.md` | workshop_observation | ✅ Verify + Author · attribution reassigned Philip→Junior Francis | 2 |
| 3 | `evidence/workshop-observations/lifted-top-step.md` | workshop_observation | ✅ Verify + Author · repair depends on inspection | 3 |
| 4 | `evidence/workshop-observations/radiator-effect-on-timber.md` | workshop_observation | ✅ Verify + Author · "can contribute" not "always causes" | 4 |
| 5 | `evidence/regulations/housing-depths.md` | trade_body | 🔍 Send for citation · BWF exact wording needed | 5 |
| 6 | `evidence/regulations/string-thicknesses.md` | trade_body | 🔍 Send for citation · manufacturer variance noted | 6 |
| 7 | `evidence/regulations/bwf-design-guide-2.md` | trade_body | ✅ Verify + Author *pending citation* (exact edition + year) | 7 (last) |

**Authoring sequence — REVISED 2026-07-30 (Philip's second review):**

Philip revised the Layer 2 sequence after the second evidence review, expanding scope beyond the current 7 evidence files:

| # | Layer 2 module | Evidence file(s) supporting it | Ready to author? |
|---|----------------|--------------------------------|------------------|
| 1 | Stopped Wedge Principle | `stopped-wedge-principle.md` (✅ verified) | ✅ Yes |
| 2 | Top Tread Machining | `top-tread-machining.md` (✅ verified · Junior Francis documented experience) | ✅ Yes |
| 3 | String Housings | `housing-depths.md` (🔍 awaiting_external_reference) | 🔍 needs BWF citation |
| 4 | Closed Strings | **NO EVIDENCE FILE YET** | ❌ needs evidence collection first |
| 5 | Open Strings | **NO EVIDENCE FILE YET** | ❌ needs evidence collection first |
| 6 | Timber Movement | `radiator-effect-on-timber.md` (✅ verified) + additional evidence needed | 🔍 partial evidence · broader scope |
| 7 | Stair Repairs | `lifted-top-step.md` (✅ verified) + additional repair evidence needed | 🔍 partial evidence · broader scope |
| 8 | Installation Tolerances | **NO EVIDENCE FILE YET** | ❌ needs evidence collection first |

Rationale (Philip): *"That gives NEX a proper understanding of how staircases work before learning regulations."*

**Modules dropped from top sequence:** `string-thicknesses.md` and `bwf-design-guide-2.md` are NOT in the top-8 Layer 2 modules under the revised sequence. They remain in evidence as reference material cited by other modules, but no standalone Layer 2 module is planned.

**Evidence collection gap (Philip 2026-07-30):** Modules #4, #5, #8 require new evidence files before Layer 2 authoring can begin. Rule B still applies — evidence must come from named workshop practitioners (documented experience) or trade body / manufacturer citation. AI cannot generate this content.

**Cross-cutting attribution:** every evidence file lists the question numbers it would answer once a Layer 2 module is authored. Any Q number with no evidence file backing it = a Layer 2 authoring gap that can't be closed yet without more source material.

### Junior Francis attribution — documented experience, NOT external expert citation

`top-tread-machining.md` source_person reassigned Philip O'Farrell → Junior Francis on 2026-07-30.

**Philip's clarification 2026-07-30:** *"I would not use Junior Francis as an expert citation. The authority comes from documented experience, not from claiming external expert status."*

Applied shape on the file:

```yaml
source_person:       Junior Francis
authority_frame:     documented_workshop_experience
verification:        "Personally observed during staircase manufacture and installation."
```

**Two authority frames now distinguished on evidence files:**

- `documented_experience` — practitioner-observed content. Authority rests on the `verification` field describing HOW the observation was made. Junior Francis, Philip, and any other named workshop practitioner falls in this frame.
- `credentialled_authority` — external expert citation. Authority rests on the expert's institutional role (RIBA architect, BWF committee member, chartered engineer). Not used yet in this directory; taxonomy anticipates future files.

Rule C is satisfied for `documented_experience` when there is a NAMED person AND a `verification` statement. Both must be present.

### Evidence Type taxonomy (Philip 2026-07-30 · v2)

Every Layer 1 file now carries `evidence_type` — governs how NEX phrases the runtime answer:

| Evidence type | Runtime framing | Example content |
|---|---|---|
| `regulation` | *"required by regulation"* | Approved Doc K, TGD K, BS 5395 |
| `standard` | *"published standard"* | BS 6180, BS EN 14076 |
| `manufacturer` | *"manufacturer specification"* | Named UK manufacturer manual |
| `trade_body` | *"trade body guidance"* | BWF Design Guide, TRADA, FIRA (guidance NOT legislation) |
| `industry_best_practice` | *"widespread industry convention (varies by maker)"* | String thickness options; sizes many manufacturers use but none specifies |
| `workshop_observation` | *"based on long-term joinery experience"* | Stopped-wedge principle; top-tread machining (Junior Francis) |
| `historic_reference` | *"documented historical information"* | Harland & Wolff records, museum archives |
| `material_science` | *"documented material behaviour"* | Timber shrinkage/swell data |
| `engineering_principle` | *"engineering principle"* | Load path, section modulus |

**`industry_best_practice` added 2026-07-30 (Philip):** *"There are many things every staircase manufacturer does which are neither regulations nor engineering laws."* Distinguishes widespread convention from formal trade-body specification.

Prevents workshop experience from being presented as statutory requirements while preserving the value of expert knowledge.

### Evidence Confidence field (Philip 2026-07-30 · new schema)

Every Layer 1 file now carries a `confidence` block:

```yaml
confidence:
  level:             VERY_HIGH | HIGH | MEDIUM | LOW
  basis:                                    # what the confidence rests on
    - workshop_observation
    - verified_by_author
  limitations:                              # required · caveats that stop the claim from being universal
    - not_universal
    - construction_may_vary
  status:            awaiting_external_reference   # optional
```

**Rationale (Philip):** *"This makes the reasoning engine much stronger because NEX can explain WHY it is confident instead of simply giving an answer."*

Runtime consumption: when NEX composes an answer citing evidence, it can surface not just the citation but the confidence level + basis. A `LOW` confidence claim gets *"per one workshop practitioner, this may vary by manufacturer"* framing; a `VERY_HIGH` claim gets *"required by Approved Document K section X"*.

### Assembly library (2026-07-30)

Current: 1T · 2T · 3T · 4T · 5T · 6T · 7T (turned) · 8T (turned) · 9T (turned) · 10T · 12T · 13T · 14T = **13 assemblies**.

**Missing (3 gaps):** 11T · 15T · 16T.

- 11T + 15T = continuous 1-16 sequence gaps
- 16T = last golden reference (Philip's golden set: 1, 4, 8, 10, 13, 16)

### Titanic candidates status

Philip provided 3 ChatGPT-generated Titanic staircase image URLs 2026-07-30. Held in `candidates/2026-07-30-titanic-ai-renders.md` per Rule B. Not promoted to `evidence/heritage/` because they fail every one of Philip's own Titanic-authenticity criteria (Harland & Wolff / Titanic Belfast / NMM / recognised publication). Cannot be surfaced under Titanic questions in the questions catalogue, cannot enter Golden Replies, cannot be marketing-labelled *"Titanic staircase"*. Would need pairing with an authoritative source before promotion.

### Existing Reference Brain material

Philip's earlier expert authoring lives at `docs/brains/staircase-*.md` — mostly Layer 2 draft material predating this preparation directory. Those files aren't governed by this pipeline yet; when a Layer 2 module authored from these evidence files gets published to `hammerex_nex_brain_versions`, the older draft files should either be migrated in or archived.

Add new evidence files as raw material is curated. Never fake volume by extracting the same claim twice.
