// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: VisualDifferenceReportRanges
// Deterministic byte-stable output. Do not edit by hand.
//
// // §36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2
// // Coded by NEX1 via typed_data_contract · 2026-09-15
// // This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.
// // The spec lives at src/lib/nex-agent-runtime/nex-visual-intelligence-v2/visual-difference-report-spec.ts (MAI infrastructure).
// // The bytes below are NEX1-authored capability. Do not hand-edit.

export const V2_MAX_PROPERTY_DIFFS: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 128 });

export const V2_MAX_REQUESTED_CHANGES: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 32 });

export type V2_PropertyKind =
  | "identity_feature"
  | "geometry"
  | "camera"
  | "composition"
  | "material"
  | "colour"
  | "provenance"
  | "free_property";

export const V2_PropertyKind_MEMBERS: readonly V2_PropertyKind[] = Object.freeze(["identity_feature", "geometry", "camera", "composition", "material", "colour", "provenance", "free_property"]);

export type V2_PropertyVerdict =
  | "preserved"
  | "changed_as_requested"
  | "changed_unexpectedly"
  | "violated_lock"
  | "unable_to_verify"
  | "not_applicable";

export const V2_PropertyVerdict_MEMBERS: readonly V2_PropertyVerdict[] = Object.freeze(["preserved", "changed_as_requested", "changed_unexpectedly", "violated_lock", "unable_to_verify", "not_applicable"]);

export type V2_RequestedChangeKind =
  | "material_swap"
  | "camera_change"
  | "environment_change"
  | "colour_adjust"
  | "composition_reframe"
  | "motion_activate"
  | "none";

export const V2_RequestedChangeKind_MEMBERS: readonly V2_RequestedChangeKind[] = Object.freeze(["material_swap", "camera_change", "environment_change", "colour_adjust", "composition_reframe", "motion_activate", "none"]);

export type V2_OverallDifferenceVerdict =
  | "all_locked_preserved"
  | "some_locked_violated"
  | "some_uncertain"
  | "all_uncertain";

export const V2_OverallDifferenceVerdict_MEMBERS: readonly V2_OverallDifferenceVerdict[] = Object.freeze(["all_locked_preserved", "some_locked_violated", "some_uncertain", "all_uncertain"]);

export type V2_DifferenceReportRefusalReason =
  | "V2_INVALID_REFERENCE_CONTRACT"
  | "V2_INVALID_CANDIDATE_CONTRACT"
  | "V2_CONTRACT_ID_MISMATCH"
  | "V2_INVALID_REQUESTED_CHANGE"
  | "V2_MAX_PROPERTY_DIFFS_EXCEEDED"
  | "V2_MAX_REQUESTED_CHANGES_EXCEEDED"
  | "V2_INVALID_STRING_CONTENT"
  | "V2_INTERNAL";

export const V2_DifferenceReportRefusalReason_MEMBERS: readonly V2_DifferenceReportRefusalReason[] = Object.freeze(["V2_INVALID_REFERENCE_CONTRACT", "V2_INVALID_CANDIDATE_CONTRACT", "V2_CONTRACT_ID_MISMATCH", "V2_INVALID_REQUESTED_CHANGE", "V2_MAX_PROPERTY_DIFFS_EXCEEDED", "V2_MAX_REQUESTED_CHANGES_EXCEEDED", "V2_INVALID_STRING_CONTENT", "V2_INTERNAL"]);
