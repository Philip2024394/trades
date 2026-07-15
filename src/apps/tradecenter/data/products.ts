// Marketplace App — product fixtures.
//
// 12 products across 4 categories, each attached to a merchant. Real
// products come through tc_marketplace.products in Wave 2. Prices in
// pence-free GBP integers; trade + business pricing populated where it
// makes sense to demonstrate the tier surfacing.

import type { TradeCenterProduct } from "../types";

export const PRODUCT_FIXTURES: TradeCenterProduct[] = [
  // ─── Hand tools ───────────────────────────────────────────
  {
    id: "p-marshalltown-trowel-14",
    slug: "marshalltown-finishing-trowel-14",
    name: "Marshalltown Finishing Trowel",
    spec: "14\" stainless steel · straight edge",
    category: "hand-tools",
    subCategory: "trowels",
    merchantSlug: "manchester-tools-direct",
    priceGbp: 30,
    tradePriceGbp: 26,
    currency: "GBP",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledsdaaavas.png?updatedAt=1783787922276",
    stockState: "in",
    stockQty: 42,
    deliveryPromise: "Free tomorrow",
    collectAvailable: true,
    distanceMi: 4,
    starRating: 4.9,
    reviewCount: 2356,
    badges: ["best-seller"]
  },
  {
    id: "p-ox-plastering-hawk",
    slug: "ox-plastering-hawk-13",
    name: "OX Plastering Hawk",
    spec: "13\" lightweight aluminium",
    category: "hand-tools",
    subCategory: "hawks",
    merchantSlug: "manchester-tools-direct",
    priceGbp: 20,
    tradePriceGbp: 17,
    currency: "GBP",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledsdaaavasdsere.png?updatedAt=1783788069019",
    stockState: "in",
    stockQty: 26,
    deliveryPromise: "Free tomorrow",
    collectAvailable: true,
    distanceMi: 4,
    starRating: 4.8,
    reviewCount: 1892
  },
  {
    id: "p-refina-skimming-blade",
    slug: "refina-skimming-blade-24",
    name: "Refina Skimming Blade",
    spec: "24\" / 600mm",
    category: "hand-tools",
    subCategory: "skimming-blades",
    merchantSlug: "leeds-builders-supplies",
    priceGbp: 24,
    tradePriceGbp: 21,
    currency: "GBP",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledsdaaavasds.png?updatedAt=1783788001124",
    stockState: "in",
    stockQty: 8,
    deliveryPromise: "Free tomorrow",
    collectAvailable: false,
    distanceMi: 22,
    starRating: 4.9,
    reviewCount: 3421,
    badges: ["top-rated"]
  },
  {
    id: "p-2pc-trowel-set",
    slug: "trowel-set-2pc",
    name: "Trowel Set",
    spec: "11\" & 14\" stainless steel",
    packSize: "2 piece",
    category: "hand-tools",
    subCategory: "trowels",
    merchantSlug: "leeds-builders-supplies",
    priceGbp: 45,
    tradePriceGbp: 38,
    businessPriceGbp: 32,
    currency: "GBP",
    stockState: "in",
    stockQty: 14,
    deliveryPromise: "Free tomorrow",
    collectAvailable: false,
    distanceMi: 22,
    starRating: 4.8,
    reviewCount: 1567,
    badges: ["value-pack"]
  },

  // ─── Power tools ──────────────────────────────────────────
  {
    id: "p-collomix-xo6-mixer",
    slug: "collomix-xo6-mixer",
    name: "Collomix Xo 6 R Mixer",
    spec: "1600W · dual paddle",
    category: "power-tools",
    subCategory: "mixers",
    merchantSlug: "manchester-tools-direct",
    priceGbp: 190,
    tradePriceGbp: 165,
    businessPriceGbp: 155,
    currency: "GBP",
    stockState: "in",
    stockQty: 6,
    deliveryPromise: "Free Next Day",
    collectAvailable: true,
    distanceMi: 4,
    starRating: 4.9,
    reviewCount: 892,
    badges: ["new"]
  },

  // ─── Site materials — buckets, beads, corner beads ─────────
  {
    id: "p-clever-bucket-26l",
    slug: "clever-extra-strong-bucket-26",
    name: "Clever Extra Strong Bucket",
    spec: "26L · black · reinforced rim",
    category: "site-materials",
    subCategory: "buckets",
    merchantSlug: "leeds-builders-supplies",
    priceGbp: 7,
    currency: "GBP",
    stockState: "in",
    stockQty: 300,
    deliveryPromise: "In stock",
    collectAvailable: true,
    distanceMi: 22,
    starRating: 4.7,
    reviewCount: 1234,
    bulkPricing: [
      { qty: 10, unitGbp: 6 },
      { qty: 50, unitGbp: 5 }
    ]
  },
  {
    id: "p-pvc-corner-bead-3m",
    slug: "pvc-corner-bead-3m",
    name: "PVC Corner Bead",
    spec: "3m × 25mm",
    packSize: "Pack of 50",
    category: "site-materials",
    subCategory: "beads",
    merchantSlug: "brighton-tile-warehouse",
    priceGbp: 15,
    tradePriceGbp: 12,
    currency: "GBP",
    stockState: "in",
    stockQty: 80,
    deliveryPromise: "Free tomorrow",
    collectAvailable: false,
    distanceMi: 61,
    starRating: 4.6,
    reviewCount: 956
  },
  {
    id: "p-tilemaster-grouting-sponge",
    slug: "tilemaster-grouting-sponge",
    name: "Tilemaster Grouting Sponge",
    spec: "large · 190×110×70mm",
    category: "site-materials",
    subCategory: "sponges",
    merchantSlug: "brighton-tile-warehouse",
    priceGbp: 3,
    currency: "GBP",
    stockState: "low",
    stockQty: 5,
    deliveryPromise: "Low stock",
    collectAvailable: false,
    distanceMi: 61,
    starRating: 4.7,
    reviewCount: 1123
  },

  // ─── Scaffolding + safety ─────────────────────────────────
  {
    id: "p-scaffold-tube-4m",
    slug: "scaffold-tube-4m",
    name: "Scaffold Tube 4m",
    spec: "48.3mm OD × 4mm wall · galvanised",
    category: "site-materials",
    subCategory: "scaffolding",
    merchantSlug: "glasgow-scaffolding-co",
    priceGbp: 24,
    tradePriceGbp: 21,
    businessPriceGbp: 19,
    currency: "GBP",
    stockState: "in",
    stockQty: 480,
    deliveryPromise: "48h dispatch",
    collectAvailable: true,
    distanceMi: 214,
    starRating: 4.9,
    reviewCount: 2145,
    badges: ["top-rated"],
    bulkPricing: [
      { qty: 25, unitGbp: 22 },
      { qty: 100, unitGbp: 20 },
      { qty: 500, unitGbp: 18 }
    ]
  },
  {
    id: "p-scaffold-clip-double",
    slug: "scaffold-clip-double",
    name: "Scaffold Double Coupler",
    spec: "48.3mm · drop forged · BS EN 74",
    category: "site-materials",
    subCategory: "scaffolding",
    merchantSlug: "glasgow-scaffolding-co",
    priceGbp: 3,
    tradePriceGbp: 2,
    businessPriceGbp: 1,
    currency: "GBP",
    stockState: "in",
    stockQty: 2500,
    deliveryPromise: "48h dispatch",
    collectAvailable: true,
    distanceMi: 214,
    starRating: 4.9,
    reviewCount: 4210,
    bulkPricing: [
      { qty: 50, unitGbp: 2 },
      { qty: 250, unitGbp: 1 }
    ]
  },
  {
    id: "p-scaffold-toe-board",
    slug: "scaffold-toe-board",
    name: "Scaffold Toe Board",
    spec: "3m × 225mm · softwood",
    category: "site-materials",
    subCategory: "scaffolding",
    merchantSlug: "glasgow-scaffolding-co",
    priceGbp: 14,
    tradePriceGbp: 12,
    currency: "GBP",
    stockState: "in",
    stockQty: 320,
    deliveryPromise: "48h dispatch",
    collectAvailable: true,
    distanceMi: 214,
    starRating: 4.7,
    reviewCount: 856
  },

  // ─── Safety PPE ──────────────────────────────────────────
  {
    id: "p-ppe-hardhat-white",
    slug: "ppe-hardhat-white",
    name: "White Vented Hard Hat",
    spec: "EN 397 · adjustable ratchet",
    category: "safety-ppe",
    subCategory: "head-protection",
    merchantSlug: "manchester-tools-direct",
    priceGbp: 12,
    tradePriceGbp: 10,
    currency: "GBP",
    stockState: "in",
    stockQty: 260,
    deliveryPromise: "Free tomorrow",
    collectAvailable: true,
    distanceMi: 4,
    starRating: 4.5,
    reviewCount: 512
  }
];

export function productsByCategory(cat: string): TradeCenterProduct[] {
  return PRODUCT_FIXTURES.filter((p) => p.category === cat);
}

export function findProduct(id: string): TradeCenterProduct | undefined {
  return PRODUCT_FIXTURES.find((p) => p.id === id);
}

/** Simple search — substring match on name + spec + subCategory.
 *  Real search comes through pgvector + tsvector in Wave 2. */
export function searchProductsFixture(q: string): TradeCenterProduct[] {
  const query = q.toLowerCase().trim();
  if (!query) return [];
  return PRODUCT_FIXTURES.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      p.spec.toLowerCase().includes(query) ||
      p.subCategory.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query)
  );
}
