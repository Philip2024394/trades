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
  // Custom Domain add-on — point your own domain at this profile.
  //   custom_domain: lowercase host the customer typed (with or without
  //     "www." — middleware does the dual-match). UNIQUE — one listing
  //     per domain.
  //   custom_domain_apex: apex form (no leading "www."). We always
  //     attach both apex + www at Vercel and redirect www → apex.
  //   custom_domain_status: lifecycle enum. 'pending' = freshly created
  //     row, no Vercel call yet. 'dns_pending' = Vercel returned
  //     verification records, awaiting customer DNS. 'verifying' = DNS
  //     looks right, Vercel issuing SSL. 'live' = traffic is routing +
  //     SSL valid. 'ssl_failed' / 'dns_lost' / 'expired' / 'blocked' =
  //     error states. 'disconnected' = customer pressed Disconnect.
  //   custom_domain_verification: Vercel's verification challenge
  //     records (TXT / CNAME the customer must add at their registrar).
  //   custom_domain_vercel_id: opaque Vercel domain ID, used for detach.
  //   *_added_at / *_verified_at / *_ssl_verified_at: audit timestamps.
  //   custom_domain_last_check_at: most recent health-check ping.
  //   custom_domain_last_error: human-readable error string from Vercel.
  //   custom_domain_failure_count: cron-incremented; ≥3 = dns_lost.
  //   custom_domain_addon_active: free first 30 days, then auto-charge.
  //     Drives the billing reconciliation job — not the route gate.
  custom_domain: string | null;
  custom_domain_apex: string | null;
  custom_domain_status:
    | "pending"
    | "dns_pending"
    | "verifying"
    | "live"
    | "ssl_failed"
    | "dns_lost"
    | "expired"
    | "disconnected"
    | "blocked"
    | null;
  custom_domain_verification: {
    type: string;
    domain: string;
    value: string;
    reason?: string;
  }[] | null;
  custom_domain_vercel_id: string | null;
  custom_domain_added_at: string | null;
  custom_domain_verified_at: string | null;
  custom_domain_ssl_verified_at: string | null;
  custom_domain_last_check_at: string | null;
  custom_domain_last_error: string | null;
  custom_domain_failure_count: number;
  custom_domain_addon_active: boolean;
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
  // Phase 3 storefront — slug is the per-product URL handle (unique per
  // listing among live rows). featured_at is the "front window"
  // timestamp set when the tradesperson drags a product into one of the
  // 6 Featured slots on the editor. NULL = not featured. The teaser +
  // /<slug>/shop default sort both rank featured_at DESC NULLS LAST.
  slug: string | null;
  featured_at: string | null;
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

// Lead Alerts add-on — one row per (listing, device endpoint). A
// tradesperson can subscribe unlimited devices to one listing; each
// device carries its own vibration_pattern, muted_events filter and
// optional quiet-hours window. endpoint_hash is the SHA-256 of the
// raw push endpoint URL — used for the public-facing UNIQUE key so we
// never echo the endpoint URL back to the client.
export type HammerexXratedPushSubscription = {
  id: string;
  listing_id: string;
  endpoint: string;
  endpoint_hash: string;
  p256dh_key: string;
  auth_key: string;
  user_agent: string | null;
  platform: "ios" | "android" | "desktop" | "unknown";
  device_label: string | null;
  vibration_pattern: number[];
  muted_events: string[];
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  enabled: boolean;
  last_used_at: string | null;
  last_success_at: string | null;
  failure_count: number;
  created_at: string;
};

// Push notification delivery log. Initially a stub for Materials
// Network commission pings; Lead Alerts upgrades it to a real
// per-attempt delivery log keyed by subscription_id with a
// delivery_status enum ('queued'|'sent'|'failed'|'throttled'|'muted'|
// 'quiet_hours'). subscription_id can be NULL for legacy stub rows.
export type HammerexXratedPushLog = {
  id: string;
  listing_id: string;
  event_type: "whatsapp_click" | "commission" | "review" | "test" | "lead" | "referral_pending" | "referral_fulfilled";
  payload: Record<string, unknown>;
  subscription_id: string | null;
  delivery_status: "queued" | "sent" | "failed" | "throttled" | "muted" | "quiet_hours";
  delivery_error: string | null;
  created_at: string;
};

// Custom Domain add-on — append-only audit log. Every state transition
// (attach attempt, verify success / failure, SSL issued, health-check
// failure, disconnect) writes a row here so admin can debug stuck
// domains. Payload is the raw Vercel API response (or our own
// {reason, message} structure for non-Vercel transitions).
export type HammerexCustomDomainEvent = {
  id: number;
  listing_id: string | null;
  domain: string;
  event_type:
    | "attach_attempt"
    | "attach_success"
    | "attach_failed"
    | "verify_attempt"
    | "verify_success"
    | "verify_failed"
    | "ssl_issued"
    | "health_check_ok"
    | "health_check_failed"
    | "dns_lost"
    | "disconnect"
    | "blocked";
  payload: Record<string, unknown> | null;
  created_at: string;
};

// FAQ Page add-on — single Q&A row keyed by ref_code (FAQ-001 / FAQ-002 / …).
// The ref_code is unique per listing and is the human-shareable handle a
// customer types into the URL (#faq-001) or quotes in WhatsApp. Category
// drives the filter chips on the dedicated /<slug>/faq page. Soft-archive
// via status='archived' so old answers never break inbound links.
export type HammerexXratedFaqItem = {
  id: string;
  listing_id: string;
  ref_code: string;
  question: string;
  answer: string;
  category:
    | "general"
    | "pricing"
    | "process"
    | "materials"
    | "trust"
    | "warranty"
    | "aftercare";
  status: "live" | "archived";
  sort_order: number;
  view_count: number;
  created_at: string;
  updated_at: string;
};

// Reference image attached to a FAQ row. Up to 3 per FAQ (DB trigger
// enforced). image_url is a public Supabase Storage URL under the
// shared product-images bucket. title is the headline customers see on
// the lightbox; alt_text is the accessibility caption that doubles as
// the search-engine signal for image SEO.
export type HammerexXratedFaqImage = {
  id: string;
  faq_id: string;
  image_url: string;
  title: string;
  alt_text: string | null;
  sort_order: number;
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

// Quote Pipeline add-on (£5/mo) — minimal CRM for tradies who run
// crews. Tracks quotes per stage (sent / chasing / accepted / lost),
// WhatsApp deep-links, follow-up reminders. No customer login — all
// handoffs go via the tradie's WhatsApp.
export type QuoteStatus = "sent" | "chasing" | "accepted" | "lost";

export type HammerexXratedQuote = {
  id: string;
  listing_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  service_name: string | null;
  quote_amount_pence: number | null;
  status: QuoteStatus;
  follow_up_at: string | null;
  notes: string | null;
  lost_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
  updated_at: string;
};

// Verified Plus (£29.99/mo) — independently verified DBS + insurance +
// trade body memberships. Tier above paid/Verified.
export type VerifiedPlusStatus =
  | "applied"
  | "in_review"
  | "approved"
  | "rejected";

export type HammerexTradeOffVerifiedPlusApplication = {
  id: string;
  listing_id: string;
  applicant_name: string;
  contact_phone: string;
  dbs_doc_url: string | null;
  insurance_doc_url: string | null;
  insurance_amount_pence: number | null;
  trade_body_names: string[] | null;
  trade_body_cert_urls: string[] | null;
  notes: string | null;
  status: VerifiedPlusStatus;
  reviewer_notes: string | null;
  created_at: string;
  decided_at: string | null;
};

// The Yard reactions — Facebook-style emoji per post. One row per
// (post, reactor) — toggling changes the kind, removing deletes the row.
export type YardReactionKind =
  | "like"
  | "dislike"
  | "fire"
  | "lol"
  | "strong"
  | "wow";

export type HammerexTradeOffYardReaction = {
  id: string;
  post_id: string;
  listing_id: string;
  kind: YardReactionKind;
  created_at: string;
};

// The Yard — paid-tier-only trades-to-trades board. Two kinds of post:
//   'available' — sub-contractor advertising availability ("free next
//                 week in Wexford, can do plastering")
//   'needed'    — main-contractor sourcing crew ("need 3 scaffolders
//                 immediate start Monday")
// Free auto-expiry at 14 days keeps the feed fresh. `is_sample=true`
// posts are seeded so the feed never reads empty in pre-liquidity v1 —
// they render with a yellow "Sample" badge so members know.
export type HammerexTradeOffYardPost = {
  id: string;
  listing_id: string;
  kind: "available" | "needed" | "chat" | "product";
  trade_slug: string;
  title: string;
  body: string;
  country: string;
  region: string | null;
  start_date: string | null;
  end_date: string | null;
  crew_size_needed: number | null;
  day_rate_pence: number | null;
  is_sample: boolean;
  status: "live" | "archived";
  parent_id: string | null;
  // Attachments — up to 3 images plus one file (PDF / drawing) plus one
  // external link per post. DB enforces the 3-image cap.
  image_urls: string[];
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_kind: "pdf" | "file" | null;
  link_url: string | null;
  link_title: string | null;
  // Product-kind extras — merchants selling tools / materials to the
  // trade. product_price_pence is the post's listing price (members can
  // override their shop price for a Yard post). source_product_id links
  // back to their Shop Mode catalogue when the post was pre-filled from
  // an existing product (so the composer drawer can round-trip).
  product_price_pence: number | null;
  source_product_id: string | null;
  created_at: string;
  expires_at: string;
};
