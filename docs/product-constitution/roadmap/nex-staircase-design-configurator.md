# Future Module Brief · NEX Staircase Design Configurator

**Status:** Roadmap · not scheduled
**Source:** Philip O'Farrell · 2026-07-28
**Depends on:** Materials v1 (frozen) · Staircase Estimation (shipped) · Staircase Reference Brain content (staircase-design-principles · staircase-category-taxonomy · wood-intelligence · material-profiles) · multimodal LLM (for photo analysis · already available)
**Category:** Customer-facing visualisation · pre-manufacture design collaboration

---

## The principle this module encodes

Old thinking: *"A staircase connects floors."*
Future thinking: *"The staircase is a designed piece of furniture inside the home."*

This module gives every customer the value an experienced staircase designer would bring — visualisation of their actual hallway, design options that respect their building, and price-impact intelligence before manufacture. The workshop then receives a **well-qualified customer** with realistic expectations, an agreed design language, and a budget conversation already had.

## The workflow

Standard NEX six-step (Principle 0002):

### 1 · Customer describes what they want (in their words)

Voice · photo · upload · text — same first-class equals as everywhere on the platform. Owner uploads:

- Hallway photos (multiple angles)
- Rough measurements (or later: measured survey attached)
- Existing doors · flooring · style context
- Budget range (optional but improves the result)
- Style preference (optional — traditional · modern · luxury · unsure)

### 2 · NEX understands the business context

Before drafting anything, NEX composes what it already knows:

- Building context from the photos (door style · flooring · wall treatment · ceiling height cues)
- Staircase complexity level feasible for the space (Level 1 straight vs Level 4 sweeping — see `staircase-category-taxonomy.md`)
- Which materials the workshop currently holds in Memory + Stock
- Suppliers' typical lead times
- Reference Brain principles that apply (all nine design principles · all nine wood principles)

### 3 · NEX prepares three design options

Three options, deliberately spanning cost bands, presented as **compositions**, not verdicts:

```
Option A · Traditional Oak
  Closed string · turned newels · traditional balusters · oak handrail
  Matches your existing 4-panel oak doors.
  Cost level: premium

Option B · Modern Traditional Bridge (Shaker-style)
  Oak treads · square newels · square balusters · glass panels
  Modern-traditional look sitting between styles.
  Cost level: medium-premium

Option C · Contemporary
  Steel spine · oak treads · glass balustrade · LED tread lighting
  Modern statement · needs pre-agreed structural opening.
  Cost level: premium (design + engineering added)
```

Each option carries reasoning drawn from `staircase-design-principles.md` (Principle G · architectural family match) and `staircase-category-taxonomy.md` (which complexity level).

### 4 · Owner reviews with visualisation

Each option shows:

- Rendered visualisation set into the customer's actual hallway photo
- Component breakdown (species · sections · dimensions · quantities)
- What NEX matched to the door style + why (with Principle G evidence)
- Estimated cost band (relative language only per HARD LAW — no specific £ figures without a survey)
- Manufacturing lead-time band
- Risk factors (access · site conditions · uncommon materials)

### 5 · Owner approves a direction

Not a manufacturing commit — a design direction commit. The staircase manufacturer receives a briefed customer with a preferred option, ready for the professional site survey.

### 6 · Handoff to the workshop's estimation workflow

Feeds directly into `nex-staircase-estimation.md`'s six-stage flow. Design decisions become inputs · not restart-from-zero conversations.

## What this module does NOT do

- ❌ Does not replace the human staircase designer for luxury bespoke work · it prepares the customer so the human designer's time is spent on the interesting decisions
- ❌ Does not commit manufacturing without a professional site survey · the visualisation is preliminary
- ❌ Does not publish specific £ figures to the customer (HARD LAW · relative language only)
- ❌ Does not invent trade principles · every design recommendation traces back to authored Reference Brain content (Rules A/B/C)
- ❌ Does not silently pick a winner · Principle 0003 · always three options with the reasoning visible

## The three components this makes concrete

**Visualisation** — put the proposed staircase in the customer's actual hallway photo, matched to existing doors and floor. This is where the *"see it before it's built"* promise lives.

**Composition** — every design suggestion is composed from Reference Brain principles (design + wood + market + taxonomy), never a lookup. When the customer asks *"why did you suggest that handrail?"*, the answer is a real reasoning chain.

**Handoff** — the workshop receives structured design intent, not a wishlist. Estimation and manufacturing start with a shared understanding.

## Quality-gate stance (all 12 must pass)

- **Q1 (feels like ops manager · here: like a senior designer):** Passes when the presentation reads as a design conversation, not a product configurator.
- **Q2 (NEX did the work first):** Passes only when three composed options exist before the customer types anything else.
- **Q3 (owner reviews rather than fills forms):** Passes when the customer's role is choosing a direction, not filling a spec sheet.
- **Q7 (confidence > automation):** Passes when *"a survey is required to confirm"* is on every visualisation.
- **Q8 (uncertain → ask):** If the photo doesn't show enough of the door style, asks one specific follow-up rather than assuming.
- **Q11 (workshop manager test):** Passes when a real staircase designer looks at the output and says *"yes, that's the conversation I would have."*
- **Q12 (traceability):** Every design suggestion links to which principle · which taxonomy level · which material profile · which door-style mapping produced it.

## Design constraints

- Three options only. Never one · never seven. Three forces the *"leading recommendation + alternative"* shape from Principle 0003.
- Every recommendation carries the *why* — which principle led to it. Never present a suggestion without its reasoning.
- Cost bands only in customer view (relative language). Full pricing lives in the workshop's internal Estimation module.
- Visualisation quality must be honest. If the AI-generated render is stylised, say so. Never mislead the customer about what the final result will look like.
- Reference Brain content is authoritative. If a principle disagrees with a fashion trend, the principle wins.

## Cross-references

- `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-design-principles.md` — the nine design principles this module composes from
- `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-category-taxonomy.md` — the five-level complexity classification (which levels are feasible for the space)
- `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-market-trends.md` — the market segments and where the design conversation typically lands
- `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/wood-intelligence-principles.md` — the nine wood principles that gate material suggestions
- `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/material-profile-lamwood.md` — Level 4+ curved handrail work depends on this profile
- `docs/product-constitution/principles/0003-answers-as-judgement-not-verdict.md` — the composition rule this module lives under
- `docs/product-constitution/roadmap/nex-staircase-estimation.md` — the workshop-side estimation flow this feeds into
- `docs/product-constitution/roadmap/nex-specification-intelligence.md` — comparison across design options composes with this module
