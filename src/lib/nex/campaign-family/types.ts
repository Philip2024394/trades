// Campaign Family · types (Philip 2026-08-04).
//
// One campaign · many outputs. Instead of 4 separate adverts · Nex knows they
// belong together and can fan out into every required delivery format.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

export type CampaignOutputChannel =
  | "facebook_feed" | "facebook_cover" | "facebook_story"
  | "instagram_feed" | "instagram_story" | "instagram_reel_cover" | "instagram_carousel"
  | "linkedin_post" | "linkedin_cover"
  | "pinterest_pin" | "tiktok_cover"
  | "youtube_thumbnail" | "youtube_banner"
  | "twitter_post" | "twitter_header"
  | "google_business" | "whatsapp_status"
  | "web_landing_hero" | "web_product_hero" | "web_blog_hero"
  | "email_header"
  | "print_flyer_a4" | "print_flyer_a5" | "print_poster_a3" | "print_poster_a2" | "print_poster_a1"
  | "print_business_card" | "print_rollup_banner" | "print_signboard"
  | "vehicle_wrap" | "trade_show_banner"
  | "brochure_cover" | "quotation_cover" | "presentation_slide";

export type CampaignOutput = {
  channel: CampaignOutputChannel;
  design_size_id: string;                  // references renderer/design-sizes.ts
  pattern_id?: string;                     // references pattern-library
  status: "planned" | "generated" | "shipped";
  asset_id?: string;                       // UniversalAsset id when generated
};

export type CampaignFamily = {
  campaign_id: string;
  display_name: string;
  base_design_document_id: string;         // canonical source
  product_family: string;
  audience: string;
  brand_archetype: string;                 // BrandArchetype id
  theme_pack: string;
  outputs: readonly CampaignOutput[];
  created_at: string;
  provenance: { named_expert: string; authored: string };
};
