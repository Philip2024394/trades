// WCAG 2.1 contrast checker.
//
// Used to check whether a merchant's hero text remains readable
// against their chosen image + edits. If the ratio drops below 4.5
// the suggestion engine flags a better preset.

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** WCAG contrast ratio between two hex colours. Returns 1.0–21.0. */
export function contrastRatio(hex1: string, hex2: string): number {
  const L1 = relativeLuminance(hexToRgb(hex1));
  const L2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA passes at 4.5 for normal text, 3.0 for large text. */
export const WCAG_AA_NORMAL = 4.5;
export const WCAG_AA_LARGE = 3.0;

/** Approximate the effective background colour a merchant's hero text
 *  sits over — a mix of the image's dominant text-zone palette colour
 *  and the applied vignette + brightness edits. */
export function estimateEffectiveBackground(
  paletteColor: string,
  brightness: number,
  vignette: number
): string {
  const { r, g, b } = hexToRgb(paletteColor);
  const brightnessDelta = brightness * 2.55; // percent → 0-51 range
  const vignetteDelta = -vignette * 2; // vignette darkens edges by ~2× percent
  const adjust = (v: number) =>
    Math.max(0, Math.min(255, v + brightnessDelta + vignetteDelta));
  const rr = Math.round(adjust(r));
  const gg = Math.round(adjust(g));
  const bb = Math.round(adjust(b));
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}
