// quote-workspace — App #002 manifest.
//
// The loop-closer between AI Visualiser (produces Specifications) and
// Order (accepted quote in fulfilment). Consumes render.completed to
// auto-draft; produces quote.* events consumed by CRM, Home Timeline,
// Analytics, and (future) Order.

import { FileText } from "lucide-react";

export const QUOTE_WORKSPACE_APP_MANIFEST = {
  slug: "quote-workspace",
  name: "Quote Workspace",
  category: "sales" as const,
  version: "1.0.0",
  description:
    "Draft, send, and track quotes — every quote pinned to a project, a specification, and a homeowner. Auto-drafted from AI Visualiser renders, comparable side-by-side by the homeowner, and audit-trailed end-to-end.",
  icon: FileText,

  /** Trades that quote for installed work + merchants that quote for
   *  supply-only. Anyone who needs to send a price. */
  tradeAllowlist: [
    "kitchen-fitter",
    "bathroom-fitter",
    "carpenter",
    "staircase-manufacturer",
    "door-supplier",
    "window-installer",
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
    "kitchen-showroom",
    "bathroom-showroom",
    "building-merchant",
    "builders-supplies",
    "tile-supplier",
    "general-builder"
  ] as const,

  autoInstallOnService: [] as const,

  supportedSizes: ["landscape"] as const,

  compact: false,

  /** Not a rendered widget — a full workspace surface. */
  requiresProductFeed: false,

  /** Event contract — this app's public interface. */
  eventsConsumed: [
    "render.completed",         // → draft quote suggestion
    "spec.updated",             // → mark drafts as stale
    "property.claimed"          // → attach open quotes to real property
  ] as const,

  eventsPublished: [
    "quote.drafted",
    "quote.sent",
    "quote.viewed",
    "quote.accepted",
    "quote.rejected",
    "quote.expired",
    "quote.withdrawn"
  ] as const,

  plans: [
    {
      key: "bundled",
      label: "Bundled in Merchant Pro",
      pricePence: 0,
      monthlyQuota: null,
      audience: "merchant-pro-only"
    },
    {
      key: "starter",
      label: "Starter",
      pricePence: 900,          // £9/mo — comparable to a coffee, replaces Word + PDF + email
      monthlyQuota: 25,
      audience: "any"
    },
    {
      key: "growth",
      label: "Growth",
      pricePence: 2900,         // £29/mo
      monthlyQuota: 200,
      audience: "any"
    },
    {
      key: "unlimited",
      label: "Unlimited",
      pricePence: 5900,         // £59/mo
      monthlyQuota: null,
      audience: "any"
    }
  ] as const
} as const;

export type QuoteWorkspaceAppSize =
  (typeof QUOTE_WORKSPACE_APP_MANIFEST)["supportedSizes"][number];

export type QuoteWorkspacePlanKey =
  (typeof QUOTE_WORKSPACE_APP_MANIFEST)["plans"][number]["key"];
