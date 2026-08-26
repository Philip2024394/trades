// src/lib/nex-transport/transport-calculation.test.ts
//
// Transport calculation bright-line tests. Rules under test:
//
//   1. No tariff evidence → UNKNOWN (never invented number)
//   2. UNKNOWN-tier tariff → UNKNOWN (never promoted)
//   3. Straight-line route → UNKNOWN (route.status must be OK)
//   4. Provisional Yogyakarta ojol → OK with PROVISIONAL preface
//   5. DIY taxi (UNKNOWN evidence registered) → UNKNOWN with unknown-note
//   6. Result always a RANGE never a single number
//   7. Result carries unknown-note explaining what it is NOT (live app quote)

import { describe, it, expect } from "vitest";
import {
  calculateTransportFareRange,
  YOGYA_OJOL_ZONE_I_PROVISIONAL,
  YOGYA_TAXI_UNKNOWN,
  YOGYA_ASK_UNKNOWN,
} from "./transport-calculation";
import { straightLineDistanceMeters, type RouteResponse } from "../nex-distance/distance-intelligence";

const A = { lat: -7.7828, lng: 110.3671 };
const B = { lat: -7.7521, lng: 110.4914 };

function okRoute(distanceMeters: number, durationSeconds: number): RouteResponse {
  return {
    status: "OK",
    mode: "motorbike",
    from: A,
    to: B,
    routedDistanceMeters: distanceMeters,
    routedDurationSeconds: durationSeconds,
    straightLineDistanceMeters: straightLineDistanceMeters(A, B),
    provider: "test-osrm",
    providerReference: "trip-1",
    capturedAt: new Date(),
    freshnessValidUntil: null,
    provenance: {},
  };
}

function unavailableRoute(): RouteResponse {
  return {
    status: "UNAVAILABLE",
    mode: "motorbike",
    from: A,
    to: B,
    reason: "NO_PROVIDER",
    providersTried: [],
    straightLineDistanceMeters: straightLineDistanceMeters(A, B),
    provenance: {},
  };
}

describe("Transport calculation · refuses without tariff evidence", () => {
  it("returns UNKNOWN when tariff is null", () => {
    const r = calculateTransportFareRange({ route: okRoute(15000, 1800), tariff: null });
    expect(r.status).toBe("UNKNOWN");
    if (r.status === "UNKNOWN") {
      expect(r.reason).toBe("NO_TARIFF_EVIDENCE");
      expect(r.unknown.toLowerCase()).toMatch(/invention/);
    }
  });

  it("returns UNKNOWN when tariff tier is UNKNOWN (DIY taxi)", () => {
    const r = calculateTransportFareRange({ route: okRoute(15000, 1800), tariff: YOGYA_TAXI_UNKNOWN });
    expect(r.status).toBe("UNKNOWN");
    if (r.status === "UNKNOWN") {
      expect(r.reason).toBe("TARIFF_TIER_UNKNOWN");
      expect(r.unknown).toMatch(/primary decree text/);
    }
  });

  it("returns UNKNOWN when tariff tier is UNKNOWN (DIY ASK)", () => {
    const r = calculateTransportFareRange({ route: okRoute(15000, 1800), tariff: YOGYA_ASK_UNKNOWN });
    expect(r.status).toBe("UNKNOWN");
    if (r.status === "UNKNOWN") expect(r.reason).toBe("TARIFF_TIER_UNKNOWN");
  });
});

describe("Transport calculation · refuses without a routed distance", () => {
  it("returns UNKNOWN when route is UNAVAILABLE", () => {
    const r = calculateTransportFareRange({
      route: unavailableRoute(),
      tariff: YOGYA_OJOL_ZONE_I_PROVISIONAL,
    });
    expect(r.status).toBe("UNKNOWN");
    if (r.status === "UNKNOWN") {
      expect(r.reason).toBe("ROUTE_UNAVAILABLE");
      expect(r.unknown.toLowerCase()).toMatch(/straight-line is not/);
    }
  });
});

describe("Transport calculation · Yogyakarta ojol Zone I provisional", () => {
  it("returns a RANGE (min < max) with PROVISIONAL preface + unknown-note about live app", () => {
    const r = calculateTransportFareRange({
      route: okRoute(15000, 1800), // 15 km motorbike
      tariff: YOGYA_OJOL_ZONE_I_PROVISIONAL,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.fareRangeIdr.min).toBeLessThan(r.fareRangeIdr.max);
      // 15 km × Rp 1,850 = 27,750 lower · 15 km × Rp 2,300 = 34,500 upper
      expect(r.fareRangeIdr.min).toBeGreaterThanOrEqual(27000);
      expect(r.fareRangeIdr.max).toBeLessThanOrEqual(35000);
      expect(r.interpretation).toMatch(/^PROVISIONAL:/);
      expect(r.unknown.toLowerCase()).toMatch(/app quote may differ/);
      expect(r.provenance.tariffSourceTier).toBe("PROVISIONAL");
    }
  });

  it("respects minimum-fare band on very short trips", () => {
    // 500 m trip · per-km would be tiny · minimum-fare band should dominate
    const r = calculateTransportFareRange({
      route: okRoute(500, 90),
      tariff: YOGYA_OJOL_ZONE_I_PROVISIONAL,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      // Minimum-fare band is 9,250 – 11,500 · result must be at or above 9,250
      expect(r.fareRangeIdr.min).toBeGreaterThanOrEqual(9250);
      expect(r.fareRangeIdr.max).toBeGreaterThanOrEqual(11500);
    }
  });
});

describe("Transport calculation · UNKNOWN result never accidentally usable as a number", () => {
  it("UNKNOWN result does NOT carry fareRangeIdr", () => {
    const r = calculateTransportFareRange({ route: okRoute(15000, 1800), tariff: null });
    // TypeScript narrows this; runtime confirms
    expect(r).not.toHaveProperty("fareRangeIdr");
  });
});
