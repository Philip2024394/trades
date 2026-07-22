// Colour Intelligence — Module 2 of the DIL per V3 Q14.
import type { IntelligenceModule, DesignContext, DesignRule } from ".";

export const COLOUR_VERSION = "1.0.0";

export const colourModule: IntelligenceModule = {
  id: "colour", version: COLOUR_VERSION, category: "palette", supports: [],
  evaluate(ctx: DesignContext): DesignRule[] {
    return [{
      id: "colour.max-three", module: "colour", version: COLOUR_VERSION,
      outputs: {
        max_colours:      3,
        min_contrast_aa:  4.5,
        primary:          ctx.ir.colour.primary,
        secondary:        ctx.ir.colour.secondary,
        accent:           ctx.ir.colour.accent,
        split_pct:        ctx.ir.colour.split_pct
      },
      confidence: 1
    }];
  }
};
