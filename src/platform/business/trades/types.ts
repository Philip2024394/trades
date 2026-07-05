// tradeIntelligenceRegistry — structured KNOWLEDGE per trade.
//
// This is the moat: agency-level knowledge encoded as data, not
// prompts. Each entry captures how one trade actually presents,
// prices, wins customers, and where the money comes from.
//
// Distinct from playbooks:
//   • Playbooks are single-concern INTELLIGENCE patterns
//     ("trust-first", "before-after") that span trades.
//   • Trade Intelligence is TRADE-SPECIFIC knowledge:
//     what carpenters sell, how they win business, what images
//     they need, what customers ask, when their season peaks.
//
// The resolver folds trade intelligence into ResolvedStrategy
// BEFORE playbook merging — playbooks can override, but every
// site cascades from what the trade actually is.

export type BusinessGoalOption = {
  /** Machine slug. */
  slug: string;
  /** Merchant-facing label — "Sell more fire doors". */
  label: string;
  /** Which service(s) this goal pushes. */
  pushesServices: readonly string[];
  /** Optional playbook slugs this goal implies. */
  impliesPlaybooks?: readonly string[];
};

export type ServiceEconomics = {
  /** Slug of the service. */
  slug: string;
  label: string;
  /** Margin band — "high" services are prioritised by high-margin-focus playbook. */
  margin: "high" | "medium" | "low";
  /** Whether this service is typically presented as a package price. */
  packagePriced?: boolean;
  /** Whether this service typically requires an on-site survey. */
  requiresSurvey?: boolean;
  /** Whether this service is regulated (electrical certs, gas safe, etc.). */
  regulated?: boolean;
  /** ISO 4217 currency + rough job value band. Optional — omit rather
   *  than fabricate. */
  averageJobValue?: { min: number; max: number; currency: string };
};

export type TrustBuilderKind =
  | "years-trading"
  | "insurance"
  | "certifications"
  | "before-after"
  | "workshop-photos"
  | "van-branded"
  | "team-photos"
  | "trade-body-membership"
  | "guarantees"
  | "no-callout-fee"
  | "response-time-promise"
  | "safe-contractor"
  | "public-liability"
  | "case-studies"
  | "accreditations"
  | "employer-liability";

export type ImageCategory =
  | "hero"
  | "finished-work"
  | "before-after"
  | "process"
  | "team"
  | "van"
  | "workshop"
  | "showroom"
  | "materials"
  | "certificate"
  | "menu"
  | "interior"
  | "chef";

export type ImageStrategy = {
  /** Ordered priority — first is the hero, then in-page image types. */
  priorityOrder: readonly ImageCategory[];
  /** Optional mix percentages for the main gallery. Must sum to 100. */
  galleryMix?: Record<string, number>;
  requiresBeforeAfter: boolean;
  requiresProcess: boolean;
  /** Minimum number of finished-work photos before the site is
   *  considered credible for public launch. */
  minFinishedWorkPhotos: number;
};

export type PricingPresentation =
  | "hidden"
  | "guide"
  | "package"
  | "exact"
  | "menu";

export type ContentFlowPlacement =
  | "before-hero"
  | "in-hero"
  | "after-hero"
  | "before-services"
  | "after-services"
  | "before-gallery"
  | "after-gallery"
  | "before-pricing"
  | "after-pricing"
  | "before-faq"
  | "after-faq"
  | "before-contact"
  | "after-contact"
  | "footer";

export type ContentFlow = {
  servicesPlacement: ContentFlowPlacement;
  galleryPlacement: ContentFlowPlacement;
  testimonialsPlacement: ContentFlowPlacement;
  faqPlacement: ContentFlowPlacement;
  pricingPlacement: ContentFlowPlacement;
  contactPlacement: ContentFlowPlacement;
};

/** SEO keyword template — supports `{service}` + `{location}` + `{trade}`. */
export type SeoKeywordTemplate = {
  template: string;
  /** Which services this template applies to — empty = all services. */
  services?: readonly string[];
  /** Marginal search-intent — commercial / informational / local. */
  intent?: "commercial" | "informational" | "local" | "urgent";
  /** Priority — 1 = build first. */
  priority?: number;
};

export type CommonFaq = {
  question: string;
  /** Short answer OR left blank for merchant to fill. If blank the
   *  Studio surfaces it as "Add answer" rather than fabricating. */
  answerHint?: string;
  /** Which service(s) this FAQ is relevant to. */
  services?: readonly string[];
};

export type CommonObjection = {
  objection: string;
  /** How the site should COUNTER the objection — the trade-specific
   *  antidote. Rendered by playbooks that consume trade intelligence. */
  counter: string;
};

export type BuyingJourneyStage =
  | "awareness"
  | "research"
  | "shortlist"
  | "consultation"
  | "quote-received"
  | "decision"
  | "job-active"
  | "post-completion";

export type BuyingJourney = {
  stages: readonly BuyingJourneyStage[];
  /** Optional band — omit rather than invent. */
  averageDecisionTimeDays?: { min: number; max: number };
  /** Optional band — omit rather than invent. */
  averageJobValue?: { min: number; max: number; currency: string };
  /** Whether the customer typically gets multiple quotes. */
  multipleQuotes: boolean;
};

export type SeasonalPattern = {
  /** Month index 0-11. */
  monthIndex: number;
  /** Relative intensity 0-100. 50 = average month. */
  demandIndex: number;
  /** Optional short label — "wedding season", "storm season". */
  label?: string;
};

export type PositioningOverride = {
  /** Override primary CTA when this positioning flag is active. */
  primaryCta?: string;
  /** Additional trust builders to elevate. */
  extraTrustBuilders?: readonly TrustBuilderKind[];
  /** Additional playbook slugs to fold in. */
  extraPlaybooks?: readonly string[];
  /** Override pricing presentation. */
  pricingPresentation?: PricingPresentation;
  /** Force gallery mix override. */
  galleryMix?: Record<string, number>;
};

export type PositioningModifiers = {
  emergency?: PositioningOverride;
  luxury?: PositioningOverride;
  commercial?: PositioningOverride;
  residential?: PositioningOverride;
  budget?: PositioningOverride;
  premium?: PositioningOverride;
};

/** Explicit evidence trail — every trade seed carries its confidence. */
export type TradeEvidence = {
  /** 0-100. v1 seeds start at 60. */
  confidence: number;
  /** Growth path: none → anecdotal → measured → validated. */
  strength: "none" | "anecdotal" | "measured" | "validated";
  /** How many merchants this knowledge has been proved against. */
  sampleSize: number;
  /** ISO 3166 alpha-2 countries this knowledge has been validated in. */
  marketsValidated: readonly string[];
  /** Free-text — cite research paper, industry report, internal analysis, etc. */
  sources?: readonly string[];
  /** ISO 8601 date. */
  lastReviewed?: string;
};

export type TradeIntelligenceManifest = {
  manifestVersion: 1;
  slug: string;                  // "carpenter" | "electrician" | ...
  name: string;                  // "Carpenter"
  description: string;
  version: string;
  /** ISO 3166 alpha-2 countries this intelligence has been authored
   *  for. Fallback to global "*" when generic. */
  countries: readonly string[];

  /** Alternate slugs the platform's trade catalogue may use. */
  aliases?: readonly string[];

  // ─── Business landscape ────────────────────────────────────
  businessGoals: readonly BusinessGoalOption[];

  // ─── Service economics ─────────────────────────────────────
  services: readonly ServiceEconomics[];

  // ─── Trust ─────────────────────────────────────────────────
  trustBuilders: readonly TrustBuilderKind[];

  // ─── Images ───────────────────────────────────────────────
  imageStrategy: ImageStrategy;

  // ─── Commercial ───────────────────────────────────────────
  pricingPresentation: PricingPresentation;
  primaryCta: string;

  // ─── Content ordering ─────────────────────────────────────
  contentFlow: ContentFlow;

  // ─── SEO ──────────────────────────────────────────────────
  seoKeywordTemplates: readonly SeoKeywordTemplate[];
  /** Common location page slugs to generate against merchant's
   *  serviceRadius. Empty = derive from serviceRadius only. */
  locationPageHints?: readonly string[];

  // ─── FAQs + objections ────────────────────────────────────
  commonFaqs: readonly CommonFaq[];
  commonObjections: readonly CommonObjection[];

  // ─── Buying journey ───────────────────────────────────────
  buyingJourney: BuyingJourney;

  // ─── Seasonality ──────────────────────────────────────────
  seasonality?: readonly SeasonalPattern[];

  // ─── Positioning overrides ────────────────────────────────
  positioningModifiers: PositioningModifiers;

  // ─── Compliance / regulation ──────────────────────────────
  compliance?: {
    /** Certifications typically required — "Gas Safe", "NICEIC", etc. */
    typicalCertifications?: readonly string[];
    /** Whether public work legally requires insurance display. */
    requiresPublicLiabilityDisplay?: boolean;
    /** Additional badges the trade audience expects. */
    audienceExpectedBadges?: readonly string[];
  };

  // ─── Evidence ─────────────────────────────────────────────
  evidence: TradeEvidence;

  publisher?: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };
};

export type FrozenTradeIntelligenceManifest = Readonly<TradeIntelligenceManifest>;
