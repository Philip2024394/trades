---
authored_by: Philip O'Farrell (subcomponent hierarchy directive + 12 staircase/handrail specimens)
authored_role: Founder Object Library refinement + Master AI Engineer schema extension
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · ObjectDNA schema extension
document_version: 1.0
document_type: MEGA_DOCTRINE · Object Library gets hierarchical subcomponents · Pattern Library stays composition-only
composes_with:
  - docs/brains/nex-phase-e16-visual-learning-object-dna-philip-2026-08-04.md
  - docs/brains/nex-visual-pattern-library-and-design-genome-philip-2026-08-04.md
  - docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md
---

# ObjectDNA · Hierarchical Subcomponents

## The Directive (Philip 2026-08-04)

*"One area I'd expand next is the ObjectDNA schema so complex objects like staircases expose hierarchical subcomponents (flight type → structural system → joinery → decorative elements → material → finish). That would make recognition, querying, and generation more precise while keeping the Pattern Library focused solely on composition and layout."*

Object Library still stores physical objects. Pattern Library still stores compositions. This doctrine ONLY changes: **ObjectDNA now supports a `subcomponents` tree** so a complex object (staircase, kitchen, wardrobe) can expose its internal anatomy without becoming N flat records.

## The Subcomponent Hierarchy

Every ObjectDNA MAY declare a `subcomponents` field · which is a tree of typed nodes.

**Canonical staircase hierarchy (Philip's example):**

```
Staircase (root ObjectDNA)
├── flight_type              (straight · straight_with_lower_landing · quarter_turn · half_turn · curved · spiral · switchback)
├── structural_system        (closed_string · double_housed_string · mono_string · closed_box_fascia · steel_switchback)
├── entrance_system          (square_start · single_bullnose · double_bullnose · full_bullnose_platform · circular_platform_with_volute · double_volute)
├── balustrade_system        (turned_baluster · square_baluster · glass · steel · cable)
├── newel_family             (raised_panel_box · turned_victorian · volute_turned · volute_turned_twin · modern_square)
├── joinery
│   ├── housed_treads
│   ├── mitred_returns
│   ├── mortise_and_tenon
│   ├── loose_tenon
│   ├── dowel_fixings
│   └── rail_bolts
├── decorative_elements
│   ├── carved_string_brackets
│   ├── scroll_volutes
│   ├── brass_decorative_rings
│   ├── raised_field_panels
│   └── decorative_newel_caps
├── material                 (references material-platform)
└── finish                   (satin_lacquer · matt_hardwax_oil · polyurethane · natural)
```

Every subcomponent can be its own ObjectDNA reference OR a free-text taxonomic node · caller's choice. Recognition · querying · generation all become more precise because Nex can search *"staircases with volute newels and closed strings in walnut"* instead of matching by flat tags.

## Rule (constitutional)

**Object Library gains hierarchical subcomponents. Pattern Library stays composition-only.** No layout metadata (safe zones · CTA placement · typography hierarchy) is ever recorded inside subcomponents · that belongs in PatternDNA.

## Runtime Schema (backward compatible)

```typescript
type SubcomponentEntry = {
  slot: string;                          // "flight_type" · "structural_system" · "entrance_system" · etc.
  value: string;                         // free-text taxonomic value
  object_ref?: string;                   // optional · references another ObjectDNA id
  children?: readonly SubcomponentEntry[];
  confidence?: number;                   // 0..1
};

type ObjectDNA = {
  // ... existing fields
  subcomponents?: readonly SubcomponentEntry[];
};
```

Existing ObjectDNA records without `subcomponents` continue to work unchanged.

## Helper functions (SHIPPING this session)

- `getSubcomponent(obj, slot)` → returns the entry for a named slot.
- `walkSubcomponents(obj)` → generator that yields every entry depth-first.
- `flattenSubcomponents(obj)` → `Record<slot, value>` flat map for cheap search.
- `hasSubcomponent(obj, slot, value)` → boolean for filter predicates.

## 12 New Training Specimens (Philip 2026-08-04)

1. **External galvanized steel fire escape stair tower** — 3 switchback flights · 4 landings · steel columns · base plates · open-riser grating · guardrails · cross bracing · hot-dip galvanized. NEW subtype: `fire_escape_stair_tower`.
2. **Bullnose starting step assembly** (closed-string · square starting newel · 4 treads).
3. **Single-bullnose starting section right-hand** (isolated · closed string · square newel).
4. **Standalone walnut 3-step bullnose module** (no string · no newel · no handrail · pure step assembly).
5. **Feature entrance staircase with double bullnose wrap-around** (4 newels · turned front pair · square rear pair · continuous handrails · landing).
6. **Straight staircase with bullnose starting platform + double newel** (single flight · closed string · Philip's *canonical Straight Bullnose Closed-String Staircase*).
7. **Straight flight with grey runner + brass rods + panelling** (traditional UK premium residential).
8. **Dark walnut/mahogany straight flight with landing + T&G panelling** (Georgian-inspired · dark stain).
9. **Straight oak staircase with under-stair cupboard** (premium residential · under-stair storage).
10. **HANDRAIL_TRADITIONAL_PLOUGHED_V1** — traditional moulded oak handrail with ploughed groove for balusters + fillets.
11. **HANDRAIL_TRADITIONAL_SOLID_V1** — solid oak handrail blank (no groove · for wall mounting or custom machining).
12. **BASERAIL_TRADITIONAL_MOULDED_V1** — matching moulded base rail (bottom rail for balustrade).

**Philip's classification requirement:** the two handrail profiles (ploughed vs solid) are DISTINCT ObjectDNA · they serve different manufacturing/installation purposes. Nex must never merge them.

## Governance

- Every complex object may declare a `subcomponents` tree.
- Every leaf subcomponent that IS a separate reusable object references its ObjectDNA id in `object_ref`.
- New subcomponent slots extend the vocabulary · never fork the schema.
- Pattern Library never receives subcomponent metadata · that is Object-Library-only.
- Visual Learning Platform reads subcomponents when comparing · reinforces matched subcomponent slots · not just the root object.
