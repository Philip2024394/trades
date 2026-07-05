// layouts.booking — booking-first service page.

import { layoutRegistry } from "../registry";
import { P } from "./_shared";

layoutRegistry.register({
  manifestVersion: 1,
  slug: "booking",
  name: "Booking",
  tagline: "Direct-to-booking service page with calendar + deposit",
  description:
    "Short hero, service selector, calendar + slot picker, customer info wizard step, optional deposit, confirmation. Booking is the primary action.",
  version: "1.0.0",
  category: "trades-first",
  defaultNavigationId: "top-sticky",

  sequence: [
    { containerId: "containers.hero", role: "booking-hero" },
    { containerId: "containers.single-column", role: "trust-bar" },
    { containerId: "containers.wizard", role: "booking-wizard" },
    { containerId: "containers.single-column", role: "reviews" },
    { containerId: "containers.single-column", role: "faq" },
    { containerId: "containers.single-column", role: "contact-fallback" },
    { containerId: "containers.single-column", role: "footer" }
  ],

  decision: {
    worksBestFor: [
      "plumber-emergency",
      "electrician-emergency",
      "boiler-repair",
      "locksmith",
      "recovery-service",
      "carpenter",
      "chimney-sweep",
      "kitchen-fitter",
      "bathroom-fitter",
      "landscaper",
      "hvac-contractor",
      "roofer"
    ],
    bestIndustries: ["home-services", "trades", "emergency-services"],
    primaryGoals: ["bookings", "quotes", "lead-generation"],
    keywords: [
      "booking",
      "calendar",
      "slots",
      "appointment",
      "emergency",
      "callback",
      "quote"
    ],
    minSections: 5,
    maxSections: 8,
    heroType: "minimal-centered",
    imageDensity: "light",
    pageLength: "short",
    supportsBooking: true,
    supportsEcommerce: false,
    supportsPortfolio: false,
    supportsSearch: false,
    supportsMap: true,
    supportsFloatingCta: true,
    recommendedNavigationId: "top-sticky",
    compatibleNavigationPatterns: [
      "top-sticky",
      "top-classic",
      "drawer-hamburger",
      "bottom-tabs"
    ],
    requiredContainers: [
      "containers.hero",
      "containers.wizard",
      "containers.single-column"
    ],
    requiredSectionRoles: ["booking-hero", "booking-wizard"],
    mobileSuitability: 95,
    seoStrength: 75,
    conversionStrength: 92,
    trustSignalStrength: 80
  },
  publisher: P
});
