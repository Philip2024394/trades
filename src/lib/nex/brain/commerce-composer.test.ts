// Stage 3.19 · Phase 12 · Commerce Composer unit tests.

import { describe, it, expect, beforeEach } from "vitest";
import { composeCommerceReply } from "./commerce-composer";
import { _seedCommerceForTests, _resetCommerceCacheForTests } from "@/lib/nex/indonesia/commerce/storage";
import type { SellerRecord, ProductRecord, OfferRecord } from "@/lib/nex/indonesia/commerce/types";

const NOW = "2026-08-31T00:00:00.000Z";

function makeSeller(id: string, name: string): SellerRecord {
  return {
    id, kind: "seller", name, market: "ID",
    lifecycle: "PUBLISHED", lifecycleChangedAt: NOW,
    provenance: [{ walkerId: "test", sourceKey: "test", sourceName: "Test", sourceTier: "B", market: "ID",
      firstDiscoveredAt: NOW, lastCheckedAt: NOW, lastChangedAt: NOW, observedAt: NOW }],
    verification: "self_declared",
    categories: ["electronics"],
  };
}
function makeProduct(id: string, name: string, category: string): ProductRecord {
  return {
    id, kind: "product", name, brand: "Sony", category,
    market: "UNIVERSAL",
    lifecycle: "PUBLISHED", lifecycleChangedAt: NOW,
    provenance: [{ walkerId: "test", sourceKey: "test", sourceName: "Test", sourceTier: "B", market: "UNIVERSAL",
      firstDiscoveredAt: NOW, lastCheckedAt: NOW, lastChangedAt: NOW, observedAt: NOW }],
  };
}
function makeOffer(id: string, sellerId: string, productId: string, priceAmount = 5290000): OfferRecord {
  return {
    id, kind: "offer", sellerId, productId,
    market: "ID",
    lifecycle: "PUBLISHED", lifecycleChangedAt: NOW,
    provenance: [{ walkerId: "test", sourceKey: "test", sourceName: "Test", sourceTier: "B", market: "ID",
      firstDiscoveredAt: NOW, lastCheckedAt: NOW, lastChangedAt: NOW, observedAt: NOW }],
    status: "active",
    price: { amount: priceAmount, currency: "IDR", unit: "each", observedAt: NOW, sourceKey: "test" },
  };
}

beforeEach(() => _resetCommerceCacheForTests());

describe("composeCommerceReply · category detection", () => {
  it("detects 'headphones' → audio category", () => {
    _seedCommerceForTests({ sellers: [], products: [], offers: [] });
    const r = composeCommerceReply({ message: "buy me headphones" });
    expect(r.detectedCategory).toBe("audio");
  });

  it("detects Bahasa 'sepatu' → footwear", () => {
    _seedCommerceForTests({ sellers: [], products: [], offers: [] });
    const r = composeCommerceReply({ message: "beli sepatu" });
    expect(r.detectedCategory).toBe("footwear");
  });

  it("detects 'laptop' → computers", () => {
    _seedCommerceForTests({ sellers: [], products: [], offers: [] });
    const r = composeCommerceReply({ message: "find me a laptop" });
    expect(r.detectedCategory).toBe("computers");
  });

  it("no category keyword → detectedCategory undefined", () => {
    _seedCommerceForTests({ sellers: [], products: [], offers: [] });
    const r = composeCommerceReply({ message: "buy me stuff" });
    expect(r.detectedCategory).toBeUndefined();
  });
});

describe("composeCommerceReply · empty corpus (honest boundary)", () => {
  it("returns 'no listings yet · pipeline ready' when corpus empty", () => {
    _seedCommerceForTests({ sellers: [], products: [], offers: [] });
    const r = composeCommerceReply({ message: "buy me headphones", userMarket: "ID" });
    expect(r.offersMatched).toBe(0);
    expect(r.reply.toLowerCase()).toContain("don't have");
    expect(r.reply.toLowerCase()).toContain("pipeline");
    expect(r.reply).toContain("audio"); // detected category surfaced
  });

  it("does not fabricate any product / seller / offer when empty", () => {
    _seedCommerceForTests({ sellers: [], products: [], offers: [] });
    const r = composeCommerceReply({ message: "buy me headphones" });
    expect(r.card?.payload?.offers).toEqual([]);
    // Reply must not mention any product/seller names invented from thin air.
    expect(r.reply).not.toMatch(/Sony|JBL|Samsung|Apple/i);
  });
});

describe("composeCommerceReply · corpus has data (post-workforce)", () => {
  it("surfaces real offers with product + seller names", () => {
    const seller = makeSeller("seller:jogja-electronics", "Jogja Electronics");
    const p1 = makeProduct("product:sony-xm5", "Sony WH-1000XM5", "audio.headphones.wireless");
    const p2 = makeProduct("product:sony-earbuds", "Sony WF-1000XM5", "audio.earbuds.wireless");
    const o1 = makeOffer("offer:jogja-sony-xm5", seller.id, p1.id, 5290000);
    const o2 = makeOffer("offer:jogja-sony-earbuds", seller.id, p2.id, 4290000);
    _seedCommerceForTests({ sellers: [seller], products: [p1, p2], offers: [o1, o2] });
    const r = composeCommerceReply({ message: "buy me headphones", userMarket: "ID" });
    expect(r.offersMatched).toBeGreaterThan(0);
    expect(r.reply).toContain("Sony WH-1000XM5");
    expect(r.reply).toContain("Jogja Electronics");
    expect(r.card?.payload?.offers?.length).toBeGreaterThan(0);
  });

  it("category filter narrows to audio only when 'headphones' asked", () => {
    const seller = makeSeller("seller:jogja-electronics", "Jogja Electronics");
    const audio = makeProduct("product:sony-xm5", "Sony WH-1000XM5", "audio.headphones.wireless");
    const phone = makeProduct("product:pixel-8", "Google Pixel 8", "phones.smartphone");
    const oAudio = makeOffer("offer:audio", seller.id, audio.id);
    const oPhone = makeOffer("offer:phone", seller.id, phone.id);
    _seedCommerceForTests({ sellers: [seller], products: [audio, phone], offers: [oAudio, oPhone] });
    const r = composeCommerceReply({ message: "buy me headphones", userMarket: "ID" });
    expect(r.reply).toContain("Sony WH-1000XM5");
    expect(r.reply).not.toContain("Google Pixel 8");
  });

  it("category with no matches · honest 'none in X' reply", () => {
    const seller = makeSeller("seller:a", "A");
    const p = makeProduct("product:x", "Sony XM5", "audio.headphones.wireless");
    _seedCommerceForTests({ sellers: [seller], products: [p], offers: [makeOffer("o:1", seller.id, p.id)] });
    const r = composeCommerceReply({ message: "buy me a laptop", userMarket: "ID" });
    expect(r.detectedCategory).toBe("computers");
    expect(r.offersMatched).toBe(0);
    expect(r.reply.toLowerCase()).toContain("computers");
    expect(r.reply.toLowerCase()).toContain("none");
  });

  it("market filter isolates ID offers · UK-market seller doesn't leak", () => {
    const idSeller = makeSeller("seller:jogja", "Jogja Store");
    const ukSeller: SellerRecord = { ...makeSeller("seller:london", "London Hi-Fi"), market: "UK",
      provenance: [{ ...makeSeller("seller:london", "L").provenance[0], market: "UK" }] };
    const p = makeProduct("product:xm5", "Sony XM5", "audio.headphones.wireless");
    _seedCommerceForTests({
      sellers: [idSeller, ukSeller], products: [p],
      offers: [
        makeOffer("offer:id", idSeller.id, p.id),
        // Note: UK offer must have market=UK to pass validators (which
        // enforce offer.market === seller.market when seller has a market).
        { ...makeOffer("offer:uk", ukSeller.id, p.id), market: "UK" as const,
          provenance: [{ ...makeOffer("offer:uk", ukSeller.id, p.id).provenance[0], market: "UK" }] },
      ],
    });
    const r = composeCommerceReply({ message: "buy me headphones", userMarket: "ID" });
    expect(r.reply).toContain("Jogja Store");
    expect(r.reply).not.toContain("London Hi-Fi");
  });
});
