// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: PerceptualExtractionRanges
// Deterministic byte-stable output. Do not edit by hand.
//
// // §36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1
// // Coded by NEX1 via typed_data_contract · 2026-09-15
// // This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.
// // The spec lives at src/lib/nex-agent-runtime/nex-perceptual-contract-extraction-v1/perceptual-extraction-spec.ts (MAI infrastructure).
// // The bytes below are NEX1-authored capability. Do not hand-edit.

export const PCE_MAX_EXTRACTED_PROPERTIES: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 128 });

export const PCE_MAX_IMAGE_BYTES: { readonly min: number; readonly max: number } = Object.freeze({ min: 16, max: 33554432 });

export const PCE_MIN_IMAGE_BYTES: { readonly min: number; readonly max: number } = Object.freeze({ min: 8, max: 8 });

export type PCE_ImageFormat =
  | "png"
  | "jpeg"
  | "webp"
  | "avif"
  | "unknown";

export const PCE_ImageFormat_MEMBERS: readonly PCE_ImageFormat[] = Object.freeze(["png", "jpeg", "webp", "avif", "unknown"]);

export type PCE_VerificationStatus =
  | "verified_deterministic"
  | "high_confidence"
  | "medium_confidence"
  | "low_confidence"
  | "unable_to_verify"
  | "not_applicable";

export const PCE_VerificationStatus_MEMBERS: readonly PCE_VerificationStatus[] = Object.freeze(["verified_deterministic", "high_confidence", "medium_confidence", "low_confidence", "unable_to_verify", "not_applicable"]);

export type PCE_ExtractionMethodKind =
  | "deterministic_header_parse"
  | "deterministic_hash"
  | "deterministic_pixel_analysis"
  | "sample_statistics"
  | "unable_to_verify_no_method";

export const PCE_ExtractionMethodKind_MEMBERS: readonly PCE_ExtractionMethodKind[] = Object.freeze(["deterministic_header_parse", "deterministic_hash", "deterministic_pixel_analysis", "sample_statistics", "unable_to_verify_no_method"]);

export type PCE_DeterminismKind =
  | "deterministic"
  | "reproducible_with_seed"
  | "bounded_nondeterministic"
  | "unable_to_reproduce";

export const PCE_DeterminismKind_MEMBERS: readonly PCE_DeterminismKind[] = Object.freeze(["deterministic", "reproducible_with_seed", "bounded_nondeterministic", "unable_to_reproduce"]);

export type PCE_PerceptualDomain =
  | "dimensions"
  | "format"
  | "provenance"
  | "geometry"
  | "material"
  | "colour"
  | "camera"
  | "composition"
  | "identity";

export const PCE_PerceptualDomain_MEMBERS: readonly PCE_PerceptualDomain[] = Object.freeze(["dimensions", "format", "provenance", "geometry", "material", "colour", "camera", "composition", "identity"]);

export type PCE_ExtractionRefusalReason =
  | "PCE_INVALID_REQUEST"
  | "PCE_INVALID_IMAGE_BYTES"
  | "PCE_UNSUPPORTED_FORMAT"
  | "PCE_IMAGE_TOO_LARGE"
  | "PCE_IMAGE_TOO_SMALL"
  | "PCE_MALFORMED_HEADER"
  | "PCE_PROHIBITED_STRING_CONTENT"
  | "PCE_MAX_EXTRACTIONS_EXCEEDED"
  | "PCE_INTERNAL";

export const PCE_ExtractionRefusalReason_MEMBERS: readonly PCE_ExtractionRefusalReason[] = Object.freeze(["PCE_INVALID_REQUEST", "PCE_INVALID_IMAGE_BYTES", "PCE_UNSUPPORTED_FORMAT", "PCE_IMAGE_TOO_LARGE", "PCE_IMAGE_TOO_SMALL", "PCE_MALFORMED_HEADER", "PCE_PROHIBITED_STRING_CONTENT", "PCE_MAX_EXTRACTIONS_EXCEEDED", "PCE_INTERNAL"]);
