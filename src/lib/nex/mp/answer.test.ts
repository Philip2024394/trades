// MP answer router — classifier + reply shape.

import { describe, it, expect, vi } from "vitest";

vi.mock("./search", () => ({
  searchProducts: vi.fn(async ({ keyword }: { keyword: string }) => {
    if (keyword.includes("nothing")) return [];
    return [
      { key: "k1", source: "xrated_products", source_id: "s1",
        name: "Plasterboard 2400×1200", description: null,
        price_pence: 700, rrp_pence: null, unit: "board", category: null,
        merchant_slug: "phil", merchant_name: "Phil Plumbing", merchant_city: "Manchester",
        stock_status: "in_stock", lead_time_days: 2, distance_km: 4.5, cover_url: null,
        evidence: { source: "t", tables: [], computed_at: "x" } }
    ];
  })
}));

import { answerMP, classifyMPQuestion } from "./answer";

describe("classifyMPQuestion", () => {
  it("routes 'i need 120 concrete blocks'", () => {
    expect(classifyMPQuestion("i need 120 concrete blocks").kind).toBe("find_material");
  });
  it("routes 'find me the cheapest paint'", () => {
    expect(classifyMPQuestion("find me the cheapest paint").kind).toBe("find_material");
  });
  it("routes 'compare timber prices'", () => {
    expect(classifyMPQuestion("compare timber prices").kind).toBe("compare_prices");
  });
  it("routes 'who sells plasterboard?'", () => {
    expect(classifyMPQuestion("who sells plasterboard?").kind).toBe("find_material");
  });
  it("routes 'what can't you buy?'", () => {
    expect(classifyMPQuestion("what can't you buy?").kind).toBe("unavailable");
  });
  it("returns 'none' for unrelated text", () => {
    expect(classifyMPQuestion("hello there").kind).toBe("none");
  });
});

describe("answerMP", () => {
  it("find_material returns ranked listings + explanation", async () => {
    const r = await answerMP({ question: { kind: "find_material", ask: "i need 20 plasterboards" } });
    expect(r.speak).toContain("Plasterboard 2400×1200");
    expect(r.speak).toContain("£7.00");
    expect(r.speak.toLowerCase()).toContain("in stock");
    expect(r.data?.request.keyword).toBe("plasterboard");
    expect(r.data?.request.qty).toBe(20);
  });

  it("empty result surfaces friendly no-match message", async () => {
    const r = await answerMP({ question: { kind: "find_material", ask: "i need nothingatall" } });
    expect(r.speak).toContain("No listings");
  });

  it("unavailable enumerates gaps + reassures they surface honestly", async () => {
    const r = await answerMP({ question: { kind: "unavailable" } });
    expect(r.speak).toContain("External supplier catalogues");
    expect(r.speak).toContain("Equipment hire directory");
    expect(r.speak.toLowerCase()).toContain("finance");
  });

  it("none returns empty speak", async () => {
    const r = await answerMP({ question: { kind: "none" } });
    expect(r.speak).toBe("");
  });
});
