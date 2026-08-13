// Visual Pattern Library · Pattern DNA schema (Philip 2026-08-04).
//
// DISTINCT from Object Library. Object Library stores physical objects
// (Handrail · Cabinet Door · Chair). Pattern Library stores reusable DESIGN
// PATTERNS (Kitchen Marketing Banner Layout · Loft Ladder Banner Layout ·
// Instagram Carousel · Landing Page Hero).
//
// "Use Pattern TRADE_BANNER_001 but swap in Loft Ladder hero" · pattern
// bindings replace the objects · layout + composition are preserved.
//
// Doctrine: docs/brains/nex-visual-pattern-library-and-design-genome-philip-2026-08-04.md

import type { ObjectFamily } from "../object-library";

export type PatternFamily =
  | "marketing_banner" | "landing_page" | "product_hero" | "instagram_carousel" | "instagram_story"
  | "email_hero" | "facebook_cover" | "linkedin_banner" | "print_flyer" | "roll_up_banner"
  | "brochure_cover" | "presentation_slide" | "business_card" | "van_wrap" | "signboard"
  | "website_hero" | "sales_page" | "quotation_cover" | "invoice_header" | "other";

export type PatternLayout = {
  columns: number;
  rows: number;
  hero_position?: "left" | "right" | "top" | "bottom" | "center" | "full_bleed";
  hero_width_pct?: number;
  aspect_ratios: readonly string[];        // e.g. ["1.91:1", "1:1", "4:3"]
};

export type SafeZone = {
  id: string;
  x_pct: number;
  y_pct: number;
  width_pct: number;
  height_pct: number;
  role: "hero_product" | "headline" | "subheadline" | "feature_list" | "cta" | "contact" | "logo" | "badge" | "qr" | "social";
};

export type TypographyRole = {
  role: "display" | "headline" | "subheadline" | "body" | "feature_list_item" | "cta" | "caption" | "contact_line" | "badge";
  weight: "regular" | "medium" | "bold" | "extra_bold" | "black";
  transform?: "none" | "uppercase" | "lowercase" | "capitalize";
  hierarchy_rank: number;                  // 1 = strongest visual weight
};

export type ObjectSlotBinding = {
  slot_id: string;                         // e.g. "hero_slot" · "contact_slot"
  accepts: readonly ObjectFamily[];        // families that may bind here
  role: string;                            // "hero product image" · "primary contact block"
  required: boolean;
};

export type PatternVersionEntry = {
  version: number;
  captured_at: string;
  changes: readonly string[];
  changed_by: string;
  confidence: number;
};

export type ConversionRecord = {
  platform: string;                        // e.g. "facebook_feed"
  ctr?: number;                            // 0..1
  sample_size: number;
  captured_at?: string;
};

export type PatternDNA = {
  pattern_id: string;                      // e.g. "PREMIUM_TRADE_BANNER_V1"
  family: PatternFamily;
  display_name: string;

  layout: PatternLayout;
  alignment: string;                       // human-readable · e.g. "left-heavy asymmetric"
  spacing_grammar: string;                 // e.g. "24px section · 48px between panels"
  safe_zones: readonly SafeZone[];
  colour_hierarchy: readonly string[];     // ordered · e.g. ["theme_pack.primary", "theme_pack.secondary", "theme_pack.accent"]
  typography_hierarchy: readonly TypographyRole[];
  icon_spacing: string;                    // e.g. "24px between icons · 12px icon-to-label"
  cta_placement: string;                   // e.g. "bottom_right_contact_box"

  best_industries: readonly string[];
  best_audience: readonly string[];
  best_platforms: readonly string[];       // e.g. ["facebook_feed", "instagram_feed", "web_landing_hero"]

  object_slot_bindings: readonly ObjectSlotBinding[];

  banner_example_asset_ids: readonly string[];  // evidence · UniversalAsset ids
  conversion_history?: readonly ConversionRecord[];

  history: readonly PatternVersionEntry[];
  aggregate_confidence: number;            // 0..1
  observation_count: number;

  tags?: readonly string[];

  provenance: { named_expert: string; authored: string };
  created_at: string;
  updated_at: string;
};

export type PatternApplication = {
  pattern_id: string;
  applied_at: string;
  object_bindings: Record<string, string>; // slot_id → object_id
  overrides?: Record<string, unknown>;     // caller-supplied overrides (colour · text · etc.)
  provenance: string;
};
