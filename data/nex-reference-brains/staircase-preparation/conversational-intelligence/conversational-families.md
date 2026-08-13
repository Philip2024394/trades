---
title: Conversational Families — 14 question types per concept
provenance: philip-approved-2026-08-14 (full-corpus expansion directive)
brain: staircase_brain
domain: STAIRCASE
authoritative: true
purpose: express_each_major_concept_as_a_family_of_natural_ways_customers_arrive_at_it
---

# Conversational Families — 14 question types per concept

Every major staircase concept is a **conversational family**, not a single canonical question. NEX must recognise a concept whether the customer arrives via a direct technical question, a casual off-hand phrase, a poorly-worded description, an incomplete thought, a follow-up from earlier in the conversation, or an image request.

## The 14 question types

For every major concept in the Reference Brain, NEX should be able to handle:

1. **Direct technical** — "What is a bullnose starting step?"
2. **Casual** — "That round first step — what's it called?"
3. **Incomplete** — "The first step..."
4. **Poorly worded** — "Can the bottom bit stick out or something?"
5. **Customer terminology** — "The fat first step by the door."
6. **Trade terminology** — "Curtail starting step with volute detail."
7. **Design-focused** — "What starting step would look good in a Victorian house?"
8. **"Why" question** — "Why do some staircases have a rounded first step?"
9. **Comparison** — "What's the difference between a bullnose and a curtail?"
10. **Recommendation** — "What starting step would you recommend?"
11. **Feasibility** — "Can I have a curved first step against a wall?"
12. **Image request** — "Show me different bullnose starting steps." `[image_search]`
13. **Follow-up** — "OK, that one — what would it look like with oak treads?" (context: earlier turn established starting step type)
14. **Continuation** — mid-conversation refinement without restarting the topic

## Concept families in scope

Every family below has evidence in the existing Reference Brain. Each family's canonical Reference Brain source is noted.

### Starting Steps
Sources: `starting-steps-knowledge-2026-08-14.md` · `starting-steps-types-carpet-and-design-2026-08-14.md`
Sub-concepts: 20 named types · construction/design relationship · carpet-and-starting-step tendency · bullnose · curtail · volute · extended tread · square platform · double stacked · combined · flush · newel relationship · baluster arrangement · flooring transition

### Landing Railings
Source: `landing-railings-continuity-and-construction-2026-08-14.md` + `landing-railings-knowledge-2026-08-14.md`
Sub-concepts: continuity principle · three-way base-rail rule · top-newel transition · intermediate newels · corner-newel structural fixing · baluster heights · baluster spacing · two-per-tread convention · handrail transitions · half-newel against wall

### Handrail Components
Source: `staircase-handrail-components-2026-08-14.md`
Sub-concepts: moulded profile · turned newel · swan-neck/gooseneck · volute · wall-mounted kit · brackets · rosette · fillets · matched pairs · wedges

### Newel Posts + Caps
Source: `newel-caps-knowledge-2026-08-14.md`
Sub-concepts: 6 cap families (flat/ball/pyramidal/chrome/stainless/matt-black) · newel post shapes (turned/square/panelled) · cap swap refurbishment · LED-integrated newels

### Balusters / Spindles
Source: batch 8 gallery + `landing-railings-continuity-and-construction-2026-08-14.md`
Sub-concepts: 12 baluster families (turned timber · square timber · matt-black metal · brushed stainless · slim/chunky · glass · horizontal cable · horizontal slat · woven mesh · wrought-iron cage · perforated · cane/rattan) · spacing · heights · child safety

### Stringers + Framework
Source: `staircase-handrail-components-2026-08-14.md` (limited) + `landing-railings-continuity-and-construction-2026-08-14.md` §2 (three-way rule)
Sub-concepts: cut-string vs closed-string vs open-string · mono-stringer · dual-stringer · central spine · exposed vs housed · scroll brackets

### Treads + Risers + Nosings
Source: batch 9 timber species + batch 10 component product shots
Sub-concepts: timber species (oak/pine/walnut/mahogany/maple/beech/ash) · pencil-round nosing · bullnose nosing · thickness · open vs closed riser · contrasting materials · non-slip

### Carpet + Step Mats + Runners
Source: `step-mats-knowledge-2026-08-14.md` + `starting-steps-types-carpet-and-design-2026-08-14.md` Part 3
Sub-concepts: full carpet · runner · step mats · Hollywood vs waterfall · exposed-timber-with-carpet · carpet on bullnose · pattern selection · wool vs synthetic

### Refacing Scope
Source: `refacing-before-after-cards-and-trade-content-taxonomy-2026-08-14.md` + `starting-steps-knowledge-2026-08-14.md` §16
Sub-concepts: partial refacing · cap-only swap · spindle swap · handrail replace · sanding + refinishing · before/after documentation

### Under-Stair Uses
Source: Batch 7 + Batch 10 under-stair scenes
Sub-concepts: storage (drawers/cupboards/shoes) · workspace (desk/office) · seating (bench/nook) · features (wine/aquarium/library/reading nook/pet crate)

### Timbers + Materials-in-Use
Source: `staircase-timbers-2026-08-14.md` + batch 9 timber samples
Sub-concepts: 5 canonical species (mahogany · maple · beech · pine · oak) + walnut · sapele · reclaimed · shou sugi ban · MDF paint-grade · cost tiers · style matching

### Lighting Integration
Source: multiple batches (LED newels · LED baserail · LED cove wash · LED step lights · LED-inset balusters)
Sub-concepts: under-nosing LED · cove wash · step lights · LED newel strip · integrated baluster LED · switch/wiring · smart integration

### Layout Types (spatial)
Source: batch galleries showing helical · spiral · straight · L-shape · U-shape · winder · switchback · dog-leg · cantilever · floating · scissor
Sub-concepts: 15+ layout types

## How the 14 question types + concept families interact

For each family × each question type, NEX should have at minimum:
- Recognition (glossary + question-variations)
- Routing (intent-patterns)
- Response shape (explanation + recommendation + uncertainty patterns)

Where a specific family × question-type combination is not yet supported → flag in `knowledge-gap-register.md` as a genuine gap. Do NOT fabricate to fill.

## Cross-references

- `customer-language-glossary.md` — customer-terminology entries per family
- `question-variations.md` — natural phrasings per family
- `intent-patterns.md` — routing per family
- `customer-intent-scenarios.md` — situational patterns
- `image-retrieval-patterns.md` — image-request handling for each family
- `knowledge-gap-register.md` — genuine gaps per family
- All Reference Brain sources cited above
