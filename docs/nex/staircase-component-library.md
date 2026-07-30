# NEX Staircase Component Library — Master Doc

> Philip's Master Prompt for the Component Library, codified 2026-07-29 · Phase 1.
>
> **Framing correction from the original prompt:** the prompt named it "Component Brain" and "Vision Brain". By the Three-Layer Architecture Hard Law (2026-07-28), only knowledge is a Brain. Both are Application Modules. Same as the Geometry Module correction from earlier today. The diagram shape and dataflow survive intact.
>
> **The five sub-systems:**
>
> ```
>                     NEX (orchestration)
>                       │
>   ┌───────────────────┼────────────────────┐
>   ▼                   ▼                    ▼
> Reference           Geometry            Manufacturing
>   Brain              Module                Module
>  (Layer 1)          (Layer 2)             (Layer 2)
>   ▲                   ▲                    ▲
>   │                   │                    │
>   └──────────────┬────┴───────┬────────────┘
>                  │            │
>                Component    Vision
>                 Module      Module
>                (Layer 2)   (Layer 2)
> ```
>
> Vision extracts observations from images. Component catalogues typed reusable assets. Geometry / Manufacturing / Reference-informed conversation all read from the catalogue.

---

## The core insight

Most AI staircase systems: **image → generated render.**

NEX: **engineering component → typed metadata → assembly → validated render.**

The AI never invents a staircase. It classifies reusable components, then the Geometry Module composes valid assemblies from validated parts. That's how a workshop actually works, and it's what makes the catalogue the moat.

---

## Purpose

Every uploaded shell (later: every handrail, newel, baluster, etc.) becomes one row in a curated catalogue. Each row carries a stable deterministic ID plus typed metadata. Downstream modules — Geometry, Manufacturing, Renderer, Quoter, and the customer chat — reference components by ID, not by image.

**Not an image library.** An engineering component database. Images are the input; the metadata is the product.

---

## Hard rules

Same discipline as the Reference Brain and the Geometry Module, extended to component classification.

1. **Never describe the image as artwork.** No prose. Structured metadata only.
2. **Never generate marketing text.**
3. **Never guess missing information.** If a field cannot be determined from the shell, the value is `"unknown"`.
4. **Never estimate dimensions.**
5. **Never invent measurements.**
6. **Never infer timber species from colour.** Species is a Design decision, not a classification.
7. **Geometry is more important than appearance.** Layout, construction, tread count come first.
8. **Return valid YAML only.** No commentary in the classification output.
9. **Count visible treads directly.** Do not extrapolate.
10. **Infer risers where safely derivable** (single flight → risers = treads + 1). Otherwise `"unknown"`.
11. **Identify construction only when visually certain.** Otherwise `"unknown"`.

---

## Rule B applied here — classification, not authoring

Per Chief Reference Brain Engineer memo, AI **can** organise / dedupe / suggest / catalogue. AI **cannot** author trade content. Component classification from a shell IS organisation — extracting typed structure from something that already exists. Rule B satisfied.

But every classification is a **draft** until a human reviews it:

```
Image
   ↓
AI classifies → confidence: 0.98, review_status: draft
   ↓
Human review
   ↓
Locked component → confidence: 1.00, review_status: locked
```

Only `locked` components become foundations that others link to. Downstream modules should treat `draft` components as informational, not source-of-truth.

---

## Locked design decisions (2026-07-29 · Philip approved)

### A · Deterministic component_id — never a UUID

Uppercase. Underscore-separated. No versioning inside the ID — revisions live in the `revision` field.

Pattern **per component type**. Each type has its own scheme because different types have different distinguishing attributes.

| Component type | Pattern | Example | Notes |
|---|---|---|---|
| **shell** | `SHELL_[layout]_[construction]_[NN]` | `SHELL_STRAIGHT_CLOSED_02` | Updated 2026-07-29 (Shell 2). **Variant number NN = tread count** — `SHELL_STRAIGHT_CLOSED_02` reads directly as "2-tread straight closed-string shell". The family ID (SHELL_STRAIGHT_CLOSED) is the variant ID minus the `_NN` suffix. Construction family visible in the ID enables future expansion (`SHELL_STRAIGHT_OPEN_NN`, `SHELL_STRAIGHT_GLASS_NN`) without breaking existing IDs. |
| **string** | `STRING_[construction]_[thickness_mm]` | `STRING_HOUSED_32` | |
| **handrail** | `HANDRAIL_[hand]_[style]` | `HANDRAIL_LEFT_CLASSIC` | |
| **newel** | `NEWEL_[profile]_[section_mm]` | `NEWEL_SQUARE_90` | |
| **baluster** | `BALUSTER_[material_or_profile]_[section_mm]` | `BALUSTER_STAINLESS_ROD_12` | |
| **landing** | `LANDING_[turn]_[longest_side_mm]` | `LANDING_QUARTER_1200` | |
| **tread / riser** | `[TYPE]_[thickness_mm]_[variant]` | `TREAD_44_01` | |
| **feature_start** | `FEATURE_START_[style]` | `FEATURE_START_BULLNOSE` | |
| **timber** (material ref) | `TIMBER_[species]` | `TIMBER_WALNUT` | Not a shell family member — separate reference lookup. |
| **finish** (material ref) | `FINISH_[type]` | `FINISH_CLEAR_LACQUER` | Same — separate lookup. |

Same physical component → same ID always. If a classification was wrong, correct the metadata and **increment `revision`**. Create a **new** ID **only** if the underlying engineering component is genuinely different.

### B · component_type enum — locked at 9

```
shell · string · tread · riser · handrail · newel · baluster · landing · feature_start
```

Materials and finishes are separate reference lookups, not shell-family members — they compose onto components, they aren't components themselves.

Expand this enum only when a real product requires it. Never speculatively.

### C · confidence — single overall score 0.00–1.00

No per-field confidence. Adds ceremony that's premature (ADR-0041). Upgrade only if a real bug proves the need.

Workflow:

```yaml
# AI first-pass
confidence: 0.98
review_status: draft

# After human review
confidence: 1.00
review_status: locked
```

### D · Rule B — classify, never author

Documented above. Every draft awaits human review before other modules link to it.

### E · Immutability once locked (Philip's addition · 2026-07-29)

**A component is immutable once locked.**

- If a classification was wrong → correct the metadata and **increment `revision`**. Same `component_id`.
- Create a **new** `component_id` **only** if the underlying engineering component is genuinely different.

This preserves stable references across Geometry, Manufacturing, and Renderer. A downstream module pointing at `SHELL_STRAIGHT_13` must always resolve — even after a metadata correction — because `SHELL_STRAIGHT_13` still points at the same physical shell.

---

## Metadata schema (Phase 1 · shell components only)

Every classification returns YAML with these fields. Order matters — keep it consistent for grep-ability.

```yaml
component_id:               SHELL_STRAIGHT_CLOSED_01
component_type:             shell
revision:                   1
classified_at:              2026-07-29T15:30:00Z
source_image_refs:
  - https://ik.imagekit.io/.../shell_straight_closed_01.png

# ─── Geometry identity ─────
layout:                     straight_flight
hand:                       none
construction:               housed_closed
string_configuration:       closed_both_sides

# ─── Counts ────────────────
treads:                     1
risers:                     2
open_risers:                false

# ─── Top landing connection (its own engineering element) ─────
top_landing_connection:
  enabled:                        true
  reduced_tread:                  true
  sits_on_trimmer:                true
  final_riser_against_trimmer:    true
  flooring_allowance:             configurable
  carpet_allowance:               configurable

# ─── Bottom + landing ──────
bottom_detail:
  type:                     standard_start

landing:
  included:                 false

# ─── Capacity ──────────────
balustrade_supported:       unknown
handrail_supported:         unknown

# ─── Compatibility graph (deferred to Phase 1.5) ──
compatible_handrails:       []
compatible_newels:          []
compatible_balusters:       []
compatible_materials:       []

# ─── Review ────────────────
confidence:                 1.00
review_status:              reviewed
notes:
  - Closed strings both sides.
  - Single walking tread.
  - Two risers (one leading up to the tread, one against the trimmer).
  - Top tread is a landing-connection tread — reduced depth.
  - Balustrade and handrail support not visible from this shell — marked unknown.
```

Any field that cannot be determined from the shell must be `"unknown"` — never a guess.

---

## Assemblies as Verification Suite (Philip 2026-07-29 · Assembly 10)

Philip's framing shift at Assembly 10: assemblies aren't just static examples — a strategic subset becomes the **verification suite** for the future parametric Render Assembly Module.

**The set of `golden_reference: true` assemblies is the truth-standard** the parametric engine measures against. When the engine generates an intermediate tread count (e.g. 7-tread), it renders and compares against the nearest golden reference to validate:

- handrail length matches the pitch
- newel positions are correct at start / finish
- baluster spacing follows the 99mm rule
- string lengths match the tread count
- overall proportions stay consistent with the family

**Philip's proposed golden set:** 1, 4, 8, 10, 13, 16 treads.

**Current golden references** (2026-07-29):

| Assembly | Golden | Baluster style |
|---|---|---|
| ASSEMBLY_STRAIGHT_CLOSED_1T_LEFT_HANDRAIL | ✅ | none (span too short) |
| ASSEMBLY_STRAIGHT_CLOSED_4T_LEFT_HANDRAIL | ✅ | square |
| ASSEMBLY_STRAIGHT_CLOSED_8T_LEFT_HANDRAIL_TURNED | ✅ | turned classic |
| ASSEMBLY_STRAIGHT_CLOSED_10T_LEFT_HANDRAIL | ✅ | square |
| ASSEMBLY_STRAIGHT_CLOSED_13T_LEFT_HANDRAIL | ✅ | square |
| ASSEMBLY_STRAIGHT_CLOSED_16T_LEFT_HANDRAIL | ⏳ awaiting render | — |

Non-golden assemblies (2T, 3T, 6T, 9T, 14T) remain useful reference examples but aren't first-class validation points. When the parametric engine is built (Phase 3), it uses the golden references to verify its intermediate outputs.

---

## The 10 Architectural Principles (Philip 2026-07-29 · Assembly 03)

At Assembly 03 Philip articulated 10 principles for the library to scale from a component catalogue to a parametric product database. Each is captured here with its current implementation status. Adopt-now items are already reflected in the schema; deferred items are intentional (ADR-0041 — build when real usage proves need).

| # | Principle | Status | Where |
|---|---|---|---|
| 1 | **Component Interface** — every component shares a common base | ✅ Adopted | `ComponentBase` extended with optional `family`, `variant`, `version`, `tags` |
| 2 | **Connection sockets** — components advertise where they can connect | 🟡 Partial | Shell family carries `interfaces.lower_connection.accepts` and `upper_connection.accepts`. Extension to other components pending real need. |
| 3 | **Attachment points** — replace left/right with typed anchors | ⏳ Deferred | Requires assembly-side refactor + render module. Documented as Phase 3. |
| 4 | **Assemblies contain transforms only** — no duplicated dimensions | ⏳ Deferred | Depends on #3 + #5. Phase 3. |
| 5 | **Anchor IDs on shells** — `string_left_start`, `tread_01`, etc. | ⏳ Deferred | Belongs on shell family metadata. Phase 3. |
| 6 | **Version components (semver)** | ✅ Adopted | Optional `version` on `ComponentBase`. Default `"1.0.0"`. Older assemblies can pin. |
| 7 | **Materials as first-class references** | ✅ Adopted | New `MaterialComponent` type (12th). First: `OAK_EUROPEAN_CLEAR_01`. Assemblies use `material_ref:` alongside legacy `materials:[]`. |
| 8 | **Rules engine — rules don't live in assemblies** | ⏳ Deferred | Today assemblies still carry intent + spacing rules. Extraction to a Rules Engine is Phase 3. |
| 9 | **BOM (Bill of Materials) layer** | ⏳ Deferred | Manufacturing extension — needs product/quote context. Phase 3+. |
| 10 | **Semantic tags for search** | ✅ Adopted | Optional `tags: string[]` on `ComponentBase`. Balusters and material both tagged. |

**Immediate wins (this pass):** 4 principles adopted (1, 6, 7, 10). Six documented as deferred with clear "why" and phase target.

**Handrail/Newel Family/Variant reversal (Philip 2026-07-29):** Philip challenged the earlier "no family split for handrails" decision. Correct challenge. **Adopting as the direction** — new profiles (Rectangular / Mopstick / Pig Ear / Heritage / Contemporary for handrails; Square / Stop Chamfer / Turned Georgian / Fluted / Contemporary for newels) will introduce families when they arrive. Existing records (`HANDRAIL_CLASSIC_01`, `NEWEL_SQUARE_FLAT_01`, `NEWEL_SQUARE_PYRAMID_01`) are NOT force-refactored — the split kicks in with new profiles per ADR-0041.

**"Stop creating per-tread shell records" — negotiated compromise:** Philip proposed collapsing 20 shell variants into one parametric family. Direct disagreement: **20 records are locked; deleting violates the immutability rule Philip himself specified.** Also, the Geometry Solver (Patch 2) already uses `family_id + tread_count → variant_id` as an O(1) lookup — the parametric behaviour exists at query time. Concrete solution: `AssemblyShellReference` union type accepts EITHER `{ component_id: string }` (backward-compat) OR `{ family_id: string; tread_count: number }` (forward-compat / parametric). Assemblies can adopt the parametric form when ready; no forced refactor.

---

## The two complementary libraries (2026-07-29 · Shells 4-6 insight)

Philip observed that NEX is building two complementary libraries — the geometry templates (shells) and the engineering knowledge that explains why they're built that way. Both already exist in the platform under different names:

| Library concept | NEX artefact | Scope | Governance |
|---|---|---|---|
| **Geometry Template Library** | Component Library (this doc) | Family-specific engineering + variant catalogue | Component workflow (draft/reviewed/locked) |
| **Engineering Knowledge Library** | Reference Brain (`hammerex_nex_brain_staircase`) | General trade knowledge (regs, workshop lore, terminology) | Rules A/B/C · immutable versions |

The distinction is scope. Family records hold engineering that is *invariant within a family* — "SHELL_STRAIGHT_CLOSED always terminates on a riser against the trimmer." Reference Brain holds engineering that is *general across all families* — "Approved Document K clause 1.6 sets the max riser height."

**A customer question like *"can you machine the top tread for 18mm engineered oak?"* is answered from the family record's `top_landing_connection.machining_supported` field. A question like *"what's the maximum rise on a domestic staircase?"* is answered from the Reference Brain.** Two libraries, one integrated NEX.

---

## The Select-and-Assemble principle (2026-07-29 · Shell 3 insight)

**NEX never invents a staircase.** It selects the correct shell (geometry template) from the catalogue, validates it against the Geometry Module, attaches the chosen components (handrails, balusters, newels, materials, finishes), and renders the result.

### The Render Assembly Module (Phase 3 future — noted 2026-07-29 · Shells 07-10)

The concrete implementation of this principle is a **Render Assembly Module** — a separate Application Module (`src/lib/nex/staircase-render/`) that takes a `ShellVariant` + attached components + materials/finishes and produces a 3D scene / workshop drawing.

Pipeline:

```
Shell ← Component Library
  + Handrail
  + Newels
  + Balusters
  + Material   ← Design Module
  + Finish
  ↓
Render Assembly Module
  ↓
3D scene / workshop drawing
```

Deferred until the geometry template library + at least one non-shell component type are complete. Per ADR-0041 — build only what real usage proves necessary.

```
Customer input
    ↓
Select shell         ← Component Library (this doc)
    ↓
Validate geometry    ← Geometry Module
    ↓
Attach components    ← Component Library (handrail / newel / baluster / etc.)
    ↓
Apply materials      ← Design Module
    ↓
Render               ← Render Module
```

Every staircase starts from an engineering-approved shell. That's the moat — most AI staircase systems generate images from prompts; NEX assembles validated designs from validated parts.

**A note on terminology.** In staircase manufacturing, "shell" is the trade term for the structural framework before finishing components attach. Semantically, that same shell functions as a **geometry template** in the assembly system — the geometric skeleton stays fixed, components attach on top. Both perspectives are correct. We keep the trade term "shell" in code and IDs (`SHELL_STRAIGHT_CLOSED_03`, `ShellFamily`, `ShellVariant`) for domain authenticity, and use "geometry template" as the mental model when describing the assembly abstraction.

---

## O(1) shell lookup (2026-07-29 · Shell 3 insight)

The family_id + variant_id convention makes shell selection direct-index, not table-scan.

Given customer input:

```typescript
const family_id  = `SHELL_${layout}_${construction}`;
const variant_id = `${family_id}_${String(treads).padStart(2, "0")}`;
// e.g. SHELL_STRAIGHT_CLOSED_13
```

The Geometry Module goes straight to the file / row. No scanning 500 shells to find the right one. At 500 variants, still O(1). At 5,000, still O(1). The catalogue can grow arbitrarily without the query slowing down.

---

## Family / Variant architecture (2026-07-29 · from Shell 2)

Shell 2 revealed that every variant in a shell family shares ~90% of its metadata. Storing 20 flat records with mostly-identical fields would violate DRY and make maintenance painful — improve one manufacturing detail, rewrite 20 files. **The architecture separates family from variant:**

```
Component Library
└── Shells
    └── Straight
        ├── SHELL_STRAIGHT_CLOSED (family)
        │   ├── SHELL_STRAIGHT_CLOSED_01 (1 tread)
        │   ├── SHELL_STRAIGHT_CLOSED_02 (2 treads)
        │   ├── SHELL_STRAIGHT_CLOSED_03 (3 treads)
        │   └── ... up to N treads
        ├── SHELL_STRAIGHT_OPEN (family)
        │   └── variants ...
        └── SHELL_STRAIGHT_GLASS (family)
            └── variants ...
    └── Quarter-turn / Half-turn / Winder / etc.
```

### What lives at the family level

**Shared engineering properties — identical for every variant:**

- `layout`, `hand`, `construction`, `string_configuration`, `open_risers`
- `top_landing_connection` (structural rules)
- `bottom_detail_default`, `landing_default`
- `balustrade_supported`, `handrail_supported`
- `materials_supported` (workshop capacity, Rule B human-curated)
- `compatible_handrails`, `compatible_newels`, `compatible_balusters` (compatibility graph)

Change one of these once → every variant picks it up automatically.

### What lives at the variant level

**Only the things that vary within the family:**

- `component_id` (family_id + `_[NN]` suffix)
- `family_id` (FK back to family)
- `treads`, `risers`
- `floor_height_envelope` per building type (Phase 2 populates)
- `bottom_detail_override` (rare — variant deviates from family default)
- `source_image_refs`, `revision`, `review_status`

### Variant ID convention for shells

**Variant number = tread count.** `SHELL_STRAIGHT_CLOSED_02` reads directly as *"2-tread straight closed-string shell"*. Self-documenting.

For non-shell types (handrails, newels, balusters, etc.) the variant number is a serial or a descriptor — decided when that type's first component enters the library.

### Query flow — how the Geometry Module uses this

Given a customer's `floor_height_mm` + `building_type`:

1. Compute `[min_rise, max_rise]` for that building type (from Approved Doc K).
2. For each variant: compute or read `floor_height_envelope = risers × [min_rise, max_rise]`.
3. Filter variants where `floor_height_mm ∈ envelope`.
4. For matched variants: check rise, going, pitch, width against family's structural rules.
5. Return matches — each carries `family_id` so downstream reads inherit family properties.

The Component Module stays focused on reusable assets. The Geometry Module owns engineering suitability. Clean separation.

### File organisation

```
data/nex-staircase-components/
├── families/
│   └── shell_straight_closed.yaml       (family record)
└── variants/
    ├── shell_straight_closed_01.yaml    (1-tread variant)
    └── shell_straight_closed_02.yaml    (2-tread variant)
```

One family file per family. One variant file per variant. Filenames match `family_id` and `component_id` in lowercase.

---

## Engineering invariants (solver rules, not schema)

These are Geometry Module constraints that emerged during Shell 1 classification. They live here so any future solver code reads them before writing calculation logic.

### 1 · A single flight terminates on a riser, not on a tread

The ascent ends with the top riser sitting against the trimmer. The top tread of the flight is the *penultimate* structural element; the final structural element is the riser against the trimmer.

For any single-flight staircase terminating on a landing or upper floor:

```
risers = treads + 1
```

The Geometry Module must derive `risers` from `treads` (or vice versa) using this rule — never treating them as independent variables.

### 2 · The top tread is the landing connection, not just another tread

The last tread of a flight has different engineering responsibilities from the interior treads:

- Depth is typically reduced (75–100mm is common in UK timber staircases).
- It sits over the trimmer.
- It may be rebated, housed, machined, or haunched.
- Its depth is adjusted for the floor finish above (timber ≈ 15–20mm allowance · laminate ≈ 8–10mm · tile varies · carpet is accommodated differently to avoid over-machining the tread and weakening it).

The `top_landing_connection` object in the shell schema captures this as a distinct element rather than a tread with modifiers. Geometry Module Phase 2 will fill in the numeric allowances based on the chosen floor finish.

### 3 · String configuration ≠ construction

- **`construction`** answers *"how is the string joinery made?"* — housed, cut, floating. Manufacturing Module reads this.
- **`string_configuration`** answers *"how do the two strings relate as a pair?"* — closed_both_sides, wall_cut, closed_open. Design + Geometry Modules read this. A wall-string on one side changes fixing rules for the whole flight — the pair matters, not just the two independent observations.

Both survive in the schema. Different downstream consumers.

---

## Schema Evolution Log

Every change to the shell schema, with the reason and the shell that revealed the need.

| Date | Change | Reason | Source |
|---|---|---|---|
| 2026-07-29 | **Component type enum extended 9 → 10 with `shoe_rail`** + `ShoeRailComponent` interface added | Philip's Assembly 02 classification referenced `SR01` as a component ID. Shoe rail is a distinct manufactured component (grooved bottom rail for balusters), not just an attribute. First real proof the 9-type lock had a legitimate gap; extended per rule "add when real usage proves need, never speculatively" (ADR-0041). | Assembly 02 · Philip |
| 2026-07-29 | Second NEWEL component (`NEWEL_SQUARE_PYRAMID_01`) added | Assembly 02 uses pyramid caps, not flat. Same square profile but different manufactured cap treatment. Distinct component_id — Rule (immutability) says a materially different component gets its own ID. | Assembly 02 · Philip |
| 2026-07-29 | `StaircaseAssembly` extended: `shoe_rails[]` array, `supports_mirroring`, richer `AssemblyBalusterSpec` (`component_family_intent`, `quantity: number \| "auto"`, `style`, `spacing_rule_citation`) | Assembly 02 introduced parametric baluster spec ("auto quantity, spacing rule 99mm") for the Render Assembly Module (Phase 3) to derive. Also mirrored the assembly whole-cloth (halves the catalogue for symmetric layouts). Assembly 01 migrated from `shoe_rail: true` boolean to the structured array. | Assembly 02 · Philip |
| 2026-07-29 | First HANDRAIL type (`HandrailComponent`) + first NEWEL type (`NewelComponent`) + first **StaircaseAssembly** interface | Philip proposed a bundled family `SHELL_STRAIGHT_CLOSED_HANDRAIL`. Pushed back — bundling causes 1,600-variant combinatorial explosion and conflicts with Philip's own earlier "assemble from separate families" architecture. Adopted separate-family model + assembly-reference layer. `data/nex-staircase-assemblies/*.yaml` for canonical composed examples; component records stay sovereign. Balusters spec captures `fitted: false + reason` so NEX can explain absence. Handrails support mirroring — one record covers both L and R. | Assembly 01 · Philip |
| 2026-07-29 | Added `interfaces` (`FamilyInterfaces` + `ConnectionEndpoint` enum) to `ShellFamily` | Family-invariant connection rules — where the shell terminates at top and bottom (floor, landing, trimmer, wall, flush_end). Lets the assembly engine validate compatibility deterministically instead of AI-reasoning about it. Structural-scale requirement per Philip's "before you build hundreds of components" nudge. | Shells 12-13 · Philip |
| 2026-07-29 | Family-complete signal for `SHELL_STRAIGHT_CLOSED` (Shells 14-20 bulk-locked as pattern-derivation) | Philip explicitly signalled that Shells 01-13 prove the family's engineering rules and higher tread counts are "additional repetitions of the same module." Shells 14-20 locked with `source_image_refs: []` + `lock_basis: pattern_derivation`. New renders can be attached later without breaking the lock — image just enriches provenance. | Shells 12-13 · Philip |
| 2026-07-29 | Added `design_envelope` to `ShellFamily` (rise_mm + going_mm × recommended + absolute · width_mm min/max) | Family-invariant engineering limits — every variant of a family shares them. Geometry Module reads this when validating customer rise/going/width against a family. First step toward the full engineering envelope. | Shells 07-10 · Philip |
| 2026-07-29 | Multi-status split (engineering / visual / production) DEFERRED | Philip's Shell 07 introduced three orthogonal statuses. Real signal but hasn't been proven needed by workflow. Single `review_status` still works. Revisit only when a workflow actually needs to separate the three states. | Shells 07-10 · Philip · ADR-0041 |
| 2026-07-29 | `tread_count` / `rise_count` naming NOT ADOPTED | Philip's preference clearer semantically, but current `treads` / `risers` fields already hold both counts. Rename would churn 21 files without functional benefit. Deferred; may adopt if a broader schema pass happens later. | Shells 07-10 · Philip · ADR-0041 |
| 2026-07-29 | Added `typical_depth_range_mm` + `machining_supported` (MachiningTarget enum) to `TopLandingConnection` | Family-level engineering knowledge — lets NEX answer customer questions like "can you rebate the top tread for 12mm laminate?" from the family record rather than per-variant. Rule B — human-curated only. | Shells 4-6 · Philip |
| 2026-07-29 | Documented **Two Libraries mapping** (§Two complementary libraries) | Philip's observation that geometry templates + engineering knowledge form two libraries maps to existing Component Library + Reference Brain. Naming the mapping so future contributors don't reinvent it. | Shells 4-6 · Philip |
| 2026-07-29 | Added `handrail_positions_supported` + `balustrade_types_supported` to `ShellFamily` | Type-level capacity fields belong at family level (all variants of `SHELL_STRAIGHT_CLOSED` accept the same handrail positions). Philip's initial variant-level placement moved up to match his own earlier statement that "every shell in a family shares… compatible handrail types, compatible balustrade types". | Shell 3 · Philip |
| 2026-07-29 | Naming: `*_supported` (type/position capacity) vs `compatible_*` (instance-level compatibility, deferred) | `compatible_*` was ambiguous — could mean "specific component_ids" or "type categories". Split into two field families with clear semantics. | Shell 3 |
| 2026-07-29 | Documented **Select-and-Assemble principle** (§Select-and-Assemble principle) | Philip's articulation: NEX never invents a staircase — it selects an approved shell, validates geometry, attaches components, renders. Belongs as a first-class principle, not buried in prose. | Shell 3 · Philip |
| 2026-07-29 | Documented **O(1) shell lookup** (§O(1) shell lookup) | Family + variant naming convention makes selection direct-index rather than table-scan. Belongs in the doc so future implementers preserve it. | Shell 3 · Philip |
| 2026-07-29 | **Family / Variant architecture** (`ShellFamily` + `ShellVariant`) | Every variant in a family shares ~90% of metadata. Storing 20 flat records duplicates engineering data and makes maintenance painful. Family holds shared props; variants hold only what varies (treads, risers, envelope). | Shell 2 · Philip |
| 2026-07-29 | Variant number NN = tread count for shells | Self-documenting IDs — `SHELL_STRAIGHT_CLOSED_02` reads as "2-tread". No lookup needed to know the count. | Shell 2 · Philip |
| 2026-07-29 | `materials_supported` moved to family level | Workshop capacity applies across every variant of a family. Rule B — human-curated only, attributed to named expert. | Shell 2 · Philip |
| 2026-07-29 | `floor_height_envelope` optional on variants | Structural placeholder for Phase 2 — Geometry Module derives `risers × [min_rise, max_rise]` per building type. Shell 1 + 2 leave unset (never guess). | Shell 2 · Philip |
| 2026-07-29 | File organisation: `families/` + `variants/` directories | Matches the architectural split. One file per family, one per variant. | Shell 2 |
| 2026-07-29 | Shell 1 → revision 2 (schema restructure) | Same physical component, same ID, moved from flat to variant-of-family. Immutability rule works as designed — engineering component unchanged, metadata schema restructured. | Shell 2 · Immutability rule |
| 2026-07-29 | ID pattern updated: `SHELL_[layout]_[construction]_[variant]` | Construction family visible in ID enables future expansion (open, glass, cut-string) without breaking existing IDs | Shell 1 · Philip |
| 2026-07-29 | Added `string_configuration` field (StringConfiguration enum) | Semantic pair captures configurations like `wall_cut` that have engineering implications as a pair, not just two independent observations | Shell 1 · Philip Rule 1 |
| 2026-07-29 | Removed `left_string_type` + `right_string_type` | Redundant with `string_configuration` for Phase 1 — asymmetric detail can be added back when a real case demands it | Shell 1 |
| 2026-07-29 | Replaced flat `top_tread: TopTreadDetail` with `top_landing_connection: TopLandingConnection` object | The top tread is a distinct engineering element (the landing connection), not just another tread with a special profile | Shell 1 · Philip Rule 2 + 4 |
| 2026-07-29 | Added `open_risers: boolean \| "unknown"` | Some contemporary designs have no riser boards — needs explicit visibility | Shell 1 · Philip's classification |
| 2026-07-29 | Wrapped `bottom_detail` and `landing` in objects | Room to add flooring transition · dimensions · turn_deg later without breaking existing YAML | Shell 1 |
| 2026-07-29 | Documented engineering invariants (§Engineering invariants) | Shell 1 taught: staircase finishes on a riser; top tread is a distinct element; construction ≠ configuration | Shell 1 · Philip Rules 3–4 |
| 2026-07-29 | Initial schema | Patch 0 | — |

---

## Component types deferred to their own definition passes

Only **shell** has a specialised type in Phase 1. Handrail / newel / baluster / string / tread / riser / landing / feature_start each get their own metadata contract *when the first component of that type is classified*, driven by what the actual shell reveals. Building all nine speculatively violates ADR-0041.

---

## Upload format — Phase 1

**Rendered PNG images.** For each shell, ideally:

- 3/4 perspective (primary view — where most classification signal lives)
- Side elevation (helps confirm tread count and string profile)
- Front elevation (confirms width symmetry and balustrade presence)

3D files (.glb / .obj / .fbx) aren't natively parseable — supplement with rendered PNGs from the viewport. CAD PDFs work; DWG needs a PNG export.

---

## Gold-standard workflow

The first shell isn't rushed. It IS the reference implementation.

| Phase | Shells | Focus |
|---|---|---|
| **Gold standard** | Shell 1 | Define complete metadata schema. Test whether every field is populatable, whether any field is missing, whether any is redundant. |
| **Schema refinement** | Shells 2–5 | Fix only genuine schema gaps discovered by real components. Log every schema change with reason: *"added `winder_direction` after Shell 4 because quarter-turn winders need it and shell 4 was the first."* |
| **Routine classification** | Shells 6+ | Schema stable. Classifications become fast and consistent. |

If we get the first one right, the next 500 components become process, not design.

---

## Phase boundaries

**Phase 1 (this doc) — identity only.**

Answer *"what is this component?"* — not *"what size is it?"*

- `component_id`
- `component_type`
- Layout / construction / counts / string type / top-and-bottom detail / landing
- Compatibility flags (`balustrade_supported`, `handrail_supported`)
- Review state

**Phase 2 (later) — geometry ranges attach.**

Once every shell has an identity, we enrich each with the geometry envelope it supports:

```yaml
component_id: SHELL_STRAIGHT_13
geometry:
  minimum_floor_height_mm:
  maximum_floor_height_mm:
  minimum_width_mm:
  maximum_width_mm:
  minimum_pitch_deg:
  maximum_pitch_deg:
  minimum_going_mm:
  maximum_going_mm:
  minimum_rise_mm:
  maximum_rise_mm:
manufacturing:
  string_thickness_mm:
  tread_thickness_mm:
  riser_thickness_mm:
  top_tread_treatment:
  housing_depth_mm:
```

Notice: we're **adding engineering to an existing component**, not creating a new component for every size. The Geometry Module then reads `SHELL_STRAIGHT_13.geometry` to know if a 2800mm floor-to-floor fits.

**Phase 3 (later) — compatibility graph.**

Populate `compatible_handrails`, `compatible_newels`, `compatible_balusters`, `compatible_materials` as the catalogue accumulates non-shell components.

---

## Success criteria (Phase 1)

The Component Library is Phase-1-successful when:

1. Every shell has been classified into a locked `ShellComponent` record.
2. Every field in every record has a determined value or `"unknown"` — no guesses, no gaps.
3. Every ID is deterministic and unique.
4. Every downstream module (Geometry, Manufacturing, Renderer, Quoter, Chat) can address a shell by ID and get back a stable metadata record.
5. The schema hasn't needed a change in the last 10 classifications — signal that it's stable.

---

## Implementation status (2026-07-29 · Patch 0)

- ✅ **Master doc** — this file. Framing corrected, five-module architecture, four locks + immutability principle.
- ✅ **Starter type schema** — `src/lib/nex/staircase-components/types.ts`. Shell components only; other types get their own definitions when first encountered.
- ⏳ **Gold-standard Shell 1** — awaiting upload.
- ⏳ **Compatibility graph shape** — deferred until Shell 2 or 3 reveals how ambiguity manifests.
- ⏳ **Vision Module extraction pipeline** — separate module (`src/lib/nex/staircase-vision/`) — deferred until we've hand-classified enough shells to know what extraction would need.
- ⏳ **Phase 2 geometry-envelope attachment** — deferred until every shell has a locked identity.
