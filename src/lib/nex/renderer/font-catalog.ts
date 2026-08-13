// Font Catalog · comprehensive typography system for banner text roles.
//
// Philip 2026-08-04: "Add the fonts for the image creation styles of text and
// banner text types."
//
// 11 text roles × 6 brand personalities → resolved font family + weight + size +
// letter spacing + line height + transform + fallback stack. Every banner
// generation call resolves through this catalog · never invents font choices.
//
// Doctrine: docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md

import type { BrandPersonality } from "./types";

export type TextRole =
  | "display"                            // massive campaign hero text
  | "headline"                           // primary banner headline
  | "sub_headline"                       // supporting headline
  | "sub_sub_headline"                   // tertiary support
  | "body"                               // paragraph copy
  | "caption"                            // small explanatory text
  | "cta"                                // call-to-action button label
  | "feature_list_item"                  // bullet items
  | "contact_line"                       // phone · website · email
  | "badge"                              // discount · new · limited
  | "testimonial_quote";                 // quoted customer voice

export type FontStyle = {
  family: string;
  fallback_stack: readonly string[];
  weight: number;
  size_px: number;                       // default size at 1200×628 canvas
  size_ratio_to_headline?: number;       // preferred ratio for auto-scaling
  letter_spacing: string;                // e.g. "-0.02em" · "0.06em"
  line_height: number;                   // multiplier
  transform: "none" | "uppercase" | "lowercase" | "capitalize";
};

// ─── Font family constants ────────────────────────────────────────────────

const SANS_FALLBACK = ["Inter", "Helvetica Neue", "Arial", "sans-serif"] as const;
const SERIF_FALLBACK = ["Georgia", "Times New Roman", "serif"] as const;
const CONDENSED_FALLBACK = ["Oswald", "Arial Narrow", "sans-serif"] as const;
const MONOSPACE_FALLBACK = ["JetBrains Mono", "Menlo", "Consolas", "monospace"] as const;

// ─── The catalog · TextRole × BrandPersonality → FontStyle ────────────────

const CATALOG: Record<BrandPersonality, Record<TextRole, FontStyle>> = {

  luxury: {
    display: { family: "Fraunces", fallback_stack: [...SERIF_FALLBACK], weight: 500, size_px: 92, letter_spacing: "-0.02em", line_height: 1.05, transform: "none" },
    headline: { family: "Playfair Display", fallback_stack: [...SERIF_FALLBACK], weight: 700, size_px: 56, letter_spacing: "-0.015em", line_height: 1.1, transform: "none" },
    sub_headline: { family: "Cormorant Garamond", fallback_stack: [...SERIF_FALLBACK], weight: 500, size_px: 28, size_ratio_to_headline: 0.50, letter_spacing: "0em", line_height: 1.3, transform: "none" },
    sub_sub_headline: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 400, size_px: 20, size_ratio_to_headline: 0.36, letter_spacing: "0.04em", line_height: 1.4, transform: "uppercase" },
    body: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 300, size_px: 16, letter_spacing: "0em", line_height: 1.6, transform: "none" },
    caption: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 400, size_px: 12, letter_spacing: "0.06em", line_height: 1.4, transform: "uppercase" },
    cta: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 600, size_px: 18, letter_spacing: "0.08em", line_height: 1, transform: "none" },
    feature_list_item: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 400, size_px: 16, letter_spacing: "0em", line_height: 1.5, transform: "none" },
    contact_line: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 15, letter_spacing: "0.02em", line_height: 1.4, transform: "none" },
    badge: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 700, size_px: 12, letter_spacing: "0.10em", line_height: 1, transform: "uppercase" },
    testimonial_quote: { family: "Cormorant Garamond", fallback_stack: [...SERIF_FALLBACK], weight: 400, size_px: 22, letter_spacing: "0em", line_height: 1.5, transform: "none" },
  },

  professional: {
    display: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 800, size_px: 88, letter_spacing: "-0.015em", line_height: 1.05, transform: "none" },
    headline: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 700, size_px: 52, letter_spacing: "-0.01em", line_height: 1.15, transform: "none" },
    sub_headline: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 24, size_ratio_to_headline: 0.46, letter_spacing: "0em", line_height: 1.35, transform: "none" },
    sub_sub_headline: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 18, size_ratio_to_headline: 0.35, letter_spacing: "0.02em", line_height: 1.4, transform: "none" },
    body: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 400, size_px: 16, letter_spacing: "0em", line_height: 1.5, transform: "none" },
    caption: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 12, letter_spacing: "0.04em", line_height: 1.35, transform: "uppercase" },
    cta: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 700, size_px: 20, letter_spacing: "0.03em", line_height: 1, transform: "none" },
    feature_list_item: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 17, letter_spacing: "0em", line_height: 1.5, transform: "none" },
    contact_line: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 600, size_px: 16, letter_spacing: "0em", line_height: 1.4, transform: "none" },
    badge: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 700, size_px: 13, letter_spacing: "0.06em", line_height: 1, transform: "uppercase" },
    testimonial_quote: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 400, size_px: 20, letter_spacing: "0em", line_height: 1.5, transform: "none" },
  },

  sales_event: {
    display: { family: "Bebas Neue", fallback_stack: [...CONDENSED_FALLBACK], weight: 700, size_px: 128, letter_spacing: "0.02em", line_height: 0.95, transform: "uppercase" },
    headline: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 900, size_px: 72, letter_spacing: "-0.01em", line_height: 1.05, transform: "uppercase" },
    sub_headline: { family: "Oswald", fallback_stack: [...CONDENSED_FALLBACK], weight: 600, size_px: 32, size_ratio_to_headline: 0.44, letter_spacing: "0.02em", line_height: 1.2, transform: "uppercase" },
    sub_sub_headline: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 700, size_px: 20, size_ratio_to_headline: 0.28, letter_spacing: "0.04em", line_height: 1.3, transform: "uppercase" },
    body: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 17, letter_spacing: "0em", line_height: 1.4, transform: "none" },
    caption: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 600, size_px: 13, letter_spacing: "0.06em", line_height: 1.3, transform: "uppercase" },
    cta: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 900, size_px: 24, letter_spacing: "0.06em", line_height: 1, transform: "uppercase" },
    feature_list_item: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 600, size_px: 18, letter_spacing: "0em", line_height: 1.4, transform: "none" },
    contact_line: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 700, size_px: 18, letter_spacing: "0.02em", line_height: 1.3, transform: "none" },
    badge: { family: "Bebas Neue", fallback_stack: [...CONDENSED_FALLBACK], weight: 700, size_px: 22, letter_spacing: "0.08em", line_height: 1, transform: "uppercase" },
    testimonial_quote: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 20, letter_spacing: "0em", line_height: 1.4, transform: "none" },
  },

  family: {
    display: { family: "Poppins", fallback_stack: [...SANS_FALLBACK], weight: 700, size_px: 84, letter_spacing: "-0.01em", line_height: 1.1, transform: "none" },
    headline: { family: "Poppins", fallback_stack: [...SANS_FALLBACK], weight: 700, size_px: 52, letter_spacing: "-0.005em", line_height: 1.15, transform: "none" },
    sub_headline: { family: "Poppins", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 26, size_ratio_to_headline: 0.50, letter_spacing: "0em", line_height: 1.35, transform: "none" },
    sub_sub_headline: { family: "Lora", fallback_stack: [...SERIF_FALLBACK], weight: 500, size_px: 20, size_ratio_to_headline: 0.38, letter_spacing: "0em", line_height: 1.4, transform: "none" },
    body: { family: "Lora", fallback_stack: [...SERIF_FALLBACK], weight: 400, size_px: 17, letter_spacing: "0em", line_height: 1.6, transform: "none" },
    caption: { family: "Poppins", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 13, letter_spacing: "0.02em", line_height: 1.35, transform: "none" },
    cta: { family: "Poppins", fallback_stack: [...SANS_FALLBACK], weight: 600, size_px: 20, letter_spacing: "0.03em", line_height: 1, transform: "none" },
    feature_list_item: { family: "Poppins", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 17, letter_spacing: "0em", line_height: 1.5, transform: "none" },
    contact_line: { family: "Poppins", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 16, letter_spacing: "0em", line_height: 1.4, transform: "none" },
    badge: { family: "Poppins", fallback_stack: [...SANS_FALLBACK], weight: 700, size_px: 12, letter_spacing: "0.06em", line_height: 1, transform: "uppercase" },
    testimonial_quote: { family: "Lora", fallback_stack: [...SERIF_FALLBACK], weight: 400, size_px: 21, letter_spacing: "0em", line_height: 1.55, transform: "none" },
  },

  heritage: {
    display: { family: "DM Serif Display", fallback_stack: [...SERIF_FALLBACK], weight: 400, size_px: 92, letter_spacing: "-0.02em", line_height: 1.05, transform: "none" },
    headline: { family: "Playfair Display", fallback_stack: [...SERIF_FALLBACK], weight: 700, size_px: 52, letter_spacing: "-0.01em", line_height: 1.1, transform: "none" },
    sub_headline: { family: "Merriweather", fallback_stack: [...SERIF_FALLBACK], weight: 400, size_px: 24, size_ratio_to_headline: 0.46, letter_spacing: "0em", line_height: 1.35, transform: "none" },
    sub_sub_headline: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 400, size_px: 18, size_ratio_to_headline: 0.34, letter_spacing: "0.06em", line_height: 1.4, transform: "uppercase" },
    body: { family: "Merriweather", fallback_stack: [...SERIF_FALLBACK], weight: 400, size_px: 15, letter_spacing: "0em", line_height: 1.7, transform: "none" },
    caption: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 400, size_px: 12, letter_spacing: "0.10em", line_height: 1.4, transform: "uppercase" },
    cta: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 18, letter_spacing: "0.10em", line_height: 1, transform: "uppercase" },
    feature_list_item: { family: "Merriweather", fallback_stack: [...SERIF_FALLBACK], weight: 400, size_px: 16, letter_spacing: "0em", line_height: 1.55, transform: "none" },
    contact_line: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 15, letter_spacing: "0.04em", line_height: 1.4, transform: "none" },
    badge: { family: "Montserrat", fallback_stack: [...SANS_FALLBACK], weight: 600, size_px: 11, letter_spacing: "0.14em", line_height: 1, transform: "uppercase" },
    testimonial_quote: { family: "Merriweather", fallback_stack: [...SERIF_FALLBACK], weight: 300, size_px: 22, letter_spacing: "0em", line_height: 1.55, transform: "none" },
  },

  lifestyle: {
    display: { family: "Space Grotesk", fallback_stack: [...SANS_FALLBACK], weight: 600, size_px: 88, letter_spacing: "-0.02em", line_height: 1.05, transform: "none" },
    headline: { family: "Space Grotesk", fallback_stack: [...SANS_FALLBACK], weight: 600, size_px: 54, letter_spacing: "-0.015em", line_height: 1.12, transform: "none" },
    sub_headline: { family: "Space Grotesk", fallback_stack: [...SANS_FALLBACK], weight: 400, size_px: 26, size_ratio_to_headline: 0.48, letter_spacing: "0em", line_height: 1.35, transform: "none" },
    sub_sub_headline: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 400, size_px: 18, size_ratio_to_headline: 0.34, letter_spacing: "0.02em", line_height: 1.4, transform: "none" },
    body: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 400, size_px: 16, letter_spacing: "0em", line_height: 1.6, transform: "none" },
    caption: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 12, letter_spacing: "0.06em", line_height: 1.4, transform: "uppercase" },
    cta: { family: "Space Grotesk", fallback_stack: [...SANS_FALLBACK], weight: 600, size_px: 19, letter_spacing: "0.04em", line_height: 1, transform: "none" },
    feature_list_item: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 400, size_px: 16, letter_spacing: "0em", line_height: 1.5, transform: "none" },
    contact_line: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 500, size_px: 15, letter_spacing: "0em", line_height: 1.4, transform: "none" },
    badge: { family: "Space Grotesk", fallback_stack: [...SANS_FALLBACK], weight: 600, size_px: 12, letter_spacing: "0.08em", line_height: 1, transform: "uppercase" },
    testimonial_quote: { family: "Inter", fallback_stack: [...SANS_FALLBACK], weight: 300, size_px: 21, letter_spacing: "0em", line_height: 1.55, transform: "none" },
  },
};

// ─── Public API ──────────────────────────────────────────────────────────

/** Resolve a font style for a given text role + personality. Falls back to
 *  professional if the personality is unknown · never throws · never guesses. */
export function resolveFontStyle(role: TextRole, personality: BrandPersonality): FontStyle {
  const personalityMap = CATALOG[personality] ?? CATALOG.professional;
  return personalityMap[role] ?? personalityMap.body;
}

/** List every distinct font family the catalog references. Used by the Asset
 *  Intelligence Platform to ensure every required family is loadable. */
export function requiredFontFamilies(): readonly string[] {
  const families = new Set<string>();
  for (const p of Object.values(CATALOG)) {
    for (const style of Object.values(p)) {
      families.add(style.family);
    }
  }
  return Array.from(families).sort();
}

/** Compose a CSS-style font-family declaration (family + fallback stack). */
export function fontFamilyStack(style: FontStyle): string {
  return [style.family, ...style.fallback_stack].map((f) => (f.includes(" ") ? `"${f}"` : f)).join(", ");
}

/** Every text role catalogued. */
export function listTextRoles(): readonly TextRole[] {
  return ["display", "headline", "sub_headline", "sub_sub_headline", "body", "caption", "cta", "feature_list_item", "contact_line", "badge", "testimonial_quote"];
}

/** Every personality catalogued. */
export function listPersonalities(): readonly BrandPersonality[] {
  return ["luxury", "professional", "sales_event", "family", "heritage", "lifestyle"];
}

// Export shape for editor autocomplete of the constant
export const FONT_FALLBACKS = {
  sans: SANS_FALLBACK,
  serif: SERIF_FALLBACK,
  condensed: CONDENSED_FALLBACK,
  monospace: MONOSPACE_FALLBACK,
} as const;
