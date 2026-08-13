// Colour Grammar · seed grammar + lookup functions.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

import type { ColourGrammarEntry, ColourMeaning } from "./types";

export const COLOUR_GRAMMAR: readonly ColourGrammarEntry[] = [
  { hue: "black", hex_examples: ["#0F0F0F", "#111111", "#1A1A1A"], meanings: ["strength", "premium", "engineering"], works_with_brand: ["industrial", "luxury", "premium"], works_with_theme_packs: ["luxury_black_gold", "industrial_black_red", "industrial_black_gold"] },
  { hue: "gold", hex_examples: ["#D4AF37", "#C9A34E"], meanings: ["luxury", "value", "premium"], works_with_brand: ["luxury", "heritage", "premium"], works_with_theme_packs: ["luxury_black_gold", "industrial_black_gold"] },
  { hue: "blue", hex_examples: ["#1E40AF", "#0057B8"], meanings: ["trust", "professional", "clean"], works_with_brand: ["modern", "corporate", "trade"], works_with_theme_packs: ["modern_blue", "corporate_grey"] },
  { hue: "green", hex_examples: ["#4A6741", "#5A7A4A"], meanings: ["eco", "nature", "home", "warmth"], works_with_brand: ["family", "eco"], works_with_theme_packs: ["nature_green", "nature_green_lifestyle"] },
  { hue: "burgundy", hex_examples: ["#5C1229", "#8B1E3F"], meanings: ["luxury", "premium", "heritage"], works_with_brand: ["luxury", "heritage"], works_with_theme_packs: ["luxury_burgundy"] },
  { hue: "red", hex_examples: ["#D32F2F", "#B71C1C"], meanings: ["urgency", "action", "sales", "strength"], works_with_brand: ["industrial", "trade"], works_with_theme_packs: ["industrial_black_red"] },
  { hue: "white", hex_examples: ["#FFFFFF", "#FAFAFA"], meanings: ["clean", "minimal", "space"], works_with_brand: ["minimal", "modern"], works_with_theme_packs: ["minimal_white", "modern_blue"] },
  { hue: "walnut_brown", hex_examples: ["#4A2E1D", "#5C4033"], meanings: ["heritage", "warmth", "traditional", "premium"], works_with_brand: ["heritage", "luxury"], works_with_theme_packs: ["heritage_walnut_cream", "traditional_brown"] },
  { hue: "cream", hex_examples: ["#F5F5DC", "#FAF3E0"], meanings: ["warmth", "heritage", "clean"], works_with_brand: ["heritage", "family"], works_with_theme_packs: ["heritage_walnut_cream", "luxury_burgundy"] },
  { hue: "teal", hex_examples: ["#0F766E", "#0D9488"], meanings: ["trust", "clean", "professional"], works_with_brand: ["modern", "corporate"], works_with_theme_packs: ["aqua_teal"] },
  { hue: "orange", hex_examples: ["#F58220", "#F97316"], meanings: ["action", "urgency", "sales", "playful"], works_with_brand: ["trade", "industrial"], works_with_theme_packs: ["industrial_orange"] },
  { hue: "purple", hex_examples: ["#6B21A8", "#7C3AED"], meanings: ["luxury", "premium", "youthful"], works_with_brand: ["luxury", "premium"], works_with_theme_packs: ["premium_purple"] },
];

export function meaningsFor(hue: string): readonly ColourMeaning[] {
  const entry = COLOUR_GRAMMAR.find((c) => c.hue === hue);
  return entry?.meanings ?? [];
}

export function huesForMeaning(meaning: ColourMeaning): readonly string[] {
  return COLOUR_GRAMMAR.filter((c) => c.meanings.includes(meaning)).map((c) => c.hue);
}

export function themePacksForMeaning(meaning: ColourMeaning): readonly string[] {
  const themes = new Set<string>();
  for (const c of COLOUR_GRAMMAR) {
    if (c.meanings.includes(meaning)) for (const t of c.works_with_theme_packs) themes.add(t);
  }
  return Array.from(themes);
}

/** Reverse lookup · e.g. "make it feel trustworthy" → find hues carrying "trust". */
export function huesFeeling(feelings: readonly ColourMeaning[]): readonly { hue: string; matched: readonly ColourMeaning[] }[] {
  return COLOUR_GRAMMAR
    .map((c) => ({ hue: c.hue, matched: c.meanings.filter((m) => feelings.includes(m)) }))
    .filter((r) => r.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length);
}

/** Convert a set of THEME PACKS (from a design) into the FEELINGS the theme communicates. */
export function feelingsFromThemePacks(themePacks: readonly string[]): readonly ColourMeaning[] {
  const feelings = new Set<ColourMeaning>();
  for (const t of themePacks) {
    for (const c of COLOUR_GRAMMAR) {
      if (c.works_with_theme_packs.includes(t)) for (const m of c.meanings) feelings.add(m);
    }
  }
  return Array.from(feelings);
}

export function count(): number { return COLOUR_GRAMMAR.length; }
