// src/lib/nexapp/mockBusinessHome.ts · Philip 2026-09-05
//
// Mock data for the NEX BUSINESS SECTION M0 · Business Home workspace.
//
// EXPLICIT BOUNDARY (per §26-29 of the authorizing spec):
//   · Zero DB · zero .env · zero workforce activation · zero taxonomy runtime access
//   · Zero real messages sent · zero fake AI · zero fake counters
//   · Demo company (PT Fresh on Time Seafood) is DEMO ONLY · never real customer
//     contact without explicit agreement per Business/Marketing doctrine
//   · Marketing campaign preview shows STRUCTURED INTENT ONLY · no execution
//
// The Business Home reads:
//   · the demo owner-company profile from this file
//   · Products count via a small helper (mock · from NexWorkspaceProducts pool later
//     · for M0 we hard-code the visible count to match MOCK_PRODUCTS)
//   · Business Contacts count via same MOCK_BUSINESS_CONTACTS used by ContactsPanel
//   · Conversations count = 0 (universal chat isn't populated for business yet)
//
// When real business identity persistence lands (a future authorized slice · needs
// a `business_profile` table + reads from `nex_taxonomy`), replace this file's
// exports with fetched data · the component doesn't need to change.

import { MOCK_BUSINESS_CONTACTS } from "@/lib/nexapp/mockContacts";

// ── Company profile (demo · PT Fresh on Time Seafood) ─────────────────

export interface DemoCompanyProfile {
  id: string;
  legalName: string;
  displayName: string;
  industryLabel: string;              // owner-facing · not taxonomy id
  industryTaxonomyHint: string;       // for eventual T3 wiring · not consumed today
  homeCountryCode: string;            // ISO 3166-1 alpha-2 · from Market registry vocabulary
  homeCountryLabel: string;
  homeCity: string;
  targetMarkets: ReadonlyArray<{
    code: string;                     // ISO 3166-1 alpha-2 (aligns with T1 markets table)
    label: string;
    flag: string;
    firstClass: boolean;              // Japan first_class · surfaced to owner subtly
  }>;
  objectives: ReadonlyArray<string>;  // short calm phrases · not marketing jargon
  ownerLanguage: "id" | "en" | "ja";  // owner_language ≠ target_market_language
  ownerCurrency: "IDR" | "JPY" | "USD" | "EUR" | "GBP" | "SGD" | "AUD";
  createdAt: string;
  aboutShort: string;                 // one calm sentence
}

export const DEMO_COMPANY: DemoCompanyProfile = {
  id: "biz-fresh-on-time-seafood",
  legalName: "PT Fresh on Time Seafood",
  displayName: "Fresh on Time Seafood",
  industryLabel: "Seafood · Food & Beverage",
  industryTaxonomyHint: "food.seafood",
  homeCountryCode: "ID",
  homeCountryLabel: "Indonesia",
  homeCity: "Jakarta",
  targetMarkets: [
    { code: "JP", label: "Japan",         flag: "🇯🇵", firstClass: true  },
    { code: "US", label: "United States", flag: "🇺🇸", firstClass: false },
    { code: "DE", label: "Europe",        flag: "🇪🇺", firstClass: false },
  ],
  objectives: [
    "International buyers for frozen seafood",
    "Long-term business relationships with importers",
    "Reliable international suppliers",
  ],
  ownerLanguage: "id",
  ownerCurrency: "IDR",
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  aboutShort:
    "Indonesian seafood processor and exporter. Frozen tuna, shrimp, crab, squid. Serving international buyers.",
};

// ── Business Home section metadata ────────────────────────────────────
// Each card describes ONE surface. `destination` is either:
//   · `swap:<artifact>` → NexAppShell swaps to that existing workspace
//   · `screen:<name>`   → navigates to an internal screen inside Business Home
//   · null              → future · card is a calm "Coming next" tile

export type BusinessSectionDestination =
  | { kind: "swap"; artifact: string }
  | { kind: "screen"; name: BusinessScreen }
  | { kind: "future" };

export type BusinessScreen =
  | "home"
  | "company"
  | "marketing"
  | "campaign-review"
  | "customers"
  | "quotes";

export interface BusinessSection {
  id: string;
  label: string;
  icon: string;                     // emoji or short text glyph
  hint: string;                     // short honest one-line
  status: "ready" | "empty" | "future" | "connected";
  destination: BusinessSectionDestination;
}

/** Live count helpers · deliberately tiny · never fabricate activity */

export function productsCountHint(): number {
  // Matches MOCK_PRODUCTS in NexWorkspaceProducts (4 demo items)
  // Kept in sync manually · not imported to avoid coupling client bundles
  return 4;
}

export function businessContactsCountHint(): number {
  return MOCK_BUSINESS_CONTACTS.length;
}

export function conversationsCountHint(): number {
  // Business conversations = 0 in M0 · universal chat isn't wired for business yet
  return 0;
}

export function customersCountHint(): number {
  return 0;
}

/**
 * Section metadata for M0. Emphasis (per Philip's adjustment):
 *   · Products + My Company = the STRONGEST cards (things owner meets today).
 *   · Business Contacts + Conversations = CONNECTED (wired to existing NEX surfaces).
 *   · Marketing + Customers + Quotes = clearly FUTURE (never fake AI · never claim
 *     activity that doesn't exist).
 * `emphasis` field is consumed by the workspace renderer to choose visual weight.
 */
export type BusinessSectionEmphasis = "primary" | "connected" | "future";

export interface BusinessSection2 extends BusinessSection {
  emphasis: BusinessSectionEmphasis;
}

export function sectionsForHome(): ReadonlyArray<BusinessSection2> {
  return [
    {
      id: "my-company",
      label: "My Company",
      icon: "🏢",
      hint: "Not set up yet",
      status: "empty",
      emphasis: "primary",
      destination: { kind: "screen", name: "company" },
    },
    {
      id: "products",
      label: "Products",
      icon: "🛍",
      hint: `${productsCountHint()} in catalogue`,
      status: "connected",
      emphasis: "primary",
      destination: { kind: "swap", artifact: "products" },
    },
    {
      id: "business-contacts",
      label: "Business Contacts",
      icon: "🏢",
      hint: `${businessContactsCountHint()} contacts`,
      status: "connected",
      emphasis: "connected",
      destination: { kind: "swap", artifact: "messages-contacts" },
    },
    {
      id: "conversations",
      label: "Conversations",
      icon: "💬",
      hint: "Open NEX chat",
      status: "connected",
      emphasis: "connected",
      destination: { kind: "swap", artifact: "messages-friends" },
    },
    {
      id: "marketing",
      label: "Marketing",
      icon: "📣",
      hint: "First campaign · Coming next",
      status: "future",
      emphasis: "future",
      destination: { kind: "screen", name: "marketing" },
    },
    {
      id: "customers",
      label: "Customers",
      icon: "👥",
      hint: `${customersCountHint()} customers yet · Coming next`,
      status: "future",
      emphasis: "future",
      destination: { kind: "screen", name: "customers" },
    },
    {
      id: "quotes",
      label: "Quotes",
      icon: "📄",
      hint: "Coming next",
      status: "future",
      emphasis: "future",
      destination: { kind: "screen", name: "quotes" },
    },
  ];
}

// ── Marketing conversational suggestions ──────────────────────────────
// Calm phrases in owner language · never technical mode names · per §12

export interface MarketingSuggestion {
  id: string;
  text: string;               // owner-facing phrasing
  parsed: MarketingIntent;    // pre-computed structured intent · for M0 demo
}

/**
 * Owner-facing structured intent · calm labels · never technical.
 * A future Marketing Employee will populate this from a real NLU parse.
 * For M0 the suggestions are pre-parsed as demo state.
 */
export interface MarketingIntent {
  productHint: string;             // e.g. "Seafood"
  taxonomyHint: string | null;     // e.g. "food.seafood" · future T3 wiring
  marketCountryCode: string;       // ISO 3166-1 alpha-2
  marketLabel: string;             // e.g. "Japan"
  audienceLabel: string;           // e.g. "Potential seafood buyers"
  campaignType: "LOCAL" | "NATIONAL" | "INTERNATIONAL_B2B";
  quantityHint: number | null;
  channelsHint: string[];          // e.g. ["Email (with prior consent)", "NEX in-app"]
  ownerRequest: string;            // verbatim owner phrasing
}

export const MARKETING_SUGGESTIONS: ReadonlyArray<MarketingSuggestion> = [
  {
    id: "japan-100",
    text: "Introduce our seafood company to 100 potential buyers in Japan.",
    parsed: {
      productHint: "Frozen Seafood",
      taxonomyHint: "food.seafood",
      marketCountryCode: "JP",
      marketLabel: "Japan",
      audienceLabel: "Importers · Distributors · Wholesalers",
      campaignType: "INTERNATIONAL_B2B",
      quantityHint: 100,
      channelsHint: ["Email (with prior consent)", "NEX in-app"],
      ownerRequest: "Introduce our seafood company to 100 potential buyers in Japan.",
    },
  },
  {
    id: "europe-importers",
    text: "Help introduce our seafood to European importers.",
    parsed: {
      productHint: "Frozen Seafood",
      taxonomyHint: "food.seafood",
      marketCountryCode: "DE",
      marketLabel: "Europe",
      audienceLabel: "Seafood importers · Wholesale distributors",
      campaignType: "INTERNATIONAL_B2B",
      quantityHint: null,
      channelsHint: ["Email (with prior consent)", "NEX in-app"],
      ownerRequest: "Help introduce our seafood to European importers.",
    },
  },
  {
    id: "yogya-local",
    text: "Get more customers around Yogyakarta.",
    parsed: {
      productHint: "Restaurant · Seafood dining",
      taxonomyHint: "food.restaurant",
      marketCountryCode: "ID",
      marketLabel: "Indonesia",
      audienceLabel: "Local consumers · Restaurant discovery",
      campaignType: "LOCAL",
      quantityHint: null,
      channelsHint: ["NEX in-app", "Social (owner-authorised)"],
      ownerRequest: "Get more customers around Yogyakarta.",
    },
  },
  {
    id: "how-going",
    text: "Show me how our marketing is going.",
    parsed: {
      productHint: "(all products)",
      taxonomyHint: null,
      marketCountryCode: "",
      marketLabel: "(all markets)",
      audienceLabel: "(existing campaigns)",
      campaignType: "INTERNATIONAL_B2B",
      quantityHint: null,
      channelsHint: [],
      ownerRequest: "Show me how our marketing is going.",
    },
  },
];

// ── Owner-facing empty state copy (calm employee tone) ────────────────

export const COPY = {
  headerTitle: "My Business",
  headerSubtitle: (name: string) => name,

  primaryPromptTitle: "What would you like NEX to do?",
  primaryPromptHint: "Tell your Marketing Employee in plain language.",

  companyBadges: {
    firstClassJP: "🇯🇵 First-class market",
  },

  marketing: {
    title: "Your NEX Marketing Employee",
    prompt: '"What would you like me to do?"',
    hintUnder: "Tap a suggestion below · or type your own.",
    inputPlaceholder: "e.g. Introduce our seafood to Japanese importers",
    footnote: "Marketing Employee not yet activated. This is a preview. Nothing is sent.",
  },

  campaignReview: {
    title: "Campaign ready · preview",
    calloutBanner: "NEX Marketing Employee is not yet activated. This preview shows what would happen when authorised. Nothing is sent.",
    nextTitle: "What happens next",
    nextText:
      "When your Marketing Employee is activated, NEX will research reachable prospects, prepare business introductions in the target market's language, apply eligibility rules, and start work. Every send is evidence-logged. You review before commitment.",
    saveDraftLabel: "Save as draft (local)",
    cancelLabel: "Discard",
  },

  customersEmpty: {
    title: "Customers",
    body: "Customers appear here once real conversations start. NEX will keep track of who's talked to you, what they asked, and what they're likely to want next.",
    coming: "Coming with the Customer Identity slice.",
  },

  quotesEmpty: {
    title: "Quotes",
    body: "Quotes tie together a customer, one or more products, commercial pricing (with Incoterm where relevant), and validity.",
    coming: "Coming next.",
  },
};
