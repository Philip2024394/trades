// scripts/nex-acquisition/country-awareness.test.mjs
//
// Country Foundation Step 4 · Walker configs country-aware · 2026-08-22.
//
// Verifies (per Philip 2026-08-22 Step 4 acceptance criteria):
//   · Yogyakarta Walker → ID (both configs declare country: 'ID')
//   · country is never inferred from a city name (engine rejects configs without country)
//   · every new business row has an explicit valid ISO-2 country
//     (INSERT SQL includes country column + this.country value in both configs)
//   · no silent ID default exists (engine throws when country is missing/invalid)
//   · existing Food and Accommodation behaviour unchanged (config shape backward-compatible)
//
// Doctrine anchors:
//   project_nex_country_foundation_phased_plan_2026_08_22 (Step 4)
//   project_nex_truth_invariant_2026_08_22
//   project_nex_walker_stays_pure_acquisition_2026_08_22
//   project_nex_country_scope_from_phone_country_code_2026_08_22

import { describe, expect, it } from "vitest";
import { foodYogyakartaConfig } from "./configs/food-yogyakarta.mjs";
import { accommodationYogyakartaConfig } from "./configs/accommodation-yogyakarta.mjs";
import { runAgent } from "./engine.mjs";

describe("Country Foundation Step 4 · configs declare country explicitly", () => {
  it("foodYogyakartaConfig.country === 'ID'", () => {
    expect(foodYogyakartaConfig.country).toBe("ID");
  });

  it("accommodationYogyakartaConfig.country === 'ID'", () => {
    expect(accommodationYogyakartaConfig.country).toBe("ID");
  });

  it("both configs' country field matches ISO 3166-1 alpha-2 pattern", () => {
    expect(foodYogyakartaConfig.country).toMatch(/^[A-Z]{2}$/);
    expect(accommodationYogyakartaConfig.country).toMatch(/^[A-Z]{2}$/);
  });

  it("existing city fields preserved (regression · Yogyakarta unchanged)", () => {
    expect(foodYogyakartaConfig.city).toBe("Yogyakarta");
    expect(accommodationYogyakartaConfig.city).toBe("Yogyakarta");
  });

  it("country and city are distinct fields (country is NOT derived from city)", () => {
    // Sanity: country must be a truly separate value from city, not a substring or transform.
    expect(foodYogyakartaConfig.country).not.toBe(foodYogyakartaConfig.city);
    expect(accommodationYogyakartaConfig.country).not.toBe(accommodationYogyakartaConfig.city);
    // Country is not the first two letters of city uppercased ("YO" would be a bad silent default).
    expect(foodYogyakartaConfig.country).not.toBe(
      foodYogyakartaConfig.city.slice(0, 2).toUpperCase(),
    );
  });

  it("preserves all pre-Step-4 config fields (regression · Walker-pure-acquisition invariants)", () => {
    // Spot-check critical existing fields that must not have been accidentally altered.
    expect(foodYogyakartaConfig.vertical).toBe("food");
    expect(foodYogyakartaConfig.publicRefPrefix).toBe("#FL");
    expect(foodYogyakartaConfig.tables.business).toBe("nex.food_business");
    expect(typeof foodYogyakartaConfig.insertNewRecord).toBe("function");

    expect(accommodationYogyakartaConfig.vertical).toBe("accommodation");
    expect(accommodationYogyakartaConfig.publicRefPrefix).toBe("#AC");
    expect(accommodationYogyakartaConfig.tables.business).toBe("nex.accommodation_business");
    expect(typeof accommodationYogyakartaConfig.insertNewRecord).toBe("function");
  });
});

describe("Country Foundation Step 4 · engine rejects invalid country configs", () => {
  // Mock pool · engine MUST reject before any DB access (validation is first line of runAgent).
  const mockPool = {
    query: () => {
      throw new Error(
        "Test failure: pool.query was called — engine should reject invalid country BEFORE any DB access",
      );
    },
  };

  const opts = { smokeMode: true, dryRun: true };

  it("throws when config.country is undefined (no silent 'ID' default)", async () => {
    const badConfig = { ...foodYogyakartaConfig, country: undefined };
    await expect(runAgent(mockPool, badConfig, opts)).rejects.toThrow(/country is REQUIRED/i);
  });

  it("throws when config.country is null", async () => {
    const badConfig = { ...foodYogyakartaConfig, country: null };
    await expect(runAgent(mockPool, badConfig, opts)).rejects.toThrow(/country is REQUIRED/i);
  });

  it("throws when config.country is empty string", async () => {
    const badConfig = { ...foodYogyakartaConfig, country: "" };
    await expect(runAgent(mockPool, badConfig, opts)).rejects.toThrow(/country is REQUIRED/i);
  });

  it("throws when config.country is lowercase 'id' (must be UPPERCASE ISO-2)", async () => {
    const badConfig = { ...foodYogyakartaConfig, country: "id" };
    await expect(runAgent(mockPool, badConfig, opts)).rejects.toThrow(/country is REQUIRED/i);
  });

  it("throws when config.country is 3-letter ISO ('IDN' rejected · must be alpha-2)", async () => {
    const badConfig = { ...foodYogyakartaConfig, country: "IDN" };
    await expect(runAgent(mockPool, badConfig, opts)).rejects.toThrow(/country is REQUIRED/i);
  });

  it("throws when config.country is a full country name ('Indonesia')", async () => {
    const badConfig = { ...foodYogyakartaConfig, country: "Indonesia" };
    await expect(runAgent(mockPool, badConfig, opts)).rejects.toThrow(/country is REQUIRED/i);
  });

  it("throws when config.country contains digits", async () => {
    const badConfig = { ...foodYogyakartaConfig, country: "I1" };
    await expect(runAgent(mockPool, badConfig, opts)).rejects.toThrow(/country is REQUIRED/i);
  });

  it("throws when config.country is a number, not a string", async () => {
    const badConfig = { ...foodYogyakartaConfig, country: 62 };
    await expect(runAgent(mockPool, badConfig, opts)).rejects.toThrow(/country is REQUIRED/i);
  });

  it("error message names Country Foundation Step 4 doctrine", async () => {
    const badConfig = { ...foodYogyakartaConfig, country: undefined };
    await expect(runAgent(mockPool, badConfig, opts)).rejects.toThrow(
      /Country Foundation Step 4 doctrine/,
    );
  });

  it("error message explicitly says 'never inferred from city'", async () => {
    const badConfig = { ...foodYogyakartaConfig, country: undefined };
    await expect(runAgent(mockPool, badConfig, opts)).rejects.toThrow(/never inferred from city/i);
  });
});

describe("Country Foundation Step 4 · INSERT SQL propagates country to the DB", () => {
  // Static analysis of insertNewRecord.toString() — catches accidental removal
  // of the country column from either config's INSERT statement.

  it("food insertNewRecord source contains 'country' column reference", () => {
    const src = foodYogyakartaConfig.insertNewRecord.toString();
    expect(src).toContain("country");
  });

  it("food insertNewRecord source contains 'this.country' value binding", () => {
    const src = foodYogyakartaConfig.insertNewRecord.toString();
    expect(src).toContain("this.country");
  });

  it("accommodation insertNewRecord source contains 'country' column reference", () => {
    const src = accommodationYogyakartaConfig.insertNewRecord.toString();
    expect(src).toContain("country");
  });

  it("accommodation insertNewRecord source contains 'this.country' value binding", () => {
    const src = accommodationYogyakartaConfig.insertNewRecord.toString();
    expect(src).toContain("this.country");
  });

  it("food INSERT SQL does NOT contain any 'if (city ==' or 'city.toLowerCase' pattern that could infer country", () => {
    const src = foodYogyakartaConfig.insertNewRecord.toString();
    // Guard: no code path deriving country from city.
    expect(src).not.toMatch(/country\s*=\s*.*city/i);
    expect(src).not.toMatch(/city\s*===?\s*['"]Yogyakarta['"].*country/i);
  });

  it("accommodation INSERT SQL does NOT contain any 'if (city ==' or 'city.toLowerCase' pattern that could infer country", () => {
    const src = accommodationYogyakartaConfig.insertNewRecord.toString();
    expect(src).not.toMatch(/country\s*=\s*.*city/i);
    expect(src).not.toMatch(/city\s*===?\s*['"]Yogyakarta['"].*country/i);
  });
});
