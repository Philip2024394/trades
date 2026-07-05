// layouts.ecommerce — product-first commerce page.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "ecommerce",
  name: "Ecommerce",
  tagline: "Product showroom + categories + featured + reviews",
  description:
    "Product-first commerce layout: header search, category grid, featured products, best-sellers, reviews, footer. For building merchants, tool hire, materials, retail.",
  version: "1.0.0",
  category: "commerce-first",
  defaultNavigationId: "mega-menu",

  sequence: [
    { containerId: "containers.hero", role: "product-showroom-hero" },
    { containerId: "containers.single-column", role: "categories-grid" },
    { containerId: "containers.single-column", role: "featured-products" },
    { containerId: "containers.single-column", role: "best-sellers" },
    { containerId: "containers.single-column", role: "trust-bar" },
    { containerId: "containers.single-column", role: "reviews" },
    { containerId: "containers.single-column", role: "brand-strip" },
    { containerId: "containers.single-column", role: "footer" }
  ],

  decision: {
    worksBestFor: [
      "building-merchant",
      "builders-supplies",
      "tool-hire",
      "plant-hire",
      "timber-merchant",
      "aggregate-supplier",
      "workwear-supplier"
    ],
    bestIndustries: ["commerce", "supply", "materials", "retail"],
    primaryGoals: ["ecommerce", "brand-awareness"],
    keywords: [
      "ecommerce",
      "products",
      "categories",
      "trade-account",
      "supply",
      "commerce"
    ],
    minSections: 6,
    maxSections: 10,
    heroType: "product-showroom",
    imageDensity: "heavy",
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
      "top-classic",
      "drawer-hamburger",
      "bottom-tabs"
    ],
    requiredContainers: ["containers.hero", "containers.single-column"],
    requiredSectionRoles: [
      "product-showroom-hero",
      "categories-grid",
      "featured-products"
    ],
    mobileSuitability: 88,
    seoStrength: 92,
    conversionStrength: 88,
    trustSignalStrength: 70
  },
  publisher: P
});
