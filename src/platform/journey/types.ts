// Journey Registry — types.
//
// A Customer Journey is a 3-5 stage plan describing how a visitor
// moves from awareness to conversion. It sits between Intent (step 2)
// and Layout (step 4) in the 14-step AI Composition pipeline:
//
//   Intent → Journey.selectFor(intent, trade) → Layout scoring input.
//
// The Journey is deterministic — it's a scored pick over registered
// manifests, no LLM. It shapes which layouts + navigations + section
// roles the downstream steps consume.

/** How urgent the visitor's need is. Anchors journey selection. */
export type JourneyUrgency = "emergency" | "planned" | "browse";

/** The visitor's most likely posture at this stage. Section
 *  registrations declare which roles fulfil which stage. */
export type JourneyStageRole =
  | "attention"        // arrival, hero, headline
  | "trust"            // reviews, accreditations, guarantees
  | "browse"           // service menu, category tiles, product grid
  | "consider"         // portfolio, case study, comparison
  | "action"           // booking, quote form, cart, contact
  | "reassure"         // FAQ, testimonials, confirmation
  | "handoff";         // footer, ongoing contact

export type JourneyStage = {
  id: string;
  role: JourneyStageRole;
  purpose: string;
  /** Section roles that satisfy this stage. Composer picks the highest-
   *  scoring registered section whose role appears here. */
  primarySectionRoles: readonly string[];
  /** Optional CTA role — the composer surfaces a matching primary CTA
   *  when the stage supports it. */
  ctaRole?: "call" | "whatsapp" | "quote" | "book" | "buy" | "email";
};

/** Business goals a journey advances — mirrors LayoutRegistry's
 *  BusinessGoal type so scoring inputs pass through. */
export type JourneyGoal =
  | "lead-generation"
  | "bookings"
  | "quotes"
  | "portfolio-showcase"
  | "ecommerce"
  | "brand-awareness"
  | "directory-listing"
  | "operations-dashboard"
  | "content-publishing"
  | "trust-building"
  | "search-anchored";

export type JourneyConversionCharacter =
  | "single-cta"       // one path to conversion
  | "multi-touch"      // visitor sees 2-3 nudges
  | "browse-heavy";    // many touches, low urgency

export type JourneyDecisionProfile = {
  urgency: JourneyUrgency;
  /** Trade slugs this journey fits. `["*"]` = any trade. */
  worksBestFor: readonly string[];
  /** Business goals this journey advances. */
  bestGoals: readonly JourneyGoal[];
  /** Free-form keywords for AI scoring + merchant browsing. */
  keywords: readonly string[];
  conversionCharacter: JourneyConversionCharacter;
  /** Layout slugs that pair naturally with this journey — the
   *  layoutRegistry scoring can boost these when this journey wins. */
  typicalLayoutSlugs: readonly string[];
  /** How suitable this journey is for mobile-primary traffic (0..100). */
  mobileSuitability: number;
  /** How well this journey handles high-urgency traffic (0..100). */
  urgencyFit: number;
};

/** Canonical pages a journey may auto-generate. Composer walks
 *  `pageSet` and produces one composition per required page.
 *  Non-required pages are optional recommendations Studio surfaces
 *  as "one-click add" tiles. */
export type JourneyPageId =
  | "home"
  | "about"
  | "contact"
  | "projects"
  | "services"
  | "product-grid"
  | "product-detail"
  | "cart"
  | "checkout"
  | "faq"
  | "reviews"
  | "coverage";

export type JourneyPage = {
  id: JourneyPageId;
  /** Required = always composed. Optional = surfaced as a suggestion. */
  required: boolean;
  /** Layout slug the composer should pick for this page. When absent
   *  the composer runs layoutRegistry.rank() and picks the top. */
  layoutSlug?: string;
  /** One-line reason the page exists in this journey. Merchant-facing. */
  purpose: string;
};

/** Shared chrome that renders on every page of the journey. Studio
 *  materialises these as global surfaces the AI never has to re-pick. */
export type JourneyChrome = {
  stickyFooter?: {
    /** Show a floating WhatsApp CTA — merchant's number picked up
     *  from brand.contacts.whatsapp at render time. */
    whatsapp?: boolean;
    /** Show a floating phone CTA. */
    call?: boolean;
    /** Show a floating quote/enquiry CTA. */
    quote?: boolean;
  };
  sidebarRail?: {
    /** Persistent reviews rail. "left" | "right" | "off". Reviews come
     *  from brand.reviews at render time. */
    reviews?: "left" | "right" | "off";
  };
};

export type JourneyManifest = {
  manifestVersion: 1;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  version: string;
  category:
    | "trades-first"
    | "commerce-first"
    | "content-first"
    | "operations-first"
    | "directory-first";
  stages: readonly JourneyStage[];
  /** Pages the journey auto-generates. `home` is implicit + always
   *  first. Composer produces one plan per required page. */
  pageSet: readonly JourneyPage[];
  /** Global chrome — sticky footer, review rail, etc. */
  chrome: JourneyChrome;
  decision: JourneyDecisionProfile;
  publisher?: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };
};

/** Input the composer passes to `journeyRegistry.rank()`. */
export type JourneyRankInput = {
  trade?: string;
  urgency?: JourneyUrgency;
  goals?: readonly JourneyGoal[];
  keywords?: readonly string[];
  /** Wants — feature flags extracted at intent time. Journeys that
   *  don't support a wanted feature score lower. */
  wantsBooking?: boolean;
  wantsEcommerce?: boolean;
  wantsPortfolio?: boolean;
  wantsSearch?: boolean;
  /** Preferred conversion character — matches gain a small boost. */
  preferredCharacter?: JourneyConversionCharacter;
};

export type JourneyRankResult = {
  journey: Readonly<JourneyManifest>;
  score: number;
  reasons: readonly string[];
};

export type FrozenJourneyManifest = Readonly<JourneyManifest>;
