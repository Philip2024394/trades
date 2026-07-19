// Region-scoped summary data for the on-page ComparisonSection —
// the "at a glance" chart on /trade-off (renders once per region so
// visitors see UK, USA, AU stacked as global proof).
//
// Full 16-feature × N-platform matrices per region live in
// tradePlatformComparison.ts / .us.ts / .au.ts and drive the
// deep-dive reports under /trade-off/{uk,us,au}/compare-platforms.
// This file is the CURATED SUMMARY — 8 headline competitors + 19
// most-differentiating dimensions — for scannable presentation.
//
// Legal posture:
//   UK  → BPRs 2008 reg.4 + DMCCA ss.226-227
//   USA → Lanham Act §43(a) + FTC 1979 Policy + nominative fair use
//   AU  → ACL s.18/s.29 + TMA 1995 (Cth) s.122(1)(f)
// Every price cell must be re-verified quarterly. Stale = liability.
// See docs/LEGAL_{UK,US,AU}_COMPARATIVE_ADVERTISING.md.

export type YesNo = true | false | null;

export type ComparisonRow = {
  label: string;
  us:    YesNo;
  comp:  Record<string, YesNo>;
};

export type RegionSummary = {
  key:               "uk" | "us" | "au";
  flag:              string;
  regionLabel:       string;                 // "UK" | "USA" | "Australia"
  intlLocale:        string;                 // "en-GB" | "en-US" | "en-AU"
  reportHref:        string;                 // /trade-off/{region}/compare-platforms
  usPricingShort:    string;                 // "Free / £9.99+", etc
  currencySymbol:    string;                 // £, $, A$
  competitors:       string[];
  competitorPricing: Record<string, string>;
  rows:              ComparisonRow[];
};

// Shared native + fair-picture rows — Networkers-only mechanics that
// apply identically in every market. Competitors uniformly false.
const NATIVE_ROWS_ALL_FALSE_COMP: (competitors: string[]) => ComparisonRow[] = (competitors) => {
  const allFalse = Object.fromEntries(competitors.map((c) => [c, false as YesNo])) as Record<string, YesNo>;
  return [
    { label: "Inspiration image library → nearest trades",  us: true, comp: allFalse },
    { label: "Per-merchant community canteen (feed + shop)", us: true, comp: allFalse },
    { label: "Own-branded installable mobile PWA",           us: true, comp: allFalse }
  ];
};

// ============================================================
// UK
// ============================================================
const UK_COMPETITORS = ["Checkatrade", "MyBuilder", "Bark", "RatedPeople", "TrustATrader", "Yell", "GoogleBP", "Nextdoor"];

export const UK_SUMMARY: RegionSummary = {
  key:            "uk",
  flag:           "🇬🇧",
  regionLabel:    "UK",
  intlLocale:     "en-GB",
  reportHref:     "/trade-off/compare-platforms",
  usPricingShort: "Free / £9.99+",
  currencySymbol: "£",
  competitors:    UK_COMPETITORS,
  competitorPricing: {
    Checkatrade:  "£30–£399/mo + lead fees",
    MyBuilder:    "Free + £5–£50/lead",
    Bark:         "Credit packs £1.20–£1.80 ea",
    RatedPeople:  "£2–£30/lead + £40/mo Plus",
    TrustATrader: "£70–£120/mo · 12-mo",
    Yell:         "Free / £249+/mo Biz",
    GoogleBP:     "Free",
    Nextdoor:     "Free"
  },
  rows: [
    { label: "Own live URL",                                us: true,
      comp: { Checkatrade: true,   MyBuilder: true,   Bark: true,   RatedPeople: true,   TrustATrader: true,  Yell: true,   GoogleBP: true,   Nextdoor: true } },
    { label: "Custom domain support",                       us: true,
      comp: { Checkatrade: false,  MyBuilder: false,  Bark: false,  RatedPeople: false,  TrustATrader: false, Yell: false,  GoogleBP: false,  Nextdoor: false } },
    { label: "Free tier (no card)",                         us: true,
      comp: { Checkatrade: false,  MyBuilder: true,   Bark: true,   RatedPeople: true,   TrustATrader: false, Yell: true,   GoogleBP: true,   Nextdoor: true } },
    { label: "No commission on jobs",                       us: true,
      comp: { Checkatrade: true,   MyBuilder: true,   Bark: true,   RatedPeople: true,   TrustATrader: true,  Yell: true,   GoogleBP: true,   Nextdoor: true } },
    { label: "Transparent lead pricing (fixed, no surge)",  us: true,
      comp: { Checkatrade: false,  MyBuilder: false,  Bark: false,  RatedPeople: false,  TrustATrader: true,  Yell: null,   GoogleBP: true,   Nextdoor: true } },
    { label: "Direct WhatsApp contact",                     us: true,
      comp: { Checkatrade: null,   MyBuilder: false,  Bark: false,  RatedPeople: false,  TrustATrader: null,  Yell: false,  GoogleBP: true,   Nextdoor: false } },
    { label: "Product catalogue for merchants",             us: true,
      comp: { Checkatrade: false,  MyBuilder: false,  Bark: false,  RatedPeople: false,  TrustATrader: false, Yell: false,  GoogleBP: true,   Nextdoor: false } },
    { label: "Community feed / forum",                      us: true,
      comp: { Checkatrade: false,  MyBuilder: false,  Bark: false,  RatedPeople: false,  TrustATrader: false, Yell: false,  GoogleBP: false,  Nextdoor: true } },
    { label: "Homeowner project beacon (2h SLA)",           us: true,
      comp: { Checkatrade: false,  MyBuilder: true,   Bark: true,   RatedPeople: true,   TrustATrader: false, Yell: false,  GoogleBP: false,  Nextdoor: false } },
    { label: "Cross-merchant installer cross-sell",         us: true,
      comp: { Checkatrade: false,  MyBuilder: false,  Bark: false,  RatedPeople: false,  TrustATrader: false, Yell: false,  GoogleBP: false,  Nextdoor: false } },
    { label: "Trade-to-trade referral network",             us: true,
      comp: { Checkatrade: false,  MyBuilder: false,  Bark: false,  RatedPeople: false,  TrustATrader: false, Yell: false,  GoogleBP: false,  Nextdoor: false } },
    { label: "AI Visualiser + AI content tools",            us: true,
      comp: { Checkatrade: null,   MyBuilder: null,   Bark: null,   RatedPeople: null,   TrustATrader: false, Yell: null,   GoogleBP: true,   Nextdoor: null } },
    { label: "Push notifications to merchant PWA",          us: true,
      comp: { Checkatrade: true,   MyBuilder: true,   Bark: true,   RatedPeople: true,   TrustATrader: null,  Yell: null,   GoogleBP: true,   Nextdoor: true } },
    { label: "Reviews + verified badge",                    us: true,
      comp: { Checkatrade: true,   MyBuilder: true,   Bark: true,   RatedPeople: true,   TrustATrader: true,  Yell: false,  GoogleBP: true,   Nextdoor: false } },
    ...NATIVE_ROWS_ALL_FALSE_COMP(UK_COMPETITORS),
    // Fair-picture rows — DMCCA s.227 defence
    { label: "10+ year established brand history",          us: false,
      comp: { Checkatrade: true,   MyBuilder: true,   Bark: true,   RatedPeople: true,   TrustATrader: true,  Yell: true,   GoogleBP: true,   Nextdoor: true } },
    { label: "Insurance-backed workmanship guarantee",      us: false,
      comp: { Checkatrade: true,   MyBuilder: false,  Bark: false,  RatedPeople: false,  TrustATrader: true,  Yell: false,  GoogleBP: false,  Nextdoor: false } }
  ]
};

// ============================================================
// USA
// ============================================================
const US_COMPETITORS = ["Angi", "Thumbtack", "Yelp", "GoogleBP", "Nextdoor", "TaskRabbit", "Handy", "HouzzPro"];

export const US_SUMMARY: RegionSummary = {
  key:            "us",
  flag:           "🇺🇸",
  regionLabel:    "USA",
  intlLocale:     "en-US",
  reportHref:     "/trade-off/us/compare-platforms",
  usPricingShort: "Free / $12+",
  currencySymbol: "$",
  competitors:    US_COMPETITORS,
  competitorPricing: {
    Angi:        "$15–$120/lead + $300/yr Ads",
    Thumbtack:   "$8–$150/lead",
    Yelp:        "Free / $300–$5k Ads",
    GoogleBP:    "Free",
    Nextdoor:    "Free / $1/day Deals",
    TaskRabbit:  "$25 reg · 15% client fee",
    Handy:       "~20–25% commission",
    HouzzPro:    "$85–$399/mo (annual)"
  },
  rows: [
    { label: "Own live URL",                                us: true,
      comp: { Angi: true,   Thumbtack: true,  Yelp: true,  GoogleBP: true,  Nextdoor: true,  TaskRabbit: true,  Handy: false, HouzzPro: true } },
    { label: "Custom domain support",                       us: true,
      comp: { Angi: false,  Thumbtack: false, Yelp: false, GoogleBP: false, Nextdoor: false, TaskRabbit: false, Handy: false, HouzzPro: true } },
    { label: "Free tier (no card)",                         us: true,
      comp: { Angi: true,   Thumbtack: true,  Yelp: true,  GoogleBP: true,  Nextdoor: true,  TaskRabbit: false, Handy: true,  HouzzPro: true } },
    { label: "No commission on jobs",                       us: true,
      comp: { Angi: true,   Thumbtack: true,  Yelp: true,  GoogleBP: true,  Nextdoor: true,  TaskRabbit: true,  Handy: false, HouzzPro: true } },
    { label: "Transparent lead pricing (fixed, no surge)",  us: true,
      comp: { Angi: false,  Thumbtack: false, Yelp: true,  GoogleBP: true,  Nextdoor: true,  TaskRabbit: true,  Handy: true,  HouzzPro: true } },
    { label: "Direct WhatsApp contact",                     us: true,
      comp: { Angi: false,  Thumbtack: false, Yelp: false, GoogleBP: false, Nextdoor: false, TaskRabbit: false, Handy: false, HouzzPro: false } },
    { label: "Product catalogue for merchants",             us: true,
      comp: { Angi: false,  Thumbtack: false, Yelp: false, GoogleBP: true,  Nextdoor: false, TaskRabbit: false, Handy: false, HouzzPro: false } },
    { label: "Community feed / forum",                      us: true,
      comp: { Angi: false,  Thumbtack: false, Yelp: false, GoogleBP: false, Nextdoor: true,  TaskRabbit: false, Handy: false, HouzzPro: true } },
    { label: "Homeowner project beacon (2h SLA)",           us: true,
      comp: { Angi: true,   Thumbtack: true,  Yelp: false, GoogleBP: false, Nextdoor: false, TaskRabbit: true,  Handy: true,  HouzzPro: true } },
    { label: "Cross-merchant installer cross-sell",         us: true,
      comp: { Angi: false,  Thumbtack: false, Yelp: false, GoogleBP: false, Nextdoor: false, TaskRabbit: false, Handy: false, HouzzPro: true } },
    { label: "Trade-to-trade referral network",             us: true,
      comp: { Angi: false,  Thumbtack: false, Yelp: false, GoogleBP: false, Nextdoor: true,  TaskRabbit: false, Handy: false, HouzzPro: false } },
    { label: "AI Visualiser + AI content tools",            us: true,
      comp: { Angi: true,   Thumbtack: null,  Yelp: null,  GoogleBP: true,  Nextdoor: null,  TaskRabbit: null,  Handy: null,  HouzzPro: true } },
    { label: "Push notifications to merchant PWA",          us: true,
      comp: { Angi: true,   Thumbtack: true,  Yelp: true,  GoogleBP: false, Nextdoor: true,  TaskRabbit: true,  Handy: true,  HouzzPro: true } },
    { label: "Reviews + verified badge",                    us: true,
      comp: { Angi: true,   Thumbtack: true,  Yelp: false, GoogleBP: false, Nextdoor: false, TaskRabbit: true,  Handy: true,  HouzzPro: true } },
    ...NATIVE_ROWS_ALL_FALSE_COMP(US_COMPETITORS),
    { label: "10+ year established USA brand history",      us: false,
      comp: { Angi: true,   Thumbtack: true,  Yelp: true,  GoogleBP: true,  Nextdoor: true,  TaskRabbit: true,  Handy: true,  HouzzPro: true } },
    { label: "USA local review density (100k+ per market)", us: false,
      comp: { Angi: true,   Thumbtack: true,  Yelp: true,  GoogleBP: true,  Nextdoor: null,  TaskRabbit: null,  Handy: null,  HouzzPro: true } }
  ]
};

// ============================================================
// AU
// ============================================================
const AU_COMPETITORS = ["Hipages", "ServiceSeeking", "Airtasker", "Oneflare", "YellowAU", "TrueLocal", "NextdoorAU", "GoogleBP"];

export const AU_SUMMARY: RegionSummary = {
  key:            "au",
  flag:           "🇦🇺",
  regionLabel:    "Australia",
  intlLocale:     "en-AU",
  reportHref:     "/trade-off/au/compare-platforms",
  usPricingShort: "Free / A$18+",
  currencySymbol: "A$",
  competitors:    AU_COMPETITORS,
  competitorPricing: {
    Hipages:        "A$129–A$810/mo + $30–$80/lead",
    ServiceSeeking: "A$49/mo Starter · A$9.95/lead",
    Airtasker:      "12.5–20% commission",
    Oneflare:       "Credit packs — closing 30 Jun 2026",
    YellowAU:       "From A$30/mo · 12-mo",
    TrueLocal:      "Free",
    NextdoorAU:     "Free / A$3/day Deals",
    GoogleBP:       "Free"
  },
  rows: [
    { label: "Own live URL",                                us: true,
      comp: { Hipages: false, ServiceSeeking: false, Airtasker: false, Oneflare: false, YellowAU: true,  TrueLocal: false, NextdoorAU: false, GoogleBP: false } },
    { label: "Custom domain support",                       us: true,
      comp: { Hipages: false, ServiceSeeking: false, Airtasker: false, Oneflare: false, YellowAU: true,  TrueLocal: false, NextdoorAU: false, GoogleBP: false } },
    { label: "Free tier (no card)",                         us: true,
      comp: { Hipages: false, ServiceSeeking: true,  Airtasker: true,  Oneflare: true,  YellowAU: true,  TrueLocal: true,  NextdoorAU: true,  GoogleBP: true } },
    { label: "No commission on jobs",                       us: true,
      comp: { Hipages: true,  ServiceSeeking: true,  Airtasker: false, Oneflare: true,  YellowAU: true,  TrueLocal: true,  NextdoorAU: true,  GoogleBP: true } },
    { label: "Transparent lead pricing (fixed, no surge)",  us: true,
      comp: { Hipages: false, ServiceSeeking: true,  Airtasker: true,  Oneflare: false, YellowAU: true,  TrueLocal: true,  NextdoorAU: true,  GoogleBP: true } },
    { label: "Direct WhatsApp contact",                     us: true,
      comp: { Hipages: false, ServiceSeeking: false, Airtasker: false, Oneflare: false, YellowAU: false, TrueLocal: false, NextdoorAU: false, GoogleBP: false } },
    { label: "Product catalogue for merchants",             us: true,
      comp: { Hipages: false, ServiceSeeking: false, Airtasker: false, Oneflare: false, YellowAU: false, TrueLocal: false, NextdoorAU: false, GoogleBP: true } },
    { label: "Community feed / forum",                      us: true,
      comp: { Hipages: false, ServiceSeeking: false, Airtasker: false, Oneflare: false, YellowAU: false, TrueLocal: false, NextdoorAU: true,  GoogleBP: false } },
    { label: "Homeowner project beacon (2h SLA)",           us: true,
      comp: { Hipages: true,  ServiceSeeking: true,  Airtasker: true,  Oneflare: true,  YellowAU: false, TrueLocal: false, NextdoorAU: false, GoogleBP: false } },
    { label: "Cross-merchant installer cross-sell",         us: true,
      comp: { Hipages: false, ServiceSeeking: false, Airtasker: false, Oneflare: false, YellowAU: false, TrueLocal: false, NextdoorAU: false, GoogleBP: false } },
    { label: "Trade-to-trade referral network",             us: true,
      comp: { Hipages: false, ServiceSeeking: false, Airtasker: false, Oneflare: false, YellowAU: false, TrueLocal: false, NextdoorAU: true,  GoogleBP: false } },
    { label: "AI Visualiser + AI content tools",            us: true,
      comp: { Hipages: true,  ServiceSeeking: null,  Airtasker: null,  Oneflare: null,  YellowAU: null,  TrueLocal: null,  NextdoorAU: null,  GoogleBP: true } },
    { label: "Push notifications to merchant PWA",          us: true,
      comp: { Hipages: true,  ServiceSeeking: true,  Airtasker: true,  Oneflare: true,  YellowAU: null,  TrueLocal: true,  NextdoorAU: true,  GoogleBP: false } },
    { label: "Reviews + verified badge",                    us: true,
      comp: { Hipages: true,  ServiceSeeking: null,  Airtasker: true,  Oneflare: true,  YellowAU: true,  TrueLocal: false, NextdoorAU: false, GoogleBP: true } },
    ...NATIVE_ROWS_ALL_FALSE_COMP(AU_COMPETITORS),
    { label: "10+ year established AU brand history",       us: false,
      comp: { Hipages: true,  ServiceSeeking: true,  Airtasker: true,  Oneflare: true,  YellowAU: true,  TrueLocal: true,  NextdoorAU: true,  GoogleBP: true } },
    { label: "AU-native tradie density (nationwide)",       us: false,
      comp: { Hipages: true,  ServiceSeeking: true,  Airtasker: true,  Oneflare: true,  YellowAU: true,  TrueLocal: true,  NextdoorAU: null,  GoogleBP: true } }
  ]
};

export const REGION_SUMMARIES: RegionSummary[] = [UK_SUMMARY, US_SUMMARY, AU_SUMMARY];
