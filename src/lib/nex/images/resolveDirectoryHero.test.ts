// Universal Directory Hero Resolver · unit tests · Phase 1 · 2026-08-22.
//
// Covers all 7 acceptance tests from the Universal Image Doctrine
// (project_nex_universal_directory_image_doctrine_2026_08_22) plus
// invariants (never null, Direct-Provenance A carry-forward, country isolation,
// approval gates, fallback category presence).

import { describe, expect, it } from "vitest";
import { resolveDirectoryHero } from "./resolveDirectoryHero";
import type { BusinessImageRow, ImageType } from "./types";

const BASE = {
  businessType: "food",
  businessCountry: "ID",
  businessRef: "#FL-TEST-001",
  categoryId: "restaurant",
} as const;

const UNIVERSAL = "https://fixture.example/universal-fallback.jpg";

// Fixture library: only 'restaurant' + 'hotel' in ID.
function fixtureFallback(categoryId: string, country: string): string | null {
  if (country === "ID" && categoryId === "restaurant") return "https://fixture.example/restaurant-ID.jpg";
  if (country === "ID" && categoryId === "hotel")      return "https://fixture.example/hotel-ID.jpg";
  return null;
}

let rowCounter = 0;
function makeRow(overrides: Partial<BusinessImageRow> = {}): BusinessImageRow {
  rowCounter += 1;
  return {
    id: `test-row-${rowCounter}`,
    business_type: "food",
    business_country: "ID",
    business_ref: "#FL-TEST-001",
    image_type: "OWNER_IMAGE" as ImageType,
    url: "https://example.com/img.jpg",
    source: "test",
    provenance: null,
    confidence: null,
    cycle_run_id: null,
    fallback_category: null,
    owner_approved: false,
    approved: true,
    created_at: "2026-08-22T00:00:00Z",
    updated_at: "2026-08-22T00:00:00Z",
    ...overrides,
  };
}

describe("resolveDirectoryHero · acceptance tests 1-7", () => {
  it("Test 1: verified real business image → displayed as VERIFIED_REAL", () => {
    const rows = [
      makeRow({
        image_type: "VERIFIED_REAL",
        url: "https://verified.example/x.jpg",
        approved: true,
        cycle_run_id: "cycle-1",
      }),
    ];
    const out = resolveDirectoryHero({ ...BASE, images: rows, fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).toBe("VERIFIED_REAL");
    expect(out.url).toBe("https://verified.example/x.jpg");
  });

  it("Test 2: owner image + verified real coexist → OWNER_IMAGE wins", () => {
    const rows = [
      makeRow({ image_type: "OWNER_IMAGE",   url: "https://owner.example/x.jpg",   approved: true }),
      makeRow({ image_type: "VERIFIED_REAL", url: "https://verified.example/x.jpg", approved: true, cycle_run_id: "c-1" }),
    ];
    const out = resolveDirectoryHero({ ...BASE, images: rows, fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).toBe("OWNER_IMAGE");
    expect(out.url).toBe("https://owner.example/x.jpg");
  });

  it("Test 3: no real image + fallback library has entry → CATEGORY_FALLBACK from library", () => {
    const out = resolveDirectoryHero({ ...BASE, images: [], fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).toBe("CATEGORY_FALLBACK");
    expect(out.url).toBe("https://fixture.example/restaurant-ID.jpg");
    expect(out.fallbackCategory).toBe("restaurant");
    expect(out.source).toBe("nex.categoryLibrary");
  });

  it("Test 4: owner accepts keep-fallback → CATEGORY_FALLBACK preserved (resolver never re-labels)", () => {
    // Owner accepting keep-fallback = NO OWNER_IMAGE row is created.
    // Resolver still returns CATEGORY_FALLBACK. Provenance stays honest.
    const out = resolveDirectoryHero({ ...BASE, images: [], fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).toBe("CATEGORY_FALLBACK");
    expect(out.fallbackCategory).toBe("restaurant");
  });

  it("Test 5: owner uploads → OWNER_IMAGE replaces fallback", () => {
    const rows = [
      makeRow({ image_type: "OWNER_IMAGE", url: "https://owner.example/uploaded.jpg", approved: true }),
    ];
    const out = resolveDirectoryHero({ ...BASE, images: rows, fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).toBe("OWNER_IMAGE");
    expect(out.url).toBe("https://owner.example/uploaded.jpg");
  });

  it("Test 6: rejected low-confidence VERIFIED_REAL (approved=false) → NEVER displayed", () => {
    const rows = [
      makeRow({
        image_type: "VERIFIED_REAL",
        url: "https://rejected.example/x.jpg",
        approved: false,
        confidence: 0.63,
        cycle_run_id: "c-1",
      }),
    ];
    const out = resolveDirectoryHero({ ...BASE, images: rows, fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).not.toBe("VERIFIED_REAL");
    expect(out.imageType).toBe("CATEGORY_FALLBACK");
    expect(out.url).toBe("https://fixture.example/restaurant-ID.jpg");
    expect(out.url).not.toBe("https://rejected.example/x.jpg");
  });

  it("Test 7: unknown category → universal fallback · never null", () => {
    const out = resolveDirectoryHero({
      ...BASE,
      categoryId: "diving",              // no entry in fixture library
      images: [],
      fallbackLookup: fixtureFallback,
      universalFallback: UNIVERSAL,
    });
    expect(out.imageType).toBe("CATEGORY_FALLBACK");
    expect(out.url).toBe(UNIVERSAL);
    expect(out.fallbackCategory).toBe("universal");
    expect(out.source).toBe("nex.universalFallback");
  });
});

describe("resolveDirectoryHero · invariants", () => {
  it("Invariant: resolver NEVER returns null (empty images + null fallback → universal)", () => {
    const out = resolveDirectoryHero({
      ...BASE,
      images: [],
      fallbackLookup: () => null,
      universalFallback: UNIVERSAL,
    });
    expect(out).not.toBeNull();
    expect(out.url).toBe(UNIVERSAL);
    expect(out.imageType).toBe("CATEGORY_FALLBACK");
  });

  it("Invariant: VERIFIED_REAL output carries cycleRunId (Direct-Provenance A)", () => {
    const rows = [
      makeRow({ image_type: "VERIFIED_REAL", approved: true, cycle_run_id: "cycle-abc-123" }),
    ];
    const out = resolveDirectoryHero({ ...BASE, images: rows, fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).toBe("VERIFIED_REAL");
    expect(out.cycleRunId).toBe("cycle-abc-123");
  });

  it("Invariant: CATEGORY_FALLBACK output carries fallbackCategory", () => {
    const out = resolveDirectoryHero({ ...BASE, images: [], fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).toBe("CATEGORY_FALLBACK");
    expect(out.fallbackCategory).toBeDefined();
    expect(out.fallbackCategory).toBe("restaurant");
  });

  it("Invariant: unapproved OWNER_IMAGE is not returned (owner_approved gate)", () => {
    const rows = [
      makeRow({ image_type: "OWNER_IMAGE", url: "https://unapproved.example/x.jpg", approved: false }),
    ];
    const out = resolveDirectoryHero({ ...BASE, images: rows, fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).not.toBe("OWNER_IMAGE");
    expect(out.imageType).toBe("CATEGORY_FALLBACK");
  });
});

describe("resolveDirectoryHero · country isolation", () => {
  it("Rows for a different business_country are filtered out", () => {
    const rows = [
      makeRow({
        business_country: "GB",
        image_type: "OWNER_IMAGE",
        url: "https://gb-owner.example/x.jpg",
        approved: true,
      }),
    ];
    const out = resolveDirectoryHero({ ...BASE, images: rows, fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).toBe("CATEGORY_FALLBACK");
    expect(out.url).not.toBe("https://gb-owner.example/x.jpg");
    expect(out.url).toBe("https://fixture.example/restaurant-ID.jpg");
  });

  it("Same categoryId in a different country resolves to that country's library (or universal)", () => {
    // GB has no restaurant fallback in fixture → universal.
    const out = resolveDirectoryHero({
      ...BASE,
      businessCountry: "GB",
      images: [],
      fallbackLookup: fixtureFallback,
      universalFallback: UNIVERSAL,
    });
    expect(out.imageType).toBe("CATEGORY_FALLBACK");
    expect(out.url).toBe(UNIVERSAL);
  });

  it("Same categoryId, same country → same library URL", () => {
    const a = resolveDirectoryHero({ ...BASE, images: [], fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    const b = resolveDirectoryHero({ ...BASE, images: [], fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(a.url).toBe(b.url);
    expect(a.imageType).toBe(b.imageType);
  });
});

describe("resolveDirectoryHero · row scoping safety", () => {
  it("Rows for a different business_ref are filtered out", () => {
    const rows = [
      makeRow({
        business_ref: "#FL-OTHER-999",
        image_type: "OWNER_IMAGE",
        url: "https://other-owner.example/x.jpg",
        approved: true,
      }),
    ];
    const out = resolveDirectoryHero({ ...BASE, images: rows, fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).toBe("CATEGORY_FALLBACK");
    expect(out.url).not.toBe("https://other-owner.example/x.jpg");
  });

  it("Rows for a different business_type are filtered out", () => {
    const rows = [
      makeRow({
        business_type: "accommodation",
        image_type: "OWNER_IMAGE",
        url: "https://acc-owner.example/x.jpg",
        approved: true,
      }),
    ];
    const out = resolveDirectoryHero({ ...BASE, images: rows, fallbackLookup: fixtureFallback, universalFallback: UNIVERSAL });
    expect(out.imageType).toBe("CATEGORY_FALLBACK");
    expect(out.url).not.toBe("https://acc-owner.example/x.jpg");
  });
});
