// Asset Intelligence Platform · public exports (MVP contract · implementations phased).
//
// Doctrine: docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md

export type {
  Asset, AssetKind, AssetQuery, AssetResolution, LicenceKind, AssetIntelligencePlatform,
} from "./types";
export { validateAsset } from "./asset-library";
export type { UniversalAsset, QualityRating, AssetIngestionRequest, AssetIngestionResult } from "./asset-library";
export { overlayFitsInSafeArea, heroSupportsDesignSize } from "./hero-image";
export type { HeroImageIntelligence, SafeArea, FocalPoint, CroppingLimits, RegionBox } from "./hero-image";
