// src/lib/nex/brain/presentation.test.ts
//
// Stage 3.34 · Phase 27 · Presentation capability tests (Philip 2026-08-31).
//
// Locks in the vertical-agnostic 3-card contract + evidence-driven
// actions + never-fabricate discipline.

import { describe, expect, it } from "vitest";
import { presentRecords } from "./presentation";
import type { WorldRecord, WorldVertical } from "./world-adapters/types";

function makeRecord(overrides: Partial<WorldRecord> & { id: string; name: string; vertical: WorldVertical }): WorldRecord {
  return {
    market: "ID",
    provenance: { sourceKey: "test", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00.000Z" },
    ...overrides,
  } as WorldRecord;
}

describe("presentRecords · card count discipline", () => {
  it("5 records → 3 cards (default max)", () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({ id: `a${i}`, name: `A${i}`, vertical: "accommodation" }),
    );
    const out = presentRecords({ records, totalAvailable: 5, vertical: "accommodation" });
    expect(out.cards).toHaveLength(3);
    expect(out.caveat).toBeUndefined();
    expect(out.headline).toBe("Showing 3 of 5 real stays.");
  });

  it("2 records → 2 cards · caveat only_2_available", () => {
    const records = Array.from({ length: 2 }, (_, i) =>
      makeRecord({ id: `a${i}`, name: `A${i}`, vertical: "accommodation" }),
    );
    const out = presentRecords({ records, totalAvailable: 2, vertical: "accommodation" });
    expect(out.cards).toHaveLength(2);
    expect(out.caveat).toBe("only_2_available");
    expect(out.headline).toBe("Found 2 real stays.");
  });

  it("1 record → 1 card · headline uses singular", () => {
    const records = [makeRecord({ id: "a1", name: "A1", vertical: "accommodation" })];
    const out = presentRecords({ records, totalAvailable: 1, vertical: "accommodation" });
    expect(out.cards).toHaveLength(1);
    expect(out.caveat).toBe("only_1_available");
    expect(out.headline).toBe("Found 1 real stay.");
  });

  it("0 records → 0 cards · caveat no_real_matches · NEVER fills fake cards", () => {
    const out = presentRecords({ records: [], totalAvailable: 0, vertical: "accommodation" });
    expect(out.cards).toHaveLength(0);
    expect(out.caveat).toBe("no_real_matches");
    expect(out.headline).toBe("No real stays matched.");
  });
});

describe("presentRecords · evidence-driven actions", () => {
  it("record with whatsapp gets whatsapp action", () => {
    const r = makeRecord({ id: "a1", name: "Griya Sentana", vertical: "accommodation", whatsapp: "+62812345678" });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "accommodation" });
    const kinds = out.cards[0].actions.map((a) => a.kind);
    expect(kinds).toContain("whatsapp");
    const wa = out.cards[0].actions.find((a) => a.kind === "whatsapp");
    expect(wa?.href).toBe("https://wa.me/62812345678");
    expect(wa?.disabled).toBeFalsy();
  });

  it("record without whatsapp gets NO whatsapp action", () => {
    const r = makeRecord({ id: "a1", name: "Griya Sentana", vertical: "accommodation" });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "accommodation" });
    const kinds = out.cards[0].actions.map((a) => a.kind);
    expect(kinds).not.toContain("whatsapp");
  });

  it("record with phone gets call action", () => {
    const r = makeRecord({ id: "a1", name: "X", vertical: "accommodation", phone: "+62812345678" });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "accommodation" });
    const call = out.cards[0].actions.find((a) => a.kind === "call");
    expect(call?.href).toBe("tel:62812345678");
  });

  it("record with coords gets directions action", () => {
    const r = makeRecord({ id: "a1", name: "X", vertical: "accommodation", latitude: -7.79, longitude: 110.36 });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "accommodation" });
    const dir = out.cards[0].actions.find((a) => a.kind === "directions");
    expect(dir?.href).toBe("https://maps.google.com/?q=-7.79,110.36");
  });

  it("accommodation book action is DISABLED · reason no_live_booking_integration", () => {
    const r = makeRecord({ id: "a1", name: "X", vertical: "accommodation" });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "accommodation" });
    const book = out.cards[0].actions.find((a) => a.kind === "book");
    expect(book?.disabled).toBe(true);
    expect(book?.reason).toBe("no_live_booking_integration");
  });

  it("commerce cards get buy + add_to_cart actions · both DISABLED", () => {
    const r = makeRecord({ id: "p1", name: "Headphones", vertical: "commerce" });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "commerce" });
    const buy   = out.cards[0].actions.find((a) => a.kind === "buy");
    const cart  = out.cards[0].actions.find((a) => a.kind === "add_to_cart");
    expect(buy?.disabled).toBe(true);
    expect(cart?.disabled).toBe(true);
  });
});

describe("presentRecords · never fabricates", () => {
  it("missing price = no price field · never invented 'From Rp 350,000'", () => {
    const r = makeRecord({ id: "a1", name: "X", vertical: "accommodation" });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "accommodation" });
    expect(out.cards[0].price).toBeUndefined();
  });

  it("price field only shows real price value", () => {
    const r = makeRecord({ id: "a1", name: "X", vertical: "accommodation", price: 250000 });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "accommodation" });
    expect(out.cards[0].price).toBe("Rp 250.000");
  });

  it("missing hero image stays undefined · never placeholder-defaulted", () => {
    const r = makeRecord({ id: "a1", name: "X", vertical: "accommodation" });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "accommodation" });
    expect(out.cards[0].heroImage).toBeUndefined();
  });

  it("missing rating stays undefined", () => {
    const r = makeRecord({ id: "a1", name: "X", vertical: "accommodation" });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "accommodation" });
    expect(out.cards[0].rating).toBeUndefined();
    expect(out.cards[0].reviewCount).toBeUndefined();
  });
});

describe("presentRecords · vertical-agnostic behaviour", () => {
  it("food vertical → 3 cards + food-noun headline", () => {
    const records = Array.from({ length: 3 }, (_, i) =>
      makeRecord({ id: `f${i}`, name: `F${i}`, vertical: "food" }),
    );
    const out = presentRecords({ records, totalAvailable: 10, vertical: "food" });
    expect(out.cards).toHaveLength(3);
    expect(out.headline).toBe("Showing 3 of 10 real places.");
  });

  it("commerce vertical → 3 cards + product-noun headline", () => {
    const records = Array.from({ length: 3 }, (_, i) =>
      makeRecord({ id: `p${i}`, name: `P${i}`, vertical: "commerce" }),
    );
    const out = presentRecords({ records, totalAvailable: 3, vertical: "commerce" });
    expect(out.headline).toBe("Found 3 real products.");
  });

  it("service vertical → provider noun", () => {
    const records = [makeRecord({ id: "s1", name: "S1", vertical: "service" })];
    const out = presentRecords({ records, totalAvailable: 1, vertical: "service" });
    expect(out.headline).toBe("Found 1 real provider.");
  });
});

describe("presentRecords · provenance label", () => {
  it("claimed directory listing shows 'NEX directory · claimed'", () => {
    const r = makeRecord({
      id: "a1", name: "X", vertical: "accommodation",
      claimStatus: "claimed",
    });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "accommodation" });
    expect(out.cards[0].provenanceLabel).toBe("NEX directory · claimed");
  });

  it("listed directory row shows 'NEX directory · listed'", () => {
    const r = makeRecord({
      id: "a1", name: "X", vertical: "accommodation",
      claimStatus: "listed",
    });
    const out = presentRecords({ records: [r], totalAvailable: 1, vertical: "accommodation" });
    expect(out.cards[0].provenanceLabel).toBe("NEX directory · listed");
  });
});
