// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: VisualDifferenceReport
// Deterministic byte-stable output. Do not edit by hand.
//
// // §36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2
// // Coded by NEX1 via typed_data_contract · 2026-09-15
// // This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.
// // The spec lives at src/lib/nex-agent-runtime/nex-visual-intelligence-v2/visual-difference-report-spec.ts (MAI infrastructure).
// // The bytes below are NEX1-authored capability. Do not hand-edit.

import type { V2_PropertyKind } from "./visual-difference-report-ranges";
import type { V2_PropertyVerdict } from "./visual-difference-report-ranges";
import type { V2_RequestedChangeKind } from "./visual-difference-report-ranges";
import type { V2_OverallDifferenceVerdict } from "./visual-difference-report-ranges";

export interface V2RequestedChange {
  readonly kind: V2_RequestedChangeKind;
  readonly target_property_path: string;
  readonly description: string;
}

export interface V2PropertyDiff {
  readonly field_path: string;
  readonly property_kind: V2_PropertyKind;
  readonly reference_value_summary: string;
  readonly candidate_value_summary: string;
  readonly verdict: V2_PropertyVerdict;
  readonly rationale: string;
}

export interface VisualDifferenceReport {
  readonly report_id: string;
  readonly reference_contract_id: string;
  readonly candidate_contract_id: string;
  readonly reference_contract_sha256: string;
  readonly candidate_contract_sha256: string;
  readonly property_diffs: readonly V2PropertyDiff[];
  readonly requested_changes: readonly V2RequestedChange[];
  readonly preserved_count: number;
  readonly changed_as_requested_count: number;
  readonly changed_unexpectedly_count: number;
  readonly violated_lock_count: number;
  readonly unable_to_verify_count: number;
  readonly overall_verdict: V2_OverallDifferenceVerdict;
  readonly generated_at: string;
}
