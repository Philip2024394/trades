// src/lib/nex/brain/presentation-expanded.test.ts
//
// Stage 3.34 · Phase 27c · Expanded 10-card page tests (Philip 2026-08-31).
//
// Locks in:
//   · vertical-agnostic 10-per-page pagination
//   · never fabricates fillers (fewer records → fewer cards)
//   · same evidence-driven action rules as the 3-card set
//   · headline reflects page X of Y or "Full list · N"
//   · hasNext/hasPrev correct at boundaries
//   · pageSize configurable (doctrine default 10)

import { describe, expect, it } from "vitest";
import { presentRecordsExpanded, presentRecords } from "./presentation";
import type { WorldRecord, WorldVertical } from "./world-adapters/types";

function fake(overrides: Partial<WorldRecord> & { id: string; name: string; vertical: WorldVertical }): WorldRecord {
  return {
    market: "ID",
    provenance: { sourceKey: "test", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00.000Z" },
    ...overrides,
  } as WorldRecord;
}

function makeSet(n: number, vertical: WorldVertical = "accommodation"): WorldRecord[] {
  return Array.from({ length: n }, (_, i) => fake({ id: `id${i + 1}`, name: `Item ${i + 1}`, vertical }));
}

describe("presentRecordsExpanded · pagination + slicing", () => {
  it("10 records total → page 1 has 10 cards · totalPages=1 · headline says 'Full list'", () => {
    const records = makeSet(10);
    const out = presentRecordsExpanded({ records, totalAvailable: 10, vertical: "accommodation", page: 1 });
    expect(out.cards).toHaveLength(10);
    expect(out.totalPages).toBe(1);
    expect(out.hasNext).toBe(false);
    expect(out.hasPrev).toBe(false);
    expect(out.headline).toBe("Full list · 10 real stays.");
    expect(out.caveat).toBeUndefined();
  });

  it("25 records → page 1 has 10 · page 2 has 10 · page 3 has 5 · totalPages=3", () => {
    const records = makeSet(25);
    const p1 = presentRecordsExpanded({ records, totalAvailable: 25, vertical: "accommodation", page: 1 });
    const p2 = presentRecordsExpanded({ records, totalAvailable: 25, vertical: "accommodation", page: 2 });
    const p3 = presentRecordsExpanded({ records, totalAvailable: 25, vertical: "accommodation", page: 3 });
    expect(p1.cards).toHaveLength(10);
    expect(p2.cards).toHaveLength(10);
    expect(p3.cards).toHaveLength(5);
    expect(p1.totalPages).toBe(3);
    expect(p2.totalPages).toBe(3);
    expect(p3.totalPages).toBe(3);
    expect(p1.hasPrev).toBe(false);
    expect(p1.hasNext).toBe(true);
    expect(p2.hasPrev).toBe(true);
    expect(p2.hasNext).toBe(true);
    expect(p3.hasPrev).toBe(true);
    expect(p3.hasNext).toBe(false);
  });

  it("slicing puts the right records on each page", () => {
    const records = makeSet(25);
    const p1 = presentRecordsExpanded({ records, totalAvailable: 25, vertical: "accommodation", page: 1 });
    const p2 = presentRecordsExpanded({ records, totalAvailable: 25, vertical: "accommodation", page: 2 });
    expect(p1.cards[0].name).toBe("Item 1");
    expect(p1.cards[9].name).toBe("Item 10");
    expect(p2.cards[0].name).toBe("Item 11");
    expect(p2.cards[9].name).toBe("Item 20");
  });

  it("page number > totalPages returns empty cards with page_out_of_range caveat", () => {
    const records = makeSet(5);
    const p9 = presentRecordsExpanded({ records, totalAvailable: 5, vertical: "accommodation", page: 9 });
    expect(p9.cards).toHaveLength(0);
    expect(p9.caveat).toBe("page_out_of_range");
  });

  it("zero records → 0 cards · no_real_matches caveat · totalPages=1", () => {
    const out = presentRecordsExpanded({ records: [], totalAvailable: 0, vertical: "accommodation", page: 1 });
    expect(out.cards).toHaveLength(0);
    expect(out.caveat).toBe("no_real_matches");
    expect(out.headline).toBe("No real stays matched.");
  });

  it("pageSize configurable · default 10 · custom 5 slices in fives", () => {
    const records = makeSet(12);
    const p1 = presentRecordsExpanded({ records, totalAvailable: 12, vertical: "accommodation", page: 1, pageSize: 5 });
    const p3 = presentRecordsExpanded({ records, totalAvailable: 12, vertical: "accommodation", page: 3, pageSize: 5 });
    expect(p1.cards).toHaveLength(5);
    expect(p3.cards).toHaveLength(2);
    expect(p1.totalPages).toBe(3);
    expect(p3.totalPages).toBe(3);
  });

  it("preSliced:true trusts the caller's slice · no re-slicing", () => {
    const preSliced = makeSet(3);
    const out = presentRecordsExpanded({
      records: preSliced, totalAvailable: 25, vertical: "accommodation",
      page: 2, preSliced: true,
    });
    expect(out.cards).toHaveLength(3);
    expect(out.totalPages).toBe(3);
    expect(out.currentPage).toBe(2);
  });
});

describe("presentRecordsExpanded · vertical-agnostic + evidence-driven actions", () => {
  it("food vertical → food nouns in headline", () => {
    const out = presentRecordsExpanded({
      records: makeSet(15, "food"), totalAvailable: 15, vertical: "food", page: 1,
    });
    expect(out.headline).toBe("Page 1 of 2 · 15 real places total.");
  });

  it("commerce vertical → product nouns · buy/add_to_cart actions on cards", () => {
    const out = presentRecordsExpanded({
      records: makeSet(3, "commerce"), totalAvailable: 3, vertical: "commerce", page: 1,
    });
    expect(out.headline).toBe("Full list · 3 real products.");
    const actions = out.cards[0].actions.map((a) => a.kind);
    expect(actions).toContain("buy");
    expect(actions).toContain("add_to_cart");
  });

  it("same evidence-driven action rules as the 3-card set (whatsapp presence)", () => {
    const withWA = fake({ id: "w1", name: "With WA", vertical: "accommodation", whatsapp: "+6281234567890" });
    const withoutWA = fake({ id: "w2", name: "No WA", vertical: "accommodation" });
    const out = presentRecordsExpanded({
      records: [withWA, withoutWA], totalAvailable: 2, vertical: "accommodation", page: 1,
    });
    const card1Actions = out.cards[0].actions.map((a) => a.kind);
    const card2Actions = out.cards[1].actions.map((a) => a.kind);
    expect(card1Actions).toContain("whatsapp");
    expect(card2Actions).not.toContain("whatsapp");
  });
});

describe("presentRecordsExpanded · doctrine parity with presentRecords", () => {
  it("same card shape for the same record · top-3 vs expanded page 1 first-3 identical", () => {
    const records = makeSet(20);
    const three = presentRecords({ records, totalAvailable: 20, vertical: "accommodation" });
    const expanded = presentRecordsExpanded({ records, totalAvailable: 20, vertical: "accommodation", page: 1 });
    for (let i = 0; i < 3; i++) {
      expect(expanded.cards[i].id).toBe(three.cards[i].id);
      expect(expanded.cards[i].name).toBe(three.cards[i].name);
      expect(expanded.cards[i].provenanceLabel).toBe(three.cards[i].provenanceLabel);
    }
  });
});
