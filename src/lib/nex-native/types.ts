// src/lib/nex-native/types.ts
//
// NEX-native shared types. Every service exports/imports its own row/insert
// shapes from here to keep the type surface coherent.
//
// Doctrine:
//   · Every ID is a UUID string · never phone/email
//   · Money is bigint minor units (pence/cents) · never float
//   · Currency is ISO-4217 uppercase 3-char code
//   · Timestamps are ISO strings (Supabase JS returns them as string)

/** UUID string · alias for readability. Every FK is one of these. */
export type NexUuid = string;

/** ISO-8601 timestamp string (Supabase-native format). */
export type NexTimestamp = string;

/** ISO-4217 uppercase 3-char currency code. */
export type NexCurrency = string;

// ---------------------------------------------------------------------------
// nex_account
// ---------------------------------------------------------------------------
export interface NexAccountRow {
  id: NexUuid;
  supabase_user_id: NexUuid | null;
  display_name: string;
  /**
   * Public NEX identity handle (nex-XXXXX form · e.g. nex-36474).
   * Permanent · unique · human-readable public identity.
   * The internal relationship key remains `id` (UUID) · handles never
   * replace it in FKs. Nullable in the schema so provisioning does not
   * fail atomically · the session layer guarantees allocation.
   */
  nex_handle: string | null;
  /**
   * Account-scoped chat theme preference · migration 021 · nullable.
   * CHECK-constrained to a known set. null = default theme.
   */
  chat_theme: NexChatTheme | null;
  /** Signup credential attribute · migration 024 · e.g. '+44' · never a relationship key. */
  phone_country_code: string | null;
  /** Signup credential attribute · migration 024 · digits only · 5-15 chars · never a relationship key. */
  phone_national_number: string | null;
  /**
   * Package tier · migration 046 · Indonesia launch (2026-09-27).
   * `gratis` (default), `bisnis` (paid), `pro` (deferred phase 2).
   * Businesses inherit owner-account tier. Use `effectiveTier(account)`
   * from account-service to treat lapsed Bisnis as Gratis.
   */
  tier: NexAccountTier;
  /**
   * Bisnis subscription lapse timestamp · migration 046 · null when
   * never upgraded or currently on gratis. Feature gates lazy-check
   * `now() < bisnis_expires_at` before granting Bisnis features.
   */
  bisnis_expires_at: NexTimestamp | null;
  /** Bridge 56g · one-shot 7-day premium-theme trial · migration 089.
   *  Set once when the buyer taps "Try 7 days free" on any package ·
   *  never reset. Service layer adds 7 days to compute expiry (see
   *  isThemesTrialActive in account-service.ts). One trial per account
   *  lifetime — the anti-abuse gate. */
  themes_trial_used_at: NexTimestamp | null;
  /** Bridge 56g · which package the buyer picked as the on-ramp
   *  (buy | ringan | bisnis) · migration 089 · informational only. */
  themes_trial_package_id: string | null;
  /** Bridge 57 · which paid package the buyer holds · migration
   *  090. NULL = gratis default. Distinct from `tier` (which is
   *  the effective feature gate). Set by admin when payment is
   *  confirmed via the NEX1 support flow. Allowed values are
   *  enforced by nex_account_subscription_plan_known check
   *  constraint. */
  subscription_plan: NexSubscriptionPlan | null;
  /** Bridge 16b · when the user acknowledged the NEX safe-trade
   *  terms via the JIT modal · migration 069. NULL means they
   *  haven't seen the modal yet. Sets the legal basis for saying
   *  "you were warned about off-doctrine payment risks". */
  safe_trade_consent_at: NexTimestamp | null;
  /** Bridge 16b · which terms version they acknowledged · migration
   *  069. Format YYYY-MM-DD matching the doctrine seal date. When
   *  we materially update the doctrine we bump the constant in
   *  safe-trade-consent-service and can re-prompt anyone on an old
   *  version. */
  safe_trade_consent_version: string | null;
  /** Bridge 16d · user locale preference · migration 071. NULL
   *  means "no preference" · resolveLocale() falls back to
   *  Accept-Language + Indonesian market default. Values: 'id',
   *  'en'. Updated via updateAccountLocaleAction. */
  locale: string | null;
  created_at: NexTimestamp;
}

/** Package tier · matches CHECK constraint on nex_account.tier
 *  (migration 046). See CLAUDE.md "NEX PACKAGE DOCTRINE" for the
 *  sealed launch limits and Bisnis unlocks. */
export type NexAccountTier = "gratis" | "bisnis" | "pro";

export const NEX_ACCOUNT_TIERS: readonly NexAccountTier[] = [
  "gratis",
  "bisnis",
  "pro",
] as const;

/** Human-readable tier label · consumed by pricing surfaces and admin
 *  tooling. Localised copy for Indonesia intentionally uses "Gratis"
 *  and "Bisnis" (both direct Bahasa Indonesia loanwords). */
export const NEX_ACCOUNT_TIER_LABEL: Record<NexAccountTier, string> = {
  gratis: "NEX Gratis",
  bisnis: "NEX Bisnis",
  pro: "NEX Pro",
};

/** Bridge 57 · which paid package a buyer holds · matches CHECK
 *  constraint on nex_account.subscription_plan (migration 090).
 *  Distinct from NexAccountTier (feature gate). Values map 1:1
 *  to the pricing ladder on /nex-native/settings/tier. */
export type NexSubscriptionPlan = "buy" | "ringan" | "bisnis" | "custom";

export const NEX_SUBSCRIPTION_PLAN_LABEL: Record<
  NexSubscriptionPlan,
  string
> = {
  buy: "Buy a theme",
  ringan: "Themes Ringan",
  bisnis: "NEX Bisnis",
  custom: "Own Theme Request",
};

/** Known chat theme identifiers · matches migration 021 CHECK. */
export type NexChatTheme = "default" | "titanium" | "pink" | "gold" | "night";
export const NEX_CHAT_THEMES: readonly NexChatTheme[] = [
  "default", "titanium", "pink", "gold", "night",
] as const;

export interface NexAccountInsert {
  supabase_user_id?: NexUuid | null;
  display_name: string;
  phone_country_code?: string | null;
  phone_national_number?: string | null;
}

// ---------------------------------------------------------------------------
// nex_account_profile · migration 042 · Bridge 2 identity/discovery layer
// ---------------------------------------------------------------------------

/** The "what best describes what you do?" onboarding answer set.
 *  Matches the CHECK constraint in migration 042 (with `reseller` added
 *  by migration 044). */
export type NexAccountKind =
  | "professional"
  | "business_owner"
  | "reseller"
  | "student"
  | "seeking_work"
  | "exploring"
  | "other";

export const NEX_ACCOUNT_KINDS: readonly NexAccountKind[] = [
  "professional",
  "business_owner",
  "reseller",
  "student",
  "seeking_work",
  "exploring",
  "other",
] as const;

/** Human-readable label per kind · consumed by the onboarding UI and the
 *  settings/profile editor. Keep short · these render as chips/buttons. */
export const NEX_ACCOUNT_KIND_LABEL: Record<NexAccountKind, string> = {
  professional: "I have a profession",
  business_owner: "I run a business",
  reseller: "I resell products",
  student: "I'm a student",
  seeking_work: "I'm looking for work",
  exploring: "I'm exploring / between professions",
  other: "Something else",
};

/** Bridge 39 · structured day-to-day status · migration 086.
 *  Cascading follow-up fields live in daily_activity_detail. */
export type NexDailyActivity =
  | "student"
  | "self_employed"
  | "company_employee"
  | "unemployed"
  | "other";

export const NEX_DAILY_ACTIVITIES: readonly NexDailyActivity[] = [
  "student",
  "self_employed",
  "company_employee",
  "unemployed",
  "other",
] as const;

export const NEX_DAILY_ACTIVITY_LABEL: Record<NexDailyActivity, string> = {
  student: "Student",
  self_employed: "Self-employed",
  company_employee: "Company employee",
  unemployed: "Unemployed",
  other: "Other",
};

/** Per-activity follow-up shape · free-form so it can evolve without
 *  migrations. Every field optional; empty string becomes undefined. */
export interface NexDailyActivityDetail {
  // student
  field_of_study?: string;
  institution?: string;
  year?: string;
  // self_employed
  business?: string;
  industry?: string;
  // company_employee
  company?: string;
  role?: string;
  // unemployed
  seeking?: string;
  since_month?: string;
  // other
  note?: string;
}

export interface NexAccountProfileRow {
  account_id: NexUuid;
  kind: NexAccountKind | null;
  headline: string | null;
  bio: string | null;
  profession: string | null;
  skills: string[];
  location_label: string | null;
  looking_for: string[];
  is_public: boolean;
  /** Public URL of the account's profile image · uploaded to the
   *  nex-avatars Supabase Storage bucket · nullable · UI falls back
   *  to initials when null. Migration 045. */
  avatar_url: string | null;
  /** Bridge 39 · migration 086 · structured occupation. Null when
   *  unset · one of NEX_DAILY_ACTIVITIES otherwise. */
  daily_activity: NexDailyActivity | null;
  /** Bridge 39 · migration 086 · cascading follow-up fields · shape
   *  depends on daily_activity. Never null · defaults to {} on DB. */
  daily_activity_detail: NexDailyActivityDetail;
  /** Bridge 41 · migration 086 · true only when the current avatar
   *  was captured through the live-camera + MediaPipe flow (Bridge
   *  40, deferred). Combined with a completed daily_activity, drives
   *  the Verified Personal ✓ tick. File-upload paths leave false. */
  avatar_face_verified: boolean;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

/** Insert shape · account_id required, everything else optional (defaults
 *  applied by the DB or the service layer). */
export interface NexAccountProfileInsert {
  account_id: NexUuid;
  kind?: NexAccountKind | null;
  headline?: string | null;
  bio?: string | null;
  profession?: string | null;
  skills?: string[];
  location_label?: string | null;
  looking_for?: string[];
  is_public?: boolean;
  avatar_url?: string | null;
  daily_activity?: NexDailyActivity | null;
  daily_activity_detail?: NexDailyActivityDetail;
  avatar_face_verified?: boolean;
}

/** Patch shape · every field optional · empty string is normalised to null
 *  by the service layer to explicitly clear a text field. */
export interface NexAccountProfilePatch {
  kind?: NexAccountKind | null;
  headline?: string | null;
  bio?: string | null;
  profession?: string | null;
  skills?: string[];
  location_label?: string | null;
  looking_for?: string[];
  is_public?: boolean;
  avatar_url?: string | null;
  daily_activity?: NexDailyActivity | null;
  daily_activity_detail?: NexDailyActivityDetail;
  avatar_face_verified?: boolean;
}

/** Bridge 41 · derived predicate · pure function so any surface can
 *  compute the "Verified Personal ✓" tick from a profile row without
 *  duplicating the AND logic. Both conditions must hold:
 *    1. Avatar was captured via the live-camera flow (Bridge 40)
 *    2. daily_activity is set (Bridge 39)
 *  Callers that need the tick should read this instead of hand-rolling
 *  the check. */
export function isPersonalVerified(
  profile: Pick<NexAccountProfileRow, "avatar_face_verified" | "daily_activity"> | null,
): boolean {
  if (!profile) return false;
  return profile.avatar_face_verified && profile.daily_activity !== null;
}

/** Length limits mirror the migration 042 CHECK constraints so the service
 *  layer rejects oversized input before the DB does. */
export const NEX_PROFILE_HEADLINE_MAX = 120;
export const NEX_PROFILE_BIO_MAX = 1000;
export const NEX_PROFILE_PROFESSION_MAX = 80;
export const NEX_PROFILE_LOCATION_LABEL_MAX = 120;
export const NEX_PROFILE_SKILLS_MAX = 20;
export const NEX_PROFILE_LOOKING_FOR_MAX = 10;
/** Per-element length cap for skill/looking_for entries · app-side only
 *  (DB does not enforce per-element length). */
export const NEX_PROFILE_ARRAY_ELEMENT_MAX = 40;

/** Bridge 80 · migration 095 · display_name bounds. Emoji allowed
 *  (Unicode code points via char_length) · only length is enforced
 *  so bubbles + identity headers render predictably. Mirror this
 *  range on the client so the character counter matches the DB
 *  reality. */
export const NEX_DISPLAY_NAME_MIN = 2;
export const NEX_DISPLAY_NAME_MAX = 40;

// ---------------------------------------------------------------------------
// nex_business
// ---------------------------------------------------------------------------
/** Weekly hours · migration 031 · null on any day = closed · one interval
 *  per day (split shifts deferred). HH:MM 24-hour clock · local time of the
 *  business (timezone column TBD). */
export type NexDayHours = { open: string; close: string } | null;
export interface NexWeeklyHours {
  mon: NexDayHours;
  tue: NexDayHours;
  wed: NexDayHours;
  thu: NexDayHours;
  fri: NexDayHours;
  sat: NexDayHours;
  sun: NexDayHours;
}
export const NEX_WEEK_DAYS: readonly (keyof NexWeeklyHours)[] = [
  "mon", "tue", "wed", "thu", "fri", "sat", "sun",
] as const;

export type NexBusinessMarketReach = "both" | "export_only" | "local_only";

export type NexBusinessSellerKind = "private" | "registered_company";

/** Bridge 21 · Return-policy canonical vocabularies + type. */
export const NEX_RETURN_REASONS = [
  "defective",
  "wrong_item",
  "not_as_described",
  "damaged_in_transit",
  "changed_mind",
  "sized_wrong",
  "arrived_late",
] as const;
export type NexReturnReason = (typeof NEX_RETURN_REASONS)[number];

export const NEX_RETURN_SHIPPING_PAID_BY = [
  "buyer",
  "seller",
  "split",
  "buyer_unless_defective",
] as const;
export type NexReturnShippingPaidBy =
  (typeof NEX_RETURN_SHIPPING_PAID_BY)[number];

export const NEX_RETURN_LEGAL_MIN_WINDOW_DAYS = 7 as const;
export const NEX_RETURN_LEGAL_MIN_REFUND_DAYS = 3 as const;

export interface NexReturnPolicy {
  accepts_returns: boolean;
  window_days: number;
  refund_days: number;
  accepts_reasons: NexReturnReason[];
  shipping_paid_by: NexReturnShippingPaidBy;
  restocking_fee_percent: number;
  non_returnable: string[];
  notes: string | null;
}

/** Default policy that matches UU No 8/1999 minimums · used when a
 *  business row has no policy stored (shouldn't happen after
 *  migration 076 but defensive). */
export const NEX_RETURN_POLICY_DEFAULT: NexReturnPolicy = {
  accepts_returns: true,
  window_days: NEX_RETURN_LEGAL_MIN_WINDOW_DAYS,
  refund_days: NEX_RETURN_LEGAL_MIN_REFUND_DAYS,
  accepts_reasons: [
    "defective",
    "wrong_item",
    "not_as_described",
    "damaged_in_transit",
  ],
  shipping_paid_by: "buyer_unless_defective",
  restocking_fee_percent: 0,
  non_returnable: [],
  notes: null,
};

export interface NexBusinessRow {
  id: NexUuid;
  owner_account_id: NexUuid;
  display_name: string;
  slug: string;
  /** Merchant-editable profile fields · all nullable · added by migration 014. */
  description: string | null;
  logo_url: string | null;
  /** Structured weekly hours · reshaped from text to jsonb by migration 031. */
  hours: NexWeeklyHours | null;
  address: string | null;
  public_phone: string | null;
  public_email: string | null;
  website_url: string | null;
  /** Offline-payment fields · migration 018 · Founder doctrine sealed 2026-09-24. */
  payment_instructions: string | null;
  accepts_cod: boolean;
  accepts_pickup: boolean;
  /** Optional short status message · migration 022 · max 200 chars · nullable. */
  status_message: string | null;
  /** Optional TTL for status_message · migration 022 · nullable · consumers filter past-expiry. */
  status_message_expires_at: NexTimestamp | null;
  /** Market reach · migration 060 · declares whether the shop serves
   *  local buyers, export buyers, or both. Drives Directory search
   *  filtering + the reach bullets on the public shop landing.
   *  Defaults to 'both' at the DB level so existing rows stay
   *  visible everywhere. */
  market_reach: NexBusinessMarketReach;
  /** Bridge 14 · vertical · migration 065. One of the 19
   *  NEX_BUSINESS_CATEGORIES from site-templates.ts, or NULL when
   *  the seller hasn't picked yet · Directory treats NULL as
   *  uncategorised. */
  business_category: string | null;
  /** Bridge 14 · per-shop discovery terms · migration 065.
   *  Complements product tags for service businesses that have
   *  no products of their own to tag. */
  search_keywords: string[] | null;
  /** Bridge 16a · buyer-safety chips the seller supports · migration
   *  068. Subset of NEX_PAYMENT_METHODS from business-service. Default
   *  ['cod'] · every shop starts COD-only, seller opts into more
   *  from /manage/shop. Doctrine: NEX never handles payments · buyer
   *  is always safe. */
  accepted_payment_methods: string[];
  /** Bridge 16e · single-line city / neighbourhood · migration 072.
   *  Shown on the About panel with a 📍 pin. Free-text 1-80 chars
   *  when set. Directory facet reads this via lower(city) index. */
  city: string | null;
  /** Bridge 16e · human-readable opening hours · migration 072.
   *  Free-text 0-200 chars ("Mon-Sat 9am-6pm · closed Sunday").
   *  Complements the structured nex_business.hours JSONB. */
  hours_display: string | null;
  /** Bridge 17d · seller has explicitly committed to NEX safe-trade
   *  practices · migration 073. Default false · seller opts in from
   *  /manage/shop. Drives the compact TradeAgreementCard binary
   *  message in every commerce chat. */
  safe_trade_activated: boolean;
  /** Bridge 21 · seller return policy · migration 076. JSONB with
   *  Indonesian legal-min defaults (7-day window, 3-day refund,
   *  defective/wrong-item/not-as-described/damaged-in-transit
   *  auto-accepted). Rendered on /[shop]/returns + a small link
   *  on every product page. Seller edits inline on /manage/shop. */
  return_policy: NexReturnPolicy;
  /** Bridge 13 · Responsiveness signals · migration 063.
   *  last_seller_activity_at drives the graduated status badge on
   *  every shop landing (active · slow · away · archived). Bumped
   *  by peer-message-service on every seller send. Archived rows
   *  disappear from Directory search until the seller reactivates. */
  last_seller_activity_at: NexTimestamp;
  is_away: boolean;
  away_until: NexTimestamp | null;
  away_message: string | null;
  archived_at: NexTimestamp | null;
  /** Seller detail fields · migration 061 · every field powers a
   *  row in the About overlay on the public shop page. Booleans
   *  default false, languages default to ['id'] Indonesian,
   *  seller_kind default 'private', text fields default NULL. */
  year_established: number | null;
  staff_count: string | null;
  samples_available: boolean;
  accepts_oem: boolean;
  min_order_quantity: string | null;
  local_postage_included: boolean;
  seller_kind: NexBusinessSellerKind;
  languages: string[];
  additional_details: string | null;
  /** Social handles · migration 026 · all nullable · stored WITHOUT leading @. */
  instagram_handle: string | null;
  facebook_handle: string | null;
  tiktok_handle: string | null;
  linkedin_handle: string | null;
  x_handle: string | null;
  /** Bridge 23b · Restaurant / cafe / bar event-hosting profile ·
   *  migration 080. Renders as a "Book this venue" panel under About
   *  Us on the buyer page when any field is set. */
  events_profile: NexBusinessEventsProfile;
  /** Bridge 23b · Up to 6 photo URLs of the venue itself · dining
   *  room · private space · sound stage · outdoor catering setup.
   *  Empty array when the seller hasn't uploaded any. */
  venue_gallery: string[];
  /** Bridge 25c · WGS84 lat/lng of the seller pickup point ·
   *  migration 082. Used by the /cart bike-delivery estimator to
   *  compute distance to the buyer's browser geolocation. NULL means
   *  the seller hasn't disclosed a location · cart falls back to
   *  "confirm delivery in chat". */
  location_lat: number | null;
  location_lng: number | null;
  /** Bridge 30 · Admin-set verification signal · migration 083.
   *  NULL when unverified · timestamp when an admin has confirmed the
   *  shop is a real trading entity. Drives the "Business" tab
   *  visibility on /nex-native/chat (verified only). */
  verified_at: NexTimestamp | null;
  /** Bridge 30 · Admin-only note about the verification event ·
   *  migration 083. Never shown to buyers. */
  verified_note: string | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export interface NexBusinessEventsProfile {
  hosts_parties?: boolean;
  seat_capacity?: number | null;
  outside_catering?: boolean;
  has_live_music_or_dj?: boolean;
  can_book_private_party?: boolean;
  has_sound_system_pa?: boolean;
  other_event_info?: string | null;
}

export const NEX_BUSINESS_EVENTS_EMPTY: NexBusinessEventsProfile = {
  hosts_parties: false,
  seat_capacity: null,
  outside_catering: false,
  has_live_music_or_dj: false,
  can_book_private_party: false,
  has_sound_system_pa: false,
  other_event_info: null,
};

/** Bridge 23b · Categories that get the Events profile UI. Cafes and
 *  bars also host parties · the concept isn't restaurant-exclusive. */
export const NEX_VENUE_CATEGORIES = [
  "restaurant",
  "cafe",
  "ice-cream",
  "dessert-shop",
  "drinks-shop",
  "juice-bar",
  "bar",
  "nightclub",
  "event-space",
  "hotel",
] as const;

export function isVenueCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return (NEX_VENUE_CATEGORIES as readonly string[]).includes(category);
}

export interface NexBusinessInsert {
  owner_account_id: NexUuid;
  display_name: string;
  slug: string;
}

/** Merchant-editable profile fields · every field is optional · empty string
 *  is normalised to null by the service layer · null explicitly clears. */
export interface NexBusinessProfilePatch {
  description?: string | null;
  logo_url?: string | null;
  address?: string | null;
  public_phone?: string | null;
  public_email?: string | null;
  website_url?: string | null;
  payment_instructions?: string | null;
  accepts_cod?: boolean;
  accepts_pickup?: boolean;
  status_message?: string | null;
  status_message_expires_at?: string | null;
  instagram_handle?: string | null;
  facebook_handle?: string | null;
  tiktok_handle?: string | null;
  linkedin_handle?: string | null;
  x_handle?: string | null;
}

// ---------------------------------------------------------------------------
// nex_product
// ---------------------------------------------------------------------------
export type NexProductStatus = "draft" | "live" | "archived";

/** Optional stock signal to buyers · matches migration 023 CHECK. */
export type NexProductStockStatus = "in_stock" | "low_stock" | "made_to_order" | "sold_out";
export const NEX_PRODUCT_STOCK_STATUSES: readonly NexProductStockStatus[] = [
  "in_stock", "low_stock", "made_to_order", "sold_out",
] as const;

export interface NexProductRow {
  id: NexUuid;
  business_id: NexUuid;
  name: string;
  description: string | null;
  /** Primary product image URL · migration 015 · nullable · http(s) prefix required. */
  image_url: string | null;
  /** Optional gallery of additional image URLs · migration 016 · max 10 entries · nullable. */
  gallery_urls: string[] | null;
  /** Optional slug-style discovery tags · migration 017 · max 20 entries · nullable · lowercase pattern. */
  tags: string[] | null;
  /** Optional stock signal · migration 023 · null = no claim. */
  stock_status: NexProductStockStatus | null;
  /** Optional merchant SKU · migration 030 · ≤50 · [A-Za-z0-9._-] · unique per business (case-insensitive). */
  sku: string | null;
  price_pence: number;
  currency: NexCurrency;
  status: NexProductStatus;
  /** Bridge 13c · migration 064 · free-form buyer-facing text for
   *  turnaround expectations. Both nullable · empty simply doesn't
   *  render on the product page. */
  dispatch_time: string | null;
  sample_request_time: string | null;
  /** Bridge 20 · migration 075 · structured Specifications block ·
   *  rendered as the buyer-facing Specifications section on the
   *  product detail page. Open schema · every reader defensively
   *  parses expected keys. */
  spec: NexProductSpec;
  /** Category Tabs sealed 2026-09-30 · migration 107 · optional FK to
   *  nex_product_section for the buyer-facing category tab bar. NULL =
   *  "uncategorised" · appears only under the "All" tab. */
  section_id?: NexUuid | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

/** Bridge 20 · Structured Specifications block stored as JSONB on
 *  nex_product.spec. Every field is optional · empty keys don't
 *  render on the buyer detail page. Common across physical goods ·
 *  vertical-specific keys documented in comments. */
export interface NexProductSpec {
  /* --- Universal (physical goods) ------------------------------- */
  condition?: "new" | "used" | "refurbished" | "vintage" | "new_old_stock";
  origin?: string; // "Yogyakarta, Indonesia" · "Germany"
  brand?: string;
  model?: string;
  authenticity?:
    | "verified_original"
    | "authenticated_vintage"
    | "reproduction"
    | "unspecified";
  materials?: string[];
  dimensions?: {
    w?: number;
    h?: number;
    d?: number;
    unit?: "mm" | "cm" | "m" | "in";
  };
  weight?: {
    value?: number;
    unit?: "g" | "kg" | "oz" | "lb";
  };
  included?: string[]; // "camera body" · "leather case" · "manual"
  warranty?: string; // "6 months manufacturer"
  certifications?: string[]; // ["SNI-4523", "CE", "RoHS", "halal"]
  age_rating?: string; // "3+ years" · "adult"
  year_produced?: number;
  care_instructions?: string;

  /* --- Services (salon / beauty / fitness / consultant / agency) - */
  duration?: string; // "1 hour" · "60-90 minutes"
  service_location?:
    | "at_home"
    | "at_shop"
    | "online"
    | "outdoor"
    | "custom";
  advance_booking?: string; // "24 hours notice"
  age_range?: string; // "any age" · "18+"

  /* --- Manufacturers (product-brand / construction / staircase) - */
  hs_code?: string; // Harmonized System customs code
  export_markets?: string[]; // ISO country codes ["ID", "SG", "MY"]
  factory_location?: string;
  production_capacity?: string; // "500 units/month"
  lead_time?: string; // "4-6 weeks"

  /* --- Freeform extras · seller controls schema per shop --------- */
  additional?: Record<string, string>;
}

export interface NexProductInsert {
  business_id: NexUuid;
  name: string;
  description?: string | null;
  image_url?: string | null;
  gallery_urls?: string[] | null;
  tags?: string[] | null;
  stock_status?: NexProductStockStatus | null;
  sku?: string | null;
  price_pence: number;
  currency: NexCurrency;
  status?: NexProductStatus;
  dispatch_time?: string | null;
  sample_request_time?: string | null;
}

// ---------------------------------------------------------------------------
// nex_product_variant · migration 035 · Slice 6c MVP
// ---------------------------------------------------------------------------
export interface NexProductVariantRow {
  id: NexUuid;
  product_id: NexUuid;
  name: string;
  /** Nullable · when set, this variant sells at price_pence instead of parent product price. */
  price_pence: number | null;
  position: number;
  /** Bridge 20 · migration 075 · typed variant axis. Groups the
   *  variant so the buyer picker renders separate rows per attribute
   *  instead of a flat list. NULL for legacy variants (flat fallback). */
  attribute: NexVariantAttribute | null;
  /** Bridge 20 · migration 075 · per-variant stock override. When
   *  NULL the product-level stock_status applies. */
  stock_status: NexProductStockStatus | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export const NEX_VARIANT_ATTRIBUTES = [
  "size",
  "colour",
  "material",
  "package",
  "duration",
  "style",
  "finish",
  "fit",
  "pack_size",
  "other",
] as const;
export type NexVariantAttribute = (typeof NEX_VARIANT_ATTRIBUTES)[number];

export interface NexProductVariantInsert {
  product_id: NexUuid;
  name: string;
  price_pence?: number | null;
  position?: number;
  attribute?: NexVariantAttribute | null;
  stock_status?: NexProductStockStatus | null;
}

// ---------------------------------------------------------------------------
// nex_conversation + participant + message
// ---------------------------------------------------------------------------
export interface NexConversationRow {
  id: NexUuid;
  business_id: NexUuid;
  about_product_id: NexUuid | null;
  created_at: NexTimestamp;
}

export interface NexConversationInsert {
  business_id: NexUuid;
  about_product_id?: NexUuid | null;
}

export type NexParticipantSide = "business" | "customer";

export interface NexConversationParticipantRow {
  conversation_id: NexUuid;
  account_id: NexUuid;
  side: NexParticipantSide;
  joined_at: NexTimestamp;
  last_read_at: NexTimestamp | null;
}

export interface NexConversationParticipantInsert {
  conversation_id: NexUuid;
  account_id: NexUuid;
  side: NexParticipantSide;
}

export interface NexMessageRow {
  id: NexUuid;
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  body: string;
  created_at: NexTimestamp;
}

export interface NexMessageInsert {
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  body: string;
}

// ---------------------------------------------------------------------------
// nex_order + event
// ---------------------------------------------------------------------------
export type NexOrderState =
  | "created"
  | "pending"
  | "paid"
  | "completed"
  | "cancelled"
  | "refunded";

export interface NexOrderRow {
  id: NexUuid;
  customer_account_id: NexUuid;
  business_id: NexUuid;
  product_id: NexUuid;
  source_conversation_id: NexUuid | null;
  state: NexOrderState;
  price_pence: number;
  currency: NexCurrency;
  idempotency_key: string | null;
  /** Optional buyer note attached at placement · migration 019 · max 500 chars. */
  customer_note: string | null;
  /** Optional merchant note visible only to seller · migration 020 · max 500. */
  merchant_note?: string | null;
  /** Optional merchant dispatch/tracking URL · migration 032 · ≤1024 · null when unset. */
  dispatch_tracking_url: string | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export interface NexOrderInsert {
  customer_account_id: NexUuid;
  business_id: NexUuid;
  product_id: NexUuid;
  source_conversation_id?: NexUuid | null;
  state?: NexOrderState;
  price_pence: number;
  currency: NexCurrency;
  idempotency_key?: string | null;
  customer_note?: string | null;
}

export interface NexOrderEventRow {
  id: NexUuid;
  order_id: NexUuid;
  event: string;
  actor_account_id: NexUuid | null;
  metadata: Record<string, unknown>;
  created_at: NexTimestamp;
}

export interface NexOrderEventInsert {
  order_id: NexUuid;
  event: string;
  actor_account_id?: NexUuid | null;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// nex_ledger_entry + line
// ---------------------------------------------------------------------------
export interface NexLedgerEntryRow {
  id: NexUuid;
  order_id: NexUuid | null;
  description: string;
  reversal_of_entry_id: NexUuid | null;
  created_at: NexTimestamp;
}

export interface NexLedgerLineRow {
  id: NexUuid;
  entry_id: NexUuid;
  account: string;
  debit_pence: number;
  credit_pence: number;
  currency: NexCurrency;
  created_at: NexTimestamp;
}

/** Balanced-entry input: caller provides lines · service enforces balance
 * (sum debits = sum credits) before insert. */
export interface NexLedgerEntryInput {
  order_id?: NexUuid | null;
  description: string;
  reversal_of_entry_id?: NexUuid | null;
  lines: Array<{
    account: string;
    debit_pence?: number;
    credit_pence?: number;
    currency: NexCurrency;
  }>;
}

// ---------------------------------------------------------------------------
// nex_live_post · Live phase-1 announcements · migration 029
// ---------------------------------------------------------------------------
export interface NexLivePostRow {
  id: NexUuid;
  business_id: NexUuid;
  body: string;
  expires_at: NexTimestamp | null;
  created_at: NexTimestamp;
}

export interface NexLivePostInsert {
  business_id: NexUuid;
  body: string;
  expires_at?: NexTimestamp | null;
}

