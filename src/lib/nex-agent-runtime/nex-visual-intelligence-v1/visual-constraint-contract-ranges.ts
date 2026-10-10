// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: VisualConstraintContractRanges
// Deterministic byte-stable output. Do not edit by hand.
//
// // §36-V1 · WAVE-V1 · 2026-09-15 · nex-visual-intelligence-v1
// // Coded by NEX1 via typed_data_contract · 2026-09-15
// // This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.
// // The spec lives at src/lib/nex-agent-runtime/nex-visual-intelligence-v1/visual-constraint-contract-spec.ts (MAI infrastructure).
// // The bytes below are NEX1-authored capability. Do not hand-edit.

export const V1_HUE_DEGREES_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 360 });

export const V1_UNIT_INTERVAL_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 1 });

export const V1_DELTA_E_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 100 });

export const V1_ASPECT_RATIO_COMPONENT_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: 1, max: 4096 });

export const V1_MAX_IDENTITY_FEATURES: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 32 });

export const V1_MAX_LOCKED_MATERIALS: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 16 });

export const V1_MAX_LOCKED_COLOURS: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 16 });

export type FeatureCriticality =
  | "absolute"
  | "high"
  | "medium"
  | "advisory";

export const FeatureCriticality_MEMBERS: readonly FeatureCriticality[] = Object.freeze(["absolute", "high", "medium", "advisory"]);

export type ViewAngleKind =
  | "front"
  | "rear"
  | "left"
  | "right"
  | "three_quarter_left"
  | "three_quarter_right"
  | "top_down"
  | "eye_level"
  | "low_angle"
  | "high_angle";

export const ViewAngleKind_MEMBERS: readonly ViewAngleKind[] = Object.freeze(["front", "rear", "left", "right", "three_quarter_left", "three_quarter_right", "top_down", "eye_level", "low_angle", "high_angle"]);

export type HeightRelativeKind =
  | "floor_level"
  | "eye_level"
  | "above_head"
  | "overhead";

export const HeightRelativeKind_MEMBERS: readonly HeightRelativeKind[] = Object.freeze(["floor_level", "eye_level", "above_head", "overhead"]);

export type FocalLengthKind =
  | "wide"
  | "standard"
  | "telephoto"
  | "ultra_wide"
  | "macro";

export const FocalLengthKind_MEMBERS: readonly FocalLengthKind[] = Object.freeze(["wide", "standard", "telephoto", "ultra_wide", "macro"]);

export type ColourSpaceKind =
  | "sRGB"
  | "display_P3"
  | "Rec709"
  | "Rec2020";

export const ColourSpaceKind_MEMBERS: readonly ColourSpaceKind[] = Object.freeze(["sRGB", "display_P3", "Rec709", "Rec2020"]);

export type PromotionState =
  | "PROMOTED"
  | "PENDING"
  | "SUPERSEDED"
  | "NEEDS_REVIEW";

export const PromotionState_MEMBERS: readonly PromotionState[] = Object.freeze(["PROMOTED", "PENDING", "SUPERSEDED", "NEEDS_REVIEW"]);

export type AuthoredByKind =
  | "NEX1_via_typed_data_contract"
  | "MAI_infrastructure";

export const AuthoredByKind_MEMBERS: readonly AuthoredByKind[] = Object.freeze(["NEX1_via_typed_data_contract", "MAI_infrastructure"]);

export type VisualConstraintContractRefusalReason =
  | "V1_INVALID_IDENTITY_FEATURE"
  | "V1_INVALID_GEOMETRY_LOCK"
  | "V1_INVALID_CAMERA_LOCK"
  | "V1_INVALID_COMPOSITION_LOCK"
  | "V1_INVALID_MATERIAL_LOCK"
  | "V1_INVALID_COLOUR_LOCK"
  | "V1_INVALID_PROVENANCE"
  | "V1_MAX_ARRAY_LENGTH_EXCEEDED"
  | "V1_INVALID_STRING_CONTENT"
  | "V1_DUPLICATE_IDENTITY_FEATURE_ID"
  | "V1_DUPLICATE_MATERIAL_ID"
  | "V1_DUPLICATE_COLOUR_ID";

export const VisualConstraintContractRefusalReason_MEMBERS: readonly VisualConstraintContractRefusalReason[] = Object.freeze(["V1_INVALID_IDENTITY_FEATURE", "V1_INVALID_GEOMETRY_LOCK", "V1_INVALID_CAMERA_LOCK", "V1_INVALID_COMPOSITION_LOCK", "V1_INVALID_MATERIAL_LOCK", "V1_INVALID_COLOUR_LOCK", "V1_INVALID_PROVENANCE", "V1_MAX_ARRAY_LENGTH_EXCEEDED", "V1_INVALID_STRING_CONTENT", "V1_DUPLICATE_IDENTITY_FEATURE_ID", "V1_DUPLICATE_MATERIAL_ID", "V1_DUPLICATE_COLOUR_ID"]);
