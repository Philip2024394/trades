// src/app/nex-native/directory/__tests__/distance.test.ts
//
// NEX Directory · Phase A · Pure Haversine helper tests.
//
// Covers
//   · haversineKm agrees with known reference distances
//   · same-point → 0
//   · symmetric (A→B === B→A)
//   · antipodal upper bound is sane (≈ 20015 km on a 6371 km sphere)
//   · haversineKmOrNull returns null when either side is null
//   · formatKmDistance renders metres / 1-decimal km / integer km
//   · formatKmDistance rejects non-finite / negative

import { describe, expect, it } from "vitest";
import {
  EARTH_MEAN_RADIUS_KM,
  formatKmDistance,
  haversineKm,
  haversineKmOrNull,
} from "../_distance";

const JAKARTA = { lat: -6.2088, lng: 106.8456 };
const YOGYAKARTA = { lat: -7.7956, lng: 110.3695 };
const DENPASAR = { lat: -8.6705, lng: 115.2126 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };

// ═════════════════════════════════════════════════════════════════════
// §1 · haversineKm · known reference distances
// ═════════════════════════════════════════════════════════════════════

describe("haversineKm · known distances", () => {
  it("Jakarta → Yogyakarta is ~430 km", () => {
    const km = haversineKm(JAKARTA, YOGYAKARTA);
    expect(km).toBeGreaterThan(420);
    expect(km).toBeLessThan(440);
  });

  it("Yogyakarta → Denpasar is ~540 km", () => {
    const km = haversineKm(YOGYAKARTA, DENPASAR);
    expect(km).toBeGreaterThan(520);
    expect(km).toBeLessThan(560);
  });

  it("London → Sydney is ~17000 km", () => {
    const km = haversineKm(LONDON, SYDNEY);
    expect(km).toBeGreaterThan(16500);
    expect(km).toBeLessThan(17500);
  });

  it("uses EARTH_MEAN_RADIUS_KM = 6371", () => {
    expect(EARTH_MEAN_RADIUS_KM).toBe(6371);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · haversineKm · algebraic properties
// ═════════════════════════════════════════════════════════════════════

describe("haversineKm · algebraic properties", () => {
  it("same-point distance is 0", () => {
    expect(haversineKm(YOGYAKARTA, YOGYAKARTA)).toBe(0);
  });

  it("very-close points (same street) are < 0.5 km", () => {
    const near = { lat: YOGYAKARTA.lat + 0.001, lng: YOGYAKARTA.lng + 0.001 };
    const km = haversineKm(YOGYAKARTA, near);
    expect(km).toBeGreaterThan(0);
    expect(km).toBeLessThan(0.5);
  });

  it("is symmetric · haversineKm(A,B) === haversineKm(B,A)", () => {
    const ab = haversineKm(JAKARTA, YOGYAKARTA);
    const ba = haversineKm(YOGYAKARTA, JAKARTA);
    expect(Math.abs(ab - ba)).toBeLessThan(1e-9);
  });

  it("antipodal pair distance is bounded by π · R", () => {
    const antipodeOfJakarta = {
      lat: -JAKARTA.lat,
      lng: JAKARTA.lng + 180,
    };
    const km = haversineKm(JAKARTA, antipodeOfJakarta);
    expect(km).toBeGreaterThan(Math.PI * EARTH_MEAN_RADIUS_KM - 10);
    expect(km).toBeLessThan(Math.PI * EARTH_MEAN_RADIUS_KM + 1);
  });

  it("output is non-negative for any inputs", () => {
    for (let i = 0; i < 20; i++) {
      const a = { lat: 90 - 180 * (i / 20), lng: -180 + 360 * (i / 20) };
      const b = { lat: -90 + 180 * (i / 20), lng: 180 - 360 * (i / 20) };
      expect(haversineKm(a, b)).toBeGreaterThanOrEqual(0);
    }
  });

  it("is deterministic · same input → same output byte-stable", () => {
    const first = haversineKm(JAKARTA, YOGYAKARTA);
    for (let i = 0; i < 20; i++) {
      expect(haversineKm(JAKARTA, YOGYAKARTA)).toBe(first);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · haversineKmOrNull · nullable form
// ═════════════════════════════════════════════════════════════════════

describe("haversineKmOrNull · null handling", () => {
  it("returns null when `from` is null", () => {
    expect(haversineKmOrNull(null, YOGYAKARTA)).toBe(null);
  });

  it("returns null when `to` is null", () => {
    expect(haversineKmOrNull(YOGYAKARTA, null)).toBe(null);
  });

  it("returns null when both are null", () => {
    expect(haversineKmOrNull(null, null)).toBe(null);
  });

  it("delegates to haversineKm when both are present", () => {
    expect(haversineKmOrNull(JAKARTA, YOGYAKARTA)).toBe(
      haversineKm(JAKARTA, YOGYAKARTA),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · formatKmDistance
// ═════════════════════════════════════════════════════════════════════

describe("formatKmDistance", () => {
  it("renders values under 1 km in rounded 10-metre units", () => {
    expect(formatKmDistance(0.3)).toBe("300 m");
    expect(formatKmDistance(0.325)).toBe("330 m");
    expect(formatKmDistance(0.001)).toBe("0 m");
    expect(formatKmDistance(0.995)).toBe("1000 m");
  });

  it("renders values ≥ 1 km and < 10 km with one decimal", () => {
    expect(formatKmDistance(1)).toBe("1.0 km");
    expect(formatKmDistance(2.4)).toBe("2.4 km");
    expect(formatKmDistance(9.9)).toBe("9.9 km");
  });

  it("renders values ≥ 10 km as integer km", () => {
    expect(formatKmDistance(10)).toBe("10 km");
    expect(formatKmDistance(17.4)).toBe("17 km");
    expect(formatKmDistance(430)).toBe("430 km");
  });

  it("exactly 0 renders as 0 m (not fabricated)", () => {
    expect(formatKmDistance(0)).toBe("0 m");
  });

  it("rejects non-finite inputs (returns null)", () => {
    expect(formatKmDistance(Number.NaN)).toBe(null);
    expect(formatKmDistance(Number.POSITIVE_INFINITY)).toBe(null);
    expect(formatKmDistance(Number.NEGATIVE_INFINITY)).toBe(null);
  });

  it("rejects negative inputs (returns null, no fabricated absolute value)", () => {
    expect(formatKmDistance(-1)).toBe(null);
    expect(formatKmDistance(-100)).toBe(null);
  });

  it("is deterministic", () => {
    const first = formatKmDistance(2.4);
    for (let i = 0; i < 10; i++) {
      expect(formatKmDistance(2.4)).toBe(first);
    }
  });
});
