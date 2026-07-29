---
author: Philip O'Farrell
role: Founder · staircase manufacturer · named expert for the Staircase Reference Brain
captured_at: 2026-07-28
type: expert_note
status: layer_1_evidence
intended_module: staircase_categories (foundational taxonomy — feeds every future Brain module about staircases)
rule_b_compliance: authored by named expert (Philip O'Farrell) · not AI-authored · eligible to enter the Reference Brain through the governed authoring workflow
rule_c_compliance: single named expert · every claim traceable
---

# Staircase Category Taxonomy · Five levels of complexity

*Expert taxonomy by Philip O'Farrell · captured 2026-07-28 · foundational classification that every future Brain module about staircases will reference.*

A good staircase manufacturer sees staircases as **five distinct product levels**, each with its own manufacturing complexity, skill requirements, materials mix, and price positioning. Confusing levels leads to bad estimates, bad customer conversations, and unfair comparisons.

## The five levels

| Level | Category | Typical example | Complexity |
|---|---|---|---|
| **1** | Standard straight stairs | Straight flight · 13–15 risers · standard oak or pine | Baseline |
| **2** | Winders and feature starts | Straight flight with kite winders at the bottom, or a bullnose/curtail feature start | Moderate |
| **3** | Quarter-turn / half-turn | L-shaped (quarter-turn) or U-shaped (half-turn) with intermediate landing | Higher — geometry planning · two flights coordinated |
| **4** | Sweeping radius stairs | Curved sweeping flight · often a feature staircase in a large entrance | High — curved strings + curved handrails · CNC or specialist lamination |
| **5** | Architectural grand staircases | Bespoke elliptical · helical · double-return · double-height entrance features | Highest — full custom design · engineering · specialist craftsmanship |

## Why the levels matter

A customer might ask: *"why is this staircase £25,000 when another is £6,000?"*

NEX explains by level:

```
Standard staircase (Level 1):
  Straight components
  Standard machining

Sweeping staircase (Level 4):
  Custom radius design
  Curved strings
  Curved handrail
  Specialist manufacturing
  Higher installation skill
```

The higher-level staircase isn't a marked-up Level 1 — it's a different product with different labour, different materials sourcing, different risk. Comparing them on price without acknowledging the level is exactly the trap NEX Specification Intelligence (`docs/product-constitution/roadmap/nex-specification-intelligence.md`) is built to prevent.

## Sweeping / curved staircases (Level 4-5) · the specialist zone

Sweeping stairs go by many trade names:

- Sweeping staircases
- Curved staircases
- Radius staircases
- Grand curved stairs
- Elliptical staircases
- **Helical staircases** (when they rise continuously without a central landing)

### Why more common in America than the UK

**1 · Larger house layouts.** Many American custom luxury homes have large entrance halls, double-height ceilings, open foyers — a sweeping staircase needs space, and a small UK hallway usually cannot accommodate the radius.

**2 · Architectural style.** American luxury homes often use the staircase as a centrepiece: curved oak handrails, large newel posts, decorative balusters, carpet runners, feature lighting. The staircase is designed almost like a piece of furniture.

**3 · Custom home market.** In the USA there is a large custom-build market where homeowners may spend significantly more on architectural features.

### UK availability

Yes, many high-end UK staircase manufacturers make sweeping / curved staircases. They require specialist skills at every stage — design (radius · rise · going · headroom · handrail geometry · structural support) · manufacturing (curved strings · curved handrails) · installation.

### Curved string manufacturing

A normal staircase string is straight timber. A sweeping staircase string is curved and can be produced from:

- Laminated timber layers
- CNC-cut engineered sections
- Curved plywood formers
- Specialist bending techniques

### Curved handrail manufacturing (the most skilled part)

**Laminated bent handrail** — multiple thin strips glued around a former.

- ✓ Very stable · ✓ Accurate curves · ✓ Repeatable production

**Solid curved handrail** — made from selected timber sections.

- ✓ Premium appearance · ✓ Natural grain
- ✗ Very difficult · ✗ Expensive · ✗ Requires exceptional timber

### Materials commonly used at Level 4-5

Premium sweeping stairs often use:

- **Oak** — most popular (European Oak · American White Oak)
- **Walnut** — luxury interiors
- **Mahogany** — traditional high-end work
- **Painted hardwood** — for classic American styles

### Why Level 4-5 costs more (manufacturing sequence comparison)

A normal (Level 1) staircase:

```
Cut parts
   ↓
Assemble
   ↓
Install
```

A sweeping (Level 4) staircase:

```
Survey
   ↓
3D design
   ↓
Radius calculations
   ↓
Custom templates
   ↓
Special timber selection
   ↓
Curved components manufactured
   ↓
Trial assembly
   ↓
Finishing
   ↓
Installation
```

A single curved handrail can represent many hours of skilled work. The cost differential isn't margin — it's labour + specialist material sourcing + longer manufacturing cycles + higher risk.

## Structured form (for eventual Reference Brain module)

```json
{
  "taxonomy": "staircase_complexity_levels",
  "trade": "staircase",
  "levels": [
    { "level": 1, "name": "standard_straight",       "examples": ["straight flight 13-15 risers"], "manufacturing": "cut and assemble", "risk": "low" },
    { "level": 2, "name": "winders_and_feature_starts", "examples": ["kite winders", "bullnose", "curtail"], "manufacturing": "additional geometry", "risk": "moderate" },
    { "level": 3, "name": "quarter_turn_half_turn",  "examples": ["L-shape", "U-shape"], "manufacturing": "two coordinated flights + landing", "risk": "moderate-high" },
    { "level": 4, "name": "sweeping_radius",         "examples": ["curved feature stair"], "manufacturing": "curved strings + curved handrails", "risk": "high" },
    { "level": 5, "name": "architectural_grand",     "examples": ["elliptical", "helical", "double-return"], "manufacturing": "full custom · engineered · specialist craft", "risk": "highest" }
  ],
  "rule": "Compare staircases only within the same level. A Level 1 quote and a Level 4 quote are different products, not different prices for the same product.",
  "reason": "Manufacturing sequence, labour hours, material sourcing, and risk all change materially between levels. Cross-level price comparisons mislead customers and undervalue specialist craftsmanship."
}
```

## Governance note

Same lifecycle as sibling files. Ready for promotion to Layer 2 whenever Philip chooses.

## Related documents

- `wood-intelligence-principles.md` — the trade rules that apply to every level
- `material-profile-lamwood.md` — lamwood is the enabling material for Level 4+ curved work
- `docs/product-constitution/roadmap/nex-staircase-estimation.md` — the estimation module reads level to size manufacturing hours + risk factors
- `docs/product-constitution/roadmap/nex-specification-intelligence.md` — the comparison module reads level to prevent unfair cross-level price comparisons
