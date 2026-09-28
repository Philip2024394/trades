// src/lib/nex-native/bike-delivery-service.ts
//
// Bridge 25c · Bike-delivery rate estimator (Indonesian standard).
// ----------------------------------------------------------------
// Buyers on the /cart page tap "Estimate delivery" · the browser
// geolocation gives us the buyer's lat/lng · we compute Haversine
// distance to the seller's saved location and multiply by a
// standard bike-hailing rate (Gojek / Grab / Maxim). The output is a
// single "Estimated bike delivery" figure the seller can quote when
// they book a driver from GoSend / GrabExpress / Maxim.
//
// This is deliberately a client-safe pure module · no server-only
// import. Anywhere that needs the calc (cart page, seller shop
// preview) can pull from here.
//
// Rate sources (Indonesian bike-hail 2025 baseline):
//   Gojek GoSend Instant · base Rp 9,000 · Rp 2,500/km after 1 km · min Rp 12,000
//   GrabExpress          · base Rp 10,000 · Rp 2,700/km after 1 km · min Rp 12,000
//   Maxim Bike           · base Rp 8,000  · Rp 2,200/km after 1 km · min Rp 10,000
//
// We publish a "standard NEX estimate" that lands roughly on the
// median (base Rp 9,000 · Rp 2,500 / km · min Rp 12,000). Sellers
// still book the actual driver themselves · this is a quote for
// buyer transparency, not a live booking API integration.

export const NEX_BIKE_DELIVERY_RATE = {
  /** Currency fixed to IDR for now · Indonesian rider services. */
  currency: "IDR" as const,
  /** Rp 9,000 base fare · pickup + first 1km. */
  base_pence: 9_000 * 100,
  /** Rp 2,500 per km after the first km. */
  per_km_pence: 2_500 * 100,
  /** First 1 km is included in the base. */
  base_km: 1,
  /** Rp 12,000 minimum · shorter trips still cost this much. */
  minimum_pence: 12_000 * 100,
};

export interface BikeDeliveryEstimate {
  /** Straight-line distance in kilometres · one decimal precision. */
  distance_km: number;
  /** Estimated fare in pence (centi-rupiah). */
  fare_pence: number;
  /** Human "Rp 15,000" render helper. */
  fare_label: string;
  /** Ballpark ride time · assume 22 km/h city bike average. */
  eta_minutes: number;
  currency: "IDR";
  /** Which rate set produced the number · surfaced in the UI so the
   *  buyer knows this is a NEX estimate, not a live driver quote. */
  rate_name: "nex_standard";
}

/** Haversine great-circle distance in kilometres. */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371; // km · mean earth radius
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

/** Compute an estimate for the given straight-line km. Real road
 *  distance is typically 1.2-1.4× straight-line · we apply a modest
 *  1.25× correction so the quote isn't optimistic. */
export function estimateBikeFare(distanceKm: number): BikeDeliveryEstimate {
  const roadKm = Math.max(0, distanceKm) * 1.25;
  const km = Math.round(roadKm * 10) / 10;
  const extraKm = Math.max(0, km - NEX_BIKE_DELIVERY_RATE.base_km);
  const raw =
    NEX_BIKE_DELIVERY_RATE.base_pence +
    extraKm * NEX_BIKE_DELIVERY_RATE.per_km_pence;
  const fare = Math.max(raw, NEX_BIKE_DELIVERY_RATE.minimum_pence);
  const rounded = Math.round(fare / (500 * 100)) * (500 * 100); // Rp 500 step
  const eta = Math.max(8, Math.round((km / 22) * 60)); // ~22 km/h · 8 min floor
  return {
    distance_km: km,
    fare_pence: rounded,
    fare_label: formatIdrPence(rounded),
    eta_minutes: eta,
    currency: "IDR",
    rate_name: "nex_standard",
  };
}

/** Compute an estimate given two lat/lng pairs. Returns null when
 *  either coordinate is missing / non-finite. */
export function estimateBikeFareBetween(
  fromLat: number | null | undefined,
  fromLng: number | null | undefined,
  toLat: number | null | undefined,
  toLng: number | null | undefined,
): BikeDeliveryEstimate | null {
  if (
    typeof fromLat !== "number" ||
    typeof fromLng !== "number" ||
    typeof toLat !== "number" ||
    typeof toLng !== "number" ||
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    return null;
  }
  return estimateBikeFare(haversineKm(fromLat, fromLng, toLat, toLng));
}

/** Rp 12,500 render for pence values. */
export function formatIdrPence(pence: number): string {
  const majors = Math.round(pence / 100);
  return `Rp ${majors.toLocaleString("id-ID")}`;
}

/** Snapshot embedded into the cart-order bubble so the seller sees
 *  what the buyer was quoted at Send time. Frozen · does not change
 *  after send even if rates or coordinates change later. */
export interface NexCartDeliveryQuote {
  /** "free" · one of the ordered dishes had the free_delivery perk.
   *  "estimate" · standard NEX bike rate. "unknown" · buyer opted
   *  out or geolocation failed · seller confirms in chat. */
  kind: "free" | "estimate" | "unknown";
  distance_km?: number;
  fare_pence?: number;
  currency?: "IDR";
  eta_minutes?: number;
  /** Which perk (if any) triggered the free classification, e.g.
   *  the dish name that had free_delivery ticked. */
  free_reason?: string | null;
}
