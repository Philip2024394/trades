// NEX Staircase Component Library — Phase 1 type contracts.
//
// Master doc: docs/nex/staircase-component-library.md
//
// Schema evolution log (add newest at top):
//   2026-07-29 · Shell 2 revealed the Family/Variant architecture:
//     - `ShellFamily` — shared engineering properties (layout, construction,
//       string_configuration, top_landing_connection, materials_supported, etc.)
//     - `ShellVariant` — per-instance record: treads, risers, floor_height_envelope,
//       links back to family via `family_id`
//     - Variant number in the ID = tread count for shells (`SHELL_STRAIGHT_CLOSED_02`
//       reads as "2-tread straight closed-string shell")
//     - `materials_supported` at the family level (human-curated per Rule B)
//     - `floor_height_envelope` optional on variants (Phase 2 populates)
//   2026-07-29 · Shell 1 revealed:
//     - `string_configuration` as its own field
//     - `top_tread` (flat enum) → `top_landing_connection` (nested object)
//     - `open_risers: boolean | "unknown"` added
//     - ID pattern: SHELL_LAYOUT_CONSTRUCTION_VARIANT
//     - Bottom detail + landing wrapped in objects
//   2026-07-29 · Patch 0: initial schema
//
// Design rules:
// - No logic in this file. Contracts only.
// - Every field either has a determined value or is "unknown" — never guessed.
// - `readonly` on every field. Immutable once locked.
// - StairLayout / StairHand imported from Geometry Module.

import type { StairLayout, StairHand } from "../staircase-geometry/types";

// ─── Enums ────────────────────────────────────────────────────────

/** Component types. Started at 9 (2026-07-29) → 10 (`shoe_rail`, Assembly 02)
 *  → 11 (`material`, Assembly 03 · Philip Principle 7 — material as
 *  first-class reference). Extend only when real usage proves the need. */
export type ComponentType =
  | "shell" | "string" | "tread" | "riser"
  | "handrail" | "newel" | "baluster"
  | "landing" | "feature_start"
  | "shoe_rail"
  | "material";

/** Classification lifecycle. Only `locked` records become source-of-truth
 *  for downstream modules. */
export type ReviewStatus = "draft" | "reviewed" | "locked";

/** Joinery + visual profile of the strings. Manufacturing Module reads this. */
export type ConstructionType =
  | "housed_closed" | "housed_open" | "cut_string" | "open_string"
  | "floating" | "cantilever" | "unknown";

/** Configuration of the two strings as a semantic pair.
 *  Design + Geometry Modules read this. */
export type StringConfiguration =
  | "closed_both_sides" | "closed_open" | "open_both_sides"
  | "wall_cut" | "wall_closed" | "unknown";

/** Handrail mount positions a shell family can accept.
 *  Added 2026-07-29 (Shell 3). */
export type HandrailPosition = "left" | "right" | "both";

/** Balustrade type categories a shell family can accept.
 *  Type-level capacity, not instance-level compatibility.
 *  Added 2026-07-29 (Shell 3). */
export type BalustradeType =
  | "timber" | "glass" | "stainless" | "steel" | "mixed";

// ─── Connection interfaces (added 2026-07-29 · Shells 12-13) ─────
//
// How a shell family connects to other structural elements at its
// top and bottom. Family-invariant — every variant terminates the
// same way. Lets the assembly engine validate a project without
// asking the AI to reason about compatibility.

/** Endpoints a shell can connect against.
 *  `floor` = finished floor (typical bottom for a full flight).
 *  `landing` = intermediate landing (for split flights).
 *  `trimmer` = ceiling trimmer (typical top for a full flight).
 *  `wall` = wall termination (e.g. a wall-side landing).
 *  `flush_end` = finished flush against another element (bespoke). */
export type ConnectionEndpoint =
  | "floor"
  | "landing"
  | "trimmer"
  | "wall"
  | "flush_end";

export interface ConnectionInterface {
  readonly accepts: readonly ConnectionEndpoint[];
}

export interface FamilyInterfaces {
  readonly lower_connection: ConnectionInterface;
  readonly upper_connection: ConnectionInterface;
}

// ─── Ranges (added 2026-07-29 · Shells 07-10) ────────────────────

/** Simple min-max range in a single unit. */
export interface RangeMinMax {
  readonly min: number;
  readonly max: number;
}

/** Recommended range (practical / preferred) + absolute range
 *  (regulatory / hard limit). Both required — recommended sits
 *  inside absolute. */
export interface RecommendedAbsoluteRange {
  readonly recommended: RangeMinMax;
  readonly absolute: RangeMinMax;
}

/** The family's design envelope — the practical + absolute limits
 *  within which its geometry lives. Family-invariant — every variant
 *  of a family shares these ranges. The Geometry Module reads these
 *  when validating a customer's rise/going/width against a family. */
export interface DesignEnvelope {
  readonly rise_mm: RecommendedAbsoluteRange;
  readonly going_mm: RecommendedAbsoluteRange;
  readonly width_mm: RangeMinMax;
}

/** Floor-finish categories the top-tread machining supports.
 *  Added 2026-07-29 (Shells 4-6). Rule B — workshop capacity,
 *  human-curated only. Lets NEX answer customer questions like
 *  "can you machine the top tread for 18mm engineered oak?"
 *  from family-level engineering knowledge, not per-variant. */
export type MachiningTarget =
  | "timber_floor"
  | "laminate_floor"
  | "tile_floor"
  | "carpet_floor";

export type BottomDetailType =
  | "standard_start" | "bullnose" | "scroll" | "d_end"
  | "kite_start" | "feature_start" | "unknown";

export type LandingKind = "quarter" | "half" | "dogleg" | "unknown";

// ─── Nested value objects ────────────────────────────────────────

/** The top landing connection — a distinct engineering element (not
 *  just a tread with modifiers). Reduced depth over the trimmer, riser
 *  against trimmer, floor-finish allowance machined in. `configurable`
 *  values are Phase 2 placeholders. */
export interface TopLandingConnection {
  readonly enabled: boolean;
  readonly reduced_tread: boolean;
  readonly sits_on_trimmer: boolean;
  readonly final_riser_against_trimmer: boolean;
  readonly flooring_allowance: "configurable" | number;
  readonly carpet_allowance: "configurable" | number;

  /** Typical depth range for the reduced top tread in mm.
   *  e.g. { min: 75, max: 100 } for UK timber closed-string.
   *  Family-level workshop knowledge. Added 2026-07-29 (Shells 4-6). */
  readonly typical_depth_range_mm?: {
    readonly min: number;
    readonly max: number;
  };

  /** Floor-finish machining the family's top-tread supports.
   *  Empty array means "not yet documented", not "none supported".
   *  Added 2026-07-29 (Shells 4-6). Rule B applies. */
  readonly machining_supported?: readonly MachiningTarget[];
}

export interface BottomDetail {
  readonly type: BottomDetailType;
}

export interface LandingSpec {
  readonly included: boolean;
  readonly kind?: LandingKind;
}

/** Floor-height envelope for a variant under a given building type.
 *  Derived from `risers × [min_rise, max_rise]` where the rise range
 *  depends on Approved Doc K + building type. Populated by Geometry
 *  Module Phase 2, not by the classifier. */
export interface FloorHeightEnvelope {
  readonly min_mm: number;
  readonly max_mm: number;
}

// ─── ShellFamily — shared engineering properties ─────────────────
//
// Introduced 2026-07-29 (Shell 2). A family holds the properties every
// variant in it inherits. Change a family property once and every variant
// picks it up. `materials_supported` and the compatibility graph live
// here — they're workshop capacity statements, human-curated per Rule B.

export interface ShellFamily {
  /** e.g. "SHELL_STRAIGHT_CLOSED". Same as a variant ID minus the
   *  `_[NN]` suffix. Uppercase, underscore-separated. */
  readonly family_id: string;

  /** Human-readable family name. */
  readonly family_name: string;

  /** Always "shell" for a ShellFamily. Discriminator so mixed lookups
   *  can filter. */
  readonly component_type: "shell";

  // ─── Structural fingerprint (identical for every variant) ─────
  readonly layout: StairLayout;
  readonly hand: StairHand;
  readonly construction: ConstructionType;
  readonly string_configuration: StringConfiguration;
  readonly open_risers: boolean | "unknown";

  // ─── Structural rules — apply the same way at any tread count ─
  readonly top_landing_connection: TopLandingConnection;
  readonly bottom_detail_default: BottomDetail;
  readonly landing_default: LandingSpec;
  readonly balustrade_supported: boolean | "unknown";
  readonly handrail_supported: boolean | "unknown";

  // ─── Workshop capacity (human-curated · Rule B applies) ───────
  //
  // TYPE-LEVEL capacity: what categories of thing this family accepts.
  // Rule B: populated by named expert only. AI never adds entries here.
  // Instance-level compatibility (specific component_ids validated
  // together) lives in the `compatible_*` fields below and is
  // Phase-2 deferred.

  /** Timbers / finish categories this family can be manufactured in.
   *  e.g. ["oak", "walnut", "ash", "painted"] */
  readonly materials_supported: readonly string[];

  /** Handrail mount positions this family accepts.
   *  e.g. ["left", "right", "both"] */
  readonly handrail_positions_supported: readonly HandrailPosition[];

  /** Balustrade type categories this family accepts.
   *  e.g. ["timber", "glass", "stainless", "mixed"] */
  readonly balustrade_types_supported: readonly BalustradeType[];

  /** Design envelope — the practical + absolute geometric limits
   *  within which every variant of this family lives. Family-invariant.
   *  Read by the Geometry Module when validating customer rise/going/
   *  width against the family. Added 2026-07-29 (Shells 07-10). */
  readonly design_envelope?: DesignEnvelope;

  /** Connection interfaces — how this family's shells terminate at
   *  their top and bottom. Family-invariant. Lets the assembly engine
   *  validate structural compatibility without AI reasoning.
   *  Added 2026-07-29 (Shells 12-13). */
  readonly interfaces?: FamilyInterfaces;

  // ─── Instance-level compatibility (Phase 2 deferred) ──────────
  // Specific component_ids validated as compatible. Populated once
  // the non-shell catalogue has enough entries for real ambiguity.

  readonly compatible_handrails?: readonly string[];
  readonly compatible_newels?: readonly string[];
  readonly compatible_balusters?: readonly string[];

  // ─── Provenance ───────────────────────────────────────────────
  readonly created_at: string;
  readonly created_by: string;   // Rule C — attributable origin
  readonly revision: number;
  readonly review_status: ReviewStatus;
  readonly notes?: readonly string[];
}

// ─── ShellVariant — one row per (family, tread count) ────────────
//
// Renamed from `ShellComponent` after Shell 2 revealed the family/variant
// architecture. Downstream code that imported `ShellComponent` should
// migrate to `ShellVariant`.

export interface ShellVariant {
  /** Full ID including variant suffix. e.g. `SHELL_STRAIGHT_CLOSED_02`.
   *  For shells the variant number equals the tread count. */
  readonly component_id: string;

  readonly component_type: "shell";

  /** FK to `ShellFamily.family_id`. e.g. `SHELL_STRAIGHT_CLOSED`.
   *  This variant inherits every property from its family. */
  readonly family_id: string;

  readonly revision: number;
  readonly classified_at: string;
  readonly source_image_refs: readonly string[];

  // ─── The only fields that vary within a family ────────────────
  readonly treads: number;                // matches variant number
  readonly risers: number;                // = treads + 1 (Engineering Invariant §1)

  /** Floor-height envelope per building type — the Geometry Module
   *  uses this to filter variants when a customer's floor height
   *  arrives. Populated in Phase 2 (deferred). */
  readonly floor_height_envelope?: {
    readonly dwelling?: FloorHeightEnvelope;
    readonly non_domestic?: FloorHeightEnvelope;
    readonly assembly?: FloorHeightEnvelope;
    readonly loft_only?: FloorHeightEnvelope;
  };

  /** Rare: this variant overrides its family's default bottom detail
   *  (e.g. a specific 3-tread variant that ships bullnose by default).
   *  If absent, use family's default. */
  readonly bottom_detail_override?: BottomDetail;

  // ─── Review ───────────────────────────────────────────────────
  readonly confidence: number;
  readonly review_status: ReviewStatus;
  readonly notes?: readonly string[];
}

/** @deprecated Use ShellVariant. Kept as alias until callers migrate. */
export type ShellComponent = ShellVariant;

// ─── ComponentBase (still used by non-shell components) ─────────

export interface ComponentBase {
  readonly component_id: string;
  readonly component_type: ComponentType;
  readonly revision: number;

  /** Semantic version — Philip Principle 6 (Assembly 03 · 2026-07-29).
   *  Older assemblies can pin to specific versions if they need render
   *  fidelity. Format: "MAJOR.MINOR.PATCH". Default "1.0.0". */
  readonly version?: string;

  /** Optional family + variant grouping — Philip Principle 1
   *  (Component Interface). Empty means the component is standalone. */
  readonly family?: string;
  readonly variant?: string;

  readonly classified_at: string;
  readonly source_image_refs: readonly string[];
  readonly confidence: number;
  readonly review_status: ReviewStatus;

  /** Semantic tags for search — Philip Principle 10.
   *  e.g. ["timber", "oak", "domestic", "traditional", "square", "uk"]. */
  readonly tags?: readonly string[];

  readonly notes?: readonly string[];
}

// ─── Handrail — first non-shell type (added 2026-07-29 · Assembly 01) ─
//
// Design decision from Philip's assembly discussion:
// Handrails do NOT get a Family/Variant split yet — different profiles
// (classic / modern / ornate) share nothing structurally, so treating
// them as variants of a common family would be false. Each handrail
// is a standalone component. Add a Family layer later if a real profile
// tree emerges.

/** Cross-section shapes a handrail can have. */
export type HandrailCrossSectionShape = "round" | "square" | "rectangular" | "moulded" | "unknown";

/** Terminal treatment at each end of the handrail. */
export type HandrailTerminal = "wall_end" | "mitred" | "scrolled" | "volute" | "wreathed" | "wall_bracket" | "unknown";

export interface HandrailComponent extends ComponentBase {
  readonly component_type: "handrail";

  /** e.g. "classic_rounded", "modern_flat", "ornate_carved". Free-form
   *  for now; enum when a set stabilises. */
  readonly profile_name: string;

  readonly cross_section_shape: HandrailCrossSectionShape;

  /** Section dimensions in mm. Height optional for round profiles. */
  readonly section_mm: { readonly width: number; readonly height?: number };

  /** Whether this handrail component can be visually mirrored to
   *  produce a right-handed version from the same left-handed record
   *  (or vice versa). Halves the catalogue when true. */
  readonly supports_mirroring: boolean;

  readonly terminal_start: HandrailTerminal;
  readonly terminal_finish: HandrailTerminal;

  /** Shell families this handrail is validated against. Optional —
   *  empty means unassessed, not "compatible with everything". */
  readonly compatible_shell_families?: readonly string[];
}

// ─── Newel — first non-shell type (added 2026-07-29 · Assembly 01) ────

/** Newel profile shape. */
export type NewelProfile = "square" | "turned" | "chamfered" | "carved" | "moulded" | "unknown";

/** Cap style at the top of the newel. */
export type NewelCapStyle = "flat" | "ball" | "acorn" | "pyramid" | "moulded" | "chamfered_flat" | "unknown";

export interface NewelComponent extends ComponentBase {
  readonly component_type: "newel";

  readonly profile: NewelProfile;

  /** Face section in mm (square newel: 90 = 90×90mm). Rectangular
   *  variants would need width/height — extend when a real case demands. */
  readonly section_mm: number;

  readonly cap_style: NewelCapStyle;

  /** Whether this newel is intended for the start (bottom of flight)
   *  or the finish (top / landing), or both. */
  readonly usable_positions: readonly ("start" | "finish" | "intermediate")[];

  readonly compatible_shell_families?: readonly string[];
}

// ─── Shoe rail (added 2026-07-29 · Assembly 02) ─────────────────
//
// The lower rail that runs along the string and receives balusters.
// Manufactured separately from the string; different profiles
// (grooved for spindles vs plain vs moulded). First proved real by
// Philip's Assembly 02 classification referencing `SR01`.

export type ShoeRailProfile =
  | "grooved_for_spindles" | "plain" | "moulded" | "chamfered" | "unknown";

export interface ShoeRailComponent extends ComponentBase {
  readonly component_type: "shoe_rail";

  readonly profile: ShoeRailProfile;

  /** Section dimensions in mm (typical: 55×27mm for UK domestic). */
  readonly section_mm: { readonly width: number; readonly height: number };

  readonly compatible_shell_families?: readonly string[];
}

// ─── Assembly reference (added 2026-07-29 · Assembly 01) ─────────
//
// A StaircaseAssembly documents a specific composition of shell +
// handrail + newels + balusters. Two use cases:
//   - assembly_type: "static_reference" — canonical example images
//     the Render Module and marketing use as the "this is how it
//     looks" record. Human-curated.
//   - assembly_type: "customer_configuration" — actual customer
//     projects where NEX has selected the components for them.
//     Machine-produced (with human sign-off before order).
//
// Lives at data/nex-staircase-assemblies/*.yaml.

export type AssemblyType = "static_reference" | "customer_configuration";

/** How a specific handrail attaches to a specific shell within an assembly. */
export interface AssemblyHandrailAttachment {
  readonly component_id: string;      // FK to HandrailComponent
  readonly position: HandrailPosition; // "left" | "right" | "both"
  readonly mirrored: boolean;         // true if this instance is the mirror image
}

export interface AssemblyNewelAttachment {
  readonly component_id: string;      // FK to NewelComponent
  readonly at: "start" | "finish" | "intermediate";
  readonly quantity: number;
}

export interface AssemblyShoeRailAttachment {
  readonly component_id: string;      // FK to ShoeRailComponent
  readonly position: HandrailPosition; // "left" | "right" | "both" — reuses handrail enum
}

/** Baluster spec on an assembly. Captures three states:
 *   - fitted:false + reason      = deliberately absent (e.g. span too short)
 *   - fitted:true + component_id = specific baluster picked
 *   - fitted:true + component_family_intent = intent declared but no
 *                                             specific component yet
 *                                             (waiting for family to be built)
 *  `quantity` can be a number OR "auto" — "auto" means the Render
 *  Assembly Module derives the count from `spacing_rule_mm` and the
 *  handrail's finished length at render time. */
export interface AssemblyBalusterSpec {
  readonly fitted: boolean;
  readonly reason?: string;
  readonly component_id?: string;
  readonly component_family_intent?: string;  // e.g. "BALUSTER_TIMBER_SPINDLE"
  readonly quantity?: number | "auto";
  readonly style?: string;                    // e.g. "square", "turned"
  readonly spacing_rule_mm?: number;
  readonly spacing_rule_citation?: string;    // e.g. Approved Doc K reference
}

export interface StaircaseAssembly {
  readonly assembly_id: string;
  readonly assembly_type: AssemblyType;
  readonly created_at: string;
  readonly created_by: string;
  readonly revision: number;
  readonly review_status: ReviewStatus;

  readonly shell:       AssemblyShellReference;   // component_id OR family_id+tread_count
  readonly handrails?:  readonly AssemblyHandrailAttachment[];
  readonly newels?:     readonly AssemblyNewelAttachment[];
  readonly shoe_rails?: readonly AssemblyShoeRailAttachment[];
  readonly balusters:   AssemblyBalusterSpec;

  /** Material reference for the whole assembly — Philip Principle 7.
   *  Points at a MaterialComponent. Prefer this over the free-form
   *  `materials: string[]` field (kept for backwards compat). */
  readonly material_ref?: string;

  /** Whether the whole assembly (shell + handrail + shoe rail on ONE
   *  side) can be mirrored to produce the opposite-hand version.
   *  Halves the assembly reference catalogue for symmetric layouts. */
  readonly supports_mirroring?: boolean;

  /** Philip Principle (2026-07-29 · Assembly 10): assemblies aren't
   *  just static examples — a strategic subset becomes the
   *  VERIFICATION SUITE for the parametric Render Assembly Module
   *  (Phase 3). When the engine generates an intermediate tread count
   *  (e.g. 7-tread), it compares against the nearest golden reference
   *  to validate handrail length, newel positions, baluster spacing.
   *
   *  Philip's proposed golden set: 1, 4, 8, 10, 13, 16 treads.
   *  Non-golden assemblies remain useful reference examples but
   *  aren't the truth-standard the parametric engine measures against. */
  readonly golden_reference?: boolean;

  /** Materials applied to the whole assembly. Free-form for now. */
  readonly materials?: readonly string[];

  readonly source_image_refs?: readonly string[];
  readonly notes?: readonly string[];
}

// ─── Baluster (added 2026-07-29 · Assembly 03) ───────────────────
//
// First baluster type. Two variants shipped at once:
//   BALUSTER_SQUARE_41    — plain square profile, 41mm section
//   BALUSTER_TURNED_CLASSIC_01 — turned classic profile
//
// Balusters don't get a Family/Variant split yet — turned vs square
// share nothing structurally. Same rationale as handrails/newels.

export type BalusterProfile =
  | "square" | "rectangular"
  | "turned_classic" | "turned_georgian" | "turned_victorian"
  | "fluted" | "twist"
  | "metal_round" | "metal_square"
  | "glass_panel" | "wire" | "unknown";

export interface BalusterComponent extends ComponentBase {
  readonly component_type: "baluster";

  readonly profile: BalusterProfile;

  /** Section dimensions in mm. Square: single value (e.g. 41 = 41×41).
   *  Rectangular / turned / other: object with width/height/diameter. */
  readonly section_mm: number | { readonly width: number; readonly height?: number; readonly diameter?: number };

  /** Standard length in mm — but assemblies typically calculate the
   *  actual required length from handrail-to-shoe-rail spacing at
   *  render time. This value is the FAMILY-typical length. */
  readonly standard_length_mm?: number;

  readonly compatible_shell_families?: readonly string[];
  readonly compatible_shoe_rails?:    readonly string[];
  readonly compatible_handrails?:     readonly string[];
}

// ─── Material (added 2026-07-29 · Assembly 03 · Philip Principle 7) ──
//
// Materials are first-class components — Philip explicitly requested
// this in the 10-principle brief. A material reference carries the
// engineering + supply properties every downstream module needs:
// renderer (grain / texture), BOM (density / weight), CNC (machining
// feeds), quoter (supplier / cost), Reference Brain (behaviour).
//
// Lives in a separate directory: `data/nex-staircase-materials/`.

export type MaterialKind =
  | "timber" | "metal" | "glass" | "paint_finish" | "unknown";

export interface MaterialComponent extends ComponentBase {
  readonly component_type: "material";

  readonly kind: MaterialKind;

  /** Species (for timber) or specific-material name. e.g. "European Oak",
   *  "American White Oak", "Stainless Steel 304". */
  readonly species_or_alloy: string;

  /** Density kg/m³. Timber refs: European Oak ~720. Estimate; Philip
   *  to confirm against supplier data before locking. */
  readonly density_kg_m3?: number;

  /** Janka hardness in Newtons (or equivalent for non-timber).
   *  European Oak: ~4980 N. Estimate. */
  readonly hardness?: { readonly value: number; readonly scale: "janka_N" | "janka_lbf" | "brinell" | "shore" };

  /** Free-form grain / surface descriptors — populated by named expert. */
  readonly grain?: string;
  readonly texture?: string;

  /** Colour tone descriptors. */
  readonly natural_colour?: string;
  readonly finish_compatibility?: readonly string[];   // e.g. ["clear_lacquer", "oil", "stain", "paint"]
  readonly stain_compatibility?:  readonly string[];

  /** Supplier reference (free-form for now). */
  readonly supplier?: string;

  /** Rule C — every material value should trace to a source. */
  readonly source_notes?: string;
}

// ─── Assembly extension: parametric shell reference ──────────────
//
// Philip Principle 3 direction — assemblies can eventually reference
// families + parameters instead of specific variant IDs. Backward-
// compatible today: `component_id` still works; `family_id +
// tread_count` opens the parametric path for the future Render Module.

/** A shell reference on an assembly. Two forms — either works. */
export type AssemblyShellReference =
  | { readonly component_id: string }                            // specific variant (locked)
  | { readonly family_id: string; readonly tread_count: number }; // parametric — resolved at render time

// ─── Deferred (component types) ──────────────────────────────────
// StringComponent · TreadComponent · RiserComponent · LandingComponent
// · FeatureStartComponent — added when their first component is
// classified. Same ADR-0041 discipline.
