// src/lib/nex/brain/compare-from-world.test.ts
//
// Stage 3.35 · Phase B · Comparison over live WorldRecords tests
// (Philip 2026-08-31).
//
// Constitutional invariants:
//   · NEVER manufactures a winner
//   · Missing values render as "—" or "Unavailable" · never blank
//   · Observations only for defensible per-field claims
//   · pickHint always hedged · never says "best overall"
//   · When zero evidence available, reply says so explicitly
//   · Bilingual EN + ID reply text

import { describe, expect, it } from "vitest";
import { compareFromWorld } from "./compare-from-world";
import type { WorldRecord, WorldVertical } from "./world-adapters/types";

function rec(overrides: Partial<WorldRecord> & { id: string; name: string; vertical?: WorldVertical }): WorldRecord {
  return {
    vertical: overrides.vertical ?? "accommodation",
    market: "ID",
    category: overrides.vertical === "commerce" ? "new" : "hotel",
    city: "Yogyakarta",
    provenance: { sourceKey: "test", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
    ...overrides,
  };
}

describe("compareFromWorld · never manufactures a winner", () => {
  it("all cells null → observations empty · pickHint undefined · reply says so", () => {
    const A = rec({ id: "1", name: "Indonesia Hotel" });
    const B = rec({ id: "2", name: "Gaotama Hotel" });
    const C = rec({ id: "3", name: "Summer Season" });
    const out = compareFromWorld({ records: [A, B, C], vertical: "accommodation" });
    expect(out.compared).toBe(true);
    if (out.compared) {
      expect(out.observations).toHaveLength(0);
      expect(out.pickHint).toBeUndefined();
      expect(out.replyText.en).toContain("can't make any defensible claim");
      // Every cell in the rating column reports missing
      for (const row of out.rows) {
        const ratingCell = row.cells.find((c) => c.column === "rating")!;
        expect(ratingCell.present).toBe(false);
        expect(ratingCell.display).toBe("Unavailable");
      }
    }
  });

  it("distance-only evidence → hedged pickHint (closest) · NEVER claims overall best", () => {
    const A = rec({ id: "1", name: "Close",  latitude: -7.795, longitude: 110.366 });
    const B = rec({ id: "2", name: "Middle", latitude: -7.82,  longitude: 110.37 });
    const C = rec({ id: "3", name: "Far",    latitude: -7.90,  longitude: 110.45 });
    const out = compareFromWorld({ records: [A, B, C], vertical: "accommodation", slotArea: "malioboro" });
    if (out.compared) {
      expect(out.pickHint).toBeDefined();
      expect(out.pickHint!.recordId).toBe("1");
      expect(out.pickHint!.hedged).toBe(true);
      expect(out.pickHint!.reason).toContain("closest");
      expect(out.replyText.en).toContain("not the same as saying it's the best overall");
    }
  });

  it("distance-tied → NO pickHint (would be misleading)", () => {
    // Both very close · within 100m threshold
    const A = rec({ id: "1", name: "A", latitude: -7.7929, longitude: 110.3660 });
    const B = rec({ id: "2", name: "B", latitude: -7.7930, longitude: 110.3665 });
    const out = compareFromWorld({ records: [A, B], vertical: "accommodation", slotArea: "malioboro" });
    if (out.compared) {
      expect(out.pickHint).toBeUndefined();
    }
  });
});

describe("compareFromWorld · missing-value discipline", () => {
  it("mixed availability · some cells 'Yes' or number · missing render '—' or 'Unavailable'", () => {
    const A = rec({ id: "1", name: "A", whatsapp: "+6280000000000", rating: 4.5, reviewCount: 100 });
    const B = rec({ id: "2", name: "B", rating: 4.7, reviewCount: 200 });
    const out = compareFromWorld({ records: [A, B], vertical: "accommodation" });
    if (out.compared) {
      const rowA = out.rows.find((r) => r.recordId === "1")!;
      const rowB = out.rows.find((r) => r.recordId === "2")!;
      expect(rowA.cells.find((c) => c.column === "whatsapp")!.display).toBe("Yes");
      expect(rowB.cells.find((c) => c.column === "whatsapp")!.display).toBe("—");
      expect(rowA.cells.find((c) => c.column === "price")!.display).toBe("Unavailable");
      expect(rowB.cells.find((c) => c.column === "price")!.display).toBe("Unavailable");
    }
  });

  it("unavailable list enumerates fields no candidate publishes", () => {
    const A = rec({ id: "1", name: "A", rating: 4.5, reviewCount: 100 });
    const B = rec({ id: "2", name: "B", rating: 4.7, reviewCount: 200 });
    const out = compareFromWorld({ records: [A, B], vertical: "accommodation" });
    if (out.compared) {
      const unavailFields = out.unavailable.map((u) => u.field);
      expect(unavailFields).toContain("price");
      expect(unavailFields).toContain("whatsapp");
      expect(unavailFields).toContain("phone");
      expect(unavailFields).toContain("amenities");
    }
  });
});

describe("compareFromWorld · defensible observations", () => {
  it("rating-diff above 0.15 → observation cites highest rated", () => {
    const A = rec({ id: "1", name: "Top",    rating: 4.9, reviewCount: 100 });
    const B = rec({ id: "2", name: "Middle", rating: 4.3, reviewCount: 100 });
    const C = rec({ id: "3", name: "Low",    rating: 3.8, reviewCount: 100 });
    const out = compareFromWorld({ records: [A, B, C], vertical: "accommodation" });
    if (out.compared) {
      const ratingObs = out.observations.find((o) => o.field === "rating");
      expect(ratingObs).toBeDefined();
      expect(ratingObs!.claim).toContain("Top");
      expect(ratingObs!.claim).toContain("4.9");
    }
  });

  it("rating-diff below 0.15 (essentially tied) → NO rating observation", () => {
    const A = rec({ id: "1", name: "A", rating: 4.4, reviewCount: 100 });
    const B = rec({ id: "2", name: "B", rating: 4.5, reviewCount: 100 });
    const out = compareFromWorld({ records: [A, B], vertical: "accommodation" });
    if (out.compared) {
      expect(out.observations.find((o) => o.field === "rating")).toBeUndefined();
    }
  });

  it("partial-availability field (only some have whatsapp) → observation names who does", () => {
    const A = rec({ id: "1", name: "HasWA", whatsapp: "+6280000000000", rating: 4.5, reviewCount: 100 });
    const B = rec({ id: "2", name: "NoWA",  rating: 4.7, reviewCount: 200 });
    const out = compareFromWorld({ records: [A, B], vertical: "accommodation" });
    if (out.compared) {
      const waObs = out.observations.find((o) => o.field === "whatsapp");
      expect(waObs).toBeDefined();
      expect(waObs!.claim).toContain("HasWA");
      expect(waObs!.claim).toContain("WhatsApp");
    }
  });
});

describe("compareFromWorld · insufficient candidates", () => {
  it("1 record → compared:false insufficient_candidates", () => {
    const out = compareFromWorld({ records: [rec({ id: "1", name: "Solo" })], vertical: "accommodation" });
    expect(out.compared).toBe(false);
    if (!out.compared) {
      expect(out.reason).toBe("insufficient_candidates");
      expect(out.message.en).toContain("at least two");
    }
  });

  it("0 records → compared:false no_candidates", () => {
    const out = compareFromWorld({ records: [], vertical: "accommodation" });
    expect(out.compared).toBe(false);
    if (!out.compared) {
      expect(out.reason).toBe("no_candidates");
    }
  });
});

describe("compareFromWorld · vertical-agnostic column selection", () => {
  it("commerce vertical · price + availability + condition columns", () => {
    const A = rec({ id: "1", name: "P1", vertical: "commerce", price: 100000, availability: "available" });
    const B = rec({ id: "2", name: "P2", vertical: "commerce", price: 200000, availability: "limited" });
    const out = compareFromWorld({ records: [A, B], vertical: "commerce" });
    if (out.compared) {
      const fieldNames = out.columns.map((c) => c.field);
      expect(fieldNames).toContain("price");
      expect(fieldNames).toContain("availability");
      expect(fieldNames).not.toContain("distance");
      expect(fieldNames).not.toContain("amenities");
    }
  });

  it("commerce price-diff → observation cites cheapest", () => {
    const A = rec({ id: "1", name: "Cheap",  vertical: "commerce", price: 500000 });
    const B = rec({ id: "2", name: "Pricey", vertical: "commerce", price: 3000000 });
    const out = compareFromWorld({ records: [A, B], vertical: "commerce" });
    if (out.compared) {
      const priceObs = out.observations.find((o) => o.field === "price");
      expect(priceObs).toBeDefined();
      expect(priceObs!.claim).toContain("Cheap");
      expect(priceObs!.claim).toContain("cheapest");
      expect(priceObs!.claim).toContain("500.000");
    }
  });

  it("transport vertical · rating + reviews + price + amenities columns", () => {
    const A = rec({ id: "1", name: "D1", vertical: "transport", rating: 4.8, reviewCount: 20, price: 50000, amenities: ["honda-vario"] });
    const B = rec({ id: "2", name: "D2", vertical: "transport", rating: 4.5, reviewCount: 15, price: 60000, amenities: ["yamaha-nmax"] });
    const out = compareFromWorld({ records: [A, B], vertical: "transport" });
    if (out.compared) {
      const fieldNames = out.columns.map((c) => c.field);
      expect(fieldNames).toContain("rating");
      expect(fieldNames).toContain("amenities");
    }
  });
});

describe("compareFromWorld · bilingual reply text", () => {
  it("ID reply uses Indonesian phrasing", () => {
    const A = rec({ id: "1", name: "A", rating: 4.9, reviewCount: 100 });
    const B = rec({ id: "2", name: "B", rating: 4.3, reviewCount: 100 });
    const out = compareFromWorld({ records: [A, B], vertical: "accommodation" });
    if (out.compared) {
      expect(out.replyText.id).toContain("Membandingkan");
      expect(out.replyText.id).toContain("rating tertinggi");
    }
  });
});
