// Colour Grammar · types (Philip 2026-08-04).
//
// Store the SEMANTIC PURPOSE of every colour · not just the hex value.
// Future campaigns can request "make it feel trustworthy" instead of #0057B8.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

export type ColourMeaning =
  | "strength" | "premium" | "engineering"
  | "luxury" | "value" | "warmth"
  | "trust" | "professional"
  | "eco" | "nature" | "home"
  | "urgency" | "action" | "sales"
  | "clean" | "minimal" | "space"
  | "playful" | "youthful"
  | "heritage" | "traditional";

export type ColourGrammarEntry = {
  hue: string;                             // canonical hue label · e.g. "black" · "gold" · "blue"
  hex_examples: readonly string[];         // representative hex values
  meanings: readonly ColourMeaning[];      // semantic purposes this hue carries
  works_with_brand: readonly string[];     // BrandArchetype ids
  works_with_theme_packs: readonly string[]; // renderer/tokens.ts theme pack ids
  notes?: string;
};
