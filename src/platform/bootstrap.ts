// Platform bootstrap — registers demo Apps for the Week 1 shell view.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Bootstrap is a platform concern, not an App concern.
//    Every App is expected to self-register at import time, but until
//    every existing App under `src/apps/*` has its manifest wired
//    into the boot import chain, we bootstrap a curated demo set from
//    here so the workspace shell has something to render.
//
// 2. Which future Apps benefit?  Every App the shell renders will
//    ultimately register itself via its own manifest. This bootstrap
//    is a transitional bridge until all `src/apps/*` manifests are
//    wired.
//
// 3. Which doc authorises?  TRADE_CENTER_PLATFORM_DELTA §6 Week 1
//    "Shell primitives" — the primary rail reads from appRegistry;
//    empty registry = empty rail = broken demo.

import { appRegistry } from "@/platform/registry";
import { helloWorldAppManifest } from "@/platform/demo/helloWorldApp";
import { registerMarketplaceApp } from "@/apps/marketplace/register";
import { registerOrdersApp } from "@/apps/orders/register";
import type { AppManifest } from "@/platform/manifest/types";

/** Minimal placeholder Apps so the Week 1 shell view renders with
 *  more than one slot. These are NOT production Apps — they're demo
 *  entries showing the primary rail composes from registry data.
 *  Each answers "why platform" the same way `helloWorldAppManifest`
 *  does: they're fixtures for shell validation. */
const placeholders: AppManifest[] = [
  {
    manifestVersion: 1,
    slug: "marketplace",
    name: "Marketplace",
    tagline: "Products + merchants (Week 3 wire-up target)",
    description:
      "Placeholder rail entry until the marketplace App's manifest lands in Week 3 per PLATFORM_DELTA §6.",
    icon: "🛒",
    category: "products",
    version: "0.1.0",
    publisher: { name: "Trade Center Platform Team", verified: true },
    compatibility: { industries: ["*"], pages: ["*"], createsPages: [] },
    requirements: {
      plan: "free",
      dependencies: [],
      conflicts: [],
      capabilities: [],
      permissions: []
    },
    studio: { sections: [] },
    appStore: { screenshots: [], benefits: [], priceLabel: "Free" },
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
        icon: "RotateCcw"
      }
    ]
  },
  {
    manifestVersion: 1,
    slug: "orders",
    name: "Orders",
    tagline: "Delivery tracking (Week 2 wire-up target)",
    description: "Placeholder rail entry — real Orders App lands under M4.",
    icon: "📦",
    category: "operations",
    version: "0.1.0",
    publisher: { name: "Trade Center Platform Team", verified: true },
    compatibility: { industries: ["*"], pages: ["*"], createsPages: [] },
    requirements: {
      plan: "free",
      dependencies: [],
      conflicts: [],
      capabilities: [],
      permissions: []
    },
    studio: { sections: [] },
    appStore: { screenshots: [], benefits: [], priceLabel: "Free" },
    commands: [
      {
        id: "orders.track",
        label: "Track an order",
        group: "actions",
        shortcut: "g o",
        icon: "Truck"
      }
    ]
  },
  {
    manifestVersion: 1,
    slug: "messages",
    name: "Messages",
    tagline: "Buyer ↔ merchant threads (Week 2 wire-up target)",
    description: "Placeholder rail entry — real Messages App lands under M4.",
    icon: "💬",
    category: "operations",
    version: "0.1.0",
    publisher: { name: "Trade Center Platform Team", verified: true },
    compatibility: { industries: ["*"], pages: ["*"], createsPages: [] },
    requirements: {
      plan: "free",
      dependencies: [],
      conflicts: [],
      capabilities: [],
      permissions: []
    },
    studio: { sections: [] },
    appStore: { screenshots: [], benefits: [], priceLabel: "Free" },
    commands: [
      {
        id: "messages.new",
        label: "New message",
        group: "actions",
        shortcut: "c m",
        icon: "MessageSquare"
      }
    ]
  }
];

let bootstrapped = false;

/** Idempotent bootstrap. Safe to call from every rendered route. */
export function bootstrapPlatform(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  // Register self-managing Apps first (they know their own handlers
  // + platform-service wiring).
  registerMarketplaceApp();
  registerOrdersApp();

  // Legacy fixture Apps that only need registration (no wiring).
  // Skip slugs already registered by the self-managing Apps above.
  const skipSlugs = new Set(["marketplace", "orders"]);
  const toRegister: AppManifest[] = [
    helloWorldAppManifest,
    ...placeholders.filter((p) => !skipSlugs.has(p.slug))
  ];
  for (const app of toRegister) {
    // Guard against double-register when Next dev hot-reloads —
    // `appRegistry.has()` short-circuits.
    if (!appRegistry.has(app.slug)) {
      appRegistry.register(app);
    }
  }
}
