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
