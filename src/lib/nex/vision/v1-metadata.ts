// src/lib/nex/vision/v1-metadata.ts
//
// NEX Master AI · Phase 7 · Vision Stage V1 · deterministic image metadata
// Philip 2026-09-07 · AUTHORIZE Phase 7 · Vision V1
//
// The safest smallest stage of the vision doctrine:
//   · File-header format detection (no pixel decoding)
//   · Dimensions from PNG IHDR + JPEG SOF markers
//   · Byte-exact SHA-256 (exact-dedup)
//   · Truncated hash for cheap near-dedup fingerprint
//   · Corruption detection
//
// HARD RULES (per vision doctrine):
//   · Never fabricates what an image contains
//   · Never claims semantic understanding (that requires V4 self-hosted vision model · not this stage)
//   · Never sends bytes to any third-party API
//   · Every result cites analyzer + version + confidence
//   · Returns UNKNOWN honestly when it cannot determine
//   · Pure Node built-ins only · zero external dependencies

import { createHash } from "node:crypto";

export const V1_ANALYZER = "nex-vision-v1-header-metadata";
export const V1_ANALYZER_VERSION = "1.0.0";

export type ImageFormat = "png" | "jpeg" | "webp" | "gif" | "bmp" | "unknown";

export type CorruptionStatus =
  | "OK"
  | "SIGNATURE_MISSING"
  | "SIGNATURE_MISMATCH"
  | "TRUNCATED"
  | "UNKNOWN";

export type ImageMetadata = {
  analyzer: string;
  analyzer_version: string;
  format: ImageFormat;
  size_bytes: number;
  width: number | null;
  height: number | null;
  corruption_status: CorruptionStatus;
  sha256_full: string;              // 64-hex (exact-dedup)
  fingerprint16: string;            // first 16 hex chars of sha256 (fast near-dedup grouping)
  confidence: "low" | "medium" | "high";
  observations: string[];           // deterministic notes about what the analyzer noticed
  claimed_semantic_content: null;   // ALWAYS null · V1 never claims semantics · doctrine
};

// ─── Format detection (deterministic byte-signature) ───────────

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SOI = Buffer.from([0xff, 0xd8]);
const JPEG_EOI = Buffer.from([0xff, 0xd9]);
const GIF87 = Buffer.from("GIF87a", "ascii");
const GIF89 = Buffer.from("GIF89a", "ascii");
const BMP_SIG = Buffer.from("BM", "ascii");

export function detectFormat(buf: Buffer): ImageFormat {
  if (buf.length < 4) return "unknown";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG)) return "png";
  if (buf.length >= 2 && buf.subarray(0, 2).equals(JPEG_SOI)) return "jpeg";
  if (buf.length >= 6 && (buf.subarray(0, 6).equals(GIF87) || buf.subarray(0, 6).equals(GIF89))) return "gif";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.length >= 2 && buf.subarray(0, 2).equals(BMP_SIG)) return "bmp";
  return "unknown";
}

// ─── Dimensions ────────────────────────────────────────────────

function readPngDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG IHDR chunk starts at byte 8 · length (4) + type "IHDR" (4) + width (4) + height (4)
  if (buf.length < 24) return null;
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function readJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  // Scan through JPEG markers · look for SOF0 (0xC0) through SOF15 (0xCF) excluding DHT (0xC4) and DAC (0xCC)
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) return null; // not on a marker · malformed
    // Skip fill bytes 0xFF
    while (i < buf.length - 1 && buf[i + 1] === 0xff) i += 1;
    const marker = buf[i + 1];
    // SOI/EOI are no-length
    if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
    if (i + 4 > buf.length) return null;
    const segLen = buf.readUInt16BE(i + 2);
    // SOF markers 0xC0-0xCF except 0xC4 (DHT) 0xC8 (JPG_ext) 0xCC (DAC)
    if (marker !== undefined && marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      // SOF segment: length(2) + P(1) + Y(2) + X(2)
      if (i + 9 > buf.length) return null;
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    i += 2 + segLen;
  }
  return null;
}

function readGifDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 10) return null;
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  return { width, height };
}

function readBmpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 26) return null;
  // BITMAPINFOHEADER starts at offset 14 · width int32 LE at 18 · height int32 LE at 22
  const width = Math.abs(buf.readInt32LE(18));
  const height = Math.abs(buf.readInt32LE(22));
  return { width, height };
}

function readWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  // WebP has three container variants: VP8 (lossy) · VP8L (lossless) · VP8X (extended)
  if (buf.length < 30) return null;
  const fourCC = buf.subarray(12, 16).toString("ascii");
  if (fourCC === "VP8 ") {
    // Simple VP8 · width/height at offset 26-30 (14-bit each · masked)
    if (buf.length < 30) return null;
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (fourCC === "VP8L") {
    // Lossless · 14-bit width-1 and height-1 in bytes 21-25
    if (buf.length < 25) return null;
    const b0 = buf.readUInt8(21);
    const b1 = buf.readUInt8(22);
    const b2 = buf.readUInt8(23);
    const b3 = buf.readUInt8(24);
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  if (fourCC === "VP8X") {
    // Extended · 24-bit width-1 and height-1 in bytes 24-29
    if (buf.length < 30) return null;
    const width = 1 + (buf.readUInt8(24) | (buf.readUInt8(25) << 8) | (buf.readUInt8(26) << 16));
    const height = 1 + (buf.readUInt8(27) | (buf.readUInt8(28) << 8) | (buf.readUInt8(29) << 16));
    return { width, height };
  }
  return null;
}

export function readDimensions(buf: Buffer, format: ImageFormat): { width: number; height: number } | null {
  switch (format) {
    case "png": return readPngDimensions(buf);
    case "jpeg": return readJpegDimensions(buf);
    case "gif": return readGifDimensions(buf);
    case "bmp": return readBmpDimensions(buf);
    case "webp": return readWebpDimensions(buf);
    default: return null;
  }
}

// ─── Corruption detection ─────────────────────────────────────

export function detectCorruption(buf: Buffer, format: ImageFormat): CorruptionStatus {
  if (buf.length === 0) return "SIGNATURE_MISSING";
  switch (format) {
    case "png": {
      if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) return "SIGNATURE_MISSING";
      // Last chunk should be IEND · type at (len-8..len-4)
      if (buf.length < 12) return "TRUNCATED";
      const tail = buf.subarray(buf.length - 8, buf.length - 4).toString("ascii");
      if (tail !== "IEND") return "TRUNCATED";
      return "OK";
    }
    case "jpeg": {
      if (buf.length < 2 || !buf.subarray(0, 2).equals(JPEG_SOI)) return "SIGNATURE_MISSING";
      if (buf.length < 4) return "TRUNCATED";
      const tail = buf.subarray(buf.length - 2);
      if (!tail.equals(JPEG_EOI)) return "TRUNCATED";
      return "OK";
    }
    case "gif": {
      if (buf.length < 6) return "SIGNATURE_MISSING";
      // GIF trailer is 0x3B
      if (buf.readUInt8(buf.length - 1) !== 0x3b) return "TRUNCATED";
      return "OK";
    }
    case "bmp": {
      if (buf.length < 2 || !buf.subarray(0, 2).equals(BMP_SIG)) return "SIGNATURE_MISSING";
      if (buf.length < 14) return "TRUNCATED";
      const declaredSize = buf.readUInt32LE(2);
      if (declaredSize !== buf.length) return "TRUNCATED";
      return "OK";
    }
    case "webp": {
      if (buf.length < 12) return "SIGNATURE_MISSING";
      const declaredSize = buf.readUInt32LE(4) + 8;
      if (declaredSize !== buf.length) return "TRUNCATED";
      return "OK";
    }
    default:
      return "UNKNOWN";
  }
}

// ─── Public entry point ────────────────────────────────────────

export function computeImageMetadata(buf: Buffer): ImageMetadata {
  const observations: string[] = [];
  const format = detectFormat(buf);
  observations.push(`format detected: ${format}`);

  const dims = readDimensions(buf, format);
  if (dims) observations.push(`dimensions: ${dims.width}x${dims.height}`);
  else if (format !== "unknown") observations.push("dimensions: UNKNOWN (header not parseable at V1)");

  const corruption = detectCorruption(buf, format);
  observations.push(`corruption_status: ${corruption}`);

  const sha256 = createHash("sha256").update(buf).digest("hex");
  const fingerprint16 = sha256.slice(0, 16);

  // Confidence: HIGH when format + dims + OK all present · MEDIUM when format only · LOW when unknown
  let confidence: ImageMetadata["confidence"] = "low";
  if (format !== "unknown" && dims && corruption === "OK") confidence = "high";
  else if (format !== "unknown") confidence = "medium";

  return {
    analyzer: V1_ANALYZER,
    analyzer_version: V1_ANALYZER_VERSION,
    format,
    size_bytes: buf.length,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    corruption_status: corruption,
    sha256_full: sha256,
    fingerprint16,
    confidence,
    observations,
    claimed_semantic_content: null,   // DOCTRINE: V1 never claims semantics
  };
}
