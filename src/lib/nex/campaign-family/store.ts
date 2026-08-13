// Campaign Family · in-memory store + fan-out helper.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

import type { CampaignFamily, CampaignOutput, CampaignOutputChannel } from "./types";

const STORE = new Map<string, CampaignFamily>();

export function register(campaign: CampaignFamily): CampaignFamily {
  if (STORE.has(campaign.campaign_id)) throw new Error(`CampaignFamily already registered: ${campaign.campaign_id}`);
  STORE.set(campaign.campaign_id, campaign);
  return campaign;
}

export function get(campaign_id: string): CampaignFamily | undefined { return STORE.get(campaign_id); }
export function all(): readonly CampaignFamily[] { return Array.from(STORE.values()); }
export function count(): number { return STORE.size; }
export function clear(): void { STORE.clear(); }

export function updateOutput(campaign_id: string, channel: CampaignOutputChannel, patch: Partial<CampaignOutput>): CampaignFamily {
  const existing = STORE.get(campaign_id);
  if (!existing) throw new Error(`Unknown campaign_id: ${campaign_id}`);
  const outputs = existing.outputs.map((o) => o.channel === channel ? { ...o, ...patch } : o);
  const next: CampaignFamily = { ...existing, outputs };
  STORE.set(campaign_id, next);
  return next;
}

/** Fan out a campaign into planned outputs. Standard "full domestic marketing pack"
 *  used when the caller doesn't specify channels. */
export const DEFAULT_DOMESTIC_FAN_OUT: readonly { channel: CampaignOutputChannel; design_size_id: string }[] = [
  { channel: "facebook_feed", design_size_id: "facebook_feed" },
  { channel: "instagram_feed", design_size_id: "instagram_feed" },
  { channel: "instagram_story", design_size_id: "instagram_story" },
  { channel: "instagram_carousel", design_size_id: "instagram_carousel" },
  { channel: "linkedin_post", design_size_id: "linkedin_post" },
  { channel: "web_landing_hero", design_size_id: "web_landing_hero" },
  { channel: "web_product_hero", design_size_id: "web_product_hero" },
  { channel: "email_header", design_size_id: "web_email_header" },
  { channel: "print_flyer_a4", design_size_id: "print_flyer_a5" },
  { channel: "print_business_card", design_size_id: "print_business_card" },
  { channel: "google_business", design_size_id: "google_business" },
];

export function planCampaign(input: {
  campaign_id: string; display_name: string;
  base_design_document_id: string; product_family: string;
  audience: string; brand_archetype: string; theme_pack: string;
  pattern_id?: string;
  channels?: readonly { channel: CampaignOutputChannel; design_size_id: string }[];
}): CampaignFamily {
  const fanOut = input.channels ?? DEFAULT_DOMESTIC_FAN_OUT;
  const outputs: CampaignOutput[] = fanOut.map((c) => ({
    channel: c.channel,
    design_size_id: c.design_size_id,
    pattern_id: input.pattern_id,
    status: "planned",
  }));
  const campaign: CampaignFamily = {
    campaign_id: input.campaign_id,
    display_name: input.display_name,
    base_design_document_id: input.base_design_document_id,
    product_family: input.product_family,
    audience: input.audience,
    brand_archetype: input.brand_archetype,
    theme_pack: input.theme_pack,
    outputs,
    created_at: new Date().toISOString(),
    provenance: { named_expert: "Philip O'Farrell", authored: "2026-08-04" },
  };
  return register(campaign);
}
