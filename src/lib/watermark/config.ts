// Watermark configuration — single source of truth for brand + URL
// values used across every watermark layer.
//
// Change these constants and every image processed by the pipeline
// picks up the new brand automatically. Keeps visible marks + metadata
// + steganography aligned so a stolen image always ties back to us.

export const WATERMARK_BRAND = "xratedtrades.com";
export const WATERMARK_URL_BASE = "https://xratedtrades.com/i";
export const WATERMARK_COPYRIGHT = "© xratedtrades.com — All rights reserved";
export const WATERMARK_LICENSE_TERMS_URL =
  "https://xratedtrades.com/image-licence-terms";

/** Watermark tier — decides which layers apply.
 *
 *  preview: visible corner URL + center chip + metadata + steganography
 *  standard: metadata + steganography (no visible marks — merchant paid)
 *  clean:   nothing (only for full-buyout owners) */
export type WatermarkTier = "preview" | "standard" | "clean";

/** Server-side pipeline defaults. Feel free to tweak per-image via the
 *  pipeline options — these are the safe defaults. */
export const WATERMARK_DEFAULTS = {
  /** Corner text size as a fraction of the shorter edge. 10-12px at
   *  1000px equals ~1%. */
  cornerFontRatio: 0.018,
  /** Corner text colour + shadow. White text on soft dark shadow reads
   *  on any background without dominating. */
  cornerFillHex: "#FFFFFF",
  cornerShadowHex: "#000000",
  cornerShadowOpacity: 0.55,
  cornerTextOpacity: 0.85,
  /** Center brand chip — for preview tier only. 15% opacity keeps the
   *  image readable but leaves a durable brand impression. */
  centerChipOpacity: 0.15,
  centerChipDiameterRatio: 0.22, // 22% of shorter edge
  /** Padding from edge for corner mark, as fraction of shorter edge. */
  cornerPaddingRatio: 0.02
};
