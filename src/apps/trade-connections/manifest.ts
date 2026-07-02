// App: Trade Connections.
//
// Local trades who install this product / material. Auto-scrolling
// carousel that turns product pages into a two-way local marketplace.
// Reuses the existing TradeConnectionsCarousel profile component.

import type { AppManifest } from "@/platform/manifest/types";

export const tradeConnectionsManifest: AppManifest = {
  manifestVersion: 1,

  slug: "trade-connections",
  name: "Trade Connections",
  tagline:
    "Local trades who install this — auto-scroll carousel on every product page.",
  description:
    "Turns every product page into a two-way local marketplace. Customers see a horizontal auto-scrolling carousel of independent local trades who install that type of product — bricklayers under bricks, tilers under tiles, painters under paint. A non-verification disclaimer protects the merchant; a floating 'Back to [Merchant]' chip follows customers onto trade profiles so they always return. Configurable radius, default 25 km.",
  icon: "🤝",
  category: "products",
  version: "1.0.0",

  publisher: {
    name: "Xrated Trades",
    verified: true
  },

  compatibility: {
    industries: [
      "building-merchant",
      "builders-supplies",
      "tool-hire",
      "materials-yard"
    ],
    pages: ["home", "shop", "product"],
    createsPages: []
  },

  requirements: {
    plan: "free",
    dependencies: [],
    conflicts: [],
    capabilities: ["products", "location"],
    permissions: ["read:listing", "read:products"]
  },

  studio: {
    sections: [
      {
        id: "carousel",
        name: "Trade Connections Carousel",
        library: "categories",
        description:
          "Auto-scroll carousel of local trades who install this kind of product.",
        moduleImport: "./sections/carousel"
      }
    ],
    slotHints: ["product.body", "shop.body"],
    contentEditor: {
      route: "/trade-off/edit/{slug}/trade-connections",
      title: "Configure Trade Connections",
      surface: "slide-over"
    }
  },

  navigation: [],

  ai: {
    keywords: [
      "trade connections",
      "installers",
      "local trades",
      "product installers",
      "recommended trades"
    ],
    userStories: [
      "As a merchant, I want my customers to find installers so they leave with materials AND a trade to fit them."
    ],
    recommendedFor: [
      "builders' merchants",
      "materials yards",
      "tile suppliers",
      "kitchen showrooms"
    ]
  },

  appStore: {
    screenshots: [],
    benefits: [
      "Every product page becomes a local marketplace — trades + materials in one place",
      "Floating 'Back to [Merchant]' chip keeps customers returning to your store",
      "Open to every trade on the platform — no pay-to-play gating"
    ],
    priceLabel: "Free"
  }
};
