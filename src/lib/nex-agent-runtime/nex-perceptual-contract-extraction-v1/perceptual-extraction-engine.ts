// §36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1 · engine
// NEX bounded infrastructure · deterministic perceptual extraction engine · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT
// NEX1-authored capability.
//
// Pure function · zero I/O · deterministic. Reads image bytes, applies
// deterministic pixel-adjacent extraction (PNG header + SHA-256), and
// emits a NEX1-authored PerceptualExtractionResult populated with per-
// property verification_status.
//
// Semantic properties (materials · geometry · camera · identity) are
// marked `unable_to_verify` explicitly. Dominant colour extraction from
// decoded pixels is deferred to a bounded PCE Vb amendment.
//
// Zero LLM · zero ML · zero package install · zero external inference.

import { createHash } from "node:crypto";
import type { Buffer } from "node:buffer";
import { readImageHeader, type HeaderReadResult } from "./perceptual-image-reader";
import {
  PCE_MAX_EXTRACTED_PROPERTIES,
  PCE_MAX_IMAGE_BYTES,
  PCE_MIN_IMAGE_BYTES,
  type PCE_ExtractionRefusalReason,
  type PCE_ImageFormat,
  type PCE_VerificationStatus,
} from "./perceptual-extraction-ranges";
import type {
  PCE_ExtractedProperty,
  PCE_ExtractionProvenance,
  PerceptualExtractionResult,
} from "./perceptual-extraction";
import {
  PCE_ALGORITHM_SLUG,
  PCE_ALGORITHM_VERSION,
  PCE_GREP_MARKER,
  type PCEFailure,
  type PCEResult,
  type PCESuccess,
  type RunPerceptualExtractionRequest,
} from "./perceptual-extraction-engine-types";

// ── Locked prohibited substrings on request_id / run_id / result_id ────

const PCE_PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
  "eval(",
  "new Function",
  "child_process",
  "<script>",
  "</script>",
  "__proto__",
  "constructor.prototype",
]);

// ── Helpers ────────────────────────────────────────────────────────────

function fail(code: PCE_ExtractionRefusalReason, reason: string): PCEFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    grep_marker: PCE_GREP_MARKER,
    algorithm_version: PCE_ALGORITHM_VERSION,
  };
}

function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function containsProhibited(s: string): string | null {
  for (const bad of PCE_PROHIBITED_SUBSTRINGS) if (s.includes(bad)) return bad;
  return null;
}

const IDENT_RE = /^[A-Za-z0-9_\-\.:/]+$/;

function isValidId(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= 128 && IDENT_RE.test(s);
}

function unableProperty(
  property_id: string,
  perceptual_domain: PCE_ExtractedProperty["perceptual_domain"],
  rationale: string,
): PCE_ExtractedProperty {
  return {
    property_id,
    perceptual_domain,
    value_summary: "(unable_to_verify)",
    verification_status: "unable_to_verify" as PCE_VerificationStatus,
    extraction_method_kind: "unable_to_verify_no_method",
    rationale,
  };
}

// ── Entry point ────────────────────────────────────────────────────────

export function runPerceptualContractExtraction(request: RunPerceptualExtractionRequest): PCEResult {
  if (!request || typeof request !== "object") {
    return fail("PCE_INVALID_REQUEST", "request required");
  }
  if (!isValidId(request.request_id)) {
    return fail("PCE_INVALID_REQUEST", "request_id must be a non-empty identifier (≤128 chars · [A-Za-z0-9_\\-.:/])");
  }
  const badInId = containsProhibited(request.request_id);
  if (badInId !== null) {
    return fail("PCE_PROHIBITED_STRING_CONTENT", `request_id contains prohibited substring '${badInId}'`);
  }
  if (request.run_id !== undefined && !isValidId(request.run_id)) {
    return fail("PCE_INVALID_REQUEST", "run_id must be a valid identifier when provided");
  }
  if (request.result_id !== undefined && !isValidId(request.result_id)) {
    return fail("PCE_INVALID_REQUEST", "result_id must be a valid identifier when provided");
  }
  const bytes = request.image_bytes;
  if (!bytes || typeof bytes !== "object" || (!(bytes instanceof Uint8Array) && !("byteLength" in bytes))) {
    return fail("PCE_INVALID_IMAGE_BYTES", "image_bytes must be a Uint8Array or Buffer");
  }
  const byteLength = (bytes as Uint8Array).byteLength ?? (bytes as Buffer).length ?? 0;
  if (byteLength < PCE_MIN_IMAGE_BYTES.min) {
    return fail("PCE_IMAGE_TOO_SMALL", `image_bytes.length ${byteLength} below minimum ${PCE_MIN_IMAGE_BYTES.min}`);
  }
  if (byteLength > PCE_MAX_IMAGE_BYTES.max) {
    return fail("PCE_IMAGE_TOO_LARGE", `image_bytes.length ${byteLength} above maximum ${PCE_MAX_IMAGE_BYTES.max}`);
  }

  const view: Uint8Array = bytes instanceof Uint8Array ? bytes : new Uint8Array((bytes as Buffer).buffer, (bytes as Buffer).byteOffset, byteLength);

  // Header parse
  const header: HeaderReadResult = readImageHeader(view);
  if (header.kind === "FAILURE") {
    switch (header.reason) {
      case "invalid_bytes": return fail("PCE_INVALID_IMAGE_BYTES", "image_bytes invalid");
      case "too_small": return fail("PCE_IMAGE_TOO_SMALL", "image_bytes shorter than any known image header");
      case "malformed_header": return fail("PCE_MALFORMED_HEADER", "image header malformed (bad IHDR / zero dimension)");
      case "unsupported_format": return fail("PCE_UNSUPPORTED_FORMAT", "image format not recognised (not PNG · not JPEG · not WebP · not AVIF)");
    }
  }

  const hdr = header;
  const source_sha256 = sha256Hex(view);
  const format: PCE_ImageFormat = hdr.format;
  const width = hdr.width ?? 0;
  const height = hdr.height ?? 0;

  // ── Assemble properties ─────────────────────────────────────────────
  const properties: PCE_ExtractedProperty[] = [];

  // Format (deterministic magic-byte detection)
  properties.push({
    property_id: "format",
    perceptual_domain: "format",
    value_summary: format,
    verification_status: "verified_deterministic",
    extraction_method_kind: "deterministic_header_parse",
    rationale: `image format determined from magic bytes · ${format}`,
  });

  // SHA-256 provenance (deterministic hash)
  properties.push({
    property_id: "source_asset_sha256",
    perceptual_domain: "provenance",
    value_summary: source_sha256,
    verification_status: "verified_deterministic",
    extraction_method_kind: "deterministic_hash",
    rationale: `SHA-256 of image_bytes (${byteLength} bytes)`,
  });

  // Byte length (deterministic)
  properties.push({
    property_id: "source_byte_length",
    perceptual_domain: "provenance",
    value_summary: String(byteLength),
    verification_status: "verified_deterministic",
    extraction_method_kind: "deterministic_header_parse",
    rationale: `image_bytes.length = ${byteLength}`,
  });

  // Dimensions
  if (hdr.width !== null && hdr.height !== null) {
    properties.push({
      property_id: "dimensions.width",
      perceptual_domain: "dimensions",
      value_summary: String(hdr.width),
      verification_status: "verified_deterministic",
      extraction_method_kind: "deterministic_header_parse",
      rationale: `${format.toUpperCase()} IHDR chunk width = ${hdr.width}`,
    });
    properties.push({
      property_id: "dimensions.height",
      perceptual_domain: "dimensions",
      value_summary: String(hdr.height),
      verification_status: "verified_deterministic",
      extraction_method_kind: "deterministic_header_parse",
      rationale: `${format.toUpperCase()} IHDR chunk height = ${hdr.height}`,
    });
    // Aspect ratio (derived deterministically from dimensions)
    // Use gcd to reduce to simplest form
    const gcd = greatestCommonDivisor(hdr.width, hdr.height);
    const ar_num = hdr.width / gcd;
    const ar_den = hdr.height / gcd;
    properties.push({
      property_id: "composition.aspect_ratio",
      perceptual_domain: "composition",
      value_summary: `${ar_num}:${ar_den}`,
      verification_status: "verified_deterministic",
      extraction_method_kind: "deterministic_header_parse",
      rationale: `derived from ${hdr.width}x${hdr.height} · reduced by gcd(${hdr.width},${hdr.height})=${gcd}`,
    });
  } else {
    // JPEG/WebP/AVIF in V1: dimensions unable_to_verify
    properties.push(unableProperty(
      "dimensions.width",
      "dimensions",
      `PCE V1 supports PNG dimensions only · ${format.toUpperCase()} dimension parsing is a future PCE Vb amendment`,
    ));
    properties.push(unableProperty(
      "dimensions.height",
      "dimensions",
      `PCE V1 supports PNG dimensions only · ${format.toUpperCase()} dimension parsing is a future PCE Vb amendment`,
    ));
    properties.push(unableProperty(
      "composition.aspect_ratio",
      "composition",
      `aspect_ratio requires dimensions · which are unable_to_verify for ${format.toUpperCase()} in this wave`,
    ));
  }

  // ── Semantic properties → unable_to_verify (honest scope) ───────────

  properties.push(unableProperty(
    "geometry.component_counts",
    "geometry",
    "component-count extraction requires object segmentation · no ML capability authorised in this wave",
  ));
  properties.push(unableProperty(
    "geometry.structural_description",
    "geometry",
    "structural description requires scene understanding · no ML capability authorised in this wave",
  ));
  properties.push(unableProperty(
    "material.classifications",
    "material",
    "material classification requires perceptual training · no ML capability authorised in this wave",
  ));
  properties.push(unableProperty(
    "colour.dominant_ranges",
    "colour",
    "dominant colour extraction requires zlib-decoded pixel data · deferred to a bounded PCE Vb amendment",
  ));
  properties.push(unableProperty(
    "camera.view_angle_kind",
    "camera",
    "camera-view inference requires geometry understanding · no ML capability authorised in this wave",
  ));
  properties.push(unableProperty(
    "camera.height_relative_kind",
    "camera",
    "camera-height inference requires scene understanding · no ML capability authorised in this wave",
  ));
  properties.push(unableProperty(
    "camera.focal_length_kind",
    "camera",
    "focal-length inference requires camera calibration or EXIF · not supported in PCE V1",
  ));
  properties.push(unableProperty(
    "composition.subject_placement_hint",
    "composition",
    "subject-placement extraction requires saliency detection · no ML capability authorised in this wave",
  ));
  properties.push(unableProperty(
    "identity.features",
    "identity",
    "identity-feature extraction requires ML embeddings · no ML capability authorised in this wave",
  ));

  // Safety cap
  if (properties.length > PCE_MAX_EXTRACTED_PROPERTIES.max) {
    return fail("PCE_MAX_EXTRACTIONS_EXCEEDED", `properties ${properties.length} above cap ${PCE_MAX_EXTRACTED_PROPERTIES.max}`);
  }

  // ── Counters + provenance ───────────────────────────────────────────
  let verified = 0;
  let unable = 0;
  for (const p of properties) {
    if (p.verification_status === "verified_deterministic") verified++;
    else if (p.verification_status === "unable_to_verify") unable++;
  }

  const extraction_timestamp = request.extraction_timestamp ?? "1970-01-01T00:00:00.000Z";
  const run_id = request.run_id ?? `pce-run:${source_sha256.slice(0, 12)}`;
  const result_id = request.result_id ?? `pce-result:${request.request_id}:${source_sha256.slice(0, 12)}`;

  const provenance: PCE_ExtractionProvenance = {
    extraction_algorithm_slug: PCE_ALGORITHM_SLUG,
    algorithm_version: PCE_ALGORITHM_VERSION,
    source_asset_sha256: source_sha256,
    source_dimensions_width: width,
    source_dimensions_height: height,
    source_format: format,
    source_byte_length: byteLength,
    run_id,
    extraction_timestamp,
  };

  const result: PerceptualExtractionResult = {
    result_id,
    request_id: request.request_id,
    provenance,
    extracted_properties: Object.freeze(properties),
    determinism_kind: "deterministic",
    verified_count: verified,
    unable_to_verify_count: unable,
  };

  const success: PCESuccess = {
    kind: "SUCCESS",
    result,
    grep_marker: PCE_GREP_MARKER,
    algorithm_version: PCE_ALGORITHM_VERSION,
  };
  return success;
}

function greatestCommonDivisor(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

// Re-exports
export { PCE_ALGORITHM_SLUG, PCE_ALGORITHM_VERSION, PCE_GREP_MARKER } from "./perceptual-extraction-engine-types";
