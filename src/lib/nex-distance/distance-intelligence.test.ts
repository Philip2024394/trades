// src/lib/nex-distance/distance-intelligence.test.ts
//
// Distance Intelligence bright-line tests. The rule enforced by these tests:
//
//   Straight-line distance is NEVER returned as a routed answer.
//   No provider → UNAVAILABLE. All providers failed → UNAVAILABLE.

import { describe, it, expect, beforeEach } from "vitest";
import {
  routeBetween,
  registerDistanceProvider,
  _resetDistanceProviders,
  straightLineDistanceMeters,
  type DistanceProvider,
} from "./distance-intelligence";

const A = { lat: -7.7828, lng: 110.3671 }; // Malioboro
const B = { lat: -7.7521, lng: 110.4914 }; // Prambanan

beforeEach(() => _resetDistanceProviders());

describe("Distance Intelligence · no provider ever means UNAVAILABLE (never straight-line)", () => {
  it("returns UNAVAILABLE with NO_PROVIDER when no providers are registered", async () => {
    const r = await routeBetween({ from: A, to: B, mode: "walking" });
    expect(r.status).toBe("UNAVAILABLE");
    if (r.status === "UNAVAILABLE") {
      expect(r.reason).toBe("NO_PROVIDER");
      expect(r.providersTried).toEqual([]);
      // Straight-line included ONLY for QA labelling · never as a routed answer
      expect(r.straightLineDistanceMeters).toBeGreaterThan(0);
    }
  });

  it("returns UNAVAILABLE when every provider throws", async () => {
    const failing: DistanceProvider = {
      name: "test-failing",
      supports: () => true,
      route: async () => {
        throw new Error("boom");
      },
    };
    registerDistanceProvider(failing);

    const r = await routeBetween({ from: A, to: B, mode: "walking" });
    expect(r.status).toBe("UNAVAILABLE");
    if (r.status === "UNAVAILABLE") {
      expect(r.reason).toBe("PROVIDER_FAILED");
      expect(r.providersTried).toContain("test-failing");
    }
  });
});

describe("Distance Intelligence · a working provider returns a routed answer with provenance", () => {
  it("returns OK when the provider succeeds · provenance intact", async () => {
    const working: DistanceProvider = {
      name: "test-working",
      supports: (m) => m === "walking",
      route: async (req) => ({
        status: "OK",
        mode: req.mode,
        from: req.from,
        to: req.to,
        routedDistanceMeters: 15000,
        routedDurationSeconds: 12000,
        straightLineDistanceMeters: straightLineDistanceMeters(req.from, req.to),
        provider: "test-working",
        providerReference: "trip-abc",
        capturedAt: new Date("2026-08-23T00:00:00Z"),
        freshnessValidUntil: null,
        provenance: { engine: "test", version: "0.0.0" },
      }),
    };
    registerDistanceProvider(working);

    const r = await routeBetween({ from: A, to: B, mode: "walking" });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.routedDistanceMeters).toBe(15000);
      expect(r.routedDurationSeconds).toBe(12000);
      expect(r.provider).toBe("test-working");
      expect(r.providerReference).toBe("trip-abc");
      // Straight-line should be LESS than routed for a realistic route
      expect(r.straightLineDistanceMeters).toBeLessThan(r.routedDistanceMeters);
    }
  });
});

describe("Distance Intelligence · straight-line helper is honest about what it is", () => {
  it("computes haversine distance in metres · not a walkable distance", () => {
    const d = straightLineDistanceMeters(A, B);
    // Malioboro → Prambanan is roughly ~14 km straight-line
    expect(d).toBeGreaterThan(13000);
    expect(d).toBeLessThan(16000);
  });
});
