// src/lib/nex/create-banners/index.ts
//
// NEX Create Banners · barrel export · Founder Authorisation A · 2026-09-23
// =========================================================================
// Public surface of the NEX Create Banners architecture. Every consumer
// imports from here. Callers MUST NOT reach into internal module paths.

// Quality status
export type { QualityStatus } from "./quality-status";
export {
  QUALITY_STATUS_VALUES,
  DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES,
  isQualityStatus,
  qualityStatusUserFacingLabel,
  mayPublishToSocialPoster,
  mayPreviewInternally,
  _QUALITY_STATUS_DEFAULT_IS_UNPROVEN,
  _QUALITY_STATUS_PUBLICATION_REQUIRES_PRODUCTION_VALIDATED,
  _QUALITY_STATUS_NEVER_AUTO_PROMOTED_WITHOUT_EVALUATION_PASS,
} from "./quality-status";

// Formats
export type { BannerFormat, BannerFormatId } from "./formats";
export {
  BANNER_FORMATS,
  BANNER_FORMAT_IDS,
  EVALUATION_REQUIRED_FORMAT_IDS,
  getBannerFormat,
} from "./formats";

// Core types
export type {
  BannerCampaign,
  BusinessIdentity,
  ProductOrServiceContext,
  BrandConstraints,
  ProvenanceRequirements,
  ReferenceAssetHandle,
  ReferenceProvenance,
  BannerConcept,
  CompositionIntent,
  CopyRequirements,
  ReferenceRequirements,
  EngineAgnosticHints,
  BannerGenerationRequest,
  GenerationResult,
  EngineIdentity,
  ModelIdentity,
  BannerVariant,
  BannerVariantLifecycleState,
  BannerVerification,
  AutomatedCheck,
  VerificationDefect,
  BannerJobLifecycle,
} from "./types";
export { BANNER_VARIANT_LIFECYCLE_STATES } from "./types";

// Capability contract
export type {
  VisualGenerationCapability,
  GenerationEngineProvider,
  GenerationEngineAdapter,
  GenerationEngineRegistry,
} from "./capability-contract";
export { InMemoryGenerationEngineRegistry } from "./capability-contract";

// SDXL binding (the ONLY engine-specific file in this module)
export type { SdxlBindingInput, UnderlyingAdapterOutcome } from "./sdxl-engine-adapter-binding";
export {
  NEX_VISUAL_ENGINE_PRIMARY_SLUG,
  CREATE_BANNERS_SDXL_BINDING_VERSION,
  makeSdxlEngineAdapter,
  makeSdxlProvider,
} from "./sdxl-engine-adapter-binding";

// Reference eligibility (doctrine-inheriting)
export type {
  ReferenceEligibilityDecision,
  CampaignReferenceGuardResult,
} from "./reference-eligibility";
export {
  THIRD_PARTY_AI_MARKERS,
  HUMAN_PHOTO_MARKERS,
  classifyReferenceHandle,
  classifyRawProvenanceText,
  guardCampaignReferences,
} from "./reference-eligibility";

// Campaign + concept validators
export type { CampaignValidationResult } from "./campaign";
export { validateBannerCampaign, isValidFormatId } from "./campaign";
export type { ConceptValidationResult } from "./concept";
export { validateBannerConcept } from "./concept";

// Orchestrator
export type { OrchestrationPlan, VariantDefinition } from "./orchestrator";
export { buildOrchestrationPlan, initialJobLifecycles } from "./orchestrator";

// Composition seam
export type {
  CompositionRequest,
  CompositionResult,
  CompositionEngine,
  SafeZone,
  BannerVariantForComposition,
} from "./composition-contract";
export { planSafeZones } from "./composition-contract";

// Verification seam
export type { Verifier } from "./verification-contract";
export {
  AUTOMATED_CHECK_STUBS,
  buildInitialVerification,
} from "./verification-contract";

// Provenance
export type { ProvenanceChain } from "./provenance";
export { buildProvenanceChain } from "./provenance";

// Social Poster handoff
export type {
  SocialPosterHandoffRequest,
  SocialPosterHandoffOutcome,
  SocialPosterBridge,
} from "./social-poster-handoff";
export { preflightHandoff } from "./social-poster-handoff";

// Legacy Anthropic route quarantine
export {
  LEGACY_ANTHROPIC_BANNER_ROUTE_PATH,
  LEGACY_ANTHROPIC_BANNER_QUARANTINE_REASONS,
  CREATE_BANNERS_MUST_NOT_IMPORT_FROM,
  CREATE_BANNERS_MAY_REUSE_LEGACY_ANTHROPIC_ROUTE,
  CREATE_BANNERS_MAY_DELETE_LEGACY_ROUTE_UNILATERALLY,
} from "./legacy-anthropic-quarantine";
