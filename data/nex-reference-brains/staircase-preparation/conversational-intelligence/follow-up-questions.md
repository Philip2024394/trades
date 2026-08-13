---
title: Follow-Up Questions — clarifying questions per topic gap
provenance: philip-approved-2026-08-14
brain: staircase_brain
domain: STAIRCASE
authoritative: true
purpose: model_conversational_clarification_rather_than_information_dumping
---

# Follow-Up Questions — the clarifying-questions library

NEX asks a useful clarifying question when the missing piece would change the answer. It does not ask questions to seem thorough, and it does not dump options to compensate for missing information.

**Locked rules:**
- Every follow-up question is tied to a specific knowledge gap that changes the answer
- Maximum three follow-ups in a single turn (usually one, sometimes two)
- Never ask something the customer has already told you
- Never ask something the answer to which wouldn't change your recommendation
- Questions are conversational, not procedural

---

## Starting-step follow-ups

### FU-SS-01 · Construction-type gap
**When to ask:** customer wants a rounded/bullnose/curtail starting step without specifying construction type.
**Ask:** "Is the staircase open on one side, open on both sides, or against a wall?"
**Why:** determines whether the wrap can be on one or both sides (the wall blocks outward projection on the wall side).
**Source:** `starting-steps-knowledge-2026-08-14.md` §1

### FU-SS-02 · Style-direction gap
**When to ask:** customer wants a "feature" or "nice" starting step without specifying style.
**Ask:** "What's the rest of the staircase leaning toward — traditional, modern, or somewhere between?"
**Why:** the starting-step type should belong to the same design language (turned newel + volute + bullnose = traditional; square platform + minimalist newel = modern).
**Source:** `starting-steps-types-carpet-and-design-2026-08-14.md` Part 5 §5.1

### FU-SS-03 · Carpet-intent gap
**When to ask:** customer wants a starting step and hasn't mentioned finish.
**Ask:** "Will the rest of the staircase be carpeted, or left as exposed timber?"
**Why:** on carpeted staircases the timber first step commonly remains exposed as a feature (Part 3 tendency); a fully carpeted feature step requires pre-manufacture planning.
**Source:** Part 3

### FU-SS-04 · Floor-space gap
**When to ask:** customer wants an extended or projecting starting step and the space isn't obvious.
**Ask:** "How much floor space is available at the bottom of the stairs? A projecting step needs somewhere to project into."
**Why:** narrow hallways may not allow the projection.
**Source:** Part 4 §4.5 (proportions) + Part 5 §5.11 (house-scale match)

### FU-SS-05 · Single vs double starting step
**When to ask:** customer describes a "grand" or "wider" entry and both single and double-stacked options apply.
**Ask:** "Are we thinking a single feature step, or two stacked steps — the second option needs more floor space but gives a more substantial entry."
**Source:** Part 1 §5 + §20 (contemporary minimalist)

### FU-SS-06 · Feature-step + carpet type
**When to ask:** customer wants an exposed feature step on a carpeted staircase.
**Ask:** "Is it a full carpet or a runner down the centre? A runner works particularly well with an exposed timber first step."
**Source:** Part 3 §3.5

---

## Landing-railing follow-ups

### FU-LR-01 · Construction type (closed-string vs cut-string)
**When to ask:** customer asks about the base rail and doesn't specify construction.
**Ask:** "Is the staircase a closed-string design (the string covers the ends of the treads and risers) or a cut-string (the sides of the treads are exposed)? That affects whether the flight itself needs a base rail."
**Source:** `landing-railings-continuity-and-construction-2026-08-14.md` §2 (three-way rule)

### FU-LR-02 · Landing dimensions
**When to ask:** customer describes a "long" landing without specifying how long.
**Ask:** "Roughly how long is the landing? On a long run I'd suggest an intermediate newel rather than one unsupported handrail from end to end."
**Source:** §4 (avoiding long unsupported handrail runs)

### FU-LR-03 · Newel fixing substrate
**When to ask:** customer wants to know how the corner newel fixes.
**Ask:** "What's underneath the corner where the newel will sit — solid floor joists, a beam, or just floorboards over plasterboard? The fixing needs to reach structural material."
**Source:** §5 (corner newel structural fixing)

---

## Handrail follow-ups

### FU-HR-01 · Wall-mounted vs newel-mounted
**When to ask:** customer asks about handrail brackets without specifying.
**Ask:** "Is the handrail being fixed to a wall, or is it part of the balustrade with newel posts at each end?"
**Source:** `staircase-handrail-components-2026-08-14.md` §6

### FU-HR-02 · Handrail profile
**When to ask:** customer wants a new handrail without specifying feel/style.
**Ask:** "Are you leaning toward a traditional moulded handrail (with the finger grooves + spindle groove underneath) or a simpler modern square/round profile?"
**Source:** §1

### FU-HR-03 · Volute or plain return
**When to ask:** customer wants the handrail to end at the bottom newel and hasn't specified.
**Ask:** "At the bottom, do you want the handrail to curl into a volute (the traditional scroll) or use a plain curved return (the modern minimal finish)?"
**Source:** §5

---

## Balustrade follow-ups

### FU-BAL-01 · Style direction
**When to ask:** customer describes wanting a change to the balustrade appearance.
**Ask:** "Do you want to stay traditional (turned timber spindles, decorative newels) or move modern (square spindles, matt black metal, glass panels)?"
**Source:** landing-railings § + starting-steps-types §5.1

### FU-BAL-02 · Baluster material family
**When to ask:** customer wants "different" balusters without direction.
**Ask:** "Turned timber, plain square timber, matt black metal, brushed stainless, or glass panels — any of those catch your eye?"
**Source:** landing-railings-knowledge (batch 8 gallery listing all 12 families)

---

## Carpet + step-mats follow-ups

### FU-CM-01 · Runner vs full carpet
**When to ask:** customer says they'll "carpet the stairs" without specifying.
**Ask:** "Full carpet (everything covered) or a runner down the centre (timber margins visible on the sides)? That affects what works on the first step."
**Source:** `step-mats-knowledge-2026-08-14.md` §1

### FU-CM-02 · Timber-showing intent
**When to ask:** customer wants "some timber showing" without specifying which parts.
**Ask:** "Which timber do you want to keep visible — the tread margins beside the carpet runner, the first step as a feature, or all of it (which would point toward step mats rather than a runner)?"
**Source:** Same

### FU-CM-03 · Bullnose interaction
**When to ask:** customer plans to carpet a staircase that has a bullnose starting step.
**Ask:** "The first step is a bullnose — do you want the carpet to try to wrap the curve, or would you rather leave the bullnose in timber as a feature step and start the carpet on the second tread up?"
**Source:** `starting-steps-types-carpet-and-design-2026-08-14.md` Part 3.3

---

## Refacing follow-ups

### FU-RF-01 · Scope
**When to ask:** customer wants to "refurb" without specifying what.
**Ask:** "Which parts of the current staircase are you happiest to keep, and which are the ones that bother you — the treads, the newel posts, the spindles, the handrail, or the finish?"
**Source:** `refacing-before-after-cards-and-trade-content-taxonomy-2026-08-14.md` §1

### FU-RF-02 · Current condition
**When to ask:** customer describes refurb intent but the underlying condition isn't clear.
**Ask:** "Is the existing timber in good shape or does it need sanding and re-finishing before anything new goes on top?"
**Source:** condition-survey scenes (batch 10 §1.8)

### FU-RF-03 · Newel-cap-only scope
**When to ask:** customer asks about the smallest possible change.
**Ask:** "Are you thinking full refacing, or just a specific detail like the newel caps or the spindles?"
**Source:** `newel-caps-knowledge-2026-08-14.md` §6

---

## Under-stair follow-ups

### FU-US-01 · Usage priority
**When to ask:** customer asks what to do with the under-stair space.
**Ask:** "Are you thinking storage (drawers, shelves, cupboards), a small workspace (desk, home office), or a feature (wine cellar, reading nook, display)?"
**Source:** batch 7 + batch 10 under-stair scenes

### FU-US-02 · Space dimensions
**When to ask:** customer wants under-stair ideas and the space isn't described.
**Ask:** "Roughly how tall is the space at the highest point, and how deep? That determines which uses actually fit."
**Source:** same

---

## Meta-follow-up rules

- **Only ask when the missing information changes the answer.** If it doesn't matter, don't ask.
- **Ask in natural language.** "How much floor space is available?" beats "Please specify the floor area available at the base of the staircase in square metres."
- **Ask one main question, one supporting question.** Never five in one turn.
- **Combine related follow-ups when they naturally fit.** E.g. style + carpet in one sentence: "What style is the rest of the staircase, and will it be carpeted?"
- **Never ask something the customer has already answered.** Track what they've told you.
- **Never punish the customer for not knowing the answer.** If they say "I don't know how tall the space is," offer to work with typical dimensions.

## Cross-references

- `intent-patterns.md` — which patterns trigger which follow-ups
- `customer-intent-scenarios.md` — situational scenarios that use these follow-ups
- `explanation-patterns.md` — how NEX explains WHY it needs the answer to the follow-up
- All Reference Brain sources cited
