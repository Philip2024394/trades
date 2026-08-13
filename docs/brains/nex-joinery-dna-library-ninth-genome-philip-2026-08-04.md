---
authored_by: Philip O'Farrell (Joinery DNA directive · 3 cross-trade specimens)
authored_role: Founder platform doctrine + Master AI Engineer schema
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Design Genome 9th library
document_version: 1.0
document_type: MEGA_DOCTRINE · Joinery DNA · cross-trade component families
composes_with:
  - docs/brains/nex-construction-rules-library-eighth-genome-philip-2026-08-04.md
  - docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md (7-library baseline)
  - docs/brains/nex-object-dna-subcomponent-hierarchy-philip-2026-08-04.md
---

# Joinery DNA Library · The 9th Design Genome Library

## The Directive (Philip 2026-08-04)

*"Beyond your seven libraries, I think the next major compounding advantage would be a Joinery DNA Library. This would contain reusable component families across every trade, for example: Staircases · Kitchens · Wardrobes · Wall panelling · Doors · Skirting · Architraves · Cabinet doors · Crown mouldings · Window boards · Furniture. Many of the objects you've shown — handrails · mouldings · raised panels · caps · timber profiles — share the same design language as cabinetry and architectural joinery. A unified Joinery DNA layer would let Nex transfer design knowledge between staircases, kitchens, and bespoke interiors, making recommendations feel much more coherent across the whole home."*

## The Numbering Note

In Philip's original enumeration this is the "8th library." However, the previous session already shipped Construction Rules as the 8th library. So in the actual runtime this is the **9th library** · both are first-class Design Genome members with equal weight.

## Design Genome · Now 9 Libraries

```
1 · Object Library                  (physical objects · SHIPPED)
2 · Pattern Library                 (compositions · SHIPPED)
3 · Relationship Library            (typed edges · SHIPPED)
4 · Campaign Library                (campaign → outputs · SHIPPED)
5 · Construction Library            (Building Regs · SHIPPED via construction-platform)
6 · Style Library                   (Design DNA + Style DNA · SHIPPED via design-dna)
7 · Manufacturing Library           (manufacturing-platform · SHIPPED)
8 · Construction Rules Library      (combination validity · SHIPPED · previous session)
9 · Joinery DNA Library             (cross-trade component families · SHIPPING · this session)
```

Every upload strengthens all NINE.

## What Joinery DNA Actually Stores

A joinery FAMILY is a **reusable component motif that recurs across trades**. The same "raised panel · shaker" motif appears on:

- staircase newel post panels
- kitchen cabinet doors
- wardrobe doors
- wall panelling
- interior doors

Each of those uses is a DIFFERENT ObjectDNA (they live in Object Library) · but they SHARE a Joinery DNA family. That shared family is what carries the design language across the home.

## Schema

```typescript
type JoineryDNAFamily = {
  family_id: string;                     // e.g. "IN_FRAME_SHAKER" · "OGEE_MOULDING" · "TURNED_TAPER"
  display_name: string;
  component_kind: string;                // "cabinet_door" · "moulding" · "handrail_profile" · "newel_cap" · "skirting" · "architrave" · "crown_moulding" · "raised_panel" · etc.
  design_language: string;               // "shaker" · "in_frame_traditional" · "victorian" · "georgian" · "contemporary_slab" · "industrial_stainless" · "modern_handleless"
  trades_it_appears_in: readonly string[];  // ["staircase", "kitchen", "wardrobe", "panelling", "door", "skirting", "architrave"]
  material_families: readonly string[];  // ["oak", "walnut", "painted_mdf", "stainless_steel"]
  characteristic_features: readonly string[];  // ["wide_stiles", "flat_centre_panel", "traditional_proportions"]
  incompatible_with: readonly string[];  // other family_ids that would clash on the same project
  observation_count: number;
  aggregate_confidence: number;
  evidence_asset_ids: readonly string[];
  history: readonly { at: string; delta: number; reason: string; evidence?: string; trade?: string }[];
  provenance: { named_expert: string; authored: string };
};
```

**Cross-trade reinforcement:** when a kitchen upload matches an IN_FRAME_SHAKER family AND a staircase upload later matches the same family · both observations strengthen the same JoineryDNAFamily. That's the compounding advantage — Nex learns that IN_FRAME_SHAKER is a design language a customer might want CONSISTENT across their staircase + kitchen + wardrobes.

## Authored Seed Families (SHIPPING this session)

Every family Rule-c attributable to Philip O'Farrell 2026-08-04.

### Traditional joinery families
1. **IN_FRAME_SHAKER** — wide stiles + wide rails + flat centre panel + traditional proportions · trades: kitchen · wardrobe · panelling · doors · staircase panels.
2. **RAISED_PANEL_TRADITIONAL** — recessed field panels with raised centre · trades: newel · kitchen door · wardrobe · panelling · doors · furniture.
3. **OGEE_MOULDING** — S-curve profile · trades: crown_moulding · architrave · skirting · handrail_profile · plinth.
4. **BULLNOSE_PROFILE** — rounded front edge · trades: stair_tread · worktop · shelf · window_board.
5. **TURNED_TRADITIONAL** — lathe-turned profile · trades: baluster · furniture_leg · handrail_terminal · newel_cap.
6. **CROWN_MOULDING_STEPPED** — multi-step cornice · trades: kitchen · wardrobe · panelling · newel_cap.

### Contemporary joinery families
7. **CONTEMPORARY_SLAB** — flat slab · no frame · minimal · trades: kitchen · wardrobe · doors · panelling.
8. **HANDLELESS_MODERN** — integrated handle rail / push-latch · trades: kitchen · wardrobe.
9. **SQUARE_CONTEMPORARY_PROFILE** — sharp square edges · trades: handrail · newel_cap · skirting · architrave · worktop.
10. **INDUSTRIAL_STAINLESS** — brushed stainless steel + minimal joinery · trades: kitchen · worktop · splashback · appliance surround.

### Heritage / architectural families
11. **VICTORIAN_TURNED** — decorative multi-bead turning · trades: baluster · newel · furniture · finial.
12. **GEORGIAN_CLASSICAL** — symmetrical proportions + fielded panels + astragal glazing · trades: doors · windows · panelling · staircase · furniture.
13. **BEADED_FACE_FRAME** — face frames with bead detail · trades: kitchen · wardrobe · in-frame furniture.
14. **PIGS_EAR_PROFILE** — half-round wall-mounted profile · trades: handrail · shelf-edge.

### Structural / functional families
15. **CHAMFERED_MODERN_TRADITIONAL** — stop-chamfered edges · trades: newel · furniture · panelling · beam.
16. **FLUTED_COLUMN** — vertical grooves · trades: newel · column · pilaster · furniture · panelling.
17. **TONGUE_AND_GROOVE_PANELLING** — vertical or horizontal T&G · trades: wall panelling · under-stair · door lining.
18. **RAISED_FIELD_PANEL_LARGE_FORMAT** — oversized raised panels · trades: doors · wardrobe · panelling · furniture end panels.

### Style-signal families
19. **WARM_WALNUT_LUXURY** — book-matched walnut · satin lacquer · furniture-grade finish · trades: kitchen · wardrobe · staircase · furniture · panelling.
20. **NATURAL_OAK_HERITAGE** — European oak · natural satin · visible cathedral grain · trades: staircase · flooring · kitchen · panelling · door.

## Cross-Trade Query Patterns Unlocked

- `familiesForTrade("kitchen")` → returns every joinery family that appears on kitchens.
- `familiesForDesignLanguage("in_frame_traditional")` → returns every family that carries the in-frame traditional language.
- `sharedFamiliesAcross(["staircase", "kitchen"])` → returns families that recur across both trades (e.g. IN_FRAME_SHAKER · CROWN_MOULDING_STEPPED · WARM_WALNUT_LUXURY · NATURAL_OAK_HERITAGE).
- `recommendFamiliesForProject({ trades, design_language })` → surfaces the coherent set of joinery families that make a whole-home renovation feel intentional rather than disjointed.

## The Compounding Advantage

Every walnut in-frame kitchen upload reinforces IN_FRAME_SHAKER + WARM_WALNUT_LUXURY + BEADED_FACE_FRAME + RAISED_PANEL_TRADITIONAL + CROWN_MOULDING_STEPPED. Every heritage oak staircase reinforces NATURAL_OAK_HERITAGE + TURNED_TRADITIONAL + VICTORIAN_TURNED + OGEE_MOULDING. Over hundreds of specimens Nex learns *"customers who install walnut in-frame kitchens usually match with heritage oak staircases and Georgian panelling"* — automatically — without hardcoding.

## 3 Cross-Trade Specimens (this session)

1. **Luxury walnut in-frame shaker kitchen** (Philip · walnut · satin lacquer · in-frame · raised panel · crown moulding · antique brass · warm cream splashback) — reinforces IN_FRAME_SHAKER · WARM_WALNUT_LUXURY · BEADED_FACE_FRAME · CROWN_MOULDING_STEPPED · RAISED_PANEL_TRADITIONAL.
2. **Grand double-curved horse-newel hardwood staircase** (Philip · golden oak · satin poly · continuous curved handrail · turned balusters · sculptural horse newels + turned landing newels) — reinforces NATURAL_OAK_HERITAGE · TURNED_TRADITIONAL · VICTORIAN_TURNED + records a hero-tier sculptural newel outlier.
3. **Contemporary industrial stainless commercial-style kitchen** (Philip · brushed stainless · flat slab · fluted glass display · black aluminium · pendants · commercial-residential hybrid) — reinforces INDUSTRIAL_STAINLESS · CONTEMPORARY_SLAB · HANDLELESS_MODERN · SQUARE_CONTEMPORARY_PROFILE.

## Governance

- Every JoineryDNAFamily lives in `src/lib/nex/joinery-dna/` · never merged into Object Library (Object Library stores ONE physical thing · Joinery DNA stores a DESIGN LANGUAGE that recurs across many things).
- Every upload MUST reinforce every applicable family (kitchen upload → reinforce all matching kitchen families · staircase upload → reinforce all matching staircase families · cross-trade families accumulate observations from BOTH).
- Every new family extends the taxonomy · never edits existing families.
- Every family carries `characteristic_features` so Vision Intelligence can auto-match visual signatures.
- Joinery DNA READS from Object Library subcomponents · it does NOT store subcomponents itself (that's Object Library's job).
