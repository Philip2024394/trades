// Marketplace App — Trade Center's Plugin #1.
//
// ─── Role in the platform ──────────────────────────────────────
//
// The Marketplace App is the reference implementation of the
// AppManifest v1.1 shape. It opts into every Trade Center Week 1–2
// declaration slice: aiTools, featureFlags, telemetry, commands,
// declaredCapabilities, searchProviders, widgets, notificationKinds,
// platformCompat. Future Apps (Orders, Messages, Fleet, Insurance,
// Finance, Recruitment, Training) mirror this pattern.
//
// Nothing here duplicates existing platform infrastructure — every
// slice is a declaration; discovery + orchestration happens through
// the platform services shipped Weeks 1–2.
//
// ─── 3-question rule ──────────────────────────────────────────
//
// 1. Why platform vs App?  The manifest ITSELF is App-scoped
//    (Marketplace-specific). But every field it declares plugs into
//    a PLATFORM service (AI Dispatcher, Universal Search, Command
//    Palette, Policy Engine, Widgets, Notifications). The App
//    contributes; the platform discovers.
//
// 2. Which future Apps benefit?  Every App. Marketplace is the
//    template.
//
// 3. Which doc authorises?  ADR-051 (Marketplace as Plugin #1) +
//    TRADE_CENTER_PLATFORM_DELTA §6 Week 3 "Marketplace Integration".

import type { AppManifest } from "@/platform/manifest/types";

export const marketplaceAppManifest: AppManifest = {
  manifestVersion: 1,
  slug: "marketplace",
  name: "Marketplace",
  tagline: "Materials + tools from verified UK trade merchants",
  description:
    "The Marketplace App renders products from every merchant across every trade. Merchant identity is prominent on every card. Trust score is visible. Delivery, distance, trade pricing, business pricing surface without extra clicks. This is the buying surface of the Business OS.",
  icon: "🛒",
  category: "products",
  version: "1.0.0",
  publisher: {
    name: "Trade Center Platform Team",
    verified: true
  },

  compatibility: {
    industries: ["*"],
    pages: ["*"],
    createsPages: [
      {
        pageId: "marketplace.home",
        path: "/tc/trade-center",
        title: "Marketplace"
      },
      {
        pageId: "marketplace.category",
        path: "/tc/trade-center/{slug}",
        title: "Marketplace category"
      }
    ]
  },

  requirements: {
    plan: "free",
    dependencies: [],
    conflicts: [],
    capabilities: ["products", "analytics", "events"],
    permissions: ["read:products", "publish:events"]
  },

  studio: {
    sections: []
  },

  appStore: {
    screenshots: [],
    benefits: [
      "Every merchant identity surfaced on every card",
      "8-layer trust score visible per merchant",
      "Trade pricing + business account pricing tier gated",
      "Universal search returns products, merchants, categories in one query",
      "Command palette exposes reorder + compare + find alternatives"
    ],
    priceLabel: "Free"
  },

  // ─── Week 1 slices ─────────────────────────────────────────

  platformCompat: {
    apiVersion: "1.0.0",
    schemaVersion: "1.0.0",
    minPlatformVersion: "1.0.0"
  },

  aiTools: [
    {
      name: "marketplace.search_products",
      description:
        "Search the marketplace for products matching a natural-language query. Returns the top ranked results with merchant identity + price + delivery.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural-language search term." }
        },
        required: ["query"]
      },
      cost: "low"
    },
    {
      name: "marketplace.get_product",
      description:
        "Return the full product record for a given product id, including merchant + trust + pricing tiers.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string" }
        },
        required: ["productId"]
      },
      cost: "low"
    },
    {
      name: "marketplace.compare_products",
      description:
        "Return a side-by-side spec + price + delivery comparison for 2–4 product ids.",
      parameters: {
        type: "object",
        properties: {
          productIds: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 4
          }
        },
        required: ["productIds"]
      },
      cost: "low"
    },
    {
      name: "marketplace.find_alternatives",
      description:
        "Given a product id, return up to 5 alternative products from other merchants that match the same subcategory + spec.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string" }
        },
        required: ["productId"]
      },
      cost: "medium"
    }
  ],

  featureFlags: [
    {
      key: "marketplace.compare_drawer",
      description: "Enable the right-panel comparison drawer.",
      default: true,
      scope: "user"
    },
    {
      key: "marketplace.trade_pricing",
      description:
        "Surface trade-only pricing on every product card. Gated to Professional+ tier at runtime.",
      default: true,
      scope: "user"
    },
    {
      key: "marketplace.business_pricing",
      description:
        "Surface business account pricing on every product card. Gated to Enterprise tier at runtime.",
      default: true,
      scope: "business"
    },
    {
      key: "marketplace.local_supplier_filter",
      description:
        "Show the distance chip + local supplier filter (spec §19.3 dynamic radius).",
      default: true,
      scope: "user"
    }
  ],

  telemetry: [
    {
      metric: "marketplace.card.viewed",
      kind: "counter",
      description: "Product card entered the viewport.",
      labels: ["product_id", "merchant_slug", "category"]
    },
    {
      metric: "marketplace.card.opened",
      kind: "counter",
      description: "Product card was opened in detail.",
      labels: ["product_id", "merchant_slug"]
    },
    {
      metric: "marketplace.compare.opened",
      kind: "counter",
      description: "Compare drawer opened.",
      labels: ["source"]
    },
    {
      metric: "marketplace.trade_price.shown",
      kind: "counter",
      description: "Trade price was surfaced on a card.",
      labels: ["product_id"]
    }
  ],

  commands: [
    {
      id: "marketplace.search",
      label: "Search products",
      group: "products",
      shortcut: "g p",
      icon: "Search"
    },
    {
      id: "marketplace.reorder",
      label: "Reorder last purchase",
      group: "actions",
      shortcut: "g r",
      icon: "RotateCcw"
    },
    {
      id: "marketplace.compare",
      label: "Open comparison drawer",
      group: "actions",
      shortcut: "g c",
      icon: "Columns"
    },
    {
      id: "marketplace.find_local",
      label: "Find local suppliers",
      group: "merchants",
      icon: "MapPin"
    },
    {
      id: "marketplace.browse_categories",
      label: "Browse marketplace categories",
      group: "categories",
      icon: "Grid"
    }
  ],

  // ─── Week 2 slices ─────────────────────────────────────────

  declaredCapabilities: [
    {
      key: "marketplace.buy",
      description: "Place orders",
      scope: "user",
      defaultTiers: ["free", "paid", "verified", "merchant-pro"],
      defaultRoles: ["user", "trade"]
    },
    {
      key: "marketplace.sell",
      description: "List products for sale",
      scope: "business",
      defaultTiers: ["merchant-pro"],
      defaultRoles: ["merchant"]
    },
    {
      key: "marketplace.moderate_listings",
      description: "Take down listings that violate platform rules",
      scope: "platform",
      defaultTiers: ["merchant-pro"],
      defaultRoles: ["admin"]
    },
    {
      key: "marketplace.view_trade_pricing",
      description: "See trade-tier pricing on every card",
      scope: "user",
      defaultTiers: ["paid", "verified", "merchant-pro"],
      defaultRoles: ["trade", "merchant"]
    },
    {
      key: "marketplace.view_business_pricing",
      description: "See business-account pricing on every card",
      scope: "business",
      defaultTiers: ["merchant-pro"],
      defaultRoles: ["business_admin"]
    }
  ],

  searchProviders: [
    {
      id: "marketplace.products",
      kind: "products",
      label: "Products",
      weight: 1.0,
      handler: "./handlers/searchProducts",
      supportsSemanticSearch: false
    },
    {
      id: "marketplace.merchants",
      kind: "merchants",
      label: "Merchants",
      weight: 0.9,
      handler: "./handlers/searchMerchants",
      supportsSemanticSearch: false
    },
    {
      id: "marketplace.categories",
      kind: "categories",
      label: "Categories",
      weight: 0.6,
      handler: "./handlers/searchCategories",
      supportsSemanticSearch: false
    }
  ],

  widgets: [
    {
      id: "marketplace.back_in_stock",
      slot: "home.today",
      label: "Back in stock on your saved list",
      order: 20,
      handler: "./widgets/backInStock",
      refreshInterval: 300
    },
    {
      id: "marketplace.new_from_pinned",
      slot: "home.today",
      label: "New products from merchants you've pinned",
      order: 30,
      handler: "./widgets/newFromPinned",
      refreshInterval: 900
    },
    {
      id: "marketplace.compare_drawer",
      slot: "right-panel",
      label: "Comparison drawer",
      order: 10,
      handler: "./widgets/compareDrawer"
    }
  ],

  notificationKinds: [
    {
      kind: "marketplace.back_in_stock",
      category: "inventory",
      description: "A product on your saved list is back in stock.",
      defaultChannels: ["in-app", "email"]
    },
    {
      kind: "marketplace.price_drop",
      category: "inventory",
      description: "A product you viewed dropped in price.",
      defaultChannels: ["in-app"]
    },
    {
      kind: "marketplace.new_from_merchant",
      category: "merchant-activity",
      description: "A merchant you follow listed a new product.",
      defaultChannels: ["in-app"]
    }
  ],

  // ─── Standard events (existing AppManifest field) ─────────

  events: {
    publishes: [
      "marketplace.card_viewed",
      "marketplace.card_opened",
      "marketplace.compare_opened",
      "marketplace.search_executed"
    ],
    subscribes: [
      "merchant.trust_changed",
      "merchant.verified"
    ]
  },

  ai: {
    keywords: ["marketplace", "buy", "product", "supplier", "tools", "materials"],
    userStories: [
      "I need to buy plaster from a local merchant",
      "I want to compare trowels from different sellers",
      "I need to reorder what I bought last time",
      "I want to see who delivers by tomorrow"
    ]
  }
};
