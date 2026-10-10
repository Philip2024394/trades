// src/lib/nex-native/business/content.ts
//
// NEX Business Experience · universal content catalog + per-subtype
// recommendations. Rev 6 FROZEN · 2026-10-02.
//
// NAMING DISCIPLINE (Finding #4 · hidden-permission defence):
//   AVAILABLE   · getAvailableContentTypes()    · universal · SOURCE OF TRUTH
//   RECOMMENDED · getRecommendedContentTypes()  · subtype suggestion only
//   ENABLED     · getEffectiveContentType()     · owner_override ?? recommendation ?? false
//
// The hard invariant: every content type is AVAILABLE on every NEX forever.
// The subtype never gates availability. See the two load-bearing principles.

import type {
  BusinessEngineInput,
  BusinessSubtype,
  ContentTypeKey,
} from "./types";

// -----------------------------------------------------------------------------
// AVAILABLE · universal catalog · one row per implemented content type.
// -----------------------------------------------------------------------------
export const AVAILABLE_CONTENT_TYPES: readonly ContentTypeKey[] = [
  "menu_item",
  "product",
  "service",
  "accommodation_unit",
  "property_listing",
  "portfolio_item",
  "offer",
  "testimonial",
] as const;

export const CONTENT_TYPE_LABEL: Record<ContentTypeKey, string> = {
  menu_item:          "Menu item",
  product:            "Product",
  service:            "Service",
  accommodation_unit: "Accommodation unit",
  property_listing:   "Property listing",
  portfolio_item:     "Portfolio piece",
  offer:              "Offer",
  testimonial:        "Testimonial",
};

export const CONTENT_TYPE_TABLE: Record<ContentTypeKey, string> = {
  menu_item:          "nex_menu_item",
  product:            "nex_product",
  service:            "nex_service",
  accommodation_unit: "nex_accommodation_unit",
  property_listing:   "nex_property_listing",
  portfolio_item:     "nex_portfolio_item",
  offer:              "nex_offer",
  testimonial:        "nex_testimonial",
};

// -----------------------------------------------------------------------------
// RECOMMENDED · subtype-sourced suggestions. Non-exhaustive by design ·
// shows up in the "Suggested for your business" section of /manage/content.
// Not a permission; owner can enable anything in AVAILABLE_CONTENT_TYPES.
// -----------------------------------------------------------------------------
const R: Record<BusinessSubtype, readonly ContentTypeKey[]> = {
  // Food
  restaurant:         ["menu_item", "offer", "testimonial", "portfolio_item"],
  cafe:               ["menu_item", "offer", "testimonial", "portfolio_item"],
  bakery:             ["menu_item", "offer", "testimonial", "portfolio_item"],
  food_maker:         ["menu_item", "offer", "testimonial", "portfolio_item"],
  catering:           ["offer", "menu_item", "testimonial", "portfolio_item"],
  drinks:             ["menu_item", "offer", "testimonial"],
  food_delivery:      ["menu_item", "offer", "testimonial"],
  // Accommodation
  hotel:              ["accommodation_unit", "offer", "testimonial", "portfolio_item"],
  villa:              ["accommodation_unit", "offer", "testimonial", "portfolio_item"],
  guesthouse:         ["accommodation_unit", "offer", "testimonial", "portfolio_item"],
  homestay:           ["accommodation_unit", "offer", "testimonial", "portfolio_item"],
  resort:             ["accommodation_unit", "offer", "testimonial", "portfolio_item"],
  short_rental:       ["accommodation_unit", "offer", "testimonial", "portfolio_item"],
  // Property
  for_sale:           ["property_listing", "portfolio_item", "testimonial", "offer"],
  for_rent:           ["property_listing", "portfolio_item", "testimonial", "offer"],
  developer:          ["property_listing", "portfolio_item", "testimonial", "offer"],
  agent:              ["property_listing", "portfolio_item", "testimonial", "offer"],
  // Products
  retail:             ["product", "offer", "testimonial"],
  manufacturer:       ["product", "portfolio_item", "testimonial", "offer"],
  wholesale:          ["product", "portfolio_item", "testimonial", "offer"],
  local_artisan:      ["product", "portfolio_item", "testimonial", "offer"],
  exporter:           ["product", "portfolio_item", "testimonial", "offer"],
  // Services
  beauty:             ["service", "portfolio_item", "testimonial", "offer"],
  health_wellness:    ["service", "portfolio_item", "testimonial", "offer"],
  home_services:      ["service", "testimonial", "portfolio_item", "offer"],
  automotive:         ["service", "testimonial", "portfolio_item", "offer"],
  trade_construction: ["service", "portfolio_item", "testimonial", "offer"],
  professional:       ["service", "testimonial", "offer", "portfolio_item"],
  events:             ["offer", "portfolio_item", "testimonial", "service"],
  creative:           ["portfolio_item", "service", "offer", "testimonial"],
};

export const CONTENT_RECOMMENDATIONS_BY_SUBTYPE: Readonly<
  Record<BusinessSubtype, readonly ContentTypeKey[]>
> = R;

// -----------------------------------------------------------------------------
// Public selectors · each named precisely to prevent Finding #4 attacks.
// -----------------------------------------------------------------------------

/** AVAILABLE · universal catalog · every content type on every NEX, forever. */
export function getAvailableContentTypes(): readonly ContentTypeKey[] {
  return AVAILABLE_CONTENT_TYPES;
}

/** RECOMMENDED · union across the business's primary + secondary subtypes. */
export function getRecommendedContentTypes(
  subtypes: readonly BusinessSubtype[],
): readonly ContentTypeKey[] {
  const seen = new Set<ContentTypeKey>();
  for (const s of subtypes) {
    for (const k of R[s] ?? []) seen.add(k);
  }
  return Array.from(seen);
}

/** EFFECTIVE · owner_override ?? recommendation ?? false. */
export function getEffectiveContentType(
  key: ContentTypeKey,
  input: BusinessEngineInput,
  subtypes: readonly BusinessSubtype[],
): boolean {
  const override = input.owner_state.content_overrides[key];
  if (typeof override === "boolean") return override;
  const recommended = new Set(getRecommendedContentTypes(subtypes));
  return recommended.has(key);
}

/** The set of effectively-enabled content types on the business. */
export function getEnabledContentTypes(
  input: BusinessEngineInput,
  subtypes: readonly BusinessSubtype[],
): Set<ContentTypeKey> {
  const out = new Set<ContentTypeKey>();
  for (const key of AVAILABLE_CONTENT_TYPES) {
    if (getEffectiveContentType(key, input, subtypes)) out.add(key);
  }
  return out;
}

/** Does the business have at least one actual row of this content type?
 *  Feeds semantic feasibility (an Order CTA requires at least ONE orderable
 *  item, not merely an enabled content type). */
export function hasContentItems(
  key: ContentTypeKey,
  input: BusinessEngineInput,
): boolean {
  return (input.content_counts[key] ?? 0) > 0;
}
