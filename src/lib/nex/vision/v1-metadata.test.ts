// src/lib/nex/vision/v1-metadata.test.ts
//
// Phase 7 · Vision V1 · deterministic image metadata · contract tests

import { describe, it, expect } from "vitest";
import { computeImageMetadata, detectFormat, readDimensions, detectCorruption, V1_ANALYZER, V1_ANALYZER_VERSION } from "./v1-metadata";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

// ─── Tiny valid image constructors ─────────────────────────

function makeMinimalPng(width: number, height: number): Buffer {
  // 8-byte PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR chunk: length(4)=13, type "IHDR", width(4), height(4), bitDepth(1)=8, colorType(1)=2 (RGB), compression(1)=0, filter(1)=0, interlace(1)=0, CRC(4)=0 (invalid but structurally present)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(2, 9);
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdrLen = Buffer.alloc(4); ihdrLen.writeUInt32BE(13, 0);
  const ihdrType = Buffer.from("IHDR", "ascii");
  const ihdrCrc = Buffer.alloc(4); // stubbed CRC
  const ihdr = Buffer.concat([ihdrLen, ihdrType, ihdrData, ihdrCrc]);
  // IDAT chunk: minimal deflated single black pixel row
  const rowBytes = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0)]); // filter byte + RGB pixels
  const allRows = Buffer.concat(Array(height).fill(rowBytes));
  const idatData = deflateSync(allRows);
  const idatLen = Buffer.alloc(4); idatLen.writeUInt32BE(idatData.length, 0);
  const idatType = Buffer.from("IDAT", "ascii");
  const idatCrc = Buffer.alloc(4);
  const idat = Buffer.concat([idatLen, idatType, idatData, idatCrc]);
  // IEND chunk: length(4)=0 · type "IEND" · CRC(4)
  const iendLen = Buffer.alloc(4); iendLen.writeUInt32BE(0, 0);
  const iendType = Buffer.from("IEND", "ascii");
  const iendCrc = Buffer.alloc(4);
  const iend = Buffer.concat([iendLen, iendType, iendCrc]);
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function makeMinimalJpeg(width: number, height: number): Buffer {
  // SOI + SOF0 marker segment + EOI
  const soi = Buffer.from([0xff, 0xd8]);
  // SOF0: FF C0, length=11, precision=8, height(2), width(2), components=3, then 3 component specs (3 bytes each = 9). Length includes the length bytes itself. 2+1+2+2+1+9=17 → length=17-2=15? Actually the length field INCLUDES itself · so total data after length = length. SOF0 payload = P(1)+Y(2)+X(2)+Nf(1)+components(Nf*3) = 1+2+2+1+9=15 · so length field = 15+2=17
  const sof = Buffer.alloc(19);
  sof.writeUInt8(0xff, 0);
  sof.writeUInt8(0xc0, 1);
  sof.writeUInt16BE(17, 2);      // length
  sof.writeUInt8(8, 4);          // precision
  sof.writeUInt16BE(height, 5);  // Y (height)
  sof.writeUInt16BE(width, 7);   // X (width)
  sof.writeUInt8(3, 9);          // Nf (num components)
  // 3 components (Y, Cb, Cr) · each: id + sampling factor + Tq
  sof.writeUInt8(1, 10); sof.writeUInt8(0x22, 11); sof.writeUInt8(0, 12);
  sof.writeUInt8(2, 13); sof.writeUInt8(0x11, 14); sof.writeUInt8(0, 15);
  sof.writeUInt8(3, 16); sof.writeUInt8(0x11, 17); sof.writeUInt8(0, 18);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, sof, eoi]);
}

// ─── Tests ─────────────────────────────────────────────────

describe("Phase 7 Vision V1 · format detection · deterministic", () => {
  it("detects PNG signature", () => {
    const p = makeMinimalPng(1, 1);
    expect(detectFormat(p)).toBe("png");
  });
  it("detects JPEG signature", () => {
    const j = makeMinimalJpeg(1, 1);
    expect(detectFormat(j)).toBe("jpeg");
  });
  it("returns unknown for arbitrary bytes", () => {
    const junk = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]);
    expect(detectFormat(junk)).toBe("unknown");
  });
  it("returns unknown for empty buffer", () => {
    expect(detectFormat(Buffer.alloc(0))).toBe("unknown");
  });
});

describe("Phase 7 Vision V1 · dimensions", () => {
  it("reads PNG dimensions from IHDR", () => {
    const p = makeMinimalPng(640, 480);
    const dims = readDimensions(p, "png");
    expect(dims).toEqual({ width: 640, height: 480 });
  });
  it("reads JPEG dimensions from SOF0", () => {
    const j = makeMinimalJpeg(320, 240);
    const dims = readDimensions(j, "jpeg");
    expect(dims).toEqual({ width: 320, height: 240 });
  });
  it("returns null for unknown format", () => {
    const junk = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(readDimensions(junk, "unknown")).toBe(null);
  });
});

describe("Phase 7 Vision V1 · corruption detection", () => {
  it("OK for well-formed PNG", () => {
    const p = makeMinimalPng(10, 10);
    expect(detectCorruption(p, "png")).toBe("OK");
  });
  it("TRUNCATED for PNG missing IEND", () => {
    const p = makeMinimalPng(10, 10);
    const truncated = p.subarray(0, p.length - 12);
    expect(detectCorruption(truncated, "png")).toBe("TRUNCATED");
  });
  it("OK for well-formed JPEG", () => {
    const j = makeMinimalJpeg(10, 10);
    expect(detectCorruption(j, "jpeg")).toBe("OK");
  });
  it("TRUNCATED for JPEG missing EOI", () => {
    const j = makeMinimalJpeg(10, 10);
    const truncated = j.subarray(0, j.length - 2);
    expect(detectCorruption(truncated, "jpeg")).toBe("TRUNCATED");
  });
  it("SIGNATURE_MISSING for random bytes claimed as PNG", () => {
    const junk = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(detectCorruption(junk, "png")).toBe("SIGNATURE_MISSING");
  });
});

describe("Phase 7 Vision V1 · full metadata composition", () => {
  it("computeImageMetadata produces analyzer/version/confidence/observations/no-semantic-claim", () => {
    const p = makeMinimalPng(100, 50);
    const md = computeImageMetadata(p);
    expect(md.analyzer).toBe(V1_ANALYZER);
    expect(md.analyzer_version).toBe(V1_ANALYZER_VERSION);
    expect(md.format).toBe("png");
    expect(md.width).toBe(100);
    expect(md.height).toBe(50);
    expect(md.corruption_status).toBe("OK");
    expect(md.confidence).toBe("high");
    expect(md.observations.length).toBeGreaterThan(0);
    // Doctrine: V1 never claims semantics
    expect(md.claimed_semantic_content).toBe(null);
  });

  it("identical bytes → identical sha256_full (deterministic dedup)", () => {
    const p1 = makeMinimalPng(10, 10);
    const p2 = makeMinimalPng(10, 10);
    const md1 = computeImageMetadata(p1);
    const md2 = computeImageMetadata(p2);
    expect(md1.sha256_full).toBe(md2.sha256_full);
    expect(md1.fingerprint16).toBe(md2.fingerprint16);
    // Cross-check hash is real SHA-256
    expect(md1.sha256_full).toBe(createHash("sha256").update(p1).digest("hex"));
  });

  it("different dimensions → different sha256 (proves no reuse)", () => {
    const p1 = makeMinimalPng(10, 10);
    const p2 = makeMinimalPng(20, 20);
    const md1 = computeImageMetadata(p1);
    const md2 = computeImageMetadata(p2);
    expect(md1.sha256_full).not.toBe(md2.sha256_full);
  });

  it("unknown format → confidence LOW · width/height null · never fabricates dimensions", () => {
    const junk = Buffer.from("not an image at all", "utf8");
    const md = computeImageMetadata(junk);
    expect(md.format).toBe("unknown");
    expect(md.width).toBe(null);
    expect(md.height).toBe(null);
    expect(md.confidence).toBe("low");
    expect(md.claimed_semantic_content).toBe(null);
  });

  it("V1 NEVER populates claimed_semantic_content (doctrine)", () => {
    const p = makeMinimalPng(1, 1);
    const j = makeMinimalJpeg(1, 1);
    const junk = Buffer.from("random", "utf8");
    for (const buf of [p, j, junk]) {
      const md = computeImageMetadata(buf);
      expect(md.claimed_semantic_content).toBe(null);
    }
  });
});
