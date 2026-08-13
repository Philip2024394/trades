// Asset Intelligence · Hero Image Intelligence extension (Philip 2026-08-04).
//
// Every hero image knows its safe areas · focal point · cropping limits ·
// recommended layouts · recommended theme packs · channels-it-works-on.
// This lets the Smart Crop Engine and the Automatic Platform Variants
// generator serve any of the 66 Design Sizes without stretching · squashing ·
// or cropping the product.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

export type RegionBox = {
  x_pct: number;                         // 0..100 · fractional coordinates so the record is resolution-independent
  y_pct: number;
  width_pct: number;
  height_pct: number;
};

export type SafeArea = {
  kind: "cta" | "text" | "logo" | "social" | "contact" | "badge";
  region: RegionBox;
  notes?: string;
};

export type FocalPoint = {
  x_pct: number;                         // 0..100
  y_pct: number;
  confidence: "high" | "medium" | "low";
  description?: string;
};

export type CroppingLimits = {
  min_visible_pct: {                     // how much of each side may be cropped before the hero is broken
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  never_crop_regions?: readonly RegionBox[];
};

export type HeroImageIntelligence = {
  asset_id: string;

  // Composition
  camera_angle?: string;
  composition_notes?: string;
  negative_space_regions?: readonly RegionBox[];
  focal_point: FocalPoint;
  visual_balance?: "left_weighted" | "right_weighted" | "centered" | "top_weighted" | "bottom_weighted";

  // Safe areas (what may be overlaid where)
  safe_areas: readonly SafeArea[];

  // Cropping
  cropping_limits: CroppingLimits;

  // Recommendations
  recommended_layouts: readonly string[]; // layout_family ids
  recommended_theme_packs: readonly string[];
  works_on: readonly string[];            // design-sizes ids (e.g. "instagram_feed", "facebook_feed")
  avoid_on?: readonly string[];

  // Lighting hints (feeds Lighting Intelligence when re-rendering the scene)
  lighting_signature?: {
    key_direction?: "top_left" | "top_right" | "top" | "front" | "back";
    dominant_temperature_k?: number;
    dominant_hue_hex?: string;
  };
};

/** Convenience · check whether an overlay region fits inside any declared safe area of a given kind. */
export function overlayFitsInSafeArea(hero: HeroImageIntelligence, kind: SafeArea["kind"], overlay: RegionBox): boolean {
  const areas = hero.safe_areas.filter((s) => s.kind === kind);
  if (areas.length === 0) return false;
  return areas.some((area) => {
    const r = area.region;
    return overlay.x_pct >= r.x_pct
      && overlay.y_pct >= r.y_pct
      && overlay.x_pct + overlay.width_pct <= r.x_pct + r.width_pct
      && overlay.y_pct + overlay.height_pct <= r.y_pct + r.height_pct;
  });
}

/** Convenience · does a target design size appear in works_on? */
export function heroSupportsDesignSize(hero: HeroImageIntelligence, design_size_id: string): boolean {
  if (hero.avoid_on?.includes(design_size_id)) return false;
  return hero.works_on.includes(design_size_id);
}
