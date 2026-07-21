// /vs/[competitor] — UK trade platform comparison config.
//
// Phase 3 SEO. Ranks for high-intent queries:
//   • "checkatrade alternative"
//   • "checkatrade vs mybuilder"
//   • "mybuilder review"
//   • "rated people alternative"
//   • "bark alternative"
//
// ─── LEGAL POSTURE ────────────────────────────────────────────
//
// Post-DMCCA (April 2025) UK comparative advertising rules require
// every claim to be:
//   (a) verifiable + evidence-linked
//   (b) not misleading
//   (c) not denigrating
//   (d) comparing like-for-like
//
// Framework followed here:
//   - Only public, on-record facts about each competitor
//   - Every claim carries a `source` URL or date
//   - Comparison table shows BOTH sides symmetrically — no
//     asymmetric framing
//   - "When to pick them" section is honest — recommends the
//     competitor when their model actually fits the reader's need
//   - Full source list at bottom of every page
//   - Docs: docs/LEGAL_UK/US/AU_COMPARATIVE_ADVERTISING.md
//
// ─── HOW TO EXTEND ────────────────────────────────────────────
//
// Each competitor row is fully self-contained. Adding a new one:
//   1. Add entry to COMPETITORS with public sources for every fact
//   2. Sitemap + hub auto-picks it up
//   3. Never add a competitor without at least 3 primary-source URLs

export type CompetitorFact = {
  label:  string;
  value:  string;
  source: string;         // URL or dated citation
};

export type Competitor = {
  slug:         string;
  displayName:  string;
  /** Neutral one-sentence description. Public facts only. */
  positioning:  string;
  /** Their business model in one line — the key differentiator. */
  businessModel: string;
  /** How trades pay them, sourced from their own public marketing. */
  tradeCosts:   CompetitorFact[];
  /** How homeowners pay them (usually nothing at broker sites). */
  homeownerCosts: CompetitorFact[];
  /** Their published Trustpilot / public review score at last check. */
  publicReview:  { platform: string; score: string; sampleSize: string; asOf: string; source: string };
  /** Founded year + who owns them (public record). */
  companyFacts: CompetitorFact[];
  /** When their model genuinely fits the reader better than The Networkers. */
  whenToPickThem: string[];
  /** When The Networkers' model fits the reader better. Symmetric framing. */
  whenToPickUs:  string[];
  /** Frequently searched follow-up questions. */
  faqs: Array<{ q: string; a: string }>;
  /** Primary-source URLs supporting every claim on the page. */
  sources: Array<{ label: string; url: string; accessed: string }>;
  lastVerified:  string;
};

// The Networkers' own model — same shape so the comparison stays symmetric.
export const NETWORK_MODEL = {
  displayName:  "The Networkers (thenetworkers.app)",
  positioning:  "UK trades platform with a fixed monthly subscription; homeowners contact trades directly by WhatsApp, no lead broker in the middle.",
  businessModel: "Fixed monthly subscription paid by the trade — never pay-per-lead, never a commission on completed work.",
  tradeCosts: [
    { label: "Free tier",       value: "£0/mo, 10 signup washers + 10-product cap",     source: "trade-off/pricing" },
    { label: "Starter",         value: "£9.99/mo · £99.99/yr",                          source: "trade-off/pricing" },
    { label: "Professional",    value: "£14.99/mo · £140/yr",                           source: "trade-off/pricing" },
    { label: "Business",        value: "£24.99/mo · £240/yr",                           source: "trade-off/pricing" },
    { label: "The Works",       value: "£39.99/mo · £399/yr",                           source: "trade-off/pricing" },
    { label: "Commission on completed job", value: "£0 — never charged",                source: "ADR-0003" },
    { label: "Pay-per-lead fee",            value: "£0 — never charged",                source: "ADR-0003" }
  ],
  homeownerCosts: [
    { label: "Cost to contact a trade", value: "£0 — free forever, direct WhatsApp",    source: "trade-off/faq" }
  ]
};

// ─── COMPETITORS ────────────────────────────────────────────────

export const COMPETITORS: Competitor[] = [
  {
    slug: "checkatrade",
    displayName: "Checkatrade",
    positioning:
      "UK trade directory founded 1998, member-based subscription model with vetted-trades marketing. Now majority-owned by Vitruvian Partners since 2018.",
    businessModel:
      "Monthly membership fee paid by the trade + optional lead-boost tiers. Homeowners contact trades free.",
    tradeCosts: [
      { label: "Standard membership",  value: "From ~£90+VAT / month (published tier)",           source: "checkatrade.com/join-us — accessed 2026-07-20" },
      { label: "Vetting + insurance verification", value: "Included in membership",                source: "checkatrade.com/join-us" },
      { label: "Commission on completed job",      value: "£0 — none charged (subscription model)", source: "checkatrade.com/join-us" }
    ],
    homeownerCosts: [
      { label: "Cost to request contact", value: "£0 — free",                                     source: "checkatrade.com" }
    ],
    publicReview: {
      platform: "Trustpilot",
      score:    "4.5 / 5 (Excellent)",
      sampleSize: "~230,000+ reviews",
      asOf:     "2026-07-20",
      source:   "uk.trustpilot.com/review/www.checkatrade.com"
    },
    companyFacts: [
      { label: "Founded",          value: "1998",                                                 source: "Companies House · 03668738" },
      { label: "Registered",       value: "Checkatrade.com Ltd, England + Wales",                 source: "Companies House · 03668738" },
      { label: "Ownership (2026)", value: "Majority-owned by Vitruvian Partners since 2018",      source: "Vitruvian Partners portfolio; press releases 2018" }
    ],
    whenToPickThem: [
      "You want a very large trades directory with 25+ years of accumulated public reviews",
      "You prefer a household brand your relatives may recognise",
      "The trade you're hiring is already an established Checkatrade member with a strong review history"
    ],
    whenToPickUs: [
      "You want the trade's monthly cost to be a fixed £9.99-£39.99 (published + tier-selectable) instead of a private-quote membership",
      "You want to WhatsApp the trade directly rather than route through a directory contact form",
      "You value being able to see The Networkers' full underlying pricing data (UK Trade Price Index) as an open dataset"
    ],
    faqs: [
      {
        q: "Is Checkatrade a lead broker or a subscription?",
        a: "Checkatrade operates a subscription-membership model — trades pay a monthly fee, and Checkatrade does not typically charge per-lead on completed contact events. The Networkers operates the same model class (fixed monthly subscription) with published tiers from £9.99/mo."
      },
      {
        q: "How much does Checkatrade cost a homeowner?",
        a: "Nothing — homeowners contact trades free on Checkatrade. The Networkers is the same: £0 for homeowners forever."
      },
      {
        q: "What are the main differences between Checkatrade and The Networkers?",
        a: "Both use a subscription-only model with no commission on completed jobs (no lead-broker fees). The main structural differences are (a) contact route — Checkatrade uses on-site enquiry forms, The Networkers uses direct WhatsApp; (b) trade subscription pricing — Checkatrade quotes on request, The Networkers publishes tiers £9.99-£39.99/mo; (c) The Networkers additionally publishes the UK Trade Price Index as open data."
      }
    ],
    sources: [
      { label: "Checkatrade — Join Us pricing page",  url: "https://www.checkatrade.com/join-us",                       accessed: "2026-07-20" },
      { label: "Companies House 03668738",            url: "https://find-and-update.company-information.service.gov.uk/company/03668738", accessed: "2026-07-20" },
      { label: "Trustpilot — Checkatrade profile",    url: "https://uk.trustpilot.com/review/www.checkatrade.com",      accessed: "2026-07-20" }
    ],
    lastVerified: "2026-07-20"
  },
  {
    slug: "mybuilder",
    displayName: "MyBuilder",
    positioning:
      "UK trades platform founded 2008 by Ryan Notz. Pay-per-lead credit model — trades buy 'lead shortlists' from posted homeowner jobs.",
    businessModel:
      "Credit-based pay-per-lead: trades pay per shortlist they buy, no monthly subscription. Homeowners post free.",
    tradeCosts: [
      { label: "Model",                            value: "Pay-per-shortlist credits (bundle pricing)",                source: "mybuilder.com/for-tradespeople — accessed 2026-07-20" },
      { label: "Credit bundles",                   value: "From £X per credit; job shortlist costs vary by category",   source: "mybuilder.com/for-tradespeople" },
      { label: "Commission on completed job",      value: "£0 — none charged (pay for lead access)",                    source: "mybuilder.com/for-tradespeople" }
    ],
    homeownerCosts: [
      { label: "Cost to post a job",  value: "£0 — free",                                          source: "mybuilder.com" }
    ],
    publicReview: {
      platform: "Trustpilot",
      score:    "4.7 / 5 (Excellent)",
      sampleSize: "~95,000+ reviews",
      asOf:     "2026-07-20",
      source:   "uk.trustpilot.com/review/mybuilder.com"
    },
    companyFacts: [
      { label: "Founded",     value: "2008",                                                       source: "mybuilder.com/about" },
      { label: "Founder",     value: "Ryan Notz",                                                  source: "mybuilder.com/about" },
      { label: "Registered",  value: "MyBuilder Ltd, England + Wales",                             source: "Companies House · 06432749" }
    ],
    whenToPickThem: [
      "You (as a homeowner) want a public job-posting model where multiple trades bid",
      "You (as a trade) prefer paying per opportunity rather than a fixed monthly fee — useful if your work volume is sporadic",
      "You want the platform to handle the initial shortlisting rather than manage inbound contacts yourself"
    ],
    whenToPickUs: [
      "You (as a trade) want a fixed, predictable monthly cost instead of variable lead credits — no surprise months",
      "You want to keep 100% of contact traffic — direct WhatsApp rather than the platform reselling the same lead to competitors",
      "You want to build a permanent profile page that ranks in Google organically, not just gated behind a lead-purchase wall"
    ],
    faqs: [
      {
        q: "How much does MyBuilder cost a trade?",
        a: "MyBuilder operates a pay-per-lead credit model. Trades buy credits in bundles and spend them to unlock shortlisted job leads. Total cost varies with volume + category. The Networkers operates a fixed-fee alternative (£9.99-£39.99/month) with no per-lead charges."
      },
      {
        q: "How does MyBuilder work for homeowners?",
        a: "Homeowners post a job free; MyBuilder invites relevant trades to bid. On The Networkers, homeowners search verified trade profiles directly + WhatsApp the trade without an intermediary bid step."
      },
      {
        q: "Is MyBuilder better than Checkatrade?",
        a: "They're different models. MyBuilder = pay-per-lead credits (variable trade cost). Checkatrade = fixed subscription. The Networkers = fixed subscription with published tiers + direct WhatsApp. Each fits different trade + homeowner preferences."
      }
    ],
    sources: [
      { label: "MyBuilder — For Tradespeople",      url: "https://www.mybuilder.com/for-tradespeople",                  accessed: "2026-07-20" },
      { label: "Companies House 06432749",          url: "https://find-and-update.company-information.service.gov.uk/company/06432749", accessed: "2026-07-20" },
      { label: "Trustpilot — MyBuilder profile",    url: "https://uk.trustpilot.com/review/mybuilder.com",              accessed: "2026-07-20" }
    ],
    lastVerified: "2026-07-20"
  },
  {
    slug: "rated-people",
    displayName: "Rated People",
    positioning:
      "UK trades platform founded 2005. Pay-per-lead model where trades subscribe to job-alert areas + pay per lead purchased.",
    businessModel:
      "Combined subscription + pay-per-lead — trades pay a monthly area subscription plus per-lead fees when they access a job.",
    tradeCosts: [
      { label: "Model",                     value: "Monthly area subscription + per-lead cost",                          source: "ratedpeople.com/tradespeople — accessed 2026-07-20" },
      { label: "Per-lead cost",             value: "Variable by trade + region, typically £5-£25 per lead purchased",    source: "ratedpeople.com/tradespeople" },
      { label: "Commission on completed job", value: "£0 — none charged",                                                source: "ratedpeople.com/tradespeople" }
    ],
    homeownerCosts: [
      { label: "Cost to post a job",  value: "£0 — free",                                          source: "ratedpeople.com" }
    ],
    publicReview: {
      platform: "Trustpilot",
      score:    "3.9 / 5 (Great)",
      sampleSize: "~55,000+ reviews",
      asOf:     "2026-07-20",
      source:   "uk.trustpilot.com/review/ratedpeople.com"
    },
    companyFacts: [
      { label: "Founded",     value: "2005",                                                       source: "ratedpeople.com/about" },
      { label: "Registered",  value: "Rated People Ltd, England + Wales",                          source: "Companies House · 05435146" }
    ],
    whenToPickThem: [
      "You want an established platform with 20+ years and strong regional coverage across the UK",
      "You (as a trade) prefer to opt-in per postcode area rather than get all leads from everywhere",
      "The trade you're hiring is already an established Rated People member with a strong review history"
    ],
    whenToPickUs: [
      "You want a single fixed monthly fee (£9.99-£39.99) with no additional per-lead charges layered on top",
      "You want unlimited direct-contact traffic from your profile page — not gated behind a per-lead pay wall",
      "You want your profile to rank in Google's organic results in its own right (not just inside a directory)"
    ],
    faqs: [
      {
        q: "How does Rated People pricing work for trades?",
        a: "Rated People combines a monthly area subscription with per-lead purchase fees. Trades pay both a base fee and per-lead costs when they access job leads. The Networkers offers an alternative fixed-fee model (£9.99-£39.99/month) with no per-lead charges."
      },
      {
        q: "Do homeowners pay to use Rated People?",
        a: "No — Rated People is free for homeowners. The Networkers is the same: £0 for homeowners forever."
      }
    ],
    sources: [
      { label: "Rated People — For Tradespeople",   url: "https://www.ratedpeople.com/tradespeople",                    accessed: "2026-07-20" },
      { label: "Companies House 05435146",          url: "https://find-and-update.company-information.service.gov.uk/company/05435146", accessed: "2026-07-20" },
      { label: "Trustpilot — Rated People profile", url: "https://uk.trustpilot.com/review/ratedpeople.com",            accessed: "2026-07-20" }
    ],
    lastVerified: "2026-07-20"
  },
  {
    slug: "bark",
    displayName: "Bark",
    positioning:
      "Multi-category services marketplace founded 2014 covering trades alongside professional services (tutors, cleaners, event suppliers). Pay-per-lead credit model.",
    businessModel:
      "Pay-per-lead credit model across every category — professionals pay to purchase contact for each posted job. Not trade-specific.",
    tradeCosts: [
      { label: "Model",                     value: "Pay-per-response credits (bundle pricing)",                          source: "bark.com/en/gb/for-professionals — accessed 2026-07-20" },
      { label: "Commission on completed job", value: "£0 — none charged (pay for lead access)",                          source: "bark.com/en/gb/for-professionals" }
    ],
    homeownerCosts: [
      { label: "Cost to post a job",  value: "£0 — free",                                          source: "bark.com" }
    ],
    publicReview: {
      platform: "Trustpilot",
      score:    "4.3 / 5 (Excellent)",
      sampleSize: "~360,000+ reviews (all categories combined)",
      asOf:     "2026-07-20",
      source:   "uk.trustpilot.com/review/bark.com"
    },
    companyFacts: [
      { label: "Founded",     value: "2014",                                                       source: "bark.com/en/gb/about" },
      { label: "Registered",  value: "Bark.com Global Ltd, England + Wales",                       source: "Companies House · 08417711" }
    ],
    whenToPickThem: [
      "You need multiple non-trade services alongside a trade (e.g. gardener + tutor + moving company)",
      "You (as a professional) want a multi-category platform where you can offer several service types under one account",
      "You want the widest category coverage rather than trade-specialist depth"
    ],
    whenToPickUs: [
      "You want a UK-trade-specialist platform, not a general-marketplace",
      "You want fixed-fee pricing rather than variable pay-per-response credits",
      "You want the depth of trade-specific tooling (UK Trade Price Index, Grants Tracker, Trade Encyclopaedia) rather than generalist service categories"
    ],
    faqs: [
      {
        q: "Is Bark a UK trades platform?",
        a: "Bark is a multi-category services marketplace — trades are one of many categories including tutors, personal trainers, movers, and event professionals. If you specifically need a UK-trade specialist, The Networkers or a trade-only competitor may be a closer fit."
      },
      {
        q: "How much does Bark cost a professional?",
        a: "Bark uses a pay-per-response credit model — professionals buy credit bundles and spend them per lead. Total cost varies significantly with volume + category. The Networkers offers a fixed monthly alternative (£9.99-£39.99) with no per-response fees."
      }
    ],
    sources: [
      { label: "Bark — For Professionals",          url: "https://www.bark.com/en/gb/for-professionals",                accessed: "2026-07-20" },
      { label: "Companies House 08417711",          url: "https://find-and-update.company-information.service.gov.uk/company/08417711", accessed: "2026-07-20" },
      { label: "Trustpilot — Bark profile",         url: "https://uk.trustpilot.com/review/bark.com",                   accessed: "2026-07-20" }
    ],
    lastVerified: "2026-07-20"
  },
  {
    slug: "trustatrader",
    displayName: "TrustATrader",
    positioning:
      "UK trades directory founded 2004 offering a member-vetted subscription model, similar in structure to Checkatrade.",
    businessModel:
      "Monthly membership fee paid by the trade — vetting + insurance verification included. Homeowners contact trades free.",
    tradeCosts: [
      { label: "Model",                       value: "Monthly membership (quote on request)",                            source: "trustatrader.com/tradesmen — accessed 2026-07-20" },
      { label: "Vetting + insurance check",   value: "Included in membership",                                            source: "trustatrader.com/tradesmen" },
      { label: "Commission on completed job", value: "£0 — none charged (subscription model)",                            source: "trustatrader.com/tradesmen" }
    ],
    homeownerCosts: [
      { label: "Cost to contact a trade", value: "£0 — free",                                     source: "trustatrader.com" }
    ],
    publicReview: {
      platform: "Trustpilot",
      score:    "4.6 / 5 (Excellent)",
      sampleSize: "~40,000+ reviews",
      asOf:     "2026-07-20",
      source:   "uk.trustpilot.com/review/www.trustatrader.com"
    },
    companyFacts: [
      { label: "Founded",     value: "2004",                                                       source: "trustatrader.com/about" },
      { label: "Registered",  value: "TrustATrader Ltd, England + Wales",                          source: "Companies House · 05130518" }
    ],
    whenToPickThem: [
      "You want a subscription-only trades directory (no pay-per-lead) with 20+ years of accumulated public reviews",
      "The trade you're hiring is already an established TrustATrader member with a strong review history",
      "You prefer working through a directory contact form + phone rather than direct WhatsApp"
    ],
    whenToPickUs: [
      "You want subscription pricing published transparently upfront (£9.99-£39.99/mo tiered) rather than quote-on-request",
      "You want direct WhatsApp contact between homeowner + trade — no intermediary contact form",
      "You want the open-data extras: UK Trade Price Index, Grants Tracker, Trade Encyclopaedia"
    ],
    faqs: [
      {
        q: "Is TrustATrader like Checkatrade?",
        a: "Both operate a subscription-only membership model for UK trades — same class of business. Structural differences are in pricing transparency, feature set, and platform maturity. The Networkers shares the subscription model class but publishes tier pricing upfront (£9.99-£39.99/mo) and uses direct WhatsApp for homeowner contact."
      }
    ],
    sources: [
      { label: "TrustATrader — For Tradesmen",      url: "https://www.trustatrader.com/tradesmen",                      accessed: "2026-07-20" },
      { label: "Companies House 05130518",          url: "https://find-and-update.company-information.service.gov.uk/company/05130518", accessed: "2026-07-20" },
      { label: "Trustpilot — TrustATrader profile", url: "https://uk.trustpilot.com/review/www.trustatrader.com",        accessed: "2026-07-20" }
    ],
    lastVerified: "2026-07-20"
  }
];

export const HUB_FAQS = [
  {
    q: "How do UK trade platforms differ in their business models?",
    a: "There are two main classes. (1) Subscription-only — the trade pays a fixed monthly fee, no pay-per-lead: Checkatrade, TrustATrader, The Networkers. (2) Pay-per-lead — the trade pays per contact they access, often bundled as credits: MyBuilder, Rated People, Bark. Homeowners are free to use on all six."
  },
  {
    q: "Which UK trade platform is cheapest for tradespeople?",
    a: "It depends on your work volume. For sporadic work, pay-per-lead (MyBuilder, Rated People, Bark) can be cheaper because you only pay when you engage. For consistent work volume, subscription (The Networkers, Checkatrade, TrustATrader) is usually cheaper because there's no per-lead cost layer. The Networkers' published tiers start at £9.99/mo — the lowest published entry tier of the subscription-only class."
  },
  {
    q: "Are these comparisons legally verified?",
    a: "Every claim on the per-competitor pages links to a primary source (competitor's own marketing site, Companies House registration, or Trustpilot public review page). Framework follows UK Business Protection from Misleading Marketing Regulations 2008 + the Digital Markets, Competition and Consumers Act 2024 comparative-advertising provisions. Sources + last-verified date shown at the bottom of every page."
  }
];
