// ai-visualiser — App-store manifest.
//
// Merchant-scoped AI renovation renders. When a merchant installs this
// app they pick which catalogue leaves they sell (e.g. a carpenter
// ticks "internal_doors" + "loft_ladders" but NOT "staircases"). The
// customer-facing Visualiser will refuse any upload outside that scope,
// so the merchant only pays for renders inside their catalogue and
// never loses a lead to a competitor down the road.
//
// Homeowner registration (name / email / whatsapp / postcode) creates a
// lead attached to THIS merchant. Merchant owns every lead generated on
// their page. No marketplace routing at this layer — off-scope uploads
// become "routed leads" in the marketplace lane, which is a separate
// revenue line.

import { Sparkles } from "lucide-react";

export const AI_VISUALISER_APP_MANIFEST = {
  slug: "ai-visualiser",
  name: "AI Visualiser",
  category: "conversion" as const,
  version: "1.0.0",
  description:
    "Homeowners upload a photo, pick style + colour + finish from your catalogue, and see their renovation on their own space before they book. Every render captures a verified lead — name, email, WhatsApp, postcode — straight to your inbox.",
  icon: Sparkles,

  /** Which trades can install this app. Kept broad because the AI is
   *  constrained by the per-merchant leaf picker at install time, not
   *  by trade. */
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
    "kitchen-showroom",
    "bathroom-showroom",
    "building-merchant",
    "builders-supplies",
    "tile-supplier",
    "general-builder"
  ] as const,

  /** Auto-suggest installation when a merchant lists any of these
   *  services in their profile. Actual scope is picked in the app
   *  install wizard. */
  autoInstallOnService: [
    "kitchen-installation",
    "bathroom-installation",
    "staircase-installation",
    "door-installation",
    "window-installation",
    "roof-tiling",
    "flooring-installation",
    "landscape-design",
    "driveway-installation",
    "fence-installation",
    "painting",
    "decorating"
  ] as const,

  /** Supported embed sizes for the merchant-page square + gold-path
   *  slot. */
  supportedSizes: ["square", "landscape", "portrait"] as const,

  /** Compact enough to embed as an opt-in tile on merchant homepages. */
  compact: true,

  /** Requires a merchant product catalogue — the design tree is
   *  populated from real products, not generic AI content. */
  requiresProductFeed: true,

  /** Billing plans exposed at the App Store. Bundled tier is included
   *  free in the Merchant Pro plan (£14.99/mo, building-merchant +
   *  builders-supplies only). */
  plans: [
    {
      key: "bundled",
      label: "Bundled in Merchant Pro",
      pricePence: 0,
      monthlyQuota: 100,
      overageRatePence: 30,
      audience: "merchant-pro-only"
    },
    {
      key: "starter",
      label: "Starter",
      pricePence: 1900,
      monthlyQuota: 100,
      overageRatePence: 30,
      audience: "any"
    },
    {
      key: "growth",
      label: "Growth",
      pricePence: 4900,
      monthlyQuota: 400,
      overageRatePence: 20,
      audience: "any"
    },
    {
      key: "unlimited",
      label: "Unlimited",
      pricePence: 12900,
      monthlyQuota: 2000, // fair-use cap; still marketed as unlimited
      overageRatePence: 15,
      audience: "any"
    }
  ] as const
} as const;

export type AiVisualiserAppSize =
  (typeof AI_VISUALISER_APP_MANIFEST)["supportedSizes"][number];

export type AiVisualiserPlanKey =
  (typeof AI_VISUALISER_APP_MANIFEST)["plans"][number]["key"];
