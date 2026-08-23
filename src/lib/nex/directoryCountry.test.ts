// Country Foundation Step 5 · directory country normaliser tests · 2026-08-22.
//
// Doctrine anchors:
//   project_nex_country_foundation_phased_plan_2026_08_22 (Step 5)
//   project_nex_country_scope_from_phone_country_code_2026_08_22
//   project_nex_truth_invariant_2026_08_22

import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MARKET, normalizeDirectoryCountry } from "./directoryCountry";

describe("normalizeDirectoryCountry · defaults", () => {
  it("DEFAULT_MARKET is 'ID' (all current inventory is Yogyakarta)", () => {
    expect(DEFAULT_MARKET).toBe("ID");
  });

  it("returns DEFAULT_MARKET for undefined", () => {
    expect(normalizeDirectoryCountry(undefined)).toBe(DEFAULT_MARKET);
  });

  it("returns DEFAULT_MARKET for null", () => {
    expect(normalizeDirectoryCountry(null)).toBe(DEFAULT_MARKET);
  });
});

describe("normalizeDirectoryCountry · valid ISO-2 pass-through", () => {
  it("returns 'ID' verbatim", () => {
    expect(normalizeDirectoryCountry("ID")).toBe("ID");
  });

  it("returns 'GB' verbatim (valid even though no inventory — Truth Invariant: never silently swap)", () => {
    expect(normalizeDirectoryCountry("GB")).toBe("GB");
  });

  it("returns 'US' verbatim", () => {
    expect(normalizeDirectoryCountry("US")).toBe("US");
  });

  it("takes the first element from string[] (Next.js repeated params)", () => {
    expect(normalizeDirectoryCountry(["GB", "US"])).toBe("GB");
  });
});

describe("normalizeDirectoryCountry · invalid input silently falls back to 'ID' with warning", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    warnSpy?.mockRestore();
  });

  function spyWarn() {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  }

  it("lowercase 'id' → 'ID' + warning", () => {
    spyWarn();
    expect(normalizeDirectoryCountry("id")).toBe(DEFAULT_MARKET);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("3-letter 'IDN' → 'ID' + warning", () => {
    spyWarn();
    expect(normalizeDirectoryCountry("IDN")).toBe(DEFAULT_MARKET);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("full country name 'Indonesia' → 'ID' + warning", () => {
    spyWarn();
    expect(normalizeDirectoryCountry("Indonesia")).toBe(DEFAULT_MARKET);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("digits 'I1' → 'ID' + warning", () => {
    spyWarn();
    expect(normalizeDirectoryCountry("I1")).toBe(DEFAULT_MARKET);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("empty string → 'ID' + warning", () => {
    spyWarn();
    expect(normalizeDirectoryCountry("")).toBe(DEFAULT_MARKET);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("SQL-injection attempt → 'ID' + warning", () => {
    spyWarn();
    expect(normalizeDirectoryCountry("' OR 1=1 --")).toBe(DEFAULT_MARKET);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("XSS attempt → 'ID' + warning", () => {
    spyWarn();
    expect(normalizeDirectoryCountry("<script>")).toBe(DEFAULT_MARKET);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("non-string primitives → 'ID' + warning", () => {
    spyWarn();
    expect(normalizeDirectoryCountry(42)).toBe(DEFAULT_MARKET);
    expect(normalizeDirectoryCountry(true)).toBe(DEFAULT_MARKET);
    expect(normalizeDirectoryCountry({})).toBe(DEFAULT_MARKET);
  });

  it("warning message names the offending value", () => {
    spyWarn();
    normalizeDirectoryCountry("BOGUS");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("BOGUS"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'ID'"));
  });
});
