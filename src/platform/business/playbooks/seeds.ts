// playbookRegistry — 10 seed patterns.

import { playbookRegistry } from "./registry";

const P = { name: "Xrated Trades Platform", verified: true } as const;
const E = {
  confidence: 75,
  evidenceStrength: "anecdotal" as const,
  sampleSize: 0,
  marketsValidated: ["GB", "IE"]
};

// 1. Trust first
playbookRegistry.register({
  manifestVersion: 1,
  slug: "trust-first",
  name: "Trust First",
  description:
    "Foreground trust markers: insurance, guarantees, years trading, reviews. Best when merchants compete on credibility.",
  version: "1.0.0",
  category: "trust",
  appliesTo: { trades: ["*"] },
  facets: {
    "trust.placement": { slots: ["hero", "trust-bar"] },
    "trust.elements": {
      list: ["insurance", "guarantees", "years-trading", "reviews", "certifications"]
    },
    "sections.emphasise": { roles: ["trust-anchor-hero", "trust-bar", "reviews"] },
    "hero.style": { value: "trust-anchor" }
  },
  source: "platform-authored",
  evidence: E,
  publisher: P
});

// 2. Portfolio heavy
playbookRegistry.register({
  manifestVersion: 1,
  slug: "portfolio-heavy",
  name: "Portfolio Heavy",
  description:
    "Gallery-first composition. Real photos with before/during/finished shots, cost + duration captions, testimonial pairing. Never stock imagery.",
  version: "1.0.0",
  category: "portfolio",
  appliesTo: {
    trades: ["*"],
    profileFlags: ["premium", "luxury"]
  },
  facets: {
    "gallery.style": { value: "before-after" },
    "gallery.minImages": { value: 12 },
    "gallery.captionRules": {
      list: ["cost", "duration", "materials", "location"]
    },
    "gallery.requiresBeforeAfter": { value: true },
    "sections.emphasise": {
      roles: ["portfolio-hero", "portfolio-grid", "featured-case-study"]
    }
  },
  source: "platform-authored",
  evidence: E,
  publisher: P
});

// 3. Local SEO
playbookRegistry.register({
  manifestVersion: 1,
  slug: "local-seo",
  name: "Local SEO",
  description:
    "Multi-page location strategy: town pages, county pages, service-area pages, plus location-tagged testimonials and Google Maps embed.",
  version: "1.0.0",
  category: "seo",
  appliesTo: { trades: ["*"] },
  facets: {
    "seo.pageKinds": {
      kinds: ["home", "town", "county", "service-area", "emergency"]
    },
    "seo.locationStrategy": { strategy: "hybrid-town-county" },
    "seo.keywordEmphasis": {
      themes: ["local", "town-name", "trade-in-location"]
    }
  },
  source: "platform-authored",
  evidence: E,
  publisher: P
});

// 4. Premium luxury
playbookRegistry.register({
  manifestVersion: 1,
  slug: "premium-luxury",
  name: "Premium Luxury",
  description:
    "Dark theme, minimal copy, large imagery, no pricing, book-consultation CTA, awards positioned near the top.",
  version: "1.0.0",
  category: "brand",
  appliesTo: {
    trades: ["*"],
    profileFlags: ["luxury"]
  },
  facets: {
    "theme.preferredMode": { value: "dark" },
    "theme.preferredMotion": { value: "expressive" },
    "pricing.display": { value: "hidden" },
    "cta.primary": { intent: "book-consultation" },
    "hero.style": { value: "editorial-photo" },
    "sections.emphasise": { roles: ["awards", "portfolio-grid", "author-bio"] },
    "booking.flowKind": { value: "consultation" },
    "booking.depositPolicy": { value: "optional" },
    "booking.availabilityDisplay": { value: "consultation" }
  },
  source: "platform-authored",
  evidence: E,
  publisher: P
});

// 5. Emergency response
playbookRegistry.register({
  manifestVersion: 1,
  slug: "emergency-response",
  name: "Emergency Response",
  description:
    "Call Now primary CTA, 24/7 badge, coverage map, thumb-zone floating CTA, response-time promise front and center.",
  version: "1.0.0",
  category: "urgency",
  appliesTo: {
    trades: ["*"],
    profileFlags: ["emergency"]
  },
  facets: {
    "cta.primary": { intent: "call-now" },
    "cta.secondary": { intent: "whatsapp" },
    "cta.placement": { slots: ["hero", "sticky-top", "floating-bottom-right"] },
    "booking.flowKind": { value: "emergency" },
    "booking.gate": { value: "emergency" },
    "booking.availabilityDisplay": { value: "callback-only" },
    "booking.depositPolicy": { value: "none" },
    "hero.style": { value: "emergency-247" },
    "hero.messageStrategy": { value: "response-time-promise" },
    "trust.placement": { slots: ["hero", "cta-band"] },
    "sections.emphasise": {
      roles: ["hero-primary", "coverage-map", "reviews", "cta"]
    },
    "dashboard.primaryMetrics": {
      list: [
        "callback_requests",
        "callback_response_time",
        "unread_messages",
        "upcoming_bookings",
        "review_score"
      ]
    },
    "dashboard.suggestedActions": {
      list: [
        "call-back-unanswered-leads",
        "publish-coverage-map-page",
        "collect-post-callout-review"
      ]
    }
  },
  source: "platform-authored",
  evidence: {
    ...E,
    confidence: 85,
    evidenceStrength: "measured",
    sampleSize: 340
  },
  publisher: P
});

// 6. Quote driven
playbookRegistry.register({
  manifestVersion: 1,
  slug: "quote-driven",
  name: "Quote Driven",
  description:
    "Free-survey primary CTA, request-quote secondary, finance-available panel, guarantee panel. Best for premium services with variable pricing.",
  version: "1.0.0",
  category: "conversion",
  appliesTo: { trades: ["*"] },
  facets: {
    "cta.primary": { intent: "free-survey" },
    "cta.secondary": { intent: "request-quote" },
    "pricing.display": { value: "guide" },
    "booking.flowKind": { value: "simple" },
    "booking.depositPolicy": { value: "none" },
    "booking.availabilityDisplay": { value: "next-available" },
    "sections.emphasise": {
      roles: ["hero-primary", "services-list", "trust-bar", "faq", "contact-form"]
    },
    "trust.elements": { list: ["guarantees", "no-callout-fee", "insurance"] },
    "dashboard.primaryMetrics": {
      list: [
        "quote_requests",
        "form_conversion_rate",
        "average_job_value",
        "revenue_total",
        "jobs_completed"
      ]
    },
    "dashboard.suggestedActions": {
      list: [
        "respond-to-open-quotes",
        "publish-testimonial-page",
        "upload-recent-project-photos"
      ]
    }
  },
  source: "platform-authored",
  evidence: E,
  publisher: P
});

// 7. Before after
playbookRegistry.register({
  manifestVersion: 1,
  slug: "before-after",
  name: "Before & After",
  description:
    "Image-slider comparison, cost/duration captions, timelapse-friendly. Best for high-visual-contrast trades (roofing, painting, landscaping, kitchens).",
  version: "1.0.0",
  category: "storytelling",
  appliesTo: {
    trades: [
      "roofer",
      "painter",
      "landscaper",
      "kitchen-fitter",
      "bathroom-fitter",
      "tiler"
    ]
  },
  facets: {
    "gallery.style": { value: "before-after-slider" },
    "gallery.requiresBeforeAfter": { value: true },
    "gallery.captionRules": { list: ["cost", "duration"] }
  },
  source: "platform-authored",
  evidence: E,
  publisher: P
});

// 8. High margin focus
playbookRegistry.register({
  manifestVersion: 1,
  slug: "high-margin-focus",
  name: "High Margin Focus",
  description:
    "Emphasise high-value services + upsells, hide low-margin work, package pricing preferred.",
  version: "1.0.0",
  category: "commerce",
  appliesTo: { trades: ["*"] },
  facets: {
    "pricing.display": { value: "package" },
    "pricing.highlight": { hint: "growth-strategy-push-services" },
    "pricing.hide": { hint: "growth-strategy-reduce-services" },
    "sections.emphasise": { roles: ["services-list", "pricing-tiers", "upsell-panel"] },
    "marketing.upsellMoments": {
      list: ["after-primary-install", "at-quote-acceptance", "post-completion"]
    }
  },
  source: "platform-authored",
  evidence: E,
  publisher: P
});

// 9. Residential focus
playbookRegistry.register({
  manifestVersion: 1,
  slug: "residential-focus",
  name: "Residential Focus",
  description:
    "Homeowner voice, family-safe imagery, showroom-quality photos, testimonials front and center.",
  version: "1.0.0",
  category: "customer-segment",
  appliesTo: {
    trades: ["*"],
    profileFlags: ["residential"]
  },
  facets: {
    "sections.emphasise": {
      roles: ["services-list", "testimonials", "portfolio-grid", "contact-form"]
    },
    "sections.exclude": { roles: ["trade-account", "wholesale-panel"] },
    "trust.elements": { list: ["reviews", "guarantees", "years-trading"] }
  },
  source: "platform-authored",
  evidence: E,
  publisher: P
});

// 10. Commercial focus
playbookRegistry.register({
  manifestVersion: 1,
  slug: "commercial-focus",
  name: "Commercial Focus",
  description:
    "Business voice, case-study emphasis, ROI language, trade-account CTA. Sidebar nav on desktop.",
  version: "1.0.0",
  category: "customer-segment",
  appliesTo: {
    trades: ["*"],
    profileFlags: ["commercial"]
  },
  facets: {
    "sections.emphasise": {
      roles: [
        "featured-case-study",
        "portfolio-grid",
        "features-grid",
        "trade-account"
      ]
    },
    "sections.exclude": { roles: ["home-testimonials", "before-after-slider"] },
    "cta.primary": { intent: "open-trade-account" },
    "cta.secondary": { intent: "request-quote" },
    "trust.elements": {
      list: ["certifications", "accreditations", "years-trading", "case-studies"]
    }
  },
  source: "platform-authored",
  evidence: E,
  publisher: P
});
