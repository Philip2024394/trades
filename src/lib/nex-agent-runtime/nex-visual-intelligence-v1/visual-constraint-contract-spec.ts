// §36-V1 · WAVE-V1 · 2026-09-15 · nex-visual-intelligence-v1 · spec
// NEX bounded infrastructure · Visual Constraint Contract spec module · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule.
//
// This module holds the exact TypedDataContractSpec pair that NEX1 uses to
// author the NEX Visual Constraint Contract (V1). The specs themselves are
// MAI infrastructure. The BYTES emitted by authorTypedDataContract(spec, ...)
// are what NEX1 authored. The distinction is preserved by:
//   - shipping the specs here (this file · MAI infrastructure header)
//   - the emitted capability files at
//     src/lib/nex-agent-runtime/nex-visual-intelligence-v1/
//     carrying the "Coded by NEX1 via typed_data_contract" header.
//
// Wave V1 emits TWO capability files:
//   1. visual-constraint-contract-ranges.ts — numeric ranges + literal unions
//      + refusal reason union · 15 declarations.
//   2. visual-constraint-contract.ts — 9 interfaces referencing (via type-only
//      imports) the unions declared in file 1.
//
// Zero generator dependency. Zero image bytes. Pure intelligence layer.

import type { TypedDataContractSpec, StyleProfile } from "../programming-mission/types";

// ── Style profile (shared across both emissions) ────────────────────────

export const V1_STYLE: StyleProfile = {
  naming_convention: "camelCase",
  export_style: "named",
  semicolons: "yes",
  quote_style: "double",
  test_framework: "vitest",
  detected_from_files: [],
  detection_confidence: "high",
};

// ── Target paths (deterministic · used by the authorship-proof harness) ─

export const V1_RANGES_TARGET_PATH = "output/visual-constraint-contract-ranges.ts" as const;
export const V1_CONTRACT_TARGET_PATH = "output/visual-constraint-contract.ts" as const;

// ── Shared header block ────────────────────────────────────────────────

const V1_HEADER = (
  "// §36-V1 · WAVE-V1 · 2026-09-15 · nex-visual-intelligence-v1\n" +
  "// Coded by NEX1 via typed_data_contract · 2026-09-15\n" +
  "// This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.\n" +
  "// The spec lives at src/lib/nex-agent-runtime/nex-visual-intelligence-v1/visual-constraint-contract-spec.ts (MAI infrastructure).\n" +
  "// The bytes below are NEX1-authored capability. Do not hand-edit."
);

// ── Spec 1 · ranges + unions + refusal ─────────────────────────────────

export function buildV1RangesSpec(): TypedDataContractSpec {
  return {
    contract_name: "VisualConstraintContractRanges",
    header_comment: V1_HEADER,
    type_only_imports: [],
    declarations: [
      // ── Numeric ranges (locked bounds) ─────────────────────────────
      { declaration_kind: "numeric_range_constant", name: "V1_HUE_DEGREES_BOUNDS", min: 0, max: 360, exported: true },
      { declaration_kind: "numeric_range_constant", name: "V1_UNIT_INTERVAL_BOUNDS", min: 0, max: 1, exported: true },
      { declaration_kind: "numeric_range_constant", name: "V1_DELTA_E_BOUNDS", min: 0, max: 100, exported: true },
      { declaration_kind: "numeric_range_constant", name: "V1_ASPECT_RATIO_COMPONENT_BOUNDS", min: 1, max: 4096, exported: true },
      { declaration_kind: "numeric_range_constant", name: "V1_MAX_IDENTITY_FEATURES", min: 0, max: 32, exported: true },
      { declaration_kind: "numeric_range_constant", name: "V1_MAX_LOCKED_MATERIALS", min: 0, max: 16, exported: true },
      { declaration_kind: "numeric_range_constant", name: "V1_MAX_LOCKED_COLOURS", min: 0, max: 16, exported: true },

      // ── Literal unions (categorical vocabularies) ───────────────────
      {
        declaration_kind: "literal_union",
        name: "FeatureCriticality",
        literals: ["absolute", "high", "medium", "advisory"],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "ViewAngleKind",
        literals: [
          "front",
          "rear",
          "left",
          "right",
          "three_quarter_left",
          "three_quarter_right",
          "top_down",
          "eye_level",
          "low_angle",
          "high_angle",
        ],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "HeightRelativeKind",
        literals: ["floor_level", "eye_level", "above_head", "overhead"],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "FocalLengthKind",
        literals: ["wide", "standard", "telephoto", "ultra_wide", "macro"],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "ColourSpaceKind",
        literals: ["sRGB", "display_P3", "Rec709", "Rec2020"],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "PromotionState",
        literals: ["PROMOTED", "PENDING", "SUPERSEDED", "NEEDS_REVIEW"],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "AuthoredByKind",
        literals: ["NEX1_via_typed_data_contract", "MAI_infrastructure"],
        exported: true,
      },

      // ── Refusal reason union ────────────────────────────────────────
      {
        declaration_kind: "refusal_reason_union",
        name: "VisualConstraintContractRefusalReason",
        reasons: [
          "V1_INVALID_IDENTITY_FEATURE",
          "V1_INVALID_GEOMETRY_LOCK",
          "V1_INVALID_CAMERA_LOCK",
          "V1_INVALID_COMPOSITION_LOCK",
          "V1_INVALID_MATERIAL_LOCK",
          "V1_INVALID_COLOUR_LOCK",
          "V1_INVALID_PROVENANCE",
          "V1_MAX_ARRAY_LENGTH_EXCEEDED",
          "V1_INVALID_STRING_CONTENT",
          "V1_DUPLICATE_IDENTITY_FEATURE_ID",
          "V1_DUPLICATE_MATERIAL_ID",
          "V1_DUPLICATE_COLOUR_ID",
        ],
        exported: true,
      },
    ],
  };
}

// ── Spec 2 · interfaces (references file 1 via type-only imports) ──────

export function buildV1ContractSpec(): TypedDataContractSpec {
  return {
    contract_name: "VisualConstraintContract",
    header_comment: V1_HEADER,
    type_only_imports: [
      { symbol: "FeatureCriticality", from_specifier: "./visual-constraint-contract-ranges" },
      { symbol: "ViewAngleKind", from_specifier: "./visual-constraint-contract-ranges" },
      { symbol: "HeightRelativeKind", from_specifier: "./visual-constraint-contract-ranges" },
      { symbol: "FocalLengthKind", from_specifier: "./visual-constraint-contract-ranges" },
      { symbol: "ColourSpaceKind", from_specifier: "./visual-constraint-contract-ranges" },
      { symbol: "PromotionState", from_specifier: "./visual-constraint-contract-ranges" },
      { symbol: "AuthoredByKind", from_specifier: "./visual-constraint-contract-ranges" },
    ],
    declarations: [
      {
        declaration_kind: "interface",
        name: "IdentityFeature",
        exported: true,
        fields: [
          { name: "feature_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "description", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "criticality", type: { kind: "reference", to: "FeatureCriticality" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "ComponentCount",
        exported: true,
        fields: [
          { name: "part_name", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "count", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "GeometryLock",
        exported: true,
        fields: [
          {
            name: "component_counts",
            type: { kind: "array", element: { kind: "reference", to: "ComponentCount" } },
            optional: false,
            readonly_modifier: true,
          },
          { name: "structural_description", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "CameraLock",
        exported: true,
        fields: [
          { name: "view_angle_kind", type: { kind: "reference", to: "ViewAngleKind" }, optional: false, readonly_modifier: true },
          { name: "height_relative_kind", type: { kind: "reference", to: "HeightRelativeKind" }, optional: false, readonly_modifier: true },
          { name: "focal_length_kind", type: { kind: "reference", to: "FocalLengthKind" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "CompositionLock",
        exported: true,
        fields: [
          { name: "aspect_ratio_num", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "aspect_ratio_den", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "subject_placement_hint", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "MaterialLock",
        exported: true,
        fields: [
          { name: "material_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "part_reference", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "material_reference_id_optional", type: { kind: "primitive", type: "string" }, optional: true, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "ColourLock",
        exported: true,
        fields: [
          { name: "colour_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "colour_space", type: { kind: "reference", to: "ColourSpaceKind" }, optional: false, readonly_modifier: true },
          { name: "hue_min", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "hue_max", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "saturation_min", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "saturation_max", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "lightness_min", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "lightness_max", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "tolerance_deltaE", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "ContractProvenance",
        exported: true,
        fields: [
          { name: "authored_at", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "authored_by", type: { kind: "reference", to: "AuthoredByKind" }, optional: false, readonly_modifier: true },
          { name: "source_reference_sha256", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "contract_version", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "promotion_state", type: { kind: "reference", to: "PromotionState" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "VisualConstraintContract",
        exported: true,
        fields: [
          { name: "contract_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "subject_kind", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          {
            name: "identity_features",
            type: { kind: "array", element: { kind: "reference", to: "IdentityFeature" } },
            optional: false,
            readonly_modifier: true,
          },
          { name: "geometry", type: { kind: "reference", to: "GeometryLock" }, optional: false, readonly_modifier: true },
          { name: "camera", type: { kind: "reference", to: "CameraLock" }, optional: false, readonly_modifier: true },
          { name: "composition", type: { kind: "reference", to: "CompositionLock" }, optional: false, readonly_modifier: true },
          {
            name: "locked_materials",
            type: { kind: "array", element: { kind: "reference", to: "MaterialLock" } },
            optional: false,
            readonly_modifier: true,
          },
          {
            name: "locked_colours",
            type: { kind: "array", element: { kind: "reference", to: "ColourLock" } },
            optional: false,
            readonly_modifier: true,
          },
          { name: "provenance", type: { kind: "reference", to: "ContractProvenance" }, optional: false, readonly_modifier: true },
        ],
      },
    ],
  };
}
