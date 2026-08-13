// Nex Booker · compliance reader tests.
//
// Uses mock bundles (not the store) so tests are fast and deterministic.
// Covers all 4 jurisdictions from the seeded compliance packages.

import { describe, expect, it } from "vitest";
import { ComplianceReaderError, makeReader } from "./compliance";
import type { NexBkComplianceBundle } from "./types";

// ── Fixtures ────────────────────────────────────────────────────────

function mkPackage(overrides: Partial<NexBkComplianceBundle["package"]> = {}): NexBkComplianceBundle["package"] {
  return {
    id: "pkg-1",
    country_code: "GB",
    state_code: null,
    version: "1.1.0",
    effective_from: "2026-08-06",
    effective_to: null,
    last_verified_at: "2026-08-06T00:00:00Z",
    source_urls: ["https://www.gov.uk/vat-rates"],
    release_notes: null,
    created_at: "2026-08-06T00:00:00Z",
    ...overrides,
  };
}

const UK_RULES = {
  vat_standard_rate: 0.20,
  vat_reduced_rate: 0.05,
  vat_zero_rate: 0.00,
  vat_registration_threshold_gbp: 90000,
  vat_deregistration_threshold_gbp: 88000,
  vat_return_frequency_default: "quarterly",
  mtd_vat_required: true,
  mtd_vat_exemption_grounds: ["insolvency", "age_or_health_or_disability"],
  vat_record_retention_years: 6,
  personal_tax_year_start: { month: 4, day: 6 },
  corporation_tax_small_profits_rate: { rate: 0.19, upper_threshold_gbp: 50000 },
  currency_code: "GBP",
  currency_symbol: "£",
  authority_name: "HM Revenue & Customs",
  authority_abbreviation: "HMRC",
};

const IE_RULES = {
  vat_standard_rate: 0.23,
  vat_reduced_rate: 0.135,
  vat_second_reduced_rate: 0.09,
  vat_livestock_rate: 0.048,
  vat_zero_rate: 0.00,
  vat_threshold_goods_eur: 85000,
  vat_threshold_services_eur: 42500,
  record_retention_years: 6,
  currency_code: "EUR",
  currency_symbol: "€",
  authority_name: "Office of the Revenue Commissioners",
  authority_abbreviation: "Revenue",
};

const AU_RULES = {
  gst_standard_rate: 0.10,
  gst_registration_threshold_standard_aud: 75000,
  gst_registration_threshold_nonprofit_aud: 150000,
  super_guarantee_rate: 0.12,
  record_retention_years: 5,
  currency_code: "AUD",
  currency_symbol: "$",
  authority_name: "Australian Taxation Office",
  authority_abbreviation: "ATO",
};

const US_RULES = {
  self_employment_tax_rate: 0.153,
  social_security_wage_base_2026: 184500,
  form_1099_nec_threshold_2026: 2000,
  record_retention_general_years: 3,
  record_retention_employment_tax_years: 4,
  currency_code: "USD",
  currency_symbol: "$",
  authority_name: "Internal Revenue Service",
  authority_abbreviation: "IRS",
};

// ── Generic accessors ──────────────────────────────────────────────

describe("compliance reader · generic accessors", () => {
  const reader = makeReader({ package: mkPackage(), rules: UK_RULES });

  it("getRate returns rates", () => {
    expect(reader.getRate("vat_standard_rate")).toBe(0.20);
    expect(reader.getRate("vat_reduced_rate")).toBe(0.05);
    expect(reader.getRate("vat_zero_rate")).toBe(0.00);
  });

  it("getRate throws when value looks like a percentage not a rate", () => {
    const badReader = makeReader({
      package: mkPackage(),
      rules: { ...UK_RULES, some_pct: 20 as unknown as number },
    });
    expect(() => badReader.getRate("some_pct")).toThrow(/not a rate/);
  });

  it("getMoneyAmount returns money amounts", () => {
    expect(reader.getMoneyAmount("vat_registration_threshold_gbp")).toBe(90000);
    expect(reader.getMoneyAmount("vat_deregistration_threshold_gbp")).toBe(88000);
  });

  it("getMoneyAmount throws on negative values", () => {
    const badReader = makeReader({
      package: mkPackage(),
      rules: { ...UK_RULES, neg: -100 as unknown as number },
    });
    expect(() => badReader.getMoneyAmount("neg")).toThrow(/negative/);
  });

  it("getInteger returns integers, throws on decimals", () => {
    expect(reader.getInteger("vat_record_retention_years")).toBe(6);
    const badReader = makeReader({
      package: mkPackage(),
      rules: { ...UK_RULES, half: 2.5 as unknown as number },
    });
    expect(() => badReader.getInteger("half")).toThrow(/expected integer/);
  });

  it("getString returns strings", () => {
    expect(reader.getString("authority_name")).toBe("HM Revenue & Customs");
    expect(reader.getString("currency_code")).toBe("GBP");
  });

  it("getBool returns booleans", () => {
    expect(reader.getBool("mtd_vat_required")).toBe(true);
  });

  it("getObject returns objects", () => {
    const cy = reader.getObject<{ month: number; day: number }>("personal_tax_year_start");
    expect(cy.month).toBe(4);
    expect(cy.day).toBe(6);
  });

  it("getObject throws on arrays", () => {
    expect(() => reader.getObject("mtd_vat_exemption_grounds")).toThrow(/expected object/);
  });

  it("getStringArray returns arrays of strings", () => {
    const grounds = reader.getStringArray("mtd_vat_exemption_grounds");
    expect(grounds).toContain("insolvency");
    expect(grounds).toHaveLength(2);
  });

  it("has() checks presence without throwing", () => {
    expect(reader.has("vat_standard_rate")).toBe(true);
    expect(reader.has("bogus_key")).toBe(false);
  });

  it("required accessors throw ComplianceReaderError with rule_key", () => {
    try {
      reader.getRate("nonexistent_rate");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ComplianceReaderError);
      expect((err as ComplianceReaderError).code).toBe("rule_missing");
      expect((err as ComplianceReaderError).rule_key).toBe("nonexistent_rate");
    }
  });

  it("tryGet* variants return undefined on missing keys", () => {
    expect(reader.tryGetRate("missing")).toBeUndefined();
    expect(reader.tryGetMoneyAmount("missing")).toBeUndefined();
    expect(reader.tryGetString("missing")).toBeUndefined();
    expect(reader.tryGetObject("missing")).toBeUndefined();
  });

  it("tryGet* variants return values when present", () => {
    expect(reader.tryGetRate("vat_standard_rate")).toBe(0.20);
    expect(reader.tryGetMoneyAmount("vat_registration_threshold_gbp")).toBe(90000);
    expect(reader.tryGetString("authority_name")).toBe("HM Revenue & Customs");
  });
});

// ── Cross-jurisdictional convenience methods ────────────────────────

describe("compliance reader · cross-jurisdictional convenience", () => {
  it("UK: vatOrGstStandardRate uses VAT rate", () => {
    const r = makeReader({ package: mkPackage({ country_code: "GB" }), rules: UK_RULES });
    expect(r.vatOrGstStandardRate()).toBe(0.20);
  });

  it("IE: vatOrGstStandardRate uses VAT rate", () => {
    const r = makeReader({ package: mkPackage({ country_code: "IE" }), rules: IE_RULES });
    expect(r.vatOrGstStandardRate()).toBe(0.23);
  });

  it("AU: vatOrGstStandardRate uses GST rate", () => {
    const r = makeReader({ package: mkPackage({ country_code: "AU" }), rules: AU_RULES });
    expect(r.vatOrGstStandardRate()).toBe(0.10);
  });

  it("registrationThreshold picks UK VAT threshold", () => {
    const r = makeReader({ package: mkPackage({ country_code: "GB" }), rules: UK_RULES });
    expect(r.registrationThreshold()).toBe(90000);
  });

  it("registrationThreshold picks IE services threshold (lower — matters for trades)", () => {
    const r = makeReader({ package: mkPackage({ country_code: "IE" }), rules: IE_RULES });
    expect(r.registrationThreshold()).toBe(42500);   // services, not goods
  });

  it("registrationThreshold picks AU GST threshold", () => {
    const r = makeReader({ package: mkPackage({ country_code: "AU" }), rules: AU_RULES });
    expect(r.registrationThreshold()).toBe(75000);
  });

  it("recordRetentionYears picks per-jurisdiction rule", () => {
    const gb = makeReader({ package: mkPackage({ country_code: "GB" }), rules: UK_RULES });
    const ie = makeReader({ package: mkPackage({ country_code: "IE" }), rules: IE_RULES });
    const au = makeReader({ package: mkPackage({ country_code: "AU" }), rules: AU_RULES });
    const us = makeReader({ package: mkPackage({ country_code: "US" }), rules: US_RULES });
    expect(gb.recordRetentionYears()).toBe(6);
    expect(ie.recordRetentionYears()).toBe(6);
    expect(au.recordRetentionYears()).toBe(5);
    expect(us.recordRetentionYears()).toBe(3);
  });

  it("authorityName differs per jurisdiction", () => {
    expect(makeReader({ package: mkPackage({ country_code: "GB" }), rules: UK_RULES }).authorityName()).toBe("HM Revenue & Customs");
    expect(makeReader({ package: mkPackage({ country_code: "IE" }), rules: IE_RULES }).authorityName()).toBe("Office of the Revenue Commissioners");
    expect(makeReader({ package: mkPackage({ country_code: "AU" }), rules: AU_RULES }).authorityName()).toBe("Australian Taxation Office");
    expect(makeReader({ package: mkPackage({ country_code: "US" }), rules: US_RULES }).authorityName()).toBe("Internal Revenue Service");
  });

  it("currencyCode + currencySymbol", () => {
    const gb = makeReader({ package: mkPackage({ country_code: "GB" }), rules: UK_RULES });
    expect(gb.currencyCode()).toBe("GBP");
    expect(gb.currencySymbol()).toBe("£");
  });
});

// ── Citation ────────────────────────────────────────────────────────

describe("compliance reader · citation", () => {
  it("produces a human-readable citation with jurisdiction, version, verified date, source host", () => {
    const r = makeReader({
      package: mkPackage({
        country_code: "GB",
        version: "1.1.0",
        last_verified_at: "2026-08-06T14:30:00Z",
        source_urls: ["https://www.gov.uk/vat-rates"],
      }),
      rules: UK_RULES,
    });
    expect(r.citation()).toBe("GB v1.1.0 · verified 2026-08-06 · gov.uk");
  });

  it("includes state code when present", () => {
    const r = makeReader({
      package: mkPackage({
        country_code: "US",
        state_code: "CA",
        version: "1.0.0",
        source_urls: ["https://www.irs.gov/"],
      }),
      rules: US_RULES,
    });
    expect(r.citation()).toBe("US/CA v1.0.0 · verified 2026-08-06 · irs.gov");
  });
});

// ── Package metadata pass-through ───────────────────────────────────

describe("compliance reader · metadata", () => {
  it("exposes package + country + state + version + verified", () => {
    const pkg = mkPackage({ country_code: "IE", version: "1.0.0" });
    const r = makeReader({ package: pkg, rules: IE_RULES });
    expect(r.countryCode).toBe("IE");
    expect(r.stateCode).toBeNull();
    expect(r.version).toBe("1.0.0");
    expect(r.package).toBe(pkg);
  });
});
