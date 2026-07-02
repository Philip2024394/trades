// Pack: Essentials.
//
// First manifest-driven Industry Pack. Installs the three retrofitted
// reference Apps (Meet the Team, Newsletter, Trade Connections) and
// seeds a neutral brand token starter so a merchant lands on a
// professionally-configured profile from a single install click.
//
// Industry = "*" (any) — Essentials is the universal starter every
// merchant benefits from. Vertical-specific Packs (Plant Hire, Builder
// Merchant, Plumber) layer on top and add trade-specific Apps.

import type { PackManifest } from "@/platform/packs/types";

export const essentialsPackManifest: PackManifest = {
  manifestVersion: 1,

  slug: "essentials-pack",
  name: "Essentials Pack",
  tagline:
    "The three Apps every merchant profile should ship with — team, newsletter, trade partners.",
  description:
    "The universal starter pack. Installs Meet the Team, Newsletter, and Trade Connections in one click. Seeds a neutral brand token starter (yellow accent, black ink, comfortable radii) if you haven't already configured your theme. Home page starter layout is opt-in — we only seed it when your home page is empty.",
  icon: "✨",
  version: "1.0.0",

  publisher: {
    name: "Xrated Trades",
    verified: true
  },

  industry: "*",

  apps: [
    { slug: "meet-the-team" },
    { slug: "newsletter" },
    { slug: "trade-connections" }
  ],

  theme: {
    tokens: [
      { kind: "color", key: "primary", value: "#FFB300" },
      { kind: "color", key: "ink", value: "#0A0A0A" },
      { kind: "color", key: "muted", value: "#737373" },
      { kind: "color", key: "surface", value: "#FFFFFF" },
      { kind: "color", key: "subtle", value: "#F5F5F5" },
      { kind: "radius", key: "md", value: 16 },
      { kind: "radius", key: "sm", value: 8 },
      { kind: "radius", key: "lg", value: 24 }
    ]
  },

  homeLayout: {
    sections: [
      { key: "app.meet-the-team.team-grid", slotHint: "body" },
      { key: "app.newsletter.inline", slotHint: "footer" }
    ]
  },

  packStore: {
    screenshots: [],
    benefits: [
      "Three reference Apps installed in one click",
      "Neutral brand starter (yellow accent, comfortable radii) — only added if you haven't set your own tokens",
      "Optional home page starter layout — never overwrites your existing edits"
    ],
    priceLabel: "Free"
  }
};
