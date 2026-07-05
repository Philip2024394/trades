// layouts.directory — search + filter directory listing.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "directory",
  name: "Directory",
  tagline: "Search + filter + card grid listing page",
  description:
    "Search-anchored hero + filter bar + card grid + map + pagination. Use for merchant directories, trade finders, marketplace catalogues.",
  version: "1.0.0",
  category: "content-first",
  defaultNavigationId: "top-sticky",

  sequence: [
    { containerId: "containers.hero", role: "search-hero" },
    { containerId: "containers.single-column", role: "filter-bar" },
    { containerId: "containers.grid", role: "listing-cards" },
    { containerId: "containers.single-column", role: "map" },
    { containerId: "containers.single-column", role: "pagination" },
    { containerId: "containers.single-column", role: "footer" }
  ],

  decision: {
    worksBestFor: ["*"],
    bestIndustries: [
      "directories",
      "marketplaces",
      "trade-networks",
      "commerce"
    ],
    primaryGoals: ["directory-listing", "search-anchored", "lead-generation"],
    keywords: [
      "directory",
      "listing",
      "search",
      "filter",
      "map",
      "catalogue",
      "find"
    ],
    minSections: 4,
    maxSections: 8,
    heroType: "search-anchored",
    imageDensity: "medium",
    pageLength: "long",
    supportsBooking: false,
    supportsEcommerce: false,
    supportsPortfolio: false,
    supportsSearch: true,
    supportsMap: true,
    supportsFloatingCta: false,
    recommendedNavigationId: "top-sticky",
    compatibleNavigationPatterns: [
      "top-sticky",
      "top-classic",
      "mega-menu",
      "drawer-hamburger"
    ],
    requiredContainers: ["containers.hero", "containers.grid"],
    requiredSectionRoles: ["search-hero", "listing-cards"],
    mobileSuitability: 82,
    seoStrength: 95,
    conversionStrength: 72,
    trustSignalStrength: 65
  },
  publisher: P
});
