// Print Intelligence — Module 9 per V3 Q14 + V3 Extended Q21.
import type { IntelligenceModule, DesignRule } from ".";
export const PRINT_VERSION = "1.0.0";
export const printModule: IntelligenceModule = {
  id: "print", version: PRINT_VERSION, category: "print-production",
  supports: ["print", "business-card", "letterhead", "invoice"],
  evaluate(): DesignRule[] {
    return [{
      id: "print.rules", module: "print", version: PRINT_VERSION,
      outputs: {
        bleed_mm:         3,
        safe_area_mm:     5,
        min_dpi:          300,
        colour_mode:      "CMYK",
        crop_marks:       true,
        min_font_pt:      8,
        min_qr_size_mm:   20
      },
      confidence: 1
    }];
  }
};
