# NEX Refacing · PR-12 Execution Specification

**Purpose:** technical contract for the Refacing image intelligence layer.
**Written:** 2026-08-12 (Gate 1 · Philip authorised · pre-Stage 8 GO LOCK)
**Status:** ACTIVE · governs any implementation of the image intelligence work.
**Authority chain:** implements PR-12 from `project_nex_refacing_architecture_v2_2026_08_12.md` (LOCKED) · consumed by any future `GO LOCK · REFACING FLOW · STAGE 8` implementation phase · sibling to `STAGE-1-REMEDIATION-SPEC.md`.

## The one sentence this spec exists to enforce

> **NEX turns an existing image library from "a folder of useful pictures" into "structured NEX design knowledge" that the Brain can retrieve, the Trade Exchange can hand off, and the customer never has to browse.**

## Non-goals (LOCKED · what this spec explicitly does NOT do)

- ❌ No new images added to the library
- ❌ No new customer-facing UI
- ❌ No new staircase categories on the customer surface
- ❌ No tagger UI (that's a separate implementation phase)
- ❌ No AI compositor (that's the Brain's job, not the library's)
- ❌ No changes to the parked bundle at `/nex-app/staircase-renovations`
- ❌ No commitment / push · everything remains uncommitted until Stage 8 GO LOCK

## Purpose bridge (what this spec produces)

```
Existing images → metadata → compatibility → retrieval → design directions → Refacing Case
                    ↑                              ↑                    ↑
                    │                              │                    │
                    │                              │                    │
                 THIS SPEC                    Brain reads              Case includes
                                              tags to compose          matched references
                                              SEE directions           at CONNECT
```

Without PR-12 done first, Stage 8 risks turning the existing images into another catalogue rather than an intelligence layer. This spec is the guarantee that doesn't happen.

---

## §1 · The eight metadata fields · full specification

Every image entry in the reference library carries these 8 fields. Priority order per PR-12 doctrine (do NOT attempt fields 4-8 until 1-3 are populated across the library).

### Field 1 · `component_role` (LOCKED · required · every image)

**Purpose:** what this image IS. Powers Brain retrieval.

**Allowed values (closed vocabulary · amendment requires memory update):**

| Value | Meaning |
|---|---|
| `baluster` | Single baluster/spindle detail or product shot |
| `newel` | Single newel post detail or product shot |
| `handrail` | Handrail detail or product shot |
| `tread` | Tread detail (top surface, nosing, edge profile) |
| `riser` | Riser detail (vertical surface between treads) |
| `stringer` | Stringer detail (open string / closed string) |
| `whole_staircase` | Complete staircase image (isometric render OR full lifestyle photo) |
| `step_unit` | Isometric single-step render on transparent background (subset of `whole_staircase` for the 19 step-units already staged) |
| `feature_step` | Special step (bullnose, curved starting step, winder, landing tread) |
| `material_swatch` | Material sample photo (species, finish, colour reference) |
| `in_situ_room` | Staircase in a fully-furnished room context (hallway, entry) |
| `detail_joinery` | Close-up of a joinery/construction detail (dovetail, mitre, fixings) |

**Multi-value:** NO · single value per image. If an image genuinely spans two roles (a whole_staircase + a detail_joinery close-up), the tagger picks the PRIMARY role and can optionally cross-reference the secondary via `related_images[]` (see §3).

**Required:** YES · every image · schema rejects entries without this field.

**Confidence:** typically `observed` (roles are visually determinable). Rare `inferred` cases where the image is ambiguous get `unknown` + admin review per ADR-0033 rule #3.

### Field 2 · `canonical_profile_ids[]` (LOCKED · required for whole_staircase & in_situ_room · optional for components)

**Purpose:** which of the 32 style×mood cells this image exemplifies. Powers Brain retrieval at SEE.

**The 32 canonical profile IDs (locked):**

Style vocabulary (8): `modern` · `classic` · `traditional` · `luxury` · `minimal` · `warm-natural` · `industrial` · `signature`
Mood vocabulary (4): `airy` · `cosy` · `bold` · `restrained`

ID pattern: `<style>_<mood>`.

Examples: `modern_airy`, `classic_cosy`, `warm-natural_restrained`, `industrial_bold`.

Full grid = 8 × 4 = 32 cells. Additional styles or moods require an explicit memory amendment.

**Multi-value:** YES · 1-3 profile IDs per image. An image often exemplifies more than one cell (a warm oak with glass balustrade is both `modern_airy` and `warm-natural_airy`). Beyond 3 = the image is too generic to be a good exemplar; admin review.

**Required:**
- `whole_staircase` · `step_unit` · `in_situ_room` · `feature_step` → YES
- `baluster` · `newel` · `handrail` · `tread` · `riser` · `stringer` · `material_swatch` · `detail_joinery` → OPTIONAL (component images may exemplify a profile but often are style-neutral)

**Confidence:** always required per field per image (`observed | inferred | unknown`).

### Field 3 · `compatibility_group_ids[]` (LOCKED · required for components in swap-galleries)

**Purpose:** cluster ID so images in the same group can be swapped at TRY without breaking style coherence. Powers the swap-a-component gallery at Refine stage.

**Formation:**
- **Brain-derived:** co-occurring components in the same `whole_staircase` hero photo form an implicit group (all balusters visible in the same modern-warm hero photo belong to `cg_modern_warm_balusters_v1`)
- **Explicit:** manual grouping by tagger for cross-source coherence (e.g. a black-metal baluster from source A and one from source B both fit `cg_modern_metal_slim_black`)
- **Role-based inference:** same-role images that share canonical profile + material + finish default to same group unless explicit override

**ID pattern:** `cg_<sequential>` or `cg_<descriptive>` (both valid). Descriptive preferred for legibility.

Examples: `cg_modern_metal_black_slim` · `cg_classic_oak_turned` · `cg_signature_walnut_flute`.

**Multi-value:** YES · an image can belong to multiple compatibility groups (a black-metal baluster fits `cg_modern_metal_black_slim`, `cg_industrial_black_metal`, and `cg_signature_black_accent`).

**Required:**
- Component images (`baluster`, `newel`, `handrail`, `tread`, `riser`, `stringer`) → YES · these appear in swap-galleries
- `whole_staircase` · `in_situ_room` → OPTIONAL (heroes rarely need cross-swap)
- `material_swatch` · `detail_joinery` → OPTIONAL

**Governance:** group creation is admin-controlled. Any tagger can PROPOSE a new group; only admin can create it. Prevents group proliferation that makes retrieval meaningless.

### Field 4 · `style[]` (LOCKED · required for whole_staircase & hero)

**Purpose:** style attribution independent of canonical profile (some images convey style without fitting a full profile cell).

**Allowed values (closed vocabulary · extensible via amendment):**

`modern` · `classic` · `traditional` · `luxury` · `minimal` · `warm-natural` · `industrial` · `signature` · `scandinavian` · `farmhouse`

**Multi-value:** YES · 1-3 typical.

**Required:** `whole_staircase` · `step_unit` · `in_situ_room` · `feature_step` → YES · components OPTIONAL.

**Confidence:** required per image.

### Field 5 · `mood[]` (LOCKED · required for whole_staircase & hero)

**Purpose:** mood attribution independent of style (a modern staircase can be airy OR bold).

**Allowed values (closed vocabulary):**

`airy` · `cosy` · `bold` · `restrained` · `dramatic` · `understated`

**Multi-value:** YES · 1-2 typical.

**Required:** same as `style[]`.

**Confidence:** required per image.

### Field 6 · `material` (LOCKED · required · every image)

**Purpose:** the dominant material family (per Riser Material Dominance rule already locked in `project_nex_refacing_step_unit_taxonomy_2026_08_12.md`).

**Family (closed vocabulary):**

`metal` · `painted` · `wood` · `glass`

**Sub-material (open vocabulary per family):**

- Metal: `brushed-stainless` · `brass` · `chrome` · `black-steel` · `wrought-iron` · `bronze` · etc
- Painted: `cream` · `white` · `sage-green` · `black` · `charcoal` · `duck-egg` · etc
- Wood: species name — `walnut` · `maple` · `oak` · `mahogany` · `cherry` · `ash` · `beech` · `iroko` · etc
- Glass: `clear` · `frosted` · `etched` · `tinted` · `smoked` · etc

**Multi-material:** YES via `material_composition[]` for images with more than one material genuinely visible:

```json
{
  "material": "wood",
  "sub_material": "oak",
  "material_composition": [
    { "component_role": "tread",       "material": "wood",    "sub_material": "oak" },
    { "component_role": "riser",       "material": "painted", "sub_material": "cream" },
    { "component_role": "baluster",    "material": "metal",   "sub_material": "black-steel" }
  ]
}
```

**Dominance rule for `material` (single-value):** file under the RISER's dominant visual family. Preserved from step-unit taxonomy.

**Required:** YES · every image · `material` + `sub_material` both required (sub-material may be `unknown` with `confidence: unknown` if photo doesn't distinguish).

**Confidence:** required per field. Species-from-photo commonly `inferred`.

### Field 7 · `geometry` (LOCKED · required for whole_staircase & in_situ_room · per-flight structure NOT single step-count)

**Purpose:** structural geometry that lets NEX match a customer's staircase to reference staircases with matching layout. Per Philip's flight-based correction, geometry is per-flight, never a single `staircase_step_count` field.

**Schema:**

```json
{
  "geometry": {
    "configuration": "quarter_landing",
    "configuration_confidence": "observed",
    "flights": [
      {
        "flight_index": 1,
        "visible_tread_count": 9,
        "visible_tread_count_confidence": "inferred",
        "orientation": "ascending"
      },
      {
        "landing_between": true,
        "landing_confidence": "observed"
      },
      {
        "flight_index": 2,
        "visible_tread_count": 8,
        "visible_tread_count_confidence": "inferred",
        "orientation": "left_turn"
      }
    ],
    "overall_shape": {
      "string_type": "closed_string",
      "string_type_confidence": "observed",
      "riser_openness": "closed_riser",
      "riser_openness_confidence": "observed"
    }
  }
}
```

**Allowed values:**

- `configuration`: `straight` · `quarter_landing` · `half_turn` · `u_turn` · `winder` · `curved` · `spiral` · `mixed` (extensible)
- `orientation` (per flight): `ascending` · `descending` · `left_turn` · `right_turn` · `winder`
- `string_type`: `open_string` · `closed_string` · `mixed`
- `riser_openness`: `open_riser` · `closed_riser` · `mixed`

**Multi-value:** N/A (single geometry per image).

**Required:**
- `whole_staircase` · `step_unit` · `in_situ_room` → YES
- Component images → typically N/A (a baluster doesn't have staircase geometry) but may carry `component_geometry` (dimensions, profile) if applicable

**Confidence:** every sub-field required per PR-16 (`configuration_confidence`, `visible_tread_count_confidence`, `landing_confidence`, `string_type_confidence`, `riser_openness_confidence`).

**Naming rule (PR-16 HARD constraint):** the field is `visible_tread_count` not `tread_count`. The field is `configuration_confidence: observed` not `configuration: quarter_landing_confirmed`. Never a name that implies certainty from visual-only evidence.

### Field 8 · `confidence` (LOCKED · required · every field per image · PR-16 HARD CONSTRAINT)

**Purpose:** every field written into a Refacing Case or a reference library entry must carry an epistemic marker.

**Values (closed vocabulary):**

- `observed` — clearly visible in the image (e.g. distinctive open oak grain visible = `sub_material_confidence: observed`)
- `inferred` — likely based on visual evidence but not certain (e.g. species inferred from tone alone = `sub_material_confidence: inferred`)
- `unknown` — the image doesn't show enough to determine (e.g. photo shows only detail, cannot see full component = `<field>_confidence: unknown`)

**Application:** at ATTRIBUTE level, not just image level. An image might have `sub_material_confidence: observed` and `dimensions_confidence: unknown`.

**Required:** YES for every field. Schema rejects any entry with a certainty-named field lacking a `_confidence` sibling.

**Naming rule (PR-16 HARD constraint):**

If image suggests oak → write:
```json
{ "sub_material": "oak", "sub_material_confidence": "inferred" }
```
NOT:
```json
{ "sub_material": "oak" }
```

Multi-flight staircase → per §Field 7 pattern with per-flight confidence.

---

## §2 · Full schema (JSON)

A single reference library entry:

```json
{
  "image_id": "img_20260810_walnut_hero_01",
  "src": "/staircase-renovations/walnut/walnut-treads-and-risers-white-stairparts-01.png",
  "alt": "Dark walnut treads and risers with white newel, handrail and turned balusters",

  "component_role": "whole_staircase",
  "component_role_confidence": "observed",

  "canonical_profile_ids": ["classic_cosy", "warm-natural_cosy"],
  "canonical_profile_ids_confidence": "inferred",

  "compatibility_group_ids": ["cg_classic_walnut_turned_v1"],

  "style": ["classic", "warm-natural"],
  "style_confidence": "observed",

  "mood": ["cosy", "restrained"],
  "mood_confidence": "observed",

  "material": "wood",
  "material_confidence": "observed",
  "sub_material": "walnut",
  "sub_material_confidence": "inferred",

  "material_composition": [
    { "component_role": "tread",    "material": "wood",    "sub_material": "walnut",  "confidence": "inferred" },
    { "component_role": "riser",    "material": "wood",    "sub_material": "walnut",  "confidence": "inferred" },
    { "component_role": "newel",    "material": "painted", "sub_material": "white",   "confidence": "observed" },
    { "component_role": "handrail", "material": "painted", "sub_material": "white",   "confidence": "observed" },
    { "component_role": "baluster", "material": "painted", "sub_material": "white",   "confidence": "observed" }
  ],

  "geometry": {
    "configuration": "straight",
    "configuration_confidence": "observed",
    "flights": [
      {
        "flight_index": 1,
        "visible_tread_count": 13,
        "visible_tread_count_confidence": "inferred",
        "orientation": "ascending"
      }
    ],
    "overall_shape": {
      "string_type": "closed_string",
      "string_type_confidence": "observed",
      "riser_openness": "closed_riser",
      "riser_openness_confidence": "observed"
    }
  },

  "quality": {
    "photo_quality_score": 4,
    "staged_or_real": "staged",
    "has_before_photo": false,
    "has_after_photo": true,
    "case_study_ref": null
  },

  "governance": {
    "owner_type": "nex_curated",
    "owner_id": "nex",
    "visibility_label": "INSPIRATION_LIBRARY",
    "created_at": "2026-08-10",
    "updated_at": "2026-08-12",
    "superseded_by": null,
    "retention_class": "long_term"
  },

  "related_images": [
    { "image_id": "img_20260810_walnut_hero_02", "relation": "same_case_study" },
    { "image_id": "img_20260810_walnut_baluster_close", "relation": "detail_of" }
  ]
}
```

## §3 · Storage · file structure · versioning

**Storage:** extend the existing `data/staircase-renovations/manifest.json` (currently v2) → v3 by adding an `images_v3[]` array alongside the existing `categories[]` and `step_units[]`.

**Backward compatibility:** v2 fields (`categories[]`, `step_units[]`) are PRESERVED unchanged. Consumers of v2 continue to work. The new v3 richer entries in `images_v3[]` are the intelligence layer.

**Cross-reference:** entries in `images_v3[]` that also appear in `categories[]` or `step_units[]` share the `src` field · consumers doing a full-intelligence read use `images_v3[]` · consumers doing legacy display use the category / step-unit blocks.

**Version field:** `"version": 3` at manifest root when `images_v3[]` first populated. All new writes use v3 shape.

**Migration path:** additive-only · never delete v2 blocks · never mutate existing v2 entries. The migration is a one-time script that walks the existing category/step-unit images and emits v3 entries with initial confidence markers of `unknown` or `inferred` (never `observed` — that requires tagger review per §4).

**File location:** `data/staircase-renovations/manifest.json` (unchanged). No new files.

## §4 · Tagging workflow

### §4.1 · Priority order (LOCKED)

Do fields 1-3 across the entire library BEFORE starting fields 4-8. Retrieval and composition depend on the earlier fields. Rationale from architecture memory: "Do not attempt fields 4-8 until 1-3 are populated across the existing library."

### §4.2 · Tagger identity

Per NEX Golden Rules (ADR-0027/0028/0030/0033):

- **Level 1 · Collection Intelligence** — auto-inherit from established canonical profiles where per-field confidence ≥ 85%
- **Level 2 · Image Intelligence** — parse from existing `alt` text where confident
- **Level 3 · Relationship Intelligence** — cross-reference via `related_images[]`
- **Level 4 · MASTER AI PROMPT auto-generator** — compose from real inherited+inferred fields
- **Level 5 · Vision Intelligence** — pixel inspection via vision model (deferred build)
- **Level 6 · Admin Review** — LAST resort · fires when levels 1-5 combined < 85%

Target: < 5% admin intervention (per ADR-0030 preamble).

### §4.3 · Save gate (per ADR-0033 · Quality over Quantity)

Every write to `images_v3[]` passes through the score gate:

- **≥ 70 overall confidence** → clean save · entry enters intelligence · surfaces in matcher/brains/cards
- **50-69** → `draft_only: true` · filtered from every intelligence read · admin can promote
- **< 50** → **SAVE FAILED** with missing-fields list · admin must resolve

Never lower thresholds to inflate completion. That's a Golden Rule #2 violation.

### §4.4 · What "observed" means for a tagger

- The image clearly shows the attribute (grain pattern proves oak · geometry clearly shows quarter-landing).
- Not inferred from context, not inferred from filename, not inferred from category.
- If a tagger is not sure, `inferred` is correct — never upgrade `inferred` → `observed` on second pass to look better.

### §4.5 · Multi-tag semantics

- `canonical_profile_ids[]`, `style[]`, `mood[]`, `compatibility_group_ids[]`, `material_composition[]` are all multi-value.
- Order within array is INSIGNIFICANT — arrays are treated as sets by retrieval.
- Empty array = "unknown/not applicable" (schema allows) · retrieval treats absent = null.

## §5 · Retrieval logic · how the Brain queries this library

### §5.1 · At SEE (customer stage · design directions)

Input: `{style_vector, mood, must_not_change, base_geometry, base_component_inventory, budget_band, region}` from FEEL + PHOTO UNDERSTANDING.

Query pipeline:

1. **Filter** — exclude images that violate MUST_NOT_CHANGE (customer's veto) or geometry incompatibility (wrong configuration for their staircase).
2. **Score** — rank remaining images by:
   - 0.30 canonical_profile match (Jaccard overlap of `canonical_profile_ids[]` with query's style×mood vector)
   - 0.20 style overlap
   - 0.15 mood overlap
   - 0.15 material match (dominant + sub_material)
   - 0.10 geometry match (configuration + flight structure)
   - 0.05 quality score
   - 0.05 has_before/has_after (evidence boost)
3. **Diversify** — enforce meaningful spread across the 3 directions (Safe Centre / Warm Character / Stretch Statement) by capping same-profile picks; second and third pick must add profile diversity.

Output: 2-4 `whole_staircase` or `in_situ_room` images with meaningful directional span.

### §5.2 · At TRY (customer stage · component refinement)

Input: current chosen design's compatibility group IDs · which component the customer wants to swap (`baluster` / `handrail` / etc).

Query: all images with `component_role: <target>` AND overlap in `compatibility_group_ids[]` with the current design's groups.

Output: 5-8 alternates that maintain style coherence.

### §5.3 · At CONNECT (member handoff)

The Refacing Case Package includes the chosen images (`whole_staircase` + component selections) with full `images_v3[]` metadata attached. Member sees the intelligence, not raw images.

## §6 · Compatibility relationships · full model

### §6.1 · Groups (Field 3) recap

Component images that share style coherence + material + finish belong to the same compatibility group.

### §6.2 · Composition rules (Brain-level, informed by library)

At SEE and TRY, the Brain composes designs by drawing components from a shared compatibility group. Rules:

- **Never mix incompatible groups in one design** — a `cg_modern_metal_black_slim` baluster cannot appear in a design otherwise composed of `cg_classic_oak_turned` components.
- **Cross-group swaps at TRY require re-composition** — if the customer swaps a baluster from a modern group into a classic-composed design, the Brain re-evaluates whether other components need to update too, and asks the customer via Compatibility Check (Stage 8 · LOCK · PR-4).

### §6.3 · How groups form (spec)

- **From heroes:** every `whole_staircase` hero that passes quality gate creates or updates one or more `cg_*` IDs based on its `material_composition[]` and `canonical_profile_ids[]`.
- **From explicit tagging:** admin tagger can create a group and assign images to it. Requires a `group_description` field (30-80 chars) so its meaning stays legible.
- **From role + profile:** an inference layer proposes group memberships for component images based on same-role + same-profile matches. Admin confirms before persistence.

## §7 · Confidence enforcement (PR-16 HARD CONSTRAINT · schema + naming + drift-catcher)

### §7.1 · Schema validator

Every field that describes an observable attribute MUST have a sibling `<field>_confidence` field with value `observed | inferred | unknown`. Validator:

```
For every entry in images_v3[]:
  For every field <F> in [component_role, canonical_profile_ids, style, mood, material, sub_material,
                          configuration, visible_tread_count, string_type, riser_openness]:
    if <F> is present and <F>_confidence is absent:
      REJECT with error: "PR-16 violation · field '<F>' missing '<F>_confidence' sibling"
    if <F>_confidence is present and value not in ['observed', 'inferred', 'unknown']:
      REJECT with error: "PR-16 violation · '<F>_confidence' must be observed|inferred|unknown"
```

Runs at write time. Never bypass.

### §7.2 · Naming convention

Fields that could imply certainty from visual-only evidence MUST use hedged names:

| Certainty-named (BANNED) | Hedged (REQUIRED) |
|---|---|
| `species` | `sub_material` (with sub_material_confidence) |
| `tread_count` | `visible_tread_count` |
| `configuration` | `configuration` + `configuration_confidence` |
| `baluster_type` | `component_role: baluster` + `sub_material` |
| `staircase_has_landing` | `landing_between` (per flight) + `landing_confidence` |
| `regulation_status` | (never present · regulation is a survey concern, not a library concern) |
| `dimensions` | (never present · dimensions are a survey concern) |

Enforced by drift-catcher scan (§7.3).

### §7.3 · CI drift-catcher

A test in the CI pipeline scans all code that WRITES to `images_v3[]` and rejects the build if:

- Any assignment sets a certainty-named field (`species = 'oak'` etc)
- Any assignment sets a field without a `_confidence` sibling
- Any assignment sets `_confidence: 'observed'` from a visual-only evidence source (heuristic: source function is a vision-inference module)

Purpose: prevent the rule silently eroding as new fields are added.

## §8 · Validation

### §8.1 · Schema tests

- `images_v3.schema.json` (JSON Schema · versioned) validates every entry.
- Test suite runs against every entry on every write.

### §8.2 · Coverage metrics

Track and report:

- % of images with `component_role` populated
- % of images with `canonical_profile_ids[]` populated (per role subset — heroes must be 100%, components optional)
- % of images with `compatibility_group_ids[]` populated (per role subset — components in swap-galleries must be 100%)
- Distribution of `_confidence` values per field (target: `observed` ≥ 40% for objective fields, `inferred` ≤ 55%, `unknown` ≤ 5%)
- Coverage per canonical profile cell (target: each of 32 cells has ≥ 3 A+ images so Level 1 collection intelligence can bootstrap · per ADR-0030)

### §8.3 · Regression tests

- Round-trip test: write entry → validate → read back → validate. Byte-exact preservation of confidence markers.
- Retrieval test: given a fixed query at SEE, verify the top-3 results are deterministic and diversified.
- Compatibility test: given a swap request at TRY, verify only within-group alternates are returned.
- PR-16 negative test: attempt to write an entry with `species: "oak"` and no confidence sibling · assert schema rejects.

## §9 · Success criteria (definition of PR-12 DONE)

PR-12 execution is complete when ALL of these are true:

1. Every image in the existing library (currently ~59 across categories + step_units) has an `images_v3[]` entry with:
   - `component_role` populated (100%)
   - `component_role_confidence` populated (100%)
2. At least 80% of `whole_staircase` and `in_situ_room` entries have `canonical_profile_ids[]` populated with ≥ 1 profile ID.
3. Every component-role image (`baluster`, `newel`, `handrail`, `tread`, `riser`, `stringer`) has ≥ 1 `compatibility_group_ids[]` assignment.
4. Every field in every entry has its `_confidence` sibling. Schema validator green.
5. CI drift-catcher green. No certainty-named field assignments in Case-generation or library-write code.
6. Coverage per canonical profile cell: at least 12 of 32 cells have ≥ 3 A+ images (bootstrap threshold for Level 1 collection intelligence per ADR-0030). Full 32-cell coverage is a stretch goal, not a blocker.
7. Round-trip and retrieval regression tests green.
8. Migration script has run non-destructively · existing `categories[]` and `step_units[]` blocks byte-identical to pre-migration.

Any failure of 4, 5, or 8 blocks the PR-12 completion sign-off.

## §10 · Migration script structure (non-destructive · additive · reversible)

**Location:** `scripts/refacing/migrate-manifest-to-v3.mjs` (new file, does not exist yet).

**Behaviour:**
1. Read `data/staircase-renovations/manifest.json` (v2)
2. For each entry in `categories[].images[]` and `step_units[].step_units[]`:
   - Derive `component_role` from category slug + entry filename (heuristics: `oak/*` → `whole_staircase`, `step-units/*/monolithic-*` → `step_unit`, etc)
   - Set `component_role_confidence: "inferred"` (default · admin can promote to `observed` after review)
   - Derive `material` from step-unit family or category slug
   - Set all other fields to null with `_confidence: "unknown"` (never `observed`)
   - Emit v3 entry into a new `images_v3[]` block
3. Bump `manifest.json` version 2 → 3
4. NEVER mutate existing `categories[]` or `step_units[]` blocks · additive-only
5. Write output to `data/staircase-renovations/manifest.json`
6. Output migration report: X entries created, Y with derived data, Z requiring admin tagging pass

**Reversibility:** removing the `images_v3[]` block + downgrading version → 2 returns the manifest to pre-migration state exactly. Tested in the regression suite.

## §11 · What's NOT in this spec (defer to later)

- **Tagger UI** — no admin interface designed yet. First pass is likely a script + admin JSON edit workflow. UI is a separate Stage 8 implementation phase.
- **AI-composer for SEE stage** — how the Brain assembles the customer's actual staircase visualisation. That's Stage 8+ / Brain team responsibility.
- **Real-time vision model integration** (Level 5 per ADR-0030) — deferred until Level 1-4 are operational.
- **HQ observability of tagging quality** — dashboards for coverage metrics live in HQ, not in this spec. Data model is here; surfacing is HQ's job.
- **Trade-side portfolio images** — Members eventually add their own portfolio (per Stage 4 D locked). Separate `images_v3[]` entries with `governance.owner_type: "trade_partner"`. Same schema, different owner.

## §12 · Amendment procedure

Any amendment to this spec requires:

1. A named change (which field · which section · what changes)
2. A cross-reference check against `project_nex_refacing_architecture_v2_2026_08_12.md` PRODUCT RULES (must not violate PR-1 through PR-17)
3. A cross-reference check against `project_nex_refacing_step_unit_taxonomy_2026_08_12.md` (still governs the step-unit subset)
4. A cross-reference check against `project_nex_refacing_flow_stage7_2026_08_10.md` (Stage 7 image schema locks · this spec extends but never contradicts them)
5. A note in the amendment section below with date + author

Amendments to closed vocabularies (component_role values, style values, mood values, configuration values) require an explicit memory update — not a spec-only change.

## §13 · How to apply (posture for implementation)

- When implementation of PR-12 begins: read this spec first · then read `project_nex_refacing_architecture_v2_2026_08_12.md` PR-12 section · then read `project_nex_refacing_step_unit_taxonomy_2026_08_12.md`.
- When a tagger asks "should I add this new image?" → NO · this spec exists to add intelligence to what's already there. New images are a separate authorised workstream.
- When a developer asks "should I bypass the schema validator for this special case?" → NO · PR-16 is a HARD CONSTRAINT.
- When admin asks "can we promote all `inferred` markers to `observed` in bulk?" → NO · promotion is per-image with review.
- When a proposal wants to add a certainty-named field ("just this once, we know it's oak") → NO · every field is hedged or admin review, no exceptions.

## §14 · Governance

- **This spec is amendable only via §12 procedure.**
- **This spec does NOT authorise implementation.** Implementation requires the Stage 8 GO LOCK typed by Philip.
- **If a future proposal contradicts this spec AND the PR-12 doctrine:** default answer is NO. Cite this file + architecture memory PR-12.

---

**End of PR-12 Execution Specification.**

**Next authorised operation:** Philip's typed `GO LOCK · REFACING FLOW · STAGE 8`. Until then, the parked bundle at `/nex-app/staircase-renovations` remains uncommitted and unchanged.
