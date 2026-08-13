---
authored_by: Philip O'Farrell (8th library directive · handrail/newel taxonomy expansion · 8 component specimens)
authored_role: Founder platform doctrine + Master AI Engineer schema
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Design Genome 8th library
document_version: 1.0
document_type: MEGA_DOCTRINE · Construction Rules Library + expanded taxonomies
composes_with:
  - docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md (7-library Design Genome)
  - docs/brains/nex-object-dna-subcomponent-hierarchy-philip-2026-08-04.md (subcomponent slots)
  - docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md (Reality Advisor)
---

# Construction Rules Library · The 8th Design Genome Library

## The Directive (Philip 2026-08-04)

*"One area that could become a major long-term advantage is introducing an eighth library dedicated to Construction Rules. This would store engineering and manufacturing constraints rather than visual patterns."*

Philip's examples:
- Bullnose step requires an entrance system.
- Handrail height must remain continuous.
- Closed string cannot be paired with certain open-riser constructions.
- Volute handrail requires a volute newel.
- Glass balusters are incompatible with grooved timber handrails.
- Maximum spacing between balusters.
- Building code constraints by region.

*"Unlike the relationship graph ('A connects to B'), this library would encode WHY combinations are valid or invalid and allow automatic validation before rendering or manufacturing."*

## The Three-Way Distinction

Three related-but-distinct platforms handle three different concerns. New PRs MUST route to the correct one.

| Platform | Purpose | Answers |
|----------|---------|---------|
| `relationship-library/` | Typed edges (requires · mounted_in · inside · used_for · supports) | "How is A related to B?" |
| `construction-platform/` | Building Regulations · code compliance (Part K rise/going/pitch · sphere rule · handrail height min/max) | "Does this specific measurement satisfy the regs?" |
| **`construction-rules/`** (NEW · this session) | **Component-combination validity · engineering & manufacturing constraints · pre-render validation** | **"Is this combination of components a valid design?"** |

`relationship-library` connects nouns. `construction-platform` checks numbers. `construction-rules` gates combinations.

## Design Genome · Now 8 Libraries

```
Object Library          (physical objects · SHIPPED)
    ↓
Pattern Library         (compositions · SHIPPED)
    ↓
Relationship Library    (typed edges · SHIPPED)
    ↓
Campaign Library        (campaign → outputs · SHIPPED)
    ↓
Construction Library    (Building Regs compliance · SHIPPED via construction-platform)
    ↓
Construction Rules Library  (combination validity · SHIPPING this session · NEW · 8th library)
    ↓
Style Library           (Design DNA · SHIPPED)
    ↓
Manufacturing Library   (manufacturing-platform · SHIPPED)
```

**Every upload strengthens all EIGHT.** The 8th library gets stronger every time a valid combination is observed (rule fires without violations) OR a manufacturer flags an invalid combination (rule fires with a violation and the fix is recorded).

## Construction Rule Schema

```typescript
type ConstructionRule = {
  rule_id: string;                       // e.g. "volute_handrail_requires_volute_newel"
  domain: "staircase" | "kitchen" | "wardrobe" | "roofing" | "general";
  severity: "advisory" | "warn" | "required" | "impossible";
  citation?: string;                     // e.g. "Building Regs Part K" · "BS 585-1 · timber stairs"
  reason: string;                        // WHY this rule exists

  // Conditions
  if_present: readonly ComponentPredicate[];   // rule triggers when ALL of these match
  then_requires?: readonly ComponentPredicate[]; // required to also be present
  forbids?: readonly ComponentPredicate[];       // must NOT be present
  warns?: string;                              // human-readable warning if not addressed
  suggested_fix?: string;

  provenance: { named_expert: string; authored: string };
};

type ComponentPredicate = { slot: string; value: string };  // matches subcomponent slot/value

type CombinationSpec = { slot: string; value: string }[];  // proposed combination

type RuleFiring = {
  rule_id: string;
  severity: ConstructionRule["severity"];
  reason: string;
  status: "satisfied" | "violated";
  missing_required?: readonly ComponentPredicate[];
  forbidden_present?: readonly ComponentPredicate[];
  suggested_fix?: string;
};

type ValidationReport = {
  combination: CombinationSpec;
  firings: readonly RuleFiring[];
  passes: number;
  advisories: number;
  warns: number;
  required_failures: number;
  impossible_failures: number;
  overall: "valid" | "advisory_only" | "has_warnings" | "invalid" | "impossible";
};
```

## Authored Seed Rules (SHIPPING this session)

15+ rules covering Philip's examples. Every rule Rule-c attributable to Philip O'Farrell 2026-08-04. Every rule has a REASON so future consumers (Voice · Reality Advisor · Manufacturing Planner) can EXPLAIN violations.

### Staircase combination rules

1. **volute_handrail_requires_volute_newel** — if `handrail_termination=scroll_volute` then requires `newel_family in [volute_turned · volute_turned_twin]`.
2. **glass_balusters_incompatible_with_grooved_handrail** — if `balustrade_system=glass` then forbids `handrail_profile=traditional_moulded_ploughed`.
3. **pyramid_cap_requires_box_newel** — if `newel_cap=pyramid` then requires `newel_family in [raised_panel_box · box_newel · chamfered_box]`.
4. **acorn_finial_incompatible_with_modern_square_newel** — if `newel_finial=acorn` then forbids `newel_family=modern_square`.
5. **bullnose_requires_entrance_system** — if `starting_step_shape=bullnose_curved_front` then requires `entrance_system present`.
6. **closed_string_incompatible_with_no_riser** — if `structural_system=closed_string` then forbids `riser_type=open_no_riser_boards`.
7. **mono_string_requires_open_riser** — if `structural_system=mono_string` then requires `riser_type=open`.
8. **external_steel_switchback_requires_galvanised** — if `structural_system=steel_switchback` and `environment=exterior` then requires `finish in [hot_dip_galvanized · powder_coated_over_galvanized]`.

### Handrail combination rules

9. **handrail_fitting_gooseneck_requires_half_landing** — if `handrail_fitting=gooseneck` then requires `flight_type in [half_landing · half_turn · quarter_turn_with_landing]`.
10. **volute_start_requires_curtail_step** — if `handrail_start=volute` then requires `entrance_system in [curtail_step · single_bullnose · double_bullnose]`.
11. **handrail_ploughed_requires_fillets** — if `handrail_profile=traditional_moulded_ploughed` then requires `balustrade_component=fillets`.
12. **handrail_solid_blank_wall_mount_only_unless_machined** — if `handrail_type=solid_blank` and `manufacturing_state=blank` then requires `installation=wall_mounted OR further_machining_planned`.

### Regulatory-cross rules

13. **domestic_handrail_height** — if `use=primary_domestic` then requires `handrail_height_mm between 900-1000` (composes with `construction-platform` numeric check).
14. **baluster_sphere_rule** — if `balustrade present` then requires `baluster_gap_mm ≤ 100` (composes with `construction-platform`).
15. **commercial_guardrail_height** — if `location=commercial` and `has_guardrail` then requires `guardrail_height_mm ≥ 1100`.

## Expanded Handrail Family Taxonomy (Philip 2026-08-04)

Per Philip's directive · the handrail vocabulary expands into these distinct object subfamilies. Object Library `handrail_type` subcomponent slot uses these values:

- straight_rail
- ramp_rail
- landing_rail
- over_easing
- under_easing
- gooseneck
- volute
- double_volute
- monkey_tail
- horizontal_turnout
- quarter_turn_fitting
- half_turn_fitting
- level_quarter_turn
- mopstick / contemporary_profile

## Expanded Newel Cap / Finial Taxonomy

Object Library `newel_cap` and `newel_finial` subcomponent slots:

**Caps** — flat · pyramid · stepped_pyramid · chamfered · bun · contemporary_square · metal · decorative.
**Finials** — ball · acorn · urn · vase · gothic · flame · turned_finial · contemporary_cube · metal_finial.

## Expanded Newel System Hierarchy

```
NEWEL_SYSTEM
├── Newel Posts (square · raised_panel · stop_chamfered · turned_victorian · colonial · box_newel · contemporary)
├── Newel Caps (flat · pyramid · ball · acorn · bun · urn · contemporary_square · metal)
├── Newel Bases
├── Newel Connectors
└── Newel Fixings
```

Every one of these becomes its own reusable ObjectDNA with subcomponents (Philip 2026-08-04 · Object Library gets richer without Pattern Library adopting the same shape).

## 8 New Component Specimens (SHIPPING this session)

1. **HANDRAIL_VOLUTE_TRADITIONAL_V1** — traditional oak volute handrail starter · spiral scroll · sits above first newel · required companion for grand traditional staircases.
2. **NEWEL_CAP_PYRAMID_V1** — 4-sided pyramid newel cap · stepped moulding · fits box newels.
3. **NEWEL_FINIAL_ACORN_V1** — turned acorn finial · Victorian/Edwardian · reinforces heritage identity.
4. **NEWEL_FINIAL_BALL_V1** — turned ball finial · alternative to acorn · similar heritage weight.
5. **NEWEL_CAP_FLAT_SQUARE_V1** — square flat pyramid newel cap · low profile · Shaker/modern-traditional.
6. **NEWEL_CANONICAL_HERO_V1** — close-up canonical newel + handrail joinery specimen · gold-standard reference for grain · finish · profile · joinery.
7. **HANDRAIL_FITTING_GOOSENECK_RETURN_V1** — wooden handrail return/end elbow (gooseneck return).
8. Extended manifest cross-references for the newel canonical hero photograph.

## Governance

- Every proposed staircase combination MUST run through `validateCombination()` before rendering or before Manufacturing Planner emits a cut list.
- Every construction rule MUST cite its reason · either regulatory (`citation`) OR engineering (in `reason`).
- Every new rule extends the ruleset · never edits existing rules (versioning via history).
- Rules with `severity=impossible` gate the render entirely; `required` blocks manufacturing but allows a preview render with warnings; `warn` and `advisory` show up in reports.
- The 8th library is READ by Reality Advisor · Voice Intelligence · Recommendation Engine · Prompt Compiler · Manufacturing Planner.

## The Two-Rule Test (constitutional)

Before rendering a design, Nex asks:
1. **Does this combination satisfy all Construction Rules?** (this library)
2. **Do the specific numeric measurements satisfy Building Regs?** (existing `construction-platform`)

Only if both return `overall=valid` does the render proceed. Otherwise the caller receives a report with `suggested_fix` for every violation.

## Success Vision

User uploads a rough sketch that says "floating oak staircase with glass balusters and volute handrail." Nex identifies the combination · runs `validateCombination()` · fires 2 rules:

- `glass_balusters_incompatible_with_grooved_handrail` (violated · suggested_fix: use stainless standoffs or square contemporary handrail)
- `volute_handrail_requires_volute_newel` (violated · suggested_fix: add turned volute newel)

The Planner receives the report, adjusts the design, and only then does the renderer or Prompt Compiler proceed.

**Pixels never enter the picture until the design is provably buildable.**
