---
# ═══════════════════════════════════════════════════════════════
# LAYER 2 MODULE DRAFT · TARGET FILE FOR EXPERT AUTHORING
# Priority #2 in Philip's 2026-07-30 authoring sequence.
# Layer 2 lives in hammerex_nex_brain_drafts once authored,
# hammerex_nex_brain_versions once published. This file is the
# pre-database authoring canvas — Rule B applies below front-matter.
# ═══════════════════════════════════════════════════════════════

# --- Identity ---
module_id:                  staircase-top-landing-connection
module_slug:                top-tread-machining
module_title:               Top Tread Machining · The Landing Connection Detail
module_version:             0.1-draft
layer:                      2
brain:                      staircase
supersedes:                 —
superseded_by:              —

# --- Lifecycle (Seven-State Knowledge Lifecycle) ---
lifecycle_state:            expert_draft
draft_status:               scaffolded_awaiting_content
created_at:                 2026-07-30T00:00:00Z
created_by:                 claude_scaffold_generator
authored_by:                # ⬅ SLOT · Junior Francis (per Philip 2026-07-30 attribution reassignment)
authored_at:                # ⬅ SLOT · YYYY-MM-DD
technical_reviewer:         # ⬅ SLOT · second named expert · Rule C independent verification
technical_reviewed_at:      —
approved_by:                —
approved_at:                —
published_at:               —

# --- Evidence Provenance (Rule C · attributable origin) ---
evidence_refs:
  - path:                   evidence/workshop-observations/top-tread-machining.md
    evidence_type:          workshop_observation
    authority_frame:        documented_workshop_experience    # NOT external_expert_citation
    source_person:          Junior Francis
    verification:           "Personally observed during staircase manufacture and installation."
    verified_at:            2026-07-30
    reviewed_by:            Philip O'Farrell
    attribution_note:       "Author reassigned Philip O'Farrell → Junior Francis on Philip 2026-07-30. Junior Francis is a workshop practitioner whose authority rests on documented workshop experience — NOT external credentialled expertise."

# --- Confidence Composition (inherited from evidence) ---
confidence:
  level:                    HIGH
  basis:
    - workshop_observation
    - repeated_manufacture
    - verified_by_author
    - documented_experience_of_named_practitioner
  limitations:
    - not_universal_across_all_UK_workshops
    - construction_may_vary_by_manufacturer_and_specification
    - numeric_ranges_are_workshop_convention_not_specification
  runtime_framing:          "Based on long-term joinery experience — this is workshop-standard practice, not a single-shop convention. Not a regulation."

# --- Question Catalogue Ties (coverage tracking · questions/02-construction-and-craft.md) ---
questions_answered:
  - id:                     Q053
    text:                   "Are treads and risers the same length as each other?"
    homeowner_variant:      "Do I cut the treads and risers together?"
  - id:                     Q061
    text:                   "Why does the top riser terminate against the trimmer, not the string?"
    homeowner_variant:      "What's happening at the top of the flight — riser goes against what?"

# --- Governance Compliance (all three must PASS before publish) ---
rule_a_anti_fabrication:
  status:                   # ⬅ SLOT · PASS | FAIL | REVIEW
  notes:                    Every claim traces to the cited evidence file. Numeric ranges (75-100mm top tread depth · 32mm intermediate · 12-20mm floor rebate examples · 3-6mm carpet allowance) described as "workshop convention" NOT "specification." No fabricated claims.

rule_b_no_ai_authored:
  status:                   # ⬅ SLOT · PASS | FAIL | REVIEW
  notes:                    Trade content authored by Junior Francis (Philip's nominated named practitioner). Scaffold structure by Claude. No AI-generated trade prose in module body.

rule_c_attributable_origin:
  status:                   # ⬅ SLOT · PASS | FAIL | REVIEW
  notes:                    Origin trace unbroken · evidence_refs → workshop-observations/top-tread-machining.md → Junior Francis (documented workshop experience frame, NOT credentialled expert citation) → verification statement.

# --- Product Constitution alignment ---
principle_0001_workshop_manager_test:
  status:                   # ⬅ SLOT
  notes:                    Does the answer read like a workshop manager teaching an apprentice, with sawdust on their hands? Person + phone in pocket test.

principle_0003_judgement_not_verdict:
  status:                   # ⬅ SLOT
  notes:                    Four-move shape required. Top-tread machining is DIAGNOSTIC not deterministic — different construction types + different floor finishes = different correct answers. This module MUST teach the diagnosis, not prescribe a single dimension.

# --- ADR-0040 Professional Test (Prime Sentence · CAPSTONE) ---
professional_test:
  question:                 "Would a master joiner recommend this module to a peer?"
  status:                   # ⬅ SLOT · must be YES before publish

# --- Phrasing Constraints (from evidence file phrasing_note) ---
phrasing_constraints:
  - "Layer 2 module MUST phrase as 'commonly manufactured' NOT 'always manufactured.' The 75-100mm range is workshop convention · construction may vary by manufacturer and specification. Philip 2026-07-30."

# --- Runtime Framing (evidence_type → phrasing prefix) ---
runtime_framing:            "based on long-term joinery experience"
---

# Top Tread Machining · The Landing Connection Detail

> **Rule B reminder · IMMUTABLE:** everything below the front-matter is trade content — **Junior Francis authors (Philip's nominated named practitioner), Claude does not touch.** Sections are stubbed with authoring prompts, NOT with drafted content. Delete each prompt as you write over it.

---

## 1 · One-line principle statement

<!-- AUTHOR: one sentence. The top tread is not a normal tread — it's a landing-transition detail. Frame the way Junior would say it in the workshop. Must respect phrasing constraint (commonly manufactured, not always). -->

---

## 2 · The claim (short workshop-language framing)

<!-- AUTHOR: 2-4 sentences. From the evidence file, three ways the top tread differs from intermediate treads:
     (a) Reduced front-to-back depth (~75-100mm typical).
     (b) Sits partly on the trimming joist (trimmer), not housed into strings.
     (c) Top riser finishes against the trimmer face, not against a string housing.
     Frame in workshop-practitioner voice. Structural transition detail, not just "another tread". -->

---

## 3 · Manufacturing consequence · hard floor finishes

<!-- AUTHOR: for hard floor finishes (engineered oak · timber · laminate · tile), the underside or rear of the top tread is often machined (rebated) to suit the exact Finished Floor Level. From the evidence file, illustrative examples (not standards):
       - 15mm engineered oak
       - 18mm solid timber
       - 12mm laminate + 3mm underlay
       - 20mm porcelain tile
     Frame these as EXAMPLES, not specifications (per phrasing constraint · workshop convention, not spec). -->

---

## 4 · Manufacturing consequence · carpet + underlay (the critical rule)

<!-- AUTHOR: **do NOT deeply rebate the top tread for carpet.** This is the central workshop rule of the module. Explain why:
       - Removing 12-15mm from a tread with only 75-100mm bearing over the trimmer weakens the effective section.
       - Correct practice is either (a) slightly haunch the tread down into the trimmer, or (b) set the tread a few mm lower relative to finished landing level.
       - Carpet + underlay then finishes flush without significantly reducing tread strength.
     This is the workshop rule that keeps a staircase strong for decades. Frame with the weight it deserves — this is the module's core teaching. -->

---

## 5 · Judgement-not-verdict shape (Principle 0003 · required)

For NEX runtime composition. Author each of the four moves:

### 5.1 · State the specific case

<!-- AUTHOR: "You're planning what happens at the top of the staircase where it meets the landing floor..." One or two sentences. Concrete. Doesn't presume the answer. -->

### 5.2 · Compose the relevant principles

<!-- AUTHOR: name the two-three principles that combine here:
       - Top tread is a transition detail, not a load-bearing housed tread
       - Effective section thickness matters (don't remove what you need)
       - Finish type (hard vs soft) drives the machining choice, not aesthetics
     Compose them — show how they interact. -->

### 5.3 · Lead with a recommendation + visible reasoning

<!-- AUTHOR: what does an experienced joiner recommend? Why?
       - "For hard finishes, rebate to suit the finished thickness — because the top tread still has enough section left over the trimmer."
       - "For carpet, haunch or set-down — because deep-rebating for carpet takes away section you need."
     Show the reasoning, not just the rule. -->

### 5.4 · Name the alternative honestly

<!-- AUTHOR: what does an over-eager installer do?
     Suggested shape (write fresh in Junior's voice):
       "An installer with a router might deep-rebate the top tread for carpet just because they've been doing that for hard flooring. That's the moment the staircase quietly loses strength — nothing shows on day one, but the joint starts working loose in year two."
     Frame with compassion, not condescension. -->

---

## 6 · Answer templates

### 6.1 · Q053 — *"Are treads and risers the same length as each other?"*

Homeowner variant: *"Do I cut the treads and risers together?"*

<!-- AUTHOR: NEX's runtime answer to Q053.
     Broad answer: yes — intermediate treads and risers share the same clear-width + housing length calc because both are housed into the same string profile.
     **Exception the module teaches:** top tread + top riser are the geometry exception (top tread reduced depth, top riser terminates against trimmer face rather than a housing).
     Frame in customer-facing register — Principle 0003 four-move shape, short. -->

### 6.2 · Q061 — *"Why does the top riser terminate against the trimmer, not the string?"*

Homeowner variant: *"What's happening at the top of the flight — riser goes against what?"*

<!-- AUTHOR: NEX's runtime answer to Q061.
     This is the ENGINEERING INVARIANT (Philip 2026-07-30): risers = treads + 1 · every single flight terminates on a riser against the trimming joist.
     Frame it as the structural transition detail — the flight leaves the strings and hands off to the landing construction.
     Principle 0003 shape · customer-facing register. -->

---

## 7 · Cross-references

- **Companion evidence:** `evidence/regulations/housing-depths.md` — the housing rule that governs intermediate treads/risers but NOT the top tread (top tread bears on trimmer, not string).
- **Companion evidence:** `evidence/workshop-observations/lifted-top-step.md` — safety implications when the top tread is under-fixed. Different Layer 2 module (Stair Repairs · #3 in queue) but related.
- **Companion Layer 2 module:** `stopped-wedge-principle.md` (#1) — housed joint verification. Different scope, adjacent concern.
- **Engineering invariant:** risers = treads + 1 · single flight terminates on a riser against the trimmer. See character-layer Rule 3 · Geometry Module solver.
- **Component Library:** `data/nex-staircase-components/families/shell_straight_closed.yaml` — the `top_landing_connection` field carries `typical_depth_range_mm: { min: 75, max: 100 }` and `machining_supported: [timber_floor, laminate_floor, tile_floor, carpet_floor]`. This module authors the underlying knowledge those flags represent.

---

## 8 · Promise (per feedback_nex_brain_mission_principles_promise.md)

### 8.1 · will_do

<!-- AUTHOR: 3-5 things this module WILL do at runtime. Suggested shape:
       - Explain WHY the top tread differs from intermediate treads (structure, not just dimension).
       - Teach the hard-finish vs soft-finish machining distinction.
       - Warn honestly that deep-rebating for carpet weakens the tread, without alarmism.
       - Point at inspection when the specific case can't be answered remotely. -->

### 8.2 · will_not_do

<!-- AUTHOR: 3-5 things this module will NOT do — the honest boundary. Suggested:
       - Prescribe the specific FFL allowance for a specific floor product remotely (needs measurement).
       - Diagnose a specific damaged top tread (that's the Stair Repairs module).
       - Present workshop practice as if it were a regulation.
       - Quote a single "correct" top tread depth. The 75-100mm range is convention, not spec. -->

---

## 9 · Author sign-off (Rule B · Rule C)

Once every section above is filled AND every governance check reads PASS:

1. Update `authored_by:` to `Junior Francis` and `authored_at:` in the front-matter.
2. Update `lifecycle_state:` from `expert_draft` to `technical_review`.
3. Update `draft_status:` from `scaffolded_awaiting_content` to `authored_awaiting_review`.
4. Nominate a `technical_reviewer:` — a second named expert (Rule C · independent verification).
5. Flip all three `rule_*_status:` fields from SLOT to explicit PASS/FAIL/REVIEW.
6. Flip `principle_0001_workshop_manager_test.status:` and `principle_0003_judgement_not_verdict.status:`.
7. Flip `professional_test.status:` — must read YES before publish.

The module cannot promote to `hammerex_nex_brain_drafts` until sign-off is complete.

**Rule B final check:** search the module body for any sentence you didn't write yourself. If any remain, delete or rewrite. The Reference Brain contains no AI-authored trade content — including scaffold prompts.
