// Types shared across the hero-swap feature.
//
// A merchant's hero-image slot on any page renders one HeroImage from
// the library. Merchants can swap it live via the ChangeImageChip →
// HeroSwapSheet flow. Only images matching the merchant's
// trade_keywords surface in the carousel (strict match).

export type HeroImageAspect = "16:9" | "1:1" | "3:4";

export type HeroImagePalette = {
  primary: string;
  secondary: string;
  surface_warm: string;
  surface_deep: string;
  accent: string;
};

export type HeroImageTextZone = {
  primary: string;
  container_required?: boolean;
  container_style?: string;
  text_shadow_recommended?: boolean;
  note?: string;
};

export type HeroImage = {
  id: string;
  image_url: string;
  subject: string;
  keywords_strict: string[];
  excluded_trades?: string[];
  vibe: string;
  text_zone: HeroImageTextZone;
  theme_palette: HeroImagePalette;
  aspect_variants: Partial<Record<HeroImageAspect, string>>;
  sibling_group_id?: string;
  hero_use_case: string;
  burned_in_text?: boolean;
  worker_visible?: boolean;
  recommended_use: "hero" | "split-hero" | "product-grid" | "section-content";
  note?: string;
};

/** Layout preset for the hero — swaps in place with the selected image. */
export type HeroPreset = "full_bleed" | "framed" | "card";

/** Merchant-owned overrides. Simple, clamped values (see suggestionEngine). */
export type HeroEdits = {
  brightness: number; // -20 to +20 (percent)
  warmth: number; // -30 to +30 (percent)
  vignette: number; // 0 to 40 (percent)
  focus_x: number | null; // 0 to 100 (percent, null = no focus point set)
  focus_y: number | null;
};

export const DEFAULT_HERO_EDITS: HeroEdits = {
  brightness: 0,
  warmth: 0,
  vignette: 0,
  focus_x: null,
  focus_y: null
};

/** Full state of a merchant's hero slot. */
export type HeroSlotState = {
  image: HeroImage;
  preset: HeroPreset;
  edits: HeroEdits;
  hero_text_color: string; // hex — used for contrast checks
};

/** A suggestion the platform gives the merchant when edits push toward
 *  a worse outcome. Shown as a chip next to the offending control. */
export type HeroSuggestion = {
  reason: string; // one-line human explanation
  suggest_preset?: HeroPreset;
  suggest_image_id?: string;
  suggest_revert_edit?: keyof HeroEdits;
};
