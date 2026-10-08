// src/lib/nex-native/directory/__tests__/directory-classification.test.ts
//
// NEX Directory · Phase B · classifyEntityType tests.
//
// Covers
//   · Each of the 9 sealed entity_types maps to exactly one classification
//   · The three sealed sets are disjoint and their union is the sealed 9
//   · classification is a pure function (same input → same output)
//
// This file does NOT:
//   · Import "server-only" (classifier is environment-neutral)
//   · Touch the DB, network, filesystem, clock, or randomness

import { describe, expect, it } from "vitest";
import {
  BUSINESS_ENTITY_TYPES,
  PERSON_ENTITY_TYPES,
  PLACE_ENTITY_TYPES,
  classifyEntityType,
} from "../classify-entity-type";
import type { EntityType, DirectoryClassification } from "../types";

/** The full sealed set — kept in-sync with migration 167 ck_bc_entity_type. */
const ALL_ENTITY_TYPES: readonly EntityType[] = [
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

describe("classifyEntityType · one-to-one coverage of the sealed 9 entity_types", () => {
  const EXPECTED: ReadonlyArray<[EntityType, DirectoryClassification]> = [
    ["food", "business"],
    ["accommodation", "business"],
    ["service", "business"],
    ["vehicle_rental", "business"],
    ["marketplace_seller", "business"],
    ["transport_operator", "business"],
    ["professional", "person"],
    ["transport_driver", "person"],
    ["place", "place"],
  ];

  for (const [et, expected] of EXPECTED) {
    it(`${et} → ${expected}`, () => {
      expect(classifyEntityType(et)).toBe(expected);
    });
  }
});

describe("sealed classification sets", () => {
  it("BUSINESS set has the exact 6 sealed business entity_types", () => {
    expect([...BUSINESS_ENTITY_TYPES].sort()).toEqual(
      [
        "accommodation",
        "food",
        "marketplace_seller",
        "service",
        "transport_operator",
        "vehicle_rental",
      ].sort(),
    );
  });

  it("PERSON set has the exact 2 sealed person entity_types", () => {
    expect([...PERSON_ENTITY_TYPES].sort()).toEqual(
      ["professional", "transport_driver"].sort(),
    );
  });

  it("PLACE set has the exact 1 sealed place entity_type", () => {
    expect([...PLACE_ENTITY_TYPES]).toEqual(["place"]);
  });

  it("the three sets are pairwise disjoint", () => {
    const b = new Set(BUSINESS_ENTITY_TYPES);
    const p = new Set(PERSON_ENTITY_TYPES);
    const pl = new Set(PLACE_ENTITY_TYPES);
    for (const et of BUSINESS_ENTITY_TYPES) {
      expect(p.has(et)).toBe(false);
      expect(pl.has(et)).toBe(false);
    }
    for (const et of PERSON_ENTITY_TYPES) {
      expect(b.has(et)).toBe(false);
      expect(pl.has(et)).toBe(false);
    }
    for (const et of PLACE_ENTITY_TYPES) {
      expect(b.has(et)).toBe(false);
      expect(p.has(et)).toBe(false);
    }
  });

  it("the three sets' union equals the sealed 9 entity_types", () => {
    const union = new Set<EntityType>([
      ...BUSINESS_ENTITY_TYPES,
      ...PERSON_ENTITY_TYPES,
      ...PLACE_ENTITY_TYPES,
    ]);
    expect(union.size).toBe(ALL_ENTITY_TYPES.length);
    for (const et of ALL_ENTITY_TYPES) {
      expect(union.has(et)).toBe(true);
    }
  });

  it("every classification set is consistent with classifyEntityType", () => {
    for (const et of BUSINESS_ENTITY_TYPES) {
      expect(classifyEntityType(et)).toBe("business");
    }
    for (const et of PERSON_ENTITY_TYPES) {
      expect(classifyEntityType(et)).toBe("person");
    }
    for (const et of PLACE_ENTITY_TYPES) {
      expect(classifyEntityType(et)).toBe("place");
    }
  });
});

describe("classifyEntityType · determinism", () => {
  it("returns the same classification on repeated calls with the same input", () => {
    for (const et of ALL_ENTITY_TYPES) {
      const first = classifyEntityType(et);
      for (let i = 0; i < 20; i++) {
        expect(classifyEntityType(et)).toBe(first);
      }
    }
  });

  it("does not mutate its input (strings are primitives but check reference stability)", () => {
    const input: EntityType = "food";
    const originalLen = (input as string).length;
    classifyEntityType(input);
    expect((input as string).length).toBe(originalLen);
    expect(input).toBe("food");
  });
});

describe("classifyEntityType · runtime safety (defence in depth)", () => {
  it("throws loudly when called with a value outside the sealed enum", () => {
    // Deliberate `as EntityType` cast — simulates the only way this
    // could happen in production: a future migration added a new
    // entity_type without updating the classifier. We want a loud
    // error, not a silent misclassification.
    const bogus = "spaceship" as unknown as EntityType;
    expect(() => classifyEntityType(bogus)).toThrowError(
      /unmapped entity_type/,
    );
  });
});
