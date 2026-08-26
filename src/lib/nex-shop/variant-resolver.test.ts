// src/lib/nex-shop/variant-resolver.test.ts

import { describe, it, expect } from "vitest";
import { resolveVariant } from "./variant-resolver";
import type { Product } from "./types";

// ── Fixtures ──────────────────────────────────────────────────────────
// T-shirt with Color (Black/White) × Size (M/L/XL) · 6 combinations
// Only 4 are actually listed: Black-L · Black-M · White-L · White-XL

const OV = {
  black: "ov-black", white: "ov-white",
  m: "ov-m", l: "ov-l", xl: "ov-xl",
};

const T_SHIRT: Product = {
  productId: "p-tshirt",
  sellerId: "s-nex-demo",
  categoryId: "c-fashion",
  slug: "nex-premium-tshirt",
  name: "NEX Premium T-shirt",
  description: null,
  condition: "new",
  hasVariants: true,
  basePriceIdr: null,
  baseStock: null,
  baseSku: null,
  active: true,
  images: [],
  options: [
    {
      optionId: "opt-color", productId: "p-tshirt", name: "Color", sortOrder: 10,
      values: [
        { optionValueId: OV.black, optionId: "opt-color", value: "Black", sortOrder: 10 },
        { optionValueId: OV.white, optionId: "opt-color", value: "White", sortOrder: 20 },
      ],
    },
    {
      optionId: "opt-size", productId: "p-tshirt", name: "Size", sortOrder: 20,
      values: [
        { optionValueId: OV.m,  optionId: "opt-size", value: "M",  sortOrder: 10 },
        { optionValueId: OV.l,  optionId: "opt-size", value: "L",  sortOrder: 20 },
        { optionValueId: OV.xl, optionId: "opt-size", value: "XL", sortOrder: 30 },
      ],
    },
  ],
  variants: [
    { variantId: "v-black-l",  productId: "p-tshirt", sku: "NEX-BLK-L",  priceIdr: 150000, stock: 8, active: true,  optionValueIds: [OV.black, OV.l] },
    { variantId: "v-black-m",  productId: "p-tshirt", sku: "NEX-BLK-M",  priceIdr: 145000, stock: 3, active: true,  optionValueIds: [OV.black, OV.m] },
    { variantId: "v-white-l",  productId: "p-tshirt", sku: "NEX-WHT-L",  priceIdr: 150000, stock: 0, active: true,  optionValueIds: [OV.white, OV.l] },
    { variantId: "v-white-xl", productId: "p-tshirt", sku: "NEX-WHT-XL", priceIdr: 155000, stock: 3, active: true,  optionValueIds: [OV.white, OV.xl] },
  ],
};

const HAMMER: Product = {
  productId: "p-hammer",
  sellerId: "s-nex-demo",
  categoryId: "c-tools",
  slug: "nex-hammer",
  name: "NEX Hammer",
  description: "Plain hammer",
  condition: "new",
  hasVariants: false,
  basePriceIdr: 85000,
  baseStock: 12,
  baseSku: "NEX-HAMMER",
  active: true,
  images: [],
  options: [],
  variants: [],
};

// ── Tests ─────────────────────────────────────────────────────────────

describe("Variant resolver · base product (no variants)", () => {
  it("returns BASE_PRODUCT with base price + stock", () => {
    const r = resolveVariant(HAMMER, {});
    expect(r.status).toBe("BASE_PRODUCT");
    if (r.status === "BASE_PRODUCT") {
      expect(r.priceIdr).toBe(85000);
      expect(r.stock).toBe(12);
      expect(r.sku).toBe("NEX-HAMMER");
      expect(r.outOfStock).toBe(false);
    }
  });
});

describe("Variant resolver · Philip's core test case (Black + L)", () => {
  it("Black + L → Rp 150,000 · stock 8 · SKU NEX-BLK-L", () => {
    const r = resolveVariant(T_SHIRT, { Color: "Black", Size: "L" });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.priceIdr).toBe(150000);
      expect(r.stock).toBe(8);
      expect(r.sku).toBe("NEX-BLK-L");
      expect(r.outOfStock).toBe(false);
    }
  });

  it("selection is case-insensitive (Black = black)", () => {
    const r = resolveVariant(T_SHIRT, { Color: "black", Size: "l" });
    expect(r.status).toBe("OK");
  });
});

describe("Variant resolver · unavailable combination", () => {
  it("Black + XL is not listed → UNAVAILABLE / COMBINATION_NOT_LISTED", () => {
    const r = resolveVariant(T_SHIRT, { Color: "Black", Size: "XL" });
    expect(r.status).toBe("UNAVAILABLE");
    if (r.status === "UNAVAILABLE") {
      expect(r.reason).toBe("COMBINATION_NOT_LISTED");
    }
  });

  it("White + M is not listed → UNAVAILABLE", () => {
    const r = resolveVariant(T_SHIRT, { Color: "White", Size: "M" });
    expect(r.status).toBe("UNAVAILABLE");
  });
});

describe("Variant resolver · out-of-stock behaviour", () => {
  it("White + L has stock=0 → OK but outOfStock=true", () => {
    const r = resolveVariant(T_SHIRT, { Color: "White", Size: "L" });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.stock).toBe(0);
      expect(r.outOfStock).toBe(true);
    }
  });
});

describe("Variant resolver · incomplete selection", () => {
  it("only Color chosen → INCOMPLETE_SELECTION lists Size missing", () => {
    const r = resolveVariant(T_SHIRT, { Color: "Black" });
    expect(r.status).toBe("INCOMPLETE_SELECTION");
    if (r.status === "INCOMPLETE_SELECTION") {
      expect(r.missingOptions).toContain("Size");
    }
  });

  it("nothing selected → INCOMPLETE_SELECTION lists all options", () => {
    const r = resolveVariant(T_SHIRT, {});
    expect(r.status).toBe("INCOMPLETE_SELECTION");
    if (r.status === "INCOMPLETE_SELECTION") {
      expect(r.missingOptions).toEqual(expect.arrayContaining(["Color", "Size"]));
    }
  });
});

describe("Variant resolver · invalid option value", () => {
  it("Color=Purple is not a known value → INVALID_OPTION", () => {
    const r = resolveVariant(T_SHIRT, { Color: "Purple", Size: "L" });
    expect(r.status).toBe("INVALID_OPTION");
  });
});

describe("Variant resolver · never falls back to base when variants exist", () => {
  it("valid selection returns variant · never basePrice", () => {
    const r = resolveVariant(T_SHIRT, { Color: "Black", Size: "L" });
    if (r.status === "OK") {
      // Assert we didn't get the base price · because base is null
      expect(r.priceIdr).not.toBeNull();
    }
  });
});
