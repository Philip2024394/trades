// layouts.saas — feature + pricing SaaS marketing page.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "saas",
  name: "SaaS",
  tagline: "Feature + comparison + pricing SaaS marketing page",
  description:
    "Text-forward hero + features grid + comparison table + pricing tiers + testimonials + CTA. Built for software / subscription / plan-driven products.",
  version: "1.0.0",
  category: "content-first",
  defaultNavigationId: "top-floating",

  sequence: [
    { containerId: "containers.hero", role: "text-hero" },
    { containerId: "containers.single-column", role: "features-grid" },
    { containerId: "containers.comparison", role: "feature-comparison" },
    { containerId: "containers.grid", role: "pricing-tiers" },
    { containerId: "containers.single-column", role: "testimonials" },
    { containerId: "containers.single-column", role: "faq" },
    { containerId: "containers.single-column", role: "cta" },
    { containerId: "containers.single-column", role: "footer" }
  ],

  decision: {
    worksBestFor: ["*"],
    bestIndustries: ["software", "saas", "professional-services"],
    primaryGoals: ["lead-generation", "brand-awareness", "trust-building"],
    keywords: [
      "saas",
      "software",
      "pricing",
      "features",
      "plans",
      "subscription",
      "comparison"
    ],
    minSections: 6,
    maxSections: 10,
    heroType: "minimal-centered",
    imageDensity: "light",
    pageLength: "medium",
    supportsBooking: false,
    supportsEcommerce: false,
    supportsPortfolio: false,
    supportsSearch: false,
    supportsMap: false,
    supportsFloatingCta: true,
    recommendedNavigationId: "top-floating",
    compatibleNavigationPatterns: [
      "top-floating",
      "top-sticky",
      "top-classic",
      "drawer-hamburger"
    ],
    requiredContainers: [
      "containers.hero",
      "containers.comparison",
      "containers.grid"
    ],
    requiredSectionRoles: [
      "text-hero",
      "features-grid",
      "pricing-tiers"
    ],
    mobileSuitability: 88,
    seoStrength: 82,
    conversionStrength: 90,
    trustSignalStrength: 78
  },
  publisher: P
});
