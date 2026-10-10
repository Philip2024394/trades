// src/lib/nex/create-banners/campaign.ts
//
// NEX Create Banners · Campaign validator · Founder Authorisation A · 2026-09-23

import type { BannerCampaign } from "./types";
import type { BannerFormatId } from "./formats";
import { BANNER_FORMAT_IDS } from "./formats";
import { guardCampaignReferences } from "./reference-eligibility";

export interface CampaignValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateBannerCampaign(
  campaign: BannerCampaign
): CampaignValidationResult {
  const errors: string[] = [];

  if (!campaign.campaign_id || campaign.campaign_id.trim().length === 0) {
    errors.push("campaign_id must be a non-empty string");
  }
  if (
    !campaign.business ||
    !campaign.business.business_id ||
    !campaign.business.display_name
  ) {
    errors.push("business identity must include business_id and display_name");
  }
  if (
    !campaign.product_or_service ||
    !campaign.product_or_service.label ||
    campaign.product_or_service.label.trim().length === 0
  ) {
    errors.push(
      "product_or_service.label is required (defines D3 prompt compliance)"
    );
  }
  if (
    !campaign.campaign_objective ||
    campaign.campaign_objective.trim().length < 4
  ) {
    errors.push(
      "campaign_objective is required and must be a real sentence (defines D3 and D4)"
    );
  }
  if (
    !Array.isArray(campaign.requested_formats) ||
    campaign.requested_formats.length === 0
  ) {
    errors.push("requested_formats must include at least one format");
  } else {
    for (const f of campaign.requested_formats) {
      if (!(BANNER_FORMAT_IDS as readonly string[]).includes(f)) {
        errors.push(`requested_formats contains unknown format id: ${f}`);
      }
    }
  }
  // Reference guard · doctrine-enforcing
  const refGuard = guardCampaignReferences(
    campaign.permitted_source_assets ?? []
  );
  if (!refGuard.campaign_may_proceed) {
    errors.push(
      `reference eligibility: ${refGuard.refusal_reason ?? "campaign refused"}`
    );
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function isValidFormatId(id: string): id is BannerFormatId {
  return (BANNER_FORMAT_IDS as readonly string[]).includes(id);
}
