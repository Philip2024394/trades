// src/lib/nex-native/business/categories.ts
//
// NEX Business Experience · 5 universal business categories.
// Rev 6 FROZEN · 2026-10-02.
//
// Categories exist as a RECOMMENDATION context, never as a permission
// boundary. See the two load-bearing principles in ./types.ts.

import type { BusinessCategory } from "./types";

export const BUSINESS_CATEGORIES: readonly BusinessCategory[] = [
  "food",
  "accommodation",
  "property",
  "products",
  "services",
] as const;

export const BUSINESS_CATEGORY_LABEL: Record<BusinessCategory, string> = {
  food:          "Food & Dining",
  accommodation: "Accommodation",
  property:      "Property",
  products:      "Products",
  services:      "Services",
};

export const BUSINESS_CATEGORY_BLURB: Record<BusinessCategory, string> = {
  food:          "Prepares + sells food or drinks (venue or maker)",
  accommodation: "Hosts guests overnight (hotel, villa, guesthouse, resort, rental)",
  property:      "Buys / sells / rents / develops real estate",
  products:      "Makes or sells physical goods",
  services:      "Provides time + skill (not a physical good)",
};

export function isBusinessCategory(value: string | null | undefined): value is BusinessCategory {
  return !!value && (BUSINESS_CATEGORIES as readonly string[]).includes(value);
}
