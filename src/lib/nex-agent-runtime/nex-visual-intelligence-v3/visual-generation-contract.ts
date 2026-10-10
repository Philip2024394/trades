// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: VisualGenerationContract
// Deterministic byte-stable output. Do not edit by hand.
//
// // §36-V3 · WAVE-V3 · 2026-09-15 · nex-visual-intelligence-v3
// // Coded by NEX1 via typed_data_contract · 2026-09-15
// // This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.
// // The spec lives at src/lib/nex-agent-runtime/nex-visual-intelligence-v3/visual-generation-contract-spec.ts (MAI infrastructure).
// // The bytes below are NEX1-authored capability. Do not hand-edit.

import type { V3_GenerationKind } from "./visual-generation-contract-ranges";
import type { V3_OutputFormatKind } from "./visual-generation-contract-ranges";
import type { V3_EngineRegistrationStatus } from "./visual-generation-contract-ranges";
import type { V3_ResponseKind } from "./visual-generation-contract-ranges";
import type { V3_PerceptionVerificationStatus } from "./visual-generation-contract-ranges";
import type { V3_LicenceCommercialUseKind } from "./visual-generation-contract-ranges";

export interface V3GenerationRequest {
  readonly request_id: string;
  readonly generation_kind: V3_GenerationKind;
  readonly reference_contract_id: string;
  readonly reference_contract_sha256: string;
  readonly prompt: string;
  readonly output_format: V3_OutputFormatKind;
  readonly max_output_images: number;
}

export interface V3EngineProvenance {
  readonly engine_slug: string;
  readonly engine_version: string;
  readonly adapter_version: string;
  readonly adapter_grep_marker: string;
  readonly licence_commercial_use_kind: V3_LicenceCommercialUseKind;
  readonly invoked_at: string;
}

export interface V3EngineRegistration {
  readonly engine_slug: string;
  readonly engine_version: string;
  readonly adapter_version: string;
  readonly licence_commercial_use_kind: V3_LicenceCommercialUseKind;
  readonly registration_status: V3_EngineRegistrationStatus;
}

export interface V3GenerationOutcome {
  readonly outcome_id: string;
  readonly request_id: string;
  readonly response_kind: V3_ResponseKind;
  readonly engine_registration_status: V3_EngineRegistrationStatus;
  readonly perception_verification_status: V3_PerceptionVerificationStatus;
  readonly reason_summary: string;
  readonly candidate_asset_ids: readonly string[];
  readonly generated_at: string;
}
