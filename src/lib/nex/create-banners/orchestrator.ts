// src/lib/nex/create-banners/orchestrator.ts
//
// NEX Create Banners · N-variant orchestration · Founder Authorisation A · 2026-09-23
// ====================================================================================
// The orchestrator produces a plan for generating N banner variants (up to
// 12 by product brief) across the requested formats and seeds.
// This is INERT PLANNING · it does not execute generation. Execution goes
// through the VisualGenerationCapability + engine adapter (§9).

import type {
  BannerCampaign,
  BannerConcept,
  BannerGenerationRequest,
  BannerJobLifecycle,
} from "./types";
import type { BannerFormatId } from "./formats";
import { DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES } from "./quality-status";

export interface OrchestrationPlan {
  readonly plan_id: string;
  readonly campaign_id: string;
  readonly concept_id: string;
  readonly requested_formats: readonly BannerFormatId[];
  readonly seeds: readonly number[];
  readonly variant_definitions: readonly VariantDefinition[];
  readonly generation_requests: readonly BannerGenerationRequest[];
  readonly total_variants: number;
}

export interface VariantDefinition {
  readonly variant_id: string;
  readonly format_id: BannerFormatId;
  readonly seed: number;
}

/**
 * Build an orchestration plan for a campaign + concept. Deterministic.
 * Does NOT dispatch generation · caller wires this into the capability.
 */
export function buildOrchestrationPlan(input: {
  readonly campaign: BannerCampaign;
  readonly concept: BannerConcept;
  readonly seeds: readonly number[];
}): OrchestrationPlan {
  const { campaign, concept, seeds } = input;
  if (seeds.length === 0) {
    throw new Error("orchestration plan requires at least one seed");
  }
  if (campaign.requested_formats.length === 0) {
    throw new Error(
      "orchestration plan requires at least one requested_format"
    );
  }
  const variant_definitions: VariantDefinition[] = [];
  const generation_requests: BannerGenerationRequest[] = [];
  let ordinal = 0;
  for (const format_id of campaign.requested_formats) {
    for (const seed of seeds) {
      ordinal += 1;
      const variant_id = `${campaign.campaign_id}::${concept.concept_id}::${format_id}::${seed}::v${ordinal}`;
      const request_id = `${variant_id}::req`;
      variant_definitions.push({ variant_id, format_id, seed });
      generation_requests.push({
        request_id,
        concept_id: concept.concept_id,
        format_id,
        seed,
        quality_status_at_request_time:
          DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES,
      });
    }
  }
  return {
    plan_id: `${campaign.campaign_id}::${concept.concept_id}::plan`,
    campaign_id: campaign.campaign_id,
    concept_id: concept.concept_id,
    requested_formats: campaign.requested_formats,
    seeds,
    variant_definitions,
    generation_requests,
    total_variants: variant_definitions.length,
  };
}

/**
 * Initial lifecycle rows for every variant · caller persists these.
 */
export function initialJobLifecycles(
  plan: OrchestrationPlan
): readonly BannerJobLifecycle[] {
  const now = new Date().toISOString();
  return plan.variant_definitions.map((v) => ({
    job_id: `${v.variant_id}::job`,
    campaign_id: plan.campaign_id,
    created_at: now,
    updated_at: now,
    state: "requested",
    quality_status: DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES,
    last_error: null,
  }));
}

export const _ORCHESTRATOR_IS_INERT_PLANNING_ONLY = true as const;
export const _ORCHESTRATOR_NEVER_CALLS_ENGINE_DIRECTLY = true as const;
