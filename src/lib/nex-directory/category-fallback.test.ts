// Unit tests · pure pickFallback resolver · MUST match .mjs behaviour.

import { describe, it, expect } from "vitest";
import { pickFallback, type LibraryRow } from "./category-fallback";

const libRows: LibraryRow[] = [
  { id: "1", category_slug: "gyms", variant_tag: "modern-gym",     url: "u/gym-modern.jpg",  priority: 10,  active: true, created_at: "2026-08-27T00:00:00Z" },
  { id: "2", category_slug: "gyms", variant_tag: "women-fitness",  url: "u/gym-women.jpg",   priority: 20,  active: true, created_at: "2026-08-27T00:01:00Z" },
  { id: "3", category_slug: "gyms", variant_tag: null,             url: "u/gym-generic.jpg", priority: 100, active: true, created_at: "2026-08-27T00:02:00Z" },
  { id: "4", category_slug: "*",    variant_tag: null,             url: "u/generic.jpg",     priority: 200, active: true, created_at: "2026-08-27T00:03:00Z" },
];

describe("pickFallback · TS mirror of _resolver.mjs", () => {
  it("null when empty library", () => {
    expect(pickFallback({ categorySlug: "gyms", libraryRows: [] })).toBeNull();
  });
  it("null when category has no rows and no '*' generic", () => {
    expect(pickFallback({ categorySlug: "florists", libraryRows: [libRows[0]] })).toBeNull();
  });
  it("preferred variant wins", () => {
    const r = pickFallback({ categorySlug: "gyms", preferredVariants: ["women-fitness"], libraryRows: libRows });
    expect(r?.id).toBe("2");
  });
  it("category-specific untagged beats '*' generic", () => {
    const untaggedOnly = libRows.filter((r) => r.variant_tag === null || r.category_slug === "*");
    const r = pickFallback({ categorySlug: "gyms", libraryRows: untaggedOnly });
    expect(r?.id).toBe("3");
  });
  it("falls to '*' when no category match", () => {
    const r = pickFallback({ categorySlug: "dentists", libraryRows: libRows });
    expect(r?.id).toBe("4");
  });
  it("priority ordering respected", () => {
    const rows: LibraryRow[] = [
      { id: "a", category_slug: "gyms", variant_tag: null, url: "u/a", priority: 50, active: true, created_at: "2026-08-27T00:00:00Z" },
      { id: "b", category_slug: "gyms", variant_tag: null, url: "u/b", priority: 10, active: true, created_at: "2026-08-27T00:00:00Z" },
    ];
    expect(pickFallback({ categorySlug: "gyms", libraryRows: rows })?.id).toBe("b");
  });
});
