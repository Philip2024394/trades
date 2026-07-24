// Haversine — pure function.

import { describe, it, expect } from "vitest";
import { haversineKm } from "./directory";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(53.48, -2.24, 53.48, -2.24)).toBe(0);
  });
  it("computes a sensible distance for Manchester → Liverpool (~50km)", () => {
    const km = haversineKm(53.4808, -2.2426, 53.4084, -2.9916);
    expect(km).toBeGreaterThan(40);
    expect(km).toBeLessThan(60);
  });
});
