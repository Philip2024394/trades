// notebook — trade-facing Quote Me app manifest.
//
// The trade opens a Notebook of the products they buy; each item
// auto-matches to the nearest verified merchant. Multi-item basket
// submits as one bulk quote request that fans out to the nearest
// verified merchants (per Constitution rule 3: notebook is
// personal-list-first, never a global deals wall).

import { NotebookText } from "lucide-react";

export const NOTEBOOK_APP_MANIFEST = {
  slug: "notebook",
  name: "Trade Notebook",
  category: "buying" as const,
  version: "1.0.0",
  description:
    "The trade's personal buying list, tuned to their location. Notebook stores usual items, matches each to the nearest verified merchant, and submits multi-item Quote Me requests. Zero commission on winning quotes.",
  icon: NotebookText,

  /** Trades who buy materials — every discipline that runs a site. */
  tradeAllowlist: [
    "plasterer",
    "bricklayer",
    "carpenter",
    "joiner",
    "electrician",
    "plumber",
    "roofer",
    "flooring-installer",
    "landscaper",
    "fencer",
    "decorator",
    "painter",
    "tiler",
    "kitchen-fitter",
    "bathroom-fitter",
    "general-builder",
    "groundworker"
  ] as const,

  autoInstallOnService: [] as const,

  supportedSizes: ["landscape"] as const,

  compact: false,

  requiresProductFeed: false,

  /** Event contract. */
  eventsConsumed: [
    "product.stock_low",         // → suggest clearance surface
    "product.price_changed",     // → recompute basket unit prices
    "product.withdrawn"          // → flag basket items as unavailable
  ] as const,

  eventsPublished: [
    "notebook.basket.item_added",
    "notebook.basket.item_removed",
    "notebook.quote_request.sent",
    "notebook.quote_request.quoted",
    "notebook.quote_request.won",
    "notebook.quote_request.expired",
    "notebook.site_project.created"
  ] as const,

  plans: [
    {
      key:          "included",
      label:        "Included in Trade Center",
      pricePence:   0,
      monthlyQuota: null,
      audience:     "all-trades"
    }
  ] as const,

  /** Storage — every table prefixed app_notebook_ per platform rule. */
  storage: {
    tables: [
      "app_notebook_site_projects",
      "app_notebook_quote_basket_items",
      "app_notebook_quote_requests",
      "app_notebook_quote_request_items"
    ] as const,
    views: ["app_notebook_merchant_inbox"] as const
  }
} as const;

export type NotebookAppManifest = typeof NOTEBOOK_APP_MANIFEST;
