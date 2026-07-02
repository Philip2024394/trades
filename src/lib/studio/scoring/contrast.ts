// WCAG contrast utilities.
//
// Pure, client-safe. Feeds Module 15's scoreAccessibility heuristic
// AND the Module 16 brand-extraction preview (which flags candidate
// colour pairs that would fail contrast before the merchant applies).
//
// Reference: WCAG 2.1, section 1.4.3. AA text ≥ 4.5:1 for body,
// ≥ 3:1 for large text. AAA raises those to 7:1 and 4.5:1.

const HEX_RE = /^#([0-9A-Fa-f]{6})$/;

function parseHex(hex: string): [number, number, number] | null {
  const m = HEX_RE.exec(hex.trim());
  if (!m) return null;
  const num = parseInt(m[1], 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Relative luminance per WCAG. Value in [0, 1]. */
function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colours per WCAG. Returns 0 for
 *  malformed input so callers can treat it as "unknown, skip". */
export function contrastRatio(fg: string, bg: string): number {
  const fgRgb = parseHex(fg);
  const bgRgb = parseHex(bg);
  if (!fgRgb || !bgRgb) return 0;
  const l1 = luminance(fgRgb);
  const l2 = luminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastGrade = "AAA" | "AA" | "AA-large" | "fail";

export function gradeContrast(ratio: number): ContrastGrade {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "fail";
}

/** Human label for the modal. */
export function contrastLabel(ratio: number): string {
  if (ratio <= 0) return "?";
  return `${ratio.toFixed(2)}:1`;
}
