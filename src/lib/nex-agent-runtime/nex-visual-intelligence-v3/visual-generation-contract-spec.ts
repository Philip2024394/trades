// §36-V3 · WAVE-V3 · 2026-09-15 · nex-visual-intelligence-v3 · spec
// NEX bounded infrastructure · Visual Generation Contract spec module · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule.
//
// Emits two NEX1-authored capability files:
//   1. visual-generation-contract-ranges.ts — 3 ranges + 6 literal unions + 1 refusal union
//   2. visual-generation-contract.ts — 4 interfaces
//
// The MAI-authored engine adapter (engine-adapter.ts) is separate
// infrastructure that CONSUMES the NEX1-authored request shape and
// PRODUCES the NEX1-authored outcome shape. The registry currently
// holds ZERO engines · every invocation returns V3_ENGINE_NOT_REGISTERED.

import type { TypedDataContractSpec, StyleProfile } from "../programming-mission/types";

export const V3_STYLE: StyleProfile = {
  naming_convention: "camelCase",
  export_style: "named",
  semicolons: "yes",
  quote_style: "double",
  test_framework: "vitest",
  detected_from_files: [],
  detection_confidence: "high",
};

export const V3_RANGES_TARGET_PATH = "output/visual-generation-contract-ranges.ts" as const;
export const V3_CONTRACT_TARGET_PATH = "output/visual-generation-contract.ts" as const;

const V3_HEADER = (
  "// §36-V3 · WAVE-V3 · 2026-09-15 · nex-visual-intelligence-v3\n" +
  "// Coded by NEX1 via typed_data_contract · 2026-09-15\n" +
  "// This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.\n" +
  "// The spec lives at src/lib/nex-agent-runtime/nex-visual-intelligence-v3/visual-generation-contract-spec.ts (MAI infrastructure).\n" +
  "// The bytes below are NEX1-authored capability. Do not hand-edit."
);

export function buildV3RangesSpec(): TypedDataContractSpec {
  return {
    contract_name: "VisualGenerationContractRanges",
    header_comment: V3_HEADER,
    type_only_imports: [],
    declarations: [
      { declaration_kind: "numeric_range_constant", name: "V3_MAX_PROMPT_LENGTH", min: 1, max: 4096, exported: true },
      { declaration_kind: "numeric_range_constant", name: "V3_MAX_OUTPUT_IMAGES", min: 1, max: 8, exported: true },
      { declaration_kind: "numeric_range_constant", name: "V3_MAX_REGISTERED_ENGINES", min: 0, max: 16, exported: true },
      {
        declaration_kind: "literal_union",
        name: "V3_GenerationKind",
        literals: [
          "text_to_image",
          "image_to_image",
          "reference_conditioned",
          "multi_reference_composition",
        ],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "V3_OutputFormatKind",
        literals: ["png", "webp", "jpeg", "alpha_native"],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "V3_EngineRegistrationStatus",
        literals: ["no_engine_registered", "registered", "registered_disabled"],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "V3_ResponseKind",
        literals: [
          "engine_registration_incomplete",
          "engine_invocation_success",
          "engine_refused",
          "adapter_refused",
        ],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "V3_PerceptionVerificationStatus",
        literals: ["not_applicable", "pending_perceptual_layer", "verified"],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "V3_LicenceCommercialUseKind",
        literals: ["permissive", "restricted", "unspecified"],
        exported: true,
      },
      {
        declaration_kind: "refusal_reason_union",
        name: "V3_EngineAdapterRefusalReason",
        reasons: [
          "V3_INVALID_REQUEST",
          "V3_INVALID_CONSTRAINT_CONTRACT_REFERENCE",
          "V3_MAX_PROMPT_EXCEEDED",
          "V3_MAX_OUTPUT_IMAGES_EXCEEDED",
          "V3_PROHIBITED_STRING_CONTENT",
          "V3_ENGINE_NOT_REGISTERED",
          "V3_ENGINE_INSUFFICIENT_LICENCE",
          "V3_ENGINE_DISABLED",
          "V3_ENGINE_UNKNOWN_SLUG",
          "V3_PERCEPTION_NOT_AVAILABLE",
          "V3_INTERNAL",
        ],
        exported: true,
      },
    ],
  };
}

export function buildV3ContractSpec(): TypedDataContractSpec {
  return {
    contract_name: "VisualGenerationContract",
    header_comment: V3_HEADER,
    type_only_imports: [
      { symbol: "V3_GenerationKind", from_specifier: "./visual-generation-contract-ranges" },
      { symbol: "V3_OutputFormatKind", from_specifier: "./visual-generation-contract-ranges" },
      { symbol: "V3_EngineRegistrationStatus", from_specifier: "./visual-generation-contract-ranges" },
      { symbol: "V3_ResponseKind", from_specifier: "./visual-generation-contract-ranges" },
      { symbol: "V3_PerceptionVerificationStatus", from_specifier: "./visual-generation-contract-ranges" },
      { symbol: "V3_LicenceCommercialUseKind", from_specifier: "./visual-generation-contract-ranges" },
    ],
    declarations: [
      {
        declaration_kind: "interface",
        name: "V3GenerationRequest",
        exported: true,
        fields: [
          { name: "request_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "generation_kind", type: { kind: "reference", to: "V3_GenerationKind" }, optional: false, readonly_modifier: true },
          { name: "reference_contract_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "reference_contract_sha256", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "prompt", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "output_format", type: { kind: "reference", to: "V3_OutputFormatKind" }, optional: false, readonly_modifier: true },
          { name: "max_output_images", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "V3EngineProvenance",
        exported: true,
        fields: [
          { name: "engine_slug", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "engine_version", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "adapter_version", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "adapter_grep_marker", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "licence_commercial_use_kind", type: { kind: "reference", to: "V3_LicenceCommercialUseKind" }, optional: false, readonly_modifier: true },
          { name: "invoked_at", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "V3EngineRegistration",
        exported: true,
        fields: [
          { name: "engine_slug", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "engine_version", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "adapter_version", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "licence_commercial_use_kind", type: { kind: "reference", to: "V3_LicenceCommercialUseKind" }, optional: false, readonly_modifier: true },
          { name: "registration_status", type: { kind: "reference", to: "V3_EngineRegistrationStatus" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "V3GenerationOutcome",
        exported: true,
        fields: [
          { name: "outcome_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "request_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "response_kind", type: { kind: "reference", to: "V3_ResponseKind" }, optional: false, readonly_modifier: true },
          { name: "engine_registration_status", type: { kind: "reference", to: "V3_EngineRegistrationStatus" }, optional: false, readonly_modifier: true },
          { name: "perception_verification_status", type: { kind: "reference", to: "V3_PerceptionVerificationStatus" }, optional: false, readonly_modifier: true },
          { name: "reason_summary", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          {
            name: "candidate_asset_ids",
            type: { kind: "array", element: { kind: "primitive", type: "string" } },
            optional: false,
            readonly_modifier: true,
          },
          { name: "generated_at", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
        ],
      },
    ],
  };
}
