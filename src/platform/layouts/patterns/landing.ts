// layouts.landing — general lead-generation landing page.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "landing",
  name: "Landing",
  tagline: "Balanced lead-generation page for any trade",
  description:
    "Full-width photo hero + trust bar + services + features + testimonials + CTA. The safe default that converts across most trades.",
  version: "1.0.0",
  category: "trades-first",
  defaultNavigationId: "top-sticky",

  sequence: [
    { containerId: "containers.hero", role: "hero-primary" },
    { containerId: "containers.single-column", role: "trust-bar" },
    { containerId: "containers.single-column", role: "services-list" },
    { containerId: "containers.single-column", role: "features" },
    { containerId: "containers.single-column", role: "testimonials" },
    { containerId: "containers.single-column", role: "faq" },
    { containerId: "containers.single-column", role: "cta" },
    { containerId: "containers.single-column", role: "footer" }
  ],

  decision: {
    worksBestFor: ["*"],
    bestIndustries: ["construction", "trades", "home-services", "professional-services"],
    primaryGoals: ["lead-generation", "trust-building"],
    keywords: [
      "landing",
      "trades",
      "lead-gen",
      "quotes",
      "contact-first",
      "balanced"
    ],
    minSections: 6,
    maxSections: 10,
    heroType: "full-width-photo",
    imageDensity: "medium",
    pageLength: "medium",
    supportsBooking: false,
    supportsEcommerce: false,
    supportsPortfolio: false,
    supportsSearch: false,
    supportsMap: false,
    supportsFloatingCta: true,
    recommendedNavigationId: "top-sticky",
    compatibleNavigationPatterns: [
      "top-sticky",
      "top-classic",
      "drawer-hamburger"
    ],
    requiredContainers: ["containers.hero", "containers.single-column"],
    requiredSectionRoles: [
      "hero-primary",
      "trust-bar",
      "services-list",
      "cta"
    ],
    mobileSuitability: 90,
    seoStrength: 85,
    conversionStrength: 80,
    trustSignalStrength: 75
  },
  publisher: P
});
