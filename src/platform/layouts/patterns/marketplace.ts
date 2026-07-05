// layouts.marketplace — categories + featured + browse marketplace home.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "marketplace",
  name: "Marketplace",
  tagline: "Categories + featured + browse — the marketplace home page",
  description:
    "Hero + top categories + featured items + trending + browse-all + trust. For platforms that aggregate multiple sellers / apps / templates.",
  version: "1.0.0",
  category: "commerce-first",
  defaultNavigationId: "mega-menu",

  sequence: [
    { containerId: "containers.hero", role: "marketplace-hero" },
    { containerId: "containers.single-column", role: "search-bar" },
    { containerId: "containers.grid", role: "categories-grid" },
    { containerId: "containers.single-column", role: "featured-carousel" },
    { containerId: "containers.grid", role: "trending-items" },
    { containerId: "containers.single-column", role: "trust-bar" },
    { containerId: "containers.single-column", role: "footer" }
  ],

  decision: {
    worksBestFor: ["*"],
    bestIndustries: [
      "marketplaces",
      "commerce",
      "software",
      "creative",
      "professional-services"
    ],
    primaryGoals: [
      "directory-listing",
      "ecommerce",
      "brand-awareness",
      "search-anchored"
    ],
    keywords: [
      "marketplace",
      "categories",
      "featured",
      "browse",
      "apps",
      "templates",
      "listings"
    ],
    minSections: 5,
    maxSections: 9,
    heroType: "search-anchored",
    imageDensity: "medium",
    pageLength: "long",
    supportsBooking: false,
    supportsEcommerce: true,
    supportsPortfolio: false,
    supportsSearch: true,
    supportsMap: false,
    supportsFloatingCta: false,
    recommendedNavigationId: "mega-menu",
    compatibleNavigationPatterns: [
      "mega-menu",
      "top-sticky",
      "top-classic",
      "drawer-hamburger"
    ],
    requiredContainers: ["containers.hero", "containers.grid"],
    requiredSectionRoles: [
      "marketplace-hero",
      "categories-grid",
      "featured-carousel"
    ],
    mobileSuitability: 80,
    seoStrength: 90,
    conversionStrength: 78,
    trustSignalStrength: 72
  },
  publisher: P
});
