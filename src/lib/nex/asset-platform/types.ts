// Asset Intelligence Platform · contract.
//
// The Asset Resolver evolves into a full Asset Intelligence Platform with 10
// responsibilities. This types file defines the platform's public contract ·
// individual capabilities are implemented incrementally (see doctrine for the
// phased delivery plan).
//
// Doctrine: docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md

// ─── Asset kinds ─────────────────────────────────────────────────────────

export type AssetKind = "hero_image" | "logo" | "icon" | "texture" | "background" | "font" | "video" | "audio" | "3d_model" | "hdri";

export type LicenceKind = "internal" | "royalty_free" | "creative_commons" | "commercial_licensed" | "custom_agreement";

// ─── Asset descriptor ────────────────────────────────────────────────────

export type Asset = {
  id: string;
  kind: AssetKind;
  url: string;
  content_hash?: string;                 // perceptual hash for duplicate detection
  version: string;
  supersedes?: string;                   // previous asset id in the version chain
  quality_score?: number;                // 0-100 · resolver-computed
  semantic_tags: readonly string[];
  style_tags: readonly string[];         // e.g. "modern", "traditional", "sales_event"
  timber_profiles?: readonly string[];   // e.g. ["oak", "walnut"]
  compatible_themes?: readonly string[]; // e.g. ["luxury_burgundy", "heritage_walnut_cream"]
  compatible_personalities?: readonly string[]; // e.g. ["luxury", "heritage"]
  licence: {
    kind: LicenceKind;
    attribution_required?: boolean;
    commercial_use?: boolean;
    notes?: string;
  };
  usage_analytics?: {
    times_selected: number;
    times_displayed: number;
    performance_score?: number;          // downstream conversion metric
  };
  created_at: string;
  metadata: Record<string, unknown>;
};

// ─── Query brief ─────────────────────────────────────────────────────────

export type AssetQuery = {
  kind: AssetKind;
  semantic_tags?: readonly string[];
  style_tags?: readonly string[];
  timber_profile?: string;
  theme_pack?: string;
  personality?: string;
  min_quality_score?: number;
  licence_kind?: LicenceKind;
  exclude_ids?: readonly string[];
};

// ─── Resolution result (with ranked fallbacks + A/B candidates) ───────────

export type AssetResolution = {
  primary?: Asset;
  fallbacks: readonly Asset[];           // ranked alternatives
  ab_candidates?: readonly Asset[];      // 2+ candidates when A/B testing is active
  reasoning: readonly string[];          // explainable resolution chain
  resolved_at: string;
};

// ─── The Asset Intelligence Platform contract (all 10 responsibilities) ─

export type AssetIntelligencePlatform = {
  // 1 · Versioning
  registerVersion(asset: Asset): Asset;
  history(assetId: string): readonly Asset[];

  // 2 · Quality scoring
  scoreQuality(asset: Asset): number;

  // 3 · Duplicate detection
  findDuplicates(asset: Asset): readonly Asset[];

  // 4 · Semantic tagging
  tag(asset: Asset, tags: readonly string[]): Asset;

  // 5 · Style compatibility
  isCompatible(asset: Asset, opts: { theme_pack?: string; personality?: string; timber_profile?: string }): boolean;

  // 6 · Licensing
  licenceCheck(asset: Asset, opts: { commercial: boolean }): { allowed: boolean; reason?: string };

  // 7 · Preferred asset selection · 8 · Fallback chains
  resolve(query: AssetQuery): AssetResolution;

  // 9 · A/B testing
  registerABTest(query: AssetQuery, candidates: readonly Asset[]): string;         // returns test id

  // 10 · Usage analytics
  recordUsage(assetId: string, event: { kind: "selected" | "displayed" | "clicked" | "converted" }): void;
};
