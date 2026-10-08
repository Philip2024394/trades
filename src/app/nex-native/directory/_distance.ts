// src/app/nex-native/directory/_distance.ts
//
// NEX Directory · Phase A · Pure Haversine distance helper.
//
// What this module is
//   · The one authoritative place where "how far is listing X from
//     the viewer" is answered.
//   · Pure: no clock, no randomness, no network, no DB. Pure math
//     over two {lat, lng} points.
//   · Deterministic. Same inputs → same output every time.
//
// What this module is NOT
//   · Not a geolocation permission handler (that lives client-side
//     in _directory-results.tsx, which asks the browser for the
//     viewer's position with explicit user consent).
//   · Not a fallback computer. If either point is null (viewer has
//     no location permission, or the listing has no canonical
//     coordinates), the module returns null · never a fabricated
//     distance.
//   · Not a formatter. Rendering ("1.2 km" vs "860 m") is the UI's
//     concern. This module returns a plain number of kilometres.
//
// Semantics
//   · Uses the standard Haversine formula on the WGS84 sphere with
//     mean Earth radius R = 6371 km. This matches the shape the rest
//     of NEX uses (nex_business.location_lat / location_lng in the
//     cart bike-delivery estimator; coordinate decomposition in the
//     sealed scripts/nex-canonical/canonical-row.ts).
//   · Precision is sufficient for Directory display (hundreds of
//     metres accuracy at typical city-centre distances). Not geodesic;
//     the Earth isn't a perfect sphere, but the difference is well
//     under 1% at these scales.
//
// Reflection discipline
//   · The two lat/lng shapes carried into this module come from
//     Phase B's `DirectoryCoordinates`. If that type ever renames or
//     restructures, this module must stay in lock-step via the
//     import below.

import type { DirectoryCoordinates } from "@/lib/nex-native/directory";

// ═════════════════════════════════════════════════════════════════════
// §1 · Constants
// ═════════════════════════════════════════════════════════════════════

/** Mean Earth radius in kilometres (WGS84 convention). */
export const EARTH_MEAN_RADIUS_KM = 6371 as const;

// ═════════════════════════════════════════════════════════════════════
// §2 · Pure math
// ═════════════════════════════════════════════════════════════════════

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two WGS84 points, in kilometres.
 *  Pure. Deterministic. The two points are supplied by:
 *   · `from` = the viewer's current position (from navigator.geolocation,
 *              gated by explicit user consent in the client component),
 *   · `to`   = the listing's canonical coordinates (from
 *              nex.business_canonical, projected via Phase B). */
export function haversineKm(
  from: DirectoryCoordinates,
  to: DirectoryCoordinates,
): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_MEAN_RADIUS_KM * c;
}

/** Nullable form · returns null if either input is null. The Directory
 *  calls this on every card, passing the listing's `coordinates` and
 *  the viewer's position; null means "no distance to show" and the UI
 *  renders no distance chip (honest). */
export function haversineKmOrNull(
  from: DirectoryCoordinates | null,
  to: DirectoryCoordinates | null,
): number | null {
  if (from === null || to === null) return null;
  return haversineKm(from, to);
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Formatter
// ═════════════════════════════════════════════════════════════════════

/** Convert a kilometre distance to a human-readable chip string.
 *   · Distances < 1 km render in metres rounded to the nearest 10
 *     (e.g. "320 m").
 *   · Distances ≥ 1 km and < 10 km render with one decimal
 *     (e.g. "2.4 km").
 *   · Distances ≥ 10 km render as integer km (e.g. "17 km").
 *   · Non-finite / negative inputs return null (defensive · the
 *     caller never fabricates a value).
 *
 *  Pure. Deterministic. No locale-sensitive formatting (Phase A
 *  Directory stays with the global convention for ships; a later
 *  wave can introduce i18n via the sealed `src/lib/nex/i18n/`
 *  primitive). */
export function formatKmDistance(km: number): string | null {
  if (!Number.isFinite(km) || km < 0) return null;
  if (km < 1) {
    const metres = Math.round((km * 1000) / 10) * 10;
    return `${metres} m`;
  }
  if (km < 10) {
    const rounded = Math.round(km * 10) / 10;
    return `${rounded.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}
