// layouts.magazine — long-form editorial content page.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "magazine",
  name: "Magazine",
  tagline: "Long-form editorial article page with related content",
  description:
    "Magazine layout container + article body + author bio + related articles + newsletter signup + footer. Optimised for reading time.",
  version: "1.0.0",
  category: "content-first",
  defaultNavigationId: "top-sticky",

  sequence: [
    { containerId: "containers.hero", role: "article-hero" },
    { containerId: "containers.magazine", role: "article-body" },
    { containerId: "containers.split", role: "author-bio" },
    { containerId: "containers.grid", role: "related-articles" },
    { containerId: "containers.single-column", role: "newsletter-signup" },
    { containerId: "containers.single-column", role: "footer" }
  ],

  decision: {
    worksBestFor: ["*"],
    bestIndustries: [
      "publishing",
      "media",
      "content",
      "professional-services",
      "education"
    ],
    primaryGoals: ["content-publishing", "brand-awareness", "trust-building"],
    keywords: [
      "magazine",
      "article",
      "editorial",
      "long-form",
      "blog",
      "content",
      "read"
    ],
    minSections: 4,
    maxSections: 8,
    heroType: "minimal-centered",
    imageDensity: "medium",
    pageLength: "long",
    supportsBooking: false,
    supportsEcommerce: false,
    supportsPortfolio: false,
    supportsSearch: true,
    supportsMap: false,
    supportsFloatingCta: false,
    recommendedNavigationId: "top-sticky",
    compatibleNavigationPatterns: [
      "top-sticky",
      "top-classic",
      "top-floating",
      "drawer-hamburger"
    ],
    requiredContainers: ["containers.magazine", "containers.hero"],
    requiredSectionRoles: ["article-hero", "article-body"],
    mobileSuitability: 90,
    seoStrength: 95,
    conversionStrength: 55,
    trustSignalStrength: 75
  },
  publisher: P
});
