// layouts.trades — trust-first trade page with portfolio.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "trades",
  name: "Trades",
  tagline: "Trust-anchored trade page with portfolio and reviews",
  description:
    "Big photographic hero with trust anchor + services + portfolio grid + reviews + FAQ + contact form. Reads as credible and photo-heavy — the trades default.",
  version: "1.0.0",
  category: "trades-first",
  defaultNavigationId: "top-sticky",

  sequence: [
    { containerId: "containers.hero", role: "trust-anchor-hero" },
    { containerId: "containers.single-column", role: "trust-bar" },
    { containerId: "containers.single-column", role: "services-list" },
    { containerId: "containers.single-column", role: "features" },
    { containerId: "containers.single-column", role: "portfolio-grid" },
    { containerId: "containers.single-column", role: "reviews" },
    { containerId: "containers.single-column", role: "faq" },
    { containerId: "containers.single-column", role: "contact-form" },
    { containerId: "containers.single-column", role: "footer" }
  ],

  decision: {
    worksBestFor: [
      "plumber",
      "electrician",
      "gas-engineer",
      "roofer",
      "handyman",
      "hvac-contractor",
      "carpenter",
      "joiner",
      "painter",
      "tiler",
      "plasterer",
      "landscaper",
      "kitchen-fitter",
      "bathroom-fitter"
    ],
    bestIndustries: ["construction", "trades", "home-services"],
    primaryGoals: [
      "lead-generation",
      "quotes",
      "trust-building",
      "portfolio-showcase"
    ],
    keywords: [
      "trades",
      "trust",
      "portfolio",
      "reviews",
      "photo-heavy",
      "construction"
    ],
    minSections: 7,
    maxSections: 12,
    heroType: "full-width-photo",
    imageDensity: "heavy",
    pageLength: "medium",
    supportsBooking: false,
    supportsEcommerce: false,
    supportsPortfolio: true,
    supportsSearch: false,
    supportsMap: true,
    supportsFloatingCta: true,
    recommendedNavigationId: "top-sticky",
    compatibleNavigationPatterns: [
      "top-sticky",
      "top-classic",
      "top-transparent",
      "drawer-hamburger"
    ],
    requiredContainers: ["containers.hero", "containers.single-column"],
    requiredSectionRoles: [
      "trust-anchor-hero",
      "services-list",
      "portfolio-grid",
      "reviews",
      "contact-form"
    ],
    mobileSuitability: 92,
    seoStrength: 90,
    conversionStrength: 85,
    trustSignalStrength: 95
  },
  publisher: P
});
