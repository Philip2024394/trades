// Region config + regulation source pointers.

import { describe, it, expect } from "vitest";
import { regionConfigFor, regulationFor } from "./region";
import { NO_LOCAL_SOURCE_MESSAGE } from "./types";

describe("regionConfigFor", () => {
  it("UK: GBP + VAT 20% + metric", () => {
    const cfg = regionConfigFor("UK");
    expect(cfg.currency).toBe("GBP");
    expect(cfg.vat_or_gst_rate).toBe(20);
    expect(cfg.vat_or_gst_label).toBe("VAT");
    expect(cfg.unit_system).toBe("metric");
  });

  it("IE: EUR + VAT 23% + metric", () => {
    const cfg = regionConfigFor("IE");
    expect(cfg.currency).toBe("EUR");
    expect(cfg.vat_or_gst_rate).toBe(23);
  });

  it("AU: AUD + GST 10% + metric", () => {
    const cfg = regionConfigFor("AU");
    expect(cfg.currency).toBe("AUD");
    expect(cfg.vat_or_gst_rate).toBe(10);
    expect(cfg.vat_or_gst_label).toBe("GST");
  });

  it("US: USD + imperial + Sales Tax label (rate 0 sentinel)", () => {
    const cfg = regionConfigFor("US");
    expect(cfg.currency).toBe("USD");
    expect(cfg.unit_system).toBe("imperial");
    expect(cfg.vat_or_gst_label).toBe("Sales Tax");
  });

  it("unknown: safe default (GBP + VAT 20% + metric) + null regulations", () => {
    const cfg = regionConfigFor("unknown");
    expect(cfg.currency).toBe("GBP");
    for (const src of Object.values(cfg.regulations)) expect(src).toBeNull();
  });
});

describe("regulationFor", () => {
  it("UK stairs → Approved Document K with a real URL", () => {
    const src = regulationFor("UK", "stairs");
    expect(src).not.toBeNull();
    expect(src!.short).toBe("Part K");
    expect(src!.url).toContain("gov.uk");
  });

  it("IE stairs → TGD K (real gov.ie link)", () => {
    const src = regulationFor("IE", "stairs");
    expect(src).not.toBeNull();
    expect(src!.short).toBe("TGD K");
    expect(src!.url).toContain("gov.ie");
  });

  it("AU stairs → NCC", () => {
    const src = regulationFor("AU", "stairs");
    expect(src).not.toBeNull();
    expect(src!.short).toBe("NCC");
  });

  it("returns null when Nex has no country-specific source", () => {
    // We don't have IE electrical / AU electrical on file today.
    expect(regulationFor("IE", "electrical")).toBeNull();
    expect(regulationFor("AU", "electrical")).toBeNull();
    expect(regulationFor("US", "plumbing")).toBeNull();
    expect(regulationFor("unknown", "stairs")).toBeNull();
  });

  it("NO_LOCAL_SOURCE_MESSAGE matches the mandatory phrasing", () => {
    expect(NO_LOCAL_SOURCE_MESSAGE).toContain("I couldn't find an official source for your location");
    expect(NO_LOCAL_SOURCE_MESSAGE).toContain("not be treated as a legal or regulatory requirement");
  });
});
