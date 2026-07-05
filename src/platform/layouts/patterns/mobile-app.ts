// layouts.mobile-app — mobile-first app-like feed.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "mobile-app",
  name: "Mobile App",
  tagline: "Native-feeling mobile PWA with bottom nav + feed",
  description:
    "Bottom-tab navigation + card feed + detail cards + bottom CTA. Designed for merchants publishing as an installable PWA / native app.",
  version: "1.0.0",
  category: "app-first",
  defaultNavigationId: "bottom-tabs",

  sequence: [
    { containerId: "containers.stack", role: "app-header" },
    { containerId: "containers.stack", role: "card-feed" },
    { containerId: "containers.floating", role: "floating-cta" }
  ],

  decision: {
    worksBestFor: [
      "plumber-emergency",
      "electrician-emergency",
      "boiler-repair",
      "locksmith",
      "recovery-service",
      "restaurant",
      "cafe",
      "handyman"
    ],
    bestIndustries: [
      "home-services",
      "hospitality",
      "trades",
      "emergency-services"
    ],
    primaryGoals: ["app-download", "bookings", "lead-generation"],
    keywords: [
      "mobile-app",
      "pwa",
      "native",
      "app",
      "bottom-nav",
      "feed",
      "install"
    ],
    minSections: 3,
    maxSections: 6,
    heroType: "minimal-centered",
    imageDensity: "medium",
    pageLength: "short",
    supportsBooking: true,
    supportsEcommerce: false,
    supportsPortfolio: false,
    supportsSearch: true,
    supportsMap: true,
    supportsFloatingCta: true,
    recommendedNavigationId: "bottom-tabs",
    compatibleNavigationPatterns: ["bottom-tabs", "drawer-hamburger"],
    requiredContainers: ["containers.stack", "containers.floating"],
    requiredSectionRoles: ["app-header", "card-feed"],
    mobileSuitability: 98,
    seoStrength: 40,
    conversionStrength: 88,
    trustSignalStrength: 70
  },
  publisher: P
});
