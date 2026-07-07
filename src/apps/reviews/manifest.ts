// reviews — App #004 manifest.
//
// Consumes review.requested (fired by Job Diary sign-off). Publishes
// review.posted, review.disputed, review.responded. Every review is
// auto-verified because it's bound to a completed sign-off — no more
// drive-by fakes.

import { Star } from "lucide-react";

export const REVIEWS_APP_MANIFEST = {
  slug: "reviews",
  name: "Reviews",
  category: "customer" as const,
  version: "1.0.0",
  description:
    "Verified reviews only. The moment a job is signed off the customer gets a one-tap review link. No accounts to create, no way to review a merchant you didn't buy from. Merchant responses public. Disputes go through admin — not a hidden button.",
  icon: Star,

  tradeAllowlist: [
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
  requiresProductFeed: false,

  eventsConsumed: ["review.requested"] as const,
  eventsPublished: [
    "review.posted",
    "review.responded",
    "review.disputed"
  ] as const,

  plans: [
    {
      key: "bundled",
      label: "Bundled with any Suite",
      pricePence: 0,
      monthlyQuota: null,
      audience: "any"
    }
  ] as const
} as const;

export type ReviewsPlanKey =
  (typeof REVIEWS_APP_MANIFEST)["plans"][number]["key"];
