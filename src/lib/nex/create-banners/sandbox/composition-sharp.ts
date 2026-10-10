// src/lib/nex/create-banners/sandbox/composition-sharp.ts
//
// NEX Create Banners · Sandbox Sharp-based composition · 2026-09-23
// =================================================================
// Overlays NEX-controlled headline + CTA + watermark on top of a raw
// SDXL-generated asset. Uses Sharp with SVG composite (no rasterised
// third-party fonts · no external calls). Bounded implementation for
// the sandbox demo.

import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import type { BannerFormat } from "../formats";
import type { CopyRequirements } from "../types";
import { SANDBOX_WATERMARK_TEXT } from "./sandbox-doctrine";

export interface ComposeInput {
  readonly raw_generated_asset_absolute_path: string;
  readonly format: BannerFormat;
  readonly copy: CopyRequirements;
  readonly output_absolute_path: string;
}

export interface ComposeOutput {
  readonly kind: "SUCCESS" | "FAILURE";
  readonly composed_asset_absolute_path: string | null;
  readonly composed_asset_sha256: string | null;
  readonly composed_asset_bytes: number | null;
  readonly duration_ms: number;
  readonly failure_reason: string | null;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function overlaySvg(format: BannerFormat, copy: CopyRequirements): string {
  const w = format.width;
  const h = format.height;
  const marginX = Math.round(w * 0.05);
  const headlineFontSize = Math.max(24, Math.round(h * 0.06));
  const ctaFontSize = Math.max(18, Math.round(h * 0.04));
  const watermarkFontSize = Math.max(12, Math.round(h * 0.022));

  const headline = escapeXml(copy.headline);
  const cta = escapeXml(copy.cta);
  const watermark = escapeXml(SANDBOX_WATERMARK_TEXT);

  // Top translucent dark band for headline
  const headlineBandHeight = Math.round(h * 0.18);
  // Bottom translucent dark band for CTA
  const ctaBandHeight = Math.round(h * 0.14);
  const ctaBandY = h - ctaBandHeight;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="topBand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.72)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0)" />
    </linearGradient>
    <linearGradient id="bottomBand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.85)" />
    </linearGradient>
  </defs>
  <!-- Headline band -->
  <rect x="0" y="0" width="${w}" height="${headlineBandHeight}" fill="url(#topBand)" />
  <text x="${marginX}" y="${Math.round(headlineBandHeight * 0.62)}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${headlineFontSize}" font-weight="700"
        fill="#ffffff">${headline}</text>

  <!-- CTA band -->
  <rect x="0" y="${ctaBandY}" width="${w}" height="${ctaBandHeight}" fill="url(#bottomBand)" />
  <text x="${marginX}" y="${ctaBandY + Math.round(ctaBandHeight * 0.55)}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${ctaFontSize}" font-weight="600"
        fill="#facc15">${cta}</text>

  <!-- Watermark diagonal · doctrine-locked · never removable -->
  <g transform="translate(${w / 2}, ${h / 2}) rotate(-30)">
    <text x="0" y="0"
          text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${watermarkFontSize * 2.4}"
          font-weight="800"
          fill="rgba(220,38,38,0.55)"
          stroke="rgba(0,0,0,0.35)"
          stroke-width="1">${watermark}</text>
  </g>

  <!-- Bottom-right small watermark tag -->
  <text x="${w - marginX}" y="${h - Math.round(marginX * 0.6)}"
        text-anchor="end"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${watermarkFontSize}"
        font-weight="600"
        fill="#ffffff"
        opacity="0.85">NEX SANDBOX · UNPROVEN</text>
</svg>`;
}

export async function composeSandboxBanner(
  input: ComposeInput
): Promise<ComposeOutput> {
  const started = Date.now();
  try {
    const svgOverlay = Buffer.from(overlaySvg(input.format, input.copy));

    // Resize the raw generation to the target format (cover behaviour so the
    // subject fills the target aspect · centre-cropped).
    const resizedRaw = await sharp(input.raw_generated_asset_absolute_path)
      .resize(input.format.width, input.format.height, {
        fit: "cover",
        position: "attention",
      })
      .toBuffer();

    // Composite the SVG overlay on top of the resized raw.
    const composedBuffer = await sharp(resizedRaw)
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .png()
      .toBuffer();

    fs.mkdirSync(path.dirname(input.output_absolute_path), {
      recursive: true,
    });
    fs.writeFileSync(input.output_absolute_path, composedBuffer);

    const sha = createHash("sha256").update(composedBuffer).digest("hex");
    return {
      kind: "SUCCESS",
      composed_asset_absolute_path: input.output_absolute_path,
      composed_asset_sha256: sha,
      composed_asset_bytes: composedBuffer.length,
      duration_ms: Date.now() - started,
      failure_reason: null,
    };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      kind: "FAILURE",
      composed_asset_absolute_path: null,
      composed_asset_sha256: null,
      composed_asset_bytes: null,
      duration_ms: Date.now() - started,
      failure_reason: reason,
    };
  }
}
