// layouts.portfolio — case-study first portfolio page.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "portfolio",
  name: "Portfolio",
  tagline: "Case-study driven showcase for photo-heavy trades",
  description:
    "Photo-rich hero + portfolio masonry + featured case study + services + bio + contact. For designers, landscapers, kitchen showrooms, premium construction.",
  version: "1.0.0",
  category: "content-first",
  defaultNavigationId: "top-transparent",

  sequence: [
    { containerId: "containers.hero", role: "portfolio-hero" },
    { containerId: "containers.masonry", role: "portfolio-grid" },
    { containerId: "containers.split", role: "featured-case-study" },
    { containerId: "containers.single-column", role: "services-list" },
    { containerId: "containers.split", role: "author-bio" },
    { containerId: "containers.single-column", role: "reviews" },
    { containerId: "containers.single-column", role: "contact-form" },
    { containerId: "containers.single-column", role: "footer" }
  ],

  decision: {
    worksBestFor: [
      "landscaper",
      "landscape-gardener",
      "garden-designer",
      "kitchen-fitter",
      "kitchen-showroom",
      "bathroom-fitter",
      "extension-builder",
      "carpenter",
      "joiner",
      "painter",
      "tiler",
      "roofer",
      "stonemason"
    ],
    bestIndustries: ["design", "construction", "trades", "creative"],
    primaryGoals: ["portfolio-showcase", "trust-building", "brand-awareness"],
    keywords: [
      "portfolio",
      "case-study",
      "showcase",
      "photo-heavy",
      "premium",
      "design",
      "creative"
    ],
    minSections: 6,
    maxSections: 10,
    heroType: "full-width-photo",
    imageDensity: "heavy",
    pageLength: "long",
    supportsBooking: false,
    supportsEcommerce: false,
    supportsPortfolio: true,
    supportsSearch: false,
    supportsMap: false,
    supportsFloatingCta: true,
    recommendedNavigationId: "top-transparent",
    compatibleNavigationPatterns: [
      "top-transparent",
      "top-sticky",
      "top-floating",
      "drawer-hamburger"
    ],
    requiredContainers: [
      "containers.hero",
      "containers.masonry",
      "containers.split"
    ],
    requiredSectionRoles: [
      "portfolio-hero",
      "portfolio-grid",
      "featured-case-study"
    ],
    mobileSuitability: 85,
    seoStrength: 78,
    conversionStrength: 70,
    trustSignalStrength: 92
  },
  publisher: P
});
