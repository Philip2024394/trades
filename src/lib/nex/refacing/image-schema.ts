// image-schema.ts — `images_v3[]` entry types per PR-12 EXECUTION SPEC §1-2.
//
// The reference library intelligence layer. Every image the Brain retrieves
// against carries these 8 fields (+ quality + governance + related_images).
//
// LOCKED constraints:
//   · PR-12 · these are the 8 fields, in the locked priority order
//   · PR-16 · every observable attribute has a sibling `_confidence` field
//   · PR-18 · this schema is the source of truth for what NEX may compose

import type { Confidence } from "./confidence";

// ── Field 1 · component_role (closed vocabulary · required · every image) ─
export const COMPONENT_ROLES = [
  "baluster",
  "newel",
  "handrail",
  "tread",
  "riser",
  "stringer",
  "whole_staircase",
  "step_unit",
  "feature_step",
  "material_swatch",
  "in_situ_room",
  "detail_joinery",
] as const;
export type ComponentRole = (typeof COMPONENT_ROLES)[number];

// ── Field 2 · canonical_profile_ids[] (closed style×mood grid) ────────────
export const CANONICAL_STYLES = [
  "modern",
  "classic",
  "traditional",
  "luxury",
  "minimal",
  "warm-natural",
  "industrial",
  "signature",
] as const;
export type CanonicalStyle = (typeof CANONICAL_STYLES)[number];

export const CANONICAL_MOODS = ["airy", "cosy", "bold", "restrained"] as const;
export type CanonicalMood = (typeof CANONICAL_MOODS)[number];

export type CanonicalProfileId = `${CanonicalStyle}_${CanonicalMood}`;

export function makeCanonicalProfileId(
  style: CanonicalStyle,
  mood: CanonicalMood
): CanonicalProfileId {
  return `${style}_${mood}`;
}

export function isCanonicalProfileId(v: unknown): v is CanonicalProfileId {
  if (typeof v !== "string") return false;
  const [style, mood] = v.split("_");
  return (
    (CANONICAL_STYLES as readonly string[]).includes(style ?? "") &&
    (CANONICAL_MOODS as readonly string[]).includes(mood ?? "")
  );
}

// ── Field 3 · compatibility_group_ids[] (open vocabulary · admin-governed) ─
export type CompatibilityGroupId = `cg_${string}`;

export function isCompatibilityGroupId(v: unknown): v is CompatibilityGroupId {
  return typeof v === "string" && /^cg_[a-z0-9_-]{2,80}$/.test(v);
}

// ── Field 4 · style[] (closed extensible vocabulary) ──────────────────────
export const STYLE_VALUES = [
  "modern",
  "classic",
  "traditional",
  "luxury",
  "minimal",
  "warm-natural",
  "industrial",
  "signature",
  "scandinavian",
  "farmhouse",
] as const;
export type StyleValue = (typeof STYLE_VALUES)[number];

// ── Field 5 · mood[] (closed vocabulary) ──────────────────────────────────
export const MOOD_VALUES = [
  "airy",
  "cosy",
  "bold",
  "restrained",
  "dramatic",
  "understated",
] as const;
export type MoodValue = (typeof MOOD_VALUES)[number];

// ── Field 6 · material (family + sub-material) ────────────────────────────
export const MATERIAL_FAMILIES = ["metal", "painted", "wood", "glass"] as const;
export type MaterialFamily = (typeof MATERIAL_FAMILIES)[number];

/**
 * Sub-material is open per family. Enforced at UI/validation layer, not type.
 * Metal: brushed-stainless, brass, chrome, black-steel, wrought-iron, bronze, ...
 * Painted: cream, white, sage-green, black, charcoal, duck-egg, ...
 * Wood: species — walnut, maple, oak, mahogany, cherry, ash, beech, iroko, ...
 * Glass: clear, frosted, etched, tinted, smoked, ...
 */
export type SubMaterial = string;

export type MaterialCompositionEntry = {
  component_role: ComponentRole;
  material: MaterialFamily;
  sub_material: SubMaterial;
  confidence: Confidence;
};

// ── Field 7 · geometry (per-flight structure per PR-16 correction) ────────
export const CONFIGURATION_VALUES = [
  "straight",
  "quarter_landing",
  "half_turn",
  "u_turn",
  "winder",
  "curved",
  "spiral",
  "mixed",
] as const;
export type Configuration = (typeof CONFIGURATION_VALUES)[number];

export const FLIGHT_ORIENTATION_VALUES = [
  "ascending",
  "descending",
  "left_turn",
  "right_turn",
  "winder",
] as const;
export type FlightOrientation = (typeof FLIGHT_ORIENTATION_VALUES)[number];

export const STRING_TYPE_VALUES = ["open_string", "closed_string", "mixed"] as const;
export type StringType = (typeof STRING_TYPE_VALUES)[number];

export const RISER_OPENNESS_VALUES = ["open_riser", "closed_riser", "mixed"] as const;
export type RiserOpenness = (typeof RISER_OPENNESS_VALUES)[number];

/**
 * A single flight within a staircase geometry. Note field naming: `visible_tread_count`
 * (not `tread_count`) per PR-16 field-naming rule — the name hedges the epistemic
 * status from photo-only evidence.
 */
export type FlightSegment = {
  kind: "flight";
  flight_index: number;
  visible_tread_count: number;
  visible_tread_count_confidence: Confidence;
  orientation: FlightOrientation;
  orientation_confidence: Confidence;
};

export type LandingSegment = {
  kind: "landing";
  landing_between: true;
  landing_confidence: Confidence;
};

export type GeometrySegment = FlightSegment | LandingSegment;

export type Geometry = {
  configuration: Configuration;
  configuration_confidence: Confidence;
  flights: GeometrySegment[];
  overall_shape: {
    string_type: StringType;
    string_type_confidence: Confidence;
    riser_openness: RiserOpenness;
    riser_openness_confidence: Confidence;
  };
};

// ── Field 8 · confidence (per-attribute) — implicit via `_confidence` siblings ─

// ── Quality attributes (non-doctrinal · from PR-12 spec §2 example) ───────
export type QualityAttributes = {
  photo_quality_score: 1 | 2 | 3 | 4 | 5;
  staged_or_real: "staged" | "real" | "mixed" | "unknown";
  has_before_photo: boolean;
  has_after_photo: boolean;
  case_study_ref: string | null;
};

// ── Governance (per Stage 7 · locked) ─────────────────────────────────────
export const OWNER_TYPES = [
  "nex_curated",
  "trade_partner",
  "customer_upload",
  "public_source",
] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export const VISIBILITY_LABELS = [
  "INSPIRATION_LIBRARY",
  "REFERENCE_BRAIN",
  "PRODUCT_LIBRARY",
  "CUSTOMER_BASE",
  "TRADE_UPLOAD",
  "MEMBER_INTERNAL",
] as const;
export type VisibilityLabel = (typeof VISIBILITY_LABELS)[number];

export type Governance = {
  owner_type: OwnerType;
  owner_id: string;
  visibility_label: VisibilityLabel;
  created_at: string; // ISO
  updated_at: string; // ISO
  superseded_by: string | null;
  retention_class: "short_term" | "long_term" | "permanent";
};

// ── Related-image cross-references ────────────────────────────────────────
export type RelatedImageRef = {
  image_id: string;
  relation: "detail_of" | "same_case_study" | "same_family" | "alternate_view" | "before_of" | "after_of";
};

// ── The full ImagesV3 entry ───────────────────────────────────────────────
export type ImagesV3Entry = {
  image_id: string;
  src: string;
  alt: string;

  // Field 1 · required · every image
  component_role: ComponentRole;
  component_role_confidence: Confidence;

  // Field 2 · required for whole_staircase / in_situ_room · optional for components
  canonical_profile_ids?: CanonicalProfileId[];
  canonical_profile_ids_confidence?: Confidence;

  // Field 3 · required for component roles that appear in swap-galleries
  compatibility_group_ids?: CompatibilityGroupId[];

  // Field 4 · required for hero images
  style?: StyleValue[];
  style_confidence?: Confidence;

  // Field 5 · required for hero images
  mood?: MoodValue[];
  mood_confidence?: Confidence;

  // Field 6 · required
  material: MaterialFamily;
  material_confidence: Confidence;
  sub_material: SubMaterial;
  sub_material_confidence: Confidence;
  material_composition?: MaterialCompositionEntry[];

  // Field 7 · required for whole_staircase / in_situ_room
  geometry?: Geometry;

  // Non-doctrinal helpers
  quality?: QualityAttributes;
  governance: Governance;
  related_images?: RelatedImageRef[];
};

export type ImagesV3Family = {
  images_v3: ImagesV3Entry[];
};
