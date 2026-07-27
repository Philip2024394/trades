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
  // Contact channels — each field is null when the merchant has not
  // opted-in for public display OR when they have no value on file.
  // The four `nex_show_*` toggles on hammerex_trade_off_listings gate
  // whether the corresponding value gets surfaced to the customer card.
  merchant_whatsapp: string | null;
  merchant_email: string | null;
  merchant_phone: string | null;
  merchant_website: string | null;
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
  // Admin ref — human-readable stable ID (e.g. "NEX-D-001") for
  // directory seeds. Used during curation so Philip can point at a
  // specific card and say "this one should get image X". Undefined
  // for non-seed items (real merchant products).
  admin_ref?: string;
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
