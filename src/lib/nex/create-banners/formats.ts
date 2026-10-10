// src/lib/nex/create-banners/formats.ts
//
// NEX Create Banners · Format catalogue · Founder Authorisation A · 2026-09-23
// ===========================================================================
// Banner format definitions the orchestrator uses to produce N variants per
// campaign. The catalogue is NEX-owned and engine-agnostic — no generation
// engine ever sees this file; the engine adapter receives raw dimensions.

/**
 * BannerFormat describes ONE output shape. The evaluation plan §D7 requires
 * at minimum three (square · landscape · portrait). Twelve are declared
 * here because the product brief is a "12-banner factory" — but the
 * orchestrator can produce any subset per campaign.
 */
export interface BannerFormat {
  readonly id: BannerFormatId;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  /** Aspect ratio family for composition planning. */
  readonly aspect: "square" | "landscape" | "portrait";
  /**
   * Text-region hint · fraction of the image area the composition layer
   * SHOULD keep clear for headline/offer/CTA overlay. Consumed by the
   * composition engine when planning safe zones.
   */
  readonly text_region_area_fraction_hint: number;
  /**
   * Format role · used by verification (D4 commercial composition) and by
   * Social Poster to pick the right variant per destination.
   */
  readonly role:
    | "square_social"
    | "landscape_banner"
    | "portrait_story"
    | "landscape_hero"
    | "square_marketplace"
    | "portrait_reel";
}

export const BANNER_FORMAT_IDS = [
  "square_1024",
  "landscape_1200x628",
  "portrait_1080x1920",
  "square_1080",
  "landscape_1600x900",
  "portrait_1080x1350",
  "square_600",
  "landscape_1200x400",
  "portrait_1200x1500",
  "square_500",
  "landscape_2400x1260",
  "portrait_800x1200",
] as const;
export type BannerFormatId = (typeof BANNER_FORMAT_IDS)[number];

export const BANNER_FORMATS: readonly BannerFormat[] = [
  {
    id: "square_1024",
    label: "Square 1024",
    width: 1024,
    height: 1024,
    aspect: "square",
    text_region_area_fraction_hint: 0.3,
    role: "square_social",
  },
  {
    id: "landscape_1200x628",
    label: "Facebook / LinkedIn landscape banner",
    width: 1200,
    height: 628,
    aspect: "landscape",
    text_region_area_fraction_hint: 0.35,
    role: "landscape_banner",
  },
  {
    id: "portrait_1080x1920",
    label: "Instagram / TikTok story",
    width: 1080,
    height: 1920,
    aspect: "portrait",
    text_region_area_fraction_hint: 0.25,
    role: "portrait_story",
  },
  {
    id: "square_1080",
    label: "Instagram square",
    width: 1080,
    height: 1080,
    aspect: "square",
    text_region_area_fraction_hint: 0.3,
    role: "square_social",
  },
  {
    id: "landscape_1600x900",
    label: "Website hero landscape",
    width: 1600,
    height: 900,
    aspect: "landscape",
    text_region_area_fraction_hint: 0.35,
    role: "landscape_hero",
  },
  {
    id: "portrait_1080x1350",
    label: "Instagram portrait post",
    width: 1080,
    height: 1350,
    aspect: "portrait",
    text_region_area_fraction_hint: 0.28,
    role: "portrait_reel",
  },
  {
    id: "square_600",
    label: "Marketplace tile",
    width: 600,
    height: 600,
    aspect: "square",
    text_region_area_fraction_hint: 0.25,
    role: "square_marketplace",
  },
  {
    id: "landscape_1200x400",
    label: "Wide banner strip",
    width: 1200,
    height: 400,
    aspect: "landscape",
    text_region_area_fraction_hint: 0.4,
    role: "landscape_banner",
  },
  {
    id: "portrait_1200x1500",
    label: "Portrait poster",
    width: 1200,
    height: 1500,
    aspect: "portrait",
    text_region_area_fraction_hint: 0.28,
    role: "portrait_reel",
  },
  {
    id: "square_500",
    label: "Small card square",
    width: 500,
    height: 500,
    aspect: "square",
    text_region_area_fraction_hint: 0.25,
    role: "square_marketplace",
  },
  {
    id: "landscape_2400x1260",
    label: "Retina landscape hero",
    width: 2400,
    height: 1260,
    aspect: "landscape",
    text_region_area_fraction_hint: 0.32,
    role: "landscape_hero",
  },
  {
    id: "portrait_800x1200",
    label: "Portrait card",
    width: 800,
    height: 1200,
    aspect: "portrait",
    text_region_area_fraction_hint: 0.3,
    role: "portrait_reel",
  },
] as const;

export function getBannerFormat(id: BannerFormatId): BannerFormat {
  const found = BANNER_FORMATS.find((f) => f.id === id);
  if (!found) {
    throw new Error(`Unknown BannerFormatId: ${id}`);
  }
  return found;
}

/**
 * The three formats required by the Banner Evaluation Plan §D7. Any
 * evaluation-track campaign MUST include at least these three.
 */
export const EVALUATION_REQUIRED_FORMAT_IDS: readonly BannerFormatId[] = [
  "square_1024",
  "landscape_1200x628",
  "portrait_1080x1920",
];

// Doctrine locks
export const _BANNER_FORMATS_ARE_NEX_OWNED_NEVER_ENGINE_SPECIFIC =
  true as const;
export const _BANNER_FORMATS_COUNT_IS_TWELVE_BY_PRODUCT_BRIEF = true as const;
