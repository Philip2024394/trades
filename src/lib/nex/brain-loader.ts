// Brain loader — discovers Business Brains registered in the platform
// and exposes a lightweight registry for the Intent Router + UI.
//
// V1 registry is a static in-memory list bootstrapped from the existing
// trade config loader. This preserves compatibility with the current
// staircase content while establishing the "brains as first-class
// objects" pattern the Platform architecture requires.
//
// V2 will scan the filesystem for brains/<slug>/brain.json entries at
// boot and auto-register them without code changes. The public API
// (listAvailableBrains + getBrain) is stable across both versions.

import { listAvailableTrades, loadTradeConfig } from "@/lib/nex-apps/_config-loader";

export type BrainDescriptor = {
  slug:        string;               // "staircase" · "plumbing" · etc.
  name:        string;               // "Nex Staircases"
  category:    string;               // "construction" · "medical" · etc.
  cluster:     string;               // "visual_sell" · "trust_sell" · etc.
  keywords:    string[];             // trigger words for the Intent Router
  route:       string;               // "/nex-app/brains/staircase"
  short_intro: string;               // one-line intro shown on the platform landing
  status:      "live" | "coming_soon";
};

// Category-level keyword map. Adds broad terms so the Router can
// classify unfamiliar phrasing into the right Brain.
const KEYWORD_HINTS: Record<string, string[]> = {
  staircase: ["staircase", "stair", "stairs", "handrail", "banister", "balustrade", "spindle", "newel", "tread", "riser", "cut string", "closed string", "winder", "loft stair", "spiral stair"],
  plumbing:  ["plumbing", "plumber", "boiler", "leak", "tap", "faucet", "pipe", "drain", "gas safe", "combi boiler", "system boiler", "radiator", "wet room"]
};

const CATEGORY_HINTS: Record<string, string> = {
  staircase: "construction",
  plumbing:  "construction",
  electrical: "construction",
  roofing:   "construction",
  carpentry: "construction"
};

// Static registry — bootstrapped from the trade config list.
// V2: replace body with filesystem scan of `brains/*/brain.json`.
export function listAvailableBrains(): BrainDescriptor[] {
  const trades = listAvailableTrades();
  return trades.map((slug) => {
    const config = loadTradeConfig(slug);
    return {
      slug,
      name:        config?.placeholder_content.merchant.business_name ?? slug,
      category:    CATEGORY_HINTS[slug] ?? "general",
      cluster:     config?.cluster ?? "visual_sell",
      keywords:    KEYWORD_HINTS[slug] ?? [slug],
      route:       `/nex-app/brains/${slug}`,
      short_intro: config?.ai_panel.subhead ?? "",
      status:      slug === "staircase" ? "live" : "coming_soon"
    };
  });
}

export function getBrain(slug: string): BrainDescriptor | null {
  return listAvailableBrains().find((b) => b.slug === slug) ?? null;
}

export function listBrainsByCategory(category: string): BrainDescriptor[] {
  return listAvailableBrains().filter((b) => b.category === category);
}

export function listCategories(): string[] {
  return [...new Set(listAvailableBrains().map((b) => b.category))];
}
