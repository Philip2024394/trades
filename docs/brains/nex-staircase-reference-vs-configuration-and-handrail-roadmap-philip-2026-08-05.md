# NEX Staircase · Reference Assembly vs Customer Configuration + Handrail-variant + Structural-family roadmap (Philip 2026-08-05)

> **Directives (Philip 2026-08-05):**
> - *"At the moment Claude has: Assembly. I would rename it Configuration or Reference Assembly, because later you'll have Customer Configuration."*
> - *"For every shell you'll have Bare · Left rail · Right rail without inventing anything new. Then Double handrail · Glass one side · Glass both sides · then finally Open string shell."*
> - *"Your shell library currently stops at 13 treads because that's what you've rendered. That actually aligns well with UK domestic practice."*
> - *"Once you reach longer flights, they often require intermediate landings depending on the applicable regulations and building type … Instead, I'd start creating new structural families: Quarter landing · Half landing (U-shaped) · Winder · Kite winder · Double winder · Dog-leg · Open string · Cut string · Cut string with brackets."*
> - *"Claude has made a good architectural decision by separating: Shells (structure) · Components (reusable parts) · Assemblies/Configurations (how components are combined). That separation will scale much better than trying to encode every staircase variation as its own standalone asset."*

## 1 · Reference Assembly vs Customer Configuration (type-level split)

`StaircaseAssembly` (the pre-2026-08-05 name) always meant "a factory-standard
composition of shell + handrail + newels + balusters." That was correct
until the customer flow demanded a *distinct* concept: user-authored builds
carrying material overrides, accessory picks, and a lifecycle. Two concepts
sharing one interface age badly.

The split (implemented in `src/lib/nex/staircase-components/types.ts`):

- **`StaircaseReferenceAssembly`** *(was `StaircaseAssembly`)* — NEX-owned
  factory standard. Never edited per-customer. Truth-standard for the
  Render Assembly Module and the marketing gallery. YAML at
  `data/nex-staircase-assemblies/*.yaml`.
- **`StaircaseCustomerConfiguration`** *(new)* — Customer + Project owned.
  Layered over exactly ONE reference assembly. Carries
  `material_overrides[]` (species / stain / carpet / glass tint / chrome /
  LED / paint), `accessories[]`, `finish_spec`, and a
  `StaircaseConfigurationStatus` lifecycle (draft → quoted → approved →
  in_production → fitted → cancelled). `locked_at` fires when status hits
  `"approved"`.
- **Backwards compat:** `StaircaseAssembly = StaircaseReferenceAssembly`
  remains as a deprecated alias. Existing YAML with
  `assembly_type: static_reference` still parses. New code should
  discriminate by TYPE, not by field.

Why type-level rather than field-level: the customer configuration will
grow bespoke fields (customer_id · project_id · quote_ref · scheduled
delivery date · site notes · access constraints) that never belong on a
factory reference. A shared interface would end up with half its fields
being conditionally-required. Two types, one purpose each.

## 2 · Handrail variant priority (per shell)

Directive: for EVERY shell family, generate the reference assemblies in
this exact order. Earlier variants unlock more render value per hour of
work — cover BREADTH (many shells × many variants) before adding DEPTH
(exotic variants on a single shell).

| Order | Variant             | Notes                                                                                      |
| ----- | ------------------- | ------------------------------------------------------------------------------------------ |
| 1     | `bare`              | Shell only, no rail. Fastest ROI — gives the render engine something to compose against.   |
| 2     | `left_handrail`     | Left-side handrail + shoe rail + balusters + newels.                                       |
| 3     | `right_handrail`    | Mirror of left (ImageKit `tr:fl-h`, no new render needed).                                 |
| 4     | `double_handrail`   | Both sides. Composes left + right without a fresh render.                                  |
| 5     | `glass_one_side`    | Glass balustrade one side, timber rail the other.                                          |
| 6     | `glass_both_sides`  | Glass balustrade both sides.                                                               |
| 7     | `open_string`       | Open-string shell variant — bridges into the structural roadmap (§4).                      |

Enforced by:

- `HandrailVariantKind` enum (types.ts).
- `HANDRAIL_VARIANT_PRIORITY` array — a stable ordering the roadmap
  reporter can use to compute per-shell coverage.
- New reference assemblies declare `handrail_variant?: HandrailVariantKind`
  so the roadmap board can show `SHELL_STRAIGHT_CLOSED_10 · bare ✓ · left ✓ · right ✓ · double ○ · glass_one ○ · glass_both ○ · open_string ○`.

Existing YAML doesn't yet carry the field — populated on the next authoring
pass. Absence ≠ compliance; it's just "not yet audited."

## 3 · Straight-closed tread cap

`SHELL_STRAIGHT_CLOSED` currently ships 15 variants (1–15 treads). Philip's
directive: don't grow this family further. UK domestic practice puts a soft
cap at ~13 treads before an intermediate landing becomes preferable
(Approved Doc K Section 1). Longer straight flights are usually poor design
regardless of what regulations permit.

Constants in `catalog.ts`:

```ts
STRAIGHT_CLOSED_TREAD_SOFT_CAP = 13;   // UK domestic sweet spot
STRAIGHT_CLOSED_TREAD_HARD_CAP = 15;   // current build ceiling
NEXT_STRUCTURAL_FAMILY = "quarter_landing";
```

Growth after variant coverage moves to §4 — new structural families,
not more straight treads.

## 4 · Structural family roadmap

Once every existing shell (and any future straight variants up to 13/15)
carries the seven handrail variants from §2, growth moves to NEW
construction types. Order dictated by Philip 2026-08-05:

1. `quarter_landing` — one 90° turn on a landing plate. Immediate coverage
   gain over straight for two-storey UK homes with an L-shaped hall.
2. `half_landing_u_shaped` — U-turn on a half landing. Standard for
   townhouses and mid-terrace layouts where the stair returns on itself.
3. `winder` — turn made from tapered treads (no landing). Space-efficient
   variant of quarter/half turns.
4. `kite_winder` — three-tread 90° winder (kite-shaped centre tread).
5. `double_winder` — two winders back-to-back for a full 180° turn without
   a landing.
6. `dog_leg` — half-landing turn with parallel flights sharing a common
   newel wall. Distinct from `half_landing_u_shaped` in how the strings
   frame.
7. `open_string` — string cut away to expose the tread ends. Bridges from
   the handrail-variant list into a full structural family.
8. `cut_string` — housed variant of open string with visible tread returns.
9. `cut_string_with_brackets` — cut string with decorative brackets under
   each tread. Signature Victorian / Georgian aesthetic.

Enforced by `StructuralFamilyKind` enum + `STRUCTURAL_FAMILY_ROADMAP` array
in types.ts + `NEXT_STRUCTURAL_FAMILY` constant in catalog.ts.

## 5 · Architectural affirmation (Philip 2026-08-05)

The Shells → Components → Reference Assemblies / Customer Configurations
separation is affirmed. This scales:

- **Shells** hold structure (family + tread count + interfaces).
- **Components** hold reusable parts (handrails · newels · balusters ·
  shoe rails · materials).
- **Reference Assemblies** compose components onto shells for the factory
  standard.
- **Customer Configurations** layer per-project overrides on a reference.

Growth in every direction stays additive. New handrails add rows to the
component table. New shells add rows to the shell table. New material
picks add rows to a customer configuration without touching either.
Adding a whole new construction type (quarter landing) adds ONE new shell
family and inherits every existing component. That's why the separation
holds — every future spec can be assigned to one layer without disturbing
the others.

## Files owned by this doctrine

- `src/lib/nex/staircase-components/types.ts` (Reference / Configuration
  types + Handrail + Structural enums)
- `src/lib/nex/staircase-components/catalog.ts` (tread caps + next-family
  constant)
- `data/nex-staircase-assemblies/*.yaml` (existing reference YAMLs · get
  `handrail_variant` field on next authoring pass)

## Related pins

- `feedback_adoption_over_architecture_2026_08_02.md` (Constitution ·
  Simplicity Rule · this is a rename, not a rewrite)
- Master Product Vision · Render Assembly Module (Phase 3)
- Constitution First Law (Configuration is a commitment · needs status +
  lifecycle + visible object)
