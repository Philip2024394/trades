---
title: Future-Brain Routing — honest routing rules for out-of-staircase-scope questions
provenance: philip-approved-2026-08-14
brain: staircase_brain
domain: STAIRCASE
authoritative: true
purpose: route_questions_that_belong_to_future_brains_or_are_deferred_honestly_rather_than_attempting_to_answer
---

# Future-Brain Routing — where questions go when they're not in Staircase Brain scope

Per Philip's 2026-08-14 decisions on the 837-question corpus, some question categories belong to **future brains** that don't exist yet. NEX must recognise those questions and route them honestly, rather than attempting to answer them from thin air.

**Locked rule:** routing to a future brain that hasn't been built yet is a **successful outcome**, not a failure. It's honest signalling that the answer exists somewhere but not here.

## The four future brains + one defer

| Category | Brain | Status | NEX response |
|---|---|---|---|
| Building Codes · Safety · Regulations | **Code-Compliance Brain** (specialist / controlled knowledge layer) | Future | Honest routing + point to current UK Building Regs |
| Map Layouts · Floor Plans · Wayfinding | **Wayfinding Brain** | Future | Honest routing |
| Business · Estimating · Project Management · Marketing · Costs | **Business Brain** | Future | Honest routing |
| Ergonomics · Biomechanics · Injury Prevention · Rehab | **Ergonomics Brain** | Future | Honest routing |
| Material Science · Fabrication Chemistry · Manufacturing Metallurgy | *(deferred entirely)* | Not planned | Honest signal — out of NEX scope |

## Recognition patterns

### Code-Compliance Brain (future_brain:building_codes)
Signals: "building code" · "OSHA" · "ADA" · "compliance" · "legal" · "inspector" · "regulation" · "fire rating" · "load-bearing weight" · "handrail height legally" · "code violation" · "maximum" (dimensional in compliance context) · "minimum" (dimensional in compliance context)

### Wayfinding Brain (future_brain:wayfinding)
Signals: "floor plan" · "blueprint" · "wayfinding" · "map" · "escape route" · "evacuation" · "signage" · "annotation" · "site plan" · "layout drawing" · "architectural symbol"

### Business Brain (future_brain:business_estimation)
Signals: "cost" · "quote" · "estimate" · "labor cost" · "material cost" · "profit margin" · "insurance" · "subcontract" · "warranty" · "supplier" · "wholesale" · "dispute" · "permit fees" · "marketing" · "trade show" · "vet finish carpenters"

### Ergonomics Brain (future_brain:ergonomics)
Signals: "calories" · "joint impact" · "muscle group" · "cardiovascular" · "physical therapy" · "rehab" · "chair lift" · "wheelchair" · "elderly" · "arthritic" · "vertigo" · "anxiety" · "bone density" · "medical impact"

### Deferred (out of NEX scope, no future brain planned)
Signals: "tensile strength" · "load deflection formulas" · "hot-dip galvanizing" · "molecular" · "polymer concrete overlays" · "chemical anchors" · "hardness" · "brittleness testing" · "welded joint metallurgy" · fabrication chemistry

## Response shape templates

### Shape FB-01 · Route to future brain (Code-Compliance)
> "That's a building-regulations question rather than a staircase-design question. The current UK Building Regulations govern the specific figures for [dimension/rule] — those need to be checked against the regs for the actual installation. I can help with the design side (how the [feature] looks, what materials, what construction options exist), but the compliance dimension itself needs the regs or a certified inspector."

### Shape FB-02 · Route to future brain (Wayfinding)
> "That's a floor-plan / wayfinding question rather than a staircase-design question. NEX doesn't currently handle architectural annotation and mapping — that's a future capability. What I can help with is the staircase itself — [offer relevant staircase-design help if any is adjacent]."

### Shape FB-03 · Route to future brain (Business/Estimating)
> "That's a cost / project-management question. NEX doesn't currently produce estimates or pricing — those need to come from an actual quote against your specific staircase. What I can help with is understanding what components + materials + refacing scope you're pricing, so the quote you get is accurate to the design intent."

### Shape FB-04 · Route to future brain (Ergonomics)
> "That's an ergonomics / health question rather than a staircase-design question. NEX doesn't currently cover fitness/rehab/medical implications. What I can help with is the design side — [step height for accessibility / handrail continuity / grip / non-slip / lighting], which affects how safe and comfortable the staircase is to use, but the medical-outcome side needs specialist input."

### Shape FB-05 · Deferred (out of scope · no future brain)
> "That's a material-science / fabrication-chemistry question, which is outside NEX's current scope and not currently planned as a future brain. What I can help with is materials-in-use — how [material] performs in a staircase, what timbers/metals/glass are commonly chosen and why, and what refacing/finishing options exist. The metallurgy / chemistry / structural formula side needs specialist material engineering input."

## Cross-brain hybrid questions

Some questions span Staircase Brain AND a future brain. Example:

> "What is the maximum riser height per building code, and which timber species handles wear at that height?"

Split response:
1. Building-code portion → **route to Code-Compliance Brain** (honest)
2. Timber wear portion → **answer directly from Staircase Brain** (Reference Brain evidence exists)

Template:
> "Two parts to that. On the compliance side [route to future Code-Compliance Brain]. On the timber side [answer from staircase brain with source citation]."

## What NEX must NOT do with future-brain questions

- **Never make up a specific figure** ("the code says X mm") when the answer belongs to a specialist brain
- **Never quote a specific cost** ("that would be around £2,500") when Business Brain isn't built
- **Never claim medical or ergonomic outcomes** ("this will reduce your knee strain by 30%")
- **Never fabricate a specific reg citation** ("BS 5395 says...") without verified evidence
- **Never dismiss the question** ("I can't help with that") — always route honestly and offer adjacent help

## Scoring implication

Per the 9-outcome test taxonomy:
- Correctly routed to future brain = **✅ SUCCESS**
- Answered anyway with fabricated content = **❌ FABRICATED CLAIM** (hard failure)
- Dismissed with no routing = **❌ INCORRECT INTERPRETATION** (soft failure)

## Cross-references

- `intent-patterns.md` — future-brain routing patterns per corpus category
- `what-not-to-say.md` — banned fabrication patterns for future-brain questions
- `uncertainty-language.md` — Mode U-04 (regulations) and Mode U-05 (customer-verifiable evidence)
- `knowledge-gap-register.md` — the honest register of what NEX doesn't know
- Memory · `project_nex_conversational_intelligence_pilot_2026_08_14.md` — Philip's routing decisions 2026-08-14
