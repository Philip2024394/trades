// src/lib/nex-native/shipping-scope.ts
//
// Client-safe constants + type for the Migration 108 shipping-scope
// enum. Extracted from business-service.ts so cover-page primitives
// (which are "use client") can consume the labels without transitively
// pulling in server-only Supabase code.
//
// Server-side mutations still live on business-service.ts
// (updateShippingScope) alongside the "server-only" import.

export const NEX_SHIPPING_SCOPES = [
  "local_delivery",
  "local_and_export",
  "international_only",
  "pickup_only",
  "dine_in",
  "digital",
] as const;

export type NexShippingScope = (typeof NEX_SHIPPING_SCOPES)[number];

/** Human-friendly labels + emoji + blurb for the seller picker AND for
 *  the cover-page section heading. Order matches the visual grid.
 *  venueOnly = true when the option only makes sense for restaurants /
 *  cafes / bars / event spaces (hidden for product sellers). */
export const NEX_SHIPPING_SCOPE_META: Record<
  NexShippingScope,
  { emoji: string; label: string; blurb: string; venueOnly?: boolean }
> = {
  local_delivery: {
    emoji: "🛵",
    label: "Local Delivery",
    blurb: "Delivered locally by a rider or courier · your city / metro area",
  },
  local_and_export: {
    emoji: "✈️",
    label: "Local Delivery / Export",
    blurb: "Local delivery + international shipping on request",
  },
  international_only: {
    emoji: "🌏",
    label: "Ships Internationally",
    blurb: "Ships worldwide · no local-only option",
  },
  pickup_only: {
    emoji: "🏪",
    label: "Pickup Only",
    blurb: "Buyer collects · no delivery, no shipping",
  },
  dine_in: {
    emoji: "🍽",
    label: "Dine-in",
    blurb: "Seated dining at the venue · no delivery",
    venueOnly: true,
  },
  digital: {
    emoji: "💾",
    label: "Digital Delivery",
    blurb: "Downloadable / sent by link · no physical shipping",
  },
};
