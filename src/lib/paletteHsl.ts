// HSL palette generator — the "modern simple" replacement for
// the 20 hardcoded named palettes.
//
// Given the merchant's chosen base_hue + lightness + intensity +
// mode, this function computes a full PaletteTokens object live.
// No named palettes; every merchant's canteen renders from three
// numbers.
//
// Design rationale (Philip 2026-07-17): the picker shows 8 base
// hue chips and one lightness slider. Combined = infinite palette
// variance without the visual noise of 20 pre-baked swatches. This
// module contains ONLY the computation — the picker UI + storage
// live elsewhere.

import type { PaletteTokens } from "./paletteTokens";

export type BaseHue =
  | "yellow"
  | "orange"
  | "red"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "neutral";

export type Intensity = "bold" | "standard" | "subtle";
export type Mode = "light" | "dark";

/** HSL hue (0-360) + base saturation (0-100) for each hue chip.
 *  These are the identity anchors; the merchant's lightness slider
 *  shifts around these anchors to generate the accent hex. */
const HUE_ANCHORS: Record<BaseHue, { h: number; s: number; displayName: string }> = {
  yellow:  { h:  45, s: 92, displayName: "Yellow"  },
  orange:  { h:  25, s: 88, displayName: "Orange"  },
  red:     { h:   5, s: 78, displayName: "Red"     },
  green:   { h: 130, s: 55, displayName: "Green"   },
  teal:    { h: 180, s: 60, displayName: "Teal"    },
  blue:    { h: 215, s: 70, displayName: "Blue"    },
  purple:  { h: 275, s: 55, displayName: "Purple"  },
  neutral: { h:   0, s:  0, displayName: "Neutral" }
};

export const BASE_HUES: readonly BaseHue[] = [
  "yellow", "orange", "red", "green", "teal", "blue", "purple", "neutral"
];

/** Per-hue minimum lightness — where each hue bottoms out as its
 *  deepest still-recognisable form. Yellow becomes brown/black
 *  below ~L38 (looks broken); red / blue / green / purple can
 *  safely go to L18-22 (oxblood / navy / forest / royal purple).
 *  Neutral can go all the way to near-black.
 *
 *  Fixes the "picked yellow, got black at deep" bug (Philip 2026-07-17):
 *  the slider now maps 0→top (L88) to 100→per-hue floor, so every hue
 *  reaches its own true deepest form at slider 100 rather than a
 *  one-size-fits-all L18. */
const HUE_MIN_L: Record<BaseHue, number> = {
  yellow:  38,
  orange:  28,
  red:     22,
  green:   20,
  teal:    22,
  blue:    22,
  purple:  22,
  neutral: 12
};

export function hueDisplayName(hue: BaseHue): string {
  return HUE_ANCHORS[hue].displayName;
}

/** Accent-preview hex for the picker chip (mid-saturation, mid-
 *  lightness of the hue). Independent of any merchant selection —
 *  this is just the anchor colour the user sees on the swatch. */
export function hueChipHex(hue: BaseHue): string {
  const a = HUE_ANCHORS[hue];
  // Purple / neutral read washed at L=50, so bump.
  const l = hue === "yellow" ? 52 : hue === "neutral" ? 40 : 48;
  return hslToHex(a.h, a.s, l);
}

/** Compute the accent hex for a hue at any lightness. Powers the
 *  live gradient rendered under the Lightness slider so the user
 *  sees the transition as they drag. */
export function accentAtLightness(hue: BaseHue, lightness: number, intensity: Intensity = "standard"): string {
  const anchor = HUE_ANCHORS[hue];
  const satMult = intensity === "bold" ? 1.15 : intensity === "subtle" ? 0.55 : 1.0;
  const baseSat = Math.max(0, Math.min(100, anchor.s * satMult));
  const t = Math.max(0, Math.min(100, lightness)) / 100;
  // Per-hue lightness range (Philip 2026-07-17): slider 0 = top of
  // scale L=88 (pale wash), slider 100 = per-hue floor from HUE_MIN_L
  // (yellow bottoms at gold not brown; green bottoms at forest;
  // neutral bottoms near black). Ensures every hue reaches ITS
  // true deep form without going muddy.
  const minL = HUE_MIN_L[hue];
  const s = baseSat * (0.25 + 0.75 * t);
  const l = 88 - ((88 - minL) * t);
  return hslToHex(anchor.h, s, l);
}

// ─── HSL <-> HEX ─────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => {
    const c = L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ─── Public API ──────────────────────────────────────────────

/** Generate a full PaletteTokens object from HSL inputs.
 *
 *  Behaviour:
 *   • accent = hue at merchant's lightness (shifted for legibility)
 *   • bg     = very light in light mode / near-black in dark mode
 *              (still tinted by hue for a "warm cream" vs "cool
 *              cream" feel — never pure white)
 *   • text   = high-contrast to bg (dark on light, light on dark)
 *   • heroLastWord + chip = same as accent (H1 accent word colour)
 *
 *  Intensity multiplies saturation:
 *   • bold     = 1.15× (more vivid)
 *   • standard = 1.00× (as-is)
 *   • subtle   = 0.55× (softer)
 */
export function generatePalette({
  hue,
  lightness,
  intensity = "standard",
  mode = "light"
}: {
  hue: BaseHue;
  lightness: number;         // 0-100 (0 = washed / pale, 100 = pure solid identity)
  intensity?: Intensity;
  mode?: Mode;
}): PaletteTokens {
  const anchor = HUE_ANCHORS[hue];
  const satMult = intensity === "bold" ? 1.15 : intensity === "subtle" ? 0.55 : 1.0;
  const baseSat = Math.max(0, Math.min(100, anchor.s * satMult));

  // Slider mapping (Philip 2026-07-17): 100 = pure solid anchor
  // colour (S=full, L=~50), 0 = pale wash of same hue (S≈15,
  // L≈88 — near-cream with a tint). Reduces IN BOTH sat and
  // lightness-shift so the user visibly sees the colour "fade
  // toward light" as they drag left.
  // Per-hue lightness range (Philip 2026-07-17). Slider 0 = L88
  // (pale wash), slider 100 = per-hue floor from HUE_MIN_L. Yellow
  // bottoms at gold not brown; green bottoms at forest; neutral
  // bottoms near black. See accentAtLightness above.
  const minL = HUE_MIN_L[hue];
  const t = Math.max(0, Math.min(100, lightness)) / 100; // 0..1 (1 = deep)
  const accentSat = baseSat * (0.25 + 0.75 * t); // 25%..100% of base sat
  const accentL   = 88 - ((88 - minL) * t);      // L 88 (pale) at t=0 → per-hue min at t=1
  const accentHex = hslToHex(anchor.h, accentSat, accentL);

  // Bg — very washed tint of the hue. Light mode = pale, near cream;
  // dark mode = near-black with slight tint. Neutral hue produces
  // pure grey.
  const bgSat = Math.min(anchor.s, 12);
  const bgL   = mode === "dark" ? 6  : 96;
  const bgHex = hslToHex(anchor.h, bgSat, bgL);

  // Text — high contrast to bg. Slight warmth from the hue for
  // brand cohesion (dark ink in light mode, near-cream in dark
  // mode). Neutral produces pure black / white.
  const textL   = mode === "dark" ? 95 : 12;
  const textSat = Math.min(anchor.s, 8);
  const textHex = hslToHex(anchor.h, textSat, textL);

  // Muted text — 3-step gap from text.
  const mutedL   = mode === "dark" ? 65 : 42;
  const mutedSat = Math.min(anchor.s, 10);
  const mutedHex = hslToHex(anchor.h, mutedSat, mutedL);

  return {
    slug:         "hsl-generated",
    displayName:  `${anchor.displayName} · L${Math.round(lightness)}`,
    bg:           bgHex,
    text:         textHex,
    accent:       accentHex,
    mutedText:    mutedHex,
    heroLastWord: accentHex,
    chip:         accentHex,
    dark:         mode === "dark"
  };
}
