// Auto-contrast tuner.
//
// Given a foreground and background colour, returns the nearest ink
// choice that meets WCAG AA (default 4.5:1). Deterministic, pure — no
// I/O, no framework deps — so it's safe to run per-render.
//
// The tuner never modifies the background. Background is the merchant's
// brand token. We only tune the INK to preserve brand identity.
//
// Also exports the raw WCAG contrast ratio calculator so the score
// engine and the toolbar contrast chip share one implementation.

// ─── Public API ──────────────────────────────────────────────

/** Return the nearest ink colour that hits the target contrast. Prefers
 *  the requested `ink` if it already passes. Otherwise picks the better
 *  of pure black / pure white. */
export function autoTuneInk(
  ink: string,
  background: string,
  targetRatio = 4.5
): { ink: string; ratio: number; tuned: boolean } {
  const bg = parseColour(background);
  const requested = parseColour(ink);
  if (!bg || !requested) {
    return { ink, ratio: 1, tuned: false };
  }
  const currentRatio = contrastRatio(requested, bg);
  if (currentRatio >= targetRatio) {
    return { ink, ratio: currentRatio, tuned: false };
  }
  const blackRatio = contrastRatio({ r: 0, g: 0, b: 0 }, bg);
  const whiteRatio = contrastRatio({ r: 255, g: 255, b: 255 }, bg);
  if (blackRatio >= whiteRatio) {
    return { ink: "#0A0A0A", ratio: blackRatio, tuned: true };
  }
  return { ink: "#FFFFFF", ratio: whiteRatio, tuned: true };
}

/** WCAG 2.1 contrast ratio between two colours. Range 1..21. */
export function contrastRatioOf(a: string, b: string): number {
  const rgbA = parseColour(a);
  const rgbB = parseColour(b);
  if (!rgbA || !rgbB) return 1;
  return contrastRatio(rgbA, rgbB);
}

/** True if the pair meets the given target. Convenience for score
 *  engines that just want a boolean. */
export function meetsContrast(
  a: string,
  b: string,
  target = 4.5
): boolean {
  return contrastRatioOf(a, b) >= target;
}

// ─── Tap-target enforcement ─────────────────────────────────

/** Returns a warning payload when a size falls below the required
 *  minimum tap target. Renderers can splat this into a chip shown in
 *  edit mode only. */
export function checkTapTarget(
  actualPx: number,
  minPx = 44
): { ok: boolean; actualPx: number; minPx: number; shortByPx: number } {
  const shortByPx = Math.max(0, minPx - actualPx);
  return { ok: shortByPx === 0, actualPx, minPx, shortByPx };
}

// ─── Internals ──────────────────────────────────────────────

type RGB = { r: number; g: number; b: number };

/** Accept `#rgb`, `#rrggbb`, `rgb(...)`, `rgba(...)`. Returns null for
 *  anything else (named colours, linear-gradient, hsl etc.). */
function parseColour(input: string): RGB | null {
  const s = input.trim();
  if (s.startsWith("#")) {
    if (s.length === 4) {
      const r = parseInt(s[1] + s[1], 16);
      const g = parseInt(s[2] + s[2], 16);
      const b = parseInt(s[3] + s[3], 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      return { r, g, b };
    }
    if (s.length === 7 || s.length === 9) {
      const r = parseInt(s.slice(1, 3), 16);
      const g = parseInt(s.slice(3, 5), 16);
      const b = parseInt(s.slice(5, 7), 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      return { r, g, b };
    }
    return null;
  }
  const m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const parts = m[1].split(",").map((p) => p.trim());
    const r = parseInt(parts[0], 10);
    const g = parseInt(parts[1], 10);
    const b = parseInt(parts[2], 10);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  return null;
}

/** sRGB relative luminance per WCAG. */
function luminance({ r, g, b }: RGB): number {
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
