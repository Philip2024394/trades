// src/lib/nex-shop/taxonomy.test.ts

import { describe, it, expect } from "vitest";
import { TAXONOMY, flattenTaxonomy, allMicroNicheLabels, masterKey, level1Key, level2Key } from "./taxonomy";

describe("Taxonomy · structural expectations", () => {
  it("has 13 master categories", () => {
    expect(TAXONOMY.length).toBe(13);
  });

  it("every master has children (no empty masters)", () => {
    for (const m of TAXONOMY) {
      expect(m.children.length).toBeGreaterThan(0);
    }
  });

  it("every L1 has children (no empty subcategories)", () => {
    for (const m of TAXONOMY) {
      for (const l1 of m.children) {
        expect(l1.children.length).toBeGreaterThan(0);
      }
    }
  });

  it("includes Electronics/Smartphones & Accessories/Mobile Phones", () => {
    const elec = TAXONOMY.find((m) => m.label === "Electronics")!;
    const sa = elec.children.find((c) => c.label === "Smartphones & Accessories")!;
    const mp = sa.children.find((c) => c.label === "Mobile Phones");
    expect(mp).toBeDefined();
  });
});

describe("Taxonomy · flatten", () => {
  it("returns masters + L1 + L2 with expected counts", () => {
    const { masters, level1, level2 } = flattenTaxonomy();
    expect(masters.length).toBe(13);
    expect(level1.length).toBeGreaterThanOrEqual(50);
    expect(level2.length).toBeGreaterThanOrEqual(200);
  });

  it("every L1 references a valid master key as parentKey", () => {
    const { masters, level1 } = flattenTaxonomy();
    const masterKeys = new Set(masters.map((m) => m.key));
    for (const l1 of level1) {
      expect(masterKeys.has(l1.parentKey)).toBe(true);
    }
  });

  it("every L2 references a valid L1 key as parentKey", () => {
    const { level1, level2 } = flattenTaxonomy();
    const l1Keys = new Set(level1.map((l) => l.key));
    for (const l2 of level2) {
      expect(l1Keys.has(l2.parentKey)).toBe(true);
    }
  });

  it("all L1 keys are unique", () => {
    const { level1 } = flattenTaxonomy();
    const keys = level1.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("all L2 keys are unique", () => {
    const { level2 } = flattenTaxonomy();
    const keys = level2.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("Taxonomy · key generation is stable + slash-notated", () => {
  it("master keys use slug of label", () => {
    expect(masterKey("Electronics")).toBe("electronics");
    expect(masterKey("Fashion & Apparel")).toBe("fashion-and-apparel");
    expect(masterKey("Home & Kitchen")).toBe("home-and-kitchen");
  });

  it("L1 keys use master/sub notation", () => {
    expect(level1Key("Electronics", "Smartphones & Accessories")).toBe("electronics/smartphones-and-accessories");
  });

  it("L2 keys use master/sub/micro notation", () => {
    expect(level2Key("Electronics", "Smartphones & Accessories", "Mobile Phones")).toBe("electronics/smartphones-and-accessories/mobile-phones");
  });
});

describe("Taxonomy · walker keyword source", () => {
  it("allMicroNicheLabels returns hundreds of labels for walker keyword expansion", () => {
    const labels = allMicroNicheLabels();
    expect(labels.length).toBeGreaterThanOrEqual(200);
    expect(labels).toContain("Mobile Phones");
    expect(labels).toContain("Sneakers & Athletic Shoes");
    expect(labels).toContain("Coffee Beans & Ground Coffee");
  });
});
