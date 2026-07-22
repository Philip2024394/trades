// Logo Intelligence — Module 6 per V3 Q14.
import type { IntelligenceModule, DesignContext, DesignRule } from ".";
export const LOGO_VERSION = "1.0.0";
export const logoModule: IntelligenceModule = {
  id: "logo", version: LOGO_VERSION, category: "identity", supports: [],
  evaluate(): DesignRule[] {
    return [{
      id: "logo.rules", module: "logo", version: LOGO_VERSION,
      outputs: {
        min_size_px:            48,
        min_size_mm_vehicle:    380,
        protection_zone_pct:    50,     // whitespace around logo = 50% of logo width
        require_mono_variant:   true,
        require_reverse_variant: true,
        embroidery_min_thickness: 1.5,  // mm
        trademark_uniqueness_check: "recommend"
      },
      confidence: 1
    }];
  }
};
