// themeRegistry — preset seeds.
//
// Six curated themes carried over from @/lib/studio/themePresets.ts.
// Registered at module load. When brandRegistry lands (M4+) these
// become the default themes on the platform Brand.

import { themeRegistry } from "./registry";

const P = {
  name: "Xrated Trades Platform",
  verified: true
} as const;

themeRegistry.register({
  manifestVersion: 1,
  slug: "modern",
  name: "Modern",
  description:
    "Clean, contemporary, sans-serif everywhere. Safe default that reads premium across every trade.",
  version: "1.0.0",
  bestForVerticals: [
    "electrician",
    "plumber",
    "gas-engineer",
    "hvac-contractor",
    "handyman"
  ],
  vars: {
    "--font-heading": "var(--font-inter)",
    "--font-body": "var(--font-inter)",
    "--radius": "0.75rem",
    "--section-padding": "5rem",
    "--letter-spacing-tight": "-0.02em"
  },
  motion: "standard",
  publisher: P
});

themeRegistry.register({
  manifestVersion: 1,
  slug: "corporate",
  name: "Corporate",
  description:
    "Manrope for headline + body. Reads as serious, engineering-grade, dependable.",
  version: "1.0.0",
  bestForVerticals: [
    "structural-engineer",
    "chartered-surveyor",
    "party-wall-surveyor",
    "commercial-builder",
    "commercial-roofing",
    "commercial-vehicle-hire"
  ],
  vars: {
    "--font-heading": "var(--font-manrope)",
    "--font-body": "var(--font-manrope)",
    "--radius": "0.5rem",
    "--section-padding": "6rem",
    "--letter-spacing-tight": "-0.015em"
  },
  motion: "restrained",
  publisher: P
});

themeRegistry.register({
  manifestVersion: 1,
  slug: "luxury",
  name: "Luxury",
  description:
    "Playfair Display headlines + Inter body. Editorial serif/sans mix — the premium showroom look.",
  version: "1.0.0",
  bestForVerticals: [
    "kitchen-showroom",
    "bathroom-showroom",
    "premium-showroom",
    "kitchen-fitter",
    "bathroom-fitter",
    "extension-builder",
    "extension-specialist",
    "chartered-surveyor"
  ],
  vars: {
    "--font-heading": "var(--font-playfair)",
    "--font-body": "var(--font-inter)",
    "--radius": "0.375rem",
    "--section-padding": "7rem",
    "--letter-spacing-tight": "-0.025em"
  },
  motion: "expressive",
  publisher: P
});

themeRegistry.register({
  manifestVersion: 1,
  slug: "industrial",
  name: "Industrial",
  description:
    "Roboto everywhere. Warehouse energy, straightforward, working-site vernacular.",
  version: "1.0.0",
  bestForVerticals: [
    "plant-hire",
    "tool-hire",
    "aggregate-supplier",
    "concrete-supplier",
    "skip-hire",
    "welfare-unit-hire",
    "workwear-supplier",
    "groundworker",
    "building-merchant",
    "timber-merchant"
  ],
  vars: {
    "--font-heading": "var(--font-roboto)",
    "--font-body": "var(--font-roboto)",
    "--radius": "0.25rem",
    "--section-padding": "5rem",
    "--letter-spacing-tight": "-0.01em"
  },
  motion: "restrained",
  publisher: P
});

themeRegistry.register({
  manifestVersion: 1,
  slug: "minimal",
  name: "Minimal",
  description:
    "DM Sans throughout. Restrained white, generous rhythm, copy-driven.",
  version: "1.0.0",
  bestForVerticals: [
    "carpenter",
    "joiner",
    "painter",
    "decorator",
    "tiler",
    "plasterer",
    "chimney-sweep"
  ],
  vars: {
    "--font-heading": "var(--font-dm-sans)",
    "--font-body": "var(--font-dm-sans)",
    "--radius": "0.625rem",
    "--section-padding": "6rem",
    "--letter-spacing-tight": "-0.02em"
  },
  motion: "restrained",
  publisher: P
});

themeRegistry.register({
  manifestVersion: 1,
  slug: "creative",
  name: "Creative",
  description:
    "Poppins throughout. Warm, expressive, portfolio-forward — landscaping, design, boutique fit.",
  version: "1.0.0",
  bestForVerticals: [
    "landscaper",
    "landscape-gardener",
    "garden-designer",
    "insulation-installer",
    "solar-installer",
    "heat-pump-installer"
  ],
  vars: {
    "--font-heading": "var(--font-poppins)",
    "--font-body": "var(--font-poppins)",
    "--radius": "0.875rem",
    "--section-padding": "5.5rem",
    "--letter-spacing-tight": "-0.025em"
  },
  motion: "expressive",
  publisher: P
});
