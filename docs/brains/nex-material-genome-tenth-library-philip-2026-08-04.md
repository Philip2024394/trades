---
authored_by: Philip O'Farrell (Material Genome directive · 2 kitchen specimens)
authored_role: Founder platform doctrine + Master AI Engineer schema
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Design Genome 10th library
document_version: 1.0
document_type: MEGA_DOCTRINE · Material Genome · unified cross-trade material intelligence
composes_with:
  - docs/brains/nex-joinery-dna-library-ninth-genome-philip-2026-08-04.md
  - docs/brains/nex-construction-rules-library-eighth-genome-philip-2026-08-04.md
  - docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md (material-platform · Material Intelligence + Physics)
---

# Material Genome Library · The 10th Design Genome Library

## The Directive (Philip 2026-08-04)

*"One thing I would consider adding next is a Material Genome as a dedicated library, rather than treating materials as simple attributes. For example, oak isn't just 'oak.' It has properties such as: grain character · hardness · stain response · machining characteristics · durability · UV ageing · moisture movement · repairability · sustainability · premium level · compatible finishes · recommended applications. That knowledge can then be shared across staircases, kitchens, doors, furniture, and joinery instead of being duplicated."*

## Design Genome · Now 10 Libraries

```
1 · Object Library                  (physical objects)
2 · Pattern Library                 (compositions)
3 · Relationship Library            (typed edges)
4 · Campaign Library                (campaign → outputs)
5 · Construction Library            (Building Regs)
6 · Style Library                   (Design DNA)
7 · Manufacturing Library
8 · Construction Rules Library      (combination validity)
9 · Joinery DNA Library             (cross-trade component families)
10 · Material Genome Library        (SHIPPING · this session · unified cross-trade material intelligence)
```

Every upload strengthens all TEN.

## What Material Genome Adds

Nex already ships `material-platform/catalog.ts` (fire rating · carbon · manufacturers · cost · care frequency) and `material-platform/physics.ts` (Janka hardness · thermal expansion · moisture · UV ageing · machining · staining · oil absorption · paint adhesion). Material Genome is the **higher-level DNA layer** that composes these into a single queryable unit + adds:

- **Design fields:** grain character (narrative) · stain response tags · premium level (1-5) · repairability score · sustainability score · compatible finishes list · recommended applications per trade.
- **Cross-trade dimensions:** `trades_it_appears_in` · reinforcement per trade so oak learned on a staircase upload strengthens oak knowledge used on a kitchen upload.
- **Coherence signals:** `pairs_well_with` (other MaterialDNA ids) and `avoid_pairing_with` for whole-home compositions.

## Schema

```typescript
type MaterialTrade = "staircase" | "kitchen" | "door" | "wardrobe" | "furniture" | "flooring" | "panelling" | "worktop" | "cabinet" | "splashback" | "handrail" | "cladding";

type MaterialDNA = {
  material_id: string;                     // references material-platform catalog · e.g. "oak_american_white_satin_lacquer"
  display_name: string;
  category: "timber" | "metal" | "glass" | "stone" | "composite" | "paint" | "porcelain" | "concrete" | "textile";

  // Composed from material-platform · surfaced for cross-trade convenience
  physics_ref?: string;                    // material-platform physics id (if present)
  intelligence_ref?: string;               // material-platform catalog id

  // Design intelligence (Philip 2026-08-04)
  grain_character?: string;                // narrative · e.g. "cathedral grain · quarter and crown grain · warm chocolate tones"
  stain_response?: readonly ("takes_stain_evenly" | "tends_to_blotch" | "resists_stain" | "receives_dark_stain_well" | "receives_pigmented_stain_well")[];
  machining_ease?: "easy" | "moderate" | "difficult" | "requires_carbide";
  durability_score: number;                // 0-100
  uv_ageing_narrative?: string;            // human-readable · e.g. "gentle amber deepening over 10 years"
  moisture_movement_class: "low" | "medium" | "high";
  repairability_score: number;             // 0-100 (100 = easily sanded + refinished · 0 = replace-only)
  sustainability_score: number;            // 0-100 · biogenic wins
  premium_level: 1 | 2 | 3 | 4 | 5;         // 1 budget · 5 flagship
  compatible_finishes: readonly string[];  // "satin_lacquer" · "hardwax_oil" · "matt_polyurethane" · "spray_lacquer" · "powder_coat" · etc.
  recommended_applications: readonly { trade: MaterialTrade; suitability: "excellent" | "good" | "acceptable" | "avoid"; note?: string }[];

  // Cross-trade coherence
  pairs_well_with: readonly string[];      // other material_dna_ids
  avoid_pairing_with: readonly string[];

  // Growing intelligence
  trades_it_appears_in: readonly MaterialTrade[];
  observation_count: number;
  aggregate_confidence: number;
  evidence_asset_ids: readonly string[];
  history: readonly { at: string; delta: number; reason: string; evidence?: string; trade?: MaterialTrade }[];

  provenance: { named_expert: string; authored: string };
};
```

## 15 Seed Materials (SHIPPING this session)

Every MaterialDNA Rule-c attributable to Philip O'Farrell 2026-08-04.

**Timbers:** oak_american_white · european_walnut · scandinavian_pine · mahogany · ash_white.
**Metals:** steel_black_powder_coated · brass_polished · aluminium_anodised · stainless_steel_brushed.
**Stone / Composite:** quartz_worktop_white · granite_black · porcelain_grey_large_format.
**Paint / Concrete / Glass:** paint_matt_emulsion_white_shaker · concrete_polished · glass_toughened_10mm.

## Cross-Trade Query Patterns

- `materialsForTrade("kitchen")` → returns every MaterialDNA suitable for kitchens (with per-application suitability).
- `materialsForPremiumLevel(5)` → surfaces flagship-tier materials for high-end briefs.
- `pairsWith(material_dna_id)` → returns coherent material combinations for whole-home design.
- `materialsCompatibleWithFinish("satin_lacquer")` → filter by finish.
- `mostRepairable(threshold)` / `mostSustainable(threshold)` → durability/sustainability queries.

## Reinforcement (the whole point)

`reinforce(materialDnaId, trade, delta, reason, evidence)` records the trade in history. When Nex sees oak on a staircase upload AND oak on a kitchen upload · the same MaterialDNA record gains observations from BOTH trades. Its `trades_it_appears_in` widens automatically. Its aggregate confidence rises. Its cross-trade suitability strengthens.

Compare with the older material-platform records: those stayed static. Material Genome is the compounding layer.

## 2 New Kitchen Specimens (this session)

1. **Modern Shaker Kitchen with Navy Island** — Philip · deep navy painted shaker · solid oak/engineered-oak butcher-block island worktop · brushed brass hardware · light stone splashback · warm LED · pendant glass shades · light oak flooring · undermount sink · matte black mixer. Reinforces `oak_american_white` (for the timber worktop) · `paint_matt_emulsion_white_shaker` (for the shaker doors · adapted to navy) · `brass_polished` (hardware + accents) · `porcelain_grey_large_format` (flooring · adapted to light oak-effect).
2. **Luxury Warm-White Transitional Kitchen with Ivory Cabinetry** — Philip · warm off-white/ivory shaker · full-height glazed display cabinets with fluted glass · brushed brass throughout · white engineered quartz worktops with matching quartz splashback · large-format light beige porcelain flooring · black aluminium doors · pendant ribbed glass with brass fittings · upholstered cream fabric stools with slim black metal legs. Reinforces `paint_matt_emulsion_white_shaker` · `quartz_worktop_white` · `brass_polished` · `porcelain_grey_large_format` · `glass_toughened_10mm`.

## Governance

- Every specimen upload MUST reinforce every applicable MaterialDNA via `reinforce(id, trade, ...)`.
- Every new MaterialDNA extends the seed list · never renames an existing entry (that would break cross-trade continuity).
- Every MaterialDNA reads from · never rewrites · material-platform/catalog.ts + physics.ts. The Genome LAYER composes those atoms into a queryable unit; it doesn't replace them.
- Every application recommendation must specify a `trade` + a `suitability` score.
- Cross-trade `pairs_well_with` / `avoid_pairing_with` are used by the Recommendation Engine BEFORE proposing whole-home compositions · composes with `joinery-dna.detectClashes()`.
- Material Genome READS material-platform data · READS ObjectDNA subcomponents · WRITES only to its own store.
