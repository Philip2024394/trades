import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false }
});

export type HammerexTradeOffListing = {
  id: string;
  slug: string;
  display_name: string;
  trading_name: string | null;
  primary_trade: string;
  secondary_trades: string[];
  city: string;
  country: string;
  postcode_prefix: string | null;
  lat: number | null;
  lng: number | null;
  service_postcodes: string[];
  whatsapp: string;
  phone: string | null;
  email: string;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  youtube: string | null;
  twitter: string | null;
  snapchat: string | null;
  reddit: string | null;
  google: string | null;
  bio: string;
  years_in_trade: number | null;
  start_year: number | null;
  avatar_url: string | null;
  photos: string[];
  status: "draft" | "live" | "hidden";
  report_count: number;
  hammerex_standard_verified: boolean;
  hammerex_standard_products: string[];
  hammerex_standard_blurb: string | null;
  theme_color: string;
  button_text_color: string;
  cta_button_effect: "none" | "pulse" | "glow" | "shake";
  hero_text_line1: string | null;
  hero_text_line2: string | null;
  hero_text_line2_color: string | null;
  hero_text_tagline: string | null;
  hero_text_effect: "none" | "shimmer" | "dance" | "underline";
  avatar_frame_style: "none" | "ring" | "pulse" | "dance";
  profile_placement: "center" | "top-left" | "bottom-left";
  accepting_jobs: boolean;
  tier: "standard" | "app_trial" | "app_paid" | "app_expired";
  trial_started_at: string | null;
  trial_expires_at: string | null;
  running_marquee: string | null;
  paid_expires_at: string | null;
  last_payment_plan: "monthly" | "annual" | null;
  operating_hours: Record<string, { open: string; close: string } | null>;
  faq_items: { q: string; a: string }[];
  services_offered: string[];
  contact_form_enabled: boolean;
  visit_us_enabled: boolean;
  rating_avg: number | null;
  rating_count: number;
  priced_services: {
    name: string;
    image_url: string | null;
    image_urls?: string[];
    before_image_url?: string | null;
    price: number;
    unit: string;
    description?: string | null;
  }[];
  availability: "now" | "tomorrow" | "this_week" | "next_week" | "two_weeks" | "later" | null;
  headline_rate: { amount: number; unit: string; currency: string } | null;
  recommendations: { slug: string; note?: string }[];
  is_insured: boolean;
  insurance_cover_gbp: number | null;
  qualifications: string[];
  trade_memberships: string[];
  dbs_checked: boolean;
  has_own_transport: boolean;
  has_own_tools: boolean;
  minimum_job_gbp: number | null;
  free_site_visits: boolean;
  quote_availability: string | null;
  quote_turnaround_hours: number | null;
  current_status_note: string | null;
  ready_date: string | null;
  promo_text: string | null;
  whatsapp_click_count: number;
  last_whatsapp_click_at: string | null;
  upgrade_nudge_dismissed_at: string | null;
  custom_app_hero_url: string | null;
  trust_level_override: number | null;
  video_url: string | null;
  video_cover_url: string | null;
  video_caption: string | null;
  team_members: {
    name: string;
    role: string;
    years_experience: number | null;
    avatar_url: string | null;
    skills: string[];
  }[];
  addons_enabled: Record<string, boolean>;
  // Wholesale Mode — yard origin + delivery config. Lat/lng nullable
  // so a listing can enable wholesale_mode and complete the yard
  // setup later. distance_fudge maps straight-line km to road km
  // (1.0 = pure crow-fly, default 1.40, max 3.0).
  wholesale_origin_address: string | null;
  wholesale_origin_postcode: string | null;
  wholesale_origin_lat: number | null;
  wholesale_origin_lng: number | null;
  wholesale_distance_fudge: number;
  wholesale_allow_pickup: boolean;
  wholesale_currency: string;
  wholesale_prices_ex_vat: boolean;
  // Materials Network add-on. Three role-specific columns:
  //   merchant_*: only used when this listing IS a merchant accepting
  //   referrals from other tradespeople (configured per-merchant in the
  //   commission editor). Rate is % of fulfilled order value, min_pence
  //   is the floor commission per referral.
  //   materials_network_opted_in_at: timestamp of first opt-in for the
  //   merchant side (audit trail).
  //   materials_network_paused: merchant can pause new referrals without
  //   archiving picks (existing pending referrals continue).
  merchant_commission_rate: number | null;
  merchant_commission_min_pence: number;
  merchant_commission_terms: string | null;
  materials_network_opted_in_at: string | null;
  materials_network_paused: boolean;
  joined_at: string;
  created_at: string;
  updated_at: string;
};

// Shop Mode add-on — a tradesperson's product catalog.
export type HammerexXratedProduct = {
  id: string;
  listing_id: string;
  kind: "product" | "service";
  unit: string | null;
  category: string | null;
  name: string;
  description: string | null;
  price_pence: number;
  stock_count: number | null;
  cover_url: string | null;
  gallery_urls: string[];
  dispatch_days: number | null;
  variants: {
    axis: "size" | "colour";
    label: string;
    stock_count?: number | null;
    price_delta_pence?: number | null;
  }[];
  size_chart_url: string | null;
  size_chart_unit: "size" | "kg" | "litre" | "cm" | "other" | null;
  // Wholesale Mode bulk-pricing tiers. Empty array = no tier pricing.
  // Shape per row: { min_qty, max_qty?, price_pence }. Top tier omits
  // max_qty ("50+ each"). API enforces ascending min_qty + non-
  // overlapping + ≤5 tiers per product.
  bulk_tiers: {
    min_qty: number;
    max_qty?: number | null;
    price_pence: number;
  }[];
  compare_with: string[];
  status: "live" | "archived";
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// Shop Mode shipping config — one row per (listing, country).
export type HammerexXratedShippingZone = {
  id: string;
  listing_id: string;
  country_code: string;
  country_name: string;
  air_price_pence: number | null;
  sea_price_pence: number | null;
  eta_min_days: number | null;
  eta_max_days: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// Wholesale Mode delivery zone — one row per listing (we keep it as
// a table for future "named regions" headroom). banded_pricing is an
// ordered array of distance bands; the first band whose max_km the
// customer's distance falls under is applied.
export type HammerexXratedWholesaleZone = {
  id: string;
  listing_id: string;
  free_radius_km: number | null;
  free_postcodes: string[];
  banded_pricing: {
    max_km: number;
    price_pence: number;
    min_order_pence?: number;
  }[];
  min_order_pence: number;
  max_delivery_km: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// Downloads add-on — per-listing file library. PDFs, Word/Excel docs,
// images that a tradesperson uploads for customers to fetch (brochures,
// trade-account forms, RAMS, qualifications). `file_url` is a public
// Supabase Storage URL under product-images/downloads/. When
// `requires_email=true`, the public surface gates the download behind
// an email capture (lead row in HammerexXratedDownloadLead).
export type HammerexXratedDownload = {
  id: string;
  listing_id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: "pdf" | "doc" | "docx" | "xls" | "xlsx" | "jpg" | "jpeg" | "png" | "other";
  file_size_bytes: number | null;
  category: "brochure" | "form" | "compliance" | "catalogue" | "qualification" | "other";
  requires_email: boolean;
  cover_image_url: string | null;
  download_count: number;
  status: "live" | "archived";
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// Captured email lead for an email-gated download. One row per download
// event (rate-limit / dedupe is handled at the API layer, not the table).
export type HammerexXratedDownloadLead = {
  id: string;
  download_id: string;
  customer_email: string;
  customer_name: string | null;
  ip_hash: string | null;
  downloaded_at: string;
};

// Job Diary add-on — public project a tradesperson advertises. Each
// project carries a live update stream (HammerexXratedProjectUpdate)
// and is hard-gated behind a privacy disclaimer (no faces / no
// addresses / customer agreed) before it can be saved. `status='live'`
// shows on the profile; `completed` archives into the past-projects
// strip; `archived` is soft-hidden (right-to-removal or tradesperson
// choice).
export type HammerexXratedProject = {
  id: string;
  listing_id: string;
  title: string;
  location_label: string;
  started_at: string;
  estimated_complete_at: string | null;
  completed_at: string | null;
  cover_image_url: string;
  final_summary: string | null;
  status: "live" | "completed" | "archived";
  privacy_disclaimer_confirmed_at: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// One "post" within a Job Diary project. status_chip is a controlled
// enum of 8 neutral-framed values (see lib/xratedAddons.ts /
// JobDiaryStatusPicker for the labels and colours). image_urls capped
// at 4 to keep update cards scannable.
export type HammerexXratedProjectUpdate = {
  id: string;
  project_id: string;
  status_chip:
    | "on_track"
    | "stage_complete"
    | "inspection_passed"
    | "weather_delay"
    | "materials_delay"
    | "scope_change"
    | "snagging"
    | "completed";
  image_urls: string[];
  note: string | null;
  shared_platforms: string[];
  ip_hash: string | null;
  posted_at: string;
  created_at: string;
};

export type HammerexTradeOffMessage = {
  id: string;
  listing_id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  message: string;
  ip_hash: string | null;
  created_at: string;
};

export type HammerexXratedView = {
  id: string;
  listing_id: string | null;
  page: string;
  session_id: string | null;
  ip_hash: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
  user_agent: string | null;
  viewed_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

export type HammerexXratedJob = {
  id: string;
  slug: string;
  customer_name: string;
  customer_whatsapp: string;
  trade_slug: string;
  city: string;
  country: string;
  postcode_prefix: string | null;
  description: string;
  budget_hint: string | null;
  photos: string[];
  status: "pending" | "live" | "completed" | "rejected" | "expired";
  is_example: boolean;
  report_count: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type HammerexXratedPayment = {
  id: string;
  listing_id: string;
  plan: "monthly" | "annual";
  amount_gbp: number;
  paid_at: string;
  paid_via: string;
  admin_note: string | null;
  expires_at: string;
  created_at: string;
};

export type HammerexTradeOffProject = {
  id: string;
  listing_id: string;
  title: string;
  description: string | null;
  before_url: string | null;
  during_url: string | null;
  after_url: string | null;
  location_city: string | null;
  completed_at: string | null;
  verified: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type HammerexXratedVoucher = {
  id: string;
  listing_id: string;
  code: string;
  product_slug: string;
  status: "unused" | "redeemed" | "expired" | "revoked";
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_order_ref: string | null;
  admin_note: string | null;
};

// Hammerex Standard products surface — when a tradesperson opts into
// the "Hammerex Standard" badge, they pick from a shortlist of Hammerex
// products. Xrated Trades reads only the public fields needed to render
// the linked product card on the profile (slug + name + image). The
// underlying rows live in the Hammerex `hammerex_products` table —
// shared while both apps point at the same Supabase project; will move
// to its own table once Xrated forks the database.
export type HammerexProduct = {
  id: string;
  slug: string | null;
  name: string;
  image_url: string | null;
};

// Materials Network add-on — tradesperson's curated merchant picks.
// Each row binds one tradie listing to one merchant listing with an
// optional intro_note (≤200 chars) and a sort_order for drag-reorder.
// status='archived' soft-hides without breaking historical referrals.
export type HammerexXratedMerchantPick = {
  id: string;
  tradie_listing_id: string;
  merchant_listing_id: string;
  intro_note: string | null;
  sort_order: number;
  status: "live" | "archived";
  created_at: string;
  updated_at: string;
};

// Materials Network — single referral. Created when a customer composes
// a WhatsApp quote from /<slug>/materials/<merchantSlug>. ref_code is
// the human-visible attribution token ("MN-A4F2K7"). Last-click 24h
// sticky: a repeat send by the same customer_wa_hash + merchant within
// 24h reuses the existing ref_code instead of opening a new row.
//
// Privacy boundary: the tradesperson's earnings ledger NEVER reads
// customer_name / customer_wa_e164 / customer_wa_hash fields — only
// the merchant fulfilment panel sees those.
export type HammerexXratedMerchantReferral = {
  id: string;
  ref_code: string;
  tradie_listing_id: string;
  merchant_listing_id: string;
  customer_session_id: string | null;
  customer_wa_hash: string | null;
  customer_name: string | null;
  customer_wa_e164: string | null;
  cart_items_snapshot: {
    name: string;
    qty: number;
    price_pence: number;
    unit?: string | null;
    variant_label?: string | null;
  }[];
  estimated_cart_total_pence: number | null;
  status: "pending" | "fulfilled" | "declined" | "expired" | "disputed";
  fulfilled_at: string | null;
  fulfilled_order_value_pence: number | null;
  commission_rate_at_fulfilment: number | null;
  commission_pence: number | null;
  fulfilled_note: string | null;
  declined_reason: string | null;
  declined_note: string | null;
  expires_at: string;
  created_at: string;
};

// Materials Network — earnings view per tradesperson. Aggregates the
// referral ledger into counts + monetary totals. Read-only.
export type HammerexXratedTradieEarnings = {
  tradie_listing_id: string;
  pending_count: number;
  pending_estimate_pence: number;
  fulfilled_count: number;
  commission_total_pence: number;
  declined_count: number;
};

// Stub push notification log. Lead Alerts add-on will replace the
// in-app stub publisher with real web-push delivery; this table just
// captures the queued event so we don't lose the signal in the interim.
export type HammerexXratedPushLog = {
  id: string;
  listing_id: string;
  event_type: "commission" | "lead" | "referral_pending" | "referral_fulfilled";
  payload: Record<string, unknown>;
  created_at: string;
};

export type HammerexShippingZone = {
  id: string;
  country_code: string;
  country_name: string;
  carrier: string;
  base_fee_idr: number;
  per_kg_idr: number;
  eta_min_days: number;
  eta_max_days: number;
  is_default: boolean;
  free_shipping_threshold_idr: number;
};
