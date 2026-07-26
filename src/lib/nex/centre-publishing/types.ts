// NEX Centre publishing — shared types.
//
// The CentreFeedItem is the canonical shape every published product
// takes when it reaches the /nex-app/centre discovery surface.
// Kept minimal + serialisable so any surface can consume it.
//
// Reference: docs/architecture/NEX_MASTER_DATA_FLOW_ARCHITECTURE.md · Flow 1
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Amendment section

export type MerchantVerificationLevel =
  | "listed"
  | "claimed"
  | "verified"
  | "partner";

export type CentreFeedItem = {
  kind: "product";
  offer_id: string;
  canonical_id: string;
  name: string;
  brand_name: string;
  slug: string;
  description: string | null;
  price_pence: number;
  vat_rate: number;
  stock_status: string;
  hero_image_url: string | null;
  category_path: string[];
  // Merchant identity
  merchant_id: string;
  merchant_slug: string | null;
  merchant_display_name: string | null;
  merchant_city: string | null;
  merchant_postcode_prefix: string | null;
  merchant_lat: number | null;
  merchant_lng: number | null;
  merchant_avatar_url: string | null;
  merchant_whatsapp: string | null; // E.164 or normalised phone; null = not enabled
  merchant_email: string | null; // null when not opted-in for public display
  merchant_verification_level: MerchantVerificationLevel;
  // Ranking signals
  distance_km: number | null; // populated when query includes a postcode
  region_match_score: number | null; // populated when query includes a postcode
  is_promoted: boolean;
  // Banner overlay
  active_banner_headline: string | null;
  active_banner_visual_style: string | null;
  // Timestamps
  published_at: string | null;
};

export type CentreFeedFilters = {
  query?: string;
  category?: string;
  postcode?: string;
  min_price_pence?: number;
  max_price_pence?: number;
  limit?: number;
  offset?: number;
};
