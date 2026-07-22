// Layout Intelligence — Module 1 of the DIL per V3 Q14.
// Grid systems, hero ratios, negative space, information hierarchy.

import type { IntelligenceModule, DesignContext, DesignRule } from ".";

export const LAYOUT_VERSION = "1.0.0";

export const layoutModule: IntelligenceModule = {
  id:       "layout",
  version:  LAYOUT_VERSION,
  category: "composition",
  supports: [],  // applies to every surface
  evaluate(ctx: DesignContext): DesignRule[] {
    const rules: DesignRule[] = [];

    // Universal rule — max 3 information groups
    rules.push({
      id:         "layout.max-info-groups",
      module:     "layout",
      version:    LAYOUT_VERSION,
      outputs:    { max_info_groups: 3 },
      confidence: 1
    });

    // Vehicle-specific — hero image 28-62% depending on style
    if (ctx.surface === "vehicle") {
      const hero = ctx.ir.layout.style_anchor?.toLowerCase().includes("luxury") ? 28 : 45;
      rules.push({
        id:         "layout.vehicle.hero-pct",
        module:     "layout",
        version:    LAYOUT_VERSION,
        outputs:    { hero_pct: hero, negative_space_pct: 18 },
        confidence: 0.9
      });
    }

    // Print-specific — grid + margins
    if (ctx.surface === "business-card" || ctx.surface === "letterhead") {
      rules.push({
        id:         "layout.print.margins",
        module:     "layout",
        version:    LAYOUT_VERSION,
        outputs:    { margin_mm: 10, grid: "12-column" },
        confidence: 1
      });
    }

    return rules;
  }
};
