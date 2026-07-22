// Stage 4 · Brand Injection.
// Reads BrandRecord + turns each section into an IR-shaped block the
// downstream stages consume. Deterministic. No AI. Per V3 Q13.

import type { BrandRecord } from "@/lib/design/brand/schema";
import type { ColourIntent, TypographyIntent } from "../ir";

/** Extract a ColourIntent from a BrandRecord's palette. */
export function extractColour(brand: BrandRecord): ColourIntent {
  return {
    primary:   brand.colour.primary,
    secondary: brand.colour.secondary,
    accent:    brand.colour.accent,
    split_pct: { body: 75, graphics: 20, accent: 5 }
  };
}

/** Extract a TypographyIntent. Maps BrandRecord font strings to the
 *  aesthetic bucket the DIL Typography module understands. */
export function extractTypography(brand: BrandRecord): TypographyIntent {
  const heading = brand.typography.primary;
  return {
    aesthetic:        aestheticFromFont(heading),
    primary_family:   heading,
    secondary_family: brand.typography.secondary
  };
}

function aestheticFromFont(font: string): TypographyIntent["aesthetic"] {
  const luxury      = ["Helvetica", "Avenir", "Gilroy", "TT Norms", "Manrope"];
  const industrial  = ["DIN", "Eurostile", "Roboto Condensed"];
  const traditional = ["Trajan", "Cormorant", "Playfair"];
  const f = font.toLowerCase();
  if (luxury.some((n)      => f.includes(n.toLowerCase()))) return "luxury";
  if (industrial.some((n)  => f.includes(n.toLowerCase()))) return "industrial";
  if (traditional.some((n) => f.includes(n.toLowerCase()))) return "traditional";
  return "modern";
}

/** Extract the business tuple that gets rendered as prompt text. */
export function extractBusiness(brand: BrandRecord): {
  name: string; tagline: string; phone: string; website: string; services: string[]
} {
  return {
    name:     brand.name,
    tagline:  brand.tagline ?? "",
    phone:    "",   // populated by SDS from merchant record — brand doesn't own contact
    website:  "",
    services: brand.services.slice(0, 6)
  };
}
