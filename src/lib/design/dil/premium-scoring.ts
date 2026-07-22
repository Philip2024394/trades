// Premium Scoring — Module 12 per V3 Q14.
// Deterministic pre-critique score that feeds into the compiler as a
// "minimum premium score" hint. Full critique lives in the Design
// Critic (V3 Q12).
import type { IntelligenceModule, DesignContext, DesignRule } from ".";

export const PREMIUM_VERSION = "1.0.0";

export const premiumScoringModule: IntelligenceModule = {
  id: "premium-scoring", version: PREMIUM_VERSION, category: "quality", supports: [],
  evaluate(ctx: DesignContext): DesignRule[] {
    const anchor = ctx.ir.layout.style_anchor?.toLowerCase() ?? "";
    const luxury = anchor.includes("luxury") || anchor.includes("minimal");
    return [{
      id: "premium-scoring.target", module: "premium-scoring", version: PREMIUM_VERSION,
      outputs: {
        target_score:         luxury ? 96 : 92,
        whitespace_pct:       luxury ? 24 : 18,
        photo_ratio:          luxury ? 0.6 : 0.45,
        info_density:         luxury ? 3 : 5,
        logo_weight_mult:     luxury ? 1.2 : 1.0
      },
      confidence: 1
    }];
  }
};
