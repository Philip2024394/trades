// Stage 4 · NEX Commerce · unit tests for types, validators, storage,
// and retrieval (Philip 2026-08-31). Data-model coverage only. No chat,
// no payment, no fake inventory.

import { describe, it, expect, beforeEach } from "vitest";
import type { SellerRecord, ProductRecord, OfferRecord } from "./types";
import { isSeller, isProduct, isOffer } from "./types";
import {
  validateSeller, validateProduct, validateOffer, validateOfferAgainst,
} from "./validators";
import {
  _seedCommerceForTests, _resetCommerceCacheForTests, listSellers, listProducts, listOffers,
  loadCommerceReport,
} from "./storage";
import { findSellers, findProducts, findOffers, joinOffers } from "./retrieval";

const NOW = "2026-08-31T00:00:00.000Z";

function makeSeller(overrides: Partial<SellerRecord> = {}): SellerRecord {
  return {
    id: "seller:test:jogja-electronics",
    kind: "seller",
    name: "Jogja Electronics",
    market: "ID",
    lifecycle: "PUBLISHED",
    lifecycleChangedAt: NOW,
    provenance: [{
      walkerId: "walker.commerce.sellers", sourceKey: "test", sourceName: "Test Seed",
      sourceTier: "B", market: "ID",
      firstDiscoveredAt: NOW, lastCheckedAt: NOW, lastChangedAt: NOW, observedAt: NOW,
    }],
    verification: "self_declared",
    categories: ["electronics", "audio"],
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "product:test:sony-wh1000xm5",
    kind: "product",
    name: "Sony WH-1000XM5 Wireless Headphones",
    brand: "Sony",
    category: "audio.headphones.wireless",
    market: "UNIVERSAL",
    lifecycle: "PUBLISHED",
    lifecycleChangedAt: NOW,
    provenance: [{
      walkerId: "walker.commerce.products", sourceKey: "test", sourceName: "Test Seed",
      sourceTier: "B", market: "UNIVERSAL",
      firstDiscoveredAt: NOW, lastCheckedAt: NOW, lastChangedAt: NOW, observedAt: NOW,
    }],
    ...overrides,
  };
}

function makeOffer(overrides: Partial<OfferRecord> = {}): OfferRecord {
  return {
    id: "offer:test:jogja-electronics:sony-wh1000xm5",
    kind: "offer",
    sellerId: "seller:test:jogja-electronics",
    productId: "product:test:sony-wh1000xm5",
    market: "ID",
    lifecycle: "PUBLISHED",
    lifecycleChangedAt: NOW,
    provenance: [{
      walkerId: "walker.commerce.offers", sourceKey: "test", sourceName: "Test Seed",
      sourceTier: "B", market: "ID",
      firstDiscoveredAt: NOW, lastCheckedAt: NOW, lastChangedAt: NOW, observedAt: NOW,
    }],
    status: "active",
    price: { amount: 5290000, currency: "IDR", unit: "each", observedAt: NOW, sourceKey: "test" },
    stock: { level: "available", observedAt: NOW, sourceKey: "test" },
    ...overrides,
  };
}

beforeEach(() => _resetCommerceCacheForTests());

describe("type guards", () => {
  it("isSeller / isProduct / isOffer discriminate correctly", () => {
    expect(isSeller(makeSeller())).toBe(true);
    expect(isProduct(makeSeller())).toBe(false);
    expect(isSeller(makeProduct())).toBe(false);
    expect(isProduct(makeProduct())).toBe(true);
    expect(isOffer(makeOffer())).toBe(true);
    expect(isSeller(makeOffer())).toBe(false);
  });
});

describe("validateSeller", () => {
  it("accepts a well-formed seller", () => {
    expect(validateSeller(makeSeller())).toEqual({ valid: true, issues: [] });
  });

  it("rejects missing id / name / market / provenance / verification / categories", () => {
    const r = validateSeller({ kind: "seller" });
    expect(r.valid).toBe(false);
    const fields = r.issues.map((i) => i.field);
    expect(fields).toContain("id");
    expect(fields).toContain("name");
    expect(fields).toContain(".market");
    expect(fields).toContain(".provenance");
    expect(fields).toContain("verification");
    expect(fields).toContain("categories");
  });

  it("rejects seller with invalid market", () => {
    const r = validateSeller(makeSeller({ market: "XX" as never }));
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.field)).toContain(".market");
  });
});

describe("validateProduct", () => {
  it("accepts a well-formed product", () => {
    expect(validateProduct(makeProduct())).toEqual({ valid: true, issues: [] });
  });

  it("rejects missing category", () => {
    const p = makeProduct();
    // @ts-expect-error deliberate for negative test
    delete p.category;
    const r = validateProduct(p);
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.field)).toContain("category");
  });
});

describe("validateOffer (structural)", () => {
  it("accepts a well-formed offer", () => {
    expect(validateOffer(makeOffer())).toEqual({ valid: true, issues: [] });
  });

  it("rejects offer with missing sellerId / productId", () => {
    const r = validateOffer(makeOffer({ sellerId: "", productId: "" }));
    expect(r.valid).toBe(false);
    const fields = r.issues.map((i) => i.field);
    expect(fields).toContain("sellerId");
    expect(fields).toContain("productId");
  });

  it("rejects offer with negative price amount", () => {
    const r = validateOffer(makeOffer({
      price: { amount: -10, currency: "IDR", unit: "each", observedAt: NOW, sourceKey: "test" },
    }));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === "price.amount")).toBe(true);
  });

  it("rejects offer with invalid currency", () => {
    const r = validateOffer(makeOffer({
      // @ts-expect-error deliberate for negative test
      price: { amount: 100, currency: "XYZ", unit: "each", observedAt: NOW, sourceKey: "test" },
    }));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === "price.currency")).toBe(true);
  });

  it("accepts offer with null price (unpublished honest signal)", () => {
    expect(validateOffer(makeOffer({ price: null })).valid).toBe(true);
    expect(validateOffer(makeOffer({ price: undefined })).valid).toBe(true);
  });

  it("accepts offer with null stock (unknown honest signal)", () => {
    expect(validateOffer(makeOffer({ stock: null })).valid).toBe(true);
  });
});

describe("validateOfferAgainst (FK integrity)", () => {
  it("rejects offer referencing unknown sellerId", () => {
    const seller = makeSeller();
    const product = makeProduct();
    const offer = makeOffer({ sellerId: "seller:does-not-exist" });
    const r = validateOfferAgainst(offer, [seller], [product]);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === "sellerId")).toBe(true);
  });

  it("rejects offer referencing unknown productId", () => {
    const seller = makeSeller();
    const product = makeProduct();
    const offer = makeOffer({ productId: "product:does-not-exist" });
    const r = validateOfferAgainst(offer, [seller], [product]);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === "productId")).toBe(true);
  });

  it("rejects offer with market mismatched to its seller", () => {
    const seller = makeSeller({ market: "ID" });
    const product = makeProduct();
    const offer = makeOffer({ market: "UK" });
    const r = validateOfferAgainst(offer, [seller], [product]);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === "market")).toBe(true);
  });

  it("accepts a valid offer with matching FKs and market", () => {
    const seller = makeSeller();
    const product = makeProduct();
    const offer = makeOffer();
    expect(validateOfferAgainst(offer, [seller], [product]).valid).toBe(true);
  });
});

describe("storage · in-memory seed round-trip", () => {
  it("_seedCommerceForTests exposes seeded state via list functions", () => {
    _seedCommerceForTests({ sellers: [makeSeller()], products: [makeProduct()], offers: [makeOffer()] });
    expect(listSellers()).toHaveLength(1);
    expect(listProducts()).toHaveLength(1);
    expect(listOffers()).toHaveLength(1);
  });

  it("loadCommerceReport returns totals + dropped count", () => {
    _seedCommerceForTests({ sellers: [makeSeller()], products: [makeProduct()], offers: [] });
    const r = loadCommerceReport();
    expect(r.sellers.total).toBe(1);
    expect(r.sellers.valid).toBe(1);
    expect(r.sellers.dropped).toBe(0);
    expect(r.offers.total).toBe(0);
  });
});

describe("findSellers", () => {
  beforeEach(() => {
    _seedCommerceForTests({
      sellers: [
        makeSeller({ id: "seller:a", name: "Jogja Electronics", market: "ID", categories: ["electronics", "audio"], verification: "platform_verified" }),
        makeSeller({ id: "seller:b", name: "Bandung Audio Store", market: "ID", categories: ["audio"], verification: "unverified" }),
        makeSeller({ id: "seller:c", name: "London Hi-Fi", market: "UK", categories: ["audio"], verification: "government_verified" }),
      ],
      products: [], offers: [],
    });
  });

  it("filters by market", () => {
    expect(findSellers({ market: "ID" }).length).toBe(2);
    expect(findSellers({ market: "UK" }).length).toBe(1);
  });

  it("filters by categoryIn", () => {
    expect(findSellers({ categoryIn: ["electronics"] }).length).toBe(1);
    expect(findSellers({ categoryIn: ["audio"] }).length).toBe(3);
  });

  it("filters by nameContains (case-insensitive)", () => {
    expect(findSellers({ nameContains: "jogja" }).length).toBe(1);
    expect(findSellers({ nameContains: "STORE" }).length).toBe(1);
  });

  it("filters by minVerification", () => {
    expect(findSellers({ minVerification: "platform_verified" }).length).toBe(2);
    expect(findSellers({ minVerification: "government_verified" }).length).toBe(1);
  });

  it("market boundary · ID user query never surfaces UK sellers", () => {
    const idOnly = findSellers({ market: "ID" });
    expect(idOnly.every((s) => s.market === "ID")).toBe(true);
    expect(idOnly.some((s) => s.id === "seller:c")).toBe(false);
  });
});

describe("findProducts", () => {
  beforeEach(() => {
    _seedCommerceForTests({
      sellers: [],
      products: [
        makeProduct({ id: "product:sony-xm5", name: "Sony WH-1000XM5", brand: "Sony", category: "audio.headphones.wireless" }),
        makeProduct({ id: "product:sony-earbuds", name: "Sony WF-1000XM5", brand: "Sony", category: "audio.earbuds.wireless" }),
        makeProduct({ id: "product:jbl-flip6", name: "JBL Flip 6", brand: "JBL", category: "audio.speaker.portable" }),
      ],
      offers: [],
    });
  });

  it("filters by category exact", () => {
    expect(findProducts({ category: "audio.headphones.wireless" }).length).toBe(1);
  });

  it("filters by categoryPrefix", () => {
    expect(findProducts({ categoryPrefix: "audio" }).length).toBe(3);
    expect(findProducts({ categoryPrefix: "audio.headphones" }).length).toBe(1);
  });

  it("filters by brand", () => {
    expect(findProducts({ brand: "Sony" }).length).toBe(2);
    expect(findProducts({ brand: "sony" }).length).toBe(2); // case-insensitive
    expect(findProducts({ brand: "JBL" }).length).toBe(1);
  });

  it("filters by nameContains", () => {
    expect(findProducts({ nameContains: "flip" }).length).toBe(1);
  });
});

describe("findOffers", () => {
  const s = makeSeller();
  const p1 = makeProduct({ id: "product:p1" });
  const p2 = makeProduct({ id: "product:p2" });
  beforeEach(() => {
    _seedCommerceForTests({
      sellers: [s],
      products: [p1, p2],
      offers: [
        makeOffer({ id: "offer:o1", productId: "product:p1", status: "active", price: { amount: 1000000, currency: "IDR", unit: "each", observedAt: NOW, sourceKey: "test" } }),
        makeOffer({ id: "offer:o2", productId: "product:p2", status: "active", price: { amount: 500000, currency: "IDR", unit: "each", observedAt: NOW, sourceKey: "test" } }),
        makeOffer({ id: "offer:o3", productId: "product:p1", status: "paused", price: { amount: 750000, currency: "IDR", unit: "each", observedAt: NOW, sourceKey: "test" } }),
        makeOffer({ id: "offer:o4", productId: "product:p2", status: "active", price: null, stock: { level: "out_of_stock", observedAt: NOW, sourceKey: "test" } }),
      ],
    });
  });

  it("default returns only active offers", () => {
    expect(findOffers().length).toBe(3);
    expect(findOffers().every((o) => o.status === "active")).toBe(true);
  });

  it("status filter can include paused", () => {
    expect(findOffers({ status: ["active", "paused"] }).length).toBe(4);
  });

  it("hasPrice filter drops null-price offers", () => {
    const out = findOffers({ hasPrice: true });
    expect(out.some((o) => o.id === "offer:o4")).toBe(false);
  });

  it("stockLevelIn filter", () => {
    expect(findOffers({ stockLevelIn: ["available"] }).length).toBe(2);
    expect(findOffers({ stockLevelIn: ["out_of_stock"] }).length).toBe(1);
  });

  it("sort by price ascending", () => {
    const out = findOffers({ hasPrice: true, sortBy: "priceAsc" });
    expect(out[0].id).toBe("offer:o2"); // 500000
    expect(out[1].id).toBe("offer:o1"); // 1000000
  });

  it("sort by price descending", () => {
    const out = findOffers({ hasPrice: true, sortBy: "priceDesc" });
    expect(out[0].id).toBe("offer:o1"); // 1000000
  });

  it("maxPrice filter", () => {
    expect(findOffers({ hasPrice: true, maxPrice: 600000 }).length).toBe(1);
  });

  it("limit caps returned results", () => {
    expect(findOffers({ limit: 1 }).length).toBe(1);
  });
});

describe("joinOffers · materialises seller + product", () => {
  it("returns { offer, seller, product } for offers with resolvable FKs", () => {
    const s = makeSeller();
    const p = makeProduct();
    const o = makeOffer();
    _seedCommerceForTests({ sellers: [s], products: [p], offers: [o] });
    const joined = joinOffers(listOffers());
    expect(joined).toHaveLength(1);
    expect(joined[0].seller.id).toBe(s.id);
    expect(joined[0].product.id).toBe(p.id);
    expect(joined[0].offer.id).toBe(o.id);
  });
});

describe("commerce records DO NOT leak into knowledge retrieval", () => {
  it("commerce world is isolated from knowledge world", async () => {
    // Import knowledge dynamically to avoid the fake corpus reset affecting other tests.
    const { retrieveKnowledge } = await import("../knowledge");
    _seedCommerceForTests({
      sellers: [makeSeller()], products: [makeProduct()], offers: [makeOffer()],
    });
    // A query mentioning "headphones" via the knowledge retrieval must
    // NOT surface a commerce record — different world, different loader.
    const hits = retrieveKnowledge("Sony headphones", { limit: 10 });
    expect(hits.every((h) => !h.id.startsWith("product:") && !h.id.startsWith("seller:") && !h.id.startsWith("offer:"))).toBe(true);
  });
});
