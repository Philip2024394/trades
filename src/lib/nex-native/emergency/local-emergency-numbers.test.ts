// src/lib/nex-native/emergency/local-emergency-numbers.test.ts

import { describe, expect, it } from "vitest";

import {
  INTERNATIONAL_FALLBACK,
  LOCAL_EMERGENCY_NUMBERS,
  resolveEmergencyNumber,
} from "./local-emergency-numbers";

describe("LOCAL_EMERGENCY_NUMBERS · shape", () => {
  it("seeds at least 20 countries (founder spec)", () => {
    expect(Object.keys(LOCAL_EMERGENCY_NUMBERS).length).toBeGreaterThanOrEqual(20);
  });

  it("every entry has a non-empty generalNumber", () => {
    for (const [code, entry] of Object.entries(LOCAL_EMERGENCY_NUMBERS)) {
      expect(entry.generalNumber, `generalNumber for ${code}`).toBeTruthy();
      expect(entry.generalNumber.trim()).toBe(entry.generalNumber);
    }
  });

  it("every key equals its row's countryCode (keys are canonical)", () => {
    for (const [code, entry] of Object.entries(LOCAL_EMERGENCY_NUMBERS)) {
      expect(entry.countryCode).toBe(code);
    }
  });

  it("every key is upper-case ISO alpha-2", () => {
    for (const code of Object.keys(LOCAL_EMERGENCY_NUMBERS)) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("every entry has a non-empty countryName", () => {
    for (const [code, entry] of Object.entries(LOCAL_EMERGENCY_NUMBERS)) {
      expect(entry.countryName, `countryName for ${code}`).toBeTruthy();
    }
  });
});

describe("resolveEmergencyNumber · known countries", () => {
  it("Indonesia → generalNumber 112, policeNumber 110", () => {
    const r = resolveEmergencyNumber("ID");
    expect(r.countryCode).toBe("ID");
    expect(r.generalNumber).toBe("112");
    expect(r.policeNumber).toBe("110");
  });

  it("United States → 911", () => {
    expect(resolveEmergencyNumber("US").generalNumber).toBe("911");
  });

  it("Australia → 000", () => {
    expect(resolveEmergencyNumber("AU").generalNumber).toBe("000");
  });

  it("United Kingdom → 999", () => {
    expect(resolveEmergencyNumber("GB").generalNumber).toBe("999");
  });

  it("New Zealand → 111", () => {
    expect(resolveEmergencyNumber("NZ").generalNumber).toBe("111");
  });

  it("Japan → policeNumber 110, ambulanceNumber 119", () => {
    const r = resolveEmergencyNumber("JP");
    expect(r.policeNumber).toBe("110");
    expect(r.ambulanceNumber).toBe("119");
  });

  it("Thailand → policeNumber 191, ambulanceNumber 1669", () => {
    const r = resolveEmergencyNumber("TH");
    expect(r.policeNumber).toBe("191");
    expect(r.ambulanceNumber).toBe("1669");
  });

  it("South Africa → 10111 (five-digit police line)", () => {
    expect(resolveEmergencyNumber("ZA").generalNumber).toBe("10111");
  });

  it("France → generalNumber 112, policeNumber 17", () => {
    const r = resolveEmergencyNumber("FR");
    expect(r.generalNumber).toBe("112");
    expect(r.policeNumber).toBe("17");
  });

  it("Germany → generalNumber 112, policeNumber 110", () => {
    const r = resolveEmergencyNumber("DE");
    expect(r.generalNumber).toBe("112");
    expect(r.policeNumber).toBe("110");
  });
});

describe("resolveEmergencyNumber · case insensitivity", () => {
  it("accepts lower-case alpha-2", () => {
    expect(resolveEmergencyNumber("id").countryCode).toBe("ID");
  });

  it("accepts mixed-case alpha-2", () => {
    expect(resolveEmergencyNumber("gB").countryCode).toBe("GB");
  });

  it("trims leading/trailing whitespace", () => {
    expect(resolveEmergencyNumber("  us  ").countryCode).toBe("US");
  });
});

describe("resolveEmergencyNumber · fallback", () => {
  it("unknown country → international fallback (112)", () => {
    const r = resolveEmergencyNumber("XX");
    expect(r).toEqual(INTERNATIONAL_FALLBACK);
    expect(r.generalNumber).toBe("112");
  });

  it("null → international fallback", () => {
    expect(resolveEmergencyNumber(null).generalNumber).toBe("112");
  });

  it("undefined → international fallback", () => {
    expect(resolveEmergencyNumber(undefined).generalNumber).toBe("112");
  });

  it("empty string → international fallback", () => {
    expect(resolveEmergencyNumber("").generalNumber).toBe("112");
  });

  it("whitespace-only → international fallback", () => {
    expect(resolveEmergencyNumber("   ").generalNumber).toBe("112");
  });

  it("non-ISO garbage (e.g. a lat/lng mistake) → international fallback", () => {
    expect(resolveEmergencyNumber("not-a-country").generalNumber).toBe("112");
  });

  it("INTERNATIONAL_FALLBACK itself is a usable row (ZZ pseudo-code)", () => {
    expect(INTERNATIONAL_FALLBACK.countryCode).toBe("ZZ");
    expect(INTERNATIONAL_FALLBACK.generalNumber).toBe("112");
  });
});

describe("resolveEmergencyNumber · never throws", () => {
  // The UI calls this on every render; it MUST be total.
  const inputs: Array<string | null | undefined> = [
    null, undefined, "", " ", "ID", "us", "ZZ", "FOO", "12", "😀", "a".repeat(100),
  ];
  for (const i of inputs) {
    it(`totally returns a row for input=${JSON.stringify(i)}`, () => {
      expect(() => resolveEmergencyNumber(i)).not.toThrow();
      const r = resolveEmergencyNumber(i);
      expect(r.generalNumber).toBeTruthy();
    });
  }
});
