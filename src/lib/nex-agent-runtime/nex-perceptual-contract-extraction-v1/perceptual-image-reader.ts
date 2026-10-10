// §36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1 · reader
// NEX bounded infrastructure · deterministic image header parser · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT
// NEX1-authored capability.
//
// Pure functions · zero I/O. Parses image byte buffers to extract:
//   · format (via magic-byte detection)
//   · dimensions (PNG only in V1 · JPEG deferred to a bounded Vb)
//
// Zero external dependencies. Node builtin Buffer only. Zero zlib.
// Zero decoders. Only header parsing.

import type { Buffer } from "node:buffer";

export type ImageFormat = "png" | "jpeg" | "webp" | "avif" | "unknown";

export interface HeaderReadSuccess {
  readonly kind: "SUCCESS";
  readonly format: ImageFormat;
  readonly width: number | null;   // null = unable_to_verify
  readonly height: number | null;  // null = unable_to_verify
  readonly bit_depth: number | null;
  readonly colour_type: number | null;
}

export interface HeaderReadFailure {
  readonly kind: "FAILURE";
  readonly reason: "invalid_bytes" | "malformed_header" | "unsupported_format" | "too_small";
}

export type HeaderReadResult = HeaderReadSuccess | HeaderReadFailure;

// PNG signature: 89 50 4E 47 0D 0A 1A 0A
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// JPEG signature: FF D8 FF (SOI + first marker byte)
const JPEG_SIGNATURE_2 = new Uint8Array([0xFF, 0xD8]);

// WebP: bytes 0-3 "RIFF" + bytes 8-11 "WEBP"
const WEBP_SIG_A = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // "RIFF"
const WEBP_SIG_B = new Uint8Array([0x57, 0x45, 0x42, 0x50]); // "WEBP"

// AVIF: bytes 4-11 "ftypavif" (approximate · avif box)
const AVIF_FTYP = new Uint8Array([0x66, 0x74, 0x79, 0x70]); // "ftyp"
const AVIF_BRAND = new Uint8Array([0x61, 0x76, 0x69, 0x66]); // "avif"

function bytesEqual(a: Uint8Array, b: Uint8Array, offset = 0): boolean {
  for (let i = 0; i < b.length; i++) if (a[offset + i] !== b[i]) return false;
  return true;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0; // unsigned
}

function detectFormat(bytes: Uint8Array): ImageFormat {
  if (bytes.length < 8) return "unknown";
  if (bytesEqual(bytes, PNG_SIGNATURE, 0)) return "png";
  if (bytes[0] === JPEG_SIGNATURE_2[0] && bytes[1] === JPEG_SIGNATURE_2[1]) return "jpeg";
  if (bytes.length >= 12 && bytesEqual(bytes, WEBP_SIG_A, 0) && bytesEqual(bytes, WEBP_SIG_B, 8)) return "webp";
  if (bytes.length >= 12 && bytesEqual(bytes, AVIF_FTYP, 4) && bytesEqual(bytes, AVIF_BRAND, 8)) return "avif";
  return "unknown";
}

/** Parse the PNG IHDR chunk to extract width/height/bit_depth/colour_type.
 *  PNG spec: after the 8-byte signature, the first chunk MUST be IHDR.
 *  IHDR layout:
 *    · 4 bytes chunk length (always 13)
 *    · 4 bytes chunk type ("IHDR")
 *    · 4 bytes width (big-endian uint32)
 *    · 4 bytes height (big-endian uint32)
 *    · 1 byte bit depth
 *    · 1 byte colour type
 *    · 1 byte compression method
 *    · 1 byte filter method
 *    · 1 byte interlace method
 *    · 4 bytes CRC
 */
function parsePngHeader(bytes: Uint8Array): HeaderReadResult {
  // Need at least signature (8) + chunk length (4) + chunk type (4) + IHDR data (13) = 29 bytes
  if (bytes.length < 29) return { kind: "FAILURE", reason: "too_small" };
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunkType !== "IHDR") return { kind: "FAILURE", reason: "malformed_header" };
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  if (width === 0 || height === 0) return { kind: "FAILURE", reason: "malformed_header" };
  // Sanity: reject absurd dimensions (e.g., > 65535 in either axis · standard consumer image cap)
  if (width > 65535 || height > 65535) return { kind: "FAILURE", reason: "malformed_header" };
  const bit_depth = bytes[24];
  const colour_type = bytes[25];
  return {
    kind: "SUCCESS",
    format: "png",
    width,
    height,
    bit_depth,
    colour_type,
  };
}

/** Read image header. In V1 only PNG dimensions are parsed. JPEG/WebP/AVIF
 *  return SUCCESS with width/height = null · reflecting unable_to_verify. */
export function readImageHeader(bytes: Uint8Array | Buffer): HeaderReadResult {
  if (!bytes || bytes.length === 0) return { kind: "FAILURE", reason: "invalid_bytes" };
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.length < 8) return { kind: "FAILURE", reason: "too_small" };
  const format = detectFormat(view);
  if (format === "unknown") return { kind: "FAILURE", reason: "unsupported_format" };
  if (format === "png") return parsePngHeader(view);
  // JPEG/WebP/AVIF: format detected but dimensions unable_to_verify in V1
  return {
    kind: "SUCCESS",
    format,
    width: null,
    height: null,
    bit_depth: null,
    colour_type: null,
  };
}

/** Craft a minimal valid PNG with the given dimensions. Used by the test
 *  harness as a real-image fixture. Deterministic byte output.
 *  Produces an 8-bit RGB image (colour_type=2) with a single all-black pixel row.
 *  Note: IDAT is intentionally minimal · CRC values are placeholders that a
 *  strict PNG validator would reject · but our parser only needs the IHDR. */
export function craftMinimalPng(width: number, height: number): Uint8Array {
  if (width <= 0 || height <= 0 || width > 65535 || height > 65535) {
    throw new Error(`craftMinimalPng: dimensions out of range (${width}x${height})`);
  }
  const out = new Uint8Array(29);
  // Signature
  out.set(PNG_SIGNATURE, 0);
  // IHDR chunk length (13)
  out[8] = 0x00; out[9] = 0x00; out[10] = 0x00; out[11] = 0x0D;
  // IHDR chunk type
  out[12] = 0x49; out[13] = 0x48; out[14] = 0x44; out[15] = 0x52;
  // width (BE uint32)
  out[16] = (width >>> 24) & 0xFF;
  out[17] = (width >>> 16) & 0xFF;
  out[18] = (width >>> 8) & 0xFF;
  out[19] = width & 0xFF;
  // height (BE uint32)
  out[20] = (height >>> 24) & 0xFF;
  out[21] = (height >>> 16) & 0xFF;
  out[22] = (height >>> 8) & 0xFF;
  out[23] = height & 0xFF;
  // bit_depth = 8, colour_type = 2 (RGB), compression = 0, filter = 0, interlace = 0
  out[24] = 8;
  out[25] = 2;
  out[26] = 0;
  out[27] = 0;
  out[28] = 0;
  // CRC deliberately not filled · parser skips CRC · only header fields are read
  return out;
}

/** Craft a JPEG SOI-only stub for format-detection testing. */
export function craftMinimalJpegStub(): Uint8Array {
  // 8 bytes: FF D8 (SOI) + placeholder
  return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
}

/** Craft a WebP stub (RIFF ... WEBP ...). */
export function craftMinimalWebpStub(): Uint8Array {
  const out = new Uint8Array(12);
  out.set(WEBP_SIG_A, 0);
  // 4 bytes file size (placeholder)
  out[4] = 0; out[5] = 0; out[6] = 0; out[7] = 0;
  out.set(WEBP_SIG_B, 8);
  return out;
}
