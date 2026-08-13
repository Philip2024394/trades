// Visual Pattern Library · authored seed patterns.
//
// PREMIUM_TRADE_BANNER_V1 is the first canonical pattern · derived from Philip's
// 4 loft ladder + 4 staircase + 3 kitchen + 4 joinery banners. Registered on
// demand via seedPremiumTradeBanner() so tests remain deterministic.
//
// Doctrine: docs/brains/nex-visual-pattern-library-and-design-genome-philip-2026-08-04.md

import type { PatternDNA } from "./types";
import { register } from "./store";

const PHILIP = "Philip O'Farrell";
const AUTHORED = "2026-08-04";

/** Register PREMIUM_TRADE_BANNER_V1 · idempotent (returns existing if already registered). */
export function seedPremiumTradeBanner(): PatternDNA {
  const pattern: PatternDNA = {
    pattern_id: "PREMIUM_TRADE_BANNER_V1",
    family: "marketing_banner",
    display_name: "Premium Trade Banner · left panel + right hero + bottom CTA",
    layout: {
      columns: 2,
      rows: 3,
      hero_position: "right",
      hero_width_pct: 60,
      aspect_ratios: ["1.91:1", "1:1", "4:3"],
    },
    alignment: "left-heavy asymmetric",
    spacing_grammar: "24px section · 48px between panels · 15px safe margin",
    safe_zones: [
      { id: "hero_zone", x_pct: 42, y_pct: 4, width_pct: 54, height_pct: 74, role: "hero_product" },
      { id: "headline_zone", x_pct: 5, y_pct: 4, width_pct: 36, height_pct: 18, role: "headline" },
      { id: "subheadline_zone", x_pct: 5, y_pct: 24, width_pct: 36, height_pct: 16, role: "subheadline" },
      { id: "features_zone", x_pct: 5, y_pct: 43, width_pct: 34, height_pct: 28, role: "feature_list" },
      { id: "phone_cta_zone", x_pct: 5, y_pct: 84, width_pct: 34, height_pct: 12, role: "cta" },
      { id: "contact_zone", x_pct: 42, y_pct: 82, width_pct: 54, height_pct: 14, role: "contact" },
    ],
    colour_hierarchy: ["theme_pack.primary", "theme_pack.secondary", "theme_pack.accent", "theme_pack.text_on_primary"],
    typography_hierarchy: [
      { role: "headline", weight: "extra_bold", transform: "uppercase", hierarchy_rank: 1 },
      { role: "subheadline", weight: "medium", hierarchy_rank: 2 },
      { role: "feature_list_item", weight: "regular", hierarchy_rank: 3 },
      { role: "cta", weight: "bold", hierarchy_rank: 2 },
      { role: "contact_line", weight: "medium", hierarchy_rank: 3 },
    ],
    icon_spacing: "24px between icons · 12px icon-to-label",
    cta_placement: "bottom_right_contact_box",
    best_industries: ["joinery", "kitchens", "staircases", "loft_ladders", "under_stair_storage", "wardrobes", "doors"],
    best_audience: ["luxury_homeowner", "modern_family", "builder_trade", "general_homeowner", "installer"],
    best_platforms: ["facebook_feed", "instagram_feed", "web_landing_hero", "print_flyer_a4", "linkedin_post"],
    object_slot_bindings: [
      { slot_id: "hero_slot", accepts: ["STAIR_HANDRAIL", "STAIR_TREAD", "STAIR_NEWEL", "KITCHEN_ISLAND", "KITCHEN_CABINET", "DOOR", "WARDROBE", "OTHER"], role: "hero product image · right column", required: true },
      { slot_id: "contact_slot", accepts: ["OTHER"], role: "primary contact block · bottom-right", required: true },
      { slot_id: "feature_icons", accepts: ["OTHER"], role: "4-6 themed circular icons in feature list", required: false },
    ],
    banner_example_asset_ids: [],
    conversion_history: [],
    history: [{ version: 1, captured_at: AUTHORED, changes: ["seed registration · Philip authored"], changed_by: "philip", confidence: 0.95 }],
    aggregate_confidence: 0.95,
    observation_count: 1,
    tags: ["premium_trade_banner", "left_panel_right_hero", "bottom_right_cta", "banner_family", "authored_seed"],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
    created_at: `${AUTHORED}T00:00:00.000Z`,
    updated_at: `${AUTHORED}T00:00:00.000Z`,
  };
  return register(pattern);
}
