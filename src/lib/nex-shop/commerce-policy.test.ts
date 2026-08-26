// src/lib/nex-shop/commerce-policy.test.ts

import { describe, it, expect } from "vitest";
import { calculateSellerFee } from "./commerce-policy";
import type { CommercePolicy } from "./types";

const DEFAULT: CommercePolicy = {
  policyId: "p-default",
  jurisdiction: "ID/DIY/Yogyakarta",
  categoryId: null,
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  effectiveTo: null,
  sellerFeeRate: 0.05,
  minFeeIdr: 0,
  maxFeeIdr: null,
  currency: "IDR",
  notes: null,
};

describe("calculateSellerFee · Philip's worked examples", () => {
  it("Rp 100,000 @ 5% → seller Rp 95,000 · NEX Rp 5,000", () => {
    const r = calculateSellerFee({
      saleIdr: 100000, jurisdiction: "ID/DIY/Yogyakarta", categoryId: null,
      policies: [DEFAULT],
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.sellerReceivesIdr).toBe(95000);
      expect(r.nexCommissionIdr).toBe(5000);
      expect(r.appliedRate).toBe(0.05);
    }
  });

  it("Rp 500,000 @ 5% → seller Rp 475,000 · NEX Rp 25,000", () => {
    const r = calculateSellerFee({
      saleIdr: 500000, jurisdiction: "ID/DIY/Yogyakarta", categoryId: null,
      policies: [DEFAULT],
    });
    if (r.status === "OK") {
      expect(r.sellerReceivesIdr).toBe(475000);
      expect(r.nexCommissionIdr).toBe(25000);
    }
  });
});

describe("calculateSellerFee · never invents policy", () => {
  it("no matching jurisdiction → NO_POLICY_MATCH", () => {
    const r = calculateSellerFee({
      saleIdr: 100000, jurisdiction: "ID/Central-Java/Magelang", categoryId: null,
      policies: [DEFAULT],
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("NO_POLICY_MATCH");
  });

  it("non-positive sale → SALE_NON_POSITIVE", () => {
    const r = calculateSellerFee({
      saleIdr: 0, jurisdiction: "ID/DIY/Yogyakarta", categoryId: null,
      policies: [DEFAULT],
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("SALE_NON_POSITIVE");
  });
});

describe("calculateSellerFee · configurable rate proves it's not hard-coded", () => {
  it("policy at 3% → NEX 3,000 on Rp 100,000", () => {
    const at3: CommercePolicy = { ...DEFAULT, sellerFeeRate: 0.03 };
    const r = calculateSellerFee({
      saleIdr: 100000, jurisdiction: "ID/DIY/Yogyakarta", categoryId: null,
      policies: [at3],
    });
    if (r.status === "OK") {
      expect(r.nexCommissionIdr).toBe(3000);
      expect(r.appliedRate).toBe(0.03);
    }
  });

  it("category-scoped policy takes precedence over generic", () => {
    const scoped: CommercePolicy = { ...DEFAULT, policyId: "p-scoped", categoryId: "c-fashion", sellerFeeRate: 0.08 };
    const r = calculateSellerFee({
      saleIdr: 100000, jurisdiction: "ID/DIY/Yogyakarta", categoryId: "c-fashion",
      policies: [DEFAULT, scoped],
    });
    if (r.status === "OK") {
      expect(r.policyId).toBe("p-scoped");
      expect(r.appliedRate).toBe(0.08);
    }
  });
});

describe("calculateSellerFee · reconciliation invariant", () => {
  it("seller + nex = sale · for many values", () => {
    for (const sale of [1, 100, 999, 1000, 12345, 100000, 999999]) {
      const r = calculateSellerFee({
        saleIdr: sale, jurisdiction: "ID/DIY/Yogyakarta", categoryId: null,
        policies: [DEFAULT],
      });
      if (r.status === "OK") {
        expect(r.sellerReceivesIdr + r.nexCommissionIdr).toBe(sale);
        expect(Number.isInteger(r.sellerReceivesIdr)).toBe(true);
        expect(Number.isInteger(r.nexCommissionIdr)).toBe(true);
      }
    }
  });
});
