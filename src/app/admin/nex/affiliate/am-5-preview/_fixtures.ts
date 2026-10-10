// src/app/admin/nex/affiliate/am-5-preview/_fixtures.ts
//
// AM-5 Rev 4 · Admin Mock Preview · fixtures ONLY.
//
// This file contains STATIC mock data representing the sealed Rev 4
// architecture of nex_affiliate_terms + nex_affiliate_promotion. It
// does not describe the production database. It is never written to
// or read from Supabase. It exists only to drive the admin preview
// UI so the founder can inspect the AM-5 user experience before any
// real AM-5-A implementation is authorized.
//
// Scope wall · this file must NOT:
//   · export anything imported by production affiliate code paths
//   · match the real DB types 1:1 beyond what the UI needs
//   · be referenced from any route outside /admin/nex/affiliate/am-5-preview

export type MockBusinessCategory =
  | "food"
  | "accommodation"
  | "property"
  | "products"
  | "services";

export type MockQualifyingEvent =
  | "paid_order_shipped"
  | "paid_completed_order"
  | "completed_stay"
  | "completed_paid_job";

export type MockReturnsRule =
  | "reverse_on_return"
  | "no_reversal"
  | "partial_reversal"
  | "seller_discretion";

export type MockPublicationSource = "nex_standard_seed" | "owner_published";

/** One mock version row · parallel to nex_affiliate_terms (13 columns). */
export interface MockAffiliateTermsVersion {
  version: number;
  publication_source: MockPublicationSource;
  commission_pct: number;
  settlement_frequency: "weekly" | "monthly";
  qualifying_event: MockQualifyingEvent;
  returns_rule: MockReturnsRule;
  returns_notes: string | null;
  minimum_payout_amount: number | null;
  minimum_payout_currency: string | null;
  published_at: string;      // ISO
  published_by_label: string; // e.g. "Business owner" or "NEX standard seed"
}

/** One mock seller fixture. */
export interface MockAffiliateSeller {
  id: string;
  category: MockBusinessCategory;
  programme_state: "enabled" | "disabled" | "never_enabled" | "excluded";
  display_name: string;
  contact_person: string;
  location_label: string;
  description: string;
  logo_emoji: string;              // placeholder for a logo image in mock
  verified: boolean;
  catalogue_term: string;          // "products" / "dishes" / "rooms" / "services"
  catalogue_count: number;
  thumbnail_glyphs: string[];      // 4 placeholder glyphs
  markets_label: string;           // "UK · EU · Worldwide" or "Yogyakarta · Sleman · Bantul" etc.
  // Full version history for this seller · ORDER matters · [v1, v2, …].
  // Empty array when programme_state is "never_enabled" or "excluded".
  versions: MockAffiliateTermsVersion[];
  // The viewer's promotion state (for the detail view).
  mock_promotion: {
    is_promoting: boolean;
    terms_version_at_start: number | null; // non-null when is_promoting = true
  };
}

// -----------------------------------------------------------------------------
// NEX standard defaults · per category · snapshot of the sealed
// NEX_AFFILIATE_STANDARD_DEFAULTS constant (Rev 4 §3).
// -----------------------------------------------------------------------------
export const MOCK_STANDARD_DEFAULTS = {
  commission_pct: 10,
  settlement_frequency: "weekly" as const,
  by_category: {
    food:          { qualifying_event: "paid_completed_order" as const, returns_rule: "no_reversal" as const },
    accommodation: { qualifying_event: "completed_stay" as const,       returns_rule: "reverse_on_return" as const },
    services:      { qualifying_event: "completed_paid_job" as const,   returns_rule: "seller_discretion" as const },
    products:      { qualifying_event: "paid_order_shipped" as const,   returns_rule: "reverse_on_return" as const },
  },
};

// -----------------------------------------------------------------------------
// Fixtures · five sellers · one per category
// -----------------------------------------------------------------------------

const HAMMEREX_TOOLS: MockAffiliateSeller = {
  id: "mock-products-hammerex",
  category: "products",
  programme_state: "enabled",
  display_name: "Hammerex Tools",
  contact_person: "Philip O'Farrell",
  location_label: "United Kingdom",
  description:
    "Manufacturer of professional construction toolbelts, tool stations and trade accessories.",
  logo_emoji: "🔨",
  verified: true,
  catalogue_term: "products",
  catalogue_count: 24,
  thumbnail_glyphs: ["🔧", "🧰", "🪛", "⚒️"],
  markets_label: "🇬🇧 UK · 🇪🇺 EU · 🌍 Worldwide",
  // Three-version history demonstrating owner edits
  versions: [
    {
      version: 1,
      publication_source: "nex_standard_seed",
      commission_pct: 10,
      settlement_frequency: "weekly",
      qualifying_event: "paid_order_shipped",
      returns_rule: "reverse_on_return",
      returns_notes: null,
      minimum_payout_amount: null,
      minimum_payout_currency: null,
      published_at: "2026-09-15T09:00:00Z",
      published_by_label: "NEX standard seed",
    },
    {
      version: 2,
      publication_source: "owner_published",
      commission_pct: 10,
      settlement_frequency: "monthly",
      qualifying_event: "paid_order_shipped",
      returns_rule: "reverse_on_return",
      returns_notes: "Returns reversed within 30 days of dispatch.",
      minimum_payout_amount: 50,
      minimum_payout_currency: "GBP",
      published_at: "2026-09-20T14:12:00Z",
      published_by_label: "Business owner",
    },
    {
      version: 3,
      publication_source: "owner_published",
      commission_pct: 10,
      settlement_frequency: "monthly",
      qualifying_event: "paid_order_shipped",
      returns_rule: "partial_reversal",
      returns_notes: "50% commission retained on returns within 60 days of dispatch.",
      minimum_payout_amount: 50,
      minimum_payout_currency: "GBP",
      published_at: "2026-10-01T10:30:00Z",
      published_by_label: "Business owner",
    },
  ],
  // The viewer joined at v1 · seller is now on v3 · demonstrates
  // the "Seller updated terms since you joined" state.
  mock_promotion: { is_promoting: true, terms_version_at_start: 1 },
};

const WARUNG_BU_TARI: MockAffiliateSeller = {
  id: "mock-food-warung-bu-tari",
  category: "food",
  programme_state: "enabled",
  display_name: "Warung Bu Tari",
  contact_person: "Bu Tari",
  location_label: "Yogyakarta, Indonesia",
  description:
    "Traditional Javanese dishes · homemade sambal · open for lunch and dinner · delivery across Yogyakarta.",
  logo_emoji: "🍚",
  verified: true,
  catalogue_term: "dishes",
  catalogue_count: 18,
  thumbnail_glyphs: ["🥘", "🍜", "🍲", "🥗"],
  markets_label: "Yogyakarta · Sleman · Bantul",
  versions: [
    {
      version: 1,
      publication_source: "nex_standard_seed",
      commission_pct: 10,
      settlement_frequency: "weekly",
      qualifying_event: "paid_completed_order",
      returns_rule: "no_reversal",
      returns_notes: null,
      minimum_payout_amount: null,
      minimum_payout_currency: null,
      published_at: "2026-09-18T08:00:00Z",
      published_by_label: "NEX standard seed",
    },
  ],
  mock_promotion: { is_promoting: false, terms_version_at_start: null },
};

const BALI_TILE_STONE: MockAffiliateSeller = {
  id: "mock-services-bali-tile-stone",
  category: "services",
  programme_state: "enabled",
  display_name: "Bali Tile & Stone",
  contact_person: "Made Wijaya",
  location_label: "Bali, Indonesia",
  description:
    "Residential + hospitality tile and natural-stone installation · ten years in Bali · insured and licensed.",
  logo_emoji: "🧱",
  verified: true,
  catalogue_term: "services",
  catalogue_count: 12,
  thumbnail_glyphs: ["🛁", "🏊", "🍴", "🏛️"],
  markets_label: "Ubud · Canggu · Seminyak · Sanur",
  versions: [
    {
      version: 1,
      publication_source: "nex_standard_seed",
      commission_pct: 10,
      settlement_frequency: "weekly",
      qualifying_event: "completed_paid_job",
      returns_rule: "seller_discretion",
      returns_notes: null,
      minimum_payout_amount: null,
      minimum_payout_currency: null,
      published_at: "2026-09-25T11:00:00Z",
      published_by_label: "NEX standard seed",
    },
    {
      version: 2,
      publication_source: "owner_published",
      commission_pct: 10,
      settlement_frequency: "monthly",
      qualifying_event: "completed_paid_job",
      returns_rule: "seller_discretion",
      returns_notes: "Case-by-case review for jobs cancelled after site visit.",
      minimum_payout_amount: 500_000,
      minimum_payout_currency: "IDR",
      published_at: "2026-10-02T09:00:00Z",
      published_by_label: "Business owner",
    },
  ],
  mock_promotion: { is_promoting: true, terms_version_at_start: 2 },
};

const BAMBOO_HAVEN: MockAffiliateSeller = {
  id: "mock-accommodation-bamboo-haven",
  category: "accommodation",
  programme_state: "enabled",
  display_name: "Bamboo Haven Resort",
  contact_person: "Reservations Team",
  location_label: "Ubud, Bali",
  description:
    "Boutique eco-resort · 24 private villas · spa · fine dining in the heart of Ubud rice fields.",
  logo_emoji: "🏨",
  verified: true,
  catalogue_term: "rooms",
  catalogue_count: 8,
  thumbnail_glyphs: ["🏞️", "🛏️", "🏊‍♀️", "🧖"],
  markets_label: "Local · International",
  versions: [
    {
      version: 1,
      publication_source: "nex_standard_seed",
      commission_pct: 10,
      settlement_frequency: "weekly",
      qualifying_event: "completed_stay",
      returns_rule: "reverse_on_return",
      returns_notes: null,
      minimum_payout_amount: null,
      minimum_payout_currency: null,
      published_at: "2026-09-28T10:00:00Z",
      published_by_label: "NEX standard seed",
    },
  ],
  mock_promotion: { is_promoting: false, terms_version_at_start: null },
};

const PROPERTY_EXCLUDED: MockAffiliateSeller = {
  id: "mock-property-example-agent",
  category: "property",
  programme_state: "excluded",
  display_name: "Jakarta Property Group",
  contact_person: "Agent Office",
  location_label: "Jakarta, Indonesia",
  description:
    "Residential + commercial property sales and rentals across Greater Jakarta.",
  logo_emoji: "🏘️",
  verified: true,
  catalogue_term: "listings",
  catalogue_count: 46,
  thumbnail_glyphs: ["🏠", "🏢", "🏬", "🏗️"],
  markets_label: "Jakarta · Bogor · Depok · Tangerang · Bekasi",
  versions: [],
  mock_promotion: { is_promoting: false, terms_version_at_start: null },
};

export const MOCK_SELLERS: MockAffiliateSeller[] = [
  HAMMEREX_TOOLS,
  WARUNG_BU_TARI,
  BALI_TILE_STONE,
  BAMBOO_HAVEN,
  PROPERTY_EXCLUDED,
];

export function findMockSellerById(id: string): MockAffiliateSeller | null {
  return MOCK_SELLERS.find((s) => s.id === id) ?? null;
}

// -----------------------------------------------------------------------------
// Display helpers · pure functions · no side effects
// -----------------------------------------------------------------------------

export function qualifyingEventLabel(k: MockQualifyingEvent): string {
  return {
    paid_order_shipped:    "Paid order shipped",
    paid_completed_order:  "Paid completed order",
    completed_stay:        "Completed stay",
    completed_paid_job:    "Completed paid job",
  }[k];
}

export function returnsRuleLabel(k: MockReturnsRule): string {
  return {
    reverse_on_return: "Reverse on return",
    no_reversal:       "No reversal",
    partial_reversal:  "Partial reversal",
    seller_discretion: "Seller discretion",
  }[k];
}

export function publicationSourceLabel(k: MockPublicationSource): string {
  return k === "nex_standard_seed" ? "NEX standard seed" : "Owner published";
}

export function categoryLabel(c: MockBusinessCategory): string {
  return {
    food:          "Food & Dining",
    accommodation: "Accommodation",
    property:      "Property",
    products:      "Products",
    services:      "Services",
  }[c];
}

export function currentVersion(s: MockAffiliateSeller): MockAffiliateTermsVersion | null {
  return s.versions.length > 0 ? s.versions[s.versions.length - 1]! : null;
}
