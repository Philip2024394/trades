// UI Intelligence — Module 8 per V3 Q14. Used by App Studio surfaces.
import type { IntelligenceModule, DesignRule } from ".";
export const UI_VERSION = "1.0.0";
export const uiModule: IntelligenceModule = {
  id: "ui", version: UI_VERSION, category: "app-ui", supports: [],
  evaluate(): DesignRule[] {
    return [{
      id: "ui.rules", module: "ui", version: UI_VERSION,
      outputs: {
        grid_pt:          8,
        min_touch_target: 44,
        max_bottom_nav:   5,
        max_primary_cta:  1,
        min_body_px:      14
      },
      confidence: 1
    }];
  }
};
