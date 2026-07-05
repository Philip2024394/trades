// Delivery zones calculator — 3 concentric zones (green / yellow /
// red) with radius + price. Owner controls what's visible.
//
// This is a labour-side calc (owner sets prices, customer sees map)
// so there's no CalculatorOutput / material feed — the shape is
// purpose-built for the map widget.

export type DeliveryZoneColor = "green" | "yellow" | "red";

export type DeliveryZone = {
  color: DeliveryZoneColor;
  radius_km: number;
  price_pence: number;
  free: boolean;
};

export type DeliveryConfig = {
  owner_lat: number;
  owner_lng: number;
  owner_label: string;
  approximate_location: boolean;
  zones: DeliveryZone[];
  show_zones: boolean;
  show_directions_bar: boolean;
};

export const DELIVERY_ZONE_LABEL: Record<DeliveryZoneColor, string> = {
  green: "Green (closest)",
  yellow: "Yellow (mid)",
  red: "Red (outer)"
};

/** UI-facing hex colours per zone (fill + stroke). */
export const DELIVERY_ZONE_COLOURS: Record<
  DeliveryZoneColor,
  { fill: string; stroke: string }
> = {
  green: { fill: "#22c55e33", stroke: "#16a34a" },
  yellow: { fill: "#eab30833", stroke: "#ca8a04" },
  red: { fill: "#ef444433", stroke: "#dc2626" }
};

/** Radius (m) of the "approximate location" fuzzy ring — 500 m by
 *  default so the actual address stays private within a small
 *  neighbourhood. */
export const APPROXIMATE_RADIUS_M = 500;

/** Haversine distance in km between two lat/lng points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Returns the ZONE that a given distance falls into, or null if
 *  outside all zones. Uses the smallest radius that contains the
 *  distance (green first if inside green, then yellow, then red). */
export function zoneForDistance(
  config: DeliveryConfig,
  distanceKm: number
): DeliveryZone | null {
  const sorted = [...config.zones].sort((a, b) => a.radius_km - b.radius_km);
  for (const z of sorted) {
    if (distanceKm <= z.radius_km) return z;
  }
  return null;
}

/** Build a Google Maps directions URL. Destination-only — Google Maps
 *  fills in the visitor's current location as the origin. */
export function googleMapsDirectionsUrl(
  lat: number,
  lng: number,
  label?: string
): string {
  const dest = label ? encodeURIComponent(label) : `${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

/** Sanity-check + normalise zones: enforce green ≤ yellow ≤ red radii. */
export function sanitiseZones(zones: DeliveryZone[]): DeliveryZone[] {
  const byColor: Record<DeliveryZoneColor, DeliveryZone | undefined> = {
    green: undefined,
    yellow: undefined,
    red: undefined
  };
  for (const z of zones) byColor[z.color] = z;
  const g = byColor.green ?? DEFAULT_ZONE("green");
  const y = byColor.yellow ?? DEFAULT_ZONE("yellow");
  const r = byColor.red ?? DEFAULT_ZONE("red");
  // Enforce ordering
  const yellowR = Math.max(y.radius_km, g.radius_km + 0.1);
  const redR = Math.max(r.radius_km, yellowR + 0.1);
  return [
    { ...g },
    { ...y, radius_km: yellowR },
    { ...r, radius_km: redR }
  ];
}

function DEFAULT_ZONE(color: DeliveryZoneColor): DeliveryZone {
  switch (color) {
    case "green":
      return { color, radius_km: 3, price_pence: 0, free: true };
    case "yellow":
      return { color, radius_km: 8, price_pence: 500, free: false };
    case "red":
      return { color, radius_km: 15, price_pence: 1000, free: false };
  }
}

export const DEFAULT_DELIVERY_ZONES: DeliveryZone[] = [
  DEFAULT_ZONE("green"),
  DEFAULT_ZONE("yellow"),
  DEFAULT_ZONE("red")
];

/** Central London default so demo previews render somewhere sensible. */
export const DEFAULT_DELIVERY_CONFIG: DeliveryConfig = {
  owner_lat: 51.5074,
  owner_lng: -0.1278,
  owner_label: "London",
  approximate_location: false,
  zones: DEFAULT_DELIVERY_ZONES,
  show_zones: true,
  show_directions_bar: true
};

export function formatZonePrice(z: DeliveryZone): string {
  if (z.free) return "Free";
  const gbp = z.price_pence / 100;
  return gbp >= 10 ? `£${gbp.toFixed(0)}` : `£${gbp.toFixed(2)}`;
}
