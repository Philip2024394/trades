// Classifier + region-aware regulation formatter.

import { describe, it, expect, vi } from "vitest";

vi.mock("./location", () => ({
  resolveLocation: vi.fn(async () => ({
    country: "UK", region: null, city: "Manchester", postcode: null,
    source: "merchant_setting", reason: "test",
    evidence: { source: "t", tables: [], computed_at: "x" }
  })),
  normaliseCountry: (t: string) => t.toLowerCase() === "ireland" ? "IE" : "UK"
}));

// Pass through the real region module — we want its real config surfaced.
vi.mock("./universal_search", () => ({ universalSearch: vi.fn(async () => []) }));
vi.mock("./impact", () => ({ buildImpactAnalysis: vi.fn(async () => ({ change: {}, effects: [], warnings: [], evidence: { source: "t", tables: [], computed_at: "x" } })) }));

import { answerWorld, classifyWorldQuestion } from "./answer";

describe("classifyWorldQuestion", () => {
  it("routes location", () => {
    expect(classifyWorldQuestion("where am I?").kind).toBe("location");
    expect(classifyWorldQuestion("what country am I in").kind).toBe("location");
  });
  it("routes regulation by topic + optional country hint", () => {
    const q = classifyWorldQuestion("what's the minimum stair width in Ireland?");
    expect(q.kind).toBe("regulation");
    if (q.kind === "regulation") {
      expect(q.topic).toBe("stairs");
      expect(q.country_hint).toBe("IE");
    }
  });
  it("routes regulation without country hint (falls back to resolved location)", () => {
    const q = classifyWorldQuestion("what's the minimum stair width?");
    expect(q.kind).toBe("regulation");
    if (q.kind === "regulation") {
      expect(q.topic).toBe("stairs");
      expect(q.country_hint).toBeUndefined();
    }
  });
  it("routes impact 'what if I delay X'", () => {
    expect(classifyWorldQuestion("what if I delay the Smith kitchen?").kind).toBe("impact");
  });
  it("routes universal search 'search for X'", () => {
    const q = classifyWorldQuestion("search for solar");
    expect(q.kind).toBe("universal");
    if (q.kind === "universal") expect(q.query).toBe("solar");
  });
  it("returns none for unrelated text", () => {
    expect(classifyWorldQuestion("hello there").kind).toBe("none");
  });
});

describe("answerWorld — location", () => {
  it("reports country + currency + VAT + units + signal", async () => {
    const out = await answerWorld({ question: { kind: "location" }, merchantSlug: "phil" });
    expect(out).toContain("United Kingdom");
    expect(out).toContain("GBP");
    expect(out).toContain("VAT 20%");
    expect(out).toContain("Units: metric");
    expect(out).toContain("merchant_setting");
  });
});

describe("answerWorld — regulation", () => {
  it("UK stairs shows Part K + real URL", async () => {
    const out = await answerWorld({
      question: { kind: "regulation", topic: "stairs" },
      merchantSlug: "phil"
    });
    expect(out).toContain("United Kingdom");
    expect(out).toContain("Part K");
    expect(out).toContain("gov.uk");
  });

  it("IE stairs (via country_hint) shows TGD K + gov.ie", async () => {
    const out = await answerWorld({
      question: { kind: "regulation", topic: "stairs", country_hint: "IE" },
      merchantSlug: "phil"
    });
    expect(out).toContain("Ireland");
    expect(out).toContain("TGD K");
    expect(out).toContain("gov.ie");
  });

  it("region without a country-specific source surfaces the mandatory fallback", async () => {
    // IE electrical isn't on file → NO_LOCAL_SOURCE_MESSAGE
    const out = await answerWorld({
      question: { kind: "regulation", topic: "electrical", country_hint: "IE" },
      merchantSlug: "phil"
    });
    expect(out).toContain("I couldn't find an official source for your location");
    expect(out).toContain("not be treated as a legal or regulatory requirement");
  });
});
