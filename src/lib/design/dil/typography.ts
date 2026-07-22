// Typography Intelligence — Module 3 per V3 Q14.
import type { IntelligenceModule, DesignContext, DesignRule } from ".";

export const TYPOGRAPHY_VERSION = "1.0.0";

const AESTHETIC_FONTS = {
  luxury:      ["Helvetica Neue", "Avenir", "Gilroy", "TT Norms", "Manrope"],
  industrial:  ["DIN", "Eurostile", "Roboto Condensed"],
  traditional: ["Trajan", "Cormorant", "Playfair Display"],
  modern:      ["Inter", "Montserrat", "SF Pro", "Roboto"]
};

export const typographyModule: IntelligenceModule = {
  id: "typography", version: TYPOGRAPHY_VERSION, category: "type", supports: [],
  evaluate(ctx: DesignContext): DesignRule[] {
    const aesthetic = ctx.ir.typography.aesthetic ?? "modern";
    return [{
      id: "typography.family-shortlist", module: "typography", version: TYPOGRAPHY_VERSION,
      outputs: {
        max_families:     1,
        max_weights:      3,
        min_body_px:      14,
        min_vehicle_mm:   80,
        preferred_shortlist: AESTHETIC_FONTS[aesthetic],
        embroidery_forbid:  ["thin serif", "hairline", "ultra-light", "condensed-script"]
      },
      confidence: 1
    }];
  }
};
