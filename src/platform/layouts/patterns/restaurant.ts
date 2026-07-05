// layouts.restaurant — menu + reservations restaurant page.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "restaurant",
  name: "Restaurant",
  tagline: "Photo hero + menu + reservations + gallery + location",
  description:
    "Full-bleed photo hero with transparent nav + menu + reservation booking + gallery + reviews + location map + footer. Culinary aesthetic.",
  version: "1.0.0",
  category: "trades-first",
  defaultNavigationId: "top-transparent",

  sequence: [
    { containerId: "containers.hero", role: "restaurant-hero" },
    { containerId: "containers.single-column", role: "menu-items" },
    { containerId: "containers.wizard", role: "reservation-booking" },
    { containerId: "containers.masonry", role: "gallery" },
    { containerId: "containers.single-column", role: "reviews" },
    { containerId: "containers.split", role: "location-map" },
    { containerId: "containers.single-column", role: "footer" }
  ],

  decision: {
    worksBestFor: ["restaurant", "cafe", "bar", "food-service", "catering"],
    bestIndustries: ["hospitality", "food-and-beverage"],
    primaryGoals: ["bookings", "brand-awareness", "trust-building"],
    keywords: [
      "restaurant",
      "menu",
      "reservations",
      "hospitality",
      "cafe",
      "bar",
      "food"
    ],
    minSections: 5,
    maxSections: 9,
    heroType: "full-width-photo",
    imageDensity: "heavy",
    pageLength: "medium",
    supportsBooking: true,
    supportsEcommerce: false,
    supportsPortfolio: false,
    supportsSearch: false,
    supportsMap: true,
    supportsFloatingCta: true,
    recommendedNavigationId: "top-transparent",
    compatibleNavigationPatterns: [
      "top-transparent",
      "top-sticky",
      "drawer-hamburger"
    ],
    requiredContainers: [
      "containers.hero",
      "containers.masonry",
      "containers.wizard"
    ],
    requiredSectionRoles: [
      "restaurant-hero",
      "menu-items",
      "reservation-booking"
    ],
    mobileSuitability: 90,
    seoStrength: 80,
    conversionStrength: 85,
    trustSignalStrength: 82
  },
  publisher: P
});
