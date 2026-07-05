// Layout Registry — types.
//
// A Layout Pattern is a reusable page-scale composition template PLUS
// a rich decision profile the AI composer uses to rank against
// merchant intent. Concrete Blueprint Instances (@/lib/studio/blueprints)
// may declare `layoutId` pointing at a Layout Pattern here — see ADR-011.
//
// The Layout Registry is a **decision engine**, not just a catalogue:
// every layout self-describes its business fit, structural rules,
// feature support, and conversion character so the composer picks
// by scoring metadata — not by prompting an LLM.

export type LayoutPatternId =
  | "landing"
  | "trades"
  | "ecommerce"
  | "booking"
  | "saas"
  | "dashboard"
  | "portfolio"
  | "directory"
  | "marketplace"
  | "restaurant"
  | "magazine"
  | "mobile-app";

/** Primary business goal a page is trying to advance. */
export type BusinessGoal =
  | "lead-generation"
  | "bookings"
  | "quotes"
  | "portfolio-showcase"
  | "ecommerce"
  | "brand-awareness"
  | "directory-listing"
  | "operations-dashboard"
  | "content-publishing"
  | "app-download"
  | "trust-building"
  | "search-anchored";

/** Hero visual character. */
export type LayoutHeroType =
  | "full-width-photo"
  | "split-photo-copy"
  | "video-background"
  | "product-showroom"
  | "search-anchored"
  | "minimal-centered"
  | "dashboard-header";

/** Image density preference. */
export type ImageDensity = "light" | "medium" | "heavy";

/** Page length guidance. */
export type PageLength = "short" | "medium" | "long";

/** A single step in the layout's container sequence. */
export type LayoutStep = {
  containerId: string;
  role: string;
  compatibleSections?: readonly string[];
  containerPropsOverride?: Record<string, unknown>;
};

/** A responsive / conditional variant of the layout. */
export type LayoutVariant = {
  id: string;
  name: string;
  description: string;
  sequence: readonly LayoutStep[];
  condition?: {
    device?: "mobile" | "tablet" | "desktop";
    themeMode?: "light" | "dark";
    [key: string]: unknown;
  };
};

/** The Decision Profile — the metadata the AI ranks against.
 *  Every layout must declare this so the composer never has to guess. */
export type LayoutDecisionProfile = {
  /** Trade slugs this layout is designed for. `["*"]` = any trade. */
  worksBestFor: readonly string[];
  /** Broad industries this layout serves. */
  bestIndustries: readonly string[];
  /** Primary business goals this layout advances. Ordered by strength. */
  primaryGoals: readonly BusinessGoal[];
  /** Free-form keywords for AI search / merchant browsing. */
  keywords: readonly string[];

  // ─── Structural bounds ─────────────────────────────────────
  minSections: number;
  maxSections: number;

  // ─── Visual character ──────────────────────────────────────
  heroType: LayoutHeroType;
  imageDensity: ImageDensity;
  pageLength: PageLength;

  // ─── Feature support ───────────────────────────────────────
  supportsBooking: boolean;
  supportsEcommerce: boolean;
  supportsPortfolio: boolean;
  supportsSearch: boolean;
  supportsMap: boolean;
  supportsFloatingCta: boolean;

  // ─── Navigation guidance ───────────────────────────────────
  /** Preferred nav pattern slug — layoutRegistry.recommendedNavFor()
   *  returns this. */
  recommendedNavigationId?: string;
  /** Fallback nav patterns compatible with this layout. */
  compatibleNavigationPatterns: readonly string[];

  // ─── Compatibility ─────────────────────────────────────────
  /** Container ids this layout expects to be able to use. Composer
   *  can validate that the required containers are registered. */
  requiredContainers: readonly string[];
  /** Section roles this layout expects to fill. Composer maps roles
   *  to concrete sectionRegistry ids. */
  requiredSectionRoles: readonly string[];

  // ─── Scored suitability (0-100) ────────────────────────────
  mobileSuitability: number;
  seoStrength: number;
  conversionStrength: number;
  trustSignalStrength: number;
};

export type LayoutManifest = {
  manifestVersion: 1;

  slug: LayoutPatternId | string;
  name: string;
  tagline: string;
  description: string;
  version: string;

  category:
    | "trades-first"
    | "commerce-first"
    | "content-first"
    | "operations-first"
    | "app-first";

  sequence: readonly LayoutStep[];
  variants?: readonly LayoutVariant[];
  defaultNavigationId?: string;

  /** The Decision Profile — see LayoutDecisionProfile. This is what
   *  the AI composer ranks against. */
  decision: LayoutDecisionProfile;

  publisher?: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };
};

/** Input the composer passes to `layoutRegistry.rank()`. Any field is
 *  optional; scoring is weighted by presence + match quality. */
export type LayoutRankInput = {
  trade?: string;
  industry?: string;
  goals?: readonly BusinessGoal[];
  keywords?: readonly string[];

  wantsBooking?: boolean;
  wantsEcommerce?: boolean;
  wantsPortfolio?: boolean;
  wantsSearch?: boolean;
  wantsMap?: boolean;
  wantsFloatingCta?: boolean;

  preferredImageDensity?: ImageDensity;
  preferredHero?: LayoutHeroType;
  preferredPageLength?: PageLength;

  /** When set, layouts that fail the specified suitability threshold
   *  score 0 regardless of other matches. */
  minMobileSuitability?: number;
  minSeoStrength?: number;
  minConversionStrength?: number;
};

export type LayoutRankResult = {
  layout: FrozenLayoutManifest;
  score: number;
  reasons: readonly string[];
};

export type FrozenLayoutManifest = Readonly<LayoutManifest>;
