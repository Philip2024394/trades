// Stairparts supplier pool — isolation + distribution regression tests.
//
// Rules under test (Philip 2026-08-17 · locked):
//   1. STAIRPARTS_SUPPLIER_POOL is strictly isolated · every URL in it must
//      NOT appear in the general A+ nex-image-manifest, so the diverse
//      picker never surfaces these images on non-stairparts cards.
//   2. isStairpartsSupplier detects `capabilities.kit_or_product_supplier`
//      OR `business_type = REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER`.
//   3. pickStairpartsSupplierImage returns a URL only from the pool,
//      distributes least-used-first with hash tie-break.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  STAIRPARTS_SUPPLIER_POOL,
  isStairpartsSupplier,
  pickStairpartsSupplierImage,
  type DirectorySeed,
} from "./directorySeedLoader";

// Fixture seed used by isStairpartsSupplier tests. Only the fields the
// function actually reads are populated.
const baseSeed = (overrides: Partial<DirectorySeed> = {}): DirectorySeed =>
  ({
    id: "test-seed",
    slug: "test-seed",
    business_name: "Test Company",
    category: null,
    primary_trade: "staircase",
    address_line_1: null,
    address_line_2: null,
    town: null,
    county: null,
    postcode: null,
    country: "United Kingdom",
    region: null,
    telephone: null,
    website: null,
    email: null,
    opening_hours: null,
    description: null,
    services: [],
    google_rating: null,
    google_review_count: null,
    google_maps_url: null,
    latitude: null,
    longitude: null,
    tags: [],
    status: "listed",
    claimed: false,
    verified: false,
    visibility: "public",
    photos: [],
    cover_image: null,
    source: "refacing_discovery",
    imported_at: "2026-08-17T00:00:00Z",
    ...overrides,
  }) as DirectorySeed;

describe("STAIRPARTS_SUPPLIER_POOL isolation from the A+ manifest", () => {
  it("no stairparts pool URL exists in the nex-image-manifest", () => {
    // The manifest lives on disk · this is a config test so we read it once.
    const manifestPath = join(process.cwd(), "data", "nex-image-manifest.json");
    const raw = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(raw) as { images?: Record<string, unknown> };
    const manifestUrls = new Set(Object.keys(manifest.images ?? {}));

    // Compare on raw URL (no `?tr=` transform) since applyCardCrop appends
    // the transform at render time but the manifest key is the raw URL.
    for (const url of STAIRPARTS_SUPPLIER_POOL) {
      expect(
        manifestUrls.has(url),
        `stairparts URL must not be in the A+ manifest: ${url}`,
      ).toBe(false);
    }
  });

  it("pool has at least one URL (empty pool would blank stairparts cards)", () => {
    expect(STAIRPARTS_SUPPLIER_POOL.length).toBeGreaterThan(0);
  });

  it("pool URLs themselves are all unique", () => {
    expect(new Set(STAIRPARTS_SUPPLIER_POOL).size).toBe(STAIRPARTS_SUPPLIER_POOL.length);
  });
});

describe("isStairpartsSupplier detection", () => {
  it("returns true when capabilities.kit_or_product_supplier is 'yes'", () => {
    const seed = baseSeed({ capabilities: { kit_or_product_supplier: "yes" } });
    expect(isStairpartsSupplier(seed)).toBe(true);
  });

  it("returns true when business_type is REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER", () => {
    const seed = baseSeed();
    (seed as unknown as { business_type?: string }).business_type =
      "REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER";
    expect(isStairpartsSupplier(seed)).toBe(true);
  });

  it("returns false for a plain staircase manufacturer", () => {
    const seed = baseSeed({
      capabilities: { manufacture: "yes", installation: "yes" },
    });
    (seed as unknown as { business_type?: string }).business_type =
      "STAIRCASE_MANUFACTURER";
    expect(isStairpartsSupplier(seed)).toBe(false);
  });

  it("returns false when capability flag is missing or 'unknown'", () => {
    expect(isStairpartsSupplier(baseSeed({ capabilities: {} }))).toBe(false);
    expect(
      isStairpartsSupplier(baseSeed({ capabilities: { kit_or_product_supplier: "unknown" } })),
    ).toBe(false);
    expect(
      isStairpartsSupplier(baseSeed({ capabilities: { kit_or_product_supplier: "no" } })),
    ).toBe(false);
  });
});

describe("pickStairpartsSupplierImage distribution", () => {
  it("only returns URLs from STAIRPARTS_SUPPLIER_POOL", () => {
    const pool = new Set(STAIRPARTS_SUPPLIER_POOL);
    const usedCounts = new Map<string, number>();
    for (let i = 0; i < 40; i++) {
      const url = pickStairpartsSupplierImage(`seed-${i}`, usedCounts, "2026-08-17");
      expect(url).not.toBeNull();
      if (url) {
        expect(pool.has(url)).toBe(true);
        usedCounts.set(url, (usedCounts.get(url) ?? 0) + 1);
      }
    }
  });

  it("distributes evenly across the pool before any URL is reused", () => {
    const usedCounts = new Map<string, number>();
    for (let i = 0; i < STAIRPARTS_SUPPLIER_POOL.length; i++) {
      const url = pickStairpartsSupplierImage(`seed-${i}`, usedCounts, "2026-08-17");
      if (url) usedCounts.set(url, (usedCounts.get(url) ?? 0) + 1);
    }
    // Every pool URL should be at exactly count 1 · nobody at 0, nobody at 2.
    const counts = [...usedCounts.values()].sort();
    const expected = STAIRPARTS_SUPPLIER_POOL.map(() => 1);
    expect(counts).toEqual(expected);
  });

  it("least-used-first prevents concentration when suppliers > pool size", () => {
    // Simulate 3× as many suppliers as pool images. Every URL should end
    // at either floor(N/pool) or ceil(N/pool) — never a runaway winner.
    const N = STAIRPARTS_SUPPLIER_POOL.length * 3;
    const usedCounts = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const url = pickStairpartsSupplierImage(`seed-${i}`, usedCounts, "2026-08-17");
      if (url) usedCounts.set(url, (usedCounts.get(url) ?? 0) + 1);
    }
    const counts = [...usedCounts.values()];
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    expect(max - min).toBeLessThanOrEqual(1);
  });
});
