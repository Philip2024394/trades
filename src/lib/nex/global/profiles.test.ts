// Country profiles — every supported country has a sensible profile.

import { describe, it, expect } from "vitest";
import { profileFor, supportedCountries } from "./profiles";
import type { CountryCode } from "../world/types";

describe("supportedCountries", () => {
  it("does NOT include 'unknown' in the choice list", () => {
    const codes = supportedCountries().map((c) => c.code);
    expect(codes).not.toContain("unknown");
  });
  it("covers UK, IE, AU, US, CA, NZ, AE", () => {
    const codes = supportedCountries().map((c) => c.code);
    for (const c of ["UK", "IE", "AU", "US", "CA", "NZ", "AE"] as CountryCode[]) {
      expect(codes).toContain(c);
    }
  });
});

describe("profileFor", () => {
  it("UK profile mentions Approved Documents link", () => {
    const p = profileFor("UK");
    expect(p.government_link.url).toContain("gov.uk");
    expect(p.trade_bodies.some((b) => b.name.includes("FMB") || b.name.includes("CITB"))).toBe(true);
  });

  it("IE profile flags BC(A)R + gov.ie", () => {
    const p = profileFor("IE");
    expect(p.government_link.url).toContain("gov.ie");
    expect(p.notes.some((n) => n.toLowerCase().includes("bc") || n.toLowerCase().includes("tgd"))).toBe(true);
  });

  it("AU profile mentions ABCB / NCC", () => {
    const p = profileFor("AU");
    expect(p.government_link.url).toContain("abcb.gov.au");
  });

  it("US profile flags state-by-state adoption + sales tax variance", () => {
    const p = profileFor("US");
    expect(p.notes.join(" ").toLowerCase()).toContain("state");
  });

  it("CA profile mentions Codes Canada + provincial variation", () => {
    const p = profileFor("CA");
    expect(p.government_link.url).toContain("nrc.canada.ca");
    expect(p.notes.join(" ").toLowerCase()).toContain("québec");
  });

  it("NZ profile links to building.govt.nz", () => {
    const p = profileFor("NZ");
    expect(p.government_link.url).toContain("building.govt.nz");
  });

  it("AE profile flags Dubai Municipality + emirate variance", () => {
    const p = profileFor("AE");
    expect(p.government_link.url).toContain("dm.gov.ae");
    expect(p.notes.join(" ").toLowerCase()).toContain("emirate");
  });

  it("unknown profile suppresses details + nudges to set country", () => {
    const p = profileFor("unknown");
    expect(p.typical_materials).toEqual([]);
    expect(p.notes[0].toLowerCase()).toContain("set your country");
  });
});
