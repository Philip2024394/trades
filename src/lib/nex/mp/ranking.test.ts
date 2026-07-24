// Ranking — pure arithmetic.

import { describe, it, expect } from "vitest";
import { rankListings } from "./ranking";
import type { ProductListing } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

function listing(overrides: Partial<ProductListing> = {}): ProductListing {
  return {
    key: "k", source: "xrated_products", source_id: "s",
    name: "Board", description: null,
    price_pence: 1000, rrp_pence: null, unit: "each", category: null,
    merchant_slug: "m1", merchant_name: "M1", merchant_city: null,
    stock_status: "in_stock", lead_time_days: 3,
    distance_km: 10, cover_url: null, evidence: ev,
    ...overrides
  };
}

describe("rankListings", () => {
  it("empty → empty", async () => {
    const r = await rankListings({ listings: [] });
    expect(r).toEqual([]);
  });

  it("all equal → score 100 across price/lead/distance (uniform batch)", async () => {
    const r = await rankListings({ listings: [
      listing({ key: "a", price_pence: 1000, lead_time_days: 3, distance_km: 10 }),
      listing({ key: "b", price_pence: 1000, lead_time_days: 3, distance_km: 10 })
    ] });
    expect(r[0].score_breakdown.price).toBe(100);
    expect(r[0].score_breakdown.lead_time).toBe(100);
    expect(r[0].score_breakdown.distance).toBe(100);
  });

  it("lower price beats higher price when everything else equal", async () => {
    const r = await rankListings({ listings: [
      listing({ key: "cheap",     price_pence: 500  }),
      listing({ key: "expensive", price_pence: 1500 })
    ] });
    expect(r[0].listing.key).toBe("cheap");
  });

  it("in_stock beats out_of_stock when prices equal", async () => {
    const r = await rankListings({ listings: [
      listing({ key: "oos", stock_status: "out_of_stock" }),
      listing({ key: "ok",  stock_status: "in_stock" })
    ] });
    expect(r[0].listing.key).toBe("ok");
  });

  it("shorter lead time beats longer when other factors equal", async () => {
    const r = await rankListings({ listings: [
      listing({ key: "fast", lead_time_days: 1 }),
      listing({ key: "slow", lead_time_days: 10 })
    ] });
    expect(r[0].listing.key).toBe("fast");
  });

  it("trust lookup contributes to score", async () => {
    const r = await rankListings({
      listings: [
        listing({ key: "trusted",  merchant_slug: "trusted-m",  price_pence: 1000 }),
        listing({ key: "unknown",  merchant_slug: "unknown-m",  price_pence: 1000 })
      ],
      trustLookup: async (slug) => slug === "trusted-m" ? 95 : 20
    });
    expect(r[0].listing.key).toBe("trusted");
    expect(r[0].score_breakdown.trust).toBe(95);
  });

  it("reason string surfaces price + stock + lead + distance", async () => {
    const r = await rankListings({ listings: [listing({ merchant_name: "Jewson" })] });
    expect(r[0].reason).toContain("£10.00");
    expect(r[0].reason).toContain("in stock");
    expect(r[0].reason).toContain("3d lead");
    expect(r[0].reason).toContain("Jewson");
  });
});
