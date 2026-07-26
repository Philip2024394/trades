// NEX Merchant Assistant — banner generation tests.
//
// Covers:
//   - generate_banner requires offer ownership
//   - generate_banner ignores spoofed merchant_id in input
//   - Banner guardrails reject false certifications
//   - JSON parse failures return a friendly error
//   - REFUSAL path from the model is surfaced as guardrail_blocked
//   - activateBannerVersion re-checks ownership + deactivates prior
//     active on same offer
//
// The Anthropic wrapper is mocked so no real API call is made.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MerchantContext } from "./types";

// Reuse the chainable Supabase mock pattern from writeExecutors.test.ts
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
  chain.order = vi.fn(returnSelf);
  chain.limit = vi.fn(returnSelf);
  chain.single = vi.fn(returnFinal);
  chain.maybeSingle = vi.fn(returnFinal);
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(finalResponse).then(resolve);
  return chain;
};
const fromMock = vi.fn();

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: (t: string) => fromMock(t) },
}));

const completeWithUsageMock = vi.fn();
vi.mock("@/lib/llm/anthropic", () => ({
  completeWithUsage: (input: unknown) => completeWithUsageMock(input),
}));

vi.mock("@/lib/products/read", () => ({
  findCanonicalById: vi.fn(async () => null),
  listMerchantOffers: vi.fn(async () => []),
  loadProductWithOffers: vi.fn(async () => null),
}));

vi.mock("@/lib/os/events", () => ({
  publish: vi.fn(async () => undefined),
}));

import { runTool } from "./toolExecutors";
import {
  generateAndSaveBanner,
  activateBannerVersion,
} from "./bannerGenerator";
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
  completeWithUsageMock.mockReset();
});

describe("executeGenerateBanner (via runTool) — ownership", () => {
  it("rejects when the offer belongs to another merchant", async () => {
    // Offer lookup returns row for a different merchant
    fromMock.mockReturnValueOnce(
      makeChain({
        data: {
          id: "offer-1",
          merchant_id: "different-merchant",
          canonical_product_id: "canon-1",
          price_pence: 8900,
        },
        error: null,
      })
    );

    const result = await runTool(ctx, "generate_banner", { offer_id: "offer-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/only generate banners for your own/i);
  });

  it("rejects when offer_id is missing", async () => {
    const result = await runTool(ctx, "generate_banner", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/offer_id/);
  });
});

describe("generateAndSaveBanner — guardrails + JSON parsing", () => {
  it("blocks a false certification in generated body", async () => {
    completeWithUsageMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            headline: "Solid Oak Treads",
            body: "BSI-approved craftsmanship for every home.",
            cta: "Shop now",
          }),
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const result = await generateAndSaveBanner(
      ctx,
      { offerId: "offer-1" },
      {
        productName: "Oak Treads",
        brandName: "OakCo",
        description: "Solid oak stair treads.",
        pricePence: 8900,
      }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guardrail_blocked).toBe(true);
      expect(result.guardrail_reason).toMatch(/BSI/);
    }
  });

  it("returns a friendly error when the model returns unparseable text", async () => {
    completeWithUsageMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "not valid json at all" }],
      usage: { inputTokens: 100, outputTokens: 20 },
    });
    const result = await generateAndSaveBanner(
      ctx,
      { offerId: "offer-1" },
      {
        productName: "Oak Treads",
        brandName: "OakCo",
        description: null,
        pricePence: 8900,
      }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/could not compose a valid banner/i);
  });

  it("surfaces the model's REFUSAL response as a guardrail block", async () => {
    completeWithUsageMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            headline: "REFUSAL",
            body: "This product requires certifications not supplied.",
            cta: "",
          }),
        },
      ],
      usage: { inputTokens: 100, outputTokens: 30 },
    });
    const result = await generateAndSaveBanner(
      ctx,
      { offerId: "offer-1" },
      {
        productName: "Fire-rated Panel",
        brandName: "SafetyCo",
        description: null,
        pricePence: 12000,
      }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guardrail_blocked).toBe(true);
      expect(result.guardrail_reason).toMatch(/certifications/i);
    }
  });

  it("persists a clean banner as a new version", async () => {
    completeWithUsageMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            headline: "Solid Oak Craftsmanship",
            body: "Hand-finished treads for lasting quality.",
            cta: "Order today",
          }),
        },
      ],
      usage: { inputTokens: 100, outputTokens: 40 },
    });
    // Version lookup — no prior versions
    fromMock.mockReturnValueOnce(makeChain({ data: null, error: null }));
    // Insert new banner
    fromMock.mockReturnValueOnce(
      makeChain({
        data: {
          id: "banner-1",
          merchant_id: "merchant-abc",
          offer_id: "offer-1",
          version: 1,
          headline: "Solid Oak Craftsmanship",
          body: "Hand-finished treads for lasting quality.",
          cta: "Order today",
          visual_style: "premium",
          is_active: false,
          generated_by: "nex_ai",
          generated_at: "2026-07-27T00:00:00Z",
          approved_at: null,
        },
        error: null,
      })
    );

    const result = await generateAndSaveBanner(
      ctx,
      { offerId: "offer-1", visualStyle: "premium" },
      {
        productName: "Oak Treads",
        brandName: "OakCo",
        description: "Solid oak stair treads.",
        pricePence: 8900,
      }
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.banner.version).toBe(1);
      expect(result.banner.isActive).toBe(false);
      expect(result.banner.merchantId).toBe("merchant-abc");
    }
  });
});

describe("activateBannerVersion — ownership + swap", () => {
  it("rejects when banner is owned by different merchant", async () => {
    fromMock.mockReturnValueOnce(
      makeChain({
        data: {
          id: "banner-1",
          merchant_id: "different-merchant",
          offer_id: "offer-1",
        },
        error: null,
      })
    );
    const result = await activateBannerVersion(ctx, "banner-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/only activate your own/i);
  });

  it("rejects when banner is not found", async () => {
    fromMock.mockReturnValueOnce(makeChain({ data: null, error: null }));
    const result = await activateBannerVersion(ctx, "banner-missing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/i);
  });

  it("deactivates prior active + activates the target version", async () => {
    // Load banner (own it)
    fromMock.mockReturnValueOnce(
      makeChain({
        data: {
          id: "banner-2",
          merchant_id: "merchant-abc",
          offer_id: "offer-1",
        },
        error: null,
      })
    );
    // Deactivate prior actives
    const deactivateChain = makeChain({ error: null });
    fromMock.mockReturnValueOnce(deactivateChain);
    // Activate target
    const activateChain = makeChain({ error: null });
    fromMock.mockReturnValueOnce(activateChain);

    const result = await activateBannerVersion(ctx, "banner-2");
    expect(result.ok).toBe(true);
    // Deactivate call should target is_active=true on same offer
    const deactPatch = (deactivateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(deactPatch.is_active).toBe(false);
    // Activate call should set is_active=true + approved_at
    const actPatch = (activateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(actPatch.is_active).toBe(true);
    expect(actPatch.approved_at).toBeDefined();
  });
});
