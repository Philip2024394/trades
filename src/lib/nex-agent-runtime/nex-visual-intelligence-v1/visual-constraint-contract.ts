// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: VisualConstraintContract
// Deterministic byte-stable output. Do not edit by hand.
//
// // §36-V1 · WAVE-V1 · 2026-09-15 · nex-visual-intelligence-v1
// // Coded by NEX1 via typed_data_contract · 2026-09-15
// // This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.
// // The spec lives at src/lib/nex-agent-runtime/nex-visual-intelligence-v1/visual-constraint-contract-spec.ts (MAI infrastructure).
// // The bytes below are NEX1-authored capability. Do not hand-edit.

import type { FeatureCriticality } from "./visual-constraint-contract-ranges";
import type { ViewAngleKind } from "./visual-constraint-contract-ranges";
import type { HeightRelativeKind } from "./visual-constraint-contract-ranges";
import type { FocalLengthKind } from "./visual-constraint-contract-ranges";
import type { ColourSpaceKind } from "./visual-constraint-contract-ranges";
import type { PromotionState } from "./visual-constraint-contract-ranges";
import type { AuthoredByKind } from "./visual-constraint-contract-ranges";

export interface IdentityFeature {
  readonly feature_id: string;
  readonly description: string;
  readonly criticality: FeatureCriticality;
}

export interface ComponentCount {
  readonly part_name: string;
  readonly count: number;
}

export interface GeometryLock {
  readonly component_counts: readonly ComponentCount[];
  readonly structural_description: string;
}

export interface CameraLock {
  readonly view_angle_kind: ViewAngleKind;
  readonly height_relative_kind: HeightRelativeKind;
  readonly focal_length_kind: FocalLengthKind;
}

export interface CompositionLock {
  readonly aspect_ratio_num: number;
  readonly aspect_ratio_den: number;
  readonly subject_placement_hint: string;
}

export interface MaterialLock {
  readonly material_id: string;
  readonly part_reference: string;
  readonly material_reference_id_optional?: string;
}

export interface ColourLock {
  readonly colour_id: string;
  readonly colour_space: ColourSpaceKind;
  readonly hue_min: number;
  readonly hue_max: number;
  readonly saturation_min: number;
  readonly saturation_max: number;
  readonly lightness_min: number;
  readonly lightness_max: number;
  readonly tolerance_deltaE: number;
}

export interface ContractProvenance {
  readonly authored_at: string;
  readonly authored_by: AuthoredByKind;
  readonly source_reference_sha256: string;
  readonly contract_version: string;
  readonly promotion_state: PromotionState;
}

export interface VisualConstraintContract {
  readonly contract_id: string;
  readonly subject_kind: string;
  readonly identity_features: readonly IdentityFeature[];
  readonly geometry: GeometryLock;
  readonly camera: CameraLock;
  readonly composition: CompositionLock;
  readonly locked_materials: readonly MaterialLock[];
  readonly locked_colours: readonly ColourLock[];
  readonly provenance: ContractProvenance;
}
