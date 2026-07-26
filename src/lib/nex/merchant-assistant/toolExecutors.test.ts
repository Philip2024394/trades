// NEX Merchant Assistant — tool executor tests.
//
// Session gating + ownership tests. Products lib + supabaseAdmin
// are mocked so the test doesn't need a live DB. What we're checking:
//
//   - Unknown tool names return an error result (never throw)
//   - Write tools return a "not enabled" result in Increment 2
//   - list_products filters by merchantId (ownership passthrough)
//   - preview_change rejects when the merchant does not own any
//     offer on the requested product
//
// Reference: src/lib/nex/merchant-assistant/toolExecutors.ts

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MerchantContext } from "./types";

// Mocks must be hoisted above the import of the executors module
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(async () => ({ data: [] })),
      })),
    })),
  },
}));

vi.mock("@/lib/products/read", () => ({
  listMerchantOffers: vi.fn(async () => []),
  loadProductWithOffers: vi.fn(async () => null),
  findCanonicalById: vi.fn(async () => null),
}));

// Import AFTER mocks are declared
import { runTool } from "./toolExecutors";
import {
  listMerchantOffers,
  loadProductWithOffers,
  findCanonicalById,
} from "@/lib/products/read";

const ctx: MerchantContext = {
  merchantId: "merchant-abc",
  slug: "test-merchant",
  businessName: "Test Merchant Ltd",
  verificationLevel: "verified",
  tier: "trade_pro",
  tradeType: "staircase-manufacturer",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runTool — dispatch behaviour", () => {
  it("returns an error for unknown tool names (never throws)", async () => {
    const result = await runTool(ctx, "does_not_exist", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unknown tool/i);
  });

  // generate_banner is now live (Increment 4). Its own ownership /
  // guardrail / persistence tests live in bannerGenerator.test.ts.
});

describe("runTool — list_products (ownership passthrough)", () => {
  it("calls listMerchantOffers with the caller's merchantId", async () => {
    await runTool(ctx, "list_products", { query: "oak", limit: 10 });
    expect(listMerchantOffers).toHaveBeenCalledWith({
      merchantId: "merchant-abc",
      q: "oak",
      limit: 10,
    });
  });

  it("caps the limit at 100 even if a larger value is requested", async () => {
    await runTool(ctx, "list_products", { limit: 500 });
    expect(listMerchantOffers).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    );
  });

  it("uses a default limit of 20 when none is provided", async () => {
    await runTool(ctx, "list_products", {});
    expect(listMerchantOffers).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 })
    );
  });

  it("returns an empty array when the merchant has no offers", async () => {
    (listMerchantOffers as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const result = await runTool(ctx, "list_products", {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });
});

describe("runTool — preview_change (ownership re-check)", () => {
  it("returns an error when the product does not exist", async () => {
    (findCanonicalById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const result = await runTool(ctx, "preview_change", {
      product_id: "prod-xyz",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/i);
  });

  it("rejects preview when caller owns no offer on the product", async () => {
    (findCanonicalById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "prod-xyz",
      name: "Test Product",
      brandName: "TestBrand",
      description: null,
      categoryPath: [],
      heroImageUrl: null,
      lifecycleStatus: "active",
    });
    // Bundle for the merchant scope returns null/empty offers
    (loadProductWithOffers as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await runTool(ctx, "preview_change", {
      product_id: "prod-xyz",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/do not have any offers/i);
  });

  it("allows preview when caller owns at least one offer on the product", async () => {
    (findCanonicalById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "prod-xyz",
      name: "Oak Treads",
      brandName: "OakCo",
      description: "Solid oak treads.",
      categoryPath: ["staircase", "treads"],
      heroImageUrl: null,
      lifecycleStatus: "active",
    });
    // Merchant-scoped bundle: this merchant has an offer
    (loadProductWithOffers as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        canonical: { id: "prod-xyz" },
        variants: [],
        offers: [
          {
            id: "offer-1",
            merchantId: "merchant-abc",
            pricePence: 4500,
            stockStatus: "in_stock",
            isActive: true,
          },
        ],
      })
      // Full unscoped bundle for the offers_summary
      .mockResolvedValueOnce({
        canonical: { id: "prod-xyz" },
        variants: [],
        offers: [
          {
            id: "offer-1",
            merchantId: "merchant-abc",
            pricePence: 4500,
            stockStatus: "in_stock",
            isActive: true,
          },
          {
            id: "offer-2",
            merchantId: "merchant-def",
            pricePence: 5000,
            stockStatus: "in_stock",
            isActive: true,
          },
        ],
      });

    const result = await runTool(ctx, "preview_change", {
      product_id: "prod-xyz",
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const data = result.data as { offers_summary: Array<{ is_this_merchant: boolean }> };
      expect(data.offers_summary).toHaveLength(2);
      expect(
        data.offers_summary.find((o) => o.is_this_merchant)
      ).toBeTruthy();
    }
  });
});
