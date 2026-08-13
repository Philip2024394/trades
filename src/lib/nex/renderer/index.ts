// NDIP Rendering Layer · public exports.
//
// Doctrine:
//  - docs/brains/nex-design-intelligence-platform-ndip-philip-2026-08-04.md
//  - docs/brains/nex-pixel-rendering-engine-phase-e0-philip-2026-08-04.md

export { renderBanner } from "./svg-renderer";
export { resolveAssets } from "./asset-resolver";
export { validateGrammar } from "./grammar";
export { resolveTheme, listThemes } from "./tokens";
export { bannerToDocument } from "./design-document";
export { planRenderDocument } from "./render-planner";
export { buildRenderManifest, determinismHash } from "./render-manifest";
export { resolveFontStyle, requiredFontFamilies, fontFamilyStack, listTextRoles, listPersonalities, FONT_FALLBACKS } from "./font-catalog";
export type { TextRole, FontStyle } from "./font-catalog";
export { listDesignSizes, listByCategory, getDesignSize, countDesignSizes, listCategories } from "./design-sizes";
export type { DesignSize, DesignSizeCategory } from "./design-sizes";
export type {
  BannerSpecification, RenderedBanner, ResolvedAssets, GrammarViolation,
  ThemePack, Layer, TextLayer, ShapeLayer, ImageLayer, IconLayer, FeatureListLayer, ContactBoxLayer,
  BrandPersonality, CTAArchitecture, LayoutFamily, OutputFormat, ExportSize, Box, Position, Size,
} from "./types";
export type {
  DesignDocument, DesignDocumentBase, BannerDocument, DocumentType,
  SceneGraph, SceneObject, Camera, LightingRig, EnvironmentBinding, Provenance,
} from "./design-document";
export type { RenderBrief, BannerRenderBrief } from "./render-planner";
export type { RenderManifest } from "./render-manifest";
