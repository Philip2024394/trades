// derivePropertyId — stable, normalised, collision-safe.

import { describe, it, expect } from "vitest";
import { derivePropertyId } from "./types";

describe("derivePropertyId", () => {
  it("same input → same id", () => {
    expect(derivePropertyId("h1", "M25 1AB", "14 High Street"))
      .toBe(derivePropertyId("h1", "M25 1AB", "14 High Street"));
  });

  it("case-insensitive on postcode, case-lower on line", () => {
    expect(derivePropertyId("h1", "m25 1ab", "14 HIGH STREET"))
      .toBe(derivePropertyId("h1", "M251AB", "14 high street"));
  });

  it("different homeowner → different id even at same address", () => {
    expect(derivePropertyId("h1", "M25 1AB", "14 High Street"))
      .not.toBe(derivePropertyId("h2", "M25 1AB", "14 High Street"));
  });

  it("null postcode and null line still hashes stably", () => {
    expect(derivePropertyId("h1", null, null))
      .toBe(derivePropertyId("h1", null, null));
    expect(derivePropertyId("h1", null, null))
      .not.toBe(derivePropertyId("h1", "M25 1AB", null));
  });

  it("id has prop_ prefix + is short", () => {
    const id = derivePropertyId("h1", "M25", "14 High St");
    expect(id.startsWith("prop_")).toBe(true);
    expect(id.length).toBe(21);   // "prop_" (5) + 16 hex
  });
});
