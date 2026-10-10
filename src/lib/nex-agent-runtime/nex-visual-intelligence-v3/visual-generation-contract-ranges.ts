// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: VisualGenerationContractRanges
// Deterministic byte-stable output. Do not edit by hand.
//
// // §36-V3 · WAVE-V3 · 2026-09-15 · nex-visual-intelligence-v3
// // Coded by NEX1 via typed_data_contract · 2026-09-15
// // This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.
// // The spec lives at src/lib/nex-agent-runtime/nex-visual-intelligence-v3/visual-generation-contract-spec.ts (MAI infrastructure).
// // The bytes below are NEX1-authored capability. Do not hand-edit.

export const V3_MAX_PROMPT_LENGTH: { readonly min: number; readonly max: number } = Object.freeze({ min: 1, max: 4096 });

export const V3_MAX_OUTPUT_IMAGES: { readonly min: number; readonly max: number } = Object.freeze({ min: 1, max: 8 });

export const V3_MAX_REGISTERED_ENGINES: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 16 });

export type V3_GenerationKind =
  | "text_to_image"
  | "image_to_image"
  | "reference_conditioned"
  | "multi_reference_composition";

export const V3_GenerationKind_MEMBERS: readonly V3_GenerationKind[] = Object.freeze(["text_to_image", "image_to_image", "reference_conditioned", "multi_reference_composition"]);

export type V3_OutputFormatKind =
  | "png"
  | "webp"
  | "jpeg"
  | "alpha_native";

export const V3_OutputFormatKind_MEMBERS: readonly V3_OutputFormatKind[] = Object.freeze(["png", "webp", "jpeg", "alpha_native"]);

export type V3_EngineRegistrationStatus =
  | "no_engine_registered"
  | "registered"
  | "registered_disabled";

export const V3_EngineRegistrationStatus_MEMBERS: readonly V3_EngineRegistrationStatus[] = Object.freeze(["no_engine_registered", "registered", "registered_disabled"]);

export type V3_ResponseKind =
  | "engine_registration_incomplete"
  | "engine_invocation_success"
  | "engine_refused"
  | "adapter_refused";

export const V3_ResponseKind_MEMBERS: readonly V3_ResponseKind[] = Object.freeze(["engine_registration_incomplete", "engine_invocation_success", "engine_refused", "adapter_refused"]);

export type V3_PerceptionVerificationStatus =
  | "not_applicable"
  | "pending_perceptual_layer"
  | "verified";

export const V3_PerceptionVerificationStatus_MEMBERS: readonly V3_PerceptionVerificationStatus[] = Object.freeze(["not_applicable", "pending_perceptual_layer", "verified"]);

export type V3_LicenceCommercialUseKind =
  | "permissive"
  | "restricted"
  | "unspecified";

export const V3_LicenceCommercialUseKind_MEMBERS: readonly V3_LicenceCommercialUseKind[] = Object.freeze(["permissive", "restricted", "unspecified"]);

export type V3_EngineAdapterRefusalReason =
  | "V3_INVALID_REQUEST"
  | "V3_INVALID_CONSTRAINT_CONTRACT_REFERENCE"
  | "V3_MAX_PROMPT_EXCEEDED"
  | "V3_MAX_OUTPUT_IMAGES_EXCEEDED"
  | "V3_PROHIBITED_STRING_CONTENT"
  | "V3_ENGINE_NOT_REGISTERED"
  | "V3_ENGINE_INSUFFICIENT_LICENCE"
  | "V3_ENGINE_DISABLED"
  | "V3_ENGINE_UNKNOWN_SLUG"
  | "V3_PERCEPTION_NOT_AVAILABLE"
  | "V3_INTERNAL";

export const V3_EngineAdapterRefusalReason_MEMBERS: readonly V3_EngineAdapterRefusalReason[] = Object.freeze(["V3_INVALID_REQUEST", "V3_INVALID_CONSTRAINT_CONTRACT_REFERENCE", "V3_MAX_PROMPT_EXCEEDED", "V3_MAX_OUTPUT_IMAGES_EXCEEDED", "V3_PROHIBITED_STRING_CONTENT", "V3_ENGINE_NOT_REGISTERED", "V3_ENGINE_INSUFFICIENT_LICENCE", "V3_ENGINE_DISABLED", "V3_ENGINE_UNKNOWN_SLUG", "V3_PERCEPTION_NOT_AVAILABLE", "V3_INTERNAL"]);
