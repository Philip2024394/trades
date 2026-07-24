// Terminology — regional word swaps.

import { describe, it, expect } from "vitest";
import { localize, localTerm } from "./terminology";

describe("localize", () => {
  it("UK: leaves standard terms unchanged (UK IS the standard)", () => {
    expect(localize("Order 20 plasterboards for the loft.", "UK")).toBe("Order 20 plasterboards for the loft.");
  });

  it("US: plasterboard → drywall, loft → attic", () => {
    const out = localize("Order 20 plasterboards for the loft.", "US");
    expect(out).toContain("drywall");
    expect(out).toContain("attic");
  });

  it("CA: skirting → baseboard, plasterboard → drywall", () => {
    const out = localize("Fit skirting after plasterboard.", "CA");
    expect(out).toContain("baseboard");
    expect(out).toContain("drywall");
  });

  it("AU: block paving → pavers, loft → attic", () => {
    const out = localize("Lay block paving; use loft for storage.", "AU");
    expect(out.toLowerCase()).toContain("pavers");
    expect(out.toLowerCase()).toContain("attic");
  });

  it("preserves initial capitalisation of the matched word", () => {
    const out = localize("Plasterboard first, then skim.", "US");
    expect(out.startsWith("Drywall")).toBe(true);
  });

  it("unknown country returns text as-is", () => {
    expect(localize("plasterboard on the loft", "unknown")).toBe("plasterboard on the loft");
  });
});

describe("localTerm", () => {
  it("returns the local term when mapped", () => {
    expect(localTerm("plasterboard", "US")).toBe("drywall");
    expect(localTerm("loft", "AU")).toBe("attic");
    expect(localTerm("hob", "AU")).toBe("cooktop");
  });
  it("returns the standard when no mapping for that country", () => {
    expect(localTerm("plasterboard", "UK")).toBe("plasterboard");
    expect(localTerm("something-unmapped", "US")).toBe("something-unmapped");
  });
});
