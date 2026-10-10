// src/lib/nex/create-banners/sandbox/composition-v2/typography-engine.ts
//
// NEX Composition Engineering Wave · dynamic typography auto-fit
// ==============================================================
// Word-boundary-aware wrapping + binary-search auto-fit. No third-party
// AI. No external service. Deterministic.
//
// Font metrics use a conservative approximation (0.55 × font-size for
// average glyph width) tuned for sans-serif at display weights. Real
// text measurement inside Sharp SVG rendering is impractical without
// spinning up a headless browser · this approximation is good enough
// for layout-decision purposes and produces the correct outcome for the
// vast majority of practical headlines.

import type { TypographyPlan } from "./types";

export interface AutoFitInput {
  readonly text: string;
  readonly available_width_px: number;
  readonly available_height_px: number;
  readonly font_family: string;
  readonly font_weight: number;
  readonly min_font_size_px: number;
  readonly max_font_size_px: number;
  readonly line_height_ratio: number; // e.g. 1.15
  readonly max_lines?: number; // default 3
  // When true, disable word-boundary wrapping and shrink the font so the
  // ENTIRE text fits on a single line within available_width_px. Used for
  // CTA buttons, eyebrows and other one-line elements where dropping
  // trailing words is unacceptable.
  readonly no_wrap?: boolean;
}

const DEFAULT_MAX_LINES = 3;
const AVG_GLYPH_WIDTH_RATIO_BY_WEIGHT: Record<number, number> = {
  300: 0.5,
  400: 0.53,
  500: 0.55,
  600: 0.57,
  700: 0.6,
  800: 0.62,
  900: 0.64,
};

function glyphWidthRatio(weight: number): number {
  const keys = Object.keys(AVG_GLYPH_WIDTH_RATIO_BY_WEIGHT).map(Number);
  let best = keys[0]!;
  let best_diff = Math.abs(keys[0]! - weight);
  for (const k of keys) {
    const d = Math.abs(k - weight);
    if (d < best_diff) {
      best = k;
      best_diff = d;
    }
  }
  return AVG_GLYPH_WIDTH_RATIO_BY_WEIGHT[best]!;
}

function measureLineWidth(text: string, fontSizePx: number, weight: number): number {
  const ratio = glyphWidthRatio(weight);
  return text.length * fontSizePx * ratio;
}

/**
 * Wrap a string at word boundaries so that no line exceeds availableWidth
 * at the given fontSize. Never breaks mid-word (unless a single word is
 * itself wider than the available width — in that case it is kept whole
 * and the caller sees overflow).
 */
export function wrapAtWordBoundaries(
  text: string,
  fontSizePx: number,
  weight: number,
  availableWidth: number
): readonly string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const candidate = current + " " + words[i]!;
    const w = measureLineWidth(candidate, fontSizePx, weight);
    if (w <= availableWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Binary search for the largest font size that fits within the available
 * region using word-boundary wrapping · while respecting min/max font
 * sizes and max lines. Returns a TypographyPlan describing the outcome
 * (including `overflow=true` if the text cannot fit even at min font
 * size).
 */
export function autoFitTypography(input: AutoFitInput): TypographyPlan {
  const max_lines = input.no_wrap ? 1 : input.max_lines ?? DEFAULT_MAX_LINES;
  let lo = input.min_font_size_px;
  let hi = input.max_font_size_px;
  let best: TypographyPlan | null = null;

  const attempt = (fs: number): TypographyPlan => {
    // In no_wrap mode we NEVER break the text — measure it as one line and
    // let the fit check drive the font size down until the whole string
    // fits horizontally. This prevents callers that only render lines[0]
    // (e.g. CTA button) from silently dropping trailing words.
    const wrapped = input.no_wrap
      ? [input.text.replace(/\s+/g, " ").trim()]
      : wrapAtWordBoundaries(
          input.text,
          fs,
          input.font_weight,
          input.available_width_px
        );
    const line_h = Math.round(fs * input.line_height_ratio);
    const total_h = wrapped.length * line_h;
    const max_line_w = wrapped.reduce(
      (m, line) =>
        Math.max(m, measureLineWidth(line, fs, input.font_weight)),
      0
    );
    const fits =
      wrapped.length <= max_lines &&
      total_h <= input.available_height_px &&
      max_line_w <= input.available_width_px;
    return {
      font_family: input.font_family,
      font_weight: input.font_weight,
      font_size_px: fs,
      line_height_px: line_h,
      wrapped_lines: wrapped,
      measured_width_px: Math.round(max_line_w),
      measured_height_px: Math.round(total_h),
      overflow: !fits,
    };
  };

  for (let iter = 0; iter < 18 && hi - lo > 0.5; iter++) {
    const mid = (lo + hi) / 2;
    const plan = attempt(mid);
    if (!plan.overflow) {
      best = plan;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  if (best) return best;
  // Nothing fits; return the plan at min font size (overflow=true).
  return attempt(input.min_font_size_px);
}

/**
 * Choose a reasonable minimum font size for a given format height, so
 * small formats don't accept unreadably tiny text.
 */
export function formatMinFontPx(formatHeightPx: number): number {
  return Math.max(14, Math.round(formatHeightPx * 0.025));
}
