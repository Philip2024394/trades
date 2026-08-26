// src/lib/nex-shop/pricing.test.ts

import { describe, it, expect } from "vitest";
import {
  activeTierAt,
  effectivePricePerUnit,
  computeQuantityPricing,
  validateQtyPriceTiers,
  type QtyPriceTier,
} from "./pricing";

const T2 = { minQty: 2, pricePerUnitIdr: 142500 };
const T3 = { minQty: 3, pricePerUnitIdr: 135000 };
const T5 = { minQty: 5, pricePerUnitIdr: 125000 };
const BASE = 150000;

describe("activeTierAt · highest-applicable-minQty-wins", () => {
  it("returns null when tiers empty", () => {
    expect(activeTierAt(3, [])).toBeNull();
  });
  it("returns null when qty below smallest minQty", () => {
    expect(activeTierAt(1, [T2, T3])).toBeNull();
  });
  it("returns the T2 tier at qty=2", () => {
    expect(activeTierAt(2, [T2, T3, T5])).toEqual(T2);
  });
  it("returns the T3 tier at qty=3 and qty=4", () => {
    expect(activeTierAt(3, [T2, T3, T5])).toEqual(T3);
    expect(activeTierAt(4, [T2, T3, T5])).toEqual(T3);
  });
  it("returns the T5 tier at qty>=5", () => {
    expect(activeTierAt(5, [T2, T3, T5])).toEqual(T5);
    expect(activeTierAt(50, [T2, T3, T5])).toEqual(T5);
  });
  it("tolerates unsorted input · picks the highest applicable minQty", () => {
    expect(activeTierAt(4, [T5, T2, T3])).toEqual(T3);
  });
  it("returns null for non-finite / zero / negative qty", () => {
    expect(activeTierAt(0, [T2])).toBeNull();
    expect(activeTierAt(-1, [T2])).toBeNull();
    expect(activeTierAt(NaN, [T2])).toBeNull();
  });
});

describe("effectivePricePerUnit", () => {
  it("returns base when no tiers", () => {
    expect(effectivePricePerUnit(BASE, [], 5)).toBe(BASE);
  });
  it("returns base when qty below minimum tier", () => {
    expect(effectivePricePerUnit(BASE, [T2, T3], 1)).toBe(BASE);
  });
  it("returns tier price when tier applies", () => {
    expect(effectivePricePerUnit(BASE, [T2, T3, T5], 3)).toBe(135000);
  });
});

describe("computeQuantityPricing · full buyer-facing outcome", () => {
  it("qty=1 · no tier · base price · zero savings · next tier T2", () => {
    const r = computeQuantityPricing(BASE, [T2, T3, T5], 1);
    expect(r).toMatchObject({
      qty: 1,
      pricePerUnitIdr: BASE,
      lineTotalIdr: BASE,
      activeTier: null,
      savingsPerUnitIdr: 0,
      savingsLineTotalIdr: 0,
      nextTier: T2,
      unitsToNextTier: 1,
    });
  });
  it("qty=2 · T2 tier · 2 × 142500 = 285000 · save 15000 · next tier T3", () => {
    const r = computeQuantityPricing(BASE, [T2, T3, T5], 2);
    expect(r.pricePerUnitIdr).toBe(142500);
    expect(r.lineTotalIdr).toBe(285000);
    expect(r.savingsPerUnitIdr).toBe(7500);
    expect(r.savingsLineTotalIdr).toBe(15000);
    expect(r.activeTier).toEqual(T2);
    expect(r.nextTier).toEqual(T3);
    expect(r.unitsToNextTier).toBe(1);
  });
  it("qty=3 · T3 tier · line 405000 · save 45000 · next tier T5", () => {
    const r = computeQuantityPricing(BASE, [T2, T3, T5], 3);
    expect(r.pricePerUnitIdr).toBe(135000);
    expect(r.lineTotalIdr).toBe(405000);
    expect(r.savingsLineTotalIdr).toBe(45000);
    expect(r.nextTier).toEqual(T5);
    expect(r.unitsToNextTier).toBe(2);
  });
  it("qty=10 · T5 tier · no next tier", () => {
    const r = computeQuantityPricing(BASE, [T2, T3, T5], 10);
    expect(r.pricePerUnitIdr).toBe(125000);
    expect(r.lineTotalIdr).toBe(1250000);
    expect(r.nextTier).toBeNull();
    expect(r.unitsToNextTier).toBeNull();
  });
  it("floors non-integer qty · never below 1", () => {
    expect(computeQuantityPricing(BASE, [T2], 2.9).qty).toBe(2);
    expect(computeQuantityPricing(BASE, [T2], 0).qty).toBe(1);
    expect(computeQuantityPricing(BASE, [T2], -5).qty).toBe(1);
  });
  it("no tiers · never returns savings", () => {
    const r = computeQuantityPricing(BASE, [], 10);
    expect(r.pricePerUnitIdr).toBe(BASE);
    expect(r.savingsPerUnitIdr).toBe(0);
    expect(r.savingsLineTotalIdr).toBe(0);
    expect(r.activeTier).toBeNull();
    expect(r.nextTier).toBeNull();
  });
});

describe("validateQtyPriceTiers · triple-defence input validation", () => {
  it("accepts empty array", () => {
    expect(validateQtyPriceTiers([], BASE)).toEqual({ ok: true, tiers: [] });
  });
  it("accepts well-formed sorted tiers", () => {
    const r = validateQtyPriceTiers([T2, T3, T5], BASE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tiers).toEqual([T2, T3, T5]);
  });
  it("sorts tiers by minQty ascending even if input unsorted", () => {
    const r = validateQtyPriceTiers([T5, T2, T3], BASE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tiers.map((t) => t.minQty)).toEqual([2, 3, 5]);
  });
  it("rejects non-array input", () => {
    expect(validateQtyPriceTiers("not an array", BASE)).toEqual({ ok: false, error: "Tiers must be an array" });
  });
  it("rejects minQty < 2", () => {
    const r = validateQtyPriceTiers([{ minQty: 1, pricePerUnitIdr: 140000 }], BASE);
    expect(r.ok).toBe(false);
  });
  it("rejects zero or negative price", () => {
    expect(validateQtyPriceTiers([{ minQty: 2, pricePerUnitIdr: 0 }], BASE).ok).toBe(false);
    expect(validateQtyPriceTiers([{ minQty: 2, pricePerUnitIdr: -1 }], BASE).ok).toBe(false);
  });
  it("rejects non-integer minQty or price", () => {
    expect(validateQtyPriceTiers([{ minQty: 2.5, pricePerUnitIdr: 140000 }], BASE).ok).toBe(false);
    expect(validateQtyPriceTiers([{ minQty: 2, pricePerUnitIdr: 140000.5 }], BASE).ok).toBe(false);
  });
  it("rejects tier price >= base", () => {
    expect(validateQtyPriceTiers([{ minQty: 2, pricePerUnitIdr: 150000 }], BASE).ok).toBe(false);
    expect(validateQtyPriceTiers([{ minQty: 2, pricePerUnitIdr: 160000 }], BASE).ok).toBe(false);
  });
  it("rejects duplicate minQty", () => {
    const r = validateQtyPriceTiers([{ minQty: 2, pricePerUnitIdr: 140000 }, { minQty: 2, pricePerUnitIdr: 135000 }], BASE);
    expect(r.ok).toBe(false);
  });
  it("rejects tier at higher qty being MORE expensive than lower qty", () => {
    const r = validateQtyPriceTiers([
      { minQty: 2, pricePerUnitIdr: 140000 },
      { minQty: 3, pricePerUnitIdr: 145000 }, // wrong · higher qty must be cheaper
    ], BASE);
    expect(r.ok).toBe(false);
  });
  it("rejects tier at higher qty being EQUAL price to lower qty", () => {
    const r = validateQtyPriceTiers([
      { minQty: 2, pricePerUnitIdr: 140000 },
      { minQty: 3, pricePerUnitIdr: 140000 },
    ], BASE);
    expect(r.ok).toBe(false);
  });
});
