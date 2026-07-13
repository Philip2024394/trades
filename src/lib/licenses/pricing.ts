// Licence tier pricing — single source of truth for what each tier
// costs. All prices in pence GBP. Change here → change everywhere
// (checkout, marketplace UI, license emails).

import type { LicenseTier } from "./types";

export type TierPricing = {
  id: LicenseTier;
  label: string;
  headline: string;
  sublabel: string;
  amountPence: number;
  /** Some tiers are recurring — the string appears next to the price. */
  billingCadence: "one-time" | "monthly" | "annual";
  /** What the buyer gets. Marketing copy → shown on the tier picker. */
  bullets: string[];
};

export const TIER_PRICING: Record<LicenseTier, TierPricing> = {
  standard: {
    id: "standard",
    label: "Standard",
    headline: "Licence to use",
    sublabel: "Website, social, print, ads — one business",
    amountPence: 3900, // £39
    billingCadence: "one-time",
    bullets: [
      "Removes the thenetworkers.app corner mark",
      "Use on your website, socials, print, digital ads",
      "One-off payment — yours to keep",
      "Non-exclusive (others can also licence)"
    ]
  },
  extended: {
    id: "extended",
    label: "Extended",
    headline: "Any use, unlimited",
    sublabel: "Print + paid ads + merchandise + resale of derived works",
    amountPence: 14900, // £149
    billingCadence: "one-time",
    bullets: [
      "Everything in Standard",
      "Merchandise (t-shirts, mugs, prints)",
      "Sell derivative works (e.g. tote bag prints)",
      "Unlimited impressions on paid social + display ads"
    ]
  },
  regional_exclusive: {
    id: "regional_exclusive",
    label: "Regional exclusive",
    headline: "Lock it to your area",
    sublabel: "No other merchant in your postcode district can use it",
    amountPence: 34800, // £29/mo × 12
    billingCadence: "annual",
    bullets: [
      "Everything in Standard",
      "Locked to one postcode district (e.g. SW1, E14)",
      "No other tradesperson in your area can licence this image",
      "Annual subscription — renewable at same rate"
    ]
  },
  full_buyout: {
    id: "full_buyout",
    label: "Full buyout",
    headline: "Own it outright",
    sublabel: "Removed from the catalogue — nobody else can ever use it",
    amountPence: 29900, // £299
    billingCadence: "one-time",
    bullets: [
      "Everything in Extended",
      "Image removed from the xrated trades catalogue",
      "Nobody else can licence it, anywhere, ever",
      "You own the clean file outright"
    ]
  },
  competitor: {
    id: "competitor",
    label: "Competitor / platform licence",
    headline: "For competing platforms + agencies",
    sublabel: "Distribute inside another product / template library",
    amountPence: 149900, // £1499
    billingCadence: "one-time",
    bullets: [
      "For platforms + agencies redistributing to their customers",
      "Includes source file + tagging metadata",
      "One image / one product line",
      "Non-exclusive"
    ]
  }
};

export function formatPence(pence: number, currency = "GBP"): string {
  const value = pence / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: value === Math.floor(value) ? 0 : 2
  }).format(value);
}
