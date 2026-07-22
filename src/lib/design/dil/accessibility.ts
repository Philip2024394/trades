// Accessibility Intelligence — Module 10 per V3 Q14.
import type { IntelligenceModule, DesignRule } from ".";
export const ACCESSIBILITY_VERSION = "1.0.0";
export const accessibilityModule: IntelligenceModule = {
  id: "accessibility", version: ACCESSIBILITY_VERSION, category: "a11y", supports: [],
  evaluate(): DesignRule[] {
    return [{
      id: "accessibility.rules", module: "accessibility", version: ACCESSIBILITY_VERSION,
      outputs: {
        min_contrast_ratio:  4.5,     // WCAG AA
        colour_blind_safe:   true,
        min_touch_target_px: 44,
        min_body_font_px:    14,
        never_colour_only_indicator: true,
        dynamic_type_support: true
      },
      confidence: 1
    }];
  }
};
