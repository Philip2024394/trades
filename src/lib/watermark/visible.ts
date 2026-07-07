// Visible watermark layer — the corner URL (SEO-durable) + optional
// center brand chip (preview only).
//
// Both marks are composited via Sharp as SVG overlays so they scale
// crisply with the image and don't depend on installed fonts.

import sharp from "sharp";
import type { OverlayOptions, Sharp } from "sharp";
import {
  WATERMARK_BRAND,
  WATERMARK_DEFAULTS
} from "./config";

export type VisibleWatermarkOptions = {
  /** Show the corner URL text (SEO backlink). Default true for preview. */
  cornerUrl?: boolean;
  /** Show the center brand chip (stronger preview signal). */
  centerChip?: boolean;
  /** Override the brand text (defaults to WATERMARK_BRAND). */
  brand?: string;
};

/** Apply visible watermarks to a Sharp pipeline. Returns the same
 *  pipeline for chaining. Reads image dimensions first (Sharp needs
 *  them to size the overlays proportionally). */
export async function applyVisibleWatermarks(
  input: Buffer,
  options: VisibleWatermarkOptions = {}
): Promise<Buffer> {
  const brand = options.brand ?? WATERMARK_BRAND;
  const cornerUrl = options.cornerUrl ?? true;
  const centerChip = options.centerChip ?? false;

  const pipeline: Sharp = sharp(input);
  const meta = await pipeline.metadata();
  const width = meta.width ?? 1000;
  const height = meta.height ?? 1000;
  const shorterEdge = Math.min(width, height);

  const overlays: OverlayOptions[] = [];

  if (cornerUrl) {
    const svg = renderCornerUrlSvg(brand, width, height, shorterEdge);
    overlays.push({
      input: Buffer.from(svg),
      top: 0,
      left: 0
    });
  }

  if (centerChip) {
    const svg = renderCenterChipSvg(brand, width, height, shorterEdge);
    overlays.push({
      input: Buffer.from(svg),
      top: 0,
      left: 0
    });
  }

  if (overlays.length === 0) {
    return input;
  }

  return await pipeline.composite(overlays).png().toBuffer();
}

/** Corner URL SVG — text sits in the bottom-right with a soft
 *  shadow that survives on both light and dark backgrounds. */
function renderCornerUrlSvg(
  brand: string,
  width: number,
  height: number,
  shorterEdge: number
): string {
  const fontSize = Math.max(
    10,
    Math.round(shorterEdge * WATERMARK_DEFAULTS.cornerFontRatio)
  );
  const padding = Math.round(shorterEdge * WATERMARK_DEFAULTS.cornerPaddingRatio);
  const shadowOffset = Math.max(1, Math.round(fontSize * 0.08));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <filter id="softshadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="${Math.max(
          1,
          fontSize * 0.05
        )}" />
        <feOffset dx="${shadowOffset}" dy="${shadowOffset}" result="offsetblur" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="${WATERMARK_DEFAULTS.cornerShadowOpacity}" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <text
      x="${width - padding}"
      y="${height - padding}"
      font-family="Helvetica, Arial, sans-serif"
      font-weight="600"
      font-size="${fontSize}"
      fill="${WATERMARK_DEFAULTS.cornerFillHex}"
      fill-opacity="${WATERMARK_DEFAULTS.cornerTextOpacity}"
      text-anchor="end"
      filter="url(#softshadow)"
    >${escapeXml(brand)}</text>
  </svg>`;
}

/** Center brand chip SVG — a soft circular halo with the brand text
 *  centred inside. 15% opacity by default so it's clearly a preview
 *  signal without dominating the composition. */
function renderCenterChipSvg(
  brand: string,
  width: number,
  height: number,
  shorterEdge: number
): string {
  const diameter = Math.round(
    shorterEdge * WATERMARK_DEFAULTS.centerChipDiameterRatio
  );
  const radius = Math.round(diameter / 2);
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  const fontSize = Math.max(11, Math.round(diameter * 0.14));
  const opacity = WATERMARK_DEFAULTS.centerChipOpacity;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g opacity="${opacity}">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="white" stroke="white" stroke-width="${Math.max(
        1,
        radius * 0.02
      )}" />
      <text
        x="${cx}"
        y="${cy + fontSize / 3}"
        font-family="Helvetica, Arial, sans-serif"
        font-weight="700"
        font-size="${fontSize}"
        fill="black"
        text-anchor="middle"
      >${escapeXml(brand.toUpperCase())}</text>
    </g>
  </svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
