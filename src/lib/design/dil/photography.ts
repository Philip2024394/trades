// Photography Intelligence — Module 5 per V3 Q14.
import type { IntelligenceModule, DesignContext, DesignRule } from ".";
export const PHOTOGRAPHY_VERSION = "1.0.0";
export const photographyModule: IntelligenceModule = {
  id: "photography", version: PHOTOGRAPHY_VERSION, category: "imagery", supports: [],
  evaluate(): DesignRule[] {
    return [{
      id: "photography.one-hero", module: "photography", version: PHOTOGRAPHY_VERSION,
      outputs: {
        max_hero_photos:      1,
        background_style:     "soft",
        lighting:             "natural-daylight",
        perspective:          "natural",
        reject_low_quality:   true,
        min_pixels:           { width: 1200, height: 1200 }
      },
      confidence: 1
    }];
  }
};
