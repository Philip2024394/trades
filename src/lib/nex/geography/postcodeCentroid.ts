// NEX geography · country-aware postcode centroid resolver.
//
// Wraps the UK-only `ukPostcodeCentroids` so downstream code stops
// pretending UK centroid maths can rank US ZIP or IE Eircode results.
//
// Current strategy · Option A per the international-readiness plan
// (Philip 2026-08-16):
//   · country="GB" (or unspecified) → resolve via ukPostcodeCentroids
//   · country=any other → return null (distance_km becomes null,
//     ranking falls back to promoted-first then published_at DESC)
//
// Future · Option B (deferred): plug in a US ZIP centroid dataset and IE
// Eircode routing key lookup here without touching any call site.

import { centroidOf as ukCentroidOf, type Latlng } from "@/lib/ukPostcodeCentroids";

export type { Latlng } from "@/lib/ukPostcodeCentroids";
export { haversineKm } from "@/lib/ukPostcodeCentroids";

/**
 * Resolve a postcode to a centroid, scoped by country.
 *   country undefined | "United Kingdom" | "GB" → UK lookup.
 *   any other country → null (honest degrade).
 */
export function centroidOf(postcode: string | null, country?: string | null): Latlng | null {
  if (!postcode) return null;
  if (country && country !== "United Kingdom" && country !== "GB") return null;
  return ukCentroidOf(postcode);
}
