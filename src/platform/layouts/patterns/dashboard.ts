// layouts.dashboard — merchant admin dashboard.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "dashboard",
  name: "Dashboard",
  tagline: "Merchant Business OS control panel with sidebar + block grid",
  description:
    "Full-page dashboard shell (top nav + sidebar + main grid) with analytics, orders, bookings, jobs, messages, activity feed. The merchant's operational cockpit.",
  version: "1.0.0",
  category: "operations-first",
  defaultNavigationId: "sidebar-dashboard",

  sequence: [
    { containerId: "containers.dashboard-shell", role: "dashboard-shell" }
  ],

  decision: {
    worksBestFor: ["*"],
    bestIndustries: [
      "trades",
      "construction",
      "professional-services",
      "commerce",
      "saas"
    ],
    primaryGoals: ["operations-dashboard"],
    keywords: [
      "dashboard",
      "admin",
      "operations",
      "control-panel",
      "back-office",
      "merchant"
    ],
    minSections: 1,
    maxSections: 3,
    heroType: "dashboard-header",
    imageDensity: "light",
    pageLength: "medium",
    supportsBooking: false,
    supportsEcommerce: false,
    supportsPortfolio: false,
    supportsSearch: true,
    supportsMap: false,
    supportsFloatingCta: false,
    recommendedNavigationId: "sidebar-dashboard",
    compatibleNavigationPatterns: ["sidebar-dashboard", "top-classic"],
    requiredContainers: ["containers.dashboard-shell"],
    requiredSectionRoles: ["dashboard-shell"],
    mobileSuitability: 65,
    seoStrength: 30,
    conversionStrength: 40,
    trustSignalStrength: 50
  },
  publisher: P
});
