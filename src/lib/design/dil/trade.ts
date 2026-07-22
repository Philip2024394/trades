// Trade Intelligence — Module 7 per V3 Q14 + V3 Extended Q19.
// One entry per trade. Expands from tradePalettes in colours.ts.
import type { IntelligenceModule, DesignContext, DesignRule } from ".";

export const TRADE_VERSION = "1.0.0";

type TradeProfile = {
  preferred_layout:   string;
  hero_photography:   string;
  trust_elements:     string[];
  avoid_iconography:  string[];
};

const TRADE_PROFILES: Record<string, TradeProfile> = {
  "joinery": {
    preferred_layout:  "Luxury Split Panel",
    hero_photography:  "finished luxury oak staircase",
    trust_elements:    ["craftsmanship", "wood grain", "luxury homes"],
    avoid_iconography: ["hammers", "nails", "cartoons"]
  },
  "plumbing": {
    preferred_layout:  "Corporate Fleet",
    hero_photography:  "luxury bathroom vanity",
    trust_elements:    ["Gas Safe number", "24hr callout", "clean-work photo"],
    avoid_iconography: ["cartoon plunger", "cartoon pipe"]
  },
  "electrical": {
    preferred_layout:  "Bold Geometric",
    hero_photography:  "modern smart home / consumer unit",
    trust_elements:    ["NICEIC badge", "PAT tested", "part-P registered"],
    avoid_iconography: ["cartoon lightning", "cartoon plug"]
  },
  "roofing": {
    preferred_layout:  "Industrial",
    hero_photography:  "contemporary roofline",
    trust_elements:    ["insurance-approved", "10-year guarantee", "before/after"],
    avoid_iconography: ["cartoon roof"]
  }
};

export const tradeModule: IntelligenceModule = {
  id: "trade", version: TRADE_VERSION, category: "trade-fit", supports: [],
  evaluate(ctx: DesignContext): DesignRule[] {
    const profile = TRADE_PROFILES[ctx.trade];
    if (!profile) return [];
    return [{
      id: `trade.${ctx.trade}.profile`, module: "trade", version: TRADE_VERSION,
      outputs: profile as unknown as Record<string, unknown>, confidence: 1
    }];
  }
};
