---
authored_by: Philip O'Farrell (E.3-E.8 roadmap + Design History Engine + No-Image-Without-Knowledge core elevation) · Master AI Engineer (schema + contracts)
authored_role: Founder platform doctrine + Master AI Engineer implementation architecture
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Phase E.3-E.8 roadmap · Design History Engine · core-principle elevation
document_version: 1.0
document_type: MEGA_DOCTRINE · roadmap doctrine + Design History addition
composes_with:
  - docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md (E.2 unified platforms)
  - docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md (E.1 studio)
  - docs/brains/nex-design-intelligence-platform-ndip-philip-2026-08-04.md (NDIP)
constitutional_rules_elevated:
  - rule_no_image_without_knowledge → CORE constitutional principle (was feedback pin)
constitutional_rules_introduced:
  - rule_design_history_is_persistent
---

# Phase E.3–E.8 Roadmap + Design History Engine + Core Elevation

## Elevation to Core Constitutional Principle

Philip 2026-08-04: *"No Image Without Knowledge — I actually think this should become one of the core constitutional principles."*

**Elevated status (this session):** the No-Image-Without-Knowledge rule was captured as a feedback pin in Phase E.1. It is now a **CORE constitutional principle**, ranked alongside Layer Separation Inviolable, Renderer Never Makes Aesthetic Decisions, and Universal Object Model.

**Restated:** every image entering Nex (uploaded · AI-generated · imported · rendered · captured · screenshot) MUST produce a UniversalAsset record. An untagged image is a constitutional violation. Voice queries about that image will fail unless the record exists.

**Restated in pipeline form (Philip's canonical framing):**

```
Instead of:                     NEX always does:

    Prompt                          Conversation
      ↓                                 ↓
    Image                            Knowledge
                                        ↓
                                    Reasoning
                                        ↓
                                  Design Document
                                        ↓
                                    Composition
                                        ↓
                                     Rendering
```

**Every image explainable.** Every recommendation reasoned. Every render reproducible.

## The Phase E.3–E.8 Roadmap

| Phase | Platform Service | Status | Runtime Location |
|-------|-----------------|--------|------------------|
| **E.2** | Spatial Intelligence | SHIPPED (2026-08-04) | `src/lib/nex/spatial/` |
| **E.3** | Material Intelligence | SHIPPING (this session) | `src/lib/nex/material-platform/` |
| **E.4** | Construction Intelligence | SHIPPING scaffold (this session) | `src/lib/nex/construction-platform/` |
| **E.5** | Scene Intelligence | SHIPPING scaffold (this session) | `src/lib/nex/scene-platform/` |
| **E.6** | Camera Intelligence | SHIPPED (in Geometry Platform) | `src/lib/nex/geometry-platform/camera-object.ts` |
| **E.7** | Voice Intelligence | SHIPPING contract (this session) | `src/lib/nex/voice-platform/` |
| **E.8** | Reality Advisor | SHIPPED (2026-08-04 · starter rules) | `src/lib/nex/reality-advisor/` |
| **E.9** | Design History Engine | SHIPPING (this session · NEW addition) | `src/lib/nex/design-history/` |

## Phase E.3 · Material Intelligence Platform

**Every material becomes a first-class intelligence object.**

Beyond the Geometry Platform's `MaterialObject` (which handles PBR + surface properties for rendering), the Material Intelligence Platform holds the DOMAIN knowledge that every downstream service needs:

- **Physical:** texture · colour · density · roughness · reflectivity · transparency.
- **Regulatory:** fire_rating (Class A · B · C · D) · slip_rating (R9-R13) · VOC content.
- **Sustainability:** carbon_kg_per_kg · recyclability · FSC status · water_usage_manufacture.
- **Cost:** cost_per_m2 · cost_per_m3 · cost_per_linear_m · price_stability.
- **Maintenance:** care_frequency · care_notes · expected_lifespan_years · patina_behaviour.
- **Manufacturers:** authorised suppliers · product_code · lead_time_weeks · minimum_order.

One `oak_american_white_satin_lacquer` definition drives every render · every quotation · every carbon report · every fire regulation check.

## Phase E.4 · Construction Intelligence Platform

**The engineering brain.** Understands:

- Stair regulations (Building Regs Part K · rise/going limits · headroom · handrail heights).
- Kitchen clearances (worktop overhang · appliance clearances · door swing radii).
- Cabinet spacing (carcass gaps · scribe allowances · plinth heights).
- Appliance requirements (oven ventilation · integrated fridge cooling · induction hob distances).
- Structural constraints (load-bearing walls · ceiling loads · floor deflection limits).
- Fixings (screw types · anchor selection · fixing centres).
- Tolerances (nominal vs. built · shrinkage allowances).
- Manufacturability (minimum panel size · cutting-list optimisation · edge banding limits).

**Contract:** `check(design, context) → ComplianceReport` with rule citations · confidence · advice. Composes with Reality Advisor · never mutates the design.

## Phase E.5 · Scene Intelligence Platform

**Complete rooms · not isolated objects.**

```
Room
  ├── Walls (structural + partition)
  ├── Floor (material · pattern · under-floor build-up)
  ├── Ceiling (height · features · services)
  ├── Windows (position · size · glazing)
  ├── Doors (position · swing · frame)
  ├── Lighting (fixtures · switches · circuits)
  ├── Furniture
  └── Products (kitchen · staircase · storage · appliances)
```

Every room composable · every element addressable · every relationship known.

## Phase E.6 · Camera Intelligence

**Already SHIPPED** as part of the Geometry Platform (`src/lib/nex/geometry-platform/camera-object.ts` · 10 profiles: marketing · website · instagram · flyer · technical · construction · exploded · isometric · floorplan · section).

## Phase E.7 · Voice Intelligence Platform

**First-class platform service** (Philip 2026-08-04). Voice answers:

- *"Why did you choose oak here?"* → reads the Design Document's Provenance chain.
- *"How wide is that staircase?"* → reads the Spatial Intelligence Measurements.
- *"What material is this?"* → reads the Material Intelligence entry.
- *"Why did you position the island there?"* → reads the Composition + Recommendation reasoning.
- *"Can this be built?"* → reads the Reality Advisor report.
- *"Show alternatives"* → reads the Recommendation Engine's other options.

**Constitutional rule (Philip · reinforced):** Voice reads from the Design Document + Render Manifest + Reality Report · **never invents** an explanation post-hoc.

## Phase E.8 · Reality Advisor

**Already SHIPPED** (2026-08-04) with 7-level realism classification + 7-score validation + starter concern rules. Phase E.4 Construction Intelligence extends the rule catalogue.

## NEW · Design History Engine (Philip's explicit addition)

Philip 2026-08-04: *"Every change becomes a recorded operation rather than replacing the previous state."*

**Contract:**

```
Version 1
    ↓ apply(op: ChangeHandrail)
Version 2
    ↓ apply(op: ChangeFloor)
Version 3
    ↓ apply(op: ChangeLighting)
Version 4
```

**Enables:**

- **Unlimited undo/redo** — operation log · not state replacement.
- **Branching design concepts** — fork a version · explore an alternative.
- **Comparing alternatives** — diff two versions · surface the delta.
- **Collaboration** — merge branches with conflict resolution.
- **Audit history** — every change carries who/why/when.
- **Explaining design evolution** — Voice answers *"why did the design evolve?"* by reading the operation log.

**Constitutional rule:** every change to a Design Document MUST flow through the Design History Engine · never in-place mutation.

**Location:** `src/lib/nex/design-history/` (SHIPPED this session).

## Two-Layer Rule (constitutional reminder)

Philip 2026-08-04 · elevated: *"Continue to protect rigorously the principle you've already introduced — the renderer should never make design decisions. Keeping planning · composition · validation · and rendering as separate responsibilities will make the platform much easier to extend as it grows."*

This composes with:
- `feedback_nex_layer_separation_inviolable.md`
- `feedback_nex_renderer_no_aesthetic_decisions.md`

**Every future phase must honour both.**

## The Complete Platform Stack (2026-08-04 · post E.3-E.9 scaffold)

```
Knowledge Platform                                (shipped · retrieve+FAQ+articles)
      ↓
Reasoning Platform                                (shipped · recommend + selectBanner)
      ↓
Planning Platform                                 (shipped · pipeline · Render Planner)
      ↓
Reality Advisor Platform                          (E.8 · shipped · starter rules)
      ↓
Composition Platform                              (E.1 · shipped · detectors)
      ↓
Design Platform + Design Object Model             (shipped · Fonts · Sizes · Primitives · Tree)
      ↓
Universal Object Model + Geometry Platform        (E.2 · shipped · 10 cameras · 8 lightings · 12 render targets)
      ↓
Material Intelligence Platform                    (E.3 · shipping this session)
      ↓
Construction Intelligence Platform                (E.4 · shipping scaffold)
      ↓
Scene Intelligence Platform                       (E.5 · shipping scaffold)
      ↓
Asset Intelligence Platform                       (shipped + Hero Image extension)
      ↓
Spatial Intelligence Platform                     (E.2 · shipped)
      ↓
Rendering Platform                                (shipped · SVG · 11 more render targets pending)
      ↓
Voice Intelligence Platform                       (E.7 · shipping contract)
      ↓
Design History Engine                             (E.9 · shipping this session · NEW)
      ↓
Delivery Platform                                 (SVG shipped · PNG/PDF/HTML pending)
      ↓
Learning Platform                                 (pending · feeds back into Knowledge)
```

## Governance

- Every future PR must classify its change into ONE platform service · never smeared.
- Every image MUST become structured knowledge (CORE constitutional).
- Every design change MUST flow through Design History (CORE constitutional).
- Every renderer PR must demonstrate zero aesthetic decisions (CORE constitutional).
- Every layer boundary is inviolable (CORE constitutional).
- Every measurement carries its confidence (CORE constitutional).
- Every recommendation traces to a named expert (Rule c).
