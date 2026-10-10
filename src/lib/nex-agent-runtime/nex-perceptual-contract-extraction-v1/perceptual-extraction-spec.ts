// §36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1 · spec
// NEX bounded infrastructure · PCE V1 spec module · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule.
//
// Emits two NEX1-authored capability files:
//   1. perceptual-extraction-ranges.ts — 3 ranges + 5 literal unions + 1 refusal union
//   2. perceptual-extraction.ts — 3 interfaces
//
// The MAI-authored extraction engine consumes real image bytes, applies
// deterministic pixel-adjacent extraction (PNG header + SHA), and produces
// PerceptualExtractionResult. Semantic properties (materials · geometry ·
// camera · identity) are unable_to_verify in this wave — deferred to a
// bounded PCE Vb amendment for pixel decoding.

import type { TypedDataContractSpec, StyleProfile } from "../programming-mission/types";

export const PCE_STYLE: StyleProfile = {
  naming_convention: "camelCase",
  export_style: "named",
  semicolons: "yes",
  quote_style: "double",
  test_framework: "vitest",
  detected_from_files: [],
  detection_confidence: "high",
};

export const PCE_RANGES_TARGET_PATH = "output/perceptual-extraction-ranges.ts" as const;
export const PCE_CONTRACT_TARGET_PATH = "output/perceptual-extraction.ts" as const;

const PCE_HEADER = (
  "// §36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1\n" +
  "// Coded by NEX1 via typed_data_contract · 2026-09-15\n" +
  "// This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.\n" +
  "// The spec lives at src/lib/nex-agent-runtime/nex-perceptual-contract-extraction-v1/perceptual-extraction-spec.ts (MAI infrastructure).\n" +
  "// The bytes below are NEX1-authored capability. Do not hand-edit."
);

export function buildPCERangesSpec(): TypedDataContractSpec {
  return {
    contract_name: "PerceptualExtractionRanges",
    header_comment: PCE_HEADER,
    type_only_imports: [],
    declarations: [
      { declaration_kind: "numeric_range_constant", name: "PCE_MAX_EXTRACTED_PROPERTIES", min: 0, max: 128, exported: true },
      { declaration_kind: "numeric_range_constant", name: "PCE_MAX_IMAGE_BYTES", min: 16, max: 33554432, exported: true },
      { declaration_kind: "numeric_range_constant", name: "PCE_MIN_IMAGE_BYTES", min: 8, max: 8, exported: true },
      {
        declaration_kind: "literal_union",
        name: "PCE_ImageFormat",
        literals: ["png", "jpeg", "webp", "avif", "unknown"],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "PCE_VerificationStatus",
        literals: [
          "verified_deterministic",
          "high_confidence",
          "medium_confidence",
          "low_confidence",
          "unable_to_verify",
          "not_applicable",
        ],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "PCE_ExtractionMethodKind",
        literals: [
          "deterministic_header_parse",
          "deterministic_hash",
          "deterministic_pixel_analysis",
          "sample_statistics",
          "unable_to_verify_no_method",
        ],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "PCE_DeterminismKind",
        literals: [
          "deterministic",
          "reproducible_with_seed",
          "bounded_nondeterministic",
          "unable_to_reproduce",
        ],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "PCE_PerceptualDomain",
        literals: [
          "dimensions",
          "format",
          "provenance",
          "geometry",
          "material",
          "colour",
          "camera",
          "composition",
          "identity",
        ],
        exported: true,
      },
      {
        declaration_kind: "refusal_reason_union",
        name: "PCE_ExtractionRefusalReason",
        reasons: [
          "PCE_INVALID_REQUEST",
          "PCE_INVALID_IMAGE_BYTES",
          "PCE_UNSUPPORTED_FORMAT",
          "PCE_IMAGE_TOO_LARGE",
          "PCE_IMAGE_TOO_SMALL",
          "PCE_MALFORMED_HEADER",
          "PCE_PROHIBITED_STRING_CONTENT",
          "PCE_MAX_EXTRACTIONS_EXCEEDED",
          "PCE_INTERNAL",
        ],
        exported: true,
      },
    ],
  };
}

export function buildPCEContractSpec(): TypedDataContractSpec {
  return {
    contract_name: "PerceptualExtractionContract",
    header_comment: PCE_HEADER,
    type_only_imports: [
      { symbol: "PCE_ImageFormat", from_specifier: "./perceptual-extraction-ranges" },
      { symbol: "PCE_VerificationStatus", from_specifier: "./perceptual-extraction-ranges" },
      { symbol: "PCE_ExtractionMethodKind", from_specifier: "./perceptual-extraction-ranges" },
      { symbol: "PCE_DeterminismKind", from_specifier: "./perceptual-extraction-ranges" },
      { symbol: "PCE_PerceptualDomain", from_specifier: "./perceptual-extraction-ranges" },
    ],
    declarations: [
      {
        declaration_kind: "interface",
        name: "PCE_ExtractedProperty",
        exported: true,
        fields: [
          { name: "property_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "perceptual_domain", type: { kind: "reference", to: "PCE_PerceptualDomain" }, optional: false, readonly_modifier: true },
          { name: "value_summary", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "verification_status", type: { kind: "reference", to: "PCE_VerificationStatus" }, optional: false, readonly_modifier: true },
          { name: "extraction_method_kind", type: { kind: "reference", to: "PCE_ExtractionMethodKind" }, optional: false, readonly_modifier: true },
          { name: "rationale", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "PCE_ExtractionProvenance",
        exported: true,
        fields: [
          { name: "extraction_algorithm_slug", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "algorithm_version", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "source_asset_sha256", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "source_dimensions_width", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "source_dimensions_height", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "source_format", type: { kind: "reference", to: "PCE_ImageFormat" }, optional: false, readonly_modifier: true },
          { name: "source_byte_length", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "run_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "extraction_timestamp", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "PerceptualExtractionResult",
        exported: true,
        fields: [
          { name: "result_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "request_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "provenance", type: { kind: "reference", to: "PCE_ExtractionProvenance" }, optional: false, readonly_modifier: true },
          {
            name: "extracted_properties",
            type: { kind: "array", element: { kind: "reference", to: "PCE_ExtractedProperty" } },
            optional: false,
            readonly_modifier: true,
          },
          { name: "determinism_kind", type: { kind: "reference", to: "PCE_DeterminismKind" }, optional: false, readonly_modifier: true },
          { name: "verified_count", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "unable_to_verify_count", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
        ],
      },
    ],
  };
}
