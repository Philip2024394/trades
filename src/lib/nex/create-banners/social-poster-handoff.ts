// src/lib/nex/create-banners/social-poster-handoff.ts
//
// NEX Create Banners · Social Poster handoff · Founder Authorisation A · 2026-09-23
// =================================================================================
// Clean handoff from an approved banner variant to the existing Social
// Poster. Create Banners does NOT re-implement publishing.
//
// Publication is gated: only PRODUCTION_VALIDATED variants may hand off.

import type { BannerVariant } from "./types";
import type { ProvenanceChain } from "./provenance";
import { mayPublishToSocialPoster } from "./quality-status";

export interface SocialPosterHandoffRequest {
  readonly handoff_id: string;
  readonly variant_id: string;
  readonly final_asset_ref: string;
  readonly final_asset_sha256: string;
  readonly provenance_chain: ProvenanceChain;
  readonly campaign_id: string;
  readonly target_destination_ids: readonly string[];
}

export interface SocialPosterHandoffOutcome {
  readonly outcome: "ACCEPTED_BY_HANDOFF" | "REFUSED_QUALITY_GATE" | "REFUSED_MISSING_PROVENANCE";
  readonly handoff_id: string;
  readonly reason: string | null;
}

/**
 * Pre-flight guard. Called by the handoff bridge BEFORE any Social Poster
 * API is invoked. Returns REFUSED when the variant is not authorised
 * to publish under the two-authorisation model.
 */
export function preflightHandoff(input: {
  readonly variant: BannerVariant;
  readonly provenance_chain: ProvenanceChain;
}): SocialPosterHandoffOutcome {
  const { variant, provenance_chain } = input;
  const handoff_id = `${variant.variant_id}::handoff`;
  if (!mayPublishToSocialPoster(variant.quality_status)) {
    return {
      outcome: "REFUSED_QUALITY_GATE",
      handoff_id,
      reason: `Variant quality_status is ${variant.quality_status} · only PRODUCTION_VALIDATED may publish · Authorisation B (Banner Evaluation Plan pass) required`,
    };
  }
  if (!provenance_chain.final_asset.asset_sha256) {
    return {
      outcome: "REFUSED_MISSING_PROVENANCE",
      handoff_id,
      reason:
        "Provenance chain missing final_asset.asset_sha256 · handoff refused · ADR-0024 manifest rule",
    };
  }
  if (
    !provenance_chain.verification.overall ||
    provenance_chain.verification.overall !== "pass"
  ) {
    return {
      outcome: "REFUSED_QUALITY_GATE",
      handoff_id,
      reason: `Verification overall is '${provenance_chain.verification.overall}' · handoff requires pass`,
    };
  }
  return {
    outcome: "ACCEPTED_BY_HANDOFF",
    handoff_id,
    reason: null,
  };
}

/**
 * The bridge to the existing Social Poster. Implementation must call the
 * existing Social Poster module rather than duplicating publishing logic.
 * At Authorisation A time this is defined as a contract only.
 */
export interface SocialPosterBridge {
  readonly bridge_slug: "nex.create_banners.social_poster_bridge";
  handoff(
    request: SocialPosterHandoffRequest
  ): Promise<SocialPosterHandoffOutcome>;
}

export const _SOCIAL_POSTER_HANDOFF_NEVER_BYPASSES_QUALITY_GATE = true as const;
export const _SOCIAL_POSTER_HANDOFF_REQUIRES_PROVENANCE_CHAIN = true as const;
export const _CREATE_BANNERS_DOES_NOT_REIMPLEMENT_SOCIAL_POSTER = true as const;
