// src/lib/nex-native/directory/__tests__/category-image-resolver.test.ts
//
// NEX Directory · P0 · category-image-resolver tests.
//
// Covers
//   · No library row → null
//   · Empty library + unknown entity type → null
//   · Tier-3 match on category_slug === entityType (the production path
//     for today's food rows whose category_ids is empty)
//   · Tier-2 match on category_slug ∈ categoryIds
//   · Tier-1 match on category_slug ∈ categoryIds AND variant_tag ∈ categoryIds
//   · Tier-4 wildcard match ('*')
//   · Priority tie-break (lower priority wins; equal priority → variant pick)
//   · Deterministic variant pick (same canonical id → same chosen row)
//   · Different canonical ids distribute across variants (non-degenerate)
//   · Inactive rows are ignored
//   · isRepresentative is literally `true` (ADR-0022 contract)
//
// No DB, no network. The server-only `getCategoryImageLibrary` is NOT
// exercised here · it is covered by the live-page probe in the P0
// verification step.

import { describe, expect, it } from "vitest";
import {
  resolveCategoryImage,
  type CategoryImageLibraryRow,
  type CategoryImageResolved,
} from "../category-image-resolver";

// ═════════════════════════════════════════════════════════════════════
// §1 · Fixtures
// ═════════════════════════════════════════════════════════════════════

function makeRow(partial: Partial<CategoryImageLibraryRow> & {
  readonly id: string;
  readonly category_slug: string;
  readonly url: string;
}): CategoryImageLibraryRow {
  return {
    id: partial.id,
    category_slug: partial.category_slug,
    variant_tag: "variant_tag" in partial ? partial.variant_tag! : null,
    url: partial.url,
    attribution:
      "attribution" in partial ? partial.attribution! : "NEX design system",
    licence: "licence" in partial ? partial.licence! : "NEX internal",
    priority: partial.priority ?? 100,
    active: "active" in partial ? partial.active! : true,
    created_at: partial.created_at ?? "2026-10-09T00:00:00Z",
  };
}

/** The 10-variant food library · mirrors what the seed script writes. */
function foodLibrary(): CategoryImageLibraryRow[] {
  const variants = [
    "restaurant",
    "cafe",
    "warung",
    "bakery",
    "street-food",
    "fine-dining",
    "seafood",
    "fast-food",
    "dessert",
    "bar-pub",
  ];
  return variants.map((v, i) =>
    makeRow({
      id: `00000000-0000-4000-8000-00000000000${i.toString(16)}`,
      category_slug: "food",
      variant_tag: v,
      url: `/nex-category-fallbacks/food-${v}.svg`,
      created_at: `2026-10-09T00:00:0${i}.000Z`,
    }),
  );
}

const CANONICAL_A = "11111111-1111-4111-8111-111111111111";
const CANONICAL_B = "22222222-2222-4222-8222-222222222222";
const CANONICAL_C = "33333333-3333-4333-8333-333333333333";
const CANONICAL_D = "44444444-4444-4444-8444-444444444444";

// ═════════════════════════════════════════════════════════════════════
// §2 · No-match cases
// ═════════════════════════════════════════════════════════════════════

describe("resolveCategoryImage · no match", () => {
  it("returns null when library is empty", () => {
    const r = resolveCategoryImage({
      libraryRows: [],
      entityType: "food",
      categoryIds: [],
      canonicalBusinessId: CANONICAL_A,
    });
    expect(r).toBeNull();
  });

  it("returns null when no row matches any tier (no entity, no category, no wildcard)", () => {
    const lib = [
      makeRow({ id: "r1", category_slug: "accommodation", url: "/x.svg" }),
      makeRow({ id: "r2", category_slug: "service", url: "/y.svg" }),
    ];
    const r = resolveCategoryImage({
      libraryRows: lib,
      entityType: "food",
      categoryIds: ["restaurant"],
      canonicalBusinessId: CANONICAL_A,
    });
    expect(r).toBeNull();
  });

  it("ignores inactive rows even when their slug matches", () => {
    const lib = [
      makeRow({
        id: "r1",
        category_slug: "food",
        variant_tag: "cafe",
        url: "/food-cafe.svg",
        active: false,
      }),
    ];
    const r = resolveCategoryImage({
      libraryRows: lib,
      entityType: "food",
      categoryIds: [],
      canonicalBusinessId: CANONICAL_A,
    });
    expect(r).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Tier matching
// ═════════════════════════════════════════════════════════════════════

describe("resolveCategoryImage · tiered matching", () => {
  it("tier-3 matches category_slug === entityType when categoryIds is empty", () => {
    const lib = foodLibrary();
    const r = resolveCategoryImage({
      libraryRows: lib,
      entityType: "food",
      categoryIds: [],
      canonicalBusinessId: CANONICAL_A,
    });
    expect(r).not.toBeNull();
    expect(r!.category_slug).toBe("food");
    expect(r!.url.startsWith("/nex-category-fallbacks/food-")).toBe(true);
    expect(r!.isRepresentative).toBe(true);
  });

  it("tier-2 matches category_slug ∈ categoryIds (wins over tier-3 entityType)", () => {
    const lib = [
      // tier-3 candidate · entity_type match
      makeRow({ id: "r1", category_slug: "food", variant_tag: null, url: "/food-generic.svg" }),
      // tier-2 candidate · category_ids match (should win)
      makeRow({ id: "r2", category_slug: "cafe", variant_tag: null, url: "/cafe-wins.svg" }),
    ];
    const r = resolveCategoryImage({
      libraryRows: lib,
      entityType: "food",
      categoryIds: ["cafe"],
      canonicalBusinessId: CANONICAL_A,
    });
    expect(r).not.toBeNull();
    expect(r!.url).toBe("/cafe-wins.svg");
    expect(r!.category_slug).toBe("cafe");
  });

  it("tier-1 matches (category_slug ∈ categoryIds AND variant_tag ∈ categoryIds)", () => {
    const lib = [
      makeRow({ id: "r1", category_slug: "food", variant_tag: null, url: "/food-generic.svg" }),
      // tier-2 only (slug match)
      makeRow({ id: "r2", category_slug: "food", variant_tag: "warung", url: "/food-warung.svg" }),
      // tier-1 · slug AND variant both in categoryIds
      makeRow({
        id: "r3",
        category_slug: "food",
        variant_tag: "fine-dining",
        url: "/food-fine-dining.svg",
      }),
    ];
    const r = resolveCategoryImage({
      libraryRows: lib,
      entityType: "food",
      categoryIds: ["food", "fine-dining"],
      canonicalBusinessId: CANONICAL_A,
    });
    expect(r).not.toBeNull();
    expect(r!.url).toBe("/food-fine-dining.svg");
    expect(r!.variant_tag).toBe("fine-dining");
  });

  it("tier-4 wildcard matches when nothing else does", () => {
    const lib = [
      makeRow({ id: "r1", category_slug: "service", url: "/service.svg" }),
      makeRow({ id: "r2", category_slug: "*", url: "/wildcard.svg" }),
    ];
    const r = resolveCategoryImage({
      libraryRows: lib,
      entityType: "food",
      categoryIds: [],
      canonicalBusinessId: CANONICAL_A,
    });
    expect(r).not.toBeNull();
    expect(r!.url).toBe("/wildcard.svg");
    expect(r!.category_slug).toBe("*");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Priority tie-break
// ═════════════════════════════════════════════════════════════════════

describe("resolveCategoryImage · priority tie-break", () => {
  it("lower priority number wins", () => {
    const lib = [
      makeRow({
        id: "r1",
        category_slug: "food",
        variant_tag: "cafe",
        url: "/cafe.svg",
        priority: 50,
      }),
      makeRow({
        id: "r2",
        category_slug: "food",
        variant_tag: "warung",
        url: "/warung.svg",
        priority: 100,
      }),
    ];
    const r = resolveCategoryImage({
      libraryRows: lib,
      entityType: "food",
      categoryIds: [],
      canonicalBusinessId: CANONICAL_A,
    });
    expect(r).not.toBeNull();
    expect(r!.url).toBe("/cafe.svg");
  });

  it("within equal priority, variant pick is deterministic per canonical id", () => {
    const lib = foodLibrary();

    const a1 = resolveCategoryImage({
      libraryRows: lib,
      entityType: "food",
      categoryIds: [],
      canonicalBusinessId: CANONICAL_A,
    });
    const a2 = resolveCategoryImage({
      libraryRows: lib,
      entityType: "food",
      categoryIds: [],
      canonicalBusinessId: CANONICAL_A,
    });
    expect(a1).toEqual(a2);
    expect(a1!.url).toBe(a2!.url);
  });

  it("different canonical ids distribute across multiple variants", () => {
    const lib = foodLibrary();
    const picked = new Set<string>();
    for (const id of [CANONICAL_A, CANONICAL_B, CANONICAL_C, CANONICAL_D]) {
      const r = resolveCategoryImage({
        libraryRows: lib,
        entityType: "food",
        categoryIds: [],
        canonicalBusinessId: id,
      });
      expect(r).not.toBeNull();
      picked.add(r!.url);
    }
    // 4 canonical ids over 10 variants shouldn't collapse to 1 variant.
    expect(picked.size).toBeGreaterThan(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · ADR-0022 flag contract
// ═════════════════════════════════════════════════════════════════════

describe("resolveCategoryImage · ADR-0022 contract", () => {
  it("always sets isRepresentative = true on a resolved image", () => {
    const lib = foodLibrary();
    const r = resolveCategoryImage({
      libraryRows: lib,
      entityType: "food",
      categoryIds: [],
      canonicalBusinessId: CANONICAL_A,
    });
    expect(r).not.toBeNull();
    const narrowed: CategoryImageResolved = r!;
    // Literal-type check at the value level · the type guarantees
    // this at the type level.
    expect(narrowed.isRepresentative).toBe(true);
  });

  it("falls back to 'unspecified' when licence is null", () => {
    const lib = [
      makeRow({
        id: "r1",
        category_slug: "food",
        url: "/x.svg",
        licence: null,
      }),
    ];
    const r = resolveCategoryImage({
      libraryRows: lib,
      entityType: "food",
      categoryIds: [],
      canonicalBusinessId: CANONICAL_A,
    });
    expect(r).not.toBeNull();
    expect(r!.licence).toBe("unspecified");
  });
});
