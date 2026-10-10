// src/lib/nex-native/directory/related-businesses/__tests__/relevance.test.ts
//
// NEX Directory · Related Businesses · pure relevance-map tests.
//
// Covers
//   · groupsForAnchor returns the sealed strip order for each anchor
//   · All weights are finite numbers in [0, 1]
//   · Deterministic (same input → same output across repeated calls)
//   · Exhaustive · every sealed entity_type returns a non-empty array
//   · rankScore + formatDistanceLabel pure-function behaviour
//
// This test file is environment-neutral: no "server-only" import, no DB
// access, no clock, no network, no randomness.

import { describe, expect, it } from "vitest";
import {
  groupsForAnchor,
  rankScore,
  formatDistanceLabel,
  type AnchorCategory,
} from "../relevance";
import type { EntityType } from "../../types";

const ALL_ANCHORS: readonly AnchorCategory[] = [
  "food",
  "accommodation",
  "service",
  "professional",
  "vehicle_rental",
  "marketplace_seller",
  "transport_driver",
  "transport_operator",
  "place",
] as const;

describe("groupsForAnchor · accommodation sealed order", () => {
  it("returns Rentals + Airport transfer + Food & drink + Laundry + Attractions in that order", () => {
    const g = groupsForAnchor("accommodation");
    expect(g.map((x) => x.label)).toEqual([
      "Rentals",
      "Airport transfer",
      "Food & drink",
      "Laundry",
      "Attractions",
    ]);
  });

  it("Rentals group targets vehicle_rental at weight 1.0", () => {
    const g = groupsForAnchor("accommodation");
    const rentals = g.find((x) => x.label === "Rentals");
    expect(rentals).toBeDefined();
    expect(rentals!.entityTypes).toEqual(["vehicle_rental"]);
    expect(rentals!.relevanceWeight).toBe(1.0);
  });

  it("Airport transfer targets transport_driver + transport_operator with airport_pickup tag", () => {
    const g = groupsForAnchor("accommodation");
    const airport = g.find((x) => x.label === "Airport transfer");
    expect(airport).toBeDefined();
    expect([...airport!.entityTypes].sort()).toEqual(
      ["transport_driver", "transport_operator"].sort(),
    );
    expect(airport!.subcategoryTags).toContain("airport_pickup");
    expect(airport!.relevanceWeight).toBe(1.0);
  });

  it("Food & drink is weight 0.9", () => {
    const g = groupsForAnchor("accommodation");
    const food = g.find((x) => x.label === "Food & drink");
    expect(food!.entityTypes).toEqual(["food"]);
    expect(food!.relevanceWeight).toBe(0.9);
  });

  it("Laundry targets service with category_slug 'laundry' at weight 0.8", () => {
    const g = groupsForAnchor("accommodation");
    const laundry = g.find((x) => x.label === "Laundry");
    expect(laundry!.entityTypes).toEqual(["service"]);
    expect(laundry!.categorySlugs).toEqual(["laundry"]);
    expect(laundry!.relevanceWeight).toBe(0.8);
  });

  it("Attractions targets place at weight 0.7", () => {
    const g = groupsForAnchor("accommodation");
    const attractions = g.find((x) => x.label === "Attractions");
    expect(attractions!.entityTypes).toEqual(["place"]);
    expect(attractions!.relevanceWeight).toBe(0.7);
  });
});

describe("groupsForAnchor · food sealed order", () => {
  it("returns Rentals (0.6) + Food & drink · more nearby (0.6) + Attractions (0.8)", () => {
    const g = groupsForAnchor("food");
    expect(g.map((x) => x.label)).toEqual([
      "Rentals",
      "Food & drink · more nearby",
      "Attractions",
    ]);
    const rentals = g.find((x) => x.label === "Rentals");
    expect(rentals!.entityTypes).toEqual(["vehicle_rental"]);
    expect(rentals!.relevanceWeight).toBe(0.6);
    const foodMore = g.find((x) => x.label === "Food & drink · more nearby");
    expect(foodMore!.entityTypes).toEqual(["food"]);
    expect(foodMore!.relevanceWeight).toBe(0.6);
    const attractions = g.find((x) => x.label === "Attractions");
    expect(attractions!.entityTypes).toEqual(["place"]);
    expect(attractions!.relevanceWeight).toBe(0.8);
  });
});

describe("groupsForAnchor · vehicle_rental sealed order", () => {
  it("returns Food & drink (0.9) + Accommodation (0.9) + Airport (0.8)", () => {
    const g = groupsForAnchor("vehicle_rental");
    expect(g.map((x) => x.label)).toEqual([
      "Food & drink",
      "Accommodation",
      "Airport",
    ]);
    expect(g[0].entityTypes).toEqual(["food"]);
    expect(g[0].relevanceWeight).toBe(0.9);
    expect(g[1].entityTypes).toEqual(["accommodation"]);
    expect(g[1].relevanceWeight).toBe(0.9);
    expect([...g[2].entityTypes].sort()).toEqual(
      ["transport_driver", "transport_operator"].sort(),
    );
    expect(g[2].relevanceWeight).toBe(0.8);
  });
});

describe("groupsForAnchor · exhaustive coverage of all sealed entity_types", () => {
  it("returns a non-empty array for every sealed anchor", () => {
    for (const anchor of ALL_ANCHORS) {
      const g = groupsForAnchor(anchor);
      expect(g.length).toBeGreaterThan(0);
    }
  });

  it("every returned group has a non-empty entityTypes array", () => {
    for (const anchor of ALL_ANCHORS) {
      const g = groupsForAnchor(anchor);
      for (const group of g) {
        expect(group.entityTypes.length).toBeGreaterThan(0);
      }
    }
  });

  it("every returned group's entityTypes are all sealed EntityType values", () => {
    const sealed = new Set<EntityType>([
      "food",
      "accommodation",
      "service",
      "professional",
      "vehicle_rental",
      "marketplace_seller",
      "transport_driver",
      "transport_operator",
      "place",
    ]);
    for (const anchor of ALL_ANCHORS) {
      const g = groupsForAnchor(anchor);
      for (const group of g) {
        for (const et of group.entityTypes) {
          expect(sealed.has(et)).toBe(true);
        }
      }
    }
  });
});

describe("groupsForAnchor · weight invariants (no fabrication)", () => {
  it("every weight is a finite number in [0, 1]", () => {
    for (const anchor of ALL_ANCHORS) {
      const g = groupsForAnchor(anchor);
      for (const group of g) {
        expect(Number.isFinite(group.relevanceWeight)).toBe(true);
        expect(group.relevanceWeight).toBeGreaterThanOrEqual(0);
        expect(group.relevanceWeight).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("groupsForAnchor · determinism", () => {
  it("returns the same group labels + weights on repeated calls", () => {
    for (const anchor of ALL_ANCHORS) {
      const first = groupsForAnchor(anchor);
      const firstSig = first.map((g) => `${g.label}:${g.relevanceWeight}`);
      for (let i = 0; i < 10; i++) {
        const next = groupsForAnchor(anchor);
        const nextSig = next.map((g) => `${g.label}:${g.relevanceWeight}`);
        expect(nextSig).toEqual(firstSig);
      }
    }
  });
});

describe("rankScore · pure proximity-weighted score", () => {
  it("returns weight when distance is 0", () => {
    expect(rankScore(0, 1.0)).toBe(1.0);
    expect(rankScore(0, 0.7)).toBe(0.7);
  });

  it("decreases as distance increases, holding weight constant", () => {
    const near = rankScore(100, 1.0);
    const mid = rankScore(500, 1.0);
    const far = rankScore(5000, 1.0);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  it("multiplies by weight at the same distance", () => {
    const full = rankScore(500, 1.0);
    const half = rankScore(500, 0.5);
    expect(half).toBeCloseTo(full * 0.5, 10);
  });

  it("clamps negative or non-finite distance to 0 metres (at-anchor)", () => {
    // The implementation treats a non-finite distance as "unknown ·
    // treat as at-anchor" so the row still appears in rank with its
    // full group weight · the alternative (silently push to the bottom)
    // would be a fabrication of a distance we don't know.
    expect(rankScore(-100, 1.0)).toBe(1.0);
    expect(rankScore(Number.NaN, 1.0)).toBe(1.0);
    expect(rankScore(Number.POSITIVE_INFINITY, 1.0)).toBe(1.0);
  });

  it("clamps weight outside [0,1] safely", () => {
    expect(rankScore(500, -0.5)).toBe(0);
    expect(rankScore(500, 2)).toBe(rankScore(500, 1));
  });
});

describe("formatDistanceLabel · pure human-readable distance", () => {
  it("renders metres under 1 km, rounded to nearest 10", () => {
    expect(formatDistanceLabel(0)).toBe("0 m");
    expect(formatDistanceLabel(5)).toBe("10 m");
    expect(formatDistanceLabel(44)).toBe("40 m");
    expect(formatDistanceLabel(45)).toBe("50 m");
    expect(formatDistanceLabel(350)).toBe("350 m");
    expect(formatDistanceLabel(999)).toBe("1000 m");
  });

  it("renders km with one decimal under 10 km", () => {
    expect(formatDistanceLabel(1000)).toBe("1.0 km");
    expect(formatDistanceLabel(1234)).toBe("1.2 km");
    expect(formatDistanceLabel(9500)).toBe("9.5 km");
  });

  it("renders km as integer at ≥ 10 km", () => {
    expect(formatDistanceLabel(10_000)).toBe("10 km");
    expect(formatDistanceLabel(12_400)).toBe("12 km");
    expect(formatDistanceLabel(100_000)).toBe("100 km");
  });

  it("renders empty string for negative or non-finite values (honest absence)", () => {
    expect(formatDistanceLabel(-1)).toBe("");
    expect(formatDistanceLabel(Number.NaN)).toBe("");
    expect(formatDistanceLabel(Number.POSITIVE_INFINITY)).toBe("");
  });
});
