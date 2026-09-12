// src/lib/nex/cross-domain/geo-reasoning.ts
//
// Founder Phase 5 · P5-3 · geographic reasoning helper.
//
// Haversine distance between two lat/lng points · builds proximity
// relations between two entity lists. Doctrine-safe: null coordinates
// in → null out. Never invents a distance.

export interface GeoPoint {
  entity_ref: string;
  display_name?: string;
  lat: number | null;
  lng: number | null;
}

export interface ProximityRelation {
  from: GeoPoint;
  to: GeoPoint;
  distance_km: number;
}

const EARTH_R_KM = 6371;

/**
 * Haversine great-circle distance in km. Returns null when EITHER
 * point has null coordinates. Never throws.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Build proximity relations between two entity lists. Returns pairs
 * whose distance is <= max_km. Silently skips pairs with null coords.
 */
export function buildProximityRelations(
  fromList: readonly GeoPoint[],
  toList: readonly GeoPoint[],
  max_km: number,
): ProximityRelation[] {
  const out: ProximityRelation[] = [];
  for (const a of fromList) {
    for (const b of toList) {
      const d = haversineKm(a, b);
      if (d == null) continue;
      if (d <= max_km) out.push({ from: a, to: b, distance_km: Number(d.toFixed(3)) });
    }
  }
  out.sort((x, y) => x.distance_km - y.distance_km);
  return out;
}
