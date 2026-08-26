// src/lib/nex-distance/distance-intelligence.ts
//
// DISTANCE INTELLIGENCE · routing abstraction.
//
// A pluggable provider interface that returns routed distance + duration by mode.
// NEVER returns straight-line as a substitute for routed distance. When no provider
// is registered · or all providers fail · the result is honestly UNAVAILABLE so
// callers cannot accidentally show a straight-line number as if it were a walk.
//
// Doctrine anchors:
//   - Distance Intelligence precision-matched to confidence (2026-08-23)
//   - Transport Intelligence design (2026-08-23) · this is the routed-distance dependency
//   - Truth Invariant (2026-08-22): every returned route carries provider + capturedAt + provenance
//   - Traveller Protection Principle (2026-08-23): "Can I walk there?" must never mislead
//
// This module ships NO live HTTP call and NO real provider. It is the interface +
// registry + pure geometry helpers. Real providers (OSRM local · GraphHopper local ·
// Mapbox · Google) are separate files registered explicitly once greenlit.

export type TransportMode = "walking" | "motorbike" | "car";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteRequest {
  from: LatLng;
  to: LatLng;
  mode: TransportMode;
}

export interface RouteResult {
  status: "OK";
  mode: TransportMode;
  from: LatLng;
  to: LatLng;
  routedDistanceMeters: number;
  routedDurationSeconds: number;
  straightLineDistanceMeters: number;      // for QA only · UI must never show this without label
  provider: string;
  providerReference: string | null;         // e.g. OSRM trip id · Mapbox request id
  capturedAt: Date;
  freshnessValidUntil: Date | null;
  provenance: Record<string, unknown>;
}

export interface RouteUnavailable {
  status: "UNAVAILABLE";
  mode: TransportMode;
  from: LatLng;
  to: LatLng;
  reason: "NO_PROVIDER" | "PROVIDER_FAILED" | "ROUTE_NOT_FOUND" | "OUT_OF_COVERAGE";
  providersTried: string[];
  straightLineDistanceMeters: number;
  provenance: Record<string, unknown>;
}

export type RouteResponse = RouteResult | RouteUnavailable;

export interface DistanceProvider {
  name: string;
  supports: (mode: TransportMode) => boolean;
  route: (req: RouteRequest) => Promise<RouteResponse>;
}

// ── Registry ──────────────────────────────────────────────────────────
const providers: DistanceProvider[] = [];

export function registerDistanceProvider(p: DistanceProvider): void {
  providers.push(p);
}

/** Test-only reset. Not exported from the barrel to avoid production misuse. */
export function _resetDistanceProviders(): void {
  providers.length = 0;
}

// ── Public API ────────────────────────────────────────────────────────
export async function routeBetween(req: RouteRequest): Promise<RouteResponse> {
  const straight = straightLineDistanceMeters(req.from, req.to);
  const candidates = providers.filter((p) => p.supports(req.mode));

  if (candidates.length === 0) {
    return {
      status: "UNAVAILABLE",
      mode: req.mode,
      from: req.from,
      to: req.to,
      reason: "NO_PROVIDER",
      providersTried: [],
      straightLineDistanceMeters: straight,
      provenance: {
        reason:
          "No distance provider is registered for this mode. NEX will not substitute straight-line distance for a routed answer.",
      },
    };
  }

  const tried: string[] = [];
  for (const p of candidates) {
    tried.push(p.name);
    try {
      const r = await p.route(req);
      if (r.status === "OK") return r;
    } catch {
      // continue to next provider
    }
  }

  return {
    status: "UNAVAILABLE",
    mode: req.mode,
    from: req.from,
    to: req.to,
    reason: "PROVIDER_FAILED",
    providersTried: tried,
    straightLineDistanceMeters: straight,
    provenance: { reason: "All registered providers failed to return a route." },
  };
}

// ── Geometry ──────────────────────────────────────────────────────────
/**
 * Haversine straight-line distance in metres. Used ONLY for QA labelling and
 * for the `straightLineDistanceMeters` field on results (never as a routed answer).
 */
export function straightLineDistanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
