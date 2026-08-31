// Unit tests · category image library resolver · Philip E · 2026-08-27.

import { describe, it, expect } from "vitest";
import { pickFallback, resolveBestImage } from "./_resolver.mjs";

const libRows = [
  { id: "1", category_slug: "gyms", variant_tag: "modern-gym", url: "https://cdn/gym-modern.jpg", priority: 10, active: true, created_at: "2026-08-27T00:00:00Z" },
  { id: "2", category_slug: "gyms", variant_tag: "women-fitness", url: "https://cdn/gym-women.jpg", priority: 20, active: true, created_at: "2026-08-27T00:01:00Z" },
  { id: "3", category_slug: "gyms", variant_tag: null,           url: "https://cdn/gym-generic.jpg", priority: 100, active: true, created_at: "2026-08-27T00:02:00Z" },
  { id: "4", category_slug: "*",     variant_tag: null,           url: "https://cdn/generic.jpg", priority: 200, active: true, created_at: "2026-08-27T00:03:00Z" },
  { id: "5", category_slug: "salons", variant_tag: "mens-barber", url: "https://cdn/salon-mens.jpg", priority: 10, active: true, created_at: "2026-08-27T00:04:00Z" },
  { id: "6", category_slug: "gyms", variant_tag: "cardio",       url: "https://cdn/gym-cardio.jpg", priority: 30, active: false, created_at: "2026-08-27T00:05:00Z" },
];

describe("pickFallback", () => {
  it("returns null when library is empty", () => {
    expect(pickFallback({ categorySlug: "gyms", libraryRows: [] })).toBeNull();
  });

  it("returns null when no category match", () => {
    expect(pickFallback({ categorySlug: "florists", libraryRows: [{ id: "x", category_slug: "gyms", url: "u", priority: 10, active: true, created_at: "z" }] })).toBeNull();
  });

  it("prefers requested variant when present", () => {
    const r = pickFallback({
      categorySlug: "gyms",
      preferredVariants: ["women-fitness"],
      libraryRows: libRows,
    });
    expect(r?.id).toBe("2");
  });

  it("respects preferredVariants order (first hit wins)", () => {
    const r = pickFallback({
      categorySlug: "gyms",
      preferredVariants: ["nonexistent", "women-fitness", "modern-gym"],
      libraryRows: libRows,
    });
    expect(r?.id).toBe("2");
  });

  it("falls back to lowest-priority variant when no variant preference matches", () => {
    const r = pickFallback({
      categorySlug: "gyms",
      preferredVariants: ["nonexistent"],
      libraryRows: libRows,
    });
    // Variant-tagged category-specific · lowest priority = id "1" (modern-gym, priority 10)
    expect(r?.id).toBe("1");
  });

  it("uses category-specific untagged over '*' generic when no variants", () => {
    // Filter to only untagged rows so no variant-tagged gyms are picked
    const untaggedOnlyLib = libRows.filter((r) => r.variant_tag === null || r.category_slug === "*");
    const r = pickFallback({
      categorySlug: "gyms",
      libraryRows: untaggedOnlyLib,
    });
    expect(r?.id).toBe("3");   // gyms untagged
  });

  it("falls back to '*' generic when category has no rows at all", () => {
    const r = pickFallback({
      categorySlug: "dentists",
      libraryRows: libRows,
    });
    expect(r?.id).toBe("4");
  });

  it("excludes inactive rows", () => {
    // id 6 (cardio) is inactive · request cardio explicitly · should get another gym variant
    const r = pickFallback({
      categorySlug: "gyms",
      preferredVariants: ["cardio"],
      libraryRows: libRows,
    });
    expect(r?.id).not.toBe("6");
  });

  it("respects priority ordering within same variant class", () => {
    const rows = [
      { id: "a", category_slug: "gyms", variant_tag: null, url: "u1", priority: 50, active: true, created_at: "2026-08-27T00:00:00Z" },
      { id: "b", category_slug: "gyms", variant_tag: null, url: "u2", priority: 10, active: true, created_at: "2026-08-27T00:00:00Z" },
    ];
    const r = pickFallback({ categorySlug: "gyms", libraryRows: rows });
    expect(r?.id).toBe("b");
  });
});

describe("resolveBestImage · Universal Image Doctrine order", () => {
  it("OWNER_IMAGE wins over verified + fallback", () => {
    const r = resolveBestImage({
      ownerImageUrl: "https://owner.jpg",
      verifiedRealUrl: "https://verified.jpg",
      categorySlug: "gyms",
      libraryRows: libRows,
    });
    expect(r).toEqual({ url: "https://owner.jpg", source: "owner" });
  });

  it("VERIFIED_REAL wins over fallback when no owner image", () => {
    const r = resolveBestImage({
      ownerImageUrl: null,
      verifiedRealUrl: "https://verified.jpg",
      categorySlug: "gyms",
      libraryRows: libRows,
    });
    expect(r).toEqual({ url: "https://verified.jpg", source: "verified" });
  });

  it("Falls back to CATEGORY_FALLBACK when neither exists", () => {
    const r = resolveBestImage({
      ownerImageUrl: null,
      verifiedRealUrl: null,
      categorySlug: "gyms",
      preferredVariants: ["modern-gym"],
      libraryRows: libRows,
    });
    expect(r?.source).toBe("fallback");
    expect(r?.url).toBe("https://cdn/gym-modern.jpg");
    expect(r?.libraryRow?.id).toBe("1");
  });

  it("Returns null when nothing at all is available", () => {
    const r = resolveBestImage({
      ownerImageUrl: null,
      verifiedRealUrl: null,
      categorySlug: "florists",
      libraryRows: [],
    });
    expect(r).toBeNull();
  });
});
