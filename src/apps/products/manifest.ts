// products — App #006 manifest.
//
// The canonical product layer for the entire XRatedTrade OS.
// Manufacturer publishes canonical → supplier distributes → merchant
// creates offer → trade adds to quote → homeowner sees real product.
//
// Consumes spec.updated (a Specification change flags dependent offers
// as needing review). Publishes product.published / .updated /
// .withdrawn / .price_changed / .stock_low for every downstream app.

import { Package } from "lucide-react";

export const PRODUCTS_APP_MANIFEST = {
  slug: "products",
  name: "Products",
  category: "commerce" as const,
  version: "1.0.0",
  description:
    "The canonical product layer. Manufacturers publish once. Suppliers distribute. Merchants set price + stock. Trades quote against real SKUs. Homeowners see real products in AI Visualiser + Warranty Ledger. One product record — the whole ecosystem consumes it.",
  icon: Package,

  tradeAllowlist: [
    // Every commercial persona
    "kitchen-fitter",
    "bathroom-fitter",
    "carpenter",
    "roofer",
    "flooring-installer",
    "landscaper",
    "driveway-installer",
    "fencer",
    "decorator",
    "painter",
    "joiner",
    "electrician",
    "plumber",
    "general-builder",
    "kitchen-showroom",
    "bathroom-showroom",
    "building-merchant",
    "builders-supplies",
    "tile-supplier",
    "door-supplier",
    "window-installer",
    "staircase-manufacturer"
  ] as const,

  autoInstallOnService: [] as const,
  supportedSizes: ["landscape"] as const,
  compact: false,
  requiresProductFeed: false, // this IS the feed

  // --------------------------------------------------------------
  // Event contract
  // --------------------------------------------------------------

  eventsConsumed: [
    "spec.updated"          // → flag offers whose spec fingerprint changed
  ] as const,

  eventsPublished: [
    "product.published",
    "product.updated",
    "product.withdrawn",
    "product.price_changed",
    "product.stock_low"
  ] as const,

  // --------------------------------------------------------------
  // Plans — one entitlement per business role. A single business
  // may hold multiple (e.g. a merchant that also manufactures
  // their own-brand accessories).
  // --------------------------------------------------------------

  plans: [
    {
      key: "products.merchant",
      label: "Products · Merchant",
      pricePence: 0,                    // Included with Merchant Pro
      audience: "any"
    },
    {
      key: "products.supplier",
      label: "Products · Supplier",
      pricePence: 4900,
      audience: "supplier"
    },
    {
      key: "products.manufacturer",
      label: "Products · Manufacturer",
      pricePence: 9900,
      audience: "manufacturer"
    }
  ] as const
} as const;

export type ProductsPlanKey =
  (typeof PRODUCTS_APP_MANIFEST)["plans"][number]["key"];
