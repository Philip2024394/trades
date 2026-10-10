// src/lib/nex-native/business/subtypes.ts
//
// NEX Business Experience · 30 subtypes under 5 categories.
// Rev 6 FROZEN · 2026-10-02.
//
// A subtype is a RECOMMENDATION context, not a permission boundary. It
// drives the starting values of capability + content recommendations and
// the terminology defaults. The owner can override anything, enable any
// content type from the universal catalog, and toggle any implemented
// capability regardless of subtype.
//
// Deeper specialisation within a subtype (nail artist vs hairdresser, plumber
// vs electrician) is OWNER-AUTHORED, not another subtype level. The subtype
// tree is kept intentionally flat to stop a 300-subtype slide.

import type {
  AccommodationSubtype,
  BusinessCategory,
  BusinessSubtype,
  FoodSubtype,
  ProductsSubtype,
  PropertySubtype,
  ServicesSubtype,
} from "./types";

export const FOOD_SUBTYPES: readonly FoodSubtype[] = [
  "restaurant",
  "cafe",
  "bakery",
  "food_maker",
  "catering",
  "drinks",
  "food_delivery",
] as const;

export const ACCOMMODATION_SUBTYPES: readonly AccommodationSubtype[] = [
  "hotel",
  "villa",
  "guesthouse",
  "homestay",
  "resort",
  "short_rental",
] as const;

export const PROPERTY_SUBTYPES: readonly PropertySubtype[] = [
  "for_sale",
  "for_rent",
  "developer",
  "agent",
] as const;

export const PRODUCTS_SUBTYPES: readonly ProductsSubtype[] = [
  "retail",
  "manufacturer",
  "wholesale",
  "local_artisan",
  "exporter",
  "motorbike_shop",
] as const;

export const SERVICES_SUBTYPES: readonly ServicesSubtype[] = [
  "beauty",
  "health_wellness",
  "home_services",
  "professional",
  "trade_construction",
  "automotive",
  "events",
  "creative",
] as const;

export const BUSINESS_SUBTYPES: readonly BusinessSubtype[] = [
  ...FOOD_SUBTYPES,
  ...ACCOMMODATION_SUBTYPES,
  ...PROPERTY_SUBTYPES,
  ...PRODUCTS_SUBTYPES,
  ...SERVICES_SUBTYPES,
] as const;

export const BUSINESS_SUBTYPE_CATEGORY: Record<BusinessSubtype, BusinessCategory> = {
  // Food
  restaurant:         "food",
  cafe:               "food",
  bakery:             "food",
  food_maker:         "food",
  catering:           "food",
  drinks:             "food",
  food_delivery:      "food",
  // Accommodation
  hotel:              "accommodation",
  villa:              "accommodation",
  guesthouse:         "accommodation",
  homestay:           "accommodation",
  resort:             "accommodation",
  short_rental:       "accommodation",
  // Property
  for_sale:           "property",
  for_rent:           "property",
  developer:          "property",
  agent:              "property",
  // Products
  retail:             "products",
  manufacturer:       "products",
  wholesale:          "products",
  local_artisan:      "products",
  exporter:           "products",
  motorbike_shop:     "products",
  // Services
  beauty:             "services",
  health_wellness:    "services",
  home_services:      "services",
  professional:       "services",
  trade_construction: "services",
  automotive:         "services",
  events:             "services",
  creative:           "services",
};

export const BUSINESS_SUBTYPE_LABEL: Record<BusinessSubtype, string> = {
  restaurant:         "Restaurant",
  cafe:               "Café",
  bakery:             "Bakery",
  food_maker:         "Food maker",
  catering:           "Catering",
  drinks:             "Drinks",
  food_delivery:      "Food delivery",
  hotel:              "Hotel",
  villa:              "Villa",
  guesthouse:         "Guesthouse",
  homestay:           "Homestay",
  resort:             "Resort",
  short_rental:       "Short rental",
  for_sale:           "Property for sale",
  for_rent:           "Property for rent",
  developer:          "Property developer",
  agent:              "Property agent",
  retail:             "Retail",
  manufacturer:       "Manufacturer",
  wholesale:          "Wholesale",
  local_artisan:      "Local artisan",
  exporter:           "Exporter",
  motorbike_shop:     "Motorbike shop",
  beauty:             "Beauty",
  health_wellness:    "Health & wellness",
  home_services:      "Home services",
  professional:       "Professional services",
  trade_construction: "Trade & construction",
  automotive:         "Automotive",
  events:             "Events",
  creative:           "Creative services",
};

export function isBusinessSubtype(value: string | null | undefined): value is BusinessSubtype {
  return !!value && (BUSINESS_SUBTYPES as readonly string[]).includes(value);
}

export function subtypesByCategory(category: BusinessCategory): readonly BusinessSubtype[] {
  switch (category) {
    case "food":          return FOOD_SUBTYPES;
    case "accommodation": return ACCOMMODATION_SUBTYPES;
    case "property":      return PROPERTY_SUBTYPES;
    case "products":      return PRODUCTS_SUBTYPES;
    case "services":      return SERVICES_SUBTYPES;
  }
}
