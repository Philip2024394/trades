// src/lib/nex/create-banners/types.ts
//
// NEX Create Banners · Core typed contracts · Founder Authorisation A · 2026-09-23
// ==================================================================================
// Engine-agnostic product contracts. Any generation engine is a swappable
// COMPONENT behind these contracts, never named at the product-contract layer.
// See §7 of the Authorisation A message.

import type { BannerFormatId } from "./formats";
import type { QualityStatus } from "./quality-status";

// ============================================================================
// § BannerCampaign — business-level campaign request
// ============================================================================
export interface BannerCampaign {
  readonly campaign_id: string;
  readonly authored_by: "founder" | "authenticated_merchant" | "nex_agent";
  readonly authored_at: string; // ISO 8601 UTC

  readonly business: BusinessIdentity;
  readonly product_or_service: ProductOrServiceContext;
  readonly campaign_objective: string;
  readonly target_audience_hints: readonly string[];
  readonly brand_constraints: BrandConstraints;
  readonly permitted_source_assets: readonly ReferenceAssetHandle[];

  readonly requested_formats: readonly BannerFormatId[];
  readonly generation_quality_status: QualityStatus;
  readonly provenance_requirements: ProvenanceRequirements;
}

export interface BusinessIdentity {
  readonly business_id: string;
  readonly display_name: string;
  readonly website: string | null;
  readonly trade_category: string;
}

export interface ProductOrServiceContext {
  readonly kind: "product" | "service" | "hybrid";
  readonly label: string;
  readonly notes: string;
}

export interface BrandConstraints {
  readonly colour_palette_hex: readonly string[];
  readonly must_include_logo: boolean;
  readonly forbidden_elements: readonly string[];
}

export interface ProvenanceRequirements {
  readonly require_reference_sha256: boolean;
  readonly require_engine_identity_recorded: boolean;
  readonly require_composition_layer_recorded: boolean;
  readonly require_verification_recorded: boolean;
}

// ============================================================================
// § ReferenceAssetHandle — pointer with provenance (never raw pixels here)
// ============================================================================
export interface ReferenceAssetHandle {
  readonly reference_id: string;
  readonly manifest_asset_id_or_path: string;
  readonly sha256: string;
  readonly provenance: ReferenceProvenance;
}

/**
 * Provenance classification aligned with the NEX-wide no-third-party-AI
 * doctrine. `THIRD_PARTY_AI_GENERATED` is INELIGIBLE by construction.
 * `UNKNOWN` is NOT_AUTHORISABLE.
 */
export interface ReferenceProvenance {
  readonly classification:
    | "KNOWN_HUMAN_LEGITIMATE_SOURCE"
    | "NEX_LOCAL_GENERATION_OUTPUT"
    | "THIRD_PARTY_AI_GENERATED"
    | "UNKNOWN";
  readonly evidence: string;
  readonly recorded_by: "founder" | "manifest_lookup" | "intake_flow";
  readonly recorded_at: string;
}

// ============================================================================
// § BannerConcept — NEX-generated visual concept BEFORE pixel generation
// ============================================================================
export interface BannerConcept {
  readonly concept_id: string;
  readonly campaign_id: string;

  readonly subject: string;
  readonly visual_objective: string;
  readonly composition_intent: CompositionIntent;
  readonly environment: string;
  readonly required_visual_elements: readonly string[];
  readonly forbidden_elements: readonly string[];
  readonly brand_constraints: BrandConstraints;
  readonly copy_requirements: CopyRequirements;
  readonly reference_requirements: ReferenceRequirements;

  /**
   * Engine-independent generation-parameters hint. The adapter is free to
   * translate these into engine-specific inputs.
   */
  readonly engine_agnostic_hints: EngineAgnosticHints;
}

export interface CompositionIntent {
  readonly primary_subject_placement: "left" | "right" | "centre" | "rule_of_thirds";
  readonly negative_space_placement: "left" | "right" | "top" | "bottom" | "auto";
  readonly mood: string;
}

export interface CopyRequirements {
  readonly headline: string;
  readonly offer: string | null;
  readonly cta: string;
  readonly phone: string | null;
  readonly url: string | null;
}

export interface ReferenceRequirements {
  readonly reference_ids: readonly string[];
  readonly reference_strength_hint: number; // 0..1
  readonly may_generate_without_reference: boolean;
}

export interface EngineAgnosticHints {
  readonly photorealism_priority: "high" | "medium" | "low";
  readonly people_allowed: boolean;
  readonly text_in_image_allowed: false; // ALWAYS false — text is NEX-composed
  readonly logo_in_image_allowed: false; // ALWAYS false — logo is NEX-composed
}

// ============================================================================
// § BannerGenerationRequest — engine-independent generation input
// ============================================================================
export interface BannerGenerationRequest {
  readonly request_id: string;
  readonly concept_id: string;
  readonly format_id: BannerFormatId;
  readonly seed: number;
  readonly quality_status_at_request_time: QualityStatus;
}

// ============================================================================
// § GenerationResult — engine-independent generation output
// ============================================================================
export interface GenerationResult {
  readonly result_id: string;
  readonly request_id: string;
  readonly kind: "SUCCESS" | "FAILURE";

  readonly generated_asset_path_or_ref: string | null;
  readonly generated_asset_sha256: string | null;

  readonly engine_identity: EngineIdentity;
  readonly model_identity: ModelIdentity;
  readonly seed: number;
  readonly generation_parameters_fingerprint: string;
  readonly reference_provenance: readonly ReferenceProvenance[];

  readonly generated_at: string;
  readonly generation_duration_ms: number;

  readonly quality_status_at_generation_time: QualityStatus;
  readonly failure_reason: string | null;
}

export interface EngineIdentity {
  readonly engine_slug: string; // e.g. "nex-visual-engine-primary"
  readonly engine_adapter_version: string;
}

export interface ModelIdentity {
  readonly model_slug: string; // engine-provided string · engine-agnostic at product layer
  readonly model_variant: string | null;
  readonly model_weights_sha256_fingerprint: string;
}

// ============================================================================
// § BannerVariant — one output format/version
// ============================================================================
export interface BannerVariant {
  readonly variant_id: string;
  readonly campaign_id: string;
  readonly concept_id: string;
  readonly format_id: BannerFormatId;

  readonly generation_result_ref: string;
  readonly composition_result_ref: string | null;
  readonly verification_result_ref: string | null;

  readonly lifecycle_state: BannerVariantLifecycleState;
  readonly quality_status: QualityStatus;
  readonly provenance_chain_id: string;
}

export const BANNER_VARIANT_LIFECYCLE_STATES = [
  "requested",
  "generating",
  "generated",
  "composing",
  "composed",
  "verifying",
  "verified",
  "approved",
  "rejected",
  "failed",
] as const;
export type BannerVariantLifecycleState =
  (typeof BANNER_VARIANT_LIFECYCLE_STATES)[number];

// ============================================================================
// § BannerVerification — verification result
// ============================================================================
export interface BannerVerification {
  readonly verification_id: string;
  readonly variant_id: string;

  readonly automated_checks: readonly AutomatedCheck[];
  readonly defects_found: readonly VerificationDefect[];
  readonly attribution: "generation" | "composition" | "workflow" | "clean";

  readonly overall: "pass" | "fail" | "blocked";
  readonly quality_status: QualityStatus;
  readonly verified_at: string;
  readonly reviewed_by: "nex_automated" | "founder";
}

export interface AutomatedCheck {
  readonly check_id: string;
  readonly kind: string;
  readonly outcome: "pass" | "fail" | "not_yet_proven" | "blocked";
  readonly evidence: string;
}

export interface VerificationDefect {
  readonly defect_id: string;
  readonly dimension_ref:
    | "D1_subject_accuracy"
    | "D2_reference_fidelity"
    | "D3_prompt_compliance"
    | "D4_commercial_composition"
    | "D5_photorealism"
    | "D6_brand_integrity"
    | "D7_format_adaptability"
    | "D8_consistency"
    | "D9_text_safety"
    | "D10_provenance";
  readonly attribution: "generation" | "composition" | "workflow";
  readonly evidence: string;
}

// ============================================================================
// § BannerJobLifecycle — job state (persistence contract · not implementation)
// ============================================================================
export interface BannerJobLifecycle {
  readonly job_id: string;
  readonly campaign_id: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly state: BannerVariantLifecycleState;
  readonly quality_status: QualityStatus;
  readonly last_error: string | null;
}

// Doctrine locks
export const _CREATE_BANNERS_TYPES_ARE_ENGINE_AGNOSTIC = true as const;
export const _CREATE_BANNERS_TEXT_IN_IMAGE_ALWAYS_FALSE = true as const;
export const _CREATE_BANNERS_LOGO_IN_IMAGE_ALWAYS_FALSE = true as const;
export const _CREATE_BANNERS_NEVER_NAMES_ENGINE_AT_PRODUCT_LAYER =
  true as const;
