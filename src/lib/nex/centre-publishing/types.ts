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
  // Philip 2026-08-16 · country-aware Trade Centre. `merchant_country` is
  // the canonical directory_seeds.country string ("United Kingdom",
  // "Ireland", "USA", …). `merchant_region` is a free-text region field —
  // a UK county, an Irish county, or a US state code — country-scoped, so
  // callers must combine with `merchant_country` to interpret it. Optional
  // for backward compatibility with mock items and legacy merchant rows
  // that pre-date the country column.
  merchant_country?: string | null;
  merchant_region?: string | null;
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
  // Philip 2026-08-02 · Trade Center feed v2 · membership + profile fields.
  // Tier drives card sizing: paid tiers get the full-height featured card,
  // free tier gets the mixed small/medium hash. Sourced from
  // hammerex_trade_off_listings.tier · null on directory-seed listings
  // (they're not on any paid plan yet).
  merchant_tier: string | null;
  // Star rating shown only when populated (Google-sourced on directory
  // seeds · not fabricated). Free-tier merchants with ratings still show
  // them if we have real data.
  merchant_google_rating: number | null;
  merchant_google_review_count: number | null;
  // Extra profile data for the View Details slide-up panel.
  merchant_services: string[];
  merchant_years_in_trade: number | null;
  merchant_photos: string[];       // up to 5 project thumbnails rendered
  merchant_instagram: string | null;
  merchant_facebook: string | null;
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
  // Philip 2026-08-02 · Freshness Rule scaffold (Big Win #3).
  // Populated by merchant-side confirmation flow (not yet shipped · needs
  // merchant auth). MerchantProfileSheet renders a subtle "Confirmed X ago"
  // chip when populated · silently omits when null. Adding the field now
  // so the display code is ready when the write side ships.
  merchant_last_confirmed_at?: string | null;
  merchant_next_confirmation_due?: string | null;
};

export type CentreFeedFilters = {
  query?: string;
  category?: string;
  postcode?: string;
  min_price_pence?: number;
  max_price_pence?: number;
  /**
   * Canonical directory_seeds.country value ("United Kingdom", "Ireland",
   * "USA"). Callers passing a code like "GB"/"US"/"IE" should first
   * normalise via `toDbCountryValue` in `@/lib/nex/geography/countries`.
   * Absent or "all" = no country filter.
   */
  country?: string;
  /** Country-scoped region — UK county, Irish county, or US state code. */
  region?: string;
  /** Capability flag key (e.g. "refacing") — filters on `capabilities`. */
  capability?: string;
  limit?: number;
  offset?: number;
};
