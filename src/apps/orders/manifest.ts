// Orders App — Plugin #2. Second reference implementation.
//
// Proves the platform is truly App-agnostic: Orders opts into every
// Week 1-4 declaration slice without duplicating a single primitive.
// The Home dashboard's Today's Work strip discovers Orders widgets
// alongside Marketplace's. The Command Palette shows Orders commands
// alongside Marketplace's. Universal Search returns Orders alongside
// products. Nothing in the platform knows the string "orders".

import type { AppManifest } from "@/platform/manifest/types";

export const ordersAppManifest: AppManifest = {
  manifestVersion: 1,
  slug: "orders",
  name: "Orders",
  tagline: "Every purchase, tracked from placed to delivered",
  description:
    "The Orders App manages the delivery lifecycle. Kanban of active orders + tracking + cancel + Copilot-callable status queries. Ships as Plugin #2 proving the platform is genuinely App-agnostic.",
  icon: "📦",
  category: "operations",
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
        pageId: "orders.home",
        path: "/tc/orders",
        title: "Orders"
      }
    ]
  },

  requirements: {
    plan: "free",
    dependencies: ["marketplace"],
    conflicts: [],
    capabilities: ["events", "notifications"],
    permissions: ["read:orders", "write:orders", "publish:events"]
  },

  studio: {
    sections: []
  },

  appStore: {
    screenshots: [],
    benefits: [
      "One view of every order across every merchant",
      "Copilot can track / cancel / summarise orders",
      "Home dashboard shows deliveries arriving today"
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
      name: "orders.track_order",
      description:
        "Return the current status, ETA and tracking reference for an order id.",
      parameters: {
        type: "object",
        properties: { orderId: { type: "string" } },
        required: ["orderId"]
      },
      cost: "low"
    },
    {
      name: "orders.list_recent",
      description:
        "List the user's most recent orders across every merchant.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max rows (default 10)." }
        }
      },
      cost: "low"
    },
    {
      name: "orders.cancel_order",
      description:
        "Attempt to cancel an order — only valid while status is placed or accepted.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string" },
          reason: { type: "string" }
        },
        required: ["orderId"]
      },
      cost: "low"
    }
  ],

  featureFlags: [
    {
      key: "orders.kanban",
      description: "Show the Kanban view on /tc/orders.",
      default: true,
      scope: "user"
    },
    {
      key: "orders.auto_reorder",
      description:
        "Nudge the user to reorder recurring purchases based on the last 90 days.",
      default: false,
      scope: "user"
    }
  ],

  telemetry: [
    {
      metric: "orders.list.opened",
      kind: "counter",
      description: "Orders workspace opened.",
      labels: ["source"]
    },
    {
      metric: "orders.status.changed",
      kind: "counter",
      description: "An order transitioned status.",
      labels: ["from", "to"]
    },
    {
      metric: "orders.cancel.attempted",
      kind: "counter",
      description: "A cancel was attempted.",
      labels: ["outcome"]
    }
  ],

  commands: [
    {
      id: "orders.track",
      label: "Track an order",
      group: "actions",
      shortcut: "g o",
      icon: "Truck"
    },
    {
      id: "orders.recent",
      label: "Show recent orders",
      group: "actions",
      icon: "History"
    },
    {
      id: "orders.cancel",
      label: "Cancel an order",
      group: "actions",
      icon: "XCircle"
    }
  ],

  // ─── Week 2 slices ─────────────────────────────────────────

  declaredCapabilities: [
    {
      key: "orders.read",
      description: "Read own orders",
      scope: "user",
      defaultTiers: ["free", "paid", "verified", "merchant-pro"],
      defaultRoles: ["user", "trade"]
    },
    {
      key: "orders.approve_refund",
      description: "Approve a refund on behalf of a merchant",
      scope: "business",
      defaultTiers: ["merchant-pro"],
      defaultRoles: ["business_admin"]
    },
    {
      key: "orders.moderate",
      description: "Force-cancel orders as platform staff",
      scope: "platform",
      defaultTiers: ["merchant-pro"],
      defaultRoles: ["admin"]
    }
  ],

  searchProviders: [
    {
      id: "orders.orders",
      kind: "content",
      label: "Orders",
      weight: 0.85,
      handler: "./handlers/searchOrders"
    }
  ],

  widgets: [
    {
      id: "orders.arriving_today",
      slot: "home.today",
      label: "Deliveries arriving today",
      order: 5,
      handler: "./widgets/arrivingToday",
      refreshInterval: 300
    },
    {
      id: "orders.awaiting_confirmation",
      slot: "home.today",
      label: "Waiting on merchant confirmation",
      order: 15,
      handler: "./widgets/awaitingConfirmation"
    }
  ],

  notificationKinds: [
    {
      kind: "orders.accepted",
      category: "order-lifecycle",
      description: "A merchant accepted your order.",
      defaultChannels: ["in-app"]
    },
    {
      kind: "orders.dispatched",
      category: "order-lifecycle",
      description: "An order has been dispatched.",
      defaultChannels: ["in-app", "email"]
    },
    {
      kind: "orders.delivered",
      category: "order-lifecycle",
      description: "An order has been delivered.",
      defaultChannels: ["in-app"]
    },
    {
      kind: "orders.delayed",
      category: "order-lifecycle",
      description: "An order is delayed.",
      defaultChannels: ["in-app", "push"],
      severity: "warning"
    }
  ],

  events: {
    publishes: [
      "orders.placed",
      "orders.accepted",
      "orders.dispatched",
      "orders.delivered",
      "orders.cancelled"
    ],
    subscribes: []
  },

  ai: {
    keywords: ["orders", "track", "delivery", "cancel", "shipment"],
    userStories: [
      "Where's my scaffold order?",
      "Cancel the tile order",
      "What's arriving today?"
    ]
  }
};
