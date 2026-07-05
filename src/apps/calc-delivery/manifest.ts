// calc-delivery — App-store manifest.
//
// Delivery Zones Calculator — interactive map with 3 concentric
// zones (green/yellow/red) each priced separately, plus a Google
// Maps directions bar. Owner controls what's shown.

import { MapPin } from "lucide-react";

export const CALC_DELIVERY_APP_MANIFEST = {
  slug: "calc-delivery",
  name: "Delivery Zones Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Interactive OpenStreetMap widget with 3 concentric delivery zones (green / yellow / red) each with radius + price (free or £). Owner toggles: show zones on/off · show directions bar on/off · show approximate location only. Directions bar opens Google Maps with turn-by-turn to the owner.",
  icon: MapPin,

  tradeAllowlist: [
    "driver",
    "delivery-driver",
    "courier",
    "takeaway",
    "restaurant",
    "florist",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "delivery",
    "local-delivery",
    "takeaway",
    "courier",
    "same-day-delivery",
    "florist",
    "restaurant",
    "shop"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcDeliveryAppSize =
  (typeof CALC_DELIVERY_APP_MANIFEST)["supportedSizes"][number];
