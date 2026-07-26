// NEX Merchant Assistant — write-executor integration tests.
//
// Covers the Phase 7 Increment 3 write path:
//   - create_product_draft forces publisher_business_id + merchant_id
//     from ctx (NEX cannot spoof)
//   - create_product_draft blocks on guardrail failures
//   - update_product_field rejects cross-merchant edits
//   - publish_product requires confirm=true
//   - publish_product rejects unowned products
//   - archive_product rejects unowned products
//
// Supabase mocks return canned responses so the test doesn't need a
// live DB. The event bus is mocked to a no-op.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MerchantContext } from "./types";

// Chainable Supabase mock builder — every fluent method returns `this`
// so we can await the final resolvers.
const makeChain = (finalResponse: Record<string, unknown> = { data: null, error: null }) => {
  const chain: Record<string, unknown> = {};
  const returnSelf = () => chain;
  const returnFinal = () => Promise.resolve(finalResponse);
  chain.select = vi.fn(returnSelf);
  chain.insert = vi.fn(returnSelf);
  chain.update = vi.fn(returnSelf);
  chain.eq = vi.fn(returnSelf);
  chain.is = vi.fn(returnSelf);
  chain.in = vi.fn(returnSelf);
  chain.single = vi.fn(returnFinal);
  chain.maybeSingle = vi.fn(returnFinal);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(finalResponse).then(resolve);
  return chain;
};

const fromMock = vi.fn();

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: (t: string) => fromMock(t) },
}));

vi.mock("@/lib/os/events", () => ({
  publish: vi.fn(async () => undefined),
}));

vi.mock("@/lib/products/read", () => ({
  listMerchantOffers: vi.fn(async () => []),
  loadProductWithOffers: vi.fn(async () => null),
  findCanonicalById: vi.fn(async () => null),
}));

import { runTool } from "./toolExecutors";
import { findCanonicalById } from "@/lib/products/read";

const ctx: MerchantContext = {
  merchantId: "merchant-abc",
  slug: "test-merchant",
  businessName: "Test Merchant Ltd",
  verificationLevel: "verified",
  tier: "gold",
  tradeType: "staircase-manufacturer",
};

beforeEach(() => {
  vi.clearAllMocks();
  fromMock.mockReset();
});

describe("create_product_draft — ownership + guardrails", () => {
  it("forces publisher_business_id and merchant_id from ctx (rejects spoofed values)", async () => {
    const canonicalInsertMock = makeChain({
      data: {
        id: "canon-new-123",
        name: "Oak Treads",
        brand_name: "OakCo",
        slug: "oakco/oak-treads",
      },
      error: null,
    });
    const offerInsertMock = makeChain({
      data: { id: "offer-new-456" },
      error: null,
    });
    fromMock
      .mockReturnValueOnce(canonicalInsertMock)
      .mockReturnValueOnce(offerInsertMock);

    const result = await runTool(ctx, "create_product_draft", {
      // Attempted spoofing — should be IGNORED, not honoured
      merchant_id: "different-merchant",
      publisher_business_id: "different-merchant",
      name: "Oak Treads",
      brand_name: "OakCo",
      price_pence: 8900,
    });

    expect(result.ok).toBe(true);

    // The insert payload should carry ctx.merchantId, NOT the spoofed value
    const canonicalInsertCall = (canonicalInsertMock.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(canonicalInsertCall.publisher_business_id).toBe("merchant-abc");
    expect(canonicalInsertCall.lifecycle_status).toBe("draft");
    expect(canonicalInsertCall.nex_draft_source).toBe("nex_merchant_assistant");

    const offerInsertCall = (offerInsertMock.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(offerInsertCall.merchant_id).toBe("merchant-abc");
    expect(offerInsertCall.is_active).toBe(false);
    expect(offerInsertCall.nex_draft_source).toBe("nex_merchant_assistant");
  });

  it("blocks a certification claim in the description", async () => {
    const result = await runTool(ctx, "create_product_draft", {
      name: "Oak Treads",
      brand_name: "OakCo",
      description: "Our BSI-approved craftsmanship stands out.",
      price_pence: 8900,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guardrail_blocked).toBe(true);
      expect(result.guardrail_reason).toMatch(/BSI/);
    }
  });

  it("rejects missing required fields", async () => {
    const result = await runTool(ctx, "create_product_draft", {
      name: "",
      brand_name: "OakCo",
      price_pence: 8900,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/name and brand_name/);
  });

  it("rejects negative price", async () => {
    const result = await runTool(ctx, "create_product_draft", {
      name: "Oak Treads",
      brand_name: "OakCo",
      price_pence: -1,
    });
    expect(result.ok).toBe(false);
  });
});

describe("update_product_field — cross-merchant rejection", () => {
  it("rejects updates to products owned by a different merchant", async () => {
    (findCanonicalById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "canon-owned-by-someone-else",
      publisherBusinessId: "different-merchant",
      name: "Their Product",
      brandName: "TheirBrand",
      description: null,
      categoryPath: [],
      heroImageUrl: null,
      lifecycleStatus: "active",
    });

    const result = await runTool(ctx, "update_product_field", {
      product_id: "canon-owned-by-someone-else",
      field: "name",
      value: "Hijacked Name",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/only edit products you own/i);
  });

  it("allows updates on products the merchant owns", async () => {
    (findCanonicalById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "canon-mine",
      publisherBusinessId: "merchant-abc",
      name: "My Product",
      brandName: "MyBrand",
      description: null,
      categoryPath: [],
      heroImageUrl: null,
      lifecycleStatus: "draft",
    });
    const updateChain = makeChain({ data: null, error: null });
    fromMock.mockReturnValueOnce(updateChain);

    const result = await runTool(ctx, "update_product_field", {
      product_id: "canon-mine",
      field: "description",
      value: "A well-made oak product.",
    });
    expect(result.ok).toBe(true);
  });
});

describe("publish_product — confirmation + ownership", () => {
  it("rejects publish without confirm=true", async () => {
    const result = await runTool(ctx, "publish_product", {
      product_id: "canon-mine",
      confirm: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/explicit merchant confirmation/i);
  });

  it("rejects publish on unowned product even with confirm=true", async () => {
    (findCanonicalById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "canon-not-mine",
      publisherBusinessId: "different-merchant",
      name: "Their Product",
      brandName: "TheirBrand",
      description: null,
      categoryPath: [],
      heroImageUrl: null,
      lifecycleStatus: "draft",
    });

    const result = await runTool(ctx, "publish_product", {
      product_id: "canon-not-mine",
      confirm: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/only publish products you own/i);
  });

  it("publishes an owned product when confirm=true", async () => {
    (findCanonicalById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "canon-mine",
      publisherBusinessId: "merchant-abc",
      name: "My Product",
      brandName: "MyBrand",
      description: null,
      categoryPath: [],
      heroImageUrl: null,
      lifecycleStatus: "draft",
    });
    const canonicalUpdate = makeChain({ error: null });
    const offersUpdate = makeChain({ error: null });
    fromMock.mockReturnValueOnce(canonicalUpdate).mockReturnValueOnce(offersUpdate);

    const result = await runTool(ctx, "publish_product", {
      product_id: "canon-mine",
      confirm: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const data = result.data as { lifecycle_status: string };
      expect(data.lifecycle_status).toBe("active");
    }
    // Canonical update should set lifecycle_status=active and target the
    // merchant's own row (ownership at SQL level)
    const patch = (canonicalUpdate.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(patch.lifecycle_status).toBe("active");
    expect(patch.published_at).toBeDefined();
  });
});

describe("archive_product — confirmation + ownership", () => {
  it("rejects archive without confirm=true", async () => {
    const result = await runTool(ctx, "archive_product", {
      product_id: "canon-mine",
      confirm: false,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects archive on unowned product", async () => {
    (findCanonicalById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "canon-not-mine",
      publisherBusinessId: "different-merchant",
      name: "Their Product",
      brandName: "TheirBrand",
      description: null,
      categoryPath: [],
      heroImageUrl: null,
      lifecycleStatus: "active",
    });

    const result = await runTool(ctx, "archive_product", {
      product_id: "canon-not-mine",
      confirm: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/only archive products you own/i);
  });
});
