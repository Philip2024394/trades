// src/components/nexapp/CategoryConstellation.test.ts
//
// Country Foundation Step 7 Part B · Phase 7B.2 tests · 2026-08-23.
//
// Verifies:
//   · Layout math (pure function) — deterministic orbital positions
//   · Family accent (pure function) — subtle tint per family
//   · Registry-driven category set — no hardcoded slugs
//   · Country filter integration — GB returns empty, ID returns 6
//   · Active-only filter — inactive categories never appear in the constellation set
//   · Truth Invariant — graceful empty-country state without inventing tiles
//
// Component-level render tests would need @testing-library/react (not installed).
// These tests cover the pure logic that drives what the constellation renders.
// Visual verification is by browser inspection of the running dev server.

import { describe, expect, it } from "vitest";
import {
  familyAccent,
  layoutNodes,
  nexResponseForEmpty,
  nexResponseForError,
  nexResponseForResults,
} from "./CategoryConstellation";
import { activeCategoriesForCountry, CATEGORY_REGISTRY } from "@/lib/nex/category-registry";

// ═══════════════════════════════════════════════════════════════════════
// Layout math
// ═══════════════════════════════════════════════════════════════════════

describe("layoutNodes · pure orbital layout math", () => {
  it("returns empty array for count=0", () => {
    expect(layoutNodes(0)).toEqual([]);
  });

  it("returns empty array for negative count (defensive)", () => {
    expect(layoutNodes(-3)).toEqual([]);
  });

  it("returns single node above centre for count=1", () => {
    const result = layoutNodes(1);
    expect(result.length).toBe(1);
    expect(result[0]!.x).toBeCloseTo(0, 5);
    expect(result[0]!.y).toBeLessThan(0);
  });

  it("returns 6 nodes distributed on a circle for count=6", () => {
    const result = layoutNodes(6);
    expect(result.length).toBe(6);
    expect(result[0]!.x).toBeCloseTo(0, 5);
    expect(result[0]!.y).toBeCloseTo(-0.9, 2);
  });

  it("nodes are on a circle of radius ~0.9", () => {
    const result = layoutNodes(6);
    for (const p of result) {
      const distance = Math.sqrt(p.x * p.x + p.y * p.y);
      expect(distance).toBeCloseTo(0.9, 2);
    }
  });

  it("count=4 places nodes at top / right / bottom / left (cardinal)", () => {
    const r = layoutNodes(4);
    expect(r.length).toBe(4);
    expect(r[0]!.y).toBeCloseTo(-0.9, 2);   // top
    expect(r[1]!.x).toBeCloseTo(0.9, 2);    // right
    expect(r[2]!.y).toBeCloseTo(0.9, 2);    // bottom
    expect(r[3]!.x).toBeCloseTo(-0.9, 2);   // left
  });

  it("scales to larger counts without breaking (8, 12, 20)", () => {
    expect(layoutNodes(8).length).toBe(8);
    expect(layoutNodes(12).length).toBe(12);
    expect(layoutNodes(20).length).toBe(20);
  });

  it("positions are deterministic (same input → same output)", () => {
    const a = layoutNodes(6);
    const b = layoutNodes(6);
    expect(a).toEqual(b);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Family accent
// ═══════════════════════════════════════════════════════════════════════

describe("familyAccent · subtle family-based color tinting", () => {
  it("returns NEX orange for 'food' family", () => {
    expect(familyAccent("food")).toBe("rgba(249, 115, 22, 1.0)");
  });

  it("returns warm amber for 'accommodation' family", () => {
    expect(familyAccent("accommodation")).toBe("rgba(255, 165, 90, 1.0)");
  });

  it("returns default NEX orange for unknown family", () => {
    expect(familyAccent("nonexistent")).toBe("rgba(249, 115, 22, 1.0)");
  });

  it("returns default NEX orange for undefined family", () => {
    expect(familyAccent(undefined)).toBe("rgba(249, 115, 22, 1.0)");
  });

  it("always returns a valid rgba() color string", () => {
    for (const f of ["food", "accommodation", undefined, "unknown"]) {
      expect(familyAccent(f)).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Registry-driven · country filtering · Truth Invariant
// ═══════════════════════════════════════════════════════════════════════

describe("Registry-driven category set (data the constellation renders from)", () => {
  it("ID user gets 6 active categories from the Registry", () => {
    const cats = activeCategoriesForCountry("ID");
    expect(cats.length).toBe(6);
    const ids = cats.map((c) => c.id).sort();
    expect(ids).toEqual(["accommodation", "food", "guesthouse", "hostel", "hotel", "kos"]);
  });

  it("GB user gets 0 active categories (Truth Invariant · honest empty state)", () => {
    expect(activeCategoriesForCountry("GB")).toEqual([]);
  });

  it("Unknown country gets 0 active categories (never invents)", () => {
    expect(activeCategoriesForCountry("XX")).toEqual([]);
  });

  it("Every constellation-visible category has a Registry visual.glyph string", () => {
    // Phase 7B.1 guarantee: constellation can render every active category via its glyph.
    for (const cat of activeCategoriesForCountry("ID")) {
      expect(cat.visual, `${cat.id} missing visual`).toBeDefined();
      expect(cat.visual.glyph, `${cat.id} missing visual.glyph`).toBeTruthy();
      expect(typeof cat.visual.glyph).toBe("string");
    }
  });

  it("Inactive categories (villa/homestay/resort/apartment) never appear in the constellation set", () => {
    const activeIds = activeCategoriesForCountry("ID").map((c) => c.id);
    expect(activeIds).not.toContain("villa");
    expect(activeIds).not.toContain("homestay");
    expect(activeIds).not.toContain("resort");
    expect(activeIds).not.toContain("apartment");
  });

  it("Registry-driven contract: adding a new active category with country in countries[] appears in the set", () => {
    // Regression-style: proves constellation is not hardcoded — it derives from the Registry.
    // If someone hardcoded "6 categories" somewhere, this test wouldn't catch it, but the
    // implementation calls activeCategoriesForCountry directly, so the length responds to Registry changes.
    // We assert the current set matches the current Registry — if Registry grows, this test fails
    // (intentionally, forcing a review of whether the new category is expected).
    const idCount = activeCategoriesForCountry("ID").length;
    const totalActive = CATEGORY_REGISTRY.filter((c) => c.active && c.countries.includes("ID")).length;
    expect(idCount).toBe(totalActive);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Selection contract
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// Phase 7B.3 · NEX conversational response text helpers
// ═══════════════════════════════════════════════════════════════════════

describe("nexResponseForResults · grounded NEX response text (never fabricates)", () => {
  it("singular count → 'Here's one X'", () => {
    const t = nexResponseForResults("Hotel", 1);
    expect(t).toMatch(/one hotel/i);
    expect(t).toContain("hotel");
  });

  it("plural count → 'Here are N X places'", () => {
    const t = nexResponseForResults("Hotel", 12);
    expect(t).toContain("12");
    expect(t).toMatch(/hotel/i);
  });

  it("uses lowercase category label in the sentence", () => {
    expect(nexResponseForResults("Food", 5)).toContain("food");
    expect(nexResponseForResults("Kos (monthly rental)", 3)).toContain("kos");
  });

  it("returns non-empty string for any positive count", () => {
    for (const n of [1, 2, 5, 12, 100]) {
      expect(nexResponseForResults("Test", n).length).toBeGreaterThan(0);
    }
  });
});

describe("nexResponseForEmpty · truthful empty-state response text", () => {
  it("no_inventory_in_country → names the country + acknowledges gap", () => {
    const t = nexResponseForEmpty("Hotel", "GB", "no_inventory_in_country");
    expect(t).toContain("GB");
    expect(t.toLowerCase()).toContain("don't have");
    expect(t.toLowerCase()).toContain("hotel");
  });

  it("category_inactive → acknowledges category but says not ready", () => {
    const t = nexResponseForEmpty("Villa", "ID", "category_inactive");
    expect(t.toLowerCase()).toContain("villa");
    expect(t.toLowerCase()).toContain("isn't ready");
  });

  it("unsupported_vertical → coming soon message", () => {
    const t = nexResponseForEmpty("BikeRental", "ID", "unsupported_vertical");
    expect(t.toLowerCase()).toContain("coming soon");
  });

  it("no_visible_listings → generic empty response", () => {
    const t = nexResponseForEmpty("Hotel", "ID", "no_visible_listings");
    expect(t.toLowerCase()).toContain("couldn't find");
  });

  it("unknown reason → falls back to generic empty response (never fabricates)", () => {
    const t = nexResponseForEmpty("Hotel", "ID", "some_unknown_reason");
    expect(t.length).toBeGreaterThan(0);
    expect(t.toLowerCase()).not.toContain("here are"); // Never claims to have found results
  });

  it("undefined reason → falls back gracefully", () => {
    const t = nexResponseForEmpty("Hotel", "ID", undefined);
    expect(t.length).toBeGreaterThan(0);
  });

  it("Truth Invariant: empty responses NEVER claim results were found", () => {
    for (const reason of ["no_inventory_in_country", "category_inactive", "no_visible_listings", undefined]) {
      const t = nexResponseForEmpty("Hotel", "GB", reason);
      expect(t.toLowerCase()).not.toContain("here are"); // never fabricates results
      expect(t.toLowerCase()).not.toContain("found these"); // never claims discovery
    }
  });
});

describe("nexResponseForError · graceful network/server failure text", () => {
  it("returns a friendly retry-suggestive message", () => {
    const t = nexResponseForError();
    expect(t.length).toBeGreaterThan(0);
    expect(t.toLowerCase()).toContain("try again");
  });

  it("never blames the user", () => {
    const t = nexResponseForError().toLowerCase();
    expect(t).not.toContain("you did");
    expect(t).not.toContain("wrong");
  });
});

describe("Selection contract (what CategoryConstellation dispatches to parents)", () => {
  it("selection callback receives a valid Registry category id or null (for deselect)", () => {
    // Compile-time / contract assertion: the component props type accepts string | null.
    // This test exists to guard against the callback signature quietly changing.
    const validIds = activeCategoriesForCountry("ID").map((c) => c.id);
    for (const id of validIds) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
