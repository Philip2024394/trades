// Unit tests · hospitality persister pure helpers · Philip Phase 1.5 · 2026-08-27.
//
// Full end-to-end persistence path is verified via live walker runs; here we
// lock the pure functions (dedupe hash + ref generator) so a legacy regression
// on formula shape fails loudly instead of silently misclassifying dupes.

import { describe, it, expect } from "vitest";
import { computeDedupeHash, generatePublicRef } from "./_hospitality-persister.mjs";

describe("computeDedupeHash · MUST match legacy engine.mjs formula", () => {
  it("same inputs → same hash (idempotent)", () => {
    const a = computeDedupeHash({ name: "Warung A", address: "Jl. X 1", phone: "+62 812 3456 7890", lat: -6.2, lng: 106.8 });
    const b = computeDedupeHash({ name: "Warung A", address: "Jl. X 1", phone: "+62 812 3456 7890", lat: -6.2, lng: 106.8 });
    expect(a).toBe(b);
  });

  it("normalises name (lowercase · strip punctuation)", () => {
    const a = computeDedupeHash({ name: "Warung-A!!!", lat: -6.2, lng: 106.8 });
    const b = computeDedupeHash({ name: "warung a", lat: -6.2, lng: 106.8 });
    expect(a).toBe(b);
  });

  it("phone → last 6 digits only", () => {
    const a = computeDedupeHash({ name: "X", phone: "+62 812 3456 7890", lat: 0, lng: 0 });
    const b = computeDedupeHash({ name: "X", phone: "abc-3456-7890",       lat: 0, lng: 0 });
    expect(a).toBe(b);
  });

  it("coordinates rounded to 3 decimals", () => {
    const a = computeDedupeHash({ name: "X", lat: -6.20012, lng: 106.80099 });
    const b = computeDedupeHash({ name: "X", lat: -6.20038, lng: 106.80071 });
    expect(a).toBe(b);
  });

  it("different names produce different hashes", () => {
    const a = computeDedupeHash({ name: "A", lat: 0, lng: 0 });
    const b = computeDedupeHash({ name: "B", lat: 0, lng: 0 });
    expect(a).not.toBe(b);
  });

  it("null/undefined values are handled gracefully", () => {
    expect(() => computeDedupeHash({ name: null, address: undefined, phone: null, lat: null, lng: null })).not.toThrow();
  });
});

describe("generatePublicRef · Crockford + prefix per target table", () => {
  it("food_business → #FL-YYYY-XXXXX", () => {
    expect(generatePublicRef("nex.food_business", "some|dedupe|key"))
      .toMatch(/^#FL-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$/);
  });

  it("accommodation_business → #AC-YYYY-XXXXX", () => {
    expect(generatePublicRef("nex.accommodation_business", "some|dedupe|key"))
      .toMatch(/^#AC-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$/);
  });

  it("same dedupe hash → same ref (deterministic)", () => {
    const a = generatePublicRef("nex.food_business", "warung|jl|123456|-6.200|106.800");
    const b = generatePublicRef("nex.food_business", "warung|jl|123456|-6.200|106.800");
    expect(a).toBe(b);
  });

  it("different dedupe hashes → different refs", () => {
    const a = generatePublicRef("nex.food_business", "hash-A");
    const b = generatePublicRef("nex.food_business", "hash-B");
    expect(a).not.toBe(b);
  });

  it("unknown target table throws", () => {
    expect(() => generatePublicRef("nex.random_table", "x")).toThrow(/unknown target table/);
  });
});
