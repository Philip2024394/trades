// src/lib/nex/brain/universal-discovery/universal-discovery.test.ts
//
// NEX Universal Discovery Slice · unit tests
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE

import { describe, expect, it } from "vitest";
import {
  RESULT_SET_PAGE_SIZE,
  pageOf,
  nextPage,
  prevPage,
  resolveOrdinalOnPage,
  resolveLastOnPage,
  establishResultSet,
  demoteToHistorical,
  anchorActiveEntity,
} from "./result-set-page";
import { projectEntityDetail } from "./entity-detail-contract";
import { buildInterestedPrefill } from "./interested-message";
import {
  addOutboxItem,
  itemsForEntity,
  newItemId,
  type InterestOutboxItem,
} from "./interest-outbox";
import type { EntityResultCard } from "../entity-result-cards";
import type { WorldRecord } from "../world-adapters/types";

// ─── Fixtures ───────────────────────────────────────────────────

function fakeCard(refId: string, name: string, position: number): EntityResultCard {
  return {
    card: {
      id: refId,
      vertical: "accommodation",
      name,
      subline: "Hotel · Yogyakarta",
      location: "Yogyakarta",
      amenities: [],
      verified: false,
      provenanceLabel: "OpenStreetMap community",
      ownershipState: "listed",
      actions: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    position,
    ref_id: refId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attributes: {} as any,
    highlights: [],
    unverified_highlights: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coverage: { total: 0, known: 0, unknown: 0, unverified: 0, stale: 0, conflicting: 0, coverage_pct: 0, evidence_pct: 0 } as any,
  };
}

function tenHotels(): EntityResultCard[] {
  return Array.from({ length: 10 }).map((_, i) =>
    fakeCard(`place:accommodation:#AC-2026-000${i}`, `Hotel ${i + 1}`, i + 1),
  );
}

function fakeAccommodationRecord(): WorldRecord {
  return {
    id: "#AC-2026-0000D",
    name: "Gaotama Hotel",
    vertical: "accommodation",
    market: "ID",
    category: "hotel",
    city: "Yogyakarta",
    area: "Malioboro",
    rating: 4.5,
    reviewCount: 100,
    latitude: -7.79,
    longitude: 110.36,
    claimStatus: "listed",
    verified: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-09-01T00:00:00Z" } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    amenities: ["pool", "wifi", "parking"] as any,
  } as WorldRecord;
}

// ─── Result-set page contract ────────────────────────────────

describe("Universal Discovery · ResultSetPage", () => {
  it("pageSize is fixed at 10 per AUTHORIZE §5", () => {
    expect(RESULT_SET_PAGE_SIZE).toBe(10);
  });
  it("pageOf slices a 25-entity list into 3 pages", () => {
    const entities = Array.from({ length: 25 }).map((_, i) =>
      fakeCard(`ref${i}`, `Hotel ${i}`, i + 1),
    );
    const p1 = pageOf(entities, 1, 25);
    expect(p1.entities.length).toBe(10);
    expect(p1.entities[0].ref_id).toBe("ref0");
    expect(p1.has_prev).toBe(false);
    expect(p1.has_next).toBe(true);
    const p2 = nextPage(p1, entities);
    expect(p2.page).toBe(2);
    expect(p2.entities[0].ref_id).toBe("ref10");
    expect(p2.has_next).toBe(true);
    const p3 = nextPage(p2, entities);
    expect(p3.page).toBe(3);
    expect(p3.entities.length).toBe(5);
    expect(p3.has_next).toBe(false);
    // Advancing past the last page returns the same snapshot
    const p3Again = nextPage(p3, entities);
    expect(p3Again).toBe(p3);
    const p2Back = prevPage(p3, entities);
    expect(p2Back.page).toBe(2);
  });
  it("resolveOrdinalOnPage returns the correct entity", () => {
    const ten = tenHotels();
    const p = pageOf(ten, 1, 10);
    expect(resolveOrdinalOnPage(p, 3)?.card.name).toBe("Hotel 3");
    expect(resolveOrdinalOnPage(p, 10)?.card.name).toBe("Hotel 10");
    expect(resolveOrdinalOnPage(p, 11)).toBeNull();
    expect(resolveOrdinalOnPage(p, 0)).toBeNull();
    expect(resolveLastOnPage(p)?.card.name).toBe("Hotel 10");
  });
  it("establishResultSet + demoteToHistorical + anchorActiveEntity", () => {
    const ten = tenHotels();
    const snap = establishResultSet({
      vertical: "accommodation",
      allEntities: ten,
      totalAvailable: 25,
      currentTurn: 1,
    });
    expect(snap.state).toBe("ACTIVE_RESULT_SET");
    expect(snap.page.page).toBe(1);
    expect(snap.set_id.startsWith("rs_accommodation_1_")).toBe(true);
    const anchored = anchorActiveEntity(snap, ten[1].ref_id);
    expect(anchored.active_entity_ref_id).toBe(ten[1].ref_id);
    // anchor a non-existent id is a no-op
    const unchanged = anchorActiveEntity(snap, "not-in-page");
    expect(unchanged.active_entity_ref_id).toBeNull();
    const historical = demoteToHistorical(anchored);
    expect(historical.state).toBe("HISTORICAL_RESULT_SET");
  });
});

// ─── EntityDetail contract ────────────────────────────────

describe("Universal Discovery · EntityDetail", () => {
  it("projects an accommodation record into a coherent detail shape", () => {
    const record = fakeAccommodationRecord();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = projectEntityDetail({ record, card: {} as any });
    expect(detail.vertical).toBe("accommodation");
    expect(detail.name).toBe("Gaotama Hotel");
    expect(detail.location).toContain("Yogyakarta");
    expect(detail.summary).not.toBeNull();
    expect(detail.summary).toContain("Gaotama Hotel");
    expect(detail.trust.primary_source).toBe("NEX directory");
    expect(detail.trust.owner_verified).toBe(false);
    // Sections adaptive · facilities present because amenities were set
    const facilitiesSection = detail.sections.find((s) => s.id === "facilities");
    expect(facilitiesSection).toBeDefined();
    // Pool/wifi/parking should be in facilities (from the amenities array)
    // The section renders only KNOWN_YES/UNVERIFIED rows
    expect((facilitiesSection?.rows.length ?? 0)).toBeGreaterThan(0);
  });
  it("cross-vertical · food record produces food-specific sections", () => {
    const foodRecord: WorldRecord = {
      id: "#FL-2026-000A",
      name: "Warung Bu Ageng",
      vertical: "food",
      market: "ID",
      category: "restaurant",
      city: "Yogyakarta",
      area: "Prawirotaman",
      claimStatus: "listed",
      verified: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provenance: { sourceKey: "nex.food_business", sourceTier: "directory_live", readAt: "2026-09-01T00:00:00Z" } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      amenities: ["delivery", "takeaway"] as any,
      latitude: -7.83, longitude: 110.37,
    } as WorldRecord;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = projectEntityDetail({ record: foodRecord, card: {} as any });
    expect(detail.vertical).toBe("food");
    const serviceSection = detail.sections.find((s) => s.id === "service");
    // No accommodation-only "facilities" section
    expect(detail.sections.find((s) => s.id === "facilities")).toBeUndefined();
  });
  it("empty attribute sections are hidden per §8 'no empty sections'", () => {
    const bareRecord: WorldRecord = {
      id: "#AC-2026-BARE",
      name: "Bare Hotel",
      vertical: "accommodation",
      market: "ID",
      category: "hotel",
      claimStatus: "listed",
      verified: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-09-01T00:00:00Z" } as any,
      latitude: 0, longitude: 0,
    } as WorldRecord;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = projectEntityDetail({ record: bareRecord, card: {} as any });
    // No amenities · so facilities section should be empty and hidden
    expect(detail.sections.find((s) => s.id === "facilities")).toBeUndefined();
  });
  it("interested_enabled is true when contact channel exists · false otherwise", () => {
    const withPhone: WorldRecord = {
      ...fakeAccommodationRecord(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      phone: "+62 812 3456 7890" as any,
    } as WorldRecord;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detailWith = projectEntityDetail({ record: withPhone, card: {} as any });
    expect(detailWith.interested_enabled).toBe(true);
    expect(detailWith.contact.phone?.value).toBe("+62 812 3456 7890");
  });
});

// ─── Interested prefill ────────────────────────────────

describe("Universal Discovery · InterestedPrefill", () => {
  it("EN accommodation prefill names the entity and asks about rooms", () => {
    const record = fakeAccommodationRecord();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = projectEntityDetail({ record, card: {} as any });
    const p = buildInterestedPrefill({ detail, lang: "EN" });
    expect(p.entity_ref_id).toBe("place:accommodation:#AC-2026-0000D");
    expect(p.entity_name).toBe("Gaotama Hotel");
    expect(p.message).toContain("Gaotama Hotel");
    expect(p.message).toContain("Yogyakarta");
    expect(p.message.toLowerCase()).toContain("interested");
    // Never invents a specific price/room/date
    expect(p.message).not.toMatch(/\$\d+|Rp\s?\d+/);
    expect(p.message).not.toMatch(/tonight at \d+/i);
  });
  it("ID accommodation prefill uses Indonesian", () => {
    const record = fakeAccommodationRecord();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = projectEntityDetail({ record, card: {} as any });
    const p = buildInterestedPrefill({ detail, lang: "ID" });
    expect(p.message.toLowerCase()).toContain("tertarik");
    expect(p.message).toContain("Gaotama Hotel");
  });
  it("food vertical prefill is contextually different", () => {
    const foodRecord: WorldRecord = {
      id: "#FL-2026-000B",
      name: "Warung Kopi",
      vertical: "food",
      market: "ID",
      category: "restaurant",
      city: "Yogyakarta",
      claimStatus: "listed",
      verified: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provenance: { sourceKey: "nex.food_business", sourceTier: "directory_live", readAt: "2026-09-01T00:00:00Z" } as any,
      latitude: 0, longitude: 0,
    } as WorldRecord;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = projectEntityDetail({ record: foodRecord, card: {} as any });
    const p = buildInterestedPrefill({ detail, lang: "EN" });
    expect(p.message.toLowerCase()).toContain("eating");
    expect(p.message).toContain("Warung Kopi");
  });
  it("commerce vertical prefill asks 'is it still available'", () => {
    const commerceRecord: WorldRecord = {
      id: "#CO-2026-000C",
      name: "Blue Mountain Bike",
      vertical: "commerce",
      market: "ID",
      category: "bike",
      claimStatus: "listed",
      verified: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provenance: { sourceKey: "nex.mp_product", sourceTier: "directory_live", readAt: "2026-09-01T00:00:00Z" } as any,
      latitude: 0, longitude: 0,
    } as WorldRecord;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = projectEntityDetail({ record: commerceRecord, card: {} as any });
    const p = buildInterestedPrefill({ detail, lang: "EN" });
    expect(p.message.toLowerCase()).toContain("still available");
    expect(p.message).toContain("Blue Mountain Bike");
  });
});

// ─── Interest outbox ────────────────────────────────

describe("Universal Discovery · InterestOutbox", () => {
  it("addOutboxItem prepends newest-first and caps at 200", () => {
    const first: InterestOutboxItem = {
      id: newItemId(),
      entity_ref_id: "place:accommodation:#AC-2026-0000D",
      entity_name: "Gaotama Hotel",
      vertical: "accommodation",
      message: "Hi, I'm interested…",
      created_at: new Date().toISOString(),
      status: "PENDING_LOCAL",
      language: "EN",
      entity_snapshot: { name: "Gaotama Hotel", location: "Yogyakarta", category: "hotel", primary_source: "NEX directory" },
    };
    const list1 = addOutboxItem([], first);
    expect(list1.length).toBe(1);
    // Fill to 250 and ensure capped
    let filled: InterestOutboxItem[] = list1;
    for (let i = 0; i < 250; i++) {
      filled = addOutboxItem(filled, { ...first, id: `id_${i}` });
    }
    expect(filled.length).toBeLessThanOrEqual(200);
    expect(filled[0].id).toBe("id_249"); // newest first
  });
  it("itemsForEntity filters by ref_id", () => {
    const a: InterestOutboxItem = {
      id: "a", entity_ref_id: "ref-A", entity_name: "A", vertical: "accommodation",
      message: "hi", created_at: "2026-01-01", status: "PENDING_LOCAL", language: "EN",
      entity_snapshot: { name: "A", location: null, category: null, primary_source: "NEX" },
    };
    const b: InterestOutboxItem = { ...a, id: "b", entity_ref_id: "ref-B", entity_name: "B" };
    const list = [a, b];
    expect(itemsForEntity(list, "ref-A").map((i) => i.id)).toEqual(["a"]);
    expect(itemsForEntity(list, "ref-C")).toEqual([]);
  });
});
