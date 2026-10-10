// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: PerceptualExtractionContract
// Deterministic byte-stable output. Do not edit by hand.
//
// // §36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1
// // Coded by NEX1 via typed_data_contract · 2026-09-15
// // This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.
// // The spec lives at src/lib/nex-agent-runtime/nex-perceptual-contract-extraction-v1/perceptual-extraction-spec.ts (MAI infrastructure).
// // The bytes below are NEX1-authored capability. Do not hand-edit.

import type { PCE_ImageFormat } from "./perceptual-extraction-ranges";
import type { PCE_VerificationStatus } from "./perceptual-extraction-ranges";
import type { PCE_ExtractionMethodKind } from "./perceptual-extraction-ranges";
import type { PCE_DeterminismKind } from "./perceptual-extraction-ranges";
import type { PCE_PerceptualDomain } from "./perceptual-extraction-ranges";

export interface PCE_ExtractedProperty {
  readonly property_id: string;
  readonly perceptual_domain: PCE_PerceptualDomain;
  readonly value_summary: string;
  readonly verification_status: PCE_VerificationStatus;
  readonly extraction_method_kind: PCE_ExtractionMethodKind;
  readonly rationale: string;
}

export interface PCE_ExtractionProvenance {
  readonly extraction_algorithm_slug: string;
  readonly algorithm_version: string;
  readonly source_asset_sha256: string;
  readonly source_dimensions_width: number;
  readonly source_dimensions_height: number;
  readonly source_format: PCE_ImageFormat;
  readonly source_byte_length: number;
  readonly run_id: string;
  readonly extraction_timestamp: string;
}

export interface PerceptualExtractionResult {
  readonly result_id: string;
  readonly request_id: string;
  readonly provenance: PCE_ExtractionProvenance;
  readonly extracted_properties: readonly PCE_ExtractedProperty[];
  readonly determinism_kind: PCE_DeterminismKind;
  readonly verified_count: number;
  readonly unable_to_verify_count: number;
}
