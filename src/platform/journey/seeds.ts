// journeyRegistry — 7 canonical customer journeys.
//
// Every UK-trades merchant profile the AI composes sits under one of
// these journeys. Adding a journey: append here + it's live in the
// composer next boot.
//
// Each journey declares:
//   • stages  — the visitor's conversion flow (attention → action)
//   • pageSet — pages auto-composed for the merchant (home is always
//               required; About / Contact / Projects for services-only
//               trades; Product Grid for product sellers)
//   • chrome  — sticky WhatsApp footer + left review rail per user
//               spec 2026-07-09. Global surfaces the AI never re-picks.

import { journeyRegistry } from "./registry";

const P = { name: "Xrated Trades Platform", verified: true } as const;

// Shared chrome used by every merchant-facing journey (all except
// the platform-side directory-lookup which serves the directory app
// itself, not a merchant profile).
const MERCHANT_CHROME = {
  stickyFooter: { whatsapp: true, call: false, quote: false },
  sidebarRail: { reviews: "left" }
} as const;

// ─── 1. Emergency callout — single-CTA panic path ─────────────
journeyRegistry.register({
  manifestVersion: 1,
  slug: "emergency-callout",
  name: "Emergency Callout",
  tagline: "Panic-mode visitor lands, taps call, conversation starts.",
  description:
    "One-page, single-CTA journey for high-urgency search traffic. Hero communicates availability + service area; trust bar reassures; a phone/WhatsApp CTA is present at every scroll depth.",
  version: "1.0.0",
  category: "trades-first",
  stages: [
    {
      id: "attention",
      role: "attention",
      purpose: "Hero states availability + service area with a phone CTA.",
      primarySectionRoles: ["emergency-hero", "hero"],
      ctaRole: "call"
    },
    {
      id: "trust",
      role: "trust",
      purpose: "Reassure with reviews, accreditations, response time.",
      primarySectionRoles: ["trust-bar", "reviews-strip"]
    },
    {
      id: "action",
      role: "action",
      purpose: "Repeat call/WhatsApp CTA — reachable at scroll.",
      primarySectionRoles: ["contact-fallback", "sticky-cta"],
      ctaRole: "whatsapp"
    }
  ],
  pageSet: [
    { id: "home", required: true, purpose: "Landing — availability, region, CTA." },
    { id: "contact", required: true, purpose: "Fallback contact when the visitor scrolls past the CTA." },
    { id: "about", required: false, purpose: "Optional trust-builder for repeat lookups." }
  ],
  chrome: {
    stickyFooter: { whatsapp: true, call: true },
    sidebarRail: { reviews: "left" }
  },
  decision: {
    urgency: "emergency",
    worksBestFor: [
      "plumber",
      "electrician",
      "gas-engineer",
      "roofer",
      "drainage-engineer",
      "pest-control",
      "damp-proofer",
      "asbestos-removal"
    ],
    bestGoals: ["lead-generation", "quotes"],
    keywords: ["emergency", "24/7", "callout", "urgent", "same-day", "now"],
    conversionCharacter: "single-cta",
    typicalLayoutSlugs: ["landing", "trades"],
    mobileSuitability: 95,
    urgencyFit: 100
  },
  publisher: P
});

// ─── 2. Research-then-quote — considered project journey ──────
journeyRegistry.register({
  manifestVersion: 1,
  slug: "research-then-quote",
  name: "Research then Quote",
  tagline: "Visitor researches capability, then requests a quote.",
  description:
    "Multi-touch journey for planned work. Portfolio, testimonials, and case studies build confidence before the visitor commits to a quote request. Best fit for larger jobs and specialist trades.",
  version: "1.0.0",
  category: "trades-first",
  stages: [
    {
      id: "attention",
      role: "attention",
      purpose: "Hero states specialism + region + accreditations.",
      primarySectionRoles: ["hero", "trust-hero"]
    },
    {
      id: "browse",
      role: "browse",
      purpose: "Services menu — what we do.",
      primarySectionRoles: ["services-menu", "services-grid"]
    },
    {
      id: "consider",
      role: "consider",
      purpose: "Portfolio gallery + case-study cards to prove capability.",
      primarySectionRoles: ["gallery", "portfolio", "case-study"]
    },
    {
      id: "trust",
      role: "trust",
      purpose: "Reviews with first-name attribution.",
      primarySectionRoles: ["testimonials", "reviews-strip"]
    },
    {
      id: "action",
      role: "action",
      purpose: "Quote form — captures scope + contact details.",
      primarySectionRoles: ["quote-form", "contact-form"],
      ctaRole: "quote"
    }
  ],
  pageSet: [
    { id: "home", required: true, purpose: "Landing — specialism + top-level services + trust." },
    { id: "about", required: true, purpose: "Story, accreditations, team — the trust-builder." },
    { id: "projects", required: true, purpose: "Portfolio grid of completed work with case-study depth." },
    { id: "contact", required: true, purpose: "Full quote form + phone + email + WhatsApp." },
    { id: "services", required: false, purpose: "Long-form service breakdown when the merchant offers 6+ services." }
  ],
  chrome: MERCHANT_CHROME,
  decision: {
    urgency: "planned",
    worksBestFor: [
      "general-builder",
      "carpenter",
      "joiner",
      "kitchen-fitter",
      "bathroom-fitter",
      "landscaper",
      "roofer",
      "conservatory-installer",
      "solar-installer",
      "heat-pump-installer",
      "extension-specialist"
    ],
    bestGoals: ["quotes", "portfolio-showcase", "trust-building"],
    keywords: ["portfolio", "quote", "project", "estimate", "consultation"],
    conversionCharacter: "multi-touch",
    typicalLayoutSlugs: ["trades", "portfolio"],
    mobileSuitability: 85,
    urgencyFit: 60
  },
  publisher: P
});

// ─── 3. Browse-then-book — appointment/slot journey ───────────
journeyRegistry.register({
  manifestVersion: 1,
  slug: "browse-then-book",
  name: "Browse then Book",
  tagline: "Visitor scans services, picks a slot, books.",
  description:
    "Book-first journey for merchants who take appointments. Service menu leads into a calendar + slot picker, with an optional deposit at confirmation.",
  version: "1.0.0",
  category: "trades-first",
  stages: [
    {
      id: "attention",
      role: "attention",
      purpose: "Hero states booking availability + region.",
      primarySectionRoles: ["booking-hero", "hero"]
    },
    {
      id: "browse",
      role: "browse",
      purpose: "Services menu with duration + price bands.",
      primarySectionRoles: ["services-menu", "pricing"]
    },
    {
      id: "action",
      role: "action",
      purpose: "Calendar + slot picker — the primary conversion.",
      primarySectionRoles: ["booking-wizard", "calendar"],
      ctaRole: "book"
    },
    {
      id: "reassure",
      role: "reassure",
      purpose: "FAQ + confirmation copy — nudges any last hesitation.",
      primarySectionRoles: ["faq", "confirmation"]
    }
  ],
  pageSet: [
    { id: "home", required: true, purpose: "Landing — book-now hero + service preview + trust." },
    { id: "services", required: true, purpose: "Full services menu with duration + price bands + book buttons." },
    { id: "about", required: true, purpose: "Story, accreditations, working area." },
    { id: "contact", required: true, purpose: "Contact + fallback when a slot isn't right." },
    { id: "projects", required: false, purpose: "Optional — recent jobs when the trade benefits from visual proof." },
    { id: "faq", required: false, purpose: "Common questions about slots, cancellations, deposits." }
  ],
  chrome: MERCHANT_CHROME,
  decision: {
    urgency: "planned",
    worksBestFor: [
      "chimney-sweep",
      "hvac-contractor",
      "carpenter",
      "gas-engineer",
      "boiler-repair",
      "tree-surgeon",
      "pest-control",
      "post-construction-cleaner",
      "mobile-mechanic"
    ],
    bestGoals: ["bookings", "lead-generation"],
    keywords: ["book", "appointment", "slot", "calendar", "schedule"],
    conversionCharacter: "single-cta",
    typicalLayoutSlugs: ["booking"],
    mobileSuitability: 90,
    urgencyFit: 55
  },
  publisher: P
});

// ─── 4. Directory lookup — customer searches for a merchant ───
journeyRegistry.register({
  manifestVersion: 1,
  slug: "directory-lookup",
  name: "Directory Lookup",
  tagline: "Customer searches by trade + region, picks a merchant.",
  description:
    "Search-anchored journey where the visitor scans a directory of merchants. Filter + sort + merchant cards. The 'conversion' is a handoff to the picked merchant's profile page.",
  version: "1.0.0",
  category: "directory-first",
  stages: [
    {
      id: "search",
      role: "attention",
      purpose: "Search-anchored hero: postcode + trade selector.",
      primarySectionRoles: ["search-hero", "hero"]
    },
    {
      id: "browse",
      role: "browse",
      purpose: "Filtered results — merchant cards with badges.",
      primarySectionRoles: ["merchant-grid", "directory-results"]
    },
    {
      id: "consider",
      role: "consider",
      purpose: "Merchant profile preview: rating + services + gallery peek.",
      primarySectionRoles: ["merchant-card-detail", "merchant-preview"]
    },
    {
      id: "action",
      role: "action",
      purpose: "Contact handoff to the merchant.",
      primarySectionRoles: ["contact-handoff", "contact-form"],
      ctaRole: "email"
    }
  ],
  pageSet: [
    { id: "home", required: true, purpose: "Directory landing — search + featured merchants." }
  ],
  chrome: {
    // Directory itself has no merchant-specific chrome.
    stickyFooter: { whatsapp: false, call: false },
    sidebarRail: { reviews: "off" }
  },
  decision: {
    urgency: "browse",
    worksBestFor: ["*"],
    bestGoals: ["directory-listing", "search-anchored", "lead-generation"],
    keywords: ["directory", "search", "postcode", "filter", "browse"],
    conversionCharacter: "browse-heavy",
    typicalLayoutSlugs: ["directory", "marketplace"],
    mobileSuitability: 88,
    urgencyFit: 40
  },
  publisher: P
});

// ─── 5. Product purchase — merchant sells products ────────────
journeyRegistry.register({
  manifestVersion: 1,
  slug: "product-purchase",
  name: "Product Purchase",
  tagline: "Visitor browses products, adds to cart, checks out.",
  description:
    "Ecommerce-first journey for merchants + suppliers. Category grid → PDP → cart → checkout. Handles quote-form-only checkout for trades who take payment offline.",
  version: "1.0.0",
  category: "commerce-first",
  stages: [
    {
      id: "attention",
      role: "attention",
      purpose: "Product-showroom hero — bestsellers or new arrivals.",
      primarySectionRoles: ["product-hero", "hero"]
    },
    {
      id: "browse",
      role: "browse",
      purpose: "Product grid with filters + categories.",
      primarySectionRoles: ["product-grid", "category-grid"]
    },
    {
      id: "consider",
      role: "consider",
      purpose: "Product detail with variants + reviews.",
      primarySectionRoles: ["product-detail", "pdp"]
    },
    {
      id: "cart",
      role: "action",
      purpose: "Cart summary — quantity + variant sanity.",
      primarySectionRoles: ["cart-summary", "cart"]
    },
    {
      id: "checkout",
      role: "action",
      purpose: "Checkout form (or quote-form handoff for trades).",
      primarySectionRoles: ["checkout-form", "quote-form"],
      ctaRole: "buy"
    }
  ],
  pageSet: [
    { id: "home", required: true, purpose: "Landing — showroom hero + featured categories." },
    { id: "product-grid", required: true, purpose: "Full catalogue with filter + sort." },
    { id: "product-detail", required: true, purpose: "Per-product PDP: variants, reviews, cart action." },
    { id: "cart", required: true, purpose: "Cart summary + variant sanity + quote handoff option." },
    { id: "checkout", required: true, purpose: "Checkout form (or quote-request handoff for trades)." },
    { id: "about", required: true, purpose: "Supplier story — who, where from, trade credentials." },
    { id: "contact", required: true, purpose: "Bulk / trade-account enquiry + delivery questions." },
    { id: "projects", required: false, purpose: "Optional — supply-in-use case studies when the supplier has portfolio-worthy jobs." }
  ],
  chrome: MERCHANT_CHROME,
  decision: {
    urgency: "planned",
    worksBestFor: [
      "building-merchant",
      "builders-supplies",
      "tool-hire",
      "heavy-machinery",
      "metal-engineer"
    ],
    bestGoals: ["ecommerce", "lead-generation"],
    keywords: ["shop", "buy", "checkout", "cart", "products", "delivery"],
    conversionCharacter: "browse-heavy",
    typicalLayoutSlugs: ["ecommerce"],
    mobileSuitability: 80,
    urgencyFit: 45
  },
  publisher: P
});

// ─── 6. Showcase portfolio — brand-led exhibition journey ─────
journeyRegistry.register({
  manifestVersion: 1,
  slug: "showcase-portfolio",
  name: "Showcase Portfolio",
  tagline: "Visitor immerses in past work, then reaches out.",
  description:
    "Portfolio-heavy journey for craftsmanship-first trades. Hero → gallery → about → testimonials → contact. Optimised for premium brand feel; conversion pressure is soft.",
  version: "1.0.0",
  category: "content-first",
  stages: [
    {
      id: "attention",
      role: "attention",
      purpose: "Editorial hero — full-bleed image + short statement.",
      primarySectionRoles: ["editorial-hero", "hero"]
    },
    {
      id: "consider",
      role: "consider",
      purpose: "Full-width portfolio gallery — before/after where relevant.",
      primarySectionRoles: ["gallery-showcase", "portfolio", "before-after"]
    },
    {
      id: "trust",
      role: "trust",
      purpose: "About story + testimonials with photos.",
      primarySectionRoles: ["about-story", "testimonials-photo"]
    },
    {
      id: "action",
      role: "action",
      purpose: "Soft contact form or email invite.",
      primarySectionRoles: ["contact-form", "email-invite"],
      ctaRole: "email"
    }
  ],
  pageSet: [
    { id: "home", required: true, purpose: "Editorial hero + portfolio strip + soft CTA." },
    { id: "projects", required: true, purpose: "Full-width portfolio grid — before/after, materials, story per job." },
    { id: "about", required: true, purpose: "Craft story, workshop / studio, awards, values." },
    { id: "contact", required: true, purpose: "Soft-touch enquiry form + email invite." }
  ],
  chrome: MERCHANT_CHROME,
  decision: {
    urgency: "browse",
    worksBestFor: [
      "stonemason",
      "joiner",
      "painter",
      "landscaper",
      "garden-designer",
      "sash-window-restorer",
      "kitchen-fitter"
    ],
    bestGoals: ["portfolio-showcase", "brand-awareness", "trust-building"],
    keywords: ["portfolio", "craft", "showcase", "before-after", "gallery"],
    conversionCharacter: "browse-heavy",
    typicalLayoutSlugs: ["portfolio", "magazine"],
    mobileSuitability: 82,
    urgencyFit: 30
  },
  publisher: P
});

// ─── 7. Local search anchored — SEO landing journey ───────────
journeyRegistry.register({
  manifestVersion: 1,
  slug: "local-search-anchored",
  name: "Local Search Anchored",
  tagline: "Search-first landing that ranks + converts local queries.",
  description:
    "SEO-hardened journey. Search-hero doubles as a postcode input; area-list + reviews reinforce local intent; footer surfaces every service-area page. Best fit for merchants competing on 'trade + town' keywords.",
  version: "1.0.0",
  category: "trades-first",
  stages: [
    {
      id: "search",
      role: "attention",
      purpose: "Search-anchored hero + local promise.",
      primarySectionRoles: ["search-hero", "hero"]
    },
    {
      id: "browse",
      role: "browse",
      purpose: "Service areas grid — every town + postcode covered.",
      primarySectionRoles: ["service-areas", "coverage-map"]
    },
    {
      id: "trust",
      role: "trust",
      purpose: "Reviews with location tag + accreditations.",
      primarySectionRoles: ["reviews-strip", "trust-bar"]
    },
    {
      id: "action",
      role: "action",
      purpose: "Contact + call CTA with location context.",
      primarySectionRoles: ["contact-fallback", "contact-form"],
      ctaRole: "call"
    }
  ],
  pageSet: [
    { id: "home", required: true, purpose: "Search-anchored hero + coverage + reviews." },
    { id: "coverage", required: true, purpose: "Service areas grid — every town + postcode." },
    { id: "reviews", required: true, purpose: "Full reviews page tagged by location — SEO gold." },
    { id: "contact", required: true, purpose: "Contact + call CTA with location context." },
    { id: "about", required: false, purpose: "Optional — usually merged into the home page." },
    { id: "projects", required: false, purpose: "Optional — portfolio proof when the trade benefits from it." }
  ],
  chrome: {
    stickyFooter: { whatsapp: true, call: true },
    sidebarRail: { reviews: "left" }
  },
  decision: {
    urgency: "planned",
    worksBestFor: ["*"],
    bestGoals: ["search-anchored", "lead-generation", "directory-listing"],
    keywords: ["local", "postcode", "area", "town", "coverage", "seo"],
    conversionCharacter: "multi-touch",
    typicalLayoutSlugs: ["landing", "directory"],
    mobileSuitability: 88,
    urgencyFit: 50
  },
  publisher: P
});
