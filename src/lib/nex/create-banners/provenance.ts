// src/lib/nex/create-banners/provenance.ts
//
// NEX Create Banners · Provenance chain · Founder Authorisation A · 2026-09-23
// ============================================================================
// Every generated asset is traceable end-to-end per ADR-0024 (Image Manifest Rule)
// and the reconciliation doctrine.
//   Campaign → Concept → GenerationRequest → Engine → Model → Seed → References
//     → Composition → Verification → FinalAsset

import type {
  BannerCampaign,
  BannerConcept,
  BannerVariant,
  GenerationResult,
  ReferenceProvenance,
} from "./types";
import type { CompositionResult } from "./composition-contract";
import type { BannerVerification } from "./types";

export interface ProvenanceChain {
  readonly provenance_chain_id: string;
  readonly built_at: string;
  readonly campaign_id: string;
  readonly concept_id: string;
  readonly variant_id: string;
  readonly generation: {
    readonly request_id: string;
    readonly result_id: string;
    readonly engine_slug: string;
    readonly engine_adapter_version: string;
    readonly model_slug: string;
    readonly model_variant: string | null;
    readonly model_weights_sha256_fingerprint: string;
    readonly seed: number;
    readonly generation_parameters_fingerprint: string;
    readonly generated_asset_sha256: string | null;
    readonly reference_provenance: readonly ReferenceProvenance[];
    readonly generated_at: string;
  };
  readonly composition: {
    readonly composition_result_id: string | null;
    readonly composed_asset_sha256: string | null;
    readonly composed_at: string | null;
  };
  readonly verification: {
    readonly verification_id: string | null;
    readonly overall: "pass" | "fail" | "blocked" | null;
    readonly reviewed_by: "nex_automated" | "founder" | null;
    readonly verified_at: string | null;
  };
  readonly final_asset: {
    readonly asset_ref: string | null;
    readonly asset_sha256: string | null;
  };
}

export function buildProvenanceChain(input: {
  readonly campaign: BannerCampaign;
  readonly concept: BannerConcept;
  readonly variant: BannerVariant;
  readonly generation_result: GenerationResult;
  readonly composition_result: CompositionResult | null;
  readonly verification: BannerVerification | null;
  readonly final_asset_ref: string | null;
  readonly final_asset_sha256: string | null;
}): ProvenanceChain {
  const {
    campaign,
    concept,
    variant,
    generation_result,
    composition_result,
    verification,
    final_asset_ref,
    final_asset_sha256,
  } = input;
  return {
    provenance_chain_id: `${variant.variant_id}::provenance`,
    built_at: new Date().toISOString(),
    campaign_id: campaign.campaign_id,
    concept_id: concept.concept_id,
    variant_id: variant.variant_id,
    generation: {
      request_id: generation_result.request_id,
      result_id: generation_result.result_id,
      engine_slug: generation_result.engine_identity.engine_slug,
      engine_adapter_version:
        generation_result.engine_identity.engine_adapter_version,
      model_slug: generation_result.model_identity.model_slug,
      model_variant: generation_result.model_identity.model_variant,
      model_weights_sha256_fingerprint:
        generation_result.model_identity.model_weights_sha256_fingerprint,
      seed: generation_result.seed,
      generation_parameters_fingerprint:
        generation_result.generation_parameters_fingerprint,
      generated_asset_sha256: generation_result.generated_asset_sha256,
      reference_provenance: generation_result.reference_provenance,
      generated_at: generation_result.generated_at,
    },
    composition: {
      composition_result_id: composition_result?.result_id ?? null,
      composed_asset_sha256: composition_result?.composed_asset_sha256 ?? null,
      composed_at: composition_result?.composed_at ?? null,
    },
    verification: {
      verification_id: verification?.verification_id ?? null,
      overall: verification?.overall ?? null,
      reviewed_by: verification?.reviewed_by ?? null,
      verified_at: verification?.verified_at ?? null,
    },
    final_asset: {
      asset_ref: final_asset_ref,
      asset_sha256: final_asset_sha256,
    },
  };
}

export const _PROVENANCE_IS_END_TO_END = true as const;
export const _PROVENANCE_INHERITS_ADR_0024_MANIFEST_RULE = true as const;
