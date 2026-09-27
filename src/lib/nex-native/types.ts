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
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
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
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
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
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export interface NexProductVariantInsert {
  product_id: NexUuid;
  name: string;
  price_pence?: number | null;
  position?: number;
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

