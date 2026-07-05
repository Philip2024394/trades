// websiteRecipeRegistry — seed recipes.
//
// Recipes are TINY. They just reference playbooks. No decision logic
// duplicated across recipes.

import { websiteRecipeRegistry } from "./registry";

const P = { name: "Xrated Trades Platform", verified: true } as const;
const E = {
  confidence: 78,
  evidenceStrength: "anecdotal" as const,
  marketsValidated: ["GB", "IE"]
};

// Recipe 1 — Door Installation Specialist
websiteRecipeRegistry.register({
  manifestVersion: 1,
  slug: "door-installation-specialist",
  name: "Door Installation Specialist",
  description:
    "Trust-first, portfolio-heavy, local SEO, quote-driven, high-margin focus, residential. The default recipe for a carpenter or joiner pushing door installations.",
  version: "1.0.0",
  appliesTo: {
    trades: ["carpenter", "joiner"],
    profileFlags: ["premium", "residential"],
    growthGoals: ["increase-average-job-value", "lead-generation"]
  },
  playbooks: [
    "trust-first",
    "portfolio-heavy",
    "local-seo",
    "quote-driven",
    "high-margin-focus",
    "residential-focus"
  ],
  source: "platform-authored",
  evidence: E,
  publisher: P
});

// Recipe 2 — Emergency 24/7 Service
websiteRecipeRegistry.register({
  manifestVersion: 1,
  slug: "emergency-247-service",
  name: "Emergency 24/7 Service",
  description:
    "Emergency response + trust-first + local SEO. Minimalist page, thumb-zone CTA, Call Now primary.",
  version: "1.0.0",
  appliesTo: {
    trades: ["plumber", "electrician", "gas-engineer", "locksmith"],
    profileFlags: ["emergency"],
    growthGoals: ["increase-conversion-rate", "bookings"]
  },
  playbooks: ["emergency-response", "trust-first", "local-seo"],
  source: "platform-authored",
  evidence: {
    ...E,
    confidence: 85,
    evidenceStrength: "measured",
    sampleSize: 340
  },
  publisher: P
});

// Recipe 3 — Luxury Showroom
websiteRecipeRegistry.register({
  manifestVersion: 1,
  slug: "luxury-showroom",
  name: "Luxury Showroom",
  description:
    "Premium luxury + portfolio heavy + before/after. Dark editorial aesthetic, hidden pricing, book-consultation CTA.",
  version: "1.0.0",
  appliesTo: {
    trades: ["kitchen-fitter", "bathroom-fitter", "extension-builder"],
    profileFlags: ["luxury", "premium", "residential"],
    growthGoals: ["portfolio-showcase", "brand-awareness"]
  },
  playbooks: ["premium-luxury", "portfolio-heavy", "before-after"],
  source: "platform-authored",
  evidence: E,
  publisher: P
});

// Recipe 4 — Residential Trades Default
websiteRecipeRegistry.register({
  manifestVersion: 1,
  slug: "residential-trades-default",
  name: "Residential Trades Default",
  description:
    "Balanced recipe for any residential trade — trust, residential focus, local SEO, quote-driven. Safe fallback when no more-specific recipe fits.",
  version: "1.0.0",
  appliesTo: {
    trades: ["*"],
    profileFlags: ["residential"]
  },
  playbooks: ["trust-first", "residential-focus", "quote-driven", "local-seo"],
  source: "platform-authored",
  evidence: E,
  publisher: P
});

// Recipe 5 — Commercial Trades Default
websiteRecipeRegistry.register({
  manifestVersion: 1,
  slug: "commercial-trades-default",
  name: "Commercial Trades Default",
  description:
    "Case-study forward + commercial focus + trust-first + high-margin. Trade-account CTA + certifications emphasis.",
  version: "1.0.0",
  appliesTo: {
    trades: ["*"],
    profileFlags: ["commercial"]
  },
  playbooks: ["commercial-focus", "trust-first", "high-margin-focus", "local-seo"],
  source: "platform-authored",
  evidence: E,
  publisher: P
});
