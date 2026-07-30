---
# ═══════════════════════════════════════════════════════════════
# LAYER 2 MODULE DRAFT · TARGET FILE FOR EXPERT AUTHORING
# Do not read from this file at runtime. Layer 2 lives in the
# hammerex_nex_brain_drafts table once authored, and
# hammerex_nex_brain_versions once published. This file is the
# pre-database authoring canvas — Rule B applies to everything
# below the front-matter.
# ═══════════════════════════════════════════════════════════════

# --- Identity ---
module_id:                  staircase-wedge-assembly-principle
module_slug:                stopped-wedge-principle
module_title:               The Stopped-Wedge Principle
module_version:             0.1-draft
layer:                      2                                     # Layer 2 · expert-authored knowledge
brain:                      staircase                             # Reference Brain this module belongs to
supersedes:                 —                                     # if this replaces a prior module version
superseded_by:              —                                     # populated when replaced

# --- Lifecycle (Seven-State Knowledge Lifecycle) ---
lifecycle_state:            expert_draft                          # → technical_review → approved → published → version_locked
draft_status:               scaffolded_awaiting_content           # → authored_awaiting_review → approved_awaiting_publish → published
created_at:                 2026-07-30T00:00:00Z
created_by:                 claude_scaffold_generator             # scaffold only · not trade content
authored_by:                # ⬅ SLOT · SET WHEN AUTHORING BEGINS · Philip O'Farrell (per 2026-07-30 Layer 2 priority #1)
authored_at:                # ⬅ SLOT · YYYY-MM-DD
technical_reviewer:         # ⬅ SLOT · second named expert · Rule C independent verification
technical_reviewed_at:      —
approved_by:                —
approved_at:                —
published_at:               —

# --- Evidence Provenance (Rule C · attributable origin) ---
evidence_refs:
  - path:                   evidence/workshop-observations/stopped-wedge-principle.md
    evidence_type:          workshop_observation
    authority_frame:        documented_workshop_experience        # NOT external_expert_citation
    source_person:          Philip O'Farrell
    verification:           "Personally observed during staircase manufacture and installation."
    verified_at:            2026-07-30
    reviewed_by:            Philip O'Farrell

# --- Confidence Composition (inherited from evidence) ---
confidence:
  level:                    HIGH
  basis:
    - workshop_observation
    - repeated_manufacture
    - verified_by_author
  limitations:
    - not_universal_across_all_UK_workshops
    - joint_verification_practice_may_differ_between_shops
  runtime_framing:          "Based on long-term joinery experience — this is workshop-standard practice, not a single-shop convention. Not a regulation."

# --- Question Catalogue Ties (coverage tracking · questions/02-construction-and-craft.md) ---
questions_answered:
  - id:                     Q055
    text:                   "Is a wedge that won't drive any further proof the tread is fully home?"
    homeowner_variant:      "If I can't move the wedge, is the joint tight?"
  - id:                     Q056
    text:                   "What happens if I keep hammering after a wedge has stopped?"
    homeowner_variant:      "Should I keep going or stop?"

# --- Governance Compliance (all three must PASS before publish) ---
rule_a_anti_fabrication:
  status:                   # ⬅ SLOT · PASS | FAIL | REVIEW · check at author sign-off
  notes:                    Every claim in this module must trace to the cited evidence file. Numeric ranges described as "workshop convention" not "specification". No fabricated claims.

rule_b_no_ai_authored:
  status:                   # ⬅ SLOT · PASS | FAIL | REVIEW · check at author sign-off
  notes:                    Trade content authored by Philip O'Farrell (or nominated named practitioner). Scaffold structure by Claude. No AI-generated trade prose enters the module body. Every sentence below front-matter must be human-written.

rule_c_attributable_origin:
  status:                   # ⬅ SLOT · PASS | FAIL | REVIEW · check at author sign-off
  notes:                    Origin trace via `evidence_refs` → verified evidence file → named practitioner → verification statement. Chain is unbroken.

# --- Product Constitution alignment ---
principle_0001_workshop_manager_test:
  status:                   # ⬅ SLOT
  notes:                    Does the answer read like something a workshop manager with sawdust on their hands would naturally say? Person + phone in pocket test.

principle_0003_judgement_not_verdict:
  status:                   # ⬅ SLOT
  notes:                    Answer must COMPOSE principles, not deliver a rigid rule.
                            Four-move shape required (state case → compose principles → recommendation + visible reasoning → alternative honestly named).

# --- ADR-0040 Professional Test (Prime Sentence · CAPSTONE) ---
professional_test:
  question:                 "Would a master joiner recommend this module to a peer?"
  status:                   # ⬅ SLOT · must be YES before publish

# --- Phrasing Constraints (from evidence file phrasing_note) ---
phrasing_constraints:
  - "Layer 2 module MUST phrase as 'a stopped wedge alone is not evidence of a housed-and-wedged staircase.' Avoid absolute statements ('always fails', 'never works') — the principle is diagnostic, not deterministic. Philip 2026-07-30."

# --- Runtime Framing (evidence_type → phrasing prefix) ---
runtime_framing:            "based on long-term joinery experience"   # from workshop_observation evidence type
---

# The Stopped-Wedge Principle

> **Rule B reminder · IMMUTABLE:** everything below the front-matter is trade content — **Philip authors, Claude does not touch.** Sections are stubbed with authoring prompts, NOT with drafted content. Delete each prompt as you write over it.

---

## 1 · One-line principle statement

<!-- AUTHOR: one sentence. The rule as a workshop manager would say it. Must respect the phrasing constraint in the front-matter (no absolute statements). -->

---

## 2 · The claim (short workshop-language framing)

<!-- AUTHOR: 2-4 sentences. What is the rule? Frame in workshop-practitioner voice, not documentation voice. Avoid "always" and "never" — the principle is diagnostic. -->

---

## 3 · The mechanism

<!-- AUTHOR: why does a wedge stop before the joint closes? Describe the three outcomes:
     1. The tread closes fully against the housing shoulder (desired).
     2. The wedge locks on friction between wedge, tread, and housing (undesired).
     3. The timber begins compressing more than the wedge advances (undesired).
     Reference the evidence file's mechanism section without copy-pasting — reframe in your own workshop voice. -->

---

## 4 · Verification method (professional practice)

<!-- AUTHOR: how does a skilled assembler check whether the joint is actually closed?
     Four-step sequence per the evidence file:
       1. Visual check — tread shoulder against housing, no line of daylight.
       2. Tread underside check — riser fully seated (from below).
       3. Glue line closed — squeeze-out at the shoulder is positive; gap is not.
       4. Only then confirm the wedge — wedge is the last check, not the first.
     Frame as diagnostic behaviour a professional teaches an apprentice. -->

---

## 5 · Failure modes (what happens if you hammer past a stopped wedge)

<!-- AUTHOR: list the consequences. From the evidence file:
       - Split wedge (repeated impact fatigues the taper section).
       - Crushed fibres (housing shoulder or tread underside crushes locally).
       - Damaged housing (routed groove profile deforms permanently).
       - Bruised string (impact marks on the visible face).
       - Failed joint over time (crushed fibres relax as the timber moves).
     Phrase each in workshop consequence-language. Don't list mechanically — narrate the way an apprentice would learn it. -->

---

## 6 · Judgement-not-verdict shape (Principle 0003 · required)

For NEX runtime composition. Author each of the four moves:

### 6.1 · State the specific case

<!-- AUTHOR: how NEX describes the customer's situation before answering.
     Example shape: "You're checking whether a housed staircase is assembled properly..."
     One or two sentences. Concrete. Doesn't presume the answer. -->

### 6.2 · Compose the relevant principles

<!-- AUTHOR: name the two or three principles that combine here.
     Suggestions from the evidence file:
       - Housed joint mechanics (wedge in tapered housing, adhesive at shoulder).
       - Wedge behaviour (three possible outcomes when the wedge stops).
       - Glue line verification (squeeze-out at shoulder is the positive sign).
     Compose them — don't stack them as bullet points. Show how they interact. -->

### 6.3 · Lead with a recommendation + visible reasoning

<!-- AUTHOR: what does an experienced assembler recommend? Why?
     Show the reasoning. Not "do X". "Do X because Y, and here's how you know Y is true." -->

### 6.4 · Name the alternative honestly

<!-- AUTHOR: what would an over-eager beginner do? Why is that wrong?
     Frame with compassion, not condescension. Reference the evidence file's line:
       "An apprentice assumes the wedge is the joint. A skilled assembler treats the wedge
        as the last check on a joint that's already closed."
     That's the shape — but write it fresh in your own voice. -->

---

## 7 · Answer templates for the questions this module answers

### 7.1 · Q055 — *"Is a wedge that won't drive any further proof the tread is fully home?"*

Homeowner variant: *"If I can't move the wedge, is the joint tight?"*

<!-- AUTHOR: NEX's runtime answer to Q055.
     Register: customer-facing but honest about the workshop reality.
     Must respect Principle 0003 four-move shape (short version — not a lecture).
     Must respect the phrasing constraint: no absolute statements.
     Suggested opening: "Not on its own — ..." (matches the honest answer from Q055 notes). -->

### 7.2 · Q056 — *"What happens if I keep hammering after a wedge has stopped?"*

Homeowner variant: *"Should I keep going or stop?"*

<!-- AUTHOR: NEX's runtime answer to Q056.
     Register: this one is more diagnostic — the customer is worried about doing damage.
     Answer needs to be practical: stop, check the four verification points, only then decide.
     Failure modes go here honestly but without alarmism. -->

---

## 8 · Cross-references

- **Companion evidence:** `evidence/regulations/housing-depths.md` — the tapered housing geometry the wedge sits in.
- **Companion evidence (planned):** wedge material choice (typically beech) · wedge angle · glue line timing — not yet authored.
- **Component Library:** `data/nex-staircase-components/families/shell_straight_closed.yaml` — the `construction: housed_closed` field consumes this principle at Phase 2 (dimensioned build-out).
- **Adjacent Layer 2 modules on the authoring queue:**
  - #2 Top Tread Machining (evidence file verified · authored_by: Junior Francis)
  - #3 String Housings (evidence file awaiting citation)

---

## 9 · Promise (per feedback_nex_brain_mission_principles_promise.md)

### 9.1 · will_do

<!-- AUTHOR: 3-5 things this module WILL do at runtime. Concrete verbs.
     Examples of shape (fill with your own content):
       - Distinguish "wedge stopped" from "joint closed" for the customer.
       - Name the four-step verification a professional uses.
       - Warn honestly about what over-hammering damages, without alarmism. -->

### 9.2 · will_not_do

<!-- AUTHOR: 3-5 things this module will NOT do — the honest boundary.
     Examples of shape:
       - Diagnose a specific staircase remotely without inspection.
       - Prescribe a repair method for a joint that has already failed (that's a different module).
       - Present workshop practice as if it were a regulation. -->

---

## 10 · Author sign-off (Rule B · Rule C)

Once every section above is filled AND every governance check reads PASS:

1. Update `authored_by:` and `authored_at:` in the front-matter.
2. Update `lifecycle_state:` from `expert_draft` to `technical_review`.
3. Update `draft_status:` from `scaffolded_awaiting_content` to `authored_awaiting_review`.
4. Nominate a `technical_reviewer:` — a second named expert (Rule C · independent verification).
5. Flip all three `rule_*_status:` fields from SLOT to explicit PASS/FAIL/REVIEW.
6. Flip `principle_0001_workshop_manager_test.status:` and `principle_0003_judgement_not_verdict.status:`.
7. Flip `professional_test.status:` — must read YES before publish.

The module cannot promote to `hammerex_nex_brain_drafts` until this sign-off is complete.

**Rule B final check:** search the module body for any sentence you didn't write yourself. If any remain, delete or rewrite. The Reference Brain contains no AI-authored trade content.
